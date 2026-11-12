const pool = require('../src/config/db');

const quoteIdentifier = (identifier) => `\`${String(identifier).replaceAll('`', '``')}\``;

async function auditDatabase() {
  const [[{ schema_name: database }]] = await pool.query('SELECT DATABASE() AS schema_name');
  if (database !== 'bd_matricula') {
    throw new Error(`La conexión apunta a ${database || 'ninguna base'}; se requiere bd_matricula.`);
  }

  const [tables] = await pool.query(`
    SELECT TABLE_NAME AS table_name
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  const [columns] = await pool.query(`
    SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
           COLUMN_TYPE AS column_type, IS_NULLABLE AS nullable,
           COLUMN_KEY AS column_key, COLUMN_DEFAULT AS default_value
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  const [foreignKeys] = await pool.query(`
    SELECT TABLE_NAME AS child_table, COLUMN_NAME AS child_column,
           REFERENCED_TABLE_NAME AS parent_table,
           REFERENCED_COLUMN_NAME AS parent_column,
           CONSTRAINT_NAME AS constraint_name
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION
  `);

  const counts = [];
  for (const { table_name: table } of tables) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`);
    counts.push({ table, count: Number(rows[0].count) });
  }

  const orphans = [];
  for (const foreignKey of foreignKeys) {
    const childTable = quoteIdentifier(foreignKey.child_table);
    const childColumn = quoteIdentifier(foreignKey.child_column);
    const parentTable = quoteIdentifier(foreignKey.parent_table);
    const parentColumn = quoteIdentifier(foreignKey.parent_column);
    const [rows] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM ${childTable} child
      LEFT JOIN ${parentTable} parent
        ON child.${childColumn} = parent.${parentColumn}
      WHERE child.${childColumn} IS NOT NULL AND parent.${parentColumn} IS NULL
    `);
    orphans.push({ ...foreignKey, count: Number(rows[0].count) });
  }

  return {
    database,
    tables: counts,
    emptyTables: counts.filter((item) => item.count === 0).map((item) => item.table),
    columns,
    foreignKeys,
    orphans
  };
}

auditDatabase()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    const causes = Array.isArray(error.errors)
      ? error.errors.map((cause) => cause.code || cause.message).filter(Boolean).join(', ')
      : '';
    console.error(
      'No se pudo completar la auditoría de la base de datos:',
      error.message || error.code || causes || 'Error desconocido.'
    );
    process.exitCode = 1;
  })
  .finally(() => pool.end());
