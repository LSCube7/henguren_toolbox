import { LegacyLocaleRedirectPage, type LegacySearchParams } from "@/app/components/LegacyLocaleRedirectPage";

export default function LegacyVocabPage({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  return <LegacyLocaleRedirectPage logicalPath="/vocab" searchParams={searchParams} />;
}
