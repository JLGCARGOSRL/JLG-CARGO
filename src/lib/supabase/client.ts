import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

function readAuthRedirectType() {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  return url.searchParams.get('type') ?? hash.get('type')
}

// Supabase removes the recovery tokens from the URL while it initializes. Keep
// only the non-sensitive callback type so the recovery screen can distinguish a
// real recovery session from a normal session already stored in the browser.
const initialAuthRedirectType = readAuthRedirectType()

export function isPasswordRecoveryRedirect() {
  return initialAuthRedirectType === 'recovery'
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
