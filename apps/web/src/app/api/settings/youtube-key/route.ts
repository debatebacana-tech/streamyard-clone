import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const session = await requireHostSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const settings = await prisma.showSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({ hasKey: Boolean(settings?.youtubeStreamKeyCipher) });
}

export async function POST(request: Request) {
  const session = await requireHostSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const streamKey = typeof body?.streamKey === "string" ? body.streamKey.trim() : "";
  if (!streamKey) {
    return NextResponse.json({ error: "Chave de transmissão vazia" }, { status: 400 });
  }

  const youtubeStreamKeyCipher = encrypt(streamKey);
  await prisma.showSettings.upsert({
    where: { id: "default" },
    create: { id: "default", youtubeStreamKeyCipher },
    update: { youtubeStreamKeyCipher },
  });

  return NextResponse.json({ ok: true });
}
