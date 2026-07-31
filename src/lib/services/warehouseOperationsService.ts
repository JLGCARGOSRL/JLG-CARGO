import { supabase } from '../supabase/client'
import type {
  WarehouseLocation,
  WarehouseMovement,
  WarehouseReceiptStatus,
} from '../../types/warehouse'
import type { WarehouseReceiptListItem } from './receiptService'

export type WarehouseDashboardData = {
  manifests: number
  receipts: number
  pendingInspection: number
  available: number
  customsPending: number
  dispatched: number
  withoutLocation: number
  piecesInStock: number
  weightInStock: number
  locations: number
  recentReceipts: WarehouseReceiptListItem[]
}

export type MovementWithLocations = WarehouseMovement & {
  performed_by_name?: string | null
  from_location?: { code: string } | null
  to_location?: { code: string } | null
}

async function loadWarehouseDashboardSource() {
  return Promise.all([
      supabase
        .from('warehouse_receipts')
        .select(`
          id, wr_number, customer_id, manifest_id, manifest_item_id, received_at,
          tracking_number, courier_name, external_reference, pieces, weight_kg,
          description, cargo_condition, has_visible_damage, location_id, status,
          customs_status, customs_reference, customs_verified_at, customs_verified_by,
          notes, created_at, updated_at,
          customers (id, company_name, legal_name, customer_code, tax_id),
          warehouse_locations (id, code, zone, rack, level, position),
          warehouse_manifests (id, manifest_number, master_bl, container_number)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('warehouse_manifests').select('*', { count: 'exact', head: true }),
      supabase
        .from('warehouse_locations')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
    ])
}

export async function getWarehouseDashboard(): Promise<WarehouseDashboardData> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) {
    throw new Error('La sesión expiró. Inicie sesión nuevamente.')
  }

  let [receiptResult, manifestResult, locationResult] =
    await loadWarehouseDashboardSource()

  if (receiptResult.error?.code === '42501') {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession()
    if (refreshError || !refreshed.session) {
      throw new Error('La sesión expiró. Inicie sesión nuevamente.')
    }

    ;[receiptResult, manifestResult, locationResult] =
      await loadWarehouseDashboardSource()
  }

  const { data: receipts, error: receiptError } = receiptResult
  const { count: manifests } = manifestResult
  const { count: locations } = locationResult

  if (receiptError) throw new Error(receiptError.message)

  const rows = (receipts || []).map((row) => {
    const normalized = row as unknown as WarehouseReceiptListItem & {
      customers?: WarehouseReceiptListItem['customers'] | WarehouseReceiptListItem['customers'][]
      warehouse_locations?: WarehouseReceiptListItem['warehouse_locations'] | WarehouseReceiptListItem['warehouse_locations'][]
      warehouse_manifests?: WarehouseReceiptListItem['warehouse_manifests'] | WarehouseReceiptListItem['warehouse_manifests'][]
    }
    return {
      ...normalized,
      customers: Array.isArray(normalized.customers) ? normalized.customers[0] || null : normalized.customers || null,
      warehouse_locations: Array.isArray(normalized.warehouse_locations) ? normalized.warehouse_locations[0] || null : normalized.warehouse_locations || null,
      warehouse_manifests: Array.isArray(normalized.warehouse_manifests) ? normalized.warehouse_manifests[0] || null : normalized.warehouse_manifests || null,
    }
  })

  const stockRows = rows.filter((row) => !['dispatched', 'cancelled'].includes(row.status))
  return {
    manifests: manifests || 0,
    receipts: rows.length,
    pendingInspection: rows.filter((row) => ['received', 'inspection'].includes(row.status)).length,
    available: rows.filter((row) => row.status === 'available').length,
    customsPending: rows.filter(
      (row) => row.status === 'available' && row.customs_status !== 'verified'
    ).length,
    dispatched: rows.filter((row) => row.status === 'dispatched').length,
    withoutLocation: stockRows.filter((row) => !row.location_id).length,
    piecesInStock: stockRows.reduce((sum, row) => sum + Number(row.pieces || 0), 0),
    weightInStock: stockRows.reduce((sum, row) => sum + Number(row.weight_kg || 0), 0),
    locations: locations || 0,
    recentReceipts: rows.slice(0, 6),
  }
}

export async function createWarehouseLocation(payload: {
  code: string
  zone: string
  rack?: string
  level?: string
  position?: string
  description?: string
}): Promise<WarehouseLocation> {
  const { data, error } = await supabase.rpc('create_warehouse_location', {
    p_code: payload.code,
    p_zone: payload.zone,
    p_rack: payload.rack || null,
    p_level: payload.level || null,
    p_position: payload.position || null,
    p_description: payload.description || null,
  })
  if (error) throw new Error(error.message)
  return data as WarehouseLocation
}

export async function moveWarehouseReceipt(payload: {
  receiptId: string
  locationId: string
  status: WarehouseReceiptStatus
  notes: string
  operatorName: string
}) {
  const { data, error } = await supabase.rpc('move_warehouse_receipt', {
    p_receipt_id: payload.receiptId,
    p_to_location_id: payload.locationId || null,
    p_to_status: payload.status,
    p_notes: payload.notes || null,
    p_operator_name: payload.operatorName || null,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function getReceiptMovements(receiptId: string): Promise<MovementWithLocations[]> {
  const { data, error } = await supabase
    .from('warehouse_movements')
    .select(`
      id, warehouse_receipt_id, movement_type, from_location_id, to_location_id,
      from_status, to_status, notes, created_by, created_at, performed_by_name,
      from_location:warehouse_locations!warehouse_movements_from_location_id_fkey(code),
      to_location:warehouse_locations!warehouse_movements_to_location_id_fkey(code)
    `)
    .eq('warehouse_receipt_id', receiptId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map((row) => {
    const item = row as unknown as MovementWithLocations & {
      from_location?: { code: string } | { code: string }[] | null
      to_location?: { code: string } | { code: string }[] | null
    }
    return {
      ...item,
      from_location: Array.isArray(item.from_location) ? item.from_location[0] || null : item.from_location || null,
      to_location: Array.isArray(item.to_location) ? item.to_location[0] || null : item.to_location || null,
    }
  })
}
