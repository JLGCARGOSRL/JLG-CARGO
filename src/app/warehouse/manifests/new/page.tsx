'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'

import {
  createManifest,
  createManifestCustomer,
  getManifestById,
  getManifestCustomers,
  getManifestItems,
  updateManifest,
} from '../../../../lib/services/manifestService'

import type {
  ManifestTransferType,
  WarehouseManifestFormData,
  WarehouseManifestItemFormData,
} from '../../../../types/manifest'

import type { CustomerOption } from '../../../../types/warehouse'

type ManifestItemDraft = WarehouseManifestItemFormData & {
  local_id: string
  database_id?: string
  customer_search: string
}

type CustomerModalData = {
  company_name: string
  tax_id: string
  contact_name: string
  email: string
  phone: string
}

const DOMINICAN_CUSTOMS_ADMINISTRATIONS = [
  'ADMINISTRACION HAINA ORIENTAL',
  'ADMINISTRACION HAINA OCCIDENTAL',
  'ADMINISTRACION MULTIMODAL CAUCEDO',
  'ADMINISTRACION PUERTO PLATA',
  'ADMINISTRACION MANZANILLO',
  'ADMINISTRACION SAMANA',
  'ADMINISTRACION LA ROMANA',
  'ADMINISTRACION SANTO DOMINGO',
  'ADMINISTRACION AEROPUERTO LAS AMERICAS',
  'ADMINISTRACION AEROPUERTO CIBAO',
  'ADMINISTRACION AEROPUERTO PUNTA CANA',
  'OTRA',
]

const initialManifestData: WarehouseManifestFormData = {
  manifest_number: '',
  master_bl: '',

  carrier_name: '',
  carrier_identification: '',
  agent_name: '',
  customs_administration: '',

  entry_mode: 'Marítimo',
  transfer_type: 'Celador',

  departure_date: '',
  arrival_date: '',

  container_number: '',
  seal_number: '',
  vehicle_plate: '',
  cargo_label: '',

  origin: '',
  destination: '',

  status: 'open',

  notes: '',
  internal_notes: '',
}

const initialCustomerModalData: CustomerModalData = {
  company_name: '',
  tax_id: '',
  contact_name: '',
  email: '',
  phone: '',
}

function createEmptyItem(lineNumber: number): ManifestItemDraft {
  return {
    local_id: crypto.randomUUID(),
    line_number: lineNumber,

    document_number: '',
    house_bl: '',
    container_number: '',
    seal_number: '',

    customer_id: '',
    customer_search: '',

    shipper_name: '',
    consignee_name: '',
    notify_party_name: '',

    package_quantity: 0,
    package_type: 'BULTOS',

    gross_weight_kg: 0,
    volume_cbm: 0,
    freight_amount: 0,

    cargo_description: '',
    marks_and_numbers: '',

    status: 'pending',

    notes: '',
  }
}

function toManifestItemFormData(
  item: ManifestItemDraft
): WarehouseManifestItemFormData {
  return {
    line_number: item.line_number,
    document_number: item.document_number,
    house_bl: item.house_bl,
    container_number: item.container_number,
    seal_number: item.seal_number,
    customer_id: item.customer_id,
    shipper_name: item.shipper_name,
    consignee_name: item.consignee_name,
    notify_party_name: item.notify_party_name,
    package_quantity: item.package_quantity,
    package_type: item.package_type,
    gross_weight_kg: item.gross_weight_kg,
    volume_cbm: item.volume_cbm,
    freight_amount: item.freight_amount,
    cargo_description: item.cargo_description,
    marks_and_numbers: item.marks_and_numbers,
    status: item.status,
    notes: item.notes,
  }
}

function getCustomerName(customer: CustomerOption) {
  return customer.company_name || customer.legal_name || 'Cliente sin nombre'
}

function getCustomerLabel(customer: CustomerOption) {
  const name = getCustomerName(customer)
  const taxId = 'tax_id' in customer && customer.tax_id ? ` | RNC: ${customer.tax_id}` : ''
  return customer.customer_code ? `${name} - ${customer.customer_code}${taxId}` : `${name}${taxId}`
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
}

