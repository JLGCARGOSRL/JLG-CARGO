'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Banknote,
  CircleDollarSign,
  Download,
  FileCheck2,
  Printer,
  ReceiptText,
  WalletCards,
} from 'lucide-react'

import {
  getBillingReport,
  type BillingReportRecord,
} from '../../../lib/services/billingReportService'
import type { DispatchBillingStatus, DispatchCurrency } from '../../../types/dispatch'

type StatusFilter = 'all' | 'invoiced' | 'paid'
type CurrencyFilter = 'all' | DispatchCurrency

const statusLabels: Record<Extract<DispatchBillingStatus, 'invoiced' | 'paid'>, string> = {
  invoiced: 'Facturado / por cobrar',
  paid: 'Pagado',
}

function money(value: number, currency: DispatchCurrency) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

function date(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('es-DO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
}

function dateKey(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function BillingReportPage() {
  const [records, setRecords] = useState<BillingReportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [currency, setCurrency] = useState<CurrencyFilter>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true

    getBillingReport()
      .then((result) => {
        if (active) setRecords(result)
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el reporte de facturación.'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return records.filter((record) => {
      const billingDay = dateKey(record.billing_date)
      if (status !== 'all' && record.billing_status !== status) return false
      if (currency !== 'all' && record.currency !== currency) return false
      if (fromDate && billingDay < fromDate) return false
      if (toDate && billingDay > toDate) return false

      return (
        !query ||
        [
          record.invoice_reference,
          record.dispatch_number,
          record.document_number,
          record.wr_number,
          record.customer_name,
          record.customer_code,
          record.manifest_number,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    })
  }, [currency, fromDate, records, search, status, toDate])

  const totals = useMemo(() => {
    const summarize = (selectedCurrency: DispatchCurrency) => {
      const rows = filtered.filter((record) => record.currency === selectedCurrency)
      const paid = rows.filter((record) => record.billing_status === 'paid')
      const receivable = rows.filter((record) => record.billing_status === 'invoiced')

      return {
        count: rows.length,
        invoiced: rows.reduce((sum, record) => sum + record.total_amount, 0),
        paid: paid.reduce((sum, record) => sum + record.total_amount, 0),
        receivable: receivable.reduce((sum, record) => sum + record.total_amount, 0),
        tax: rows.reduce((sum, record) => sum + record.tax_amount, 0),
      }
    }

    return { DOP: summarize('DOP'), USD: summarize('USD') }
  }, [filtered])

  const monthly = useMemo(() => {
    const rows = new Map<
      string,
      { label: string; DOP: number; USD: number; count: number }
    >()

    for (const record of filtered) {
      const parsed = new Date(record.billing_date)
      if (Number.isNaN(parsed.getTime())) continue
      const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`
      const current = rows.get(key) || {
        label: parsed.toLocaleDateString('es-DO', {
          month: 'long',
          year: 'numeric',
        }),
        DOP: 0,
        USD: 0,
        count: 0,
      }
      current[record.currency] += record.total_amount
      current.count += 1
      rows.set(key, current)
    }

    return [...rows.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, 12)
      .map(([, value]) => value)
  }, [filtered])

  const visibleIds = useMemo(() => filtered.map((record) => record.id), [filtered])
  const selectedRecords = useMemo(
    () => records.filter((record) => selectedIds.has(record.id)),
    [records, selectedIds]
  )
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  function toggleRecord(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleVisibleRecords() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }

  function printSelected() {
    if (!selectedRecords.length) return
    const ids = selectedRecords.map((record) => record.id).join(',')
    window.open(`/warehouse/billing/print?ids=${encodeURIComponent(ids)}`, '_blank', 'noopener,noreferrer')
  }

  function exportCsv() {
    const quote = (value: string | number | null) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`
    const lines = [
      [
        'Fecha facturación',
        'Factura',
        'Despacho',
        'Cliente',
        'BL',
        'Estado',
        'Moneda',
        'Subtotal',
        'ITBIS',
        'Descuento',
        'Total',
      ].map(quote),
      ...filtered.map((record) =>
        [
          date(record.billing_date),
          record.invoice_reference,
          record.dispatch_number,
          record.customer_name,
          record.document_number,
          statusLabels[record.billing_status as 'invoiced' | 'paid'],
          record.currency,
          record.subtotal,
          record.tax_amount,
          record.discount_amount,
          record.total_amount,
        ].map(quote)
      ),
    ]
    const blob = new Blob([`\ufeff${lines.map((line) => line.join(',')).join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-facturacion-${dateKey(new Date().toISOString())}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-700">
              <CircleDollarSign size={19} /> Control financiero
            </div>
            <h1 className="text-3xl font-bold text-slate-950">Reporte de facturación</h1>
            <p className="mt-1 text-sm text-slate-500">
              Totales facturados, cobrados y pendientes, separados por moneda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/warehouse/dispatch"
              className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Ver despachos
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!filtered.length}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Download size={17} /> Exportar CSV
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-2">
          <CurrencySummary currency="DOP" totals={totals.DOP} />
          <CurrencySummary currency="USD" totals={totals.USD} />
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_repeat(4,1fr)]">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Buscar
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Factura, cliente, BL o despacho"
                className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-slate-900"
              />
            </label>
            <Filter label="Estado" value={status} onChange={(value) => setStatus(value as StatusFilter)}>
              <option value="all">Facturado + pagado</option>
              <option value="invoiced">Por cobrar</option>
              <option value="paid">Pagado</option>
            </Filter>
            <Filter label="Moneda" value={currency} onChange={(value) => setCurrency(value as CurrencyFilter)}>
              <option value="all">DOP y USD separados</option>
              <option value="DOP">Solo DOP</option>
              <option value="USD">Solo USD</option>
            </Filter>
            <DateFilter label="Desde" value={fromDate} onChange={setFromDate} />
            <DateFilter label="Hasta" value={toDate} onChange={setToDate} />
          </div>
          {(search || status !== 'all' || currency !== 'all' || fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatus('all')
                setCurrency('all')
                setFromDate('')
                setToDate('')
              }}
              className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_2.2fr]">
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="font-bold text-slate-950">Facturación mensual</h2>
              <p className="text-sm text-slate-500">Últimos 12 meses con actividad en el filtro.</p>
            </div>
            <div className="max-h-[620px] divide-y overflow-y-auto">
              {monthly.length ? (
                monthly.map((month) => (
                  <div key={month.label} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold capitalize text-slate-800">{month.label}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {month.count} factura{month.count === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <div className="rounded-lg bg-blue-50 px-3 py-2 font-bold text-blue-800">
                        {money(month.DOP, 'DOP')}
                      </div>
                      <div className="rounded-lg bg-emerald-50 px-3 py-2 font-bold text-emerald-800">
                        {money(month.USD, 'USD')}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Empty text="No hay facturas para los filtros seleccionados." />
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-950">Detalle de facturas</h2>
                <p className="text-sm text-slate-500">
                  {filtered.length} comprobante{filtered.length === 1 ? '' : 's'} en el resultado.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:underline"
                  >
                    Limpiar selección
                  </button>
                )}
                <button
                  type="button"
                  onClick={printSelected}
                  disabled={!selectedRecords.length}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Printer size={17} />
                  Imprimir seleccionadas ({selectedRecords.length})
                </button>
              </div>
            </div>
            {loading ? (
              <Empty text="Calculando la facturación..." />
            ) : filtered.length ? (
              <div className="max-h-[620px] overflow-auto">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase text-slate-600">
                    <tr>
                      <th className="w-12 px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleVisibleRecords}
                          aria-label="Seleccionar todas las facturas visibles"
                          className="h-4 w-4 cursor-pointer accent-blue-700"
                        />
                      </th>
                      <th className="px-3 py-3">Factura / fecha</th>
                      <th className="px-3 py-3">Cliente</th>
                      <th className="px-3 py-3">Despacho / BL</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3 text-right">Subtotal</th>
                      <th className="px-3 py-3 text-right">ITBIS</th>
                      <th className="px-3 py-3 text-right">Total</th>
                      <th className="px-3 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(record.id)}
                            onChange={() => toggleRecord(record.id)}
                            aria-label={`Seleccionar factura ${record.invoice_reference || record.dispatch_number}`}
                            className="h-4 w-4 cursor-pointer accent-blue-700"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900">
                            {record.invoice_reference || 'Sin referencia'}
                          </div>
                          <div className="text-xs text-slate-500">{date(record.billing_date)}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold">{record.customer_name}</div>
                          <div className="text-xs text-slate-500">{record.customer_code || '-'}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div>{record.dispatch_number}</div>
                          <div className="text-xs text-slate-500">{record.document_number}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              record.billing_status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {statusLabels[record.billing_status as 'invoiced' | 'paid']}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">{money(record.subtotal, record.currency)}</td>
                        <td className="px-3 py-3 text-right">{money(record.tax_amount, record.currency)}</td>
                        <td className="px-3 py-3 text-right font-black text-slate-950">
                          {money(record.total_amount, record.currency)}
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/warehouse/dispatch/report/${record.id}`}
                            className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                          >
                            Ver comprobante
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="No hay facturas para los filtros seleccionados." />
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function CurrencySummary({
  currency,
  totals,
}: {
  currency: DispatchCurrency
  totals: { count: number; invoiced: number; paid: number; receivable: number; tax: number }
}) {
  const blue = currency === 'DOP'
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${blue ? 'bg-blue-950 text-white' : 'bg-emerald-950 text-white'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">Moneda</p>
          <h2 className="mt-1 text-2xl font-black">{currency}</h2>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          {blue ? <Banknote size={25} /> : <CircleDollarSign size={25} />}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MoneyMetric icon={ReceiptText} label="Facturado" value={money(totals.invoiced, currency)} />
        <MoneyMetric icon={WalletCards} label="Cobrado" value={money(totals.paid, currency)} />
        <MoneyMetric icon={FileCheck2} label="Por cobrar" value={money(totals.receivable, currency)} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-xs text-white/65">
        <span>{totals.count} factura{totals.count === 1 ? '' : 's'}</span>
        <span>ITBIS incluido: {money(totals.tax, currency)}</span>
      </div>
    </div>
  )
}

function MoneyMetric({ icon: Icon, label, value }: { icon: typeof ReceiptText; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-white/65"><Icon size={15} /> {label}</div>
      <div className="mt-2 break-words text-lg font-black">{value}</div>
    </div>
  )
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-slate-900"
      >
        {children}
      </select>
    </label>
  )
}

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal tracking-normal text-slate-900"
      />
    </label>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-slate-500">{text}</div>
}
