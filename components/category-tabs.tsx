"use client";

/** Abas de categoria — scroll horizontal confortável no celular. */
export default function CategoryTabs({
  categories,
  active,
  onChange,
  className = "",
}: {
  categories: string[];
  active: string;
  onChange: (category: string) => void;
  className?: string;
}) {
  if (categories.length <= 1) return null;

  return (
    <div
      className={`sk-category-tabs ${className}`.trim()}
      role="tablist"
      aria-label="Categorias de produtos"
    >
      {categories.map((category) => {
        const isActive = active === category;
        return (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(category)}
            className={`sk-category-tab ${isActive ? "sk-category-tab--active" : ""}`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}
