const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { splitStatements } = require('../scripts/sqlUtils');
const { intervalsOverlap, isValidTimeRange } = require('../src/services/horarioUtils');

test('schedule time ranges are valid and adjacent classes do not overlap', () => {
  assert.equal(isValidTimeRange('08:00:00', '10:00:00'), true);
  assert.equal(isValidTimeRange('18:30', '20:00'), true);
  assert.equal(isValidTimeRange('10:00', '08:00'), false);
  assert.equal(isValidTimeRange('08:00', '08:00:00'), false);
  assert.equal(isValidTimeRange('25:00', '26:00'), false);
  assert.equal(intervalsOverlap('08:00', '10:00', '10:00', '12:00'), false);
  assert.equal(intervalsOverlap('08:00', '10:00', '09:59', '11:00'), true);
});

test('schedule demo seed is incremental and only links unambiguous enrollments', () => {
  const seed = fs.readFileSync(path.resolve(__dirname, '../../database/10_horarios_demo.sql'), 'utf8');
  const validation = fs.readFileSync(path.resolve(__dirname, '../../database/11_validar_horarios.sql'), 'utf8');
  const statements = splitStatements(seed);

  assert.ok(statements.length >= 7);
  assert.ok(statements.every((statement) =>
    /^INSERT IGNORE INTO\b/i.test(statement)
    || /^INSERT INTO seccion_horarios\b/i.test(statement)
    || /^UPDATE seccion_horarios h\s+JOIN\b/i.test(statement)
    || /^UPDATE matriculas m\s+JOIN\s*\(/i.test(statement)
  ));
  for (const statement of statements) {
    assert.doesNotMatch(statement, /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM|REPLACE\s+INTO)\b/i);
  }
  assert.match(seed, /HAVING COUNT\(DISTINCT s\.id_seccion\)=1/i);
  assert.match(seed, /m2\.id_seccion IS NULL/i);
  assert.match(seed, /existente\.id_seccion=s\.id_seccion/);
  assert.doesNotMatch(seed, /r\.capacidad_aula/);
  assert.match(validation, /a\.capacidad<s\.capacidad/);
  assert.match(validation, /ds2\.id_docente=ds1\.id_docente/);
});
