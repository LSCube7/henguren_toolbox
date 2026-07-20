export type MasteryLevel = "learning" | "reviewing" | "mastered";

export type MasteryRecord = {
  id: string;
  level: MasteryLevel;
  correctStreak: number;
  reviewCount: number;
  lastReviewedAt: string;
  nextReviewAt: string;
  updatedAt: string;
};

const reviewIntervals = [1, 3, 7, 14, 30];

export function nextMasteryRecord(id: string, current: MasteryRecord | undefined, correct: boolean, now = new Date()): MasteryRecord {
  const correctStreak = correct ? (current?.correctStreak ?? 0) + 1 : 0;
  const intervalDays = correct ? reviewIntervals[Math.min(correctStreak - 1, reviewIntervals.length - 1)] : 0;
  const nextReviewAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return {
    id,
    level: correctStreak >= 3 ? "mastered" : correct ? "reviewing" : "learning",
    correctStreak,
    reviewCount: (current?.reviewCount ?? 0) + 1,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: nextReviewAt.toISOString(),
    updatedAt: now.toISOString()
  };
}

export function isMasteryDue(record: MasteryRecord | undefined, now = new Date()) {
  return !record || record.nextReviewAt <= now.toISOString();
}

export function isMasteryLearning(record: MasteryRecord | undefined) {
  return !record || record.level === "learning";
}

export function masteryLabel(record: MasteryRecord | undefined) {
  if (!record) return "待学习";
  if (record.level === "mastered") return "已掌握";
  if (record.level === "reviewing") return "复习中";
  return "学习中";
}
