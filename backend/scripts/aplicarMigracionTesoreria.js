const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/db');
const { splitStatements } = require('./sqlUtils');

async function applyTreasuryMigration() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') {
      throw new Error(`Base de datos inesperada: ${schemaName || 'ninguna'}; se requiere bd_matricula.`);
    }

    const [[{ required_tables: requiredTables }]] = await connection.query(
      `SELECT COUNT(DISTINCT TABLE_NAME) AS required_tables
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA=DATABASE()
         AND TABLE_NAME IN ('carreras','periodos_academicos','conceptos_pago','obligaciones_pago',
           'estudiantes','pagos','usuarios','roles','usuario_roles')`
    );
    if (Number(requiredTables) !== 9) {
      throw new Error('Aplica primero las migraciones académica y de autenticación.');
    }

    const sql = await fs.readFile(path.resolve(__dirname, '../../database/05_tesoreria_planes_pago.sql'), 'utf8');
    const statements = splitStatements(sql);
    for (const statement of statements) {
      if (!/^CREATE TABLE\b/i.test(statement)
          || /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE)\b/i.test(statement)) {
        throw new Error('La migración contiene una operación no permitida y no se ejecutará.');
      }
      await connection.query(statement);
    }
    console.log(`Migración de tesorería aplicada: ${statements.length} tablas aditivas.`);
  } finally {
    connection.release();
    await pool.end();
  }
}

applyTreasuryMigration().catch((error) => {
  console.error('No se pudo aplicar la migración de tesorería:', error.message);
  process.exitCode = 1;
});
