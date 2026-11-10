import { NextResponse } from "next/server";
import { connection } from "next/server";

// Changes on every deploy (the server restarts), so the stream renderer can
// notice a new version and swap to it without stopping the live.
const g = globalThis as unknown as { __serverStartedAt?: number };
const startedAt = (g.__serverStartedAt ??= Date.now());

export async function GET() {
  await connection();
  return NextResponse.json({ version: String(startedAt) }, { headers: { "Cache-Control": "no-store" } });
}
