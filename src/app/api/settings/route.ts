import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { readJsonFromR2, settingsKey, writeJsonToR2 } from "@/lib/r2";
import { defaultSettings, type ToolboxSettings } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await readJsonFromR2<ToolboxSettings>(settingsKey(user.id));
  return NextResponse.json(settings ?? defaultSettings);
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<ToolboxSettings>;
  const settings: ToolboxSettings = {
    ...defaultSettings,
    ...body,
    schemaVersion: 1,
    updatedAt: new Date().toISOString()
  };
  await writeJsonToR2(settingsKey(user.id), settings);
  return NextResponse.json(settings);
}
