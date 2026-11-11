import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { mkdir, rename, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, UPLOAD_DIR, mediaUrl } from "@/lib/assets";
import { prisma } from "@/lib/db";
import { hostProgram } from "@/lib/hostProgram";
import { syncProgramRoom } from "@/lib/programs";
import { normalizeVideo } from "@/lib/video";

type Params = { params: Promise<{ slug: string }> };

function present(asset: { id: string; kind: string; role: string; name: string; fileName: string; size: number }) {
  return { id: asset.id, kind: asset.kind, role: asset.role, name: asset.name, url: mediaUrl(asset.fileName), size: asset.size };
}

const ROLES = new Set(["trilha", "efeito", "arte", "midia", "clube"]);

export async function GET(_request: Request, { params }: Params) {
  const { error } = await hostProgram(params);
  if (error) return error;

  const assets = await prisma.asset.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ assets: assets.map(present) });
}

export async function POST(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  const type = ALLOWED_TYPES[file.type];
  if (!type) {
    return NextResponse.json(
      { error: "Formato não suportado. Use PNG, JPG, WEBP, GIF, MP3, WAV, OGG, M4A, MP4 ou WEBM." },
      { status: 415 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 150 MB" }, { status: 413 });
  }

  const id = randomBytes(12).toString("hex");
  let fileName = `${id}.${type.ext}`;
  let mimeType = file.type;
  let size = file.size;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const saved = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, fileName);
  await writeFile(saved, Buffer.from(await file.arrayBuffer()));

  // MP4/MOV (e.g. iPhone HEVC) become H.264 MP4 that every browser and the
  // stream can play; WEBM stays as sent (keeps transparency for stingers).
  if (type.kind === "video" && type.ext !== "webm") {
    const converted = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, `${id}.mp4`);
    const target = converted === saved ? `${converted}.conv` : converted;
    if (await normalizeVideo(saved, target)) {
      if (target !== converted) await rename(target, converted);
      else await unlink(saved).catch(() => {});
      fileName = `${id}.mp4`;
      mimeType = "video/mp4";
      size = (await stat(converted)).size;
    }
  }

  const rawName = form?.get("name");
  const name = (typeof rawName === "string" && rawName.trim() ? rawName : file.name).trim().slice(0, 80);
  const rawRole = form?.get("role");
  const role = typeof rawRole === "string" && ROLES.has(rawRole) ? rawRole : type.kind === "image" ? "" : "efeito";
  const asset = await prisma.asset.create({
    data: { programId: program.id, kind: type.kind, role, name, fileName, mimeType, size },
  });
  // New effect pads get preloaded on every output.
  if (asset.role === "efeito") await syncProgramRoom(program).catch(() => {});
  return NextResponse.json({ asset: present(asset) });
}

export async function DELETE(request: Request, { params }: Params) {
  const { error } = await hostProgram(params);
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  const asset = id ? await prisma.asset.findFirst({ where: { id } }) : null;
  if (!asset) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
  await prisma.asset.delete({ where: { id: asset.id } });
  await unlink(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, asset.fileName)).catch(() => {});
  return NextResponse.json({ ok: true });
}
