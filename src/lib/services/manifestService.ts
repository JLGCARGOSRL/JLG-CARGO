import { supabase } from '../supabase/client'

import type {
  WarehouseManifest,
  WarehouseManifestFormData,
  WarehouseManifestItem,
  WarehouseManifestItemFormData,
  CreateWarehouseManifestPayload,
} from '../../types/manifest'

import type { CustomerOption } from '../../types/warehouse'

export type CreateManifestCustomerPayload = {
  company_name: string
  tax_id: string
  contact_name?: string
  email?: string
  phone?: string
}

export type UpdateWarehouseManifestItemPayload =
  WarehouseManifestItemFormData & {
    id?: string
  }

export type UpdateWarehouseManifestPayload = {
  manifest: WarehouseManifestFormData
  items: UpdateWarehouseManifestItemPayload[]
}

function isManifestNumberAndMasterBlConflict(message: string) {
  return (
    message.includes('warehouse_manifests_manifest_number_key') ||
    message.includes('warehouse_manifests_unique_number_master_bl')
  )
}

function getManifestDuplicateMessage(
  manifestNumber: string,
  masterBl: string
) {
  return `Ya existe el manifiesto ${manifestNumber} con el BL Master ${masterBl}. Puedes repetir el numero de manifiesto solamente cuando el BL Master sea diferente.`
}

export async function getManifestCustomers(): Promise<CustomerOption[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, company_name, legal_name, customer_code, tax_id')
    .order('company_name', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as CustomerOption[]
}

export async function createManifestCustomer(
  payload: CreateManifestCustomerPayload
): Promise<CustomerOption> {
  const cleanTaxId = payload.tax_id.trim()
  const cleanCompanyName = payload.company_name.trim()

  if (!cleanCompanyName) {
    throw new Error('Debes indicar el nombre del cliente.')
  }

  if (!cleanTaxId) {
    throw new Error('Debes indicar el RNC del cliente.')
  }

  const { data: existingCustomer, error: existingError } = await supabase
    .from('customers')
    .select('id, company_name, legal_name, customer_code, tax_id')
    .eq('tax_id', cleanTaxId)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existingCustomer) {
    throw new Error(`Ya existe un cliente con ese RNC: ${cleanTaxId}`)
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      company_name: cleanCompanyName,
      legal_name: cleanCompanyName,
      contact_name: payload.contact_name?.trim() || null,
      email: payload.email?.trim() || null,
      phone: payload.phone?.trim() || null,
      tax_id: cleanTaxId,
      status: 'active',
      customer_type: 'importer',
      compliance_status: 'pending',
      kyc_completed: false,
      sanctions_checked: false,
      oea_approved: false,
    })
    .select('id, company_name, legal_name, customer_code, tax_id')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as CustomerOption
}

