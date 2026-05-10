# YGinvest Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 이메일 또는 구글로 가입/로그인 후, 자동 생성된 글로벌 포트폴리오 (₩100,000,000 + $0)를 보여주는 빈 대시보드까지 도달할 수 있다. 백엔드 Python 워커는 heartbeat 단계 (실제 시세/매칭 로직은 Plan #2-3에서). Vercel + Railway + Supabase에 배포되어 본인 외 친구들도 URL로 접속 가능.

**Architecture:** 모노레포 구조 (`apps/web`, `apps/worker`, `supabase/`). Next.js 15 App Router on Vercel, Python 3.12 + APScheduler on Railway, Supabase Postgres + Auth + Realtime. Auth 트리거로 가입 시 profile/portfolio/notification_settings 자동 생성.

**Tech Stack:** Next.js 15 (TS) · Tailwind v4 · shadcn/ui · @supabase/ssr · Vitest · Playwright · Python 3.12 · uv · APScheduler · ruff · pytest · Supabase CLI · Docker (Supabase 로컬용)

---

## 사전 요구사항 (사용자가 직접 한 번만 수행)

- [ ] **Docker Desktop 설치 및 실행** (Supabase 로컬 개발용)
- [ ] **Node.js 20+ 설치** (`node -v`로 확인)
- [ ] **Python 3.12+ 설치** (`python --version` 또는 `py -V`)
- [ ] **uv 설치**: `pip install uv` 또는 `winget install --id=astral-sh.uv`
- [ ] **Supabase CLI 설치**: `npm install -g supabase`
- [ ] **Vercel CLI 설치**: `npm install -g vercel`
- [ ] **Railway CLI 설치**: `npm install -g @railway/cli`
- [ ] **Supabase 클라우드 프로젝트 생성** (https://supabase.com/dashboard, region: ap-northeast-2 추천)
  - 프로젝트 URL과 anon key, service_role key 메모
- [ ] **Google OAuth 클라이언트 생성** (https://console.cloud.google.com)
  - Authorized redirect URI: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
  - Client ID/Secret을 Supabase Dashboard → Authentication → Providers → Google에 등록

---

## 파일 구조

```
YGinvest/
├── .gitignore
├── README.md
├── package.json                         (모노레포 루트, scripts only)
├── apps/
│   ├── web/                             (Next.js 앱 — Vercel root)
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                 (랜딩)
│   │   │   ├── globals.css
│   │   │   ├── auth/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── callback/route.ts
│   │   │   └── (app)/
│   │   │       ├── layout.tsx           (인증 셸)
│   │   │       └── dashboard/page.tsx
│   │   ├── components/
│   │   │   ├── ui/                      (shadcn 생성물)
│   │   │   ├── login-form.tsx
│   │   │   └── logout-button.tsx
│   │   ├── lib/
│   │   │   └── supabase/
│   │   │       ├── client.ts            (브라우저 클라이언트)
│   │   │       ├── server.ts            (서버 컴포넌트/액션)
│   │   │       └── middleware.ts        (세션 갱신)
│   │   ├── middleware.ts                (Next.js 미들웨어 — auth 가드)
│   │   ├── public/
│   │   │   └── favicon.ico
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   └── auth-redirect.test.ts
│   │   │   └── e2e/
│   │   │       └── signup-to-dashboard.spec.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── postcss.config.mjs
│   │   ├── vitest.config.ts
│   │   ├── playwright.config.ts
│   │   ├── .env.local.example
│   │   └── .env.local                   (gitignored)
│   └── worker/                          (Python 워커 — Railway root)
│       ├── pyproject.toml
│       ├── uv.lock
│       ├── src/
│       │   └── ygworker/
│       │       ├── __init__.py
│       │       ├── main.py              (entry point)
│       │       ├── config.py            (env 로딩)
│       │       ├── supabase_client.py
│       │       └── jobs/
│       │           ├── __init__.py
│       │           └── heartbeat.py     (1분마다 로그)
│       ├── tests/
│       │   ├── __init__.py
│       │   └── test_heartbeat.py
│       ├── Dockerfile
│       ├── .env.example
│       └── .env                         (gitignored)
├── supabase/
│   ├── config.toml
│   ├── seed.sql                         (선택, 비어있음)
│   └── migrations/
│       ├── 20260510000001_profiles.sql
│       ├── 20260510000002_portfolios.sql
│       ├── 20260510000003_notification_settings.sql
│       ├── 20260510000004_rls_policies.sql
│       └── 20260510000005_signup_trigger.sql
└── .github/
    └── workflows/
        ├── web-ci.yml                   (typecheck, lint, unit test, build)
        └── worker-ci.yml                (ruff, pytest)
```

각 파일의 책임:
- `apps/web/lib/supabase/*.ts` — 브라우저/서버/미들웨어용 Supabase 클라이언트 분리. SSR 인증 패턴.
- `apps/web/middleware.ts` — `/app/*` 경로는 인증 필수, 미인증 시 `/auth/login` 리다이렉트.
- `apps/web/app/(app)/layout.tsx` — 인증된 사용자만 접근 가능한 레이아웃. 라우트 그룹.
- `apps/worker/src/ygworker/main.py` — APScheduler를 띄우고 등록된 잡을 실행.
- `supabase/migrations/*.sql` — 모든 스키마 변경은 마이그레이션으로. RLS 포함.

---

## Task 1: 모노레포 부트스트랩

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `package.json` (root)

- [ ] **Step 1: 작업 디렉토리 확인**

Run: `pwd` (Windows: `cd`)
Expected: `C:\Users\Helios_Neo_18\모의 주식`

- [ ] **Step 2: 루트 `.gitignore` 작성**

Create `.gitignore`:

```gitignore
# Node
node_modules/
.next/
out/
dist/
*.tsbuildinfo
.turbo/

# Python
__pycache__/
*.py[cod]
*$py.class
.venv/
.python-version
*.egg-info/
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Env
.env
.env.local
.env.*.local
!.env.local.example
!.env.example

# OS
.DS_Store
Thumbs.db
desktop.ini

# IDE
.vscode/
.idea/
*.swp
*.swo

# Test/coverage
coverage/
.nyc_output/
playwright-report/
test-results/
htmlcov/

# Supabase
supabase/.branches/
supabase/.temp/
```

- [ ] **Step 3: 루트 `README.md` 작성**

Create `README.md`:

```markdown
# YGinvest

모의 주식 트레이딩 PWA — 한국·미국 거래소, KRW/USD 분리 계좌, 글로벌 + 친구방 리더보드.

## 디렉토리

- `apps/web` — Next.js 프론트엔드 (Vercel)
- `apps/worker` — Python 시세/매칭 워커 (Railway)
- `supabase/` — DB 마이그레이션 + 로컬 개발 설정
- `docs/superpowers/` — spec & plan 문서

## 개발

각 앱별 README는 해당 디렉토리에 위치.

요약:
\`\`\`bash
# DB 로컬
supabase start

# 웹
cd apps/web && npm install && npm run dev

# 워커
cd apps/worker && uv sync && uv run python -m ygworker.main
\`\`\`

## 배포

- 웹: Vercel (root: `apps/web`)
- 워커: Railway (root: `apps/worker`, Dockerfile)
- DB: Supabase Cloud
```

- [ ] **Step 4: 루트 `package.json` 작성 (간단한 스크립트만)**

Create `package.json`:

```json
{
  "name": "yginvest",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "web": "npm --prefix apps/web run dev",
    "web:build": "npm --prefix apps/web run build",
    "web:test": "npm --prefix apps/web test",
    "web:e2e": "npm --prefix apps/web run test:e2e",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:diff": "supabase db diff"
  }
}
```

- [ ] **Step 5: 커밋**

```bash
git add .gitignore README.md package.json
git commit -m "chore: bootstrap monorepo structure"
```

---

## Task 2: Supabase 로컬 환경 초기화

**Files:**
- Create: `supabase/config.toml` (CLI 자동 생성)

- [ ] **Step 1: Supabase 프로젝트 초기화**

Run: `supabase init`
Expected: `supabase/config.toml` 등 생성됨

- [ ] **Step 2: 클라우드 프로젝트와 링크**

Run: `supabase link --project-ref <YOUR_PROJECT_REF>`

(`<YOUR_PROJECT_REF>`은 Supabase Dashboard URL의 `https://app.supabase.com/project/<REF>`에서 확인)

Expected: 비밀번호 입력 프롬프트, 성공 시 "Finished supabase link"

- [ ] **Step 3: `supabase/config.toml` 검토**

Verify `[auth]` 섹션에 다음이 포함되도록 편집:

```toml
[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/callback"]
jwt_expiry = 3600

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false  # 로컬 개발 단순화. 프로덕션에선 true

[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret = "env(GOOGLE_CLIENT_SECRET)"
redirect_uri = "http://localhost:54321/auth/v1/callback"
```

- [ ] **Step 4: Supabase 로컬 시작**

Run: `supabase start`
Expected: API URL (`http://localhost:54321`), Studio URL (`http://localhost:54323`), DB URL, anon key, service_role key 출력

(Docker가 안 떠있으면 실패. Docker Desktop 실행 후 재시도.)

- [ ] **Step 5: 출력값 메모 및 커밋**

`supabase status` 출력 결과를 메모장에 저장. 다음 단계 환경변수에서 사용.

```bash
git add supabase/config.toml
git commit -m "chore: initialize supabase local config"
```

---

## Task 3: Migration — profiles 테이블

**Files:**
- Create: `supabase/migrations/20260510000001_profiles.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `supabase/migrations/20260510000001_profiles.sql`:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_display_name_idx on public.profiles (display_name);

comment on table public.profiles is '사용자 프로필 (auth.users 1:1)';
```

- [ ] **Step 2: 로컬 DB에 적용 (db reset이 모든 마이그레이션 재실행)**

Run: `supabase db reset`
Expected: "Finished supabase db reset" + 모든 마이그레이션 적용 로그

- [ ] **Step 3: Supabase Studio에서 테이블 확인**

Open: http://localhost:54323 → Table Editor → `public.profiles` 보임

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260510000001_profiles.sql
git commit -m "feat(db): add profiles table"
```

---

## Task 4: Migration — portfolios 테이블

**Files:**
- Create: `supabase/migrations/20260510000002_portfolios.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510000002_portfolios.sql`:

```sql
-- rooms 테이블은 Plan #5에서 생성됨. 지금은 room_id를 nullable uuid로만 두고
-- FK는 미설정. Plan #5에서 ALTER TABLE로 FK 추가.
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid,
  starting_krw numeric(20,4) not null,
  starting_usd numeric(20,4) not null default 0,
  fx_rate_at_start numeric(20,8) not null,
  krw_balance numeric(20,4) not null,
  usd_balance numeric(20,4) not null default 0,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- 사용자당 글로벌 포트폴리오는 1개만
create unique index portfolios_user_global_uniq
  on public.portfolios (user_id) where room_id is null;

-- 사용자당 같은 방의 포트폴리오는 1개만
create unique index portfolios_user_room_uniq
  on public.portfolios (user_id, room_id) where room_id is not null;

create index portfolios_user_id_idx on public.portfolios (user_id);
create index portfolios_room_id_idx on public.portfolios (room_id) where room_id is not null;

comment on table public.portfolios is '경쟁 단위. 글로벌(room_id=NULL) + 방 포트폴리오';
```

- [ ] **Step 2: 적용 + 검증**

Run: `supabase db reset`
Expected: 두 마이그레이션 모두 적용

- [ ] **Step 3: 부분 유니크 인덱스 동작 확인 (Studio SQL Editor에서)**

```sql
-- 더미 사용자 생성 (auth schema는 Studio에서 직접 SQL로)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'a@test.com');
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-000000000001', 'Tester A');

-- 첫 글로벌 포트폴리오 — 성공해야 함
insert into public.portfolios (user_id, starting_krw, fx_rate_at_start, krw_balance)
values ('00000000-0000-0000-0000-000000000001', 100000000, 1395, 100000000);

-- 두 번째 글로벌 — 유니크 위반으로 실패해야 함
insert into public.portfolios (user_id, starting_krw, fx_rate_at_start, krw_balance)
values ('00000000-0000-0000-0000-000000000001', 100000000, 1395, 100000000);
-- ERROR: duplicate key value violates unique constraint "portfolios_user_global_uniq"
```

수동 검증 후 더미 데이터 제거:
```sql
delete from public.portfolios where user_id = '00000000-0000-0000-0000-000000000001';
delete from public.profiles where id = '00000000-0000-0000-0000-000000000001';
delete from auth.users where id = '00000000-0000-0000-0000-000000000001';
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260510000002_portfolios.sql
git commit -m "feat(db): add portfolios table with partial unique indexes"
```

---

## Task 5: Migration — notification_settings 테이블

**Files:**
- Create: `supabase/migrations/20260510000003_notification_settings.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510000003_notification_settings.sql`:

```sql
create table public.notification_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  order_filled boolean not null default true,
  order_expiring_soon boolean not null default true,
  room_starting boolean not null default true,
  room_ending boolean not null default true,
  dividend_received boolean not null default true,
  corporate_action_applied boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.notification_settings is '사용자별 푸시 알림 종류 ON/OFF';
```

- [ ] **Step 2: 적용 + 커밋**

Run: `supabase db reset`

```bash
git add supabase/migrations/20260510000003_notification_settings.sql
git commit -m "feat(db): add notification_settings table"
```

---

## Task 6: Migration — RLS 정책

**Files:**
- Create: `supabase/migrations/20260510000004_rls_policies.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510000004_rls_policies.sql`:

```sql
-- profiles
alter table public.profiles enable row level security;

create policy "profiles: 누구나 읽기"
  on public.profiles for select
  to anon, authenticated  -- spec §4.3: SELECT 누구나
  using (true);

create policy "profiles: 본인 업데이트"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: 본인 삭제"
  on public.profiles for delete
  to authenticated
  using (id = auth.uid());

-- profiles INSERT는 트리거(다음 Task)가 service_role로 처리하므로 정책 없음

-- portfolios
alter table public.portfolios enable row level security;

create policy "portfolios: 본인 읽기"
  on public.portfolios for select
  to authenticated
  using (user_id = auth.uid());
-- 방 멤버 공개 정책은 Plan #5에서 추가

-- portfolios INSERT/UPDATE/DELETE는 서버(service_role)만. 사용자 직접 X.

-- notification_settings
alter table public.notification_settings enable row level security;

create policy "notification_settings: 본인 읽기"
  on public.notification_settings for select
  to authenticated
  using (user_id = auth.uid());

create policy "notification_settings: 본인 업데이트"
  on public.notification_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- [ ] **Step 2: 적용 + 커밋**

Run: `supabase db reset`

```bash
git add supabase/migrations/20260510000004_rls_policies.sql
git commit -m "feat(db): add RLS policies for profiles/portfolios/notification_settings"
```

---

## Task 7: Migration — 가입 트리거

**Files:**
- Create: `supabase/migrations/20260510000005_signup_trigger.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `supabase/migrations/20260510000005_signup_trigger.sql`:

```sql
-- 신규 auth.users 행 생성 시 profile + 글로벌 portfolio + notification_settings 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_display_name text;
begin
  -- display_name 결정 우선순위: OAuth full_name → user_metadata.display_name → email local part
  default_display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'display_name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    default_display_name,
    new.raw_user_meta_data->>'avatar_url'
  );

  -- 글로벌 포트폴리오: 1억 KRW + 0 USD
  -- fx_rate_at_start는 Plan #2에서 fx_rates 테이블 생기면 실시간 환율로 대체.
  -- 지금은 starting_usd=0이라 의미 없으므로 placeholder 1395 사용.
  insert into public.portfolios (user_id, starting_krw, starting_usd, fx_rate_at_start, krw_balance, usd_balance)
  values (new.id, 100000000, 0, 1395, 100000000, 0);

  insert into public.notification_settings (user_id) values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: 적용**

