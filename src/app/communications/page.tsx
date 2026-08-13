"use client";

import {
  CalendarDays, FileClock, Filter, Mail, MessageCircle,
  Plus, RefreshCw, Search, ShieldCheck, Upload, X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../contexts/authContext";
import { getCommunicationRecords, recordManualCommunication } from "../../lib/services/communicationService";
import type { CommunicationChannel, CommunicationDirection, CommunicationRecord } from "../../types/communication";
import BulkEmailImportModal from "../../components/bulkEmailImportModal";

const channelLabels: Record<CommunicationChannel, string> = {
  email: "Correo", phone: "Llamada", whatsapp: "WhatsApp", in_person: "Presencial", other: "Otro",
};
const directionLabels: Record<CommunicationDirection, string> = {
  inbound: "Recibida", outbound: "Enviada", internal: "Interna",
};

function effectiveDate(record: CommunicationRecord) {
  return record.received_at || record.sent_at || record.declared_at || record.created_at;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function localDateTimeValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function CommunicationsPage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<CommunicationRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<"all" | CommunicationChannel>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getCommunicationRecords();
      setRecords(result.records);
      setTotalRecords(result.total);
      setConfigured(result.configured);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las comunicaciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      const day = effectiveDate(record).slice(0, 10);
      if (channel !== "all" && record.channel !== channel) return false;
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return !query || [record.subject, record.sender, ...(record.recipients || []), record.customer_reference, record.document_reference, record.body_text]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [channel, fromDate, records, search, toDate]);

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await recordManualCommunication({
        channel: String(form.get("channel")) as "phone" | "whatsapp" | "in_person" | "other",
        direction: String(form.get("direction")) as CommunicationDirection,
        subject: String(form.get("subject")), counterpart: String(form.get("counterpart")),
        body: String(form.get("body")), declaredAt: String(form.get("declaredAt")),
        customerReference: String(form.get("customerReference")),
        documentReference: String(form.get("documentReference")),
      });
      setMessage("Comunicación registrada con su fecha declarada y sello de auditoría actual.");
      setShowForm(false);
      await load();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No se pudo guardar la comunicación.");
    } finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.16em] text-blue-700"><Mail size={18} /> Comunicaciones</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Correo y evidencias</h1><p className="mt-2 text-slate-500">Cronología verificable por fecha real de entrada, envío o declaración.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"><RefreshCw size={17} /> Actualizar</button><button onClick={() => setShowImport(true)} disabled={!configured || profile?.role !== "administrator"} className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 font-bold text-blue-800 disabled:opacity-40"><Upload size={18} /> Importar correos</button><button onClick={() => setShowForm(true)} disabled={!configured} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white shadow-lg shadow-blue-950/15 hover:bg-blue-700 disabled:opacity-40"><Plus size={18} /> Registrar comunicación</button></div>
      </header>

      {!configured && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><div className="flex gap-3"><FileClock className="shrink-0" /><div><h2 className="font-black">Módulo preparado, falta activar la base de datos</h2><p className="mt-1 text-sm">Aplique la migración <code>202608120016_communications_and_evidence.sql</code>. Después aparecerán los correos importados y podrá crear registros manuales.</p></div></div></section>}
      {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><Mail className="text-blue-600" /><p className="mt-3 text-3xl font-black">{totalRecords}</p><p className="text-sm text-slate-500">Correos conservados</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><MessageCircle className="text-emerald-600" /><p className="mt-3 text-3xl font-black">{records.filter((item) => item.source === "manual").length}</p><p className="text-sm text-slate-500">Registros manuales</p></article>
        <article className="rounded-2xl border bg-white p-5 shadow-sm"><ShieldCheck className="text-violet-600" /><p className="mt-3 text-3xl font-black">{totalRecords}</p><p className="text-sm text-slate-500">Evidencias auditadas</p></article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-5 lg:grid-cols-[minmax(260px,1fr)_180px_170px_170px]">
          <label className="relative"><Search className="absolute left-3 top-3.5 text-slate-400" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar remitente, asunto, cliente o BL…" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3 outline-none focus:border-blue-500" /></label>
          <label className="relative"><Filter className="absolute left-3 top-3.5 text-slate-400" size={17} /><select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className="w-full appearance-none rounded-xl border border-slate-300 py-3 pl-10 pr-3"><option value="all">Todos los canales</option>{Object.entries(channelLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label><span className="sr-only">Desde</span><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
          <label><span className="sr-only">Hasta</span><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Fecha efectiva</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Comunicación</th><th className="px-4 py-3">Relacionado</th><th className="px-5 py-3">Integridad</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((record) => <tr key={record.id} className="align-top hover:bg-slate-50/70"><td className="whitespace-nowrap px-5 py-4"><p className="font-bold text-slate-900">{displayDate(effectiveDate(record))}</p><p className="mt-1 text-xs text-slate-500">{record.received_at ? "Recibido por servidor" : record.sent_at ? "Enviado por servidor" : "Fecha declarada"}</p></td><td className="px-4 py-4"><span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{channelLabels[record.channel]}</span><p className="mt-2 text-xs text-slate-500">{directionLabels[record.direction]}</p></td><td className="max-w-xl px-4 py-4"><p className="font-bold text-slate-950">{record.subject}</p><p className="mt-1 text-xs text-slate-500">{record.sender || record.recipients?.join(", ") || "Sin contraparte"}</p>{record.body_text && <p className="mt-2 line-clamp-2 text-slate-600">{record.body_text}</p>}</td><td className="px-4 py-4"><p className="font-semibold text-slate-800">{record.customer_reference || "—"}</p><p className="text-xs text-slate-500">{record.document_reference || "Sin BL/expediente"}</p></td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${record.source === "mail_server" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}><ShieldCheck size={13} />{record.source === "mail_server" ? "Fecha del servidor" : "Registro manual"}</span><p className="mt-2 text-xs text-slate-500">Registrado: {displayDate(record.created_at)}</p>{record.created_by_name && <p className="text-xs text-slate-500">Por {record.created_by_name}</p>}</td></tr>)}</tbody></table></div>
        {loading && <p className="p-6 text-sm text-slate-500">Cargando comunicaciones…</p>}
        {!loading && filtered.length === 0 && <div className="p-12 text-center"><CalendarDays className="mx-auto text-slate-300" size={38} /><h2 className="mt-3 font-black text-slate-900">No hay comunicaciones en este rango</h2><p className="mt-1 text-sm text-slate-500">Ajuste los filtros o registre una comunicación no electrónica.</p></div>}
      </section>

      {showImport && <BulkEmailImportModal onClose={() => setShowImport(false)} onImported={async (notice) => { setMessage(notice); await load(); }} />}
      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Registrar comunicación manual"><form onSubmit={submitManual} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b p-6"><div><p className="text-sm font-bold uppercase tracking-wider text-blue-700">Evidencia no electrónica</p><h2 className="text-2xl font-black text-slate-950">Registrar comunicación</h2><p className="mt-1 text-sm text-slate-500">La fecha declarada se conserva junto con la fecha real de creación.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X /></button></header><div className="grid gap-5 p-6 sm:grid-cols-2">
        <label className="font-bold text-slate-700">Canal<select name="channel" required className="mt-2 w-full rounded-xl border p-3 font-normal"><option value="phone">Llamada</option><option value="whatsapp">WhatsApp</option><option value="in_person">Presencial</option><option value="other">Otro</option></select></label>
        <label className="font-bold text-slate-700">Dirección<select name="direction" required className="mt-2 w-full rounded-xl border p-3 font-normal"><option value="inbound">Recibida</option><option value="outbound">Enviada</option><option value="internal">Interna</option></select></label>
        <label className="font-bold text-slate-700 sm:col-span-2">Asunto *<input name="subject" required maxLength={180} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        <label className="font-bold text-slate-700">Persona o entidad<input name="counterpart" required className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        <label className="font-bold text-slate-700">Fecha declarada *<input name="declaredAt" type="datetime-local" required max={localDateTimeValue()} defaultValue={localDateTimeValue()} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        <label className="font-bold text-slate-700">Cliente o código<input name="customerReference" className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        <label className="font-bold text-slate-700">BL, manifiesto o expediente<input name="documentReference" className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        <label className="font-bold text-slate-700 sm:col-span-2">Descripción<textarea name="body" required rows={5} className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
        <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Control de integridad:</strong> este registro no crea ni modifica correos. Mostrará siempre la fecha declarada y la fecha actual en que {profile?.full_name || "el usuario"} lo registró.</div>
      </div><footer className="flex justify-end gap-3 border-t p-6"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border px-5 py-3 font-bold text-slate-700">Cancelar</button><button disabled={saving} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar registro auditado"}</button></footer></form></div>}
    </div>
  );
}
