'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import AmountInput from '../../../../../../components/amountInput'
import ServiceCatalogPicker from '../../../../../../components/serviceCatalogPicker'
import { getDispatchReport, updateDispatch } from '../../../../../../lib/services/dispatchService'
import type { DispatchCharge, DispatchCurrency, DispatchRecord, UpdateDispatchPayload } from '../../../../../../types/dispatch'

type EditableCharge = DispatchCharge & { row_id: string }
type EditForm = Omit<UpdateDispatchPayload, 'dispatch_id' | 'charges'> & { charges: EditableCharge[] }

function rowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function money(value: number, currency: DispatchCurrency) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value)
}

function formFromDispatch(dispatch: DispatchRecord): EditForm {
  return {
    igra_number: dispatch.igra_number || '',
    igra_approved: dispatch.igra_approved,
    liquidation_amount: dispatch.liquidation_amount,
    insurance_rate: dispatch.insurance_rate,
    recipient_name: dispatch.recipient_name,
    recipient_identification: dispatch.recipient_identification || '',
    recipient_phone: dispatch.recipient_phone || '',
    carrier_name: dispatch.carrier_name || '',
    driver_name: dispatch.driver_name || '',
    vehicle_plate: dispatch.vehicle_plate || '',
    delivery_notes: dispatch.delivery_notes || '',
    currency: dispatch.currency,
    tax_rate: dispatch.tax_rate,
    discount_amount: dispatch.discount_amount,
    edited_by: '',
    admin_key: '',
    charges: dispatch.charges
      .filter((charge) => charge.charge_code !== 'cargo_insurance')
      .map((charge) => ({ ...charge, row_id: rowId() })),
  }
}

