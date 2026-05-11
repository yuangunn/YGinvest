"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RoomCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [krw, setKrw] = useState("100000000");
  const [usd, setUsd] = useState("0");
  const [days, setDays] = useState("30");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const startsAt = new Date().toISOString();
    const endsAt =
      days === "0"
        ? null
        : new Date(Date.now() + Number(days) * 24 * 3600 * 1000).toISOString();
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        starting_krw: Number(krw),
        starting_usd: Number(usd),
        starts_at: startsAt,
        ends_at: endsAt,
        max_members: 10,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/app/rooms/${data.room_id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "오류");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="room-name">방 이름</Label>
        <Input
          id="room-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
        />
      </div>
      <div>
        <Label htmlFor="room-krw">시작 KRW</Label>
        <Input
          id="room-krw"
          type="number"
          min="0"
          required
          value={krw}
          onChange={(e) => setKrw(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="room-usd">시작 USD</Label>
        <Input
          id="room-usd"
          type="number"
          min="0"
          required
          value={usd}
          onChange={(e) => setUsd(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="room-days">기간 (일, 0=무제한)</Label>
        <Input
          id="room-days"
          type="number"
          min="0"
          required
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={submitting} className="w-full">
        방 만들기
      </Button>
    </form>
  );
}
