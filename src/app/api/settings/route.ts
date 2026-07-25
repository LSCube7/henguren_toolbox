import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readJsonFromR2, settingsKey, writeJsonToR2 } from "@/lib/r2";
import { defaultSettings, normalizeToolboxSettings } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storedSettings = await readJsonFromR2<unknown>(settingsKey(user.id));
  const settings = storedSettings ? normalizeToolboxSettings(storedSettings) : null;
  if (new URL(request.url).searchParams.get("availability") === "1") {
    return NextResponse.json({ available: Boolean(settings), settings });
  }
  return NextResponse.json(settings ?? defaultSettings);
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = normalizeToolboxSettings(await request.json());
  settings.updatedAt = new Date().toISOString();
  await writeJsonToR2(settingsKey(user.id), settings);
  return NextResponse.json(settings);
}