Run: `supabase db reset`
Expected: 모든 마이그레이션 적용 + 트리거 등록

- [ ] **Step 3: 트리거 동작 확인 (Studio SQL Editor)**

```sql
-- 더미 가입
insert into auth.users (id, email, raw_user_meta_data)
values (
  '11111111-1111-1111-1111-111111111111',
  'foo@test.com',
  '{"full_name": "Test Foo"}'::jsonb
);

-- 자동 생성됐는지
select * from public.profiles where id = '11111111-1111-1111-1111-111111111111';
-- display_name = 'Test Foo' 이어야 함

select * from public.portfolios where user_id = '11111111-1111-1111-1111-111111111111';
-- starting_krw=100000000, krw_balance=100000000, room_id=NULL

select * from public.notification_settings where user_id = '11111111-1111-1111-1111-111111111111';
-- 모두 true 기본값

-- 정리
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
-- on delete cascade로 profile/portfolio/notification_settings 자동 삭제됨
select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111';
-- 0 이어야 함
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260510000005_signup_trigger.sql
git commit -m "feat(db): add signup trigger to auto-create profile/portfolio/notification_settings"
```

---

## Task 8: DB 통합 테스트 (가입 트리거 검증)

> **참고**: 이 통합 테스트는 워커 테스트로 둡니다. Python에서 service_role로 Supabase에 연결해서 검증. 먼저 워커 환경부터 만들어야 해서 Task 18 이후로 미루는 것도 가능하지만, 트리거 로직 안정성 확보를 위해 여기서 처리.

