import { NextResponse } from "next/server";
import type { Program } from "@prisma/client";
import { requireHostSession } from "./auth";
import { getProgram } from "./programs";

// Shared guard for /api/programs/[slug]/* routes: director session + existing program.
export async function hostProgram(
  params: Promise<{ slug: string }>,
): Promise<{ program: Program; error?: never } | { program?: never; error: NextResponse }> {
  const session = await requireHostSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  const { slug } = await params;
  const program = await getProgram(slug);
  if (!program) {
    return { error: NextResponse.json({ error: "Programa não encontrado" }, { status: 404 }) };
  }
  return { program };
}
