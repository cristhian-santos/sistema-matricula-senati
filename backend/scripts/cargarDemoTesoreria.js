const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/db');
const { splitStatements } = require('./sqlUtils');

async function seedTreasuryDemo() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') throw new Error('Se requiere la base bd_matricula.');
    const sql = await fs.readFile(path.resolve(__dirname, '../../database/06_datos_demo_tesoreria.sql'), 'utf8');
    const statements = splitStatements(sql);
    for (const statement of statements) {
      if (!/^INSERT IGNORE INTO\b/i.test(statement)
          || /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM|UPDATE)\b/i.test(statement)) {
        throw new Error('El seed contiene una operación no permitida y no se ejecutará.');
      }
    }

    await connection.beginTransaction();
    for (const statement of statements) await connection.query(statement);
    await connection.commit();
    const [plans] = await connection.query(
      `SELECT p.codigo,p.nombre,p.moneda,p.monto_total,COUNT(q.id_plan_pago_cuota) AS cuotas,
              COALESCE(SUM(q.monto),0) AS monto_cronograma
       FROM planes_pago p LEFT JOIN plan_pago_cuotas q ON q.id_plan_pago=p.id_plan_pago
       WHERE p.codigo LIKE 'DEMO-PLAN-%' GROUP BY p.id_plan_pago ORDER BY p.codigo`
    );
    console.log(JSON.stringify({ database: schemaName, demonstrationPlans: plans, note: 'No se crean asignaciones ni pagos.' }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedTreasuryDemo().catch((error) => {
  console.error('No se pudieron cargar los planes de demostración:', error.message);
  process.exitCode = 1;
});
