"use client";

import type { VocabWord } from "@/lib/types";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

type PrintableSource = {
  title: string;
  words: VocabWord[];
};

type PrintablePayload = {
  createdAt: string;
  sources: PrintableSource[];
};

type DisplayMode = "definition" | "word";
type DefinitionLanguage = "zh" | "en";

const storageKey = "henguren-v3-printable-vocab";
let cachedRaw: string | null | undefined;
let cachedPayload: PrintablePayload | null = null;

function readPrintablePayload(): PrintablePayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey);
  if (raw === cachedRaw) return cachedPayload;
  cachedRaw = raw;
  try {
    if (!raw) {
      cachedPayload = null;
      return cachedPayload;
    }
    const parsed = JSON.parse(raw) as Partial<PrintablePayload>;
    if (!Array.isArray(parsed.sources)) {
      cachedPayload = null;
      return cachedPayload;
    }
    cachedPayload = {
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      sources: parsed.sources
        .map((source) => ({
          title: String(source.title ?? "未命名词表"),
          words: Array.isArray(source.words) ? source.words : []
        }))
        .filter((source) => source.words.length > 0)
    };
    return cachedPayload;
  } catch {
    cachedPayload = null;
    return null;
  }
}

function subscribePrintablePayload(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function toggleLanguage(current: DefinitionLanguage[], value: DefinitionLanguage) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function definitionsFor(word: VocabWord, languages: DefinitionLanguage[]) {
  const definitions = [
    ...(languages.includes("en") ? word.en_definition ?? [] : []),
    ...(languages.includes("zh") ? word.zh_definition ?? [] : [])
  ];
  return definitions.length > 0 ? definitions.join("；") : "未提供释义";
}

export function VocabPrintClient() {
  const payload = useSyncExternalStore(subscribePrintablePayload, readPrintablePayload, () => null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("definition");
  const [definitionLanguages, setDefinitionLanguages] = useState<DefinitionLanguage[]>(["en", "zh"]);
  const [showHint, setShowHint] = useState(true);

  const words = useMemo(() => payload?.sources.flatMap((source) => source.words.map((word) => ({ ...word, sourceTitle: word.sourceTitle ?? source.title }))) ?? [], [payload]);
  const sourceInfo = useMemo(() => payload?.sources.map((source) => source.title).join("、") ?? "未选择词表", [payload]);
  const createdAt = payload?.createdAt ? new Date(payload.createdAt).toLocaleString("zh-CN") : "";
  const answerTitle = displayMode === "definition" ? "答案：原词" : "答案：释义";

  if (!payload || words.length === 0) {
    return (
      <section className="md-card stack">
        <h2 className="section-title">没有可打印的词表</h2>
        <p className="helper-text">请先返回单词测试页，选择 Unit 或自定义词表后再创建打印版。</p>
        <div>
          <Link href="/vocab">
            <md-filled-button>返回单词测试</md-filled-button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg vocab-print-page">
      <section className="md-card stack print-config" aria-label="打印版设置">
        <div className="spread">
          <div>
            <h2 className="section-title">显示设置</h2>
            <p className="helper-text">当前共 {words.length} 个单词。选择纸面上显示原词还是释义，再打印。</p>
          </div>
          <div className="cluster">
            <Link href="/vocab">
              <md-outlined-button>返回选择</md-outlined-button>
            </Link>
            <md-filled-button onClick={() => window.print()}>打印</md-filled-button>
          </div>
        </div>

        <div className="print-option-grid">
          <div className="stack">
            <h3 className="card-title">题目显示</h3>
            <div className="cluster" role="radiogroup" aria-label="题目显示内容">
              <md-filter-chip selected={displayMode === "definition"} onClick={() => setDisplayMode("definition")} role="radio" aria-checked={displayMode === "definition"}>
                显示释义，默写原词
              </md-filter-chip>
              <md-filter-chip selected={displayMode === "word"} onClick={() => setDisplayMode("word")} role="radio" aria-checked={displayMode === "word"}>
                显示原词，默写释义
              </md-filter-chip>
            </div>
          </div>

          <div className="stack">
            <h3 className="card-title">释义语言</h3>
            <div className="cluster" aria-label="选择释义语言">
              <md-filter-chip selected={definitionLanguages.includes("zh")} onClick={() => setDefinitionLanguages((current) => toggleLanguage(current, "zh"))}>
                中文
              </md-filter-chip>
              <md-filter-chip selected={definitionLanguages.includes("en")} onClick={() => setDefinitionLanguages((current) => toggleLanguage(current, "en"))}>
                英语
              </md-filter-chip>
            </div>
            {definitionLanguages.length === 0 ? <p className="helper-text">至少建议选择一种释义语言，否则会显示“未提供释义”。</p> : null}
          </div>

          <label className="switch-field print-switch-field">
            <md-switch selected={showHint} checked={showHint} onInput={(event) => setShowHint(Boolean((event.currentTarget as HTMLElement & { checked?: boolean; selected?: boolean }).checked ?? (event.currentTarget as HTMLElement & { selected?: boolean }).selected))} />
            <span>首字母提示</span>
          </label>
        </div>
      </section>

      <section className="print-sheet" aria-label="打印预览">
        <header className="print-sheet__header">
          <div>
            <p className="print-sheet__eyebrow">Henguren Toolbox</p>
            <h2>单词测试打印版</h2>
          </div>
          <div className="print-sheet__meta">
            <span>来源：{sourceInfo}</span>
            <span>生成时间：{createdAt}</span>
            <span>共 {words.length} 题</span>
          </div>
        </header>

        <section className="print-section">
          <h3>默写题目</h3>
          <div className="print-word-list">
            {words.map((word, index) => {
              const prompt = displayMode === "definition" ? definitionsFor(word, definitionLanguages) : word.word;
              const hint = showHint && displayMode === "definition" ? word.word[0] : "";
              return (
                <article className="print-word-item" key={`${word.sourceName ?? word.sourceTitle}-${word.word}-${index}`}>
                  <span className="print-word-index">{index + 1}.</span>
                  {hint ? <span className="print-hint">{hint}</span> : null}
                  <span className="print-blank" aria-hidden="true" />
                  <span className="print-prompt">{prompt}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="print-section print-answer-section">
          <h3>{answerTitle}</h3>
          <div className="print-answer-grid">
            {words.map((word, index) => (
              <span className="print-answer-item" key={`answer-${word.sourceName ?? word.sourceTitle}-${word.word}-${index}`}>
                {index + 1}. {displayMode === "definition" ? word.word : definitionsFor(word, definitionLanguages)}
              </span>
            ))}
          </div>
        </section>

        <footer className="print-sheet__footer">恨古人工具箱 · {sourceInfo}</footer>
      </section>
    </div>
  );
}
