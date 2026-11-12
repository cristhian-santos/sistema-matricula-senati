const crypto = require('node:crypto');
const pool = require('../config/db');

const cookieName = 'sgm_session';
const sessionDurationMs = 8 * 60 * 60 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function readCookie(req, name) {
  const cookies = req.headers.cookie?.split(';') || [];
  const cookie = cookies.find((item) => item.trim().startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(name.length + 1)) : null;
}

function setSessionCookie(res, token) {
  const options = [
    `${cookieName}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${Math.floor(sessionDurationMs / 1000)}`
  ];
  if (process.env.NODE_ENV === 'production') options.push('Secure');
  res.setHeader('Set-Cookie', options.join('; '));
}

function clearSessionCookie(res) {
  const options = [`${cookieName}=`, 'HttpOnly', 'Path=/', 'SameSite=Strict', 'Max-Age=0'];
  if (process.env.NODE_ENV === 'production') options.push('Secure');
  res.setHeader('Set-Cookie', options.join('; '));
}

async function createSession(connection, userId, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await connection.query(
    'INSERT INTO sesiones_usuario (id_usuario,token_hash,expira_en) VALUES (?,?,?)',
    [userId, hashToken(token), expiresAt]
  );
  setSessionCookie(res, token);
}

async function requireAuth(req, res, next) {
  try {
    const token = readCookie(req, cookieName);
    if (!token) return res.status(401).json({ success: false, message: 'Inicia sesión para continuar.' });

    const [rows] = await pool.query(
      `SELECT u.id_usuario,u.usuario,u.email,u.id_docente,u.estado,u.debe_cambiar_password,
              s.id_sesion
       FROM sesiones_usuario s
       JOIN usuarios u ON u.id_usuario=s.id_usuario
       WHERE s.token_hash=? AND s.expira_en>NOW() AND u.estado='Activo'
       LIMIT 1`,
      [hashToken(token)]
    );
    if (!rows.length) {
      clearSessionCookie(res);
      return res.status(401).json({ success: false, message: 'La sesión expiró o la cuenta está inactiva.' });
    }

    const [roles] = await pool.query(
      `SELECT r.nombre FROM usuario_roles ur
       JOIN roles r ON r.id_rol=ur.id_rol WHERE ur.id_usuario=?`,
      [rows[0].id_usuario]
    );
    const roleNames = roles.map((role) => role.nombre);
    if (roleNames.includes('Docente') && rows[0].id_docente) {
      const [[teacher]] = await pool.query('SELECT estado FROM docentes WHERE id_docente=?', [rows[0].id_docente]);
      if (!teacher || teacher.estado !== 'Activo') {
        await pool.query('DELETE FROM sesiones_usuario WHERE id_sesion=?', [rows[0].id_sesion]);
        clearSessionCookie(res);
        return res.status(403).json({ success: false, message: 'El perfil docente está inactivo.' });
      }
    }
    let studentId = null;
    if (roleNames.includes('Estudiante')) {
      const [[student]] = await pool.query(
        `SELECT ec.id_estudiante,e.estado FROM estudiante_cuentas ec
         JOIN estudiantes e ON e.id_estudiante=ec.id_estudiante WHERE ec.id_usuario=?`,
        [rows[0].id_usuario]
      );
      if (!student || student.estado !== 'Activo') {
        await pool.query('DELETE FROM sesiones_usuario WHERE id_sesion=?', [rows[0].id_sesion]);
        clearSessionCookie(res);
        return res.status(403).json({ success: false, message: 'El perfil de estudiante está inactivo o no vinculado.' });
      }
      studentId = student.id_estudiante;
    }
    req.auth = {
      id: rows[0].id_usuario,
      username: rows[0].usuario,
      email: rows[0].email,
      id_docente: rows[0].id_docente,
      id_estudiante: studentId,
      roles: roleNames,
      mustChangePassword: Boolean(rows[0].debe_cambiar_password),
      sessionId: rows[0].id_sesion
    };
    if (req.auth.mustChangePassword && !['/me', '/logout', '/cambiar-password'].includes(req.path)) {
      return res.status(403).json({ success: false, message: 'Debes cambiar tu contraseña antes de continuar.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !req.auth.roles.some((role) => allowedRoles.includes(role))) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para esta operación.' });
    }
    return next();
  };
}

function requireTeacher(req, res, next) {
  if (!req.auth?.roles.includes('Docente') || !req.auth.id_docente) {
    return res.status(403).json({ success: false, message: 'Esta función es exclusiva para cuentas docentes vinculadas.' });
  }
  return next();
}

module.exports = {
  authorize,
  clearSessionCookie,
  createSession,
  hashToken,
  readCookie,
  requireAuth,
  requireTeacher
};
