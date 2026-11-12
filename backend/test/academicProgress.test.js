const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { splitStatements } = require('../scripts/sqlUtils');
const {
  attendancePercentage,
  canAddWeight,
  gradeStatus,
  hasCompleteWeight,
  isValidGrade,
  isValidWeight,
  weightedAverage
} = require('../src/services/academicProgress');

test('grade validation follows the 0–20 scale and database precision', () => {
  assert.equal(isValidGrade(0), true);
  assert.equal(isValidGrade('20.00'), true);
  assert.equal(isValidGrade(-0.01), false);
  assert.equal(isValidGrade(20.01), false);
  assert.equal(isValidGrade('10.001'), false);
  assert.equal(isValidGrade(''), false);
});

test('evaluation weights cannot exceed 100% and must close at exactly 100%', () => {
  assert.equal(isValidWeight('40.25'), true);
  assert.equal(isValidWeight('0'), false);
  assert.equal(isValidWeight('1.001'), false);
  assert.equal(canAddWeight(40, 60), true);
  assert.equal(canAddWeight(40, 60.01), false);
  assert.equal(hasCompleteWeight(100), true);
  assert.equal(hasCompleteWeight(99.99), false);
});

test('weighted average normalizes over evaluations with a grade', () => {
  assert.equal(weightedAverage([
    { nota: 12, peso_porcentaje: 40 },
    { nota: null, peso_porcentaje: 60 }
  ]), 12);
  assert.equal(weightedAverage([
    { nota: 12, peso_porcentaje: 40 },
    { nota: 18, peso_porcentaje: 60 }
  ]), 15.6);
  assert.equal(weightedAverage([{ nota: null, peso_porcentaje: 100 }]), null);
});

test('academic status and attendance percentage handle empty and justified records', () => {
  assert.equal(gradeStatus(null), 'Sin calificación');
  assert.equal(gradeStatus(11), 'Aprobado');
  assert.equal(gradeStatus(10.99), 'Desaprobado');
  assert.equal(attendancePercentage([]), null);
  assert.equal(attendancePercentage([
    { estado: 'Presente' },
    { estado: 'Tardanza' },
    { estado: 'Justificada' },
    { estado: 'Falta' }
  ]), 75);
});

test('evaluation demo seed uses the existing database pool and is limited to demo records', () => {
  const seed = fs.readFileSync(path.resolve(__dirname, '../scripts/cargarDemoEvaluaciones.js'), 'utf8');
  assert.match(seed, /require\('\.\.\/src\/config\/db'\)/);
  assert.match(seed, /WHERE s\.codigo LIKE 'DEMO-%'/);
  assert.match(seed, /estudiante\.demo%@example\.test/);
  assert.match(seed, /INSERT IGNORE INTO calificaciones/);
  assert.match(seed, /beginTransaction\(\)/);
  assert.match(seed, /rollback\(\)/);
  assert.doesNotMatch(seed, /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM|REPLACE\s+INTO)\b/i);
});

test('evaluation migration and validation SQL are additive and read-only', () => {
  const migration = fs.readFileSync(path.resolve(__dirname, '../../database/12_evaluaciones_asistencia.sql'), 'utf8');
  const validation = fs.readFileSync(path.resolve(__dirname, '../../database/13_validar_evaluaciones_asistencia.sql'), 'utf8');
  const migrationStatements = splitStatements(migration);
  const validationStatements = splitStatements(validation);

  assert.equal(migrationStatements.length, 1);
  assert.match(migrationStatements[0], /^CREATE TABLE IF NOT EXISTS historial_calificaciones/i);
  assert.match(migration, /REFERENCES calificaciones\(id_calificacion\)/i);
  assert.match(migration, /REFERENCES usuarios\(id_usuario\)/i);
  assert.ok(validationStatements.length >= 4);
  assert.ok(validationStatements.every((statement) => /^SELECT\b/i.test(statement)));
});
