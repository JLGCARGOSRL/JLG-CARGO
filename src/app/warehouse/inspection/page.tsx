"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, SearchCheck } from "lucide-react";
import { getWarehouseReceipts, type WarehouseReceiptListItem } from "../../../lib/services/receiptService";

const name = (r: WarehouseReceiptListItem) => r.customers?.company_name || r.customers?.legal_name || "Cliente sin nombre";

export default function InspectionQueuePage() {
  const [rows, setRows] = useState<WarehouseReceiptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { getWarehouseReceipts().then(setRows).catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar la inspección.")).finally(() => setLoading(false)); }, []);
  const pending = useMemo(() => rows.filter((r) => ["received", "inspection", "pending_documents"].includes(r.status)).filter((r) => `${r.wr_number} ${name(r)} ${r.description} ${r.warehouse_manifests?.manifest_number || ""}`.toLowerCase().includes(search.toLowerCase())), [rows, search]);
  const damaged = rows.filter((r) => r.has_visible_damage).length;
  const available = rows.filter((r) => r.status === "available").length;
  return <div className="mx-auto max-w-[1400px] space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-blue-700"><SearchCheck size={18} /> Control de calidad</div><h1 className="text-3xl font-bold text-slate-950">Inspección de carga</h1><p className="mt-1 text-sm text-slate-500">Verifica condición, medidas, daños, documentos y asigna la ubicación inicial.</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar WR, cliente o manifiesto…" className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-200 sm:max-w-sm" /></header>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <section className="grid gap-4 sm:grid-cols-3"><Kpi label="Pendientes" value={pending.length} icon={SearchCheck} tone="blue" /><Kpi label="Con daños visibles" value={damaged} icon={AlertTriangle} tone="amber" /><Kpi label="Disponibles" value={available} icon={CheckCircle2} tone="emerald" /></section>
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-bold">Cola de inspección</h2><p className="text-sm text-slate-500">Priorice las cargas sin ubicación y con diferencias.</p></div>{loading ? <div className="p-8 text-slate-500">Cargando…</div> : pending.length ? <div className="divide-y">{pending.map((r) => <div key={r.id} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_1.25fr_.7fr_auto] md:items-center"><div><Link href={`/warehouse/receipts/${r.id}`} className="font-bold text-slate-950 hover:text-blue-700">{r.wr_number}</Link><div className="text-sm text-slate-500">{name(r)}</div></div><div><div className="text-sm text-slate-800">{r.description}</div><div className="mt-1 text-xs text-slate-500">{r.warehouse_manifests?.manifest_number || "Sin manifiesto"}</div></div><div className="text-sm"><b>{Number(r.pieces).toLocaleString("es-DO")}</b> bultos<div className="text-xs text-slate-500">{Number(r.weight_kg).toLocaleString("es-DO")} kg</div></div><Link href={`/warehouse/receipts/${r.id}`} className="rounded-xl bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-blue-700">Inspeccionar</Link></div>)}</div> : <div className="p-10 text-center text-sm text-slate-500"><CheckCircle2 className="mx-auto mb-3 text-emerald-600" />No hay cargas pendientes de inspección.</div>}</section>
  </div>;
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof SearchCheck; tone: string }) { const style: Record<string,string> = { blue:"bg-blue-50 text-blue-700", amber:"bg-amber-50 text-amber-700", emerald:"bg-emerald-50 text-emerald-700" }; return <div className="flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm"><div className={`rounded-xl p-3 ${style[tone]}`}><Icon size={22} /></div><div><div className="text-2xl font-bold">{value}</div><div className="text-sm text-slate-500">{label}</div></div></div>; }
