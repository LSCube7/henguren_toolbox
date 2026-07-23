"use client";

import Link from "next/link";
import type { Route } from "next";
import type { MessageKey } from "@/i18n/config";
import { useI18n } from "../i18n/AppI18nProvider";

type ToolHref = "/" | "/shici" | "/wenchang" | "/vocab" | "/text" | "/settings" | "/user" | "/license" | "/changelog";

export function ToolCard({
  href,
  title,
  description,
  status,
  icon
}: {
  href: ToolHref;
  title: MessageKey;
  description: MessageKey;
  status: MessageKey;
  icon: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Link href={href as Route} className="md-card md-card--interactive">
      <div className="spread">
        <span className="app-nav__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="badge">{t(status)}</span>
      </div>
      <div className="tool-card__content stack">
        <h2 className="card-title">{t(title)}</h2>
        <p className="card-description">{t(description)}</p>
      </div>
    </Link>
  );
}
