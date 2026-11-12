const express = require('express');
const pool = require('../config/db');
const { authorize, requireAuth } = require('../middlewares/auth');
const {
  allocationsWithinBalances,
  calculateBenefit,
  fromCents,
  toCents,
  validMoney,
  validPlanConfiguration,
  validateAllocations,
  validateInstallments
} = require('../services/tesoreriaUtils');

const router = express.Router();
const staff = [requireAuth, authorize('Administrador', 'Secretaría')];
const admin = [requireAuth, authorize('Administrador')];
const cents = toCents;
const money = fromCents;
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
async function getBenefits(connection, studentPlanId) {
  const [scholarships] = await connection.query(
    `SELECT b.tipo,b.valor FROM estudiante_becas eb
     JOIN becas b ON b.id_beca=eb.id_beca
     WHERE eb.id_estudiante_plan=? AND eb.estado='Autorizada' AND b.estado='Activa'`,
    [studentPlanId]
  );
  const [discounts] = await connection.query(
    `SELECT d.tipo,d.valor FROM estudiante_descuentos ed
     JOIN descuentos d ON d.id_descuento=ed.id_descuento
     WHERE ed.id_estudiante_plan=? AND ed.estado='Autorizado' AND d.estado='Activo'`,
    [studentPlanId]
  );
  return [...scholarships, ...discounts];
}

async function refreshObligationState(connection, obligationId) {
  const [[balance]] = await connection.query(
    `SELECT o.monto,COALESCE(SUM(CASE WHEN p.estado='Registrado' THEN pd.monto_aplicado ELSE 0 END),0) AS pagado
     FROM obligaciones_pago o
     LEFT JOIN pago_detalles pd ON pd.id_obligacion=o.id_obligacion
     LEFT JOIN pagos p ON p.id_pago=pd.id_pago
     WHERE o.id_obligacion=? GROUP BY o.id_obligacion`,
    [obligationId]
  );
  const paidCents = cents(balance.pagado);
  const dueCents = cents(balance.monto);
  await connection.query(
    "UPDATE obligaciones_pago SET estado=? WHERE id_obligacion=? AND estado<>'Anulado'",
    [paidCents >= dueCents ? 'Pagado' : 'Pendiente', obligationId]
  );
  return { due: money(Math.max(0, dueCents - paidCents)), paid: money(paidCents) };
}

async function studentSchedule(studentId, periodId = null) {
  const values = [studentId];
  const periodFilter = periodId ? ' AND o.id_periodo=?' : '';
  if (periodId) values.push(periodId);
  const [rows] = await pool.query(
    `SELECT o.id_obligacion,o.id_periodo,o.id_concepto,o.monto AS monto_exigible,
            o.fecha_vencimiento,o.estado AS estado_registrado,p.codigo AS periodo,c.nombre AS concepto,
            e.dni,e.nombres,e.apellidos,
            pcp.id_estudiante_plan,pp.nombre AS plan_nombre,pp.moneda,
            COALESCE(t.pagado,0) AS pagado,
            GREATEST(o.monto-COALESCE(t.pagado,0),0) AS saldo,
            CASE WHEN o.estado='Anulado' THEN 'Anulada'
                 WHEN GREATEST(o.monto-COALESCE(t.pagado,0),0)<=0 THEN 'Pagada'
                 WHEN COALESCE(t.pagado,0)>0 THEN 'Parcial'
                 WHEN o.fecha_vencimiento<CURDATE() THEN 'Vencida'
                 ELSE 'Pendiente' END AS estado_calculado
     FROM obligaciones_pago o
     JOIN estudiantes e ON e.id_estudiante=o.id_estudiante
     JOIN periodos_academicos p ON p.id_periodo=o.id_periodo
     JOIN conceptos_pago c ON c.id_concepto=o.id_concepto
     LEFT JOIN plan_cuota_obligaciones pcp ON pcp.id_obligacion=o.id_obligacion
     LEFT JOIN estudiante_planes_pago ep ON ep.id_estudiante_plan=pcp.id_estudiante_plan
     LEFT JOIN planes_pago pp ON pp.id_plan_pago=ep.id_plan_pago
     LEFT JOIN (
       SELECT pd.id_obligacion,SUM(pd.monto_aplicado) AS pagado
       FROM pago_detalles pd JOIN pagos pg ON pg.id_pago=pd.id_pago AND pg.estado='Registrado'
       GROUP BY pd.id_obligacion
     ) t ON t.id_obligacion=o.id_obligacion
     WHERE o.id_estudiante=?${periodFilter}
     ORDER BY p.codigo DESC,o.fecha_vencimiento,o.id_obligacion`,
    values
  );
  return rows;
}

