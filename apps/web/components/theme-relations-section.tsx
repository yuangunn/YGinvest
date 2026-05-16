import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Sparkles, Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getUpstreamThemes,
  getDownstreamThemes,
  STRENGTH_LABEL,
  STRENGTH_COLOR,
  ORDER_LABEL,
  type ThemeRelation,
} from "@/lib/theme-relations";

type ThemeMeta = { slug: string; name: string };

/**
 * Plan #30: 테마 상세 페이지의 "관련주" 섹션.
 * 이 테마가 어디서 영향받고 어디로 파급되는지 supply chain 시각화.
 *
 * @param slug 현재 테마의 slug
 * @param themeMetas 전체 테마 메타 (slug → name 매핑용, 서버 컴포넌트에서 주입)
 */
export function ThemeRelationsSection({
  slug,
  themeMetas,
}: {
  slug: string;
  themeMetas: ThemeMeta[];
}) {
  const upstream = getUpstreamThemes(slug);
  const downstream = getDownstreamThemes(slug);

  if (upstream.length === 0 && downstream.length === 0) return null;

  const metaMap = new Map(themeMetas.map((t) => [t.slug, t]));

  return (
    <>
      {/* Downstream (이 테마가 견인하는 후속 테마) — 더 자주 관심사 */}
      {downstream.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-primary" />
              이 테마가 띄우는 후속 테마 ({downstream.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              이 테마가 강세일 때 함께 부각될 가능성이 있는 산업
            </p>
          </CardHeader>
          <CardContent>
            <RelationsList relations={downstream} metaMap={metaMap} side="child" />
          </CardContent>
        </Card>
      )}

      {/* Upstream (이 테마를 견인하는 상위 테마) */}
      {upstream.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-primary" />
              이 테마를 견인하는 상위 테마 ({upstream.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              이 테마는 다음 테마의 호황이 1·2·3차 파급된 결과
            </p>
          </CardHeader>
          <CardContent>
            <RelationsList relations={upstream} metaMap={metaMap} side="parent" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground flex items-center gap-1">
            <Network className="h-3 w-3" /> 강도 가이드
          </p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>
              <span className="font-semibold text-red-500">강력</span>: 직접 수요/공급 관계, 핵심 부품/소재
            </li>
            <li>
              <span className="font-semibold text-amber-500">중간</span>: 가격/시점 lag 있는 후속 수혜
            </li>
            <li>
              <span className="font-semibold">느슨</span>: 간접 파급, 큰 사이클일 때만 동조
            </li>
          </ul>
          <p className="pt-1">
            ⚠️ 학습용 매핑. 실제 매매는 종목별 펀더멘털 + 거시 환경 같이 검토.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function RelationsList({
  relations,
  metaMap,
  side,
}: {
  relations: ThemeRelation[];
  metaMap: Map<string, ThemeMeta>;
  side: "parent" | "child";
}) {
  return (
    <div className="space-y-2">
      {relations.map((r) => {
        const targetSlug = side === "child" ? r.child : r.parent;
        const meta = metaMap.get(targetSlug);
        const name = meta?.name ?? targetSlug;
        return (
          <Link
            key={`${r.parent}-${r.child}`}
            href={`/app/themes/${encodeURIComponent(targetSlug)}`}
            className="block rounded-md border bg-muted/20 hover:bg-accent hover:border-primary/40 p-2.5 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-medium text-sm flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
                {name}
              </span>
              <div className="flex gap-1 flex-shrink-0">
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STRENGTH_COLOR[r.strength]}`}
                  title={`연관 강도: ${STRENGTH_LABEL[r.strength]}`}
                >
                  {STRENGTH_LABEL[r.strength]}
                </span>
                <span className="inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {ORDER_LABEL[r.order]}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {r.reasoning}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
