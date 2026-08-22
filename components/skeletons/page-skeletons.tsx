/** Skeletons alinhados ao design system `sk-*` — animação suave, sem layout shift. */

function Bone({ className = "" }: { className?: string }) {
  return <div className={`sk-skeleton ${className}`} aria-hidden />;
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Bone className="h-8 w-40 rounded-lg" />
      <Bone className="h-4 w-56 rounded-md" />
    </div>
  );
}

export function MetricCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="sk-card p-4">
          <Bone className="mb-2 h-3 w-16 rounded" />
          <Bone className="h-7 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function ProductListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="sk-card p-4">
      <Bone className="mb-4 h-4 w-24 rounded" />
      <ul className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="sk-list-row flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-3/4 max-w-[12rem] rounded" />
              <Bone className="h-3 w-20 rounded" />
            </div>
            <div className="flex shrink-0 gap-1">
              <Bone className="h-9 w-9 rounded-xl" />
              <Bone className="h-9 w-14 rounded-xl" />
              <Bone className="h-9 w-9 rounded-xl" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CategoryTabsSkeleton() {
  return (
    <div className="sk-category-tabs pointer-events-none" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="sk-skeleton h-10 w-[5.5rem] shrink-0 rounded-full" />
      ))}
    </div>
  );
}

export function KanbanSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <div className={`sk-kanban sk-kanban--${columns}`}>
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="sk-card p-3">
          <Bone className="mb-3 h-4 w-28 rounded" />
          <div className="space-y-2">
            {Array.from({ length: col === 0 ? 2 : 1 }).map((_, row) => (
              <div key={row} className="sk-card p-3 space-y-2">
                <Bone className="h-6 w-16 rounded" />
                <Bone className="h-4 w-32 rounded" />
                <Bone className="h-3 w-full rounded" />
                <Bone className="h-3 w-4/5 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HomeDashboardSkeleton() {
  return (
    <div className="space-y-5 pb-8 pt-4">
      <Bone className="h-36 w-full rounded-[1.75rem]" />
      <MetricCardsSkeleton />
      <div className="sk-card p-4">
        <Bone className="mb-3 h-4 w-28 rounded" />
        <div className="space-y-2">
          <Bone className="h-10 w-full rounded-xl" />
          <Bone className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function NewOrderSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="sk-card p-4">
        <Bone className="mb-2 h-4 w-28 rounded" />
        <Bone className="h-12 w-full rounded-xl" />
      </div>
      <CategoryTabsSkeleton />
      <ProductListSkeleton rows={6} />
    </div>
  );
}

export function CashierSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="sk-card p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Bone className="h-4 w-32 rounded" />
            <Bone className="h-4 w-20 rounded" />
          </div>
        ))}
      </div>
      <ProductListSkeleton rows={3} />
    </div>
  );
}

export function GenericListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="sk-card flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-40 max-w-[12rem] rounded" />
              <Bone className="h-3 w-24 rounded" />
            </div>
            <Bone className="h-8 w-16 shrink-0 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <div className="sk-card space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-1">
            <Bone className="h-4 w-36 rounded" />
            <Bone className="h-4 w-20 rounded" />
          </div>
        ))}
      </div>
      <Bone className="h-12 w-full rounded-2xl" />
    </div>
  );
}

export function OpenDaySkeleton() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <ProductListSkeleton rows={8} />
      <Bone className="h-14 w-full rounded-2xl" />
    </div>
  );
}
