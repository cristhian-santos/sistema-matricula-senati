import React, {useEffect,useMemo,useState} from 'react';
import {useParams,Link} from 'react-router-dom';
import api from '../services/api';
const modules = {
 carreras: {title:'Carreras profesionales',icon:'mortarboard',fields:{codigo:'text',nombre:'text',descripcion:'text',duracion_ciclos:'number',estado:'estado'}},
 ciclos:{title:'Ciclos académicos',icon:'layers',fields:{numero:'number',nombre:'text',estado:'estado'}},
 periodos_academicos:{title:'Periodos académicos',icon:'calendar3',fields:{codigo:'text',nombre:'text',fecha_inicio:'date',fecha_fin:'date',inicio_matricula:'date',fin_matricula:'date',estado:['Planificado','Matricula abierta','En curso','Cerrado']}},
 sedes:{title:'Sedes',icon:'geo-alt',fields:{codigo:'text',nombre:'text',direccion:'text',estado:'estado'}},
 modalidades:{title:'Modalidades',icon:'display',fields:{nombre:'text',descripcion:'text',estado:'estado'}},
 planes_estudio:{title:'Planes de estudio',icon:'diagram-3',fields:{id_carrera:'@carreras',codigo:'text',version:'text',fecha_vigencia:'date',estado:'estado'}},
 plan_cursos:{title:'Malla curricular',icon:'journal-bookmark',fields:{id_plan:'@planes_estudio',id_ciclo:'@ciclos',id_curso:'@cursos',tipo_curso:['Obligatorio','Electivo'],orden:'number'}},
 curso_prerrequisitos:{title:'Prerrequisitos',icon:'signpost-split',fields:{id_plan_curso:'@plan_cursos',id_plan_curso_requisito:'@plan_cursos'}},
 docentes:{title:'Docentes',icon:'person-workspace',fields:{codigo_docente:'text',dni:'text',nombres:'text',apellidos:'text',email:'email',telefono:'text',especialidad:'text',tipo_contrato:'text',fecha_ingreso:'date',estado:'estado'}},
 aulas:{title:'Aulas y laboratorios',icon:'building',fields:{id_sede:'@sedes',codigo:'text',nombre:'text',tipo:['Aula','Laboratorio','Taller','Virtual'],capacidad:'number',estado:'estado'}},
 secciones:{title:'Secciones',icon:'people',fields:{id_curso:'@cursos',id_periodo:'@periodos_academicos',id_modalidad:'@modalidades',codigo:'text',turno:['Mañana','Tarde','Noche','Mixto'],capacidad:'number',estado:['Abierta','Cerrada','Finalizada']}},
 docentes_secciones:{title:'Asignación docente',icon:'person-check',fields:{id_docente:'@docentes',id_seccion:'@secciones',rol_docente:'text',estado:'estado'}},
 seccion_horarios:{title:'Horarios de clases',icon:'clock-history',fields:{id_seccion:'@secciones',id_aula:'@aulas',dia_semana:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'],hora_inicio:'time',hora_fin:'time'}},
 evaluaciones:{title:'Evaluaciones',icon:'clipboard-check',fields:{id_seccion:'@secciones',nombre:'text',tipo:['Practica','Examen','Proyecto','Otro'],peso_porcentaje:'number',fecha:'date',estado:['Abierta','Cerrada']}},
 calificaciones:{title:'Calificaciones',icon:'award',fields:{id_evaluacion:'@evaluaciones',id_matricula:'@matriculas',nota:'number'}},
 sesiones_clase:{title:'Sesiones de clase',icon:'calendar-event',fields:{id_seccion:'@secciones',fecha:'date',tema:'text',estado:['Programada','Realizada','Cancelada']}},
 asistencias:{title:'Asistencias',icon:'person-check-fill',fields:{id_sesion:'@sesiones_clase',id_matricula:'@matriculas',estado:['Presente','Tardanza','Falta','Justificada'],observacion:'text'}},
 conceptos_pago:{title:'Conceptos de pago',icon:'cash-coin',fields:{nombre:'text',descripcion:'text',monto_base:'number',estado:'estado'}},
 obligaciones_pago:{title:'Cuotas y obligaciones',icon:'receipt',fields:{id_estudiante:'@estudiantes',id_periodo:'@periodos_academicos',id_concepto:'@conceptos_pago',monto:'number',fecha_vencimiento:'date',estado:['Pendiente','Pagado','Anulado']}},
 pagos:{title:'Registro de pagos',icon:'credit-card',fields:{id_estudiante:'@estudiantes',fecha_pago:'datetime-local',metodo:'text',referencia:'text',monto:'number',estado:['Registrado','Anulado']}},
 pago_detalles:{title:'Aplicación de pagos',icon:'cash-stack',fields:{id_pago:'@pagos',id_obligacion:'@obligaciones_pago',monto_aplicado:'number'}}
};
const groups=[['Estructura académica',['carreras','ciclos','planes_estudio','plan_cursos','curso_prerrequisitos','periodos_academicos']],['Personal y espacios',['docentes','sedes','modalidades','aulas','secciones','docentes_secciones','seccion_horarios']],['Evaluación y asistencia',['evaluaciones','calificaciones','sesiones_clase','asistencias']],['Tesorería',['conceptos_pago']]];
const label = s => s.replace(/^id_/,'').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());
const pk = table => ({periodos_academicos:'id_periodo',planes_estudio:'id_plan',plan_cursos:'id_plan_curso',curso_prerrequisitos:'id_prerrequisito',docentes_secciones:'id_asignacion',seccion_horarios:'id_horario',conceptos_pago:'id_concepto',obligaciones_pago:'id_obligacion',pago_detalles:'id_pago_detalle',sesiones_clase:'id_sesion',calificaciones:'id_calificacion',asistencias:'id_asistencia'})[table] || ({carreras:'id_carrera',ciclos:'id_ciclo',sedes:'id_sede',modalidades:'id_modalidad',docentes:'id_docente',aulas:'id_aula',secciones:'id_seccion',evaluaciones:'id_evaluacion',pagos:'id_pago',matriculas:'id_matricula'})[table] || `id_${table.slice(0,-1)}`;
const display = (item, table) => item?.nombre || item?.codigo || item?.nombres && `${item.nombres} ${item.apellidos}` || item?.periodo && `${item.periodo} - ${item.estudiante_nombre}` || item?.numero && `Ciclo ${item.numero}` || item?.dia_semana && `${item.dia_semana} ${item.hora_inicio}` || item?.[pk(table)];
const format = value => value===null||value===undefined?'—':typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)?value.slice(0,10):String(value);
const isReference = kind => typeof kind === 'string' && kind.startsWith('@');
export default function AcademicoPage(){
 const {modulo}=useParams(); const config=modules[modulo];
 const [rows,setRows]=useState([]),[options,setOptions]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [search,setSearch]=useState(''),[editing,setEditing]=useState(null),[form,setForm]=useState({});
 const fields=useMemo(()=>Object.entries(config?.fields||{}),[config]);
 const load=async()=>{if(!config)return;setBusy(true);setError('');try{
  const referenced=[...new Set(fields.filter(([,kind])=>isReference(kind)).map(([,kind])=>kind.slice(1)))];
  const [main,...refs]=await Promise.all([api.get(`/academico/${modulo}`),...referenced.map(t=>api.get(['cursos','estudiantes','matriculas'].includes(t)?`/${t}`:`/academico/${t}`))]);
  setRows(main.data.data);setOptions(Object.fromEntries(referenced.map((t,i)=>[t,refs[i].data.data])));
 }catch(e){setError(e.response?.data?.message||'No se pudieron cargar los registros. Revisa la migración SQL y el backend.');}finally{setBusy(false);}};
 useEffect(()=>{setEditing(null);setForm({});setSearch('');load();},[modulo]);
 if(!config)return <div className="container py-5"><h3>Módulo no encontrado</h3><Link to="/academico">Volver</Link></div>;
 if(['obligaciones_pago','pagos','pago_detalles'].includes(modulo))return <div className="container py-5"><div className="alert alert-info"><h3 className="h5">Operaciones financieras protegidas</h3><p>El registro, ajuste y anulación de obligaciones y pagos ahora se realiza con transacciones y auditoría en el módulo de Tesorería.</p><Link className="btn btn-primary" to="/tesoreria">Abrir Tesorería</Link></div></div>;
 const begin=(item=null)=>{setEditing(item?item[pk(modulo)]: 'nuevo');setForm(item?Object.fromEntries(fields.map(([f,k])=>[f,k==='date'&&item[f]?String(item[f]).slice(0,10):k==='datetime-local'&&item[f]?String(item[f]).slice(0,16):item[f]??''])):{});setError('');setMessage('');};
 const save=async e=>{e.preventDefault();setBusy(true);setError('');try{const values=Object.fromEntries(fields.map(([field])=>[field,form[field]??null]));
  if(editing==='nuevo')await api.post(`/academico/${modulo}`,values);else await api.put(`/academico/${modulo}/${editing}`,values);
  setEditing(null);setMessage('Registro guardado correctamente');await load();
 }catch(e){setError(e.response?.data?.message||'No se pudo guardar');}finally{setBusy(false);}};
 const remove=async item=>{if(!window.confirm('¿Eliminar este registro? Los datos relacionados impedirán la eliminación.'))return;setError('');try{await api.delete(`/academico/${modulo}/${item[pk(modulo)]}`);setMessage('Registro eliminado');await load();}catch(e){setError(e.response?.data?.message||'No se pudo eliminar el registro');}};
 const filtered=rows.filter(item=>JSON.stringify(item).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
 const mallaPlanes=modulo==='plan_cursos'?(options.planes_estudio||[]).map(plan=>({
  ...plan,
  carrera:options.carreras?.find(c=>String(c.id_carrera)===String(plan.id_carrera)),
  ciclos:(options.ciclos||[]).slice().sort((a,b)=>a.numero-b.numero).map(ciclo=>({
   ...ciclo,
   cursos:rows.filter(row=>String(row.id_plan)===String(plan.id_plan)&&String(row.id_ciclo)===String(ciclo.id_ciclo))
    .map(row=>({...row,curso:options.cursos?.find(c=>String(c.id_curso)===String(row.id_curso))}))
  }))
 })):[];
 return <div className="container-fluid px-3 px-lg-5 py-4">
  <div className="row g-4"><aside className="col-lg-3 col-xl-2"><div className="card p-3"><h6 className="fw-bold mb-3">Gestión académica</h6>
   {groups.map(([name,items])=><div key={name} className="mb-3"><div className="small text-muted text-uppercase fw-bold mb-2">{name}</div>{items.map(t=><Link key={t} className={`d-block text-decoration-none rounded-3 px-2 py-2 small ${modulo===t?'bg-primary text-white':'text-secondary'}`} to={`/academico/${t}`}><i className={`bi bi-${modules[t].icon} me-2`}></i>{modules[t].title}</Link>)}</div>)}
   <Link className="d-block text-decoration-none rounded-3 px-2 py-2 small text-secondary" to="/tesoreria"><i className="bi bi-cash-coin me-2"></i>Planes, cuotas y pagos</Link>
  </div></aside><section className="col-lg-9 col-xl-10">
   <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4"><div><div className="text-info fw-bold small mb-2">ADMINISTRACIÓN INSTITUCIONAL</div><h2 className="fw-bold mb-1"><i className={`bi bi-${config.icon} me-2 text-primary`}></i>{config.title}</h2><div className="text-muted">Gestiona registros y relaciones de este módulo</div></div><button className="btn btn-primary" onClick={()=>begin()}><i className="bi bi-plus-circle me-2"/>Nuevo registro</button></div>
   {error&&<div className="alert alert-danger" role="alert">{error}</div>}{message&&<div className="alert alert-success">{message}</div>}
   {modulo==='plan_cursos'&&<div className="card shadow-sm mb-4"><div className="card-header"><strong>Malla curricular organizada por ciclo</strong><div className="small text-muted">Planes de demostración; no representan una malla oficial.</div></div><div className="card-body"><div className="row g-3">
    {mallaPlanes.map(plan=><div className="col-12 col-xl-6" key={plan.id_plan}><div className="border rounded-3 h-100 p-3"><h5 className="mb-1">{plan.codigo}</h5><div className="small text-muted mb-3">{plan.carrera?.nombre||'Carrera'} · {plan.version} · {plan.estado}</div>
     {plan.ciclos.map(ciclo=><div className="mb-3" key={ciclo.id_ciclo}><div className="fw-semibold border-bottom pb-1 mb-2">{ciclo.nombre}</div>
      {ciclo.cursos.length?ciclo.cursos.map(item=><div className="small d-flex justify-content-between gap-2 mb-1" key={item.id_plan_curso}><span>{item.curso?.codigo} · {item.curso?.nombre||'Curso'}</span><span className="text-muted text-nowrap">{item.tipo_curso}</span></div>):<div className="small text-muted">Sin cursos asignados</div>}
     </div>)}
    </div></div>)}
   </div></div></div>}
   <div className="card shadow-sm"><div className="card-body"><div className="d-flex gap-2 align-items-center mb-3"><input className="form-control" aria-label="Buscar registros" placeholder="Buscar en este módulo..." value={search} onChange={e=>setSearch(e.target.value)}/><span className="text-muted small text-nowrap">{filtered.length} registros</span></div>
   <div className="table-responsive"><table className="table table-hover align-middle"><thead><tr><th>ID</th>{fields.map(([f])=><th key={f}>{label(f)}</th>)}<th>Acciones</th></tr></thead><tbody>
    {filtered.map(item=><tr key={item[pk(modulo)]}><td className="fw-bold">{item[pk(modulo)]}</td>{fields.map(([field,kind])=><td key={field}>{isReference(kind)?display(options[kind.slice(1)]?.find(opt=>String(opt[pk(kind.slice(1))])===String(item[field])),kind.slice(1))||'—':format(item[field])}</td>)}<td className="text-nowrap"><button className="btn btn-sm btn-outline-primary me-2" onClick={()=>begin(item)} title="Editar"><i className="bi bi-pencil"/></button><button className="btn btn-sm btn-outline-danger" onClick={()=>remove(item)} title="Eliminar"><i className="bi bi-trash"/></button></td></tr>)}
   </tbody></table></div>{!filtered.length&&<div className="text-center text-muted py-4">{busy?'Cargando...':'No hay registros para mostrar.'}</div>}</div></div>
   {editing!==null&&<div className="card shadow-sm mt-4"><div className="card-header d-flex justify-content-between"><strong>{editing==='nuevo'?'Nuevo registro':'Editar registro'}</strong><button className="btn-close" aria-label="Cerrar" onClick={()=>setEditing(null)}/></div><form onSubmit={save} className="card-body"><div className="row g-3">{fields.map(([field,kind])=><div className="col-md-6" key={field}><label className="form-label fw-semibold" htmlFor={`field-${field}`}>{label(field)}</label>
   {isReference(kind)?<select id={`field-${field}`} className="form-select" value={form[field]??''} onChange={e=>setForm({...form,[field]:e.target.value})} required><option value="">Seleccionar...</option>{(options[kind.slice(1)]||[]).map(opt=><option key={opt[pk(kind.slice(1))]} value={opt[pk(kind.slice(1))]}>{display(opt,kind.slice(1))}</option>)}</select>
   :kind==='estado'||Array.isArray(kind)?<select id={`field-${field}`} className="form-select" value={form[field]??''} onChange={e=>setForm({...form,[field]:e.target.value})}><option value="">Seleccionar...</option>{(kind==='estado'?['Activo','Inactivo']:kind).map(v=><option key={v} value={v}>{v}</option>)}</select>
   :<input id={`field-${field}`} className="form-control" type={kind} step={kind==='number'?'any':undefined} value={form[field]??''} onChange={e=>setForm({...form,[field]:e.target.value})}/>}
   </div>)}</div><div className="mt-4 d-flex gap-2"><button disabled={busy} type="submit" className="btn btn-primary">{busy?'Guardando...':'Guardar'}</button><button type="button" className="btn btn-outline-secondary" onClick={()=>setEditing(null)}>Cancelar</button></div></form></div>}
  </section></div>
 </div>;
}
export {modules};
