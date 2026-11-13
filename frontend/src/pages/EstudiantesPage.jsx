import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AlertMessage from '../components/AlertMessage';
import ConfirmModal from '../components/ConfirmModal';

const EstudiantesPage = () => {
  const [estudiantes, setEstudiantes] = useState([]);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', type: 'danger' });

  // Modal de Crear / Editar
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id_estudiante: null,
    dni: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    direccion: '',
    estado: 'Activo'
  });
  const [formErrors, setFormErrors] = useState({});

  // Modal de Confirmación de Eliminación
  const [deleteModal, setDeleteModal] = useState({ show: false, id: null, nombre: '' });

  const fetchEstudiantes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/estudiantes');
      if (res.data.success) {
        setEstudiantes(res.data.data);
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Error al cargar estudiantes', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstudiantes();
  }, []);

  const showAlert = (message, type = 'success') => {
    setAlert({ show: true, message, type });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 4500);
  };

  const validate = () => {
    const errors = {};
    if (!formData.dni.trim()) {
      errors.dni = 'El DNI es obligatorio';
    } else if (!/^\d{8}$/.test(formData.dni.trim())) {
      errors.dni = 'El DNI debe tener exactamente 8 dígitos numéricos';
    }

    if (!formData.nombres.trim()) {
      errors.nombres = 'El nombre es obligatorio';
    }

    if (!formData.apellidos.trim()) {
      errors.apellidos = 'Los apellidos son obligatorios';
    }

    if (!formData.email.trim()) {
      errors.email = 'El correo electrónico es obligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Ingrese un correo electrónico válido';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setFormData({
      id_estudiante: null,
      dni: '',
      nombres: '',
      apellidos: '',
      email: '',
      telefono: '',
      direccion: '',
      estado: 'Activo'
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setIsEditing(true);
    setFormData({
      id_estudiante: item.id_estudiante,
      dni: item.dni,
      nombres: item.nombres,
      apellidos: item.apellidos,
      email: item.email,
      telefono: item.telefono || '',
      direccion: item.direccion || '',
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
        const res = await api.put(`/estudiantes/${formData.id_estudiante}`, formData);
        showAlert(res.data.message || 'Estudiante actualizado con éxito');
      } else {
        const res = await api.post('/estudiantes', formData);
        showAlert(res.data.message || 'Estudiante registrado con éxito');
      }
      setShowModal(false);
      fetchEstudiantes();
    } catch (err) {
      showAlert(err.response?.data?.message || 'Error al procesar la solicitud', 'danger');
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const res = await api.delete(`/estudiantes/${deleteModal.id}`);
      showAlert(res.data.message || 'Estudiante eliminado');
      setDeleteModal({ show: false, id: null, nombre: '' });
      fetchEstudiantes();
    } catch (err) {
      showAlert(err.response?.data?.message || 'No se pudo eliminar el estudiante', 'danger');
      setDeleteModal({ show: false, id: null, nombre: '' });
    }
  };

  // Helper para iniciales de avatar
  const getInitials = (nombres, apellidos) => {
    const n = nombres?.trim().charAt(0) || '';
    const a = apellidos?.trim().charAt(0) || '';
    return `${a}${n}`.toUpperCase();
  };

  const filteredEstudiantes = estudiantes.filter((item) => {
    const term = search.toLowerCase();
    const matchesSearch =
      item.nombres.toLowerCase().includes(term) ||
      item.apellidos.toLowerCase().includes(term) ||
      item.dni.includes(term) ||
      item.email.toLowerCase().includes(term);

    const matchesEstado = filterEstado === 'TODOS' || item.estado === filterEstado;

    return matchesSearch && matchesEstado;
  });

  return (
    <div className="container py-4">
      {/* Encabezado del Módulo */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1">
              <i className="bi bi-people-fill me-1"></i> Control de Alumnos
            </span>
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              Total: {estudiantes.length} alumnos registrados
            </span>
          </div>
          <h2 className="fw-bolder mb-0 text-dark">Padrón de Estudiantes</h2>
        </div>
        <button className="btn btn-senati d-flex align-items-center gap-2 px-3 py-2" onClick={handleOpenCreate}>
          <i className="bi bi-person-plus-fill fs-6"></i> Registrar Nuevo Alumno
        </button>
      </div>

      {alert.show && (
        <AlertMessage message={alert.message} type={alert.type} onClose={() => setAlert({ ...alert, show: false })} />
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-7">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Buscar por DNI (ej. 7123...), apellidos, nombres o correo..."
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
            <div className="col-12 col-md-5 d-flex justify-content-md-end gap-2">
              <button
                className={`btn btn-sm ${filterEstado === 'TODOS' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setFilterEstado('TODOS')}
              >
                Todos ({estudiantes.length})
              </button>
              <button
                className={`btn btn-sm ${filterEstado === 'Activo' ? 'btn-success' : 'btn-outline-success'}`}
                onClick={() => setFilterEstado('Activo')}
              >
                Activos ({estudiantes.filter((e) => e.estado === 'Activo').length})
              </button>
              <button
                className={`btn btn-sm ${filterEstado === 'Inactivo' ? 'btn-secondary' : 'btn-outline-secondary'}`}
                onClick={() => setFilterEstado('Inactivo')}
              >
                Inactivos ({estudiantes.filter((e) => e.estado === 'Inactivo').length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Estilizada de Estudiantes */}
      <div className="card shadow-sm border-0 overflow-hidden">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th className="ps-4">DNI</th>
                  <th>Estudiante</th>
                  <th>Contacto</th>
                  <th>Dirección</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center pe-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="spinner-border text-primary me-2" role="status"></div>
                      <p className="mt-2 text-muted fw-semibold">Consultando base de datos...</p>
                    </td>
                  </tr>
                ) : filteredEstudiantes.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
                      <i className="bi bi-person-x fs-1 d-block mb-2 text-secondary opacity-50"></i>
                      No se encontraron estudiantes con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredEstudiantes.map((item) => (
                    <tr key={item.id_estudiante}>
                      <td className="ps-4">
                        <span className="badge bg-light text-primary font-monospace border px-2 py-1 fw-bold fs-7">
                          {item.dni}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className="avatar-initials">
                            {getInitials(item.nombres, item.apellidos)}
                          </div>
                          <div>
                            <div className="fw-bold text-dark">{item.apellidos}, {item.nombres}</div>
                            <small className="text-muted d-flex align-items-center gap-1">
                              <i className="bi bi-envelope"></i> {item.email}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="text-dark small">
                          <i className="bi bi-telephone text-primary me-1"></i>
                          {item.telefono || <span className="text-muted fst-italic">Sin teléfono</span>}
                        </div>
                      </td>
                      <td>
                        <small className="text-muted text-truncate d-inline-block" style={{ maxWidth: '220px' }}>
                          <i className="bi bi-geo-alt me-1 text-secondary"></i>
                          {item.direccion || <span className="fst-italic">No especificada</span>}
                        </small>
                      </td>
                      <td className="text-center">
                        <span className={`badge-status ${item.estado === 'Activo' ? 'badge-activo' : 'badge-inactivo'}`}>
                          <i className={`bi ${item.estado === 'Activo' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-1`}></i>
                          {item.estado}
                        </span>
                      </td>
                      <td className="text-center pe-4">
                        <div className="btn-group btn-group-sm shadow-sm">
                          <button
                            className="btn btn-outline-primary"
                            title="Editar información"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <i className="bi bi-pencil-fill"></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            title="Eliminar estudiante"
                            onClick={() => setDeleteModal({
                              show: true,
                              id: item.id_estudiante,
                              nombre: `${item.nombres} ${item.apellidos}`
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

      {/* Modal Institucional de Registro / Edición */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(9, 26, 44, 0.65)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header navbar-senati text-white">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-white bg-opacity-20 rounded-3">
                    <i className={`bi ${isEditing ? 'bi-pencil-square' : 'bi-person-plus-fill'} fs-5 text-white`}></i>
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold mb-0 text-white">
                      {isEditing ? 'Modificar Ficha del Estudiante' : 'Ficha de Inscripción de Estudiante'}
                    </h5>
                    <small className="text-info opacity-75">Registro académico oficial - SENATI</small>
                  </div>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body p-4">
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Número de DNI (8 dígitos) *</label>
                      <input
                        type="text"
                        maxLength="8"
                        className={`form-control ${formErrors.dni ? 'is-invalid' : ''}`}
                        value={formData.dni}
                        onChange={(e) => setFormData({ ...formData, dni: e.target.value.replace(/\D/g, '') })}
                        placeholder="Ej. 71234567"
                      />
                      {formErrors.dni && <div className="invalid-feedback">{formErrors.dni}</div>}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Estado Académico *</label>
                      <select
                        className="form-select"
                        value={formData.estado}
                        onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                      >
                        <option value="Activo">Activo (Habilitado para matricularse)</option>
                        <option value="Inactivo">Inactivo (Suspendido / No matriculable)</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Nombres Completos *</label>
                      <input
                        type="text"
                        className={`form-control ${formErrors.nombres ? 'is-invalid' : ''}`}
                        value={formData.nombres}
                        onChange={(e) => setFormData({ ...formData, nombres: e.target.value })}
                        placeholder="Nombres del estudiante"
                      />
                      {formErrors.nombres && <div className="invalid-feedback">{formErrors.nombres}</div>}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Apellidos Paterno y Materno *</label>
                      <input
                        type="text"
                        className={`form-control ${formErrors.apellidos ? 'is-invalid' : ''}`}
                        value={formData.apellidos}
                        onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                        placeholder="Apellidos del estudiante"
                      />
                      {formErrors.apellidos && <div className="invalid-feedback">{formErrors.apellidos}</div>}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Correo Electrónico Institucional *</label>
                      <input
                        type="email"
                        className={`form-control ${formErrors.email ? 'is-invalid' : ''}`}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="alumno@senati.pe"
                      />
                      {formErrors.email && <div className="invalid-feedback">{formErrors.email}</div>}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label">Teléfono Celular</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        placeholder="Ej. 987654321"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Dirección Domiciliaria</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        placeholder="Distrito, Avenida, Nro o Referencia"
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary px-3" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-senati px-4">
                    <i className="bi bi-save2-fill me-1"></i> {isEditing ? 'Actualizar Ficha' : 'Guardar Alumno'}
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
        title="Confirmar Baja de Estudiante"
        message={`¿Estás seguro de eliminar a "${deleteModal.nombre}"? Si cuenta con asignaturas matriculadas, el sistema protegerá la integridad de los datos evitando la eliminación.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal({ show: false, id: null, nombre: '' })}
      />
    </div>
  );
};

export default EstudiantesPage;
