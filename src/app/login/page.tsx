"use client";

import Image from "next/image";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "../../contexts/authContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const message = await signIn(email, password);
    if (message) setError(message);
    setSubmitting(false);
  }

  return <div className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-14">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(37,99,235,.36),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(14,165,233,.18),transparent_35%)]" />
      <div className="relative flex items-center gap-5"><Image src="/jlg-cargo-logo-dark.png" alt="JLG Cargo" width={240} height={120} className="h-28 w-auto drop-shadow-2xl" priority /><div><p className="text-2xl font-bold leading-tight text-white">JLG LOGISTICS WAREHOUSE</p><p className="mt-1 text-sm text-blue-200">Gestión aduanal y de almacén</p></div></div>
      <div className="relative max-w-xl"><span className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-200"><ShieldCheck size={18} /> Acceso protegido y auditable</span><h1 className="text-5xl font-black leading-tight tracking-tight text-white">Control Integral de Almacén y Operaciones Logísticas</h1><p className="mt-6 text-lg leading-8 text-slate-300">Recepción, inventario, inspección, ubicación, liquidación y entrega en una sola plataforma.</p></div>
      <p className="relative text-sm text-slate-400">Almacén JLG Cargo · Autopista Duarte Km 17½ · RNC 131784925</p>
    </section>
    <section className="flex items-center justify-center bg-slate-50 px-5 py-12 sm:px-10">
      <div className="w-full max-w-md"><div className="mb-8 lg:hidden"><Image src="/jlg-cargo-logo-transparent.png" alt="JLG Cargo" width={240} height={121} className="h-24 w-auto" priority /></div><div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl shadow-slate-950/10 sm:p-9"><div className="mb-8"><div className="mb-4 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700"><LockKeyhole size={25} /></div><h2 className="text-3xl font-black tracking-tight text-slate-950">Iniciar sesión</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use las credenciales asignadas por el administrador.</p></div><form onSubmit={submit} className="space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Correo corporativo</span><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@jlgcargo.com" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Contraseña</span><div className="relative"><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 pr-12 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>{error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}<button disabled={submitting} className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white shadow-lg transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{submitting ? "Validando acceso…" : "Entrar al sistema"}</button></form></div><p className="mt-5 text-center text-xs text-slate-500">Cada acceso queda registrado por seguridad.</p></div>
    </section>
  </div>;
}
