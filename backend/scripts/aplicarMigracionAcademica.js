const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/db');
const { splitStatements } = require('./sqlUtils');

async function applyMigration() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') {
      throw new Error(`Base de datos inesperada: ${schemaName || 'ninguna'}; se requiere bd_matricula.`);
    }

    const migrationPath = path.resolve(__dirname, '../../database/02_ampliacion_academica.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    const statements = splitStatements(sql).filter((statement) => !/^USE\s+`?bd_matricula`?$/i.test(statement));
    const forbidden = statements.find((statement) => /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM)\b/i.test(statement));
    if (forbidden) throw new Error('La migración contiene una operación destructiva y no se ejecutará.');

    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log(`Migración aplicada sin operaciones destructivas: ${statements.length} sentencias.`);
  } finally {
    connection.release();
    await pool.end();
  }
}

applyMigration().catch((error) => {
  console.error('No se pudo aplicar la migración académica:', error.message);
  process.exitCode = 1;
});
