"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const redirectTo = `${window.location.origin}/account/recover`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo },
    );

    setSubmitting(false);
    if (resetError) {
      setError(
        resetError.status === 429
          ? "Se han realizado demasiados intentos. Espere unos minutos e inténtelo nuevamente."
          : "No fue posible enviar el enlace. Verifique su conexión e inténtelo nuevamente.",
      );
      return;
    }

    setSent(true);
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12">
    <div className="w-full max-w-lg">
      <div className="mb-7 flex justify-center"><Image src="/jlg-cargo-logo-dark.png" alt="JLG Cargo" width={220} height={110} className="h-24 w-auto" priority /></div>
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl shadow-black/30 sm:p-10">
        {sent ? <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><MailCheck size={32} /></div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Revise su correo</h1>
          <p className="mt-3 leading-7 text-slate-600">Si existe una cuenta asociada a <strong>{email.trim().toLowerCase()}</strong>, recibirá un enlace seguro para crear una contraseña nueva.</p>
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">El enlace puede tardar unos minutos. Revise también la carpeta de correo no deseado.</div>
          <Link href="/login" className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 font-bold text-white hover:bg-blue-700"><ArrowLeft size={18} /> Volver al inicio</Link>
        </div> : <>
          <div className="mb-7"><div className="mb-4 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700"><MailCheck size={27} /></div><h1 className="text-3xl font-black tracking-tight text-slate-950">Recuperar acceso</h1><p className="mt-2 leading-7 text-slate-600">Ingrese su correo corporativo y le enviaremos un enlace para crear una contraseña nueva.</p></div>
          <form onSubmit={submit} className="space-y-5">
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Correo corporativo</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@jlgcargo.com" className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
            <button disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"><Send size={18} /> {submitting ? "Enviando enlace…" : "Enviar enlace de recuperación"}</button>
          </form>
          <Link href="/login" className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700"><ArrowLeft size={16} /> Volver a iniciar sesión</Link>
        </>}
      </section>
      <p className="mt-5 text-center text-xs text-slate-400">Por seguridad, el enlace vence y solo puede utilizarse una vez.</p>
    </div>
  </main>;
}
