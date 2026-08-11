"use client";

import { useEffect, useState } from "react";

/** Banner de conexão: avisa quando o celular está sem internet.
 *  O sistema é ONLINE — ao detectar offline, mostra aviso para não
 *  confundir o usuário (ex.: "não confirme como sucesso o que não
 *  chegou ao servidor"). Volta sozinho quando reconecta.
 */
export default function ConnectionBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] bg-red-600 px-4 py-2.5 text-center">
      <p className="text-sm font-bold text-white">
        ⚠️ Sem conexão com a internet
      </p>
      <p className="text-xs text-red-100">
        Aguarde reconectar. Pedidos só são confirmados quando o servidor confirma.
      </p>
    </div>
  );
}