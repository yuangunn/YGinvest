"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  async function cancel() {
    if (!confirm("이 주문을 취소하시겠습니까?")) return;
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) {
      toast.success("주문 취소됨");
      location.reload();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(`취소 실패: ${err.error ?? "오류"}`);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={cancel} disabled={loading}>
      취소
    </Button>
  );
}
