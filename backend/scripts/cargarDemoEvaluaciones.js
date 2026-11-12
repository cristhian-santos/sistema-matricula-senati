const pool = require('../src/config/db');
const { canAddWeight } = require('../src/services/academicProgress');

const demoEvaluationNames = [
  { nombre: 'DEMO - Práctica 1', tipo: 'Practica', weight: 40, offset: 30 },
  { nombre: 'DEMO - Examen final', tipo: 'Examen', weight: 60, offset: 90 }
];
const weekdays = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const tables = ['evaluaciones','sesiones_clase','calificaciones','historial_calificaciones','asistencias'];

async function getCounts(connection) {
  const counts = {};
  for (const table of tables) {
    const [[row]] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    counts[table] = Number(row.total);
  }
  return counts;
}

function scheduledDates(start, end, scheduleDays, limit = 3) {
  const result = [];
  for (let cursor = new Date(`${start}T00:00:00Z`);
    cursor.toISOString().slice(0, 10) <= end && result.length < limit;
    cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (scheduleDays.has(weekdays[cursor.getUTCDay()])) result.push(cursor.toISOString().slice(0, 10));
  }
  return result;
}

async function seedEvaluationDemo() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') throw new Error('Se requiere la base bd_matricula.');
    const requiredTables = [
      'evaluaciones','calificaciones','sesiones_clase','asistencias','matriculas',
      'secciones','seccion_horarios','docentes_secciones','docentes','estudiantes',
      'periodos_academicos','historial_calificaciones','usuarios','roles','usuario_roles'
    ];
    const [existingTables] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?)`,
      [requiredTables]
    );
    if (existingTables.length !== requiredTables.length) {
      throw new Error('Aplica primero la migración académica, autenticación, horarios y npm run migrate:evaluations.');
    }

    const [[admin]] = await connection.query(
      `SELECT u.id_usuario
       FROM usuarios u
       JOIN usuario_roles ur ON ur.id_usuario=u.id_usuario
       JOIN roles r ON r.id_rol=ur.id_rol AND r.nombre='Administrador'
       WHERE u.estado='Activo' ORDER BY u.id_usuario LIMIT 1`
    );
    if (!admin) throw new Error('Se requiere al menos una cuenta Administrador activa para auditar las notas demo.');

    const [sections] = await connection.query(
      `SELECT s.id_seccion,s.codigo,DATE_FORMAT(p.fecha_inicio,'%Y-%m-%d') AS fecha_inicio,
              DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS fecha_fin
       FROM secciones s
       JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
       JOIN docentes_secciones ds ON ds.id_seccion=s.id_seccion AND ds.estado='Activo'
       JOIN docentes d ON d.id_docente=ds.id_docente AND d.estado='Activo'
       JOIN seccion_horarios h ON h.id_seccion=s.id_seccion
       WHERE s.codigo LIKE 'DEMO-%'
       GROUP BY s.id_seccion,s.codigo,p.fecha_inicio,p.fecha_fin
       ORDER BY p.fecha_inicio,s.codigo`
    );
    if (sections.length < 15) throw new Error('Primero carga al menos 15 secciones demo con horarios y docentes activos.');

    const [[invalidRelationships]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM matriculas m
       JOIN secciones s ON s.id_seccion=m.id_seccion
       JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
       WHERE s.codigo LIKE 'DEMO-%' AND (m.id_curso<>s.id_curso OR m.periodo<>p.codigo)`
    );
    if (Number(invalidRelationships.total)) throw new Error('Se detectaron matrículas demo que no corresponden al curso/periodo de la sección.');

    const before = await getCounts(connection);
    const report = { secciones_revisadas: sections.length, calificaciones_demo_insertadas: 0 };
    const today = new Date().toISOString().slice(0, 10);
    await connection.beginTransaction();

    for (const section of sections) {
      await connection.query('SELECT id_seccion FROM secciones WHERE id_seccion=? FOR UPDATE', [section.id_seccion]);
      const [[weightRow]] = await connection.query(
        'SELECT COALESCE(SUM(peso_porcentaje),0) AS total FROM evaluaciones WHERE id_seccion=? FOR UPDATE',
        [section.id_seccion]
      );
      let totalWeight = Number(weightRow.total);
      if (!canAddWeight(totalWeight, 0)) throw new Error(`La sección demo ${section.codigo} ya supera 100% de ponderación.`);
      for (const item of demoEvaluationNames) {
        const [[present]] = await connection.query(
          'SELECT id_evaluacion FROM evaluaciones WHERE id_seccion=? AND nombre=?',
          [section.id_seccion, item.nombre]
        );
        if (present) continue;
        if (!canAddWeight(totalWeight, item.weight)) continue;
        const date = new Date(`${section.fecha_inicio}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + item.offset);
        const evaluationDate = date.toISOString().slice(0, 10);
        if (evaluationDate > section.fecha_fin) continue;
        await connection.query(
          `INSERT INTO evaluaciones (id_seccion,nombre,tipo,peso_porcentaje,fecha,estado)
           VALUES (?,?,?,?,?,'Abierta')`,
          [section.id_seccion, item.nombre, item.tipo, item.weight, evaluationDate]
        );
        totalWeight += item.weight;
      }

      const [schedules] = await connection.query(
        'SELECT DISTINCT dia_semana FROM seccion_horarios WHERE id_seccion=?',
        [section.id_seccion]
      );
      const dates = scheduledDates(section.fecha_inicio, section.fecha_fin, new Set(schedules.map((row) => row.dia_semana)));
      for (const date of dates) {
        const [[present]] = await connection.query(
          'SELECT id_sesion FROM sesiones_clase WHERE id_seccion=? AND fecha=? LIMIT 1',
          [section.id_seccion, date]
        );
        if (!present) {
          await connection.query(
            'INSERT INTO sesiones_clase (id_seccion,fecha,tema,estado) VALUES (?,?,?,?)',
            [section.id_seccion, date, 'DEMO - Sesión generada desde horario', date <= today ? 'Realizada' : 'Programada']
          );
        }
      }
    }

    const [demoEnrollments] = await connection.query(
      `SELECT m.id_matricula,m.id_seccion
       FROM matriculas m
       JOIN estudiantes e ON e.id_estudiante=m.id_estudiante
       JOIN secciones s ON s.id_seccion=m.id_seccion
       JOIN periodos_academicos p ON p.id_periodo=s.id_periodo AND p.codigo=m.periodo
       WHERE e.email LIKE 'estudiante.demo%@example.test'
         AND s.codigo LIKE 'DEMO-%' AND m.estado='Matriculado'`
    );
    for (const enrollment of demoEnrollments) {
      const [evaluations] = await connection.query(
        `SELECT id_evaluacion,nombre FROM evaluaciones
         WHERE id_seccion=? AND nombre IN ('DEMO - Práctica 1','DEMO - Examen final')`,
        [enrollment.id_seccion]
      );
      for (const evaluation of evaluations) {
        const score = 12 + ((Number(enrollment.id_matricula) + Number(evaluation.id_evaluacion)) % 9);
        const [created] = await connection.query(
          'INSERT IGNORE INTO calificaciones (id_evaluacion,id_matricula,nota) VALUES (?,?,?)',
          [evaluation.id_evaluacion,enrollment.id_matricula,score]
        );
        if (!created.affectedRows) continue;
        report.calificaciones_demo_insertadas += 1;
        await connection.query(
          `INSERT INTO historial_calificaciones
           (id_calificacion,id_usuario,nota_anterior,nota_nueva,accion)
           VALUES (?,?,NULL,?,'CREADA')`,
          [created.insertId, admin.id_usuario, score]
        );
      }
      const [sessions] = await connection.query(
        `SELECT sc.id_sesion FROM sesiones_clase sc
         WHERE sc.id_seccion=? AND sc.estado='Realizada' AND sc.tema='DEMO - Sesión generada desde horario'`,
        [enrollment.id_seccion]
      );
      for (const session of sessions) {
        const status = ['Presente','Tardanza','Presente','Justificada'][
          (Number(enrollment.id_matricula) + Number(session.id_sesion)) % 4
        ];
        await connection.query(
          `INSERT IGNORE INTO asistencias (id_sesion,id_matricula,estado,observacion)
           VALUES (?,?,?,'Registro ficticio de demostración')`,
          [session.id_sesion,enrollment.id_matricula,status]
        );
      }
    }

    const [[invalidGrades]] = await connection.query(
      `SELECT COUNT(*) AS total FROM calificaciones ca
       JOIN evaluaciones ev ON ev.id_evaluacion=ca.id_evaluacion
       JOIN matriculas m ON m.id_matricula=ca.id_matricula
       WHERE ev.id_seccion<>m.id_seccion
         AND ev.nombre IN ('DEMO - Práctica 1','DEMO - Examen final')
         AND EXISTS (SELECT 1 FROM secciones ds WHERE ds.id_seccion=ev.id_seccion AND ds.codigo LIKE 'DEMO-%')`
    );
    const [[invalidAttendance]] = await connection.query(
      `SELECT COUNT(*) AS total FROM asistencias a
       JOIN sesiones_clase sc ON sc.id_sesion=a.id_sesion
       JOIN matriculas m ON m.id_matricula=a.id_matricula
       WHERE sc.id_seccion<>m.id_seccion
         AND sc.tema='DEMO - Sesión generada desde horario'
         AND EXISTS (SELECT 1 FROM secciones ds WHERE ds.id_seccion=sc.id_seccion AND ds.codigo LIKE 'DEMO-%')`
    );
    if (Number(invalidGrades.total) || Number(invalidAttendance.total)) {
      throw new Error('La validación de relaciones de notas/asistencias detectó una sección inconsistente.');
    }

    await connection.commit();
    const after = await getCounts(connection);
    report.registros = tables.map((table) => ({
      tabla: table,
      antes: before[table],
      despues: after[table],
      agregados: after[table] - before[table]
    }));
    console.log(JSON.stringify({ database: schemaName, ...report }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedEvaluationDemo().catch((error) => {
  console.error('No se pudieron cargar los datos demo de evaluaciones:', error.message);
  process.exitCode = 1;
});
