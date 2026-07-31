'use client'

import Link from 'next/link'
import { Download, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'

import DispatchReportPrint from '../../../../components/dispatchReportPrint'
import { downloadDispatchInvoicesPdf } from '../../../../lib/pdf/dispatchInvoicesPdf'
import { getDispatchReports } from '../../../../lib/services/dispatchService'
import type { DispatchRecord } from '../../../../types/dispatch'

export default function BillingGroupPrintPage() {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  async function downloadPdf() {
    if (!dispatches.length || downloading) return
    try {
      setDownloading(true)
      setError('')
      await downloadDispatchInvoicesPdf(dispatches)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el archivo PDF.')
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    let active = true
    const ids = new URLSearchParams(window.location.search)
      .get('ids')
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean) || []

    if (!ids.length) {
      Promise.resolve().then(() => {
        if (!active) return
        setError('No seleccionaste ninguna factura para imprimir.')
        setLoading(false)
      })
      return
    }

    getDispatchReports(ids)
      .then((result) => {
        if (!active) return
        setDispatches(result)
        if (!result.length) setError('No se encontraron las facturas seleccionadas.')
        else if (result.length !== new Set(ids).size) {
          setError('Algunas facturas no pudieron cargarse. Puedes imprimir las que aparecen abajo.')
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudieron cargar las facturas.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="group-print-root min-h-screen bg-slate-100 p-6">
      <div className="print-hidden mx-auto mb-5 flex max-w-5xl flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-slate-950">Impresión agrupada</h1>
          <p className="text-sm text-slate-500">
            {loading
              ? 'Preparando facturas...'
              : `${dispatches.length} factura${dispatches.length === 1 ? '' : 's'} lista${dispatches.length === 1 ? '' : 's'} para imprimir.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/warehouse/billing" className="rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">
            Volver a facturación
          </Link>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={loading || downloading || !dispatches.length}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-40"
          >
            <Download size={17} /> {downloading ? 'Creando PDF...' : 'Descargar PDF'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || !dispatches.length}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            <Printer size={17} /> Imprimir grupo
          </button>
        </div>
      </div>

      {error && (
        <div className="print-hidden mx-auto mb-5 max-w-5xl rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="print-hidden mx-auto max-w-5xl rounded-xl border bg-white p-8 text-center text-sm text-slate-500">
          Cargando los comprobantes seleccionados...
        </div>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {dispatches.map((dispatch, index) => (
            <DispatchReportPrint
              key={dispatch.id}
              dispatch={dispatch}
              pageBreak={index < dispatches.length - 1}
            />
          ))}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body > div > aside { display: none !important; }
          body > div > main { padding: 0 !important; background: white !important; }
          .print-hidden { display: none !important; }
          .group-print-root { padding: 0 !important; background: white !important; }
          .group-print-page { break-after: page; page-break-after: always; }
          .print-card {
            max-width: none !important;
            border: 0 !important;
            box-shadow: none !important;
            padding: 8mm 10mm !important;
            font-size: 8.5px !important;
            line-height: 1.15 !important;
          }
          .print-card header { gap: 8px !important; padding-bottom: 8px !important; }
          .print-card header .text-3xl { font-size: 19px !important; line-height: 1.05 !important; }
          .print-card header .text-2xl { font-size: 16px !important; line-height: 1.05 !important; }
          .print-card header .mt-2 { margin-top: 3px !important; }
          .print-card header .mt-1 { margin-top: 2px !important; }
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
          .print-card .mb-4, .print-card .mb-3 { margin-bottom: 5px !important; }
          .print-card .mt-4 { margin-top: 6px !important; }
          .print-card .pt-4 { padding-top: 5px !important; }
          .print-card .p-5 { padding: 7px 9px !important; }
          .print-card .gap-6 { gap: 8px !important; }
          .print-card .gap-12 { gap: 18px !important; }
          .print-card .gap-2 { gap: 4px !important; }
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
          .print-card th, .print-card td { padding: 4px 6px !important; }
          .print-card .max-w-sm { max-width: 250px !important; }
          .print-card footer { margin-top: 8px !important; padding-top: 4px !important; }
          @page { size: letter portrait; margin: 0; }
        }
      `}</style>
    </main>
  )
}
