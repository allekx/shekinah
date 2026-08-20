import { NewOrderSkeleton } from "@/components/skeletons/page-skeletons";

export default function NovoPedidoLoading() {
  return (
    <div className="sk-app-main flex-1 py-4">
      <NewOrderSkeleton />
    </div>
  );
}
