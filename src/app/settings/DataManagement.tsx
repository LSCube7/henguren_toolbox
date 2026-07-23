"use client";

import textLists from "@/assets/js/text/list.json";
import vocabLists from "@/assets/js/vocabulary/list.json";
import {
  createToolboxBackup,
  downloadToolboxBackup,
  importToolboxBackup,
  parseToolboxBackup,
  type ToolboxBackup
} from "@/lib/client-data-management";
import { cacheTextLists, cacheVocabLists, clearOfflineCaches, readOfflineStorageSummary, type OfflineStorageSummary } from "@/lib/offline-cache";
import type { VocabListMeta } from "@/lib/vocab-data";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useSnackbar } from "../components/Snackbar";
import { useI18n } from "../i18n/AppI18nProvider";

function formatBytes(value: number | undefined, unavailable: string) {
  if (value === undefined) return unavailable;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function DataManagement() {
  const importRef = useRef<HTMLInputElement>(null);
  const [offlineSummary, setOfflineSummary] = useState<OfflineStorageSummary | null>(null);
  const [pendingBackup, setPendingBackup] = useState<ToolboxBackup | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | "cache" | "clear" | null>(null);
  const { locale, t } = useI18n();
  const { clearSnackbar, showSnackbar } = useSnackbar();

  const refreshOfflineSummary = useCallback(async () => {
    setOfflineSummary(await readOfflineStorageSummary());
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      const summary = await readOfflineStorageSummary();
      if (active) setOfflineSummary(summary);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function exportBackup() {
    setBusy("export");
    clearSnackbar();
    try {
      downloadToolboxBackup(await createToolboxBackup());
      showSnackbar(t("data.backup.exportSuccess"));
    } catch {
      showSnackbar(t("data.backup.exportError"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) {
        setPendingBackup(null);
        showSnackbar(t("data.backup.tooLarge"), "error");
        return;
      }
      setPendingBackup(parseToolboxBackup(await file.text()));
      showSnackbar(t("data.backup.readSuccess"));
    } catch {
      setPendingBackup(null);
      showSnackbar(t("data.backup.readError"), "error");
    } finally {
      event.target.value = "";
    }
  }

  async function confirmImport() {
    if (!pendingBackup) return;
    setBusy("import");
    try {
      const result = await importToolboxBackup(pendingBackup);
      setPendingBackup(null);
      showSnackbar(t("data.backup.importSuccess", { wrongbookCount: result.wrongbookCount, masteryCount: result.masteryCount }));
    } catch {
      showSnackbar(t("data.backup.importPartial"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function cacheAllLearningData() {
    if (!navigator.onLine) {
      showSnackbar(t("data.offline.offlineError"), "error");
      return;
    }
    setBusy("cache");
    try {
      const [vocab, text] = await Promise.all([
        cacheVocabLists(vocabLists as VocabListMeta[]),
        cacheTextLists(textLists.map((item) => item.name))
      ]);
      await refreshOfflineSummary();
      const failed = vocab.failed + text.failed;
      showSnackbar(
        t(failed > 0 ? "data.offline.cachePartial" : "data.offline.cacheSuccess", { vocabCount: vocab.cached, textCount: text.cached, failedCount: failed }),
        failed > 0 ? "error" : "info"
      );
    } finally {
      setBusy(null);
    }
  }

  async function clearCaches() {
    if (!window.confirm(t("data.offline.clearConfirm"))) return;
    setBusy("clear");
    try {
      const result = await clearOfflineCaches();
      await refreshOfflineSummary();
      showSnackbar(result.deleted > 0 ? t("data.offline.clearSuccess", { count: result.deleted }) : t("data.offline.clearEmpty"));
    } catch {
      showSnackbar(t("data.offline.clearError"), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="settings-group" aria-labelledby="data-management-title">
      <div className="settings-group__header">
        <p className="breadcrumb">Settings</p>
        <h2 className="section-title" id="data-management-title">{t("data.title")}</h2>
        <p className="helper-text">{t("data.description")}</p>
      </div>

      <section className="md-card stack" aria-label={t("data.backup.aria")}>
        <div className="spread">
          <div>
            <h3 className="card-title">{t("data.backup.title")}</h3>
            <p className="helper-text">{t("data.backup.description")}</p>
          </div>
          <div className="cluster">
            <md-outlined-button disabled={Boolean(busy)} onClick={() => void exportBackup()}>{t(busy === "export" ? "data.backup.exporting" : "data.backup.export")}</md-outlined-button>
            <md-filled-button disabled={Boolean(busy)} onClick={() => importRef.current?.click()}>{t("data.backup.select")}</md-filled-button>
            <input ref={importRef} className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => void selectBackup(event)} />
          </div>
        </div>
        {pendingBackup ? (
          <div className="md-card md-card--flat stack" aria-label={t("data.backup.pendingAria")}>
            <h4 className="card-title">{t("data.backup.pending")}</h4>
            <p className="helper-text">{t("data.backup.exportedAt", { time: new Date(pendingBackup.exportedAt).toLocaleString(locale) })}</p>
            <div className="cluster">
              <span className="info-chip">{t("data.backup.wrongbookCount", { count: pendingBackup.wrongbook.records.length })}</span>
              <span className="info-chip">{t("data.backup.masteryCount", { count: pendingBackup.masteryRecords.length })}</span>
              <span className="info-chip">{t(pendingBackup.edition === "senior" ? "edition.senior" : "edition.junior")}</span>
            </div>
            <p className="helper-text">{t("data.backup.mergeDescription")}</p>
            <div className="cluster">
              <md-filled-button disabled={Boolean(busy)} onClick={() => void confirmImport()}>{t(busy === "import" ? "data.backup.importing" : "data.backup.confirm")}</md-filled-button>
              <md-text-button disabled={Boolean(busy)} onClick={() => setPendingBackup(null)}>{t("common.cancel")}</md-text-button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="md-card stack" aria-label={t("data.offline.aria")}>
        <div className="spread">
          <div>
            <h3 className="card-title">{t("data.offline.title")}</h3>
            <p className="helper-text">{t("data.offline.description", { vocabCount: vocabLists.length, textCount: textLists.length })}</p>
          </div>
          <div className="cluster">
            <md-outlined-button disabled={Boolean(busy)} onClick={() => void refreshOfflineSummary()}>{t("data.offline.refresh")}</md-outlined-button>
            <md-filled-button disabled={Boolean(busy)} onClick={() => void cacheAllLearningData()}>{t(busy === "cache" ? "data.offline.caching" : "data.offline.cacheAll")}</md-filled-button>
            <md-outlined-button disabled={Boolean(busy)} onClick={() => void clearCaches()}>{t(busy === "clear" ? "data.offline.clearing" : "data.offline.clear")}</md-outlined-button>
          </div>
        </div>
        <div className="md-grid" aria-label={t("data.offline.statusAria")}>
          {[
            [t("data.offline.cacheGroups"), offlineSummary?.cacheCount ?? "—"],
            [t("data.offline.cacheEntries"), offlineSummary?.entryCount ?? "—"],
            [t("data.offline.usage"), formatBytes(offlineSummary?.usage, t("data.unavailable"))],
            [t("data.offline.quota"), formatBytes(offlineSummary?.quota, t("data.unavailable"))]
          ].map(([title, value]) => (
            <article className="md-card md-card--flat" key={title}>
              <p className="helper-text">{title}</p>
              <div className="metric-value">{value}</div>
            </article>
          ))}
        </div>
        <p className="helper-text">{t("data.offline.persistence", { status: offlineSummary?.persisted === undefined ? t("data.unavailable") : offlineSummary.persisted ? t("data.offline.enabled") : t("data.offline.disabled") })}</p>
      </section>
    </section>
  );
}
