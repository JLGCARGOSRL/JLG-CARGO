"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../contexts/authContext";
import Sidebar from "./sidebar";

const PUBLIC_ROUTES = ["/login", "/registro-asociado"];
const LOGIN_ROUTE = "/login";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isLogin = pathname === LOGIN_ROUTE;

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) router.replace("/login");
    if (user && isLogin) router.replace(profile?.must_change_password ? "/account/password" : "/dashboard");
    if (user && !isPublic && profile?.must_change_password && pathname !== "/account/password") router.replace("/account/password");
  }, [isLogin, isPublic, loading, pathname, profile?.must_change_password, router, user]);

  if (isPublic) return <>{children}</>;

  if (loading || !user || !profile || (profile.must_change_password && pathname !== "/account/password")) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><div className="text-center"><LoaderCircle className="mx-auto mb-3 animate-spin text-blue-400" size={32} /><p className="text-sm text-slate-300">Validando acceso seguro…</p></div></div>;
  }

  if (pathname === "/warehouse/billing/print") return <>{children}</>;

  return <div className="min-h-screen bg-slate-100 lg:flex"><Sidebar /><main className="min-w-0 flex-1 px-4 pb-8 pt-20 sm:px-6 lg:p-8">{children}</main></div>;
}
