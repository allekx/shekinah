"use client";

import { useEffect } from "react";

/** Registra o Service Worker do PWA (manual, sem plugin — compatível
 *  com Turbopack/Next 16). Habilita a instalação como app no Android.
 */
export default function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW não é obrigatório — sistema segue online normalmente */
      });
    }
  }, []);
  return null;
}