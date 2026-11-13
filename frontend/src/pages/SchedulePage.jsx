import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const emptyFilters = { docente: '', curso: '', sede: '', ciclo: '', periodo: '' };
const displayName = (person) => `${person.apellidos}, ${person.nombres}`;

export default function SchedulePage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [catalogs, setCatalogs] = useState({ docentes: [], cursos: [], sedes: [], ciclos: [], periodos: [] });
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/academico/docentes'),
      api.get('/cursos'),
      api.get('/academico/sedes'),
      api.get('/academico/ciclos'),
      api.get('/academico/periodos_academicos')
    ]).then((results) => {
      if (!active) return;
      setCatalogs({
        docentes: results[0].data.data.filter((item) => item.estado === 'Activo'),
        cursos: results[1].data.data.filter((item) => item.estado === 'Activo'),
        sedes: results[2].data.data.filter((item) => item.estado === 'Activo'),
        ciclos: results[3].data.data.filter((item) => item.estado === 'Activo').sort((a, b) => a.numero - b.numero),
        periodos: results[4].data.data
      });
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'No se pudieron cargar los filtros del horario.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/academico/horarios', { params: Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== '')
    ) }).then(({ data }) => {
      if (active) setClasses(data.data);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'No se pudo cargar el horario semanal.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [filters]);

  const byDay = useMemo(() => weekdays.map((day) => ({
    day,
    items: classes.filter((item) => item.dia_semana === day)
  })), [classes]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="container-fluid px-3 px-lg-5 py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <div className="text-info fw-bold small mb-2">ORGANIZACIÓN ACADÉMICA</div>
          <h1 className="h2 fw-bold mb-1"><i className="bi bi-calendar-week me-2 text-primary" />Horario semanal</h1>
          <div className="text-muted">Consulta docente, curso, sede, ciclo, periodo y vacantes por sección.</div>
        </div>
        <button className="btn btn-outline-primary" onClick={() => setFilters(emptyFilters)}>
          <i className="bi bi-arrow-counterclockwise me-2" />Limpiar filtros
        </button>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6 col-xl">
              <label className="form-label" htmlFor="schedule-teacher">Docente</label>
              <select id="schedule-teacher" className="form-select" value={filters.docente} onChange={(event) => setFilter('docente', event.target.value)}>
                <option value="">Todos los docentes</option>
                {catalogs.docentes.map((item) => <option key={item.id_docente} value={item.id_docente}>{displayName(item)}</option>)}
              </select>
            </div>
            <div className="col-md-6 col-xl">
              <label className="form-label" htmlFor="schedule-course">Curso</label>
              <select id="schedule-course" className="form-select" value={filters.curso} onChange={(event) => setFilter('curso', event.target.value)}>
                <option value="">Todos los cursos</option>
                {catalogs.cursos.map((item) => <option key={item.id_curso} value={item.id_curso}>{item.codigo} · {item.nombre}</option>)}
              </select>
            </div>
            <div className="col-md-6 col-xl">
              <label className="form-label" htmlFor="schedule-campus">Sede</label>
              <select id="schedule-campus" className="form-select" value={filters.sede} onChange={(event) => setFilter('sede', event.target.value)}>
                <option value="">Todas las sedes</option>
                {catalogs.sedes.map((item) => <option key={item.id_sede} value={item.id_sede}>{item.nombre}</option>)}
              </select>
            </div>
            <div className="col-md-6 col-xl">
              <label className="form-label" htmlFor="schedule-cycle">Ciclo</label>
              <select id="schedule-cycle" className="form-select" value={filters.ciclo} onChange={(event) => setFilter('ciclo', event.target.value)}>
                <option value="">Todos los ciclos</option>
                {catalogs.ciclos.map((item) => <option key={item.id_ciclo} value={item.id_ciclo}>{item.nombre}</option>)}
              </select>
            </div>
            <div className="col-md-6 col-xl">
              <label className="form-label" htmlFor="schedule-period">Periodo</label>
              <select id="schedule-period" className="form-select" value={filters.periodo} onChange={(event) => setFilter('periodo', event.target.value)}>
                <option value="">Todos los periodos</option>
                {catalogs.periodos.map((item) => <option key={item.id_periodo} value={item.id_periodo}>{item.codigo} · {item.estado}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="small text-muted mb-3">{loading ? 'Cargando horario...' : `${classes.length} bloques horarios`}</div>
      <div className="row g-3">
        {byDay.map(({ day, items }) => (
          <div className="col-12 col-md-6 col-xl-4 col-xxl-2" key={day}>
            <section className="card h-100 shadow-sm">
              <div className="card-header bg-primary text-white fw-bold">{day}<span className="badge bg-white text-primary ms-2">{items.length}</span></div>
              <div className="card-body p-2">
                {!items.length && <div className="text-muted small p-2">{loading ? 'Cargando...' : 'Sin clases programadas.'}</div>}
                {items.map((item) => (
                  <article className="border rounded-3 p-3 mb-2" key={item.id_horario}>
                    <div className="fw-bold">{item.hora_inicio}–{item.hora_fin}</div>
                    <div className="text-primary fw-semibold mt-1">{item.curso_codigo} · {item.seccion}</div>
                    <div className="small text-muted">{item.curso}</div>
                    <hr className="my-2" />
                    <div className="small"><i className="bi bi-person-workspace me-1" />{item.docentes || 'Docente sin asignar'}</div>
                    <div className="small mt-1"><i className="bi bi-building me-1" />{item.sede} · {item.aula}</div>
                    <div className="small mt-1"><i className="bi bi-mortarboard me-1" />{item.ciclos || 'Ciclo no especificado'} · {item.periodo}</div>
                    <div className="d-flex justify-content-between small mt-2">
                      <span>{item.turno}</span>
                      <span className={Number(item.vacantes_disponibles) ? 'text-success fw-semibold' : 'text-danger fw-semibold'}>
                        {item.vacantes_disponibles} vacantes
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ))}
      </div>
    </div>
  );
}
