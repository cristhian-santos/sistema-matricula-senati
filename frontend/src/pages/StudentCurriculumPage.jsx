import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function StudentCurriculumPage() {
  const [malla, setMalla] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/malla/mi-malla')
      .then(({ data }) => setMalla(data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'No se pudo cargar tu malla curricular.'));
  }, []);

  const stateClass = (state) => ({
    Aprobado: 'bg-success',
    Desaprobado: 'bg-danger',
    'En curso': 'bg-primary',
    Retirado: 'bg-secondary',
    'Sin calificación': 'bg-warning text-dark',
    Pendiente: 'bg-light text-dark border'
  }[state] || 'bg-secondary');

  return <div className="container py-4">
    <div className="mb-4"><div className="small text-info fw-bold">PORTAL DEL ESTUDIANTE</div><h1 className="h2 fw-bold">Mi malla curricular</h1><p className="text-muted">Consulta tu plan, cursos por ciclo, avance y prerrequisitos.</p></div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {malla && !malla.programa && <div className="alert alert-info">Aún no tienes un plan de estudios vinculado. Solicita a Administración que asigne tu carrera y plan vigente.</div>}
    {malla?.programa && <>
      <div className="card mb-4"><div className="card-body"><div className="small text-muted">Carrera</div><h2 className="h4 fw-bold">{malla.programa.carrera}</h2><div className="text-muted">Plan {malla.programa.plan} · versión {malla.programa.version} · vigencia {String(malla.programa.fecha_vigencia).slice(0, 10)}</div><div className="mt-2"><strong>Ciclo actual:</strong> {malla.ciclo_actual?.nombre || 'Malla completada'}</div></div></div>
      {malla.ciclos.map((cycle) => <div className="card mb-4" key={cycle.id_ciclo}>
        <div className="card-header d-flex justify-content-between"><strong>{cycle.nombre}</strong><span>{cycle.creditos} créditos</span></div>
        <div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr><th>Curso</th><th>Créditos</th><th>Tipo</th><th>Nota</th><th>Estado</th><th>Prerrequisitos</th></tr></thead><tbody>
          {cycle.cursos.map((course) => <tr key={course.id_plan_curso}><td><span className="font-monospace small">{course.curso_codigo}</span><div>{course.curso}</div><small className="text-muted">{course.horas} horas</small></td><td>{course.creditos}</td><td>{course.tipo_curso}</td><td>{course.promedio ?? '—'}</td><td><span className={`badge ${stateClass(course.estado_academico)}`}>{course.estado_academico}</span></td><td>{course.prerrequisitos.map((item) => <div className="small" key={item.id_curso}>{item.nombre} · {item.estado}</div>)}{!course.prerrequisitos.length && '—'}{course.prerrequisitos.length > 0 && !course.puede_matricularse && <div className="small text-danger mt-1">Debes aprobar los prerrequisitos para matricular este curso.</div>}</td></tr>)}
          {!cycle.cursos.length && <tr><td colSpan="6" className="text-center text-muted">Sin cursos en este ciclo.</td></tr>}
        </tbody></table></div>
      </div>)}
      <div className="small text-muted">La clasificación utiliza una nota aprobatoria de {malla.nota_minima_aprobatoria}/20, según el reglamento académico oficial. La matrícula se valida también en el backend.</div>
    </>}
  </div>;
}
