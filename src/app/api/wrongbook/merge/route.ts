import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readJsonFromR2, writeJsonToR2, wrongBookBackupKey, wrongBookKey } from "@/lib/r2";
import { mergeWrongBooks, normalizeWrongBook } from "@/lib/wrongbook";
import type { WrongBookSnapshot } from "@/lib/types";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<WrongBookSnapshot>;
  const cloud = await readJsonFromR2<WrongBookSnapshot>(wrongBookKey(user.id));
  const local = normalizeWrongBook(body, user.id);
  const merged = mergeWrongBooks(user.id, cloud, local);

  await writeJsonToR2(wrongBookKey(user.id), merged);
  await writeJsonToR2(wrongBookBackupKey(user.id, merged.updatedAt.replaceAll(":", "-")), merged);

  return NextResponse.json(merged);
}
