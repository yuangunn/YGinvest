"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";

/**
 * Plan #27.1: 천 단위 콤마 표시 + spinner 버튼 제거된 금액 입력 컴포넌트.
 *
 * - type="text" + inputMode="numeric" → 모바일에서 숫자 키패드 + 위/아래 버튼 X
 * - 입력값은 항상 number로 부모에 전달 (콤마 자동 제거)
 * - 빈 값은 0으로 처리
 *
 * @example
 *   <NumberInput value={amount} onChange={setAmount} />
 *   → 화면: "1,000,000"  부모: number 1000000
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

function formatWithCommas(n: number, allowDecimal: boolean): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "";
  return n.toLocaleString("en-US", {
    maximumFractionDigits: allowDecimal ? 6 : 0,
  });
}

function parseInput(
  raw: string,
  allowDecimal: boolean,
  allowNegative: boolean,
): number {
  if (!raw) return 0;
  // strip everything but digits, dot, minus
  let cleaned = raw.replace(/,/g, "");
  if (!allowDecimal) cleaned = cleaned.replace(/\./g, "");
  if (!allowNegative) cleaned = cleaned.replace(/-/g, "");
  // 음수는 앞에 한 번만, 소수점도 한 번만 유효
  cleaned = cleaned.replace(/[^\d.\-]/g, "");
  // 잘못된 위치의 -와 중복 .는 정리
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function NumberInput({
  value,
  onChange,
  allowDecimal = false,
  allowNegative = false,
  className,
  ...rest
}: Props) {
  const id = useId();
  const displayValue = formatWithCommas(value, allowDecimal);
  return (
    <Input
      id={rest.id ?? id}
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      value={displayValue}
      onChange={(e) =>
        onChange(parseInput(e.target.value, allowDecimal, allowNegative))
      }
      className={className}
      {...rest}
    />
  );
}
