/**
 * Plan #14 — Auth flow에도 동일한 fade-in 전환.
 */
export default function AuthTemplate({
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
