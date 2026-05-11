type Entry = {
  portfolio_id: string;
  display_name: string;
  avatar_url: string | null;
  total_value_krw: number | null;
  return_pct: number | null;
  snapshot_ts: string | null;
};

const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export function LeaderboardTable({
  entries,
  currentUserPortfolioId,
}: {
  entries: Entry[];
  currentUserPortfolioId?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        아직 스냅샷 없음 (워커가 5분 주기로 기록)
      </div>
    );
  }
  return (
    <ol className="space-y-2">
      {entries.map((e, i) => {
        const pct = e.return_pct;
        const total = e.total_value_krw;
        const isMine = e.portfolio_id === currentUserPortfolioId;
        return (
          <li
            key={e.portfolio_id}
            className={`flex items-center justify-between border-b pb-2 ${
              isMine ? "bg-muted/30 px-2 rounded" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm w-6">{i + 1}</span>
              <span className="font-medium">{e.display_name}</span>
            </div>
            <div className="text-right">
              <div
                className={`font-mono ${
                  pct === null ? "" : pct >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {pct === null
                  ? "—"
                  : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
              </div>
              <div className="text-xs text-muted-foreground">
                {total !== null ? KRW.format(total) : "—"}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
