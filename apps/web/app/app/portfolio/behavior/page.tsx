import { redirect } from "next/navigation";
import { Brain } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSelectedPortfolioId } from "@/lib/portfolio-context";

type Trade = {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  currency: string;
  created_at: string;
};

export default async function BehaviorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const portfolioId = await getSelectedPortfolioId(supabase, user.id);
  if (!portfolioId) redirect("/app/portfolio/overview");

  const { data: trades } = await supabase
    .from("trades")
    .select("id, symbol, side, quantity, price, currency, created_at")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: true });

  const rows = (trades as Trade[] | null) ?? [];

  if (rows.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          행동경제학 인사이트
        </h1>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              거래 내역이 없어 행동 분석을 할 수 없습니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 1) 평균 보유기간 (winners vs losers — loss aversion)
  type Lot = { qty: number; price: number; ts: number };
  type Match = { gain: boolean; holdDays: number };
  const positions = new Map<string, Lot[]>();
  const matches: Match[] = [];

  // 일자별 매매 횟수 (자주 사고팔지 분석)
  const tradesByDate = new Map<string, number>();

  // 빠른 매도(매수 후 1일 이내) — emotional / impulsive
  let quickFlipCount = 0;

  for (const t of rows) {
    const ts = new Date(t.created_at).getTime();
    const dateKey = t.created_at.slice(0, 10);
    tradesByDate.set(dateKey, (tradesByDate.get(dateKey) ?? 0) + 1);

    const lots = positions.get(t.symbol) ?? [];
    if (t.side === "buy") {
      lots.push({ qty: Number(t.quantity), price: Number(t.price), ts });
    } else {
      // FIFO match
      let remaining = Number(t.quantity);
      const sellPrice = Number(t.price);
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const match = Math.min(remaining, lot.qty);
        const holdDays = (ts - lot.ts) / 86400000;
        const gain = sellPrice > lot.price;
        matches.push({ gain, holdDays });
        if (holdDays <= 1) quickFlipCount++;
        remaining -= match;
        lot.qty -= match;
        if (lot.qty <= 0) lots.shift();
      }
    }
    positions.set(t.symbol, lots);
  }

  const winners = matches.filter((m) => m.gain);
  const losers = matches.filter((m) => !m.gain);
  const avgWinHold =
    winners.length > 0
      ? winners.reduce((s, m) => s + m.holdDays, 0) / winners.length
      : 0;
  const avgLossHold =
    losers.length > 0
      ? losers.reduce((s, m) => s + m.holdDays, 0) / losers.length
      : 0;

  // Loss aversion 정도: 손실은 이익보다 얼마나 더 오래 들고있는가
  const lossAversionRatio = avgWinHold > 0 ? avgLossHold / avgWinHold : 0;
  const hasLossAversion = avgLossHold > avgWinHold * 1.3 && matches.length >= 5;

  // 거래 빈도
  const tradingDays = tradesByDate.size;
  const firstTradeDate = rows[0].created_at.slice(0, 10);
  const totalDays = Math.max(
    1,
    Math.ceil(
      (new Date().getTime() - new Date(firstTradeDate + "T00:00:00").getTime()) /
        86400000,
    ),
  );
  const tradesPerWeek = (rows.length / totalDays) * 7;
  const maxDayTrades = Math.max(...tradesByDate.values());

  // 영업일 vs 휴장일 매매 (한국 주말 = 주식 휴장)
  const weekendTrades = rows.filter((t) => {
    const d = new Date(t.created_at);
    return d.getDay() === 0 || d.getDay() === 6;
  }).length;
  const weekendRatio = (weekendTrades / rows.length) * 100;

  // 매도 종목 중 손실 매도 비율 (disposition effect의 역지표)
  const sellLossRatio =
    matches.length > 0 ? (losers.length / matches.length) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          행동경제학 인사이트
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          내 매매 패턴 자가 진단 — 흔한 인지편향을 본인이 갖고 있는지 점검.
        </p>
      </div>

      <Card
        className={
          hasLossAversion
            ? "border-amber-500/40 bg-amber-500/5"
            : ""
        }
      >
        <CardHeader>
          <CardTitle className="text-base">손실회피 (Loss Aversion)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Stat
              label="수익 종목 평균 보유"
              value={`${avgWinHold.toFixed(1)}일`}
              hint={`${winners.length}건`}
            />
            <Stat
              label="손실 종목 평균 보유"
              value={`${avgLossHold.toFixed(1)}일`}
              hint={`${losers.length}건`}
            />
          </div>
          <div className="text-sm">
            손실/수익 보유비:{" "}
            <span className="font-mono font-bold tabular-nums">
              {lossAversionRatio.toFixed(2)}x
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {hasLossAversion ? (
              <>
                <strong className="text-amber-500">⚠️ 패턴 감지</strong>: 손실 종목을{" "}
                {lossAversionRatio.toFixed(1)}배 더 오래 들고 있습니다. 이는 전형적인{" "}
                <strong>처분효과(Disposition Effect)</strong>로 — &quot;수익은
                빨리 실현, 손실은 미루기&quot; 패턴. 회복하길 바라며 손절하지
                못하는 심리. 장기적으로 수익률에 부정적.
              </>
            ) : matches.length < 5 ? (
              <>판단할 데이터 부족 — 매매 횟수가 늘어나면 더 정확히 분석됩니다.</>
            ) : (
              <>
                ✅ 수익·손실 보유기간이 비슷합니다. 손실회피 편향 없음.
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <Card
        className={
          tradesPerWeek > 5 || maxDayTrades > 10
            ? "border-amber-500/40 bg-amber-500/5"
            : ""
        }
      >
        <CardHeader>
          <CardTitle className="text-base">과도한 매매 (Overtrading)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat
              label="주당 평균 거래"
              value={`${tradesPerWeek.toFixed(1)}회`}
            />
            <Stat label="최다 거래일" value={`${maxDayTrades}회`} />
            <Stat label="총 거래일" value={`${tradingDays}일`} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {tradesPerWeek > 5 ? (
              <>
                <strong className="text-amber-500">⚠️ 빈번한 거래</strong>: 학술
                연구상 빈번한 매매는 평균적으로 수익률을 깎습니다 (수수료 +
                감정적 실수). 장기 보유 전략(buy-and-hold)이 일반적으로 우수.
              </>
            ) : (
              <>✅ 적정 빈도의 매매입니다.</>
            )}
          </p>
        </CardContent>
      </Card>

      <Card
        className={
          quickFlipCount / Math.max(1, matches.length) > 0.3
            ? "border-amber-500/40 bg-amber-500/5"
            : ""
        }
      >
        <CardHeader>
          <CardTitle className="text-base">충동매매 (Impulsivity)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Stat label="1일 이내 매도" value={`${quickFlipCount}건`} />
            <Stat
              label="전체 매도 중 비율"
              value={`${
                matches.length > 0
                  ? ((quickFlipCount / matches.length) * 100).toFixed(1)
                  : "0"
              }%`}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {quickFlipCount / Math.max(1, matches.length) > 0.3 ? (
              <>
                <strong className="text-amber-500">⚠️ 짧은 보유 빈번</strong>: 매수
                후 1일 내 매도가 30% 이상입니다. 충동매매 가능성. 매수 결정 시
                보유기간을 미리 정하면 도움됨.
              </>
            ) : (
              <>✅ 매수 후 충분히 holding하는 편입니다.</>
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">기타 지표</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="손실 매도 비율"
              value={`${sellLossRatio.toFixed(0)}%`}
              hint="너무 낮으면 손절 회피"
            />
            <Stat
              label="주말 매매 비율"
              value={`${weekendRatio.toFixed(0)}%`}
              hint="주말은 시장 닫힘 → 시장가 X"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="text-xs text-muted-foreground py-3 space-y-2">
          <p className="font-semibold text-foreground">📚 인지편향 가이드</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>
              <strong>Loss Aversion (손실회피)</strong>: 같은 크기의 손실이 이익보다 약 2배 아프게 느껴짐 → 손절을 미루게 됨.
            </li>
            <li>
              <strong>Disposition Effect (처분효과)</strong>: 수익은 빨리 챙기고 손실은 오래 미루는 경향. 결과적으로 wining stock을 일찍 팔고 loser를 오래 들고있게 됨.
            </li>
            <li>
              <strong>Overconfidence (과신)</strong>: 본인 종목 선택 능력 과대평가 → 잦은 매매·집중투자.
            </li>
            <li>
              <strong>Recency Bias (최근 편향)</strong>: 최근 등락에 과반응 → 고점매수·저점매도.
            </li>
            <li>
              <strong>해결책</strong>: 매수 시 손절/익절 가격 미리 정하기, 정기적립 등 시스템화.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-medium tabular-nums">{value}</div>
      {hint && <div className="text-[9px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
