import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import EstudiantesPage from './pages/EstudiantesPage';
import CursosPage from './pages/CursosPage';
import MatriculasPage from './pages/MatriculasPage';
import AcademicoPage from './pages/AcademicoPage';
import ReportesPage from './pages/ReportesPage';
import LoginPage from './pages/LoginPage';
import TeacherPortalPage from './pages/TeacherPortalPage';
import UserAccountsPage from './pages/UserAccountsPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import TreasuryPage from './pages/TreasuryPage';
import StudentPaymentsPage from './pages/StudentPaymentsPage';
import PaymentReceiptPage from './pages/PaymentReceiptPage';
import MallaCurricularPage from './pages/MallaCurricularPage';
import StudentCurriculumPage from './pages/StudentCurriculumPage';
import SchedulePage from './pages/SchedulePage';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="container py-5 text-center">Verificando acceso...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.debe_cambiar_password && location.pathname !== '/cambiar-password') return <Navigate to="/cambiar-password" replace />;
  if (!user.roles.some((role) => roles.includes(role))) return <Navigate to={user.roles.includes('Docente') ? '/docente' : user.roles.includes('Estudiante') ? '/mis-pagos' : '/login'} replace />;
  return children;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="d-flex flex-column min-vh-100">
          <Navbar />
          <main className="main-content pb-5">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cambiar-password" element={<ProtectedRoute roles={['Administrador','Secretaría','Docente','Estudiante']}><ChangePasswordPage /></ProtectedRoute>} />
              <Route path="/docente" element={<ProtectedRoute roles={['Docente']}><TeacherPortalPage /></ProtectedRoute>} />
              <Route path="/cuentas" element={<ProtectedRoute roles={['Administrador']}><UserAccountsPage /></ProtectedRoute>} />
              <Route path="/tesoreria" element={<ProtectedRoute roles={['Administrador','Secretaría']}><TreasuryPage /></ProtectedRoute>} />
              <Route path="/mis-pagos" element={<ProtectedRoute roles={['Estudiante']}><StudentPaymentsPage /></ProtectedRoute>} />
              <Route path="/tesoreria/constancia/:id" element={<ProtectedRoute roles={['Administrador','Secretaría','Estudiante']}><PaymentReceiptPage /></ProtectedRoute>} />
              <Route path="/mallas" element={<ProtectedRoute roles={['Administrador']}><MallaCurricularPage /></ProtectedRoute>} />
              <Route path="/horarios" element={<ProtectedRoute roles={['Administrador','Secretaría']}><SchedulePage /></ProtectedRoute>} />
              <Route path="/mi-malla" element={<ProtectedRoute roles={['Estudiante']}><StudentCurriculumPage /></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute roles={['Administrador','Secretaría']}><Dashboard /></ProtectedRoute>} />
              <Route path="/estudiantes" element={<ProtectedRoute roles={['Administrador','Secretaría']}><EstudiantesPage /></ProtectedRoute>} />
              <Route path="/cursos" element={<ProtectedRoute roles={['Administrador','Secretaría']}><CursosPage /></ProtectedRoute>} />
              <Route path="/matriculas" element={<ProtectedRoute roles={['Administrador','Secretaría']}><MatriculasPage /></ProtectedRoute>} />
              <Route path="/reportes" element={<ProtectedRoute roles={['Administrador','Secretaría']}><ReportesPage /></ProtectedRoute>} />
              <Route path="/academico/:modulo" element={<ProtectedRoute roles={['Administrador','Secretaría']}><AcademicoPage /></ProtectedRoute>} />
              <Route path="/academico" element={<Navigate to="/academico/carreras" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="bg-white border-top py-4 text-center text-muted mt-auto">
            <div className="container">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-mortarboard-fill text-primary"></i>
                  <span className="fw-bold text-dark">SENATI &bull; Sistema de Gestión de Matrícula (SGM)</span>
                </div>
                <small className="text-muted">Proyecto de Aplicación Web con React y MySQL &bull; Gestión académica integral</small>
              </div>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
