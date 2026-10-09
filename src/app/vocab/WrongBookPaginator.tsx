"use client";

import { useSyncExternalStore } from "react";
import { M3ePaginator } from "@m3e/react/paginator";
import { M3eOption } from "@m3e/react/option";
import { SelectField } from "@/app/components/SelectField";
import { useI18n } from "../i18n/AppI18nProvider";

const compactQuery = "(max-width: 600px)";
function subscribeCompact(onChange: () => void) {
  const media = window.matchMedia(compactQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function WrongBookPaginator({ length, pageIndex, pageSize, onPage }: {
  length: number;
  pageIndex: number;
  pageSize: number;
  onPage: (pageIndex: number, pageSize: number) => void;
}) {
  const { t } = useI18n();
  const compact = useSyncExternalStore(subscribeCompact, () => window.matchMedia(compactQuery).matches, () => false);
  const range = {
    start: length === 0 ? 0 : pageIndex * pageSize + 1,
    end: Math.min((pageIndex + 1) * pageSize, length),
    total: length
  };

  return (
    <div className="wrongbook-pagination">
      {compact && (
        <SelectField className="wrongbook-page-size" label={t("vocab.pagination.size")} aria-label={t("vocab.pagination.size")} value={String(pageSize)} onInput={(event) => {
          const nextSize = Number((event.currentTarget as HTMLElement & { value: string }).value);
          onPage(0, nextSize);
        }}>
          {[10, 20, 50].map((size) => <M3eOption key={size} value={String(size)}>{size}</M3eOption>)}
        </SelectField>
      )}
      <M3ePaginator
        className="wrongbook-paginator"
        aria-label={`${t("vocab.pagination.label")}: ${t("vocab.pagination.range", range)}`}
        length={length}
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageSizes="10,20,50"
        hidePageSize={compact}
        ref={(element) => {
          if (!element) return;
          element.rangeLabelFormatter = (index, size, total) => {
            const start = total === 0 ? 0 : index * (size === "all" ? total : size) + 1;
            const end = Math.min((index + 1) * (size === "all" ? total : size), total);
            return compact ? `${start}–${end} / ${total}` : t("vocab.pagination.range", { start, end, total });
          };
          element.requestUpdate();
        }}
        itemsPerPageLabel={t("vocab.pagination.size")}
        firstPageLabel={t("vocab.pagination.first")}
        previousPageLabel={t("vocab.pagination.previous")}
        nextPageLabel={t("vocab.pagination.next")}
        lastPageLabel={t("vocab.pagination.last")}
        showFirstLastButtons={!compact}
        onPage={(event) => onPage(event.detail.pageIndex, event.detail.pageSize === "all" ? 20 : event.detail.pageSize)}
      />
    </div>
  );
}
