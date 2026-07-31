import { DEFAULT_SERVICE_CATALOG } from '../serviceCatalog'
import { supabase } from '../supabase/client'
import type {
  ServiceCatalog,
  ServicePackage,
  ServicePackageItem,
  StandardService,
} from '../../types/serviceCatalog'

const missingCatalogCodes = new Set(['42P01', 'PGRST204', 'PGRST205'])
const localCatalogKey = 'jlg-warehouse-service-catalog-v1'
export const SERVICE_CATALOG_UPDATED_EVENT = 'jlg-service-catalog-updated'
let useLocalCatalog = false

function catalogUnavailable(error: { code?: string; message: string }) {
  return missingCatalogCodes.has(error.code || '') || error.message.includes('warehouse_service_')
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeService(row: Record<string, unknown>): StandardService {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    unit: String(row.unit),
    standard_price: numberValue(row.standard_price),
    minimum_quantity: numberValue(row.minimum_quantity, 1),
    quantity_mode: row.quantity_mode as StandardService['quantity_mode'],
    currency: row.currency as StandardService['currency'],
    active: Boolean(row.active),
    sort_order: numberValue(row.sort_order),
  }
}

function cloneDefaultCatalog(): ServiceCatalog {
  return {
    services: DEFAULT_SERVICE_CATALOG.services.map((service) => ({ ...service })),
    packages: DEFAULT_SERVICE_CATALOG.packages.map((servicePackage) => ({
      ...servicePackage,
      items: servicePackage.items.map((item) => ({ ...item })),
    })),
    usingDefaults: true,
  }
}

function readLocalCatalog(): ServiceCatalog {
  if (typeof window === 'undefined') return cloneDefaultCatalog()
  const saved = window.localStorage.getItem(localCatalogKey)
  if (!saved) return cloneDefaultCatalog()

  try {
    const parsed = JSON.parse(saved) as Partial<ServiceCatalog>
    if (!Array.isArray(parsed.services) || !Array.isArray(parsed.packages)) {
      return cloneDefaultCatalog()
    }
    return { services: parsed.services, packages: parsed.packages, usingDefaults: true }
  } catch {
    return cloneDefaultCatalog()
  }
}

function writeLocalCatalog(catalog: ServiceCatalog) {
  if (typeof window === 'undefined') throw new Error('El catálogo local solo está disponible en el navegador.')
  window.localStorage.setItem(localCatalogKey, JSON.stringify(catalog))
  window.dispatchEvent(new Event(SERVICE_CATALOG_UPDATED_EVENT))
}

