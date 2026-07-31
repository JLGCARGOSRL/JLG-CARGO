"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Boxes, CircleDollarSign, ClipboardCheck, Container, FileText, MapPin, PackageCheck, Scale, ShieldCheck } from "lucide-react";
import { getWarehouseDashboard, type WarehouseDashboardData } from "../../lib/services/warehouseOperationsService";

const initial: WarehouseDashboardData = { manifests: 0, receipts: 0, pendingInspection: 0, available: 0, customsPending: 0, dispatched: 0, withoutLocation: 0, piecesInStock: 0, weightInStock: 0, locations: 0, recentReceipts: [] };
const format = (value: number, decimals = 0) => value.toLocaleString("es-DO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const customerName = (row: WarehouseDashboardData["recentReceipts"][number]) => row.customers?.company_name || row.customers?.legal_name || "Cliente sin nombre";

export default function DashboardPage() {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { getWarehouseDashboard().then(setData).catch((err) => setError(err instanceof Error ? err.message : "No fue posible cargar el panel.")).finally(() => setLoading(false)); }, []);

  return (
    <div className="mx-auto max-w-[1500px] space-y-7">
      <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="mb-3 inline-flex rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300">Centro de control operativo</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Operación logística en tiempo real</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Flujo controlado desde el manifiesto hasta la facturación y despacho, incluyendo recepción, inspección, almacenaje y verificación de Aduanas.</p></div>
          <div className="flex flex-wrap gap-2"><Quick href="/warehouse/manifests/new" label="Nuevo manifiesto" /><Quick href="/warehouse/receipts/check-in" label="Dar entrada" primary /><Quick href="/warehouse/customs-verification" label="Verificar Aduanas" /></div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="rounded-2xl border bg-white p-8 text-slate-500">Cargando indicadores operativos…</div> : <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Container} label="Manifiestos" value={format(data.manifests)} detail={`${data.receipts} BL recibidos`} tone="blue" />
          <Metric icon={Boxes} label="Bultos en almacén" value={format(data.piecesInStock)} detail={`${format(data.weightInStock, 2)} kg bajo custodia`} tone="cyan" />
          <Metric icon={ClipboardCheck} label="Pendientes de inspección" value={format(data.pendingInspection)} detail="Requieren control operativo" tone={data.pendingInspection ? "amber" : "emerald"} />
          <Metric icon={PackageCheck} label="Despachos completados" value={format(data.dispatched)} detail={`${data.available} BL disponibles`} tone="emerald" />
        </section>

        {(data.withoutLocation > 0 || data.locations === 0) && <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-amber-600" /><div><h2 className="font-bold text-amber-950">Atención de inventario</h2><p className="mt-1 text-sm text-amber-800">{data.locations === 0 ? "No existen ubicaciones configuradas. Cree zonas, racks y posiciones para controlar el almacenaje." : `${data.withoutLocation} recepciones activas todavía no tienen ubicación asignada.`}</p></div></div><Link href="/warehouse/inventory" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white">Resolver ahora <ArrowRight size={16} /></Link></section>}

        <section className="grid gap-6 xl:grid-cols-[1.45fr_.75fr]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold text-slate-950">Actividad reciente</h2><p className="text-sm text-slate-500">Últimas recepciones registradas</p></div><Link href="/warehouse/receipts" className="text-sm font-semibold text-blue-700">Ver todas</Link></div>
            <div className="divide-y">{data.recentReceipts.length ? data.recentReceipts.map((row) => <Link key={row.id} href={`/warehouse/receipts/${row.id}`} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[1fr_1fr_auto] sm:items-center"><div><div className="font-semibold text-slate-900">{row.wr_number}</div><div className="text-sm text-slate-500">{customerName(row)}</div></div><div className="text-sm"><div className="text-slate-700">{row.description}</div><div className="mt-1 text-xs text-slate-500">{format(row.pieces)} bultos · {format(row.weight_kg, 2)} kg</div></div><span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{row.warehouse_locations?.code || "Sin ubicación"}</span></Link>) : <div className="p-8 text-sm text-slate-500">No hay recepciones registradas.</div>}</div>
          </div>
          <div className="space-y-4">
            <Operation href="/warehouse/manifests" icon={FileText} title="1. Manifiesto" text={`${data.manifests} manifiestos registrados`} />
            <Operation href="/warehouse/receipts/check-in" icon={ClipboardCheck} title="2. Recepción" text={`${data.receipts} BL recibidos`} />
            <Operation href="/warehouse/inspection" icon={MapPin} title="3. Inspección y almacenaje" text={`${data.pendingInspection} BL pendientes · ${data.locations} ubicaciones`} />
            <Operation href="/warehouse/customs-verification" icon={ShieldCheck} title="4. Verificación de Aduanas" text={`${data.customsPending} BL pendientes de validar`} />
            <Operation href="/warehouse/dispatch" icon={Scale} title="5. Facturación y despacho" text={`${data.available - data.customsPending} BL habilitados para salida`} />
            <Operation href="/warehouse/billing" icon={CircleDollarSign} title="Reporte de facturación" text="Ingresos facturados, cobrados y pendientes" />
          </div>
        </section>
      </>}
    </div>
  );
}

function Quick({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) { return <Link href={href} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${primary ? "bg-blue-600 text-white hover:bg-blue-500" : "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"}`}>{label}</Link>; }
function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Boxes; label: string; value: string; detail: string; tone: string }) { const colors: Record<string,string> = { blue:"bg-blue-50 text-blue-700", cyan:"bg-cyan-50 text-cyan-700", amber:"bg-amber-50 text-amber-700", emerald:"bg-emerald-50 text-emerald-700" }; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${colors[tone]}`}><Icon size={22} /></div><div className="text-sm font-semibold text-slate-500">{label}</div><div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</div><div className="mt-2 text-xs text-slate-500">{detail}</div></div>; }
function Operation({ href, icon: Icon, title, text }: { href: string; icon: typeof Boxes; title: string; text: string }) { return <Link href={href} className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><div className="rounded-xl bg-slate-100 p-3 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700"><Icon size={21} /></div><div className="min-w-0 flex-1"><div className="font-bold text-slate-900">{title}</div><div className="text-sm text-slate-500">{text}</div></div><ArrowRight size={18} className="text-slate-400 group-hover:text-blue-600" /></Link>; }