**Files:**
- Create: `apps/worker/pyproject.toml` (먼저 워커 셋업 일부)
- Create: `apps/worker/tests/test_signup_trigger.py`

- [ ] **Step 1: 워커 디렉토리 생성 + uv 초기화**

```bash
mkdir -p apps/worker
cd apps/worker
uv init --python 3.12 --no-readme
```

- [ ] **Step 2: pyproject.toml 편집**

Replace `apps/worker/pyproject.toml`:

```toml
[project]
name = "ygworker"
version = "0.1.0"
description = "YGinvest price/matching worker"
requires-python = ">=3.12"
dependencies = [
  "supabase>=2.9.0",
  "apscheduler>=3.10.4",
  "python-dotenv>=1.0.1",
  "structlog>=24.4.0",
]

[dependency-groups]
dev = [
  "pytest>=8.3.3",
  "pytest-asyncio>=0.24.0",
  "ruff>=0.7.4",
  "mypy>=1.13.0",
]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "B", "UP", "N"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.uv]
package = false  # 단일 앱이므로 패키지화 X
```

- [ ] **Step 3: 의존성 설치**

Run: `cd apps/worker && uv sync`
Expected: `.venv/` 생성 + 모든 deps 설치됨

- [ ] **Step 4: 테스트용 .env.example 작성**

