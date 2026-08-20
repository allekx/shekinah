import { createClient, getRole, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import UserForm from "./user-form";
import UserList from "./user-list";

/** Gestão de usuários (somente john / atendimento). */
export default async function UsuariosPage() {
  if ((await getRole()) !== "john") {
    redirect("/");
  }

  const user = await getUser();
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <PageShell
      title="Usuários"
      subtitle="Crie usuários e altere e-mail, tipo de acesso ou senha."
    >
      <UserForm />
      <UserList users={users ?? []} currentUserId={user!.id} />
    </PageShell>
  );
}
