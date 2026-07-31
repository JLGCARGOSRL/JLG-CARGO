'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import {
  getWarehouseReceipts,
  type WarehouseReceiptListItem,
} from '../../../lib/services/receiptService'
import { moveWarehouseReceipt } from '../../../lib/services/warehouseOperationsService'

function getCustomerName(receipt: WarehouseReceiptListItem) {
  return (
    receipt.customers?.company_name ||
    receipt.customers?.legal_name ||
    'Cliente sin nombre'
  )
}

function formatDate(value: string | null) {
  if (!value) return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatNumber(value: number | null | undefined, decimals = 2) {
  return Number(value || 0).toLocaleString('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    received: 'Recibido',
    inspection: 'En inspección',
    pending_documents: 'Pendiente documentos',
    available: 'Disponible',
    assigned_to_shipment: 'Asignado a embarque',
    dispatched: 'Despachado',
    cancelled: 'Cancelado',
  }

  return labels[status] || status
}

function getConditionLabel(condition: string) {
  const labels: Record<string, string> = {
    good: 'Buen estado',
    damaged: 'Dañada',
    partial_damage: 'Daño parcial',
    open_box: 'Caja abierta',
    missing_pieces: 'Faltan piezas',
    wet: 'Mojada',
    unknown: 'Sin verificar',
  }

  return labels[condition] || condition
}

export default function WarehouseReceiptsPage() {
  const [receipts, setReceipts] = useState<WarehouseReceiptListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusView, setStatusView] = useState<'reception' | 'all'>('reception')
  const [inspectionReceipt, setInspectionReceipt] =
    useState<WarehouseReceiptListItem | null>(null)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadReceipts() {
      try {
        setLoading(true)
        setError(null)

        const data = await getWarehouseReceipts()

        if (!mounted) return

        setReceipts(data)
      } catch (err) {
        if (!mounted) return

        const message =
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar las recepciones.'

        setError(message)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadReceipts()

    return () => {
      mounted = false
    }
  }, [])

  const filteredReceipts = useMemo(() => {
    const value = search.trim().toLowerCase()
    const visibleReceipts =
      statusView === 'reception'
        ? receipts.filter((receipt) =>
            ['draft', 'received'].includes(receipt.status)
          )
        : receipts

    if (!value) return visibleReceipts

    return visibleReceipts.filter((receipt) => {
      const searchable = [
        receipt.wr_number,
        getCustomerName(receipt),
        receipt.customers?.customer_code,
        receipt.customers?.tax_id,
        receipt.tracking_number,
        receipt.external_reference,
        receipt.description,
        receipt.status,
        receipt.warehouse_manifests?.manifest_number,
        receipt.warehouse_manifests?.master_bl,
        receipt.warehouse_manifests?.container_number,
        receipt.warehouse_locations?.code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(value)
    })
  }, [receipts, search, statusView])

  const totals = useMemo(() => {
    return receipts.reduce(
      (acc, receipt) => {
        acc.total += 1
        acc.pieces += Number(receipt.pieces || 0)
        acc.weight += Number(receipt.weight_kg || 0)

        if (receipt.status === 'received') acc.received += 1
        if (receipt.status === 'inspection') acc.inspection += 1
        if (receipt.status === 'available') acc.available += 1
        if (receipt.status === 'dispatched') acc.dispatched += 1

        return acc
      },
      {
        total: 0,
        received: 0,
        inspection: 0,
        available: 0,
        dispatched: 0,
        pieces: 0,
        weight: 0,
      }
    )
  }, [receipts])

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Recepciones
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Control de WR por cliente generadas desde manifiestos o creadas manualmente.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/warehouse/receipts/check-in"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              Dar entrada por BL
            </Link>

            <Link
              href="/warehouse/manifests/new"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              + Entrada Manifiesto
            </Link>

            <Link
              href="/warehouse/new"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Recepción Manual
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <KpiCard label="Total WR" value={String(totals.total)} />
          <KpiCard label="Recibidas" value={String(totals.received)} />
          <KpiCard label="En inspección" value={String(totals.inspection)} />
          <KpiCard label="Disponibles" value={String(totals.available)} />
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard label="Despachadas" value={String(totals.dispatched)} />
          <KpiCard label="Total piezas" value={formatNumber(totals.pieces, 2)} />
          <KpiCard label="Total peso KG" value={formatNumber(totals.weight, 3)} />
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {statusView === 'reception'
                  ? 'Carga actualmente en recepción'
                  : 'Historial completo de recepciones'}
              </h2>
              <p className="text-sm text-slate-500">
                {statusView === 'reception'
                  ? 'Al enviarla a inspección saldrá de esta cola automáticamente.'
                  : 'Consulta todos los estados sin alterar la trazabilidad.'}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
              <label className="sr-only" htmlFor="receipt-status-view">
                Vista de recepciones
              </label>
              <select
                id="receipt-status-view"
                value={statusView}
                onChange={(event) =>
                  setStatusView(event.target.value as 'reception' | 'all')
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="reception">En recepción</option>
                <option value="all">Todas / historial</option>
              </select>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar WR, cliente, RNC, manifiesto, BL..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border bg-slate-50 p-6 text-sm text-slate-500">
              Cargando recepciones...
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="rounded-xl border bg-slate-50 p-6 text-sm text-slate-500">
              {statusView === 'reception'
                ? 'No hay cargas pendientes en recepción.'
                : 'No hay recepciones para mostrar.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-[1250px] w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="border-b px-3 py-3">WR</th>
                    <th className="border-b px-3 py-3">Acción</th>
                    <th className="border-b px-3 py-3">Cliente</th>
                    <th className="border-b px-3 py-3">Manifiesto</th>
                    <th className="border-b px-3 py-3">Master BL</th>
                    <th className="border-b px-3 py-3">Contenedor</th>
                    <th className="border-b px-3 py-3">Fecha</th>
                    <th className="border-b px-3 py-3 text-right">Piezas</th>
                    <th className="border-b px-3 py-3 text-right">Peso KG</th>
                    <th className="border-b px-3 py-3">Condición</th>
                    <th className="border-b px-3 py-3">Ubicación</th>
                    <th className="border-b px-3 py-3">Estado</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReceipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-slate-50 align-top">
                      <td className="border-b px-3 py-3 font-semibold text-slate-900">
                        <Link
                          href={`/warehouse/receipts/${receipt.id}`}
                          className="text-slate-900 underline-offset-4 hover:underline"
                        >
                          {receipt.wr_number}
                        </Link>
                      </td>

                      <td className="border-b px-3 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <Link
                            href={`/warehouse/receipts/${receipt.id}`}
                            className="inline-flex rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Ver recepción
                          </Link>

                          {['received', 'pending_documents', 'available'].includes(
                            receipt.status
                          ) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSuccess('')
                                setInspectionReceipt(receipt)
                              }}
                              className="inline-flex rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                            >
                              Enviar a inspección
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="border-b px-3 py-3">
                        <div className="font-semibold text-slate-900">
                          {getCustomerName(receipt)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {receipt.customers?.customer_code || '-'}
                          {receipt.customers?.tax_id
                            ? ` · RNC ${receipt.customers.tax_id}`
                            : ''}
                        </div>
                      </td>

                      <td className="border-b px-3 py-3">
                        {receipt.warehouse_manifests?.manifest_number || '-'}
                      </td>

                      <td className="border-b px-3 py-3">
                        {receipt.warehouse_manifests?.master_bl ||
                          receipt.external_reference ||
                          '-'}
                      </td>

                      <td className="border-b px-3 py-3">
                        {receipt.warehouse_manifests?.container_number || '-'}
                      </td>

                      <td className="border-b px-3 py-3">
                        {formatDate(receipt.received_at)}
                      </td>

                      <td className="border-b px-3 py-3 text-right">
                        {formatNumber(receipt.pieces, 2)}
                      </td>

                      <td className="border-b px-3 py-3 text-right">
                        {formatNumber(receipt.weight_kg, 3)}
                      </td>

                      <td className="border-b px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {getConditionLabel(receipt.cargo_condition)}
                        </span>
                      </td>

                      <td className="border-b px-3 py-3">
                        {receipt.warehouse_locations?.code || 'Sin ubicación'}
                      </td>

                      <td className="border-b px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {getStatusLabel(receipt.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {inspectionReceipt && (
          <InspectionStatusModal
            receipt={inspectionReceipt}
            onClose={() => setInspectionReceipt(null)}
            onDone={async () => {
              setInspectionReceipt(null)
              setSuccess(
                `${inspectionReceipt.wr_number} fue enviada a inspección y el cambio quedó registrado.`
              )
              try {
                setReceipts(await getWarehouseReceipts())
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : 'El estado cambió, pero no se pudo actualizar la lista.'
                )
              }
            }}
          />
        )}
      </div>
    </main>
  )
}

function InspectionStatusModal({
  receipt,
  onClose,
  onDone,
}: {
  receipt: WarehouseReceiptListItem
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    const formData = new FormData(event.currentTarget)

    try {
      await moveWarehouseReceipt({
        receiptId: receipt.id,
        locationId: receipt.location_id || '',
        status: 'inspection',
        operatorName: String(formData.get('operator') || '').trim(),
        notes: String(formData.get('notes') || '').trim(),
      })
      await onDone()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo enviar la recepción a inspección.'
      )
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspection-status-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-5">
          <h2 id="inspection-status-title" className="text-xl font-bold text-slate-950">
            Enviar {receipt.wr_number} a inspección
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Se cambiará únicamente el estado a “En inspección”. La empresa,
            cantidades, documentos y ubicación actual se conservarán.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="block text-sm font-semibold text-slate-800">
            Responsable *
            <input
              name="operator"
              required
              placeholder="Nombre del operador"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-800">
            Motivo de la inspección *
            <textarea
              name="notes"
              required
              rows={3}
              placeholder="Ej.: Verificación adicional de carga o documentación"
              className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Confirmar inspección'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
