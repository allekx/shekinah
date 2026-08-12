import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/** Cliente Supabase server-side (RSC, Server Actions, route handlers).
 * Lê/grava cookies httpOnly de sessão. Só anon key.
 *
 * MEMOIZADO por request via React cache(): cada filtro de sessão (getSession /
 * getRole) é executado UMA vez por render de request, mesmo que o layout e a
 * página chamem o mesmo helper — eliminando chamadas redundantes ao Supabase.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado em Server Component — seguro ignorar (middleware refaz refresh).
          }
        },
      },
    }
  );
}

/** Busca o usuário autenticado UMA vez por request (memoizado).
 *  Usado por layout + páginas para evitar getUser() duplicado.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** Busca o papel do usuário UMA vez por request (memoizado).
 *  Ainda consulta profiles (fonte da verdade de permissão), mas só UMA vez
 *  por request, mesmo que middleware/layout/página chamem.
 */
export const getRole = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return (data?.role as string | null) ?? null;
});