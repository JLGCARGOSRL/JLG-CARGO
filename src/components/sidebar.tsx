"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Boxes, ChevronRight, ClipboardCheck, ClipboardList, Container, FileText,
  CircleDollarSign, LayoutDashboard, ListChecks, Menu, SearchCheck,
  Truck, Users, X, Mail,
  KeyRound, LogOut, ShieldCheck, Tags,
} from "lucide-react";
import { useAuth } from "../contexts/authContext";

const mainMenu = [
  { name: "Panel ejecutivo", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Solicitudes de asociados", href: "/customers/applications", icon: ClipboardList },
  { name: "Correo y comunicaciones", href: "/communications", icon: Mail },
];

const warehouseMenu = [
  { name: "1. Manifiestos", href: "/warehouse/manifests", icon: FileText },
  { name: "2. Entrada por BL", href: "/warehouse/receipts/check-in", icon: ClipboardList },
  { name: "2. Recepción de contenedor", href: "/warehouse/container-receipts", icon: Container },
  { name: "2. Recepciones", href: "/warehouse/receipts", icon: ClipboardCheck },
  { name: "3. Inspección y almacenaje", href: "/warehouse/inspection", icon: SearchCheck },
  { name: "3. Inventario y ubicaciones", href: "/warehouse/inventory", icon: Boxes },
  { name: "4. Verificación de Aduanas", href: "/warehouse/customs-verification", icon: ShieldCheck },
  { name: "5. Facturación y despacho", href: "/warehouse/dispatch", icon: Truck },
  { name: "5. Reporte de facturación", href: "/warehouse/billing", icon: CircleDollarSign },
  { name: "Carga suelta / manual", href: "/warehouse/new", icon: ListChecks },
];

function NavLink({ item, pathname, onClick }: {
  item: (typeof mainMenu)[number]; pathname: string; onClick: () => void;
}) {
  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onClick} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
      <Icon size={18} className={active ? "text-white" : "text-slate-400 group-hover:text-white"} />
      <span className="flex-1">{item.name}</span>
      {active && <ChevronRight size={15} />}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const close = () => setOpen(false);

  const content = (
    <>
      <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-5">
        <div className="flex h-14 w-20 shrink-0 items-center justify-center">
          <Image src="/jlg-cargo-logo-dark.png" alt="JLG Cargo" width={140} height={70} className="h-auto w-full drop-shadow-lg" priority />
        </div>
        <div className="min-w-0"><div className="text-sm font-bold leading-tight tracking-tight text-white">JLG LOGISTICS WAREHOUSE</div><div className="mt-1 text-xs text-slate-400">Gestión aduanal y almacén</div></div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        <div className="space-y-1">{mainMenu.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onClick={close} />)}</div>
        <div>
          <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Operación de almacén</div>
          <div className="space-y-1">{warehouseMenu.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onClick={close} />)}</div>
        </div>
        {profile?.role === "administrator" && <div><div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Administración</div><div className="space-y-1"><NavLink item={{ name: "Servicios y paquetes", href: "/settings/services", icon: Tags }} pathname={pathname} onClick={close} /><NavLink item={{ name: "Control de acceso", href: "/settings/access", icon: ShieldCheck }} pathname={pathname} onClick={close} /></div></div>}
      </nav>
      <div className="border-t border-slate-800 p-4"><div className="mb-3 rounded-xl bg-slate-800/70 p-3"><p className="truncate text-sm font-bold text-white">{profile?.full_name}</p><p className="truncate text-xs text-slate-400">{profile?.email}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-blue-300">{profile?.role === "administrator" ? "Administrador" : "Operador"}</p></div><div className="grid grid-cols-2 gap-2"><Link href="/account/password" onClick={close} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"><KeyRound size={14} /> Clave</Link><button onClick={() => void signOut()} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-bold text-slate-300 hover:bg-red-950 hover:text-red-200"><LogOut size={14} /> Salir</button></div></div>
    </>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur lg:hidden">
        <span className="font-bold text-slate-900">JLG LOGISTICS WAREHOUSE</span>
        <button onClick={() => setOpen(true)} className="rounded-xl border p-2 text-slate-700" aria-label="Abrir menú"><Menu size={22} /></button>
      </header>
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col bg-slate-950 text-white lg:flex">{content}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-slate-950/60" onClick={close} aria-label="Cerrar menú" /><aside className="relative flex h-full w-[86%] max-w-80 flex-col bg-slate-950 text-white shadow-2xl">{content}<button onClick={close} className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-800" aria-label="Cerrar"><X size={20} /></button></aside></div>}
    </>
  );
}
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Boxes, ChevronRight, ClipboardCheck, ClipboardList, Container, FileText,
  CircleDollarSign, LayoutDashboard, ListChecks, Menu, SearchCheck,
  Truck, Users, X,
  KeyRound, LogOut, ShieldCheck, Tags,
} from "lucide-react";
import { useAuth } from "../contexts/authContext";

