import { supabase } from '../supabase/client'
import type { WarehouseManifest, WarehouseManifestItem } from '../../types/manifest'
import type { ContainerReceptionForm, ContainerReceptionItemDraft, ContainerReceptionRecord } from '../../types/containerReception'

function nullable(value:string){ return value.trim() || null }

export async function getContainerReceptionOptions(): Promise<WarehouseManifest[]> {
  const {data,error}=await supabase.from('warehouse_manifests').select('*').not('status','in','(dispatched,cancelled)').order('created_at',{ascending:false})
  if(error) throw new Error(error.message); return (data||[]) as WarehouseManifest[]
}

export async function getContainerManifestItems(manifestId:string): Promise<WarehouseManifestItem[]> {
  const {data,error}=await supabase.from('warehouse_manifest_items').select('*').eq('manifest_id',manifestId).order('line_number')
  if(error) throw new Error(error.message); return (data||[]) as WarehouseManifestItem[]
}

export async function createContainerReception(form:ContainerReceptionForm,items:ContainerReceptionItemDraft[]):Promise<ContainerReceptionRecord>{
  const {data,error}=await supabase.from('warehouse_container_receipts').insert({
    ...form, equipment_owner:nullable(form.equipment_owner), customs_administration:nullable(form.customs_administration),
    transfer_type:nullable(form.transfer_type), seal_declared:nullable(form.seal_declared), seal_found:nullable(form.seal_found),
    temperature_c:form.temperature_c?Number(form.temperature_c):null, carrier_name:nullable(form.carrier_name),
    driver_identification:nullable(form.driver_identification), driver_phone:nullable(form.driver_phone),
    truck_plate:nullable(form.truck_plate), chassis_plate:nullable(form.chassis_plate), gate_number:nullable(form.gate_number),
    dock_number:nullable(form.dock_number), unloading_started_at:form.unloading_started_at||null,
    unloading_finished_at:form.unloading_finished_at||null, departed_at:form.departed_at||null,
    security_operator:nullable(form.security_operator), unloading_supervisor:nullable(form.unloading_supervisor),
    incident_notes:nullable(form.incident_notes), general_notes:nullable(form.general_notes),
  }).select('*').single()
  if(error) throw new Error(error.message)
  const record=data as ContainerReceptionRecord
  const payload=items.map(item=>({...item,container_receipt_id:record.id,location_id:item.location_id||null,manifest_item_id:item.manifest_item_id||null,warehouse_receipt_id:item.warehouse_receipt_id||null,customer_id:item.customer_id||null}))
  const {error:itemError}=await supabase.from('warehouse_container_receipt_items').insert(payload)
  if(itemError){await supabase.from('warehouse_container_receipts').delete().eq('id',record.id);throw new Error(itemError.message)}
  return record
}

export async function getContainerReceptions():Promise<ContainerReceptionRecord[]>{
  const {data,error}=await supabase.from('warehouse_container_receipts').select('*, warehouse_manifests(manifest_number,master_bl,container_number)').order('created_at',{ascending:false})
  if(error) throw new Error(error.message)
  return (data||[]).map(row=>{const r=row as unknown as ContainerReceptionRecord&{warehouse_manifests?:ContainerReceptionRecord['warehouse_manifests'][]|ContainerReceptionRecord['warehouse_manifests']};return {...r,warehouse_manifests:Array.isArray(r.warehouse_manifests)?r.warehouse_manifests[0]||null:r.warehouse_manifests||null}})
}

export async function uploadContainerPaperDocument(receipt:ContainerReceptionRecord,file:File){
  if(file.size>10*1024*1024) throw new Error('El archivo no puede superar 10 MB.')
  const extension=file.name.split('.').pop()?.toLowerCase()||'pdf'; const path=`${receipt.id}/${Date.now()}-formulario-firmado.${extension}`
  const {error:uploadError}=await supabase.storage.from('container-reception-documents').upload(path,file,{upsert:false})
  if(uploadError) throw new Error(uploadError.message)
  const {error}=await supabase.from('warehouse_container_receipts').update({paper_document_path:path,paper_document_name:file.name,paper_document_uploaded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',receipt.id)
  if(error) throw new Error(error.message)
}

export async function openContainerPaperDocument(path:string){
  const {data,error}=await supabase.storage.from('container-reception-documents').createSignedUrl(path,300)
  if(error) throw new Error(error.message); return data.signedUrl
}
