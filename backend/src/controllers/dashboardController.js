const pool = require('../config/db');

// Obtener resumen estadístico para el dashboard
const getDashboardStats = async (req, res, next) => {
  try {
    const [[estudiantes]] = await pool.query('SELECT COUNT(*) AS total FROM estudiantes');
    const [[cursos]] = await pool.query('SELECT COUNT(*) AS total FROM cursos');
    const [[matriculas]] = await pool.query("SELECT COUNT(*) AS total FROM matriculas WHERE estado = 'Matriculado'");
    
    const [matriculasPorCurso] = await pool.query(`
      SELECT 
        c.id_curso,
        c.codigo,
        c.nombre,
        c.vacantes_maximas,
        COUNT(CASE WHEN m.estado = 'Matriculado' THEN 1 END) AS inscritos
      FROM cursos c
      LEFT JOIN matriculas m ON c.id_curso = m.id_curso
      GROUP BY c.id_curso
      ORDER BY inscritos DESC
    `);

    res.json({
      success: true,
      data: {
        totalEstudiantes: estudiantes.total,
        totalCursos: cursos.total,
        totalMatriculasActivas: matriculas.total,
        matriculasPorCurso
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats
};

