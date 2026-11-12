const {
  courseStatus,
  latestEnrollmentByCourse,
  missingPrerequisites
} = require('./mallaUtils');

async function loadEnrollmentProgress(connection, studentId) {
  const [rows] = await connection.query(
    `SELECT m.id_matricula,m.id_curso,m.estado,m.fecha_matricula,
            COUNT(ca.id_calificacion) AS calificaciones,
            ROUND(
              SUM(CASE WHEN ca.id_calificacion IS NOT NULL THEN ca.nota*ev.peso_porcentaje ELSE 0 END)
              / NULLIF(SUM(CASE WHEN ca.id_calificacion IS NOT NULL THEN ev.peso_porcentaje ELSE 0 END),0),
              2
            ) AS promedio
     FROM matriculas m
     LEFT JOIN evaluaciones ev ON ev.id_seccion=m.id_seccion
     LEFT JOIN calificaciones ca ON ca.id_evaluacion=ev.id_evaluacion AND ca.id_matricula=m.id_matricula
     WHERE m.id_estudiante=?
     GROUP BY m.id_matricula,m.id_curso,m.estado,m.fecha_matricula
     ORDER BY m.fecha_matricula DESC,m.id_matricula DESC`,
    [studentId]
  );
  return latestEnrollmentByCourse(rows);
}

async function getActiveStudentPlan(connection, studentId) {
  const [[program]] = await connection.query(
    `SELECT ep.id_estudiante_plan,ep.id_estudiante,ep.id_plan,
            DATE_FORMAT(ep.fecha_inicio,'%Y-%m-%d') AS fecha_inicio,
            p.codigo AS plan_codigo,p.version,DATE_FORMAT(p.fecha_vigencia,'%Y-%m-%d') AS fecha_vigencia,
            c.id_carrera,c.codigo AS carrera_codigo,
            c.nombre AS carrera,c.duracion_ciclos
     FROM estudiante_planes_estudio ep
     JOIN planes_estudio p ON p.id_plan=ep.id_plan AND p.estado='Activo'
     JOIN plan_estudio_control ctl ON ctl.id_plan=p.id_plan AND ctl.estado_gestion='Publicado'
     JOIN carreras c ON c.id_carrera=p.id_carrera
     WHERE ep.id_estudiante=? AND ep.estado='Activo'
       AND ep.fecha_inicio<=CURDATE() AND p.fecha_vigencia<=CURDATE()
     ORDER BY ep.fecha_inicio DESC,ep.id_estudiante_plan DESC LIMIT 1`,
    [studentId]
  );
  return program || null;
}

async function checkCourseEligibility(connection, studentId, courseId) {
  const program = await getActiveStudentPlan(connection, studentId);
  if (!program) return { assigned: false, allowed: true, prerequisites: [], missing: [] };
  const [courseRows] = await connection.query(
    `SELECT pc.id_plan_curso,pc.id_curso,pc.id_ciclo,cy.numero AS ciclo_numero,
            COALESCE(pcc.estado,'Activo') AS estado
     FROM plan_cursos pc
     JOIN ciclos cy ON cy.id_ciclo=pc.id_ciclo
     LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=pc.id_plan_curso
     WHERE pc.id_plan=? AND pc.id_curso=?`,
    [program.id_plan, courseId]
  );
  if (!courseRows.length || courseRows[0].estado !== 'Activo') {
    return {
      assigned: true,
      allowed: false,
      reason: 'El curso no pertenece a la malla vigente del estudiante.',
      prerequisites: [],
      missing: []
    };
  }

  const [prerequisiteRows] = await connection.query(
    `SELECT requisito.id_curso,curso.nombre,curso.codigo
     FROM curso_prerrequisitos r
     JOIN plan_cursos actual ON actual.id_plan_curso=r.id_plan_curso
     JOIN plan_cursos requisito ON requisito.id_plan_curso=r.id_plan_curso_requisito
     JOIN cursos curso ON curso.id_curso=requisito.id_curso
     LEFT JOIN plan_curso_control pcc ON pcc.id_plan_curso=requisito.id_plan_curso
     WHERE actual.id_plan=? AND actual.id_curso=? AND COALESCE(pcc.estado,'Activo')='Activo'`,
    [program.id_plan, courseId]
  );
  const progress = await loadEnrollmentProgress(connection, studentId);
  const approvedIds = new Set(
    [...progress.entries()]
      .filter(([, enrollment]) => courseStatus(enrollment) === 'Aprobado')
      .map(([id]) => id)
  );
  const missingIds = missingPrerequisites(prerequisiteRows.map((row) => row.id_curso), approvedIds);
  return {
    assigned: true,
    allowed: missingIds.length === 0,
    reason: missingIds.length ? 'Debe aprobar primero todos los cursos prerrequisito.' : null,
    prerequisites: prerequisiteRows.map((row) => ({
      id_curso: row.id_curso,
      codigo: row.codigo,
      curso: row.nombre,
      estado: courseStatus(progress.get(Number(row.id_curso)))
    })),
    missing: prerequisiteRows.filter((row) => missingIds.includes(Number(row.id_curso)))
  };
}

module.exports = {
  checkCourseEligibility,
  getActiveStudentPlan,
  loadEnrollmentProgress
};
