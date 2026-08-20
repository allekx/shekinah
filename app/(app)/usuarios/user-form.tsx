"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createAppUser } from "@/lib/auth/users";

/** Formulário para criar usuário cozinha ou atendimento. */
export default function UserForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="sk-card p-4">
      <h2 className="mb-3 sk-section-title">Novo usuário</h2>

      <form
        key={formKey}
        action={async (formData) => {
          setError(null);
          setSuccess(null);
          const res = await createAppUser(formData);
          if (res.error) {
            setError(res.error);
            return;
          }
          setSuccess(res.success ?? "Usuário criado.");
          setFormKey((k) => k + 1);
          router.refresh();
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="email" className="sk-label">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="nome@shekinah.com"
            className="sk-input"
          />
        </div>

        <div>
          <label htmlFor="display_name" className="sk-label">
            Nome (opcional)
          </label>
          <input
            id="display_name"
            name="display_name"
            placeholder="Nome para exibição"
            className="sk-input"
          />
        </div>

        <div>
          <label htmlFor="password" className="sk-label">
            Senha inicial
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            className="sk-input"
          />
        </div>

        <div>
          <label htmlFor="role" className="sk-label">
            Tipo de acesso
          </label>
          <select id="role" name="role" required defaultValue="" className="sk-input">
            <option value="" disabled>
              Selecione…
            </option>
            <option value="atendimento">Atendimento (pedidos, caixa, estoque)</option>
            <option value="cozinha">Cozinha (preparo de pedidos)</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="sk-alert-error">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="sk-alert-success">
            {success}
          </p>
        )}

        <button type="submit" className="sk-btn-primary w-full">
          Criar usuário
        </button>
      </form>
    </div>
  );
}
