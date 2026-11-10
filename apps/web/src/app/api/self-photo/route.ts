import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ALLOWED_TYPES, UPLOAD_DIR } from "@/lib/assets";
import { mergeProgramConfig } from "@/lib/programConfig";
import { configOf, getProgram, listPrograms, programSlugFromRoom, syncProgramRoom } from "@/lib/programs";
import { NEUTRAL_LOOK, personKey } from "@/lib/scene";
import { verifyGuestInvite } from "@/lib/signedLinks";

// Each person sends their own photo for when their camera is off (e.g. their
// caricature): guests with their invite link, the director with their login.
// Saved by name for every program.
const MAX_PHOTO = 8 * 1024 * 1024;

async function who(inviteToken: unknown, slug: unknown) {
  if (typeof inviteToken === "string" && inviteToken) {
    const invite = await verifyGuestInvite(inviteToken).catch(() => null);
    const s = invite ? programSlugFromRoom(invite.room) : null;
    return s ? getProgram(s) : null;
  }
  const session = await getSession();
  if (!session.isHost || typeof slug !== "string") return null;
  return getProgram(slug);
}

async function setPhoto(key: string, photo: string | null) {
  for (const program of await listPrograms()) {
    const current = configOf(program);
    const looks = { ...current.looks, [key]: { ...(current.looks[key] ?? NEUTRAL_LOOK), photo } };
    const config = mergeProgramConfig(current, { looks }, program.name);
    const saved = await prisma.program.update({ where: { id: program.id }, data: { configJson: JSON.stringify(config) } });
    void syncProgramRoom(saved).catch(() => {});
  }
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const program = await who(q.get("inviteToken"), q.get("slug"));
  const key = personKey(q.get("name") ?? "");
  if (!program || !key) return NextResponse.json({ photo: null });
  return NextResponse.json({ photo: configOf(program).looks[key]?.photo ?? null });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const program = await who(form?.get("inviteToken"), form?.get("slug"));
  if (!program) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 401 });
  const key = personKey(String(form?.get("name") ?? ""));
  if (!key) return NextResponse.json({ error: "Entre com o seu nome primeiro" }, { status: 400 });
  const file = form?.get("file");
  if (!(file instanceof File)) {
    await setPhoto(key, null);
    return NextResponse.json({ photo: null });
  }
  const type = ALLOWED_TYPES[file.type];
  if (!type || type.kind !== "image") return NextResponse.json({ error: "Envie uma imagem (PNG, JPG ou WEBP)" }, { status: 415 });
  if (file.size > MAX_PHOTO) return NextResponse.json({ error: "Imagem maior que 8 MB" }, { status: 413 });
  const fileName = `${randomBytes(12).toString("hex")}.${type.ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, fileName), Buffer.from(await file.arrayBuffer()));
  await prisma.asset.create({
    data: { programId: program.id, kind: "image", role: "", name: `Foto de ${String(form?.get("name")).slice(0, 60)}`, fileName, mimeType: file.type, size: file.size },
  });
  const photo = `/media/${fileName}`;
  await setPhoto(key, photo);
  return NextResponse.json({ photo });
}
