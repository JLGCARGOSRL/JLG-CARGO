"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Boxes, Container, FileText, Scale } from "lucide-react";

import {
  getManifestById,
  getManifestCustomers,
  getManifestItems,
} from "../../../../lib/services/manifestService";
import type {
  WarehouseManifest,
  WarehouseManifestItem,
} from "../../../../types/manifest";
import {
  WAREHOUSE_MANIFEST_ITEM_STATUS_LABELS,
  WAREHOUSE_MANIFEST_STATUS_LABELS,
} from "../../../../types/manifest";
import type { CustomerOption } from "../../../../types/warehouse";

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("es-DO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
}

function formatNumber(value: number | null | undefined, decimals = 2) {
  return Number(value || 0).toLocaleString("es-DO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function ManifestDetailPage() {
  const id = String(useParams()?.id || "");
  const [manifest, setManifest] = useState<WarehouseManifest | null>(null);
  const [items, setItems] = useState<WarehouseManifestItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;

    Promise.all([
      getManifestById(id),
      getManifestItems(id),
      getManifestCustomers(),
    ])
      .then(([manifestResult, itemResult, customerResult]) => {
        if (!active) return;
        setManifest(manifestResult);
        setItems(itemResult);
        setCustomers(customerResult);
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar el manifiesto."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const customerNames = useMemo(
    () =>
      new Map(
        customers.map((customer) => [
          customer.id,
          customer.company_name || customer.legal_name || "Cliente sin nombre",
        ])
      ),
    [customers]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl rounded-2xl border bg-white p-8 text-slate-500">
        Cargando manifiesto…
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "No se encontró el manifiesto."}
        </div>
        <Link href="/warehouse/manifests" className="font-semibold text-blue-700">
          Volver a manifiestos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/warehouse/manifests"
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-700"
          >
            <ArrowLeft size={16} /> Volver a manifiestos
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-950">
              {manifest.manifest_number}
            </h1>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {WAREHOUSE_MANIFEST_STATUS_LABELS[manifest.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Detalle del manifiesto aduanal y sus BL relacionados.
          </p>
        </div>
        <Link
          href={`/warehouse/manifests/${manifest.id}/edit`}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Editar manifiesto
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={FileText} label="BL registrados" value={String(items.length)} />
        <Metric
          icon={Boxes}
          label="Bultos"
          value={formatNumber(manifest.total_packages, 0)}
        />
        <Metric
          icon={Scale}
          label="Peso total"
          value={`${formatNumber(manifest.total_weight_kg, 3)} kg`}
        />
        <Metric
          icon={Container}
          label="Contenedor"
          value={manifest.container_number || "Sin asignar"}
        />
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-6">
        <h2 className="border-b pb-3 text-lg font-bold text-slate-950">
          Información general
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Info label="Master BL" value={manifest.master_bl} />
          <Info label="Llegada" value={formatDate(manifest.arrival_date)} />
          <Info label="Medio de entrada" value={manifest.entry_mode} />
          <Info label="Tipo de traslado" value={manifest.transfer_type} />
          <Info label="Transportista" value={manifest.carrier_name} />
          <Info label="Agente" value={manifest.agent_name} />
          <Info label="Administración aduanera" value={manifest.customs_administration} />
          <Info label="Sello" value={manifest.seal_number} />
          <Info label="Placa" value={manifest.vehicle_plate} />
          <Info label="Origen" value={manifest.origin} />
          <Info label="Destino" value={manifest.destination} />
          <Info label="Volumen" value={`${formatNumber(manifest.total_volume_cbm, 4)} CBM`} />
        </div>
        {(manifest.notes || manifest.internal_notes) && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Info label="Observaciones" value={manifest.notes} />
            <Info label="Notas internas" value={manifest.internal_notes} />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="font-bold text-slate-950">BL y partidas</h2>
          <p className="text-sm text-slate-500">
            Cada partida conserva el acceso a su recepción física.
          </p>
        </div>
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Línea / documento</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3 text-right">Bultos</th>
                  <th className="p-3 text-right">Peso KG</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Recepción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold">{item.line_number}. {item.document_number}</div>
                      <div className="text-xs text-slate-500">{item.house_bl || "Sin House BL"}</div>
                    </td>
                    <td className="p-3">{customerNames.get(item.customer_id || "") || "Cliente sin nombre"}</td>
                    <td className="p-3"><div className="max-w-sm">{item.cargo_description}</div></td>
                    <td className="p-3 text-right font-semibold">{formatNumber(item.package_quantity, 0)}</td>
                    <td className="p-3 text-right">{formatNumber(item.gross_weight_kg, 3)}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {WAREHOUSE_MANIFEST_ITEM_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="p-3">
                      {item.warehouse_receipt_id ? (
                        <Link
                          href={`/warehouse/receipts/${item.warehouse_receipt_id}`}
                          className="rounded-lg border px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Ver recepción
                        </Link>
                      ) : (
                        <span className="text-xs text-amber-700">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-sm text-slate-500">Este manifiesto no tiene partidas.</div>
        )}
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Boxes; label: string; value: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div className="h-fit rounded-xl bg-blue-50 p-3 text-blue-700"><Icon size={21} /></div>
      <div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-bold text-slate-950">{value}</div></div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value || "-"}</div>
    </div>
  );
}
