import { supabase } from '../supabase/client'

import type { CargoCondition, WarehouseLocationOption } from './receiptService'
import type { WarehouseManifest } from '../../types/manifest'

export type ReceiptReconciliationStatus =
  | 'pending'
  | 'correct'
  | 'partial'
  | 'shortage'
  | 'overage'
  | 'damaged'
  | 'not_received'

export const RECONCILIATION_STATUS_LABELS: Record<ReceiptReconciliationStatus, string> = {
  pending: 'Pendiente',
  correct: 'Recibido correcto',
  partial: 'Recepción parcial',
  shortage: 'Con faltantes',
  overage: 'Con sobrantes',
  damaged: 'Con daños',
  not_received: 'No recibido',
}

export type ReceiptConfirmation = {
  id: string
  receipt_id: string
  version_no: number
  expected_pieces: number
  received_pieces: number
  expected_weight_kg: number
  received_weight_kg: number
  piece_difference: number
  reconciliation_status: ReceiptReconciliationStatus
  reception_complete: boolean
  cargo_condition: CargoCondition
  has_visible_damage: boolean
  damage_notes: string | null
  operator_name: string
  notes: string | null
  created_at: string
}

export type ManifestBlCheckInRow = {
  manifest_item_id: string
  manifest_id: string
  line_number: number
  document_number: string
  house_bl: string | null
  customer_name: string
  customer_code: string | null
  container_number: string | null
  package_type: string
  expected_pieces: number
  expected_weight_kg: number
  cargo_description: string
  receipt_id: string | null
  wr_number: string | null
  received_pieces: number
  received_weight_kg: number
  reconciliation_status: ReceiptReconciliationStatus
  piece_difference: number
  reception_complete: boolean
  cargo_condition: CargoCondition
  has_visible_damage: boolean
  damage_notes: string | null
  location_id: string | null
  confirmed_at: string | null
  confirmed_by_name: string | null
  notes: string | null
  confirmations: ReceiptConfirmation[]
}

export type ManifestCheckInSummary = {
  manifest: WarehouseManifest
  rows: ManifestBlCheckInRow[]
  total_bls: number
  processed_bls: number
  correct_bls: number
  discrepancy_bls: number
  expected_pieces: number
  received_pieces: number
  progress: number
}

export type ConfirmBlReceiptPayload = {
  receipt_id: string
  received_pieces: number
  received_weight_kg: number
  cargo_condition: CargoCondition
  has_visible_damage: boolean
  damage_notes: string
  location_id: string
  operator_name: string
  notes: string
  reception_complete: boolean
}

type RawItem = {
  id: string
  manifest_id: string
  line_number: number
  document_number: string
  house_bl: string | null
  container_number: string | null
  package_quantity: number
  package_type: string
  gross_weight_kg: number
  cargo_description: string
  customers?: RawCustomer | RawCustomer[] | null
}

type RawCustomer = {
  company_name: string | null
  legal_name: string | null
  customer_code: string | null
}

type RawReceipt = {
  id: string
  wr_number: string
  manifest_id: string | null
  manifest_item_id: string | null
  pieces: number
  weight_kg: number
  reconciliation_status: ReceiptReconciliationStatus
  piece_difference: number
  reception_complete: boolean
  cargo_condition: CargoCondition
  has_visible_damage: boolean
  damage_notes: string | null
  location_id: string | null
  confirmed_at: string | null
  confirmed_by_name: string | null
  notes: string | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null
}

function buildRows(
  items: RawItem[],
  receipts: RawReceipt[],
  confirmations: ReceiptConfirmation[] = []
): ManifestBlCheckInRow[] {
  const receiptByItem = new Map(
    receipts.map((receipt) => [receipt.manifest_item_id, receipt])
  )

  return items.map((item) => {
    const receipt = receiptByItem.get(item.id)
    const customer = firstRelation(item.customers)

    return {
      manifest_item_id: item.id,
      manifest_id: item.manifest_id,
      line_number: item.line_number,
      document_number: item.document_number,
      house_bl: item.house_bl,
      customer_name:
        customer?.company_name || customer?.legal_name || 'Cliente sin nombre',
      customer_code: customer?.customer_code || null,
      container_number: item.container_number,
      package_type: item.package_type,
      expected_pieces: Number(item.package_quantity || 0),
      expected_weight_kg: Number(item.gross_weight_kg || 0),
      cargo_description: item.cargo_description,
      receipt_id: receipt?.id || null,
      wr_number: receipt?.wr_number || null,
      received_pieces: Number(receipt?.pieces || 0),
      received_weight_kg: Number(receipt?.weight_kg || 0),
      reconciliation_status: receipt?.reconciliation_status || 'pending',
      piece_difference: Number(receipt?.piece_difference || 0),
      reception_complete: Boolean(receipt?.reception_complete),
      cargo_condition: receipt?.cargo_condition || 'unknown',
      has_visible_damage: Boolean(receipt?.has_visible_damage),
      damage_notes: receipt?.damage_notes || null,
      location_id: receipt?.location_id || null,
      confirmed_at: receipt?.confirmed_at || null,
      confirmed_by_name: receipt?.confirmed_by_name || null,
      notes: receipt?.notes || null,
      confirmations: confirmations.filter(
        (confirmation) => confirmation.receipt_id === receipt?.id
      ),
    }
  })
}

