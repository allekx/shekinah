import BrandMarkIcon from "@/components/brand-mark-icon";

/** Marca Shekinah — ícone + logotipo (mesmo padrão do login). */
export default function BrandWordmark({
  variant = "dark",
  iconSize = "md",
  subtitle,
}: {
  variant?: "light" | "dark";
  iconSize?: "sm" | "md";
  subtitle?: string;
}) {
  const isLight = variant === "light";
  const boxClass =
    iconSize === "sm" ? "h-9 w-9 shrink-0 rounded-xl" : "h-11 w-11 shrink-0 rounded-xl";
  const iconClass = iconSize === "sm" ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex ${boxClass} items-center justify-center ${
          isLight
            ? "border border-white/25 bg-white/15 text-white backdrop-blur-sm"
            : "bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-sm shadow-primary-600/20"
        }`}
        aria-hidden
      >
        <BrandMarkIcon className={iconClass} />
      </div>
      <div className="min-w-0 leading-tight">
        <p
          className={`text-sm font-semibold tracking-[0.18em] uppercase ${
            isLight ? "text-white/90" : "text-neutral-900"
          }`}
        >
          Shekinah
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[11px] font-medium text-neutral-500">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
