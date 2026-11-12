const express = require('express');
const pool = require('../config/db');
const { authorize, requireAuth } = require('../middlewares/auth');
const {
  PASSING_GRADE,
  courseStatus,
  invalidPrerequisiteEdges,
} = require('../services/mallaUtils');
const {
  checkCourseEligibility,
  getActiveStudentPlan,
  loadEnrollmentProgress
} = require('../services/mallaAcademica');

const router = express.Router();
const admin = [requireAuth, authorize('Administrador')];
const staff = [requireAuth, authorize('Administrador', 'Secretaría')];
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

async function loadPlanCourses(connection, planId) {
  const [rows] = await connection.query(
    `SELECT pc.id_plan_curso,pc.id_plan,pc.id_ciclo,cy.numero AS ciclo_numero,cy.nombre AS ciclo,
            pc.id_curso,cu.codigo AS curso_codigo,cu.nombre AS curso,cu.creditos,cu.horas,
            pc.tipo_curso,pc.orden,COALESCE(pcc.estado,'Activo') AS estado
     FROM plan_cursos pc
     JOIN ciclos cy ON cy.id_ciclo=pc.id_ciclo
     JOIN cursos cu ON cu.id_curso=pc.id_curso
     LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=pc.id_plan_curso
     WHERE pc.id_plan=? ORDER BY cy.numero,pc.orden,cu.nombre`,
    [planId]
  );
  return rows;
}

async function loadPrerequisites(connection, planId) {
  const [rows] = await connection.query(
    `SELECT r.id_prerrequisito,r.id_plan_curso,r.id_plan_curso_requisito,
            actual.id_plan AS id_plan_actual,requisito.id_plan AS id_plan_requisito,
            curso_actual.id_curso AS id_curso_actual,curso_actual.nombre AS curso_actual,
            curso_requisito.id_curso AS id_curso_requisito,curso_requisito.nombre AS curso_requisito,
            ciclo_actual.numero AS ciclo_actual,ciclo_requisito.numero AS ciclo_requisito
     FROM curso_prerrequisitos r
     JOIN plan_cursos actual ON actual.id_plan_curso=r.id_plan_curso
     JOIN plan_cursos requisito ON requisito.id_plan_curso=r.id_plan_curso_requisito
     JOIN cursos curso_actual ON curso_actual.id_curso=actual.id_curso
     JOIN cursos curso_requisito ON curso_requisito.id_curso=requisito.id_curso
     JOIN ciclos ciclo_actual ON ciclo_actual.id_ciclo=actual.id_ciclo
     JOIN ciclos ciclo_requisito ON ciclo_requisito.id_ciclo=requisito.id_ciclo
     WHERE actual.id_plan=? AND requisito.id_plan=? ORDER BY ciclo_actual.numero,curso_actual.nombre`,
    [planId, planId]
  );
  return rows;
}

