import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase usado no navegador (componentes client).
 * Usa apenas a anon key (chave pública) — nunca a service_role.
 * Sessão gerenciada por cookies httpOnly via @supabase/ssr.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}