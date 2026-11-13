import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="container py-5 text-center">Verificando sesión...</div>;
  if (user) return <Navigate to={user.debe_cambiar_password ? '/cambiar-password' : user.roles.includes('Docente') ? '/docente' : user.roles.includes('Estudiante') ? '/mis-pagos' : '/'} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const loggedUser = await login(usuario, password);
      navigate(loggedUser?.debe_cambiar_password ? '/cambiar-password' : loggedUser?.roles.includes('Docente') ? '/docente' : loggedUser?.roles.includes('Estudiante') ? '/mis-pagos' : '/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="container py-5" style={{ maxWidth: 520 }}>
    <div className="card shadow-sm"><div className="card-body p-4 p-md-5">
      <div className="text-center mb-4"><i className="bi bi-mortarboard-fill text-primary fs-1" /><h1 className="h3 fw-bold mt-2">Acceso al sistema</h1><p className="text-muted mb-0">Inicia sesión con tu cuenta institucional.</p></div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <label className="form-label fw-semibold" htmlFor="login-user">Usuario o correo</label>
        <input id="login-user" className="form-control mb-3" autoComplete="username" value={usuario} onChange={(event) => setUsuario(event.target.value)} required />
        <label className="form-label fw-semibold" htmlFor="login-password">Contraseña</label>
        <input id="login-password" className="form-control mb-4" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Ingresando...' : 'Iniciar sesión'}</button>
      </form>
      <div className="text-center small text-muted mt-3">¿Solo consultas el portal? <Link to="/">Volver al inicio</Link></div>
    </div></div>
  </div>;
}
