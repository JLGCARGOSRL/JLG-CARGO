'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import AmountInput from '../../../../components/amountInput'
import ServiceCatalogPicker from '../../../../components/serviceCatalogPicker'

import {
  createDispatch,
  getDispatchCandidate,
} from '../../../../lib/services/dispatchService'
import type {
  CreateDispatchPayload,
  DispatchCandidate,
  DispatchCharge,
  DispatchCurrency,
} from '../../../../types/dispatch'

type EditableCharge = DispatchCharge & { row_id: string }

type DispatchForm = Omit<CreateDispatchPayload, 'receipt_id' | 'charges'> & {
  charges: EditableCharge[]
}

function newRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function defaultCharges(pieces: number, storageDays: number): EditableCharge[] {
  return [
    {
      row_id: newRowId(),
      charge_code: 'cargo_receipt_control',
      description: 'Recepción y control de carga',
      quantity: 1,
      unit: 'servicio',
      unit_rate: 0,
    },
    {
      row_id: newRowId(),
      charge_code: 'storage',
      description: 'Almacenaje',
      quantity: storageDays,
      unit: 'día',
      unit_rate: 0,
    },
    {
      row_id: newRowId(),
      charge_code: 'interconnection',
      description: 'Gestión de interconexión',
      quantity: 1,
      unit: 'servicio',
      unit_rate: 0,
    },
    {
      row_id: newRowId(),
      charge_code: 'verification',
      description: 'Verificación documental y física',
      quantity: 1,
      unit: 'servicio',
      unit_rate: 0,
    },
    {
      row_id: newRowId(),
      charge_code: 'operational_handling',
      description: 'Manejo operativo de carga',
      quantity: pieces,
      unit: 'bulto',
      unit_rate: 0,
    },
  ]
}

function initialForm(pieces: number, weight: number, storageDays = 1): DispatchForm {
  return {
    pieces_dispatched: pieces,
    weight_dispatched_kg: weight,
    igra_number: '',
    igra_approved: false,
    liquidation_amount: 0,
    insurance_rate: 0,
    recipient_name: '',
    recipient_identification: '',
    recipient_phone: '',
    carrier_name: '',
    driver_name: '',
    vehicle_plate: '',
    delivery_address: '',
    authorization_reference: '',
    operator_name: '',
    delivery_notes: '',
    currency: 'DOP',
    tax_rate: 18,
    discount_amount: 0,
    charges: defaultCharges(pieces, storageDays),
  }
}

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatMoney(value: number, currency: DispatchCurrency) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

