import type { VocabWord } from "./types";

export type QuizResult = {
  correct: boolean;
  slip: boolean;
  message: string;
};

export type EvaluateAnswerOptions = {
  enableSlipDetection: boolean;
  allowMissingFirstLetter?: boolean;
};

export function shuffleWords(words: VocabWord[]) {
  return words
    .map((word) => ({ word, score: Math.random() }))
    .sort((a, b) => a.score - b.score)
    .map((item) => item.word);
}

export function pickWords(words: VocabWord[], mode: "all" | "custom", count: number) {
  const shuffled = shuffleWords(words);
  return mode === "custom" ? shuffled.slice(0, Math.min(Math.max(count, 1), shuffled.length)) : shuffled;
}

export function levenshtein(a: string, b: string) {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[left.length][right.length];
}

export function evaluateAnswer(answer: string, word: string, options: EvaluateAnswerOptions): QuizResult {
  const normalizedAnswer = answer.trim().toLowerCase();
  const normalizedWord = word.trim().toLowerCase();
  const answerWithoutFirstLetter = Array.from(normalizedWord).slice(1).join("");
  const acceptedAnswers = [
    normalizedWord,
    ...(options.allowMissingFirstLetter && answerWithoutFirstLetter ? [answerWithoutFirstLetter] : [])
  ];
  if (acceptedAnswers.includes(normalizedAnswer)) {
    return { correct: true, slip: false, message: "正确" };
  }
  if (options.enableSlipDetection && normalizedAnswer && acceptedAnswers.some((acceptedAnswer) => levenshtein(normalizedAnswer, acceptedAnswer) <= 1)) {
    return { correct: true, slip: true, message: `疑似手滑，已暂按正确处理：${word}` };
  }
  return { correct: false, slip: false, message: `错误，答案是 ${word}` };
}
