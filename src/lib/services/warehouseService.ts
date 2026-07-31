import { supabase } from '../supabase/client'

import type {
  CustomerOption,
  WarehouseLocation,
  WarehouseReceipt,
  WarehouseReceiptFormData,
} from '../../types/warehouse'

export async function getActiveCustomers(): Promise<CustomerOption[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, company_name, legal_name, customer_code')
    .order('company_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as CustomerOption[]
}

export async function getWarehouseLocations(): Promise<WarehouseLocation[]> {
  const { data, error } = await supabase
    .from('warehouse_locations')
    .select('id, code, zone, rack, level, position, description, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('code', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as WarehouseLocation[]
}

export async function createWarehouseReceipt(
  formData: WarehouseReceiptFormData
): Promise<WarehouseReceipt> {
  const payload = {
    customer_id: formData.customer_id,
    shipper_name: formData.shipper_name || null,
    supplier_name: formData.supplier_name || null,
    tracking_number: formData.tracking_number || null,
    courier_name: formData.courier_name || null,
    external_reference: formData.external_reference || null,
    pieces: Number(formData.pieces || 0),
    weight_kg: Number(formData.weight_kg || 0),
    length_cm: Number(formData.length_cm || 0),
    width_cm: Number(formData.width_cm || 0),
    height_cm: Number(formData.height_cm || 0),
    description: formData.description,
    marks_and_numbers: formData.marks_and_numbers || null,
    cargo_condition: formData.cargo_condition,
    has_visible_damage: Boolean(formData.has_visible_damage),
    damage_notes: formData.damage_notes || null,
    location_id: formData.location_id || null,
    status: formData.status,
    notes: formData.notes || null,
    internal_notes: formData.internal_notes || null,
  }

  const { data, error } = await supabase
    .from('warehouse_receipts')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as WarehouseReceipt
}
