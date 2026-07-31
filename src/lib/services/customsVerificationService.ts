import { supabase } from '../supabase/client'

export type CustomsVerificationStatus = 'pending' | 'verified' | 'held'

export type CustomsVerificationRecord = {
  id: string
  wr_number: string
  manifest_id: string | null
  manifest_item_id: string | null
  pieces: number
  weight_kg: number
  description: string
  status: string
  reception_complete: boolean
  reconciliation_status: string
  has_visible_damage: boolean
  location_id: string | null
  customs_status: CustomsVerificationStatus
  customs_reference: string | null
  customs_notes: string | null
  customs_verified_at: string | null
  customs_verified_by: string | null
  customers: {
    company_name: string | null
    legal_name: string | null
    customer_code: string | null
  } | null
  warehouse_locations: { code: string } | null
  warehouse_manifests: {
    manifest_number: string
    master_bl: string
    container_number: string | null
    customs_administration: string | null
  } | null
  warehouse_manifest_items: {
    document_number: string
    house_bl: string | null
  } | null
}

type RawRecord = Omit<
  CustomsVerificationRecord,
  'customers' | 'warehouse_locations' | 'warehouse_manifests' | 'warehouse_manifest_items'
> & {
  customers: CustomsVerificationRecord['customers'] | CustomsVerificationRecord['customers'][]
  warehouse_locations: CustomsVerificationRecord['warehouse_locations'] | CustomsVerificationRecord['warehouse_locations'][]
  warehouse_manifests: CustomsVerificationRecord['warehouse_manifests'] | CustomsVerificationRecord['warehouse_manifests'][]
  warehouse_manifest_items: CustomsVerificationRecord['warehouse_manifest_items'] | CustomsVerificationRecord['warehouse_manifest_items'][]
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value
}

export async function getCustomsVerificationQueue(): Promise<CustomsVerificationRecord[]> {
  const { data, error } = await supabase
    .from('warehouse_receipts')
    .select(`
      id, wr_number, manifest_id, manifest_item_id, pieces, weight_kg, description,
      status, reception_complete, reconciliation_status, has_visible_damage, location_id,
      customs_status, customs_reference, customs_notes, customs_verified_at, customs_verified_by,
      customers (company_name, legal_name, customer_code),
      warehouse_locations (code),
      warehouse_manifests (manifest_number, master_bl, container_number, customs_administration),
      warehouse_manifest_items (document_number, house_bl)
    `)
    .not('manifest_id', 'is', null)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(
      error.message.includes('customs_status')
        ? 'Falta aplicar la actualización de Verificación de Aduanas en Supabase.'
        : error.message
    )
  }

  return ((data || []) as unknown as RawRecord[]).map((row) => ({
    ...row,
    customers: first(row.customers),
    warehouse_locations: first(row.warehouse_locations),
    warehouse_manifests: first(row.warehouse_manifests),
    warehouse_manifest_items: first(row.warehouse_manifest_items),
  }))
}

export async function setCustomsVerification(payload: {
  receiptId: string
  status: CustomsVerificationStatus
  reference: string
  notes: string
  operatorName: string
}): Promise<void> {
  const { error } = await supabase.rpc('set_warehouse_customs_verification', {
    p_receipt_id: payload.receiptId,
    p_customs_status: payload.status,
    p_customs_reference: payload.reference || null,
    p_customs_notes: payload.notes || null,
    p_operator_name: payload.operatorName,
  })

  if (error) throw new Error(error.message)
}
