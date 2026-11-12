const pool = require('../config/db');

// Listar todos los cursos
const getCursos = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.*,
        COUNT(CASE WHEN m.estado = 'Matriculado' THEN 1 END) AS total_matriculados,
        (c.vacantes_maximas - COUNT(CASE WHEN m.estado = 'Matriculado' THEN 1 END)) AS vacantes_disponibles
      FROM cursos c
      LEFT JOIN matriculas m ON c.id_curso = m.id_curso
      GROUP BY c.id_curso
      ORDER BY c.id_curso DESC
    `);
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// Obtener curso por ID
const getCursoById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM cursos WHERE id_curso = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado.'
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

// Registrar nuevo curso
const createCurso = async (req, res, next) => {
  try {
    const { codigo, nombre, creditos, horas, vacantes_maximas, estado } = req.body;

    if (!codigo || !nombre || !creditos || !horas || !vacantes_maximas) {
      return res.status(400).json({
        success: false,
        message: 'Código, Nombre, Créditos, Horas y Vacantes son campos requeridos.'
      });
    }

    if (Number(creditos) <= 0 || Number(horas) <= 0 || Number(vacantes_maximas) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Créditos, Horas y Vacantes deben ser números enteros mayores a cero.'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO cursos (codigo, nombre, creditos, horas, vacantes_maximas, estado) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [codigo.trim().toUpperCase(), nombre.trim(), Number(creditos), Number(horas), Number(vacantes_maximas), estado || 'Activo']
    );

    res.status(201).json({
      success: true,
      message: 'Curso registrado exitosamente.',
      data: {
        id_curso: result.insertId,
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        creditos,
        horas,
        vacantes_maximas,
        estado: estado || 'Activo'
      }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar curso
const updateCurso = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, creditos, horas, vacantes_maximas, estado } = req.body;

    if (!codigo || !nombre || !creditos || !horas || !vacantes_maximas) {
      return res.status(400).json({
        success: false,
        message: 'Código, Nombre, Créditos, Horas y Vacantes son campos requeridos.'
      });
    }

    if (Number(creditos) <= 0 || Number(horas) <= 0 || Number(vacantes_maximas) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Créditos, Horas y Vacantes deben ser mayores a cero.'
      });
    }

    const [check] = await pool.query('SELECT id_curso FROM cursos WHERE id_curso = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado.'
      });
    }

    await pool.query(
      `UPDATE cursos 
       SET codigo = ?, nombre = ?, creditos = ?, horas = ?, vacantes_maximas = ?, estado = ? 
       WHERE id_curso = ?`,
      [codigo.trim().toUpperCase(), nombre.trim(), Number(creditos), Number(horas), Number(vacantes_maximas), estado || 'Activo', id]
    );

    res.json({
      success: true,
      message: 'Curso actualizado correctamente.'
    });
  } catch (error) {
    next(error);
  }
};

// Eliminar curso
const deleteCurso = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [check] = await pool.query('SELECT id_curso FROM cursos WHERE id_curso = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Curso no encontrado.'
      });
    }

    await pool.query('DELETE FROM cursos WHERE id_curso = ?', [id]);

    res.json({
      success: true,
      message: 'Curso eliminado satisfactoriamente.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCursos,
  getCursoById,
  createCurso,
  updateCurso,
  deleteCurso
};

