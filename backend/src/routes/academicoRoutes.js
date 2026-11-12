const express = require('express');
const pool = require('../config/db');
const defs = require('../config/academico');
const { isValidTimeRange } = require('../services/horarioUtils');
const router = express.Router();
const versionedCurriculumTables = new Set(['planes_estudio','plan_cursos','curso_prerrequisitos']);
const workflowManagedTables = new Set(['evaluaciones','calificaciones','sesiones_clase','asistencias']);
const managedMessage = 'Este módulo se gestiona desde el flujo académico con auditoría y validación de sección.';
const fail = (code,message) => { const err = new Error(message); err.statusCode = code; throw err; };
const def = (table) => {
  if (!Object.prototype.hasOwnProperty.call(defs,table)) fail(404,'Módulo académico no existente');
  return defs[table];
};
const requiredCheck = (data, required) => {
 for (const field of required) if (data[field] === null || data[field] === undefined || String(data[field]).trim() === '') fail(400,`El campo ${field} es obligatorio`);
};
const validate = async (conn, table, data, excludeId = null) => {
  if (table === 'docentes' && data.dni && !/^\d{8}$/.test(String(data.dni))) fail(400,'El DNI debe contener 8 dígitos');
  if (table === 'secciones') {
    if (!Number.isInteger(Number(data.capacidad)) || Number(data.capacidad) < 1) {
      fail(400,'La capacidad de la sección debe ser un entero positivo.');
    }
    const [[course]] = await conn.query(
      'SELECT vacantes_maximas FROM cursos WHERE id_curso=? AND estado=\'Activo\'',
      [data.id_curso]
    );
    const [[period]] = await conn.query(
      'SELECT id_periodo FROM periodos_academicos WHERE id_periodo=?',
      [data.id_periodo]
    );
    if (!course || !period) fail(400,'Selecciona un curso activo y un periodo académico válido.');
    if (Number(data.capacidad) > Number(course.vacantes_maximas)) {
      fail(400,'La capacidad de la sección no puede superar las vacantes máximas del curso.');
    }
  }
  if (table === 'seccion_horarios') {
    if (!isValidTimeRange(data.hora_inicio, data.hora_fin)) fail(400,'El horario debe tener horas válidas y la hora de fin debe ser posterior al inicio.');
    const [[target]] = await conn.query(
      `SELECT s.id_seccion,s.id_periodo,s.capacidad,s.estado AS estado_seccion,
              a.id_aula,a.capacidad AS capacidad_aula,a.estado AS estado_aula
       FROM secciones s JOIN aulas a ON a.id_aula=?
       WHERE s.id_seccion=? FOR UPDATE`,
      [data.id_aula,data.id_seccion]
    );
    if (!target) fail(400,'La sección o el aula no existen.');
    if (target.estado_aula !== 'Activo') fail(400,'El aula debe estar activa.');
    if (Number(target.capacidad_aula) < Number(target.capacidad)) {
      fail(400,'El aula no tiene capacidad suficiente para esta sección.');
    }
    const [conflicts] = await conn.query(
      `SELECT h.id_horario,h.id_seccion,h.id_aula
       FROM seccion_horarios h
       JOIN secciones s ON s.id_seccion=h.id_seccion
       WHERE h.id_horario<>? AND s.id_periodo=? AND h.dia_semana=?
         AND h.hora_inicio<? AND h.hora_fin>?
         AND (h.id_aula=? OR h.id_seccion=?)`,
      [excludeId || 0,target.id_periodo,data.dia_semana,data.hora_fin,data.hora_inicio,data.id_aula,data.id_seccion]
    );
    if (conflicts.some((row) => Number(row.id_aula) === Number(data.id_aula))) {
      fail(409,'El aula ya está ocupada en ese horario y periodo.');
    }
    if (conflicts.some((row) => Number(row.id_seccion) === Number(data.id_seccion))) {
      fail(409,'La sección ya tiene otro horario que se cruza en ese periodo.');
    }

    const [assignedTeachers] = await conn.query(
      `SELECT d.id_docente,d.estado
       FROM docentes_secciones ds JOIN docentes d ON d.id_docente=ds.id_docente
       WHERE ds.id_seccion=? AND ds.estado='Activo' FOR UPDATE`,
      [data.id_seccion]
    );
    if (assignedTeachers.some((teacher) => teacher.estado !== 'Activo')) {
      fail(409,'La sección tiene asignado un docente inactivo; corrige la asignación antes de programar.');
    }
    if (assignedTeachers.length) {
      const [teacherConflicts] = await conn.query(
        `SELECT h.id_horario
         FROM seccion_horarios h
         JOIN secciones s ON s.id_seccion=h.id_seccion
         JOIN docentes_secciones ds ON ds.id_seccion=s.id_seccion AND ds.estado='Activo'
         WHERE h.id_horario<>? AND s.id_periodo=? AND h.dia_semana=?
           AND h.hora_inicio<? AND h.hora_fin>?
           AND ds.id_docente IN (?) LIMIT 1`,
        [excludeId || 0,target.id_periodo,data.dia_semana,data.hora_fin,data.hora_inicio,
          assignedTeachers.map((teacher) => teacher.id_docente)]
      );
      if (teacherConflicts.length) fail(409,'Un docente asignado ya tiene una clase simultánea en ese periodo.');
    }
  }
  if (table === 'docentes_secciones') {
    const [[teacher]] = await conn.query(
      'SELECT id_docente,estado FROM docentes WHERE id_docente=? FOR UPDATE',
      [data.id_docente]
    );
    if (!teacher || (teacher.estado !== 'Activo' && data.estado !== 'Inactivo')) {
      fail(400,'Solo se pueden asignar docentes registrados y activos.');
    }
    const [[section]] = await conn.query(
      `SELECT id_seccion,id_periodo FROM secciones WHERE id_seccion=? FOR UPDATE`,
      [data.id_seccion]
    );
    if (!section) fail(400,'La sección no existe.');
    if (data.estado !== 'Inactivo') {
      const [times] = await conn.query(
        'SELECT dia_semana,hora_inicio,hora_fin FROM seccion_horarios WHERE id_seccion=?',
        [data.id_seccion]
      );
      for (const time of times) {
        const [conflicts] = await conn.query(
          `SELECT h.id_horario
           FROM docentes_secciones ds
           JOIN seccion_horarios h ON h.id_seccion=ds.id_seccion
           JOIN secciones s ON s.id_seccion=h.id_seccion
           WHERE ds.id_docente=? AND ds.estado='Activo' AND ds.id_asignacion<>?
             AND s.id_periodo=? AND h.dia_semana=? AND h.hora_inicio<? AND h.hora_fin>? LIMIT 1`,
          [data.id_docente,excludeId || 0,section.id_periodo,time.dia_semana,time.hora_fin,time.hora_inicio]
        );
        if (conflicts.length) fail(409,'Este docente tiene un cruce de horario en el mismo periodo.');
      }
    }
  }
  if (table === 'calificaciones') {
    const [[ev]] = await conn.query('SELECT id_seccion,estado FROM evaluaciones WHERE id_evaluacion=?',[data.id_evaluacion]);
    const [[m]] = await conn.query('SELECT id_seccion FROM matriculas WHERE id_matricula=?',[data.id_matricula]);
    if(!ev || !m || ev.id_seccion!==m.id_seccion) fail(400,'La matrícula no corresponde a la evaluación de esta sección');
    if(ev.estado==='Cerrada') fail(400,'Evaluación cerrada');
  }
  if (table === 'asistencias') {
    const [[ses]] = await conn.query('SELECT id_seccion FROM sesiones_clase WHERE id_sesion=?',[data.id_sesion]);
    const [[m]] = await conn.query('SELECT id_seccion FROM matriculas WHERE id_matricula=?',[data.id_matricula]);
    if(!ses || !m || ses.id_seccion!==m.id_seccion) fail(400,'El estudiante no pertenece a esta sesión');
  }
  if(table==='curso_prerrequisitos' && Number(data.id_plan_curso)===Number(data.id_plan_curso_requisito)) fail(400,'Un curso no puede ser prerrequisito de sí mismo');
};
router.get('/horarios',async(req,res,next)=>{
 try{
  const filters=[
   ['curso','s.id_curso'],
   ['sede','a.id_sede'],
   ['periodo','s.id_periodo']
  ];
  const conditions=[];
  const values=[];
  for(const [key,column] of filters){
   if(req.query[key]===undefined||req.query[key]==='')continue;
   if(!/^\d+$/.test(String(req.query[key]))||Number(req.query[key])<1)fail(400,`El filtro ${key} no es válido.`);
   conditions.push(`${column}=?`);
   values.push(Number(req.query[key]));
  }
  if(req.query.docente!==undefined&&req.query.docente!==''){
   if(!/^\d+$/.test(String(req.query.docente))||Number(req.query.docente)<1)fail(400,'El filtro docente no es válido.');
   conditions.push(`EXISTS (
    SELECT 1 FROM docentes_secciones filtro_ds
    JOIN docentes filtro_d ON filtro_d.id_docente=filtro_ds.id_docente AND filtro_d.estado='Activo'
    WHERE filtro_ds.id_seccion=s.id_seccion AND filtro_ds.id_docente=? AND filtro_ds.estado='Activo'
   )`);
   values.push(Number(req.query.docente));
  }
  if(req.query.ciclo!==undefined&&req.query.ciclo!==''){
   if(!/^\d+$/.test(String(req.query.ciclo))||Number(req.query.ciclo)<1)fail(400,'El filtro ciclo no es válido.');
   conditions.push(`EXISTS (
    SELECT 1 FROM plan_cursos pc
    JOIN ciclos cy ON cy.id_ciclo=pc.id_ciclo
    JOIN planes_estudio p ON p.id_plan=pc.id_plan AND p.estado='Activo'
    WHERE pc.id_curso=s.id_curso AND cy.id_ciclo=?
   )`);
   values.push(Number(req.query.ciclo));
  }
  const [rows]=await pool.query(
   `SELECT h.id_horario,s.id_seccion,s.codigo AS seccion,s.turno,s.capacidad,s.estado AS estado_seccion,
           p.id_periodo,p.codigo AS periodo,c.id_curso,c.codigo AS curso_codigo,c.nombre AS curso,
           a.id_aula,a.codigo AS aula_codigo,a.nombre AS aula,a.tipo AS tipo_aula,a.capacidad AS capacidad_aula,
           sede.id_sede,sede.codigo AS sede_codigo,sede.nombre AS sede,
           h.dia_semana,TIME_FORMAT(h.hora_inicio,'%H:%i') AS hora_inicio,
           TIME_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
           GROUP_CONCAT(DISTINCT CONCAT(d.nombres,' ',d.apellidos) ORDER BY d.apellidos,d.nombres SEPARATOR ', ') AS docentes,
           COUNT(DISTINCT m.id_matricula) AS inscritos,
           GREATEST(s.capacidad-COUNT(DISTINCT m.id_matricula),0) AS vacantes_disponibles,
           GROUP_CONCAT(DISTINCT CASE WHEN pl.id_plan IS NOT NULL THEN CONCAT('Ciclo ',cy.numero) END
             ORDER BY cy.numero SEPARATOR ', ') AS ciclos
    FROM seccion_horarios h
    JOIN secciones s ON s.id_seccion=h.id_seccion
    JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
    JOIN cursos c ON c.id_curso=s.id_curso
    JOIN aulas a ON a.id_aula=h.id_aula
    JOIN sedes sede ON sede.id_sede=a.id_sede
    LEFT JOIN docentes_secciones ds ON ds.id_seccion=s.id_seccion AND ds.estado='Activo'
    LEFT JOIN docentes d ON d.id_docente=ds.id_docente AND d.estado='Activo'
    LEFT JOIN matriculas m ON m.id_seccion=s.id_seccion AND m.estado='Matriculado'
    LEFT JOIN plan_cursos pc ON pc.id_curso=s.id_curso
    LEFT JOIN ciclos cy ON cy.id_ciclo=pc.id_ciclo
    LEFT JOIN planes_estudio pl ON pl.id_plan=pc.id_plan AND pl.estado='Activo'
    ${conditions.length?'WHERE '+conditions.join(' AND '):''}
    GROUP BY s.id_seccion,h.id_horario,p.id_periodo,c.id_curso,a.id_aula,sede.id_sede
    ORDER BY p.codigo DESC,FIELD(h.dia_semana,'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'),h.hora_inicio`,
   values
  );
  return res.json({success:true,data:rows});
 }catch(error){return next(error);}
});
router.get('/secciones',async(req,res,next)=>{
 try{
  const [rows]=await pool.query(
   `SELECT s.*,p.codigo AS periodo_codigo,c.codigo AS curso_codigo,c.nombre AS curso,
           GROUP_CONCAT(DISTINCT CONCAT(d.nombres,' ',d.apellidos) ORDER BY d.apellidos,d.nombres SEPARATOR ', ') AS docentes,
           GROUP_CONCAT(DISTINCT CONCAT(h.dia_semana,' ',TIME_FORMAT(h.hora_inicio,'%H:%i'),'-',TIME_FORMAT(h.hora_fin,'%H:%i'),' · ',a.nombre)
             ORDER BY FIELD(h.dia_semana,'Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'),h.hora_inicio SEPARATOR ' | ') AS horario,
           COUNT(DISTINCT m.id_matricula) AS inscritos,
           GREATEST(s.capacidad-COUNT(DISTINCT m.id_matricula),0) AS vacantes_disponibles
    FROM secciones s
    JOIN periodos_academicos p ON p.id_periodo=s.id_periodo
    JOIN cursos c ON c.id_curso=s.id_curso
    LEFT JOIN docentes_secciones ds ON ds.id_seccion=s.id_seccion AND ds.estado='Activo'
    LEFT JOIN docentes d ON d.id_docente=ds.id_docente AND d.estado='Activo'
    LEFT JOIN seccion_horarios h ON h.id_seccion=s.id_seccion
    LEFT JOIN aulas a ON a.id_aula=h.id_aula
    LEFT JOIN matriculas m ON m.id_seccion=s.id_seccion AND m.estado='Matriculado'
    GROUP BY s.id_seccion ORDER BY p.codigo DESC,c.nombre,s.codigo`
  );
  return res.json({success:true,data:rows});
 }catch(error){return next(error);}
});
router.get('/:table',async(req,res,next)=>{
 try {const [pk]=def(req.params.table);const [rows]=await pool.query(`SELECT * FROM \`${req.params.table}\` ORDER BY \`${pk}\` DESC LIMIT 1000`);res.json({success:true,data:rows});}catch(e){next(e);}
});
router.get('/:table/:id',async(req,res,next)=>{
 try {const [pk]=def(req.params.table);const [rows]=await pool.query(`SELECT * FROM \`${req.params.table}\` WHERE \`${pk}\`=?`,[req.params.id]);if(!rows.length)return res.status(404).json({success:false,message:'Registro no encontrado'});res.json({success:true,data:rows[0]});}catch(e){next(e);}
});
router.post('/:table',async(req,res,next)=>{
 if(versionedCurriculumTables.has(req.params.table))return res.status(409).json({success:false,message:'Administra las mallas desde el módulo versionado de Malla curricular.'});
 if(workflowManagedTables.has(req.params.table))return res.status(409).json({success:false,message:managedMessage});
 if(['obligaciones_pago','pagos','pago_detalles'].includes(req.params.table))return res.status(409).json({success:false,message:'Usa el módulo de Tesorería para registrar operaciones con auditoría.'});
 const conn=await pool.getConnection().catch(next);if(!conn)return;
 try {const [pk,fields,required]=def(req.params.table);const data=Object.fromEntries(fields.filter(f=>req.body[f]!==undefined).map(f=>[f,req.body[f]===''?null:req.body[f]]));requiredCheck(data,required);
 await conn.beginTransaction();await validate(conn,req.params.table,data);
 const names=Object.keys(data);const [r]=await conn.query(`INSERT INTO \`${req.params.table}\` (${names.map(f=>`\`${f}\``).join(',')}) VALUES (${names.map(()=>'?').join(',')})`,Object.values(data));await conn.commit();res.status(201).json({success:true,message:'Registro creado',data:{[pk]:r.insertId}});
 }catch(e){await conn.rollback();next(e);}finally{conn.release();}
});
router.put('/:table/:id',async(req,res,next)=>{
 if(versionedCurriculumTables.has(req.params.table))return res.status(409).json({success:false,message:'Administra las mallas desde el módulo versionado de Malla curricular.'});
 if(workflowManagedTables.has(req.params.table))return res.status(409).json({success:false,message:managedMessage});
 if(['obligaciones_pago','pagos','pago_detalles'].includes(req.params.table))return res.status(409).json({success:false,message:'Usa el módulo de Tesorería para registrar operaciones con auditoría.'});
 const conn=await pool.getConnection().catch(next);if(!conn)return;
 try {const [pk,fields,required]=def(req.params.table);const [existing]=await conn.query(`SELECT * FROM \`${req.params.table}\` WHERE \`${pk}\`=?`,[req.params.id]);if(!existing.length)fail(404,'Registro no encontrado');
 const data=Object.fromEntries(fields.filter(f=>req.body[f]!==undefined).map(f=>[f,req.body[f]===''?null:req.body[f]]));if(!Object.keys(data).length)fail(400,'Sin cambios');requiredCheck({...existing[0],...data},required);
 await conn.beginTransaction();await validate(conn,req.params.table,{...existing[0],...data},Number(req.params.id));
 await conn.query(`UPDATE \`${req.params.table}\` SET ${Object.keys(data).map(f=>`\`${f}\`=?`).join(',')} WHERE \`${pk}\`=?`,[...Object.values(data),req.params.id]);await conn.commit();res.json({success:true,message:'Registro actualizado'});
 }catch(e){await conn.rollback();next(e);}finally{conn.release();}
});
router.delete('/:table/:id',async(req,res,next)=>{
 if(versionedCurriculumTables.has(req.params.table))return res.status(409).json({success:false,message:'Las mallas conservan su historial; usa el módulo versionado para crear una nueva versión.'});
 if(workflowManagedTables.has(req.params.table))return res.status(409).json({success:false,message:managedMessage});
 if(['obligaciones_pago','pagos','pago_detalles'].includes(req.params.table))return res.status(409).json({success:false,message:'Los movimientos financieros no se eliminan; usa las acciones auditadas de Tesorería.'});
 try{const [pk]=def(req.params.table);const [r]=await pool.query(`DELETE FROM \`${req.params.table}\` WHERE \`${pk}\`=?`,[req.params.id]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Registro no encontrado'});res.json({success:true,message:'Registro eliminado'});}catch(e){next(e);}
});
module.exports=router;
