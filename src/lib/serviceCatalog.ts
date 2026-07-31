import type { DispatchCharge } from '../types/dispatch'
import type {
  ServiceCatalog,
  ServicePackage,
  StandardService,
} from '../types/serviceCatalog'

export const DEFAULT_STANDARD_SERVICES: StandardService[] = [
  {
    id: 'default-cargo-receipt-control',
    code: 'cargo_receipt_control',
    name: 'Recepción y control de carga',
    unit: 'servicio',
    standard_price: 1240,
    minimum_quantity: 1,
    quantity_mode: 'fixed',
    currency: 'DOP',
    active: true,
    sort_order: 10,
  },
  {
    id: 'default-storage',
    code: 'storage',
    name: 'Almacenaje',
    unit: 'día',
    standard_price: 720,
    minimum_quantity: 7,
    quantity_mode: 'storage_days',
    currency: 'DOP',
    active: true,
    sort_order: 20,
  },
]

export const DEFAULT_SERVICE_PACKAGES: ServicePackage[] = [
  {
    id: 'default-storage-dispatch',
    code: 'storage_dispatch',
    name: 'Almacenaje y despacho',
    description: 'Recepción, control de carga y almacenaje con un mínimo de 7 días.',
    currency: 'DOP',
    active: true,
    sort_order: 10,
    items: [
      { service_id: 'default-cargo-receipt-control', quantity_override: null, sort_order: 10 },
      { service_id: 'default-storage', quantity_override: null, sort_order: 20 },
    ],
  },
]

export const DEFAULT_SERVICE_CATALOG: ServiceCatalog = {
  services: DEFAULT_STANDARD_SERVICES,
  packages: DEFAULT_SERVICE_PACKAGES,
  usingDefaults: true,
}

export function quantityForService(
  service: StandardService,
  context: { storageDays: number; pieces: number },
  quantityOverride?: number | null
) {
  const base = quantityOverride ?? (
    service.quantity_mode === 'storage_days'
      ? context.storageDays
      : service.quantity_mode === 'pieces'
        ? context.pieces
        : 1
  )

  return Math.max(base, service.minimum_quantity, 1)
}

export function chargeFromStandardService(
  service: StandardService,
  context: { storageDays: number; pieces: number },
  quantityOverride?: number | null
): DispatchCharge {
  return {
    charge_code: service.code,
    description: service.name,
    quantity: quantityForService(service, context, quantityOverride),
    unit: service.unit,
    unit_rate: service.standard_price,
  }
}

export function chargesFromPackage(
  servicePackage: ServicePackage,
  services: StandardService[],
  context: { storageDays: number; pieces: number }
) {
  const serviceById = new Map(services.map((service) => [service.id, service]))

  return [...servicePackage.items]
    .sort((left, right) => left.sort_order - right.sort_order)
    .flatMap((item) => {
      const service = serviceById.get(item.service_id)
      return service ? [chargeFromStandardService(service, context, item.quantity_override)] : []
    })
}

export function mergeCharges(existing: DispatchCharge[], incoming: DispatchCharge[]) {
  const incomingCodes = new Set(incoming.map((charge) => charge.charge_code))
  return [
    ...existing.filter((charge) => !incomingCodes.has(charge.charge_code)),
    ...incoming,
  ]
}
