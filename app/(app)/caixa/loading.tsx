import { CashierSkeleton } from "@/components/skeletons/page-skeletons";

export default function CaixaLoading() {
  return (
    <div className="sk-app-main flex-1 py-4">
      <CashierSkeleton />
    </div>
  );
}
