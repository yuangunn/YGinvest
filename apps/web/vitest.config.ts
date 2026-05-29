import { defineConfig } from "vitest/config";

// 단위 테스트 전용 설정.
// - 순수 로직(lib/**/*.test.ts)만 대상. node 환경(jsdom 불필요).
// - Playwright e2e(tests/e2e/*.spec.ts)는 제외 — 별도 러너(test:e2e).
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
  },
});
