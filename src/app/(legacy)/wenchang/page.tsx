import { LegacyLocaleRedirectPage, type LegacySearchParams } from "@/app/components/LegacyLocaleRedirectPage";

export default function LegacyWenchangPage({ searchParams }: { searchParams: Promise<LegacySearchParams> }) {
  return <LegacyLocaleRedirectPage logicalPath="/wenchang" searchParams={searchParams} />;
}