export default function ManifestFormPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const manifestId = pathname.endsWith('/edit') ? params.id : undefined
  const isEditing = Boolean(manifestId)

  const [activeTab, setActiveTab] =
    useState<'manifest' | 'transport' | 'items' | 'notes'>('manifest')

  const [manifestData, setManifestData] =
    useState<WarehouseManifestFormData>(initialManifestData)

  const [items, setItems] = useState<ManifestItemDraft[]>([createEmptyItem(1)])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [customersRefreshing, setCustomersRefreshing] = useState(false)
  const [openCustomerSearchId, setOpenCustomerSearchId] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [customerModalTargetId, setCustomerModalTargetId] = useState<string | null>(null)
  const [customerModalData, setCustomerModalData] =
    useState<CustomerModalData>(initialCustomerModalData)
  const [customerModalError, setCustomerModalError] = useState<string | null>(null)
  const [customerModalLoading, setCustomerModalLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadInitialData() {
      try {
        setInitialLoading(true)
        const [customerData, manifestRecord, manifestItems] = await Promise.all([
          getManifestCustomers(),
          manifestId ? getManifestById(manifestId) : Promise.resolve(null),
          manifestId ? getManifestItems(manifestId) : Promise.resolve([]),
        ])

        if (!mounted) return

        setCustomers(customerData)

        if (manifestId) {
          if (!manifestRecord) {
            throw new Error('No se encontró el manifiesto solicitado.')
          }

          setManifestData({
            manifest_number: manifestRecord.manifest_number || '',
            master_bl: manifestRecord.master_bl || '',
            carrier_name: manifestRecord.carrier_name || '',
            carrier_identification:
              manifestRecord.carrier_identification || '',
            agent_name: manifestRecord.agent_name || '',
            customs_administration:
              manifestRecord.customs_administration || '',
            entry_mode:
              manifestRecord.entry_mode as WarehouseManifestFormData['entry_mode'],
            transfer_type:
              (manifestRecord.transfer_type ||
                'Celador') as WarehouseManifestFormData['transfer_type'],
            departure_date: manifestRecord.departure_date?.slice(0, 10) || '',
            arrival_date: manifestRecord.arrival_date?.slice(0, 10) || '',
            container_number: manifestRecord.container_number || '',
            seal_number: manifestRecord.seal_number || '',
            vehicle_plate: manifestRecord.vehicle_plate || '',
            cargo_label: manifestRecord.cargo_label || '',
            origin: manifestRecord.origin || '',
            destination: manifestRecord.destination || '',
            status: manifestRecord.status,
            notes: manifestRecord.notes || '',
            internal_notes: manifestRecord.internal_notes || '',
          })

          setItems(
            manifestItems.map((item) => {
              const customer = customerData.find(
                (option) => option.id === item.customer_id
              )

              return {
                local_id: crypto.randomUUID(),
                database_id: item.id,
                line_number: item.line_number,
                document_number: item.document_number || '',
                house_bl: item.house_bl || '',
                container_number: item.container_number || '',
                seal_number: item.seal_number || '',
                customer_id: item.customer_id || '',
                customer_search: customer ? getCustomerLabel(customer) : '',
                shipper_name: item.shipper_name || '',
                consignee_name: item.consignee_name || '',
                notify_party_name: item.notify_party_name || '',
                package_quantity: Number(item.package_quantity || 0),
                package_type: item.package_type || 'BULTOS',
                gross_weight_kg: Number(item.gross_weight_kg || 0),
                volume_cbm: Number(item.volume_cbm || 0),
                freight_amount: Number(item.freight_amount || 0),
                cargo_description: item.cargo_description || '',
                marks_and_numbers: item.marks_and_numbers || '',
                status: item.status,
                notes: item.notes || '',
              }
            })
          )
        }
      } catch (err) {
        if (!mounted) return

        const message =
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los datos del manifiesto.'

        setError(message)
      } finally {
        if (mounted) {
          setInitialLoading(false)
        }
      }
    }

    loadInitialData()

    return () => {
      mounted = false
    }
  }, [manifestId])

  useEffect(() => {
    let mounted = true

    async function refreshCustomersSilently() {
      try {
        const customerData = await getManifestCustomers()

        if (!mounted) return

        setCustomers(customerData)
        setItems((prevItems) =>
          prevItems.map((item) => {
            if (!item.customer_id) return item

            const customer = customerData.find(
              (option) => option.id === item.customer_id
            )

            if (!customer) return item

            return {
              ...item,
              customer_search: getCustomerLabel(customer),
            }
          })
        )
      } catch {
        // La carga inicial conserva el mensaje de error principal. Una
        // actualización en segundo plano no debe interrumpir el formulario.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshCustomersSilently()
      }
    }

    window.addEventListener('focus', refreshCustomersSilently)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      window.removeEventListener('focus', refreshCustomersSilently)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.packages += Number(item.package_quantity || 0)
        acc.weight += Number(item.gross_weight_kg || 0)
        acc.cbm += Number(item.volume_cbm || 0)
        return acc
      },
      {
        packages: 0,
        weight: 0,
        cbm: 0,
      }
    )
  }, [items])

  function updateManifestField<K extends keyof WarehouseManifestFormData>(
    key: K,
    value: WarehouseManifestFormData[K]
  ) {
    setManifestData((prev: WarehouseManifestFormData) => ({
      ...prev,
      [key]: value,
    }))
  }

  function updateItemField<K extends keyof ManifestItemDraft>(
    localId: string,
    key: K,
    value: ManifestItemDraft[K]
  ) {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.local_id === localId
          ? {
              ...item,
              [key]: value,
            }
          : item
      )
    )
  }

  function handleCustomerSearch(localId: string, value: string) {
    setOpenCustomerSearchId(localId)
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.local_id === localId
          ? {
              ...item,
              customer_search: value,
              customer_id: '',
              consignee_name: '',
              notify_party_name: '',
            }
          : item
      )
    )
  }

  function applyCustomerSelection(
    localId: string,
    selectedCustomer?: CustomerOption
  ) {
    const customerName = selectedCustomer
      ? getCustomerName(selectedCustomer)
      : ''

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.local_id === localId
          ? {
              ...item,
              customer_id: selectedCustomer?.id || '',
              customer_search: selectedCustomer
                ? getCustomerLabel(selectedCustomer)
                : '',
              consignee_name: customerName,
              notify_party_name: customerName,
            }
          : item
      )
    )
  }

  function handleCustomerSelect(localId: string, customerId: string) {
    const selectedCustomer = customers.find((customer) => customer.id === customerId)
    applyCustomerSelection(localId, selectedCustomer)
    setOpenCustomerSearchId(null)
  }

  async function refreshCustomers() {
    try {
      setCustomersRefreshing(true)
      setError(null)

      const customerData = await getManifestCustomers()
      setCustomers(customerData)

      setItems((prevItems) =>
        prevItems.map((item) => {
          if (!item.customer_id) return item

          const customer = customerData.find(
            (option) => option.id === item.customer_id
          )

          if (!customer) return item

          return {
            ...item,
            customer_search: getCustomerLabel(customer),
          }
        })
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la lista de clientes.'
      )
    } finally {
      setCustomersRefreshing(false)
    }
  }

  function getFilteredCustomers(searchValue: string) {
    const search = normalize(searchValue.trim())

    if (!search) {
      return customers.slice(0, 8)
    }

    return customers
      .filter((customer) => {
        const value = normalize(
          [
            customer.company_name,
            customer.legal_name,
            customer.customer_code,
            'tax_id' in customer ? customer.tax_id : '',
          ]
            .filter(Boolean)
            .join(' ')
        )

        return value.includes(search)
      })
      .slice(0, 12)
  }

  function addItem() {
    setItems((prevItems) => [
      ...prevItems,
      createEmptyItem(prevItems.length + 1),
    ])
  }

  function removeItem(localId: string) {
    setItems((prevItems) => {
      const filtered = prevItems.filter((item) => item.local_id !== localId)

      if (filtered.length === 0) {
        return [createEmptyItem(1)]
      }

      return filtered.map((item, index) => ({
        ...item,
        line_number: index + 1,
      }))
    })
  }

  function openCustomerModal(localId: string) {
    setCustomerModalTargetId(localId)
    setCustomerModalData(initialCustomerModalData)
    setCustomerModalError(null)
    setCustomerModalOpen(true)
  }

  function updateCustomerModalField<K extends keyof CustomerModalData>(
    key: K,
    value: CustomerModalData[K]
  ) {
    setCustomerModalData((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  async function handleCreateCustomer() {
    setCustomerModalError(null)

    if (!customerModalData.company_name.trim()) {
      setCustomerModalError('Debes indicar el nombre del cliente.')
      return
    }

    if (!customerModalData.tax_id.trim()) {
      setCustomerModalError('Debes indicar el RNC.')
      return
    }

    const duplicate = customers.find(
      (customer) =>
        'tax_id' in customer &&
        customer.tax_id &&
        customer.tax_id.trim() === customerModalData.tax_id.trim()
    )

    if (duplicate) {
      setCustomerModalError(`Ya existe un cliente con ese RNC: ${customerModalData.tax_id}`)
      return
    }

    try {
      setCustomerModalLoading(true)

      const createdCustomer = await createManifestCustomer(customerModalData)
      setCustomers((prev) => [...prev, createdCustomer])

      if (customerModalTargetId) {
        applyCustomerSelection(customerModalTargetId, createdCustomer)
      }

      setCustomerModalOpen(false)
      setCustomerModalTargetId(null)
      setCustomerModalData(initialCustomerModalData)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo crear el cliente.'

      setCustomerModalError(message)
    } finally {
      setCustomerModalLoading(false)
    }
  }

  function validateForm(): string | null {
    if (!manifestData.manifest_number.trim()) {
      return 'Debes indicar el número de manifiesto.'
    }

    if (!manifestData.master_bl.trim()) {
      return 'Debes indicar el Master B/L.'
    }

    if (!manifestData.customs_administration.trim()) {
      return 'Debes indicar la administración aduanal.'
    }

    if (!manifestData.container_number.trim()) {
      return 'Debes indicar el número de contenedor.'
    }

    if (!manifestData.arrival_date) {
      return 'Debes indicar la fecha de llegada.'
    }

    if (!manifestData.carrier_name.trim()) {
      return 'Debes indicar el transportista.'
    }

    if (!manifestData.vehicle_plate.trim()) {
      return 'Debes indicar la placa.'
    }

    if (items.length === 0) {
      return 'Debes agregar al menos un cliente al manifiesto.'
    }

    const documentLines = new Map<string, number>()

    for (const item of items) {
      if (!item.document_number.trim()) {
        return `El cliente ${item.line_number} no tiene documento de embarque.`
      }

      const normalizedDocument = item.document_number.trim().toLocaleLowerCase()
      const duplicateLine = documentLines.get(normalizedDocument)

      if (duplicateLine !== undefined) {
        return `El documento ${item.document_number.trim()} esta repetido en las partidas ${duplicateLine} y ${item.line_number}. Cada documento debe ser unico dentro del manifiesto.`
      }

      documentLines.set(normalizedDocument, item.line_number)

      if (!item.customer_id) {
        return `El cliente ${item.line_number} no tiene cliente seleccionado.`
      }

      if (!item.consignee_name.trim()) {
        return `El cliente ${item.line_number} no tiene consignatario.`
      }

      if (Number(item.package_quantity) <= 0) {
        return `El cliente ${item.line_number} debe tener bultos mayores que cero.`
      }

      if (Number(item.gross_weight_kg) < 0) {
        return `El cliente ${item.line_number} no puede tener peso negativo.`
      }

      if (!item.cargo_description.trim()) {
        return `El cliente ${item.line_number} no tiene descripción de mercancía.`
      }
    }

    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const validationError = validateForm()

    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setLoading(true)

      const manifest = manifestId
        ? await updateManifest(manifestId, {
            manifest: manifestData,
            items: items.map((item) => ({
              ...toManifestItemFormData(item),
              id: item.database_id,
            })),
          })
        : await createManifest({
            manifest: manifestData,
            items: items.map(toManifestItemFormData),
          })

      router.push(
        manifestId
          ? '/warehouse/manifests'
          : `/warehouse/manifests/${manifest.id}`
      )
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `No se pudo ${isEditing ? 'actualizar' : 'guardar'} el manifiesto.`

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const tabButtonClass = (tab: typeof activeTab) =>
    activeTab === tab
      ? 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white'
      : 'rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {isEditing ? 'Editar manifiesto' : 'Entrada de manifiesto'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isEditing
                ? 'Corrige los datos del manifiesto y sus clientes asociados.'
                : 'Selecciona clientes existentes o créalos desde esta pantalla. El RNC evita duplicados.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/warehouse/manifests')}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Volver
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {initialLoading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500 shadow-sm">
            {isEditing ? 'Cargando manifiesto...' : 'Cargando clientes...'}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-4 shadow-sm">
              <button type="button" onClick={() => setActiveTab('manifest')} className={tabButtonClass('manifest')}>
                1. Manifiesto
              </button>
              <button type="button" onClick={() => setActiveTab('transport')} className={tabButtonClass('transport')}>
                2. Transporte / Traslado
              </button>
              <button type="button" onClick={() => setActiveTab('items')} className={tabButtonClass('items')}>
                3. Clientes
              </button>
              <button type="button" onClick={() => setActiveTab('notes')} className={tabButtonClass('notes')}>
                4. Observaciones
              </button>
            </div>

            {activeTab === 'manifest' && (
              <section className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm">
                <SectionTitle title="Datos del manifiesto" />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Número de manifiesto" required>
                    <input
                      value={manifestData.manifest_number}
                      onChange={(event) => updateManifestField('manifest_number', event.target.value)}
                      placeholder="Ej: IGMM2026041308"
                      className="input"
                      required
                    />
                  </Field>

                  <Field label="Master B/L" required>
                    <input
                      value={manifestData.master_bl}
                      onChange={(event) => updateManifestField('master_bl', event.target.value)}
                      placeholder="Ej: SMLU9033866A002"
                      className="input"
                      required
                    />
                  </Field>

                  <Field label="Administración aduanal" required>
                    <select
                      value={manifestData.customs_administration}
                      onChange={(event) => updateManifestField('customs_administration', event.target.value)}
                      className="input"
                      required
                    >
                      <option value="">Seleccionar administración...</option>
                      {DOMINICAN_CUSTOMS_ADMINISTRATIONS.map((admin) => (
                        <option key={admin} value={admin}>
                          {admin}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Fecha de llegada" required>
                    <input
                      type="date"
                      value={manifestData.arrival_date}
                      onChange={(event) => updateManifestField('arrival_date', event.target.value)}
                      className="input"
                      required
                    />
                  </Field>

                  <Field label="Número de contenedor" required>
                    <input
                      value={manifestData.container_number}
                      onChange={(event) => updateManifestField('container_number', event.target.value)}
                      placeholder="Ej: SMLU8509856"
                      className="input"
                      required
                    />
                  </Field>

                  <Field label="Vía de ingreso">
                    <select
                      value={manifestData.entry_mode}
                      onChange={(event) =>
                        updateManifestField(
                          'entry_mode',
                          event.target.value as WarehouseManifestFormData['entry_mode']
                        )
                      }
                      className="input"
                    >
                      <option value="Marítimo">Marítimo</option>
                      <option value="Aéreo">Aéreo</option>
                      <option value="Terrestre">Terrestre</option>
                      <option value="Courier">Courier</option>
                    </select>
                  </Field>
                </div>
              </section>
            )}

            {activeTab === 'transport' && (
              <section className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm">
                <SectionTitle title="Transporte y traslado" />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Transportista" required>
                    <input
                      value={manifestData.carrier_name}
                      onChange={(event) => updateManifestField('carrier_name', event.target.value)}
                      placeholder="Ej: SEADOM SAS"
                      className="input"
                      required
                    />
                  </Field>

                  <Field label="Cédula del transportista">
                    <input
                      value={manifestData.carrier_identification}
                      onChange={(event) => updateManifestField('carrier_identification', event.target.value)}
                      placeholder="Ej: 001-0000000-0"
                      className="input"
                    />
                  </Field>

                  <Field label="Agente">
                    <input
                      value={manifestData.agent_name}
                      onChange={(event) => updateManifestField('agent_name', event.target.value)}
                      placeholder="Ej: DXT DOMINICANA SRL"
                      className="input"
                    />
                  </Field>

                  <Field label="Placa" required>
                    <input
                      value={manifestData.vehicle_plate}
                      onChange={(event) => updateManifestField('vehicle_plate', event.target.value)}
                      placeholder="Ej: L123456"
                      className="input"
                      required
                    />
                  </Field>

                  <Field label="Rótulo">
                    <input
                      value={manifestData.cargo_label}
                      onChange={(event) => updateManifestField('cargo_label', event.target.value)}
                      placeholder="Ej: RT-2026-001"
                      className="input"
                    />
                  </Field>

                  <Field label="Tipo de traslado">
                    <select
                      value={manifestData.transfer_type}
                      onChange={(event) =>
                        updateManifestField(
                          'transfer_type',
                          event.target.value as ManifestTransferType
                        )
                      }
                      className="input"
                    >
                      <option value="Celador">Celador</option>
                      <option value="Sello Electrónico">Sello Electrónico</option>
                      <option value="Sello Naviera">Sello Naviera</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </Field>

                  <Field label="Número de sello">
                    <input
                      value={manifestData.seal_number}
                      onChange={(event) => updateManifestField('seal_number', event.target.value)}
                      placeholder="Ej: G3972225"
                      className="input"
                    />
                  </Field>
                </div>
              </section>
            )}

            {activeTab === 'items' && (
              <section className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <SectionTitle title="Clientes del manifiesto" />
                    <p className="mt-1 text-sm text-slate-500">
                      Busca clientes existentes por nombre, código o RNC. Si no existe, créalo sin duplicar RNC.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={refreshCustomers}
                      disabled={customersRefreshing}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {customersRefreshing
                        ? 'Actualizando...'
                        : 'Actualizar clientes'}
                    </button>
                    <button
                      type="button"
                      onClick={addItem}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                    >
                      + Agregar cliente
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                  <table className="min-w-[1350px] w-full border-collapse text-sm">
                    <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                      <tr>
                        <th className="border-b px-3 py-3">#</th>
                        <th className="border-b px-3 py-3">Doc. Embarque</th>
                        <th className="border-b px-3 py-3">Buscar cliente</th>
                        <th className="border-b px-3 py-3">Cliente seleccionado</th>
                        <th className="border-b px-3 py-3">Bultos</th>
                        <th className="border-b px-3 py-3">Peso KG</th>
                        <th className="border-b px-3 py-3">CBM</th>
                        <th className="border-b px-3 py-3">Descripción</th>
                        <th className="border-b px-3 py-3">Acción</th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map((item) => {
                        const filteredCustomers = getFilteredCustomers(item.customer_search)
                        const selectedCustomer = customers.find(
                          (customer) => customer.id === item.customer_id
                        )
                        const customerSearchOpen =
                          openCustomerSearchId === item.local_id

                        return (
                          <tr key={item.local_id} className="align-top">
                            <td className="border-b px-3 py-3 text-slate-500">
                              {item.line_number}
                            </td>

                            <td className="border-b px-3 py-3">
                              <input
                                value={item.document_number}
                                onChange={(event) =>
                                  updateItemField(item.local_id, 'document_number', event.target.value)
                                }
                                placeholder="Ej: JLG9033866A01"
                                className="input"
                              />
                            </td>

                            <td className="border-b px-3 py-3">
                              <div
                                className="min-w-[360px] space-y-2"
                                onBlur={(event) => {
                                  const nextTarget = event.relatedTarget

                                  if (
                                    !(nextTarget instanceof Node) ||
                                    !event.currentTarget.contains(nextTarget)
                                  ) {
                                    setOpenCustomerSearchId(null)
                                  }
                                }}
                              >
                                <div className="relative">
                                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                                    ⌕
                                  </span>
                                  <input
                                    value={item.customer_search}
                                    onFocus={() => setOpenCustomerSearchId(item.local_id)}
                                    onChange={(event) =>
                                      handleCustomerSearch(item.local_id, event.target.value)
                                    }
                                    placeholder="Nombre, código o RNC..."
                                    autoComplete="off"
                                    role="combobox"
                                    aria-expanded={customerSearchOpen}
                                    aria-controls={`customer-results-${item.local_id}`}
                                    className="input pl-9 pr-10"
                                  />
                                  {item.customer_search && (
                                    <button
                                      type="button"
                                      onClick={() => handleCustomerSearch(item.local_id, '')}
                                      className="absolute inset-y-0 right-2 my-auto h-7 rounded-lg px-2 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                      aria-label="Limpiar búsqueda de cliente"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>

                                {customerSearchOpen && (
                                  <div
                                    id={`customer-results-${item.local_id}`}
                                    role="listbox"
                                    className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                                  >
                                    <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                      {item.customer_search.trim()
                                        ? 'Coincidencias encontradas'
                                        : 'Clientes recientes'}
                                    </div>

                                    {filteredCustomers.length > 0 ? (
                                      filteredCustomers.map((customer) => {
                                        const customerName = getCustomerName(customer)
                                        const taxId =
                                          'tax_id' in customer
                                            ? customer.tax_id
                                            : null

                                        return (
                                          <button
                                            key={customer.id}
                                            type="button"
                                            role="option"
                                            aria-selected={customer.id === item.customer_id}
                                            onClick={() =>
                                              handleCustomerSelect(
                                                item.local_id,
                                                customer.id
                                              )
                                            }
                                            className={`block w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                                              customer.id === item.customer_id
                                                ? 'bg-blue-50 text-blue-900'
                                                : 'text-slate-700 hover:bg-slate-100'
                                            }`}
                                          >
                                            <span className="block text-sm font-bold">
                                              {customerName}
                                            </span>
                                            <span className="mt-0.5 block text-xs text-slate-500">
                                              {customer.customer_code || 'Sin código'}
                                              {taxId ? ` · RNC ${taxId}` : ''}
                                            </span>
                                          </button>
                                        )
                                      })
                                    ) : (
                                      <div className="px-3 py-4 text-center text-sm text-slate-500">
                                        No encontramos clientes con esa búsqueda.
                                      </div>
                                    )}

                                    <div className="border-t border-slate-100 px-2 pt-2 text-xs text-slate-500">
                                      Mostrando hasta 12 resultados. Escribe más datos para precisar la búsqueda.
                                    </div>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openCustomerModal(item.local_id)}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  + Crear cliente
                                </button>
                              </div>
                            </td>

                            <td className="border-b px-3 py-3">
                              {selectedCustomer ? (
                                <div className="min-w-[250px] rounded-xl border border-blue-200 bg-blue-50 p-3">
                                  <div className="text-sm font-bold text-blue-950">
                                    {getCustomerName(selectedCustomer)}
                                  </div>
                                  <div className="mt-1 text-xs text-blue-700">
                                    {selectedCustomer.customer_code || 'Sin código'}
                                    {'tax_id' in selectedCustomer &&
                                    selectedCustomer.tax_id
                                      ? ` · RNC ${selectedCustomer.tax_id}`
                                      : ''}
                                  </div>
                                  <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                                    Cliente vinculado
                                  </div>
                                </div>
                              ) : (
                                <div className="min-w-[250px] rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
                                  Busca y selecciona un cliente.
                                </div>
                              )}
                            </td>

                            <td className="border-b px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.package_quantity}
                                onChange={(event) =>
                                  updateItemField(item.local_id, 'package_quantity', Number(event.target.value))
                                }
                                className="input"
                              />
                            </td>

                            <td className="border-b px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={item.gross_weight_kg}
                                onChange={(event) =>
                                  updateItemField(item.local_id, 'gross_weight_kg', Number(event.target.value))
                                }
                                className="input"
                              />
                            </td>

                            <td className="border-b px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.0001"
                                value={item.volume_cbm}
                                onChange={(event) =>
                                  updateItemField(item.local_id, 'volume_cbm', Number(event.target.value))
                                }
                                className="input"
                              />
                            </td>

                            <td className="border-b px-3 py-3">
                              <textarea
                                value={item.cargo_description}
                                onChange={(event) =>
                                  updateItemField(item.local_id, 'cargo_description', event.target.value)
                                }
                                placeholder="Ej: Q.D.C. ARTÍCULOS PARA EL HOGAR"
                                className="input min-h-20"
                              />
                            </td>

                            <td className="border-b px-3 py-3">
                              <button
                                type="button"
                                onClick={() => removeItem(item.local_id)}
                                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <TotalCard label="Total bultos" value={totals.packages.toFixed(2)} />
                  <TotalCard label="Total peso KG" value={totals.weight.toFixed(3)} />
                  <TotalCard label="Total CBM" value={totals.cbm.toFixed(4)} />
                </div>
              </section>
            )}

            {activeTab === 'notes' && (
              <section className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm">
                <SectionTitle title="Observaciones" />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Notas operativas">
                    <textarea
                      value={manifestData.notes}
                      onChange={(event) => updateManifestField('notes', event.target.value)}
                      placeholder="Observaciones visibles del manifiesto..."
                      className="input min-h-28"
                    />
                  </Field>

                  <Field label="Notas internas">
                    <textarea
                      value={manifestData.internal_notes}
                      onChange={(event) => updateManifestField('internal_notes', event.target.value)}
                      placeholder="Notas internas de operación..."
                      className="input min-h-28"
                    />
                  </Field>
                </div>
              </section>
            )}

            <div className="flex justify-end gap-3 rounded-2xl border bg-white p-6 shadow-sm">
              <button
                type="button"
                onClick={() => router.push('/warehouse/manifests')}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {loading
                  ? 'Guardando...'
                  : isEditing
                    ? 'Guardar correcciones'
                    : 'Guardar manifiesto y crear WR'}
              </button>
            </div>
          </form>
        )}
      </div>

      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Crear cliente</h2>
              <p className="text-sm text-slate-500">
                El RNC no puede repetirse. Si ya existe, el sistema no permitirá duplicarlo.
              </p>
            </div>

            {customerModalError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {customerModalError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre / Razón social" required>
                <input
                  value={customerModalData.company_name}
                  onChange={(event) =>
                    updateCustomerModalField('company_name', event.target.value)
                  }
                  className="input"
                  placeholder="Ej: MODATEX SRL"
                />
              </Field>

              <Field label="RNC" required>
                <input
                  value={customerModalData.tax_id}
                  onChange={(event) =>
                    updateCustomerModalField('tax_id', event.target.value)
                  }
                  className="input"
                  placeholder="Ej: 131234567"
                />
              </Field>

              <Field label="Contacto">
                <input
                  value={customerModalData.contact_name}
                  onChange={(event) =>
                    updateCustomerModalField('contact_name', event.target.value)
                  }
                  className="input"
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={customerModalData.email}
                  onChange={(event) =>
                    updateCustomerModalField('email', event.target.value)
                  }
                  className="input"
                />
              </Field>

              <Field label="Teléfono">
                <input
                  value={customerModalData.phone}
                  onChange={(event) =>
                    updateCustomerModalField('phone', event.target.value)
                  }
                  className="input"
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={customerModalLoading}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {customerModalLoading ? 'Creando...' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(203 213 225);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          background: white;
        }

        .input:focus {
          box-shadow: 0 0 0 2px rgb(203 213 225);
        }
      `}</style>
    </main>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="border-b pb-2 text-lg font-semibold text-slate-900">
      {title}
    </h2>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  )
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
