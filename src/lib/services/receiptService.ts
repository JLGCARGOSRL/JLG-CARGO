import { supabase } from '../supabase/client'

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

export type WarehouseReceiptListItem = {
  id: string
  wr_number: string
  customer_id: string
  manifest_id: string | null
  manifest_item_id: string | null

  received_at: string
  tracking_number: string | null
  courier_name: string | null
  external_reference: string | null

  pieces: number
  weight_kg: number

  description: string
  cargo_condition: string
  has_visible_damage: boolean
  location_id: string | null
  status: string
  customs_status: 'pending' | 'verified' | 'held'
  customs_reference: string | null
  customs_verified_at: string | null
  customs_verified_by: string | null

  notes: string | null
  created_at: string
  updated_at: string

  customers?: {
    id: string
    company_name: string | null
    legal_name: string | null
    customer_code: string | null
    tax_id: string | null
  } | null

  warehouse_locations?: {
    id: string
    code: string
    zone: string | null
    rack: string | null
    level: string | null
    position: string | null
  } | null

  warehouse_manifests?: {
    id: string
    manifest_number: string
    master_bl: string
    container_number: string | null
  } | null
}

export type WarehouseReceiptDetail = {
  id: string
  wr_number: string
  customer_id: string
  shipment_id: string | null

  received_date: string | null
  received_by: string | null
  received_at: string

  location_id: string | null

  shipper_name: string | null
  supplier_name: string | null

  tracking_number: string | null
  courier_name: string | null
  external_reference: string | null

  pieces: number
  weight_kg: number
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null

  description: string
  marks_and_numbers: string | null

  cargo_condition: CargoCondition
  has_visible_damage: boolean
  damage_notes: string | null

  notes: string | null
  internal_notes: string | null

  status: WarehouseReceiptStatus

  customs_status: 'pending' | 'verified' | 'held'
  customs_reference: string | null
  customs_notes: string | null
  customs_verified_at: string | null
  customs_verified_by: string | null

  manifest_id: string | null
  manifest_item_id: string | null

  created_at: string
  updated_at: string

  customers?: {
    id: string
    company_name: string | null
    legal_name: string | null
    customer_code: string | null
    tax_id: string | null
    email: string | null
    phone: string | null
  } | null

  warehouse_locations?: {
    id: string
    code: string
    zone: string | null
    rack: string | null
    level: string | null
    position: string | null
    description: string | null
  } | null

  warehouse_manifests?: {
    id: string
    manifest_number: string
    master_bl: string
    container_number: string | null
    seal_number: string | null
    customs_administration: string | null
    carrier_name: string | null
    vehicle_plate: string | null
  } | null
}

export type WarehouseReceiptItem = {
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

export type WarehouseLocationOption = {
  id: string
  code: string
  zone: string | null
  rack: string | null
  level: string | null
  position: string | null
  description: string | null
}

export type UpdateReceiptInspectionPayload = {
  pieces: number
  weight_kg: number
  length_cm: number
  width_cm: number
  height_cm: number
  cargo_condition: CargoCondition
  has_visible_damage: boolean
  damage_notes: string
  location_id: string
  status: WarehouseReceiptStatus
  notes: string
  internal_notes: string
  operator_name?: string
}

type RawWarehouseReceiptListItem = Omit<
  WarehouseReceiptListItem,
  'customers' | 'warehouse_locations' | 'warehouse_manifests'
> & {
  customers?:
    | WarehouseReceiptListItem['customers']
    | WarehouseReceiptListItem['customers'][]
    | null

  warehouse_locations?:
    | WarehouseReceiptListItem['warehouse_locations']
    | WarehouseReceiptListItem['warehouse_locations'][]
    | null

  warehouse_manifests?:
    | WarehouseReceiptListItem['warehouse_manifests']
    | WarehouseReceiptListItem['warehouse_manifests'][]
    | null
}

type RawWarehouseReceiptDetail = Omit<
  WarehouseReceiptDetail,
  'customers' | 'warehouse_locations' | 'warehouse_manifests'
> & {
  customers?:
    | WarehouseReceiptDetail['customers']
    | WarehouseReceiptDetail['customers'][]
    | null

  warehouse_locations?:
    | WarehouseReceiptDetail['warehouse_locations']
    | WarehouseReceiptDetail['warehouse_locations'][]
    | null

  warehouse_manifests?:
    | WarehouseReceiptDetail['warehouse_manifests']
    | WarehouseReceiptDetail['warehouse_manifests'][]
    | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] || null
  }

  return value || null
}

