'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  cancelDispatch,
  getDispatchReport,
  setDispatchBillingStatus,
} from '../../../../../lib/services/dispatchService'
import {
  BILLING_STATUS_LABELS,
  DISPATCH_STATUS_LABELS,
  type DispatchBillingStatus,
  type DispatchRecord,
} from '../../../../../types/dispatch'
import VerificationQr from '../../../../../components/verificationQr'
import { useAuth } from '../../../../../contexts/authContext'

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-DO')
}

function formatShortDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

export default function DispatchReportPage() {
  const { profile } = useAuth()
  const isAdministrator = profile?.role === 'administrator'
  const params = useParams<{ dispatchId: string }>()
  const dispatchId = params.dispatchId
  const [dispatch, setDispatch] = useState<DispatchRecord | null>(null)
  const [billingStatus, setBillingStatus] = useState<Exclude<DispatchBillingStatus, 'cancelled'>>('pending')
  const [invoiceReference, setInvoiceReference] = useState('')
  const [billingOperator, setBillingOperator] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function refresh() {
    try {
      setLoading(true)
      setError(null)
      const result = await getDispatchReport(dispatchId)
      setDispatch(result)
      if (result.billing_status !== 'cancelled') setBillingStatus(result.billing_status)
      setInvoiceReference(result.invoice_reference || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    async function loadInitial() {
      try {
        const result = await getDispatchReport(dispatchId)
        if (!mounted) return
        setDispatch(result)
        if (result.billing_status !== 'cancelled') setBillingStatus(result.billing_status)
        setInvoiceReference(result.invoice_reference || '')
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadInitial()
    return () => {
      mounted = false
    }
  }, [dispatchId])

  async function handleBilling(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!billingOperator.trim()) {
      setError('Debes indicar quién actualiza el estado de cobro.')
      return
    }
    if ((billingStatus === 'invoiced' || billingStatus === 'paid') && !invoiceReference.trim()) {
      setError('Indica el número o referencia de factura.')
      return
    }

    try {
      setSaving(true)
      await setDispatchBillingStatus(
        dispatchId,
        billingStatus,
        invoiceReference,
        billingOperator
      )
      await refresh()
      setSuccess('El estado de cobro fue actualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el cobro.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!dispatch) return
    const operator = window.prompt('Nombre del operador que cancela el despacho:')
    if (!operator?.trim()) return
    const reason = window.prompt('Motivo de la cancelación:')
    if (!reason?.trim()) return
    if (!window.confirm(`¿Confirmas cancelar el despacho ${dispatch.dispatch_number}? El inventario del BL será restaurado.`)) return

    try {
      setSaving(true)
      setError(null)
      await cancelDispatch(dispatch.id, operator, reason)
      await refresh()
      setSuccess('El despacho fue cancelado y el inventario quedó restaurado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar el despacho.')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !dispatch) return <State text="Cargando reporte de despacho..." />
  if (!dispatch) return <State text={error || 'No se encontró el despacho.'} error />

  return (
    <main className="report-page min-h-screen bg-slate-100 p-6">
      <div className="print-hidden mx-auto mb-5 flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/warehouse/dispatch" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
          Volver a despachos
        </Link>
        <div className="flex flex-wrap gap-2">
          {dispatch.dispatch_status !== 'cancelled' && (
            <Link href={`/warehouse/dispatch/report/${dispatch.id}/edit`} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">
              {['invoiced', 'paid'].includes(dispatch.billing_status) ? 'Editar con clave' : 'Editar comprobante'}
            </Link>
          )}
          <button type="button" onClick={() => setPreviewOpen(true)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Vista previa
          </button>
          {isAdministrator && dispatch.dispatch_status !== 'cancelled' && !['invoiced', 'paid'].includes(dispatch.billing_status) && (
            <button type="button" disabled={saving} onClick={handleCancel} className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Cancelar despacho
            </button>
          )}
        </div>
      </div>

      <div className="print-hidden mx-auto mb-5 max-w-5xl space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}
      </div>

      {previewOpen && (
        <button
          type="button"
          aria-label="Cerrar vista previa"
          onClick={() => setPreviewOpen(false)}
          className="print-hidden fixed inset-0 z-40 cursor-default bg-slate-950/75"
        />
      )}

      <article className={`print-card bg-white p-8 ${previewOpen ? 'fixed inset-4 z-50 mx-auto max-w-5xl overflow-y-auto rounded-xl shadow-2xl' : 'mx-auto max-w-5xl rounded-2xl border shadow-sm'}`}>
        {previewOpen && (
          <div className="print-hidden sticky top-0 z-10 -mx-8 -mt-8 mb-6 flex flex-wrap justify-end gap-2 border-b bg-slate-900 p-3 shadow-sm">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Cerrar vista previa
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100"
            >
              Imprimir / Guardar PDF
            </button>
          </div>
        )}
        <header className="flex flex-col gap-6 border-b-2 border-slate-900 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Image
              src="/jlg-cargo-logo.jpg"
              alt="JLG Cargo SRL"
              width={160}
              height={81}
              priority
              className="report-logo h-auto w-36 object-contain sm:w-40"
            />
            <div className="border-l border-slate-300 pl-4">
              <h1 className="text-3xl font-black text-slate-900">Comprobante de despacho</h1>
              <p className="mt-1 text-sm text-slate-500">Entrega individual por Bill of Lading</p>
              <div className="company-address mt-3 space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <p>Almacén JLG Cargo</p>
                <p>Autopista Duarte, Km 17 1/2</p>
                <p>RNC: 131784925</p>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 sm:text-right">
            <div>
              <p className="text-2xl font-black text-slate-900">{dispatch.dispatch_number}</p>
              <p className="mt-1 text-sm text-slate-600">{formatDate(dispatch.dispatched_at)}</p>
              <div className="mt-2 flex gap-2 sm:justify-end">
                <Badge>{DISPATCH_STATUS_LABELS[dispatch.dispatch_status]}</Badge>
                <Badge>{BILLING_STATUS_LABELS[dispatch.billing_status]}</Badge>
              </div>
            </div>
            <div className="qr-frame shrink-0 rounded-lg border bg-white p-1.5 shadow-sm">
              <VerificationQr
                value={`https://jlg-cargo-net.vercel.app/warehouse/dispatch/report/${dispatch.id}`}
                size={112}
                className="report-qr mx-auto"
              />
            </div>
          </div>
        </header>

        {dispatch.dispatch_status === 'cancelled' && (
          <div className="mt-6 rounded-xl border-2 border-red-500 bg-red-50 p-4 text-center text-lg font-black uppercase tracking-widest text-red-700">
            Despacho cancelado
          </div>
        )}

        <section className="mt-7">
          <InfoBlock title="Cliente y BL" compact>
            <Info label="Cliente" value={dispatch.customer_name} />
            <Info label="Código" value={dispatch.customer_code || '-'} />
            <Info label="BL individual" value={dispatch.document_number} />
            <Info label="WR" value={dispatch.wr_number} />
            <Info label="Dirección del cliente" value={dispatch.customer_address || '-'} wide />
            <Info label="Contenido de la carga" value={dispatch.cargo_description || '-'} wide />
            <Info label="Fecha de llegada" value={formatShortDate(dispatch.arrival_date)} />
            <Info label="Fecha de recepción" value={formatShortDate(dispatch.received_at)} />
            <Info label="Fecha de despacho" value={formatShortDate(dispatch.dispatched_at)} />
            <Info label="Días de almacenaje" value={String(dispatch.storage_days)} />
            <Info label="IGRA aprobado" value={dispatch.igra_number || '-'} />
            <Info label="Estado IGRA" value={dispatch.igra_approved ? 'Aprobado' : 'No aprobado'} />
            <Info label="Monto liquidación" value={formatMoney(dispatch.liquidation_amount, dispatch.currency)} />
            <Info label={`Seguro (${formatNumber(dispatch.insurance_rate, 2)}%)`} value={formatMoney(dispatch.insurance_amount, dispatch.currency)} />
          </InfoBlock>
        </section>

        <section className="mt-7 rounded-xl border-2 border-slate-900">
          <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
            <Metric label="Bultos entregados" value={formatNumber(dispatch.pieces_dispatched)} />
            <Metric label="Peso entregado" value={`${formatNumber(dispatch.weight_dispatched_kg, 3)} KG`} />
            <Metric label="Bultos restantes" value={formatNumber(dispatch.remaining_pieces)} />
          </div>
        </section>

        <section className="mt-7">
          <InfoBlock title="Autorizado a retirar y transporte" compact>
            <Info label="Autorizado a retirar" value={dispatch.recipient_name} wide />
            <Info label="Identificación" value={dispatch.recipient_identification || '-'} />
            <Info label="Teléfono" value={dispatch.recipient_phone || '-'} />
            <Info label="Transportista" value={dispatch.carrier_name || '-'} wide />
            <Info label="Conductor" value={dispatch.driver_name || '-'} />
            <Info label="Placa" value={dispatch.vehicle_plate || '-'} />
            <Info label="Observaciones" value={dispatch.delivery_notes || '-'} full />
          </InfoBlock>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">Liquidación de servicios</h2>
              <p className="text-sm text-slate-500">Detalle preparado para facturación al finalizar la entrega.</p>
            </div>
            <p className="text-sm font-bold text-slate-700">Moneda: {dispatch.currency}</p>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase text-white">
                <tr>
                  <th className="px-3 py-3">Concepto</th>
                  <th className="px-3 py-3 text-right">Cantidad</th>
                  <th className="px-3 py-3">Unidad</th>
                  <th className="px-3 py-3 text-right">Tarifa</th>
                  <th className="px-3 py-3 text-right">Base</th>
                  <th className="px-3 py-3 text-right">ITBIS</th>
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {dispatch.charges.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">Sin cargos registrados.</td></tr>
                ) : dispatch.charges.map((charge) => (
                  <tr key={charge.id || `${charge.charge_code}-${charge.sort_order}`}>
                    <td className="border-b px-3 py-3">{charge.description}</td>
                    <td className="border-b px-3 py-3 text-right">{formatNumber(charge.quantity, 2)}</td>
                    <td className="border-b px-3 py-3">{charge.unit}</td>
                    <td className="border-b px-3 py-3 text-right">{formatMoney(charge.unit_rate, dispatch.currency)}</td>
                    <td className="border-b px-3 py-3 text-right font-semibold">{formatMoney(charge.amount || 0, dispatch.currency)}</td>
                    <td className="border-b px-3 py-3 text-right">{formatMoney((charge.amount || 0) * dispatch.tax_rate / 100, dispatch.currency)}</td>
                    <td className="border-b px-3 py-3 text-right font-semibold">{formatMoney((charge.amount || 0) * (1 + dispatch.tax_rate / 100), dispatch.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto mt-4 max-w-sm space-y-2 text-sm">
            <TotalRow label="Subtotal" value={formatMoney(dispatch.subtotal, dispatch.currency)} />
            <TotalRow label={`Impuesto (${formatNumber(dispatch.tax_rate, 2)}%)`} value={formatMoney(dispatch.tax_amount, dispatch.currency)} />
            <TotalRow label="Descuento" value={`-${formatMoney(dispatch.discount_amount, dispatch.currency)}`} />
            <div className="flex justify-between border-t-2 border-slate-900 pt-3 text-xl font-black">
              <span>Total</span><span>{formatMoney(dispatch.total_amount, dispatch.currency)}</span>
            </div>
            {dispatch.invoice_reference && <p className="pt-2 text-right text-xs text-slate-500">Factura / referencia: {dispatch.invoice_reference}</p>}
          </div>
        </section>

        <section className="mt-16 grid gap-12 sm:grid-cols-3">
          <Signature label="Entregado por JLG" />
          <Signature label="Conductor / transportista" />
          <Signature label="Recibido conforme" />
        </section>

        <footer className="mt-10 border-t pt-4 text-center text-xs text-slate-500">
          <span className="font-semibold">Almacén JLG Cargo</span> · Autopista Duarte, Km 17 1/2 · RNC: 131784925 · {dispatch.dispatch_number}
        </footer>
      </article>

      {isAdministrator && dispatch.dispatch_status !== 'cancelled' && (
        <form onSubmit={handleBilling} className="print-hidden mx-auto mt-6 max-w-5xl rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Control de facturación</h2>
          <p className="mt-1 text-sm text-slate-500">Actualiza el seguimiento del cobro sin modificar la liquidación original.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <Field label="Estado de cobro">
              <select value={billingStatus} onChange={(event) => setBillingStatus(event.target.value as Exclude<DispatchBillingStatus, 'cancelled'>)} className="input">
                <option value="pending">Pendiente</option>
                <option value="ready">Listo para facturar</option>
                <option value="invoiced">Facturado</option>
                <option value="paid">Pagado</option>
              </select>
            </Field>
            <Field label="Factura / referencia">
              <input value={invoiceReference} onChange={(event) => setInvoiceReference(event.target.value)} className="input" />
            </Field>
            <Field label="Operador responsable" required>
              <input value={billingOperator} onChange={(event) => setBillingOperator(event.target.value)} className="input" />
            </Field>
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Guardando...' : 'Actualizar cobro'}
              </button>
            </div>
          </div>
        </form>
      )}

      {!isAdministrator && dispatch.dispatch_status !== 'cancelled' && (
        <div className="print-hidden mx-auto mt-6 max-w-5xl rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          La facturación y cancelación de despachos están reservadas al administrador.
        </div>
      )}

      <style jsx global>{`
        .input { width: 100%; border-radius: .75rem; border: 1px solid rgb(203 213 225); background: white; padding: .58rem .75rem; font-size: .875rem; outline: none; }
        .input:focus { box-shadow: 0 0 0 2px rgb(203 213 225); }
        @media print {
          body > div > aside { display: none !important; }
          body > div > main { padding: 0 !important; background: white !important; }
          .print-hidden { display: none !important; }
          .report-page { padding: 0 !important; background: white !important; }
          .print-card {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 8mm 10mm !important;
            font-size: 8.5px !important;
            line-height: 1.15 !important;
          }
          .print-card header {
            gap: 8px !important;
            padding-bottom: 8px !important;
          }
          .print-card header .text-3xl { font-size: 19px !important; line-height: 1.05 !important; }
          .print-card header .text-2xl { font-size: 16px !important; line-height: 1.05 !important; }
          .print-card header .mt-2 { margin-top: 3px !important; }
          .print-card header .mt-1 { margin-top: 2px !important; }
          .print-card header .mt-2.flex { margin-top: 4px !important; }
          .print-card .report-logo { width: 92px !important; height: auto !important; }
          .print-card .company-address { margin-top: 4px !important; }
          .print-card .company-address > :not([hidden]) ~ :not([hidden]) { margin-top: 1px !important; }
          .print-card .compact-info { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; gap: 8px !important; }
          .print-card .wide-info { grid-column: span 2 / span 2 !important; }
          .print-card .full-info { grid-column: span 4 / span 4 !important; }
          .print-card .report-qr { width: 82px !important; height: 82px !important; }
          .print-card .qr-frame { padding: 3px !important; }
          .print-card section,
          .print-card .rounded-xl { break-inside: avoid; page-break-inside: avoid; }
          .print-card .mt-7 { margin-top: 8px !important; }
          .print-card .mt-8 { margin-top: 9px !important; }
          .print-card .mt-16 { margin-top: 20px !important; }
          .print-card .mt-10 { margin-top: 10px !important; }
          .print-card .mt-6 { margin-top: 8px !important; }
          .print-card .mb-4 { margin-bottom: 5px !important; }
          .print-card .mb-3 { margin-bottom: 5px !important; }
          .print-card .mt-4 { margin-top: 6px !important; }
          .print-card .pt-5 { padding-top: 7px !important; }
          .print-card .pt-4 { padding-top: 5px !important; }
          .print-card .p-5 { padding: 7px 9px !important; }
          .print-card .gap-6 { gap: 8px !important; }
          .print-card .gap-12 { gap: 18px !important; }
          .print-card .gap-2 { gap: 4px !important; }
          .print-card .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 3px !important; }
          .print-card .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 2px !important; }
          .print-card h2 { line-height: 1.05 !important; }
          .print-card h2.text-xl { font-size: 13px !important; }
          .print-card dt { font-size: 7px !important; line-height: 1.05 !important; }
          .print-card dd { margin-top: 1px !important; font-size: 8.5px !important; line-height: 1.15 !important; }
          .print-card p { line-height: 1.15 !important; }
          .print-card .text-sm { font-size: 8.5px !important; }
          .print-card .text-xs { font-size: 7px !important; }
          .print-card .text-2xl { font-size: 16px !important; }
          .print-card .text-xl { font-size: 13px !important; }
          .print-card table { font-size: 8px !important; line-height: 1.1 !important; }
          .print-card th { padding: 4px 6px !important; }
          .print-card td { padding: 4px 6px !important; }
          .print-card .max-w-sm { max-width: 250px !important; }
          .print-card footer { margin-top: 8px !important; padding-top: 4px !important; }
          @page { size: letter portrait; margin: 0; }
        }
      `}</style>
    </main>
  )
}

function State({ text, error = false }: { text: string; error?: boolean }) {
  return <main className="min-h-screen bg-slate-100 p-6"><div className={`mx-auto max-w-4xl rounded-xl border p-6 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'bg-white text-slate-500'}`}>{text}<div className="mt-4"><Link href="/warehouse/dispatch" className="font-semibold underline">Volver a despachos</Link></div></div></main>
}

function InfoBlock({ title, children, compact = false }: { title: string; children: React.ReactNode; compact?: boolean }) {
  return <div className="rounded-xl border bg-slate-50 p-5"><h2 className="mb-4 font-black uppercase tracking-wide text-slate-900">{title}</h2><dl className={compact ? 'compact-info grid gap-3 sm:grid-cols-4' : 'space-y-3'}>{children}</dl></div>
}

function Info({ label, value, wide = false, full = false }: { label: string; value: string; wide?: boolean; full?: boolean }) {
  const className = full ? 'full-info sm:col-span-4' : wide ? 'wide-info sm:col-span-2' : undefined
  return <div className={className}><dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">{value}</dd></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="p-5 text-center"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{children}</span>
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 text-slate-600"><span>{label}</span><span className="font-semibold text-slate-900">{value}</span></div>
}

function Signature({ label }: { label: string }) {
  return <div className="border-t border-slate-900 pt-2 text-center text-xs font-semibold uppercase text-slate-600">{label}<div className="mt-1 font-normal normal-case text-slate-400">Firma, nombre y fecha</div></div>
}

function Alert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return <div className={`rounded-xl border p-4 text-sm ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{children}</div>
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="space-y-1"><span className="text-sm font-medium text-slate-700">{label}{required && <span className="text-red-600"> *</span>}</span>{children}</label>
}
