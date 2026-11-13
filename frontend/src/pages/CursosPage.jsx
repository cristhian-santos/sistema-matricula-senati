import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AlertMessage from '../components/AlertMessage';
import ConfirmModal from '../components/ConfirmModal';

const CursosPage = () => {
  const [cursos, setCursos] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'danger' });

  // Modal Crear / Editar
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id_curso: null,
    codigo: '',
    nombre: '',
    creditos: 3,
    horas: 60,
    vacantes_maximas: 25,
    estado: 'Activo'
  });
  const [formErrors, setFormErrors] = useState({});

  // Modal Eliminación
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nombre: '' });

  const fetchCursos = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cursos');
      if (res.data.success) {
        setCursos(res.data.data);
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Error al cargar cursos', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCursos();
  }, []);

  const showAlert = (message, type = 'success') => {
    setAlert({ show: true, message, type });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 4500);
  };

  const validate = () => {
    const errors = {};
    if (!formData.codigo.trim()) {
      errors.codigo = 'El código del curso es obligatorio';
    }

    if (!formData.nombre.trim()) {
      errors.nombre = 'El nombre de la materia es obligatorio';
    }

    if (!formData.creditos || Number(formData.creditos) <= 0) {
      errors.creditos = 'Debe indicar al menos 1 crédito';
    }

    if (!formData.horas || Number(formData.horas) <= 0) {
      errors.horas = 'Las horas deben ser mayores a 0';
    }

    if (!formData.vacantes_maximas || Number(formData.vacantes_maximas) <= 0) {
      errors.vacantes_maximas = 'El cupo de vacantes debe ser mayor a 0';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setFormData({
      id_curso: null,
      codigo: '',
      nombre: '',
      creditos: 3,
      horas: 60,
      vacantes_maximas: 25,
      estado: 'Activo'
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setIsEditing(true);
    setFormData({
      id_curso: item.id_curso,
      codigo: item.codigo,
      nombre: item.nombre,
      creditos: item.creditos,
      horas: item.horas,
      vacantes_maximas: item.vacantes_maximas,
      estado: item.estado
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEditing) {
        const res = await api.put(`/cursos/${formData.id_curso}`, formData);
        showAlert(res.data.message || 'Curso actualizado correctamente');
      } else {
        const res = await api.post('/cursos', formData);
        showAlert(res.data.message || 'Curso creado con éxito');
      }
      setShowModal(false);
      fetchCursos();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Error al guardar curso', 'danger');
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const res = await api.delete(`/cursos/${deleteModal.id}`);
      showAlert(res.data.message || 'Curso eliminado con éxito');
      setDeleteModal({ show: false, id: null, nombre: '' });
      fetchCursos();
    } catch (err) {
      showAlert(err.response?.data?.message || 'No se puede eliminar el curso porque tiene matrículas registradas', 'danger');
      setDeleteModal({ show: false, id: null, nombre: '' });
    }
  };

  const filteredCursos = cursos.filter((item) => {
    const term = search.toLowerCase();
    return item.nombre.toLowerCase().includes(term) || item.codigo.toLowerCase().includes(term);
  });

  return (
    <div className="container py-4">
      {/* Encabezado del Módulo */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">
              <i className="bi bi-book-half me-1"></i> Asignaturas y Módulos
            </span>
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              {cursos.length} cursos ofertados
            </span>
          </div>
          <h2 className="fw-bolder mb-0 text-dark">Catálogo Académico de Cursos</h2>
        </div>
        <button className="btn btn-success d-flex align-items-center gap-2 px-3 py-2 fw-semibold shadow-sm" onClick={handleOpenCreate}>
          <i className="bi bi-journal-plus fs-6"></i> Crear Asignatura
        </button>
      </div>

      {alert.show && (
        <AlertMessage message={alert.message} type={alert.type} onClose={() => setAlert({ ...alert, show: false })} />
      )}

      {/* Buscador */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-body p-3">
          <div className="input-group">
            <span className="input-group-text bg-white border-end-0">
              <i className="bi bi-search text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0 ps-0"
              placeholder="Buscar curso por código de materia (ej. DEV-201) o título..."
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
      </div>

      {/* Tabla de Cursos */}
      <div className="card shadow-sm border-0 overflow-hidden">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th className="ps-4">Código</th>
                  <th>Asignatura</th>
                  <th className="text-center">Créditos</th>
                  <th className="text-center">Horas Lectivas</th>
                  <th className="text-center">Cupo y Disponibilidad</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center pe-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5">
                      <div className="spinner-border text-success me-2" role="status"></div>
                      <p className="mt-2 text-muted fw-semibold">Cargando catálogo...</p>
                    </td>
                  </tr>
                ) : filteredCursos.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      <i className="bi bi-journal-x fs-1 d-block mb-2 text-secondary opacity-50"></i>
                      No se encontraron cursos con ese criterio.
                    </td>
                  </tr>
                ) : (
                  filteredCursos.map((item) => (
                    <tr key={item.id_curso}>
                      <td className="ps-4">
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 font-monospace fw-bold px-2 py-1">
                          {item.codigo}
                        </span>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{item.nombre}</div>
                        <small className="text-muted">Plan de Estudios 2026</small>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-light text-dark border px-2 py-1">
                          <i className="bi bi-award me-1 text-warning"></i>
                          {item.creditos} CR
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="text-muted small">
                          <i className="bi bi-clock me-1"></i>
                          {item.horas} hrs
                        </span>
                      </td>
                      <td className="text-center" style={{ minWidth: '150px' }}>
                        <div className="fw-bold text-dark">
                          {item.total_matriculados || 0} / {item.vacantes_maximas}
                        </div>
                        <small className="text-success fw-semibold">
                          ({item.vacantes_disponibles ?? item.vacantes_maximas} disponibles)
                        </small>
                      </td>
                      <td className="text-center">
                        <span className={`badge-status ${item.estado === 'Activo' ? 'badge-activo' : 'badge-inactivo'}`}>
                          {item.estado}
                        </span>
                      </td>
                      <td className="text-center pe-4">
                        <div className="btn-group btn-group-sm shadow-sm">
                          <button
                            className="btn btn-outline-primary"
                            title="Editar materia"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <i className="bi bi-pencil-fill"></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            title="Eliminar curso"
                            onClick={() => setDeleteModal({
                              show: true,
                              id: item.id_curso,
                              nombre: `${item.codigo} - ${item.nombre}`
                            })}
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

      {/* Modal Crear / Editar */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(9, 26, 44, 0.65)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-white bg-opacity-20 rounded-3">
                    <i className="bi bi-book-half fs-5 text-white"></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0 text-white">
                      {isEditing ? 'Modificar Parámetros del Curso' : 'Registro de Nueva Asignatura'}
                    </h5>
                    <small className="text-white opacity-75">Configuración de créditos y vacantes</small>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Código Oficial de Asignatura *</label>
                      <input
                        type="text"
                        className={`form-control ${formErrors.codigo ? 'is-invalid' : ''}`}
                        value={formData.codigo}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                        placeholder="Ej. DEV-201, BD-301"
                      />
                      {formErrors.codigo && <div className="invalid-feedback">{formErrors.codigo}</div>}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Estado del Curso *</label>
                      <select
                        className="form-select"
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      >
                        <option value="Activo">Activo (Acepta inscripciones)</option>
                        <option value="Inactivo">Inactivo (Cerrado por periodo)</option>
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Nombre del Curso / Módulo Formativo *</label>
                      <input
                        type="text"
                        className={`form-control ${formErrors.nombre ? 'is-invalid' : ''}`}
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Ej. Desarrollo Web con React y MySQL"
                      />
                      {formErrors.nombre && <div className="invalid-feedback">{formErrors.nombre}</div>}
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label">Créditos Académicos *</label>
                      <input
                        type="number"
                        min="1"
                        className={`form-control ${formErrors.creditos ? 'is-invalid' : ''}`}
                        value={formData.creditos}
                        onChange={(e) => setFormData({ ...formData, creditos: e.target.value })}
                      />
                      {formErrors.creditos && <div className="invalid-feedback">{formErrors.creditos}</div>}
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label">Horas Semestrales *</label>
                      <input
                        type="number"
                        min="1"
                        className={`form-control ${formErrors.horas ? 'is-invalid' : ''}`}
                        value={formData.horas}
                        onChange={(e) => setFormData({ ...formData, horas: e.target.value })}
                      />
                      {formErrors.horas && <div className="invalid-feedback">{formErrors.horas}</div>}
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label">Cupo Máximo de Vacantes *</label>
                      <input
                        type="number"
                        min="1"
                        className={`form-control ${formErrors.vacantes_maximas ? 'is-invalid' : ''}`}
                        value={formData.vacantes_maximas}
                        onChange={(e) => setFormData({ ...formData, vacantes_maximas: e.target.value })}
                      />
                      {formErrors.vacantes_maximas && <div className="invalid-feedback">{formErrors.vacantes_maximas}</div>}
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary px-3" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-success px-4 fw-semibold">
                    <i className="bi bi-save2-fill me-1"></i> {isEditing ? 'Actualizar Curso' : 'Guardar Curso'}
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
        title="Confirmar Baja de Asignatura"
        message={`¿Estás seguro de eliminar el curso "${deleteModal.nombre}"? Si ya cuenta con alumnos matriculados, la base de datos protegerá el historial impidiendo el borrado.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ show: false, id: null, nombre: '' })}
      />
    </div>
  );
};

export default CursosPage;
