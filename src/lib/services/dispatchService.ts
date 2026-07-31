import { supabase } from '../supabase/client'

import type {
  CreateDispatchPayload,
  DispatchBillingStatus,
  DispatchCandidate,
  DispatchCharge,
  DispatchRecord,
  UpdateDispatchPayload,
} from '../../types/dispatch'

type RawReceipt = {
  id: string
  wr_number: string
  customer_id: string
  manifest_id: string | null
  manifest_item_id: string | null
  pieces: number
  weight_kg: number
  status: string
  reconciliation_status: string
  reception_complete: boolean
  confirmed_at: string | null
  has_visible_damage: boolean
  location_id: string | null
  customs_status: string
}

type RawManifest = {
  id: string
  manifest_number: string
  master_bl: string
  container_number: string | null
  arrival_date: string | null
}

type RawItem = {
  id: string
  document_number: string
  house_bl: string | null
  cargo_description: string
  package_type: string
}

type RawCustomer = {
  id: string
  company_name: string | null
  legal_name: string | null
  customer_code: string | null
  address: string | null
  city: string | null
}

type RawLocation = {
  id: string
  code: string
}

type RawDispatch = Omit<
  DispatchRecord,
  | 'charges'
  | 'wr_number'
  | 'manifest_number'
  | 'master_bl'
  | 'document_number'
  | 'house_bl'
  | 'cargo_description'
  | 'customer_name'
  | 'customer_code'
  | 'customer_address'
  | 'location_code'
> & {
  warehouse_dispatch_charges?: DispatchCharge[] | null
}

export type DispatchDashboardData = {
  candidates: DispatchCandidate[]
  dispatches: DispatchRecord[]
}

function throwIfError(error: { message: string; code?: string } | null) {
  if (!error) return

  throw new Error(
    error.message.includes('warehouse_dispatch') || error.code === 'PGRST202'
      ? 'Falta aplicar la migración del módulo de despacho en Supabase.'
      : error.message
  )
}

function numberValue(value: unknown): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function storageDays(receivedAt: string | null | undefined, dispatchedAt = new Date()) {
  if (!receivedAt) return 1
  const received = new Date(receivedAt)
  if (Number.isNaN(received.getTime())) return 1
  const receivedDay = Date.UTC(received.getUTCFullYear(), received.getUTCMonth(), received.getUTCDate())
  const dispatchDay = Date.UTC(dispatchedAt.getUTCFullYear(), dispatchedAt.getUTCMonth(), dispatchedAt.getUTCDate())
  return Math.max(1, Math.ceil((dispatchDay - receivedDay) / 86_400_000))
}

