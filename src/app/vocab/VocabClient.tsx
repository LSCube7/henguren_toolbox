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
import { MaterialIcon } from "../components/MaterialIcon";
import { cacheVocabLists, readVocabCacheStates, useOnlineStatus, type VocabCacheState } from "@/lib/offline-cache";
import { defaultSettings, type ToolboxSettings, type VocabDefinitionLanguage, type WrongBookSnapshot, type VocabWord } from "@/lib/types";
import { getBookCode, getBookTitle, loadVocabList, type VocabListMeta } from "@/lib/vocab-data";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { StatusAlert } from "../components/StatusAlert";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

type UploadedList = VocabListMeta & { words: VocabWord[] };
type TestMode = "all" | "custom";
type Screen = "select" | "testing" | "result" | "wrongbook";
type WrongBookView = "words" | "batches";
type WrongBookLevel = "all" | "1" | "2" | "3plus";
type CloudAction = "pull" | "overwrite" | "merge";

const books = Array.from(new Set(list.map((item) => getBookCode(item.name)))).map((code) => ({ code, title: getBookTitle(code) }));
const visibleCustomListCount = 3;
const wrongBookLevelOptions: Array<{ value: WrongBookLevel; label: string }> = [
  { value: "all", label: "全部" },
  { value: "1", label: "错 1 次" },
  { value: "2", label: "错 2 次" },
  { value: "3plus", label: "错 3+ 次" }
];
const definitionLanguageOptions: Array<{ value: VocabDefinitionLanguage; label: string }> = [
  { value: "zh", label: "中文释义" },
  { value: "en", label: "英语释义" }
];

const cloudActionIcon: Record<CloudAction, string> = {
  pull: "cloud_download",
  overwrite: "cloud_upload",
  merge: "cloud_sync"
};

