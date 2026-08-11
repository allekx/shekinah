"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface LoginState {
  error?: string;
}

/** Faz login com e-mail e senha. Usuários são criados pelo admin
 *  no painel do Supabase (sem cadastro público). Após autenticar,
 *  redireciona por perfil (john → /, cozinha → /cozinha).
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

  // Busca o perfil para direcionar por papel.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  revalidatePath("/", "layout");
  redirect(profile?.role === "cozinha" ? "/cozinha" : "/");
}

/** Faz logout: encerra a sessão no Supabase e volta ao login. */
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}