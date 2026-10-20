'use client';

import Link from 'next/link';
import QuotationServices from '../../components/quotationServices';
import { useEffect, useState, type ReactNode } from 'react';
import { BASES, OPERATIONS, PRESENTATIONS, cargoTotals, money, newCargo, newDraft, quantity, provisionalStructure, totals, validate, type Company, type Quote, type QuoteDraft } from '../../lib/quotations/model';
import { getQuotationCompanies, getQuotations, saveQuotation } from '../../lib/services/quotationService';

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
const button = 'rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40';
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1 text-sm font-medium text-slate-600"><span>{label}</span>{children}</label>;
}
function Numeric({ label, value, onChange, nullable = false, integer = false }: { label: string; value: number | null; onChange: (value: number | null) => void; nullable?: boolean; integer?: boolean }) {
  return <Field label={label}><input className={input} type="number" min="0" step={integer ? '1' : 'any'} value={value ?? ''} placeholder={nullable ? 'Pendiente' : '0'} onChange={e => onChange(e.target.value === '' && nullable ? null : Number(e.target.value))} /></Field>;
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">{title}</h2>{children}</section>;
}
export default function QuotationsPage() {
  const [draft, setDraft] = useState<QuoteDraft>(newDraft);
  const [existing, setExisting] = useState<Quote>();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    let live = true;
    async function load() {
      const results = await Promise.allSettled([getQuotationCompanies(), getQuotations()]);
      if (!live) return;
      if (results[0].status === 'fulfilled') setCompanies(results[0].value);
      if (results[1].status === 'fulfilled') setQuotes(results[1].value);
      setError(results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason.message).join(' '));
      setLoading(false);
    }
    void load();
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function change(values: Partial<QuoteDraft>) { setDraft(d => ({ ...d, ...values })); setDirty(true); setNotice(''); }
  function reset() { setExisting(undefined); setDraft(newDraft()); setDirty(false); setNotice(''); setPreview(false); }
  function open(q: Quote) { setDraft(q); setExisting(q); setDirty(false); setPreview(false); setNotice(''); setError(''); }
  const company = companies.find(c => c.id === draft.customer_id);
  const filtered = companies.filter(c => `${c.company_name || ''} ${c.tax_id || ''}`.toLowerCase().includes(search.toLowerCase()));
  const summary = totals(draft);
  const cargo = cargoTotals(draft.cargo);
  const format = (value: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: draft.currency }).format(value);
  async function save() {
    setError(''); setNotice('');
    const problem = validate(draft);
    if (problem) { setError(problem); return; }
    if (!company) { setError('Selecciona una empresa del registro de JLG-Net.'); return; }
    setSaving(true);
    try {
      const saved = await saveQuotation(draft, existing);
      setExisting(saved); setDraft(saved); setDirty(false);
      setQuotes(q => [saved, ...q.filter(item => item.id !== saved.id)]);
      setNotice(`Borrador COT-${saved.number} guardado en JLG-Net.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  }
  function showPreview() {
    const problem = validate(draft);
    if (problem || !company || summary.pendingPrice || !draft.valid_until) {
      setError(problem || (!company ? 'Selecciona una empresa registrada.' : summary.pendingPrice ? 'Completa los precios de venta antes de generar la vista comercial.' : 'Indica la vigencia de la cotización.')); return;
    }
    setError(''); setPreview(true);
  }
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-500">JLG-Net · Comercial</p><h1 className="text-3xl font-bold text-slate-900">Cotizaciones</h1><p className="mt-2 text-slate-600">Una cotización por contenedor para la empresa contratante.</p></div><button className={button} disabled={dirty || saving} onClick={reset}>Nueva cotización</button></header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
    {notice && <div role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">{notice}</div>}
    {loading ? <p role="status">Cargando empresas y cotizaciones…</p> : <>
      <Panel title="Cotizaciones recientes (hasta 100)"><p className="text-sm text-slate-500">{dirty ? 'Guarda los cambios antes de abrir otra cotización o crear una nueva.' : 'Abre una cotización para consultar o editar su borrador.'}</p><div className="flex max-h-48 flex-wrap gap-2 overflow-auto">{quotes.length ? quotes.map(q => <button key={q.id} disabled={dirty || saving} className={button} onClick={() => open(q)}>COT-{q.number} · {companies.find(c => c.id === q.customer_id)?.company_name || 'Empresa registrada'} · {q.shipment.container || 'Sin contenedor'}</button>) : <p className="text-sm text-slate-500">No hay cotizaciones guardadas.</p>}</div></Panel>
      <fieldset disabled={saving} className="space-y-6 disabled:opacity-60">
      <Panel title="1. Empresa contratante registrada">
        <div className="grid gap-4 md:grid-cols-2"><Field label="Buscar por nombre o RNC"><input className={input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa existente" /></Field><Field label="Empresa obligatoria"><select className={input} value={draft.customer_id} onChange={e => change({ customer_id: e.target.value })}><option value="">Seleccionar empresa registrada</option>{[...new Map([...filtered, ...(company ? [company] : [])].map(c => [c.id, c])).values()].map(c => <option key={c.id} value={c.id}>{c.company_name} · {c.tax_id || 'Sin RNC'}</option>)}</select></Field></div>
        {company && <p className="text-sm text-blue-800">Facturar a: {company.company_name} · RNC: {company.tax_id || 'Sin registrar'}</p>}
        <p className="text-sm text-slate-500">Si la empresa no existe, debe registrarse primero en <Link className="font-semibold text-blue-700 underline" href="/customers/new">Empresas / Clientes</Link>.</p>
      </Panel>
      <fieldset disabled={!company} className="space-y-6 disabled:opacity-50">
      <Panel title="2. Operación y contenedor">
        <p className="text-sm text-amber-800">Cambiar operación o presentación carga una estructura nueva en DOP con referencias provisionales MARDOM y reemplaza los cargos actuales.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Operación"><select className={input} value={draft.operation} onChange={e => { const operation = e.target.value as QuoteDraft['operation']; change({ operation, currency: 'DOP', charges: provisionalStructure(operation, draft.presentation) }); }}>{Object.entries(OPERATIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="Presentación"><select className={input} value={draft.presentation} onChange={e => { const presentation = e.target.value as QuoteDraft['presentation']; change({ presentation, currency: 'DOP', charges: provisionalStructure(draft.operation, presentation) }); }}>{Object.entries(PRESENTATIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="Tamaño / tipo"><select className={input} value={draft.shipment.size} onChange={e => change({ shipment: { ...draft.shipment, size: e.target.value } })}>{['20', '40', '40HC', '45HC', 'Otro'].map(v => <option key={v}>{v}</option>)}</select></Field>
          {([['container', 'Número de contenedor'], ['master_bl', 'BL madre'], ['manifest', 'Número de manifiesto'], ['port', 'Puerto / ruta']] as const).map(([key, label]) => <Field key={key} label={label}><input className={input} value={draft.shipment[key]} onChange={e => change({ shipment: { ...draft.shipment, [key]: e.target.value } })} /></Field>)}
          <Numeric label="Despachos previstos" integer value={draft.shipment.dispatches} onChange={v => change({ shipment: { ...draft.shipment, dispatches: v ?? 0 } })} />
          <Field label="Moneda de toda la cotización"><select className={input} value={draft.currency} onChange={e => change({ currency: e.target.value as QuoteDraft['currency'], charges: draft.charges.map(c => ({ ...c, cost: null, price: null })) })}><option>USD</option><option>DOP</option></select></Field>
          <Field label="Válida hasta"><input className={input} type="date" value={draft.valid_until} onChange={e => change({ valid_until: e.target.value })} /></Field>
        </div><p className="text-sm text-slate-500">Los documentos pueden completarse después en el borrador. Cambiar moneda deja las tarifas pendientes; no convierte importes.</p>
      </Panel>
      <Panel title="3. Detalle por HBL">
        <p className="text-sm text-slate-500">Los HBL identifican la carga. El total se cotiza a la empresa por su contenedor completo. En carga mixta registra paletas y cajas sueltas; evita contar una misma unidad dos veces.</p>
        {draft.cargo.map((item, index) => <div key={item.id} className="space-y-3 rounded-xl border bg-slate-50 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Carga {index + 1}</h3><button className={button} onClick={() => change({ cargo: draft.cargo.filter(c => c.id !== item.id) })}>Quitar carga</button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([['hbl', 'HBL'], ['consignee', 'Consignatario'], ['content', 'Contenido del BL']] as const).map(([key, label]) => <Field key={key} label={label}><input className={input} value={item[key]} onChange={e => change({ cargo: draft.cargo.map(c => c.id === item.id ? { ...c, [key]: e.target.value } : c) })} /></Field>)}
          {([['boxes', 'Cajas / bultos'], ['kg', 'Peso kg'], ['m3', 'Volumen M³'], ['pallets', 'Paletas']] as const).map(([key, label]) => <Numeric key={key} label={label} integer={key === 'boxes' || key === 'pallets'} value={item[key]} onChange={v => change({ cargo: draft.cargo.map(c => c.id === item.id ? { ...c, [key]: v ?? 0 } : c) })} />)}
        </div></div>)}
        <button className={button} onClick={() => change({ cargo: [...draft.cargo, newCargo()] })}>+ Agregar HBL / carga</button>
        <p className="font-semibold text-slate-700">Totales: {cargo.boxes} cajas/bultos · {cargo.pallets} paletas · {cargo.kg.toFixed(3)} kg · {cargo.m3.toFixed(3)} M³</p>
      </Panel>
      <Panel title="4. Servicios a cotizar">
        <QuotationServices draft={draft} onChange={change} />
      </Panel>
      <Panel title="5. Resumen del contenedor">
        <div className="grid gap-4 sm:grid-cols-3">{[['Subtotal de venta', summary.pendingPrice ? 'Pendiente' : format(summary.subtotal)], ['Impuestos', summary.pendingPrice ? 'Pendiente' : format(summary.tax)], ['Total de cotización', summary.pendingPrice ? 'Pendiente' : format(summary.total)]].map(([label, value]) => <div className="rounded-xl bg-slate-50 p-4" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>
        <details className="text-sm text-slate-500"><summary className="cursor-pointer">Ver costo y margen interno</summary><p className="mt-2">Costo: {summary.pendingCost ? 'Pendiente' : format(summary.cost)} · Margen antes de impuestos: {summary.pendingCost || summary.pendingPrice || !summary.subtotal ? 'Pendiente' : `${summary.margin.toFixed(2)}%`}</p></details>
        <div className="flex flex-wrap gap-3"><button className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-40" disabled={saving || !company} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar borrador'}</button><button className={button} onClick={showPreview}>Vista comercial</button>{dirty && <><span className="self-center text-sm text-amber-800">Cambios sin guardar</span><button className={button} onClick={() => { if (window.confirm("¿Descartar los cambios sin guardar?")) { if (existing) open(existing); else reset(); } }}>Descartar cambios</button></>}</div>
      </Panel>
      </fieldset></fieldset>
    </>}
    {preview && company && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4"><div className="mx-auto max-w-4xl space-y-5 rounded-2xl bg-white p-6"><div className="flex justify-between"><h2 className="text-xl font-bold">Vista comercial</h2><button className={button} onClick={() => setPreview(false)}>Cerrar</button></div><p className="text-sm text-amber-800">Borrador para revisión. {dirty ? 'Hay cambios sin guardar.' : ''}</p><h3 className="text-2xl font-bold">JLG LOGISTICS WAREHOUSE · {existing ? `COT-${existing.number}` : 'Sin guardar'}</h3><p>{company.company_name} · RNC {company.tax_id || 'Sin registrar'}</p><p>{OPERATIONS[draft.operation]} · {PRESENTATIONS[draft.presentation]} · {draft.shipment.size}</p><p>Contenedor: {draft.shipment.container || 'Por asignar'} · BL madre: {draft.shipment.master_bl || 'Por asignar'} · Manifiesto: {draft.shipment.manifest || 'Por asignar'}</p><p>Válida hasta: {draft.valid_until} · Moneda: {draft.currency}</p><div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Concepto</th><th className="p-2">Cantidad / base</th><th className="p-2">Tarifa</th><th className="p-2">Importe</th></tr></thead><tbody>{draft.charges.map(c => <tr key={c.id} className="border-b"><td className="p-2">{c.name}<p className="text-xs text-slate-500">{c.notes}</p>{(c.included > 0 || c.minimum > 0) && <p className="text-xs text-slate-500">Unidades incluidas: {c.included} · Mínimo facturable: {c.minimum}</p>}</td><td className="p-2">{quantity(c, draft)} / {BASES[c.basis]}</td><td className="p-2">{format(c.price ?? 0)}</td><td className="p-2">{format(money(quantity(c, draft) * (c.price ?? 0)))}</td></tr>)}</tbody></table></div><p className="text-right">Subtotal: {format(summary.subtotal)} · Impuestos: {format(summary.tax)}</p><p className="text-right text-xl font-bold">Total: {format(summary.total)}</p>{draft.conditions.trim() && <p className="whitespace-pre-wrap text-sm">{draft.conditions}</p>}</div></div>}
  </div>;
}
