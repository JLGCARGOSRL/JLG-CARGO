'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

import {
  confirmBlReceipt,
  getManifestCheckIn,
  RECONCILIATION_STATUS_LABELS,
  type ConfirmBlReceiptPayload,
  type ManifestBlCheckInRow,
  type ManifestCheckInSummary,
  type ReceiptReconciliationStatus,
} from '../../../../../lib/services/receiptCheckInService'
import type {
  CargoCondition,
  WarehouseLocationOption,
} from '../../../../../lib/services/receiptService'

const CONDITIONS: { value: CargoCondition; label: string }[] = [
  { value: 'good', label: 'Buen estado' },
  { value: 'unknown', label: 'Sin verificar' },
  { value: 'partial_damage', label: 'Daño parcial' },
  { value: 'damaged', label: 'Dañada' },
  { value: 'open_box', label: 'Caja abierta' },
  { value: 'missing_pieces', label: 'Faltan piezas' },
  { value: 'wet', label: 'Mojada' },
]

const initialForm: ConfirmBlReceiptPayload = {
  receipt_id: '',
  received_pieces: 0,
  received_weight_kg: 0,
  cargo_condition: 'good',
  has_visible_damage: false,
  damage_notes: '',
  location_id: '',
  operator_name: '',
  notes: '',
  reception_complete: true,
}

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('es-DO')
}

