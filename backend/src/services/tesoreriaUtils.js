function toCents(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : NaN;
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

function validMoney(value, allowNegative = false) {
  const expression = allowNegative
    ? /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/
    : /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
  return expression.test(String(value));
}

function calculateBenefit(baseCents, benefits) {
  let remaining = baseCents;
  for (const benefit of benefits) {
    const discount = benefit.tipo === 'Porcentaje'
      ? Math.round(remaining * Number(benefit.valor) / 100)
      : Math.min(remaining, toCents(benefit.valor));
    remaining = Math.max(0, remaining - discount);
  }
  return { discount: baseCents - remaining, due: remaining };
}

function validateInstallments(installments, totalCents, expectedCount) {
  return installments.length === expectedCount
    && installments.every((item, index) => Number(item.numero_cuota) === index + 1
      && Number.isInteger(Number(item.id_concepto)) && Number(item.id_concepto) > 0
      && validMoney(item.monto)
      && Number.isInteger(toCents(item.monto)) && toCents(item.monto) > 0
      && Number.isInteger(Number(item.dias_desde_inicio))
      && Number(item.dias_desde_inicio) >= 0 && Number(item.dias_desde_inicio) <= 3650)
    && installments.reduce((sum, item) => sum + toCents(item.monto), 0) === totalCents;
}

function validPlanConfiguration(modality, installmentCount) {
  return ['Unico', 'Mensual', 'Por ciclo', 'Fraccionado'].includes(modality)
    && Number.isInteger(installmentCount)
    && installmentCount >= 1
    && installmentCount <= 120
    && (modality !== 'Unico' || installmentCount === 1);
}

function validateAllocations(allocations, paymentCents) {
  return Array.isArray(allocations)
    && allocations.length > 0
    && allocations.every((item) => Number.isInteger(Number(item.id_obligacion))
      && Number(item.id_obligacion) > 0
      && Number.isInteger(toCents(item.monto_aplicado))
      && toCents(item.monto_aplicado) > 0)
    && new Set(allocations.map((item) => Number(item.id_obligacion))).size === allocations.length
    && allocations.reduce((sum, item) => sum + toCents(item.monto_aplicado), 0) === paymentCents;
}

function allocationsWithinBalances(allocations, availableBalances) {
  return allocations.every((item) => availableBalances.has(item.id)
    && Number.isInteger(item.amount)
    && item.amount > 0
    && item.amount <= availableBalances.get(item.id));
}

function paymentState(dueCents, paidCents, overdue = false, annulled = false) {
  if (annulled) return 'Anulada';
  if (dueCents - paidCents <= 0) return 'Pagada';
  if (paidCents > 0) return 'Parcial';
  return overdue ? 'Vencida' : 'Pendiente';
}

module.exports = {
  allocationsWithinBalances,
  calculateBenefit,
  fromCents,
  paymentState,
  toCents,
  validMoney,
  validPlanConfiguration,
  validateAllocations,
  validateInstallments
};
