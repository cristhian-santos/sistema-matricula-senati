import React, { useEffect, useState } from 'react';
import api from '../services/api';

const blankForm = { usuario: '', email: '', password: '', rol: 'Docente', id_docente: '', id_estudiante: '' };

export default function UserAccountsPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [usersResult, rolesResult, teachersResult, studentsResult] = await Promise.all([
      api.get('/auth/usuarios'), api.get('/auth/roles'), api.get('/auth/docentes-disponibles'), api.get('/auth/estudiantes-disponibles')
    ]);
    setUsers(usersResult.data.data);
    setRoles(rolesResult.data.data);
    setTeachers(teachersResult.data.data);
    setStudents(studentsResult.data.data);
  };

  useEffect(() => { load().catch((requestError) => setError(requestError.response?.data?.message || 'No se pudieron cargar las cuentas.')); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.post('/auth/usuarios', {
        ...form,
        id_docente: form.id_docente || null,
        id_estudiante: form.id_estudiante || null
      });
      setForm(blankForm);
      setMessage('Cuenta creada. Comparte las credenciales por un canal seguro y pide al usuario que cambie su contraseña.');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo crear la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (user) => {
    const estado = user.estado === 'Activo' ? 'Inactivo' : 'Activo';
    if (!window.confirm(`¿${estado === 'Inactivo' ? 'Desactivar' : 'Activar'} la cuenta ${user.usuario}?`)) return;
    try {
      await api.patch(`/auth/usuarios/${user.id_usuario}/estado`, { estado });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cambiar el estado.');
    }
  };

  const resetPassword = async (user) => {
    if (!window.confirm(`Se cerrarán las sesiones de ${user.usuario} y se generará una contraseña temporal. ¿Continuar?`)) return;
    try {
      const { data } = await api.post(`/auth/usuarios/${user.id_usuario}/restablecer-password`);
      setMessage(`Contraseña temporal de ${user.usuario}: ${data.data.password_temporal}. Se muestra una sola vez; entrégala por un canal seguro.`);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo restablecer la contraseña.');
    }
  };

  return <div className="container py-4">
    <div className="mb-4"><div className="small text-info fw-bold">ADMINISTRACIÓN</div><h1 className="h2 fw-bold">Cuentas y accesos</h1><p className="text-muted">Administra roles y cuentas. Las contraseñas se almacenan con bcrypt.</p></div>
    {error && <div className="alert alert-danger">{error}</div>}{message && <div className="alert alert-info user-select-all">{message}</div>}
    <div className="card mb-4"><div className="card-header fw-bold">Crear cuenta</div><div className="card-body">
      <form onSubmit={submit} className="row g-3">
        <div className="col-md-4"><label className="form-label" htmlFor="new-username">Usuario</label><input id="new-username" className="form-control" minLength={3} value={form.usuario} onChange={(event) => setForm({ ...form, usuario: event.target.value })} required /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="new-email">Correo</label><input id="new-email" type="email" className="form-control" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="new-role">Rol</label><select id="new-role" className="form-select" value={form.rol} onChange={(event) => setForm({ ...form, rol: event.target.value, id_docente: '', id_estudiante: '' })}>{roles.map((role) => <option key={role.id_rol} value={role.nombre}>{role.nombre}</option>)}</select></div>
        {form.rol === 'Docente' && <div className="col-md-6"><label className="form-label" htmlFor="teacher-link">Docente sin cuenta</label><select id="teacher-link" className="form-select" value={form.id_docente} onChange={(event) => setForm({ ...form, id_docente: event.target.value })} required><option value="">Selecciona un docente</option>{teachers.map((teacher) => <option key={teacher.id_docente} value={teacher.id_docente}>{teacher.codigo_docente} · {teacher.apellidos}, {teacher.nombres}</option>)}</select></div>}
        {form.rol === 'Estudiante' && <div className="col-md-6"><label className="form-label" htmlFor="student-link">Estudiante sin cuenta</label><select id="student-link" className="form-select" value={form.id_estudiante} onChange={(event) => setForm({ ...form, id_estudiante: event.target.value })} required><option value="">Selecciona un estudiante</option>{students.map((student) => <option key={student.id_estudiante} value={student.id_estudiante}>{student.dni} · {student.apellidos}, {student.nombres}</option>)}</select></div>}
        <div className="col-md-6"><label className="form-label" htmlFor="initial-password">Contraseña inicial (mín. 12)</label><input id="initial-password" type="password" autoComplete="new-password" className="form-control" minLength={12} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></div>
        <div className="col-12"><button className="btn btn-primary" disabled={busy}>{busy ? 'Creando...' : 'Crear cuenta'}</button></div>
      </form>
    </div></div>
    <div className="card"><div className="card-header fw-bold">Usuarios registrados</div><div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr><th>Usuario</th><th>Correo</th><th>Rol(es)</th><th>Docente</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      {users.map((user) => <tr key={user.id_usuario}><td>{user.usuario}</td><td>{user.email}</td><td>{user.roles || '—'}</td><td>{user.codigo_docente || user.estudiante || '—'}</td><td><span className={`badge ${user.estado === 'Activo' ? 'bg-success' : 'bg-secondary'}`}>{user.estado}</span>{user.debe_cambiar_password ? <div className="small text-warning">Debe actualizar contraseña</div> : null}</td><td className="text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => resetPassword(user)}>Restablecer clave</button><button className="btn btn-sm btn-outline-secondary" onClick={() => setStatus(user)}>{user.estado === 'Activo' ? 'Desactivar' : 'Activar'}</button></td></tr>)}
      {!users.length && <tr><td colSpan="6" className="text-center text-muted py-4">No hay cuentas.</td></tr>}
    </tbody></table></div></div>
  </div>;
}
