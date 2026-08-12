"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getRole } from "@/lib/supabase/server";

interface LoginState {
  error?: string;
}

/** Faz login com e-mail e senha. Usuários são criados pelo admin
 *  no painel do Supabase (sem cadastro público). Após autenticar,
 *  redireciona por perfil (john → /, cozinha → /cozinha).
 *
 *  Otimizado: o signInWithPassword já devolve a sessão/usuário (não há
 *  necessidade de um segundo getUser()); o papel é resolvido por getRole()
 *  (memoizado) para o redirect por perfil.
 */
export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }

  // Redireciona por papel (memoizado). O middleware também garante a guarda.
  const role = await getRole();

  revalidatePath("/", "layout");
  redirect(role === "cozinha" ? "/cozinha" : "/");
}

/** Faz logout: encerra a sessão no Supabase e volta ao login. */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}