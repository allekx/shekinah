import { KanbanSkeleton } from "@/components/skeletons/page-skeletons";

export default function CozinhaLoading() {
  return (
    <div className="sk-app-main flex-1 py-4">
      <KanbanSkeleton columns={3} />
    </div>
  );
}
