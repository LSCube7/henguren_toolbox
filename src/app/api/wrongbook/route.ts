import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readJsonFromR2, writeJsonToR2, wrongBookBackupKey, wrongBookKey } from "@/lib/r2";
import { emptyWrongBook, normalizeWrongBook } from "@/lib/wrongbook";
import type { WrongBookSnapshot } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await readJsonFromR2<WrongBookSnapshot>(wrongBookKey(user.id));
  return NextResponse.json(snapshot ?? emptyWrongBook(user.id));
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<WrongBookSnapshot>;
  const snapshot = normalizeWrongBook({ ...body, updatedAt: new Date().toISOString() }, user.id);
  await writeJsonToR2(wrongBookKey(user.id), snapshot);
  await writeJsonToR2(wrongBookBackupKey(user.id, snapshot.updatedAt.replaceAll(":", "-")), snapshot);

  return NextResponse.json(snapshot);
}
