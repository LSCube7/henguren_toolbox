"use client";

import { PageHeader } from "../components/PageHeader";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

const sections: Array<{ title: MessageKey; body: MessageKey }> = [
  { title: "terms.section.1.title", body: "terms.section.1.body" },
  { title: "terms.section.2.title", body: "terms.section.2.body" },
  { title: "terms.section.4.title", body: "terms.section.4.body" },
  { title: "terms.section.5.title", body: "terms.section.5.body" },
  { title: "terms.section.6.title", body: "terms.section.6.body" },
  { title: "terms.section.7.title", body: "terms.section.7.body" }
];

export default function TermsPage() {
  const { t } = useI18n();
  return (
    <div className="stack-lg">
      <PageHeader current="footer.terms" title="footer.terms" description="terms.description" />
      <p className="helper-text legal-updated">{t("legal.updated")}</p>
      {sections.slice(0, 2).map((section) => (
        <section className="md-card stack" key={section.title}>
          <h2 className="section-title">{t(section.title)}</h2>
          <p className="helper-text">{t(section.body)}</p>
        </section>
      ))}
      <section className="md-card stack">
        <h2 className="section-title">{t("terms.section.3.title")}</h2>
        <p className="helper-text">
          {t("terms.section.3.beforeLinks")} <a href="https://auth.lsc7.top/terms" target="_blank" rel="noreferrer">{t("footer.terms")}</a>{" "}
          {t("terms.section.3.betweenLinks")} <a href="https://auth.lsc7.top/privacy" target="_blank" rel="noreferrer">{t("footer.privacy")}</a>{t("terms.section.3.afterLinks")}
        </p>
      </section>
      {sections.slice(2).map((section) => (
        <section className="md-card stack" key={section.title}>
          <h2 className="section-title">{t(section.title)}</h2>
          <p className="helper-text">{t(section.body)}</p>
        </section>
      ))}
    </div>
  );
}
