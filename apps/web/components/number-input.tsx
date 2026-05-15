"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * Plan #27.1: 천 단위 콤마 표시 + spinner 버튼 제거된 금액 입력.
 * Plan #27.4: 내부 텍스트 state로 소수점 입력 보존.
 *
 * 이전 버그:
 *   "3." 입력 → onChange로 3 emit → 부모 value 3 → format 결과 "3" → 점이 사라짐.
 * 해결:
 *   내부에 text state를 유지하여 "3." "3.5" "3.50" 같은 중간 상태를 보존.
 *   외부 value가 사용자 입력과 무관하게 바뀌었을 때만 re-format.
 */
type Props = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: number;
  onChange: (n: number) => void;
  /** 소수점 허용 (기본 false, 정수만) */
  allowDecimal?: boolean;
  /** 음수 허용 (기본 false) */
  allowNegative?: boolean;
};

function formatForDisplay(n: number, allowDecimal: boolean): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: allowDecimal ? 8 : 0,
  });
}

function parseToNumber(s: string): number {
  const cleaned = s.replace(/,/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.")
    return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 사용자 입력 raw를 정제해 표시용 텍스트 생성.
 * 중간 상태 ("3.", "3.50", "-")를 보존.
 */
function sanitizeAndFormat(
  raw: string,
  allowDecimal: boolean,
  allowNegative: boolean,
): string {
  // 1) 허용 문자만 (digits, dot, minus, comma)
  let cleaned = raw.replace(/[^\d.\-,]/g, "").replace(/,/g, "");
  if (!allowDecimal) cleaned = cleaned.replace(/\./g, "");
  // 2) minus 처리 — 앞에만 한 번
  let neg = "";
  if (allowNegative && cleaned.startsWith("-")) {
    neg = "-";
  }
  cleaned = cleaned.replace(/-/g, "");
  // 3) dot 처리 — 첫 번째 dot만 유지
  if (allowDecimal) {
    const firstDot = cleaned.indexOf(".");
    if (firstDot >= 0) {
      cleaned =
        cleaned.slice(0, firstDot + 1) +
        cleaned.slice(firstDot + 1).replace(/\./g, "");
    }
  }
  if (cleaned === "") return neg; // "-" 또는 ""
  // 4) 정수 부분에만 콤마, 소수 부분은 그대로
  if (cleaned.includes(".")) {
    const [intPart, decPart] = cleaned.split(".");
    const intFormatted =
      intPart === "" ? "" : Number(intPart).toLocaleString("en-US");
    return neg + intFormatted + "." + (decPart ?? "");
  }
  return neg + Number(cleaned).toLocaleString("en-US");
}

export function NumberInput({
  value,
  onChange,
  allowDecimal = false,
  allowNegative = false,
  className,
  ...rest
}: Props) {
  // 내부 텍스트 state — 사용자가 보는 그대로
  const [text, setText] = useState<string>(() =>
    formatForDisplay(value, allowDecimal),
  );
  // 마지막으로 우리가 emit한 number 추적 (부모가 외부에서 value 변경했는지 판별)
  const lastEmittedRef = useRef<number>(value);

  // 외부 value 변화가 user-typing 결과가 아니면 text 재동기화
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    setText(formatForDisplay(value, allowDecimal));
    lastEmittedRef.current = value;
  }, [value, allowDecimal]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = sanitizeAndFormat(
      e.target.value,
      allowDecimal,
      allowNegative,
    );
    setText(formatted);
    const n = parseToNumber(formatted);
    lastEmittedRef.current = n;
    if (n !== value) onChange(n);
  }

  return (
    <Input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={text}
      onChange={handleChange}
      className={className}
      {...rest}
    />
  );
}
