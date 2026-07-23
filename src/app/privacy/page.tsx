"use client";

import { PageHeader } from "../components/PageHeader";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

const sections: Array<{ title: MessageKey; body: MessageKey }> = [
  { title: "privacy.section.1.title", body: "privacy.section.1.body" },
  { title: "privacy.section.3.title", body: "privacy.section.3.body" },
  { title: "privacy.section.4.title", body: "privacy.section.4.body" },
  { title: "privacy.section.5.title", body: "privacy.section.5.body" },
  { title: "privacy.section.6.title", body: "privacy.section.6.body" },
  { title: "privacy.section.7.title", body: "privacy.section.7.body" }
];

export default function PrivacyPage() {
  const { t } = useI18n();
  return (
    <div className="stack-lg">
      <PageHeader current="footer.privacy" title="footer.privacy" description="privacy.description" />
      <p className="helper-text legal-updated">{t("legal.updated")}</p>
      <section className="md-card stack">
        <h2 className="section-title">{t(sections[0].title)}</h2>
        <p className="helper-text">{t(sections[0].body)}</p>
      </section>
      <section className="md-card stack">
        <h2 className="section-title">{t("privacy.section.2.title")}</h2>
        <p className="helper-text">
          {t("privacy.section.2.beforeLinks")} <a href="https://auth.lsc7.top/privacy" target="_blank" rel="noreferrer">{t("footer.privacy")}</a>{" "}
          {t("privacy.section.2.betweenLinks")} <a href="https://auth.lsc7.top/terms" target="_blank" rel="noreferrer">{t("footer.terms")}</a>.
        </p>
      </section>
      {sections.slice(1).map((section) => (
        <section className="md-card stack" key={section.title}>
          <h2 className="section-title">{t(section.title)}</h2>
          <p className="helper-text">{t(section.body)}</p>
        </section>
      ))}
    </div>
  );
}
