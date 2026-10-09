"use client";

import { M3eLoadingIndicator } from "@m3e/react/loading-indicator";
import { useI18n } from "../i18n/AppI18nProvider";

export function PageLoading({ label }: { label?: string }) {
  const { t } = useI18n();
  const message = label ?? t("common.pageLoading");
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <M3eLoadingIndicator aria-hidden="true" />
      <span className="helper-text">{message}</span>
    </div>
  );
}
