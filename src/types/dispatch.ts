export type DispatchStatus = 'confirmed' | 'delivered' | 'cancelled'

export type DispatchBillingStatus =
  | 'pending'
  | 'ready'
  | 'invoiced'
  | 'paid'
  | 'cancelled'

export type DispatchCurrency = 'DOP' | 'USD'
export type DispatchType = 'full' | 'partial'

export type DispatchCharge = {
  id?: string
  dispatch_id?: string
  sort_order?: number
  charge_code: string
  description: string
  quantity: number
  unit: string
  unit_rate: number
  amount?: number
  created_at?: string
}

export type DispatchRecord = {
  id: string
  dispatch_number: string
  receipt_id: string
  manifest_id: string
  manifest_item_id: string
  customer_id: string
  dispatch_status: DispatchStatus
  billing_status: DispatchBillingStatus
  dispatch_type: DispatchType
  pieces_dispatched: number
  weight_dispatched_kg: number
  remaining_pieces: number
  currency: DispatchCurrency
  igra_number: string
  igra_approved: boolean
  liquidation_amount: number
  insurance_rate: number
  insurance_amount: number
  recipient_name: string
  recipient_identification: string | null
  recipient_phone: string | null
  carrier_name: string | null
  driver_name: string | null
  vehicle_plate: string | null
  delivery_address: string | null
  authorization_reference: string | null
  operator_name: string
  delivery_notes: string | null
  invoice_reference: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  dispatched_at: string
  delivered_at: string | null
  created_at: string
  updated_at: string
  charges: DispatchCharge[]
  wr_number: string
  manifest_number: string
  master_bl: string
  document_number: string
  house_bl: string | null
  cargo_description: string
  customer_name: string
  customer_code: string | null
  customer_address: string | null
  location_code: string | null
  arrival_date: string | null
  received_at: string | null
  storage_days: number
}

export type DispatchCandidate = {
  receipt_id: string
  wr_number: string
  manifest_id: string
  manifest_item_id: string
  customer_id: string
  manifest_number: string
  master_bl: string
  container_number: string | null
  document_number: string
  house_bl: string | null
  cargo_description: string
  package_type: string
  customer_name: string
  customer_code: string | null
  received_pieces: number
  received_weight_kg: number
  dispatched_pieces: number
  dispatched_weight_kg: number
  available_pieces: number
  available_weight_kg: number
  location_code: string | null
  confirmed_at: string | null
  arrival_date: string | null
  storage_days: number
  customs_status: string
  eligible: boolean
  blocked_reason: string | null
}

export type CreateDispatchPayload = {
  receipt_id: string
  pieces_dispatched: number
  weight_dispatched_kg: number
  igra_number: string
  igra_approved: boolean
  liquidation_amount: number
  insurance_rate: number
  recipient_name: string
  recipient_identification: string
  recipient_phone: string
  carrier_name: string
  driver_name: string
  vehicle_plate: string
  delivery_address: string
  authorization_reference: string
  operator_name: string
  delivery_notes: string
  currency: DispatchCurrency
  tax_rate: number
  discount_amount: number
  charges: DispatchCharge[]
}

export type UpdateDispatchPayload = {
  dispatch_id: string
  igra_number: string
  igra_approved: boolean
  liquidation_amount: number
  insurance_rate: number
  recipient_name: string
  recipient_identification: string
  recipient_phone: string
  carrier_name: string
  driver_name: string
  vehicle_plate: string
  delivery_notes: string
  currency: DispatchCurrency
  tax_rate: number
  discount_amount: number
  edited_by: string
  admin_key: string
  charges: DispatchCharge[]
}

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  confirmed: 'Confirmado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

export const BILLING_STATUS_LABELS: Record<DispatchBillingStatus, string> = {
  pending: 'Pendiente de liquidar',
  ready: 'Listo para facturar',
  invoiced: 'Facturado',
  paid: 'Pagado',
  cancelled: 'Cancelado',
}
