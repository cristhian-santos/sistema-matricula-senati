const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/db');
const { splitStatements } = require('./sqlUtils');

async function migrateAuth() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') {
      throw new Error(`Base de datos inesperada: ${schemaName || 'ninguna'}; se requiere bd_matricula.`);
    }

    const sql = await fs.readFile(path.resolve(__dirname, '../../database/04_autenticacion_docentes.sql'), 'utf8');
    const statements = splitStatements(sql);
    for (const statement of statements) {
      if (!/^(CREATE TABLE|INSERT IGNORE INTO)\b/i.test(statement)) {
        throw new Error('La migración contiene una operación no permitida y no se ejecutará.');
      }
      await connection.query(statement);
    }
    console.log(`Migración de autenticación aplicada: ${statements.length} sentencias.`);
  } finally {
    connection.release();
    await pool.end();
  }
}

migrateAuth().catch((error) => {
  console.error('No se pudo aplicar la migración de autenticación:', error.message);
  process.exitCode = 1;
});