const cloudActionLabel: Record<CloudAction, string> = {
  pull: "正在拉取云端错题本",
  overwrite: "正在上传覆盖云端",
  merge: "正在合并上传"
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

export function VocabClient() {
  const router = useRouter();
  const online = useOnlineStatus();
  const [screen, setScreen] = useState<Screen>("select");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [uploadedLists, setUploadedLists] = useState<UploadedList[]>([]);
  const [selectedUploadedIds, setSelectedUploadedIds] = useState<string[]>([]);
  const [testMode, setTestMode] = useState<TestMode>("all");
  const [testCount, setTestCount] = useState(() => getSavedQuizSettings().defaultTestCount);
  const [showHint, setShowHint] = useState(() => getSavedQuizSettings().showHint);
  const [enableSlipDetection, setEnableSlipDetection] = useState(() => getSavedQuizSettings().enableSlipDetection);
  const [definitionLanguages, setDefinitionLanguages] = useState<VocabDefinitionLanguage[]>(() => getSavedQuizSettings().vocabDefinitionLanguages);
  const [batchName, setBatchName] = useState("");
  const [testNo, setTestNo] = useState("");
  const [testWords, setTestWords] = useState<VocabWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pendingSlip, setPendingSlip] = useState(false);
  const [correctWords, setCorrectWords] = useState<VocabWord[]>([]);
  const [incorrectWords, setIncorrectWords] = useState<VocabWord[]>([]);
  const [wrongBook, setWrongBook] = useState<WrongBookSnapshot | null>(null);
  const [wrongBookSearch, setWrongBookSearch] = useState("");
  const [wrongBookSource, setWrongBookSource] = useState("all");
  const [wrongBookLevel, setWrongBookLevel] = useState<WrongBookLevel>("all");
  const [wrongBookView, setWrongBookView] = useState<WrongBookView>("words");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [cloudAction, setCloudAction] = useState<CloudAction | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [vocabCacheStates, setVocabCacheStates] = useState<Record<string, VocabCacheState>>({});
  const [customListDialogOpen, setCustomListDialogOpen] = useState(false);
  const [customListDialogKey, setCustomListDialogKey] = useState(0);
  const customListRef = useRef<HTMLInputElement>(null);
  const importWrongBookRef = useRef<HTMLInputElement>(null);
  const clientId = useMemo(() => (typeof window === "undefined" ? "server" : getClientId()), []);
  const currentWord = testWords[currentIndex];

  const refreshWrongBook = useCallback(async () => {
    setWrongBook(await readLocalWrongBook(clientId));
  }, [clientId]);

  useEffect(() => {
    let active = true;
    async function loadWrongBook() {
      const snapshot = await readLocalWrongBook(clientId);
      if (active) setWrongBook(snapshot);
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
  const hiddenCustomSelectionText =
    hiddenCustomSelectionState === "all" ? "隐藏词表已全选" : hiddenCustomSelectionState === "partial" ? "隐藏词表已部分选择" : "隐藏词表未选择";
  const maxTestCount = selectedUnits.length * 80 + selectedCustomLists.reduce((sum, item) => sum + item.words.length, 0);
  const wrongRecords = wrongBook?.records ?? [];
  const wrongBookSources = Array.from(new Set(wrongRecords.map((record) => record.sourceName))).sort();
  const wrongBookBatches = getWrongBookBatches(wrongRecords);
  const filteredWrongRecords = wrongRecords.filter((record) => {
    const keywordMatch = record.word.toLowerCase().includes(wrongBookSearch.toLowerCase());
    const sourceMatch = wrongBookSource === "all" || record.sourceName === wrongBookSource;
    const levelMatch =
      wrongBookLevel === "all" ||
      (wrongBookLevel === "1" && record.wrongCount === 1) ||
      (wrongBookLevel === "2" && record.wrongCount === 2) ||
      (wrongBookLevel === "3plus" && record.wrongCount >= 3);
    return keywordMatch && sourceMatch && levelMatch;
  });
  const selectedCacheStates = selectedMetas.map((meta) => vocabCacheStates[meta.name] ?? "missing");
  const cachedUnitCount = selectedCacheStates.filter((state) => state === "cached").length;
  const missingUnitCount = selectedMetas.length - cachedUnitCount;

  function toggleBook(bookCode: string) {
    const units = list.filter((item) => getBookCode(item.name) === bookCode).map((item) => item.name);
    const allSelected = units.every((unit) => selectedUnits.includes(unit));
    setSelectedUnits((current) => (allSelected ? current.filter((item) => !units.includes(item)) : Array.from(new Set([...current, ...units]))));
  }

  function toggleDefinitionLanguage(language: VocabDefinitionLanguage) {
    setDefinitionLanguages((current) => {
      const next = current.includes(language) ? current.filter((item) => item !== language) : [...current, language];
      if (next.length === 0) {
        setMessage("请至少保留一种题目释义语言。");
        return current;
      }
      persistDefinitionLanguages(next);
      setMessage("");
      return next;
    });
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
      if (manual) setMessage("请先选择至少一个 Unit。");
      return;
    }
    if (!online) {
      if (manual) setMessage("当前离线，无法缓存新的 Unit；已缓存的 Unit 仍可使用。");
      return;
    }

    setCacheBusy(true);
    try {
      const result = await cacheVocabLists(selectedMetas);
      await refreshVocabCacheStates();
      if (manual) {
        setMessage(result.failed > 0 ? `已缓存 ${result.cached} 个 Unit，${result.failed} 个缓存失败。` : `已缓存 ${result.cached} 个 Unit。`);
      } else if (result.failed > 0) {
        setMessage(`部分 Unit 自动缓存失败（${result.failed} 个），测试会继续尝试加载。`);
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
    setMessage("");
    try {
      if (source === "selection" && selectedMetas.length > 0 && online) {
        await cacheSelectedUnits(false);
      }
      const testSource =
        source === "wrongbook"
          ? wrongRecords.map((record) => ({
              word: record.word,
              en_definition: record.definitions ?? [],
              zh_definition: record.zhDefinitions ?? [],
              sourceName: record.sourceName,
              sourceTitle: record.sourceTitle ?? record.sourceName
            }))
          : [...(await Promise.all(selectedMetas.map(loadVocabList))).flat(), ...selectedCustomLists.flatMap((item) => item.words)];

      if (testSource.length === 0) {
        setMessage("请先选择至少一个单元、上传词表，或在错题本中保留记录。");
        return;
      }

      setTestWords(pickWords(testSource, testMode, testCount));
      setCorrectWords([]);
      setIncorrectWords([]);
      setCurrentIndex(0);
      setAnswer("");
      setFeedback("");
      setPendingSlip(false);
      setTestNo(`test-${nowStamp()}`);
      setScreen("testing");
    } catch (error) {
      setMessage(!online ? "该 Unit 尚未离线缓存，请联网打开或手动缓存一次后再离线使用。" : error instanceof Error ? error.message : "词表加载失败。");
    } finally {
      setLoading(false);
    }
  }

  function advanceAfterAnswer() {
    if (currentIndex + 1 >= testWords.length) {
      setAnswer("");
      setPendingSlip(false);
      setScreen("result");
      return;
    }
    setCurrentIndex((index) => index + 1);
    setAnswer("");
    setPendingSlip(false);
  }

  async function submitAnswer(forced?: "correct" | "wrong") {
    if (!currentWord) return;
    const result =
      forced === "wrong"
        ? { correct: false, slip: false, message: `已计为错误，答案是 ${currentWord.word}` }
        : forced === "correct"
          ? { correct: true, slip: false, message: `已计为正确：${currentWord.word}` }
          : evaluateAnswer(answer, currentWord.word, enableSlipDetection);
    setFeedback(result.message);
    if (result.slip) {
      setPendingSlip(true);
      return;
    }
    if (result.correct) {
      setCorrectWords((current) => [...current, currentWord]);
    } else {
      setIncorrectWords((current) => [...current, currentWord]);
      await addWrongWord(currentWord, testNo, batchName || undefined);
      await refreshWrongBook();
    }
    advanceAfterAnswer();
  }

  function resetTest() {
    setScreen("select");
    setTestWords([]);
    setCorrectWords([]);
    setIncorrectWords([]);
    setFeedback("");
    setPendingSlip(false);
    setAnswer("");
    setCurrentIndex(0);
  }

  async function importWrongBook(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await importWrongBookSnapshot(JSON.parse(await file.text()) as Partial<WrongBookSnapshot>);
    await refreshWrongBook();
    setMessage("错题本已导入并合并。");
    event.target.value = "";
  }

  async function pullCloud() {
    setCloudAction("pull");
    try {
      await pullAndMergeWrongBook();
      await refreshWrongBook();
      setMessage("已拉取云端错题本并合并到本地。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "需要登录后才能拉取云端错题本。");
    } finally {
      setCloudAction(null);
    }
  }

  async function overwriteCloud() {
    setCloudAction("overwrite");
    try {
      await overwriteCloudWrongBook();
      setMessage("已用本地错题本上传覆盖云端。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "需要登录后才能上传错题本。");
    } finally {
      setCloudAction(null);
    }
  }

  async function mergeCloud() {
    setCloudAction("merge");
    try {
      await mergeUploadWrongBook();
      await refreshWrongBook();
      setMessage("已完成本地与云端合并上传。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "需要登录后才能合并上传错题本。");
    } finally {
      setCloudAction(null);
    }
  }

  async function preparePrintableVocabulary() {
    setLoading(true);
    setMessage("");
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
        setMessage("请先选择至少一个 Unit 或上传并选择自定义词表。");
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
    } catch (error) {
      setMessage(!online ? "该 Unit 尚未离线缓存，请联网打开或手动缓存一次后再创建打印版。" : error instanceof Error ? error.message : "打印版准备失败。");
    } finally {
      setLoading(false);
    }
  }

  if (screen === "testing") {
    return (
      <div className="stack">
        <section className="md-card spread" aria-label="测试进度">
          <div>
            <h2 className="section-title">测试中</h2>
            <p className="helper-text">
              {currentIndex + 1} / {testWords.length} · 当前来源：{currentWord?.sourceTitle ?? currentWord?.sourceName}
            </p>
          </div>
          <md-outlined-button onClick={resetTest}>退出测试</md-outlined-button>
        </section>
        <section className="md-card stack" aria-label="当前题目">
          <div className="stack">
            {definitionLanguages.includes("en") ? (
              <div>
                <span className="badge badge--neutral">英语释义</span>
                <p className="section-title">{currentWord?.en_definition.join("; ") || "未提供英语释义"}</p>
              </div>
            ) : null}
            {definitionLanguages.includes("zh") ? (
              <div>
                <span className="badge badge--neutral">中文释义</span>
                <p className="section-title">{currentWord?.zh_definition.join("；") || "未提供中文释义"}</p>
              </div>
            ) : null}
          </div>
          <div className="cluster">
            {showHint && currentWord ? <span className="badge">{currentWord.word[0]}</span> : null}
            <md-outlined-text-field
              label="输入单词"
              value={answer}
              onInput={(event) => setAnswer(valueFrom(event))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitAnswer();
              }}
            />
            <md-filled-button onClick={() => void submitAnswer()}>提交</md-filled-button>
          </div>
          <StatusAlert message={feedback} />
          {pendingSlip ? (
            <div className="cluster">
              <md-outlined-button onClick={() => void submitAnswer("correct")}>判为正确</md-outlined-button>
              <md-outlined-button onClick={() => void submitAnswer("wrong")}>判为错误</md-outlined-button>
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
        <section className="md-grid" aria-label="测试结果">
          {[
            ["正确率", `${rate}%`],
            ["正确", correctWords.length],
            ["错误", incorrectWords.length]
          ].map(([title, value]) => (
            <article className="md-card" key={title}>
              <p className="helper-text">{title}</p>
              <div className="metric-value">{value}</div>
            </article>
          ))}
        </section>
        <section className="md-card stack" aria-label="错误单词">
          <div className="spread">
            <h2 className="section-title">错误单词</h2>
            <div className="cluster">
              <md-outlined-button onClick={() => downloadJson(`incorrect_${nowStamp()}.json`, { vocabulary: incorrectWords })}>下载错误 JSON</md-outlined-button>
              <md-filled-button onClick={resetTest}>重新开始</md-filled-button>
            </div>
          </div>
          {incorrectWords.length === 0 ? <p className="helper-text">没有错误单词。</p> : null}
          {incorrectWords.map((word) => (
            <article className="md-card md-card--flat spread" key={`${word.sourceName}-${word.word}`}>
              <div>
                <h3 className="card-title">{word.word}</h3>
                {definitionLanguages.includes("en") ? <p className="helper-text">英语：{word.en_definition.join("; ") || "未提供"}</p> : null}
                {definitionLanguages.includes("zh") ? <p className="helper-text">中文：{word.zh_definition.join("；") || "未提供"}</p> : null}
              </div>
              <span className="badge badge--neutral">{word.sourceTitle ?? word.sourceName}</span>
            </article>
          ))}
        </section>
      </div>
    );
  }

  if (screen === "wrongbook") {
    return (
      <div className="stack">
        <section className="md-card spread" aria-label="错题本说明">
          <div>
            <h2 className="section-title">错题本</h2>
            <p className="helper-text">错题本优先保存在本机。登录或配置自定义同步源后，可以手动拉取、上传或合并云端数据。</p>
          </div>
          <div className="cluster">
            <md-outlined-button onClick={() => setScreen("select")}>返回测试</md-outlined-button>
            <md-filled-button disabled={wrongRecords.length === 0} onClick={() => void startTest("wrongbook")}>
              错题测试
            </md-filled-button>
          </div>
        </section>
        <section className="md-card stack" aria-label="错题记录">
          <div className="spread">
            <h2 className="section-title">错题记录</h2>
            <div className="cluster">
              <md-outlined-button onClick={() => wrongBook && downloadJson(`wrongbook_${nowStamp()}.json`, wrongBook)}>导出</md-outlined-button>
              <md-outlined-button onClick={() => importWrongBookRef.current?.click()}>导入</md-outlined-button>
              <input ref={importWrongBookRef} className="hidden-input" type="file" accept=".json" onChange={(event) => void importWrongBook(event)} />
            </div>
          </div>
          <div className="wrongbook-filters">
            <md-outlined-text-field label="搜索单词" value={wrongBookSearch} onInput={(event) => setWrongBookSearch(valueFrom(event))} />
            <div className="wrongbook-filter-row">
              <md-filled-select className="wrongbook-source-select" label="来源" value={wrongBookSource} onInput={(event) => setWrongBookSource(valueFrom(event))}>
                <md-select-option value="all">
                  <div slot="headline">全部来源</div>
                </md-select-option>
                {wrongBookSources.map((source) => (
                  <md-select-option key={source} value={source}>
                    <div slot="headline">{source}</div>
                  </md-select-option>
                ))}
              </md-filled-select>
              <div className="filter-section" aria-label="错误次数筛选">
                <span className="filter-label">错误次数</span>
                <div className="button-group" role="radiogroup" aria-label="错误次数">
                  {wrongBookLevelOptions.map((option) => (
                    <button
                      className="button-group__item"
                      type="button"
                      role="radio"
                      aria-checked={wrongBookLevel === option.value}
                      data-selected={wrongBookLevel === option.value}
                      key={option.value}
                      onClick={() => setWrongBookLevel(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-section" aria-label="视图筛选">
                <span className="filter-label">视图</span>
                <div className="chip-scroll">
                  <md-filter-chip selected={wrongBookView === "words"} onClick={() => setWrongBookView("words")}>
                    单词
                  </md-filter-chip>
                  <md-filter-chip selected={wrongBookView === "batches"} onClick={() => setWrongBookView("batches")}>
                    批次
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
                      <div className="record-chip-row" aria-label={`${record.word} 错题信息`}>
                        <span className="info-chip">来源：{record.sourceTitle ?? record.sourceName}</span>
                        <span className="info-chip info-chip--strong">错 {record.wrongCount} 次</span>
                      </div>
                    </div>
                    <md-outlined-button onClick={() => void deleteWrongRecord(record.id).then(refreshWrongBook)} aria-label={`删除 ${record.word}`}>
                      删除
                    </md-outlined-button>
                  </article>
                ))
              : wrongBookBatches.map((batch) => (
                  <article className="md-card md-card--flat spread" key={batch.testNo}>
                    <div>
                      <h3 className="card-title">{batch.batchName || batch.testNo}</h3>
                      <p className="helper-text">
                        {batch.createdAt} · {batch.syncedCount} 词
                      </p>
                    </div>
                    <md-outlined-button onClick={() => void deleteWrongBatch(batch.testNo).then(refreshWrongBook)} aria-label={`删除批次 ${batch.testNo}`}>
                      删除
                    </md-outlined-button>
                  </article>
                ))}
          </div>
        </section>
        <section className="md-card spread" aria-label="云端同步">
          <div>
            <h2 className="section-title">云端同步</h2>
            <p className="helper-text">提供拉取云端、上传覆盖、合并上传三种显式操作，默认不自动覆盖本地数据。</p>
            <span className="sync-status-chip" data-status={!online ? "offline" : cloudAction ? "syncing" : "ready"}>
              <MaterialIcon name={!online ? "cloud_off" : cloudAction ? cloudActionIcon[cloudAction] : "cloud_sync"} />
              <span>{!online ? "当前离线，云端同步不可用" : cloudAction ? cloudActionLabel[cloudAction] : "云端同步可用"}</span>
            </span>
          </div>
          <div className="cluster">
            <md-outlined-button disabled={!online || Boolean(cloudAction)} onClick={() => void pullCloud()}>拉取云端</md-outlined-button>
            <md-outlined-button disabled={!online || Boolean(cloudAction)} onClick={() => void overwriteCloud()}>上传覆盖</md-outlined-button>
            <md-filled-button disabled={!online || Boolean(cloudAction)} onClick={() => void mergeCloud()}>合并上传</md-filled-button>
          </div>
        </section>
        <StatusAlert message={message} />
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="md-card spread" aria-label="选择单词列表">
        <div>
          <h2 className="section-title">选择单词列表</h2>
          <p className="helper-text">
            选择一个或多个单元，也可以上传自定义 JSON 词表。
            {selectedMetas.length === 0 ? " 选择 Unit 后可以缓存离线词表。" : ` 已选 ${selectedMetas.length} 个 Unit · 已缓存 ${cachedUnitCount} · 未缓存 ${missingUnitCount}`}
          </p>
        </div>
        <div className="cluster">
          <span className={online ? "badge badge--neutral" : "badge badge--error"}>{online ? "在线" : "离线"}</span>
          <md-outlined-button disabled={!online || cacheBusy || selectedMetas.length === 0} onClick={() => void cacheSelectedUnits()}>
            {cacheBusy ? "正在缓存" : "缓存已选 Unit"}
          </md-outlined-button>
          <md-outlined-button disabled={selectedMetas.length === 0 && selectedCustomLists.length === 0} onClick={() => void preparePrintableVocabulary()}>
            创建打印版
          </md-outlined-button>
          <md-outlined-button onClick={() => setScreen("wrongbook")}>打开错题本</md-outlined-button>
          <md-filled-button disabled={loading} onClick={() => void startTest()}>
            开始测试
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
                <md-outlined-button onClick={() => toggleBook(book.code)}>{allSelected ? "已全选" : "全选"}</md-outlined-button>
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
        <section className="md-card stack" aria-label="自定义词表">
          <div className="spread">
            <h3 className="card-title">自定义词表</h3>
            <md-outlined-button onClick={() => customListRef.current?.click()}>上传</md-outlined-button>
            <input ref={customListRef} className="hidden-input" type="file" accept=".json" multiple onChange={(event) => void uploadCustomList(event)} />
          </div>
          <div className="unit-grid">
            {Array.from({ length: Math.ceil((visibleCustomLists.length + (customOverflowCount > 0 ? 1 : 0)) / 2) }, (_, rowIndex) => {
              const cells = customOverflowCount > 0 ? [...visibleCustomLists, { name: "__more__", title: `更多 ${customOverflowCount}…` }] : visibleCustomLists;
              return (
                <div className="unit-row" key={`custom-row-${rowIndex}`}>
                  {cells.slice(rowIndex * 2, rowIndex * 2 + 2).map((item) =>
                    item.name === "__more__" ? (
                      <button
                        className="more-chip"
                        data-state={hiddenCustomSelectionState}
                        key={item.name}
                        type="button"
                        aria-label={`${hiddenCustomSelectionText}，打开更多自定义词表`}
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
          {uploadedLists.length === 0 ? <p className="helper-text">尚未上传。</p> : null}
        </section>
      </div>

      <section className="md-card stack" aria-label="测试设置">
        <h2 className="section-title">测试设置</h2>
        <div className="quiz-settings-grid">
          <md-filled-select label="测试模式" value={testMode} onInput={(event) => setTestMode(valueFrom(event) as TestMode)}>
            <md-select-option value="all">
              <div slot="headline">全部</div>
            </md-select-option>
            <md-select-option value="custom">
              <div slot="headline">自定义数量</div>
            </md-select-option>
          </md-filled-select>
          {testMode === "all" ? (
            <div className="material-static-field" aria-disabled="true">
              <span>全部模式下不可用</span>
              <strong>{testCount}</strong>
            </div>
          ) : (
            <md-outlined-text-field
              type="number"
              label="测试数量"
              value={testCount}
              min={1}
              max={Math.max(maxTestCount, testCount, 1)}
              onInput={(event) => setTestCount(Number(valueFrom(event)))}
            />
          )}
          <label className="switch-field">
            <md-switch selected={showHint} checked={showHint} onInput={(event) => setShowHint(checkedFrom(event))} />
            <span>首字母提示</span>
          </label>
          <label className="switch-field">
            <md-switch selected={enableSlipDetection} checked={enableSlipDetection} onInput={(event) => setEnableSlipDetection(checkedFrom(event))} />
            <span>手滑判定</span>
          </label>
          <div className="stack" aria-label="题目释义语言">
            <span className="helper-text">题目释义语言</span>
            <div className="cluster">
              {definitionLanguageOptions.map((option) => (
                <md-filter-chip
                  key={option.value}
                  selected={definitionLanguages.includes(option.value)}
                  onClick={() => toggleDefinitionLanguage(option.value)}
                >
                  {option.label}
                </md-filter-chip>
              ))}
            </div>
          </div>
          <md-outlined-text-field label="批次名称（可选）" value={batchName} onInput={(event) => setBatchName(valueFrom(event))} />
        </div>
      </section>
      <StatusAlert message={message} />

      <md-dialog open={loading}>
        <div slot="headline">正在准备测试</div>
        <div slot="content">正在加载词表，请稍候。</div>
      </md-dialog>
      <md-dialog key={customListDialogKey} open={customListDialogOpen} onClosed={closeCustomListDialog} onClose={closeCustomListDialog} onCancel={closeCustomListDialog}>
        <div slot="headline">自定义词表</div>
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
          <md-text-button onClick={closeCustomListDialog}>完成</md-text-button>
        </div>
      </md-dialog>
    </div>
  );
}
