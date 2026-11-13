import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const money = (value) => Number(value || 0).toFixed(2);
const emptyPlan = () => ({ codigo: '', nombre: '', modalidad: 'Mensual', numero_cuotas: 1, monto_total: '', moneda: 'PEN', id_carrera: '', id_periodo: '', descripcion: '', cuotas: [{ numero_cuota: 1, id_concepto: '', monto: '', dias_desde_inicio: 0 }] });
const emptyBenefit = { clase: 'beca', codigo: '', nombre: '', tipo: 'Porcentaje', valor: '', descripcion: '', fecha_inicio: '', fecha_fin: '' };

export default function TreasuryPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('Administrador');
  const [tab, setTab] = useState('resumen');
  const [catalogs, setCatalogs] = useState({ carreras: [], periodos: [], conceptos: [], estudiantes: [] });
  const [benefits, setBenefits] = useState({ becas: [], descuentos: [] });
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState({ obligaciones: [], deuda_pendiente: 0, cuotas_por_estado: {} });
  const [incomes, setIncomes] = useState([]);
  const [audit, setAudit] = useState({ pagos_sobreaplicados: [], obligaciones_sobreaplicadas: [], estados_inconsistentes: [] });
  const [filter, setFilter] = useState({ periodo: '', carrera: '', estado: '' });
  const [plan, setPlan] = useState(emptyPlan());
  const [assignment, setAssignment] = useState({ id_plan_pago: '', id_estudiante: '', id_periodo: '', fecha_inicio: new Date().toLocaleDateString('en-CA'), becas: [], descuentos: [] });
  const [benefitForm, setBenefitForm] = useState(emptyBenefit);
  const [paymentStudent, setPaymentStudent] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [payment, setPayment] = useState({ metodo: 'Transferencia', referencia: '' });
  const [historyStudent, setHistoryStudent] = useState('');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedPeriodStudents = useMemo(
    () => catalogs.estudiantes.filter((student) => String(student.id_periodo) === String(assignment.id_periodo)),
    [catalogs.estudiantes, assignment.id_periodo]
  );
  const paymentStudents = useMemo(
    () => [...new Map(catalogs.estudiantes.map((student) => [student.id_estudiante, student])).values()],
    [catalogs.estudiantes]
  );
  const paymentTotal = Object.values(allocations).reduce((sum, value) => sum + Math.round(Number(value || 0) * 100), 0) / 100;
  const planTotal = plan.cuotas.reduce((sum, installment) => sum + Number(installment.monto || 0), 0);

  const loadBase = async () => {
    const [catalogResult, benefitResult, planResult] = await Promise.all([
      api.get('/tesoreria/catalogos'), api.get('/tesoreria/beneficios'), api.get('/tesoreria/planes')
    ]);
    setCatalogs(catalogResult.data.data);
    setBenefits(benefitResult.data.data);
    setPlans(planResult.data.data);
  };
  const loadSummary = async (filters = filter) => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const [summaryResult, incomeResult, auditResult] = await Promise.all([
      api.get('/tesoreria/resumen', { params }), api.get('/tesoreria/ingresos'), api.get('/tesoreria/auditoria-saldos')
    ]);
    setSummary(summaryResult.data.data);
    setIncomes(incomeResult.data.data);
    setAudit(auditResult.data.data);
  };

  useEffect(() => {
    Promise.all([loadBase(), loadSummary({ periodo: '', carrera: '', estado: '' })])
      .catch((requestError) => setError(requestError.response?.data?.message || 'No se pudo cargar Tesorería.'));
  }, []);

  useEffect(() => {
    if (!paymentStudent) {
      setSchedule([]);
      setAllocations({});
      return;
    }
    api.get(`/tesoreria/estudiantes/${paymentStudent}/cronograma`).then(({ data }) => {
      setSchedule(data.data);
      setAllocations({});
    }).catch((requestError) => setError(requestError.response?.data?.message || 'No se pudo cargar el cronograma.'));
  }, [paymentStudent]);

  const notify = async (action, success) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  };

  const updateInstallmentCount = (value) => {
    const count = Math.max(1, Math.min(120, Number(value) || 1));
    setPlan((current) => ({
      ...current,
      numero_cuotas: count,
      cuotas: Array.from({ length: count }, (_, index) => current.cuotas[index] || {
        numero_cuota: index + 1,
        id_concepto: current.cuotas[0]?.id_concepto || '',
        monto: '',
        dias_desde_inicio: index * 30
      }).map((item, index) => ({ ...item, numero_cuota: index + 1 }))
    }));
  };

  const createPlan = (event) => {
    event.preventDefault();
    notify(async () => {
      await api.post('/tesoreria/planes', { ...plan, monto_total: Number(planTotal.toFixed(2)), id_carrera: plan.id_carrera || null, id_periodo: plan.id_periodo || null });
      setPlan(emptyPlan());
      await loadBase();
    }, 'Plan de pago creado.');
  };

  const assignPlan = (event) => {
    event.preventDefault();
    notify(async () => {
      const { data } = await api.post('/tesoreria/asignaciones', {
        ...assignment,
        becas: assignment.becas.map(Number),
        descuentos: assignment.descuentos.map(Number)
      });
      setMessage(`Plan asignado: ${data.data.cuotas} cuotas, saldo programado S/ ${money(data.data.total_exigible)}.`);
      await loadSummary();
    }, 'Cronograma generado; no se registró ningún pago.');
  };

  const createBenefit = (event) => {
    event.preventDefault();
    notify(async () => {
      await api.post('/tesoreria/beneficios', { ...benefitForm, valor: Number(benefitForm.valor), fecha_inicio: benefitForm.fecha_inicio || null, fecha_fin: benefitForm.fecha_fin || null });
      setBenefitForm(emptyBenefit);
      const { data } = await api.get('/tesoreria/beneficios');
      setBenefits(data.data);
    }, 'Beneficio creado.');
  };

  const registerPayment = (event) => {
    event.preventDefault();
    const selected = schedule.filter((row) => Number(allocations[row.id_obligacion] || 0) > 0);
    notify(async () => {
      const { data } = await api.post('/tesoreria/pagos', {
        id_estudiante: Number(paymentStudent),
        metodo: payment.metodo,
        referencia: payment.referencia,
        monto: Number(paymentTotal.toFixed(2)),
        asignaciones: selected.map((row) => ({ id_obligacion: row.id_obligacion, monto_aplicado: Number(allocations[row.id_obligacion]) }))
      });
      setMessage(`Pago #${data.data.id_pago} registrado por S/ ${money(data.data.monto)}.`);
      setAllocations({});
      const { data: updated } = await api.get(`/tesoreria/estudiantes/${paymentStudent}/cronograma`);
      setSchedule(updated.data);
      await loadSummary();
    }, 'Pago registrado.');
  };

  const loadHistory = async () => {
    if (!historyStudent) return;
    setError('');
    try {
      const { data } = await api.get(`/tesoreria/estudiantes/${historyStudent}/historial`);
      setHistory(data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cargar el historial.');
    }
  };

  const cancelPayment = (row) => {
    const id = row.id_pago;
    if (!id || !window.confirm(`¿Anular el pago #${id}? La operación conservará su historial.`)) return;
    notify(async () => {
      await api.post(`/tesoreria/pagos/${id}/anular`, { motivo: 'Anulación desde Tesorería' });
      await loadSummary();
      if (historyStudent) await loadHistory();
    }, 'Pago anulado con auditoría.');
  };

  const adjustObligation = (row) => {
    const variation = window.prompt(`Variación sobre la obligación #${row.id_obligacion} (positivo o negativo, en PEN):`);
    if (variation === null) return;
    const reason = window.prompt('Motivo obligatorio del ajuste:');
    if (reason === null) return;
    notify(async () => {
      await api.post(`/tesoreria/obligaciones/${row.id_obligacion}/ajustes`, { variacion: Number(variation), motivo: reason });
      await loadSummary();
    }, 'Ajuste registrado.');
  };

  const applyFilter = (event) => {
    event.preventDefault();
    loadSummary(filter).catch((requestError) => setError(requestError.response?.data?.message || 'No se pudo aplicar el filtro.'));
  };

  const toggleBenefit = (field, id) => {
    setAssignment((current) => ({
      ...current,
      [field]: current[field].includes(id) ? current[field].filter((value) => value !== id) : [...current[field], id]
    }));
  };

  return <div className="container-fluid px-3 px-lg-5 py-4">
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div><div className="small text-info fw-bold">ADMINISTRACIÓN FINANCIERA</div><h1 className="h2 fw-bold">Tesorería</h1><p className="text-muted mb-0">Planes, cuotas y movimientos en soles. Los importes de demostración no son tarifas oficiales.</p></div>
      <div className="badge text-bg-light border fs-6">Moneda: PEN (S/)</div>
    </div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}{message && <div className="alert alert-success">{message}</div>}
    <ul className="nav nav-tabs mb-4">
      {[['resumen','Resumen'],['planes','Planes y asignaciones'],['beneficios','Becas y descuentos'],['pagos','Registrar pago']].map(([key,title]) => <li className="nav-item" key={key}><button className={`nav-link ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{title}</button></li>)}
    </ul>

    {tab === 'resumen' && <>
      <form className="card card-body mb-4" onSubmit={applyFilter}><div className="row g-2 align-items-end">
        <div className="col-md-3"><label className="form-label" htmlFor="filter-period">Periodo</label><select id="filter-period" className="form-select" value={filter.periodo} onChange={(event) => setFilter({ ...filter, periodo: event.target.value })}><option value="">Todos</option>{catalogs.periodos.map((item) => <option key={item.id_periodo} value={item.id_periodo}>{item.codigo}</option>)}</select></div>
        <div className="col-md-3"><label className="form-label" htmlFor="filter-career">Carrera</label><select id="filter-career" className="form-select" value={filter.carrera} onChange={(event) => setFilter({ ...filter, carrera: event.target.value })}><option value="">Todas</option>{catalogs.carreras.map((item) => <option key={item.id_carrera} value={item.id_carrera}>{item.nombre}</option>)}</select></div>
        <div className="col-md-3"><label className="form-label" htmlFor="filter-state">Estado</label><select id="filter-state" className="form-select" value={filter.estado} onChange={(event) => setFilter({ ...filter, estado: event.target.value })}><option value="">Todos</option>{['Pendiente','Parcial','Vencida','Pagada'].map((value) => <option key={value}>{value}</option>)}</select></div>
        <div className="col-md-3"><button className="btn btn-primary w-100" type="submit">Aplicar filtros</button></div>
      </div></form>
      <div className="row g-3 mb-4">
        <div className="col-md-4"><div className="card h-100"><div className="card-body"><div className="small text-muted">Deuda pendiente filtrada</div><div className="fs-3 fw-bold">S/ {money(summary.deuda_pendiente)}</div></div></div></div>
        {Object.entries(summary.cuotas_por_estado || {}).map(([state,count]) => <div className="col-6 col-md-2" key={state}><div className="card h-100"><div className="card-body"><div className="small text-muted">Cuotas {state.toLowerCase()}</div><div className="fs-3 fw-bold">{count}</div></div></div></div>)}
      </div>
      <div className="card mb-4"><div className="card-header fw-bold">Ingresos aplicados por periodo</div><div className="table-responsive"><table className="table mb-0"><thead><tr><th>Periodo</th><th>Pagos</th><th>Ingresos</th></tr></thead><tbody>{incomes.map((item) => <tr key={item.id_periodo}><td>{item.periodo}</td><td>{item.pagos}</td><td>S/ {money(item.ingresos)}</td></tr>)}{!incomes.length && <tr><td colSpan="3" className="text-center text-muted py-3">Aún no hay pagos aplicados.</td></tr>}</tbody></table></div></div>
      <div className={`alert ${audit.pagos_sobreaplicados.length || audit.obligaciones_sobreaplicadas.length || audit.estados_inconsistentes.length ? 'alert-warning' : 'alert-success'}`} role="status">
        <strong>Conciliación de saldos:</strong> {audit.pagos_sobreaplicados.length} pagos con aplicaciones sobre el importe, {audit.obligaciones_sobreaplicadas.length} obligaciones sobreaplicadas y {audit.estados_inconsistentes.length} estados que no coinciden con el saldo calculado.
      </div>
      {(audit.pagos_sobreaplicados.length > 0 || audit.obligaciones_sobreaplicadas.length > 0 || audit.estados_inconsistentes.length > 0) && <div className="card border-warning mb-4">
        <div className="card-header fw-bold">Detalle de diferencias detectadas</div>
        <div className="card-body">
          {audit.pagos_sobreaplicados.length > 0 && <div className="table-responsive mb-3"><table className="table table-sm table-warning mb-0"><thead><tr><th>Pago</th><th>Importe</th><th>Aplicado</th><th>Diferencia</th></tr></thead><tbody>{audit.pagos_sobreaplicados.map((item) => <tr key={`payment-${item.id_pago}`}><td>#{item.id_pago}</td><td>S/ {money(item.monto)}</td><td>S/ {money(item.aplicado)}</td><td>S/ {money(Number(item.aplicado) - Number(item.monto))}</td></tr>)}</tbody></table></div>}
          {audit.obligaciones_sobreaplicadas.length > 0 && <div className="table-responsive mb-3"><table className="table table-sm table-warning mb-0"><thead><tr><th>Obligación</th><th>Estudiante</th><th>Exigible</th><th>Aplicado</th><th>Diferencia</th></tr></thead><tbody>{audit.obligaciones_sobreaplicadas.map((item) => <tr key={`obligation-${item.id_obligacion}`}><td>#{item.id_obligacion}</td><td>#{item.id_estudiante}</td><td>S/ {money(item.exigible)}</td><td>S/ {money(item.aplicado)}</td><td>S/ {money(Number(item.aplicado) - Number(item.exigible))}</td></tr>)}</tbody></table></div>}
          {audit.estados_inconsistentes.length > 0 && <div className="table-responsive"><table className="table table-sm table-warning mb-0"><thead><tr><th>Obligación</th><th>Estudiante</th><th>Estado guardado</th><th>Estado calculado</th><th>Exigible</th><th>Pagado</th></tr></thead><tbody>{audit.estados_inconsistentes.map((item) => <tr key={`state-${item.id_obligacion}`}><td>#{item.id_obligacion}</td><td>#{item.id_estudiante}</td><td>{item.estado_guardado}</td><td>{item.estado_calculado}</td><td>S/ {money(item.monto)}</td><td>S/ {money(item.pagado)}</td></tr>)}</tbody></table></div>}
        </div>
      </div>}
      <div className="card mb-4"><div className="card-header fw-bold">Obligaciones y cronograma</div><div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr><th>Estudiante</th><th>Carrera</th><th>Periodo</th><th>Concepto</th><th>Vencimiento</th><th>Exigible</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th /></tr></thead><tbody>
        {summary.obligaciones.map((row) => <tr key={row.id_obligacion}><td>{row.apellidos}, {row.nombres}<div className="small text-muted">{row.dni}</div></td><td>{row.carrera || '—'}</td><td>{row.periodo}</td><td>{row.concepto}</td><td>{String(row.fecha_vencimiento).slice(0,10)}</td><td>S/ {money(row.exigible)}</td><td>S/ {money(row.pagado)}</td><td>S/ {money(row.saldo)}</td><td><span className={`badge ${row.estado === 'Pagada' ? 'bg-success' : row.estado === 'Vencida' ? 'bg-danger' : 'bg-secondary'}`}>{row.estado}</span></td><td>{isAdmin && row.estado !== 'Anulada' && <button className="btn btn-sm btn-outline-secondary" onClick={() => adjustObligation(row)}>Ajustar</button>}</td></tr>)}
        {!summary.obligaciones.length && <tr><td colSpan="10" className="text-center text-muted py-3">No hay obligaciones para estos filtros.</td></tr>}
      </tbody></table></div></div>
      <div className="card"><div className="card-header fw-bold">Historial de movimientos por estudiante</div><div className="card-body"><div className="row g-2 mb-3"><div className="col-md-8"><select className="form-select" aria-label="Estudiante para historial" value={historyStudent} onChange={(event) => setHistoryStudent(event.target.value)}><option value="">Selecciona un estudiante matriculado</option>{paymentStudents.map((student) => <option key={student.id_estudiante} value={student.id_estudiante}>{student.dni} · {student.apellidos}, {student.nombres}</option>)}</select></div><div className="col-md-4"><button className="btn btn-outline-primary w-100" onClick={loadHistory} disabled={!historyStudent}>Consultar historial</button></div></div>
        <div className="table-responsive"><table className="table table-sm mb-0"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Monto</th><th>Usuario</th><th>Detalle</th><th /></tr></thead><tbody>                        {history.map((item) => <tr key={item.id_movimiento}><td>{String(item.creado_en).slice(0,19)}</td><td>{item.tipo}</td><td>S/ {money(item.monto)}</td><td>{item.usuario || '—'}</td><td>{typeof item.detalle === 'string' ? item.detalle : JSON.stringify(item.detalle || {})}</td><td>{item.tipo === 'PAGO_REGISTRADO' && item.id_pago && <><a className="btn btn-sm btn-outline-primary me-1" href={`/tesoreria/constancia/${item.id_pago}`} target="_blank" rel="noreferrer">Constancia</a>{isAdmin && item.estado_pago === 'Registrado' && <button className="btn btn-sm btn-outline-danger" onClick={() => cancelPayment(item)}>Anular pago #{item.id_pago}</button>}</>}</td></tr>)}{!history.length && <tr><td colSpan="6" className="text-center text-muted py-3">Selecciona un estudiante para consultar movimientos.</td></tr>}</tbody></table></div>
      </div></div>
    </>}

    {tab === 'planes' && <div className="row g-4">
      <div className="col-xl-7"><div className="card"><div className="card-header fw-bold">Crear plan de pago</div><form className="card-body" onSubmit={createPlan}>
        <div className="row g-3">
          <div className="col-md-4"><label className="form-label" htmlFor="plan-code">Código</label><input id="plan-code" className="form-control" value={plan.codigo} onChange={(event) => setPlan({ ...plan, codigo: event.target.value })} required /></div>
          <div className="col-md-8"><label className="form-label" htmlFor="plan-name">Nombre</label><input id="plan-name" className="form-control" value={plan.nombre} onChange={(event) => setPlan({ ...plan, nombre: event.target.value })} required /></div>
          <div className="col-md-4"><label className="form-label" htmlFor="plan-mode">Modalidad</label><select id="plan-mode" className="form-select" value={plan.modalidad} onChange={(event) => setPlan({ ...plan, modalidad: event.target.value })}>{['Unico','Mensual','Por ciclo','Fraccionado'].map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="col-md-4"><label className="form-label" htmlFor="plan-count">Número de cuotas</label><input id="plan-count" type="number" min="1" max="120" className="form-control" value={plan.numero_cuotas} onChange={(event) => updateInstallmentCount(event.target.value)} required /></div>
          <div className="col-md-4"><label className="form-label">Moneda</label><input className="form-control" value="PEN (S/)" readOnly /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="plan-career">Carrera (opcional)</label><select id="plan-career" className="form-select" value={plan.id_carrera} onChange={(event) => setPlan({ ...plan, id_carrera: event.target.value })}><option value="">Cualquier carrera</option>{catalogs.carreras.map((item) => <option key={item.id_carrera} value={item.id_carrera}>{item.nombre}</option>)}</select></div>
          <div className="col-md-6"><label className="form-label" htmlFor="plan-period">Periodo (opcional)</label><select id="plan-period" className="form-select" value={plan.id_periodo} onChange={(event) => setPlan({ ...plan, id_periodo: event.target.value })}><option value="">Cualquier periodo</option>{catalogs.periodos.map((item) => <option key={item.id_periodo} value={item.id_periodo}>{item.codigo}</option>)}</select></div>
          <div className="col-12"><label className="form-label" htmlFor="plan-description">Descripción</label><input id="plan-description" className="form-control" value={plan.descripcion} onChange={(event) => setPlan({ ...plan, descripcion: event.target.value })} maxLength="250" /></div>
        </div>
        <h2 className="h6 fw-bold mt-4">Cronograma de cuotas</h2>
        <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>#</th><th>Concepto</th><th>Monto S/</th><th>Días desde inicio</th></tr></thead><tbody>{plan.cuotas.map((item,index) => <tr key={item.numero_cuota}><td>{item.numero_cuota}</td><td><select className="form-select form-select-sm" aria-label={`Concepto cuota ${index + 1}`} value={item.id_concepto} onChange={(event) => setPlan({ ...plan, cuotas: plan.cuotas.map((row,i) => i === index ? { ...row,id_concepto:event.target.value } : row) })} required><option value="">Selecciona</option>{catalogs.conceptos.map((concept) => <option key={concept.id_concepto} value={concept.id_concepto}>{concept.nombre}</option>)}</select></td><td><input type="number" min="0.01" step="0.01" className="form-control form-control-sm" value={item.monto} onChange={(event) => setPlan({ ...plan, cuotas: plan.cuotas.map((row,i) => i === index ? { ...row,monto:event.target.value } : row) })} required /></td><td><input type="number" min="0" max="3650" className="form-control form-control-sm" value={item.dias_desde_inicio} onChange={(event) => setPlan({ ...plan, cuotas: plan.cuotas.map((row,i) => i === index ? { ...row,dias_desde_inicio:event.target.value } : row) })} required /></td></tr>)}</tbody><tfoot><tr><th colSpan="2">Total PEN</th><th>S/ {money(planTotal)}</th><th /></tr></tfoot></table></div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando...' : 'Crear plan'}</button>
      </form></div></div>
      <div className="col-xl-5"><div className="card mb-4"><div className="card-header fw-bold">Asignar plan a un estudiante matriculado</div><form className="card-body" onSubmit={assignPlan}>
        <label className="form-label" htmlFor="assign-plan">Plan</label><select id="assign-plan" className="form-select mb-3" value={assignment.id_plan_pago} onChange={(event) => setAssignment({ ...assignment,id_plan_pago:event.target.value })} required><option value="">Selecciona</option>{plans.filter((item) => item.estado === 'Activo').map((item) => <option key={item.id_plan_pago} value={item.id_plan_pago}>{item.codigo} · S/ {money(item.monto_total)}</option>)}</select>
        <label className="form-label" htmlFor="assign-period">Periodo matriculado</label><select id="assign-period" className="form-select mb-3" value={assignment.id_periodo} onChange={(event) => setAssignment({ ...assignment,id_periodo:event.target.value,id_estudiante:'' })} required><option value="">Selecciona</option>{catalogs.periodos.map((item) => <option key={item.id_periodo} value={item.id_periodo}>{item.codigo}</option>)}</select>
        <label className="form-label" htmlFor="assign-student">Estudiante con matrícula activa</label><select id="assign-student" className="form-select mb-3" value={assignment.id_estudiante} onChange={(event) => setAssignment({ ...assignment,id_estudiante:event.target.value })} required><option value="">Selecciona</option>{selectedPeriodStudents.map((item,index) => <option key={`${item.id_estudiante}-${index}`} value={item.id_estudiante}>{item.dni} · {item.apellidos}, {item.nombres}</option>)}</select>
        <label className="form-label" htmlFor="assign-start-date">Fecha inicial del cronograma</label><input id="assign-start-date" type="date" className="form-control mb-3" value={assignment.fecha_inicio} onChange={(event) => setAssignment({ ...assignment,fecha_inicio:event.target.value })} required />
        {isAdmin && (benefits.becas.length > 0 || benefits.descuentos.length > 0) && <div className="border rounded-3 p-3 mb-3"><div className="fw-semibold mb-2">Beneficios (solo activos; quedan autorizados al asignarlos)</div>{benefits.becas.filter((item) => item.estado === 'Activa').map((item) => <label className="d-block small mb-1" key={`b-${item.id_beca}`}><input className="form-check-input me-2" type="checkbox" checked={assignment.becas.includes(String(item.id_beca))} onChange={() => toggleBenefit('becas',String(item.id_beca))} />Beca: {item.nombre} ({item.tipo === 'Porcentaje' ? `${item.valor}%` : `S/ ${money(item.valor)}`})</label>)}{benefits.descuentos.filter((item) => item.estado === 'Activo').map((item) => <label className="d-block small mb-1" key={`d-${item.id_descuento}`}><input className="form-check-input me-2" type="checkbox" checked={assignment.descuentos.includes(String(item.id_descuento))} onChange={() => toggleBenefit('descuentos',String(item.id_descuento))} />Descuento: {item.nombre} ({item.tipo === 'Porcentaje' ? `${item.valor}%` : `S/ ${money(item.valor)}`})</label>)}</div>}
        <div className="small text-muted mb-3">Las cuotas se crean una sola vez. No se registra ningún pago automáticamente.</div><button className="btn btn-primary" disabled={busy}>{busy ? 'Asignando...' : 'Generar cronograma'}</button>
      </form></div>
      <div className="card"><div className="card-header fw-bold">Planes configurados</div><div className="list-group list-group-flush">{plans.map((item) => <div className="list-group-item" key={item.id_plan_pago}><div className="fw-semibold">{item.nombre}</div><div className="small text-muted">{item.codigo} · {item.modalidad} · {item.cuotas} cuotas · S/ {money(item.monto_total)} {item.moneda}</div></div>)}{!plans.length && <div className="list-group-item text-muted">No hay planes todavía.</div>}</div></div></div>
    </div>}

    {tab === 'beneficios' && <div className="row g-4">
      <div className="col-xl-5">{isAdmin ? <div className="card"><div className="card-header fw-bold">Configurar beca o descuento</div><form className="card-body" onSubmit={createBenefit}>
        <label className="form-label" htmlFor="benefit-class">Tipo</label><select id="benefit-class" className="form-select mb-3" value={benefitForm.clase} onChange={(event) => setBenefitForm({ ...benefitForm,clase:event.target.value })}><option value="beca">Beca</option><option value="descuento">Descuento</option></select>
        <label className="form-label" htmlFor="benefit-code">Código</label><input id="benefit-code" className="form-control mb-3" value={benefitForm.codigo} onChange={(event) => setBenefitForm({ ...benefitForm,codigo:event.target.value })} required />
        <label className="form-label" htmlFor="benefit-name">Nombre</label><input id="benefit-name" className="form-control mb-3" value={benefitForm.nombre} onChange={(event) => setBenefitForm({ ...benefitForm,nombre:event.target.value })} required />
        <div className="row g-2"><div className="col-6"><label className="form-label" htmlFor="benefit-type">Cálculo</label><select id="benefit-type" className="form-select" value={benefitForm.tipo} onChange={(event) => setBenefitForm({ ...benefitForm,tipo:event.target.value })}><option>Porcentaje</option><option>Monto</option></select></div><div className="col-6"><label className="form-label" htmlFor="benefit-value">{benefitForm.tipo === 'Porcentaje' ? 'Porcentaje' : 'Importe PEN'}</label><input id="benefit-value" type="number" min="0.01" max={benefitForm.tipo === 'Porcentaje' ? 100 : undefined} step="0.01" className="form-control" value={benefitForm.valor} onChange={(event) => setBenefitForm({ ...benefitForm,valor:event.target.value })} required /></div></div>
        <label className="form-label mt-3" htmlFor="benefit-description">Descripción</label><input id="benefit-description" className="form-control mb-3" value={benefitForm.descripcion} onChange={(event) => setBenefitForm({ ...benefitForm,descripcion:event.target.value })} maxLength="250" />
        <div className="row g-2 mb-3"><div className="col-6"><label className="form-label" htmlFor="benefit-from">Desde</label><input id="benefit-from" type="date" className="form-control" value={benefitForm.fecha_inicio} onChange={(event) => setBenefitForm({ ...benefitForm,fecha_inicio:event.target.value })} /></div><div className="col-6"><label className="form-label" htmlFor="benefit-until">Hasta</label><input id="benefit-until" type="date" className="form-control" value={benefitForm.fecha_fin} onChange={(event) => setBenefitForm({ ...benefitForm,fecha_fin:event.target.value })} /></div></div>
        <div className="small text-muted mb-3">La autorización se registra al asignar el beneficio a un plan. Solo administradores pueden configurar beneficios.</div><button className="btn btn-primary" disabled={busy}>Guardar beneficio</button>
      </form></div> : <div className="alert alert-info">Solo el rol Administrador puede configurar o autorizar beneficios.</div>}
      </div>
      <div className="col-xl-7"><div className="card mb-4"><div className="card-header fw-bold">Becas</div><div className="table-responsive"><table className="table mb-0"><thead><tr><th>Código</th><th>Nombre</th><th>Valor</th><th>Estado</th></tr></thead><tbody>{benefits.becas.map((item) => <tr key={item.id_beca}><td>{item.codigo}</td><td>{item.nombre}</td><td>{item.tipo === 'Porcentaje' ? `${item.valor}%` : `S/ ${money(item.valor)}`}</td><td>{item.estado}</td></tr>)}</tbody></table></div></div>
        <div className="card"><div className="card-header fw-bold">Descuentos</div><div className="table-responsive"><table className="table mb-0"><thead><tr><th>Código</th><th>Nombre</th><th>Valor</th><th>Estado</th></tr></thead><tbody>{benefits.descuentos.map((item) => <tr key={item.id_descuento}><td>{item.codigo}</td><td>{item.nombre}</td><td>{item.tipo === 'Porcentaje' ? `${item.valor}%` : `S/ ${money(item.valor)}`}</td><td>{item.estado}</td></tr>)}</tbody></table></div></div>
      </div>
    </div>}

    {tab === 'pagos' && <div className="row g-4">
      <div className="col-xl-5"><div className="card"><div className="card-header fw-bold">Registrar pago completo o parcial</div><form className="card-body" onSubmit={registerPayment}>
        <label className="form-label" htmlFor="payment-student">Estudiante matriculado</label><select id="payment-student" className="form-select mb-3" value={paymentStudent} onChange={(event) => setPaymentStudent(event.target.value)} required><option value="">Selecciona</option>{paymentStudents.map((item) => <option key={item.id_estudiante} value={item.id_estudiante}>{item.dni} · {item.apellidos}, {item.nombres}</option>)}</select>
        <label className="form-label" htmlFor="payment-method">Método</label><select id="payment-method" className="form-select mb-3" value={payment.metodo} onChange={(event) => setPayment({ ...payment,metodo:event.target.value })}>{['Efectivo','Transferencia','Depósito','Tarjeta','Otro'].map((value) => <option key={value}>{value}</option>)}</select>
        <label className="form-label" htmlFor="payment-reference">Referencia (opcional)</label><input id="payment-reference" className="form-control mb-3" value={payment.referencia} onChange={(event) => setPayment({ ...payment,referencia:event.target.value })} maxLength="80" />
        <div className="alert alert-light border">Total a registrar: <strong>S/ {money(paymentTotal)}</strong></div><button className="btn btn-primary" disabled={busy || paymentTotal <= 0}>{busy ? 'Registrando...' : 'Registrar pago aplicado'}</button>
      </form></div></div>
      <div className="col-xl-7"><div className="card"><div className="card-header fw-bold">Saldos disponibles para aplicar</div><div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr><th>Obligación</th><th>Periodo</th><th>Vence</th><th>Estado</th><th>Saldo</th><th>Aplicar S/</th></tr></thead><tbody>
        {schedule.filter((item) => Number(item.saldo) > 0 && item.estado_calculado !== 'Anulada').map((item) => <tr key={item.id_obligacion}><td>{item.concepto}</td><td>{item.periodo}</td><td>{String(item.fecha_vencimiento).slice(0,10)}</td><td>{item.estado_calculado}</td><td>S/ {money(item.saldo)}</td><td><input aria-label={`Aplicar a obligación ${item.id_obligacion}`} className="form-control form-control-sm" type="number" min="0" max={item.saldo} step="0.01" value={allocations[item.id_obligacion] || ''} onChange={(event) => setAllocations({ ...allocations,[item.id_obligacion]:event.target.value })} /></td></tr>)}
        {!schedule.some((item) => Number(item.saldo) > 0 && item.estado_calculado !== 'Anulada') && <tr><td colSpan="6" className="text-center text-muted py-3">Elige un estudiante con saldo pendiente.</td></tr>}
      </tbody></table></div></div></div>
    </div>}
  </div>;
}