export async function getManifests(): Promise<WarehouseManifest[]> {
  const { data, error } = await supabase
    .from('warehouse_manifests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as WarehouseManifest[]
}

export async function getManifestById(
  manifestId: string
): Promise<WarehouseManifest | null> {
  const { data, error } = await supabase
    .from('warehouse_manifests')
    .select('*')
    .eq('id', manifestId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data as WarehouseManifest
}

export async function getManifestItems(
  manifestId: string
): Promise<WarehouseManifestItem[]> {
  const { data, error } = await supabase
    .from('warehouse_manifest_items')
    .select('*')
    .eq('manifest_id', manifestId)
    .order('line_number', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as WarehouseManifestItem[]
}

export async function deleteManifest(manifestId: string): Promise<void> {
  const { data: receipts, error: receiptsError } = await supabase
    .from('warehouse_receipts')
    .select('id')
    .eq('manifest_id', manifestId)

  if (receiptsError) {
    throw new Error(
      `No se pudieron consultar los recibos relacionados: ${receiptsError.message}`
    )
  }

  const receiptIds = (receipts || []).map((receipt) => receipt.id as string)

  if (receiptIds.length > 0) {
    const { error: unlinkError } = await supabase
      .from('warehouse_manifest_items')
      .update({ warehouse_receipt_id: null })
      .eq('manifest_id', manifestId)

    if (unlinkError) {
      throw new Error(
        `No se pudieron desvincular las partidas: ${unlinkError.message}`
      )
    }

    const { error: receiptItemsError } = await supabase
      .from('warehouse_receipt_items')
      .delete()
      .in('warehouse_receipt_id', receiptIds)

    if (receiptItemsError) {
      throw new Error(
        `No se pudieron eliminar los detalles de recepción: ${receiptItemsError.message}`
      )
    }

    const { error: deleteReceiptsError } = await supabase
      .from('warehouse_receipts')
      .delete()
      .in('id', receiptIds)

    if (deleteReceiptsError) {
      throw new Error(
        `No se pudieron eliminar los recibos relacionados: ${deleteReceiptsError.message}`
      )
    }
  }

  const { error: itemsError } = await supabase
    .from('warehouse_manifest_items')
    .delete()
    .eq('manifest_id', manifestId)

  if (itemsError) {
    throw new Error(
      `No se pudieron eliminar las partidas del manifiesto: ${itemsError.message}`
    )
  }

  const { data: deletedManifests, error: manifestError } = await supabase
    .from('warehouse_manifests')
    .delete()
    .eq('id', manifestId)
    .select('id')

  if (manifestError) {
    throw new Error(`No se pudo eliminar el manifiesto: ${manifestError.message}`)
  }

  if (!deletedManifests?.length) {
    throw new Error(
      'El manifiesto no existe o no tienes permiso para eliminarlo.'
    )
  }
}

async function createManifestItemAndReceipt(
  manifestId: string,
  manifest: WarehouseManifestFormData,
  item: WarehouseManifestItemFormData
): Promise<void> {
  if (!item.customer_id) {
    throw new Error(
      `La partida ${item.line_number} no tiene cliente seleccionado.`
    )
  }

  const { data: itemRecord, error: itemError } = await supabase
    .from('warehouse_manifest_items')
    .insert({
      manifest_id: manifestId,
      line_number: item.line_number,
      document_number: item.document_number,
      house_bl: item.house_bl || null,
      container_number: item.container_number || manifest.container_number || null,
      seal_number: item.seal_number || manifest.seal_number || null,
      customer_id: item.customer_id,
      shipper_name: item.shipper_name || null,
      consignee_name: item.consignee_name,
      notify_party_name: item.notify_party_name || null,
      package_quantity: Number(item.package_quantity || 0),
      package_type: item.package_type || 'BULTOS',
      gross_weight_kg: Number(item.gross_weight_kg || 0),
      volume_cbm: Number(item.volume_cbm || 0),
      freight_amount: Number(item.freight_amount || 0),
      cargo_description: item.cargo_description,
      marks_and_numbers: item.marks_and_numbers || null,
      status: 'received',
      notes: item.notes || null,
    })
    .select('*')
    .single()

  if (itemError) {
    throw new Error(itemError.message)
  }

  const { data: receiptRecord, error: receiptError } = await supabase
    .from('warehouse_receipts')
    .insert({
      manifest_id: manifestId,
      manifest_item_id: itemRecord.id,
      customer_id: item.customer_id,
      shipper_name: item.shipper_name || null,
      supplier_name: null,
      tracking_number: manifest.manifest_number,
      courier_name: manifest.carrier_name || null,
      external_reference: item.house_bl || manifest.master_bl,
      pieces: Number(item.package_quantity || 0),
      weight_kg: Number(item.gross_weight_kg || 0),
      length_cm: 0,
      width_cm: 0,
      height_cm: 0,
      description: item.cargo_description,
      marks_and_numbers: item.marks_and_numbers || null,
      cargo_condition: 'unknown',
      has_visible_damage: false,
      damage_notes: null,
      location_id: null,
      status: 'received',
      notes: `Generado automáticamente desde manifiesto ${manifest.manifest_number}. Documento: ${item.document_number}`,
      internal_notes: null,
    })
    .select('*')
    .single()

  if (receiptError) {
    throw new Error(receiptError.message)
  }

  const { error: linkError } = await supabase
    .from('warehouse_manifest_items')
    .update({
      warehouse_receipt_id: receiptRecord.id,
      status: 'received',
    })
    .eq('id', itemRecord.id)

  if (linkError) {
    throw new Error(linkError.message)
  }
}

export async function createManifest(
  payload: CreateWarehouseManifestPayload
): Promise<WarehouseManifest> {
  const { manifest, items } = payload

  const { data: manifestRecord, error: manifestError } = await supabase
    .from('warehouse_manifests')
    .insert({
      manifest_number: manifest.manifest_number,
      master_bl: manifest.master_bl,

      carrier_name: manifest.carrier_name || null,
      carrier_identification: manifest.carrier_identification || null,
      agent_name: manifest.agent_name || null,
      customs_administration: manifest.customs_administration || null,

      entry_mode: manifest.entry_mode,
      transfer_type: manifest.transfer_type || null,

      departure_date: null,
      arrival_date: manifest.arrival_date,

      container_number: manifest.container_number || null,
      seal_number: manifest.seal_number || null,
      vehicle_plate: manifest.vehicle_plate || null,
      cargo_label: manifest.cargo_label || null,

      origin: null,
      destination: null,

      status: manifest.status,

      notes: manifest.notes || null,
      internal_notes: manifest.internal_notes || null,
    })
    .select('*')
    .single()

  if (manifestError) {
    if (isManifestNumberAndMasterBlConflict(manifestError.message)) {
      throw new Error(
        getManifestDuplicateMessage(manifest.manifest_number, manifest.master_bl)
      )
    }

    throw new Error(manifestError.message)
  }

  const manifestId = manifestRecord.id as string

  try {
    for (const item of items) {
      await createManifestItemAndReceipt(manifestId, manifest, item)
    }
  } catch (error) {
    try {
      await deleteManifest(manifestId)
    } catch {
      // Conserva el error original. Si la limpieza tambien falla, el manifiesto
      // seguira visible en el listado para que un administrador pueda borrarlo.
    }

    throw error
  }

  return manifestRecord as WarehouseManifest
}

export async function updateManifest(
  manifestId: string,
  payload: UpdateWarehouseManifestPayload
): Promise<WarehouseManifest> {
  const { manifest, items } = payload

  const { data: existingItems, error: existingItemsError } = await supabase
    .from('warehouse_manifest_items')
    .select('id, warehouse_receipt_id')
    .eq('manifest_id', manifestId)

  if (existingItemsError) {
    throw new Error(existingItemsError.message)
  }

  const existingById = new Map(
    (existingItems || []).map((item) => [item.id as string, item])
  )
  const submittedIds = new Set(items.flatMap((item) => (item.id ? [item.id] : [])))

  for (const item of items) {
    if (!item.customer_id) {
      throw new Error(
        `La partida ${item.line_number} no tiene cliente seleccionado.`
      )
    }

    if (!item.id) {
      await createManifestItemAndReceipt(manifestId, manifest, item)
      continue
    }

    const existingItem = existingById.get(item.id)

    if (!existingItem) {
      throw new Error('Una de las partidas no pertenece a este manifiesto.')
    }

    const { error: itemError } = await supabase
      .from('warehouse_manifest_items')
      .update({
        line_number: item.line_number,
        document_number: item.document_number,
        house_bl: item.house_bl || null,
        container_number: item.container_number || manifest.container_number || null,
        seal_number: item.seal_number || manifest.seal_number || null,
        customer_id: item.customer_id,
        shipper_name: item.shipper_name || null,
        consignee_name: item.consignee_name,
        notify_party_name: item.notify_party_name || null,
        package_quantity: Number(item.package_quantity || 0),
        package_type: item.package_type || 'BULTOS',
        gross_weight_kg: Number(item.gross_weight_kg || 0),
        volume_cbm: Number(item.volume_cbm || 0),
        freight_amount: Number(item.freight_amount || 0),
        cargo_description: item.cargo_description,
        marks_and_numbers: item.marks_and_numbers || null,
        status: item.status,
        notes: item.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)
      .eq('manifest_id', manifestId)

    if (itemError) {
      throw new Error(itemError.message)
    }

    if (existingItem.warehouse_receipt_id) {
      const { error: receiptError } = await supabase
        .from('warehouse_receipts')
        .update({
          customer_id: item.customer_id,
          shipper_name: item.shipper_name || null,
          tracking_number: manifest.manifest_number,
          courier_name: manifest.carrier_name || null,
          external_reference: item.house_bl || manifest.master_bl,
          pieces: Number(item.package_quantity || 0),
          weight_kg: Number(item.gross_weight_kg || 0),
          description: item.cargo_description,
          marks_and_numbers: item.marks_and_numbers || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingItem.warehouse_receipt_id)
        .eq('manifest_id', manifestId)

      if (receiptError) {
        throw new Error(receiptError.message)
      }
    }
  }

  const removedItems = (existingItems || []).filter(
    (item) => !submittedIds.has(item.id as string)
  )

  for (const item of removedItems) {
    if (item.warehouse_receipt_id) {
      const { error: unlinkError } = await supabase
        .from('warehouse_manifest_items')
        .update({ warehouse_receipt_id: null })
        .eq('id', item.id)

      if (unlinkError) throw new Error(unlinkError.message)

      const { error: receiptItemsError } = await supabase
        .from('warehouse_receipt_items')
        .delete()
        .eq('warehouse_receipt_id', item.warehouse_receipt_id)

      if (receiptItemsError) throw new Error(receiptItemsError.message)

      const { error: receiptError } = await supabase
        .from('warehouse_receipts')
        .delete()
        .eq('id', item.warehouse_receipt_id)
        .eq('manifest_id', manifestId)

      if (receiptError) throw new Error(receiptError.message)
    }

    const { error: deleteItemError } = await supabase
      .from('warehouse_manifest_items')
      .delete()
      .eq('id', item.id)
      .eq('manifest_id', manifestId)

    if (deleteItemError) throw new Error(deleteItemError.message)
  }

  const { data: updatedManifest, error: manifestError } = await supabase
    .from('warehouse_manifests')
    .update({
      manifest_number: manifest.manifest_number,
      master_bl: manifest.master_bl,
      carrier_name: manifest.carrier_name || null,
      carrier_identification: manifest.carrier_identification || null,
      agent_name: manifest.agent_name || null,
      customs_administration: manifest.customs_administration || null,
      entry_mode: manifest.entry_mode,
      transfer_type: manifest.transfer_type || null,
      departure_date: manifest.departure_date || null,
      arrival_date: manifest.arrival_date,
      container_number: manifest.container_number || null,
      seal_number: manifest.seal_number || null,
      vehicle_plate: manifest.vehicle_plate || null,
      cargo_label: manifest.cargo_label || null,
      origin: manifest.origin || null,
      destination: manifest.destination || null,
      status: manifest.status,
      notes: manifest.notes || null,
      internal_notes: manifest.internal_notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', manifestId)
    .select('*')
    .single()

  if (manifestError) {
    if (isManifestNumberAndMasterBlConflict(manifestError.message)) {
      throw new Error(
        getManifestDuplicateMessage(manifest.manifest_number, manifest.master_bl)
      )
    }

    throw new Error(manifestError.message)
  }

  return updatedManifest as WarehouseManifest
}
