export type WarehouseManifestStatus =
  | 'draft'
  | 'open'
  | 'receiving'
  | 'received'
  | 'in_inspection'
  | 'ready_to_store'
  | 'stored'
  | 'partially_dispatched'
  | 'dispatched'
  | 'cancelled'

export type WarehouseManifestItemStatus =
  | 'pending'
  | 'received'
  | 'in_inspection'
  | 'stored'
  | 'ready_to_dispatch'
  | 'dispatched'
  | 'cancelled'

export type ManifestEntryMode =
  | 'Marítimo'
  | 'Aéreo'
  | 'Terrestre'
  | 'Courier'

export type ManifestTransferType =
  | 'Celador'
  | 'Sello Electrónico'
  | 'Sello Naviera'
  | 'Otro'

export interface WarehouseManifest {
  id: string
  manifest_number: string
  master_bl: string

  carrier_name: string | null
  carrier_identification: string | null
  agent_name: string | null
  customs_administration: string | null

  entry_mode: string
  transfer_type: string | null

  departure_date: string | null
  arrival_date: string

  container_number: string | null
  seal_number: string | null
  vehicle_plate: string | null
  cargo_label: string | null

  origin: string | null
  destination: string | null

  total_packages: number
  total_weight_kg: number
  total_volume_cbm: number
  total_freight: number

  status: WarehouseManifestStatus

  notes: string | null
  internal_notes: string | null

  created_by: string | null
  updated_by: string | null

  created_at: string
  updated_at: string
}

export interface WarehouseManifestItem {
  id: string
  manifest_id: string
  line_number: number

  document_number: string
  house_bl: string | null
  container_number: string | null
  seal_number: string | null

  customer_id: string | null

  shipper_name: string | null
  consignee_name: string
  notify_party_name: string | null

  package_quantity: number
  package_type: string

  gross_weight_kg: number
  volume_cbm: number
  freight_amount: number

  cargo_description: string
  marks_and_numbers: string | null

  warehouse_receipt_id: string | null

  status: WarehouseManifestItemStatus

  notes: string | null

  created_by: string | null
  updated_by: string | null

  created_at: string
  updated_at: string
}

export interface WarehouseManifestFormData {
  manifest_number: string
  master_bl: string

  carrier_name: string
  carrier_identification: string
  agent_name: string
  customs_administration: string

  entry_mode: ManifestEntryMode
  transfer_type: ManifestTransferType

  departure_date: string
  arrival_date: string

  container_number: string
  seal_number: string
  vehicle_plate: string
  cargo_label: string

  origin: string
  destination: string

  status: WarehouseManifestStatus

  notes: string
  internal_notes: string
}

export interface WarehouseManifestItemFormData {
  line_number: number

  document_number: string
  house_bl: string
  container_number: string
  seal_number: string

  customer_id: string

  shipper_name: string
  consignee_name: string
  notify_party_name: string

  package_quantity: number
  package_type: string

  gross_weight_kg: number
  volume_cbm: number
  freight_amount: number

  cargo_description: string
  marks_and_numbers: string

  status: WarehouseManifestItemStatus

  notes: string
}

export interface CreateWarehouseManifestPayload {
  manifest: WarehouseManifestFormData
  items: WarehouseManifestItemFormData[]
}

export const WAREHOUSE_MANIFEST_STATUS_LABELS: Record<WarehouseManifestStatus, string> = {
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

export const WAREHOUSE_MANIFEST_ITEM_STATUS_LABELS: Record<WarehouseManifestItemStatus, string> = {
  pending: 'Pendiente',
  received: 'Recibido',
  in_inspection: 'En inspección',
  stored: 'Almacenado',
  ready_to_dispatch: 'Listo para despacho',
  dispatched: 'Despachado',
  cancelled: 'Cancelado',
}

export const MANIFEST_ENTRY_MODE_OPTIONS: ManifestEntryMode[] = [
  'Marítimo',
  'Aéreo',
  'Terrestre',
  'Courier',
]

export const MANIFEST_TRANSFER_TYPE_OPTIONS: ManifestTransferType[] = [
  'Celador',
  'Sello Electrónico',
  'Sello Naviera',
  'Otro',
]