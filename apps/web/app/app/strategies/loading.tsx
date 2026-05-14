import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function StrategiesLoading() {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>

      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <div className="space-y-1 pt-2 border-t">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-8" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
