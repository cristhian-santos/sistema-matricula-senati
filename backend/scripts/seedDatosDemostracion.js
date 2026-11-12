const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/db');
const { splitStatements } = require('./sqlUtils');

const trackedTables = [
  'carreras', 'ciclos', 'periodos_academicos', 'sedes', 'modalidades',
  'planes_estudio', 'plan_cursos', 'curso_prerrequisitos', 'cursos',
  'docentes', 'aulas', 'secciones', 'docentes_secciones', 'seccion_horarios',
  'evaluaciones', 'calificaciones', 'sesiones_clase', 'asistencias',
  'conceptos_pago', 'obligaciones_pago', 'pagos', 'pago_detalles',
  'estudiantes', 'matriculas'
];

const quoteIdentifier = (identifier) => `\`${String(identifier).replaceAll('`', '``')}\``;

async function getCounts(connection) {
  const counts = {};
  for (const table of trackedTables) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`);
    counts[table] = Number(rows[0].count);
  }
  return counts;
}

async function seedDemoData() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') {
      throw new Error(`Base de datos inesperada: ${schemaName || 'ninguna'}; se requiere bd_matricula.`);
    }

    const before = await getCounts(connection);
    const scriptPath = path.resolve(__dirname, '../../database/03_datos_demostracion.sql');
    const sql = await fs.readFile(scriptPath, 'utf8');
    const statements = splitStatements(sql);
    const unsafe = statements.find((statement) => !/^(INSERT|SELECT)\b/i.test(statement)
      || /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM|UPDATE)\b/i.test(statement));
    if (unsafe) throw new Error('El script contiene una operación no permitida; no se ejecutará.');

    await connection.beginTransaction();
    const validations = [];
    for (const statement of statements) {
      const [result] = await connection.query(statement);
      if (Array.isArray(result)) validations.push(result);
    }
    await connection.commit();
    const after = await getCounts(connection);
    const report = trackedTables.map((table) => ({
      table,
      before: before[table],
      after: after[table],
      added: after[table] - before[table]
    }));
    console.log(JSON.stringify({ database: schemaName, counts: report, validationResults: validations }, null, 2));
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedDemoData().catch((error) => {
  console.error('No se pudieron cargar los datos de demostración:', error.message);
  process.exitCode = 1;
});
