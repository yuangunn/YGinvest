import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstallHelpClient } from "@/components/install-help-client";

export default async function InstallHelpPage() {
  // 로그인 안 한 사용자도 보기 가능하게 할 수도 있지만,
  // 현재 layout이 /app/* 전부 로그인 강제하므로 유지.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          앱처럼 설치하기 (PWA)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          홈 화면에 추가하면 일반 앱처럼 사용 가능. 푸시 알림·오프라인 일부
          기능까지 지원됩니다.
        </p>
      </div>

      <Card>
        <CardContent className="py-3 text-sm text-muted-foreground">
          <strong className="text-foreground">설치하면 좋은 점</strong>
          <ul className="list-disc ml-4 mt-2 space-y-1 text-xs">
            <li>홈 화면 아이콘으로 즉시 실행 (주소창 없음)</li>
            <li>가격 알림·방 이벤트 푸시 알림 수신</li>
            <li>오프라인에서도 마지막 본 페이지 / 학습 자료 열림</li>
            <li>업데이트 자동 (브라우저처럼 별도 업데이트 X)</li>
          </ul>
        </CardContent>
      </Card>

      <InstallHelpClient />

      {/* ───── iOS Safari ──────────────────────────────── */}
      <Card id="ios">
        <CardHeader>
          <CardTitle className="text-base">🍎 iOS (iPhone / iPad)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              ⚠️ <strong>Safari 브라우저에서만 설치 가능</strong>. iOS Chrome도
              내부 엔진은 Safari지만 PWA 설치 메뉴는 Safari에만 있습니다.
            </p>
          </div>
          <ol className="list-decimal ml-5 space-y-2">
            <li>
              <strong>Safari</strong> 앱으로{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                yginvest.vercel.app
              </code>{" "}
              접속
            </li>
            <li>로그인 후 둘러보기</li>
            <li>
              하단(또는 상단)의 <strong>공유 버튼 (□↑)</strong> 터치
            </li>
            <li>
              메뉴를 아래로 스크롤해서 <strong>&quot;홈 화면에 추가&quot;</strong> 선택
            </li>
            <li>이름 확인 → 우측 상단 <strong>&quot;추가&quot;</strong> 터치</li>
            <li>홈 화면에서 YGinvest 아이콘 실행</li>
          </ol>
          <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/30 rounded p-2 mt-2">
            💡 Safari가 아닌 다른 앱(카카오톡·인스타 등)에서 링크를 열었다면
            먼저 Safari로 옮겨야 합니다. 페이지 상단에 &quot;Safari에서 열기&quot;
            옵션이 보일 거예요.
          </div>
        </CardContent>
      </Card>

      {/* ───── Android Chrome ───────────────────────────── */}
      <Card id="chrome">
        <CardHeader>
          <CardTitle className="text-base">🤖 Android — 크롬</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="text-xs text-muted-foreground">
            PWA 지원이 가장 안정적. 자동 설치 배너도 뜹니다.
          </p>
          <ol className="list-decimal ml-5 space-y-2">
            <li>
              <strong>Chrome</strong> 앱 실행 →{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                yginvest.vercel.app
              </code>{" "}
              접속
            </li>
            <li>로그인 후 둘러보기</li>
            <li>
              우측 상단 <strong>⋮ (점 3개)</strong> 메뉴 터치
            </li>
            <li>
              <strong>&quot;앱 설치&quot;</strong> 또는{" "}
              <strong>&quot;홈 화면에 추가&quot;</strong> 선택
            </li>
            <li>이름 확인 → <strong>&quot;설치&quot;</strong></li>
            <li>홈 화면에서 아이콘 터치</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            💡 자동 설치 배너가 뜨면 그냥 &quot;설치&quot; 눌러도 됩니다. 페이지 상단의 노란
            배너가 가장 빠른 길.
          </p>
        </CardContent>
      </Card>

      {/* ───── Samsung Internet ─────────────────────────── */}
      <Card id="samsung">
        <CardHeader>
          <CardTitle className="text-base">📱 Android — 삼성 인터넷</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="text-xs text-muted-foreground">
            갤럭시 기본 브라우저. PWA 지원 우수합니다.
          </p>
          <ol className="list-decimal ml-5 space-y-2">
            <li>
              <strong>삼성 인터넷</strong> 실행 →{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                yginvest.vercel.app
              </code>{" "}
              접속
            </li>
            <li>로그인</li>
            <li>
              하단의 <strong>≡ (햄버거)</strong> 또는 <strong>⋮</strong> 메뉴
              터치
            </li>
            <li>
              <strong>&quot;현재 페이지 추가&quot;</strong> →{" "}
              <strong>&quot;홈 화면&quot;</strong>
              {" (또는 바로 \"홈 화면에 추가\" 항목)"}
            </li>
            <li>이름 확인 후 추가</li>
            <li>홈에서 실행</li>
          </ol>
        </CardContent>
      </Card>

      {/* ───── 인앱 브라우저 (네이버/카카오톡/인스타 등) ──── */}
      <Card id="inapp" className="border-amber-500/40">
        <CardHeader>
          <CardTitle className="text-base">
            ⚠️ 네이버 / 카카오톡 / 인스타 인앱
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="text-xs">
            인앱 브라우저는 PWA 설치를 <strong>지원하지 않습니다</strong>.
            외부 브라우저로 옮긴 다음 설치하세요.
          </p>

          <div>
            <p className="font-semibold mb-1">방법 A: 외부 브라우저로 열기</p>
            <ol className="list-decimal ml-5 space-y-1 text-xs">
              <li>현재 페이지가 열린 상태에서 메뉴 (⋯ 또는 ⋮) 터치</li>
              <li>
                <strong>&quot;다른 브라우저로 열기&quot;</strong> /{" "}
                <strong>&quot;외부 브라우저로 열기&quot;</strong> /{" "}
                <strong>&quot;Safari에서 열기&quot;</strong> 선택
              </li>
              <li>Chrome / 삼성 인터넷 / Safari 선택</li>
              <li>위의 해당 브라우저 가이드 따라 설치</li>
            </ol>
          </div>

          <div>
            <p className="font-semibold mb-1">방법 B: URL 복사 후 직접 열기</p>
            <ol className="list-decimal ml-5 space-y-1 text-xs">
              <li>
                주소창 길게 눌러서{" "}
                <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                  yginvest.vercel.app
                </code>{" "}
                복사
              </li>
              <li>Chrome / 삼성 인터넷 / Safari 직접 실행</li>
              <li>주소창에 붙여넣고 접속 후 설치</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* ───── 푸시 알림 ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🔔 푸시 알림 켜기</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-xs">
            설치 후 가격 알림 / 방 시작-종료 알림을 받으려면:
          </p>
          <ol className="list-decimal ml-5 space-y-1 text-xs">
            <li>앱 실행 → <strong>설정</strong> 탭</li>
            <li>
              <strong>알림 설정</strong> 항목 진입
            </li>
            <li>알림 종류 토글 ON</li>
            <li>
              브라우저/OS의 알림 권한 팝업이 뜨면 <strong>&quot;허용&quot;</strong> 선택
            </li>
          </ol>
          <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/30 rounded p-2">
            💡 한 번 거부하면 시스템 설정에서 다시 켜야 합니다.<br />
            <strong>Android</strong>: 설정 → 앱 → YGinvest → 알림 → 켜기<br />
            <strong>iOS</strong>: 설정 → 알림 → YGinvest → 켜기
          </div>
        </CardContent>
      </Card>

      {/* ───── 자주 묻는 질문 ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">❓ 자주 묻는 질문</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-3">
          <Faq
            q="설치 메뉴가 안 보여요"
            a={
              <>
                다음 조건을 확인하세요: <br />
                ① HTTPS로 접속했는지 (
                <code className="font-mono bg-muted px-1 rounded">
                  https://
                </code>{" "}
                시작) <br />② 카카오톡/네이버/인스타 인앱이 아닌지 <br />③ 브라우저가
                최신 버전인지 <br />④ 시크릿 모드는 아닌지
              </>
            }
          />
          <Faq
            q="데이터 캐시는 얼마나 차지하나요?"
            a="약 5~20MB. 서비스워커가 핵심 리소스만 캐싱합니다."
          />
          <Faq
            q="오프라인에서도 사용 가능?"
            a="마지막에 본 페이지 + 학습 컨텐츠는 캐시되어 열립니다. 실시간 가격·거래는 인터넷 필요."
          />
          <Faq
            q="업데이트는 자동인가요?"
            a="네. 다음 실행 시 백그라운드에서 자동으로 최신 버전을 받습니다."
          />
          <Faq
            q="로그인이 풀려요"
            a="PWA 모드에서도 쿠키가 유지됩니다. Android에서 앱 데이터 삭제 시 또는 iOS Safari 데이터 초기화 시에만 풀립니다."
          />
          <Faq
            q="갤럭시 폴드/플립에서 표시 이상"
            a="화면 회전 후 당겨서 새로고침하면 다시 정상 표시됩니다."
          />
        </CardContent>
      </Card>

      <div className="text-[10px] text-muted-foreground text-center pt-2 border-t">
        문제가 계속 발생하면 친구방 채팅 또는 GitHub 이슈로 알려주세요.
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div>
      <div className="font-semibold text-foreground">Q. {q}</div>
      <div className="text-muted-foreground mt-0.5 leading-relaxed">A. {a}</div>
    </div>
  );
}