Create `apps/worker/.env.example`:

```
# 로컬: supabase status 출력 참조
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

Create `apps/worker/.env` with actual values from `supabase status`.

- [ ] **Step 5: 실패하는 테스트 작성**

Create `apps/worker/tests/__init__.py` (empty).

Create `apps/worker/tests/test_signup_trigger.py`:

```python
import os
import uuid

import pytest
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


@pytest.fixture(scope="module")
def supabase_admin():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


@pytest.fixture
def cleanup_user(supabase_admin):
    user_ids: list[str] = []
    yield user_ids
    for uid in user_ids:
        supabase_admin.auth.admin.delete_user(uid)


def test_signup_creates_profile_portfolio_notification_settings(supabase_admin, cleanup_user):
    # Given: 신규 사용자 가입
    email = f"test-{uuid.uuid4()}@example.com"
    res = supabase_admin.auth.admin.create_user({
        "email": email,
        "password": "TestPass123!",
        "email_confirm": True,
        "user_metadata": {"full_name": "Plan One Tester"},
    })
    user_id = res.user.id
    cleanup_user.append(user_id)

    # When: 트리거가 실행되면
    profile = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute().data
    portfolio = supabase_admin.table("portfolios").select("*").eq("user_id", user_id).is_("room_id", "null").single().execute().data
    notif = supabase_admin.table("notification_settings").select("*").eq("user_id", user_id).single().execute().data

    # Then: 행이 자동 생성되고 기본값이 정확함
    assert profile["display_name"] == "Plan One Tester"
    assert portfolio["starting_krw"] == 100000000
    assert portfolio["starting_usd"] == 0
    assert portfolio["krw_balance"] == 100000000
    assert portfolio["usd_balance"] == 0
    assert portfolio["status"] == "active"
    assert portfolio["room_id"] is None
    assert notif["order_filled"] is True


def test_signup_falls_back_to_email_localpart_for_display_name(supabase_admin, cleanup_user):
    email = f"fallback-{uuid.uuid4()}@example.com"
    expected_name = email.split("@")[0]
    res = supabase_admin.auth.admin.create_user({
        "email": email,
        "password": "TestPass123!",
        "email_confirm": True,
    })
    user_id = res.user.id
    cleanup_user.append(user_id)

    profile = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute().data
    assert profile["display_name"] == expected_name


def test_global_portfolio_uniqueness_per_user(supabase_admin, cleanup_user):
    email = f"uniq-{uuid.uuid4()}@example.com"
    res = supabase_admin.auth.admin.create_user({
        "email": email,
        "password": "TestPass123!",
        "email_confirm": True,
    })
    user_id = res.user.id
    cleanup_user.append(user_id)

    with pytest.raises(Exception):
        supabase_admin.table("portfolios").insert({
            "user_id": user_id,
            "starting_krw": 100000000,
            "starting_usd": 0,
            "fx_rate_at_start": 1395,
            "krw_balance": 100000000,
            "usd_balance": 0,
        }).execute()
