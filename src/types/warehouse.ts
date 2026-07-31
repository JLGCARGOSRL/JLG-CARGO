export type WarehouseReceiptStatus =
  | 'draft'
  | 'received'
  | 'inspection'
  | 'pending_documents'
  | 'available'
  | 'assigned_to_shipment'
  | 'dispatched'
  | 'cancelled'

export type CargoCondition =
  | 'good'
  | 'damaged'
  | 'partial_damage'
  | 'open_box'
  | 'missing_pieces'
  | 'wet'
  | 'unknown'
export interface CustomerOption {
  id: string
  company_name: string | null
  legal_name: string | null
  customer_code: string | null
  tax_id: string | null
}
export type WarehouseDocumentType =
  | 'cargo_photo'
  | 'commercial_invoice'
  | 'packing_list'
  | 'tracking_label'
  | 'damage_report'
  | 'delivery_note'
  | 'other'

export type WarehouseMovementType =
  | 'receipt'
  | 'location_assignment'
  | 'relocation'
  | 'status_change'
  | 'inspection'
  | 'document_upload'
  | 'shipment_assignment'
  | 'dispatch'
  | 'adjustment'
  | 'cancellation'

export interface WarehouseLocation {
  id: string
  code: string
  zone: string
  rack: string | null
  level: string | null
  position: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WarehouseReceipt {
  id: string
  wr_number: string
  customer_id: string
  shipper_name: string | null
  supplier_name: string | null
  received_at: string
  received_by: string | null
  tracking_number: string | null
  courier_name: string | null
  external_reference: string | null
  pieces: number
  weight_kg: number
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  volume_cbm: number
  description: string
  marks_and_numbers: string | null
  cargo_condition: CargoCondition
  has_visible_damage: boolean
  damage_notes: string | null
  location_id: string | null
  status: WarehouseReceiptStatus
  shipment_id: string | null
  notes: string | null
  internal_notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string

  customers?: {
    id: string
    company_name?: string | null
    legal_name?: string | null
    customer_code?: string | null
  } | null

  warehouse_locations?: WarehouseLocation | null
}

export interface WarehouseReceiptItem {
  id: string
  warehouse_receipt_id: string
  item_number: number
  description: string
  pieces: number
  weight_kg: number
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  volume_cbm: number
  hs_code: string | null
  serial_number: string | null
  notes: string | null
  created_at: string
}

export interface WarehouseReceiptDocument {
  id: string
  warehouse_receipt_id: string
  document_type: WarehouseDocumentType
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  description: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export interface WarehouseMovement {
  id: string
  warehouse_receipt_id: string
  movement_type: WarehouseMovementType
  from_location_id: string | null
  to_location_id: string | null
  from_status: WarehouseReceiptStatus | null
  to_status: WarehouseReceiptStatus | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface WarehouseReceiptFormData {
  customer_id: string
  shipper_name: string
  supplier_name: string
  tracking_number: string
  courier_name: string
  external_reference: string
  pieces: number
  weight_kg: number
  length_cm: number
  width_cm: number
  height_cm: number
  description: string
  marks_and_numbers: string
  cargo_condition: CargoCondition
  has_visible_damage: boolean
  damage_notes: string
  location_id: string
  status: WarehouseReceiptStatus
  notes: string
  internal_notes: string
}

export const WAREHOUSE_STATUS_LABELS: Record<WarehouseReceiptStatus, string> = {
  draft: 'Borrador',
  received: 'Recibido',
  inspection: 'En inspeccion',
  pending_documents: 'Pendiente documentos',
  available: 'Disponible',
  assigned_to_shipment: 'Asignado a embarque',
  dispatched: 'Despachado',
  cancelled: 'Cancelado',
}

export const CARGO_CONDITION_LABELS: Record<CargoCondition, string> = {
  good: 'Buen estado',
  damaged: 'Danada',
  partial_damage: 'Dano parcial',
  open_box: 'Caja abierta',
  missing_pieces: 'Faltan piezas',
  wet: 'Mojada',
  unknown: 'Sin verificar',
}

export const WAREHOUSE_DOCUMENT_TYPE_LABELS: Record<WarehouseDocumentType, string> = {
  cargo_photo: 'Foto de carga',
  commercial_invoice: 'Factura comercial',
  packing_list: 'Packing list',
  tracking_label: 'Etiqueta / tracking',
  damage_report: 'Reporte de danos',
  delivery_note: 'Conduce / delivery note',
  other: 'Otro',
}