export async function getDispatchDashboard(): Promise<DispatchDashboardData> {
  const [
    receiptResult,
    manifestResult,
    itemResult,
    customerResult,
    locationResult,
    dispatchResult,
  ] = await Promise.all([
    supabase.from('warehouse_receipts').select(`
      id, wr_number, customer_id, manifest_id, manifest_item_id,
      pieces, weight_kg, status, reconciliation_status,
      reception_complete, confirmed_at, has_visible_damage, location_id, customs_status
    `),
    supabase
      .from('warehouse_manifests')
      .select('id, manifest_number, master_bl, container_number, arrival_date'),
    supabase
      .from('warehouse_manifest_items')
      .select('id, document_number, house_bl, cargo_description, package_type'),
    supabase
      .from('customers')
      .select('id, company_name, legal_name, customer_code, address, city'),
    supabase.from('warehouse_locations').select('id, code'),
    supabase
      .from('warehouse_dispatches')
      .select('*, warehouse_dispatch_charges(*)')
      .order('dispatched_at', { ascending: false }),
  ])

  throwIfError(
    receiptResult.error ||
      manifestResult.error ||
      itemResult.error ||
      customerResult.error ||
      locationResult.error ||
      dispatchResult.error
  )

  const receipts = (receiptResult.data || []) as RawReceipt[]
  const manifests = new Map(
    ((manifestResult.data || []) as RawManifest[]).map((value) => [value.id, value])
  )
  const items = new Map(
    ((itemResult.data || []) as RawItem[]).map((value) => [value.id, value])
  )
  const customers = new Map(
    ((customerResult.data || []) as RawCustomer[]).map((value) => [value.id, value])
  )
  const locations = new Map(
    ((locationResult.data || []) as RawLocation[]).map((value) => [value.id, value])
  )
  const rawDispatches = (dispatchResult.data || []) as unknown as RawDispatch[]

  const activeDispatches = rawDispatches.filter(
    (dispatch) => dispatch.dispatch_status !== 'cancelled'
  )

  const candidates = receipts
    .filter((receipt) => receipt.manifest_id && receipt.manifest_item_id)
    .map((receipt): DispatchCandidate => {
      const manifest = manifests.get(receipt.manifest_id || '')
      const item = items.get(receipt.manifest_item_id || '')
      const customer = customers.get(receipt.customer_id)
      const location = locations.get(receipt.location_id || '')
      const receiptDispatches = activeDispatches.filter(
        (dispatch) => dispatch.receipt_id === receipt.id
      )
      const dispatchedPieces = receiptDispatches.reduce(
        (total, dispatch) => total + numberValue(dispatch.pieces_dispatched),
        0
      )
      const dispatchedWeight = receiptDispatches.reduce(
        (total, dispatch) => total + numberValue(dispatch.weight_dispatched_kg),
        0
      )
      const availablePieces = Math.max(numberValue(receipt.pieces) - dispatchedPieces, 0)
      const availableWeight = Math.max(numberValue(receipt.weight_kg) - dispatchedWeight, 0)

      let blockedReason: string | null = null
      if (!receipt.reception_complete || receipt.reconciliation_status === 'pending') {
        blockedReason = 'Recepción pendiente de confirmar'
      } else if (receipt.has_visible_damage || receipt.status === 'inspection') {
        blockedReason = 'Inspección o daños pendientes'
      } else if (receipt.customs_status !== 'verified') {
        blockedReason = receipt.customs_status === 'held'
          ? 'Carga retenida por Aduanas'
          : 'Verificación de Aduanas pendiente'
      } else if (availablePieces <= 0) {
        blockedReason = 'BL despachado completamente'
      }

      return {
        receipt_id: receipt.id,
        wr_number: receipt.wr_number,
        manifest_id: receipt.manifest_id || '',
        manifest_item_id: receipt.manifest_item_id || '',
        customer_id: receipt.customer_id,
        manifest_number: manifest?.manifest_number || '-',
        master_bl: manifest?.master_bl || '-',
        container_number: manifest?.container_number || null,
        document_number: item?.document_number || '-',
        house_bl: item?.house_bl || null,
        cargo_description: item?.cargo_description || 'Sin descripción',
        package_type: item?.package_type || 'bultos',
        customer_name:
          customer?.company_name || customer?.legal_name || 'Cliente sin nombre',
        customer_code: customer?.customer_code || null,
        received_pieces: numberValue(receipt.pieces),
        received_weight_kg: numberValue(receipt.weight_kg),
        dispatched_pieces: dispatchedPieces,
        dispatched_weight_kg: dispatchedWeight,
        available_pieces: availablePieces,
        available_weight_kg: availableWeight,
        location_code: location?.code || null,
        confirmed_at: receipt.confirmed_at,
        arrival_date: manifest?.arrival_date || null,
        storage_days: storageDays(receipt.confirmed_at),
        customs_status: receipt.customs_status,
        eligible: !blockedReason,
        blocked_reason: blockedReason,
      }
    })

  const dispatches = rawDispatches.map((dispatch): DispatchRecord => {
    const receipt = receipts.find((value) => value.id === dispatch.receipt_id)
    const manifest = manifests.get(dispatch.manifest_id)
    const item = items.get(dispatch.manifest_item_id)
    const customer = customers.get(dispatch.customer_id)
    const location = locations.get(receipt?.location_id || '')

    return {
      ...dispatch,
      pieces_dispatched: numberValue(dispatch.pieces_dispatched),
      weight_dispatched_kg: numberValue(dispatch.weight_dispatched_kg),
      remaining_pieces: numberValue(dispatch.remaining_pieces),
      liquidation_amount: numberValue(dispatch.liquidation_amount),
      insurance_rate: numberValue(dispatch.insurance_rate),
      insurance_amount: numberValue(dispatch.insurance_amount),
      subtotal: numberValue(dispatch.subtotal),
      tax_rate: numberValue(dispatch.tax_rate),
      tax_amount: numberValue(dispatch.tax_amount),
      discount_amount: numberValue(dispatch.discount_amount),
      total_amount: numberValue(dispatch.total_amount),
      charges: (dispatch.warehouse_dispatch_charges || [])
        .map((charge) => ({
          ...charge,
          quantity: numberValue(charge.quantity),
          unit_rate: numberValue(charge.unit_rate),
          amount: numberValue(charge.amount),
        }))
        .sort((a, b) => numberValue(a.sort_order) - numberValue(b.sort_order)),
      wr_number: receipt?.wr_number || '-',
      manifest_number: manifest?.manifest_number || '-',
      master_bl: manifest?.master_bl || '-',
      document_number: item?.document_number || '-',
      house_bl: item?.house_bl || null,
      cargo_description: item?.cargo_description || 'Sin descripción',
      customer_name:
        customer?.company_name || customer?.legal_name || 'Cliente sin nombre',
      customer_code: customer?.customer_code || null,
      customer_address:
        [customer?.address, customer?.city].filter(Boolean).join(', ') || null,
      location_code: location?.code || null,
      arrival_date: manifest?.arrival_date || null,
      received_at: receipt?.confirmed_at || null,
      storage_days: storageDays(receipt?.confirmed_at, new Date(dispatch.dispatched_at)),
    }
  })

  return { candidates, dispatches }
}

export async function getDispatchCandidate(
  receiptId: string
): Promise<DispatchCandidate> {
  const dashboard = await getDispatchDashboard()
  const candidate = dashboard.candidates.find(
    (value) => value.receipt_id === receiptId
  )

  if (!candidate) throw new Error('No se encontró el BL solicitado.')
  return candidate
}

