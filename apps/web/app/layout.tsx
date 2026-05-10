import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YGinvest",
  description: "모의 주식 트레이딩 — 한국·미국 거래소",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
