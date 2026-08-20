import { HomeDashboardSkeleton } from "@/components/skeletons/page-skeletons";

/** Skeleton da área autenticada enquanto a rota carrega. */
export default function AppLoading() {
  return (
    <div className="sk-app-main flex-1 py-4">
      <HomeDashboardSkeleton />
    </div>
  );
}
