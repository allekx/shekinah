"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { resetAppUserPassword, updateAppUserEmail, updateAppUserRole } from "@/lib/auth/users";

interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  role: "john" | "cozinha";
  created_at: string;
}

type PanelMode = "role" | "password" | "email";

function roleLabel(role: ProfileRow["role"]) {
  return role === "john" ? "Atendimento" : "Cozinha";
}

function roleFormValue(role: ProfileRow["role"]) {
  return role === "john" ? "atendimento" : "cozinha";
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Lista de usuários com edição de e-mail, papel e redefinição de senha. */
export default function UserList({
  users,
  currentUserId,
}: {
  users: ProfileRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<{ id: string; mode: PanelMode } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function openPanel(id: string, mode: PanelMode) {
    setError(null);
    setSuccess(null);
    setPanel({ id, mode });
  }

  function closePanel() {
    setPanel(null);
    setError(null);
  }

  return (
    <section className="sk-card p-4">
      <h2 className="mb-3 sk-section-title">Usuários cadastrados</h2>

      {error && (
        <p role="alert" className="mb-3 sk-alert-error">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="mb-3 sk-alert-success">
          {success}
        </p>
      )}

      <ul className="divide-y divide-neutral-200">
        {users.length === 0 && (
          <li className="py-4 text-center text-sm sk-text-muted">Nenhum usuário cadastrado.</li>
        )}

        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const isOpen = panel?.id === u.id;

          return (
            <li key={u.id} className="py-3">
              {isOpen && panel.mode === "role" ? (
                <form
                  className="space-y-3"
                  action={async (formData) => {
                    const res = await updateAppUserRole(formData);
                    if (res.error) {
                      setError(res.error);
                      setSuccess(null);
                      return;
                    }
                    setError(null);
                    setSuccess(res.success ?? "Tipo de acesso atualizado.");
                    setPanel(null);
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="id" value={u.id} />
                  <p className="text-sm font-semibold text-neutral-900">{u.email}</p>
                  <div>
                    <label htmlFor={`role-${u.id}`} className="sk-label">
                      Tipo de acesso
                    </label>
                    <select
                      id={`role-${u.id}`}
                      name="role"
                      required
                      defaultValue={roleFormValue(u.role)}
                      className="sk-input"
                    >
                      <option value="atendimento">Atendimento (pedidos, caixa, estoque)</option>
                      <option value="cozinha">Cozinha (preparo de pedidos)</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="sk-btn-primary">
                      Salvar papel
                    </button>
                    <button type="button" onClick={closePanel} className="sk-btn-secondary">
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : isOpen && panel.mode === "email" ? (
                <form
                  className="space-y-3"
                  action={async (formData) => {
                    const res = await updateAppUserEmail(formData);
                    if (res.error) {
                      setError(res.error);
                      setSuccess(null);
                      return;
                    }
                    setError(null);
                    setSuccess(res.success ?? "E-mail atualizado.");
                    setPanel(null);
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="id" value={u.id} />
                  <div>
                    <label htmlFor={`email-${u.id}`} className="sk-label">
                      E-mail
                    </label>
                    <input
                      id={`email-${u.id}`}
                      name="email"
                      type="email"
                      required
                      autoComplete="off"
                      defaultValue={u.email}
                      placeholder="nome@shekinah.com"
                      className="sk-input"
                    />
                  </div>
                  {isSelf && (
                    <p className="text-xs sk-text-muted">
                      Ao alterar seu próprio e-mail, faça login novamente com o novo endereço.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" className="sk-btn-primary">
                      Salvar e-mail
                    </button>
                    <button type="button" onClick={closePanel} className="sk-btn-secondary">
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : isOpen && panel.mode === "password" ? (
                <form
                  className="space-y-3"
                  action={async (formData) => {
                    const res = await resetAppUserPassword(formData);
                    if (res.error) {
                      setError(res.error);
                      setSuccess(null);
                      return;
                    }
                    setError(null);
                    setSuccess(res.success ?? "Senha redefinida.");
                    setPanel(null);
                    router.refresh();
                  }}
                >
                  <input type="hidden" name="id" value={u.id} />
                  <p className="text-sm font-semibold text-neutral-900">{u.email}</p>
                  <div>
                    <label htmlFor={`password-${u.id}`} className="sk-label">
                      Nova senha
                    </label>
                    <input
                      id={`password-${u.id}`}
                      name="password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Mínimo 6 caracteres"
                      className="sk-input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="sk-btn-primary">
                      Redefinir senha
                    </button>
                    <button type="button" onClick={closePanel} className="sk-btn-secondary">
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {u.display_name ?? u.email}
                      {isSelf && (
                        <span className="ml-1.5 sk-badge sk-badge--info">você</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {u.display_name ? `${u.email} · ` : ""}
                      {fmtDate(u.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                    <span
                      className={`sk-badge ${u.role === "john" ? "sk-badge--info" : "sk-badge--neutral"}`}
                    >
                      {roleLabel(u.role)}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openPanel(u.id, "email")}
                        className="sk-btn-ghost text-xs"
                      >
                        E-mail
                      </button>
                      <button
                        type="button"
                        disabled={isSelf}
                        title={isSelf ? "Você não pode alterar seu próprio papel" : undefined}
                        onClick={() => openPanel(u.id, "role")}
                        className="sk-btn-ghost text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Papel
                      </button>
                      <button
                        type="button"
                        onClick={() => openPanel(u.id, "password")}
                        className="sk-btn-ghost text-xs"
                      >
                        Senha
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
