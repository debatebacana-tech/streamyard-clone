import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: Request) {
  const hostPassword = process.env.HOST_PASSWORD;
  if (!hostPassword) {
    return NextResponse.json({ error: "HOST_PASSWORD is not configured" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || !safeEqual(password, hostPassword)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await getSession();
  session.isHost = true;
  await session.save();

  return NextResponse.json({ ok: true });
}
