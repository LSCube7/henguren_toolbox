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
import { useI18n } from "../i18n/AppI18nProvider";
import type { MessageKey } from "@/i18n/config";

type Paragraph = { id: string; title?: string; sentences: TextSentence[] };
type Section = { id: string; title: string; paragraphs: Paragraph[] };
type TextBook = { title?: string; sections: Section[] };
type TestScope = "paragraph" | "section" | "book";
type Screen = "select" | "testing" | "result";

const difficultyOptions: Array<{ value: ClozeDifficulty; label: MessageKey; description: MessageKey }> = [
  { value: "easy", label: "text.difficulty.easy", description: "text.difficulty.easyDescription" },
  { value: "standard", label: "text.difficulty.standard", description: "text.difficulty.standardDescription" },
  { value: "hard", label: "text.difficulty.hard", description: "text.difficulty.hardDescription" }
];

function valueFrom(event: React.FormEvent<HTMLElement>) {
  return String((event.currentTarget as HTMLElement & { value?: string }).value ?? "");
}

function questionBlanks(question: ClozeQuestion) {
  return question.parts.filter((part) => part.type === "blank");
}

export function TextClient() {
  const { locale, t } = useI18n();
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
        setMessage(t("text.offlineMissing"));
      }
    }
    if (selected) void load();
  }, [selected, t]);

  const scopeSentences = useMemo(() => {
    if (!book) return [];
    if (scope === "paragraph") return paragraph?.sentences ?? [];
    if (scope === "section") return section?.paragraphs.flatMap((item) => item.sentences) ?? [];
    return book.sections.flatMap((item) => item.paragraphs.flatMap((entry) => entry.sentences));
  }, [book, paragraph, scope, section]);

  function startTest() {
    const nextQuestions = createClozeQuiz(scopeSentences, questionCount, difficulty);
    if (nextQuestions.length === 0) {
      setMessage(t("text.noSentences"));
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
    if (!currentQuestion || currentResult) return;
    const blanks = questionBlanks(currentQuestion);
    if (blanks.some((blank) => !(answers[blank.id] ?? "").trim())) {
      setMessage(t("text.completeBlanks"));
      return;
    }
    const result = evaluateClozeQuestion(currentQuestion, answers);
    setCurrentResult(result);
    setResults((current) => (current.some((entry) => entry.question === currentQuestion) ? current : [...current, result]));
    setMessage(result.correct ? t("text.sentenceCorrect") : t("text.sentenceResult", { correct: result.correctCount, total: result.total }));
  }

  function updateAnswer(blankId: string, event: React.FormEvent<HTMLElement>) {
    const value = valueFrom(event);
    setAnswers((current) => ({ ...current, [blankId]: value }));
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
        <section className="md-card spread" aria-label={t("text.progressAria")}>
          <div>
            <h2 className="section-title">{t("text.testTitle")}</h2>
            <p className="helper-text">{t("text.progress", { current: currentIndex + 1, total: questions.length })}</p>
          </div>
          <md-outlined-button onClick={resetTest}>{t("text.exit")}</md-outlined-button>
        </section>
        <section className="md-card stack" aria-label={t("text.questionAria")}>
          <div className="cloze-sentence">
            {currentQuestion.parts.map((part, index) => {
              if (part.type === "text") return <span key={`text-${index}`}>{part.value}</span>;
              const blankNumber = questionBlanks(currentQuestion).findIndex((blank) => blank.id === part.id) + 1;
              const result = currentResult?.blanks.find((blank) => blank.id === part.id);
              return (
                <span className="cloze-blank-wrap" key={part.id}>
                  <md-outlined-text-field
                    className="cloze-blank"
                    label={t("text.blankLabel", { number: blankNumber })}
                    value={answers[part.id] ?? ""}
                    disabled={Boolean(currentResult)}
                    onInput={(event) => updateAnswer(part.id, event)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !currentResult) submitAnswer();
                    }}
                  />
                  {result && !result.correct ? <span className="cloze-correction">{t("text.correctAnswer", { answer: result.answer })}</span> : null}
                </span>
              );
            })}
          </div>
          <StatusAlert message={message} tone={currentResult && !currentResult.correct ? "error" : "info"} />
          <div className="cluster">
            {currentResult ? (
              <md-filled-button onClick={goNext}>{t(currentIndex + 1 >= questions.length ? "text.viewResults" : "text.nextSentence")}</md-filled-button>
            ) : (
              <md-filled-button onClick={submitAnswer}>{t("text.submitSentence")}</md-filled-button>
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
        <section className="md-grid" aria-label={t("text.resultsAria")}>
          {[
            [t("text.accuracy"), `${accuracy}%`],
            [t("text.correctBlanks"), `${correctBlanks} / ${totalBlanks}`],
            [t("text.correctSentences"), `${correctSentences} / ${results.length}`]
          ].map(([title, value]) => (
            <article className="md-card" key={title}>
              <p className="helper-text">{title}</p>
              <div className="metric-value">{value}</div>
            </article>
          ))}
        </section>
        <section className="md-card stack" aria-label={t("text.reviewAria")}>
          <div className="spread">
            <div>
              <h2 className="section-title">{t("text.reviewTitle")}</h2>
              <p className="helper-text">{t("text.reviewDescription")}</p>
            </div>
            <md-filled-button onClick={resetTest}>{t("text.retry")}</md-filled-button>
          </div>
          {incorrectResults.length === 0 ? <p className="helper-text">{t("text.allCorrect")}</p> : null}
          {incorrectResults.map((result, index) => (
            <article className="md-card md-card--flat" key={`${result.question.sentenceId}-${index}`}>
              <p>{result.question.original}</p>
              <p className="helper-text">{t("text.reviewScore", { correct: result.correctCount, total: result.total })}</p>
            </article>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="md-card stack" aria-label={t("text.selectionAria")}>
        <div className="spread">
          <div>
            <h2 className="section-title">{t("text.selectionTitle")}</h2>
            <p className="helper-text">{t("text.selectionDescription")}</p>
          </div>
          <md-filled-button disabled={!book || scopeSentences.length === 0} onClick={startTest}>{t("text.start")}</md-filled-button>
        </div>
        <md-filled-select label={t("text.list")} value={selected} onInput={(event) => setSelected(valueFrom(event))}>
          {textLists.map((item) => (
            <md-select-option value={item.name} key={item.name}>
              <div slot="headline">{item.title}</div>
            </md-select-option>
          ))}
        </md-filled-select>
        {book ? (
          <>
            <div className="cluster" aria-label={t("text.sectionsAria")}>
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
            <div className="cluster" aria-label={t("text.paragraphsAria")}>
              {section?.paragraphs.map((item, index) =>
                index === paragraphIndex ? (
                  <md-filled-button key={item.id}>{t("text.paragraph", { number: index + 1 })}</md-filled-button>
                ) : (
                  <md-outlined-button key={item.id} onClick={() => setParagraphIndex(index)}>
                    {t("text.paragraph", { number: index + 1 })}
                  </md-outlined-button>
                )
              )}
            </div>
          </>
        ) : (
          <p className="helper-text">{message || t("text.loading")}</p>
        )}
      </section>

      <section className="md-card stack" aria-label={t("text.settingsAria")}>
        <h2 className="section-title">{t("text.settingsTitle")}</h2>
        <div className="field-grid">
          <md-filled-select key={`${locale}-text-scope`} label={t("text.scope")} value={scope} onInput={(event) => setScope(valueFrom(event) as TestScope)}>
            <md-select-option value="paragraph"><div slot="headline">{t("text.scope.paragraph")}</div></md-select-option>
            <md-select-option value="section"><div slot="headline">{t("text.scope.section")}</div></md-select-option>
            <md-select-option value="book"><div slot="headline">{t("text.scope.book")}</div></md-select-option>
          </md-filled-select>
          <md-filled-select key={`${locale}-text-difficulty`} label={t("text.difficulty")} value={difficulty} onInput={(event) => setDifficulty(valueFrom(event) as ClozeDifficulty)}>
            {difficultyOptions.map((option) => (
              <md-select-option value={option.value} key={option.value}>
                <div slot="headline">{t(option.label)}</div>
                <div slot="supporting-text">{t(option.description)}</div>
              </md-select-option>
            ))}
          </md-filled-select>
          <md-outlined-text-field
            label={t("text.questionCount")}
            type="number"
            min={1}
            max={Math.max(1, scopeSentences.length)}
            value={questionCount}
            onInput={(event) => setQuestionCount(Math.max(1, Number(valueFrom(event)) || 1))}
          />
          <div className="material-static-field">
            <span>{t("text.available")}</span>
            <strong>{scopeSentences.length}</strong>
          </div>
        </div>
      </section>

      <section className="md-card stack" aria-label={t("text.previewAria")}>
        <div>
          <h2 className="section-title">{t("text.previewTitle")}</h2>
          <p className="helper-text">{t("text.previewDescription")}</p>
        </div>
        {paragraph?.sentences.map((sentence, index) => (
          <p key={sentence.id} className="helper-text" style={{ lineHeight: 1.8 }}>
            <span className="badge badge--neutral" style={{ marginRight: 8 }}>{index + 1}</span>
            {sentence.text}
          </p>
        ))}
      </section>
      <StatusAlert message={message} tone={message === t("text.offlineMissing") ? "error" : "info"} />
    </div>
  );
}
