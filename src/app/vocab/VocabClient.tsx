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
import type { WrongBookSnapshot, VocabWord } from "@/lib/types";
import { getBookCode, getBookTitle, loadVocabList, type VocabListMeta } from "@/lib/vocab-data";
import { StatusAlert } from "../components/StatusAlert";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

type UploadedList = VocabListMeta & { words: VocabWord[] };
type TestMode = "all" | "custom";
type Screen = "select" | "testing" | "result" | "wrongbook";
type WrongBookView = "words" | "batches";

const books = Array.from(new Set(list.map((item) => getBookCode(item.name)))).map((code) => ({ code, title: getBookTitle(code) }));
const visibleCustomListCount = 3;

function nowStamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function normalizeCustomWords(words: VocabWord[], sourceName: string, sourceTitle: string) {
  return words.map((word) => ({ ...word, sourceName, sourceTitle }));
}

function getSavedQuizSettings() {
  if (typeof window === "undefined") return { showHint: true, enableSlipDetection: false, defaultTestCount: 20 };
  try {
    const saved = localStorage.getItem("henguren-v3-settings");
    return saved ? { showHint: true, enableSlipDetection: false, defaultTestCount: 20, ...JSON.parse(saved) } : { showHint: true, enableSlipDetection: false, defaultTestCount: 20 };
  } catch {
    return { showHint: true, enableSlipDetection: false, defaultTestCount: 20 };
  }
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

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function buildPrintableWrongBookHtml(snapshot: WrongBookSnapshot) {
  const rows = snapshot.records
    .map((record, index) => {
      const definitions = [...(record.definitions ?? []), ...(record.zhDefinitions ?? [])].join("；");
      return `<tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(record.word)}</strong></td>
        <td>${escapeHtml(definitions || "-")}</td>
        <td>${escapeHtml(record.sourceTitle ?? record.sourceName)}</td>
        <td>${record.wrongCount}</td>
        <td>${escapeHtml([...(record.batchNames ?? []), ...(record.testNos ?? [])].join(" / ") || "-")}</td>
      </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>恨古人工具箱错题本打印版</title>
  <style>
    body { font-family: "Microsoft YaHei UI", "Noto Sans SC", sans-serif; margin: 28px; color: #1a1b20; }
    h1 { margin: 0 0 8px; }
    .meta { color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #c6c6d0; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #eef3ff; }
    tr:nth-child(even) td { background: #fafbff; }
    @media print { body { margin: 16mm; } }
  </style>
</head>
<body>
  <h1>错题本打印版</h1>
  <div class="meta">生成时间：${escapeHtml(new Date().toLocaleString("zh-CN"))} · 共 ${snapshot.records.length} 词</div>
  <table>
    <thead><tr><th>#</th><th>单词</th><th>释义</th><th>来源</th><th>错误次数</th><th>批次</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;
}

export function VocabClient() {
  const [screen, setScreen] = useState<Screen>("select");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [uploadedLists, setUploadedLists] = useState<UploadedList[]>([]);
  const [selectedUploadedIds, setSelectedUploadedIds] = useState<string[]>([]);
  const [testMode, setTestMode] = useState<TestMode>("all");
  const [testCount, setTestCount] = useState(() => getSavedQuizSettings().defaultTestCount);
  const [showHint, setShowHint] = useState(() => getSavedQuizSettings().showHint);
  const [enableSlipDetection, setEnableSlipDetection] = useState(() => getSavedQuizSettings().enableSlipDetection);
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
  const [wrongBookLevel, setWrongBookLevel] = useState("all");
  const [wrongBookView, setWrongBookView] = useState<WrongBookView>("words");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [customListDialogOpen, setCustomListDialogOpen] = useState(false);
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

  function toggleBook(bookCode: string) {
    const units = list.filter((item) => getBookCode(item.name) === bookCode).map((item) => item.name);
    const allSelected = units.every((unit) => selectedUnits.includes(unit));
    setSelectedUnits((current) => (allSelected ? current.filter((item) => !units.includes(item)) : Array.from(new Set([...current, ...units]))));
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

  async function startTest(source: "selection" | "wrongbook" = "selection") {
    setLoading(true);
    setMessage("");
    try {
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
    const response = await fetch("/api/wrongbook");
    if (!response.ok) {
      setMessage("需要登录后才能拉取云端错题本。");
      return;
    }
    await importWrongBookSnapshot((await response.json()) as WrongBookSnapshot);
    await refreshWrongBook();
    setMessage("已拉取并合并云端错题本。");
  }

  async function overwriteCloud() {
    const response = await fetch("/api/wrongbook", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await readLocalWrongBook(clientId))
    });
    setMessage(response.ok ? "已上传覆盖云端错题本。" : "需要登录后才能上传错题本。");
  }

  async function mergeCloud() {
    const response = await fetch("/api/wrongbook/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await readLocalWrongBook(clientId))
    });
    if (!response.ok) {
      setMessage("需要登录后才能合并上传错题本。");
      return;
    }
    await importWrongBookSnapshot((await response.json()) as WrongBookSnapshot);
    await refreshWrongBook();
    setMessage("已完成云端合并同步。");
  }

  async function createPrintableWrongBook() {
    const snapshot = await readLocalWrongBook(clientId);
    if (snapshot.records.length === 0) {
      setMessage("错题本为空，暂时无法创建打印版。");
      return;
    }
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setMessage("浏览器阻止了弹出窗口，请允许后重试。");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildPrintableWrongBookHtml(snapshot));
    printWindow.document.close();
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
            <h2 className="section-title">{currentWord?.en_definition.join("; ")}</h2>
            <p className="helper-text">{currentWord?.zh_definition.join("；")}</p>
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
                <p className="helper-text">{word.en_definition.join("; ")}</p>
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
            <p className="helper-text">本地 IndexedDB 保存，登录后可以与 R2 中的云端错题本同步。</p>
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
          <div className="field-grid">
            <md-outlined-text-field label="搜索单词" value={wrongBookSearch} onInput={(event) => setWrongBookSearch(valueFrom(event))} />
            <md-filled-select label="来源" value={wrongBookSource} onInput={(event) => setWrongBookSource(valueFrom(event))}>
              <md-select-option value="all">
                <div slot="headline">全部来源</div>
              </md-select-option>
              {wrongBookSources.map((source) => (
                <md-select-option key={source} value={source}>
                  <div slot="headline">{source}</div>
                </md-select-option>
              ))}
            </md-filled-select>
            <md-filled-select label="错误次数" value={wrongBookLevel} onInput={(event) => setWrongBookLevel(valueFrom(event))}>
              <md-select-option value="all">
                <div slot="headline">全部错误次数</div>
              </md-select-option>
              <md-select-option value="1">
                <div slot="headline">错 1 次</div>
              </md-select-option>
              <md-select-option value="2">
                <div slot="headline">错 2 次</div>
              </md-select-option>
              <md-select-option value="3plus">
                <div slot="headline">错 3 次及以上</div>
              </md-select-option>
            </md-filled-select>
            <div className="cluster">
              <md-filter-chip selected={wrongBookView === "words"} onClick={() => setWrongBookView("words")}>
                单词
              </md-filter-chip>
              <md-filter-chip selected={wrongBookView === "batches"} onClick={() => setWrongBookView("batches")}>
                批次
              </md-filter-chip>
            </div>
          </div>
          <div className="stack">
            {wrongBookView === "words"
              ? filteredWrongRecords.map((record) => (
                  <article className="md-card md-card--flat spread" key={record.id}>
                    <div>
                      <h3 className="card-title">{record.word}</h3>
                      <p className="helper-text">
                        来源 {record.sourceTitle ?? record.sourceName} · 错 {record.wrongCount} 次
                      </p>
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
          </div>
          <div className="cluster">
            <md-outlined-button onClick={() => void pullCloud()}>拉取云端</md-outlined-button>
            <md-outlined-button onClick={() => void overwriteCloud()}>上传覆盖</md-outlined-button>
            <md-filled-button onClick={() => void mergeCloud()}>合并上传</md-filled-button>
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
          <p className="helper-text">选择一个或多个单元，也可以上传自定义 JSON 词表。</p>
        </div>
        <div className="cluster">
          <md-outlined-button disabled={wrongRecords.length === 0} onClick={() => void createPrintableWrongBook()}>
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
                        onClick={() => setCustomListDialogOpen(true)}
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
          <md-outlined-text-field label="批次名称（可选）" value={batchName} onInput={(event) => setBatchName(valueFrom(event))} />
        </div>
      </section>
      <StatusAlert message={message} />

      <md-dialog open={loading}>
        <div slot="headline">正在准备测试</div>
        <div slot="content">正在加载词表，请稍候。</div>
      </md-dialog>
      <md-dialog open={customListDialogOpen} onClosed={() => setCustomListDialogOpen(false)}>
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
          <md-text-button onClick={() => setCustomListDialogOpen(false)}>完成</md-text-button>
        </div>
      </md-dialog>
    </div>
  );
}
