export type TextSentence = {
  id: string;
  text: string;
};

export type ClozeDifficulty = "easy" | "standard" | "hard";

export type ClozePart =
  | { type: "text"; value: string }
  | { type: "blank"; id: string; answer: string };

export type ClozeQuestion = {
  sentenceId: string;
  original: string;
  parts: ClozePart[];
};

export type ClozeQuestionResult = {
  question: ClozeQuestion;
  correctCount: number;
  total: number;
  correct: boolean;
  blanks: Array<{ id: string; answer: string; submitted: string; correct: boolean }>;
};

const commonWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "because",
  "been",
  "before",
  "being",
  "between",
  "but",
  "can",
  "could",
  "did",
  "does",
  "doing",
  "for",
  "from",
  "had",
  "has",
  "have",
  "her",
  "here",
  "him",
  "his",
  "how",
  "into",
  "its",
  "just",
  "may",
  "more",
  "most",
  "not",
  "now",
  "our",
  "out",
  "over",
  "she",
  "should",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "too",
  "under",
  "very",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your"
]);

const difficultyRules: Record<ClozeDifficulty, { ratio: number; maxBlanks: number; minLength: number }> = {
  easy: { ratio: 0.12, maxBlanks: 2, minLength: 6 },
  standard: { ratio: 0.2, maxBlanks: 4, minLength: 4 },
  hard: { ratio: 0.3, maxBlanks: 6, minLength: 3 }
};

function normalizeAnswer(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replaceAll("’", "'");
}

function shuffled<T>(values: T[], random: () => number) {
  return values
    .map((value) => ({ value, score: random() }))
    .sort((left, right) => left.score - right.score)
    .map(({ value }) => value);
}

export function createClozeQuestion(sentence: TextSentence, difficulty: ClozeDifficulty, random: () => number = Math.random): ClozeQuestion | null {
  const rule = difficultyRules[difficulty];
  const matches = Array.from(sentence.text.matchAll(/\p{L}+(?:['’]\p{L}+)*/gu)).map((match, tokenIndex) => ({
    answer: match[0],
    start: match.index,
    end: match.index + match[0].length,
    tokenIndex
  }));
  if (matches.length === 0) return null;

  const preferred = matches.filter((match) => match.answer.length >= rule.minLength && !commonWords.has(normalizeAnswer(match.answer)));
  const candidates = preferred.length > 0 ? preferred : matches.filter((match) => match.answer.length >= 3);
  if (candidates.length === 0) return null;

  const targetCount = Math.min(rule.maxBlanks, candidates.length, Math.max(1, Math.round(matches.length * rule.ratio)));
  const randomizedCandidates = shuffled(candidates, random);
  const selected: typeof candidates = [];
  randomizedCandidates.forEach((candidate) => {
    if (selected.length < targetCount && selected.every((value) => Math.abs(value.tokenIndex - candidate.tokenIndex) > 1)) {
      selected.push(candidate);
    }
  });

  if (selected.length < targetCount) {
    randomizedCandidates.forEach((candidate) => {
      if (selected.length < targetCount && !selected.includes(candidate)) selected.push(candidate);
    });
  }

  selected.sort((left, right) => left.start - right.start);
  const parts: ClozePart[] = [];
  let cursor = 0;
  selected.forEach((blank, index) => {
    if (blank.start > cursor) parts.push({ type: "text", value: sentence.text.slice(cursor, blank.start) });
    parts.push({ type: "blank", id: `blank-${index + 1}`, answer: blank.answer });
    cursor = blank.end;
  });
  if (cursor < sentence.text.length) parts.push({ type: "text", value: sentence.text.slice(cursor) });

  return { sentenceId: sentence.id, original: sentence.text, parts };
}

export function createClozeQuiz(
  sentences: TextSentence[],
  count: number,
  difficulty: ClozeDifficulty,
  random: () => number = Math.random
) {
  const questions: ClozeQuestion[] = [];
  for (const sentence of shuffled(sentences, random)) {
    const question = createClozeQuestion(sentence, difficulty, random);
    if (question) questions.push(question);
    if (questions.length >= Math.max(1, count)) break;
  }
  return questions;
}

export function evaluateClozeQuestion(question: ClozeQuestion, answers: Record<string, string>): ClozeQuestionResult {
  const blanks = question.parts
    .filter((part): part is Extract<ClozePart, { type: "blank" }> => part.type === "blank")
    .map((part) => {
      const submitted = answers[part.id] ?? "";
      return {
        id: part.id,
        answer: part.answer,
        submitted,
        correct: normalizeAnswer(submitted) === normalizeAnswer(part.answer)
      };
    });
  const correctCount = blanks.filter((blank) => blank.correct).length;
  return {
    question,
    correctCount,
    total: blanks.length,
    correct: correctCount === blanks.length,
    blanks
  };
}
