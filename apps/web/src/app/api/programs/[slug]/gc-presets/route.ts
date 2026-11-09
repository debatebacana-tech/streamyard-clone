import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hostProgram } from "@/lib/hostProgram";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const presets = await prisma.gcPreset.findMany({ where: { programId: program.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ presets });
}

export async function POST(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!title) {
    return NextResponse.json({ error: "O GC precisa de um título" }, { status: 400 });
  }
  const subtitle = typeof body?.subtitle === "string" ? body.subtitle.trim().slice(0, 160) : "";
  const imageUrl =
    typeof body?.imageUrl === "string" && body.imageUrl.startsWith("/media/") ? body.imageUrl.slice(0, 200) : null;

  const preset = await prisma.gcPreset.create({ data: { programId: program.id, title, subtitle, imageUrl } });
  return NextResponse.json({ preset });
}

export async function DELETE(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (id) await prisma.gcPreset.deleteMany({ where: { id, programId: program.id } });
  return NextResponse.json({ ok: true });
}
