import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hostProgram } from "@/lib/hostProgram";
import { mergeProgramConfig } from "@/lib/programConfig";
import { configOf } from "@/lib/programs";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  return NextResponse.json({ config: configOf(program) });
}

// Rundown settings: opening stinger, tracks and institutional screen texts.
export async function PATCH(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const patch = await request.json().catch(() => null);
  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  const config = mergeProgramConfig(configOf(program), patch, program.name);
  await prisma.program.update({ where: { id: program.id }, data: { configJson: JSON.stringify(config) } });
  return NextResponse.json({ config });
}