router.get('/catalogos', ...staff, async (req, res, next) => {
  try {
    const [careers, periods, concepts, students] = await Promise.all([
      pool.query("SELECT id_carrera,codigo,nombre FROM carreras WHERE estado='Activo' ORDER BY nombre"),
      pool.query("SELECT id_periodo,codigo,nombre,fecha_inicio,fecha_fin FROM periodos_academicos ORDER BY fecha_inicio DESC"),
      pool.query("SELECT id_concepto,nombre,monto_base FROM conceptos_pago WHERE estado='Activo' ORDER BY nombre"),
      pool.query(
        `SELECT DISTINCT e.id_estudiante,e.dni,e.nombres,e.apellidos,m.periodo,p.id_periodo
         FROM matriculas m JOIN estudiantes e ON e.id_estudiante=m.id_estudiante
         LEFT JOIN periodos_academicos p ON p.codigo=m.periodo
         WHERE m.estado='Matriculado' AND e.estado='Activo'
         ORDER BY e.apellidos,e.nombres`
      )
    ]);
    return res.json({ success: true, data: { carreras: careers[0], periodos: periods[0], conceptos: concepts[0], estudiantes: students[0] } });
  } catch (error) {
    return next(error);
  }
});

router.get('/planes', ...staff, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT pp.*,c.nombre AS carrera,p.codigo AS periodo,
              COUNT(pc.id_plan_pago_cuota) AS cuotas,COALESCE(SUM(pc.monto),0) AS total_cronograma
       FROM planes_pago pp
       LEFT JOIN carreras c ON c.id_carrera=pp.id_carrera
       LEFT JOIN periodos_academicos p ON p.id_periodo=pp.id_periodo
       LEFT JOIN plan_pago_cuotas pc ON pc.id_plan_pago=pp.id_plan_pago
       GROUP BY pp.id_plan_pago ORDER BY pp.fecha_creacion DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/planes', ...staff, async (req, res, next) => {
  const { codigo, nombre, modalidad, numero_cuotas, moneda = 'PEN', monto_total, id_carrera, id_periodo, descripcion, cuotas } = req.body;
  const installmentCount = Number(numero_cuotas);
  const totalCents = cents(monto_total);
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(String(codigo || ''))
      || !String(nombre || '').trim() || !validPlanConfiguration(modalidad, installmentCount)
      || moneda !== 'PEN' || !validMoney(monto_total) || !Number.isInteger(totalCents) || totalCents < 1
      || !Array.isArray(cuotas) || cuotas.length !== installmentCount) {
    return res.status(400).json({ success: false, message: 'Revisa código, modalidad, moneda PEN, monto y cantidad de cuotas.' });
  }
  const normalized = cuotas.map((item, index) => ({
    numero: Number(item.numero_cuota),
    idConcept: Number(item.id_concepto),
    amount: cents(item.monto),
    offset: Number(item.dias_desde_inicio)
  }));
  if (!validateInstallments(normalized.map((item) => ({
    numero_cuota: item.numero,
    id_concepto: item.idConcept,
    monto: money(item.amount),
    dias_desde_inicio: item.offset
  })), totalCents, installmentCount)) {
    return res.status(400).json({ success: false, message: 'Las cuotas deben numerarse en orden y sumar exactamente el total del plan.' });
  }

  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO planes_pago
       (codigo,nombre,modalidad,numero_cuotas,moneda,monto_total,id_carrera,id_periodo,descripcion,creado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [codigo.trim(), nombre.trim().slice(0, 120), modalidad, installmentCount, moneda,
        money(totalCents), id_carrera || null, id_periodo || null, String(descripcion || '').trim().slice(0, 250) || null, req.auth.id]
    );
    for (const installment of normalized) {
      await connection.query(
        'INSERT INTO plan_pago_cuotas (id_plan_pago,numero_cuota,id_concepto,monto,dias_desde_inicio) VALUES (?,?,?,?,?)',
        [result.insertId, installment.numero, installment.idConcept, money(installment.amount), installment.offset]
      );
    }
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Plan creado.', data: { id_plan_pago: result.insertId } });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.get('/beneficios', ...staff, async (req, res, next) => {
  try {
    const [scholarships, discounts] = await Promise.all([
      pool.query('SELECT * FROM becas ORDER BY id_beca DESC'),
      pool.query('SELECT * FROM descuentos ORDER BY id_descuento DESC')
    ]);
    return res.json({ success: true, data: { becas: scholarships[0], descuentos: discounts[0] } });
  } catch (error) {
    return next(error);
  }
});

