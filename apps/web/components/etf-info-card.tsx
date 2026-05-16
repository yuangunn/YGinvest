// Plan #32: ETF 메타 정보 카드 (운용보수 / AUM / 추종지수 / 카테고리).

import { TrendingUp, Building2, BookOpen, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ETF_CATEGORY_LABEL,
  ETF_CATEGORY_COLOR,
  formatExpenseRatio,
  formatAum,
  rateExpenseRatio,
} from "@/lib/etf-labels";

type Props = {
  category: string | null;
  fundFamily: string | null;
  underlyingIndex: string | null;
  expenseRatio: number | null;
  aum: number | null;
  inceptionDate: string | null;
  currency: string;
};

export function EtfInfoCard({
  category,
  fundFamily,
  underlyingIndex,
  expenseRatio,
  aum,
  inceptionDate,
  currency,
}: Props) {
  const catLabel = category ? ETF_CATEGORY_LABEL[category] ?? category : "—";
  const catColor = category ? ETF_CATEGORY_COLOR[category] ?? "" : "";
  const rating = rateExpenseRatio(expenseRatio);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          ETF 정보
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {/* 카테고리 */}
          <div>
            <div className="text-xs text-muted-foreground">카테고리</div>
            {category ? (
              <span
                className={`inline-block mt-0.5 text-xs rounded border px-1.5 py-0.5 ${catColor}`}
              >
                {catLabel}
              </span>
            ) : (
              <div className="font-medium text-muted-foreground mt-0.5">—</div>
            )}
          </div>

          {/* 운용사 */}
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" /> 운용사
            </div>
            <div className="font-medium mt-0.5">{fundFamily ?? "—"}</div>
          </div>

          {/* 추종 지수 */}
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <BookOpen className="h-3 w-3" /> 추종 지수
            </div>
            <div className="font-medium mt-0.5">{underlyingIndex ?? "—"}</div>
          </div>

          {/* 운용보수 */}
          <div>
            <div className="text-xs text-muted-foreground">운용보수 (연)</div>
            <div className="font-medium tabular-nums mt-0.5">
              {formatExpenseRatio(expenseRatio)}
            </div>
            <div className={`text-[10px] mt-0.5 ${rating.color}`}>
              {rating.label}
            </div>
          </div>

          {/* AUM */}
          <div>
            <div className="text-xs text-muted-foreground">운용자산 (AUM)</div>
            <div className="font-medium tabular-nums mt-0.5">
              {formatAum(aum, currency)}
            </div>
          </div>

          {/* 설정일 */}
          {inceptionDate && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> 설정일
              </div>
              <div className="font-medium mt-0.5">
                {new Date(inceptionDate).toLocaleDateString("ko-KR")}
                <span className="text-xs text-muted-foreground ml-1">
                  ({yearsAgo(inceptionDate)}년 운용)
                </span>
              </div>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t">
          💡 운용보수는 매년 자동 차감됨. 0.05% 이하면 매우 저렴, 1% 이상은
          액티브/레버리지 ETF 가능성 ↑
        </p>
      </CardContent>
    </Card>
  );
}

function yearsAgo(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24 * 365.25));
}
