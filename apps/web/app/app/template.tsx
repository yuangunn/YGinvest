/**
 * Plan #14 — 페이지 전환 애니메이션 (subtle fade + 1px upward slide).
 *
 * Next.js App Router의 `template.tsx`는 layout.tsx와 다르게 매 네비게이션마다
 * 새 인스턴스로 마운트되므로 enter animation이 매번 발사됨. 200ms로 짧게 잡아서
 * 사용자가 답답하지 않도록 함.
 *
 * tw-animate-css의 tailwindcss-animate 호환 utility 사용.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
      {children}
    </div>
  );
}
