import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LearnLoading() {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-12" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
