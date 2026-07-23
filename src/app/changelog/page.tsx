"use client";

import { PageHeader } from "../components/PageHeader";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

const entries: Array<{
  title: string;
  label: MessageKey;
  groups: Array<{ title: MessageKey; items: MessageKey[] }>;
}> = [
  {
    title: "v3.0.0",
    label: "changelog.releaseLabel",
    groups: [
      { title: "changelog.experience", items: ["changelog.item.1", "changelog.item.2", "changelog.item.3", "changelog.item.4"] },
      { title: "changelog.learning", items: ["changelog.item.5", "changelog.item.6", "changelog.item.7", "changelog.item.8"] },
      { title: "changelog.sync", items: ["changelog.item.9", "changelog.item.10", "changelog.item.11", "changelog.item.12"] },
      { title: "changelog.compliance", items: ["changelog.item.13", "changelog.item.14", "changelog.item.15"] }
    ]
  }
];

export default function ChangelogPage() {
  const { t } = useI18n();
  return (
    <div className="stack-lg">
      <PageHeader current="nav.changelog" title="nav.changelog" description="changelog.description" />
      <section className="stack" aria-label={t("changelog.listAria")}>
        {entries.map((entry) => (
          <article className="md-card stack" key={entry.title}>
            <div className="spread">
              <div>
                <p className="helper-text">{t(entry.label)}</p>
                <h2 className="section-title">{entry.title}</h2>
              </div>
              <span className="badge">{t(entry.title === "v3.0.0" ? "changelog.current" : "changelog.note")}</span>
            </div>
            {entry.groups.map((group) => (
              <section className="stack" key={group.title}>
                <h3 className="card-title">{t(group.title)}</h3>
                <ul className="clean-list">
                  {group.items.map((item) => <li key={item}>{t(item)}</li>)}
                </ul>
              </section>
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}
