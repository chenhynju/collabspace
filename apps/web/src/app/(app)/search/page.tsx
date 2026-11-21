import { SearchPage } from "@/components/GlobalSearch";

export default function Page({ searchParams }: { searchParams: { q?: string } }) {
  return <SearchPage initialQuery={typeof searchParams.q === "string" ? searchParams.q : ""} />;
}
