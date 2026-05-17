"use client";

// Plan #40: 자산 추이 차트 — game_diary cash_delta 누적.

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Entry = {
  game_day: number;
  cash_delta: number;
};

type Point = {
  day: number;
  cash: number;
};

export function AssetChart({
  startingCash,
  currentCash,
}: {
  startingCash: number;
  currentCash: number;
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/game/diary?limit=500");
      if (cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      const entries = (data.entries ?? []) as Entry[];
      // game_day별로 cash_delta 누적
      const byDay = new Map<number, number>();
      for (const e of entries) {
        byDay.set(e.game_day, (byDay.get(e.game_day) ?? 0) + Number(e.cash_delta));
      }
      const sortedDays = Array.from(byDay.keys()).sort((a, b) => a - b);
      const result: Point[] = [{ day: 0, cash: startingCash }];
      let acc = startingCash;
      for (const d of sortedDays) {
        acc += byDay.get(d) ?? 0;
        result.push({ day: d, cash: acc });
      }
      setPoints(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [startingCash]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-xs text-muted-foreground">차트 로딩...</CardContent>
      </Card>
    );
  }

  if (points.length < 2) return null;

  const rebirthCash = startingCash * 1.05;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          자산 추이
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tickFormatter={(d) => `D+${d}`}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => `${Math.round(v / 10000)}만`}
                tick={{ fontSize: 10 }}
                width={50}
              />
              <Tooltip
                formatter={(v) => [`${Number(v).toLocaleString()}원`, "현금"]}
                labelFormatter={(d) => `D+${d}`}
                contentStyle={{ fontSize: 11 }}
              />
              <ReferenceLine
                y={rebirthCash}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{ value: "환생 5%", fontSize: 9, fill: "#10b981" }}
              />
              <Line
                type="monotone"
                dataKey="cash"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>시작: {(startingCash / 10000).toFixed(0)}만원</span>
          <span>현재: {(currentCash / 10000).toFixed(0)}만원</span>
          <span>
            수익률: {((currentCash - startingCash) / startingCash * 100).toFixed(2)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
