import type { VocabWord } from "./types";

export type VocabListMeta = {
  name: string;
  title: string;
};

export function getBookCode(unitName: string) {
  return unitName.slice(0, -2);
}

export function getBookTitle(bookCode: string) {
  const bookMap: Record<string, string> = {
    R1: "必修一",
    R2: "必修二",
    R3: "必修三",
    O1: "选必一",
    O2: "选必二",
    O3: "选必三",
    O4: "选必四"
  };
  return bookMap[bookCode] ?? bookCode;
}

export async function loadVocabList(meta: VocabListMeta): Promise<VocabWord[]> {
  const response = await fetch(`/api/data/vocab/${meta.name}`);
  if (!response.ok) throw new Error(`Failed to load ${meta.name}`);
  const data = (await response.json()) as { vocabulary?: VocabWord[] };
  return (data.vocabulary ?? []).map((word) => ({
    ...word,
    sourceName: meta.name,
    sourceTitle: meta.title
  }));
}
