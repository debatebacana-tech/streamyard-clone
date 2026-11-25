import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeTheme } from "@/lib/scene";

const unauthorized = () => NextResponse.json({ error: "Não autorizado" }, { status: 401 });

function present(row: { id: string; label: string; themeJson: string }) {
  let theme;
  try {
    theme = normalizeTheme(JSON.parse(row.themeJson));
  } catch {
    theme = normalizeTheme({});
  }
  return { id: row.id, label: row.label, theme };
}

export async function GET() {
  if (!(await requireHostSession())) return unauthorized();
  const rows = await prisma.savedTheme.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ themes: rows.map(present) });
}

export async function POST(request: Request) {
  if (!(await requireHostSession())) return unauthorized();
  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 40) : "";
  if (!label) return NextResponse.json({ error: "Dê um nome ao tema" }, { status: 400 });

  const row = await prisma.savedTheme.create({
    data: { label, themeJson: JSON.stringify(normalizeTheme(body?.theme)) },
  });
  return NextResponse.json({ theme: present(row) });
}

export async function DELETE(request: Request) {
  if (!(await requireHostSession())) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (id) await prisma.savedTheme.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
