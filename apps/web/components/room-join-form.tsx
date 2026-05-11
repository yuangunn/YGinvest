"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RoomJoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: code.toUpperCase().trim() }),
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
        <Label htmlFor="invite-code">초대 코드 (6자)</Label>
        <Input
          id="invite-code"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          placeholder="예: AB7K9P"
          className="font-mono text-lg"
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="submit"
        disabled={submitting || code.length !== 6}
        className="w-full"
      >
        가입
      </Button>
    </form>
  );
}
