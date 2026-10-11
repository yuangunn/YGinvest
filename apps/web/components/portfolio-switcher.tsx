"use client";

// 포트폴리오 전환 셀렉트 — 글로벌 ↔ 친구방 포트폴리오.
// 선택은 /api/portfolio/select 가 쿠키(yginvest_portfolio)로 저장하고,
// 서버 페이지들은 getSelectedPortfolioId 로 읽는다. 헤더(yg-app-header)에 장착.

import { useTransition } from "react";

export type SwitchablePortfolio = {
  id: string;
  room_id: string | null;
  status: string;
  rooms: { name: string } | { name: string }[] | null;
};

type Props = {
  portfolios: SwitchablePortfolio[];
  selectedId: string | null;
};

export function PortfolioSwitcher({ portfolios, selectedId }: Props) {
  const [isPending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const portfolio_id = e.target.value;
    startTransition(async () => {
      const res = await fetch("/api/portfolio/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio_id }),
      });
      if (res.ok) {
        location.reload();
      }
    });
  }

  if (portfolios.length === 0) return null;

  return (
    <select
      aria-label="포트폴리오 선택"
      value={selectedId ?? ""}
      onChange={onChange}
      disabled={isPending}
      style={{
        maxWidth: 140,
        padding: "4px 8px",
        borderRadius: 8,
        border: "1px solid var(--yg-line-faint)",
        background: "var(--yg-bg-card)",
        color: "var(--yg-fg-primary)",
        fontSize: 12,
        fontWeight: 600,
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {portfolios.map((p) => {
        const room = Array.isArray(p.rooms) ? p.rooms[0] : p.rooms;
        const label = p.room_id
          ? `방: ${room?.name ?? p.room_id.slice(0, 6)}${p.status === "ended" ? " (종료)" : ""}`
          : "글로벌";
        return (
          <option key={p.id} value={p.id}>
            {label}
          </option>
        );
      })}
    </select>
  );
}