export default function CreateBlDispatchPage() {
  const params = useParams<{ receiptId: string }>()
  const router = useRouter()
  const receiptId = params.receiptId
  const [candidate, setCandidate] = useState<DispatchCandidate | null>(null)
  const [form, setForm] = useState<DispatchForm>(() => initialForm(0, 0))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await getDispatchCandidate(receiptId)
        if (!mounted) return
        setCandidate(result)
        setForm(initialForm(result.available_pieces, result.available_weight_kg, result.storage_days))
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el BL.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [receiptId])

  const totals = useMemo(() => {
    const serviceSubtotal = form.charges.reduce((total, charge) => {
      if (charge.quantity <= 0 || charge.unit_rate < 0) return total
      return total + charge.quantity * charge.unit_rate
    }, 0)
    const insurance = Math.max(form.liquidation_amount, 0) * Math.max(form.insurance_rate, 0) / 100
    const subtotal = serviceSubtotal + insurance
    const tax = subtotal * Math.max(form.tax_rate, 0) / 100
    const discount = Math.min(Math.max(form.discount_amount, 0), subtotal + tax)
    return { serviceSubtotal, insurance, subtotal, tax, discount, total: subtotal + tax - discount }
  }, [form.charges, form.discount_amount, form.insurance_rate, form.liquidation_amount, form.tax_rate])

  function updateForm<K extends keyof DispatchForm>(key: K, value: DispatchForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateCharge<K extends keyof EditableCharge>(
    rowId: string,
    key: K,
    value: EditableCharge[K]
  ) {
    setForm((current) => ({
      ...current,
      charges: current.charges.map((charge) =>
        charge.row_id === rowId ? { ...charge, [key]: value } : charge
      ),
    }))
  }

  function addCharge() {
    setForm((current) => ({
      ...current,
      charges: [
        ...current.charges,
        {
          row_id: newRowId(),
          charge_code: 'other',
          description: '',
          quantity: 1,
          unit: 'servicio',
          unit_rate: 0,
        },
      ],
    }))
  }

  function addCatalogCharges(charges: DispatchCharge[]) {
    setForm((current) => {
      const incomingCodes = new Set(charges.map((charge) => charge.charge_code))
      return {
        ...current,
        charges: [
          ...current.charges.filter((charge) => !incomingCodes.has(charge.charge_code)),
          ...charges.map((charge) => ({ ...charge, row_id: newRowId() })),
        ],
      }
    })
  }

  function removeCharge(rowId: string) {
    setForm((current) => ({
      ...current,
      charges: current.charges.filter((charge) => charge.row_id !== rowId),
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!candidate) return
    if (!candidate.eligible) {
      setError(candidate.blocked_reason || 'Este BL no está disponible para despacho.')
      return
    }
    if (!form.recipient_name.trim()) {
      setError('Debes indicar la persona que recibe la carga.')
      return
    }
    if (!form.operator_name.trim()) {
      setError('Debes indicar el operador responsable.')
      return
    }
    if (!form.igra_number.trim()) {
      setError('Debes indicar el número de IGRA aprobado.')
      return
    }
    if (!form.igra_approved) {
      setError('Debes confirmar que el IGRA está aprobado antes de despachar.')
      return
    }
    if (form.liquidation_amount <= 0) {
      setError('El monto de la liquidación debe ser mayor que cero.')
      return
    }
    if (form.insurance_rate <= 0 || form.insurance_rate > 100) {
      setError('Indica un porcentaje de seguro mayor que cero y no mayor de 100%.')
      return
    }
    if (
      form.pieces_dispatched <= 0 ||
      form.pieces_dispatched > candidate.available_pieces ||
      !Number.isInteger(form.pieces_dispatched)
    ) {
      setError(`Puedes despachar entre 1 y ${candidate.available_pieces} bultos enteros.`)
      return
    }
    if (
      form.weight_dispatched_kg < 0 ||
      form.weight_dispatched_kg > candidate.available_weight_kg + 0.001
    ) {
      setError(`El peso no puede superar ${formatNumber(candidate.available_weight_kg, 3)} KG.`)
      return
    }

    try {
      setSaving(true)
      const dispatch = await createDispatch({
        ...form,
        receipt_id: candidate.receipt_id,
        charges: form.charges.filter(
          (charge) => charge.description.trim() && charge.quantity > 0
        ),
      })
      router.push(`/warehouse/dispatch/report/${dispatch.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el despacho.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <StateMessage text="Cargando BL disponible..." />
  }

  if (!candidate) {
    return <StateMessage text={error || 'No se encontró el BL.'} error />
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <form onSubmit={handleSubmit} className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Nuevo despacho individual</p>
            <h1 className="text-3xl font-bold text-slate-900">{candidate.document_number}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {candidate.customer_name} · {candidate.wr_number} · {candidate.manifest_number}
            </p>
          </div>
          <Link href="/warehouse/dispatch" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100">
            Cancelar y volver
          </Link>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!candidate.eligible && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {candidate.blocked_reason}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Recibidos" value={`${formatNumber(candidate.received_pieces)} bultos`} />
          <Kpi label="Ya despachados" value={`${formatNumber(candidate.dispatched_pieces)} bultos`} />
          <Kpi label="Disponibles" value={`${formatNumber(candidate.available_pieces)} bultos`} highlight />
          <Kpi label="Peso disponible" value={`${formatNumber(candidate.available_weight_kg, 3)} KG`} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
          <div className="space-y-6">
            <Section title="Autorización IGRA y seguro" description="Estos datos son obligatorios para autorizar la salida y calcular el seguro sobre la liquidación.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Número de IGRA" required>
                  <input
                    value={form.igra_number}
                    onChange={(event) => updateForm('igra_number', event.target.value.toUpperCase())}
                    className="input"
                    placeholder="Ej. IGRA-2026-000123"
                  />
                </Field>
                <Field label="Monto de la liquidación" required>
                  <AmountInput
                    value={form.liquidation_amount}
                    onValueChange={(value) => updateForm('liquidation_amount', value)}
                    className="input"
                  />
                </Field>
                <Field label="Porcentaje del seguro" required>
                  <div className="relative">
                    <AmountInput
                      value={form.insurance_rate}
                      onValueChange={(value) => updateForm('insurance_rate', value)}
                      className="input pr-10"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-semibold text-slate-500">%</span>
                  </div>
                </Field>
                <div className="rounded-xl border bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seguro calculado</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{formatMoney(totals.insurance, form.currency)}</p>
                </div>
                <label className="md:col-span-2 flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950">
                  <input
                    type="checkbox"
                    checked={form.igra_approved}
                    onChange={(event) => updateForm('igra_approved', event.target.checked)}
                    className="mt-0.5 h-5 w-5"
                  />
                  Confirmo que el número de IGRA indicado está aprobado y autoriza este despacho.
                </label>
              </div>
            </Section>

            <Section title="Cantidad a entregar" description="Permite un despacho total o parcial sin superar la existencia del BL.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Bultos a despachar" required>
                  <AmountInput
                    decimals={0}
                    value={form.pieces_dispatched}
                    onValueChange={(pieces) => {
                      updateForm('pieces_dispatched', pieces)
                      const handlingRow = form.charges.find((charge) => charge.charge_code === 'operational_handling')
                      if (handlingRow) updateCharge(handlingRow.row_id, 'quantity', pieces)
                    }}
                    className="input"
                  />
                </Field>
                <Field label="Peso a despachar KG" required>
                  <AmountInput
                    decimals={3}
                    value={form.weight_dispatched_kg}
                    onValueChange={(value) => updateForm('weight_dispatched_kg', value)}
                    className="input"
                  />
                </Field>
              </div>
            </Section>

            <Section title="Datos de entrega" description="Información que aparecerá en el comprobante de despacho.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Persona que recibe" required>
                  <input value={form.recipient_name} onChange={(event) => updateForm('recipient_name', event.target.value)} className="input" />
                </Field>
                <Field label="Cédula / identificación">
                  <input value={form.recipient_identification} onChange={(event) => updateForm('recipient_identification', event.target.value)} className="input" />
                </Field>
                <Field label="Teléfono">
                  <input value={form.recipient_phone} onChange={(event) => updateForm('recipient_phone', event.target.value)} className="input" />
                </Field>
                <Field label="Referencia de autorización">
                  <input value={form.authorization_reference} onChange={(event) => updateForm('authorization_reference', event.target.value)} className="input" placeholder="Correo, autorización o referencia" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Dirección o lugar de entrega">
                    <input value={form.delivery_address} onChange={(event) => updateForm('delivery_address', event.target.value)} className="input" />
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Transporte y responsable" description="Identifica quién retiró y quién autorizó la salida.">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Empresa transportista">
                  <input value={form.carrier_name} onChange={(event) => updateForm('carrier_name', event.target.value)} className="input" />
                </Field>
                <Field label="Conductor">
                  <input value={form.driver_name} onChange={(event) => updateForm('driver_name', event.target.value)} className="input" />
                </Field>
                <Field label="Placa del vehículo">
                  <input value={form.vehicle_plate} onChange={(event) => updateForm('vehicle_plate', event.target.value.toUpperCase())} className="input" />
                </Field>
                <Field label="Operador responsable" required>
                  <input value={form.operator_name} onChange={(event) => updateForm('operator_name', event.target.value)} className="input" />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Observaciones de entrega">
                    <textarea value={form.delivery_notes} onChange={(event) => updateForm('delivery_notes', event.target.value)} className="input min-h-24" />
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Servicios y cargos" description="Los importes se guardarán como liquidación del despacho.">
              <ServiceCatalogPicker
                currency={form.currency}
                storageDays={candidate.storage_days}
                pieces={form.pieces_dispatched}
                onAdd={addCatalogCharges}
              />
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-[850px] w-full text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                    <tr>
                      <th className="border-b px-3 py-3">Descripción</th>
                      <th className="border-b px-3 py-3">Cantidad</th>
                      <th className="border-b px-3 py-3">Unidad</th>
                      <th className="border-b px-3 py-3">Tarifa</th>
                      <th className="border-b px-3 py-3 text-right">Importe</th>
                      <th className="border-b px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.charges.map((charge) => (
                      <tr key={charge.row_id}>
                        <td className="border-b p-2"><input value={charge.description} onChange={(event) => updateCharge(charge.row_id, 'description', event.target.value)} className="input" /></td>
                        <td className="border-b p-2"><AmountInput value={charge.quantity} onValueChange={(value) => updateCharge(charge.row_id, 'quantity', value)} className="input w-28" /></td>
                        <td className="border-b p-2"><input value={charge.unit} onChange={(event) => updateCharge(charge.row_id, 'unit', event.target.value)} className="input w-28" /></td>
                        <td className="border-b p-2"><AmountInput value={charge.unit_rate} onValueChange={(value) => updateCharge(charge.row_id, 'unit_rate', value)} className="input w-32" /></td>
                        <td className="border-b px-3 py-2 text-right font-semibold">{formatMoney(charge.quantity * charge.unit_rate, form.currency)}</td>
                        <td className="border-b p-2"><button type="button" onClick={() => removeCharge(charge.row_id)} className="rounded-lg px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Quitar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={addCharge} className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50">
                + Agregar concepto
              </button>
            </Section>
          </div>

          <aside className="h-fit space-y-5 rounded-2xl border bg-white p-6 shadow-sm xl:sticky xl:top-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Resumen del despacho</h2>
              <p className="text-sm text-slate-500">BL {candidate.document_number}</p>
            </div>
            <dl className="space-y-3 text-sm">
              <Summary label="Cliente" value={candidate.customer_name} />
              <Summary label="IGRA" value={form.igra_number || 'Pendiente'} />
              <Summary label="Liquidación" value={formatMoney(form.liquidation_amount, form.currency)} />
              <Summary label="Días de almacenaje" value={String(candidate.storage_days)} />
              <Summary label="Contenedor" value={candidate.container_number || '-'} />
              <Summary label="Ubicación" value={candidate.location_code || 'Sin ubicación'} />
              <Summary label="Quedarán disponibles" value={`${Math.max(candidate.available_pieces - form.pieces_dispatched, 0)} bultos`} />
            </dl>

            <div className="grid gap-3 border-t pt-5 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="Moneda">
                <select value={form.currency} onChange={(event) => updateForm('currency', event.target.value as DispatchCurrency)} className="input">
                  <option value="DOP">DOP - Peso dominicano</option>
                  <option value="USD">USD - Dólar estadounidense</option>
                </select>
              </Field>
              <Field label="Impuesto %">
                <AmountInput value={form.tax_rate} onValueChange={(value) => updateForm('tax_rate', value)} className="input" blankWhenZero={false} />
              </Field>
              <Field label="Descuento">
                <AmountInput value={form.discount_amount} onValueChange={(value) => updateForm('discount_amount', value)} className="input" />
              </Field>
            </div>

            <div className="space-y-2 border-t pt-5 text-sm">
              <MoneyRow label="Servicios" value={formatMoney(totals.serviceSubtotal, form.currency)} />
              <MoneyRow label={`Seguro (${form.insurance_rate || 0}%)`} value={formatMoney(totals.insurance, form.currency)} />
              <MoneyRow label="Subtotal" value={formatMoney(totals.subtotal, form.currency)} />
              <MoneyRow label={`Impuesto (${form.tax_rate || 0}%)`} value={formatMoney(totals.tax, form.currency)} />
              <MoneyRow label="Descuento" value={`-${formatMoney(totals.discount, form.currency)}`} />
              <div className="flex justify-between border-t pt-3 text-lg font-bold text-slate-900">
                <span>Total</span>
                <span>{formatMoney(totals.total, form.currency)}</span>
              </div>
            </div>

            <button type="submit" disabled={saving || !candidate.eligible} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Confirmando despacho...' : 'Confirmar despacho y generar reporte'}
            </button>
            <p className="text-xs leading-5 text-slate-500">
              Al confirmar se actualizará el inventario del BL y se conservará el historial de la operación.
            </p>
          </aside>
        </div>
      </form>

      <style jsx global>{`
        .input { width: 100%; border-radius: .75rem; border: 1px solid rgb(203 213 225); background: white; padding: .58rem .75rem; font-size: .875rem; outline: none; }
        .input:focus { box-shadow: 0 0 0 2px rgb(203 213 225); }
      `}</style>
    </main>
  )
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-500">{description}</p></div>{children}</section>
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm font-medium text-slate-700">{label}{required && <span className="text-red-600"> *</span>}</span>{children}</label>
}

function Kpi({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-xl font-bold ${highlight ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p></div>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-900">{value}</dd></div>
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 text-slate-600"><span>{label}</span><span className="font-medium text-slate-900">{value}</span></div>
}

function StateMessage({ text, error = false }: { text: string; error?: boolean }) {
  return <main className="min-h-screen bg-slate-50 p-6"><div className={`mx-auto max-w-4xl rounded-xl border p-6 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'bg-white text-slate-500'}`}>{text}<div className="mt-4"><Link href="/warehouse/dispatch" className="font-semibold underline">Volver a despachos</Link></div></div></main>
}
