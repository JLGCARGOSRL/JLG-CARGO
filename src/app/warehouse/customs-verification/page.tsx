'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSearch,
  Search,
  ShieldCheck,
} from 'lucide-react'

import { useAuth } from '../../../contexts/authContext'
import {
  getCustomsVerificationQueue,
  setCustomsVerification,
  type CustomsVerificationRecord,
  type CustomsVerificationStatus,
} from '../../../lib/services/customsVerificationService'

type Filter = 'pending' | 'verified' | 'held' | 'all'

const statusText: Record<CustomsVerificationStatus, string> = {
  pending: 'Pendiente de Aduanas',
  verified: 'Verificado por Aduanas',
  held: 'Retenido por Aduanas',
}

const statusClass: Record<CustomsVerificationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  verified: 'bg-emerald-100 text-emerald-800',
  held: 'bg-red-100 text-red-800',
}

function customerName(row: CustomsVerificationRecord) {
  return row.customers?.company_name || row.customers?.legal_name || 'Cliente sin nombre'
}

function readyForCustoms(row: CustomsVerificationRecord) {
  return Boolean(
    row.reception_complete &&
      row.reconciliation_status !== 'pending' &&
      row.status === 'available' &&
      row.location_id &&
      !row.has_visible_damage
  )
}

function previousStepReason(row: CustomsVerificationRecord) {
  if (!row.reception_complete || row.reconciliation_status === 'pending') {
    return 'Recepción pendiente'
  }
  if (row.has_visible_damage || ['received', 'inspection', 'pending_documents'].includes(row.status)) {
    return 'Inspección pendiente o con incidencia'
  }
  if (!row.location_id) return 'Ubicación de almacén pendiente'
  return 'No disponible para verificación'
}

