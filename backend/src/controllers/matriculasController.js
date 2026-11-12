const pool = require('../config/db');
const { checkCourseEligibility } = require('../services/mallaAcademica');

// Listar todas las matrículas con datos relacionados (INNER JOIN)
const getMatriculas = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        m.id_matricula,
        m.id_estudiante,
        m.id_curso,
        m.periodo,
        DATE_FORMAT(m.fecha_matricula, '%Y-%m-%d') AS fecha_matricula,
        m.estado AS estado_matricula,
        m.observaciones,
        m.fecha_registro,
        m.id_seccion,
        s.codigo AS seccion_codigo,
        e.dni AS dni_estudiante,
        CONCAT(e.apellidos, ', ', e.nombres) AS estudiante_nombre,
        e.email AS email_estudiante,
        c.codigo AS curso_codigo,
        c.nombre AS curso_nombre,
        c.creditos AS curso_creditos
      FROM matriculas m
      INNER JOIN estudiantes e ON m.id_estudiante = e.id_estudiante
      INNER JOIN cursos c ON m.id_curso = c.id_curso
      LEFT JOIN secciones s ON s.id_seccion = m.id_seccion
      ORDER BY m.id_matricula DESC
    `;

    const [rows] = await pool.query(query);
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// Obtener una matrícula por ID
const getMatriculaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        m.*,
        DATE_FORMAT(m.fecha_matricula, '%Y-%m-%d') AS fecha_matricula_formateada,
        e.dni AS dni_estudiante,
        CONCAT(e.apellidos, ', ', e.nombres) AS estudiante_nombre,
        c.codigo AS curso_codigo,
        c.nombre AS curso_nombre
      FROM matriculas m
      INNER JOIN estudiantes e ON m.id_estudiante = e.id_estudiante
      INNER JOIN cursos c ON m.id_curso = c.id_curso
      WHERE m.id_matricula = ?
    `;

    const [rows] = await pool.query(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro de matrícula no encontrado.'
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

// Registrar una nueva matrícula
const createMatricula = async (req, res, next) => {
  const { id_estudiante, id_curso, periodo, fecha_matricula, estado, observaciones, id_seccion } = req.body;
  if (!id_estudiante || !id_curso || !periodo || !fecha_matricula) {
    return res.status(400).json({success:false,message:'Estudiante, curso, periodo y fecha son obligatorios.'});
  }
  const conn = await pool.getConnection().catch(next);
  if (!conn) return;
  try {
    await conn.beginTransaction();
    const [[student]] = await conn.query('SELECT estado FROM estudiantes WHERE id_estudiante=? FOR UPDATE',[id_estudiante]);
    const [[course]] = await conn.query('SELECT estado,vacantes_maximas FROM cursos WHERE id_curso=? FOR UPDATE',[id_curso]);
    if (!student || student.estado!=='Activo') {const e=new Error('El estudiante debe estar activo.');e.statusCode=400;throw e;}
    if (!course || course.estado!=='Activo') {const e=new Error('El curso debe estar activo.');e.statusCode=400;throw e;}
    if ((estado || 'Matriculado') === 'Matriculado') {
      const eligibility = await checkCourseEligibility(conn, id_estudiante, id_curso);
      if (!eligibility.allowed) {
        const missing = eligibility.missing.map((item) => item.nombre).join(', ');
        const e = new Error(`${eligibility.reason}${missing ? ` Pendientes: ${missing}.` : ''}`);
        e.statusCode = 409;
        throw e;
      }
    }
    let max=course.vacantes_maximas;
    if (id_seccion) {
      const [[section]] = await conn.query(`SELECT s.id_curso,s.capacidad,s.estado,p.codigo AS periodo_codigo,p.estado AS estado_periodo,p.inicio_matricula,p.fin_matricula
        FROM secciones s JOIN periodos_academicos p ON p.id_periodo=s.id_periodo WHERE s.id_seccion=? FOR UPDATE`,[id_seccion]);
      if(!section || Number(section.id_curso)!==Number(id_curso) || section.periodo_codigo!==periodo) {const e=new Error('Sección no corresponde al curso y periodo seleccionados.');e.statusCode=400;throw e;}
      if(section.estado!=='Abierta' || section.estado_periodo!=='Matricula abierta') {const e=new Error('La sección o su periodo no están abiertos a matrícula.');e.statusCode=400;throw e;}
      max=section.capacidad;
      const [conflicts] = await conn.query(`SELECT 1 FROM matriculas m
        JOIN seccion_horarios h1 ON h1.id_seccion=m.id_seccion
        JOIN seccion_horarios h2 ON h2.id_seccion=?
        WHERE m.id_estudiante=? AND m.periodo=? AND m.estado='Matriculado'
        AND h1.dia_semana=h2.dia_semana AND h1.hora_inicio<h2.hora_fin AND h1.hora_fin>h2.hora_inicio LIMIT 1`,[id_seccion,id_estudiante,periodo]);
      if(conflicts.length){const e=new Error('El estudiante tiene cruce de horarios.');e.statusCode=409;throw e;}
    }
    const [[count]] = await conn.query(`SELECT COUNT(*) AS total FROM matriculas WHERE ${id_seccion?'id_seccion=?':'id_curso=? AND periodo=?'} AND estado='Matriculado'`,id_seccion?[id_seccion]:[id_curso,periodo]);
    if(count.total>=max){const e=new Error('No quedan vacantes para la sección o curso en este periodo.');e.statusCode=409;throw e;}
    const [result] = await conn.query(`INSERT INTO matriculas (id_estudiante,id_curso,periodo,fecha_matricula,estado,observaciones,id_seccion) VALUES (?,?,?,?,?,?,?)`,
      [id_estudiante,id_curso,periodo,fecha_matricula,estado||'Matriculado',observaciones?.trim()||null,id_seccion||null]);
    await conn.commit();
    return res.status(201).json({success:true,message:'Matrícula registrada correctamente.',data:{id_matricula:result.insertId}});
  } catch(error){await conn.rollback();next(error);}finally{conn.release();}
};

// Actualizar matrícula
const updateMatricula = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { periodo, fecha_matricula, estado, observaciones } = req.body;

    if (!periodo || !fecha_matricula || !estado) {
      return res.status(400).json({
        success: false,
        message: 'Periodo, Fecha de matrícula y Estado son campos obligatorios.'
      });
    }

    const [check] = await pool.query('SELECT id_matricula,id_estudiante,id_curso,estado FROM matriculas WHERE id_matricula = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro de matrícula no encontrado.'
      });
    }
    if (estado === 'Matriculado' && check[0].estado !== 'Matriculado') {
      const eligibility = await checkCourseEligibility(pool, check[0].id_estudiante, check[0].id_curso);
      if (!eligibility.allowed) {
        const missing = eligibility.missing.map((item) => item.nombre).join(', ');
        return res.status(409).json({
          success: false,
          message: `${eligibility.reason}${missing ? ` Pendientes: ${missing}.` : ''}`
        });
      }
    }

    await pool.query(
      `UPDATE matriculas 
       SET periodo = ?, fecha_matricula = ?, estado = ?, observaciones = ? 
       WHERE id_matricula = ?`,
      [periodo.trim(), fecha_matricula, estado, observaciones?.trim() || null, id]
    );

    res.json({
      success: true,
      message: 'Matrícula actualizada correctamente.'
    });
  } catch (error) {
    next(error);
  }
};

// Eliminar matrícula
const deleteMatricula = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [check] = await pool.query('SELECT id_matricula FROM matriculas WHERE id_matricula = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registro de matrícula no encontrado.'
      });
    }

    await pool.query("UPDATE matriculas SET estado='Retirado' WHERE id_matricula = ?", [id]);

    res.json({
      success: true,
      message: 'Matrícula retirada; se conservó el historial.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMatriculas,
  getMatriculaById,
  createMatricula,
  updateMatricula,
  deleteMatricula
};