function statusClass(status: ReceiptReconciliationStatus) {
  if (status === 'correct') return 'bg-emerald-100 text-emerald-800'
  if (status === 'pending') return 'bg-slate-100 text-slate-700'
  if (status === 'partial') return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

export default function ManifestReceiptCheckInPage() {
  const params = useParams<{ manifestId: string }>()
  const manifestId = params.manifestId

  const [summary, setSummary] = useState<ManifestCheckInSummary | null>(null)
  const [locations, setLocations] = useState<WarehouseLocationOption[]>([])
  const [selected, setSelected] = useState<ManifestBlCheckInRow | null>(null)
  const [form, setForm] = useState<ConfirmBlReceiptPayload>(initialForm)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadManifest() {
      try {
        setLoading(true)
        setError(null)
        const data = await getManifestCheckIn(manifestId)

        if (!mounted) return
        setSummary(data.summary)
        setLocations(data.locations)
      } catch (err) {
        if (!mounted) return
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la recepción del manifiesto.'
        )
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadManifest()
    return () => {
      mounted = false
    }
  }, [manifestId])

  const filteredRows = useMemo(() => {
    if (!summary) return []
    const query = search.trim().toLowerCase()
    if (!query) return summary.rows

    return summary.rows.filter((row) =>
      [
        row.document_number,
        row.house_bl,
        row.wr_number,
        row.customer_name,
        row.customer_code,
        row.cargo_description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [search, summary])

  function openConfirmation(row: ManifestBlCheckInRow) {
    if (!row.receipt_id) {
      setError(`El BL ${row.document_number} no tiene un WR asociado.`)
      return
    }

    setSelected(row)
    setFormError(null)
    setSuccess(null)
    setForm({
      receipt_id: row.receipt_id,
      received_pieces:
        row.reconciliation_status === 'pending'
          ? row.expected_pieces
          : row.received_pieces,
      received_weight_kg:
        row.reconciliation_status === 'pending'
          ? row.expected_weight_kg
          : row.received_weight_kg,
      cargo_condition:
        row.reconciliation_status === 'pending' ? 'good' : row.cargo_condition,
      has_visible_damage: row.has_visible_damage,
      damage_notes: row.damage_notes || '',
      location_id: row.location_id || '',
      operator_name: row.confirmed_by_name || '',
      notes: row.notes || '',
      reception_complete:
        row.reconciliation_status === 'pending' ? true : row.reception_complete,
    })
  }

  function updateForm<K extends keyof ConfirmBlReceiptPayload>(
    key: K,
    value: ConfirmBlReceiptPayload[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!form.operator_name.trim()) {
      setFormError('Debes indicar el nombre del operador responsable.')
      return
    }

    if (form.received_pieces < 0 || form.received_weight_kg < 0) {
      setFormError('Los bultos y el peso no pueden ser negativos.')
      return
    }

    if (form.has_visible_damage && !form.damage_notes.trim()) {
      setFormError('Describe los daños visibles encontrados.')
      return
    }

    try {
      setSaving(true)
      await confirmBlReceipt(form)
      const blNumber = selected?.document_number || 'seleccionado'
      const data = await getManifestCheckIn(manifestId)
      setSummary(data.summary)
      setLocations(data.locations)
      setSelected(null)
      setSuccess(`La recepción del BL ${blNumber} fue registrada.`)
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo confirmar la recepción.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading && !summary) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl border bg-white p-6 text-sm text-slate-500 shadow-sm">
          Cargando BL del manifiesto...
        </div>
      </main>
    )
  }

  if (!summary) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error || 'No se encontró el manifiesto.'}
          </div>
          <Link href="/warehouse/receipts/check-in" className="inline-flex rounded-xl border bg-white px-4 py-2 text-sm font-semibold">
            Volver
          </Link>
        </div>
      </main>
    )
  }

  const manifest = summary.manifest
  const pieceDifference = summary.rows
    .filter((row) => row.reconciliation_status !== 'pending')
    .reduce((total, row) => total + row.piece_difference, 0)

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Entrada por BL</p>
            <h1 className="text-3xl font-bold text-slate-900">{manifest.manifest_number}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Master BL {manifest.master_bl} · Contenedor {manifest.container_number || '-'}
            </p>
          </div>
          <Link href="/warehouse/receipts/check-in" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Volver a manifiestos
          </Link>
        </header>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi label="BL recibidos" value={`${summary.processed_bls} / ${summary.total_bls}`} />
          <Kpi label="Progreso" value={`${summary.progress}%`} />
          <Kpi label="Bultos esperados" value={formatNumber(summary.expected_pieces)} />
          <Kpi label="Bultos recibidos" value={formatNumber(summary.received_pieces)} />
          <Kpi label="Diferencia" value={pieceDifference > 0 ? `+${pieceDifference}` : String(pieceDifference)} danger={pieceDifference !== 0} />
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">BL del manifiesto</h2>
              <p className="text-sm text-slate-500">Confirma cada línea y corrige cualquier diferencia encontrada.</p>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar BL, WR o cliente..."
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 sm:w-80"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-[1250px] w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th className="border-b px-3 py-3">Línea / BL</th>
                  <th className="border-b px-3 py-3">Cliente</th>
                  <th className="border-b px-3 py-3">WR</th>
                  <th className="border-b px-3 py-3 text-right">Esperados</th>
                  <th className="border-b px-3 py-3 text-right">Recibidos</th>
                  <th className="border-b px-3 py-3 text-right">Diferencia</th>
                  <th className="border-b px-3 py-3">Estado</th>
                  <th className="border-b px-3 py-3">Confirmación</th>
                  <th className="border-b px-3 py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.manifest_item_id} className="align-top hover:bg-slate-50">
                    <td className="border-b px-3 py-3">
                      <div className="font-semibold text-slate-900">{row.line_number}. {row.document_number}</div>
                      <div className="max-w-64 truncate text-xs text-slate-500">{row.cargo_description}</div>
                    </td>
                    <td className="border-b px-3 py-3">
                      <div className="font-medium text-slate-900">{row.customer_name}</div>
                      <div className="text-xs text-slate-500">{row.customer_code || '-'}</div>
                    </td>
                    <td className="border-b px-3 py-3">{row.wr_number || 'Sin WR'}</td>
                    <td className="border-b px-3 py-3 text-right">{formatNumber(row.expected_pieces)}</td>
                    <td className="border-b px-3 py-3 text-right">{row.reconciliation_status === 'pending' ? '-' : formatNumber(row.received_pieces)}</td>
                    <td className={`border-b px-3 py-3 text-right font-semibold ${row.piece_difference === 0 ? 'text-slate-600' : 'text-red-700'}`}>
                      {row.reconciliation_status === 'pending' ? '-' : row.piece_difference > 0 ? `+${row.piece_difference}` : row.piece_difference}
                    </td>
                    <td className="border-b px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(row.reconciliation_status)}`}>
                        {RECONCILIATION_STATUS_LABELS[row.reconciliation_status]}
                      </span>
                    </td>
                    <td className="border-b px-3 py-3 text-xs text-slate-500">
                      {row.confirmed_at ? <><div>{formatDateTime(row.confirmed_at)}</div><div>{row.confirmed_by_name}</div></> : 'Pendiente'}
                    </td>
                    <td className="border-b px-3 py-3">
                      <button
                        type="button"
                        onClick={() => openConfirmation(row)}
                        disabled={!row.receipt_id}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {row.reconciliation_status === 'pending' ? 'Dar entrada' : 'Corregir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto my-6 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selected.reconciliation_status === 'pending' ? 'Dar entrada' : 'Corregir recepción'} · {selected.document_number}
                </h2>
                <p className="text-sm text-slate-500">{selected.customer_name} · {selected.expected_pieces} {selected.package_type} esperados</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-3 py-2 text-sm">Cerrar</button>
            </div>

            {formError && <Alert tone="error">{formError}</Alert>}

            <form onSubmit={handleConfirm} className="mt-4 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Bultos manifestados">
                  <input value={selected.expected_pieces} readOnly className="input bg-slate-100" />
                </Field>
                <Field label="Bultos recibidos" required>
                  <input type="number" min="0" step="1" value={form.received_pieces} onChange={(event) => updateForm('received_pieces', Number(event.target.value))} className="input" />
                </Field>
                <Field label="Peso manifestado KG">
                  <input value={selected.expected_weight_kg} readOnly className="input bg-slate-100" />
                </Field>
                <Field label="Peso recibido KG">
                  <input type="number" min="0" step="0.001" value={form.received_weight_kg} onChange={(event) => updateForm('received_weight_kg', Number(event.target.value))} className="input" />
                </Field>
                <Field label="Condición">
                  <select value={form.cargo_condition} onChange={(event) => updateForm('cargo_condition', event.target.value as CargoCondition)} className="input">
                    {CONDITIONS.map((condition) => <option key={condition.value} value={condition.value}>{condition.label}</option>)}
                  </select>
                </Field>
                <Field label="Ubicación inicial">
                  <select value={form.location_id} onChange={(event) => updateForm('location_id', event.target.value)} className="input">
                    <option value="">Sin ubicación</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.code}{location.zone ? ` · ${location.zone}` : ''}</option>)}
                  </select>
                </Field>
                <Field label="Operador responsable" required>
                  <input value={form.operator_name} onChange={(event) => updateForm('operator_name', event.target.value)} placeholder="Nombre y apellido" className="input" />
                </Field>
                <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={form.reception_complete} onChange={(event) => updateForm('reception_complete', event.target.checked)} />
                    Esta recepción queda cerrada
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={form.has_visible_damage} onChange={(event) => updateForm('has_visible_damage', event.target.checked)} />
                    Presenta daños visibles
                  </label>
                </div>
                <div className="md:col-span-2">
                  <Field label="Descripción de daños">
                    <textarea value={form.damage_notes} onChange={(event) => updateForm('damage_notes', event.target.value)} className="input min-h-24" placeholder="Embalaje, piezas afectadas, humedad, faltantes..." />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Observaciones de recepción">
                    <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className="input min-h-24" placeholder="Comentarios operativos..." />
                  </Field>
                </div>
              </div>

              {selected.confirmations.length > 0 && (
                <section className="rounded-xl border bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-900">Historial de confirmaciones</h3>
                  <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                    {selected.confirmations.map((confirmation) => (
                      <div key={confirmation.id} className="rounded-lg border bg-white p-3 text-xs text-slate-600">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-semibold">Versión {confirmation.version_no} · {RECONCILIATION_STATUS_LABELS[confirmation.reconciliation_status]}</span>
                          <span>{formatDateTime(confirmation.created_at)}</span>
                        </div>
                        <p className="mt-1">{confirmation.received_pieces} de {confirmation.expected_pieces} bultos · Operador: {confirmation.operator_name}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setSelected(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                  {saving ? 'Guardando...' : selected.reconciliation_status === 'pending' ? 'Confirmar entrada' : 'Guardar corrección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input { width: 100%; border-radius: .75rem; border: 1px solid rgb(203 213 225); padding: .55rem .75rem; font-size: .875rem; outline: none; }
        .input:focus { box-shadow: 0 0 0 2px rgb(203 213 225); }
      `}</style>
    </main>
  )
}

function Kpi({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${danger ? 'text-red-700' : 'text-slate-900'}`}>{value}</p></div>
}

function Alert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return <div className={`rounded-xl border p-4 text-sm ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</div>
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="space-y-1"><span className="text-sm font-medium text-slate-700">{label}{required && <span className="text-red-600"> *</span>}</span>{children}</label>
}
