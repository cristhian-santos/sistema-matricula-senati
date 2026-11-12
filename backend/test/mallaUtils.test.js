const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { splitStatements } = require('../scripts/sqlUtils');
const {
  courseStatus,
  invalidPrerequisiteEdges,
  latestEnrollmentByCourse,
  missingPrerequisites
} = require('../src/services/mallaUtils');

test('prerequisite graphs reject cycles and requirements in the same or later cycle', () => {
  const cycles = new Map([[1, 1], [2, 2], [3, 3]]);
  assert.equal(invalidPrerequisiteEdges([
    { courseId: 2, prerequisiteId: 1 },
    { courseId: 3, prerequisiteId: 2 }
  ], cycles), false);
  assert.equal(invalidPrerequisiteEdges([
    { courseId: 1, prerequisiteId: 3 }
  ], cycles), true);
  assert.equal(invalidPrerequisiteEdges([
    { courseId: 1, prerequisiteId: 2 },
    { courseId: 2, prerequisiteId: 1 }
  ], cycles), true);
});

test('academic progress uses a 0-20 passing threshold and preserves non-final states', () => {
  assert.equal(courseStatus(null), 'Pendiente');
  assert.equal(courseStatus({ estado: 'Matriculado' }), 'En curso');
  assert.equal(courseStatus({ estado: 'Retirado' }), 'Retirado');
  assert.equal(courseStatus({ estado: 'Finalizado', calificaciones: 0, promedio: null }), 'Sin calificación');
  assert.equal(courseStatus({ estado: 'Finalizado', calificaciones: 2, promedio: 10.99 }), 'Desaprobado');
  assert.equal(courseStatus({ estado: 'Finalizado', calificaciones: 2, promedio: 11 }), 'Aprobado');
});

test('course progress selects the most recent enrollment and lists unapproved prerequisites', () => {
  const progress = latestEnrollmentByCourse([
    { id_curso: 8, id_matricula: 20, estado: 'Matriculado' },
    { id_curso: 8, id_matricula: 10, estado: 'Finalizado' },
    { id_curso: 9, id_matricula: 11, estado: 'Finalizado' }
  ]);
  assert.equal(progress.get(8).id_matricula, 20);
  assert.deepEqual(missingPrerequisites([8, 9], new Set([9])), [8]);
});

test('curriculum migration, seed and validation SQL are additive and cover the requested careers', () => {
  const migration = fs.readFileSync(path.resolve(__dirname, '../../database/07_gestion_mallas.sql'), 'utf8');
  const seed = fs.readFileSync(path.resolve(__dirname, '../../database/08_mallas_demo.sql'), 'utf8');
  const validation = fs.readFileSync(path.resolve(__dirname, '../../database/09_validar_mallas.sql'), 'utf8');
  const migrationStatements = splitStatements(migration);
  const seedStatements = splitStatements(seed);
  assert.ok(migrationStatements.every((statement) =>
    /^CREATE TABLE IF NOT EXISTS\b/i.test(statement) || /^INSERT IGNORE INTO\b/i.test(statement)));
  assert.ok(seedStatements.length > 10);
  assert.ok(seedStatements.every((statement) => /^INSERT IGNORE INTO\b/i.test(statement)));
  for (const statement of [...migrationStatements, ...seedStatements]) {
    assert.doesNotMatch(statement, /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM|REPLACE\s+INTO)\b/i);
  }
  for (const name of [
    'Desarrollo de Software',
    'Redes y Seguridad Informática',
    'Mecatrónica Industrial',
    'Administración Industrial',
    'Electricidad Industrial'
  ]) assert.ok(seed.includes(name));
  assert.match(seed, /'BDS-202'/);
  assert.match(seed, /'DEV-201'/);
  assert.match(validation, /\bJOIN\s+carreras\b/i);
  assert.match(validation, /\bJOIN\s+ciclos\b/i);
  assert.match(validation, /\bJOIN\s+cursos\b/i);
  assert.match(validation, /\bJOIN\s+estudiante_planes_estudio\b/i);
});