export async function getDispatchReport(
  dispatchId: string
): Promise<DispatchRecord> {
  const dashboard = await getDispatchDashboard()
  const dispatch = dashboard.dispatches.find((value) => value.id === dispatchId)

  if (!dispatch) throw new Error('No se encontró el despacho solicitado.')
  return dispatch
}

export async function getDispatchReports(
  dispatchIds: string[]
): Promise<DispatchRecord[]> {
  const uniqueIds = [...new Set(dispatchIds)]
  if (!uniqueIds.length) return []

  const dashboard = await getDispatchDashboard()
  const dispatches = new Map(
    dashboard.dispatches.map((dispatch) => [dispatch.id, dispatch])
  )

  return uniqueIds.flatMap((id) => {
    const dispatch = dispatches.get(id)
    return dispatch ? [dispatch] : []
  })
}

export async function createDispatch(
  payload: CreateDispatchPayload
): Promise<DispatchRecord> {
  const { data, error } = await supabase.rpc('create_warehouse_bl_dispatch', {
    p_receipt_id: payload.receipt_id,
    p_pieces_dispatched: Number(payload.pieces_dispatched),
    p_weight_dispatched_kg: Number(payload.weight_dispatched_kg),
    p_igra_number: payload.igra_number.trim(),
    p_igra_approved: payload.igra_approved,
    p_liquidation_amount: Number(payload.liquidation_amount),
    p_insurance_rate: Number(payload.insurance_rate),
    p_recipient_name: payload.recipient_name.trim(),
    p_recipient_identification: payload.recipient_identification || null,
    p_recipient_phone: payload.recipient_phone || null,
    p_carrier_name: payload.carrier_name || null,
    p_driver_name: payload.driver_name || null,
    p_vehicle_plate: payload.vehicle_plate || null,
    p_delivery_address: payload.delivery_address || null,
    p_authorization_reference: payload.authorization_reference || null,
    p_operator_name: payload.operator_name.trim(),
    p_delivery_notes: payload.delivery_notes || null,
    p_currency: payload.currency,
    p_tax_rate: Number(payload.tax_rate),
    p_discount_amount: Number(payload.discount_amount),
    p_charges: payload.charges.map((charge) => ({
      code: charge.charge_code,
      description: charge.description.trim(),
      quantity: Number(charge.quantity),
      unit: charge.unit,
      unit_rate: Number(charge.unit_rate),
    })),
  })

  throwIfError(error)

  const result = Array.isArray(data) ? data[0] : data
  if (!result?.id) throw new Error('Supabase no devolvió el despacho creado.')
  return getDispatchReport(result.id)
}

export async function setDispatchBillingStatus(
  dispatchId: string,
  status: Exclude<DispatchBillingStatus, 'cancelled'>,
  invoiceReference: string,
  operatorName: string
): Promise<void> {
  const { error } = await supabase.rpc('set_warehouse_dispatch_billing_status', {
    p_dispatch_id: dispatchId,
    p_billing_status: status,
    p_invoice_reference: invoiceReference || null,
    p_operator_name: operatorName.trim(),
  })

  throwIfError(error)
}

export async function updateDispatch(
  payload: UpdateDispatchPayload
): Promise<DispatchRecord> {
  const { data, error } = await supabase.rpc('update_warehouse_bl_dispatch', {
    p_dispatch_id: payload.dispatch_id,
    p_igra_number: payload.igra_number.trim(),
    p_igra_approved: payload.igra_approved,
    p_liquidation_amount: Number(payload.liquidation_amount),
    p_insurance_rate: Number(payload.insurance_rate),
    p_recipient_name: payload.recipient_name.trim(),
    p_recipient_identification: payload.recipient_identification || null,
    p_recipient_phone: payload.recipient_phone || null,
    p_carrier_name: payload.carrier_name || null,
    p_driver_name: payload.driver_name || null,
    p_vehicle_plate: payload.vehicle_plate || null,
    p_delivery_notes: payload.delivery_notes || null,
    p_currency: payload.currency,
    p_tax_rate: Number(payload.tax_rate),
    p_discount_amount: Number(payload.discount_amount),
    p_edited_by: payload.edited_by.trim(),
    p_admin_key: payload.admin_key || null,
    p_charges: payload.charges.map((charge) => ({
      code: charge.charge_code,
      description: charge.description.trim(),
      quantity: Number(charge.quantity),
      unit: charge.unit,
      unit_rate: Number(charge.unit_rate),
    })),
  })

  throwIfError(error)
  const result = Array.isArray(data) ? data[0] : data
  if (!result?.id) throw new Error('Supabase no devolvió el comprobante actualizado.')
  return getDispatchReport(result.id)
}

export async function cancelDispatch(
  dispatchId: string,
  operatorName: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc('cancel_warehouse_bl_dispatch', {
    p_dispatch_id: dispatchId,
    p_operator_name: operatorName.trim(),
    p_reason: reason.trim(),
  })

  throwIfError(error)
}
