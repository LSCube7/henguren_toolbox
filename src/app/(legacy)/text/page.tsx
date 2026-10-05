import { LegacyLocaleRedirectPage, type LegacySearchParams } from "@/app/components/LegacyLocaleRedirectPage";

export default function LegacyTextPage({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  return <LegacyLocaleRedirectPage logicalPath="/text" searchParams={searchParams} />;
}
