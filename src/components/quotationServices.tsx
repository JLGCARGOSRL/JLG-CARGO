'use client';

import { Fragment, useState } from 'react';
import { SlidersHorizontal, Trash2 } from 'lucide-react';
import { BASES, money, newCharge, tariffStructure, quantity, type Charge, type QuoteDraft } from '../lib/quotations/model';

const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
const extraServices = ['Paletización y materiales', 'Transporte', 'Retorno de contenedor', 'Pesaje / VGM', 'Horas extras'];

export default function QuotationServices({ draft, onChange }: { draft: QuoteDraft; onChange: (values: Partial<QuoteDraft>) => void }) {
  const [selected, setSelected] = useState('');
  const [customName, setCustomName] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const catalog = [...tariffStructure(draft.operation, draft.presentation), ...extraServices.map(name => newCharge(name, 'manual'))];
  const format = (n: number) => new Intl.NumberFormat('es-DO', { style: 'currency', currency: draft.currency }).format(n);
  function update(id: string, values: Partial<Charge>) {
    onChange({ charges: draft.charges.map(line => line.id === id ? { ...line, ...values } : line) });
  }
  function add() {
    const template = selected === 'custom' ? newCharge(customName.trim(), 'manual') : catalog.find(line => line.name === selected);
    if (!template || !template.name) return;
    const line = { ...template, id: crypto.randomUUID() };
    if (draft.currency !== 'DOP') line.price = null;
    onChange({ charges: [...draft.charges, line] });
    setSelected(''); setCustomName('');
  }
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">Servicio
        <select className={`${input} mt-1`} value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Seleccionar servicio…</option>
          {catalog.map(line => {
            const added = draft.charges.some(c => c.name === line.name);
            return <option key={line.name} value={line.name} disabled={added}>{line.name}{added ? ' · Ya agregado' : line.price !== null && draft.currency === 'DOP' ? ` · ${format(line.price)}` : ''}</option>;
          })}
          <option value="custom">Otro servicio…</option>
        </select>
      </label>
      {selected === 'custom' && <label className="flex-1 text-sm font-medium text-slate-700">Nombre del servicio<input className={`${input} mt-1`} value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Escribir servicio" /></label>}
      <button type="button" className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!selected || (selected === 'custom' && !customName.trim())} onClick={add}>+ Agregar</button>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Servicio</th><th className="w-28 px-3 py-3">Cantidad</th><th className="w-36 px-3 py-3">Precio {draft.currency}</th><th className="w-36 px-3 py-3 text-right">Importe</th><th className="w-24 px-3 py-3"><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {draft.charges.map(line => <Fragment key={line.id}>
            <tr>
              <td className="px-4 py-3 font-medium text-slate-800">{line.name}{line.basis !== 'manual' && <span className="mt-0.5 block text-xs font-normal text-slate-500">Por {BASES[line.basis].toLowerCase()}</span>}</td>
              <td className="px-3 py-2">{line.basis === 'manual' ? <input aria-label={`Cantidad de ${line.name}`} className={input} type="number" min="0" step="any" value={line.quantity} onChange={e => update(line.id, { quantity: Number(e.target.value) })} /> : <span className="block px-3 py-2" title="Calculada con los datos del contenedor">{quantity(line, draft)}</span>}</td>
              <td className="px-3 py-2"><input aria-label={`Precio de ${line.name}`} className={input} type="number" min="0" step="any" value={line.price ?? ''} placeholder="Pendiente" onChange={e => update(line.id, { price: e.target.value === '' ? null : Number(e.target.value) })} /></td>
              <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900">{line.price === null ? <span className="text-amber-700">Pendiente</span> : format(money(quantity(line, draft) * line.price))}</td>
              <td className="px-3 py-2"><div className="flex justify-end gap-1"><button type="button" aria-label={`Ajustes de ${line.name}`} title="Opciones del servicio" aria-expanded={expanded === line.id} className={`rounded-lg p-2 ${expanded === line.id ? 'bg-blue-50 text-blue-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`} onClick={() => setExpanded(expanded === line.id ? null : line.id)}><SlidersHorizontal size={16} /></button><button type="button" aria-label={`Quitar ${line.name}`} title="Quitar servicio" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700" onClick={() => onChange({ charges: draft.charges.filter(c => c.id !== line.id) })}><Trash2 size={16} /></button></div></td>
            </tr>
            {expanded === line.id && <tr><td colSpan={5} className="bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-medium text-slate-600">Nombre<input className={`${input} mt-1`} value={line.name} onChange={e => update(line.id, { name: e.target.value })} /></label>
                <label className="text-xs font-medium text-slate-600">Cobrar por<select className={`${input} mt-1`} value={line.basis} onChange={e => update(line.id, { basis: e.target.value as Charge['basis'] })}>{Object.entries(BASES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                {(['cost', 'tax', 'included', 'minimum'] as const).map(key => <label key={key} className="text-xs font-medium text-slate-600">{{ cost: `Costo interno ${draft.currency}`, tax: 'Impuesto %', included: 'Unidades incluidas', minimum: 'Cantidad mínima' }[key]}<input className={`${input} mt-1`} type="number" min="0" max={key === 'tax' ? 100 : undefined} step="any" placeholder={key === 'cost' ? 'Pendiente' : '0'} value={line[key] ?? ''} onChange={e => update(line.id, { [key]: e.target.value === '' && key === 'cost' ? null : Number(e.target.value) })} /></label>)}
                <label className="text-xs font-medium text-slate-600 sm:col-span-2">Notas / alcance<input className={`${input} mt-1`} value={line.notes} onChange={e => update(line.id, { notes: e.target.value })} /></label>
              </div>
              <p className="mt-3 text-xs text-slate-500">Cantidad facturable: {quantity(line, draft)}</p>
            </td></tr>}
          </Fragment>)}
          {!draft.charges.length && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Selecciona un servicio para comenzar.</td></tr>}
        </tbody>
      </table>
    </div>
    <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium text-slate-600">Condiciones de la cotización</summary><label className="mt-3 block text-sm text-slate-600">Condiciones, servicios incluidos y exclusiones<textarea className={`${input} mt-1`} rows={3} value={draft.conditions} onChange={e => onChange({ conditions: e.target.value })} /></label></details>
  </div>;
}
