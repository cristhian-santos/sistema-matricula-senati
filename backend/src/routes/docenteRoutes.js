const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireTeacher } = require('../middlewares/auth');
const {
  attendancePercentage,
  canAddWeight,
  gradeStatus,
  hasCompleteWeight,
  isValidGrade,
  isValidWeight,
  weightedAverage
} = require('../services/academicProgress');

const router = express.Router();
router.use(requireAuth, requireTeacher);
const weekdays = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

async function ownsSection(userId, sectionId) {
  const [[row]] = await pool.query(
    `SELECT s.id_seccion FROM secciones s
     JOIN docentes_secciones ds ON ds.id_seccion=s.id_seccion
     JOIN usuarios u ON u.id_docente=ds.id_docente
     WHERE u.id_usuario=? AND s.id_seccion=? AND ds.estado='Activo'`,
    [userId, sectionId]
  );
  return Boolean(row);
}

router.get('/perfil', async (req, res, next) => {
  try {
    const [[teacher]] = await pool.query(
      `SELECT id_docente,codigo_docente,dni,nombres,apellidos,email,telefono,especialidad,tipo_contrato,fecha_ingreso,estado
       FROM docentes WHERE id_docente=?`,
      [req.auth.id_docente]
    );
    if (!teacher || teacher.estado !== 'Activo') return res.status(403).json({ success: false, message: 'El perfil docente está inactivo.' });
    return res.json({ success: true, data: teacher });
  } catch (error) {
    return next(error);
  }
});

