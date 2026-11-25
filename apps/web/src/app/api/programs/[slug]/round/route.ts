import { NextResponse } from "next/server";
import { hostProgram } from "@/lib/hostProgram";
import { liveRoundStatus, startLiveRound, stopLiveRound, testGoalAlert } from "@/lib/liveRound";
import { configOf, getProgram, listPrograms, syncProgramRoom } from "@/lib/programs";

type Params = { params: Promise<{ slug: string }> };

// Live round (scores, live table, goal alerts): followed by the server while on.
async function pushToRoom(slug: string) {
  const program = await getProgram(slug);
  if (program) await syncProgramRoom(program).catch((err) => console.error("round sync failed", err));
}

const GOL = /gol/i;

// The program's "Gol Bacana" quick sound, or the first program that has one.
async function goalSound(slug: string): Promise<string | null> {
  const programs = await listPrograms();
  const own = programs.find((p) => p.slug === slug);
  for (const p of own ? [own, ...programs.filter((x) => x !== own)] : programs) {
    const sounds = configOf(p).hotSounds.filter((s) => s.url);
    const hit = sounds.find((s) => s.id === "gol-bacana") ?? sounds.find((s) => GOL.test(s.label));
    if (hit?.url) return hit.url;
  }
  return null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(_request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  return NextResponse.json({ status: liveRoundStatus(program.slug) });
}

export async function POST(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  const body = await request.json().catch(() => null);

  if (body?.action === "start") {
    const { competition, from, to } = body as { competition?: unknown; from?: unknown; to?: unknown };
    if (typeof competition !== "string" || typeof from !== "string" || typeof to !== "string" || !DAY.test(from) || !DAY.test(to)) {
      return NextResponse.json({ error: "Escolha a competição e as datas da rodada" }, { status: 400 });
    }
    try {
      const status = startLiveRound(program.slug, { competition, from, to, sound: await goalSound(program.slug) }, (slug) => void pushToRoom(slug));
      return NextResponse.json({ status });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Falha" }, { status: 400 });
    }
  }
  if (body?.action === "stop") {
    stopLiveRound(program.slug);
    return NextResponse.json({ status: liveRoundStatus(program.slug) });
  }
  if (body?.action === "test") {
    if (!testGoalAlert(program.slug)) return NextResponse.json({ error: "Ligue a rodada ao vivo e espere os jogos carregarem" }, { status: 409 });
    return NextResponse.json({ status: liveRoundStatus(program.slug) });
  }
  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
