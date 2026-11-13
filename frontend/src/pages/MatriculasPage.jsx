import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import AlertMessage from '../components/AlertMessage';
import ConfirmModal from '../components/ConfirmModal';

const MatriculasPage = () => {
  const [matriculas, setMatriculas] = useState([]);
  const [estudiantes, setEstudiantes] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [periodosAcademicos, setPeriodosAcademicos] = useState([]);
  const [eligibility, setEligibility] = useState(null);
  const [search, setSearch] = useState('');
  const [filterPeriodo, setFilterPeriodo] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'danger' });
  const alertTimeout = useRef(null);

  // Modal de Crear / Editar
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id_matricula: null,
    id_estudiante: '',
    id_curso: '',
    periodo: '2026-I',
    fecha_matricula: new Date().toISOString().split('T')[0],
    estado: 'Matriculado',
    observaciones: '',
    id_seccion: ''
  });
  const [formErrors, setFormErrors] = useState({});

  // Modal Eliminación
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, info: '' });

  const fetchData = async () => {
    setLoading(true);
    const resources = [
      ['matrículas', '/matriculas', setMatriculas],
      ['estudiantes', '/estudiantes', setEstudiantes],
      ['cursos', '/cursos', setCursos],
      ['secciones', '/academico/secciones', setSecciones],
      ['periodos académicos', '/academico/periodos_academicos', setPeriodosAcademicos]
    ];
    const results = await Promise.allSettled(resources.map(([, path]) => api.get(path)));
    const errors = [];

    results.forEach((result, index) => {
      const [name, , setData] = resources[index];
      if (result.status === 'rejected') {
        const error = result.reason;
        errors.push(`${name}: ${error?.response?.data?.message || error?.message || 'error de conexión'}`);
        return;
      }

      const response = result.value.data;
      if (!response.success || !Array.isArray(response.data)) {
        errors.push(`${name}: respuesta inválida del servidor`);
        return;
      }
      setData(response.data);
    });

    if (errors.length) {
      showAlert(`No se pudieron cargar algunos datos. ${errors.join(' | ')}. Para habilitar secciones y periodos, ejecuta database/02_ampliacion_academica.sql en bd_matricula desde MySQL Workbench, después de hacer una copia de seguridad.`, 'danger');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    return () => clearTimeout(alertTimeout.current);
  }, []);

  useEffect(() => {
    if (!showModal || isEditing || !formData.id_estudiante || !formData.id_curso) {
      setEligibility(null);
      return undefined;
    }
    let active = true;
    setEligibility({ loading: true });
    api.get(`/malla/estudiantes/${formData.id_estudiante}/eligibilidad/${formData.id_curso}`)
      .then(({ data }) => {
        if (active) setEligibility(data.data);
      })
      .catch((requestError) => {
        if (active) setEligibility({ error: requestError.response?.data?.message || 'No se pudo validar la malla.' });
      });
    return () => { active = false; };
  }, [showModal, isEditing, formData.id_estudiante, formData.id_curso]);

  const showAlert = (message, type = 'success') => {
    clearTimeout(alertTimeout.current);
    setAlert({ show: true, message, type });
    if (type !== 'danger') {
      alertTimeout.current = setTimeout(() => {
        setAlert((prev) => ({ ...prev, show: false }));
      }, 4500);
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.id_estudiante) errors.id_estudiante = 'Debe seleccionar un estudiante';
    if (!formData.id_curso) errors.id_curso = 'Debe seleccionar un curso';
    if (!formData.periodo.trim()) errors.periodo = 'El periodo lectivo es obligatorio';
    if (!formData.fecha_matricula) errors.fecha_matricula = 'La fecha de matrícula es obligatoria';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    const today = new Date().toISOString().slice(0, 10);
    const activePeriod = periodosAcademicos.find((periodo) =>
      periodo.estado === 'Matricula abierta'
      && String(periodo.fecha_inicio).slice(0, 10) <= today
      && String(periodo.fecha_fin).slice(0, 10) >= today
    ) || periodosAcademicos.find((periodo) => periodo.estado === 'Matricula abierta');
    setFormData({
      id_matricula: null,
      id_estudiante: '',
      id_curso: '',
      periodo: activePeriod?.codigo || periodosAcademicos[0]?.codigo || '2026-I',
      fecha_matricula: new Date().toISOString().split('T')[0],
      estado: 'Matriculado',
      observaciones: '',
    id_seccion: ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setIsEditing(true);
    setFormData({
      id_matricula: item.id_matricula,
      id_estudiante: item.id_estudiante,
      id_curso: item.id_curso,
      periodo: item.periodo,
      fecha_matricula: item.fecha_matricula,
      estado: item.estado_matricula,
      observaciones: item.observaciones || '',
      id_seccion: item.id_seccion || ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!isEditing && eligibility?.assigned && !eligibility.allowed) {
      showAlert(eligibility.reason || 'El estudiante no cumple los prerrequisitos.', 'danger');
      return;
    }

    try {
      if (isEditing) {
        const res = await api.put(`/matriculas/${formData.id_matricula}`, formData);
        showAlert(res.data.message || 'Matrícula actualizada');
      } else {
        const res = await api.post('/matriculas', formData);
        showAlert(res.data.message || 'Matrícula registrada exitosamente');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Error al procesar matrícula', 'danger');
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const res = await api.delete(`/matriculas/${deleteModal.id}`);
      showAlert(res.data.message || 'Matrícula eliminada exitosamente');
      setDeleteModal({ show: false, id: null, info: '' });
      fetchData();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Error al eliminar matrícula', 'danger');
      setDeleteModal({ show: false, id: null, info: '' });
    }
  };

  const getInitials = (nombreCompleto) => {
    if (!nombreCompleto) return 'AL';
    const parts = nombreCompleto.split(',');
    const ap = parts[0]?.trim().charAt(0) || '';
    const nom = parts[1]?.trim().charAt(0) || '';
    return `${ap}${nom}`.toUpperCase();
  };

  // Periodos únicos para filtrar
  const periodos = Array.from(new Set(matriculas.map((m) => m.periodo)));

  const filteredMatriculas = matriculas.filter((item) => {
    const term = search.toLowerCase();
    const matchesSearch =
      item.estudiante_nombre?.toLowerCase().includes(term) ||
      item.dni_estudiante?.includes(term) ||
      item.curso_nombre?.toLowerCase().includes(term) ||
      item.curso_codigo?.toLowerCase().includes(term) ||
      item.periodo?.toLowerCase().includes(term);

    const matchesPeriodo = filterPeriodo === 'TODOS' || item.periodo === filterPeriodo;

    return matchesSearch && matchesPeriodo;
  });

  return (
    <div className="container py-4">
      {/* Encabezado del Módulo */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1 fw-bold">
              <i className="bi bi-card-checklist me-1"></i> Control de Matrícula
            </span>
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              Relación SQL INNER JOIN activa
            </span>
          </div>
          <h2 className="fw-bolder mb-0 text-dark">Registro General de Matrículas</h2>
        </div>
        <button className="btn btn-senati d-flex align-items-center gap-2 px-3 py-2 shadow-sm" onClick={handleOpenCreate}>
          <i className="bi bi-file-earmark-plus-fill fs-6"></i> Nueva Inscripción
        </button>
      </div>

      {alert.show && (
        <AlertMessage message={alert.message} type={alert.type} onClose={() => setAlert({ ...alert, show: false })} />
      )}

      {/* Buscador y Filtro por Periodo */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-8">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Buscar por DNI, nombres de alumno, o nombre/código de curso..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                    <i className="bi bi-x-lg"></i>
                  </button>
                )}
              </div>
            </div>
            <div className="col-12 col-md-4 d-flex justify-content-md-end gap-2">
              <select
                className="form-select form-select-sm"
                value={filterPeriodo}
                onChange={(e) => setFilterPeriodo(e.target.value)}
              >
                <option value="TODOS">Todos los Periodos ({matriculas.length})</option>
                {periodos.map((p) => (
                  <option key={p} value={p}>
                    Periodo {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Matrículas */}
      <div className="card shadow-sm border-0 overflow-hidden">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th className="ps-4">N° Reg.</th>
                  <th>Estudiante Inscrito</th>
                  <th>Curso y Créditos</th>
                  <th className="text-center">Periodo</th>
                  <th className="text-center">Fecha Inscripción</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center pe-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="spinner-border text-primary me-2" role="status"></div>
                      <p className="mt-2 text-muted fw-semibold">Consultando relaciones en MySQL...</p>
                    </td>
                  </tr>
                ) : filteredMatriculas.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      <i className="bi bi-folder-x fs-1 d-block mb-2 text-secondary opacity-50"></i>
                      No se encontraron registros de matrículas vigentes.
                    </td>
                  </tr>
                ) : (
                  filteredMatriculas.map((item) => (
                    <tr key={item.id_matricula}>
                      <td className="ps-4">
                        <span className="badge bg-light text-secondary border font-monospace">
                          #{item.id_matricula}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className="avatar-initials" style={{ background: 'linear-gradient(135deg, #0f284e 0%, #1e4a7a 100%)' }}>
                            {getInitials(item.estudiante_nombre)}
                          </div>
                          <div>
                            <div className="fw-bold text-dark">{item.estudiante_nombre}</div>
                            <small className="text-muted">
                              <span className="font-monospace text-primary fw-semibold">DNI: {item.dni_estudiante}</span> &bull; {item.email_estudiante}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 font-monospace">
                            {item.curso_codigo}
                          </span>
                          <div>
                            <div className="fw-semibold text-dark">{item.curso_nombre}</div>
                            <small className="text-muted">{item.curso_creditos} créditos académicos</small>
                          </div>
                        </div>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 fw-bold px-2 py-1">
                          {item.periodo}
                        </span>
                      </td>
                      <td className="text-center text-muted small">
                        <i className="bi bi-calendar3 me-1"></i>
                        {item.fecha_matricula}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge-status ${
                            item.estado_matricula === 'Matriculado'
                              ? 'badge-matriculado'
                              : item.estado_matricula === 'Retirado'
                              ? 'badge-inactivo'
                              : 'badge-activo'
                          }`}
                        >
                          <i
                            className={`bi ${
                              item.estado_matricula === 'Matriculado'
                                ? 'bi-check-circle-fill'
                                : item.estado_matricula === 'Retirado'
                                ? 'bi-dash-circle-fill'
                                : 'bi-award-fill'
                            } me-1`}
                          ></i>
                          {item.estado_matricula}
                        </span>
                      </td>
                      <td className="text-center pe-4">
                        <div className="btn-group btn-group-sm shadow-sm">
                          <button
                            className="btn btn-outline-primary"
                            title="Editar matrícula"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <i className="bi bi-pencil-fill"></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            title="Anular matrícula"
                            onClick={() =>
                              setDeleteModal({
                                show: true,
                                id: item.id_matricula,
                                info: `Matrícula #${item.id_matricula} de ${item.estudiante_nombre} en "${item.curso_nombre}"`
                              })
                            }
                          >
                            <i className="bi bi-trash3-fill"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Crear / Editar Matrícula */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(9, 26, 44, 0.65)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header navbar-senati text-white">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-white bg-opacity-20 rounded-3">
                    <i className="bi bi-card-checklist fs-5 text-white"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0 text-white">
                      {isEditing ? 'Modificar Registro de Matrícula' : 'Ficha de Inscripción Académica'}
                    </h5>
                    <small className="text-info opacity-75">Vinculación de Alumno con Curso Oficial</small>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    {/* Estudiante */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">Estudiante Registrado *</label>
                      <select
                        className={`form-select ${formErrors.id_estudiante ? 'is-invalid' : ''}`}
                        value={formData.id_estudiante}
                        disabled={isEditing}
                        onChange={(e) => setFormData({ ...formData, id_estudiante: e.target.value })}
                      >
                        <option value="">{estudiantes.some((est) => est.estado === 'Activo') ? '-- Seleccionar Alumno --' : 'No hay alumnos activos disponibles'}</option>
                        {estudiantes
                          .filter((est) => est.estado === 'Activo' || est.id_estudiante === formData.id_estudiante)
                          .map((est) => (
                            <option key={est.id_estudiante} value={est.id_estudiante}>
                              {est.apellidos}, {est.nombres} (DNI: {est.dni})
                            </option>
                          ))}
                      </select>
                      {formErrors.id_estudiante && <div className="invalid-feedback">{formErrors.id_estudiante}</div>}
                    </div>

                    {/* Curso */}
                    <div className="col-12 col-md-6">
                      <label className="form-label">Asignatura a Matricular *</label>
                      <select
                        className={`form-select ${formErrors.id_curso ? 'is-invalid' : ''}`}
                        value={formData.id_curso}
                        disabled={isEditing}
                        onChange={(e) => setFormData({ ...formData, id_curso: e.target.value, id_seccion: '' })}
                      >
                        <option value="">{cursos.some((cur) => cur.estado === 'Activo') ? '-- Seleccionar Curso --' : 'No hay cursos activos disponibles'}</option>
                        {cursos
                          .filter((cur) => cur.estado === 'Activo' || cur.id_curso === formData.id_curso)
                          .map((cur) => (
                            <option key={cur.id_curso} value={cur.id_curso}>
                              [{cur.codigo}] {cur.nombre} ({cur.vacantes_disponibles ?? cur.vacantes_maximas} cupos disponibles)
                            </option>
                          ))}
                      </select>
                      {formErrors.id_curso && <div className="invalid-feedback">{formErrors.id_curso}</div>}
                      {!isEditing && eligibility?.loading && <small className="text-muted d-block mt-1">Verificando prerrequisitos...</small>}
                      {!isEditing && eligibility?.error && <small className="text-danger d-block mt-1">{eligibility.error}</small>}
                      {!isEditing && eligibility?.assigned && eligibility.allowed && eligibility.prerequisites.length > 0 && <small className="text-success d-block mt-1">Prerrequisitos aprobados: {eligibility.prerequisites.map((item) => item.curso).join(', ')}.</small>}
                      {!isEditing && eligibility?.assigned && !eligibility.allowed && <small className="text-danger d-block mt-1">{eligibility.reason} Pendientes: {eligibility.missing.map((item) => item.nombre).join(', ')}.</small>}
                      {!isEditing && eligibility?.assigned === false && <small className="text-muted d-block mt-1">El estudiante todavía no tiene una malla vinculada; la validación completa requiere asignar su plan.</small>}
                    </div>

                    {!isEditing && <div className="col-12 col-md-6">
                      <label className="form-label">Sección y turno (recomendado)</label>
                      <select className="form-select" value={formData.id_seccion || ''} onChange={e => setFormData({...formData, id_seccion:e.target.value})}>
                        <option value="">Sin sección (registro tradicional)</option>
                        {secciones.filter(s=>String(s.id_curso)===String(formData.id_curso) &&
                          periodosAcademicos.some(p=>String(p.id_periodo)===String(s.id_periodo) && p.codigo===formData.periodo && p.estado==='Matricula abierta') && s.estado==='Abierta')
                          .filter((s) => Number(s.vacantes_disponibles) > 0)
                          .map(s=><option value={s.id_seccion} key={s.id_seccion}>{s.codigo} — {s.turno} · {s.docentes || 'Docente sin asignar'} · {s.horario || 'Horario pendiente'} ({s.vacantes_disponibles} vacantes)</option>)}
                      </select>
                      <small className="text-muted">Solo aparecen secciones abiertas de periodos con matrícula abierta.</small>
                    </div>}
                    {/* Periodo */}
                    <div className="col-12 col-md-4">
                      <label className="form-label">Periodo Académico *</label>
                      {periodosAcademicos.length ? (
                        <select
                          className={`form-select ${formErrors.periodo ? 'is-invalid' : ''}`}
                          value={formData.periodo}
                          onChange={(e) => setFormData({ ...formData, periodo: e.target.value, id_seccion: '' })}
                        >
                          {!periodosAcademicos.some((periodo) => periodo.codigo === formData.periodo) && (
                            <option value={formData.periodo}>{formData.periodo} (actual)</option>
                          )}
                          {periodosAcademicos.map((periodo) => (
                            <option key={periodo.id_periodo} value={periodo.codigo}>
                              {periodo.nombre} ({periodo.codigo}) — {periodo.estado}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className={`form-control ${formErrors.periodo ? 'is-invalid' : ''}`}
                          value={formData.periodo}
                          onChange={(e) => setFormData({ ...formData, periodo: e.target.value.toUpperCase() })}
                          placeholder="Ej. 2026-I"
                        />
                      )}
                      {formErrors.periodo && <div className="invalid-feedback">{formErrors.periodo}</div>}
                    </div>

                    {/* Fecha de Matrícula */}
                    <div className="col-12 col-md-4">
                      <label className="form-label">Fecha de Registro *</label>
                      <input
                        type="date"
                        className={`form-control ${formErrors.fecha_matricula ? 'is-invalid' : ''}`}
                        value={formData.fecha_matricula}
                        onChange={(e) => setFormData({ ...formData, fecha_matricula: e.target.value })}
                      />
                      {formErrors.fecha_matricula && <div className="invalid-feedback">{formErrors.fecha_matricula}</div>}
                    </div>

                    {/* Estado */}
                    <div className="col-12 col-md-4">
                      <label className="form-label">Estado de Matrícula *</label>
                      <select
                        className="form-select"
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      >
                        <option value="Matriculado">Matriculado (Regular)</option>
                        <option value="Retirado">Retirado (Baja voluntaria)</option>
                        <option value="Finalizado">Finalizado (Completado)</option>
                      </select>
                    </div>

                    {/* Observaciones */}
                    <div className="col-12">
                      <label className="form-label">Observaciones / Notas Administrativas</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        placeholder="Ej. Turno de estudios, convalidación o beca..."
                        value={formData.observaciones}
                        onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                      ></textarea>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary px-3" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-senati px-4">
                    <i className="bi bi-check2-circle me-1"></i> {isEditing ? 'Actualizar Matrícula' : 'Confirmar Matrícula'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        show={deleteModal.show}
        title="Confirmar Anulación de Matrícula"
        message={`¿Estás seguro de anular la ${deleteModal.info}? El cupo quedará liberado automáticamente para otro estudiante en la base de datos.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ show: false, id: null, info: '' })}
      />
    </div>
  );
};

export default MatriculasPage;
