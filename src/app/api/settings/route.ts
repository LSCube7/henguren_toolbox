import { NextResponse } from "next/server";
import { resolveRequestLocale } from "@/i18n/locale-detection";
import { getCurrentUser } from "@/lib/session";
import { readJsonFromR2, settingsKey, writeJsonToR2 } from "@/lib/r2";
import { defaultSettingsForLocale, normalizeToolboxSettings } from "@/lib/types";

function requestFallbackSettings(request: Request) {
  return defaultSettingsForLocale(resolveRequestLocale(request.headers.get("accept-language")));
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fallbackSettings = requestFallbackSettings(request);
  const storedSettings = await readJsonFromR2<unknown>(settingsKey(user.id));
  const settings = storedSettings ? normalizeToolboxSettings(storedSettings, fallbackSettings) : null;
  if (new URL(request.url).searchParams.get("availability") === "1") {
    return NextResponse.json({ available: Boolean(settings), settings });
  }
  return NextResponse.json(settings ?? fallbackSettings);
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = normalizeToolboxSettings(await request.json(), requestFallbackSettings(request));
  settings.updatedAt = new Date().toISOString();
  await writeJsonToR2(settingsKey(user.id), settings);
  return NextResponse.json(settings);
}
