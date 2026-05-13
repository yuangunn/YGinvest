"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { offlineFetch } from "@/lib/offline-fetch";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  async function cancel() {
    if (!confirm("이 주문을 취소하시겠습니까?")) return;
    setLoading(true);
    const result = await offlineFetch(`/api/orders/${orderId}`, {
      method: "DELETE",
    });
    setLoading(false);
    if (result.status === "ok") {
      toast.success("주문 취소됨");
      location.reload();
    } else if (result.status === "queued") {
      toast.info("오프라인 — 연결 시 취소 요청 전송됩니다");
    } else {
      toast.error(`취소 실패: ${result.error}`);
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={cancel} disabled={loading}>
      취소
    </Button>
  );
}