router.get('/secciones', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id_seccion,s.codigo AS seccion,s.turno,s.capacidad,s.estado,
              DATE_FORMAT(p.fecha_inicio,'%Y-%m-%d') AS periodo_inicio,
              DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS periodo_fin,
              c.codigo AS curso_codigo,c.nombre AS curso,p.codigo AS periodo,
              GROUP_CONCAT(DISTINCT CONCAT(h.dia_semana,' ',TIME_FORMAT(h.hora_inicio,'%H:%i'),'-',TIME_FORMAT(h.hora_fin,'%H:%i'),' · ',a.nombre)
                ORDER BY FIELD(h.dia_semana,'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'),h.hora_inicio SEPARATOR ' | ') AS horario,
              COUNT(DISTINCT m.id_matricula) AS inscritos
       FROM usuarios u
       JOIN docentes_secciones ds ON ds.id_docente=u.id_docente AND ds.estado='Activo'
       JOIN secciones s ON s.id_seccion=ds.id_seccion
       JOIN cursos c ON c.id_curso=s.id_curso
       JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
       LEFT JOIN seccion_horarios h ON h.id_seccion=s.id_seccion
       LEFT JOIN aulas a ON a.id_aula=h.id_aula
       LEFT JOIN matriculas m ON m.id_seccion=s.id_seccion AND m.estado='Matriculado'
       WHERE u.id_usuario=?
       GROUP BY s.id_seccion ORDER BY p.codigo DESC,c.nombre,s.codigo`,
      [req.auth.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/secciones/:id/estudiantes', async (req, res, next) => {
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const [rows] = await pool.query(
      `SELECT m.id_matricula,e.id_estudiante,e.dni,e.nombres,e.apellidos,e.email,m.estado AS estado_matricula
       FROM matriculas m JOIN estudiantes e ON e.id_estudiante=m.id_estudiante
       WHERE m.id_seccion=? AND m.estado='Matriculado' ORDER BY e.apellidos,e.nombres`,
      [req.params.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/secciones/:id/evaluaciones', async (req, res, next) => {
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const [rows] = await pool.query(
      `SELECT e.id_evaluacion,e.nombre,e.tipo,e.peso_porcentaje,e.fecha,e.estado,
              ca.id_matricula,ca.nota,
              (SELECT COALESCE(SUM(esquema.peso_porcentaje),0)
               FROM evaluaciones esquema WHERE esquema.id_seccion=e.id_seccion) AS peso_total
       FROM evaluaciones e
       LEFT JOIN calificaciones ca ON ca.id_evaluacion=e.id_evaluacion
         AND EXISTS (
           SELECT 1 FROM matriculas m
           WHERE m.id_matricula=ca.id_matricula
             AND m.id_seccion=e.id_seccion AND m.estado='Matriculado'
         )
       WHERE e.id_seccion=? ORDER BY e.fecha,e.id_evaluacion,ca.id_matricula`,
      [req.params.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/secciones/:id/sesiones', async (req, res, next) => {
  const { fecha, tema } = req.body;
  if (!validDate(fecha) || !String(tema || '').trim()) {
    return res.status(400).json({ success: false, message: 'Fecha y tema son obligatorios.' });
  }
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[section]] = await connection.query(
        `SELECT s.id_seccion,DATE_FORMAT(p.fecha_inicio,'%Y-%m-%d') AS fecha_inicio,
                DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS fecha_fin
         FROM secciones s JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
         WHERE s.id_seccion=? FOR UPDATE`,
        [req.params.id]
      );
      if (!section || fecha < String(section.fecha_inicio).slice(0, 10) || fecha > String(section.fecha_fin).slice(0, 10)) {
        throw fail(400, 'La fecha debe pertenecer al periodo académico de la sección.');
      }
      const [[schedule]] = await connection.query(
        'SELECT dia_semana FROM seccion_horarios WHERE id_seccion=? AND dia_semana=? LIMIT 1',
        [req.params.id, weekdays[new Date(`${fecha}T00:00:00Z`).getUTCDay()]]
      );
      if (!schedule) throw fail(400, 'La fecha no coincide con un día programado para esta sección.');
      const [[existing]] = await connection.query(
        'SELECT id_sesion FROM sesiones_clase WHERE id_seccion=? AND fecha=? ORDER BY id_sesion DESC LIMIT 1 FOR UPDATE',
        [req.params.id, fecha]
      );
      if (existing) throw fail(409, 'Ya existe una sesión para esta sección en esa fecha.');
      const [result] = await connection.query(
        "INSERT INTO sesiones_clase (id_seccion,fecha,tema,estado) VALUES (?,?,?,'Programada')",
        [req.params.id, fecha, String(tema).trim().slice(0, 200)]
      );
      await connection.commit();
      return res.status(201).json({ success: true, data: { id_sesion: result.insertId }, message: 'Sesión programada.' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.post('/secciones/:id/sesiones/generar', async (req, res, next) => {
  const { desde, hasta } = req.body;
  if (!validDate(desde) || !validDate(hasta) || desde > hasta) {
    return res.status(400).json({ success: false, message: 'Indica un rango de fechas válido.' });
  }
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[section]] = await connection.query(
        `SELECT s.id_seccion,DATE_FORMAT(p.fecha_inicio,'%Y-%m-%d') AS fecha_inicio,
                DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS fecha_fin
         FROM secciones s JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
         WHERE s.id_seccion=? FOR UPDATE`,
        [req.params.id]
      );
      if (!section || desde < String(section.fecha_inicio).slice(0, 10)
          || hasta > String(section.fecha_fin).slice(0, 10)) {
        throw fail(400, 'El rango de sesiones debe quedar dentro del periodo académico de la sección.');
      }
      const [[range]] = await connection.query(
        'SELECT DATEDIFF(?,?) AS dias',
        [hasta, desde]
      );
      if (Number(range.dias) > 180) throw fail(400, 'El rango para generar sesiones no puede superar 180 días.');
      const [schedules] = await connection.query(
        'SELECT DISTINCT dia_semana FROM seccion_horarios WHERE id_seccion=?',
        [req.params.id]
      );
      if (!schedules.length) throw fail(409, 'La sección no tiene horarios semanales configurados.');
      const scheduledDays = new Set(schedules.map((item) => item.dia_semana));
      const [existingSessions] = await connection.query(
        'SELECT DATE_FORMAT(fecha,\'%Y-%m-%d\') AS fecha FROM sesiones_clase WHERE id_seccion=? AND fecha BETWEEN ? AND ?',
        [req.params.id, desde, hasta]
      );
      const existingDates = new Set(existingSessions.map((item) => item.fecha));
      const dates = [];
      for (let cursor = new Date(`${desde}T00:00:00Z`); cursor.toISOString().slice(0, 10) <= hasta; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const date = cursor.toISOString().slice(0, 10);
        if (scheduledDays.has(weekdays[cursor.getUTCDay()]) && !existingDates.has(date)) dates.push(date);
      }
      for (const date of dates) {
        await connection.query(
          "INSERT INTO sesiones_clase (id_seccion,fecha,tema,estado) VALUES (?,?,'Sesión generada desde horario','Programada')",
          [req.params.id, date]
        );
      }
      await connection.commit();
      return res.status(201).json({
        success: true,
        data: { creadas: dates.length },
        message: `Se generaron ${dates.length} sesiones nuevas; las existentes se conservaron.`
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.get('/secciones/:id/sesiones', async (req, res, next) => {
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const [rows] = await pool.query(
      `SELECT sc.id_sesion,DATE_FORMAT(sc.fecha,'%Y-%m-%d') AS fecha,sc.tema,sc.estado,
              COUNT(a.id_asistencia) AS asistencias_registradas
       FROM sesiones_clase sc
       LEFT JOIN asistencias a ON a.id_sesion=sc.id_sesion
       WHERE sc.id_seccion=? GROUP BY sc.id_sesion ORDER BY sc.fecha DESC,sc.id_sesion DESC`,
      [req.params.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/secciones/:id/sesiones/:sessionId/asistencias', async (req, res, next) => {
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const [[session]] = await pool.query(
      'SELECT id_sesion FROM sesiones_clase WHERE id_sesion=? AND id_seccion=?',
      [req.params.sessionId, req.params.id]
    );
    if (!session) return res.status(404).json({ success: false, message: 'Sesión no encontrada en esta sección.' });
    const [rows] = await pool.query(
      `SELECT m.id_matricula,e.nombres,e.apellidos,a.estado AS asistencia,a.observacion
       FROM matriculas m
       JOIN estudiantes e ON e.id_estudiante=m.id_estudiante
       LEFT JOIN asistencias a ON a.id_matricula=m.id_matricula AND a.id_sesion=?
       WHERE m.id_seccion=? AND m.estado='Matriculado'
       ORDER BY e.apellidos,e.nombres`,
      [req.params.sessionId, req.params.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/secciones/:id/asistencias/historial', async (req, res, next) => {
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const [rows] = await pool.query(
      `SELECT m.id_matricula,e.dni,e.nombres,e.apellidos,
              DATE_FORMAT(sc.fecha,'%Y-%m-%d') AS fecha,sc.tema,a.estado,a.observacion
       FROM asistencias a
       JOIN sesiones_clase sc ON sc.id_sesion=a.id_sesion AND sc.id_seccion=?
       JOIN matriculas m ON m.id_matricula=a.id_matricula AND m.id_seccion=sc.id_seccion
       JOIN estudiantes e ON e.id_estudiante=m.id_estudiante
       ORDER BY sc.fecha DESC,sc.id_sesion DESC,e.apellidos,e.nombres`,
      [req.params.id]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/secciones/:id/asistencias', async (req, res, next) => {
  const { fecha, tema, estudiantes } = req.body || {};
  if (!validDate(fecha) || !String(tema || '').trim()
      || !Array.isArray(estudiantes) || !estudiantes.length) {
    return res.status(400).json({ success: false, message: 'Fecha, tema y lista de asistencias son obligatorios.' });
  }
  if (estudiantes.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    return res.status(400).json({ success: false, message: 'La lista contiene registros de asistencia inválidos.' });
  }
  const enrollmentIds = estudiantes.map((item) => Number(item.id_matricula));
  if (enrollmentIds.some((id) => !Number.isInteger(id) || id < 1)
      || new Set(enrollmentIds).size !== enrollmentIds.length) {
    return res.status(400).json({ success: false, message: 'La lista contiene matrículas inválidas o duplicadas.' });
  }
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[session]] = await connection.query(
        `SELECT sc.id_sesion,sc.estado,p.fecha_inicio,p.fecha_fin,
                DATE_FORMAT(CURDATE(),'%Y-%m-%d') AS hoy
         FROM sesiones_clase sc
         JOIN secciones s ON s.id_seccion=sc.id_seccion
         JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
         WHERE sc.id_seccion=? AND sc.fecha=? ORDER BY sc.id_sesion DESC LIMIT 1 FOR UPDATE`,
        [req.params.id, fecha]
      );
      if (!session) throw fail(404, 'No existe una sesión programada para esta sección y fecha.');
      if (session.estado === 'Cancelada') throw fail(409, 'No se puede registrar asistencia en una sesión cancelada.');
      if (fecha > session.hoy) throw fail(409, 'No se puede registrar asistencia antes de la fecha de la sesión.');
      if (fecha < String(session.fecha_inicio).slice(0, 10) || fecha > String(session.fecha_fin).slice(0, 10)) {
        throw fail(400, 'La sesión debe pertenecer al periodo de la sección.');
      }
      for (const item of estudiantes) {
        if (!['Presente','Tardanza','Falta','Justificada'].includes(item.estado)) throw Object.assign(new Error('Estado de asistencia inválido.'), { statusCode: 400 });
        const [enrollment] = await connection.query(
          "SELECT id_matricula FROM matriculas WHERE id_matricula=? AND id_seccion=? AND estado='Matriculado'",
          [item.id_matricula, req.params.id]
        );
        if (!enrollment.length) throw Object.assign(new Error('La matrícula no pertenece a esta sección.'), { statusCode: 400 });
        await connection.query(
          `INSERT INTO asistencias (id_sesion,id_matricula,estado,observacion) VALUES (?,?,?,?)
           ON DUPLICATE KEY UPDATE estado=VALUES(estado),observacion=VALUES(observacion)`,
          [session.id_sesion, item.id_matricula, item.estado, String(item.observacion || '').slice(0, 250) || null]
        );
      }
      await connection.query(
        "UPDATE sesiones_clase SET tema=?,estado='Realizada' WHERE id_sesion=?",
        [String(tema).trim().slice(0, 200), session.id_sesion]
      );
      await connection.commit();
      return res.json({ success: true, message: 'Asistencias guardadas.' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.post('/secciones/:id/evaluaciones', async (req, res, next) => {
  const { nombre, tipo, peso_porcentaje, fecha } = req.body || {};
  if (!String(nombre || '').trim() || !['Practica','Examen','Proyecto','Otro'].includes(tipo)
      || !isValidWeight(peso_porcentaje)
      || !validDate(fecha)) {
    return res.status(400).json({ success: false, message: 'Completa nombre, tipo, peso (1-100) y fecha válidos.' });
  }
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[section]] = await connection.query(
        `SELECT s.id_seccion,DATE_FORMAT(p.fecha_inicio,'%Y-%m-%d') AS fecha_inicio,
                DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS fecha_fin
         FROM secciones s JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
         WHERE s.id_seccion=? FOR UPDATE`,
        [req.params.id]
      );
      if (!section) throw fail(404, 'Sección no encontrada.');
      if (fecha < section.fecha_inicio || fecha > section.fecha_fin) {
        throw fail(400, 'La fecha de evaluación debe pertenecer al periodo de la sección.');
      }
      const [[weights]] = await connection.query(
        'SELECT COALESCE(SUM(peso_porcentaje),0) AS total FROM evaluaciones WHERE id_seccion=? FOR UPDATE',
        [req.params.id]
      );
      if (!canAddWeight(weights.total, peso_porcentaje)) {
        throw fail(409, 'El peso acumulado de las evaluaciones no puede superar 100%.');
      }
      const [result] = await connection.query(
        "INSERT INTO evaluaciones (id_seccion,nombre,tipo,peso_porcentaje,fecha,estado) VALUES (?,?,?,?,?,'Abierta')",
        [req.params.id, String(nombre).trim().slice(0, 100), tipo, Number(peso_porcentaje), fecha]
      );
      await connection.commit();
      return res.status(201).json({ success: true, data: { id_evaluacion: result.insertId }, message: 'Evaluación creada.' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.patch('/evaluaciones/:id/cerrar', async (req, res, next) => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[evaluation]] = await connection.query(
        `SELECT e.id_evaluacion,e.id_seccion,e.estado
         FROM evaluaciones e
         JOIN docentes_secciones ds ON ds.id_seccion=e.id_seccion AND ds.estado='Activo'
         JOIN usuarios u ON u.id_docente=ds.id_docente
         WHERE e.id_evaluacion=? AND u.id_usuario=? LIMIT 1 FOR UPDATE`,
        [req.params.id, req.auth.id]
      );
      if (!evaluation) throw fail(403, 'No tienes acceso a esta evaluación.');
      if (evaluation.estado === 'Cerrada') throw fail(409, 'La evaluación ya está cerrada.');
      const [[weights]] = await connection.query(
        `SELECT SUM(peso_porcentaje) AS total FROM evaluaciones WHERE id_seccion=?`,
        [evaluation.id_seccion]
      );
      if (!hasCompleteWeight(weights.total)) throw fail(409, 'Para cerrar la evaluación, las ponderaciones de la sección deben sumar exactamente 100%.');
      const [[missing]] = await connection.query(
        `SELECT COUNT(*) AS total
         FROM matriculas m
         WHERE m.id_seccion=? AND m.estado='Matriculado'
           AND NOT EXISTS (
             SELECT 1 FROM calificaciones c
             WHERE c.id_matricula=m.id_matricula AND c.id_evaluacion=?
           )`,
        [evaluation.id_seccion, evaluation.id_evaluacion]
      );
      if (Number(missing.total)) throw fail(409, `Faltan calificaciones para ${missing.total} estudiante(s) matriculado(s).`);
      await connection.query("UPDATE evaluaciones SET estado='Cerrada' WHERE id_evaluacion=?", [evaluation.id_evaluacion]);
      await connection.commit();
      return res.json({ success: true, message: 'Evaluación cerrada; sus calificaciones ya no pueden modificarse.' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.put('/evaluaciones/:id/notas', async (req, res, next) => {
  const { calificaciones } = req.body || {};
  if (!Array.isArray(calificaciones) || !calificaciones.length) return res.status(400).json({ success: false, message: 'No se recibieron calificaciones.' });
  if (calificaciones.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    return res.status(400).json({ success: false, message: 'La lista contiene calificaciones inválidas.' });
  }
  const enrollmentIds = calificaciones.map((item) => Number(item.id_matricula));
  if (enrollmentIds.some((id) => !Number.isInteger(id) || id < 1)
      || new Set(enrollmentIds).size !== enrollmentIds.length) {
    return res.status(400).json({ success: false, message: 'La lista contiene matrículas inválidas o duplicadas.' });
  }
  try {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[evaluation]] = await connection.query(
        `SELECT e.id_evaluacion,e.id_seccion,e.estado
         FROM evaluaciones e
         JOIN docentes_secciones ds ON ds.id_seccion=e.id_seccion AND ds.estado='Activo'
         JOIN usuarios u ON u.id_docente=ds.id_docente
         WHERE e.id_evaluacion=? AND u.id_usuario=? LIMIT 1 FOR UPDATE`,
        [req.params.id, req.auth.id]
      );
      if (!evaluation) throw fail(403, 'No tienes acceso a esta evaluación.');
      if (evaluation.estado !== 'Abierta') throw fail(409, 'La evaluación está cerrada; sus calificaciones están bloqueadas.');
      for (const item of calificaciones) {
        const grade = Number(item.nota);
        if (!isValidGrade(item.nota)) throw fail(400, 'Las notas deben estar entre 0 y 20 y tener como máximo dos decimales.');
        const [enrollment] = await connection.query(
          "SELECT id_matricula FROM matriculas WHERE id_matricula=? AND id_seccion=? AND estado='Matriculado'",
          [item.id_matricula, evaluation.id_seccion]
        );
        if (!enrollment.length) throw Object.assign(new Error('La matrícula no corresponde a una sección asignada.'), { statusCode: 400 });
        const [[current]] = await connection.query(
          'SELECT id_calificacion,nota FROM calificaciones WHERE id_evaluacion=? AND id_matricula=? FOR UPDATE',
          [req.params.id, item.id_matricula]
        );
        if (current && Number(current.nota) === grade) continue;
        if (current) {
          await connection.query(
            `INSERT INTO historial_calificaciones
             (id_calificacion,id_usuario,nota_anterior,nota_nueva,accion)
             VALUES (?,?,?,?,'MODIFICADA')`,
            [current.id_calificacion,req.auth.id,current.nota,grade]
          );
          await connection.query('UPDATE calificaciones SET nota=? WHERE id_calificacion=?', [grade,current.id_calificacion]);
        } else {
          const [created] = await connection.query(
            'INSERT INTO calificaciones (id_evaluacion,id_matricula,nota) VALUES (?,?,?)',
            [req.params.id,item.id_matricula,grade]
          );
          await connection.query(
            `INSERT INTO historial_calificaciones
             (id_calificacion,id_usuario,nota_anterior,nota_nueva,accion)
             VALUES (?,?,NULL,?,'CREADA')`,
            [created.insertId,req.auth.id,grade]
          );
        }
      }
      await connection.commit();
      return res.json({ success: true, message: 'Calificaciones guardadas.' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.get('/secciones/:id/reporte', async (req, res, next) => {
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const [gradeRows] = await pool.query(
      `SELECT m.id_matricula,ca.nota,e.peso_porcentaje
       FROM matriculas m
       LEFT JOIN calificaciones ca ON ca.id_matricula=m.id_matricula
       LEFT JOIN evaluaciones e ON e.id_evaluacion=ca.id_evaluacion AND e.id_seccion=m.id_seccion
       WHERE m.id_seccion=? AND m.estado='Matriculado'`,
      [req.params.id]
    );
    const [attendanceRows] = await pool.query(
      `SELECT m.id_matricula,a.estado
       FROM matriculas m
       JOIN asistencias a ON a.id_matricula=m.id_matricula
       JOIN sesiones_clase sc ON sc.id_sesion=a.id_sesion
         AND sc.id_seccion=m.id_seccion AND sc.estado='Realizada'
       WHERE m.id_seccion=? AND m.estado='Matriculado'`,
      [req.params.id]
    );
    const [students] = await pool.query(
      `SELECT id_matricula FROM matriculas WHERE id_seccion=? AND estado='Matriculado'`,
      [req.params.id]
    );
    const gradeGroups = new Map(students.map((student) => [Number(student.id_matricula), []]));
    for (const row of gradeRows) {
      if (row.nota !== null && row.peso_porcentaje !== null) {
        gradeGroups.get(Number(row.id_matricula))?.push(row);
      }
    }
    const studentAverages = [...gradeGroups.values()]
      .map(weightedAverage)
      .filter((average) => average !== null);
    const attendanceGroups = new Map(students.map((student) => [Number(student.id_matricula), []]));
    for (const row of attendanceRows) {
      if (row.estado) attendanceGroups.get(Number(row.id_matricula))?.push(row);
    }
    const studentAttendance = [...attendanceGroups.values()]
      .map(attendancePercentage)
      .filter((percentage) => percentage !== null);
    return res.json({
      success: true,
      data: {
        estudiantes: students.length,
        promedio: studentAverages.length
          ? Math.round((studentAverages.reduce((sum, item) => sum + item, 0) / studentAverages.length) * 100) / 100
          : null,
        asistencia_pct: studentAttendance.length
          ? Math.round((studentAttendance.reduce((sum, item) => sum + item, 0) / studentAttendance.length) * 100) / 100
          : null
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/secciones/:id/rendimiento', async (req, res, next) => {
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const [students] = await pool.query(
      `SELECT m.id_matricula,e.dni,e.nombres,e.apellidos
       FROM matriculas m JOIN estudiantes e ON e.id_estudiante=m.id_estudiante
       WHERE m.id_seccion=? AND m.estado='Matriculado' ORDER BY e.apellidos,e.nombres`,
      [req.params.id]
    );
    const [grades] = await pool.query(
      `SELECT ca.id_matricula,ca.nota,ev.peso_porcentaje,ev.nombre AS evaluacion
       FROM calificaciones ca JOIN evaluaciones ev ON ev.id_evaluacion=ca.id_evaluacion
       WHERE ev.id_seccion=? ORDER BY ev.fecha,ev.id_evaluacion`,
      [req.params.id]
    );
    const [attendance] = await pool.query(
      `SELECT a.id_matricula,a.estado,sc.fecha
       FROM asistencias a JOIN sesiones_clase sc ON sc.id_sesion=a.id_sesion
       WHERE sc.id_seccion=? AND sc.estado='Realizada' ORDER BY sc.fecha DESC,sc.id_sesion DESC`,
      [req.params.id]
    );
    const gradeGroups = new Map(students.map((student) => [Number(student.id_matricula), []]));
    for (const grade of grades) gradeGroups.get(Number(grade.id_matricula))?.push(grade);
    const attendanceGroups = new Map(students.map((student) => [Number(student.id_matricula), []]));
    for (const item of attendance) attendanceGroups.get(Number(item.id_matricula))?.push(item);
    const data = students.map((student) => {
      const average = weightedAverage(gradeGroups.get(Number(student.id_matricula)) || []);
      const records = attendanceGroups.get(Number(student.id_matricula)) || [];
      return {
        ...student,
        promedio_ponderado: average,
        estado_academico: gradeStatus(average),
        porcentaje_asistencia: attendancePercentage(records),
        evaluaciones_calificadas: (gradeGroups.get(Number(student.id_matricula)) || []).length,
        sesiones_registradas: records.length
      };
    });
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

router.get('/secciones/:id/estudiantes/:enrollmentId/historial', async (req, res, next) => {
  try {
    if (!(await ownsSection(req.auth.id, req.params.id))) return res.status(403).json({ success: false, message: 'No tienes asignada esta sección.' });
    const [[student]] = await pool.query(
      `SELECT m.id_matricula,e.dni,e.nombres,e.apellidos
       FROM matriculas m JOIN estudiantes e ON e.id_estudiante=m.id_estudiante
       WHERE m.id_matricula=? AND m.id_seccion=?`,
      [req.params.enrollmentId, req.params.id]
    );
    if (!student) return res.status(404).json({ success: false, message: 'La matrícula no pertenece a esta sección.' });
    const [grades] = await pool.query(
      `SELECT ev.nombre AS evaluacion,ev.tipo,ev.peso_porcentaje,ev.estado AS estado_evaluacion,
              ca.nota,DATE_FORMAT(ca.fecha_registro,'%Y-%m-%d %H:%i') AS fecha_registro
       FROM evaluaciones ev
       LEFT JOIN calificaciones ca ON ca.id_evaluacion=ev.id_evaluacion AND ca.id_matricula=?
       WHERE ev.id_seccion=? ORDER BY ev.fecha,ev.id_evaluacion`,
      [student.id_matricula, req.params.id]
    );
    const [attendance] = await pool.query(
      `SELECT DATE_FORMAT(sc.fecha,'%Y-%m-%d') AS fecha,sc.tema,sc.estado AS estado_sesion,
              a.estado AS asistencia,a.observacion
       FROM sesiones_clase sc
       LEFT JOIN asistencias a ON a.id_sesion=sc.id_sesion AND a.id_matricula=?
       WHERE sc.id_seccion=? ORDER BY sc.fecha DESC,sc.id_sesion DESC`,
      [student.id_matricula, req.params.id]
    );
    const average = weightedAverage(grades);
    return res.json({
      success: true,
      data: {
        estudiante: student,
        promedio_ponderado: average,
        estado_academico: gradeStatus(average),
        porcentaje_asistencia: attendancePercentage(attendance.filter((item) => item.asistencia)),
        evaluaciones: grades,
        asistencias: attendance
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/evaluaciones/:id/historial', async (req, res, next) => {
  try {
    const [[evaluation]] = await pool.query(
      `SELECT e.id_evaluacion,e.id_seccion
       FROM evaluaciones e
       JOIN docentes_secciones ds ON ds.id_seccion=e.id_seccion AND ds.estado='Activo'
       JOIN usuarios u ON u.id_docente=ds.id_docente
       WHERE e.id_evaluacion=? AND u.id_usuario=? LIMIT 1`,
      [req.params.id, req.auth.id]
    );
    if (!evaluation) return res.status(403).json({ success: false, message: 'No tienes acceso a esta evaluación.' });
    const [rows] = await pool.query(
      `SELECT h.id_historial,h.nota_anterior,h.nota_nueva,h.accion,
              DATE_FORMAT(h.fecha_cambio,'%Y-%m-%d %H:%i:%s') AS fecha_cambio,
              e.nombres,e.apellidos,m.id_matricula
       FROM historial_calificaciones h
       JOIN calificaciones ca ON ca.id_calificacion=h.id_calificacion
       JOIN matriculas m ON m.id_matricula=ca.id_matricula AND m.id_seccion=?
       JOIN estudiantes e ON e.id_estudiante=m.id_estudiante
       WHERE ca.id_evaluacion=? ORDER BY h.fecha_cambio DESC,h.id_historial DESC`,
      [evaluation.id_seccion, evaluation.id_evaluacion]
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
