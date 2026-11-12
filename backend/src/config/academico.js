// Lista blanca de tablas y columnas editables (nunca usar nombres SQL del cliente).
const defs = {
 cursos: ['id_curso',['codigo','nombre','creditos','horas','vacantes_maximas','estado'],['codigo','nombre','creditos','horas','vacantes_maximas'],[]],
 estudiantes: ['id_estudiante',['dni','nombres','apellidos','email','telefono','direccion','estado'],['dni','nombres','apellidos','email'],[]],
 carreras: ['id_carrera',['codigo','nombre','descripcion','duracion_ciclos','estado'],['codigo','nombre'],[]],
 ciclos: ['id_ciclo',['numero','nombre','estado'],['numero','nombre'],[]],
 periodos_academicos: ['id_periodo',['codigo','nombre','fecha_inicio','fecha_fin','inicio_matricula','fin_matricula','estado'],['codigo','nombre','fecha_inicio','fecha_fin','inicio_matricula','fin_matricula'],['fecha_inicio','fecha_fin','inicio_matricula','fin_matricula']],
 sedes: ['id_sede',['codigo','nombre','direccion','estado'],['codigo','nombre'],[]],
 modalidades: ['id_modalidad',['nombre','descripcion','estado'],['nombre'],[]],
 planes_estudio: ['id_plan',['id_carrera','codigo','version','fecha_vigencia','estado'],['id_carrera','codigo','version','fecha_vigencia'],['fecha_vigencia']],
 plan_cursos: ['id_plan_curso',['id_plan','id_ciclo','id_curso','tipo_curso','orden'],['id_plan','id_ciclo','id_curso'],[]],
 curso_prerrequisitos: ['id_prerrequisito',['id_plan_curso','id_plan_curso_requisito'],['id_plan_curso','id_plan_curso_requisito'],[]],
 docentes: ['id_docente',['codigo_docente','dni','nombres','apellidos','email','telefono','especialidad','tipo_contrato','fecha_ingreso','estado'],['codigo_docente','dni','nombres','apellidos','email'],['fecha_ingreso']],
 aulas: ['id_aula',['id_sede','codigo','nombre','tipo','capacidad','estado'],['id_sede','codigo','nombre','capacidad'],[]],
 secciones: ['id_seccion',['id_curso','id_periodo','id_modalidad','codigo','turno','capacidad','estado'],['id_curso','id_periodo','id_modalidad','codigo','capacidad'],[]],
 docentes_secciones: ['id_asignacion',['id_docente','id_seccion','rol_docente','estado'],['id_docente','id_seccion'],[]],
 seccion_horarios: ['id_horario',['id_seccion','id_aula','dia_semana','hora_inicio','hora_fin'],['id_seccion','id_aula','dia_semana','hora_inicio','hora_fin'],[]],
 evaluaciones: ['id_evaluacion',['id_seccion','nombre','tipo','peso_porcentaje','fecha','estado'],['id_seccion','nombre','peso_porcentaje','fecha'],['fecha']],
 calificaciones: ['id_calificacion',['id_evaluacion','id_matricula','nota'],['id_evaluacion','id_matricula','nota'],[]],
 sesiones_clase: ['id_sesion',['id_seccion','fecha','tema','estado'],['id_seccion','fecha'],['fecha']],
 asistencias: ['id_asistencia',['id_sesion','id_matricula','estado','observacion'],['id_sesion','id_matricula','estado'],[]],
 conceptos_pago: ['id_concepto',['nombre','descripcion','monto_base','estado'],['nombre'],[]],
 obligaciones_pago: ['id_obligacion',['id_estudiante','id_periodo','id_concepto','monto','fecha_vencimiento','estado'],['id_estudiante','id_periodo','id_concepto','monto','fecha_vencimiento'],['fecha_vencimiento']],
 pagos: ['id_pago',['id_estudiante','fecha_pago','metodo','referencia','monto','estado'],['id_estudiante','fecha_pago','metodo','monto'],['fecha_pago']],
 pago_detalles: ['id_pago_detalle',['id_pago','id_obligacion','monto_aplicado'],['id_pago','id_obligacion','monto_aplicado'],[]]
};
module.exports = defs;
