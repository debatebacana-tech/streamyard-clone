import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";

const unauthorized = () => NextResponse.json({ error: "Não autorizado" }, { status: 401 });

export async function GET() {
  if (!(await requireHostSession())) return unauthorized();
  const settings = await prisma.showSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({ hasKey: Boolean(settings?.youtubeApiKeyCipher) });
}

// YouTube Data API key used to read the live chat (stored encrypted).
export async function POST(request: Request) {
  if (!(await requireHostSession())) return unauthorized();
  const body = await request.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!/^[\w-]{20,100}$/.test(apiKey)) {
    return NextResponse.json({ error: "Chave inválida (ela começa com AIza...)" }, { status: 400 });
  }
  const youtubeApiKeyCipher = encrypt(apiKey);
  await prisma.showSettings.upsert({
    where: { id: "default" },
    create: { id: "default", youtubeApiKeyCipher },
    update: { youtubeApiKeyCipher },
  });
  return NextResponse.json({ ok: true });
}
