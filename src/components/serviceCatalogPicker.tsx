'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Layers3, Plus, RefreshCw, Settings2, Sparkles } from 'lucide-react'

import {
  chargeFromStandardService,
  chargesFromPackage,
} from '../lib/serviceCatalog'
import {
  getServiceCatalog,
  SERVICE_CATALOG_UPDATED_EVENT,
} from '../lib/services/serviceCatalogService'
import type { DispatchCharge, DispatchCurrency } from '../types/dispatch'
import type { ServiceCatalog } from '../types/serviceCatalog'

type Props = {
  currency: DispatchCurrency
  storageDays: number
  pieces: number
  onAdd: (charges: DispatchCharge[]) => void
}

export default function ServiceCatalogPicker({
  currency,
  storageDays,
  pieces,
  onAdd,
}: Props) {
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null)
  const [selectedPackageId, setSelectedPackageId] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadCatalog = useCallback(async () => {
    try {
      setRefreshing(true)
      setError('')
      const result = await getServiceCatalog()
      setCatalog(result)
      setSelectedPackageId((current) => result.packages.some((item) => item.id === current) ? current : '')
      setSelectedServiceId((current) => result.services.some((item) => item.id === current) ? current : '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const refresh = () => void loadCatalog()
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refresh() }
    const timer = window.setTimeout(refresh, 0)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener(SERVICE_CATALOG_UPDATED_EVENT, refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener(SERVICE_CATALOG_UPDATED_EVENT, refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [loadCatalog])

  const services = useMemo(
    () => (catalog?.services || []).filter((service) => service.active && service.currency === currency),
    [catalog, currency]
  )
  const activePackages = useMemo(
    () => (catalog?.packages || []).filter((item) => item.active),
    [catalog]
  )
  const inactivePackages = useMemo(
    () => (catalog?.packages || []).filter((item) => !item.active),
    [catalog]
  )
  const packages = useMemo(
    () => activePackages.filter((item) => item.currency === currency),
    [activePackages, currency]
  )
  const otherCurrencyPackages = useMemo(
    () => activePackages.filter((item) => item.currency !== currency),
    [activePackages, currency]
  )
  const selectedPackage = activePackages.find((item) => item.id === selectedPackageId)
  const packageCurrencyMismatch = Boolean(selectedPackage && selectedPackage.currency !== currency)

  function addPackage() {
    if (!catalog || !selectedPackage) return
    if (selectedPackage.currency !== currency) {
      setError(`El paquete “${selectedPackage.name}” está configurado en ${selectedPackage.currency}. Cambia la moneda de la liquidación de ${currency} a ${selectedPackage.currency} antes de aplicarlo.`)
      return
    }
    setError('')
    onAdd(chargesFromPackage(selectedPackage, catalog.services, { storageDays, pieces }))
  }

  function addService() {
    const service = services.find((item) => item.id === selectedServiceId)
    if (!service) return
    onAdd([chargeFromStandardService(service, { storageDays, pieces })])
  }

  return (
    <div className="mb-5 space-y-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-600 p-2 text-white"><Sparkles size={18} /></div>
          <div>
            <h3 className="font-bold text-blue-950">Catálogo y paquetes de servicios</h3>
            <p className="text-sm text-blue-800">
              Aplica tarifas estándar automáticamente y luego agrega o ajusta cualquier concepto.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => void loadCatalog()} disabled={refreshing} className="inline-flex items-center justify-center rounded-xl border border-blue-300 bg-white p-2.5 text-blue-800 hover:bg-blue-100 disabled:opacity-50" aria-label="Actualizar catálogo"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /></button>
          <Link
            href="/settings/services"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100"
          >
            <Settings2 size={16} /> Administrar catálogo
          </Link>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-100 bg-white p-3">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
            Paquete de servicios
          </label>
          <div className="flex gap-2">
            <select
              value={selectedPackageId}
              onChange={(event) => {
                setSelectedPackageId(event.target.value)
                setError('')
              }}
              className="input"
            >
              <option value="">Seleccionar paquete…</option>
              {packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              {otherCurrencyPackages.length > 0 && (
                <optgroup label="Paquetes en otra moneda">
                  {otherCurrencyPackages.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.currency})</option>)}
                </optgroup>
              )}
              {inactivePackages.length > 0 && (
                <optgroup label="Paquetes inactivos">
                  {inactivePackages.map((item) => <option key={item.id} value={item.id} disabled>{item.name} ({item.currency})</option>)}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              onClick={addPackage}
              disabled={!selectedPackage || packageCurrencyMismatch}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              <Layers3 size={16} /> Aplicar
            </button>
          </div>
          {selectedPackage && <p className="mt-2 text-xs text-slate-500">{selectedPackage.description}</p>}
          {packageCurrencyMismatch && selectedPackage && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              <strong>Moneda diferente:</strong> este paquete usa {selectedPackage.currency} y la liquidación está en {currency}. Cambia la moneda de la liquidación a {selectedPackage.currency} para habilitar “Aplicar”.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-3">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
            Servicio adicional
          </label>
          <div className="flex gap-2">
            <select
              value={selectedServiceId}
              onChange={(event) => setSelectedServiceId(event.target.value)}
              className="input"
            >
              <option value="">Seleccionar servicio…</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.standard_price.toLocaleString('es-DO')} / {service.unit}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addService}
              disabled={!selectedServiceId}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-blue-300 px-3 py-2 text-sm font-bold text-blue-800 disabled:opacity-40"
            >
              <Plus size={16} /> Agregar
            </button>
          </div>
        </div>
      </div>

      {catalog?.usingDefaults && (
        <p className="text-xs text-blue-700">
          Catálogo local actualizado: {services.length} servicio(s) y {packages.length} paquete(s) disponible(s) en {currency}.
          {otherCurrencyPackages.length > 0 && ` Hay ${otherCurrencyPackages.length} paquete(s) en otra moneda.`}
          {inactivePackages.length > 0 && ` Hay ${inactivePackages.length} paquete(s) inactivo(s).`}
        </p>
      )}
    </div>
  )
}
