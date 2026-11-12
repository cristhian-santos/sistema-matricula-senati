const pool = require('../config/db');

// Listar todos los estudiantes
const getEstudiantes = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM estudiantes ORDER BY id_estudiante DESC');
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// Obtener un estudiante por ID
const getEstudianteById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM estudiantes WHERE id_estudiante = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado.'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Registrar nuevo estudiante
const createEstudiante = async (req, res, next) => {
  try {
    const { dni, nombres, apellidos, email, telefono, direccion, estado } = req.body;

    // Validación de campos obligatorios
    if (!dni || !nombres || !apellidos || !email) {
      return res.status(400).json({
        success: false,
        message: 'DNI, Nombres, Apellidos y Email son campos obligatorios.'
      });
    }

    // Validación de formato DNI (8 dígitos peruanos)
    if (!/^\d{8}$/.test(dni.trim())) {
      return res.status(400).json({
        success: false,
        message: 'El DNI debe contener exactamente 8 dígitos numéricos.'
      });
    }

    // Validación básica de formato de correo
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrónico no tiene un formato válido.'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO estudiantes (dni, nombres, apellidos, email, telefono, direccion, estado) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dni.trim(), nombres.trim(), apellidos.trim(), email.trim().toLowerCase(), telefono?.trim() || null, direccion?.trim() || null, estado || 'Activo']
    );

    res.status(201).json({
      success: true,
      message: 'Estudiante registrado correctamente.',
      data: {
        id_estudiante: result.insertId,
        dni,
        nombres,
        apellidos,
        email,
        telefono,
        direccion,
        estado: estado || 'Activo'
      }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar datos de un estudiante
const updateEstudiante = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dni, nombres, apellidos, email, telefono, direccion, estado } = req.body;

    if (!dni || !nombres || !apellidos || !email) {
      return res.status(400).json({
        success: false,
        message: 'DNI, Nombres, Apellidos y Email son campos obligatorios.'
      });
    }

    if (!/^\d{8}$/.test(dni.trim())) {
      return res.status(400).json({
        success: false,
        message: 'El DNI debe contener exactamente 8 dígitos numéricos.'
      });
    }

    const [check] = await pool.query('SELECT id_estudiante FROM estudiantes WHERE id_estudiante = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado.'
      });
    }

    await pool.query(
      `UPDATE estudiantes 
       SET dni = ?, nombres = ?, apellidos = ?, email = ?, telefono = ?, direccion = ?, estado = ? 
       WHERE id_estudiante = ?`,
      [dni.trim(), nombres.trim(), apellidos.trim(), email.trim().toLowerCase(), telefono?.trim() || null, direccion?.trim() || null, estado || 'Activo', id]
    );

    res.json({
      success: true,
      message: 'Estudiante actualizado con éxito.'
    });
  } catch (error) {
    next(error);
  }
};

// Eliminar estudiante
const deleteEstudiante = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [check] = await pool.query('SELECT id_estudiante FROM estudiantes WHERE id_estudiante = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Estudiante no encontrado.'
      });
    }

    await pool.query('DELETE FROM estudiantes WHERE id_estudiante = ?', [id]);

    res.json({
      success: true,
      message: 'Estudiante eliminado satisfactoriamente.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getEstudiantes,
  getEstudianteById,
  createEstudiante,
  updateEstudiante,
  deleteEstudiante
};

