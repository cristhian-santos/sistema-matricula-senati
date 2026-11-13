import React,{useEffect,useState} from 'react';
import api from '../services/api';
export default function ReportesPage(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=async()=>{
  setLoading(true);setError('');
  try{const response=await api.get('/reportes/resumen');setData(response.data.data);}
  catch(e){setError(e.response?.data?.message||'No se pueden cargar reportes');}
  finally{setLoading(false);}
 };
 useEffect(()=>{load();},[]);
 const exportCSV=(name,rows)=>{
  if(!rows.length)return;const cols=Object.keys(rows[0]);const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv='\uFEFF'+[cols.map(esc).join(';'),...rows.map(r=>cols.map(c=>esc(r[c])).join(';'))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();URL.revokeObjectURL(url);
 };
 return <div className="container py-4"><h2 className="fw-bold">Reportes académicos</h2><p className="text-muted">Cifras consultadas directamente desde MySQL. Descarga los reportes en CSV para Excel.</p>{error&&<div className="alert alert-danger" role="alert"><div>{error}</div><div className="mt-2">Faltan tablas de la ampliación académica. Ejecuta <code>database/02_ampliacion_academica.sql</code> en la base <code>bd_matricula</code> desde MySQL Workbench después de hacer una copia de seguridad.</div><button className="btn btn-outline-danger btn-sm mt-2" onClick={load}>Reintentar</button></div>}{loading&&<div>Cargando…</div>}
 {data&&[['periodos','Matrículas por periodo'],['carreras','Carreras y planes de estudio'],['secciones','Vacantes por sección']].map(([key,title])=><div className="card mb-4" key={key}><div className="card-header d-flex align-items-center justify-content-between"><strong>{title}</strong><button className="btn btn-outline-primary btn-sm" onClick={()=>exportCSV('reporte_'+key,data[key])}>Exportar CSV</button></div><div className="table-responsive"><table className="table table-striped mb-0"><thead><tr>{data[key][0]&&Object.keys(data[key][0]).map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{data[key].map((row,i)=><tr key={i}>{Object.values(row).map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>{!data[key].length&&<div className="p-3 text-muted">Sin registros disponibles</div>}</div>)}
 </div>;
}
