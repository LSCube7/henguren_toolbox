"use client";

import textLists from "@/assets/js/text/list.json";
import {
  createClozeQuiz,
  evaluateClozeQuestion,
  type ClozeDifficulty,
  type ClozeQuestion,
  type ClozeQuestionResult,
  type TextSentence
} from "@/lib/text-quiz";
import { useEffect, useMemo, useState } from "react";
import { StatusAlert } from "../components/StatusAlert";

type Paragraph = { id: string; title?: string; sentences: TextSentence[] };
type Section = { id: string; title: string; paragraphs: Paragraph[] };
type TextBook = { title?: string; sections: Section[] };
type TestScope = "paragraph" | "section" | "book";
type Screen = "select" | "testing" | "result";

const difficultyOptions: Array<{ value: ClozeDifficulty; label: string; description: string }> = [
  { value: "easy", label: "轻量", description: "每句最多 2 空，优先较长的实词。" },
  { value: "standard", label: "标准", description: "每句最多 4 空，兼顾难度与可读性。" },
  { value: "hard", label: "挑战", description: "每句最多 6 空，覆盖更多关键词。" }
];

function valueFrom(event: React.FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

function questionBlanks(question: ClozeQuestion) {
  return question.parts.filter((part) => part.type === "blank");
}

export function TextClient() {
  const [selected, setSelected] = useState(textLists[0]?.name ?? "");
  const [book, setBook] = useState<TextBook | null>(null);
  const [message, setMessage] = useState("");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [paragraphIndex, setParagraphIndex] = useState(0);
  const [scope, setScope] = useState<TestScope>("paragraph");
  const [difficulty, setDifficulty] = useState<ClozeDifficulty>("standard");
  const [questionCount, setQuestionCount] = useState(10);
  const [screen, setScreen] = useState<Screen>("select");
  const [questions, setQuestions] = useState<ClozeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentResult, setCurrentResult] = useState<ClozeQuestionResult | null>(null);
  const [results, setResults] = useState<ClozeQuestionResult[]>([]);
  const section = book?.sections[sectionIndex];
  const paragraph = section?.paragraphs[paragraphIndex];
  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    async function load() {
      try {
        setMessage("");
        setBook(null);
        const response = await fetch(`/api/data/text/${selected}`);
        if (!response.ok) throw new Error("text_cache_miss");
        setBook((await response.json()) as TextBook);
        setSectionIndex(0);
        setParagraphIndex(0);
        setScreen("select");
      } catch {
        setBook(null);
        setMessage("该课文尚未离线缓存，请联网打开一次后再离线使用。");
      }
    }
    if (selected) void load();
  }, [selected]);

  const scopeSentences = useMemo(() => {
    if (!book) return [];
    if (scope === "paragraph") return paragraph?.sentences ?? [];
    if (scope === "section") return section?.paragraphs.flatMap((item) => item.sentences) ?? [];
    return book.sections.flatMap((item) => item.paragraphs.flatMap((entry) => entry.sentences));
  }, [book, paragraph, scope, section]);

  function startTest() {
    const nextQuestions = createClozeQuiz(scopeSentences, questionCount, difficulty);
    if (nextQuestions.length === 0) {
      setMessage("当前范围没有适合随机挖空的英文句子，请选择其他范围。");
      return;
    }
    setQuestions(nextQuestions);
    setCurrentIndex(0);
    setAnswers({});
    setCurrentResult(null);
    setResults([]);
    setMessage("");
    setScreen("testing");
  }

  function submitAnswer() {
    if (!currentQuestion) return;
    const blanks = questionBlanks(currentQuestion);
    if (blanks.some((blank) => !(answers[blank.id] ?? "").trim())) {
      setMessage("请填写当前句子的所有空格后再提交。");
      return;
    }
    const result = evaluateClozeQuestion(currentQuestion, answers);
    setCurrentResult(result);
    setResults((current) => [...current, result]);
    setMessage(result.correct ? "本句全部正确。" : `本句答对 ${result.correctCount} / ${result.total} 个空格，请核对正确答案。`);
  }

  function goNext() {
    if (!currentResult) return;
    if (currentIndex + 1 >= questions.length) {
      setScreen("result");
      setMessage("");
      return;
    }
    setCurrentIndex((index) => index + 1);
    setAnswers({});
    setCurrentResult(null);
    setMessage("");
  }

  function resetTest() {
    setScreen("select");
    setQuestions([]);
    setResults([]);
    setAnswers({});
    setCurrentResult(null);
    setCurrentIndex(0);
    setMessage("");
  }

  if (screen === "testing" && currentQuestion) {
    return (
      <div className="stack">
        <section className="md-card spread" aria-label="课文测试进度">
          <div>
            <h2 className="section-title">课文挖空测试</h2>
            <p className="helper-text">第 {currentIndex + 1} / {questions.length} 句</p>
          </div>
          <md-outlined-button onClick={resetTest}>退出测试</md-outlined-button>
        </section>
        <section className="md-card stack" aria-label="当前挖空句子">
          <p className="cloze-sentence">
            {currentQuestion.parts.map((part, index) => {
              if (part.type === "text") return <span key={`text-${index}`}>{part.value}</span>;
              const blankNumber = questionBlanks(currentQuestion).findIndex((blank) => blank.id === part.id) + 1;
              const result = currentResult?.blanks.find((blank) => blank.id === part.id);
              return (
                <span className="cloze-blank-wrap" key={part.id}>
                  <md-outlined-text-field
                    className="cloze-blank"
                    label={`第 ${blankNumber} 空`}
                    value={answers[part.id] ?? ""}
                    disabled={Boolean(currentResult)}
                    onInput={(event) => setAnswers((current) => ({ ...current, [part.id]: valueFrom(event) }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !currentResult) submitAnswer();
                    }}
                  />
                  {result && !result.correct ? <span className="cloze-correction">正确：{result.answer}</span> : null}
                </span>
              );
            })}
          </p>
          <StatusAlert message={message} tone={currentResult && !currentResult.correct ? "error" : "info"} />
          <div className="cluster">
            {currentResult ? (
              <md-filled-button onClick={goNext}>{currentIndex + 1 >= questions.length ? "查看结果" : "下一句"}</md-filled-button>
            ) : (
              <md-filled-button onClick={submitAnswer}>提交本句</md-filled-button>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (screen === "result") {
    const totalBlanks = results.reduce((sum, result) => sum + result.total, 0);
    const correctBlanks = results.reduce((sum, result) => sum + result.correctCount, 0);
    const correctSentences = results.filter((result) => result.correct).length;
    const accuracy = totalBlanks === 0 ? 0 : Math.round((correctBlanks / totalBlanks) * 100);
    const incorrectResults = results.filter((result) => !result.correct);
    return (
      <div className="stack">
        <section className="md-grid" aria-label="课文测试结果">
          {[
            ["空格正确率", `${accuracy}%`],
            ["正确空格", `${correctBlanks} / ${totalBlanks}`],
            ["全对句子", `${correctSentences} / ${results.length}`]
          ].map(([title, value]) => (
            <article className="md-card" key={title}>
              <p className="helper-text">{title}</p>
              <div className="metric-value">{value}</div>
            </article>
          ))}
        </section>
        <section className="md-card stack" aria-label="需要复习的句子">
          <div className="spread">
            <div>
              <h2 className="section-title">需要复习的句子</h2>
              <p className="helper-text">这里列出没有全部答对的原句。</p>
            </div>
            <md-filled-button onClick={resetTest}>返回重新测试</md-filled-button>
          </div>
          {incorrectResults.length === 0 ? <p className="helper-text">全部句子都答对了。</p> : null}
          {incorrectResults.map((result, index) => (
            <article className="md-card md-card--flat" key={`${result.question.sentenceId}-${index}`}>
              <p>{result.question.original}</p>
              <p className="helper-text">答对 {result.correctCount} / {result.total} 个空格</p>
            </article>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="md-card stack" aria-label="课文与测试范围选择">
        <div className="spread">
          <div>
            <h2 className="section-title">选择课文和测试范围</h2>
            <p className="helper-text">随机挖空会优先选择较长的实词，并尽量避免连续挖空。</p>
          </div>
          <md-filled-button disabled={!book || scopeSentences.length === 0} onClick={startTest}>开始测试</md-filled-button>
        </div>
        <md-filled-select label="课文列表" value={selected} onInput={(event) => setSelected(valueFrom(event))}>
          {textLists.map((item) => (
            <md-select-option value={item.name} key={item.name}>
              <div slot="headline">{item.title}</div>
            </md-select-option>
          ))}
        </md-filled-select>
        {book ? (
          <>
            <div className="cluster" aria-label="章节列表">
              {book.sections.map((item, index) =>
                index === sectionIndex ? (
                  <md-filled-button key={item.id}>{item.title}</md-filled-button>
                ) : (
                  <md-outlined-button
                    key={item.id}
                    onClick={() => {
                      setSectionIndex(index);
                      setParagraphIndex(0);
                    }}
                  >
                    {item.title}
                  </md-outlined-button>
                )
              )}
            </div>
            <div className="cluster" aria-label="段落列表">
              {section?.paragraphs.map((item, index) =>
                index === paragraphIndex ? (
                  <md-filled-button key={item.id}>段落 {index + 1}</md-filled-button>
                ) : (
                  <md-outlined-button key={item.id} onClick={() => setParagraphIndex(index)}>
                    段落 {index + 1}
                  </md-outlined-button>
                )
              )}
            </div>
          </>
        ) : (
          <p className="helper-text">{message || "正在加载课文。"}</p>
        )}
      </section>

      <section className="md-card stack" aria-label="课文测试设置">
        <h2 className="section-title">测试设置</h2>
        <div className="field-grid">
          <md-filled-select label="测试范围" value={scope} onInput={(event) => setScope(valueFrom(event) as TestScope)}>
            <md-select-option value="paragraph"><div slot="headline">当前段落</div></md-select-option>
            <md-select-option value="section"><div slot="headline">当前章节</div></md-select-option>
            <md-select-option value="book"><div slot="headline">整篇课文</div></md-select-option>
          </md-filled-select>
          <md-filled-select label="挖空难度" value={difficulty} onInput={(event) => setDifficulty(valueFrom(event) as ClozeDifficulty)}>
            {difficultyOptions.map((option) => (
              <md-select-option value={option.value} key={option.value}>
                <div slot="headline">{option.label}</div>
                <div slot="supporting-text">{option.description}</div>
              </md-select-option>
            ))}
          </md-filled-select>
          <md-outlined-text-field
            label="测试句数"
            type="number"
            min={1}
            max={Math.max(1, scopeSentences.length)}
            value={questionCount}
            onInput={(event) => setQuestionCount(Math.max(1, Number(valueFrom(event)) || 1))}
          />
          <div className="material-static-field">
            <span>当前范围可用句子</span>
            <strong>{scopeSentences.length}</strong>
          </div>
        </div>
      </section>

      <section className="md-card stack" aria-label="课文预览">
        <div>
          <h2 className="section-title">当前段落预览</h2>
          <p className="helper-text">预览不会改变测试范围设置。</p>
        </div>
        {paragraph?.sentences.map((sentence, index) => (
          <p key={sentence.id} className="helper-text" style={{ lineHeight: 1.8 }}>
            <span className="badge badge--neutral" style={{ marginRight: 8 }}>{index + 1}</span>
            {sentence.text}
          </p>
        ))}
      </section>
      <StatusAlert message={message} tone={message.includes("尚未离线") ? "error" : "info"} />
    </div>
  );
}
