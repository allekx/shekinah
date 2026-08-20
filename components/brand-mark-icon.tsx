/** Ícone da marca — sítio + cozinha + pedido. */
export default function BrandMarkIcon({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 20.5h18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.5 20V12.2L12 7.5l5.5 4.7V20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 12.2h11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14.3 9.4c.55-.75 1.35-.75 1.9 0 .55.75.55 1.5 0 2.25"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <ellipse
        cx="12"
        cy="17.8"
        rx="3.2"
        ry="0.9"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10.2 16.2h3.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15.5" r="0.55" fill="currentColor" />
    </svg>
  );
}
