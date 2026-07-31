"use client";

import { Ban, CheckCircle2, RefreshCw, Shield, UserCog, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../contexts/authContext";
import { supabase } from "../../../lib/supabase/client";
import type { SystemAccessLog, SystemRole, SystemUserProfile } from "../../../types/auth";

const eventLabels = { login: "Inicio de sesión", logout: "Cierre de sesión", password_changed: "Cambio de contraseña" };
const formatter = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" });

export default function AccessControlPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<SystemUserProfile[]>([]);
  const [logs, setLogs] = useState<SystemAccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [usersResult, logsResult] = await Promise.all([
      supabase.from("system_user_profiles").select("*").order("full_name"),
      supabase.from("system_access_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setUsers((usersResult.data ?? []) as SystemUserProfile[]);
    setLogs((logsResult.data ?? []) as SystemAccessLog[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (profile?.role !== "administrator") return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, profile?.role]);

  async function updateAccess(user: SystemUserProfile, changes: { role?: SystemRole; is_active?: boolean }) {
    setMessage("");
    const { error } = await supabase.from("system_user_profiles").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", user.id);
    setMessage(error ? "No se pudo actualizar el usuario." : "Acceso actualizado correctamente.");
    if (!error) await load();
  }

  if (profile?.role !== "administrator") return <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center"><Ban className="mx-auto text-amber-700" size={36} /><h1 className="mt-4 text-2xl font-black text-slate-950">Acceso restringido</h1><p className="mt-2 text-slate-600">Solo el administrador puede consultar usuarios y registros de acceso.</p></div>;

  return <div className="mx-auto max-w-7xl space-y-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-[.15em] text-blue-700">Administración</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Control de acceso</h1><p className="mt-2 text-slate-500">Usuarios autorizados, permisos y trazabilidad de sesiones.</p></div><button onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"><RefreshCw size={17} /> Actualizar</button></div>{message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{message}</div>}<section className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-slate-200 p-6"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Users size={21} /></div><div><h2 className="text-xl font-black text-slate-950">Usuarios del sistema</h2><p className="text-sm text-slate-500">{users.length} cuenta(s) configurada(s)</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Usuario</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Último acceso</th><th className="px-6 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{users.map((user) => <tr key={user.id}><td className="px-6 py-4"><p className="font-bold text-slate-900">{user.full_name || "Sin nombre"}</p><p className="text-slate-500">{user.email}</p></td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${user.role === "administrator" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"}`}><Shield size={14} />{user.role === "administrator" ? "Administrador" : "Operador"}</span></td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${user.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>{user.is_active ? <CheckCircle2 size={14} /> : <Ban size={14} />}{user.is_active ? "Activo" : "Desactivado"}</span></td><td className="px-4 py-4 text-slate-600">{user.last_login_at ? formatter.format(new Date(user.last_login_at)) : "Nunca"}</td><td className="px-6 py-4"><div className="flex justify-end gap-2"><button disabled={user.id === profile.id} onClick={() => void updateAccess(user, { role: user.role === "administrator" ? "operator" : "administrator" })} className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><UserCog size={15} className="mr-1 inline" />Cambiar rol</button><button disabled={user.id === profile.id} onClick={() => void updateAccess(user, { is_active: !user.is_active })} className="rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{user.is_active ? "Desactivar" : "Activar"}</button></div></td></tr>)}</tbody></table></div>{loading && <p className="p-6 text-sm text-slate-500">Cargando usuarios…</p>}</section><section className="rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-6"><h2 className="text-xl font-black text-slate-950">Registro de actividad</h2><p className="text-sm text-slate-500">Últimos 100 eventos de seguridad.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3">Fecha y hora</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Evento</th><th className="px-6 py-3">Dispositivo</th></tr></thead><tbody className="divide-y divide-slate-100">{logs.map((log) => <tr key={log.id}><td className="px-6 py-4 whitespace-nowrap text-slate-600">{formatter.format(new Date(log.created_at))}</td><td className="px-4 py-4 font-semibold text-slate-900">{log.email}</td><td className="px-4 py-4"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{eventLabels[log.event_type]}</span></td><td className="max-w-md truncate px-6 py-4 text-xs text-slate-500" title={log.user_agent ?? ""}>{log.user_agent || "No identificado"}</td></tr>)}</tbody></table></div>{!loading && logs.length === 0 && <p className="p-6 text-sm text-slate-500">Aún no hay eventos registrados.</p>}</section></div>;
}
