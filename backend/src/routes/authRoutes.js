const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authorize, clearSessionCookie, createSession, hashToken, requireAuth } = require('../middlewares/auth');

const router = express.Router();
const passwordValid = (password) => typeof password === 'string' && password.length >= 12 && password.length <= 128;
const invalidCredentials = { success: false, message: 'Usuario o contraseña incorrectos.' };
const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

router.post('/login', async (req, res, next) => {
  const username = String(req.body.usuario || '').trim().toLowerCase();
  const password = req.body.password;
  if (!username || username.length > 80 || typeof password !== 'string' || password.length > 128) {
    return res.status(401).json(invalidCredentials);
  }
  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    const [[attempt]] = await connection.query(
      'SELECT intentos,(bloqueado_hasta>NOW()) AS is_blocked FROM intentos_login WHERE usuario=? FOR UPDATE',
      [username]
    );
    if (Number(attempt?.is_blocked)) {
      await connection.rollback();
      return res.status(429).json({ success: false, message: 'Demasiados intentos. Prueba nuevamente en 15 minutos.' });
    }

    const [[user]] = await connection.query(
      `SELECT u.id_usuario,u.password_hash,u.estado
       FROM usuarios u WHERE LOWER(u.usuario)=? OR LOWER(u.email)=?
       ORDER BY (LOWER(u.usuario)=?) DESC LIMIT 1`,
      [username, username, username]
    );
    const passwordMatches = await bcrypt.compare(password, user?.password_hash || dummyPasswordHash);
    const matches = Boolean(user && user.estado === 'Activo' && passwordMatches);
    if (!matches) {
      await connection.query(
        `INSERT INTO intentos_login (usuario,intentos,bloqueado_hasta) VALUES (?,1,NULL)
         ON DUPLICATE KEY UPDATE
           intentos=IF(bloqueado_hasta IS NOT NULL AND bloqueado_hasta<=NOW(),1,intentos+1),
           bloqueado_hasta=IF(intentos>=4,DATE_ADD(NOW(),INTERVAL 15 MINUTE),NULL)`,
        [username]
      );
      await connection.commit();
      return res.status(401).json(invalidCredentials);
    }

    await connection.query('DELETE FROM intentos_login WHERE usuario=?', [username]);
    await createSession(connection, user.id_usuario, res);
    await connection.commit();
    return res.json({ success: true, message: 'Sesión iniciada.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = require('../middlewares/auth').readCookie(req, 'sgm_session');
    if (token) await pool.query('DELETE FROM sesiones_usuario WHERE token_hash=?', [hashToken(token)]);
    clearSessionCookie(res);
    return res.json({ success: true, message: 'Sesión cerrada.' });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.nombres,d.apellidos,d.codigo_docente
       FROM docentes d WHERE d.id_docente=?`,
      [req.auth.id_docente || 0]
    );
    return res.json({
      success: true,
      data: {
        id: req.auth.id,
        usuario: req.auth.username,
        email: req.auth.email,
        roles: req.auth.roles,
        id_docente: req.auth.id_docente,
        docente: rows[0] || null,
        debe_cambiar_password: req.auth.mustChangePassword
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/cambiar-password', requireAuth, async (req, res, next) => {
  const { actual, nueva } = req.body;
  if (!passwordValid(nueva)) return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener entre 12 y 128 caracteres.' });
  try {
    const [[user]] = await pool.query('SELECT password_hash FROM usuarios WHERE id_usuario=?', [req.auth.id]);
    if (!user || !(await bcrypt.compare(String(actual || ''), user.password_hash))) {
      return res.status(400).json({ success: false, message: 'La contraseña actual no es correcta.' });
    }
    const passwordHash = await bcrypt.hash(nueva, 12);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE usuarios SET password_hash=?,debe_cambiar_password=0 WHERE id_usuario=?', [passwordHash, req.auth.id]);
      await connection.query('DELETE FROM sesiones_usuario WHERE id_usuario=?', [req.auth.id]);
      await createSession(connection, req.auth.id, res);
      await connection.commit();
      return res.json({ success: true, message: 'Contraseña actualizada.' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return next(error);
  }
});

router.get('/roles', requireAuth, authorize('Administrador'), async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id_rol,nombre,descripcion FROM roles ORDER BY nombre');
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/usuarios', requireAuth, authorize('Administrador'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id_usuario,u.usuario,u.email,u.id_docente,u.estado,u.debe_cambiar_password,
              d.codigo_docente,CONCAT(d.nombres,' ',d.apellidos) AS docente,
              ec.id_estudiante,CONCAT(e.apellidos,', ',e.nombres) AS estudiante,
              GROUP_CONCAT(r.nombre ORDER BY r.nombre SEPARATOR ', ') AS roles
       FROM usuarios u
       LEFT JOIN docentes d ON d.id_docente=u.id_docente
       LEFT JOIN estudiante_cuentas ec ON ec.id_usuario=u.id_usuario
       LEFT JOIN estudiantes e ON e.id_estudiante=ec.id_estudiante
       LEFT JOIN usuario_roles ur ON ur.id_usuario=u.id_usuario
       LEFT JOIN roles r ON r.id_rol=ur.id_rol
       GROUP BY u.id_usuario,d.codigo_docente,d.nombres,d.apellidos,
                ec.id_estudiante,e.apellidos,e.nombres
       ORDER BY u.id_usuario DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/docentes-disponibles', requireAuth, authorize('Administrador'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.id_docente,d.codigo_docente,d.nombres,d.apellidos,d.email
       FROM docentes d LEFT JOIN usuarios u ON u.id_docente=d.id_docente
       WHERE d.estado='Activo' AND u.id_usuario IS NULL ORDER BY d.apellidos,d.nombres`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/estudiantes-disponibles', requireAuth, authorize('Administrador'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.id_estudiante,e.dni,e.nombres,e.apellidos,e.email
       FROM estudiantes e LEFT JOIN estudiante_cuentas ec ON ec.id_estudiante=e.id_estudiante
       WHERE e.estado='Activo' AND ec.id_estudiante IS NULL ORDER BY e.apellidos,e.nombres`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/usuarios', requireAuth, authorize('Administrador'), async (req, res, next) => {
  const { usuario, email, password, rol, id_docente, id_estudiante } = req.body;
  const username = String(usuario || '').trim().toLowerCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,80}$/.test(username)) return res.status(400).json({ success: false, message: 'Usuario inválido.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ success: false, message: 'Correo inválido.' });
  if (!passwordValid(password)) return res.status(400).json({ success: false, message: 'La contraseña debe tener entre 12 y 128 caracteres.' });
  if (!['Administrador','Secretaría','Docente','Estudiante'].includes(rol)) return res.status(400).json({ success: false, message: 'Rol inválido.' });
  if (rol === 'Docente' && !id_docente) return res.status(400).json({ success: false, message: 'Vincula la cuenta a un docente.' });
  if (rol === 'Estudiante' && !id_estudiante) return res.status(400).json({ success: false, message: 'Vincula la cuenta a un estudiante.' });
  if (rol !== 'Docente' && id_docente) return res.status(400).json({ success: false, message: 'Solo las cuentas Docente pueden vincularse a un docente.' });
  if (rol !== 'Estudiante' && id_estudiante) return res.status(400).json({ success: false, message: 'Solo las cuentas Estudiante pueden vincularse a un estudiante.' });

  const connection = await pool.getConnection().catch(next);
  if (!connection) return;
  try {
    await connection.beginTransaction();
    if (rol === 'Docente') {
      const [[teacher]] = await connection.query('SELECT id_docente,estado,codigo_docente,email FROM docentes WHERE id_docente=? FOR UPDATE', [id_docente]);
      if (!teacher || teacher.estado !== 'Activo') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'El docente no existe o está inactivo.' });
      }
      if (normalizedEmail !== teacher.email.toLowerCase()) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'El correo electrónico no coincide con el registrado para el docente.' });
      }
    }
    if (rol === 'Estudiante') {
      const [[student]] = await connection.query('SELECT id_estudiante,estado,email FROM estudiantes WHERE id_estudiante=? FOR UPDATE', [id_estudiante]);
      if (!student || student.estado !== 'Activo') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'El estudiante no existe o está inactivo.' });
      }
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const [created] = await connection.query(
      'INSERT INTO usuarios (id_docente,usuario,email,password_hash,debe_cambiar_password) VALUES (?,?,?,?,1)',
      [rol === 'Docente' ? id_docente : null, username, normalizedEmail, passwordHash]
    );
    const [roleLink] = await connection.query(
      'INSERT INTO usuario_roles (id_usuario,id_rol) SELECT ?,id_rol FROM roles WHERE nombre=?',
      [created.insertId, rol]
    );
    if (roleLink.affectedRows !== 1) throw Object.assign(new Error('El rol no existe en la base de datos.'), { statusCode: 500 });
    if (rol === 'Estudiante') {
      await connection.query('INSERT INTO estudiante_cuentas (id_usuario,id_estudiante) VALUES (?,?)', [created.insertId, id_estudiante]);
    }
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Cuenta creada.' });
  } catch (error) {
    await connection.rollback();
    return next(error);
  } finally {
    connection.release();
  }
});

router.patch('/usuarios/:id/estado', requireAuth, authorize('Administrador'), async (req, res, next) => {
  const { estado } = req.body;
  if (!['Activo','Inactivo'].includes(estado)) return res.status(400).json({ success: false, message: 'Estado inválido.' });
  try {
    if (Number(req.params.id) === req.auth.id && estado === 'Inactivo') {
      return res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta.' });
    }
    const [[user]] = await pool.query('SELECT id_usuario FROM usuarios WHERE id_usuario=?', [req.params.id]);
    if (!user) return res.status(404).json({ success: false, message: 'Cuenta no encontrada.' });
    if (estado === 'Inactivo') {
      const [[admin]] = await pool.query(
        `SELECT COUNT(*) AS total FROM usuarios u
         JOIN usuario_roles ur ON ur.id_usuario=u.id_usuario
         JOIN roles r ON r.id_rol=ur.id_rol
         WHERE r.nombre='Administrador' AND u.estado='Activo'`
      );
      const [[target]] = await pool.query(
        `SELECT COUNT(*) AS is_admin FROM usuario_roles ur
         JOIN roles r ON r.id_rol=ur.id_rol
         WHERE ur.id_usuario=? AND r.nombre='Administrador'`,
        [req.params.id]
      );
      if (Number(target.is_admin) && Number(admin.total) <= 1) {
        return res.status(409).json({ success: false, message: 'No puedes desactivar el último administrador activo.' });
      }
    }
    await pool.query('UPDATE usuarios SET estado=? WHERE id_usuario=?', [estado, req.params.id]);
    if (estado === 'Inactivo') await pool.query('DELETE FROM sesiones_usuario WHERE id_usuario=?', [req.params.id]);
    return res.json({ success: true, message: 'Estado actualizado.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/usuarios/:id/restablecer-password', requireAuth, authorize('Administrador'), async (req, res, next) => {
  try {
    const [[user]] = await pool.query('SELECT id_usuario FROM usuarios WHERE id_usuario=?', [req.params.id]);
    if (!user) return res.status(404).json({ success: false, message: 'Cuenta no encontrada.' });
    const temporaryPassword = crypto.randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('UPDATE usuarios SET password_hash=?,debe_cambiar_password=1 WHERE id_usuario=?', [passwordHash, req.params.id]);
      await connection.query('DELETE FROM sesiones_usuario WHERE id_usuario=?', [req.params.id]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return res.json({ success: true, data: { password_temporal: temporaryPassword }, message: 'La clave se muestra una sola vez; entrégala al usuario por un canal seguro.' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
