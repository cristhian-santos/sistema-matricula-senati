const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../src/config/db');
const { splitStatements } = require('./sqlUtils');

async function seedCurriculumDemo() {
  const connection = await pool.getConnection();
  try {
    const [[{ schema_name: schemaName }]] = await connection.query('SELECT DATABASE() AS schema_name');
    if (schemaName !== 'bd_matricula') throw new Error('Se requiere la base bd_matricula.');
    const [[{ required_tables: requiredTables }]] = await connection.query(
      `SELECT COUNT(DISTINCT TABLE_NAME) AS required_tables
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA=DATABASE()
         AND TABLE_NAME IN ('plan_estudio_control','plan_curso_control','planes_estudio',
           'plan_cursos','curso_prerrequisitos','carreras','ciclos','cursos')`
    );
    if (Number(requiredTables) !== 8) throw new Error('Ejecuta primero npm run migrate:curricula.');

    const sql = await fs.readFile(path.resolve(__dirname, '../../database/08_mallas_demo.sql'), 'utf8');
    const statements = splitStatements(sql);
    for (const statement of statements) {
      if (!/^INSERT IGNORE INTO\b/i.test(statement)
          || /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM|UPDATE|REPLACE\s+INTO)\b/i.test(statement)) {
        throw new Error('El seed contiene una operación no permitida y no se ejecutará.');
      }
    }
    await connection.beginTransaction();
    for (const statement of statements) await connection.query(statement);
    const [plans] = await connection.query(
      `SELECT c.nombre AS carrera,p.codigo,p.version,
              COUNT(DISTINCT pc.id_plan_curso) AS cursos,
              COUNT(DISTINCT pc.id_ciclo) AS ciclos,
              COUNT(DISTINCT CASE WHEN pc.tipo_curso='Obligatorio' THEN pc.id_ciclo END) AS ciclos_obligatorios,
              COALESCE(SUM(cu.creditos),0) AS creditos
       FROM planes_estudio p
       JOIN carreras c ON c.id_carrera=p.id_carrera
       LEFT JOIN plan_cursos pc ON pc.id_plan=p.id_plan
       LEFT JOIN cursos cu ON cu.id_curso=pc.id_curso
       WHERE p.codigo LIKE 'DEMO-MALLA-%'
       GROUP BY p.id_plan,c.nombre,p.codigo,p.version ORDER BY c.nombre`
    );
    const [references] = await connection.query(
      `SELECT COUNT(*) AS prerrequisitos
       FROM curso_prerrequisitos r
       JOIN plan_cursos pc ON pc.id_plan_curso=r.id_plan_curso
       JOIN plan_cursos pr ON pr.id_plan_curso=r.id_plan_curso_requisito AND pr.id_plan=pc.id_plan
       JOIN planes_estudio p ON p.id_plan=pc.id_plan
       WHERE p.codigo LIKE 'DEMO-MALLA-%'`
    );
    if (plans.length !== 5 || plans.some((plan) =>
      Number(plan.ciclos) !== 6 || Number(plan.ciclos_obligatorios) !== 6)) {
      throw new Error('Las cinco mallas demo deben tener seis ciclos con al menos un curso obligatorio por ciclo.');
    }
    if (Number(references[0].prerrequisitos) !== 25) {
      throw new Error('No se pudieron validar los 25 prerrequisitos demo mediante JOIN.');
    }
    await connection.commit();
    console.log(JSON.stringify({
      database: schemaName,
      demonstrationPlans: plans,
      joinedPrerequisites: Number(references[0].prerrequisitos),
      note: 'Las mallas son ilustrativas; no se asignan estudiantes automaticamente.'
    }, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedCurriculumDemo().catch((error) => {
  console.error('No se pudieron cargar las mallas de demostración:', error.message);
  process.exitCode = 1;
});
