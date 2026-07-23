"use client";

import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

export function PageHeader({ current, title, description }: { current: MessageKey; title: MessageKey; description: MessageKey }) {
  const { t } = useI18n();
  return (
    <header className="page-header">
      <div className="breadcrumb" aria-label={t("breadcrumb.aria")}>
        <span>{t("app.name")}</span>
        <span aria-hidden="true">/</span>
        <span>{t(current)}</span>
      </div>
      <h1 className="page-title">{t(title)}</h1>
      <p className="page-description">{t(description)}</p>
    </header>
  );
}
