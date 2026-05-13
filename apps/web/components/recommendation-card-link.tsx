"use client";

import Link from "next/link";
import { trackRecommendationClick } from "@/lib/analytics";

type Props = {
  href: string;
  category: string;
  marketScope?: string;
  symbol: string;
  rank?: number;
  className?: string;
  children: React.ReactNode;
};

export function RecommendationCardLink({
  href,
  category,
  marketScope,
  symbol,
  rank,
  className,
  children,
}: Props) {
  function handleClick() {
    trackRecommendationClick({
      category,
      market_scope: marketScope,
      symbol,
      rank,
    });
  }
  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
