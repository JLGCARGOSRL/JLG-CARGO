export type ContainerReceptionStatus = 'scheduled'|'at_gate'|'seal_verified'|'unloading'|'with_differences'|'quarantine'|'reconciled'|'closed'|'cancelled'
export type SealStatus = 'pending'|'correct'|'different'|'broken'|'missing'
export type ContainerCondition = 'pending'|'good'|'damaged'|'critical'
export type CargoLineCondition = 'pending'|'good'|'damaged'|'wet'|'open'|'missing'

export type ContainerReceptionItemDraft = {
  manifest_item_id: string|null; warehouse_receipt_id: string|null; customer_id: string|null;
  line_number: number; document_number: string; house_bl: string; customer_name: string;
  cargo_description: string; package_type: string; expected_packages: number;
  received_packages: number; damaged_packages: number; expected_weight_kg: number;
  received_weight_kg: number; condition: CargoLineCondition; location_id: string; notes: string;
}

export type ContainerReceptionForm = {
  manifest_id: string; container_number: string; container_type: string; equipment_owner: string;
  customs_administration: string; transfer_type: string; seal_declared: string; seal_found: string;
  seal_status: SealStatus; exterior_condition: ContainerCondition; has_dents: boolean; has_holes: boolean;
  has_rust: boolean; has_water: boolean; has_door_damage: boolean; temperature_c: string;
  carrier_name: string; driver_name: string; driver_identification: string; driver_phone: string;
  truck_plate: string; chassis_plate: string; gate_number: string; dock_number: string;
  arrived_at: string; unloading_started_at: string; unloading_finished_at: string; departed_at: string;
  reception_operator: string; security_operator: string; unloading_supervisor: string;
  equipment_used: string[]; pallet_quantity: number; incident_notes: string; general_notes: string;
  status: ContainerReceptionStatus;
}

export type ContainerReceptionRecord = ContainerReceptionForm & {
  id: string; receipt_number: string; paper_document_path: string|null; paper_document_name: string|null;
  paper_document_uploaded_at: string|null; created_at: string; updated_at: string;
  warehouse_manifests?: { manifest_number:string; master_bl:string; container_number:string|null }|null;
}

