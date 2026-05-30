// Plan #47.8: 도움말 / FAQ 페이지 — 풍부한 섹션별 안내.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";
import { PageHeader } from "@/components/yg/page-header";

export const dynamic = "force-dynamic";

type FaqItem = {
  q: string;
  a: React.ReactNode;
};

type FaqSection = {
  title: string;
  emoji: string;
  items: FaqItem[];
};

const SECTIONS: FaqSection[] = [
  {
    title: "서비스 개요",
    emoji: "🎯",
    items: [
      {
        q: "YGinvest는 무엇인가요?",
        a: (
          <>
            <p>
              <strong>모의 주식 트레이딩 PWA</strong>입니다. 한국(KOSPI/KOSDAQ)과
              미국(NYSE/NASDAQ) 거래소의 실제 종목을 실시간 가격으로 모의 매매할
              수 있어요.
            </p>
            <ul>
              <li>가입 시 KRW ₩100,000,000 + USD $0 자동 지급</li>
              <li>실제 거래소 가격으로 매수/매도 (5분 주기 갱신)</li>
              <li>주문 체결, 분할/병합, 배당 등 실 거래소 시뮬레이션</li>
              <li>실제 돈은 들어가지 않습니다 — 학습/연습 목적</li>
            </ul>
          </>
        ),
      },
      {
        q: "왜 모의 투자를 해야 하나요?",
        a: (
          <>
            <p>실전 투자 전 무료로 경험을 쌓을 수 있어요:</p>
            <ul>
              <li>매도 타이밍 훈련 (인생 시뮬 게임에서 더 강화)</li>
              <li>매수/매도 흐름, 호가창, 분할/병합 같은 실 거래 메커니즘 학습</li>
              <li>섹터/테마 개념, 시장 동향 파악</li>
              <li>친구방에서 함께 경쟁하며 실력 비교</li>
            </ul>
          </>
        ),
      },
      {
        q: "가격은 진짜 실시간인가요?",
        a: (
          <>
            <p>대부분 실시간 가까운 수준입니다:</p>
            <ul>
              <li>
                <strong>5분 주기</strong>로 모든 활성 종목 가격 갱신
                (yfinance/FinanceDataReader)
              </li>
              <li>
                KOSPI/KOSDAQ 지수, USDKRW 환율은{" "}
                <strong>5분 실시간 매크로 fetch</strong>
              </li>
              <li>장중에만 갱신 (장 마감 후엔 마지막 종가 유지)</li>
              <li>실제 매매 호가창보다는 약간 지연 (3-5분)</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    title: "거래 (매수/매도)",
    emoji: "💸",
    items: [
      {
        q: "매수/매도는 어떻게 하나요?",
        a: (
          <>
            <ol>
              <li>
                <Link href="/app/trade/search" style={{ color: "var(--yg-up-deep)" }}>
                  거래 → 종목 검색
                </Link>
                에서 원하는 종목 찾기
              </li>
              <li>종목 상세 페이지에서 [매수하기] 또는 [매도하기] 버튼</li>
              <li>수량 입력 → 시장가 / 지정가 선택 → 주문</li>
              <li>시장가는 즉시 체결, 지정가는 도달 시 체결 (최대 7일 유효)</li>
            </ol>
          </>
        ),
      },
      {
        q: "한국 종목과 미국 종목 모두 살 수 있나요?",
        a: (
          <>
            <p>네. 단 통화가 분리되어 있어요:</p>
            <ul>
              <li>
                <strong>한국 종목 (KOSPI/KOSDAQ)</strong>: KRW 잔고로 매수
              </li>
              <li>
                <strong>미국 종목 (NYSE/NASDAQ)</strong>: USD 잔고로 매수
              </li>
              <li>
                통화 변환은{" "}
                <Link href="/app/fx" style={{ color: "var(--yg-up-deep)" }}>
                  환전 페이지
                </Link>
                에서 KRW ↔ USD (실시간 환율 기준)
              </li>
            </ul>
          </>
        ),
      },
      {
        q: "장 시간은 어떻게 되나요?",
        a: (
          <>
            <ul>
              <li>
                <strong>한국 (KRX)</strong>: 평일 09:00-15:30 KST (NXT 확장:
                08:00-20:00)
              </li>
              <li>
                <strong>미국 (NYSE/NASDAQ)</strong>: 평일 09:30-16:00 ET (한국
                시간 23:30-06:00)
              </li>
              <li>주말 + 한국/미국 공휴일 휴장</li>
              <li>장 외 시간엔 마지막 종가로 표시</li>
            </ul>
          </>
        ),
      },
      {
        q: "수수료가 있나요?",
        a: (
          <>
            <p>모의 거래이므로 수수료는 부과되지 않습니다. 단 실제 시뮬레이션을
            위해 거래세 (0.18%) 정도는 차감하도록 추후 옵션 제공 예정.</p>
          </>
        ),
      },
      {
        q: "지정가 주문은 어떻게 동작하나요?",
        a: (
          <>
            <ul>
              <li>매수 지정가: 가격이 지정가 이하로 떨어지면 체결</li>
              <li>매도 지정가: 가격이 지정가 이상으로 오르면 체결</li>
              <li>매칭 엔진이 2분마다 모든 pending 주문 점검</li>
              <li>7일 후 자동 만료 (만료 24시간 전 푸시 알림)</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    title: "포트폴리오 & 보유 종목",
    emoji: "📊",
    items: [
      {
        q: "포트폴리오 가치는 어떻게 계산되나요?",
        a: (
          <>
            <p>전체 자산 = 현금(KRW + USD×환율) + 보유 종목 평가액</p>
            <ul>
              <li>
                <strong>평가액</strong> = 현재가 × 보유수량 (실시간 가격 반영)
              </li>
              <li>
                <strong>수익률</strong> = (현재 평가액 - 매수 비용) / 매수 비용
              </li>
              <li>
                <strong>실현 손익</strong> = 매도 시 차익 (=매도가 - 평단가)
              </li>
              <li>
                <strong>평단가</strong> = 분할 매수의 가중평균 (자동 계산)
              </li>
            </ul>
          </>
        ),
      },
      {
        q: "스냅샷은 무엇인가요?",
        a: (
          <>
            <p>
              5분마다 포트폴리오 총 가치가 <code>portfolio_snapshots</code>{" "}
              테이블에 기록됩니다.
            </p>
            <ul>
              <li>차트로 자산 변화 시각화</li>
              <li>리더보드 수익률 계산 기반</li>
              <li>30일 데이터로 Sharpe ratio 계산</li>
            </ul>
          </>
        ),
      },
      {
        q: "보유 종목 가격이 안 갱신돼요",
        a: (
          <>
            <p>다음을 확인해보세요:</p>
            <ul>
              <li>
                <Link href="/app/health" style={{ color: "var(--yg-up-deep)" }}>
                  시스템 상태
                </Link>{" "}
                페이지에서 worker 동작 확인
              </li>
              <li>
                해당 종목이{" "}
                <code>is_active=false</code> 상태가 됐을 수 있음 (상폐 / 이름
                변경)
              </li>
              <li>일주일 이상 자동 fetch 실패 시 watchdog가 비활성화 처리</li>
              <li>
                관리자에게 문의: rms6654@gmail.com
              </li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    title: "🏆 글로벌 리더보드",
    emoji: "🏆",
    items: [
      {
        q: "리더보드는 어디서 보나요?",
        a: (
          <>
            <p>
              <Link
                href="/app/leaderboard"
                style={{ color: "var(--yg-up-deep)", fontWeight: 700 }}
              >
                → /app/leaderboard
              </Link>{" "}
              에서 확인 가능합니다. 3개 카테고리 탭으로 나뉘어 있어요:
            </p>
            <ul>
              <li>
                <strong>종합</strong>: 누적 수익률 (가입 30일+ 거래 5건+)
              </li>
              <li>
                <strong>이번 달</strong>: 30일 수익률 (거래 5건+)
              </li>
              <li>
                <strong>꾸준함</strong>: Sharpe ratio (변동성 대비 수익)
              </li>
            </ul>
          </>
        ),
      },
      {
        q: "리더보드에 등재되려면?",
        a: (
          <>
            <ol>
              <li>
                <Link href="/app/settings" style={{ color: "var(--yg-up-deep)" }}>
                  설정
                </Link>
                에서 글로벌 리더보드 참여 모드 선택:
                <ul>
                  <li>🔒 비공개 (기본): 리더보드 노출 안 됨</li>
                  <li>👤 익명: 등수+수익률만 (&quot;익명&quot;으로 표시)</li>
                  <li>✨ 닉네임: 본인 닉네임 공개</li>
                </ul>
              </li>
              <li>
                자격 조건 충족:
                <ul>
                  <li>거래 5건 이상 (모든 카테고리 필수)</li>
                  <li>가입 30일 이상 (종합/꾸준함만)</li>
                </ul>
              </li>
              <li>
                <strong>매일 새벽 04:00 KST</strong>에 리더보드 자동 갱신
              </li>
            </ol>
            <p
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
              }}
            >
              ⚠️ 본명(가입 이메일/이름)은 절대 공개되지 않습니다.
            </p>
          </>
        ),
      },
      {
        q: "닉네임 변경 가능한가요?",
        a: (
          <>
            <ul>
              <li>처음 등록 후 30일 이내 변경 1회 가능</li>
              <li>이후 30일에 한 번씩만 변경 (트롤링 방지)</li>
              <li>2~20자, 한글/영문/숫자/_ 만 허용</li>
              <li>비속어/예약어 자동 차단</li>
            </ul>
          </>
        ),
      },
      {
        q: "Sharpe ratio가 뭔가요?",
        a: (
          <>
            <p>
              <strong>변동성 대비 수익률</strong> 지표입니다. 같은 수익률이라도
              덜 변동했으면 더 좋은 트레이더.
            </p>
            <ul>
              <li>공식: (일별 수익률 평균) / (일별 수익률 표준편차)</li>
              <li>30일 데이터 기준</li>
              <li>14일 이상 거래 데이터 필요</li>
              <li>높을수록 안정적이고 효율적인 투자 의미</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    title: "친구방 (Rooms)",
    emoji: "👥",
    items: [
      {
        q: "친구방은 무엇인가요?",
        a: (
          <>
            <p>
              지인끼리 별도 portfolio로 경쟁하는 공간입니다. 글로벌 리더보드와
              완전 별개.
            </p>
            <ul>
              <li>최대 20명, 시작 자본/기간 자유 설정</li>
              <li>방장이 초대 코드 공유 → 다른 사용자가 [가입]</li>
              <li>방 별 리더보드 별도 운영 (방 종료 시 최종 순위)</li>
              <li>본인 이름 그대로 노출 (글로벌은 옵션, 방은 항상)</li>
            </ul>
          </>
        ),
      },
      {
        q: "어떻게 방을 만드나요?",
        a: (
          <>
            <ol>
              <li>
                <Link href="/app/rooms/new" style={{ color: "var(--yg-up-deep)" }}>
                  새 방 만들기
                </Link>
              </li>
              <li>이름, 시작 자본, 종료일 설정</li>
              <li>생성 후 초대 코드 자동 발급 → 친구들에게 공유</li>
              <li>방장 본인은 자동 가입</li>
            </ol>
          </>
        ),
      },
    ],
  },
  {
    title: "🎮 인생 시뮬레이션 (게임)",
    emoji: "🎮",
    items: [
      {
        q: "인생 시뮬레이션이 뭔가요?",
        a: (
          <>
            <p>
              매도 타이밍 훈련을 위한 게임입니다. 가상 캐릭터로 1,000,000원
              시작 → 5% 수익 달성 시 환생.
            </p>
            <ul>
              <li>실시간 비례 1:24 (실제 1시간 = 게임 1일)</li>
              <li>오프라인에서도 캐릭터 자동 진행 (월급/공부 등)</li>
              <li>플레이 모드 3가지: 학습 / 수입 / 균형</li>
              <li>일기로 매일 자동 기록 + 랜덤 이벤트</li>
              <li>환생 시 영구 업그레이드 (Roguelike)</li>
            </ul>
          </>
        ),
      },
      {
        q: "환생 조건이 뭐예요?",
        a: (
          <>
            <ul>
              <li>
                <strong>금융 수익 누적 5%</strong> 달성 시 환생 가능
              </li>
              <li>알바/월급 같은 근로 수입은 제외, 주식/부동산 매도 차익만 인정</li>
              <li>(예: 시작 100만원 → 누적 매도 차익 5만원 = 환생 가능)</li>
              <li>환생 시 포인트 획득 + 영구 업그레이드 구매 가능</li>
            </ul>
          </>
        ),
      },
      {
        q: "게임에서 산 주식이 실제 포트폴리오에 반영되나요?",
        a: (
          <>
            <p>
              <strong>아니요.</strong> 게임 내 주식과 실제 모의 포트폴리오는
              완전히 분리되어 있어요. 게임은 캐릭터가 가진 가상 자산이고,
              포트폴리오는 본인 계정의 실 모의 거래입니다.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: "📊 시황 / AI 기능",
    emoji: "📊",
    items: [
      {
        q: "오늘의 시황은 언제 갱신되나요?",
        a: (
          <>
            <ul>
              <li>
                <strong>평일 06:30 KST</strong>: 장 시작 전 브리핑 (어제 미국
                마감 + 오늘 한국 시장 전망)
              </li>
              <li>
                <strong>평일 12:30 KST</strong>: 오전장 정리 (한국 KOSPI/KOSDAQ
                흐름 + 미국 야간 동향)
              </li>
              <li>주말 휴장 — 시황 생성 안 됨</li>
              <li>
                AI(Claude Haiku)가 RSS feed 11개 + Yahoo 13개 종목 헤드라인
                분석
              </li>
            </ul>
          </>
        ),
      },
      {
        q: "시황 팝업을 다시 보고 싶어요",
        a: (
          <>
            <ol>
              <li>
                대시보드 상단{" "}
                <strong>&quot;📊 오늘의 시황&quot; 카드</strong>를 클릭하면 다시 볼 수
                있어요
              </li>
              <li>
                또는{" "}
                <Link
                  href="/app/market-today"
                  style={{ color: "var(--yg-up-deep)" }}
                >
                  /app/market-today
                </Link>
                로 직접 이동
              </li>
              <li>
                과거 시황은{" "}
                <Link
                  href="/app/market-today/history"
                  style={{ color: "var(--yg-up-deep)" }}
                >
                  아카이브
                </Link>
                에서 확인
              </li>
            </ol>
          </>
        ),
      },
      {
        q: "키워드별 관련 종목은 어떻게 추천되나요?",
        a: (
          <>
            <p>
              AI가 헤드라인 100개를 분석해서 키워드별 카테고리 분류 + 관련
              종목 ticker 3-4개를 추천합니다.
            </p>
            <ul>
              <li>예: &quot;기준금리&quot; → KB금융, 신한지주, 하나금융</li>
              <li>예: &quot;이란전쟁&quot; → 한화에어로스페이스, LIG넥스원</li>
              <li>예: &quot;AI 반도체&quot; → 삼성전자, SK하이닉스, NVDA</li>
              <li>추천 종목은 거래 페이지로 직링크</li>
            </ul>
          </>
        ),
      },
    ],
  },
  {
    title: "🔔 알림 / 푸시",
    emoji: "🔔",
    items: [
      {
        q: "어떤 알림을 받을 수 있나요?",
        a: (
          <>
            <p>
              <Link href="/app/settings" style={{ color: "var(--yg-up-deep)" }}>
                설정
              </Link>
              에서 종류별 on/off 가능:
            </p>
            <ul>
              <li>지정가 주문 체결</li>
              <li>주문 만료 24시간 전</li>
              <li>친구방 시작/종료 24시간 전</li>
              <li>배당 입금</li>
              <li>분할/병합 적용</li>
              <li>가격 알림 (개별 종목 설정)</li>
            </ul>
          </>
        ),
      },
      {
        q: "iOS에서 푸시 알림이 안 와요",
        a: (
          <>
            <ol>
              <li>
                iOS 16.4 이상 + Safari에서 <strong>홈 화면에 추가</strong>{" "}
                필수 (PWA 모드)
              </li>
              <li>홈 화면 아이콘으로 앱을 한 번 열기</li>
              <li>설정 → 푸시 알림 ON</li>
              <li>iOS는 일반 Safari 탭에서는 푸시 미지원</li>
            </ol>
            <p
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "var(--yg-fg-tertiary)",
              }}
            >
              데스크탑 Chrome/Firefox/Edge는 즉시 동작.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: "💻 PWA 설치 / 기술",
    emoji: "💻",
    items: [
      {
        q: "홈 화면에 어떻게 추가하나요?",
        a: (
          <>
            <ul>
              <li>
                <strong>iOS Safari</strong>: 공유 버튼 → &quot;홈 화면에 추가&quot;
              </li>
              <li>
                <strong>Android Chrome</strong>: 메뉴 → &quot;앱 설치&quot; 또는 &quot;홈
                화면에 추가&quot;
              </li>
              <li>
                <strong>데스크탑 Chrome</strong>: 주소창 우측의 설치 아이콘
              </li>
              <li>
                상세 가이드:{" "}
                <Link
                  href="/app/help/install"
                  style={{ color: "var(--yg-up-deep)" }}
                >
                  설치 가이드
                </Link>
              </li>
            </ul>
          </>
        ),
      },
      {
        q: "오프라인에서도 동작하나요?",
        a: (
          <>
            <p>
              Service Worker로 일부 페이지 캐시. 단 가격/거래 같은 실시간
              데이터는 인터넷 필요. 오프라인 시 마지막 캐시 표시 + &quot;오프라인&quot;
              안내.
            </p>
          </>
        ),
      },
      {
        q: "다크 모드 지원하나요?",
        a: (
          <>
            <p>
              네. 헤더의 🌙 아이콘으로 라이트/다크/시스템 3-state 토글. 시스템
              설정 따라 자동 전환도 가능.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: "🔐 계정 / 보안",
    emoji: "🔐",
    items: [
      {
        q: "이메일 인증이 안 와요",
        a: (
          <>
            <ul>
              <li>스팸 폴더 확인 (특히 네이버/다음 계정)</li>
              <li>가입 후 5-10분 안에 도착하지 않으면 다시 가입 시도</li>
              <li>해결 안 되면 rms6654@gmail.com 문의</li>
            </ul>
          </>
        ),
      },
      {
        q: "비밀번호를 잊었어요",
        a: (
          <>
            <p>
              로그인 페이지의 &quot;비밀번호 재설정&quot; 링크로 이메일 reset 가능. 5-10분
              안에 메일 도착.
            </p>
          </>
        ),
      },
      {
        q: "계정 삭제하고 싶어요",
        a: (
          <>
            <p>
              현재 셀프 삭제 UI는 준비 중. 즉시 삭제 원하시면 rms6654@gmail.com
              요청 → 24시간 안에 처리. 삭제 시 portfolio, 거래내역, 게임 데이터
              모두 영구 삭제됩니다.
            </p>
          </>
        ),
      },
      {
        q: "데이터는 어디 저장되나요?",
        a: (
          <>
            <ul>
              <li>
                <strong>Supabase Cloud (Seoul)</strong> — DB + Auth
              </li>
              <li>
                <strong>Oracle Cloud (춘천)</strong> — 워커 (시세 fetch, 매칭
                엔진)
              </li>
              <li>
                <strong>Vercel</strong> — 웹 서버 + CDN
              </li>
              <li>모든 데이터는 SSL/TLS 암호화 전송</li>
              <li>비밀번호는 bcrypt 해시 저장 (Supabase Auth)</li>
            </ul>
          </>
        ),
      },
    ],
  },
];

export default async function HelpPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  return (
    <div style={{ paddingBottom: 24 }}>
      <PageHeader title="도움말" sub={`${SECTIONS.length}개 섹션 · 자주 묻는 질문`} />

      {/* TOC */}
      <div style={{ padding: "8px 20px 0" }}>
        <div className="yg-card" style={{ padding: 16 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--yg-fg-tertiary)",
              letterSpacing: "0.04em",
              marginBottom: 10,
            }}
          >
            🗺️ 목차
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SECTIONS.map((s) => (
              <a
                key={s.title}
                href={`#${encodeURIComponent(s.title)}`}
                className="yg-tap"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 10px",
                  borderRadius: 99,
                  background: "var(--yg-bg-tint-ink)",
                  color: "var(--yg-fg-secondary)",
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                <span>{s.emoji}</span>
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* 섹션별 FAQ */}
      <div
        style={{
          padding: "12px 20px 0",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            id={section.title}
            style={{ scrollMarginTop: 80 }}
          >
            <h2
              style={{
                margin: "8px 4px 12px",
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{section.emoji}</span>
              {section.title}
            </h2>
            <div className="yg-card" style={{ padding: 18 }}>
              {section.items.map((item, i) => (
                <details
                  key={`${section.title}-${i}`}
                  style={{
                    paddingTop: i === 0 ? 0 : 12,
                    paddingBottom: 12,
                    borderBottom:
                      i === section.items.length - 1
                        ? 0
                        : "1px solid var(--yg-line-faint)",
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: "-0.01em",
                      color: "var(--yg-fg-primary)",
                      listStyle: "none",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--yg-up-deep)",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      Q.
                    </span>
                    <span>{item.q}</span>
                  </summary>
                  <div
                    className="help-body"
                    style={{
                      marginTop: 10,
                      paddingLeft: 18,
                      fontSize: 13,
                      lineHeight: 1.65,
                      color: "var(--yg-fg-secondary)",
                      fontWeight: 600,
                    }}
                  >
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 문의 */}
      <div style={{ padding: "20px 20px 0" }}>
        <div
          className="yg-card"
          style={{
            padding: 18,
            background: "var(--yg-bg-tint-red)",
            color: "var(--yg-up-deep)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
            🆘 그래도 해결이 안 되면
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <a
              href="mailto:rms6654@gmail.com"
              style={{
                color: "var(--yg-up-deep)",
                textDecoration: "underline",
              }}
            >
              rms6654@gmail.com
            </a>{" "}
            으로 문의해주세요
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .help-body p { margin: 0 0 8px; }
        .help-body p:last-child { margin-bottom: 0; }
        .help-body ul, .help-body ol { margin: 0 0 8px; padding-left: 20px; }
        .help-body li { margin-bottom: 4px; }
        .help-body strong { color: var(--yg-fg-primary); font-weight: 800; }
        .help-body code {
          background: var(--yg-bg-tint-ink);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'Pretendard Variable', ui-monospace, monospace;
        }
      `,
        }}
      />
    </div>
  );
}
