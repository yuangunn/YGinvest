import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CurationLoading() {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>

      {/* Strong Buy / 저평가 / 모멘텀 / 섹터 카드 4개 */}
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-1">
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className="flex items-center justify-between gap-2 rounded-lg p-2"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="space-y-1 flex-shrink-0">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-12 rounded-md flex-shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