function localId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${suffix}`
}

function saveLocalStandardService(service: Omit<StandardService, 'id'> & { id?: string }) {
  const catalog = readLocalCatalog()
  const code = service.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const duplicate = catalog.services.find((item) => item.code === code && item.id !== service.id)
  if (duplicate) throw new Error('Ya existe un servicio con ese código.')

  const id = service.id || localId('local-service')
  const saved: StandardService = {
    id,
    code,
    name: service.name.trim(),
    unit: service.unit.trim(),
    standard_price: Number(service.standard_price),
    minimum_quantity: Number(service.minimum_quantity),
    quantity_mode: service.quantity_mode,
    currency: service.currency,
    active: service.active,
    sort_order: Number(service.sort_order),
  }
  const index = catalog.services.findIndex((item) => item.id === id)
  if (index >= 0) catalog.services[index] = saved
  else catalog.services.push(saved)
  catalog.services.sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
  writeLocalCatalog(catalog)
}

function saveLocalServicePackage(
  servicePackage: Omit<ServicePackage, 'id' | 'items'> & { id?: string },
  serviceIds: string[]
) {
  const catalog = readLocalCatalog()
  const code = servicePackage.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  const duplicate = catalog.packages.find((item) => item.code === code && item.id !== servicePackage.id)
  if (duplicate) throw new Error('Ya existe un paquete con ese código.')

  const id = servicePackage.id || localId('local-package')
  const saved: ServicePackage = {
    id,
    code,
    name: servicePackage.name.trim(),
    description: servicePackage.description.trim(),
    currency: servicePackage.currency,
    active: servicePackage.active,
    sort_order: Number(servicePackage.sort_order),
    items: serviceIds.map((serviceId, index) => ({
      service_id: serviceId,
      quantity_override: null,
      sort_order: (index + 1) * 10,
    })),
  }
  const index = catalog.packages.findIndex((item) => item.id === id)
  if (index >= 0) catalog.packages[index] = saved
  else catalog.packages.push(saved)
  catalog.packages.sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name))
  writeLocalCatalog(catalog)
}

function deleteLocalStandardService(serviceId: string) {
  const catalog = readLocalCatalog()
  catalog.services = catalog.services.filter((service) => service.id !== serviceId)
  catalog.packages = catalog.packages.map((servicePackage) => ({
    ...servicePackage,
    items: servicePackage.items.filter((item) => item.service_id !== serviceId),
  }))
  writeLocalCatalog(catalog)
}

function deleteLocalServicePackage(packageId: string) {
  const catalog = readLocalCatalog()
  catalog.packages = catalog.packages.filter((servicePackage) => servicePackage.id !== packageId)
  writeLocalCatalog(catalog)
}

export async function getServiceCatalog(): Promise<ServiceCatalog> {
  const [servicesResult, packagesResult, itemsResult] = await Promise.all([
    supabase.from('warehouse_service_catalog').select('*').order('sort_order').order('name'),
    supabase.from('warehouse_service_packages').select('*').order('sort_order').order('name'),
    supabase.from('warehouse_service_package_items').select('*').order('sort_order'),
  ])

  const error = servicesResult.error || packagesResult.error || itemsResult.error
  if (error) {
    if (catalogUnavailable(error)) {
      useLocalCatalog = true
      return readLocalCatalog()
    }
    throw new Error(error.message)
  }

  useLocalCatalog = false

  const services = ((servicesResult.data || []) as Record<string, unknown>[]).map(normalizeService)
  const items = (itemsResult.data || []) as Array<Record<string, unknown>>
  const packages = ((packagesResult.data || []) as Record<string, unknown>[]).map((row): ServicePackage => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: String(row.description || ''),
    currency: row.currency as ServicePackage['currency'],
    active: Boolean(row.active),
    sort_order: numberValue(row.sort_order),
    items: items
      .filter((item) => item.package_id === row.id)
      .map((item): ServicePackageItem => ({
        service_id: String(item.service_id),
        quantity_override: item.quantity_override === null ? null : numberValue(item.quantity_override),
        sort_order: numberValue(item.sort_order),
      })),
  }))

  return { services, packages, usingDefaults: false }
}

export async function saveStandardService(service: Omit<StandardService, 'id'> & { id?: string }) {
  if (useLocalCatalog) {
    saveLocalStandardService(service)
    return
  }

  const payload = {
    code: service.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    name: service.name.trim(),
    unit: service.unit.trim(),
    standard_price: Number(service.standard_price),
    minimum_quantity: Number(service.minimum_quantity),
    quantity_mode: service.quantity_mode,
    currency: service.currency,
    active: service.active,
    sort_order: Number(service.sort_order),
    updated_at: new Date().toISOString(),
  }
  const query = service.id
    ? supabase.from('warehouse_service_catalog').update(payload).eq('id', service.id)
    : supabase.from('warehouse_service_catalog').insert(payload)
  const { error } = await query
  if (error) {
    if (catalogUnavailable(error)) {
      useLocalCatalog = true
      saveLocalStandardService(service)
      return
    }
    throw new Error(error.message)
  }
}

export async function saveServicePackage(
  servicePackage: Omit<ServicePackage, 'id' | 'items'> & { id?: string },
  serviceIds: string[]
) {
  if (useLocalCatalog) {
    saveLocalServicePackage(servicePackage, serviceIds)
    return
  }

  const packagePayload = {
    code: servicePackage.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    name: servicePackage.name.trim(),
    description: servicePackage.description.trim(),
    currency: servicePackage.currency,
    active: servicePackage.active,
    sort_order: Number(servicePackage.sort_order),
    updated_at: new Date().toISOString(),
  }

  let packageId = servicePackage.id
  if (packageId) {
    const { error } = await supabase.from('warehouse_service_packages').update(packagePayload).eq('id', packageId)
    if (error) {
      if (catalogUnavailable(error)) {
        useLocalCatalog = true
        saveLocalServicePackage(servicePackage, serviceIds)
        return
      }
      throw new Error(error.message)
    }
  } else {
    const { data, error } = await supabase.from('warehouse_service_packages').insert(packagePayload).select('id').single()
    if (error) {
      if (catalogUnavailable(error)) {
        useLocalCatalog = true
        saveLocalServicePackage(servicePackage, serviceIds)
        return
      }
      throw new Error(error.message)
    }
    packageId = String(data.id)
  }

  const { error: deleteError } = await supabase
    .from('warehouse_service_package_items')
    .delete()
    .eq('package_id', packageId)
  if (deleteError) throw new Error(deleteError.message)

  if (serviceIds.length) {
    const { error } = await supabase.from('warehouse_service_package_items').insert(
      serviceIds.map((serviceId, index) => ({
        package_id: packageId,
        service_id: serviceId,
        sort_order: (index + 1) * 10,
      }))
    )
    if (error) throw new Error(error.message)
  }
}

export async function deleteStandardService(serviceId: string) {
  if (useLocalCatalog) {
    deleteLocalStandardService(serviceId)
    return
  }

  const { error } = await supabase.from('warehouse_service_catalog').delete().eq('id', serviceId)
  if (error) {
    if (catalogUnavailable(error)) {
      useLocalCatalog = true
      deleteLocalStandardService(serviceId)
      return
    }
    throw new Error(error.message)
  }
}

export async function deleteServicePackage(packageId: string) {
  if (useLocalCatalog) {
    deleteLocalServicePackage(packageId)
    return
  }

  const { error } = await supabase.from('warehouse_service_packages').delete().eq('id', packageId)
  if (error) {
    if (catalogUnavailable(error)) {
      useLocalCatalog = true
      deleteLocalServicePackage(packageId)
      return
    }
    throw new Error(error.message)
  }
}
