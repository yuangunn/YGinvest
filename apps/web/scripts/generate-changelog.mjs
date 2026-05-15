/**
 * Plan #27.2: git log를 파싱해 사용자가 볼 수 있는 changelog JSON 생성.
 *
 * - `feat`, `fix`, `perf`, `refactor`, `revert` 만 포함 (chore/docs/style/ci/build/test 제외)
 * - Conventional Commit prefix 파싱
 * - 최근 200개 non-merge 커밋
 * - Co-Authored-By / Generated with 라인 제거
 *
 * 출력: apps/web/lib/changelog-data.json (git에 commit하여 Vercel 빌드 시에도 사용)
 *
 * 사용:
 *   - `npm run changelog` (수동 갱신)
 *   - `npm run build`의 prebuild hook (자동)
 *     — Vercel 빌드는 git history가 shallow일 수 있어 실패할 수 있음.
 *       실패해도 build 진행 — 기존 commit된 JSON 사용.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, "../lib/changelog-data.json");

const LIMIT = 200;
const DELIM = "<<<COMMIT_DELIM>>>";
const FIELD = "<<<FIELD>>>";

const KEEP_TYPES = new Set([
  "feat",
  "fix",
  "perf",
  "refactor",
  "revert",
]);

function readGitLog() {
  const fmt = `${FIELD}%H${FIELD}%aI${FIELD}%s${FIELD}%b${DELIM}`;
  try {
    return execSync(
      `git log --no-merges -${LIMIT} --pretty=format:${JSON.stringify(fmt)}`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    );
  } catch (e) {
    console.warn(
      "[changelog] git log failed — keeping existing JSON:",
      e.message,
    );
    return null;
  }
}

function parseCommit(raw) {
  const parts = raw.split(FIELD).slice(1);
  if (parts.length < 4) return null;
  const [sha, date, subject, body] = parts;

  const m = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/);
  let type = "other";
  let scope;
  let title = subject;
  let breaking = false;
  if (m) {
    type = m[1].toLowerCase();
    scope = m[2];
    breaking = !!m[3];
    title = m[4];
  }

  if (!KEEP_TYPES.has(type)) return null;

  // body 정리: Co-Authored-By / Generated with / 빈줄 trim
  const cleanBody = (body || "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (/^Co-Authored-By:/i.test(t)) return false;
      if (/^🤖\s+Generated with/i.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();

  return {
    sha: sha.slice(0, 7),
    date,
    type,
    scope: scope || null,
    breaking,
    title: title.trim(),
    description: cleanBody || null,
  };
}

function main() {
  const log = readGitLog();
  if (log === null) {
    // 기존 JSON 유지
    process.exit(0);
  }
  const commits = log
    .split(DELIM)
    .map((c) => c.trim())
    .filter(Boolean)
    .map(parseCommit)
    .filter(Boolean);

  writeFileSync(OUTPUT, JSON.stringify(commits, null, 2) + "\n", "utf8");
  console.log(`[changelog] wrote ${commits.length} entries to ${OUTPUT}`);
}

main();
