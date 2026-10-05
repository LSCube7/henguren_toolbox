import type { Route } from "next";
import { redirect } from "next/navigation";
import { isAppLocale } from "@/i18n/config";
import { legacyLocaleChoiceParam, legacyQueryEntries, localizePath } from "@/lib/localized-routing";
import { LocaleRedirect } from "./LocaleRedirect";

export type LegacySearchParams = Record<string, string | string[] | undefined>;

export async function LegacyLocaleRedirectPage({ logicalPath, searchParams }: {
  logicalPath: string;
  searchParams: Promise<LegacySearchParams>;
}) {
  const query = await searchParams;
  const queryEntries = legacyQueryEntries(query);
  const choice = query[legacyLocaleChoiceParam];
  if (isAppLocale(choice)) {
    const suffix = new URLSearchParams(queryEntries).toString();
    // A Location without a fragment inherits the submitted URL's fragment.
    redirect(localizePath(choice, logicalPath + (suffix ? "?" + suffix : "")) as Route);
  }
  return <LocaleRedirect logicalPath={logicalPath} queryEntries={queryEntries} />;
}
