const gradeStatus = (average, passingGrade = 11) => {
  if (average === null || average === undefined) return 'Sin calificación';
  return Number(average) >= passingGrade ? 'Aprobado' : 'Desaprobado';
};

const hasAtMostTwoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;

const isValidGrade = (value) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return false;
  const grade = Number(value);
  return Number.isFinite(grade) && grade >= 0 && grade <= 20 && hasAtMostTwoDecimals(grade);
};

const isValidWeight = (value) => {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return false;
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0 && weight <= 100 && hasAtMostTwoDecimals(weight);
};

const canAddWeight = (currentWeight, addedWeight) =>
  Math.round((Number(currentWeight) + Number(addedWeight)) * 100) <= 10000;

const hasCompleteWeight = (weight) => Math.round(Number(weight) * 100) === 10000;

const weightedAverage = (grades) => {
  const graded = grades.filter((item) => item.nota !== null && item.nota !== undefined);
  const weight = graded.reduce((total, item) => total + Number(item.peso_porcentaje), 0);
  if (!weight) return null;
  const score = graded.reduce(
    (total, item) => total + Number(item.nota) * Number(item.peso_porcentaje),
    0
  );
  return Math.round((score / weight) * 100) / 100;
};

const attendancePercentage = (attendance) => {
  if (!attendance.length) return null;
  const attended = attendance.filter((item) =>
    ['Presente','Tardanza','Justificada'].includes(item.estado)
  ).length;
  return Math.round((attended / attendance.length) * 10000) / 100;
};

module.exports = {
  attendancePercentage,
  canAddWeight,
  gradeStatus,
  hasCompleteWeight,
  isValidGrade,
  isValidWeight,
  weightedAverage
};
