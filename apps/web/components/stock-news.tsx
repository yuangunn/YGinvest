"use client";

import { useEffect, useState } from "react";

type NewsItem = {
  title: string;
  link: string;
  publisher: string;
  published_at: string | null;
};

export function StockNews({ symbol }: { symbol: string }) {
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/stocks/${encodeURIComponent(symbol)}/news?limit=5`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => {
        if (!cancelled) setNews(data.news ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (error) return <div className="text-sm text-muted-foreground">뉴스 불러오기 실패</div>;
  if (!news) return <div className="text-sm text-muted-foreground">뉴스 로딩 중...</div>;
  if (news.length === 0) return <div className="text-sm text-muted-foreground">뉴스 없음</div>;

  return (
    <ul className="space-y-2 text-sm">
      {news.map((n, i) => (
        <li key={i} className="border-b pb-2">
          <a href={n.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
            <div className="font-medium">{n.title}</div>
            <div className="text-xs text-muted-foreground">
              {n.publisher} · {n.published_at ? new Date(n.published_at).toLocaleString("ko-KR") : ""}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
