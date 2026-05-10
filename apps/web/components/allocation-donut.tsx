"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

type Slice = {
  name: string;
  value: number;
};

const COLORS = ["#26a69a", "#f59e0b", "#a78bfa", "#ef5350", "#60a5fa", "#fbbf24", "#34d399", "#f472b6"];

export function AllocationDonut({ slices }: { slices: Slice[] }) {
  if (slices.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">자산 없음</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {slices.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => Number(v ?? 0).toLocaleString("ko-KR") + " KRW"}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
