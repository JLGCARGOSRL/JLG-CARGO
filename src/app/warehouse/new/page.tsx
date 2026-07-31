'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  createWarehouseReceipt,
  getActiveCustomers,
  getWarehouseLocations,
} from '../../../lib/services/warehouseService'

import type {
  CustomerOption,
  WarehouseLocation,
  WarehouseReceiptFormData,
} from '../../../types/warehouse'

import {
  CARGO_CONDITION_LABELS,
  WAREHOUSE_STATUS_LABELS,
} from '../../../types/warehouse'

const initialFormData: WarehouseReceiptFormData = {
  customer_id: '',
  shipper_name: '',
  supplier_name: '',
  tracking_number: '',
  courier_name: '',
  external_reference: '',
  pieces: 1,
  weight_kg: 0,
  length_cm: 0,
  width_cm: 0,
  height_cm: 0,
  description: '',
  marks_and_numbers: '',
  cargo_condition: 'unknown',
  has_visible_damage: false,
  damage_notes: '',
  location_id: '',
  status: 'received',
  notes: '',
  internal_notes: '',
}

export default function NewWarehouseReceiptPage() {
  const router = useRouter()

  const [formData, setFormData] = useState<WarehouseReceiptFormData>(initialFormData)
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [locations, setLocations] = useState<WarehouseLocation[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [initialLoading, setInitialLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadOptions() {
      try {
        setInitialLoading(true)

        const [customerData, locationData] = await Promise.all([
          getActiveCustomers(),
          getWarehouseLocations(),
        ])

        if (!mounted) return

        setCustomers(customerData)
        setLocations(locationData)
      } catch (err) {
        if (!mounted) return

        const message =
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los datos iniciales.'

        setError(message)
      } finally {
        if (mounted) {
          setInitialLoading(false)
        }
      }
    }

    loadOptions()

    return () => {
      mounted = false
    }
  }, [])

  function updateField<K extends keyof WarehouseReceiptFormData>(
    key: K,
    value: WarehouseReceiptFormData[K]
  ) {
    setFormData((prev: WarehouseReceiptFormData) => ({
      ...prev,
      [key]: value,
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!formData.customer_id) {
      setError('Debes seleccionar un cliente.')
      return
    }

    if (!formData.description.trim()) {
      setError('Debes escribir la descripción de la mercancía.')
      return
    }

    if (Number(formData.pieces) <= 0) {
      setError('La cantidad de piezas debe ser mayor que cero.')
      return
    }

    if (Number(formData.weight_kg) < 0) {
      setError('El peso no puede ser negativo.')
      return
    }

    try {
      setLoading(true)
      const created = await createWarehouseReceipt(formData)
      router.push(`/warehouse/receipts/${created.id}`)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo crear la recepción de almacén.'

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const calculatedVolume =
    (Number(formData.length_cm || 0) *
      Number(formData.width_cm || 0) *
      Number(formData.height_cm || 0) *
      Math.max(Number(formData.pieces || 1), 1)) /
    1000000

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Recepción de carga suelta
            </h1>
            <p className="text-sm text-slate-500">
              Registra mercancía sin contenedor o fuera de un manifiesto aduanal.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/warehouse')}
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
            Cargando clientes y ubicaciones...
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
          >
            <Section title="Cliente y referencias">
              <Field label="Cliente" required>
                <select
                  value={formData.customer_id}
                  onChange={(event) => updateField('customer_id', event.target.value)}
                  className="input"
                  required
                >
                  <option value="">Seleccionar cliente...</option>
                  {customers.map((customer) => {
                    const customerName =
                      customer.company_name ||
                      customer.legal_name ||
                      'Cliente sin nombre'

                    const label = customer.customer_code
                      ? `${customerName} - ${customer.customer_code}`
                      : customerName

                    return (
                      <option key={customer.id} value={customer.id}>
                        {String(label)}
                      </option>
                    )
                  })}
                </select>
              </Field>

              <Field label="Número de Manifiesto">
  <input
    value={formData.tracking_number}
    onChange={(event) => updateField('tracking_number', event.target.value)}
    placeholder="Ej: MAN-2026-000123"
    className="input"
  />
</Field>

              <Field label="Courier / transportista">
                <input
                  value={formData.courier_name}
                  onChange={(event) => updateField('courier_name', event.target.value)}
                  className="input"
                />
              </Field>

              <Field label="BL / HBL / MBL">
  <input
    value={formData.external_reference}
    onChange={(event) =>
      updateField('external_reference', event.target.value)
    }
    placeholder="Ej: COSU123456789"
    className="input"
  />
</Field>

              <Field label="Shipper">
                <input
                  value={formData.shipper_name}
                  onChange={(event) => updateField('shipper_name', event.target.value)}
                  className="input"
                />
              </Field>

              <Field label="Proveedor">
                <input
                  value={formData.supplier_name}
                  onChange={(event) => updateField('supplier_name', event.target.value)}
                  className="input"
                />
              </Field>
            </Section>

            <Section title="Mercancía y medidas">
              <Field label="Descripción" required wide>
                <textarea
                  value={formData.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  className="input min-h-24"
                  placeholder="Descripción detallada de la mercancía recibida..."
                  required
                />
              </Field>

              <Field label="Piezas" required>
                <input
                  type="number"
                  min="1"
                  value={formData.pieces}
                  onChange={(event) => updateField('pieces', Number(event.target.value))}
                  className="input"
                  required
                />
              </Field>

              <Field label="Peso kg" required>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.weight_kg}
                  onChange={(event) =>
                    updateField('weight_kg', Number(event.target.value))
                  }
                  className="input"
                  required
                />
              </Field>

              <Field label="Largo cm">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.length_cm}
                  onChange={(event) =>
                    updateField('length_cm', Number(event.target.value))
                  }
                  className="input"
                />
              </Field>

              <Field label="Ancho cm">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.width_cm}
                  onChange={(event) =>
                    updateField('width_cm', Number(event.target.value))
                  }
                  className="input"
                />
              </Field>

              <Field label="Alto cm">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.height_cm}
                  onChange={(event) =>
                    updateField('height_cm', Number(event.target.value))
                  }
                  className="input"
                />
              </Field>

              <Field label="Volumen CBM calculado">
                <input
                  value={calculatedVolume.toFixed(4)}
                  className="input bg-slate-50"
                  readOnly
                />
              </Field>

              <Field label="Marcas y números" wide>
                <textarea
                  value={formData.marks_and_numbers}
                  onChange={(event) =>
                    updateField('marks_and_numbers', event.target.value)
                  }
                  className="input min-h-20"
                />
              </Field>
            </Section>

            <Section title="Inspección y estado">
              <Field label="Condición de la carga">
                <select
                  value={formData.cargo_condition}
                  onChange={(event) =>
                    updateField(
                      'cargo_condition',
                      event.target.value as WarehouseReceiptFormData['cargo_condition']
                    )
                  }
                  className="input"
                >
                  {Object.entries(CARGO_CONDITION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {String(label)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Estado operativo">
                <select
                  value={formData.status}
                  onChange={(event) =>
                    updateField(
                      'status',
                      event.target.value as WarehouseReceiptFormData['status']
                    )
                  }
                  className="input"
                >
                  {Object.entries(WAREHOUSE_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {String(label)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Ubicación inicial">
                <select
                  value={formData.location_id}
                  onChange={(event) => updateField('location_id', event.target.value)}
                  className="input"
                >
                  <option value="">Sin asignar</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {String(location.code)}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.has_visible_damage}
                    onChange={(event) =>
                      updateField('has_visible_damage', event.target.checked)
                    }
                  />
                  Tiene daño visible
                </label>
              </div>

              <Field label="Notas de daño" wide>
                <textarea
                  value={formData.damage_notes}
                  onChange={(event) => updateField('damage_notes', event.target.value)}
                  className="input min-h-20"
                />
              </Field>
            </Section>

            <Section title="Notas internas">
              <Field label="Notas al cliente / operativas" wide>
                <textarea
                  value={formData.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  className="input min-h-20"
                />
              </Field>

              <Field label="Notas internas" wide>
                <textarea
                  value={formData.internal_notes}
                  onChange={(event) =>
                    updateField('internal_notes', event.target.value)
                  }
                  className="input min-h-20"
                />
              </Field>
            </Section>

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                type="button"
                onClick={() => router.push('/warehouse')}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Crear recepción'}
              </button>
            </div>
          </form>
        )}
      </div>

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

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-lg font-semibold text-slate-900">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string
  required?: boolean
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`space-y-1 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  )
}
