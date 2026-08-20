"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  skeletonVariantForPath,
  type NavSkeletonVariant,
} from "@/lib/navigation-skeleton";
import {
  CashierSkeleton,
  GenericListSkeleton,
  HomeDashboardSkeleton,
  KanbanSkeleton,
  NewOrderSkeleton,
  OpenDaySkeleton,
  ProductListSkeleton,
  ReportSkeleton,
} from "@/components/skeletons/page-skeletons";

interface PendingNavigation {
  href: string;
  variant: NavSkeletonVariant;
}

interface NavigationContextValue {
  navigate: (href: string, variant?: NavSkeletonVariant) => void;
  startPending: (variant?: NavSkeletonVariant) => void;
  pendingHref: string | null;
  isNavigating: boolean;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

function NavigationSkeleton({ variant }: { variant: NavSkeletonVariant }) {
  switch (variant) {
    case "home":
      return <HomeDashboardSkeleton />;
    case "open-day":
      return <OpenDaySkeleton />;
    case "new-order":
      return <NewOrderSkeleton />;
    case "kanban-4":
      return <KanbanSkeleton columns={4} />;
    case "kanban-3":
      return <KanbanSkeleton columns={3} />;
    case "cashier":
      return <CashierSkeleton />;
    case "product-list":
      return (
        <div className="space-y-5">
          <ProductListSkeleton rows={8} />
        </div>
      );
    case "report":
      return <ReportSkeleton />;
    default:
      return <GenericListSkeleton />;
  }
}

function NavigationSkeletonOverlay({ variant }: { variant: NavSkeletonVariant }) {
  return (
    <div
      className="sk-nav-overlay fixed inset-0 z-20 overflow-y-auto bg-[var(--background)]"
      role="status"
      aria-live="polite"
      aria-label="Carregando página"
    >
      <div className="sk-app-main">
        <NavigationSkeleton variant={variant} />
      </div>
    </div>
  );
}

export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const navigatingRef = useRef(false);

  useEffect(() => {
    navigatingRef.current = false;
    setPending(null);
  }, [pathname]);

  const startPending = useCallback((variant?: NavSkeletonVariant) => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    setPending({
      href: "",
      variant: variant ?? "generic-list",
    });
  }, []);

  const navigate = useCallback(
    (href: string, variant?: NavSkeletonVariant) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      setPending({
        href,
        variant: variant ?? skeletonVariantForPath(href),
      });
      router.push(href);
    },
    [router]
  );

  return (
    <NavigationContext.Provider
      value={{
        navigate,
        startPending,
        pendingHref: pending?.href ?? null,
        isNavigating: pending !== null,
      }}
    >
      {children}
      {pending && <NavigationSkeletonOverlay variant={pending.variant} />}
    </NavigationContext.Provider>
  );
}

function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation deve ser usado dentro de NavigationPendingProvider");
  }
  return ctx;
}

export function useSkNavigate() {
  const { navigate } = useNavigation();
  return navigate;
}

export function useNavigationPending() {
  return useNavigation();
}

interface SkNavLinkProps extends Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
> {
  href: string;
  skeleton?: NavSkeletonVariant;
}

/** Link com skeleton instantâneo no clique — evita duplo toque enquanto a rota carrega. */
export function SkNavLink({
  href,
  skeleton,
  className = "",
  children,
  ...props
}: SkNavLinkProps) {
  const { navigate, isNavigating, pendingHref } = useNavigation();
  const isThis = pendingHref === href;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (isNavigating) return;
    navigate(href, skeleton);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-busy={isThis || undefined}
      className={`${className}${isNavigating ? " pointer-events-none" : ""}`}
      {...props}
    >
      {children}
    </a>
  );
}
