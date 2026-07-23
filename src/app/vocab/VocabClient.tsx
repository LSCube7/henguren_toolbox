"use client";

import list from "@/assets/js/vocabulary/list.json";
import {
  addWrongWord,
  deleteWrongBatch,
  deleteWrongRecord,
  downloadJson,
  getClientId,
  getWrongBookBatches,
  importWrongBookSnapshot,
  readLocalWrongBook
} from "@/lib/client-wrongbook";
import { evaluateAnswer, pickWords } from "@/lib/quiz-engine";
import { mergeUploadWrongBook, overwriteCloudWrongBook, pullAndMergeWrongBook } from "@/lib/client-sync";
import { deleteMasteryRecord, readMasteryMap, recordMasteryResult } from "@/lib/client-mastery";
import { isMasteryDue, isMasteryLearning, type MasteryRecord } from "@/lib/mastery";
import { MaterialIcon } from "../components/MaterialIcon";
import { cacheVocabLists, readVocabCacheStates, useOnlineStatus, type VocabCacheState } from "@/lib/offline-cache";
import { defaultSettings, type ToolboxSettings, type VocabDefinitionLanguage, type WrongBookSnapshot, type VocabWord } from "@/lib/types";
import { getBookCode, getBookTitle, loadVocabList, type VocabListMeta } from "@/lib/vocab-data";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useSnackbar } from "../components/Snackbar";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { MaterialSymbolName } from "@/generated/material-symbols";
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

type UploadedList = VocabListMeta & { words: VocabWord[] };
type TestWord = VocabWord & { wrongRecordId?: string };
type TestMode = "all" | "custom";
type Screen = "select" | "testing" | "result" | "wrongbook";
type WrongBookView = "words" | "batches";
type MasteryFilter = "all" | "due" | "learning" | "mastered";
type CloudAction = "pull" | "overwrite" | "merge";
type AnswerOutcome = "correct" | "wrong";
type DefinitionLanguageMode = "all" | VocabDefinitionLanguage;

const books = Array.from(new Set(list.map((item) => getBookCode(item.name)))).map((code) => ({ code, title: getBookTitle(code) }));
const visibleCustomListCount = 3;
const masteryFilterOptions: Array<{ value: MasteryFilter; label: MessageKey }> = [
  { value: "all", label: "vocab.filter.all" },
  { value: "due", label: "vocab.filter.due" },
  { value: "learning", label: "vocab.filter.learning" },
  { value: "mastered", label: "vocab.filter.mastered" }
];
const definitionLanguageOptions: Array<{ value: DefinitionLanguageMode; label: MessageKey }> = [
  { value: "all", label: "vocab.filter.all" },
  { value: "zh", label: "vocab.language.zhOnly" },
  { value: "en", label: "vocab.language.enOnly" }
];

const cloudActionIcon: Record<CloudAction, MaterialSymbolName> = {
  pull: "cloud_download",
  overwrite: "cloud_upload",
  merge: "cloud_sync"
};

const cloudActionLabel: Record<CloudAction, MessageKey> = {
  pull: "user.wrongbookSync.pulling",
  overwrite: "user.wrongbookSync.overwriting",
  merge: "user.wrongbookSync.merging"
};

function nowStamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function normalizeCustomWords(words: VocabWord[], sourceName: string, sourceTitle: string) {
  return words.map((word) => ({ ...word, sourceName, sourceTitle }));
}

function getSavedQuizSettings() {
  const fallback = {
    showHint: defaultSettings.showHint,
    enableSlipDetection: defaultSettings.enableSlipDetection,
    defaultTestCount: defaultSettings.defaultTestCount,
    vocabDefinitionLanguages: defaultSettings.vocabDefinitionLanguages
  };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = localStorage.getItem("henguren-v3-settings");
    const parsed = saved ? (JSON.parse(saved) as Partial<ToolboxSettings>) : {};
    const languages = Array.isArray(parsed.vocabDefinitionLanguages)
      ? parsed.vocabDefinitionLanguages.filter((language): language is VocabDefinitionLanguage => language === "zh" || language === "en")
      : fallback.vocabDefinitionLanguages;
    return {
      ...fallback,
      ...parsed,
      vocabDefinitionLanguages: languages.length > 0 ? languages : fallback.vocabDefinitionLanguages
    };
  } catch {
    return fallback;
  }
}

function persistDefinitionLanguages(languages: VocabDefinitionLanguage[]) {
  let settings = defaultSettings;
  try {
    const saved = localStorage.getItem("henguren-v3-settings");
    settings = saved ? { ...defaultSettings, ...(JSON.parse(saved) as Partial<ToolboxSettings>) } : defaultSettings;
  } catch {
    settings = defaultSettings;
  }
  localStorage.setItem(
    "henguren-v3-settings",
    JSON.stringify({ ...settings, vocabDefinitionLanguages: languages, updatedAt: new Date().toISOString() })
  );
}

