"use client";
import { M3eButton } from "@m3e/react/button";
import { M3eButtonGroup } from "@m3e/react/button-group";
import { moveButtonGroupSelection } from "@/app/components/button-group-keyboard";
import { M3eSwitch } from "@m3e/react/switch";

import type { VocabWord } from "@/lib/types";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useI18n } from "../../i18n/AppI18nProvider";
import { localizePath } from "@/lib/localized-routing";

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

function displayVocabularyTitle(title: string) {
  return title.replace("选择性必修", "选必");
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
  const sourceInfo = useMemo(() => payload?.sources.map((source) => displayVocabularyTitle(source.title || t("print.untitled"))).join(", ") ?? t("print.noSource"), [payload, t]);
  const createdAt = payload?.createdAt ? new Date(payload.createdAt).toLocaleString(locale) : "";
  const answerTitle = t(displayMode === "definition" ? "print.answerWord" : "print.answerDefinition");

  if (!payload || words.length === 0) {
    return (
      <section className="md-card stack">
        <h2 className="section-title">{t("print.emptyTitle")}</h2>
        <p className="helper-text">{t("print.emptyDescription")}</p>
        <div>
          <M3eButton variant="filled" href={localizePath(locale, "/vocab")}>{t("print.backVocab")}</M3eButton>
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
            <M3eButton variant="outlined" href={localizePath(locale, "/vocab")}>{t("print.back")}</M3eButton>
            <M3eButton variant="filled" onClick={() => window.print()}>{t("print.action")}</M3eButton>
          </div>
        </div>

        <div className="print-option-grid">
          <div className="stack">
            <h3 className="card-title">{t("print.displayTitle")}</h3>
            <M3eButtonGroup size="medium" className="button-group" variant="connected" onKeyDown={moveButtonGroupSelection} role="radiogroup" aria-label={t("print.displayAria")}>
              <M3eButton size="medium"
                type="button"
                variant="tonal"
                shape="square"
                toggle
                selected={displayMode === "definition"}
                tabIndex={displayMode === "definition" ? 0 : -1}
                role="radio"
                aria-checked={displayMode === "definition" ? "true" : "false"}
                onBeforeInput={(event) => { if (displayMode === "definition") event.preventDefault(); }}
                onClick={() => setDisplayMode("definition")}
              >
                {t("print.definitionPrompt")}
              </M3eButton>
              <M3eButton size="medium"
                type="button"
                variant="tonal"
                shape="square"
                toggle
                selected={displayMode === "word"}
                tabIndex={displayMode === "word" ? 0 : -1}
                role="radio"
                aria-checked={displayMode === "word" ? "true" : "false"}
                onBeforeInput={(event) => { if (displayMode === "word") event.preventDefault(); }}
                onClick={() => setDisplayMode("word")}
              >
                {t("print.wordPrompt")}
              </M3eButton>
            </M3eButtonGroup>
          </div>

          <div className="stack">
            <h3 className="card-title">{t("print.languageTitle")}</h3>
            <M3eButtonGroup size="medium" className="button-group" variant="connected" multi role="group" aria-label={t("print.languageAria")}>
              <M3eButton size="medium"
                type="button"
                variant="tonal"
                shape="square"
                toggle
                selected={definitionLanguages.includes("zh")}
                role="button"
                aria-pressed={definitionLanguages.includes("zh") ? "true" : "false"}
                onClick={() => setDefinitionLanguages((current) => toggleLanguage(current, "zh"))}
              >
                {t("language.chinese")}
              </M3eButton>
              <M3eButton size="medium"
                type="button"
                variant="tonal"
                shape="square"
                toggle
                selected={definitionLanguages.includes("en")}
                role="button"
                aria-pressed={definitionLanguages.includes("en") ? "true" : "false"}
                onClick={() => setDefinitionLanguages((current) => toggleLanguage(current, "en"))}
              >
                {t("language.english")}
              </M3eButton>
            </M3eButtonGroup>
            {definitionLanguages.length === 0 ? <p className="helper-text">{t("print.languageWarning")}</p> : null}
          </div>

          <label className="switch-field print-switch-field">
            <M3eSwitch aria-label={t("print.hint")} checked={showHint} onInput={(event) => setShowHint(Boolean((event.currentTarget as HTMLElement & { checked: boolean }).checked))} />
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
