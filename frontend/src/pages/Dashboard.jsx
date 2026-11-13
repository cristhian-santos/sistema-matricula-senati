import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatCard from '../components/StatCard';
import AlertMessage from '../components/AlertMessage';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalEstudiantes: 0,
    totalCursos: 0,
    totalMatriculasActivas: 0,
    matriculasPorCurso: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/stats');
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor Backend. Verifica que esté activo en el puerto 5000.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="container py-4">
      {/* Banner de Bienvenida Institucional */}
      <div className="hero-banner mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-2">
            <span className="badge badge-turquesa px-2 py-1">
              <i className="bi bi-mortarboard-fill me-1"></i> Módulo Académico
            </span>
            <span className="text-light opacity-75" style={{ fontSize: '0.85rem' }}>
              SENATI Dirección Zonal Lima - Callao
            </span>
          </div>
          <h2 className="fw-bolder mb-1 text-white">Sistema Integral de Matrícula</h2>
          <p className="text-light opacity-85 mb-0" style={{ maxWidth: '650px' }}>
            Control de vacantes, registro de estudiantes, catálogo de asignaturas e inscripción en tiempo real sobre Base de Datos MySQL.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/matriculas" className="btn btn-turquesa d-flex align-items-center gap-2 px-3 py-2">
            <i className="bi bi-plus-circle-fill"></i> Registrar Matrícula
          </Link>
        </div>
      </div>

      <AlertMessage message={error} onClose={() => setError('')} />

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <p className="mt-2 text-muted fw-semibold">Consultando base de datos...</p>
        </div>
      ) : (
        <>
          {/* Tarjetas Estadísticas Principales */}
          <div className="row g-3 mb-4">
            <div className="col-12 col-md-4">
              <StatCard
                title="Padrón Estudiantil"
                value={stats.totalEstudiantes}
                icon="bi-people-fill"
                colorTheme="primary"
                subtitle="Alumnos registrados"
                badgeText="Base de Datos"
              />
            </div>
            <div className="col-12 col-md-4">
              <StatCard
                title="Catálogo de Cursos"
                value={stats.totalCursos}
                icon="bi-journal-bookmark-fill"
                colorTheme="success"
                subtitle="Asignaturas ofertadas"
                badgeText="Periodo 2026-I"
              />
            </div>
            <div className="col-12 col-md-4">
              <StatCard
                title="Matrículas Vigentes"
                value={stats.totalMatriculasActivas}
                icon="bi-check2-circle"
                colorTheme="info"
                subtitle="Inscripciones activas"
                badgeText="En tiempo real"
              />
            </div>
          </div>

          {/* Gráfico / Tabla de Ocupación de Cursos */}
          <div className="row g-4">
            <div className="col-12 col-lg-8">
              <div className="card shadow-sm h-100 border-0">
                <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <div className="p-2 bg-primary bg-opacity-10 text-primary rounded-3">
                      <i className="bi bi-bar-chart-fill"></i>
                    </div>
                    <div>
                      <h6 className="mb-0 fw-bold text-dark">Demanda y Ocupación de Cupos por Curso</h6>
                      <small className="text-muted">Cálculo dinámico sobre la capacidad máxima institucional</small>
                    </div>
                  </div>
                  <Link to="/cursos" className="btn btn-sm btn-outline-primary fw-semibold">
                    Ver Catálogo <i className="bi bi-arrow-right"></i>
                  </Link>
                </div>
                <div className="card-body p-0">
                  {stats.matriculasPorCurso.length === 0 ? (
                    <p className="text-muted text-center py-4">No hay cursos registrados en el sistema.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead>
                          <tr>
                            <th className="ps-4">Código</th>
                            <th>Asignatura</th>
                            <th className="text-center">Capacidad</th>
                            <th className="text-center">Inscritos</th>
                            <th className="pe-4">Ocupación de Cupo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.matriculasPorCurso.map((curso) => {
                            const porcentaje = Math.min(100, Math.round((curso.inscritos / curso.vacantes_maximas) * 100));
                            const barColor =
                              porcentaje >= 85
                                ? 'bg-danger'
                                : porcentaje >= 40
                                ? 'bg-primary'
                                : 'bg-success';

                            return (
                              <tr key={curso.id_curso}>
                                <td className="ps-4 fw-bold font-monospace text-primary">
                                  <span className="badge bg-light text-primary border">{curso.codigo}</span>
                                </td>
                                <td>
                                  <span className="fw-semibold text-dark">{curso.nombre}</span>
                                </td>
                                <td className="text-center text-muted fw-semibold">
                                  {curso.vacantes_maximas}
                                </td>
                                <td className="text-center">
                                  <span className="badge bg-light text-dark border px-2 py-1 fw-bold">
                                    {curso.inscritos}
                                  </span>
                                </td>
                                <td className="pe-4" style={{ minWidth: '160px' }}>
                                  <div className="d-flex align-items-center gap-2">
                                    <div className="progress flex-grow-1" style={{ height: '7px' }}>
                                      <div
                                        className={`progress-bar ${barColor}`}
                                        role="progressbar"
                                        style={{ width: `${porcentaje}%` }}
                                        aria-valuenow={porcentaje}
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                      ></div>
                                    </div>
                                    <span className="text-muted fw-bold" style={{ fontSize: '0.8rem', minWidth: '35px' }}>
                                      {porcentaje}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Accesos Rápidos Institucionales */}
            <div className="col-12 col-lg-4">
              <div className="card shadow-sm h-100 border-0">
                <div className="card-header bg-white py-3">
                  <h6 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-grid-fill text-info"></i>
                    Accesos Directos a Módulos
                  </h6>
                </div>
                <div className="card-body d-flex flex-column gap-3">
                  <Link to="/estudiantes" className="card border p-3 text-decoration-none text-dark d-flex flex-row align-items-center justify-content-between hover-shadow">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-3">
                        <i className="bi bi-person-lines-fill fs-5"></i>
                      </div>
                      <div>
                        <div className="fw-bold">Gestión de Alumnos</div>
                        <small className="text-muted">Padrón de estudiantes y DNI</small>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted"></i>
                  </Link>

                  <Link to="/cursos" className="card border p-3 text-decoration-none text-dark d-flex flex-row align-items-center justify-content-between hover-shadow">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-3 bg-success bg-opacity-10 text-success rounded-3">
                        <i className="bi bi-journals fs-5"></i>
                      </div>
                      <div>
                        <div className="fw-bold">Catálogo de Cursos</div>
                        <small className="text-muted">Créditos, horas y vacantes</small>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted"></i>
                  </Link>

                  <Link to="/matriculas" className="card border p-3 text-decoration-none text-dark d-flex flex-row align-items-center justify-content-between hover-shadow">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-3 bg-info bg-opacity-10 text-info rounded-3">
                        <i className="bi bi-card-checklist fs-5"></i>
                      </div>
                      <div>
                        <div className="fw-bold">Módulo de Matrícula</div>
                        <small className="text-muted">Vinculación relacional SQL</small>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted"></i>
                  </Link>

                  <div className="alert alert-light border mt-auto mb-0 d-flex align-items-start gap-2">
                    <i className="bi bi-info-circle-fill text-primary mt-1"></i>
                    <small className="text-muted">
                      <strong>SENATI SGM:</strong> Las inscripciones descuentan cupos automáticamente y validan que no existan duplicados por periodo académico.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
