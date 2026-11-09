import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { clubFields } from "@/lib/clubs";
import { prisma } from "@/lib/db";

// Club library for match days (crest, color, stinger, anthem), shared by all programs.

const unauthorized = () => NextResponse.json({ error: "Não autorizado" }, { status: 401 });
const select = { id: true, name: true, short: true, color: true, crestUrl: true, vinhetaUrl: true, anthemUrl: true };

export async function GET() {
  if (!(await requireHostSession())) return unauthorized();
  const clubs = await prisma.club.findMany({ orderBy: { name: "asc" }, select });
  return NextResponse.json({ clubs });
}

// POST one club, or { clubs: [...] } to add several (e.g. a league's teams).
export async function POST(request: Request) {
  if (!(await requireHostSession())) return unauthorized();
  const body = await request.json().catch(() => null);
  const list: unknown[] = Array.isArray(body?.clubs) ? body.clubs.slice(0, 40) : [body];
  const existing = new Set((await prisma.club.findMany({ select: { name: true } })).map((c) => c.name.toLowerCase()));
  const created = [];
  for (const item of list) {
    const fields = clubFields(item);
    if (!fields.name || existing.has(fields.name.toLowerCase())) continue;
    existing.add(fields.name.toLowerCase());
    created.push(await prisma.club.create({ data: { ...fields, name: fields.name }, select }));
  }
  if (!created.length && list.length === 1) return NextResponse.json({ error: "Dê um nome (ou o clube já existe)" }, { status: 400 });
  return NextResponse.json({ clubs: created });
}

export async function PATCH(request: Request) {
  if (!(await requireHostSession())) return unauthorized();
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const found = id && (await prisma.club.findUnique({ where: { id } }));
  if (!found) return NextResponse.json({ error: "Clube não encontrado" }, { status: 404 });
  const club = await prisma.club.update({ where: { id }, data: clubFields(body), select });
  return NextResponse.json({ club });
}

export async function DELETE(request: Request) {
  if (!(await requireHostSession())) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (id) await prisma.club.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
