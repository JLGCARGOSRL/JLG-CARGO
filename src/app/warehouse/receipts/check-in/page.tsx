'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import {
  getManifestCheckInSummaries,
  type ManifestCheckInSummary,
} from '../../../../lib/services/receiptCheckInService'

type Filter = 'all' | 'pending' | 'discrepancy' | 'completed'

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('es-DO')
}

export default function ReceiptCheckInDashboardPage() {
  const [summaries, setSummaries] = useState<ManifestCheckInSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await getManifestCheckInSummaries()
        if (mounted) setSummaries(data)
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los manifiestos.'
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

  const totals = useMemo(
    () =>
      summaries.reduce(
        (acc, summary) => {
          acc.manifests += 1
          acc.bls += summary.total_bls
          acc.processed += summary.processed_bls
          acc.discrepancies += summary.discrepancy_bls
          acc.expected += summary.expected_pieces
          acc.received += summary.received_pieces
          return acc
        },
        {
          manifests: 0,
          bls: 0,
          processed: 0,
          discrepancies: 0,
          expected: 0,
          received: 0,
        }
      ),
    [summaries]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return summaries.filter((summary) => {
      const matchesSearch = !query ||
        [
          summary.manifest.manifest_number,
          summary.manifest.master_bl,
          summary.manifest.container_number,
          summary.manifest.carrier_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query)

      if (!matchesSearch) return false
      if (filter === 'pending') return summary.processed_bls < summary.total_bls
      if (filter === 'discrepancy') return summary.discrepancy_bls > 0
      if (filter === 'completed') {
        return summary.total_bls > 0 && summary.processed_bls === summary.total_bls
      }
      return true
    })
  }, [filter, search, summaries])

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Entrada por BL</h1>
            <p className="mt-1 text-sm text-slate-500">
              Confirma individualmente los BL recibidos y concilia sus bultos.
            </p>
          </div>
          <Link
            href="/warehouse/receipts"
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Volver a recepciones
          </Link>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Manifiestos" value={formatNumber(totals.manifests)} />
          <Kpi label="BL procesados" value={`${totals.processed} / ${totals.bls}`} />
          <Kpi label="Con diferencias" value={formatNumber(totals.discrepancies)} tone="danger" />
          <Kpi label="Bultos recibidos" value={`${formatNumber(totals.received)} / ${formatNumber(totals.expected)}`} />
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Manifiestos por recibir</h2>
              <p className="text-sm text-slate-500">Selecciona un manifiesto para procesar sus BL.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar manifiesto, Master BL, contenedor..."
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 sm:w-80"
              />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as Filter)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendientes</option>
                <option value="discrepancy">Con diferencias</option>
                <option value="completed">Completados</option>
              </select>
            </div>
          </div>

          {loading ? (
            <Empty text="Cargando manifiestos..." />
          ) : filtered.length === 0 ? (
            <Empty text="No hay manifiestos que coincidan con los filtros." />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-[1050px] w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="border-b px-3 py-3">Manifiesto</th>
                    <th className="border-b px-3 py-3">Llegada</th>
                    <th className="border-b px-3 py-3">Contenedor</th>
                    <th className="border-b px-3 py-3">Progreso BL</th>
                    <th className="border-b px-3 py-3 text-right">Bultos</th>
                    <th className="border-b px-3 py-3 text-right">Diferencias</th>
                    <th className="border-b px-3 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((summary) => (
                    <tr key={summary.manifest.id} className="hover:bg-slate-50">
                      <td className="border-b px-3 py-3">
                        <div className="font-semibold text-slate-900">{summary.manifest.manifest_number}</div>
                        <div className="text-xs text-slate-500">{summary.manifest.master_bl}</div>
                      </td>
                      <td className="border-b px-3 py-3">{formatDate(summary.manifest.arrival_date)}</td>
                      <td className="border-b px-3 py-3">{summary.manifest.container_number || '-'}</td>
                      <td className="border-b px-3 py-3">
                        <div className="mb-1 flex justify-between text-xs">
                          <span>{summary.processed_bls} de {summary.total_bls}</span>
                          <span>{summary.progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${summary.progress}%` }} />
                        </div>
                      </td>
                      <td className="border-b px-3 py-3 text-right">
                        {formatNumber(summary.received_pieces)} / {formatNumber(summary.expected_pieces)}
                      </td>
                      <td className="border-b px-3 py-3 text-right">
                        <span className={summary.discrepancy_bls ? 'font-semibold text-red-700' : 'text-slate-500'}>
                          {summary.discrepancy_bls}
                        </span>
                      </td>
                      <td className="border-b px-3 py-3">
                        <Link
                          href={`/warehouse/receipts/check-in/${summary.manifest.id}`}
                          className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                        >
                          Procesar BL
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

function Kpi({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone === 'danger' ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border bg-slate-50 p-6 text-sm text-slate-500">{text}</div>
}
