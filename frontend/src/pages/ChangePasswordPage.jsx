import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (nueva !== confirmacion) return setError('La confirmación no coincide.');
    setBusy(true);
    try {
      await api.post('/auth/cambiar-password', { actual, nueva });
      await refresh();
      setMessage('Contraseña actualizada.');
      navigate(user?.roles.includes('Docente') ? '/docente' : user?.roles.includes('Estudiante') ? '/mis-pagos' : '/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cambiar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="container py-5" style={{ maxWidth: 560 }}><div className="card"><div className="card-body p-4">
    <h1 className="h3 fw-bold">Cambiar contraseña</h1><p className="text-muted">Usa al menos 12 caracteres. Las contraseñas no se envían ni guardan en texto plano.</p>
    {message && <div className="alert alert-success">{message}</div>}{error && <div className="alert alert-danger">{error}</div>}
    <form onSubmit={submit}>
      <label className="form-label" htmlFor="current-password">Contraseña actual o temporal</label><input id="current-password" className="form-control mb-3" type="password" autoComplete="current-password" value={actual} onChange={(event) => setActual(event.target.value)} required />
      <label className="form-label" htmlFor="new-password">Nueva contraseña</label><input id="new-password" className="form-control mb-3" type="password" autoComplete="new-password" minLength={12} value={nueva} onChange={(event) => setNueva(event.target.value)} required />
      <label className="form-label" htmlFor="confirm-password">Confirmar nueva contraseña</label><input id="confirm-password" className="form-control mb-4" type="password" autoComplete="new-password" minLength={12} value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} required />
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando...' : 'Actualizar contraseña'}</button>
    </form>
  </div></div></div>;
}
