import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hostProgram } from "@/lib/hostProgram";
import { brandLogo, brandingOf, syncProgramRoom } from "@/lib/programs";

const HEX = /^#[0-9a-fA-F]{6}$/;

function mediaUrlOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string" && value.startsWith("/media/") && value.length <= 200) return value;
  return undefined;
}

// Updates a program's identity (name, colors, logo, background).
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const data: Record<string, string | null> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 60);
  if (typeof body.primaryColor === "string" && HEX.test(body.primaryColor)) data.primaryColor = body.primaryColor;
  if (typeof body.accentColor === "string" && HEX.test(body.accentColor)) data.accentColor = body.accentColor;
  for (const key of ["logoUrl", "backgroundUrl"] as const) {
    const value = mediaUrlOrNull(body[key]);
    if (value !== undefined) data[key] = value;
  }

  const updated = await prisma.program.update({ where: { id: program.id }, data });
  await syncProgramRoom(updated);
  return NextResponse.json({ program: brandingOf(updated, await brandLogo()) });
}