export default function EditDispatchReceiptPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>()
  const router = useRouter()
  const [dispatch, setDispatch] = useState<DispatchRecord | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getDispatchReport(dispatchId)
      .then((result) => {
        if (!mounted) return
        setDispatch(result)
        setForm(formFromDispatch(result))
      })
      .catch((err) => mounted && setError(err instanceof Error ? err.message : 'No se pudo cargar el comprobante.'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [dispatchId])

  const totals = useMemo(() => {
    if (!form) return { services: 0, insurance: 0, subtotal: 0, tax: 0, discount: 0, total: 0 }
    const services = form.charges.reduce((sum, charge) => sum + Math.max(charge.quantity, 0) * Math.max(charge.unit_rate, 0), 0)
    const insurance = Math.max(form.liquidation_amount, 0) * Math.max(form.insurance_rate, 0) / 100
    const subtotal = services + insurance
    const tax = subtotal * Math.max(form.tax_rate, 0) / 100
    const discount = Math.min(Math.max(form.discount_amount, 0), subtotal + tax)
    return { services, insurance, subtotal, tax, discount, total: subtotal + tax - discount }
  }, [form])

  function update<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  function updateCharge<K extends keyof EditableCharge>(id: string, key: K, value: EditableCharge[K]) {
    setForm((current) => current ? {
      ...current,
      charges: current.charges.map((charge) => charge.row_id === id ? { ...charge, [key]: value } : charge),
    } : current)
  }

  function addCharge() {
    if (!form) return
    update('charges', [...form.charges, {
      row_id: rowId(), charge_code: 'other', description: '', quantity: 1, unit: 'servicio', unit_rate: 0,
    }])
  }

  function addCatalogCharges(charges: DispatchCharge[]) {
    if (!form) return
    const incomingCodes = new Set(charges.map((charge) => charge.charge_code))
    update('charges', [
      ...form.charges.filter((charge) => !incomingCodes.has(charge.charge_code)),
      ...charges.map((charge) => ({ ...charge, row_id: rowId() })),
    ])
  }

  function removeCharge(id: string) {
    if (!form) return
    update('charges', form.charges.filter((charge) => charge.row_id !== id))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || !dispatch) return
    setError(null)
    if (!form.igra_number.trim() || !form.igra_approved) return setError('El IGRA debe estar indicado y aprobado.')
    if (form.liquidation_amount <= 0) return setError('El monto de liquidación debe ser mayor que cero.')
    if (form.insurance_rate <= 0 || form.insurance_rate > 100) return setError('La tasa de seguro debe ser mayor que cero y no mayor de 100%.')
    if (!form.recipient_name.trim()) return setError('Debes indicar la persona autorizada a retirar.')
    if (!form.edited_by.trim()) return setError('Debes indicar quién realiza la corrección.')
    if (['invoiced', 'paid'].includes(dispatch.billing_status) && !form.admin_key) return setError('Debes introducir la clave del administrador para desbloquear este comprobante.')

    try {
      setSaving(true)
      await updateDispatch({
        ...form,
        dispatch_id: dispatch.id,
        charges: form.charges.filter((charge) => charge.description.trim() && charge.quantity > 0),
      })
      router.push(`/warehouse/dispatch/report/${dispatch.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el comprobante.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <State text="Cargando comprobante..." />
  if (!dispatch || !form) return <State text={error || 'No se encontró el comprobante.'} error />
  const requiresAdminKey = ['invoiced', 'paid'].includes(dispatch.billing_status)
  if (dispatch.dispatch_status === 'cancelled') return <State text="Un comprobante cancelado no puede editarse porque su inventario fue restaurado." error />

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <form onSubmit={submit} className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">Editar comprobante de despacho</p>
            <h1 className="text-3xl font-black text-slate-900">{dispatch.dispatch_number}</h1>
            <p className="mt-1 text-sm text-slate-500">BL {dispatch.document_number} · {dispatch.customer_name}</p>
          </div>
          <Link href={`/warehouse/dispatch/report/${dispatch.id}`} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Cancelar edición</Link>
        </header>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {requiresAdminKey
            ? 'Este comprobante está bloqueado por su estado de cobro. Solo un administrador puede guardar cambios usando su clave.'
            : 'Los bultos y el peso no se modifican aquí para proteger el inventario. Esta edición queda registrada en el historial.'}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Section title="IGRA, liquidación y seguro">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Número de IGRA" required><input value={form.igra_number} onChange={(e) => update('igra_number', e.target.value.toUpperCase())} className="input" /></Field>
                <Field label="Monto de liquidación" required><AmountInput value={form.liquidation_amount} onValueChange={(value) => update('liquidation_amount', value)} className="input" /></Field>
                <Field label="Porcentaje de seguro" required><AmountInput value={form.insurance_rate} onValueChange={(value) => update('insurance_rate', value)} className="input" /></Field>
                <div className="rounded-xl border bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">Seguro calculado</p><p className="mt-1 text-xl font-black">{money(totals.insurance, form.currency)}</p></div>
                <label className="md:col-span-2 flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold"><input type="checkbox" checked={form.igra_approved} onChange={(e) => update('igra_approved', e.target.checked)} className="h-5 w-5" /> IGRA aprobado y válido para este despacho.</label>
              </div>
            </Section>

            <Section title="Autorizado a retirar y transporte">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Persona autorizada" required><input value={form.recipient_name} onChange={(e) => update('recipient_name', e.target.value)} className="input" /></Field>
                <Field label="Identificación"><input value={form.recipient_identification} onChange={(e) => update('recipient_identification', e.target.value)} className="input" /></Field>
                <Field label="Teléfono"><input value={form.recipient_phone} onChange={(e) => update('recipient_phone', e.target.value)} className="input" /></Field>
                <Field label="Transportista"><input value={form.carrier_name} onChange={(e) => update('carrier_name', e.target.value)} className="input" /></Field>
                <Field label="Conductor"><input value={form.driver_name} onChange={(e) => update('driver_name', e.target.value)} className="input" /></Field>
                <Field label="Placa"><input value={form.vehicle_plate} onChange={(e) => update('vehicle_plate', e.target.value.toUpperCase())} className="input" /></Field>
                <div className="md:col-span-2"><Field label="Observaciones"><textarea value={form.delivery_notes} onChange={(e) => update('delivery_notes', e.target.value)} className="input min-h-24" /></Field></div>
              </div>
            </Section>

            <Section title="Servicios y tarifas">
              <ServiceCatalogPicker
                currency={form.currency}
                storageDays={dispatch.storage_days}
                pieces={dispatch.pieces_dispatched}
                onAdd={addCatalogCharges}
              />
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-[820px] w-full text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600"><tr><th className="p-3">Concepto</th><th className="p-3">Cantidad</th><th className="p-3">Unidad</th><th className="p-3">Tarifa</th><th className="p-3 text-right">Importe</th><th /></tr></thead>
                  <tbody>{form.charges.map((charge) => <tr key={charge.row_id}>
                    <td className="border-t p-2"><input value={charge.description} onChange={(e) => updateCharge(charge.row_id, 'description', e.target.value)} className="input" /></td>
                    <td className="border-t p-2"><AmountInput value={charge.quantity} onValueChange={(value) => updateCharge(charge.row_id, 'quantity', value)} className="input w-24" /></td>
                    <td className="border-t p-2"><input value={charge.unit} onChange={(e) => updateCharge(charge.row_id, 'unit', e.target.value)} className="input w-24" /></td>
                    <td className="border-t p-2"><AmountInput value={charge.unit_rate} onValueChange={(value) => updateCharge(charge.row_id, 'unit_rate', value)} className="input w-32" /></td>
                    <td className="border-t p-3 text-right font-semibold">{money(charge.quantity * charge.unit_rate, form.currency)}</td>
                    <td className="border-t p-2"><button type="button" onClick={() => removeCharge(charge.row_id)} className="px-3 py-2 text-xs font-bold text-red-700">Quitar</button></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <button type="button" onClick={addCharge} className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold">+ Agregar concepto</button>
            </Section>
          </div>

          <aside className="h-fit space-y-5 rounded-2xl border bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-black">Resumen corregido</h2>
            <Field label="Moneda"><select value={form.currency} onChange={(e) => update('currency', e.target.value as DispatchCurrency)} className="input"><option value="DOP">DOP</option><option value="USD">USD</option></select></Field>
            <Field label="ITBIS %"><AmountInput value={form.tax_rate} onValueChange={(value) => update('tax_rate', value)} className="input" blankWhenZero={false} /></Field>
            <Field label="Descuento"><AmountInput value={form.discount_amount} onValueChange={(value) => update('discount_amount', value)} className="input" /></Field>
            <div className="space-y-2 border-t pt-4 text-sm"><Row label="Servicios" value={money(totals.services, form.currency)} /><Row label="Seguro" value={money(totals.insurance, form.currency)} /><Row label="Subtotal" value={money(totals.subtotal, form.currency)} /><Row label="ITBIS" value={money(totals.tax, form.currency)} /><Row label="Descuento" value={`-${money(totals.discount, form.currency)}`} /><div className="flex justify-between border-t pt-3 text-lg font-black"><span>Total</span><span>{money(totals.total, form.currency)}</span></div></div>
            <Field label="Corrección realizada por" required><input value={form.edited_by} onChange={(e) => update('edited_by', e.target.value)} className="input" placeholder="Nombre del responsable" /></Field>
            {requiresAdminKey && <Field label="Clave del administrador" required><input type="password" value={form.admin_key} onChange={(e) => update('admin_key', e.target.value)} className="input" autoComplete="current-password" /></Field>}
            <button type="submit" disabled={saving} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar correcciones'}</button>
          </aside>
        </div>
      </form>
      <style jsx global>{`.input{width:100%;border-radius:.75rem;border:1px solid rgb(203 213 225);background:white;padding:.65rem .8rem;font-size:.875rem;outline:none}.input:focus{box-shadow:0 0 0 2px rgb(203 213 225)}`}</style>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="mb-5 text-lg font-black">{title}</h2>{children}</section> }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{required && <span className="text-red-600"> *</span>}</span>{children}</label> }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><span className="text-slate-500">{label}</span><span className="font-semibold">{value}</span></div> }
function State({ text, error = false }: { text: string; error?: boolean }) { return <main className="min-h-screen bg-slate-50 p-6"><div className={`mx-auto max-w-3xl rounded-xl border p-6 ${error ? 'border-red-200 bg-red-50 text-red-700' : 'bg-white text-slate-500'}`}>{text}<div className="mt-4"><Link href="/warehouse/dispatch" className="font-semibold underline">Volver a despachos</Link></div></div></main> }
