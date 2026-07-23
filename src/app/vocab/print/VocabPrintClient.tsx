"use client";

import type { VocabWord } from "@/lib/types";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useI18n } from "../../i18n/AppI18nProvider";

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
          title: String(source.title ?? ""),
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

function definitionsFor(word: VocabWord, languages: DefinitionLanguage[], unavailable: string) {
  const definitions = [
    ...(languages.includes("en") ? word.en_definition ?? [] : []),
    ...(languages.includes("zh") ? word.zh_definition ?? [] : [])
  ];
  return definitions.length > 0 ? definitions.join("；") : unavailable;
}

export function VocabPrintClient() {
  const { locale, t } = useI18n();
  const payload = useSyncExternalStore(subscribePrintablePayload, readPrintablePayload, () => null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("definition");
  const [definitionLanguages, setDefinitionLanguages] = useState<DefinitionLanguage[]>(["en", "zh"]);
  const [showHint, setShowHint] = useState(true);

  const words = useMemo(() => payload?.sources.flatMap((source) => source.words.map((word) => ({ ...word, sourceTitle: word.sourceTitle ?? source.title }))) ?? [], [payload]);
  const sourceInfo = useMemo(() => payload?.sources.map((source) => source.title || t("print.untitled")).join(", ") ?? t("print.noSource"), [payload, t]);
  const createdAt = payload?.createdAt ? new Date(payload.createdAt).toLocaleString(locale) : "";
  const answerTitle = t(displayMode === "definition" ? "print.answerWord" : "print.answerDefinition");

  if (!payload || words.length === 0) {
    return (
      <section className="md-card stack">
        <h2 className="section-title">{t("print.emptyTitle")}</h2>
        <p className="helper-text">{t("print.emptyDescription")}</p>
        <div>
          <Link href="/vocab">
            <md-filled-button>{t("print.backVocab")}</md-filled-button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="stack-lg vocab-print-page">
      <section className="md-card stack print-config" aria-label={t("print.settingsAria")}>
        <div className="spread">
          <div>
            <h2 className="section-title">{t("print.settingsTitle")}</h2>
            <p className="helper-text">{t("print.settingsDescription", { count: words.length })}</p>
          </div>
          <div className="cluster">
            <Link href="/vocab">
              <md-outlined-button>{t("print.back")}</md-outlined-button>
            </Link>
            <md-filled-button onClick={() => window.print()}>{t("print.action")}</md-filled-button>
          </div>
        </div>

        <div className="print-option-grid">
          <div className="stack">
            <h3 className="card-title">{t("print.displayTitle")}</h3>
            <div className="cluster" role="radiogroup" aria-label={t("print.displayAria")}>
              <md-filter-chip selected={displayMode === "definition"} onClick={() => setDisplayMode("definition")} role="radio" aria-checked={displayMode === "definition"}>
                {t("print.definitionPrompt")}
              </md-filter-chip>
              <md-filter-chip selected={displayMode === "word"} onClick={() => setDisplayMode("word")} role="radio" aria-checked={displayMode === "word"}>
                {t("print.wordPrompt")}
              </md-filter-chip>
            </div>
          </div>

          <div className="stack">
            <h3 className="card-title">{t("print.languageTitle")}</h3>
            <div className="cluster" aria-label={t("print.languageAria")}>
              <md-filter-chip selected={definitionLanguages.includes("zh")} onClick={() => setDefinitionLanguages((current) => toggleLanguage(current, "zh"))}>
                {t("language.chinese")}
              </md-filter-chip>
              <md-filter-chip selected={definitionLanguages.includes("en")} onClick={() => setDefinitionLanguages((current) => toggleLanguage(current, "en"))}>
                {t("language.english")}
              </md-filter-chip>
            </div>
            {definitionLanguages.length === 0 ? <p className="helper-text">{t("print.languageWarning")}</p> : null}
          </div>

          <label className="switch-field print-switch-field">
            <md-switch selected={showHint} checked={showHint} onInput={(event) => setShowHint(Boolean((event.currentTarget as HTMLElement & { checked?: boolean; selected?: boolean }).checked ?? (event.currentTarget as HTMLElement & { selected?: boolean }).selected))} />
            <span>{t("print.hint")}</span>
          </label>
        </div>
      </section>

      <section className="print-sheet" aria-label={t("print.previewAria")}>
        <header className="print-sheet__header">
          <div>
            <p className="print-sheet__eyebrow">Henguren Toolbox</p>
            <h2>{t("page.print.title")}</h2>
          </div>
          <div className="print-sheet__meta">
            <span>{t("print.source", { source: sourceInfo })}</span>
            <span>{t("print.createdAt", { time: createdAt })}</span>
            <span>{t("print.total", { count: words.length })}</span>
          </div>
        </header>

        <section className="print-section">
          <h3>{t("print.questions")}</h3>
          <div className="print-word-list">
            {words.map((word, index) => {
              const prompt = displayMode === "definition" ? definitionsFor(word, definitionLanguages, t("print.noDefinition")) : word.word;
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
                {index + 1}. {displayMode === "definition" ? word.word : definitionsFor(word, definitionLanguages, t("print.noDefinition"))}
              </span>
            ))}
          </div>
        </section>

        <footer className="print-sheet__footer">{t("app.name")} · {sourceInfo}</footer>
      </section>
    </div>
  );
}
