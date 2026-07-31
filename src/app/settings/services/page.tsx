'use client'

import { AlertTriangle, Ban, Layers3, Pencil, Plus, RefreshCw, Save, Tags, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import AmountInput from '../../../components/amountInput'
import { useAuth } from '../../../contexts/authContext'
import {
  deleteServicePackage,
  deleteStandardService,
  getServiceCatalog,
  saveServicePackage,
  saveStandardService,
} from '../../../lib/services/serviceCatalogService'
import type { DispatchCurrency } from '../../../types/dispatch'
import type {
  ServiceCatalog,
  ServicePackage,
  ServiceQuantityMode,
  StandardService,
} from '../../../types/serviceCatalog'

type ServiceForm = Omit<StandardService, 'id'> & { id?: string }
type PackageForm = Omit<ServicePackage, 'id' | 'items'> & { id?: string }
type DeleteTarget =
  | { kind: 'service'; item: StandardService }
  | { kind: 'package'; item: ServicePackage }

const emptyService: ServiceForm = {
  code: '', name: '', unit: 'servicio', standard_price: 0, minimum_quantity: 1,
  quantity_mode: 'fixed', currency: 'DOP', active: true, sort_order: 0,
}
const emptyPackage: PackageForm = {
  code: '', name: '', description: '', currency: 'DOP', active: true, sort_order: 0,
}

function money(value: number, currency: DispatchCurrency) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency }).format(value)
}

