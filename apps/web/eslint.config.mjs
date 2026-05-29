import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plan #11 — Serwist-bundled service worker (generated)
    "public/sw.js",
    "public/sw.js.map",
    "public/workbox-*.js",
    "public/swe-worker-*.js",
  ]),
  {
    rules: {
      // next-themes 마운트 가드, 차트 초기 동기화 등 의도된 패턴이 다수.
      // 에러로 CI를 막기보다 경고로 두고 사례별로 판단한다. (Next 16/React 19에서 강화된 규칙)
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
