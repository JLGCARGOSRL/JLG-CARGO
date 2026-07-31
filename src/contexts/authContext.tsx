"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase/client";
import type { SystemUserProfile } from "../types/auth";

interface AuthContextValue {
  user: User | null;
  profile: SystemUserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from("system_user_profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as SystemUserProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SystemUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfile(await loadProfile(user.id));
  }, [user]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      if (data.user) {
        try {
          const nextProfile = await loadProfile(data.user.id);
          if (mounted) setProfile(nextProfile);
        } catch {
          await supabase.auth.signOut();
          if (mounted) setUser(null);
        }
      }
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) return "Correo o contraseña incorrectos.";

    try {
      const nextProfile = await loadProfile(data.user.id);
      if (!nextProfile.is_active) {
        await supabase.auth.signOut();
        return "Este usuario está desactivado. Contacte al administrador.";
      }
      setUser(data.user);
      setProfile(nextProfile);
      await supabase.rpc("record_system_access_event", {
        p_event_type: "login",
        p_user_agent: navigator.userAgent,
      });
      router.replace(nextProfile.must_change_password ? "/account/password" : "/dashboard");
      router.refresh();
      return null;
    } catch {
      await supabase.auth.signOut();
      return "La cuenta no tiene un perfil de acceso válido.";
    }
  }, [router]);

  const signOut = useCallback(async () => {
    if (user) {
      await supabase.rpc("record_system_access_event", {
        p_event_type: "logout",
        p_user_agent: navigator.userAgent,
      });
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    router.replace("/login");
    router.refresh();
  }, [router, user]);

  const value = useMemo(() => ({ user, profile, loading, signIn, signOut, refreshProfile }), [user, profile, loading, signIn, signOut, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