function valueFrom(event: FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

function checkedFrom(event: FormEvent<HTMLElement>) {
  return Boolean((event.currentTarget as HTMLElement & { checked?: boolean; selected?: boolean }).checked ?? (event.currentTarget as HTMLElement & { selected?: boolean }).selected);
}

function toggleValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function wrongRecordId(word: Pick<VocabWord, "word" | "sourceName">) {
  return `${word.sourceName ?? "custom"}:${word.word}`.toLowerCase();
}

function toVocabWord(word: TestWord): VocabWord {
  return {
    word: word.word,
    en_definition: word.en_definition,
    zh_definition: word.zh_definition,
    sourceName: word.sourceName,
    sourceTitle: word.sourceTitle
  };
}

function masteryMessageKey(record: MasteryRecord | undefined): MessageKey {
  if (!record) return "vocab.mastery.new";
  if (record.level === "mastered") return "vocab.mastery.mastered";
  if (record.level === "reviewing") return "vocab.mastery.reviewing";
  return "vocab.mastery.learning";
}

function getDefinitionLanguageMode(languages: VocabDefinitionLanguage[]): DefinitionLanguageMode {
  if (languages.includes("zh") && languages.includes("en")) return "all";
  return languages.includes("zh") ? "zh" : "en";
}

function getVisibleDefinitionLanguages(word: VocabWord | undefined, selected: VocabDefinitionLanguage[]) {
  if (!word) return selected;
  const hasDefinitions = (language: VocabDefinitionLanguage) =>
    language === "en" ? word.en_definition.length > 0 : word.zh_definition.length > 0;
  const selectedWithDefinitions = selected.filter(hasDefinitions);
  if (selectedWithDefinitions.length > 0) return selectedWithDefinitions;
  const fallback = (["en", "zh"] as const).filter(hasDefinitions);
  return fallback.length > 0 ? fallback : selected;
}

export function VocabClient() {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { clearSnackbar, showSnackbar } = useSnackbar();
  const online = useOnlineStatus();
  const [screen, setScreen] = useState<Screen>("select");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [uploadedLists, setUploadedLists] = useState<UploadedList[]>([]);
  const [selectedUploadedIds, setSelectedUploadedIds] = useState<string[]>([]);
  const [testMode, setTestMode] = useState<TestMode>("all");
  const [savedQuizSettings] = useState(getSavedQuizSettings);
  const [testCount, setTestCount] = useState(savedQuizSettings.defaultTestCount);
  const [showHint, setShowHint] = useState(savedQuizSettings.showHint);
  const [enableSlipDetection, setEnableSlipDetection] = useState(savedQuizSettings.enableSlipDetection);
  const [definitionLanguages, setDefinitionLanguages] = useState<VocabDefinitionLanguage[]>(savedQuizSettings.vocabDefinitionLanguages);
  const [batchName, setBatchName] = useState("");
  const [testNo, setTestNo] = useState("");
  const [testWords, setTestWords] = useState<TestWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [answerFeedback, setAnswerFeedback] = useState("");
  const [pendingSlip, setPendingSlip] = useState(false);
  const [answerOutcome, setAnswerOutcome] = useState<AnswerOutcome | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [correctWords, setCorrectWords] = useState<VocabWord[]>([]);
  const [incorrectWords, setIncorrectWords] = useState<TestWord[]>([]);
  const [wrongBook, setWrongBook] = useState<WrongBookSnapshot | null>(null);
  const [wrongBookSearch, setWrongBookSearch] = useState("");
  const [wrongBookSource, setWrongBookSource] = useState("all");
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>("all");
  const [masteryById, setMasteryById] = useState<Record<string, MasteryRecord>>({});
  const [wrongBookView, setWrongBookView] = useState<WrongBookView>("words");
  const [testSource, setTestSource] = useState<"selection" | "wrongbook">("selection");
  const [loading, setLoading] = useState(false);
  const [cloudAction, setCloudAction] = useState<CloudAction | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [vocabCacheStates, setVocabCacheStates] = useState<Record<string, VocabCacheState>>({});
  const [customListDialogOpen, setCustomListDialogOpen] = useState(false);
  const [customListDialogKey, setCustomListDialogKey] = useState(0);
  const customListRef = useRef<HTMLInputElement>(null);
  const importWrongBookRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLElement | null>(null);
  const answerSubmissionRef = useRef(false);
  const blankAnswerSpaceArmedRef = useRef(false);
  const clientId = useMemo(() => (typeof window === "undefined" ? "server" : getClientId()), []);
  const currentWord = testWords[currentIndex];
  const definitionLanguageMode = getDefinitionLanguageMode(definitionLanguages);
  const visibleDefinitionLanguages = getVisibleDefinitionLanguages(currentWord, definitionLanguages);

  const refreshWrongBook = useCallback(async () => {
    const [snapshot, mastery] = await Promise.all([readLocalWrongBook(clientId), readMasteryMap()]);
    setWrongBook(snapshot);
    setMasteryById(mastery);
  }, [clientId]);

  useEffect(() => {
    let active = true;
    async function loadWrongBook() {
      const [snapshot, mastery] = await Promise.all([readLocalWrongBook(clientId), readMasteryMap()]);
      if (!active) return;
      setWrongBook(snapshot);
      setMasteryById(mastery);
    }
    void loadWrongBook();
    return () => {
      active = false;
    };
  }, [clientId]);

  const selectedMetas = useMemo(() => list.filter((item) => selectedUnits.includes(item.name)) as VocabListMeta[], [selectedUnits]);
  const selectedCustomLists = useMemo(() => uploadedLists.filter((item) => selectedUploadedIds.includes(item.name)), [selectedUploadedIds, uploadedLists]);
  const visibleCustomLists = uploadedLists.slice(0, visibleCustomListCount);
  const hiddenCustomLists = uploadedLists.slice(visibleCustomListCount);
  const customOverflowCount = uploadedLists.length - visibleCustomListCount;
  const selectedHiddenCustomCount = hiddenCustomLists.filter((item) => selectedUploadedIds.includes(item.name)).length;
  const hiddenCustomSelectionState = selectedHiddenCustomCount === 0 ? "none" : selectedHiddenCustomCount === hiddenCustomLists.length ? "all" : "partial";
  const hiddenCustomSelectionIcon = hiddenCustomSelectionState === "all" ? "✓" : hiddenCustomSelectionState === "partial" ? "−" : "□";
  const hiddenCustomSelectionText = t(hiddenCustomSelectionState === "all" ? "vocab.hidden.all" : hiddenCustomSelectionState === "partial" ? "vocab.hidden.partial" : "vocab.hidden.none");
  const maxTestCount = selectedUnits.length * 80 + selectedCustomLists.reduce((sum, item) => sum + item.words.length, 0);
  const wrongRecords = wrongBook?.records ?? [];
  const wrongBookSources = Array.from(new Set(wrongRecords.map((record) => record.sourceName))).sort();
  const wrongBookBatches = getWrongBookBatches(wrongRecords);
  const filteredWrongRecords = wrongRecords.filter((record) => {
    const keywordMatch = record.word.toLowerCase().includes(wrongBookSearch.toLowerCase());
    const sourceMatch = wrongBookSource === "all" || record.sourceName === wrongBookSource;
    const mastery = masteryById[record.id];
    const masteryMatch =
      masteryFilter === "all" ||
      (masteryFilter === "due" && isMasteryDue(mastery)) ||
      (masteryFilter === "learning" && isMasteryLearning(mastery)) ||
      (masteryFilter === "mastered" && mastery?.level === "mastered");
    return keywordMatch && sourceMatch && masteryMatch;
  });
  const selectedCacheStates = selectedMetas.map((meta) => vocabCacheStates[meta.name] ?? "missing");
  const cachedUnitCount = selectedCacheStates.filter((state) => state === "cached").length;
  const missingUnitCount = selectedMetas.length - cachedUnitCount;

  function toggleBook(bookCode: string) {
    const units = list.filter((item) => getBookCode(item.name) === bookCode).map((item) => item.name);
    const allSelected = units.every((unit) => selectedUnits.includes(unit));
    setSelectedUnits((current) => (allSelected ? current.filter((item) => !units.includes(item)) : Array.from(new Set([...current, ...units]))));
  }

  function selectDefinitionLanguageMode(mode: DefinitionLanguageMode) {
    const next: VocabDefinitionLanguage[] = mode === "all" ? ["en", "zh"] : [mode];
    setDefinitionLanguages(next);
    persistDefinitionLanguages(next);
    clearSnackbar();
  }

  async function uploadCustomList(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const parsedLists = await Promise.all(
      files.map(async (file) => {
        const parsed = JSON.parse(await file.text()) as { vocabulary?: VocabWord[] } | VocabWord[];
        const words = Array.isArray(parsed) ? parsed : parsed.vocabulary ?? [];
        const id = `custom-${crypto.randomUUID()}`;
        const title = file.name.replace(/\.json$/i, "");
        return { name: id, title, words: normalizeCustomWords(words, id, title) };
      })
    );
    setUploadedLists((current) => [...current, ...parsedLists]);
    setSelectedUploadedIds((current) => [...current, ...parsedLists.map((item) => item.name)]);
    event.target.value = "";
  }

  async function refreshVocabCacheStates(metas = selectedMetas) {
    if (metas.length === 0) {
      setVocabCacheStates({});
      return;
    }
    setVocabCacheStates(await readVocabCacheStates(metas));
  }

  async function cacheSelectedUnits(manual = true) {
    if (selectedMetas.length === 0) {
      if (manual) showSnackbar(t("vocab.cache.selectRequired"), "error");
      return;
    }
    if (!online) {
      if (manual) showSnackbar(t("vocab.cache.offline"), "error");
      return;
    }

    setCacheBusy(true);
    try {
      const result = await cacheVocabLists(selectedMetas);
      await refreshVocabCacheStates();
      if (manual) {
        showSnackbar(
          result.failed > 0 ? t("vocab.cache.partial", { cached: result.cached, failed: result.failed }) : t("vocab.cache.success", { count: result.cached }),
          result.failed > 0 ? "error" : "info"
        );
      } else if (result.failed > 0) {
        showSnackbar(t("vocab.cache.autoPartial", { failed: result.failed }), "error");
      }
    } finally {
      setCacheBusy(false);
    }
  }

  function openCustomListDialog() {
    setCustomListDialogKey((current) => current + 1);
    setCustomListDialogOpen(false);
    window.setTimeout(() => setCustomListDialogOpen(true), 0);
  }

  function closeCustomListDialog() {
    setCustomListDialogOpen(false);
  }

  useEffect(() => {
    let active = true;
    async function loadCacheStates() {
      const states = await readVocabCacheStates(selectedMetas);
      if (active) setVocabCacheStates(states);
    }
    if (screen === "select") void loadCacheStates();
    return () => {
      active = false;
    };
  }, [screen, selectedMetas]);

  async function startTest(source: "selection" | "wrongbook" = "selection") {
    setLoading(true);
    clearSnackbar();
    try {
      if (source === "selection" && selectedMetas.length > 0 && online) {
        await cacheSelectedUnits(false);
      }
      const testWordsSource =
        source === "wrongbook"
          ? filteredWrongRecords.map((record) => ({
              word: record.word,
              en_definition: record.definitions ?? [],
              zh_definition: record.zhDefinitions ?? [],
              sourceName: record.sourceName,
              sourceTitle: record.sourceTitle ?? record.sourceName,
              wrongRecordId: record.id
            }))
          : [...(await Promise.all(selectedMetas.map(loadVocabList))).flat(), ...selectedCustomLists.flatMap((item) => item.words)];

      if (testWordsSource.length === 0) {
        showSnackbar(t("vocab.selectionRequired"), "error");
        return;
      }

      setTestWords(pickWords(testWordsSource, testMode, testCount));
      setCorrectWords([]);
      setIncorrectWords([]);
      setCurrentIndex(0);
      setAnswer("");
      setAnswerFeedback("");
      setPendingSlip(false);
      setAnswerOutcome(null);
      setSubmittingAnswer(false);
      setTestNo(`test-${nowStamp()}`);
      setTestSource(source);
      setScreen("testing");
    } catch {
      showSnackbar(!online ? t("vocab.offlineMissing") : t("vocab.loadError"), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (screen !== "testing" || answerOutcome || pendingSlip) return;
    const frame = window.requestAnimationFrame(() => answerInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [answerOutcome, currentIndex, pendingSlip, screen]);

  useEffect(() => {
    blankAnswerSpaceArmedRef.current = false;
  }, [currentIndex, screen]);

  async function finalizeAnswer(outcome: AnswerOutcome, resultMessage: string) {
    if (!currentWord || answerSubmissionRef.current) return;
    answerSubmissionRef.current = true;
    setSubmittingAnswer(true);
    let saveErrorMessage = "";
    const resultWord = toVocabWord(currentWord);
    const masteryRecordId = currentWord.wrongRecordId ?? wrongRecordId(currentWord);
    try {
      if (outcome === "correct") {
        setCorrectWords((current) => [...current, resultWord]);
        if (testSource === "wrongbook" || wrongBook?.records.some((record) => record.id === masteryRecordId)) {
          try {
            await recordMasteryResult(masteryRecordId, true);
            await refreshWrongBook();
          } catch {
            saveErrorMessage = t("vocab.masteryUpdateError", { message: resultMessage });
          }
        }
      } else {
        setIncorrectWords((current) => [...current, currentWord]);
        try {
          await addWrongWord(resultWord, testNo, batchName || undefined, currentWord.wrongRecordId);
          try {
            await recordMasteryResult(masteryRecordId, false);
          } catch {
            saveErrorMessage = t("vocab.masterySaveError", { message: resultMessage });
          }
          await refreshWrongBook();
        } catch {
          saveErrorMessage = t("vocab.wrongbookSaveError", { message: resultMessage });
        }
      }
      setAnswerFeedback(resultMessage);
      if (saveErrorMessage) showSnackbar(saveErrorMessage, "error");
      setAnswerOutcome(outcome);
      setPendingSlip(false);
    } finally {
      answerSubmissionRef.current = false;
      setSubmittingAnswer(false);
    }
  }

  async function submitAnswer(forced?: AnswerOutcome) {
    if (!currentWord || answerOutcome || answerSubmissionRef.current) return;
    const result =
      forced === "wrong"
        ? { correct: false, slip: false, message: t("vocab.answer.forcedWrong", { word: currentWord.word }) }
        : forced === "correct"
          ? { correct: true, slip: false, message: t("vocab.answer.forcedCorrect", { word: currentWord.word }) }
          : evaluateAnswer(answer, currentWord.word, { enableSlipDetection, allowMissingFirstLetter: showHint });
    const localizedResultMessage = forced === "wrong"
      ? t("vocab.answer.forcedWrong", { word: currentWord.word })
      : forced === "correct"
        ? t("vocab.answer.forcedCorrect", { word: currentWord.word })
        : result.slip
          ? t("vocab.answer.slip", { word: currentWord.word })
          : result.correct
            ? t("vocab.answer.correct")
            : t("vocab.answer.wrong", { word: currentWord.word });
    if (result.slip) {
      setAnswerFeedback(localizedResultMessage);
      setPendingSlip(true);
      return;
    }
    await finalizeAnswer(result.correct ? "correct" : "wrong", localizedResultMessage);
  }

  function goNextQuestion() {
    if (!answerOutcome) return;
    if (currentIndex + 1 >= testWords.length) {
      setAnswer("");
      setAnswerFeedback("");
      setPendingSlip(false);
      setAnswerOutcome(null);
      setScreen("result");
      return;
    }
    setCurrentIndex((index) => index + 1);
    setAnswer("");
    setAnswerFeedback("");
    setPendingSlip(false);
    setAnswerOutcome(null);
  }

  function finishTestEarly() {
    if (correctWords.length + incorrectWords.length === 0) {
      resetTest();
      return;
    }
    setScreen("result");
    setAnswer("");
    setAnswerFeedback("");
    setPendingSlip(false);
    setAnswerOutcome(null);
  }

  function retryIncorrectWords() {
    if (incorrectWords.length === 0) return;
    setTestWords(pickWords(incorrectWords, "all", incorrectWords.length));
    setCorrectWords([]);
    setIncorrectWords([]);
    setCurrentIndex(0);
    setAnswer("");
    setAnswerFeedback("");
    setPendingSlip(false);
    setAnswerOutcome(null);
    setTestNo(`test-${nowStamp()}`);
    setScreen("testing");
  }

  async function removeWrongRecord(id: string) {
    await Promise.all([deleteWrongRecord(id), deleteMasteryRecord(id)]);
    await refreshWrongBook();
  }

  async function removeWrongBatch(testNo: string) {
    await deleteWrongBatch(testNo);
    const snapshot = await readLocalWrongBook(clientId);
    const activeIds = new Set(snapshot.records.map((record) => record.id));
    const mastery = await readMasteryMap();
    await Promise.all(Object.keys(mastery).filter((id) => !activeIds.has(id)).map(deleteMasteryRecord));
    await refreshWrongBook();
  }

  function resetTest() {
    setScreen("select");
    setTestWords([]);
    setCorrectWords([]);
    setIncorrectWords([]);
    setAnswerFeedback("");
    setPendingSlip(false);
    setAnswerOutcome(null);
    setSubmittingAnswer(false);
    answerSubmissionRef.current = false;
    setAnswer("");
    setCurrentIndex(0);
  }

  async function importWrongBook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await importWrongBookSnapshot(JSON.parse(await file.text()) as Partial<WrongBookSnapshot>);
    await refreshWrongBook();
    showSnackbar(t("vocab.importSuccess"));
    event.target.value = "";
  }

  async function pullCloud() {
    setCloudAction("pull");
    try {
      await pullAndMergeWrongBook();
      await refreshWrongBook();
      showSnackbar(t("vocab.cloud.pullSuccess"));
    } catch {
      showSnackbar(t("vocab.cloud.pullError"), "error");
    } finally {
      setCloudAction(null);
    }
  }

  async function overwriteCloud() {
    setCloudAction("overwrite");
    try {
      await overwriteCloudWrongBook();
      showSnackbar(t("vocab.cloud.overwriteSuccess"));
    } catch {
      showSnackbar(t("vocab.cloud.overwriteError"), "error");
    } finally {
      setCloudAction(null);
    }
  }

  async function mergeCloud() {
    setCloudAction("merge");
    try {
      await mergeUploadWrongBook();
      await refreshWrongBook();
      showSnackbar(t("vocab.cloud.mergeSuccess"));
    } catch {
      showSnackbar(t("vocab.cloud.mergeError"), "error");
    } finally {
      setCloudAction(null);
    }
  }

  async function preparePrintableVocabulary() {
    setLoading(true);
    clearSnackbar();
    try {
      if (selectedMetas.length > 0 && online) {
        await cacheSelectedUnits(false);
      }
      const selectedSources = [
        ...(await Promise.all(
          selectedMetas.map(async (meta) => ({
            title: meta.title,
            words: await loadVocabList(meta)
          }))
        )),
        ...selectedCustomLists.map((item) => ({ title: item.title, words: item.words }))
      ].filter((source) => source.words.length > 0);

      if (selectedSources.length === 0) {
        showSnackbar(t("vocab.printSelectionRequired"), "error");
        return;
      }
      sessionStorage.setItem(
        "henguren-v3-printable-vocab",
        JSON.stringify({
          createdAt: new Date().toISOString(),
          sources: selectedSources
        })
      );
      router.push("/vocab/print" as Route);
    } catch {
      showSnackbar(!online ? t("vocab.printOfflineMissing") : t("vocab.printError"), "error");
    } finally {
      setLoading(false);
    }
  }

  if (screen === "testing") {
    return (
      <div className="stack">
        <section className="md-card spread" aria-label={t("vocab.progressAria")}>
          <div>
            <h2 className="section-title">{t("vocab.testing")}</h2>
            <p className="helper-text">
              {t("vocab.progress", { current: currentIndex + 1, total: testWords.length, source: currentWord?.sourceTitle ?? currentWord?.sourceName ?? "—" })}
            </p>
          </div>
          <md-outlined-button disabled={submittingAnswer} onClick={finishTestEarly}>
            {t("vocab.finish")}
          </md-outlined-button>
        </section>
        <section className="md-card stack" aria-label={t("vocab.questionAria")}>
          <div className="stack">
            {visibleDefinitionLanguages.includes("en") ? (
              <div>
                <span className="badge badge--neutral">{t("vocab.definition.en")}</span>
                <p className="section-title">{currentWord?.en_definition.join("; ") || t("vocab.definition.enMissing")}</p>
              </div>
            ) : null}
            {visibleDefinitionLanguages.includes("zh") ? (
              <div>
                <span className="badge badge--neutral">{t("vocab.definition.zh")}</span>
                <p className="section-title">{currentWord?.zh_definition.join("；") || t("vocab.definition.zhMissing")}</p>
              </div>
            ) : null}
          </div>
          <div className="cluster">
            {showHint && currentWord ? <span className="badge">{currentWord.word[0]}</span> : null}
            <md-outlined-text-field
              ref={answerInputRef}
              label={t("vocab.answerInput")}
              value={answer}
              readOnly={Boolean(answerOutcome) || pendingSlip || submittingAnswer}
              aria-readonly={Boolean(answerOutcome) || pendingSlip || submittingAnswer}
              onInput={(event) => {
                blankAnswerSpaceArmedRef.current = false;
                setAnswerFeedback("");
                setAnswer(valueFrom(event));
              }}
              onKeyDown={(event) => {
                if (pendingSlip || submittingAnswer) return;
                if (answerOutcome) {
                  if (event.key === "Enter") goNextQuestion();
                  return;
                }
                if (!answer.trim()) {
                  if (event.key === " ") {
                    event.preventDefault();
                    if (event.repeat) return;
                    if (blankAnswerSpaceArmedRef.current) {
                      blankAnswerSpaceArmedRef.current = false;
                      void submitAnswer();
                    } else {
                      blankAnswerSpaceArmedRef.current = true;
                      setAnswerFeedback(t("vocab.answer.emptyConfirm"));
                    }
                    return;
                  }
                  blankAnswerSpaceArmedRef.current = false;
                  setAnswerFeedback("");
                  if (event.key === "Enter") event.preventDefault();
                  return;
                }
                blankAnswerSpaceArmedRef.current = false;
                if (event.key === "Enter") void submitAnswer();
              }}
            />
            {answerOutcome ? (
              <md-filled-button onClick={goNextQuestion}>{t(currentIndex + 1 >= testWords.length ? "vocab.viewResults" : "vocab.nextQuestion")}</md-filled-button>
            ) : (
              <md-filled-button disabled={!answer.trim() || submittingAnswer || pendingSlip} onClick={() => void submitAnswer()}>{t("vocab.submit")}</md-filled-button>
            )}
          </div>
          {answerFeedback ? <p className="helper-text">{answerFeedback}</p> : null}
          {pendingSlip ? (
            <div className="cluster">
              <md-outlined-button disabled={submittingAnswer} onClick={() => void submitAnswer("correct")}>{t("vocab.markCorrect")}</md-outlined-button>
              <md-outlined-button disabled={submittingAnswer} onClick={() => void submitAnswer("wrong")}>{t("vocab.markWrong")}</md-outlined-button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (screen === "result") {
    const total = correctWords.length + incorrectWords.length;
    const rate = total === 0 ? 0 : Math.round((correctWords.length / total) * 100);
    return (
      <div className="stack">
        <section className="md-grid" aria-label={t("vocab.resultsAria")}>
          {[
            [t("vocab.rate"), `${rate}%`],
            [t("vocab.correct"), correctWords.length],
            [t("vocab.wrong"), incorrectWords.length]
          ].map(([title, value]) => (
            <article className="md-card" key={title}>
              <p className="helper-text">{title}</p>
              <div className="metric-value">{value}</div>
            </article>
          ))}
        </section>
        <section className="md-card stack" aria-label={t("vocab.incorrectAria")}>
          <div className="spread">
            <h2 className="section-title">{t("vocab.incorrectTitle")}</h2>
            <div className="cluster">
              <md-outlined-button onClick={() => downloadJson(`incorrect_${nowStamp()}.json`, { vocabulary: incorrectWords.map(toVocabWord) })}>{t("vocab.downloadErrors")}</md-outlined-button>
              <md-outlined-button disabled={incorrectWords.length === 0} onClick={retryIncorrectWords}>{t("vocab.retryErrors")}</md-outlined-button>
              <md-filled-button onClick={resetTest}>{t("vocab.backSelection")}</md-filled-button>
            </div>
          </div>
          {incorrectWords.length === 0 ? <p className="helper-text">{t("vocab.noErrors")}</p> : null}
          {incorrectWords.map((word) => {
            const visibleLanguages = getVisibleDefinitionLanguages(word, definitionLanguages);
            return (
              <article className="md-card md-card--flat spread" key={`${word.sourceName}-${word.word}`}>
                <div>
                  <h3 className="card-title">{word.word}</h3>
                  {visibleLanguages.includes("en") ? <p className="helper-text">{t("vocab.definition.enPrefix", { definition: word.en_definition.join("; ") || t("vocab.definition.missing") })}</p> : null}
                  {visibleLanguages.includes("zh") ? <p className="helper-text">{t("vocab.definition.zhPrefix", { definition: word.zh_definition.join("；") || t("vocab.definition.missing") })}</p> : null}
                </div>
                <span className="badge badge--neutral">{word.sourceTitle ?? word.sourceName}</span>
              </article>
            );
          })}
        </section>
      </div>
    );
  }

  if (screen === "wrongbook") {
    return (
      <div className="stack">
        <section className="md-card spread" aria-label={t("vocab.wrongbookInfoAria")}>
          <div>
            <h2 className="section-title">{t("vocab.wrongbook")}</h2>
            <p className="helper-text">{t("vocab.wrongbookDescription")}</p>
          </div>
          <div className="cluster">
            <md-outlined-button onClick={() => setScreen("select")}>{t("vocab.backTest")}</md-outlined-button>
            <md-filled-button disabled={filteredWrongRecords.length === 0} onClick={() => void startTest("wrongbook")}>
              {t("vocab.reviewFiltered")}
            </md-filled-button>
          </div>
        </section>
        <section className="md-card stack" aria-label={t("vocab.recordsAria")}>
          <div className="spread">
            <h2 className="section-title">{t("vocab.records")}</h2>
            <div className="cluster">
              <md-outlined-button onClick={() => wrongBook && downloadJson(`wrongbook_${nowStamp()}.json`, wrongBook)}>{t("vocab.export")}</md-outlined-button>
              <md-outlined-button onClick={() => importWrongBookRef.current?.click()}>{t("vocab.import")}</md-outlined-button>
              <input ref={importWrongBookRef} className="hidden-input" type="file" accept=".json" onChange={(event) => void importWrongBook(event)} />
            </div>
          </div>
          <div className="wrongbook-filters">
            <md-outlined-text-field label={t("vocab.search")} value={wrongBookSearch} onInput={(event) => setWrongBookSearch(valueFrom(event))} />
            <div className="wrongbook-filter-row">
              <md-filled-select className="wrongbook-source-select" label={t("vocab.source")} value={wrongBookSource} onInput={(event) => setWrongBookSource(valueFrom(event))}>
                <md-select-option value="all">
                  <div slot="headline">{t("vocab.allSources")}</div>
                </md-select-option>
                {wrongBookSources.map((source) => (
                  <md-select-option key={source} value={source}>
                    <div slot="headline">{source}</div>
                  </md-select-option>
                ))}
              </md-filled-select>
              <div className="filter-section" aria-label={t("vocab.mastery")}>
                <span className="filter-label">{t("vocab.mastery")}</span>
                <div className="button-group" role="radiogroup" aria-label={t("vocab.mastery")}>
                  {masteryFilterOptions.map((option) => (
                    <button
                      className="button-group__item"
                      type="button"
                      role="radio"
                      aria-checked={masteryFilter === option.value}
                      data-selected={masteryFilter === option.value}
                      key={option.value}
                      onClick={() => setMasteryFilter(option.value)}
                    >
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-section" aria-label={t("vocab.view")}>
                <span className="filter-label">{t("vocab.view")}</span>
                <div className="chip-scroll">
                  <md-filter-chip selected={wrongBookView === "words"} onClick={() => setWrongBookView("words")}>
                    {t("vocab.view.words")}
                  </md-filter-chip>
                  <md-filter-chip selected={wrongBookView === "batches"} onClick={() => setWrongBookView("batches")}>
                    {t("vocab.view.batches")}
                  </md-filter-chip>
                </div>
              </div>
            </div>
          </div>
          <div className="stack">
            {wrongBookView === "words"
              ? filteredWrongRecords.map((record) => (
                  <article className="md-card md-card--flat spread" key={record.id}>
                    <div>
                      <h3 className="card-title">{record.word}</h3>
                      <div className="record-chip-row" aria-label={t("vocab.recordAria", { word: record.word })}>
                        <span className="info-chip">{t("vocab.recordSource", { source: record.sourceTitle ?? record.sourceName })}</span>
                        <span className="info-chip info-chip--strong">{t("vocab.wrongCount", { count: record.wrongCount })}</span>
                        <span className="info-chip info-chip--strong">{t(masteryMessageKey(masteryById[record.id]))}</span>
                        <span className="info-chip">{isMasteryDue(masteryById[record.id]) ? t("vocab.review.now") : t("vocab.review.next", { date: new Date(masteryById[record.id]!.nextReviewAt).toLocaleDateString(locale) })}</span>
                      </div>
                    </div>
                    <md-outlined-button onClick={() => void removeWrongRecord(record.id)} aria-label={t("vocab.deleteWordAria", { word: record.word })}>
                      {t("vocab.delete")}
                    </md-outlined-button>
                  </article>
                ))
              : wrongBookBatches.map((batch) => (
                  <article className="md-card md-card--flat spread" key={batch.testNo}>
                    <div>
                      <h3 className="card-title">{batch.batchName || batch.testNo}</h3>
                      <p className="helper-text">
                        {t("vocab.batchCount", { date: batch.createdAt, count: batch.syncedCount })}
                      </p>
                    </div>
                    <md-outlined-button onClick={() => void removeWrongBatch(batch.testNo)} aria-label={t("vocab.deleteBatchAria", { batch: batch.testNo })}>
                      {t("vocab.delete")}
                    </md-outlined-button>
                  </article>
                ))}
          </div>
        </section>
        <section className="md-card spread" aria-label={t("vocab.cloudAria")}>
          <div>
            <h2 className="section-title">{t("vocab.cloudTitle")}</h2>
            <p className="helper-text">{t("vocab.cloudDescription")}</p>
            <span className="sync-status-chip" data-status={!online ? "offline" : cloudAction ? "syncing" : "ready"}>
              <MaterialIcon name={!online ? "cloud_off" : cloudAction ? cloudActionIcon[cloudAction] : "cloud_sync"} />
              <span>{t(!online ? "vocab.cloudOffline" : cloudAction ? cloudActionLabel[cloudAction] : "vocab.cloudReady")}</span>
            </span>
          </div>
          <div className="cluster">
            <md-outlined-button disabled={!online || Boolean(cloudAction)} onClick={() => void pullCloud()}>{t("vocab.cloudPull")}</md-outlined-button>
            <md-outlined-button disabled={!online || Boolean(cloudAction)} onClick={() => void overwriteCloud()}>{t("vocab.cloudOverwrite")}</md-outlined-button>
            <md-filled-button disabled={!online || Boolean(cloudAction)} onClick={() => void mergeCloud()}>{t("vocab.cloudMerge")}</md-filled-button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="md-card spread" aria-label={t("vocab.selectionAria")}>
        <div>
          <h2 className="section-title">{t("vocab.selectionTitle")}</h2>
          <p className="helper-text">
            {t("vocab.selectionDescription")}{" "}
            {selectedMetas.length === 0 ? t("vocab.selectionCacheHint") : t("vocab.selectionSummary", { selected: selectedMetas.length, cached: cachedUnitCount, missing: missingUnitCount })}
          </p>
        </div>
        <div className="cluster">
          <span className={online ? "badge badge--neutral" : "badge badge--error"}>{t(online ? "vocab.online" : "vocab.offline")}</span>
          <md-outlined-button disabled={!online || cacheBusy || selectedMetas.length === 0} onClick={() => void cacheSelectedUnits()}>
            {t(cacheBusy ? "vocab.caching" : "vocab.cacheSelected")}
          </md-outlined-button>
          <md-outlined-button disabled={selectedMetas.length === 0 && selectedCustomLists.length === 0} onClick={() => void preparePrintableVocabulary()}>
            {t("vocab.createPrint")}
          </md-outlined-button>
          <md-outlined-button onClick={() => setScreen("wrongbook")}>{t("vocab.openWrongbook")}</md-outlined-button>
          <md-filled-button disabled={loading} onClick={() => void startTest()}>
            {t("vocab.start")}
          </md-filled-button>
        </div>
      </section>

      <div className="md-grid">
        {books.map((book) => {
          const units = list.filter((item) => getBookCode(item.name) === book.code);
          const allSelected = units.every((unit) => selectedUnits.includes(unit.name));
          return (
            <section className="md-card stack" key={book.code} aria-labelledby={`${book.code}-title`}>
              <div className="spread">
                <h3 className="card-title" id={`${book.code}-title`}>
                  {book.title}
                </h3>
                <md-outlined-button onClick={() => toggleBook(book.code)}>{t(allSelected ? "vocab.allSelected" : "vocab.selectAll")}</md-outlined-button>
              </div>
              <div className="unit-grid">
                {Array.from({ length: Math.ceil(units.length / 2) }, (_, rowIndex) => (
                  <div className="unit-row" key={`${book.code}-row-${rowIndex}`}>
                    {units.slice(rowIndex * 2, rowIndex * 2 + 2).map((unit) => (
                      <md-filter-chip
                        key={unit.name}
                        selected={selectedUnits.includes(unit.name)}
                        onClick={() => setSelectedUnits((current) => toggleValue(current, unit.name))}
                      >
                        Unit {unit.name.slice(-1)}
                      </md-filter-chip>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <section className="md-card stack" aria-label={t("vocab.customAria")}>
          <div className="spread">
            <h3 className="card-title">{t("vocab.customTitle")}</h3>
            <md-outlined-button onClick={() => customListRef.current?.click()}>{t("vocab.upload")}</md-outlined-button>
            <input ref={customListRef} className="hidden-input" type="file" accept=".json" multiple onChange={(event) => void uploadCustomList(event)} />
          </div>
          <div className="unit-grid">
            {Array.from({ length: Math.ceil((visibleCustomLists.length + (customOverflowCount > 0 ? 1 : 0)) / 2) }, (_, rowIndex) => {
              const cells = customOverflowCount > 0 ? [...visibleCustomLists, { name: "__more__", title: t("vocab.more", { count: customOverflowCount }) }] : visibleCustomLists;
              return (
                <div className="unit-row" key={`custom-row-${rowIndex}`}>
                  {cells.slice(rowIndex * 2, rowIndex * 2 + 2).map((item) =>
                    item.name === "__more__" ? (
                      <button
                        className="more-chip"
                        data-state={hiddenCustomSelectionState}
                        key={item.name}
                        type="button"
                        aria-label={t("vocab.moreAria", { selection: hiddenCustomSelectionText })}
                        onClick={openCustomListDialog}
                      >
                        <span className="more-chip__icon" aria-hidden="true">
                          {hiddenCustomSelectionIcon}
                        </span>
                        <span>{item.title}</span>
                      </button>
                    ) : (
                      <md-filter-chip
                        key={item.name}
                        selected={selectedUploadedIds.includes(item.name)}
                        onClick={() => setSelectedUploadedIds((current) => toggleValue(current, item.name))}
                      >
                        {item.title}
                      </md-filter-chip>
                    )
                  )}
                </div>
              );
            })}
          </div>
          {uploadedLists.length === 0 ? <p className="helper-text">{t("vocab.noUploads")}</p> : null}
        </section>
      </div>

      <section className="md-card stack" aria-label={t("vocab.settingsAria")}>
        <h2 className="section-title">{t("vocab.settingsTitle")}</h2>
        <div className="quiz-settings-grid">
          <md-filled-select key={`${locale}-vocab-mode`} label={t("vocab.mode")} value={testMode} onInput={(event) => setTestMode(valueFrom(event) as TestMode)}>
            <md-select-option value="all">
              <div slot="headline">{t("vocab.filter.all")}</div>
            </md-select-option>
            <md-select-option value="custom">
              <div slot="headline">{t("vocab.mode.custom")}</div>
            </md-select-option>
          </md-filled-select>
          {testMode === "all" ? (
            <div className="material-static-field" aria-disabled="true">
              <span>{t("vocab.modeAllDisabled")}</span>
              <strong>{testCount}</strong>
            </div>
          ) : (
            <md-outlined-text-field
              type="number"
              label={t("vocab.testCount")}
              value={testCount}
              min={1}
              max={Math.max(maxTestCount, testCount, 1)}
              onInput={(event) => setTestCount(Number(valueFrom(event)))}
            />
          )}
          <label className="switch-field">
            <md-switch selected={showHint} checked={showHint} onInput={(event) => setShowHint(checkedFrom(event))} />
            <span>{t("vocab.hint")}</span>
          </label>
          <label className="switch-field">
            <md-switch selected={enableSlipDetection} checked={enableSlipDetection} onInput={(event) => setEnableSlipDetection(checkedFrom(event))} />
            <span>{t("vocab.slip")}</span>
          </label>
          <div className="stack" aria-label={t("vocab.definitionLanguageAria")}>
            <span className="helper-text">{t("vocab.definitionLanguage")}</span>
            <div className="button-group" role="radiogroup" aria-label={t("vocab.definitionLanguageAria")}>
              {definitionLanguageOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className="button-group__item"
                  role="radio"
                  aria-checked={definitionLanguageMode === option.value}
                  data-selected={definitionLanguageMode === option.value}
                  onClick={() => selectDefinitionLanguageMode(option.value)}
                >
                  {t(option.label)}
                </button>
              ))}
            </div>
          </div>
          <md-outlined-text-field label={t("vocab.batchName")} value={batchName} onInput={(event) => setBatchName(valueFrom(event))} />
        </div>
      </section>

      <md-dialog open={loading}>
        <div slot="headline">{t("vocab.preparing")}</div>
        <div slot="content">{t("vocab.preparingDescription")}</div>
      </md-dialog>
      <md-dialog key={customListDialogKey} open={customListDialogOpen} onClosed={closeCustomListDialog} onClose={closeCustomListDialog} onCancel={closeCustomListDialog}>
        <div slot="headline">{t("vocab.customTitle")}</div>
        <div slot="content" className="custom-list-dialog">
          {uploadedLists.map((item) => (
            <md-filter-chip
              key={item.name}
              selected={selectedUploadedIds.includes(item.name)}
              onClick={() => setSelectedUploadedIds((current) => toggleValue(current, item.name))}
            >
              {item.title}
            </md-filter-chip>
          ))}
        </div>
        <div slot="actions">
          <md-text-button onClick={closeCustomListDialog}>{t("vocab.customDone")}</md-text-button>
        </div>
      </md-dialog>
    </div>
  );
}
