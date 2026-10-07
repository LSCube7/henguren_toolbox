"use client";

import { M3eCard } from "@m3e/react/card";
import type { MessageKey } from "@/i18n/config";
import { useI18n } from "../i18n/AppI18nProvider";

export function SettingsSection({
  title,
  description,
  control
}: {
  title: MessageKey;
  description?: MessageKey;
  control: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <M3eCard variant="filled"><section className="settings-card-content settings-row" aria-labelledby={`${title}-setting`}>
      <div className="stack">
        <h2 className="section-title" id={`${title}-setting`}>
          {t(title)}
        </h2>
        {description ? <p className="helper-text">{t(description)}</p> : null}
      </div>
      <div>{control}</div>
    </section></M3eCard>
  );
}
