import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Plan #27 B5: 일관된 빈 상태 표시.
 *
 * @example
 *   <EmptyState
 *     Icon={Wallet}
 *     title="아직 보유 종목이 없어요"
 *     description="검색해서 첫 매수를 해보세요"
 *     action={{ label: "종목 검색", href: "/app/trade/search" }}
 *   />
 */
export function EmptyState({
  Icon,
  title,
  description,
  action,
  secondaryAction,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}) {
  return (
    <div className="text-center py-8 px-4 space-y-3">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          {description}
        </p>
      </div>
      {(action || secondaryAction) && (
        <div className="flex gap-2 justify-center pt-1">
          {action && (
            <Link
              href={action.href}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {action.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="inline-flex items-center gap-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
