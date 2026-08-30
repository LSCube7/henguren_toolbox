"use client";

import contents from "@/assets/js/wenchang/contents.json";
import { useMemo, useState } from "react";
import { useI18n } from "../i18n/AppI18nProvider";
import { filterByField, toggleFieldFilter, type FieldFilter } from "@/lib/wenchang-filter";

type Item = {
  name: string;
  author: string;
  origin: string;
  grade: string;
  style?: string;
};

const groups = [
  { title: "wenchang.article", items: contents.article as Item[] },
  { title: "wenchang.poem", items: contents.poem as Item[] }
] as const;

export function WenchangClient() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<FieldFilter<Item> | null>(null);
  const filteredGroups = useMemo(
    () =>
      groups.map((group) => ({
        ...group,
        items: filterByField(group.items, filter)
      })),
    [filter]
  );

  function toggleFilter(field: keyof Item, value: string) {
    setFilter((current) => toggleFieldFilter(current, field, value));
  }

  return (
    <div className="stack">
      <div className="cluster">
        <span className={filter ? "badge" : "badge badge--neutral"}>{filter ? t("wenchang.filtered", { value: filter.value }) : t("wenchang.all")}</span>
        <md-outlined-button onClick={() => setFilter(null)} disabled={!filter}>
          {t("wenchang.clear")}
        </md-outlined-button>
      </div>
      {filteredGroups.map((group) => (
        <section className="md-card stack" key={group.title} aria-labelledby={`${group.title}-title`}>
          <h2 className="section-title" id={`${group.title}-title`}>
            {t(group.title)}
          </h2>
          <div className="table-wrap">
            <table className="md-table">
              <thead>
                <tr>
                  <th scope="col">{t("wenchang.name")}</th>
                  <th scope="col">{t("wenchang.author")}</th>
                  <th scope="col">{t("wenchang.source")}</th>
                  <th scope="col">{t("wenchang.grade")}</th>
                  <th scope="col">{t("wenchang.genre")}</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={`${group.title}-${item.name}`}>
                    <td>
                      <button
                        className="wenchang-filter-button"
                        type="button"
                        aria-pressed={filter?.field === "name" && filter.value === item.name}
                        onClick={() => toggleFilter("name", item.name)}
                      >
                        {item.name}
                      </button>
                    </td>
                    <td>
                      <button
                        className="wenchang-filter-button"
                        type="button"
                        aria-pressed={filter?.field === "author" && filter.value === item.author}
                        onClick={() => toggleFilter("author", item.author)}
                      >
                        {item.author}
                      </button>
                    </td>
                    <td>
                      <button
                        className="wenchang-filter-button"
                        type="button"
                        aria-pressed={filter?.field === "origin" && filter.value === item.origin}
                        onClick={() => toggleFilter("origin", item.origin)}
                      >
                        {item.origin}
                      </button>
                    </td>
                    <td>
                      <button
                        className="wenchang-filter-button"
                        type="button"
                        aria-pressed={filter?.field === "grade" && filter.value === item.grade}
                        onClick={() => toggleFilter("grade", item.grade)}
                      >
                        {item.grade}
                      </button>
                    </td>
                    <td>{item.style || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
