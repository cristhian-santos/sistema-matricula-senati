import React, { useEffect, useState } from 'react';
import api from '../services/api';

const money = (value) => Number(value || 0).toFixed(2);

export default function StudentPaymentsPage() {
  const [schedule, setSchedule] = useState([]);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/tesoreria/mi-cronograma'), api.get('/tesoreria/mi-pagos')])
      .then(([scheduleResult, paymentResult]) => {
        setSchedule(scheduleResult.data.data);
        setPayments(paymentResult.data.data);
      })
      .catch((requestError) => setError(requestError.response?.data?.message || 'No se pudo cargar la información de pagos.'));
  }, []);

  const balance = schedule.reduce((sum, item) => sum + Number(item.saldo || 0), 0);

  return <div className="container py-4">
    <div className="mb-4"><div className="small text-info fw-bold">PORTAL DEL ESTUDIANTE</div><h1 className="h2 fw-bold">Mis pagos</h1><p className="text-muted">Consulta cuotas, vencimientos, saldos y constancias internas.</p></div>
    {error && <div className="alert alert-danger">{error}</div>}
    <div className="card mb-4"><div className="card-body"><div className="small text-muted">Saldo pendiente</div><div className="fs-2 fw-bold">S/ {money(balance)}</div></div></div>
    <div className="card mb-4"><div className="card-header fw-bold">Cronograma de cuotas</div><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th>Periodo</th><th>Concepto</th><th>Vencimiento</th><th>Importe</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>
      {schedule.map((item) => <tr key={item.id_obligacion}><td>{item.periodo}</td><td>{item.concepto}</td><td>{String(item.fecha_vencimiento).slice(0,10)}</td><td>S/ {money(item.monto_exigible)}</td><td>S/ {money(item.pagado)}</td><td>S/ {money(item.saldo)}</td><td><span className={`badge ${item.estado_calculado === 'Pagada' ? 'bg-success' : item.estado_calculado === 'Vencida' ? 'bg-danger' : 'bg-secondary'}`}>{item.estado_calculado}</span></td></tr>)}
      {!schedule.length && <tr><td colSpan="7" className="text-center text-muted py-3">No tienes cuotas registradas.</td></tr>}
    </tbody></table></div></div>
    <div className="card"><div className="card-header fw-bold">Pagos realizados</div><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th>Fecha</th><th>Método</th><th>Referencia</th><th>Importe</th><th>Estado</th><th>Constancia</th></tr></thead><tbody>
      {payments.map((item) => <tr key={item.id_pago}><td>{String(item.fecha_pago).slice(0,19)}</td><td>{item.metodo}</td><td>{item.referencia || '—'}</td><td>S/ {money(item.monto)}</td><td>{item.estado}</td><td><a className="btn btn-sm btn-outline-primary" href={`/tesoreria/constancia/${item.id_pago}`} target="_blank" rel="noreferrer">Imprimir / PDF</a></td></tr>)}
      {!payments.length && <tr><td colSpan="6" className="text-center text-muted py-3">No hay pagos registrados.</td></tr>}
    </tbody></table></div></div>
  </div>;
}
