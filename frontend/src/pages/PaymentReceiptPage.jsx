import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const money = (value) => Number(value || 0).toFixed(2);

export default function PaymentReceiptPage() {
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/tesoreria/pagos/${id}/constancia`)
      .then(({ data }) => setReceipt(data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'No se pudo abrir la constancia.'));
  }, [id]);

  if (error) return <div className="container py-5"><div className="alert alert-danger">{error}</div></div>;
  if (!receipt) return <div className="container py-5 text-center">Cargando constancia...</div>;

  const { pago, aplicaciones } = receipt;
  return <div className="container py-4" style={{ maxWidth: 850 }}>
    <div className="d-flex justify-content-end mb-3 d-print-none"><button className="btn btn-primary" onClick={() => window.print()}><i className="bi bi-printer me-2" />Imprimir / Guardar PDF</button></div>
    <article className="card p-4 p-md-5">
      <div className="d-flex justify-content-between border-bottom pb-3 mb-4"><div><div className="text-primary fw-bold">SISTEMA DE GESTIÓN DE MATRÍCULA</div><h1 className="h3 fw-bold mt-2">Constancia interna de pago</h1><div className="small text-muted">Documento informativo; no es comprobante tributario.</div></div><div className="text-end"><div className="text-muted">N.° de pago</div><strong>#{pago.id_pago}</strong><div><span className={`badge ${pago.estado === 'Registrado' ? 'bg-success' : 'bg-danger'}`}>{pago.estado}</span></div></div></div>
      <div className="row g-3 mb-4"><div className="col-sm-6"><div className="small text-muted">Estudiante</div><div className="fw-semibold">{pago.apellidos}, {pago.nombres}</div></div><div className="col-sm-6"><div className="small text-muted">DNI</div><div className="fw-semibold">{pago.dni}</div></div><div className="col-sm-6"><div className="small text-muted">Fecha</div><div>{String(pago.fecha_pago).slice(0,19)}</div></div><div className="col-sm-6"><div className="small text-muted">Método</div><div>{pago.metodo}</div></div><div className="col-sm-6"><div className="small text-muted">Referencia</div><div>{pago.referencia || '—'}</div></div><div className="col-sm-6"><div className="small text-muted">Moneda</div><div>PEN (S/)</div></div></div>
      <div className="table-responsive"><table className="table"><thead><tr><th>Obligación</th><th>Periodo</th><th>Vencimiento</th><th className="text-end">Aplicado</th></tr></thead><tbody>{aplicaciones.map((item,index) => <tr key={`${item.id_obligacion}-${index}`}><td>{item.concepto || 'Obligación'}</td><td>{item.periodo || '—'}</td><td>{item.fecha_vencimiento ? String(item.fecha_vencimiento).slice(0,10) : '—'}</td><td className="text-end">S/ {money(item.monto_aplicado)}</td></tr>)}</tbody><tfoot><tr><th colSpan="3">Total registrado</th><th className="text-end">S/ {money(pago.monto)}</th></tr></tfoot></table></div>
      <p className="small text-muted mt-4 mb-0">Constancia interna generada por el sistema. La validez se verifica con el estado del pago y su referencia en Tesorería.</p>
    </article>
  </div>;
}
