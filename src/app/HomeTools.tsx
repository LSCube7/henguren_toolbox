"use client";

import { M3eButton } from "@m3e/react/button";
import { M3eButtonGroup } from "@m3e/react/button-group";
import { moveButtonGroupSelection } from "./components/button-group-keyboard";
import { ToolCard } from "./components/ToolCard";
import { MaterialIcon } from "./components/MaterialIcon";
import { useEdition, writeEdition } from "@/lib/edition";
import { useI18n } from "./i18n/AppI18nProvider";

const tools = [
  { edition: "junior", href: "/shici", title: "nav.shici", body: "tool.shici.description", status: "status.migrated", icon: "search" },
  { edition: "junior", href: "/wenchang", title: "nav.wenchang", body: "tool.wenchang.description", status: "status.migrated", icon: "menu_book" },
  { edition: "senior", href: "/vocab", title: "nav.vocab", body: "tool.vocab.description", status: "status.recommended", icon: "spellcheck" },
  { edition: "senior", href: "/text", title: "nav.text", body: "tool.text.description", status: "status.completed", icon: "article" }
] as const;

export function HomeTools() {
  const edition = useEdition();
  const { t } = useI18n();
  const visibleTools = tools.filter((tool) => tool.edition === edition);

  return (
    <section className="stack" aria-labelledby="tools-title">
      <div className="spread">
        <div className="cluster">
          <span className="app-nav__icon" aria-hidden="true">
            <MaterialIcon name={edition === "junior" ? "school" : "workspace_premium"} />
          </span>
          <div>
            <h2 className="section-title" id="tools-title">
              {t(edition === "junior" ? "home.juniorTools" : "home.seniorTools")}
            </h2>
            <p className="helper-text">{t(edition === "junior" ? "home.juniorDescription" : "home.seniorDescription")}</p>
          </div>
        </div>
        <M3eButtonGroup data-tour="edition" className="button-group edition-switch" variant="connected"
          role="radiogroup" aria-label={t("onboarding.edition.aria")} onKeyDown={moveButtonGroupSelection}>
          {(["junior", "senior"] as const).map((value) => (
            <M3eButton key={value} variant="tonal" shape="square" toggle selected={edition === value}
              role="radio" aria-checked={edition === value ? "true" : "false"} tabIndex={edition === value ? 0 : -1}
              onBeforeInput={(event) => { if (edition === value) event.preventDefault(); }} onClick={() => writeEdition(value)}>
              {t(value === "junior" ? "edition.junior" : "edition.senior")}
            </M3eButton>
          ))}
        </M3eButtonGroup>
      </div>
      <div className="md-grid" data-tour="tools">
        {visibleTools.map((tool) => (
          <ToolCard href={tool.href} title={tool.title} description={tool.body} status={tool.status} icon={<MaterialIcon name={tool.icon} />} key={tool.href} />
        ))}
      </div>
    </section>
  );
}
