import type { NextConfig } from "next";

const legacySupabaseUrl = process.env.LEGACY_NEXT_PUBLIC_SUPABASE_URL;
const legacySupabaseAnonKey = process.env.LEGACY_NEXT_PUBLIC_SUPABASE_ANON_KEY;

const nextConfig: NextConfig = {
  // Vercel's Supabase integration added a second, empty project. Preserve the
  // warehouse system on its original database while that project is migrated.
  env: {
    ...(legacySupabaseUrl ? { NEXT_PUBLIC_SUPABASE_URL: legacySupabaseUrl } : {}),
    ...(legacySupabaseAnonKey ? { NEXT_PUBLIC_SUPABASE_ANON_KEY: legacySupabaseAnonKey } : {}),
  },
};

export default nextConfig;
