"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getRole, getUser } from "@/lib/supabase/server";

export interface UserActionResult {
  error?: string;
  success?: string;
}

type AppRole = "john" | "cozinha";

function parseRole(raw: string): AppRole | null {
  if (raw === "atendimento" || raw === "john") return "john";
  if (raw === "cozinha") return "cozinha";
  return null;
}

function roleDisplay(role: AppRole) {
  return role === "john" ? "Atendimento" : "Cozinha";
}

async function assertJohn(): Promise<UserActionResult | null> {
  if ((await getRole()) !== "john") {
    return { error: "Você não tem permissão para gerenciar usuários." };
  }
  return null;
}

function adminUnavailable(): UserActionResult {
  return {
    error: "Servidor não configurado para esta ação. Adicione SUPABASE_SERVICE_ROLE_KEY ao .env.local.",
  };
}

function getAdminClient() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function parseUserId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "").trim();
  return id || null;
}

function parseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  return email;
}

function duplicateEmailMessage(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return msg.includes("already") || msg.includes("registered") || msg.includes("duplicate");
}

/** Cria um novo usuário (cozinha ou atendimento). Somente john. */
export async function createAppUser(formData: FormData): Promise<UserActionResult> {
  const denied = await assertJohn();
  if (denied) return denied;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim() || null;
  const role = parseRole(String(formData.get("role") ?? ""));

  if (!email) return { error: "Informe o e-mail." };
  if (!email.includes("@")) return { error: "E-mail inválido." };
  if (password.length < 6) return { error: "A senha deve ter pelo menos 6 caracteres." };
  if (!role) return { error: "Selecione o tipo de usuário." };

  const admin = getAdminClient();
  if (!admin) return adminUnavailable();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (duplicateEmailMessage(error.message)) {
      return { error: "Este e-mail já está cadastrado." };
    }
    return { error: "Não foi possível criar o usuário. Tente novamente." };
  }

  if (!data.user) {
    return { error: "Não foi possível criar o usuário." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ role, display_name: displayName })
    .eq("id", data.user.id);

  if (profileError) {
    return { error: "Usuário criado, mas não foi possível definir o perfil." };
  }

  revalidatePath("/usuarios", "layout");
  return {
    success: `Usuário ${email} criado como ${roleDisplay(role)}.`,
  };
}

/** Altera o tipo de acesso de um usuário. Somente john. */
export async function updateAppUserRole(formData: FormData): Promise<UserActionResult> {
  const denied = await assertJohn();
  if (denied) return denied;

  const userId = parseUserId(formData);
  const role = parseRole(String(formData.get("role") ?? ""));

  if (!userId) return { error: "Usuário inválido." };
  if (!role) return { error: "Selecione o tipo de acesso." };

  const currentUser = await getUser();
  if (currentUser?.id === userId) {
    return { error: "Você não pode alterar seu próprio tipo de acesso." };
  }

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .single();

  if (!target) return { error: "Usuário não encontrado." };

  if (target.role === "john" && role === "cozinha") {
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "john");

    if (count === 1) {
      return { error: "Não é possível remover o único usuário de atendimento." };
    }
  }

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);

  if (error) {
    return { error: "Não foi possível atualizar o tipo de acesso." };
  }

  revalidatePath("/usuarios", "layout");
  return {
    success: `${target.email} agora é ${roleDisplay(role)}.`,
  };
}

/** Redefine a senha de um usuário. Somente john (Admin API). */
export async function resetAppUserPassword(formData: FormData): Promise<UserActionResult> {
  const denied = await assertJohn();
  if (denied) return denied;

  const userId = parseUserId(formData);
  const password = String(formData.get("password") ?? "");

  if (!userId) return { error: "Usuário inválido." };
  if (password.length < 6) return { error: "A senha deve ter pelo menos 6 caracteres." };

  const admin = getAdminClient();
  if (!admin) return adminUnavailable();

  const { data: target } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (!target) return { error: "Usuário não encontrado." };

  const { error } = await admin.auth.admin.updateUserById(userId, { password });

  if (error) {
    return { error: "Não foi possível redefinir a senha." };
  }

  revalidatePath("/usuarios", "layout");
  return {
    success: `Senha de ${target.email} redefinida.`,
  };
}

/** Altera o e-mail de um usuário. Somente john (Admin API + sync em profiles). */
export async function updateAppUserEmail(formData: FormData): Promise<UserActionResult> {
  const denied = await assertJohn();
  if (denied) return denied;

  const userId = parseUserId(formData);
  const email = parseEmail(String(formData.get("email") ?? ""));

  if (!userId) return { error: "Usuário inválido." };
  if (!email) return { error: "Informe um e-mail válido." };

  const admin = getAdminClient();
  if (!admin) return adminUnavailable();

  const { data: target } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (!target) return { error: "Usuário não encontrado." };

  if (target.email === email) {
    return { error: "O e-mail informado é igual ao atual." };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });

  if (authError) {
    if (duplicateEmailMessage(authError.message)) {
      return { error: "Este e-mail já está cadastrado." };
    }
    return { error: "Não foi possível alterar o e-mail." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ email })
    .eq("id", userId);

  if (profileError) {
    return { error: "E-mail alterado no login, mas não foi possível atualizar o perfil." };
  }

  revalidatePath("/usuarios", "layout");
  return {
    success: `E-mail atualizado para ${email}.`,
  };
}
