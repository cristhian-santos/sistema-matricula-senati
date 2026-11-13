import React, {useEffect,useState} from 'react';
import api from '../services/api';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [healthy,setHealthy]=useState(null);
  const [periodo,setPeriodo]=useState('Sin periodo activo');
  useEffect(()=>{
    api.get('/salud').then(()=>setHealthy(true)).catch(()=>setHealthy(false));
    if(user?.roles.some(role=>['Administrador','Secretaría'].includes(role))){
      api.get('/academico/periodos_academicos').then(({data})=>{const p=data.data.find(p=>p.estado==='En curso'||p.estado==='Matricula abierta');if(p)setPeriodo(p.codigo);}).catch(()=>{});
    }
  },[user]);
  return (
    <header className="sticky-top">
      {/* Barra Superior Institucional */}
      <div className="institutional-topbar">
        <div className="container d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <span><i className="bi bi-shield-check text-info me-1"></i> Sistema Integral de Gestión Académica</span>
            <span className="d-none d-md-inline">&bull;</span>
            <span className="d-none d-md-inline"><i className="bi bi-diagram-3 me-1"></i> Administración académica</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="badge bg-success bg-opacity-25 text-white border border-success border-opacity-50 px-2 py-1">
              <span className="spinner-grow spinner-grow-sm me-1" style={{ width: '6px', height: '6px' }} role="status"></span>
              Servidor BD: {healthy===null?'Verificando':healthy?'Conectado':'Sin conexión'}
            </span>
            <span className="fw-semibold text-white">{periodo}</span>
          </div>
        </div>
      </div>

      {/* Navegación Principal */}
      <nav className="navbar navbar-expand-lg navbar-senati">
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
            <div className="bg-white text-primary rounded-3 p-2 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '40px', height: '40px' }}>
              <i className="bi bi-mortarboard-fill fs-5 text-primary"></i>
            </div>
            <div>
              <div className="fw-bold fs-5 lh-1 text-white">SENATI</div>
              <small className="text-info fw-semibold" style={{ fontSize: '0.72rem', letterSpacing: '0.8px' }}>
                GESTIÓN DE MATRÍCULA
              </small>
            </div>
          </Link>

          <button
            className="navbar-toggler border-0 text-white"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarContent"
            aria-controls="navbarContent"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <i className="bi bi-list fs-2 text-white"></i>
          </button>

          <div className="collapse navbar-collapse" id="navbarContent">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0 gap-1 align-items-lg-center">
              {!user && <li className="nav-item"><NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/login"><i className="bi bi-box-arrow-in-right me-1"></i> Iniciar sesión</NavLink></li>}
              {user?.roles.includes('Administrador') || user?.roles.includes('Secretaría') ? <>
              <li className="nav-item">
                <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/">
                  <i className="bi bi-grid-1x2-fill me-1"></i> Panel General
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/estudiantes">
                  <i className="bi bi-people-fill me-1"></i> Estudiantes
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/cursos">
                  <i className="bi bi-book-half me-1"></i> Catálogo de Cursos
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/matriculas">
                  <i className="bi bi-card-checklist me-1"></i> Registro de Matrículas
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/horarios">
                  <i className="bi bi-calendar-week me-1"></i> Horarios
                </NavLink>
              </li>
              <li className="nav-item"><NavLink className={({isActive})=>`nav-link ${isActive?'active':''}`} to="/reportes"><i className="bi bi-bar-chart me-1"/> Reportes</NavLink></li>
              <li className="nav-item dropdown">
                <NavLink className={({isActive})=>`nav-link dropdown-toggle ${isActive?'active':''}`} to="/academico/carreras"><i className="bi bi-diagram-3 me-1"></i> Gestión académica</NavLink>
              </li>
              {user?.roles.includes('Administrador') && <li className="nav-item"><NavLink className={({isActive})=>`nav-link ${isActive?'active':''}`} to="/mallas"><i className="bi bi-journal-bookmark me-1"></i> Mallas</NavLink></li>}
              </> : null}
              {user?.roles.includes('Administrador') && <li className="nav-item"><NavLink className={({isActive})=>`nav-link ${isActive?'active':''}`} to="/cuentas"><i className="bi bi-person-lock me-1"></i> Cuentas</NavLink></li>}
              {user?.roles.some(role=>['Administrador','Secretaría'].includes(role)) && <li className="nav-item"><NavLink className={({isActive})=>`nav-link ${isActive?'active':''}`} to="/tesoreria"><i className="bi bi-cash-coin me-1"></i> Tesorería</NavLink></li>}
              {user?.roles.includes('Docente') && <li className="nav-item"><NavLink className={({isActive})=>`nav-link ${isActive?'active':''}`} to="/docente"><i className="bi bi-person-workspace me-1"></i> Panel docente</NavLink></li>}
              {user?.roles.includes('Estudiante') && <li className="nav-item"><NavLink className={({isActive})=>`nav-link ${isActive?'active':''}`} to="/mis-pagos"><i className="bi bi-receipt me-1"></i> Mis pagos</NavLink></li>}
              {user?.roles.includes('Estudiante') && <li className="nav-item"><NavLink className={({isActive})=>`nav-link ${isActive?'active':''}`} to="/mi-malla"><i className="bi bi-journal-bookmark me-1"></i> Mi malla</NavLink></li>}
              {user && <li className="nav-item"><button className="btn btn-link nav-link" onClick={() => logout()}><i className="bi bi-box-arrow-right me-1"></i> Cerrar sesión</button></li>}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
