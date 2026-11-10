import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hostProgram } from "@/lib/hostProgram";
import { mergeProgramConfig } from "@/lib/programConfig";
import { configOf, listPrograms, syncProgramRoom } from "@/lib/programs";

// Sounds and content the team builds once and uses in every show.
const SHARED = ["hotSounds", "tweets", "looks", "alertsUrl"] as const;

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
  const updated = await prisma.program.update({ where: { id: program.id }, data: { configJson: JSON.stringify(config) } });
  // The outputs preload the transition video from the room metadata.
  if ("transition" in patch || "hotSounds" in patch || "looks" in patch || "alertsUrl" in patch) await syncProgramRoom(updated).catch((err) => console.error("config sync failed", err));
  // The highlight sounds and the lined-up tweets are the same in every program.
  const shared = SHARED.filter((k) => k in patch);
  if (shared.length) {
    for (const other of await listPrograms()) {
      if (other.id === program.id) continue;
      const next = { ...configOf(other), ...Object.fromEntries(shared.map((k) => [k, config[k]])) };
      const saved = await prisma.program.update({ where: { id: other.id }, data: { configJson: JSON.stringify(next) } });
      if (shared.includes("hotSounds") || shared.includes("looks") || shared.includes("alertsUrl")) void syncProgramRoom(saved).catch(() => {});
    }
  }
  return NextResponse.json({ config });
}
