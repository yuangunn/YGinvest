import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/app/dashboard"
      className="flex items-center gap-2 font-semibold"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
        aria-hidden
      >
        <rect width="28" height="28" rx="6" fill="currentColor" />
        <path
          d="M9 8L14 14L19 8M14 14V20"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>YGinvest</span>
    </Link>
  );
}