router.get('/mi-malla', requireAuth, authorize('Estudiante'), async (req, res, next) => {
  if (!req.auth.id_estudiante) return res.status(403).json({ success: false, message: 'La cuenta no está vinculada a un estudiante.' });
  try {
    const connection = await pool.getConnection();
    try {
      const program = await getActiveStudentPlan(connection, req.auth.id_estudiante);
      if (!program) return res.json({ success: true, data: { programa: null, ciclos: [], nota_minima_aprobatoria: PASSING_GRADE } });
      const [courseRows, prerequisites, progress] = await Promise.all([
        loadPlanCourses(connection, program.id_plan),
        loadPrerequisites(connection, program.id_plan),
        loadEnrollmentProgress(connection, req.auth.id_estudiante)
      ]);
      const coursesByCycle = new Map();
      for (const course of courseRows.filter((row) => row.estado === 'Activo')) {
        if (!coursesByCycle.has(course.id_ciclo)) {
          coursesByCycle.set(course.id_ciclo, {
            id_ciclo: course.id_ciclo,
            numero: course.ciclo_numero,
            nombre: course.ciclo,
            creditos: 0,
            cursos: []
          });
        }
        const enrollment = progress.get(Number(course.id_curso));
        const coursePrerequisites = prerequisites
          .filter((item) => Number(item.id_curso_actual) === Number(course.id_curso))
          .map((item) => ({
            id_curso: item.id_curso_requisito,
            nombre: item.curso_requisito,
            estado: courseStatus(progress.get(Number(item.id_curso_requisito)))
          }));
        const item = {
          ...course,
          estado_academico: courseStatus(enrollment),
          promedio: enrollment?.promedio ?? null,
          prerrequisitos: coursePrerequisites,
          puede_matricularse: coursePrerequisites.every((item) => item.estado === 'Aprobado')
        };
        coursesByCycle.get(course.id_ciclo).creditos += Number(course.creditos);
        coursesByCycle.get(course.id_ciclo).cursos.push(item);
      }
      return res.json({
        success: true,
        data: {
          programa: {
            carrera: program.carrera,
            carrera_codigo: program.carrera_codigo,
            plan: program.plan_codigo,
            version: program.version,
            fecha_vigencia: program.fecha_vigencia
          },
          ciclos: [...coursesByCycle.values()].sort((a, b) => a.numero - b.numero),
          ciclo_actual: [...coursesByCycle.values()]
            .sort((a, b) => a.numero - b.numero)
            .find((cycle) => cycle.cursos.some((course) => course.tipo_curso === 'Obligatorio' && course.estado_academico !== 'Aprobado')) || null,
          nota_minima_aprobatoria: PASSING_GRADE
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.get('/mi-malla/eligibilidad/:idCurso', requireAuth, authorize('Estudiante'), async (req, res, next) => {
  if (!req.auth.id_estudiante) return res.status(403).json({ success: false, message: 'La cuenta no está vinculada a un estudiante.' });
  try {
    const eligibility = await checkCourseEligibility(pool, req.auth.id_estudiante, req.params.idCurso);
    return res.json({ success: true, data: eligibility });
  } catch (error) {
    return next(error);
  }
});

router.get('/planes', ...staff, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id_plan,p.codigo,p.version,DATE_FORMAT(p.fecha_vigencia,'%Y-%m-%d') AS fecha_vigencia,
              p.estado,c.id_carrera,c.nombre AS carrera,
              ctl.estado_gestion,
              (SELECT COUNT(*) FROM plan_cursos pc
               LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=pc.id_plan_curso
               WHERE pc.id_plan=p.id_plan AND COALESCE(pcc.estado,'Activo')='Activo') AS cursos,
              (SELECT COALESCE(SUM(cu.creditos),0) FROM plan_cursos pc
               JOIN cursos cu ON cu.id_curso=pc.id_curso
               LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=pc.id_plan_curso
               WHERE pc.id_plan=p.id_plan AND COALESCE(pcc.estado,'Activo')='Activo') AS creditos,
              (SELECT COUNT(DISTINCT ep.id_estudiante) FROM estudiante_planes_estudio ep
               WHERE ep.id_plan=p.id_plan AND ep.estado='Activo') AS estudiantes_asignados,
              (SELECT COUNT(DISTINCT m.id_estudiante) FROM estudiante_planes_estudio ep
               JOIN matriculas m ON m.id_estudiante=ep.id_estudiante AND m.estado='Matriculado'
               WHERE ep.id_plan=p.id_plan AND ep.estado='Activo') AS alumnos_matriculados
       FROM planes_estudio p
       JOIN carreras c ON c.id_carrera=p.id_carrera
       JOIN plan_estudio_control ctl ON ctl.id_plan=p.id_plan
       ORDER BY c.nombre,p.fecha_vigencia DESC,p.id_plan DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/planes/:id/malla', ...staff, async (req, res, next) => {
  try {
    const [[plan]] = await pool.query(
      `SELECT p.id_plan,p.id_carrera,p.codigo,p.version,DATE_FORMAT(p.fecha_vigencia,'%Y-%m-%d') AS fecha_vigencia,p.estado,
              c.nombre AS carrera,c.duracion_ciclos,ctl.estado_gestion
       FROM planes_estudio p
       JOIN carreras c ON c.id_carrera=p.id_carrera
       JOIN plan_estudio_control ctl ON ctl.id_plan=p.id_plan
       WHERE p.id_plan=?`,
      [req.params.id]
    );
    if (!plan) return res.status(404).json({ success: false, message: 'Plan no encontrado.' });
    const [courseRows, prerequisites] = await Promise.all([
      loadPlanCourses(pool, plan.id_plan),
      loadPrerequisites(pool, plan.id_plan)
    ]);
    const cycleRows = await pool.query(
      `SELECT cy.id_ciclo,cy.numero,cy.nombre,
              COALESCE(SUM(CASE WHEN COALESCE(pcc.estado,'Activo')='Activo' THEN cu.creditos ELSE 0 END),0) AS creditos
       FROM ciclos cy
       LEFT JOIN plan_cursos pc ON pc.id_plan=?
         AND pc.id_ciclo=cy.id_ciclo
       LEFT JOIN cursos cu ON cu.id_curso=pc.id_curso
       LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=pc.id_plan_curso
       WHERE cy.numero<=? GROUP BY cy.id_ciclo,cy.numero,cy.nombre ORDER BY cy.numero`,
      [plan.id_plan, plan.duracion_ciclos]
    );
    const prerequisitesByCourse = new Map();
    for (const item of prerequisites) {
      const key = Number(item.id_curso_actual);
      if (!prerequisitesByCourse.has(key)) prerequisitesByCourse.set(key, []);
      prerequisitesByCourse.get(key).push({
        id_plan_curso: item.id_plan_curso_requisito,
        id_curso: item.id_curso_requisito,
        nombre: item.curso_requisito,
        ciclo: item.ciclo_requisito
      });
    }
    const coursesByCycle = new Map(cycleRows[0].map((cycle) => [Number(cycle.id_ciclo), { ...cycle, cursos: [] }]));
    for (const row of courseRows) {
      const cycle = coursesByCycle.get(Number(row.id_ciclo));
      if (cycle) cycle.cursos.push({ ...row, prerrequisitos: prerequisitesByCourse.get(Number(row.id_curso)) || [] });
    }
    return res.json({ success: true, data: { plan, ciclos: [...coursesByCycle.values()] } });
  } catch (error) {
    return next(error);
  }
});

router.get('/estudiantes', ...admin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.id_estudiante,e.dni,e.nombres,e.apellidos,e.estado,
              ep.id_estudiante_plan,ep.id_plan,p.codigo AS plan_codigo,p.version,
              c.nombre AS carrera
       FROM estudiantes e
       LEFT JOIN estudiante_planes_estudio ep ON ep.id_estudiante=e.id_estudiante
         AND ep.estado='Activo' AND ep.fecha_inicio<=CURDATE()
       LEFT JOIN planes_estudio p ON p.id_plan=ep.id_plan
       LEFT JOIN carreras c ON c.id_carrera=p.id_carrera
       WHERE e.estado='Activo' ORDER BY e.apellidos,e.nombres`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/estudiantes/:id/eligibilidad/:idCurso', ...staff, async (req, res, next) => {
  try {
    const eligibility = await checkCourseEligibility(pool, req.params.id, req.params.idCurso);
    return res.json({ success: true, data: eligibility });
  } catch (error) {
    return next(error);
  }
});

router.put('/estudiantes/:id/plan', ...admin, async (req, res, next) => {
  const { id_plan, fecha_inicio } = req.body;
  if (!Number.isInteger(Number(id_plan)) || Number(id_plan) < 1 || !validDate(fecha_inicio)) {
    return res.status(400).json({ success: false, message: 'Indica un plan publicado y una fecha válida.' });
  }
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [[student]] = await connection.query('SELECT id_estudiante FROM estudiantes WHERE id_estudiante=? AND estado=\'Activo\' FOR UPDATE', [req.params.id]);
    const [[plan]] = await connection.query(
      `SELECT p.id_plan,p.codigo,DATE_FORMAT(p.fecha_vigencia,'%Y-%m-%d') AS fecha_vigencia,
              ctl.estado_gestion
       FROM planes_estudio p JOIN plan_estudio_control ctl ON ctl.id_plan=p.id_plan
       WHERE p.id_plan=? AND p.estado='Activo' FOR UPDATE`,
      [id_plan]
    );
    if (!student || !plan || plan.estado_gestion !== 'Publicado') throw fail(400, 'El estudiante debe estar activo y el plan debe estar publicado.');
    if (fecha_inicio < String(plan.fecha_vigencia).slice(0, 10)) throw fail(400, 'La asignación no puede iniciar antes de la fecha de vigencia del plan.');
    const [[existing]] = await connection.query(
      `SELECT id_estudiante_plan,id_plan,DATE_FORMAT(fecha_inicio,'%Y-%m-%d') AS fecha_inicio
       FROM estudiante_planes_estudio
       WHERE id_estudiante=? AND estado='Activo' ORDER BY id_estudiante_plan DESC LIMIT 1 FOR UPDATE`,
      [req.params.id]
    );
    if (existing && Number(existing.id_plan) === Number(id_plan)) throw fail(409, 'El estudiante ya tiene asignado este plan.');
    if (existing && fecha_inicio < String(existing.fecha_inicio).slice(0, 10)) throw fail(400, 'La fecha de inicio no puede ser anterior a la asignación vigente.');
    if (existing) {
      await connection.query(
        `UPDATE estudiante_planes_estudio SET estado='Historico',fecha_fin=GREATEST(fecha_inicio,DATE_SUB(?,INTERVAL 1 DAY))
         WHERE id_estudiante_plan=?`,
        [fecha_inicio, existing.id_estudiante_plan]
      );
    }
    const [created] = await connection.query(
      `INSERT INTO estudiante_planes_estudio (id_estudiante,id_plan,fecha_inicio,asignado_por)
       VALUES (?,?,?,?)`,
      [req.params.id, id_plan, fecha_inicio, req.auth.id]
    );
    await connection.query(
      `INSERT INTO historial_cambios_malla (id_plan,id_usuario,accion,detalle)
       VALUES (?,?,'ESTUDIANTE_ASIGNADO',JSON_OBJECT('id_estudiante',?,'plan_anterior',?,'fecha_inicio',?))`,
      [id_plan, req.auth.id, req.params.id, existing?.id_plan || null, fecha_inicio]
    );
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Plan de estudios asignado; se conservó el historial anterior.', data: { id_estudiante_plan: created.insertId } });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.post('/planes/:id/versiones', ...admin, async (req, res, next) => {
  const { codigo, version, fecha_vigencia } = req.body;
  if (!/^[A-Za-z0-9._-]{3,25}$/.test(String(codigo || ''))
      || !String(version || '').trim() || String(version).trim().length > 25
      || !validDate(fecha_vigencia)) {
    return res.status(400).json({ success: false, message: 'Código, versión y fecha de vigencia son obligatorios.' });
  }
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [[source]] = await connection.query(
      `SELECT p.id_plan,p.id_carrera,p.codigo,p.version,p.fecha_vigencia,c.nombre AS carrera
       FROM planes_estudio p JOIN carreras c ON c.id_carrera=p.id_carrera
       WHERE p.id_plan=? FOR UPDATE`,
      [req.params.id]
    );
    if (!source) throw fail(404, 'Plan de origen no encontrado.');
    const [[duplicate]] = await connection.query('SELECT id_plan FROM planes_estudio WHERE codigo=?', [codigo.trim()]);
    if (duplicate) throw fail(409, 'Ya existe un plan con ese código.');
    const [created] = await connection.query(
      `INSERT INTO planes_estudio (id_carrera,codigo,version,fecha_vigencia,estado)
       VALUES (?,?,?,?,'Inactivo')`,
      [source.id_carrera, codigo.trim(), String(version).trim(), fecha_vigencia]
    );
    const newPlanId = created.insertId;
    await connection.query(
      `INSERT INTO plan_estudio_control (id_plan,estado_gestion,creado_por)
       VALUES (?,'Borrador',?)`,
      [newPlanId, req.auth.id]
    );
    const sourceCourses = await loadPlanCourses(connection, source.id_plan);
    const activeCourses = sourceCourses.filter((course) => course.estado === 'Activo');
    const mapping = new Map();
    for (const course of activeCourses) {
      const [newCourse] = await connection.query(
        `INSERT INTO plan_cursos (id_plan,id_ciclo,id_curso,tipo_curso,orden)
         VALUES (?,?,?,?,?)`,
        [newPlanId, course.id_ciclo, course.id_curso, course.tipo_curso, course.orden]
      );
      mapping.set(Number(course.id_plan_curso), newCourse.insertId);
      await connection.query('INSERT INTO plan_curso_control (id_plan_curso,estado) VALUES (?,\'Activo\')', [newCourse.insertId]);
    }
    const [sourceRequirements] = await connection.query(
      `SELECT r.id_plan_curso,r.id_plan_curso_requisito FROM curso_prerrequisitos r
       JOIN plan_cursos pc ON pc.id_plan_curso=r.id_plan_curso AND pc.id_plan=?
       JOIN plan_cursos pr ON pr.id_plan_curso=r.id_plan_curso_requisito AND pr.id_plan=?`,
      [source.id_plan, source.id_plan]
    );
    for (const requirement of sourceRequirements) {
      const currentId = mapping.get(Number(requirement.id_plan_curso));
      const prerequisiteId = mapping.get(Number(requirement.id_plan_curso_requisito));
      if (currentId && prerequisiteId) {
        await connection.query(
          'INSERT INTO curso_prerrequisitos (id_plan_curso,id_plan_curso_requisito) VALUES (?,?)',
          [currentId, prerequisiteId]
        );
      }
    }
    await connection.query(
      `INSERT INTO historial_cambios_malla (id_plan,id_usuario,accion,detalle)
       VALUES (?,?,'VERSION_CREADA',JSON_OBJECT('plan_origen',?,'codigo_origen',?,'cursos_clonados',?))`,
      [newPlanId, req.auth.id, source.id_plan, source.codigo, mapping.size]
    );
    await connection.commit();
    return res.status(201).json({
      success: true,
      message: 'Versión en borrador creada; el plan anterior se conserva.',
      data: { id_plan: newPlanId, cursos_clonados: mapping.size, carrera: source.carrera }
    });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.post('/planes/:id/publicar', ...admin, async (req, res, next) => {
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [[plan]] = await connection.query(
      `SELECT p.id_plan,p.id_carrera,p.estado,ctl.estado_gestion,c.duracion_ciclos
       FROM planes_estudio p
       JOIN plan_estudio_control ctl ON ctl.id_plan=p.id_plan
       JOIN carreras c ON c.id_carrera=p.id_carrera
       WHERE p.id_plan=? FOR UPDATE`,
      [req.params.id]
    );
    if (!plan) throw fail(404, 'Plan no encontrado.');
    if (plan.estado_gestion !== 'Borrador') throw fail(409, 'Solo se pueden publicar versiones en borrador.');
    const [coverage] = await connection.query(
      `SELECT cy.numero,
              SUM(CASE WHEN COALESCE(pcc.estado,'Activo')='Activo' AND pc.tipo_curso='Obligatorio' THEN 1 ELSE 0 END) AS obligatorios
       FROM ciclos cy
       LEFT JOIN plan_cursos pc ON pc.id_plan=? AND pc.id_ciclo=cy.id_ciclo
       LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=pc.id_plan_curso
       WHERE cy.numero<=? GROUP BY cy.numero ORDER BY cy.numero`,
      [plan.id_plan, plan.duracion_ciclos]
    );
    if (coverage.length !== Number(plan.duracion_ciclos) || coverage.some((cycle) => Number(cycle.obligatorios) < 1)) {
      throw fail(409, 'La malla debe incluir al menos un curso obligatorio en cada ciclo de la carrera.');
    }
    const [requirements] = await connection.query(
      `SELECT pc.id_plan_curso AS courseId,pr.id_plan_curso AS prerequisiteId,
              cy.numero AS courseCycle,cypr.numero AS prerequisiteCycle
       FROM curso_prerrequisitos r
       JOIN plan_cursos pc ON pc.id_plan_curso=r.id_plan_curso AND pc.id_plan=?
       JOIN plan_cursos pr ON pr.id_plan_curso=r.id_plan_curso_requisito AND pr.id_plan=?
       JOIN ciclos cy ON cy.id_ciclo=pc.id_ciclo
       JOIN ciclos cypr ON cypr.id_ciclo=pr.id_ciclo`,
      [plan.id_plan, plan.id_plan]
    );
    const cycleByCourse = new Map();
    for (const item of requirements) {
      cycleByCourse.set(Number(item.courseId), Number(item.courseCycle));
      cycleByCourse.set(Number(item.prerequisiteId), Number(item.prerequisiteCycle));
    }
    const edges = requirements.map((item) => ({ courseId: item.courseId, prerequisiteId: item.prerequisiteId }));
    if (invalidPrerequisiteEdges(edges, cycleByCourse)) throw fail(409, 'La malla contiene prerrequisitos circulares o ubicados en un ciclo igual o posterior.');

    await connection.query(
      `UPDATE plan_estudio_control ctl
       JOIN planes_estudio p ON p.id_plan=ctl.id_plan
       SET ctl.estado_gestion='Retirado',p.estado='Inactivo'
       WHERE p.id_carrera=? AND p.estado='Activo' AND p.id_plan<>?`,
      [plan.id_carrera, plan.id_plan]
    );
    await connection.query(
      `UPDATE plan_estudio_control SET estado_gestion='Publicado',publicado_en=NOW()
       WHERE id_plan=?`,
      [plan.id_plan]
    );
    await connection.query("UPDATE planes_estudio SET estado='Activo' WHERE id_plan=?", [plan.id_plan]);
    await connection.query(
      `INSERT INTO historial_cambios_malla (id_plan,id_usuario,accion,detalle)
       VALUES (?,?,'PLAN_PUBLICADO',JSON_OBJECT('version',?))`,
      [plan.id_plan, req.auth.id, req.body.version || null]
    );
    await connection.commit();
    return res.json({ success: true, message: 'Plan publicado; la versión anterior permanece en el historial.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.post('/planes/:id/cursos', ...admin, async (req, res, next) => {
  const { id_curso, id_ciclo, tipo_curso = 'Obligatorio', orden = 1 } = req.body;
  if (![id_curso, id_ciclo, orden].every((value) => Number.isInteger(Number(value)) && Number(value) > 0)
      || !['Obligatorio', 'Electivo'].includes(tipo_curso)) {
    return res.status(400).json({ success: false, message: 'Curso, ciclo, tipo y orden no son válidos.' });
  }
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [[control]] = await connection.query('SELECT estado_gestion FROM plan_estudio_control WHERE id_plan=? FOR UPDATE', [req.params.id]);
    const [[course]] = await connection.query("SELECT id_curso FROM cursos WHERE id_curso=? AND estado='Activo'", [id_curso]);
    const [[cycle]] = await connection.query('SELECT id_ciclo FROM ciclos WHERE id_ciclo=?', [id_ciclo]);
    if (!control) throw fail(404, 'Plan no encontrado.');
    if (control.estado_gestion !== 'Borrador') throw fail(409, 'Solo se puede editar una versión en borrador.');
    if (!course || !cycle) throw fail(400, 'El curso debe estar activo y el ciclo debe existir.');
    const [[duplicate]] = await connection.query('SELECT id_plan_curso FROM plan_cursos WHERE id_plan=? AND id_curso=?', [req.params.id, id_curso]);
    if (duplicate) throw fail(409, 'El curso ya está incluido en esta versión del plan.');
    const [result] = await connection.query(
      'INSERT INTO plan_cursos (id_plan,id_ciclo,id_curso,tipo_curso,orden) VALUES (?,?,?,?,?)',
      [req.params.id, id_ciclo, id_curso, tipo_curso, orden]
    );
    await connection.query('INSERT INTO plan_curso_control (id_plan_curso,estado) VALUES (?,\'Activo\')', [result.insertId]);
    await connection.query(
      `INSERT INTO historial_cambios_malla (id_plan,id_plan_curso,id_usuario,accion,detalle)
       VALUES (?,?,?,'CURSO_AGREGADO',JSON_OBJECT('id_curso',?,'id_ciclo',?,'tipo_curso',?))`,
      [req.params.id, result.insertId, req.auth.id, id_curso, id_ciclo, tipo_curso]
    );
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Curso agregado a la versión en borrador.', data: { id_plan_curso: result.insertId } });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch('/planes/:id/cursos/:idPlanCurso', ...admin, async (req, res, next) => {
  const { id_ciclo, tipo_curso, orden, estado } = req.body;
  if (id_ciclo !== undefined && (!Number.isInteger(Number(id_ciclo)) || Number(id_ciclo) < 1)) {
    return res.status(400).json({ success: false, message: 'Ciclo inválido.' });
  }
  if (tipo_curso !== undefined && !['Obligatorio', 'Electivo'].includes(tipo_curso)) {
    return res.status(400).json({ success: false, message: 'Tipo de curso inválido.' });
  }
  if (orden !== undefined && (!Number.isInteger(Number(orden)) || Number(orden) < 1)) {
    return res.status(400).json({ success: false, message: 'Orden inválido.' });
  }
  if (estado !== undefined && !['Activo', 'Retirado'].includes(estado)) {
    return res.status(400).json({ success: false, message: 'Estado de asignación inválido.' });
  }
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [[control]] = await connection.query('SELECT estado_gestion FROM plan_estudio_control WHERE id_plan=? FOR UPDATE', [req.params.id]);
    const [[entry]] = await connection.query(
      `SELECT pc.id_plan_curso,pc.id_curso,pc.id_ciclo,pc.tipo_curso,pc.orden,COALESCE(pcc.estado,'Activo') AS estado
       FROM plan_cursos pc LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=pc.id_plan_curso
       WHERE pc.id_plan=? AND pc.id_plan_curso=? FOR UPDATE`,
      [req.params.id, req.params.idPlanCurso]
    );
    if (!control || !entry) throw fail(404, 'Plan o curso no encontrado.');
    if (control.estado_gestion !== 'Borrador') throw fail(409, 'Solo se puede editar una versión en borrador.');
    const nextCycle = id_ciclo === undefined ? Number(entry.id_ciclo) : Number(id_ciclo);
    const nextState = estado || entry.estado;
    const [[targetCycle]] = await connection.query('SELECT id_ciclo,numero FROM ciclos WHERE id_ciclo=?', [nextCycle]);
    if (!targetCycle) throw fail(400, 'El ciclo no existe.');
    const targetCycleNumber = Number(targetCycle.numero);
    if (nextState === 'Retirado') {
      const [[dependent]] = await connection.query(
        `SELECT COUNT(*) AS total FROM curso_prerrequisitos r
         JOIN plan_cursos pc ON pc.id_plan_curso=r.id_plan_curso
         LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=pc.id_plan_curso
         WHERE pc.id_plan=? AND r.id_plan_curso_requisito=? AND COALESCE(pcc.estado,'Activo')='Activo'`,
        [req.params.id, req.params.idPlanCurso]
      );
      if (Number(dependent.total)) throw fail(409, 'No se puede retirar el curso mientras sea prerrequisito de cursos activos.');
    }
    const [edges] = await connection.query(
      `SELECT pc.id_plan_curso AS courseId,pr.id_plan_curso AS prerequisiteId,
              cy.numero AS courseCycle,cypr.numero AS prerequisiteCycle
       FROM curso_prerrequisitos r
       JOIN plan_cursos pc ON pc.id_plan_curso=r.id_plan_curso AND pc.id_plan=?
       JOIN plan_cursos pr ON pr.id_plan_curso=r.id_plan_curso_requisito AND pr.id_plan=?
       JOIN ciclos cy ON cy.id_ciclo=pc.id_ciclo
       JOIN ciclos cypr ON cypr.id_ciclo=pr.id_ciclo`,
      [req.params.id, req.params.id]
    );
    const cycleByCourse = new Map();
    for (const edge of edges) {
      cycleByCourse.set(Number(edge.courseId), Number(edge.courseCycle));
      cycleByCourse.set(Number(edge.prerequisiteId), Number(edge.prerequisiteCycle));
    }
    cycleByCourse.set(Number(entry.id_plan_curso), targetCycleNumber);
    const graph = edges.map((edge) => ({ courseId: edge.courseId, prerequisiteId: edge.prerequisiteId }));
    if (invalidPrerequisiteEdges(graph, cycleByCourse)) throw fail(409, 'El cambio de ciclo dejaría un prerrequisito circular o en un ciclo igual o posterior.');
    await connection.query(
      `UPDATE plan_cursos SET id_ciclo=?,tipo_curso=?,orden=? WHERE id_plan_curso=?`,
      [nextCycle, tipo_curso || entry.tipo_curso, orden === undefined ? entry.orden : orden, req.params.idPlanCurso]
    );
    await connection.query(
      `INSERT INTO plan_curso_control (id_plan_curso,estado) VALUES (?,?)
       ON DUPLICATE KEY UPDATE estado=VALUES(estado)`,
      [req.params.idPlanCurso, nextState]
    );
    await connection.query(
      `INSERT INTO historial_cambios_malla (id_plan,id_plan_curso,id_usuario,accion,detalle)
       VALUES (?,?,?,'CURSO_ACTUALIZADO',JSON_OBJECT('id_ciclo',?,'tipo_curso',?,'orden',?,'estado',?))`,
      [req.params.id, req.params.idPlanCurso, req.auth.id, nextCycle, tipo_curso || entry.tipo_curso,
        orden === undefined ? entry.orden : orden, nextState]
    );
    await connection.commit();
    return res.json({ success: true, message: 'Curso actualizado; el cambio quedó registrado en el historial.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.post('/planes/:id/prerrequisitos', ...admin, async (req, res, next) => {
  const { id_plan_curso, id_plan_curso_requisito } = req.body;
  if (![id_plan_curso, id_plan_curso_requisito].every((value) => Number.isInteger(Number(value)) && Number(value) > 0)
      || Number(id_plan_curso) === Number(id_plan_curso_requisito)) {
    return res.status(400).json({ success: false, message: 'Selecciona dos cursos distintos del plan.' });
  }
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [[control]] = await connection.query('SELECT estado_gestion FROM plan_estudio_control WHERE id_plan=? FOR UPDATE', [req.params.id]);
    if (!control) throw fail(404, 'Plan no encontrado.');
    if (control.estado_gestion !== 'Borrador') throw fail(409, 'Solo se puede editar una versión en borrador.');
    const [courses] = await connection.query(
      `SELECT pc.id_plan_curso,pc.id_ciclo,cy.numero,COALESCE(pcc.estado,'Activo') AS estado
       FROM plan_cursos pc JOIN ciclos cy ON cy.id_ciclo=pc.id_ciclo
       LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=pc.id_plan_curso
       WHERE pc.id_plan=? AND pc.id_plan_curso IN (?,?) FOR UPDATE`,
      [req.params.id, id_plan_curso, id_plan_curso_requisito]
    );
    if (courses.length !== 2 || courses.some((course) => course.estado !== 'Activo')) throw fail(400, 'Ambos cursos deben estar activos y pertenecer al mismo plan.');
    const current = courses.find((course) => Number(course.id_plan_curso) === Number(id_plan_curso));
    const prerequisite = courses.find((course) => Number(course.id_plan_curso) === Number(id_plan_curso_requisito));
    if (Number(prerequisite.numero) >= Number(current.numero)) throw fail(400, 'El prerrequisito debe pertenecer a un ciclo anterior.');
    const [edges] = await connection.query(
      `SELECT pc.id_plan_curso AS courseId,pr.id_plan_curso AS prerequisiteId,
              cy.numero AS courseCycle,cypr.numero AS prerequisiteCycle
       FROM curso_prerrequisitos r
       JOIN plan_cursos pc ON pc.id_plan_curso=r.id_plan_curso AND pc.id_plan=?
       JOIN plan_cursos pr ON pr.id_plan_curso=r.id_plan_curso_requisito AND pr.id_plan=?
       JOIN ciclos cy ON cy.id_ciclo=pc.id_ciclo
       JOIN ciclos cypr ON cypr.id_ciclo=pr.id_ciclo`,
      [req.params.id, req.params.id]
    );
    const graph = [...edges, { courseId: id_plan_curso, prerequisiteId: id_plan_curso_requisito }];
    const cycles = new Map();
    for (const edge of edges) {
      cycles.set(Number(edge.courseId), Number(edge.courseCycle));
      cycles.set(Number(edge.prerequisiteId), Number(edge.prerequisiteCycle));
    }
    cycles.set(Number(current.id_plan_curso), Number(current.numero));
    cycles.set(Number(prerequisite.id_plan_curso), Number(prerequisite.numero));
    if (invalidPrerequisiteEdges(graph, cycles)) throw fail(409, 'El prerrequisito generaría una dependencia circular.');
    await connection.query(
      'INSERT INTO curso_prerrequisitos (id_plan_curso,id_plan_curso_requisito) VALUES (?,?)',
      [id_plan_curso, id_plan_curso_requisito]
    );
    await connection.query(
      `INSERT INTO historial_cambios_malla (id_plan,id_plan_curso,id_usuario,accion,detalle)
       VALUES (?,?,?,'PRERREQUISITO_AGREGADO',JSON_OBJECT('id_plan_curso_requisito',?))`,
      [req.params.id, id_plan_curso, req.auth.id, id_plan_curso_requisito]
    );
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Prerrequisito agregado y validado.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.get('/planes/:id/historial', ...staff, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT h.*,u.usuario FROM historial_cambios_malla h
       LEFT JOIN usuarios u ON u.id_usuario=h.id_usuario
       WHERE h.id_plan=? ORDER BY h.creado_en DESC,h.id_historial DESC LIMIT 500`,
      [req.params.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
