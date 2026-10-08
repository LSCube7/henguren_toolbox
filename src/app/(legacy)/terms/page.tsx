import { LegacyLocaleRedirectPage, type LegacySearchParams } from "@/app/components/LegacyLocaleRedirectPage";

export default function LegacyTermsPage({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  return <LegacyLocaleRedirectPage logicalPath="/terms" searchParams={searchParams} />;
}