export default function ServiceSettingsPage() {
  const { profile } = useAuth()
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null)
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyService)
  const [packageForm, setPackageForm] = useState<PackageForm>(emptyPackage)
  const [packageServiceIds, setPackageServiceIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setCatalog(await getServiceCatalog())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (profile?.role !== 'administrator') return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, profile?.role])

  const packageServices = useMemo(
    () => (catalog?.services || []).filter((service) => service.currency === packageForm.currency),
    [catalog, packageForm.currency]
  )

  function editService(service: StandardService) {
    setServiceForm(service)
    setMessage('')
  }

  function editPackage(servicePackage: ServicePackage) {
    setPackageForm(servicePackage)
    setPackageServiceIds(servicePackage.items.map((item) => item.service_id))
    setMessage('')
  }

  function togglePackageService(serviceId: string) {
    setPackageServiceIds((current) => current.includes(serviceId)
      ? current.filter((id) => id !== serviceId)
      : [...current, serviceId])
  }

  async function submitService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!serviceForm.name.trim() || !serviceForm.code.trim() || !serviceForm.unit.trim()) {
      return setError('Completa el nombre, código y unidad del servicio.')
    }
    if (serviceForm.standard_price < 0 || serviceForm.minimum_quantity <= 0) {
      return setError('El precio no puede ser negativo y la cantidad mínima debe ser mayor que cero.')
    }
    try {
      setSaving(true)
      await saveStandardService(serviceForm)
      setServiceForm(emptyService)
      setMessage('Servicio estándar guardado correctamente.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el servicio.')
    } finally { setSaving(false) }
  }

  async function submitPackage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!packageForm.name.trim() || !packageForm.code.trim()) return setError('Completa el nombre y código del paquete.')
    if (!packageServiceIds.length) return setError('Selecciona al menos un servicio para el paquete.')
    try {
      setSaving(true)
      await saveServicePackage(packageForm, packageServiceIds)
      setPackageForm(emptyPackage)
      setPackageServiceIds([])
      setMessage('Paquete guardado correctamente.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el paquete.')
    } finally { setSaving(false) }
  }

  async function removeService(service: StandardService) {
    setError('')
    setMessage('')
    try {
      setSaving(true)
      await deleteStandardService(service.id)
      if (serviceForm.id === service.id) setServiceForm(emptyService)
      setPackageServiceIds((current) => current.filter((id) => id !== service.id))
      setMessage('Servicio eliminado correctamente.')
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el servicio.')
      setDeleteTarget(null)
    } finally { setSaving(false) }
  }

  async function removePackage(servicePackage: ServicePackage) {
    setError('')
    setMessage('')
    try {
      setSaving(true)
      await deleteServicePackage(servicePackage.id)
      if (packageForm.id === servicePackage.id) {
        setPackageForm(emptyPackage)
        setPackageServiceIds([])
      }
      setMessage('Paquete eliminado correctamente.')
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el paquete.')
      setDeleteTarget(null)
    } finally { setSaving(false) }
  }

  if (profile?.role !== 'administrator') {
    return <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center"><Ban className="mx-auto text-amber-700" size={36} /><h1 className="mt-4 text-2xl font-black">Acceso restringido</h1><p className="mt-2 text-slate-600">Solo el administrador puede cambiar tarifas y paquetes.</p></div>
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-bold uppercase tracking-[.15em] text-blue-700">Administración</p><h1 className="mt-1 text-3xl font-black">Servicios y paquetes</h1><p className="mt-2 text-slate-500">Define tarifas estándar y los conceptos que se agregan juntos a una liquidación.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 font-bold"><RefreshCw size={17} /> Actualizar</button>
      </header>

      {catalog?.usingDefaults && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Catálogo local activo.</strong> Puedes crear, editar y utilizar servicios ahora mismo. Los cambios se guardarán en este navegador; al aplicar la migración de Supabase estarán disponibles para todos los usuarios.</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b p-6"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Tags size={21} /></div><div><h2 className="text-xl font-black">Tarifas estándar</h2><p className="text-sm text-slate-500">Precio, unidad y regla automática de cantidad.</p></div></div>
          <form onSubmit={submitService} className="grid gap-4 border-b bg-slate-50/70 p-6 md:grid-cols-2">
            <Field label="Nombre"><input value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} className="input" placeholder="Ej. Almacenaje" /></Field>
            <Field label="Código"><input value={serviceForm.code} onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value })} className="input" placeholder="almacenaje" /></Field>
            <Field label="Tarifa"><AmountInput value={serviceForm.standard_price} onValueChange={(value) => setServiceForm({ ...serviceForm, standard_price: value })} className="input" /></Field>
            <Field label="Moneda"><select value={serviceForm.currency} onChange={(e) => setServiceForm({ ...serviceForm, currency: e.target.value as DispatchCurrency })} className="input"><option value="DOP">DOP</option><option value="USD">USD</option></select></Field>
            <Field label="Unidad"><input value={serviceForm.unit} onChange={(e) => setServiceForm({ ...serviceForm, unit: e.target.value })} className="input" placeholder="servicio, día, bulto…" /></Field>
            <Field label="Cantidad mínima"><AmountInput value={serviceForm.minimum_quantity} onValueChange={(value) => setServiceForm({ ...serviceForm, minimum_quantity: value })} className="input" blankWhenZero={false} /></Field>
            <Field label="Cálculo de cantidad"><select value={serviceForm.quantity_mode} onChange={(e) => setServiceForm({ ...serviceForm, quantity_mode: e.target.value as ServiceQuantityMode })} className="input"><option value="fixed">Cantidad fija</option><option value="storage_days">Días de almacenaje</option><option value="pieces">Cantidad de bultos</option></select></Field>
            <label className="flex items-center gap-2 pt-7 text-sm font-semibold"><input type="checkbox" checked={serviceForm.active} onChange={(e) => setServiceForm({ ...serviceForm, active: e.target.checked })} /> Servicio activo</label>
            <div className="flex gap-2 md:col-span-2"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Save size={16} /> Guardar servicio</button>{serviceForm.id && <button type="button" onClick={() => setServiceForm(emptyService)} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Cancelar edición</button>}</div>
          </form>
          <div className="divide-y">
            {catalog?.services.map((service) => <div key={service.id} className="flex items-center justify-between gap-4 p-4"><div><div className="font-bold">{service.name}</div><div className="text-sm text-slate-500">{money(service.standard_price, service.currency)} / {service.unit} · mínimo {service.minimum_quantity}{service.quantity_mode === 'storage_days' ? ' días' : ''}</div></div><div className="flex gap-2"><button type="button" onClick={() => editService(service)} disabled={saving} className="rounded-lg border p-2 disabled:opacity-40" aria-label={`Editar ${service.name}`}><Pencil size={16} /></button><button type="button" onClick={() => setDeleteTarget({ kind: 'service', item: service })} disabled={saving} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-40" aria-label={`Eliminar ${service.name}`}><Trash2 size={16} /></button></div></div>)}
            {!loading && !catalog?.services.length && <p className="p-6 text-sm text-slate-500">No hay servicios configurados.</p>}
          </div>
        </section>

        <section className="rounded-3xl border bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b p-6"><div className="rounded-xl bg-violet-50 p-2.5 text-violet-700"><Layers3 size={21} /></div><div><h2 className="text-xl font-black">Paquetes</h2><p className="text-sm text-slate-500">Agrupa servicios para agregarlos con un solo clic.</p></div></div>
          <form onSubmit={submitPackage} className="space-y-4 border-b bg-slate-50/70 p-6">
            <div className="grid gap-4 md:grid-cols-2"><Field label="Nombre"><input value={packageForm.name} onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })} className="input" placeholder="Ej. Almacenaje y despacho" /></Field><Field label="Código"><input value={packageForm.code} onChange={(e) => setPackageForm({ ...packageForm, code: e.target.value })} className="input" placeholder="almacenaje_despacho" /></Field></div>
            <Field label="Descripción"><textarea value={packageForm.description} onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })} className="input min-h-20" /></Field>
            <Field label="Moneda"><select value={packageForm.currency} onChange={(e) => { setPackageForm({ ...packageForm, currency: e.target.value as DispatchCurrency }); setPackageServiceIds([]) }} className="input"><option value="DOP">DOP</option><option value="USD">USD</option></select></Field>
            <div><p className="mb-2 text-sm font-semibold text-slate-700">Servicios incluidos</p><div className="grid gap-2 sm:grid-cols-2">{packageServices.map((service) => <label key={service.id} className="flex items-start gap-2 rounded-xl border bg-white p-3 text-sm"><input type="checkbox" checked={packageServiceIds.includes(service.id)} onChange={() => togglePackageService(service.id)} className="mt-0.5" /><span><strong className="block">{service.name}</strong><span className="text-xs text-slate-500">{money(service.standard_price, service.currency)} / {service.unit}</span></span></label>)}</div></div>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={packageForm.active} onChange={(e) => setPackageForm({ ...packageForm, active: e.target.checked })} /> Paquete activo</label>
            <div className="flex gap-2"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Plus size={16} /> Guardar paquete</button>{packageForm.id && <button type="button" onClick={() => { setPackageForm(emptyPackage); setPackageServiceIds([]) }} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Cancelar edición</button>}</div>
          </form>
          <div className="divide-y">{catalog?.packages.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><div className="font-bold">{item.name}</div><div className="text-sm text-slate-500">{item.items.length} servicio(s) · {item.currency}</div></div><div className="flex gap-2"><button type="button" onClick={() => editPackage(item)} disabled={saving} className="rounded-lg border p-2 disabled:opacity-40" aria-label={`Editar ${item.name}`}><Pencil size={16} /></button><button type="button" onClick={() => setDeleteTarget({ kind: 'package', item })} disabled={saving} className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-40" aria-label={`Eliminar ${item.name}`}><Trash2 size={16} /></button></div></div>)}</div>
        </section>
      </div>
      {deleteTarget && (
        <DeleteConfirmation
          target={deleteTarget}
          loading={saving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget.kind === 'service'
            ? void removeService(deleteTarget.item)
            : void removePackage(deleteTarget.item)}
        />
      )}
      <style jsx global>{`.input{width:100%;border-radius:.75rem;border:1px solid rgb(203 213 225);background:white;padding:.65rem .8rem;font-size:.875rem;outline:none}.input:focus{box-shadow:0 0 0 2px rgb(203 213 225)}`}</style>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label> }