export default function CustomsVerificationPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<CustomsVerificationRecord[]>([])
  const [selected, setSelected] = useState<CustomsVerificationRecord | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await getCustomsVerificationQueue())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la verificación de Aduanas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    getCustomsVerificationQueue()
      .then((result) => {
        if (active) setRows(result)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar la verificación de Aduanas.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const queue = useMemo(() => rows.filter((row) => readyForCustoms(row)), [rows])
  const counts = useMemo(
    () => ({
      pending: queue.filter((row) => row.customs_status === 'pending').length,
      verified: queue.filter((row) => row.customs_status === 'verified').length,
      held: queue.filter((row) => row.customs_status === 'held').length,
    }),
    [queue]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter !== 'all' && row.customs_status !== filter) return false
      if (filter !== 'all' && !readyForCustoms(row)) return false
      return (
        !query ||
        [
          row.wr_number,
          row.warehouse_manifest_items?.document_number,
          row.warehouse_manifest_items?.house_bl,
          row.warehouse_manifests?.manifest_number,
          row.warehouse_manifests?.master_bl,
          row.warehouse_manifests?.container_number,
          customerName(row),
          row.customers?.customer_code,
          row.customs_reference,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    })
  }, [filter, rows, search])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    const status = String(form.get('status')) as CustomsVerificationStatus
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await setCustomsVerification({
        receiptId: selected.id,
        status,
        reference: String(form.get('reference') || ''),
        notes: String(form.get('notes') || ''),
        operatorName: String(form.get('operator') || ''),
      })
      setSuccess(
        status === 'verified'
          ? `${selected.wr_number} quedó verificado y habilitado para facturación y despacho.`
          : status === 'held'
            ? `${selected.wr_number} quedó retenido y no podrá despacharse.`
            : `${selected.wr_number} volvió a la cola de verificación.`
      )
      setSelected(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la verificación.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-700">
            <ShieldCheck size={18} /> Etapa 4 del proceso
          </div>
          <h1 className="text-3xl font-bold text-slate-950">Verificación de Aduanas</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Valida la carga después de la recepción, inspección y almacenaje. Solo los BL verificados pasan a facturación y despacho.
          </p>
        </div>
        <div className="relative w-full xl:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar BL, WR, manifiesto, cliente o contenedor…" className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
      </header>

      {error && <Notice tone="red">{error}</Notice>}
      {success && <Notice tone="green">{success}</Notice>}

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={Clock3} label="Pendientes" value={counts.pending} tone="amber" />
        <Metric icon={CheckCircle2} label="Verificados" value={counts.verified} tone="emerald" />
        <Metric icon={AlertTriangle} label="Retenidos" value={counts.held} tone="red" />
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-slate-950">Control aduanal por BL</h2>
            <p className="text-sm text-slate-500">La referencia y el responsable quedan guardados en la trazabilidad.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === 'pending'} onClick={() => setFilter('pending')}>Pendientes</FilterButton>
            <FilterButton active={filter === 'verified'} onClick={() => setFilter('verified')}>Verificados</FilterButton>
            <FilterButton active={filter === 'held'} onClick={() => setFilter('held')}>Retenidos</FilterButton>
            <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Todos</FilterButton>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Cargando control aduanal…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500"><FileSearch className="mx-auto mb-3" />No hay cargas para este filtro.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="p-4">BL / WR</th><th className="p-4">Cliente</th><th className="p-4">Manifiesto</th><th className="p-4">Almacén</th><th className="p-4">Estado</th><th className="p-4">Referencia</th><th className="p-4">Acción</th></tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row) => {
                  const ready = readyForCustoms(row)
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="p-4"><div className="font-bold text-slate-950">{row.warehouse_manifest_items?.document_number || '-'}</div><Link href={`/warehouse/receipts/${row.id}`} className="text-xs font-semibold text-blue-700 hover:underline">{row.wr_number}</Link></td>
                      <td className="p-4"><div className="font-medium text-slate-900">{customerName(row)}</div><div className="text-xs text-slate-500">{row.customers?.customer_code || '-'}</div></td>
                      <td className="p-4"><div>{row.warehouse_manifests?.manifest_number || '-'}</div><div className="text-xs text-slate-500">Master: {row.warehouse_manifests?.master_bl || '-'}</div></td>
                      <td className="p-4"><div>{Number(row.pieces).toLocaleString('es-DO')} bultos</div><div className="text-xs text-slate-500">{row.warehouse_locations?.code || 'Sin ubicación'}</div></td>
                      <td className="p-4">{ready ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass[row.customs_status]}`}>{statusText[row.customs_status]}</span> : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{previousStepReason(row)}</span>}</td>
                      <td className="p-4"><div>{row.customs_reference || '-'}</div>{row.customs_verified_by && <div className="text-xs text-slate-500">{row.customs_verified_by}</div>}</td>
                      <td className="p-4">{ready ? <button onClick={() => { setSelected(row); setSuccess('') }} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">{row.customs_status === 'pending' ? 'Verificar' : 'Actualizar'}</button> : <Link href={`/warehouse/receipts/${row.id}`} className="text-xs font-bold text-blue-700 hover:underline">Completar etapa anterior</Link>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
          <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-wider text-blue-700">Verificación de Aduanas</div><h2 className="mt-1 text-xl font-bold text-slate-950">{selected.warehouse_manifest_items?.document_number || selected.wr_number}</h2><p className="mt-1 text-sm text-slate-500">{customerName(selected)} · {selected.wr_number}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Cerrar</button></div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold">Resultado *<select name="status" defaultValue={selected.customs_status} className="mt-1 w-full rounded-xl border px-3 py-2.5"><option value="verified">Verificado — habilitar facturación y despacho</option><option value="held">Retenido — bloquear salida</option><option value="pending">Pendiente — devolver a revisión</option></select></label>
              <label className="block text-sm font-semibold">Referencia de Aduanas<input name="reference" defaultValue={selected.customs_reference || ''} placeholder="Ej. declaración, levante o autorización" className="mt-1 w-full rounded-xl border px-3 py-2.5" /></label>
              <label className="block text-sm font-semibold">Observaciones<textarea name="notes" defaultValue={selected.customs_notes || ''} rows={3} placeholder="Incidencias, restricciones o notas del proceso" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
              <label className="block text-sm font-semibold">Responsable *<input name="operator" required defaultValue={profile?.full_name || profile?.email || ''} className="mt-1 w-full rounded-xl border px-3 py-2.5" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button><button disabled={saving} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar verificación'}</button></div>
          </form>
        </div>
      )}
    </div>
  )
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-lg px-3 py-2 text-xs font-bold ${active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{children}</button>
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: number; tone: 'amber' | 'emerald' | 'red' }) {
  const colors = { amber: 'bg-amber-50 text-amber-700', emerald: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700' }
  return <div className="flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm"><div className={`rounded-xl p-3 ${colors[tone]}`}><Icon size={22} /></div><div><div className="text-2xl font-bold text-slate-950">{value}</div><div className="text-sm text-slate-500">{label}</div></div></div>
}

function Notice({ tone, children }: { tone: 'red' | 'green'; children: React.ReactNode }) {
  return <div className={`rounded-xl border p-4 text-sm ${tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</div>
}
