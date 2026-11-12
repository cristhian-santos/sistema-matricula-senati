const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/db');
const { splitStatements } = require('./sqlUtils');

async function applyEvaluationMigration() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') {
      throw new Error(`Base de datos inesperada: ${schemaName || 'ninguna'}; se requiere bd_matricula.`);
    }
    const requiredTables = ['calificaciones','evaluaciones','usuarios','matriculas','sesiones_clase','asistencias'];
    const [rows] = await connection.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?)`,
      [requiredTables]
    );
    if (rows.length !== requiredTables.length) {
      throw new Error('Aplica primero las migraciones académica y de autenticación.');
    }

    const sql = await fs.readFile(path.resolve(__dirname, '../../database/12_evaluaciones_asistencia.sql'), 'utf8');
    const statements = splitStatements(sql);
    if (!statements.length || statements.some((statement) =>
      !/^CREATE TABLE IF NOT EXISTS\b/i.test(statement)
      || /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE)\b/i.test(statement))) {
      throw new Error('La migración contiene una operación no permitida y no se ejecutará.');
    }
    for (const statement of statements) await connection.query(statement);
    console.log(`Migración de auditoría académica aplicada: ${statements.length} tabla(s) aditiva(s).`);
  } finally {
    connection.release();
    await pool.end();
  }
}

applyEvaluationMigration().catch((error) => {
  console.error('No se pudo aplicar la migración de evaluaciones y asistencia:', error.message);
  process.exitCode = 1;
});
