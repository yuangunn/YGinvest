"""가격 fetch 진단 — Oracle VM worker container 안에서 실행."""

import sys

sys.path.insert(0, "/app/src")

import FinanceDataReader as fdr  # noqa: E402

from ygworker.data_sources.yahoo import fetch_closes_batch  # noqa: E402


def main() -> None:
    print("=== FDR KOSDAQ listing ===")
    df_kq = fdr.StockListing("KOSDAQ")
    print(f"  rows: {len(df_kq)}")
    print(f"  columns: {list(df_kq.columns)}")
    has_close = "Close" in df_kq.columns
    print(f"  has Close col: {has_close}")
    if has_close:
        non_null = df_kq["Close"].notna().sum()
        print(f"  non-null Close: {non_null} / {len(df_kq)}")
    print()

    print("=== FDR KOSPI listing ===")
    df_ks = fdr.StockListing("KOSPI")
    print(f"  rows: {len(df_ks)}")
    has_close_ks = "Close" in df_ks.columns
    if has_close_ks:
        non_null = df_ks["Close"].notna().sum()
        print(f"  non-null Close: {non_null} / {len(df_ks)}")
    print()

    # 하이닉스
    print("=== 하이닉스 (000660) ===")
    hynix = df_ks[df_ks["Code"] == "000660"] if "Code" in df_ks.columns else None
    if hynix is not None and len(hynix) > 0:
        row = hynix.iloc[0]
        print(f"  FDR KOSPI: Code={row.get('Code')}, Name={row.get('Name')}, Close={row.get('Close')}")
    else:
        print("  ❌ FDR KOSPI에서 못 찾음")
    # yfinance 시도
    try:
        yf_result = fetch_closes_batch(["000660.KS"])
        print(f"  yfinance batch: {yf_result}")
    except Exception as e:
        print(f"  yfinance batch FAILED: {e}")
    print()

    # KODEX 200 (KOSPI ETF)
    print("=== KODEX 200 (069500) ===")
    if "Code" in df_ks.columns:
        kdx_ks = df_ks[df_ks["Code"] == "069500"]
        kdx_kq = df_kq[df_kq["Code"] == "069500"]
        print(f"  FDR KOSPI: {len(kdx_ks)} rows")
        print(f"  FDR KOSDAQ: {len(kdx_kq)} rows")
        if len(kdx_ks) > 0:
            print(f"    KOSPI row: {kdx_ks.iloc[0].to_dict()}")
    try:
        yf_result = fetch_closes_batch(["069500.KS"])
        print(f"  yfinance batch: {yf_result}")
    except Exception as e:
        print(f"  yfinance batch FAILED: {e}")
    print()

    # 임의 KOSDAQ 5종목 yfinance test
    print("=== KOSDAQ 5종목 yfinance test ===")
    if "Code" in df_kq.columns:
        sample = df_kq["Code"].head(5).tolist()
        symbols = [f"{c}.KQ" for c in sample]
        print(f"  symbols: {symbols}")
        try:
            result = fetch_closes_batch(symbols)
            print(f"  result: {result}")
        except Exception as e:
            print(f"  FAILED: {e}")


if __name__ == "__main__":
    main()
