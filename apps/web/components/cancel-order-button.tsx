"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  async function cancel() {
    if (!confirm("이 주문을 취소하시겠습니까?")) return;
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      location.reload();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "취소 실패");
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={cancel} disabled={loading}>
      취소
    </Button>
  );
}
