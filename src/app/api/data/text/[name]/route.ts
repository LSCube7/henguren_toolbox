import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import list from "@/assets/js/text/list.json";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!list.some((item) => item.name === name)) {
    return NextResponse.json({ error: "Unknown text list." }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "src", "assets", "js", "text", `${name}.json`);
  const content = await readFile(filePath, "utf8");
  return NextResponse.json(JSON.parse(content));
}
