"use client";

import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/authContext";
import { supabase } from "../../../lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { profile, refreshProfile, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError("Use al menos 10 caracteres, mayúscula, minúscula, número y símbolo.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    if (updateError) {
      setError("No fue posible actualizar la contraseña. Inténtelo nuevamente.");
      setSaving(false);
      return;
    }
    const { error: auditError } = await supabase.rpc("record_system_access_event", { p_event_type: "password_changed", p_user_agent: navigator.userAgent });
    if (auditError) {
      setError("La contraseña cambió, pero no se pudo actualizar el perfil. Cierre sesión y contacte al administrador.");
      setSaving(false);
      return;
    }
    await refreshProfile();
    router.replace("/dashboard");
    router.refresh();
  }

  return <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center"><div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10"><div className="mb-8 flex items-start gap-4"><div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><KeyRound size={28} /></div><div><p className="text-sm font-bold uppercase tracking-[.15em] text-blue-700">Seguridad de la cuenta</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Cree su contraseña personal</h1><p className="mt-2 text-slate-500">{profile?.must_change_password ? "La clave actual es temporal y debe cambiarla antes de usar el sistema." : "Actualice su contraseña cuando lo necesite."}</p></div></div><div className="mb-7 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 sm:grid-cols-2"><span className="flex items-center gap-2"><CheckCircle2 size={17} /> Mínimo 10 caracteres</span><span className="flex items-center gap-2"><CheckCircle2 size={17} /> Una mayúscula y una minúscula</span><span className="flex items-center gap-2"><CheckCircle2 size={17} /> Al menos un número</span><span className="flex items-center gap-2"><CheckCircle2 size={17} /> Al menos un símbolo</span></div><form onSubmit={submit} className="space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Nueva contraseña</span><input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Confirmar nueva contraseña</span><input type="password" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3.5 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label>{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}<div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => void signOut()} className="rounded-xl border border-slate-300 px-5 py-3 font-bold text-slate-700 hover:bg-slate-50">Cerrar sesión</button><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60"><ShieldCheck size={18} />{saving ? "Guardando…" : "Guardar contraseña"}</button></div></form></div></div>;
}
