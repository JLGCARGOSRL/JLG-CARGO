"use client";

import Link from "next/link";
import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/client";

function isStrongPassword(password: string) {
  return password.length >= 10
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

export default function RecoverAccountPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(Boolean(data.session));
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
      setChecking(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!isStrongPassword(password)) {
      setError("Use al menos 10 caracteres, mayúscula, minúscula, número y símbolo.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("El enlace venció o no fue posible actualizar la contraseña. Solicite uno nuevo.");
      setSaving(false);
      return;
    }

    await supabase.rpc("record_system_access_event", {
      p_event_type: "password_recovered",
      p_user_agent: navigator.userAgent,
    });
    await supabase.auth.signOut();
    setSaving(false);
    setCompleted(true);
  }

  if (checking) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><div className="text-center"><LoaderCircle className="mx-auto mb-4 animate-spin text-blue-400" size={34} /><p className="text-sm text-slate-300">Validando enlace seguro…</p></div></main>;

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12"><section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl shadow-black/30 sm:p-10">
    {completed ? <div className="text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><CheckCircle2 size={34} /></div><h1 className="text-3xl font-black text-slate-950">Contraseña actualizada</h1><p className="mt-3 leading-7 text-slate-600">Su acceso fue recuperado correctamente. Ya puede iniciar sesión con la contraseña nueva.</p><Link href="/login" className="mt-7 inline-flex rounded-xl bg-slate-950 px-6 py-3 font-bold text-white hover:bg-blue-700">Iniciar sesión</Link></div>
      : !hasSession ? <div className="text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><TriangleAlert size={34} /></div><h1 className="text-3xl font-black text-slate-950">Enlace inválido o vencido</h1><p className="mt-3 leading-7 text-slate-600">Solicite un enlace de recuperación nuevo para proteger su cuenta.</p><Link href="/forgot-password" className="mt-7 inline-flex rounded-xl bg-slate-950 px-6 py-3 font-bold text-white hover:bg-blue-700">Solicitar otro enlace</Link></div>
      : <><div className="mb-7 flex items-start gap-4"><div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><KeyRound size={28} /></div><div><p className="text-sm font-bold uppercase tracking-[.15em] text-blue-700">Recuperación segura</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Cree una contraseña nueva</h1><p className="mt-2 text-slate-600">Esta contraseña sustituirá la anterior inmediatamente.</p></div></div><div className="mb-7 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 sm:grid-cols-2"><span className="flex items-center gap-2"><CheckCircle2 size={17} /> Mínimo 10 caracteres</span><span className="flex items-center gap-2"><CheckCircle2 size={17} /> Mayúscula y minúscula</span><span className="flex items-center gap-2"><CheckCircle2 size={17} /> Al menos un número</span><span className="flex items-center gap-2"><CheckCircle2 size={17} /> Al menos un símbolo</span></div><form onSubmit={submit} className="space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Nueva contraseña</span><input type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Confirmar nueva contraseña</span><input type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label>{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}<button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white hover:bg-blue-700 disabled:opacity-60"><ShieldCheck size={18} /> {saving ? "Actualizando…" : "Guardar contraseña nueva"}</button></form></>}
  </section></main>;
}
