const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { splitStatements } = require('../scripts/sqlUtils');
const {
  allocationsWithinBalances,
  calculateBenefit,
  fromCents,
  paymentState,
  toCents,
  validMoney,
  validPlanConfiguration,
  validateAllocations,
  validateInstallments
} = require('../src/services/tesoreriaUtils');

test('money conversion uses integer cents to avoid floating point errors', () => {
  assert.equal(toCents('0.10') + toCents('0.20'), 30);
  assert.equal(fromCents(12345), 123.45);
  assert.ok(Number.isNaN(toCents('invalid')));
  assert.equal(validMoney('1.239'), false);
  assert.equal(validMoney('-1.25', true), true);
});

test('benefits cannot reduce an installment below zero', () => {
  assert.deepEqual(
    calculateBenefit(10000, [
      { tipo: 'Porcentaje', valor: 20 },
      { tipo: 'Monto', valor: 900 }
    ]),
    { discount: 10000, due: 0 }
  );
});

test('plan installments must be ordered and sum exactly to the plan total', () => {
  const installments = [
    { numero_cuota: 1, id_concepto: 1, monto: '50.00', dias_desde_inicio: 0 },
    { numero_cuota: 2, id_concepto: 1, monto: '50.00', dias_desde_inicio: 30 }
  ];
  assert.equal(validateInstallments(installments, 10000, 2), true);
  assert.equal(validateInstallments(installments, 9999, 2), false);
  assert.equal(validateInstallments([...installments].reverse(), 10000, 2), false);
});

test('a single-payment plan can contain exactly one installment', () => {
  assert.equal(validPlanConfiguration('Unico', 1), true);
  assert.equal(validPlanConfiguration('Unico', 2), false);
  assert.equal(validPlanConfiguration('Mensual', 12), true);
  assert.equal(validPlanConfiguration('No valido', 1), false);
});

test('a payment allocation is unique per obligation and equals the payment amount', () => {
  const allocations = [
    { id_obligacion: 7, monto_aplicado: '10.25' },
    { id_obligacion: 8, monto_aplicado: '5.00' }
  ];
  assert.equal(validateAllocations(allocations, 1525), true);
  assert.equal(validateAllocations(allocations, 1526), false);
  assert.equal(validateAllocations([...allocations, allocations[0]], 2550), false);
  assert.equal(allocationsWithinBalances(
    [{ id: 7, amount: 1025 }, { id: 8, amount: 500 }],
    new Map([[7, 1200], [8, 500]])
  ), true);
  assert.equal(allocationsWithinBalances(
    [{ id: 7, amount: 1025 }, { id: 8, amount: 501 }],
    new Map([[7, 1200], [8, 500]])
  ), false);
});

test('payment status distinguishes partial, overdue, paid and annulled balances', () => {
  assert.equal(paymentState(10000, 2500), 'Parcial');
  assert.equal(paymentState(10000, 0, true), 'Vencida');
  assert.equal(paymentState(10000, 10000), 'Pagada');
  assert.equal(paymentState(10000, 10000, false, true), 'Anulada');
});

test('treasury migrations and demo seeds contain only additive SQL', () => {
  const migration = fs.readFileSync(path.resolve(__dirname, '../../database/05_tesoreria_planes_pago.sql'), 'utf8');
  const seed = fs.readFileSync(path.resolve(__dirname, '../../database/06_datos_demo_tesoreria.sql'), 'utf8');
  const migrationStatements = splitStatements(migration);
  const seedStatements = splitStatements(seed);
  assert.equal(migrationStatements.length, 10);
  assert.ok(migrationStatements.every((statement) => statement.startsWith('CREATE TABLE')));
  assert.ok(seedStatements.length > 0);
  assert.ok(seedStatements.every((statement) => statement.startsWith('INSERT IGNORE INTO')));
  for (const statement of [...migrationStatements, ...seedStatements]) {
    assert.doesNotMatch(statement, /\b(DROP\s+(DATABASE|TABLE)|TRUNCATE|DELETE\s+FROM)\b/i);
  }
});