function DeleteConfirmation({
  target,
  loading,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const isPackage = target.kind === 'package'
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-50 p-3 text-red-700"><AlertTriangle size={26} /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[.16em] text-red-700">Confirmar eliminación</p>
              <h2 id="delete-dialog-title" className="mt-1 text-2xl font-black text-slate-950">
                {isPackage ? '¿Eliminar este paquete?' : '¿Eliminar este servicio?'}
              </h2>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={loading} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40" aria-label="Cerrar confirmación"><X size={20} /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isPackage ? 'Paquete seleccionado' : 'Servicio seleccionado'}</p>
            <p className="mt-1 text-lg font-black text-slate-950">{target.item.name}</p>
            {'description' in target.item && target.item.description && <p className="mt-1 text-sm text-slate-500">{target.item.description}</p>}
          </div>
          <p className="text-sm leading-6 text-slate-600">
            {isPackage
              ? 'Se eliminará únicamente el paquete. Los servicios individuales y las liquidaciones existentes se conservarán.'
              : 'Se eliminará del catálogo y de todos los paquetes donde esté incluido. Las liquidaciones existentes no cambiarán.'}
          </p>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} disabled={loading} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Cancelar</button>
            <button type="button" onClick={onConfirm} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-900/20 hover:bg-red-800 disabled:opacity-50"><Trash2 size={17} /> {loading ? 'Eliminando…' : isPackage ? 'Eliminar paquete' : 'Eliminar servicio'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
