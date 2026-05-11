"use client";

import { useTransition } from "react";

type Portfolio = {
  id: string;
  room_id: string | null;
  status: string;
  rooms: { name: string } | { name: string }[] | null;
};

type Props = {
  portfolios: Portfolio[];
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
      className="bg-background border border-border rounded px-2 py-1 text-sm"
      value={selectedId ?? ""}
      onChange={onChange}
      disabled={isPending}
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