```

- [ ] **Step 6: 테스트 실행하여 실패 확인 (이미 트리거가 있으면 통과해야 함)**

Run: `cd apps/worker && uv run pytest tests/test_signup_trigger.py -v`
Expected: 3개 테스트 모두 PASS

만약 실패한다면: 트리거가 등록 안 된 것. `supabase db reset` 다시 실행.

- [ ] **Step 7: 커밋**

```bash
git add apps/worker/pyproject.toml apps/worker/uv.lock apps/worker/.env.example apps/worker/tests/__init__.py apps/worker/tests/test_signup_trigger.py
git commit -m "test(db): integration test for signup trigger"
```

---

## Task 9: Next.js 앱 초기화

**Files:**
- Create: `apps/web/*` (대량)

- [ ] **Step 1: Next.js 생성 (인터랙티브 모드 권장)**

```bash
cd apps
npx create-next-app@latest web
```

프롬프트에서 다음과 같이 응답:
- TypeScript: **Yes**
- ESLint: **Yes**
- Tailwind CSS: **Yes**
- `src/` 디렉토리: **No**
- App Router: **Yes**
- Turbopack: **Yes**
- import alias 커스터마이즈: **Yes**, alias: `@/*`

(create-next-app의 CLI 플래그 셋은 버전마다 자주 변경되어 인터랙티브 모드가 가장 안정적.)

- [ ] **Step 2: 의존성 설치 (Supabase, 테스트 도구)**

```bash
cd apps/web
npm install @supabase/ssr @supabase/supabase-js
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 3: tsconfig strict 모드 확인**

Verify `apps/web/tsconfig.json` has `"strict": true` (Next.js 기본값).

- [ ] **Step 4: 환경변수 템플릿 작성**

Create `apps/web/.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<from supabase status>
```

복사해서 실제 값 채우기:
```bash
cp .env.local.example .env.local
# 편집하여 supabase status에서 가져온 anon, service_role 채움
```

- [ ] **Step 5: 빌드 확인**

Run: `cd apps/web && npm run build`
Expected: 성공 (기본 페이지)

- [ ] **Step 6: 커밋**

```bash
git add apps/web
git commit -m "feat(web): initialize Next.js 15 app with Tailwind + Supabase deps"
```

---

## Task 10: shadcn/ui 셋업

**Files:**
- Modify: `apps/web/components.json` (생성)
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: shadcn 초기화**

```bash
cd apps/web
npx shadcn@latest init
```
프롬프트: TypeScript ✅, style: default, base color: slate, CSS variables ✅.

- [ ] **Step 2: 사용할 컴포넌트 추가**

```bash
npx shadcn@latest add button input label card alert
```

- [ ] **Step 3: 다크모드 기본 적용 (Plan #7에서 토글 추가, 일단 dark만)**

Edit `apps/web/app/layout.tsx`:

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YGinvest",
  description: "모의 주식 트레이딩",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: 빌드 확인 + 커밋**

```bash
npm run build
git add apps/web/components.json apps/web/components apps/web/lib apps/web/app/globals.css apps/web/app/layout.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "feat(web): set up shadcn/ui with dark theme"
```

---

## Task 11: Supabase 클라이언트 (브라우저/서버/미들웨어)

**Files:**
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/middleware.ts`

- [ ] **Step 1: 브라우저 클라이언트**

Create `apps/web/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: 서버 클라이언트 (서버 컴포넌트/액션용)**

Create `apps/web/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출 시 무시 (미들웨어가 갱신)
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: 미들웨어 헬퍼 (세션 갱신용)**

Create `apps/web/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /app/* 경로는 인증 필수
  if (request.nextUrl.pathname.startsWith("/app") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // 이미 로그인했는데 로그인 페이지 접근 시 대시보드로
  if (request.nextUrl.pathname === "/auth/login" && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 4: 루트 미들웨어**

Create `apps/web/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 5: 빌드 확인 + 커밋**

```bash
npm run build
git add apps/web/lib/supabase apps/web/middleware.ts
git commit -m "feat(web): add Supabase SSR clients and auth middleware"
```

---

## Task 12: 로그인 페이지

**Files:**
- Create: `apps/web/app/auth/login/page.tsx`
- Create: `apps/web/components/login-form.tsx`

- [ ] **Step 1: 로그인 폼 컴포넌트**

Create `apps/web/components/login-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const fn = mode === "login" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error } = await fn.call(supabase.auth, { email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      window.location.href = "/app/dashboard";
    }
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{mode === "login" ? "로그인" : "가입"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {mode === "login" ? "로그인" : "가입"}
          </Button>
        </form>
        <Button variant="outline" onClick={handleGoogle} className="w-full">
          Google로 계속
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-sm text-muted-foreground hover:underline w-full text-center"
        >
          {mode === "login" ? "처음이세요? 가입하기" : "이미 계정이 있으세요? 로그인"}
        </button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 로그인 페이지**

Create `apps/web/app/auth/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
```

- [ ] **Step 3: 빌드 확인 + 커밋**

```bash
npm run build
git add apps/web/components/login-form.tsx apps/web/app/auth/login/page.tsx
git commit -m "feat(web): add login page with email/Google auth"
```

---

## Task 13: OAuth 콜백 핸들러

**Files:**
- Create: `apps/web/app/auth/callback/route.ts`

- [ ] **Step 1: 콜백 라우트**

Create `apps/web/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/auth/login?error=oauth_failed`);
}
```

- [ ] **Step 2: 빌드 확인 + 커밋**

```bash
npm run build
git add apps/web/app/auth/callback/route.ts
git commit -m "feat(web): add OAuth callback handler"
```

---

## Task 14: 인증된 앱 셸 + 빈 대시보드

**Files:**
- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/app/(app)/dashboard/page.tsx`
- Create: `apps/web/components/logout-button.tsx`
- Modify: `apps/web/app/page.tsx` (랜딩)

- [ ] **Step 1: 로그아웃 버튼**

Create `apps/web/components/logout-button.tsx`:

```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }
  return (
    <Button variant="ghost" onClick={handleLogout}>
      로그아웃
    </Button>
  );
}
```

- [ ] **Step 2: 인증 셸 레이아웃**

Create `apps/web/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="font-semibold">YGinvest</div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{profile?.display_name ?? user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: 빈 대시보드**

Create `apps/web/app/(app)/dashboard/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("krw_balance, usd_balance, starting_krw, starting_usd")
    .eq("user_id", user.id)
    .is("room_id", null)
    .single();

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KRW 잔고</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolio ? KRW.format(Number(portfolio.krw_balance)) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              시작: {portfolio ? KRW.format(Number(portfolio.starting_krw)) : "—"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">USD 잔고</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {portfolio ? USD.format(Number(portfolio.usd_balance)) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              시작: {portfolio ? USD.format(Number(portfolio.starting_usd)) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">곧 추가될 기능</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <div>· 종목 검색 및 매수/매도 (Plan #2-3)</div>
          <div>· 종목 상세 차트 + 지표 (Plan #4)</div>
          <div>· 친구방 + 리더보드 (Plan #5)</div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: 랜딩 페이지 갱신**

Replace `apps/web/app/page.tsx`:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Landing() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app/dashboard");

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-6 text-center space-y-6">
      <h1 className="text-4xl font-bold">YGinvest</h1>
      <p className="text-muted-foreground max-w-md">
        모의 주식 트레이딩. 한국·미국 거래소, 친구와 수익률 경쟁.
      </p>
      <Button asChild>
        <Link href="/auth/login">시작하기</Link>
      </Button>
    </main>
  );
}
```

- [ ] **Step 5: 로컬 실행 + 수동 검증**

Run: `cd apps/web && npm run dev`
Open: http://localhost:3000

수동 검증:
1. 랜딩 페이지 보임
2. "시작하기" 클릭 → 로그인 페이지
3. 이메일 가입 → 자동 로그인 → 대시보드로 리다이렉트
4. 대시보드에 ₩100,000,000 + $0 표시
5. 닉네임 또는 이메일 표시
6. 로그아웃 → 랜딩 복귀
7. URL로 직접 `/app/dashboard` 접근 (로그아웃 상태) → `/auth/login`로 리다이렉트

- [ ] **Step 6: 커밋**

```bash
git add apps/web/app/(app) apps/web/components/logout-button.tsx apps/web/app/page.tsx
git commit -m "feat(web): add authenticated app shell + dashboard with portfolio summary"
```

---

## Task 15: E2E 테스트 (가입→대시보드)

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/e2e/signup-to-dashboard.spec.ts`

- [ ] **Step 1: Playwright 설정**

Create `apps/web/playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,  // 같은 DB라 직렬
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: package.json 스크립트 추가**

Edit `apps/web/package.json`, scripts에 추가:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 3: E2E 테스트 작성**

Create `apps/web/tests/e2e/signup-to-dashboard.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test("signup → auto-redirect to dashboard with portfolio", async ({ page }) => {
    const email = `e2e-${Date.now()}@test.com`;
    const password = "TestPass123!";

    await page.goto("/auth/login");
    await page.getByRole("button", { name: /가입하기/i }).click();
    await page.getByLabel("이메일").fill(email);
    await page.getByLabel("비밀번호").fill(password);
    await page.getByRole("button", { name: /^가입$/i }).click();

    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText(/KRW 잔고/i)).toBeVisible();
    await expect(page.getByText(/₩100,000,000/)).toBeVisible();
    await expect(page.getByText(/USD 잔고/i)).toBeVisible();
  });

  test("logged out user redirected from /app/* to /auth/login", async ({ page }) => {
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
```

- [ ] **Step 4: 실행 (먼저 실패해야 함)**

이 시점에서 Task 14까지 완료된 상태라 실제론 통과해야 함. 테스트 작성 자체가 회귀 방지.

Run: `cd apps/web && npm run test:e2e`
Expected: 2개 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/web/playwright.config.ts apps/web/tests apps/web/package.json
git commit -m "test(web): add E2E test for signup → dashboard flow"
```

---

## Task 16: 워커 — 설정 + Supabase 클라이언트

**Files:**
- Create: `apps/worker/src/ygworker/__init__.py`
- Create: `apps/worker/src/ygworker/config.py`
- Create: `apps/worker/src/ygworker/supabase_client.py`

> **참고:** 워커 디렉토리와 `pyproject.toml`은 Task 8에서 이미 생성됨. 여기선 서브패키지·소스 파일만 추가.

- [ ] **Step 1: 패키지 디렉토리 + __init__**

```bash
mkdir -p apps/worker/src/ygworker/jobs
touch apps/worker/src/ygworker/__init__.py
touch apps/worker/src/ygworker/jobs/__init__.py
```

- [ ] **Step 2: config 작성**

Create `apps/worker/src/ygworker/config.py`:

```python
import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    log_level: str = "INFO"


def load_settings() -> Settings:
    return Settings(
        supabase_url=_required("SUPABASE_URL"),
        supabase_service_role_key=_required("SUPABASE_SERVICE_ROLE_KEY"),
        log_level=os.environ.get("LOG_LEVEL", "INFO"),
    )


def _required(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(f"환경변수 누락: {key}")
    return value
```

- [ ] **Step 3: Supabase 클라이언트**

Create `apps/worker/src/ygworker/supabase_client.py`:

```python
from supabase import Client, create_client

from ygworker.config import Settings


def make_client(settings: Settings) -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
```

- [ ] **Step 4: 커밋**

```bash
git add apps/worker/src
git commit -m "feat(worker): add config and supabase client setup"
```

---

## Task 17: 워커 — Heartbeat 잡 (TDD)

**Files:**
- Create: `apps/worker/src/ygworker/jobs/heartbeat.py`
- Create: `apps/worker/tests/test_heartbeat.py`

- [ ] **Step 1: 실패하는 테스트**

Create `apps/worker/tests/test_heartbeat.py`:

```python
from unittest.mock import MagicMock

from ygworker.jobs.heartbeat import run_heartbeat


def test_heartbeat_logs_with_supabase_reachable():
    fake_client = MagicMock()
    fake_client.table.return_value.select.return_value.limit.return_value.execute.return_value.data = []
    logger = MagicMock()

    run_heartbeat(fake_client, logger)

    logger.info.assert_called_once()
    args, kwargs = logger.info.call_args
    assert args[0] == "heartbeat"
    assert kwargs["status"] == "ok"


def test_heartbeat_logs_error_when_supabase_unreachable():
    fake_client = MagicMock()
    fake_client.table.return_value.select.return_value.limit.return_value.execute.side_effect = RuntimeError("connection refused")
    logger = MagicMock()

    run_heartbeat(fake_client, logger)

    logger.error.assert_called_once()
    args, kwargs = logger.error.call_args
    assert args[0] == "heartbeat"
    assert kwargs["status"] == "error"
    assert "connection refused" in kwargs["error"]
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `cd apps/worker && uv run pytest tests/test_heartbeat.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'ygworker.jobs.heartbeat'`

- [ ] **Step 3: 최소 구현**

Create `apps/worker/src/ygworker/jobs/heartbeat.py`:

```python
from typing import Any


def run_heartbeat(supabase: Any, logger: Any) -> None:
    """Supabase 연결 살아있는지만 확인. profiles 테이블 1행 SELECT."""
    try:
        supabase.table("profiles").select("id").limit(1).execute()
        logger.info("heartbeat", status="ok")
    except Exception as exc:
        logger.error("heartbeat", status="error", error=str(exc))
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd apps/worker && uv run pytest tests/test_heartbeat.py -v`
Expected: 2개 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/worker/src/ygworker/jobs/heartbeat.py apps/worker/tests/test_heartbeat.py
git commit -m "feat(worker): add heartbeat job with TDD"
```

---

## Task 18: 워커 — APScheduler 메인 엔트리

**Files:**
- Create: `apps/worker/src/ygworker/main.py`

- [ ] **Step 1: 메인 엔트리**

Create `apps/worker/src/ygworker/main.py`:

```python
import signal
import sys
from typing import Any

import structlog
from apscheduler.schedulers.blocking import BlockingScheduler

from ygworker.config import load_settings
from ygworker.jobs.heartbeat import run_heartbeat
from ygworker.supabase_client import make_client


def _make_logger(level: str) -> Any:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(__import__("logging"), level)),
    )
    return structlog.get_logger()


def main() -> None:
    settings = load_settings()
    logger = _make_logger(settings.log_level)
    supabase = make_client(settings)

    logger.info("worker.starting", supabase_url=settings.supabase_url)

    scheduler = BlockingScheduler(timezone="Asia/Seoul")
    scheduler.add_job(
        run_heartbeat,
        trigger="interval",
        seconds=60,
        args=[supabase, logger],
        id="heartbeat",
        replace_existing=True,
    )

    def _shutdown(signum: int, frame: Any) -> None:
        logger.info("worker.stopping", signal=signum)
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    logger.info("worker.scheduler_started")
    scheduler.start()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 로컬 실행 검증**

Run: `cd apps/worker && uv run python -m ygworker.main`
Expected: JSON 로그가 1분마다 `"heartbeat"` 출력. Ctrl+C로 종료.

- [ ] **Step 3: 커밋**

```bash
git add apps/worker/src/ygworker/main.py
git commit -m "feat(worker): add APScheduler main entry with heartbeat"
```

---

## Task 19: 워커 Dockerfile

**Files:**
- Create: `apps/worker/Dockerfile`
- Create: `apps/worker/.dockerignore`

- [ ] **Step 1: Dockerfile**

Create `apps/worker/Dockerfile`:

```dockerfile
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# 의존성만 먼저 복사 (캐시)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# 소스 복사
COPY src ./src

ENV PYTHONPATH=/app/src

CMD ["uv", "run", "--no-dev", "python", "-m", "ygworker.main"]
```

- [ ] **Step 2: .dockerignore**

Create `apps/worker/.dockerignore`:

```
.venv
.env
.env.*
!.env.example
__pycache__
*.pyc
.pytest_cache
.mypy_cache
.ruff_cache
tests/
```

- [ ] **Step 3: 로컬 빌드 테스트**

Run: `cd apps/worker && docker build -t yginvest-worker:dev .`
Expected: 성공적으로 이미지 생성

(선택) 로컬 실행:
```bash
docker run --rm --env-file .env yginvest-worker:dev
```
1분 안에 heartbeat 로그 보여야 함.

- [ ] **Step 4: 커밋**

```bash
git add apps/worker/Dockerfile apps/worker/.dockerignore
git commit -m "feat(worker): add Dockerfile for Railway deploy"
```

---

## Task 20: Vercel 배포

**Files:**
- (Vercel 설정은 대부분 대시보드/CLI에서)

- [ ] **Step 1: 클라우드 Supabase에 마이그레이션 푸시**

Run: `supabase db push`
Expected: 5개 마이그레이션이 클라우드에 적용됨

- [ ] **Step 2: Vercel 프로젝트 생성**

Run: `cd apps/web && vercel link`
프롬프트 응답:
- Set up "apps/web"? → Yes
- Which scope? → 본인 계정
- Link to existing project? → No
- Project name → `yginvest`
- Code in `./`? → Yes
- Modify settings? → Yes (필요시)
  - Build command: 기본
  - Output directory: 기본
  - Install command: 기본
  - Development command: 기본

- [ ] **Step 3: 환경변수 등록**

```bash
cd apps/web
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# 클라우드 Supabase URL 입력 (예: https://xxx.supabase.co)
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# 클라우드 anon key
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# 클라우드 service_role key
```

- [ ] **Step 4: Supabase Auth Site URL/Redirect 갱신**

Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://yginvest.vercel.app` (또는 본인 도메인)
- Redirect URLs: `https://yginvest.vercel.app/auth/callback`

- [ ] **Step 4b: 클라우드 이메일 확인 설정 (수동 검증 단순화)**

클라우드 Supabase는 기본값이 "이메일 확인 필요(`Confirm email = on`)" 입니다.
v1 검증 단계에선 OFF로 해야 가입→대시보드 플로우가 메일 클릭 없이 동작합니다.

Supabase Dashboard → Authentication → Providers → Email:
- **Confirm email**: **OFF** (개발/검증 단계만. 프로덕션 운영 시 필요에 따라 다시 ON)

(또는 켜둘 거면 Step 5의 수동 검증을 OAuth(Google) 가입으로 진행해야 함.)

- [ ] **Step 5: 첫 배포**

Run: `cd apps/web && vercel --prod`
Expected: 배포 URL 출력. 브라우저에서 접속 → 가입 플로우 동작 확인.

- [ ] **Step 6: 커밋 (Vercel 설정 파일은 자동 생성된 .vercel/만 — gitignored)**

`.vercel/` 디렉토리는 `.gitignore`에 추가:

```bash
echo ".vercel" >> .gitignore
git add .gitignore
git commit -m "chore: ignore .vercel"
```

---

## Task 21: Railway 배포

- [ ] **Step 1: Railway 로그인**

Run: `railway login`
브라우저로 인증.

- [ ] **Step 2: 프로젝트 생성 + 워커 서비스**

```bash
cd apps/worker
railway init
# 프롬프트: Empty Project, name: yginvest-worker
railway link
```

- [ ] **Step 3: Dockerfile 사용 명시**

Railway Dashboard → Settings → Service:
- Builder: Dockerfile
- Root Directory: `apps/worker`
- Dockerfile Path: `Dockerfile`

(또는 `railway.json` 작성. 일단 대시보드 경로로.)

- [ ] **Step 4: 환경변수 등록**

```bash
railway variables set SUPABASE_URL=https://xxx.supabase.co
railway variables set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
railway variables set LOG_LEVEL=INFO
```

- [ ] **Step 5: 배포**

Run: `cd apps/worker && railway up`
Expected: 빌드 + 배포 진행. Railway Dashboard에서 로그 보면 1분마다 `heartbeat` 출력.

- [ ] **Step 6: 커밋**

`.railway/` 추가:

```bash
echo ".railway" >> .gitignore
git add .gitignore
git commit -m "chore: ignore .railway"
```

---

## Task 22: GitHub Actions — Web CI

**Files:**
- Create: `.github/workflows/web-ci.yml`

- [ ] **Step 1: 워크플로 작성**

Create `.github/workflows/web-ci.yml`:

```yaml
name: web-ci
on:
  push:
    paths:
      - "apps/web/**"
      - ".github/workflows/web-ci.yml"
  pull_request:
    paths:
      - "apps/web/**"

jobs:
  lint-typecheck-build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: apps/web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy
```

- [ ] **Step 2: Push 후 GitHub Actions 결과 확인**

```bash
git add .github/workflows/web-ci.yml
git commit -m "ci: add web typecheck/lint/build workflow"
git push
```

GitHub Actions 탭에서 녹색 통과 확인.

---

## Task 23: GitHub Actions — Worker CI

**Files:**
- Create: `.github/workflows/worker-ci.yml`

- [ ] **Step 1: 워크플로 작성**

Create `.github/workflows/worker-ci.yml`:

```yaml
name: worker-ci
on:
  push:
    paths:
      - "apps/worker/**"
      - ".github/workflows/worker-ci.yml"
  pull_request:
    paths:
      - "apps/worker/**"

jobs:
  ruff-pytest:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/worker
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install uv
        run: pip install uv
      - run: uv sync
      - run: uv run ruff check .
      - run: uv run pytest tests/test_heartbeat.py -v
        # 통합 테스트 (test_signup_trigger.py)는 Supabase 인스턴스 필요 → 로컬에서만
```

- [ ] **Step 2: Push 후 결과 확인**

```bash
git add .github/workflows/worker-ci.yml
git commit -m "ci: add worker ruff + pytest workflow"
git push
```

---

## Task 24: README 보강

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README 업데이트**

Replace `README.md`:

```markdown
# YGinvest

모의 주식 트레이딩 PWA — 한국·미국 거래소, KRW/USD 분리 계좌, 글로벌 + 친구방 리더보드.

[설계 문서](./docs/superpowers/specs/2026-05-10-mock-stock-trading-app-design.md)

## 디렉토리

- `apps/web` — Next.js 프론트엔드 (Vercel)
- `apps/worker` — Python 시세/매칭 워커 (Railway)
- `supabase/` — DB 마이그레이션 + 로컬 개발 설정
- `docs/superpowers/` — spec & plan 문서

## 사전 요구사항

- Node.js 20+
- Python 3.12+
- Docker Desktop (Supabase 로컬용)
- Supabase CLI (`npm i -g supabase`)
- uv (`pip install uv`)

## 로컬 개발

\`\`\`bash
# 1. DB 시작
supabase start
# 출력된 SUPABASE_URL/anon/service_role 키를 메모

# 2. 환경변수 셋업
cp apps/web/.env.local.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env
# 두 파일에 위 키 채우기

# 3. 웹 (별도 터미널)
cd apps/web && npm install && npm run dev
# http://localhost:3000

# 4. 워커 (별도 터미널)
cd apps/worker && uv sync && uv run python -m ygworker.main

# 5. 테스트
cd apps/web && npm run test:e2e
cd apps/worker && uv run pytest
\`\`\`

## 배포

- **웹**: Vercel (root: `apps/web`). 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **워커**: Railway (root: `apps/worker`, Dockerfile). 환경변수: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOG_LEVEL`
- **DB**: Supabase Cloud. `supabase db push`로 마이그레이션 동기화

## 현재 진행 상태

이 마일스톤(Plan #1)의 산출물:
- ✅ 모노레포 + 빌드/배포 파이프라인
- ✅ Supabase 스키마: profiles, portfolios (글로벌만), notification_settings + RLS + 가입 트리거
- ✅ 이메일/구글 로그인
- ✅ 빈 대시보드 (잔고 표시)
- ✅ 워커 heartbeat

다음 (Plan #2): 종목 마스터, 시세 fetch, 검색.
\`\`\`

- [ ] **Step 2: 커밋**

```bash
git add README.md
git commit -m "docs: expand README with setup and deploy instructions"
git push
```

---

## 마무리 검증 체크리스트

다음 항목이 모두 통과해야 Plan #1 완료:

- [ ] **로컬**: `supabase start` + `npm run dev` + `uv run python -m ygworker.main` 모두 동작
- [ ] **로컬 테스트**: `npm run test:e2e` 통과 (2 tests)
- [ ] **로컬 테스트**: `uv run pytest` 통과 (heartbeat 2 + signup_trigger 3)
- [ ] **로컬 수동**: 가입 → 대시보드에서 ₩100,000,000 + $0 표시
- [ ] **클라우드 DB**: `supabase db push` 후 Studio에서 5개 테이블 보임
- [ ] **Vercel**: 배포 URL에서 가입 플로우 동작
- [ ] **Railway**: 워커 컨테이너가 1분마다 `heartbeat` 로그 출력
- [ ] **CI**: GitHub Actions 두 워크플로 녹색
- [ ] **GitHub**: master에 모든 커밋 푸시됨

---

## Plan #1에 포함되지 않은 것 (다음 plan에서)

| 항목 | Plan |
|------|------|
| stocks/stock_bars 테이블 | #2 |
| 시세 fetch (yfinance/PyKRX) | #2 |
| 종목 검색 API + UI | #2 |
| holdings/orders/trades/fx_rates/fx_transactions 테이블 | #3 |
| 시장가/지정가 주문 API + 매칭 엔진 | #3 |
| 환전 API | #3 |
| 종목 상세 페이지 + 차트 | #4 |
| 매수/매도 시트 | #4 |
| 주문 이력 페이지 | #4 |
| rooms/room_members/portfolio_snapshots 테이블 | #5 |
| 방 생성/초대/참가 | #5 |
| 글로벌·방 리더보드 | #5 |
| 배당 시뮬 | #6a |
| 분할/병합 자동 처리 | #6b |
| Web Push | #6c |
| 룰 기반 종목 추천 | #6d |
| PWA manifest + 서비스 워커 + 다크/라이트 토글 | #7 |
| Realtime 구독 (UI 자동 갱신) | #4/#7 |

---

## 참고: 디버깅 팁

- **Supabase 트리거가 안 도는 것 같으면**: `supabase db reset`을 다시 실행. 마이그레이션 순서대로 적용됨.
- **Vercel에서 가입 후 redirect가 안 되면**: Site URL/Redirect URLs 설정 재확인.
- **OAuth 콜백 401**: Google Console의 redirect URI가 정확한지 (`https://<supabase-project>.supabase.co/auth/v1/callback`).
- **`.env.local` 변경 후 반영 안됨**: `npm run dev` 재시작.
- **Playwright "browser not found"**: `npx playwright install chromium` 재실행.
- **Railway 워커가 즉시 종료**: `BlockingScheduler`가 메인 스레드를 점유해야 함. `scheduler.start()`가 마지막 라인이어야.
