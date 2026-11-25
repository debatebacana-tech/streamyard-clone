import { NextResponse, connection } from "next/server";
import { getLiveState } from "@/lib/live";

// Public yes/no: is a program streaming now? Read by the server's own update
// build, which waits for the live to end before building.
export async function GET() {
  await connection();
  const live = await getLiveState().catch(() => null);
  return NextResponse.json({ live: Boolean(live?.programSlug) }, { headers: { "Cache-Control": "no-store" } });
}
