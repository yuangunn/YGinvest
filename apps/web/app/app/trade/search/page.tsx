import { StockSearch } from "@/components/stock-search";

export default function SearchPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">종목 검색</h1>
      <StockSearch />
    </div>
  );
}