function summarize(
  manifest: WarehouseManifest,
  rows: ManifestBlCheckInRow[]
): ManifestCheckInSummary {
  const processed = rows.filter((row) => row.reconciliation_status !== 'pending')
  const discrepancies = processed.filter(
    (row) => row.reconciliation_status !== 'correct'
  )

  return {
    manifest,
    rows,
    total_bls: rows.length,
    processed_bls: processed.length,
    correct_bls: processed.length - discrepancies.length,
    discrepancy_bls: discrepancies.length,
    expected_pieces: rows.reduce((total, row) => total + row.expected_pieces, 0),
    received_pieces: processed.reduce(
      (total, row) => total + row.received_pieces,
      0
    ),
    progress: rows.length
      ? Math.round((processed.length / rows.length) * 100)
      : 0,
  }
}

const itemSelect = `
  id, manifest_id, line_number, document_number, house_bl,
  container_number, package_quantity, package_type, gross_weight_kg,
  cargo_description,
  customers (company_name, legal_name, customer_code)
`

const receiptSelect = `
  id, wr_number, manifest_id, manifest_item_id, pieces, weight_kg,
  reconciliation_status, piece_difference, reception_complete,
  cargo_condition, has_visible_damage, damage_notes, location_id,
  confirmed_at, confirmed_by_name, notes
`

function checkError(error: { message: string } | null): void {
  if (!error) return

  throw new Error(
    error.message.includes('reconciliation_status') ||
      error.message.includes('warehouse_receipt_confirmations')
      ? 'Falta aplicar la migración del módulo de entrada por BL en Supabase.'
      : error.message
  )
}

export async function getManifestCheckInSummaries(): Promise<ManifestCheckInSummary[]> {
  const [manifestResult, itemResult, receiptResult] = await Promise.all([
    supabase
      .from('warehouse_manifests')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('warehouse_manifest_items').select(itemSelect),
    supabase.from('warehouse_receipts').select(receiptSelect),
  ])

  checkError(manifestResult.error || itemResult.error || receiptResult.error)

  const manifests = (manifestResult.data || []) as WarehouseManifest[]
  const items = (itemResult.data || []) as unknown as RawItem[]
  const receipts = (receiptResult.data || []) as unknown as RawReceipt[]

  return manifests.map((manifest) =>
    summarize(
      manifest,
      buildRows(
        items.filter((item) => item.manifest_id === manifest.id),
        receipts.filter((receipt) => receipt.manifest_id === manifest.id)
      )
    )
  )
}

export async function getManifestCheckIn(
  manifestId: string
): Promise<{
  summary: ManifestCheckInSummary
  locations: WarehouseLocationOption[]
}> {
  const [manifestResult, itemResult, receiptResult, confirmationResult, locationResult] =
    await Promise.all([
      supabase
        .from('warehouse_manifests')
        .select('*')
        .eq('id', manifestId)
        .single(),
      supabase
        .from('warehouse_manifest_items')
        .select(itemSelect)
        .eq('manifest_id', manifestId)
        .order('line_number', { ascending: true }),
      supabase
        .from('warehouse_receipts')
        .select(receiptSelect)
        .eq('manifest_id', manifestId),
      supabase
        .from('warehouse_receipt_confirmations')
        .select('*')
        .eq('manifest_id', manifestId)
        .order('created_at', { ascending: false }),
      supabase
        .from('warehouse_locations')
        .select('id, code, zone, rack, level, position, description')
        .eq('is_active', true)
        .order('code', { ascending: true }),
    ])

  checkError(
    manifestResult.error ||
      itemResult.error ||
      receiptResult.error ||
      confirmationResult.error ||
      locationResult.error
  )

  const manifest = manifestResult.data as WarehouseManifest
  const items = (itemResult.data || []) as unknown as RawItem[]
  const receipts = (receiptResult.data || []) as unknown as RawReceipt[]
  const confirmations = (confirmationResult.data || []) as ReceiptConfirmation[]

  return {
    summary: summarize(manifest, buildRows(items, receipts, confirmations)),
    locations: (locationResult.data || []) as WarehouseLocationOption[],
  }
}

export async function confirmBlReceipt(
  payload: ConfirmBlReceiptPayload
): Promise<void> {
  const { error } = await supabase.rpc('confirm_warehouse_bl', {
    p_receipt_id: payload.receipt_id,
    p_received_pieces: Number(payload.received_pieces),
    p_received_weight_kg: Number(payload.received_weight_kg),
    p_cargo_condition: payload.cargo_condition,
    p_has_visible_damage: payload.has_visible_damage,
    p_damage_notes: payload.damage_notes || null,
    p_location_id: payload.location_id || null,
    p_operator_name: payload.operator_name.trim(),
    p_notes: payload.notes || null,
    p_reception_complete: payload.reception_complete,
  })

  if (error) {
    throw new Error(
      error.code === 'PGRST202'
        ? 'Falta aplicar la migración del módulo de entrada por BL en Supabase.'
        : error.message
    )
  }
}
