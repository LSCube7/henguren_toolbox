import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const expectedUser = request.headers.get("X-Sync-User");
  if (expectedUser) {
    const current = await getCurrentUser();
    if (current && current.id !== expectedUser) return NextResponse.json({ error: "TARGET_CHANGED" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
