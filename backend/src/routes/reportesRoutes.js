const express = require('express');
const pool = require('../config/db');
const router = express.Router();
router.get('/resumen',async(req,res,next)=>{
  try{
    const [periodos]=await pool.query(`SELECT periodo,COUNT(*) AS inscripciones, COUNT(DISTINCT id_estudiante) AS estudiantes FROM matriculas WHERE estado='Matriculado' GROUP BY periodo ORDER BY periodo DESC`);
    const [carreras]=await pool.query('SELECT c.codigo,c.nombre,COUNT(DISTINCT p.id_plan) AS planes FROM carreras c LEFT JOIN planes_estudio p ON p.id_carrera=c.id_carrera GROUP BY c.id_carrera ORDER BY c.nombre');
    const [secciones]=await pool.query(`SELECT p.codigo AS periodo,c.codigo AS curso,s.codigo AS seccion,s.turno,s.capacidad,COUNT(m.id_matricula) AS inscritos,GREATEST(s.capacidad-COUNT(m.id_matricula),0) AS vacantes FROM secciones s JOIN periodos_academicos p ON p.id_periodo=s.id_periodo JOIN cursos c ON c.id_curso=s.id_curso LEFT JOIN matriculas m ON m.id_seccion=s.id_seccion AND m.estado='Matriculado' GROUP BY s.id_seccion ORDER BY p.codigo DESC,c.codigo,s.codigo`);
    res.json({success:true,data:{periodos,carreras,secciones}});
  }catch(e){next(e);}
});
router.get('/horario-estudiante/:id',async(req,res,next)=>{
 try{
   const [rows]=await pool.query(`SELECT m.periodo,c.nombre AS curso,s.codigo AS seccion,h.dia_semana,h.hora_inicio,h.hora_fin,a.nombre AS aula FROM matriculas m JOIN cursos c ON c.id_curso=m.id_curso JOIN secciones s ON s.id_seccion=m.id_seccion JOIN seccion_horarios h ON h.id_seccion=s.id_seccion JOIN aulas a ON a.id_aula=h.id_aula WHERE m.id_estudiante=? AND m.estado='Matriculado' ORDER BY m.periodo,h.dia_semana,h.hora_inicio`,[req.params.id]);res.json({success:true,data:rows});
 }catch(e){next(e);}
});
module.exports=router;
