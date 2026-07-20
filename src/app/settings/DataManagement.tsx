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
import { StatusAlert } from "../components/StatusAlert";

function formatBytes(value: number | undefined) {
  if (value === undefined) return "浏览器未提供";
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
  const [message, setMessage] = useState("");

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
    setMessage("");
    try {
      downloadToolboxBackup(await createToolboxBackup());
      setMessage("统一备份已导出。文件不包含开发者模式下保存的 R2 访问密钥。");
    } catch {
      setMessage("统一备份导出失败，请稍后重试。调试信息：模块 data-backup，错误类型 EXPORT_FAILED。");
    } finally {
      setBusy(null);
    }
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("备份文件超过 10 MB，请确认选择了正确的工具箱备份。");
      setPendingBackup(parseToolboxBackup(await file.text()));
      setMessage("备份文件已读取，请核对摘要后确认导入。");
    } catch (error) {
      setPendingBackup(null);
      setMessage(error instanceof Error ? error.message : "备份文件读取失败。");
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
      setMessage(`已合并导入 ${result.wrongbookCount} 条错题记录和 ${result.masteryCount} 条掌握度记录。重新加载页面后设置会完整显示。`);
    } catch {
      setMessage("统一备份未全部导入，已合并的部分数据可能保留。请重试或重新导出备份。调试信息：模块 data-backup，错误类型 IMPORT_PARTIAL。");
    } finally {
      setBusy(null);
    }
  }

  async function cacheAllLearningData() {
    if (!navigator.onLine) {
      setMessage("当前离线，无法下载新的学习数据；现有离线内容仍可使用。");
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
      setMessage(failed > 0 ? `已缓存 ${vocab.cached} 个单词单元和 ${text.cached} 篇课文，${failed} 项失败。` : `已缓存 ${vocab.cached} 个单词单元和 ${text.cached} 篇课文。`);
    } finally {
      setBusy(null);
    }
  }

  async function clearCaches() {
    if (!window.confirm("清除后，离线页面、单词和课文需要联网重新下载。错题本、掌握度和设置不会删除。确定继续吗？")) return;
    setBusy("clear");
    try {
      const result = await clearOfflineCaches();
      await refreshOfflineSummary();
      setMessage(result.deleted > 0 ? `已清除 ${result.deleted} 组离线缓存。` : "当前没有可清除的离线缓存。");
    } catch {
      setMessage("离线缓存清除失败，请稍后重试。调试信息：模块 offline-cache，错误类型 CLEAR_FAILED。");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="settings-group" aria-labelledby="data-management-title">
      <div className="settings-group__header">
        <p className="breadcrumb">Settings</p>
        <h2 className="section-title" id="data-management-title">数据与离线管理</h2>
        <p className="helper-text">集中备份本地学习数据，并管理单词、课文和应用页面的离线缓存。</p>
      </div>

      <section className="md-card stack" aria-label="统一数据备份">
        <div className="spread">
          <div>
            <h3 className="card-title">统一备份</h3>
            <p className="helper-text">包含设置、学习阶段、初始向导、错题本和掌握度；不会导出 R2 密钥或其他开发者同步源凭据。</p>
          </div>
          <div className="cluster">
            <md-outlined-button disabled={Boolean(busy)} onClick={() => void exportBackup()}>{busy === "export" ? "正在导出…" : "导出备份"}</md-outlined-button>
            <md-filled-button disabled={Boolean(busy)} onClick={() => importRef.current?.click()}>选择备份</md-filled-button>
            <input ref={importRef} className="hidden-input" type="file" accept=".json,application/json" onChange={(event) => void selectBackup(event)} />
          </div>
        </div>
        {pendingBackup ? (
          <div className="md-card md-card--flat stack" aria-label="待导入备份摘要">
            <h4 className="card-title">待导入备份</h4>
            <p className="helper-text">导出时间：{new Date(pendingBackup.exportedAt).toLocaleString("zh-CN")}</p>
            <div className="cluster">
              <span className="info-chip">错题 {pendingBackup.wrongbook.records.length} 条</span>
              <span className="info-chip">掌握度 {pendingBackup.masteryRecords.length} 条</span>
              <span className="info-chip">{pendingBackup.edition === "senior" ? "高中版" : "初中版"}</span>
            </div>
            <p className="helper-text">错题本和掌握度按记录合并；设置、学习阶段和向导状态使用备份值。现有开发者同步源配置不会改变。</p>
            <div className="cluster">
              <md-filled-button disabled={Boolean(busy)} onClick={() => void confirmImport()}>{busy === "import" ? "正在导入…" : "确认合并导入"}</md-filled-button>
              <md-text-button disabled={Boolean(busy)} onClick={() => setPendingBackup(null)}>取消</md-text-button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="md-card stack" aria-label="离线内容管理">
        <div className="spread">
          <div>
            <h3 className="card-title">离线内容</h3>
            <p className="helper-text">一键缓存全部 {vocabLists.length} 个单词单元和 {textLists.length} 篇课文，也可以查看或清除当前缓存。</p>
          </div>
          <div className="cluster">
            <md-outlined-button disabled={Boolean(busy)} onClick={() => void refreshOfflineSummary()}>刷新状态</md-outlined-button>
            <md-filled-button disabled={Boolean(busy)} onClick={() => void cacheAllLearningData()}>{busy === "cache" ? "正在缓存…" : "缓存全部学习数据"}</md-filled-button>
            <md-outlined-button disabled={Boolean(busy)} onClick={() => void clearCaches()}>{busy === "clear" ? "正在清除…" : "清除离线缓存"}</md-outlined-button>
          </div>
        </div>
        <div className="md-grid" aria-label="离线存储状态">
          {[
            ["缓存组", offlineSummary?.cacheCount ?? "—"],
            ["缓存条目", offlineSummary?.entryCount ?? "—"],
            ["本站占用", formatBytes(offlineSummary?.usage)],
            ["浏览器配额", formatBytes(offlineSummary?.quota)]
          ].map(([title, value]) => (
            <article className="md-card md-card--flat" key={title}>
              <p className="helper-text">{title}</p>
              <div className="metric-value">{value}</div>
            </article>
          ))}
        </div>
        <p className="helper-text">持久化存储：{offlineSummary?.persisted === undefined ? "浏览器未提供" : offlineSummary.persisted ? "已启用" : "未启用，空间不足时浏览器可能自动清理缓存"}</p>
      </section>
      <StatusAlert message={message} />
    </section>
  );
}
