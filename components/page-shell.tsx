import BackButton from "@/components/back-button";

/** Cabeçalho padrão das páginas internas (mobile-first, responsivo). */
export default function PageShell({
  title,
  subtitle,
  children,
  className = "",
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`sk-page ${className}`.trim()}>
      <header className="sk-page-header flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton />
          <div className="min-w-0">
            <h1>{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm sk-text-muted">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
