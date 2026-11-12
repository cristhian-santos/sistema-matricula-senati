const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/db');
const { splitStatements } = require('./sqlUtils');

const trackedTables = ['sedes', 'aulas', 'secciones', 'docentes_secciones', 'seccion_horarios', 'matriculas'];

async function getCounts(connection) {
  const counts = {};
  for (const table of trackedTables) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    counts[table] = Number(rows[0].total);
  }
  return counts;
}

async function loadScheduleDemo() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') throw new Error('Se requiere la base bd_matricula.');
    const requiredTables = [
      'sedes','aulas','secciones','docentes_secciones','seccion_horarios',
      'modalidades','periodos_academicos','cursos','docentes','matriculas'
    ];
    const [tables] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?)`,
      [requiredTables]
    );
    if (tables.length !== requiredTables.length) {
      throw new Error('Ejecuta primero las migraciones académica y de autenticación y el seed de demostración.');
    }
    const [[sectionColumn]] = await connection.query(
      `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='matriculas' AND COLUMN_NAME='id_seccion'`
    );
    if (Number(sectionColumn.total) !== 1) throw new Error('La tabla matriculas requiere la relación opcional id_seccion.');

    const before = await getCounts(connection);
    const sql = await fs.readFile(path.resolve(__dirname, '../../database/10_horarios_demo.sql'), 'utf8');
    const statements = splitStatements(sql);
    const allowed = statements.every((statement) =>
      /^INSERT IGNORE INTO\b/i.test(statement)
      || /^INSERT INTO seccion_horarios\b/i.test(statement)
      || /^UPDATE seccion_horarios h\s+JOIN\b/i.test(statement)
      || /^UPDATE matriculas m\s+JOIN\s*\(/i.test(statement)
    );
    if (!allowed || statements.some((statement) =>
      /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM|REPLACE\s+INTO)\b/i.test(statement))) {
      throw new Error('El seed contiene una operación no permitida y no se ejecutará.');
    }

    await connection.beginTransaction();
    for (const statement of statements) await connection.query(statement);

    const [[catalogs]] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM sedes WHERE codigo IN ('DEMO-SUR','DEMO-NORTE')) AS sedes,
        (SELECT COUNT(*) FROM aulas a JOIN sedes s ON s.id_sede=a.id_sede
         WHERE s.codigo IN ('DEMO-SUR','DEMO-NORTE') AND a.codigo LIKE 'DEMO-A%') AS aulas`
    );
    if (Number(catalogs.sedes) < 2 || Number(catalogs.aulas) < 12) {
      throw new Error('Deben existir las dos sedes y los doce ambientes de demostración.');
    }

    const [[result]] = await connection.query(
      `SELECT COUNT(DISTINCT s.id_seccion) AS secciones,
              COUNT(DISTINCT h.id_seccion) AS secciones_con_horario,
              COUNT(DISTINCT CASE WHEN d.id_docente IS NOT NULL AND d.estado='Activo' THEN s.id_seccion END) AS secciones_con_docente_activo
       FROM secciones s
       JOIN cursos c ON c.id_curso=s.id_curso
       JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
       LEFT JOIN seccion_horarios h ON h.id_seccion=s.id_seccion
       LEFT JOIN docentes_secciones ds ON ds.id_seccion=s.id_seccion AND ds.estado='Activo'
       LEFT JOIN docentes d ON d.id_docente=ds.id_docente
       WHERE s.codigo LIKE 'DEMO-%'
         AND c.codigo IN ('DEV-201','BDS-202','SOF-203','RED-204','SEG-205')
         AND p.codigo IN ('2026-I','2026-II','2027-I','2027-II')`
    );
    if (Number(result.secciones) < 15 || Number(result.secciones_con_horario) < 15
        || Number(result.secciones_con_docente_activo) < 15) {
      throw new Error('Se requieren al menos 15 secciones demo con horario y docente activo. Revisa cursos, periodos, docentes y ambientes.');
    }

    const [[capacityIssues]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM secciones s JOIN seccion_horarios h ON h.id_seccion=s.id_seccion
       JOIN aulas a ON a.id_aula=h.id_aula
       WHERE s.codigo LIKE 'DEMO-%' AND a.capacidad<s.capacidad`
    );
    if (Number(capacityIssues.total)) throw new Error('Hay aulas demo con capacidad menor que la sección.');

    const [[conflicts]] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM seccion_horarios h1
         JOIN secciones s1 ON s1.id_seccion=h1.id_seccion
         JOIN seccion_horarios h2 ON h2.id_horario>h1.id_horario AND h2.dia_semana=h1.dia_semana
           AND h2.hora_inicio<h1.hora_fin AND h2.hora_fin>h1.hora_inicio
         JOIN secciones s2 ON s2.id_seccion=h2.id_seccion AND s2.id_periodo=s1.id_periodo
         WHERE (s1.codigo LIKE 'DEMO-%' OR s2.codigo LIKE 'DEMO-%')
           AND (h1.id_aula=h2.id_aula OR h1.id_seccion=h2.id_seccion)) AS aulas_o_secciones,
        (SELECT COUNT(*) FROM seccion_horarios h1
         JOIN secciones s1 ON s1.id_seccion=h1.id_seccion
         JOIN docentes_secciones ds1 ON ds1.id_seccion=s1.id_seccion AND ds1.estado='Activo'
         JOIN seccion_horarios h2 ON h2.id_horario>h1.id_horario AND h2.dia_semana=h1.dia_semana
           AND h2.hora_inicio<h1.hora_fin AND h2.hora_fin>h1.hora_inicio
         JOIN secciones s2 ON s2.id_seccion=h2.id_seccion AND s2.id_periodo=s1.id_periodo
         JOIN docentes_secciones ds2 ON ds2.id_seccion=s2.id_seccion
           AND ds2.id_docente=ds1.id_docente AND ds2.estado='Activo'
         WHERE (s1.codigo LIKE 'DEMO-%' OR s2.codigo LIKE 'DEMO-%')) AS docentes`
    );
    if (Number(conflicts.aulas_o_secciones) || Number(conflicts.docentes)) {
      throw new Error('Se detectaron cruces de aulas, secciones o docentes en los horarios demo.');
    }

    const [[invalidEnrollments]] = await connection.query(
      `SELECT COUNT(*) AS total FROM matriculas m
       JOIN secciones s ON s.id_seccion=m.id_seccion
       JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
       WHERE m.id_seccion IS NOT NULL AND (s.id_curso<>m.id_curso OR p.codigo<>m.periodo)`
    );
    if (Number(invalidEnrollments.total)) throw new Error('Hay matrículas enlazadas a una sección de otro curso o periodo.');

    await connection.commit();
    const after = await getCounts(connection);
    const report = trackedTables.map((table) => ({
      table,
      before: before[table],
      after: after[table],
      added: after[table] - before[table]
    }));
    console.log(JSON.stringify({
      database: schemaName,
      demoSections: Number(result.secciones),
      scheduledDemoSections: Number(result.secciones_con_horario),
      demoSectionsWithActiveTeacher: Number(result.secciones_con_docente_activo),
      conflicts,
      counts: report
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

loadScheduleDemo().catch((error) => {
  console.error('No se pudieron cargar los horarios de demostración:', error.message);
  process.exitCode = 1;
});
