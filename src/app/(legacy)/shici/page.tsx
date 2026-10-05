import { LegacyLocaleRedirectPage, type LegacySearchParams } from "@/app/components/LegacyLocaleRedirectPage";

export default function LegacyShiciPage({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  return <LegacyLocaleRedirectPage logicalPath="/shici" searchParams={searchParams} />;
}
