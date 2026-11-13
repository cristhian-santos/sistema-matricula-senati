import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const today = () => new Date().toLocaleDateString('en-CA');

export default function MallaCurricularPage() {
  const [plans, setPlans] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('malla');
  const [assignment, setAssignment] = useState({ id_estudiante: '', id_plan: '', fecha_inicio: today() });
  const [version, setVersion] = useState({ codigo: '', version: '', fecha_vigencia: today() });
  const [newCourse, setNewCourse] = useState({ id_curso: '', id_ciclo: '', tipo_curso: 'Obligatorio', orden: 1 });
  const [newPrerequisite, setNewPrerequisite] = useState({ id_plan_curso: '', id_plan_curso_requisito: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const editable = detail?.plan.estado_gestion === 'Borrador';
  const editableCourses = useMemo(() => detail?.ciclos.flatMap((cycle) => cycle.cursos) || [], [detail]);
  const availablePrerequisites = useMemo(() => {
    const target = editableCourses.find((item) => String(item.id_plan_curso) === String(newPrerequisite.id_plan_curso));
    if (!target) return [];
    return editableCourses.filter((item) => item.estado === 'Activo' && Number(item.ciclo_numero) < Number(target.ciclo_numero));
  }, [editableCourses, newPrerequisite.id_plan_curso]);

  const loadCatalogs = async () => {
    const [planResult, studentResult, courseResult, cycleResult] = await Promise.all([
      api.get('/malla/planes'),
      api.get('/malla/estudiantes'),
      api.get('/cursos'),
      api.get('/academico/ciclos')
    ]);
    setPlans(planResult.data.data);
    setStudents(studentResult.data.data);
    setCourses(courseResult.data.data.filter((course) => course.estado === 'Activo'));
    setCycles(cycleResult.data.data.sort((a, b) => Number(a.numero) - Number(b.numero)));
  };

  const loadPlan = async (id = selectedPlan) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const { data } = await api.get(`/malla/planes/${id}/malla`);
    setDetail(data.data);
  };

  useEffect(() => {
    loadCatalogs().catch((requestError) => setError(requestError.response?.data?.message || 'No se pudieron cargar las mallas.'));
  }, []);

  useEffect(() => {
    if (selectedPlan) {
      loadPlan(selectedPlan).catch((requestError) => setError(requestError.response?.data?.message || 'No se pudo abrir la malla.'));
    } else {
      setDetail(null);
    }
  }, [selectedPlan]);

  const perform = async (action, success) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  };

  const createVersion = (event) => {
    event.preventDefault();
    perform(async () => {
      const { data } = await api.post(`/malla/planes/${selectedPlan}/versiones`, version);
      setSelectedPlan(String(data.data.id_plan));
      setVersion({ codigo: '', version: '', fecha_vigencia: today() });
      await loadCatalogs();
      await loadPlan(data.data.id_plan);
    }, 'Versión en borrador creada; el plan anterior se conservó.');
  };

  const publishPlan = () => {
    if (!window.confirm('¿Publicar esta versión? La malla publicada anteriormente se conservará como histórica.')) return;
    perform(async () => {
      await api.post(`/malla/planes/${selectedPlan}/publicar`);
      await loadCatalogs();
      await loadPlan();
    }, 'Plan publicado.');
  };

  const addCourse = (event) => {
    event.preventDefault();
    perform(async () => {
      await api.post(`/malla/planes/${selectedPlan}/cursos`, newCourse);
      setNewCourse({ ...newCourse, id_curso: '' });
      await loadPlan();
    }, 'Curso añadido a la versión.');
  };

  const saveCourse = (course, nextState = course.estado) => {
    const cycle = document.getElementById(`cycle-${course.id_plan_curso}`)?.value;
    const type = document.getElementById(`type-${course.id_plan_curso}`)?.value;
    const order = document.getElementById(`order-${course.id_plan_curso}`)?.value;
    perform(async () => {
      await api.patch(`/malla/planes/${selectedPlan}/cursos/${course.id_plan_curso}`, {
        id_ciclo: Number(cycle),
        tipo_curso: type,
        orden: Number(order),
        estado: nextState
      });
      await loadPlan();
    }, 'Cambios del curso registrados en el historial.');
  };

  const retireCourse = (course) => {
    if (!window.confirm(`¿Retirar "${course.curso}" de esta versión? El registro se conserva.`)) return;
    perform(async () => {
      await api.patch(`/malla/planes/${selectedPlan}/cursos/${course.id_plan_curso}`, {
        id_ciclo: Number(course.id_ciclo),
        tipo_curso: course.tipo_curso,
        orden: Number(course.orden),
        estado: 'Retirado'
      });
      await loadPlan();
    }, 'Curso retirado sin borrar su historial.');
  };

  const addPrerequisite = (event) => {
    event.preventDefault();
    perform(async () => {
      await api.post(`/malla/planes/${selectedPlan}/prerrequisitos`, newPrerequisite);
      setNewPrerequisite({ id_plan_curso: '', id_plan_curso_requisito: '' });
      await loadPlan();
    }, 'Prerrequisito registrado.');
  };

  const assignPlan = (event) => {
    event.preventDefault();
    perform(async () => {
      await api.put(`/malla/estudiantes/${assignment.id_estudiante}/plan`, {
        id_plan: Number(assignment.id_plan),
        fecha_inicio: assignment.fecha_inicio
      });
      await loadCatalogs();
    }, 'Plan asignado al estudiante; su versión previa quedó en el historial.');
  };

  return <div className="container-fluid px-3 px-lg-5 py-4">
    <div className="mb-4"><div className="small text-info fw-bold">GESTIÓN ACADÉMICA</div><h1 className="h2 fw-bold">Mallas curriculares</h1><p className="text-muted mb-0">Planes de demostración; no son mallas oficiales de SENATI. Las nuevas versiones se editan en borrador y conservan el historial.</p></div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <div className="alert alert-success" role="status">{message}</div>}
    <ul className="nav nav-tabs mb-4">
      <li className="nav-item"><button className={`nav-link ${tab === 'malla' ? 'active' : ''}`} onClick={() => setTab('malla')}>Planes y mallas</button></li>
      <li className="nav-item"><button className={`nav-link ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>Asignar estudiantes</button></li>
    </ul>

    {tab === 'malla' && <div className="row g-4">
      <div className="col-xl-4">
        <div className="card mb-4"><div className="card-header fw-bold">Planes por carrera y versión</div><div className="list-group list-group-flush">
          {plans.map((item) => <button type="button" className={`list-group-item list-group-item-action ${String(selectedPlan) === String(item.id_plan) ? 'active' : ''}`} key={item.id_plan} onClick={() => setSelectedPlan(String(item.id_plan))}>
            <div className="fw-semibold">{item.carrera}</div><div className="small">{item.codigo} · {item.version} · {item.estado_gestion}</div>
            <div className="small">Cursos {item.cursos} · {item.creditos} créditos · {item.alumnos_matriculados} matriculados</div>
          </button>)}
          {!plans.length && <div className="list-group-item text-muted">No hay planes. Ejecuta la migración y el seed de demostración.</div>}
        </div></div>
        {detail && <div className="card"><div className="card-header fw-bold">Crear nueva versión</div><form className="card-body" onSubmit={createVersion}>
          <p className="small text-muted">Copia cursos y prerrequisitos activos de la versión seleccionada a un borrador independiente.</p>
          <label className="form-label" htmlFor="version-code">Código único</label><input id="version-code" className="form-control mb-2" value={version.codigo} onChange={(event) => setVersion({ ...version, codigo: event.target.value })} required maxLength="25" />
          <label className="form-label" htmlFor="version-name">Versión</label><input id="version-name" className="form-control mb-2" value={version.version} onChange={(event) => setVersion({ ...version, version: event.target.value })} required maxLength="25" />
          <label className="form-label" htmlFor="version-date">Vigencia</label><input id="version-date" type="date" className="form-control mb-3" value={version.fecha_vigencia} onChange={(event) => setVersion({ ...version, fecha_vigencia: event.target.value })} required />
          <button className="btn btn-outline-primary" disabled={busy}>Crear borrador</button>
        </form></div>}
      </div>
      <div className="col-xl-8">
        {!detail ? <div className="card card-body text-muted">Selecciona un plan para consultar y administrar su malla.</div> : <>
          <div className="card mb-4"><div className="card-body d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div><div className="small text-muted">{detail.plan.codigo} · {detail.plan.version}</div><h2 className="h4 fw-bold mb-1">{detail.plan.carrera}</h2><div className="text-muted">Vigencia {String(detail.plan.fecha_vigencia).slice(0, 10)} · {detail.plan.estado_gestion}</div></div>
            {editable && <button className="btn btn-success" onClick={publishPlan} disabled={busy}>Publicar versión</button>}
          </div></div>
          {editable && <div className="card mb-4"><div className="card-header fw-bold">Añadir curso existente</div><form className="card-body" onSubmit={addCourse}><div className="row g-2 align-items-end">
            <div className="col-lg-5"><label className="form-label" htmlFor="course-select">Curso</label><select id="course-select" className="form-select" value={newCourse.id_curso} onChange={(event) => setNewCourse({ ...newCourse, id_curso: event.target.value })} required><option value="">Selecciona un curso</option>{courses.filter((course) => !editableCourses.some((item) => Number(item.id_curso) === Number(course.id_curso))).map((course) => <option key={course.id_curso} value={course.id_curso}>{course.codigo} · {course.nombre}</option>)}</select></div>
            <div className="col-lg-3"><label className="form-label" htmlFor="course-cycle">Ciclo</label><select id="course-cycle" className="form-select" value={newCourse.id_ciclo} onChange={(event) => setNewCourse({ ...newCourse, id_ciclo: event.target.value })} required><option value="">Selecciona</option>{cycles.map((cycle) => <option key={cycle.id_ciclo} value={cycle.id_ciclo}>{cycle.nombre}</option>)}</select></div>
            <div className="col-lg-2"><label className="form-label" htmlFor="course-type">Tipo</label><select id="course-type" className="form-select" value={newCourse.tipo_curso} onChange={(event) => setNewCourse({ ...newCourse, tipo_curso: event.target.value })}><option>Obligatorio</option><option>Electivo</option></select></div>
            <div className="col-lg-2"><button className="btn btn-primary w-100" disabled={busy}>Añadir</button></div>
          </div></form></div>}
          {editable && <div className="card mb-4"><div className="card-header fw-bold">Registrar prerrequisito</div><form className="card-body" onSubmit={addPrerequisite}><div className="row g-2 align-items-end">
            <div className="col-md-5"><label className="form-label" htmlFor="prerequisite-target">Curso que lo requiere</label><select id="prerequisite-target" className="form-select" value={newPrerequisite.id_plan_curso} onChange={(event) => setNewPrerequisite({ id_plan_curso: event.target.value, id_plan_curso_requisito: '' })} required><option value="">Selecciona curso</option>{editableCourses.filter((item) => item.estado === 'Activo').map((item) => <option key={item.id_plan_curso} value={item.id_plan_curso}>{item.ciclo} · {item.curso}</option>)}</select></div>
            <div className="col-md-5"><label className="form-label" htmlFor="prerequisite-source">Prerrequisito (ciclo anterior)</label><select id="prerequisite-source" className="form-select" value={newPrerequisite.id_plan_curso_requisito} onChange={(event) => setNewPrerequisite({ ...newPrerequisite, id_plan_curso_requisito: event.target.value })} required><option value="">Selecciona curso</option>{availablePrerequisites.map((item) => <option key={item.id_plan_curso} value={item.id_plan_curso}>{item.ciclo} · {item.curso}</option>)}</select></div>
            <div className="col-md-2"><button className="btn btn-outline-primary w-100" disabled={busy}>Vincular</button></div>
          </div></form></div>}
          {detail.ciclos.map((cycle) => <div className="card mb-3" key={cycle.id_ciclo}>
            <div className="card-header d-flex justify-content-between"><strong>{cycle.nombre}</strong><span>{cycle.creditos} créditos</span></div>
            <div className="table-responsive"><table className="table table-sm align-middle mb-0"><thead><tr><th>Curso</th><th>Créditos</th><th>Horas</th><th>Tipo</th><th>Prerrequisitos</th>{editable && <th>Administrar</th>}</tr></thead><tbody>
              {cycle.cursos.map((course) => <tr key={course.id_plan_curso} className={course.estado === 'Retirado' ? 'table-secondary' : ''}>
                <td><span className="font-monospace small">{course.curso_codigo}</span><div>{course.curso}</div>{course.estado === 'Retirado' && <span className="badge text-bg-secondary">Retirado</span>}</td>
                <td>{course.creditos}</td><td>{course.horas}</td>
                <td>{editable ? <select id={`type-${course.id_plan_curso}`} className="form-select form-select-sm" defaultValue={course.tipo_curso}><option>Obligatorio</option><option>Electivo</option></select> : course.tipo_curso}</td>
                <td>{course.prerrequisitos.map((item) => <div className="small" key={item.id_plan_curso}>{item.nombre} · ciclo {item.ciclo}</div>)}{!course.prerrequisitos.length && '—'}</td>
                {editable && <td><div className="d-flex gap-1">
                  <select id={`cycle-${course.id_plan_curso}`} className="form-select form-select-sm" defaultValue={course.id_ciclo} aria-label={`Ciclo de ${course.curso}`}>{cycles.map((item) => <option key={item.id_ciclo} value={item.id_ciclo}>{item.numero}</option>)}</select>
                  <input id={`order-${course.id_plan_curso}`} className="form-control form-control-sm" type="number" min="1" defaultValue={course.orden} aria-label={`Orden de ${course.curso}`} />
                  <button className="btn btn-sm btn-outline-primary" onClick={() => saveCourse(course)} disabled={busy}>Guardar</button>
                  {course.estado === 'Activo'
                    ? <button className="btn btn-sm btn-outline-danger" onClick={() => retireCourse(course)} disabled={busy}>Retirar</button>
                    : <button className="btn btn-sm btn-outline-success" onClick={() => saveCourse(course, 'Activo')} disabled={busy}>Reactivar</button>}
                </div></td>}
              </tr>)}
              {!cycle.cursos.length && <tr><td colSpan={editable ? 6 : 5} className="text-center text-muted">Sin cursos asignados.</td></tr>}
            </tbody></table></div>
          </div>)}
          <div className="small text-muted">La condición de aprobación usada para visualizar el avance es 11/20; los cursos sin notas permanecen como “Sin calificación”.</div>
        </>}
      </div>
    </div>}

    {tab === 'students' && <div className="row g-4">
      <div className="col-xl-5"><div className="card"><div className="card-header fw-bold">Vincular estudiante con plan publicado</div><form className="card-body" onSubmit={assignPlan}>
        <label className="form-label" htmlFor="student-select">Estudiante activo</label><select id="student-select" className="form-select mb-3" value={assignment.id_estudiante} onChange={(event) => setAssignment({ ...assignment, id_estudiante: event.target.value })} required><option value="">Selecciona estudiante</option>{students.map((student) => <option key={student.id_estudiante} value={student.id_estudiante}>{student.dni} · {student.apellidos}, {student.nombres}{student.carrera ? ` — ${student.carrera}` : ''}</option>)}</select>
        <label className="form-label" htmlFor="published-plan">Plan publicado</label><select id="published-plan" className="form-select mb-3" value={assignment.id_plan} onChange={(event) => { const selected = plans.find((item) => String(item.id_plan) === event.target.value); setAssignment({ ...assignment, id_plan: event.target.value, fecha_inicio: selected?.fecha_vigencia && selected.fecha_vigencia > assignment.fecha_inicio ? String(selected.fecha_vigencia).slice(0, 10) : assignment.fecha_inicio }); }} required><option value="">Selecciona plan</option>{plans.filter((item) => item.estado_gestion === 'Publicado').map((item) => <option key={item.id_plan} value={item.id_plan}>{item.carrera} · {item.version} · desde {String(item.fecha_vigencia).slice(0, 10)}</option>)}</select>
        <label className="form-label" htmlFor="student-plan-date">Fecha de asignación</label><input id="student-plan-date" type="date" className="form-control mb-3" value={assignment.fecha_inicio} onChange={(event) => setAssignment({ ...assignment, fecha_inicio: event.target.value })} required />
        <button className="btn btn-primary" disabled={busy}>Asignar plan</button>
      </form></div></div>
      <div className="col-xl-7"><div className="card"><div className="card-header fw-bold">Planes y situación actual</div><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Estudiante</th><th>Carrera</th><th>Plan vigente</th></tr></thead><tbody>{students.map((student) => <tr key={student.id_estudiante}><td>{student.apellidos}, {student.nombres}<div className="small text-muted">{student.dni}</div></td><td>{student.carrera || 'Sin asignar'}</td><td>{student.plan_codigo ? `${student.plan_codigo} · ${student.version}` : 'Sin plan asignado'}</td></tr>)}{!students.length && <tr><td colSpan="3" className="text-center text-muted">No hay estudiantes activos.</td></tr>}</tbody></table></div></div></div>
    </div>}
  </div>;
}
