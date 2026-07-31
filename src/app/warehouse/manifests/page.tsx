'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import {
  deleteManifest,
  getManifests,
} from '../../../lib/services/manifestService'

import type { WarehouseManifest } from '../../../types/manifest'

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
    open: 'Abierto',
    receiving: 'En recepción',
    received: 'Recibido',
    in_inspection: 'En inspección',
    ready_to_store: 'Listo para almacenar',
    stored: 'Almacenado',
    partially_dispatched: 'Parcialmente despachado',
    dispatched: 'Despachado',
    cancelled: 'Cancelado',
  }

  return labels[status] || status
}

export default function WarehouseManifestsPage() {
  const [manifests, setManifests] = useState<WarehouseManifest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [manifestToDelete, setManifestToDelete] =
    useState<WarehouseManifest | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadManifests() {
      try {
        setLoading(true)
        setError(null)

        const data = await getManifests()

        if (!mounted) return

        setManifests(data)
      } catch (err) {
        if (!mounted) return

        const message =
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los manifiestos.'

        setError(message)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadManifests()

    return () => {
      mounted = false
    }
  }, [])

  async function handleDelete(manifest: WarehouseManifest) {
    try {
      setDeletingId(manifest.id)
      setError(null)
      setSuccess(null)

      await deleteManifest(manifest.id)

      setManifests((current) =>
        current.filter((item) => item.id !== manifest.id)
      )
      setManifestToDelete(null)
      setSuccess(`El manifiesto ${manifest.manifest_number} fue eliminado.`)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el manifiesto.'

      setError(message)
    } finally {
      setDeletingId(null)
    }
  }

  const filteredManifests = useMemo(() => {
    const value = search.trim().toLowerCase()

    if (!value) return manifests

    return manifests.filter((manifest) => {
      const searchable = [
        manifest.manifest_number,
        manifest.master_bl,
        manifest.container_number,
        manifest.carrier_name,
        manifest.agent_name,
        manifest.customs_administration,
        manifest.vehicle_plate,
        manifest.cargo_label,
        manifest.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(value)
    })
  }, [manifests, search])

  const totals = useMemo(() => {
    return manifests.reduce(
      (acc, manifest) => {
        acc.manifests += 1
        acc.packages += Number(manifest.total_packages || 0)
        acc.weight += Number(manifest.total_weight_kg || 0)
        acc.cbm += Number(manifest.total_volume_cbm || 0)
        return acc
      },
      {
        manifests: 0,
        packages: 0,
        weight: 0,
        cbm: 0,
      }
    )
  }, [manifests])

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Dashboard de manifiestos
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Consulta los manifiestos creados y accede al detalle operativo.
            </p>
          </div>

          <Link
            href="/warehouse/manifests/new"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + Entrada Manifiesto
          </Link>
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
          <KpiCard label="Manifiestos" value={String(totals.manifests)} />
          <KpiCard label="Total bultos" value={formatNumber(totals.packages, 2)} />
          <KpiCard label="Total peso KG" value={formatNumber(totals.weight, 3)} />
          <KpiCard label="Total CBM" value={formatNumber(totals.cbm, 4)} />
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Manifiestos creados
              </h2>
              <p className="text-sm text-slate-500">
                Listado general de manifiestos registrados en el sistema.
              </p>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar manifiesto, BL, contenedor, placa..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 sm:max-w-md"
            />
          </div>

          {loading ? (
            <div className="rounded-xl border bg-slate-50 p-6 text-sm text-slate-500">
              Cargando manifiestos...
            </div>
          ) : filteredManifests.length === 0 ? (
            <div className="rounded-xl border bg-slate-50 p-6 text-sm text-slate-500">
              No hay manifiestos para mostrar.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-[1200px] w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="border-b px-3 py-3">Manifiesto</th>
                    <th className="border-b px-3 py-3">Master BL</th>
                    <th className="border-b px-3 py-3">Llegada</th>
                    <th className="border-b px-3 py-3">Contenedor</th>
                    <th className="border-b px-3 py-3">Transportista</th>
                    <th className="border-b px-3 py-3">Placa</th>
                    <th className="border-b px-3 py-3">Adm. Aduanal</th>
                    <th className="border-b px-3 py-3 text-right">Bultos</th>
                    <th className="border-b px-3 py-3 text-right">Peso KG</th>
                    <th className="border-b px-3 py-3 text-right">CBM</th>
                    <th className="border-b px-3 py-3">Estado</th>
                    <th className="border-b px-3 py-3">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredManifests.map((manifest) => (
                    <tr key={manifest.id} className="hover:bg-slate-50">
                      <td className="border-b px-3 py-3 font-semibold text-slate-900">
                        {manifest.manifest_number}
                      </td>

                      <td className="border-b px-3 py-3">
                        {manifest.master_bl}
                      </td>

                      <td className="border-b px-3 py-3">
                        {formatDate(manifest.arrival_date)}
                      </td>

                      <td className="border-b px-3 py-3">
                        {manifest.container_number || '-'}
                      </td>

                      <td className="border-b px-3 py-3">
                        {manifest.carrier_name || '-'}
                      </td>

                      <td className="border-b px-3 py-3">
                        {manifest.vehicle_plate || '-'}
                      </td>

                      <td className="border-b px-3 py-3">
                        {manifest.customs_administration || '-'}
                      </td>

                      <td className="border-b px-3 py-3 text-right">
                        {formatNumber(manifest.total_packages, 2)}
                      </td>

                      <td className="border-b px-3 py-3 text-right">
                        {formatNumber(manifest.total_weight_kg, 3)}
                      </td>

                      <td className="border-b px-3 py-3 text-right">
                        {formatNumber(manifest.total_volume_cbm, 4)}
                      </td>

                      <td className="border-b px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {getStatusLabel(manifest.status)}
                        </span>
                      </td>

                      <td className="border-b px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/warehouse/manifests/${manifest.id}`}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Ver detalle
                          </Link>
                          <Link
                            href={`/warehouse/manifests/${manifest.id}/edit`}
                            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Editar
                          </Link>
                          <button
                            type="button"
                            onClick={() => setManifestToDelete(manifest)}
                            disabled={deletingId !== null}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === manifest.id
                              ? 'Eliminando...'
                              : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {manifestToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-manifest-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && deletingId === null) {
              setManifestToDelete(null)
            }
          }}
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-2xl text-red-700">
              !
            </div>
            <h2
              id="delete-manifest-title"
              className="mt-5 text-xl font-bold text-slate-950"
            >
              Eliminar manifiesto
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Vas a eliminar el manifiesto{' '}
              <strong>{manifestToDelete.manifest_number}</strong> con BL Master{' '}
              <strong>{manifestToDelete.master_bl}</strong>.
            </p>
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
              También se eliminarán sus partidas y los recibos de almacén
              generados. Esta acción no se puede deshacer.
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setManifestToDelete(null)}
                disabled={deletingId !== null}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(manifestToDelete)}
                disabled={deletingId !== null}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === manifestToDelete.id
                  ? 'Eliminando...'
                  : 'Sí, eliminar manifiesto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
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
