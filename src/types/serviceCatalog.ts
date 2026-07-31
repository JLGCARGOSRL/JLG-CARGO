import type { DispatchCurrency } from './dispatch'

export type ServiceQuantityMode = 'fixed' | 'storage_days' | 'pieces'

export type StandardService = {
  id: string
  code: string
  name: string
  unit: string
  standard_price: number
  minimum_quantity: number
  quantity_mode: ServiceQuantityMode
  currency: DispatchCurrency
  active: boolean
  sort_order: number
}

export type ServicePackageItem = {
  service_id: string
  quantity_override: number | null
  sort_order: number
}

export type ServicePackage = {
  id: string
  code: string
  name: string
  description: string
  currency: DispatchCurrency
  active: boolean
  sort_order: number
  items: ServicePackageItem[]
}

export type ServiceCatalog = {
  services: StandardService[]
  packages: ServicePackage[]
  usingDefaults: boolean
}
