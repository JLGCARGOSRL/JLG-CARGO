"use client";
import { FileUp, ShieldCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { parseEmailFiles } from "../lib/email/rfc822";
import { importEmailCommunications } from "../lib/services/communicationService";

export default function BulkEmailImportModal({ onClose, onImported }: { onClose: () => void; onImported: (message: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    const files = form.getAll("emails").filter((item): item is File => item instanceof File && item.size > 0);
    try {
      if (!files.length) throw new Error("Seleccione archivos .eml o un archivo .mbox.");
      const result = await importEmailCommunications(await parseEmailFiles(files, String(form.get("mailbox"))));
      await onImported(`${result.inserted} correo(s) importado(s), ${result.updated} actualizado(s) y ${result.duplicates} duplicado(s) omitido(s).`); onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron importar los correos."); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4" role="dialog" aria-modal="true" aria-label="Importar correos"><form onSubmit={submit} className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
    <header className="flex items-start justify-between border-b p-6"><div><p className="text-sm font-bold uppercase tracking-wider text-blue-700">Carga masiva</p><h2 className="text-2xl font-black">Importar hasta 250 correos</h2><p className="mt-1 text-sm text-slate-500">Admite mensajes .eml o una exportación .mbox.</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-slate-100" aria-label="Cerrar"><X /></button></header>
    <div className="space-y-5 p-6"><label className="block font-bold text-slate-700">Dirección del buzón<input name="mailbox" type="email" required defaultValue="info@jlgcargo.com" className="mt-2 w-full rounded-xl border p-3 font-normal" /></label>
      <label className="block rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-6 text-center font-bold text-blue-950"><FileUp className="mx-auto mb-3 text-blue-600" size={34} />Seleccionar correos o buzón<input name="emails" type="file" required multiple accept=".eml,.mbox,message/rfc822,application/mbox" className="mt-4 block w-full text-sm font-normal" /></label>
      <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><ShieldCheck className="shrink-0" /><p>Se conserva fecha, Message-ID y huella SHA-256. Los duplicados se omiten automáticamente.</p></div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div>}
    </div><footer className="flex justify-end gap-3 border-t p-6"><button type="button" onClick={onClose} className="rounded-xl border px-5 py-3 font-bold">Cancelar</button><button disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Importando…" : "Importar correos"}</button></footer>
  </form></div>;
}
