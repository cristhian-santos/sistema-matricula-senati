const PASSING_GRADE = 11;

function hasPrerequisiteCycle(edges) {
  const graph = new Map();
  for (const edge of edges) {
    const courseId = Number(edge.courseId);
    const prerequisiteId = Number(edge.prerequisiteId);
    if (!graph.has(courseId)) graph.set(courseId, []);
    graph.get(courseId).push(prerequisiteId);
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(courseId) {
    if (visiting.has(courseId)) return true;
    if (visited.has(courseId)) return false;
    visiting.add(courseId);
    for (const prerequisiteId of graph.get(courseId) || []) {
      if (visit(prerequisiteId)) return true;
    }
    visiting.delete(courseId);
    visited.add(courseId);
    return false;
  }
  return [...graph.keys()].some(visit);
}

function invalidPrerequisiteEdges(edges, cycleByCourse) {
  return edges.some((edge) => {
    const courseCycle = cycleByCourse.get(Number(edge.courseId));
    const prerequisiteCycle = cycleByCourse.get(Number(edge.prerequisiteId));
    return courseCycle === undefined || prerequisiteCycle === undefined
      || prerequisiteCycle >= courseCycle;
  }) || hasPrerequisiteCycle(edges);
}

function courseStatus(enrollment, passingGrade = PASSING_GRADE) {
  if (!enrollment) return 'Pendiente';
  if (enrollment.estado === 'Matriculado') return 'En curso';
  if (enrollment.estado === 'Retirado') return 'Retirado';
  if (enrollment.estado !== 'Finalizado') return 'Pendiente';
  if (Number(enrollment.calificaciones) === 0 || enrollment.promedio === null) return 'Sin calificación';
  return Number(enrollment.promedio) >= passingGrade ? 'Aprobado' : 'Desaprobado';
}

function latestEnrollmentByCourse(enrollments) {
  const latest = new Map();
  for (const enrollment of enrollments) {
    const courseId = Number(enrollment.id_curso);
    if (!latest.has(courseId)) latest.set(courseId, enrollment);
  }
  return latest;
}

function missingPrerequisites(prerequisites, approvedCourseIds) {
  return prerequisites.filter((courseId) => !approvedCourseIds.has(Number(courseId)));
}

module.exports = {
  PASSING_GRADE,
  courseStatus,
  invalidPrerequisiteEdges,
  latestEnrollmentByCourse,
  missingPrerequisites
};
