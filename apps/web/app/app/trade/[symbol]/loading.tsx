import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div style={{ paddingBottom: 16 }} className="space-y-4">
      {/* 헤더 */}
      <div className="px-5 pt-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-24 mt-2" />
      </div>

      {/* 가격 hero 카드 */}
      <div className="mx-5">
        <div className="yg-card yg-card-lg" style={{ padding: 22 }}>
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-4 w-28 mt-3" />
          <Skeleton className="h-2 w-full mt-4" />
        </div>
      </div>

      {/* 차트 자리 */}
      <div className="mx-5">
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>

      {/* 매수/매도 버튼 자리 */}
      <div className="mx-5 flex gap-2">
        <Skeleton className="h-12 flex-1 rounded-lg" />
        <Skeleton className="h-12 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
