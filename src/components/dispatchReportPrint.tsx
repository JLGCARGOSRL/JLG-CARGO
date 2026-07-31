import Image from 'next/image'
import type { ReactNode } from 'react'

import type { DispatchRecord } from '../types/dispatch'
import {
  BILLING_STATUS_LABELS,
  DISPATCH_STATUS_LABELS,
} from '../types/dispatch'
import VerificationQr from './verificationQr'

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('es-DO')
}

function formatShortDate(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

export default function DispatchReportPrint({
  dispatch,
  pageBreak = false,
}: {
  dispatch: DispatchRecord
  pageBreak?: boolean
}) {
  return (
    <article
      className={`print-card mx-auto max-w-5xl bg-white p-8 ${
        pageBreak ? 'group-print-page' : ''
      }`}
    >
      <header className="flex flex-col gap-6 border-b-2 border-slate-900 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Image
            src="/jlg-cargo-logo.jpg"
            alt="JLG Cargo SRL"
            width={160}
            height={81}
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
        <InfoBlock title="Cliente y BL">
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
          <Info
            label={`Seguro (${formatNumber(dispatch.insurance_rate, 2)}%)`}
            value={formatMoney(dispatch.insurance_amount, dispatch.currency)}
          />
        </InfoBlock>
      </section>

      <section className="mt-7 rounded-xl border-2 border-slate-900">
        <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Metric label="Bultos entregados" value={formatNumber(dispatch.pieces_dispatched)} />
          <Metric label="Peso entregado" value={`${formatNumber(dispatch.weight_dispatched_kg, 3)} KG`} />
          <Metric label="Bultos restantes" value={formatNumber(dispatch.remaining_pieces)} />
        </div>
      </section>

      <section className="mt-7">
        <InfoBlock title="Autorizado a retirar y transporte">
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
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Sin cargos registrados.</td>
                </tr>
              ) : (
                dispatch.charges.map((charge) => (
                  <tr key={charge.id || `${charge.charge_code}-${charge.sort_order}`}>
                    <td className="border-b px-3 py-3">{charge.description}</td>
                    <td className="border-b px-3 py-3 text-right">{formatNumber(charge.quantity, 2)}</td>
                    <td className="border-b px-3 py-3">{charge.unit}</td>
                    <td className="border-b px-3 py-3 text-right">{formatMoney(charge.unit_rate, dispatch.currency)}</td>
                    <td className="border-b px-3 py-3 text-right font-semibold">{formatMoney(charge.amount || 0, dispatch.currency)}</td>
                    <td className="border-b px-3 py-3 text-right">{formatMoney((charge.amount || 0) * dispatch.tax_rate / 100, dispatch.currency)}</td>
                    <td className="border-b px-3 py-3 text-right font-semibold">{formatMoney((charge.amount || 0) * (1 + dispatch.tax_rate / 100), dispatch.currency)}</td>
                  </tr>
                ))
              )}
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
          {dispatch.invoice_reference && (
            <p className="pt-2 text-right text-xs text-slate-500">
              Factura / referencia: {dispatch.invoice_reference}
            </p>
          )}
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
  )
}

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-5">
      <h2 className="mb-4 font-black uppercase tracking-wide text-slate-900">{title}</h2>
      <dl className="compact-info grid gap-3 sm:grid-cols-4">{children}</dl>
    </div>
  )
}

function Info({ label, value, wide = false, full = false }: { label: string; value: string; wide?: boolean; full?: boolean }) {
  const className = full ? 'full-info sm:col-span-4' : wide ? 'wide-info sm:col-span-2' : undefined
  return <div className={className}><dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">{value}</dd></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="p-5 text-center"><p className="text-xs font-semibold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{children}</span>
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 text-slate-600"><span>{label}</span><span className="font-semibold text-slate-900">{value}</span></div>
}

function Signature({ label }: { label: string }) {
  return <div className="border-t border-slate-900 pt-2 text-center text-xs font-semibold uppercase text-slate-600">{label}<div className="mt-1 font-normal normal-case text-slate-400">Firma, nombre y fecha</div></div>
}
