import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function TeacherPortalPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [students, setStudents] = useState([]);
  const [evaluationsRaw, setEvaluationsRaw] = useState([]);
  const [report, setReport] = useState(null);
  const [performance, setPerformance] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [session, setSession] = useState({ fecha: '', tema: '' });
  const [sessionRange, setSessionRange] = useState({ desde: today(), hasta: today() });
  const [evaluation, setEvaluation] = useState({ nombre: '', tipo: 'Practica', peso_porcentaje: '40', fecha: today() });
  const [evaluationId, setEvaluationId] = useState('');
  const [grades, setGrades] = useState({});
  const [gradeHistory, setGradeHistory] = useState([]);
  const [historyEvaluationId, setHistoryEvaluationId] = useState('');
  const [studentHistory, setStudentHistory] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const evaluations = useMemo(() => [...new Map(evaluationsRaw.map((item) => [item.id_evaluacion, item])).values()], [evaluationsRaw]);

  useEffect(() => {
    Promise.all([api.get('/docente/perfil'), api.get('/docente/secciones')]).then(([profileResult, sectionsResult]) => {
      setProfile(profileResult.data.data);
      setSections(sectionsResult.data.data);
      setSectionId(sectionsResult.data.data[0]?.id_seccion || '');
    }).catch((requestError) => setError(requestError.response?.data?.message || 'No se pudo cargar el panel docente.'));
  }, []);

  useEffect(() => {
    if (!sectionId) {
      setStudents([]);
      setEvaluationsRaw([]);
      setReport(null);
      setPerformance([]);
      setSessions([]);
      setAttendanceHistory([]);
      return;
    }
    const selectedSection = sections.find((item) => String(item.id_seccion) === String(sectionId));
    if (selectedSection?.periodo_inicio && selectedSection?.periodo_fin) {
      const start = selectedSection.periodo_inicio;
      const end = selectedSection.periodo_fin;
      const currentDate = today();
      const startDate = currentDate < start ? start : currentDate > end ? end : currentDate;
      const rangeEnd = new Date(`${startDate}T00:00:00Z`);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 28);
      const until = rangeEnd.toISOString().slice(0, 10);
      setSessionRange({ desde: startDate, hasta: until < end ? until : end });
      setEvaluation((current) => ({
        ...current,
        fecha: current.fecha < start || current.fecha > end ? startDate : current.fecha
      }));
    }
    let active = true;
    Promise.all([
      api.get(`/docente/secciones/${sectionId}/estudiantes`),
      api.get(`/docente/secciones/${sectionId}/evaluaciones`),
      api.get(`/docente/secciones/${sectionId}/reporte`),
      api.get(`/docente/secciones/${sectionId}/rendimiento`),
      api.get(`/docente/secciones/${sectionId}/sesiones`),
      api.get(`/docente/secciones/${sectionId}/asistencias/historial`)
    ]).then(([studentResult, evaluationResult, reportResult, performanceResult, sessionResult, attendanceResult]) => {
      if (!active) return;
      setStudents(studentResult.data.data);
      setEvaluationsRaw(evaluationResult.data.data);
      setReport(reportResult.data.data);
      setPerformance(performanceResult.data.data);
      setSessions(sessionResult.data.data);
      setAttendanceHistory(attendanceResult.data.data);
      setSession((current) => ({
        ...current,
        fecha: sessionResult.data.data.some((item) => item.fecha === current.fecha)
          ? current.fecha
          : sessionResult.data.data.find((item) => item.fecha <= today())?.fecha
            || sessionResult.data.data[0]?.fecha
            || ''
      }));
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'No se pudieron cargar los datos de la sección.');
    });
    return () => { active = false; };
  }, [sectionId, sections]);

  useEffect(() => {
    if (!sectionId || !session.fecha) {
      setAttendance({});
      return undefined;
    }
    const selectedSession = sessions.find((item) => item.fecha === session.fecha);
    if (!selectedSession) {
      setAttendance(Object.fromEntries(students.map((student) => [student.id_matricula, 'Presente'])));
      return undefined;
    }
    let active = true;
    api.get(`/docente/secciones/${sectionId}/sesiones/${selectedSession.id_sesion}/asistencias`)
      .then(({ data }) => {
        if (active) setAttendance(Object.fromEntries(data.data.map((student) => [
          student.id_matricula,
          student.asistencia || 'Presente'
        ])));
      })
      .catch(() => {
        if (active) setAttendance(Object.fromEntries(students.map((student) => [student.id_matricula, 'Presente'])));
      });
    return () => { active = false; };
  }, [sectionId, session.fecha, sessions, students]);

  useEffect(() => {
    const openEvaluation = evaluations.find((item) => String(item.id_evaluacion) === String(evaluationId));
    if (!openEvaluation) {
      setGrades({});
      return;
    }
    const existing = Object.fromEntries(evaluationsRaw.filter((item) => item.id_evaluacion === openEvaluation.id_evaluacion && item.id_matricula)
      .map((item) => [item.id_matricula, item.nota]));
    setGrades(existing);
  }, [evaluationId, evaluations, evaluationsRaw]);

  const run = async (action, successMessage) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  };

  const saveAttendance = (event) => {
    event.preventDefault();
    if (!session.fecha) {
      setError('Genera o selecciona una sesión programada antes de registrar asistencia.');
      return;
    }
    run(async () => {
      await api.post(`/docente/secciones/${sectionId}/asistencias`, {
        ...session,
        estudiantes: students.map((student) => ({ id_matricula: student.id_matricula, estado: attendance[student.id_matricula] || 'Presente' }))
      });
      const [sessionResult, attendanceResult, reportResult, performanceResult] = await Promise.all([
        api.get(`/docente/secciones/${sectionId}/sesiones`),
        api.get(`/docente/secciones/${sectionId}/asistencias/historial`),
        api.get(`/docente/secciones/${sectionId}/reporte`),
        api.get(`/docente/secciones/${sectionId}/rendimiento`)
      ]);
      setSessions(sessionResult.data.data);
      setAttendanceHistory(attendanceResult.data.data);
      setReport(reportResult.data.data);
      setPerformance(performanceResult.data.data);
    }, 'Asistencia guardada en la sesión seleccionada.');
  };

  const generateSessions = (event) => {
    event?.preventDefault();
    run(async () => {
      await api.post(`/docente/secciones/${sectionId}/sesiones/generar`, sessionRange);
      const { data } = await api.get(`/docente/secciones/${sectionId}/sesiones`);
      setSessions(data.data);
      const selectableSession = data.data.find((item) => item.fecha <= today()) || data.data[0];
      if (selectableSession) setSession((current) => ({ ...current, fecha: selectableSession.fecha }));
    }, 'Sesiones generadas desde el horario semanal de la sección.');
  };

  const createEvaluation = (event) => {
    event.preventDefault();
    run(async () => {
      await api.post(`/docente/secciones/${sectionId}/evaluaciones`, evaluation);
      const { data } = await api.get(`/docente/secciones/${sectionId}/evaluaciones`);
      setEvaluationsRaw(data.data);
      setEvaluation((current) => ({ ...current, nombre: '' }));
    }, 'Evaluación creada.');
  };

  const saveGrades = (event) => {
    event.preventDefault();
    const calificaciones = Object.entries(grades)
      .filter(([, nota]) => nota !== '' && nota !== null && nota !== undefined)
      .map(([id_matricula, nota]) => ({ id_matricula: Number(id_matricula), nota: Number(nota) }));
    if (!calificaciones.length) {
      setError('Ingresa al menos una nota.');
      return;
    }
    run(async () => {
      await api.put(`/docente/evaluaciones/${evaluationId}/notas`, { calificaciones });
      const [evaluationResult, performanceResult, reportResult] = await Promise.all([
        api.get(`/docente/secciones/${sectionId}/evaluaciones`),
        api.get(`/docente/secciones/${sectionId}/rendimiento`),
        api.get(`/docente/secciones/${sectionId}/reporte`)
      ]);
      setEvaluationsRaw(evaluationResult.data.data);
      setPerformance(performanceResult.data.data);
      setReport(reportResult.data.data);
    }, 'Calificaciones guardadas.');
  };

  const closeEvaluation = (id) => run(async () => {
    await api.patch(`/docente/evaluaciones/${id}/cerrar`);
    const { data } = await api.get(`/docente/secciones/${sectionId}/evaluaciones`);
    setEvaluationsRaw(data.data);
  }, 'Evaluación cerrada y bloqueada para edición.');

  const loadGradeHistory = (id) => run(async () => {
    const { data } = await api.get(`/docente/evaluaciones/${id}/historial`);
    setGradeHistory(data.data);
    setHistoryEvaluationId(String(id));
  }, 'Historial de calificaciones cargado.');

  const loadStudentHistory = (student) => run(async () => {
    const { data } = await api.get(`/docente/secciones/${sectionId}/estudiantes/${student.id_matricula}/historial`);
    setStudentHistory(data.data);
  }, 'Historial académico cargado.');

  const evaluationWeight = Number(evaluations[0]?.peso_total || 0);

  return <div className="container py-4">
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div><div className="small text-info fw-bold">PORTAL DOCENTE</div><h1 className="h2 fw-bold mb-1">{profile ? `${profile.nombres} ${profile.apellidos}` : user?.docente ? `${user.docente.nombres} ${user.docente.apellidos}` : 'Panel del docente'}</h1><div className="text-muted">{profile?.especialidad || 'Perfil académico'} · {profile?.codigo_docente || ''}</div></div>
      <div className="card px-3 py-2"><div className="small text-muted">Secciones asignadas</div><strong>{sections.length}</strong></div>
    </div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}{message && <div className="alert alert-success">{message}</div>}
    {!sections.length && <div className="alert alert-info">No tienes secciones asignadas activas.</div>}
    {sections.length > 0 && <>
      <div className="card mb-4"><div className="card-body d-flex flex-wrap gap-3 align-items-end">
        <div className="flex-grow-1"><label className="form-label fw-semibold" htmlFor="teacher-section">Sección</label><select id="teacher-section" className="form-select" value={sectionId} onChange={(event) => setSectionId(event.target.value)}>{sections.map((item) => <option key={item.id_seccion} value={item.id_seccion}>{item.curso_codigo} · {item.curso} — {item.seccion} ({item.periodo})</option>)}</select></div>
        <div><div className="small text-muted">Horario</div><div>{sections.find((item) => String(item.id_seccion) === String(sectionId))?.horario || 'Sin horario registrado'}</div></div>
      </div></div>
      <div className="row g-3 mb-4">
        {[['Estudiantes', report?.estudiantes ?? 0], ['Promedio de notas', report?.promedio ?? '—'], ['Asistencia', report?.asistencia_pct == null ? '—' : `${report.asistencia_pct}%`]].map(([label, value]) => <div className="col-md-4" key={label}><div className="card h-100"><div className="card-body"><div className="small text-muted">{label}</div><div className="fs-3 fw-bold">{value}</div></div></div></div>)}
      </div>
      <div className="card mb-4"><div className="card-header fw-bold">Estudiantes matriculados · resumen académico</div><div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr><th>DNI</th><th>Estudiante</th><th>Promedio / 20</th><th>Estado</th><th>Asistencia</th><th>Historial</th></tr></thead><tbody>
        {performance.map((student) => <tr key={student.id_matricula}><td>{student.dni}</td><td>{student.apellidos}, {student.nombres}</td><td>{student.promedio_ponderado ?? '—'}</td><td>{student.estado_academico}</td><td>{student.porcentaje_asistencia == null ? '—' : `${student.porcentaje_asistencia}%`}</td><td><button className="btn btn-sm btn-outline-primary" onClick={() => loadStudentHistory(student)}>Ver historial</button></td></tr>)}
        {!students.length && <tr><td colSpan="6" className="text-center text-muted py-3">No hay matrículas activas en esta sección.</td></tr>}
      </tbody></table></div></div>
      {studentHistory && <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Historial académico · {studentHistory.estudiante.apellidos}, {studentHistory.estudiante.nombres}</strong>
          <button type="button" className="btn-close" aria-label="Cerrar historial" onClick={() => setStudentHistory(null)} />
        </div>
        <div className="card-body">
          <div className="d-flex flex-wrap gap-4 mb-3">
            <span>Promedio ponderado: <strong>{studentHistory.promedio_ponderado ?? '—'} / 20</strong></span>
            <span>Estado: <strong>{studentHistory.estado_academico}</strong></span>
            <span>Asistencia: <strong>{studentHistory.porcentaje_asistencia == null ? '—' : `${studentHistory.porcentaje_asistencia}%`}</strong></span>
          </div>
          <div className="row g-3">
            <div className="col-lg-6"><h3 className="h6">Evaluaciones y notas</h3><div className="table-responsive"><table className="table table-sm"><thead><tr><th>Evaluación</th><th>Peso</th><th>Nota</th><th>Estado</th></tr></thead><tbody>
              {studentHistory.evaluaciones.map((item, index) => <tr key={`${item.evaluacion}-${index}`}><td>{item.evaluacion}</td><td>{item.peso_porcentaje}%</td><td>{item.nota ?? 'Pendiente'}</td><td>{item.estado_evaluacion}</td></tr>)}
              {!studentHistory.evaluaciones.length && <tr><td colSpan="4" className="text-muted">Sin evaluaciones.</td></tr>}
            </tbody></table></div></div>
            <div className="col-lg-6"><h3 className="h6">Historial de asistencia</h3><div className="table-responsive"><table className="table table-sm"><thead><tr><th>Fecha</th><th>Tema</th><th>Estado</th></tr></thead><tbody>
              {studentHistory.asistencias.map((item, index) => <tr key={`${item.fecha}-${index}`}><td>{item.fecha}</td><td>{item.tema || '—'}</td><td>{item.asistencia || (item.estado_sesion === 'Cancelada' ? 'Sesión cancelada' : 'Sin registro')}</td></tr>)}
              {!studentHistory.asistencias.length && <tr><td colSpan="3" className="text-muted">Sin sesiones registradas.</td></tr>}
            </tbody></table></div></div>
          </div>
        </div>
      </div>}
      <div className="row g-4">
        <div className="col-xl-6"><div className="card h-100"><div className="card-header fw-bold">Registrar sesión y asistencia</div><form className="card-body" onSubmit={saveAttendance}>
          <div className="border rounded-3 p-3 mb-3">
            <div className="fw-semibold mb-2">Generar sesiones desde el horario semanal</div>
            <div className="row g-2 align-items-end"><div className="col-sm-5"><label className="form-label" htmlFor="sessions-from">Desde</label><input id="sessions-from" type="date" className="form-control" min={sections.find((item) => String(item.id_seccion) === String(sectionId))?.periodo_inicio} max={sections.find((item) => String(item.id_seccion) === String(sectionId))?.periodo_fin} value={sessionRange.desde} onChange={(event) => setSessionRange({ ...sessionRange, desde: event.target.value })} required /></div><div className="col-sm-5"><label className="form-label" htmlFor="sessions-to">Hasta</label><input id="sessions-to" type="date" className="form-control" min={sections.find((item) => String(item.id_seccion) === String(sectionId))?.periodo_inicio} max={sections.find((item) => String(item.id_seccion) === String(sectionId))?.periodo_fin} value={sessionRange.hasta} onChange={(event) => setSessionRange({ ...sessionRange, hasta: event.target.value })} required /></div><div className="col-sm-2"><button type="button" className="btn btn-outline-primary w-100" disabled={busy} onClick={() => generateSessions()} title="Generar sesiones">Generar</button></div></div>
            <div className="small text-muted mt-2">Solo crea sesiones para días de clase dentro del periodo y conserva las existentes.</div>
          </div>
          <div className="row g-2 mb-3"><div className="col-sm-5"><label className="form-label" htmlFor="session-date">Sesión programada</label><select id="session-date" className="form-select" value={session.fecha} onChange={(event) => setSession({ ...session, fecha: event.target.value })} required><option value="">Selecciona fecha</option>{sessions.map((item) => <option key={item.id_sesion} value={item.fecha} disabled={item.fecha > today()}>{item.fecha} · {item.estado} ({item.asistencias_registradas} asistencias)</option>)}</select></div><div className="col-sm-7"><label className="form-label" htmlFor="session-topic">Tema de clase</label><input id="session-topic" className="form-control" value={session.tema} onChange={(event) => setSession({ ...session, tema: event.target.value })} required maxLength={200} /></div></div>
          <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Estudiante</th><th>Asistencia</th></tr></thead><tbody>{students.map((student) => <tr key={student.id_matricula}><td>{student.apellidos}, {student.nombres}</td><td><select className="form-select form-select-sm" aria-label={`Asistencia de ${student.nombres}`} value={attendance[student.id_matricula] || 'Presente'} onChange={(event) => setAttendance({ ...attendance, [student.id_matricula]: event.target.value })}>{['Presente','Tardanza','Falta','Justificada'].map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>
          {session.fecha > today() && <div className="small text-muted mb-2">La asistencia estará disponible a partir de la fecha de la sesión.</div>}
          <button className="btn btn-primary" disabled={busy || !students.length || !session.fecha || session.fecha > today()}>{busy ? 'Guardando...' : 'Guardar asistencia'}</button>
        </form></div></div>
        <div className="col-xl-6"><div className="card mb-4"><div className="card-header fw-bold">Crear evaluación</div><form className="card-body row g-2" onSubmit={createEvaluation}>
          <div className="col-md-6"><label className="form-label" htmlFor="evaluation-name">Nombre</label><input id="evaluation-name" className="form-control" value={evaluation.nombre} onChange={(event) => setEvaluation({ ...evaluation, nombre: event.target.value })} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="evaluation-type">Tipo</label><select id="evaluation-type" className="form-select" value={evaluation.tipo} onChange={(event) => setEvaluation({ ...evaluation, tipo: event.target.value })}>{['Practica','Examen','Proyecto','Otro'].map((type) => <option key={type}>{type}</option>)}</select></div>
          <div className="col-md-6"><label className="form-label" htmlFor="evaluation-weight">Peso %</label><input id="evaluation-weight" type="number" min="1" max="100" className="form-control" value={evaluation.peso_porcentaje} onChange={(event) => setEvaluation({ ...evaluation, peso_porcentaje: event.target.value })} required /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="evaluation-date">Fecha</label><input id="evaluation-date" type="date" className="form-control" min={sections.find((item) => String(item.id_seccion) === String(sectionId))?.periodo_inicio} max={sections.find((item) => String(item.id_seccion) === String(sectionId))?.periodo_fin} value={evaluation.fecha} onChange={(event) => setEvaluation({ ...evaluation, fecha: event.target.value })} required /></div>
          <div className="col-12"><div className={`small mb-2 ${evaluationWeight + Number(evaluation.peso_porcentaje) > 100 ? 'text-danger' : 'text-muted'}`}>Ponderación actual: {evaluationWeight}% · Con esta evaluación: {evaluationWeight + Number(evaluation.peso_porcentaje)}% (debe sumar 100% para cerrar)</div><button className="btn btn-outline-primary" disabled={busy || evaluationWeight + Number(evaluation.peso_porcentaje) > 100}>Crear evaluación</button></div>
        </form></div>
        <div className="card"><div className="card-header fw-bold">Notas de evaluación · escala 0–20</div><div className="card-body">
          <div className="list-group mb-3">{evaluations.map((item) => <div className="list-group-item d-flex flex-wrap justify-content-between align-items-center gap-2" key={item.id_evaluacion}><span><strong>{item.nombre}</strong> · {item.tipo} · {item.peso_porcentaje}% · {item.estado}</span><div className="d-flex gap-2"><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadGradeHistory(item.id_evaluacion)} disabled={busy}>Historial</button>{item.estado === 'Abierta' && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => closeEvaluation(item.id_evaluacion)} disabled={busy}>Cerrar</button>}</div></div>)}{!evaluations.length && <div className="list-group-item text-muted">Aún no hay evaluaciones.</div>}</div>
          <form onSubmit={saveGrades}>
          <label className="form-label" htmlFor="grade-evaluation">Evaluación</label><select id="grade-evaluation" className="form-select mb-3" value={evaluationId} onChange={(event) => setEvaluationId(event.target.value)} required><option value="">Selecciona evaluación</option>{evaluations.map((item) => <option key={item.id_evaluacion} value={item.id_evaluacion}>{item.nombre} · {item.estado}</option>)}</select>
          <div className="table-responsive"><table className="table table-sm"><thead><tr><th>Estudiante</th><th>Nota / 20</th></tr></thead><tbody>{students.map((student) => <tr key={student.id_matricula}><td>{student.apellidos}, {student.nombres}</td><td><input aria-label={`Nota de ${student.nombres}`} className="form-control form-control-sm" type="number" min="0" max="20" step="0.01" value={grades[student.id_matricula] ?? ''} onChange={(event) => setGrades({ ...grades, [student.id_matricula]: event.target.value })} disabled={!evaluationId || evaluations.find((item) => String(item.id_evaluacion) === String(evaluationId))?.estado !== 'Abierta'} /></td></tr>)}</tbody></table></div>
          <button className="btn btn-primary" disabled={busy || !evaluationId || !students.length || evaluations.find((item) => String(item.id_evaluacion) === String(evaluationId))?.estado !== 'Abierta'}>Guardar notas</button>
          </form>
          {historyEvaluationId && <div className="mt-4"><h3 className="h6">Historial de cambios · {evaluations.find((item) => String(item.id_evaluacion) === historyEvaluationId)?.nombre}</h3><div className="table-responsive"><table className="table table-sm"><thead><tr><th>Estudiante</th><th>Acción</th><th>Anterior</th><th>Nueva</th><th>Fecha</th></tr></thead><tbody>{gradeHistory.map((item) => <tr key={item.id_historial}><td>{item.apellidos}, {item.nombres}</td><td>{item.accion}</td><td>{item.nota_anterior ?? '—'}</td><td>{item.nota_nueva}</td><td>{item.fecha_cambio}</td></tr>)}{!gradeHistory.length && <tr><td colSpan="5" className="text-muted">Sin cambios registrados.</td></tr>}</tbody></table></div></div>}
        </div></div></div>
      </div>
      <div className="card mt-4"><div className="card-header fw-bold">Historial de asistencia de la sección</div><div className="table-responsive"><table className="table table-sm table-hover mb-0"><thead><tr><th>Fecha</th><th>Estudiante</th><th>Tema</th><th>Estado</th></tr></thead><tbody>{attendanceHistory.map((item, index) => <tr key={`${item.id_matricula}-${item.fecha}-${index}`}><td>{item.fecha}</td><td>{item.apellidos}, {item.nombres}</td><td>{item.tema || '—'}</td><td>{item.estado}</td></tr>)}{!attendanceHistory.length && <tr><td colSpan="4" className="text-center text-muted py-3">No hay asistencias registradas.</td></tr>}</tbody></table></div></div>
    </>}
  </div>;
}
