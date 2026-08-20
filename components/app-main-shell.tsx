"use client";

import { NavigationPendingProvider } from "@/components/navigation-pending";

/** Envolve o conteúdo autenticado com feedback visual de navegação. */
export default function AppMainShell({ children }: { children: React.ReactNode }) {
  return <NavigationPendingProvider>{children}</NavigationPendingProvider>;
}
