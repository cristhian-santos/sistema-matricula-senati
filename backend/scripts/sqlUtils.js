function splitStatements(sql) {
  const statements = [];
  let statement = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        statement += '\n';
      }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      statement += char;
      if (char === '\\' && next) {
        statement += next;
        index += 1;
      } else if (char === quote && next === quote) {
        statement += next;
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if ((char === '-' && next === '-' && /\s/.test(sql[index + 2] || '')) || char === '#') {
      lineComment = true;
      index += char === '-' ? 1 : 0;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      statement += char;
      continue;
    }
    if (char === ';') {
      if (statement.trim()) statements.push(statement.trim());
      statement = '';
      continue;
    }
    statement += char;
  }
  if (statement.trim()) statements.push(statement.trim());
  return statements;
}

module.exports = { splitStatements };
