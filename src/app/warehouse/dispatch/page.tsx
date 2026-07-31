'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import {
  getDispatchDashboard,
  type DispatchDashboardData,
} from '../../../lib/services/dispatchService'
import {
  BILLING_STATUS_LABELS,
  DISPATCH_STATUS_LABELS,
  type DispatchBillingStatus,
} from '../../../types/dispatch'

type View = 'available' | 'history' | 'billing'

const emptyData: DispatchDashboardData = { candidates: [], dispatches: [] }

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

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

function billingClass(status: DispatchBillingStatus) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800'
  if (status === 'invoiced') return 'bg-blue-100 text-blue-800'
  if (status === 'ready') return 'bg-amber-100 text-amber-800'
  if (status === 'cancelled') return 'bg-red-100 text-red-800'
  return 'bg-slate-100 text-slate-700'
}

export default function DispatchDashboardPage() {
  const [data, setData] = useState<DispatchDashboardData>(emptyData)
  const [view, setView] = useState<View>('available')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await getDispatchDashboard()
        if (mounted) setData(result)
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'No se pudo cargar el módulo de despacho.'
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const eligible = useMemo(
    () => data.candidates.filter((candidate) => candidate.eligible),
    [data.candidates]
  )

  const totals = useMemo(() => {
    const activeDispatches = data.dispatches.filter(
      (dispatch) => dispatch.dispatch_status !== 'cancelled'
    )
    return {
      availableBls: eligible.length,
      availablePieces: eligible.reduce(
        (total, candidate) => total + candidate.available_pieces,
        0
      ),
      dispatches: activeDispatches.length,
      pendingBilling: activeDispatches.filter(
        (dispatch) => dispatch.billing_status === 'pending' || dispatch.billing_status === 'ready'
      ).length,
    }
  }, [data.dispatches, eligible])

  const filteredCandidates = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.candidates.filter((candidate) => {
      if (!candidate.eligible) return false
      return (
        !query ||
        [
          candidate.document_number,
          candidate.wr_number,
          candidate.manifest_number,
          candidate.master_bl,
          candidate.customer_name,
          candidate.customer_code,
          candidate.container_number,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    })
  }, [data.candidates, search])

  const filteredDispatches = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.dispatches.filter((dispatch) => {
      if (
        view === 'billing' &&
        !['pending', 'ready', 'invoiced'].includes(dispatch.billing_status)
      ) {
        return false
      }
      return (
        !query ||
        [
          dispatch.dispatch_number,
          dispatch.document_number,
          dispatch.wr_number,
          dispatch.manifest_number,
          dispatch.customer_name,
          dispatch.recipient_name,
          dispatch.invoice_reference,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    })
  }, [data.dispatches, search, view])

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Facturación y despacho por BL</h1>
            <p className="mt-1 text-sm text-slate-500">
              Etapa final para liquidar servicios, facturar y autorizar la salida de carga verificada por Aduanas.
            </p>
          </div>
          <Link
            href="/warehouse/receipts/check-in"
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Ver entradas por BL
          </Link>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="BL disponibles" value={formatNumber(totals.availableBls)} />
          <Kpi label="Bultos disponibles" value={formatNumber(totals.availablePieces)} />
          <Kpi label="Despachos realizados" value={formatNumber(totals.dispatches)} />
          <Kpi
            label="Pendientes de cobro"
            value={formatNumber(totals.pendingBilling)}
            warning={totals.pendingBilling > 0}
          />
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <Tab active={view === 'available'} onClick={() => setView('available')}>
                Carga disponible
              </Tab>
              <Tab active={view === 'history'} onClick={() => setView('history')}>
                Historial
              </Tab>
              <Tab active={view === 'billing'} onClick={() => setView('billing')}>
                Por facturar
              </Tab>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar BL, WR, cliente o despacho..."
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 lg:w-96"
            />
          </div>

          {loading ? (
            <Empty text="Cargando información de despacho..." />
          ) : view === 'available' ? (
            filteredCandidates.length === 0 ? (
              <Empty text="No hay BL disponibles para despacho." />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-[1150px] w-full border-collapse text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                    <tr>
                      <th className="border-b px-3 py-3">BL / WR</th>
                      <th className="border-b px-3 py-3">Cliente</th>
                      <th className="border-b px-3 py-3">Manifiesto</th>
                      <th className="border-b px-3 py-3">Ubicación</th>
                      <th className="border-b px-3 py-3 text-right">Recibidos</th>
                      <th className="border-b px-3 py-3 text-right">Despachados</th>
                      <th className="border-b px-3 py-3 text-right">Disponibles</th>
                      <th className="border-b px-3 py-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCandidates.map((candidate) => (
                      <tr key={candidate.receipt_id} className="hover:bg-slate-50">
                        <td className="border-b px-3 py-3">
                          <div className="font-semibold text-slate-900">{candidate.document_number}</div>
                          <div className="text-xs text-slate-500">{candidate.wr_number}</div>
                        </td>
                        <td className="border-b px-3 py-3">
                          <div className="font-medium text-slate-900">{candidate.customer_name}</div>
                          <div className="text-xs text-slate-500">{candidate.customer_code || '-'}</div>
                        </td>
                        <td className="border-b px-3 py-3">
                          <div>{candidate.manifest_number}</div>
                          <div className="text-xs text-slate-500">{candidate.master_bl}</div>
                        </td>
                        <td className="border-b px-3 py-3">{candidate.location_code || 'Sin ubicación'}</td>
                        <td className="border-b px-3 py-3 text-right">{formatNumber(candidate.received_pieces)}</td>
                        <td className="border-b px-3 py-3 text-right">{formatNumber(candidate.dispatched_pieces)}</td>
                        <td className="border-b px-3 py-3 text-right font-bold text-emerald-700">
                          {formatNumber(candidate.available_pieces)}
                        </td>
                        <td className="border-b px-3 py-3">
                          <Link
                            href={`/warehouse/dispatch/${candidate.receipt_id}`}
                            className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            Crear despacho
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredDispatches.length === 0 ? (
            <Empty text={view === 'billing' ? 'No hay despachos pendientes de facturación.' : 'Todavía no hay despachos registrados.'} />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-[1200px] w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="border-b px-3 py-3">Despacho</th>
                    <th className="border-b px-3 py-3">BL / Cliente</th>
                    <th className="border-b px-3 py-3">Entrega</th>
                    <th className="border-b px-3 py-3 text-right">Bultos</th>
                    <th className="border-b px-3 py-3">Estado</th>
                    <th className="border-b px-3 py-3">Cobro</th>
                    <th className="border-b px-3 py-3 text-right">Total</th>
                    <th className="border-b px-3 py-3">Reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDispatches.map((dispatch) => (
                    <tr key={dispatch.id} className="hover:bg-slate-50">
                      <td className="border-b px-3 py-3">
                        <div className="font-semibold text-slate-900">{dispatch.dispatch_number}</div>
                        <div className="text-xs text-slate-500">{formatDate(dispatch.dispatched_at)}</div>
                      </td>
                      <td className="border-b px-3 py-3">
                        <div className="font-semibold">{dispatch.document_number}</div>
                        <div className="text-xs text-slate-500">{dispatch.customer_name}</div>
                      </td>
                      <td className="border-b px-3 py-3">
                        <div>{dispatch.recipient_name}</div>
                        <div className="text-xs text-slate-500">{dispatch.vehicle_plate || 'Sin placa'}</div>
                      </td>
                      <td className="border-b px-3 py-3 text-right">{formatNumber(dispatch.pieces_dispatched)}</td>
                      <td className="border-b px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {DISPATCH_STATUS_LABELS[dispatch.dispatch_status]}
                        </span>
                      </td>
                      <td className="border-b px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${billingClass(dispatch.billing_status)}`}>
                          {BILLING_STATUS_LABELS[dispatch.billing_status]}
                        </span>
                      </td>
                      <td className="border-b px-3 py-3 text-right font-semibold">
                        {formatMoney(dispatch.total_amount, dispatch.currency)}
                      </td>
                      <td className="border-b px-3 py-3">
                        <Link
                          href={`/warehouse/dispatch/report/${dispatch.id}`}
                          className="inline-flex rounded-lg border bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                        >
                          Ver reporte
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Kpi({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${warning ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold ${active ? 'bg-slate-900 text-white' : 'border bg-white text-slate-700 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border bg-slate-50 p-8 text-center text-sm text-slate-500">{text}</div>
}