const mainMenu = [
  { name: "Panel ejecutivo", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Solicitudes de asociados", href: "/customers/applications", icon: ClipboardList },
];

const warehouseMenu = [
  { name: "1. Manifiestos", href: "/warehouse/manifests", icon: FileText },
  { name: "2. Entrada por BL", href: "/warehouse/receipts/check-in", icon: ClipboardList },
  { name: "2. Recepción de contenedor", href: "/warehouse/container-receipts", icon: Container },
  { name: "2. Recepciones", href: "/warehouse/receipts", icon: ClipboardCheck },
  { name: "3. Inspección y almacenaje", href: "/warehouse/inspection", icon: SearchCheck },
  { name: "3. Inventario y ubicaciones", href: "/warehouse/inventory", icon: Boxes },
  { name: "4. Verificación de Aduanas", href: "/warehouse/customs-verification", icon: ShieldCheck },
  { name: "5. Facturación y despacho", href: "/warehouse/dispatch", icon: Truck },
  { name: "5. Reporte de facturación", href: "/warehouse/billing", icon: CircleDollarSign },
  { name: "Carga suelta / manual", href: "/warehouse/new", icon: ListChecks },
];

function NavLink({ item, pathname, onClick }: {
  item: (typeof mainMenu)[number]; pathname: string; onClick: () => void;
}) {
  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onClick} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-950/20" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
      <Icon size={18} className={active ? "text-white" : "text-slate-400 group-hover:text-white"} />
      <span className="flex-1">{item.name}</span>
      {active && <ChevronRight size={15} />}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const close = () => setOpen(false);

  const content = (
    <>
      <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-5">
        <div className="flex h-14 w-20 shrink-0 items-center justify-center">
          <Image src="/jlg-cargo-logo-dark.png" alt="JLG Cargo" width={140} height={70} className="h-auto w-full drop-shadow-lg" priority />
        </div>
        <div className="min-w-0"><div className="text-sm font-bold leading-tight tracking-tight text-white">JLG LOGISTICS WAREHOUSE</div><div className="mt-1 text-xs text-slate-400">Gestión aduanal y almacén</div></div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto p-4">
        <div className="space-y-1">{mainMenu.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onClick={close} />)}</div>
        <div>
          <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Operación de almacén</div>
          <div className="space-y-1">{warehouseMenu.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onClick={close} />)}</div>
        </div>
        {profile?.role === "administrator" && <div><div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Administración</div><div className="space-y-1"><NavLink item={{ name: "Servicios y paquetes", href: "/settings/services", icon: Tags }} pathname={pathname} onClick={close} /><NavLink item={{ name: "Control de acceso", href: "/settings/access", icon: ShieldCheck }} pathname={pathname} onClick={close} /></div></div>}
      </nav>
      <div className="border-t border-slate-800 p-4"><div className="mb-3 rounded-xl bg-slate-800/70 p-3"><p className="truncate text-sm font-bold text-white">{profile?.full_name}</p><p className="truncate text-xs text-slate-400">{profile?.email}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-blue-300">{profile?.role === "administrator" ? "Administrador" : "Operador"}</p></div><div className="grid grid-cols-2 gap-2"><Link href="/account/password" onClick={close} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"><KeyRound size={14} /> Clave</Link><button onClick={() => void signOut()} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2 py-2 text-xs font-bold text-slate-300 hover:bg-red-950 hover:text-red-200"><LogOut size={14} /> Salir</button></div></div>
    </>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur lg:hidden">
        <span className="font-bold text-slate-900">JLG LOGISTICS WAREHOUSE</span>
        <button onClick={() => setOpen(true)} className="rounded-xl border p-2 text-slate-700" aria-label="Abrir menú"><Menu size={22} /></button>
      </header>
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col bg-slate-950 text-white lg:flex">{content}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-slate-950/60" onClick={close} aria-label="Cerrar menú" /><aside className="relative flex h-full w-[86%] max-w-80 flex-col bg-slate-950 text-white shadow-2xl">{content}<button onClick={close} className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-800" aria-label="Cerrar"><X size={20} /></button></aside></div>}
    </>
  );
}
