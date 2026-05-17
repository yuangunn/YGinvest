-- Plan #34: bootstrap_etfs 버그로 stocks에 잘못 들어간 row 정리.
--
-- 증상: yfinance가 "TIGER", "KODEX", "FI" 같은 운용사 prefix를 symbol로
--       받은 row에 대해 404 반환. enrich/fetch job 매번 실패.
--
-- 원인: FDR `StockListing('ETF/KR')`의 'Symbol' 컬럼이 가끔 nickname 반환.
-- Fix: bootstrap_etfs.py에서 6자리 숫자 검증 추가 (Plan #34).
--       이미 들어간 row는 이 migration으로 삭제.

-- KR ETF는 모두 6자리 숫자 코드 + .KS suffix 형태.
-- 예외 패턴 (6자리 숫자 + .KS/.KQ가 아닌 것 + KR 시장 + ETF) 삭제.
delete from public.stocks
where instrument_type = 'etf'
  and market in ('KRX_KS', 'KRX_KQ')
  and symbol !~ '^[0-9]{6}\.(KS|KQ)$';

-- 위 조건에 해당해 삭제됐을 row 갯수 확인용:
-- select symbol, name, market from public.stocks
-- where instrument_type = 'etf' and market in ('KRX_KS','KRX_KQ')
--   and symbol !~ '^[0-9]{6}\.(KS|KQ)$';