export async function getWarehouseReceipts(): Promise<WarehouseReceiptListItem[]> {
  const { data, error } = await supabase
    .from('warehouse_receipts')
    .select(`
      id,
      wr_number,
      customer_id,
      manifest_id,
      manifest_item_id,
      received_at,
      tracking_number,
      courier_name,
      external_reference,
      pieces,
      weight_kg,
      description,
      cargo_condition,
      has_visible_damage,
      location_id,
      status,
      customs_status,
      customs_reference,
      customs_verified_at,
      customs_verified_by,
      notes,
      created_at,
      updated_at,
      customers (
        id,
        company_name,
        legal_name,
        customer_code,
        tax_id
      ),
      warehouse_locations (
        id,
        code,
        zone,
        rack,
        level,
        position
      ),
      warehouse_manifests (
        id,
        manifest_number,
        master_bl,
        container_number
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data || []) as unknown as RawWarehouseReceiptListItem[]

  return rows.map((row) => ({
    ...row,
    customers: firstRelation(row.customers),
    warehouse_locations: firstRelation(row.warehouse_locations),
    warehouse_manifests: firstRelation(row.warehouse_manifests),
  }))
}

export async function getWarehouseReceiptById(
  receiptId: string
): Promise<WarehouseReceiptDetail | null> {
  const { data, error } = await supabase
    .from('warehouse_receipts')
    .select(`
      id,
      wr_number,
      customer_id,
      shipment_id,
      received_date,
      received_by,
      received_at,
      location_id,
      shipper_name,
      supplier_name,
      tracking_number,
      courier_name,
      external_reference,
      pieces,
      weight_kg,
      length_cm,
      width_cm,
      height_cm,
      description,
      marks_and_numbers,
      cargo_condition,
      has_visible_damage,
      damage_notes,
      notes,
      internal_notes,
      status,
      customs_status,
      customs_reference,
      customs_notes,
      customs_verified_at,
      customs_verified_by,
      manifest_id,
      manifest_item_id,
      created_at,
      updated_at,
      customers (
        id,
        company_name,
        legal_name,
        customer_code,
        tax_id,
        email,
        phone
      ),
      warehouse_locations (
        id,
        code,
        zone,
        rack,
        level,
        position,
        description
      ),
      warehouse_manifests (
        id,
        manifest_number,
        master_bl,
        container_number,
        seal_number,
        customs_administration,
        carrier_name,
        vehicle_plate
      )
    `)
    .eq('id', receiptId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as unknown as RawWarehouseReceiptDetail

  return {
    ...row,
    customers: firstRelation(row.customers),
    warehouse_locations: firstRelation(row.warehouse_locations),
    warehouse_manifests: firstRelation(row.warehouse_manifests),
  }
}

export async function getWarehouseReceiptItems(
  receiptId: string
): Promise<WarehouseReceiptItem[]> {
  const { data, error } = await supabase
    .from('warehouse_receipt_items')
    .select(`
      id,
      warehouse_receipt_id,
      item_number,
      description,
      pieces,
      weight_kg,
      length_cm,
      width_cm,
      height_cm,
      volume_cbm,
      hs_code,
      serial_number,
      notes,
      created_at
    `)
    .eq('warehouse_receipt_id', receiptId)
    .order('item_number', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as WarehouseReceiptItem[]
}

export async function getWarehouseLocationOptions(): Promise<WarehouseLocationOption[]> {
  const { data, error } = await supabase
    .from('warehouse_locations')
    .select('id, code, zone, rack, level, position, description')
    .eq('is_active', true)
    .order('code', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as WarehouseLocationOption[]
}

export async function updateReceiptInspection(
  receiptId: string,
  payload: UpdateReceiptInspectionPayload
): Promise<WarehouseReceiptDetail> {
  const { data, error } = await supabase.rpc('inspect_warehouse_receipt', {
    p_receipt_id: receiptId,
    p_pieces: Number(payload.pieces || 0),
    p_weight_kg: Number(payload.weight_kg || 0),
    p_length_cm: Number(payload.length_cm || 0),
    p_width_cm: Number(payload.width_cm || 0),
    p_height_cm: Number(payload.height_cm || 0),
    p_cargo_condition: payload.cargo_condition,
    p_has_visible_damage: Boolean(payload.has_visible_damage),
    p_damage_notes: payload.damage_notes || null,
    p_location_id: payload.location_id || null,
    p_status: payload.status,
    p_notes: payload.notes || null,
    p_internal_notes: payload.internal_notes || null,
    p_operator_name: payload.operator_name || null,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('El BL ya fue despachado o no admite nuevas inspecciones.')
  }

  const updated = await getWarehouseReceiptById(receiptId)
  if (!updated) throw new Error('No se pudo recuperar la recepción actualizada.')
  return updated
}