router.post('/beneficios', ...admin, async (req, res, next) => {
  const { clase, codigo, nombre, tipo, valor, descripcion, fecha_inicio, fecha_fin } = req.body;
  const table = clase === 'beca' ? 'becas' : clase === 'descuento' ? 'descuentos' : null;
  const activeState = clase === 'beca' ? 'Activa' : 'Activo';
  const amount = Number(valor);
  if (!table || !/^[A-Za-z0-9._-]{3,30}$/.test(String(codigo || '')) || !String(nombre || '').trim()
      || !['Porcentaje','Monto'].includes(tipo) || !validMoney(valor) || !Number.isFinite(amount) || amount <= 0
      || (tipo === 'Porcentaje' && amount > 100)
      || (fecha_inicio && !validDate(fecha_inicio)) || (fecha_fin && !validDate(fecha_fin))
      || (fecha_inicio && fecha_fin && fecha_fin < fecha_inicio)) {
    return res.status(400).json({ success: false, message: 'Datos del beneficio inválidos.' });
  }
  try {
    const column = clase === 'beca' ? 'id_beca' : 'id_descuento';
    const [result] = await pool.query(
      `INSERT INTO ${table} (codigo,nombre,tipo,valor,descripcion,fecha_inicio,fecha_fin,estado,creado_por)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [codigo.trim(), nombre.trim().slice(0, 120), tipo, amount,
        String(descripcion || '').trim().slice(0, 250) || null,
        fecha_inicio || null, fecha_fin || null, activeState, req.auth.id]
    );
    return res.status(201).json({ success: true, data: { [column]: result.insertId }, message: 'Beneficio creado.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/asignaciones', ...staff, async (req, res, next) => {
  const { id_plan_pago, id_estudiante, id_periodo, fecha_inicio, becas = [], descuentos = [] } = req.body;
  if (![id_plan_pago, id_estudiante, id_periodo].every((id) => Number.isInteger(Number(id)) && Number(id) > 0)
      || !validDate(fecha_inicio) || !Array.isArray(becas) || !Array.isArray(descuentos)) {
    return res.status(400).json({ success: false, message: 'Plan, estudiante, periodo y fecha de inicio son obligatorios.' });
  }
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    if ((becas.length || descuentos.length) && !req.auth.roles.includes('Administrador')) {
      throw fail(403, 'Solo un administrador puede autorizar becas y descuentos al asignar un plan.');
    }
    const [[student]] = await connection.query('SELECT id_estudiante FROM estudiantes WHERE id_estudiante=? AND estado=\'Activo\' FOR UPDATE', [id_estudiante]);
    const [[plan]] = await connection.query('SELECT * FROM planes_pago WHERE id_plan_pago=? AND estado=\'Activo\' FOR UPDATE', [id_plan_pago]);
    const [[period]] = await connection.query('SELECT id_periodo,codigo,fecha_inicio FROM periodos_academicos WHERE id_periodo=?', [id_periodo]);
    if (!student || !plan || !period) throw fail(400, 'Estudiante, plan o periodo no existe o está inactivo.');
    if (plan.id_periodo && Number(plan.id_periodo) !== Number(id_periodo)) throw fail(400, 'El plan no corresponde al periodo seleccionado.');
    const [enrollments] = await connection.query(
      `SELECT m.id_matricula,m.id_curso FROM matriculas m
       WHERE m.id_estudiante=? AND m.periodo=? AND m.estado='Matriculado' FOR UPDATE`,
      [id_estudiante, period.codigo]
    );
    if (!enrollments.length) throw fail(400, 'El estudiante no tiene matrícula activa en este periodo.');
    if (plan.id_carrera) {
      const [careerEnrollment] = await connection.query(
        `SELECT 1 FROM matriculas m
         JOIN plan_cursos pc ON pc.id_curso=m.id_curso
         JOIN planes_estudio pe ON pe.id_plan=pc.id_plan AND pe.id_carrera=?
         WHERE m.id_estudiante=? AND m.periodo=? AND m.estado='Matriculado' LIMIT 1`,
        [plan.id_carrera, id_estudiante, period.codigo]
      );
      if (!careerEnrollment.length) throw fail(400, 'La matrícula del estudiante no coincide con la carrera del plan.');
    }
    const [[existing]] = await connection.query(
      "SELECT id_estudiante_plan FROM estudiante_planes_pago WHERE id_estudiante=? AND id_periodo=? AND estado='Activo' FOR UPDATE",
      [id_estudiante, id_periodo]
    );
    if (existing) throw fail(409, 'El estudiante ya tiene un plan de pago activo en este periodo.');

    const [installments] = await connection.query(
      'SELECT * FROM plan_pago_cuotas WHERE id_plan_pago=? ORDER BY numero_cuota',
      [id_plan_pago]
    );
    if (installments.length !== Number(plan.numero_cuotas)
        || installments.reduce((sum, item) => sum + cents(item.monto), 0) !== cents(plan.monto_total)) {
      throw fail(409, 'El cronograma del plan está incompleto o no coincide con su monto total.');
    }
    const uniqueScholarships = [...new Set(becas.map(Number))];
    const uniqueDiscounts = [...new Set(descuentos.map(Number))];
    if (uniqueScholarships.some((id) => !Number.isInteger(id) || id < 1)
        || uniqueDiscounts.some((id) => !Number.isInteger(id) || id < 1)) throw fail(400, 'Beneficio inválido.');

    const [created] = await connection.query(
      `INSERT INTO estudiante_planes_pago (id_plan_pago,id_estudiante,id_periodo,fecha_inicio,asignado_por)
       VALUES (?,?,?,?,?)`,
      [id_plan_pago, id_estudiante, id_periodo, fecha_inicio, req.auth.id]
    );
    const studentPlanId = created.insertId;
    for (const id of uniqueScholarships) {
      const [[benefit]] = await connection.query(
        `SELECT id_beca FROM becas WHERE id_beca=? AND estado='Activa'
         AND (fecha_inicio IS NULL OR fecha_inicio<=?) AND (fecha_fin IS NULL OR fecha_fin>=?)`,
        [id, fecha_inicio, fecha_inicio]
      );
      if (!benefit) throw fail(400, `La beca ${id} no está activa en la fecha de asignación.`);
      await connection.query(
        `INSERT INTO estudiante_becas (id_estudiante_plan,id_beca,estado,autorizada_por,autorizada_en)
         VALUES (?,?,'Autorizada',?,NOW())`,
        [studentPlanId, id, req.auth.id]
      );
    }
    for (const id of uniqueDiscounts) {
      const [[benefit]] = await connection.query(
        `SELECT id_descuento FROM descuentos WHERE id_descuento=? AND estado='Activo'
         AND (fecha_inicio IS NULL OR fecha_inicio<=?) AND (fecha_fin IS NULL OR fecha_fin>=?)`,
        [id, fecha_inicio, fecha_inicio]
      );
      if (!benefit) throw fail(400, `El descuento ${id} no está activo en la fecha de asignación.`);
      await connection.query(
        `INSERT INTO estudiante_descuentos (id_estudiante_plan,id_descuento,estado,autorizado_por,autorizado_en)
         VALUES (?,?,'Autorizado',?,NOW())`,
        [studentPlanId, id, req.auth.id]
      );
    }

    const activeBenefits = await getBenefits(connection, studentPlanId);
    let totalDue = 0;
    for (const installment of installments) {
      const base = cents(installment.monto);
      const benefit = calculateBenefit(base, activeBenefits);
      totalDue += benefit.due;
      const [obligation] = await connection.query(
        `INSERT INTO obligaciones_pago (id_estudiante,id_periodo,id_concepto,monto,fecha_vencimiento,estado)
         VALUES (?,?,?,?,DATE_ADD(?,INTERVAL ? DAY),?)`,
        [id_estudiante, id_periodo, installment.id_concepto, money(benefit.due), fecha_inicio,
          installment.dias_desde_inicio, benefit.due === 0 ? 'Pagado' : 'Pendiente']
      );
      await connection.query(
        `INSERT INTO plan_cuota_obligaciones
         (id_estudiante_plan,id_plan_pago_cuota,id_obligacion,monto_base,monto_beneficio,monto_exigible)
         VALUES (?,?,?,?,?,?)`,
        [studentPlanId, installment.id_plan_pago_cuota, obligation.insertId,
          money(base), money(benefit.discount), money(benefit.due)]
      );
      await connection.query(
        `INSERT INTO historial_movimientos_pago
         (id_estudiante,id_obligacion,id_usuario,tipo,monto,saldo_anterior,saldo_nuevo,detalle)
         VALUES (?,?,?,'PLAN_ASIGNADO',?,?,?,JSON_OBJECT('asignacion',?,'cuota',?,'moneda','PEN'))`,
        [id_estudiante, obligation.insertId, req.auth.id, money(benefit.due), money(benefit.due),
          money(benefit.due), studentPlanId, installment.numero_cuota]
      );
      if (benefit.discount > 0) {
        await connection.query(
          `INSERT INTO historial_movimientos_pago
           (id_estudiante,id_obligacion,id_usuario,tipo,monto,saldo_anterior,saldo_nuevo,detalle)
           VALUES (?,?,?,'BENEFICIO_AUTORIZADO',?,?,?,JSON_OBJECT('asignacion',?,'cuota',?,'moneda','PEN'))`,
          [id_estudiante, obligation.insertId, req.auth.id, money(benefit.discount),
            money(base), money(benefit.due), studentPlanId, installment.numero_cuota]
        );
      }
    }
    await connection.commit();
    return res.status(201).json({
      success: true,
      message: 'Plan asignado y cronograma generado sin pagos automáticos.',
      data: { id_estudiante_plan: studentPlanId, cuotas: installments.length, total_exigible: money(totalDue), moneda: 'PEN' }
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.get('/resumen', ...staff, async (req, res, next) => {
  try {
    const { periodo, carrera, estado } = req.query;
    const where = ['1=1'];
    const params = [];
    if (periodo) { where.push('o.id_periodo=?'); params.push(periodo); }
    if (carrera) { where.push('pp.id_carrera=?'); params.push(carrera); }
    if (estado === 'Vencida') where.push("o.estado<>'Anulado' AND o.fecha_vencimiento<CURDATE() AND GREATEST(o.monto-COALESCE(t.pagado,0),0)>0");
    else if (estado === 'Parcial') where.push('COALESCE(t.pagado,0)>0 AND GREATEST(o.monto-COALESCE(t.pagado,0),0)>0');
    else if (estado === 'Pagada') where.push("o.estado<>'Anulado' AND GREATEST(o.monto-COALESCE(t.pagado,0),0)<=0");
    else if (estado === 'Pendiente') where.push("o.estado<>'Anulado' AND COALESCE(t.pagado,0)=0 AND o.fecha_vencimiento>=CURDATE()");
    else where.push("o.estado<>'Anulado'");
    const [rows] = await pool.query(
      `SELECT o.id_obligacion,o.id_estudiante,o.id_periodo,e.dni,e.nombres,e.apellidos,
              c.nombre AS concepto,p.codigo AS periodo,o.fecha_vencimiento,o.monto AS exigible,
              COALESCE(t.pagado,0) AS pagado,GREATEST(o.monto-COALESCE(t.pagado,0),0) AS saldo,
              ca.nombre AS carrera,
              CASE WHEN o.estado='Anulado' THEN 'Anulada'
                   WHEN GREATEST(o.monto-COALESCE(t.pagado,0),0)<=0 THEN 'Pagada'
                   WHEN COALESCE(t.pagado,0)>0 THEN 'Parcial'
                   WHEN o.fecha_vencimiento<CURDATE() THEN 'Vencida'
                   ELSE 'Pendiente' END AS estado
       FROM obligaciones_pago o
       JOIN estudiantes e ON e.id_estudiante=o.id_estudiante
       JOIN periodos_academicos p ON p.id_periodo=o.id_periodo
       JOIN conceptos_pago c ON c.id_concepto=o.id_concepto
       LEFT JOIN plan_cuota_obligaciones pc ON pc.id_obligacion=o.id_obligacion
       LEFT JOIN estudiante_planes_pago ep ON ep.id_estudiante_plan=pc.id_estudiante_plan
       LEFT JOIN planes_pago pp ON pp.id_plan_pago=ep.id_plan_pago
       LEFT JOIN carreras ca ON ca.id_carrera=pp.id_carrera
       LEFT JOIN (
         SELECT pd.id_obligacion,SUM(pd.monto_aplicado) AS pagado
         FROM pago_detalles pd JOIN pagos pg ON pg.id_pago=pd.id_pago AND pg.estado='Registrado'
         GROUP BY pd.id_obligacion
       ) t ON t.id_obligacion=o.id_obligacion
       WHERE ${where.join(' AND ')} ORDER BY o.fecha_vencimiento,e.apellidos,e.nombres`,
      params
    );
    const totalDue = rows.reduce((sum, row) => sum + cents(row.saldo), 0);
    const counts = rows.reduce((all, row) => {
      all[row.estado] = (all[row.estado] || 0) + 1;
      return all;
    }, {});
    return res.json({ success: true, data: { obligaciones: rows, deuda_pendiente: money(totalDue), cuotas_por_estado: counts } });
  } catch (error) {
    return next(error);
  }
});

router.get('/ingresos', ...staff, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id_periodo,p.codigo AS periodo,SUM(pd.monto_aplicado) AS ingresos,
              COUNT(DISTINCT pg.id_pago) AS pagos
       FROM pago_detalles pd
       JOIN pagos pg ON pg.id_pago=pd.id_pago AND pg.estado='Registrado'
       JOIN obligaciones_pago o ON o.id_obligacion=pd.id_obligacion
       JOIN periodos_academicos p ON p.id_periodo=o.id_periodo
       WHERE o.estado<>'Anulado' GROUP BY p.id_periodo ORDER BY p.codigo DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/auditoria-saldos', ...staff, async (req, res, next) => {
  try {
    const [paymentOverages] = await pool.query(
      `SELECT p.id_pago,p.monto,SUM(pd.monto_aplicado) AS aplicado
       FROM pagos p JOIN pago_detalles pd ON pd.id_pago=p.id_pago
       GROUP BY p.id_pago HAVING SUM(pd.monto_aplicado)>p.monto
       ORDER BY p.id_pago DESC LIMIT 200`
    );
    const [obligationOverages] = await pool.query(
      `SELECT o.id_obligacion,o.id_estudiante,o.monto AS exigible,SUM(pd.monto_aplicado) AS aplicado
       FROM obligaciones_pago o
       JOIN pago_detalles pd ON pd.id_obligacion=o.id_obligacion
       JOIN pagos p ON p.id_pago=pd.id_pago AND p.estado='Registrado'
       WHERE o.estado<>'Anulado'
       GROUP BY o.id_obligacion HAVING SUM(pd.monto_aplicado)>o.monto
       ORDER BY o.id_obligacion DESC LIMIT 200`
    );
    const [stateMismatches] = await pool.query(
      `SELECT o.id_obligacion,o.id_estudiante,o.estado AS estado_guardado,o.monto,
              COALESCE(t.pagado,0) AS pagado,
              CASE WHEN GREATEST(o.monto-COALESCE(t.pagado,0),0)<=0 THEN 'Pagado' ELSE 'Pendiente' END AS estado_calculado
       FROM obligaciones_pago o
       LEFT JOIN (
         SELECT pd.id_obligacion,SUM(pd.monto_aplicado) AS pagado
         FROM pago_detalles pd JOIN pagos p ON p.id_pago=pd.id_pago AND p.estado='Registrado'
         GROUP BY pd.id_obligacion
       ) t ON t.id_obligacion=o.id_obligacion
       WHERE o.estado<>'Anulado'
         AND ((GREATEST(o.monto-COALESCE(t.pagado,0),0)<=0 AND o.estado<>'Pagado')
           OR (GREATEST(o.monto-COALESCE(t.pagado,0),0)>0 AND o.estado='Pagado'))
       ORDER BY o.id_obligacion DESC LIMIT 200`
    );
    return res.json({
      success: true,
      data: {
        pagos_sobreaplicados: paymentOverages,
        obligaciones_sobreaplicadas: obligationOverages,
        estados_inconsistentes: stateMismatches
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/estudiantes/:id/cronograma', ...staff, async (req, res, next) => {
  try {
    const rows = await studentSchedule(req.params.id, req.query.periodo || null);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/mi-cronograma', requireAuth, authorize('Estudiante'), async (req, res, next) => {
  if (!req.auth.id_estudiante) return res.status(403).json({ success: false, message: 'Esta cuenta no está vinculada a un estudiante.' });
  try {
    const rows = await studentSchedule(req.auth.id_estudiante, req.query.periodo || null);
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/mi-pagos', requireAuth, authorize('Estudiante'), async (req, res, next) => {
  if (!req.auth.id_estudiante) return res.status(403).json({ success: false, message: 'Esta cuenta no está vinculada a un estudiante.' });
  try {
    const [rows] = await pool.query(
      `SELECT p.id_pago,p.fecha_pago,p.metodo,p.referencia,p.monto,p.estado,
              COALESCE(SUM(CASE WHEN pg.estado='Registrado' THEN pd.monto_aplicado ELSE 0 END),0) AS monto_aplicado
       FROM pagos p LEFT JOIN pago_detalles pd ON pd.id_pago=p.id_pago
       LEFT JOIN pagos pg ON pg.id_pago=pd.id_pago
       WHERE p.id_estudiante=? GROUP BY p.id_pago ORDER BY p.fecha_pago DESC,p.id_pago DESC`,
      [req.auth.id_estudiante]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/estudiantes/:id/historial', ...staff, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT h.*,u.usuario,p.estado AS estado_pago FROM historial_movimientos_pago h
       LEFT JOIN usuarios u ON u.id_usuario=h.id_usuario
       LEFT JOIN pagos p ON p.id_pago=h.id_pago
       WHERE h.id_estudiante=? ORDER BY h.creado_en DESC,h.id_movimiento DESC LIMIT 500`,
      [req.params.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/pagos', ...staff, async (req, res, next) => {
  const { id_estudiante, fecha_pago, metodo, referencia, monto, asignaciones } = req.body;
  const totalCents = cents(monto);
  if (!Number.isInteger(Number(id_estudiante)) || Number(id_estudiante) < 1
      || !['Efectivo','Transferencia','Depósito','Tarjeta','Otro'].includes(metodo)
      || !validMoney(monto) || !Number.isInteger(totalCents) || totalCents < 1
      || (fecha_pago && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(fecha_pago))
      || !Array.isArray(asignaciones) || !asignaciones.length || asignaciones.length > 100) {
    return res.status(400).json({ success: false, message: 'Datos de pago inválidos.' });
  }
  const allocations = asignaciones.map((item) => ({ id: Number(item.id_obligacion), amount: cents(item.monto_aplicado) }));
  if (!validateAllocations(asignaciones, totalCents)) {
    return res.status(400).json({ success: false, message: 'Asigna el importe exacto del pago a obligaciones distintas.' });
  }

  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const sortedIds = allocations.map((item) => item.id).sort((a, b) => a - b);
    const [obligations] = await connection.query(
      `SELECT o.id_obligacion,o.id_estudiante,o.monto,o.estado
       FROM obligaciones_pago o
       WHERE o.id_obligacion IN (?) ORDER BY o.id_obligacion FOR UPDATE`,
      [sortedIds]
    );
    const [paidAmounts] = await connection.query(
      `SELECT pd.id_obligacion,SUM(CASE WHEN p.estado='Registrado' THEN pd.monto_aplicado ELSE 0 END) AS pagado
       FROM pago_detalles pd JOIN pagos p ON p.id_pago=pd.id_pago
       WHERE pd.id_obligacion IN (?) GROUP BY pd.id_obligacion`,
      [sortedIds]
    );
    const paidByObligation = new Map(paidAmounts.map((item) => [Number(item.id_obligacion), item.pagado]));
    const byId = new Map(obligations.map((item) => [Number(item.id_obligacion), item]));
    const availableBalances = new Map(obligations.map((item) => {
      const id = Number(item.id_obligacion);
      return [id, cents(item.monto) - cents(paidByObligation.get(id) || 0)];
    }));
    if (!allocationsWithinBalances(allocations, availableBalances)) {
      throw fail(409, 'El importe asignado supera el saldo exigible de una o más obligaciones.');
    }
    let allocated = 0;
    for (const allocation of allocations) {
      const obligation = byId.get(allocation.id);
      if (!obligation || Number(obligation.id_estudiante) !== Number(id_estudiante) || obligation.estado === 'Anulado') {
        throw fail(400, 'Todas las obligaciones deben estar vigentes y pertenecer al mismo estudiante.');
      }
      obligation.pagado = paidByObligation.get(allocation.id) || 0;
      const balance = cents(obligation.monto) - cents(obligation.pagado);
      if (allocation.amount > balance) throw fail(409, `El importe asignado supera el saldo de la obligación ${allocation.id}.`);
      allocated += allocation.amount;
    }
    if (allocated !== totalCents) throw fail(400, 'El total asignado no coincide con el importe del pago.');

    const [created] = await connection.query(
      `INSERT INTO pagos (id_estudiante,fecha_pago,metodo,referencia,monto,estado)
       VALUES (?,?,?,?,?,'Registrado')`,
      [id_estudiante, fecha_pago || new Date(), metodo, String(referencia || '').trim().slice(0, 80) || null, money(totalCents)]
    );
    for (const allocation of allocations) {
      await connection.query(
        'INSERT INTO pago_detalles (id_pago,id_obligacion,monto_aplicado) VALUES (?,?,?)',
        [created.insertId, allocation.id, money(allocation.amount)]
      );
      const balance = await refreshObligationState(connection, allocation.id);
      await connection.query(
        `INSERT INTO historial_movimientos_pago
         (id_estudiante,id_obligacion,id_pago,id_usuario,tipo,monto,saldo_anterior,saldo_nuevo,detalle)
         VALUES (?,?,?,?,'PAGO_REGISTRADO',?,?,?,JSON_OBJECT('metodo',?,'referencia',?,'moneda','PEN'))`,
        [id_estudiante, allocation.id, created.insertId, req.auth.id, money(allocation.amount),
          money(cents(byId.get(allocation.id).monto) - cents(byId.get(allocation.id).pagado)),
          money(balance.due), metodo, String(referencia || '').trim()]
      );
    }
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Pago registrado y aplicado.', data: { id_pago: created.insertId, monto: money(totalCents), moneda: 'PEN' } });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.post('/pagos/:id/anular', ...admin, async (req, res, next) => {
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [[payment]] = await connection.query('SELECT * FROM pagos WHERE id_pago=? FOR UPDATE', [req.params.id]);
    if (!payment) throw fail(404, 'Pago no encontrado.');
    if (payment.estado !== 'Registrado') throw fail(409, 'El pago ya está anulado.');
    const [details] = await connection.query(
      `SELECT pd.id_obligacion,pd.monto_aplicado,o.estado
       FROM pago_detalles pd JOIN obligaciones_pago o ON o.id_obligacion=pd.id_obligacion
       WHERE pd.id_pago=? ORDER BY pd.id_obligacion FOR UPDATE`,
      [req.params.id]
    );
    await connection.query("UPDATE pagos SET estado='Anulado' WHERE id_pago=?", [req.params.id]);
    for (const detail of details) {
      const balance = await refreshObligationState(connection, detail.id_obligacion);
      await connection.query(
        `INSERT INTO historial_movimientos_pago
         (id_estudiante,id_obligacion,id_pago,id_usuario,tipo,monto,saldo_anterior,saldo_nuevo,detalle)
         VALUES (?,?,?,?,'PAGO_ANULADO',?,?,?,JSON_OBJECT('motivo',?))`,
        [payment.id_estudiante, detail.id_obligacion, req.params.id, req.auth.id,
          Number(detail.monto_aplicado),
          money(Math.max(0, cents(balance.due) - cents(detail.monto_aplicado))),
          balance.due,
          String(req.body.motivo || 'Anulación administrativa').slice(0, 200)]
      );
    }
    await connection.commit();
    return res.json({ success: true, message: 'Pago anulado; se conservó el historial y sus aplicaciones.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.post('/obligaciones/:id/ajustes', ...admin, async (req, res, next) => {
  const deltaCents = cents(req.body.variacion);
  const motivo = String(req.body.motivo || '').trim().slice(0, 200);
  if (!validMoney(req.body.variacion, true) || !Number.isInteger(deltaCents) || deltaCents === 0 || !motivo) {
    return res.status(400).json({ success: false, message: 'Indica una variación distinta de cero y un motivo.' });
  }
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [[obligation]] = await connection.query('SELECT * FROM obligaciones_pago WHERE id_obligacion=? FOR UPDATE', [req.params.id]);
    if (!obligation || obligation.estado === 'Anulado') throw fail(404, 'Obligación no encontrada o anulada.');
    const [[payments]] = await connection.query(
      `SELECT COALESCE(SUM(pd.monto_aplicado),0) AS pagado FROM pago_detalles pd
       JOIN pagos p ON p.id_pago=pd.id_pago AND p.estado='Registrado'
       WHERE pd.id_obligacion=?`,
      [req.params.id]
    );
    const before = cents(obligation.monto);
    const after = before + deltaCents;
    if (after < cents(payments.pagado) || after < 0) throw fail(409, 'El ajuste no puede dejar el importe debajo de los pagos ya aplicados.');
    await connection.query('UPDATE obligaciones_pago SET monto=? WHERE id_obligacion=?', [money(after), req.params.id]);
    await connection.query(
      `UPDATE plan_cuota_obligaciones SET monto_exigible=? WHERE id_obligacion=?`,
      [money(after), req.params.id]
    );
    await refreshObligationState(connection, req.params.id);
    await connection.query(
      `INSERT INTO historial_movimientos_pago
       (id_estudiante,id_obligacion,id_usuario,tipo,monto,saldo_anterior,saldo_nuevo,detalle)
       VALUES (?,?,?,'AJUSTE_OBLIGACION',?,?,?,JSON_OBJECT('motivo',?))`,
      [obligation.id_estudiante, req.params.id, req.auth.id, money(deltaCents),
        money(before - cents(payments.pagado)), money(after - cents(payments.pagado)), motivo]
    );
    await connection.commit();
    return res.json({ success: true, message: 'Ajuste registrado con auditoría.', data: { monto_anterior: money(before), monto_nuevo: money(after) } });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.get('/pagos/:id/constancia', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT pg.id_pago,pg.fecha_pago,pg.metodo,pg.referencia,pg.monto,pg.estado,
              e.id_estudiante,e.dni,e.nombres,e.apellidos,
              pd.monto_aplicado,o.id_obligacion,o.fecha_vencimiento,c.nombre AS concepto,p.codigo AS periodo
       FROM pagos pg JOIN estudiantes e ON e.id_estudiante=pg.id_estudiante
       LEFT JOIN pago_detalles pd ON pd.id_pago=pg.id_pago
       LEFT JOIN obligaciones_pago o ON o.id_obligacion=pd.id_obligacion
       LEFT JOIN conceptos_pago c ON c.id_concepto=o.id_concepto
       LEFT JOIN periodos_academicos p ON p.id_periodo=o.id_periodo
       WHERE pg.id_pago=? ORDER BY o.id_obligacion`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Pago no encontrado.' });
    const isStaff = req.auth.roles.some((role) => ['Administrador','Secretaría'].includes(role));
    if (!isStaff && (!req.auth.roles.includes('Estudiante') || Number(req.auth.id_estudiante) !== Number(rows[0].id_estudiante))) {
      return res.status(403).json({ success: false, message: 'No puedes consultar esta constancia.' });
    }
    return res.json({ success: true, data: { pago: rows[0], aplicaciones: rows.filter((row) => row.id_obligacion) } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
