import { NextResponse } from "next/server";
import { hostProgram } from "@/lib/hostProgram";
import { draftSceneOf, liveSceneOf, saveScenes } from "@/lib/programs";
import { clockElapsedMs, mergeScene, type Scene } from "@/lib/scene";

type SceneRequest =
  // Edit the preview, the air, or both (e.g. a goal should hit air immediately).
  | { action: "patch"; target: "draft" | "live" | "both"; patch: unknown }
  // Send the prepared preview to air.
  | { action: "take" }
  // Clock operations run on server time so every viewer agrees.
  | { action: "clock"; op: "start" | "pause" | "reset" | "set"; ms?: number };

function applyClock(scene: Scene, op: string, ms: number | undefined, now: number): Scene {
  const clock = scene.scoreboard.clock;
  const elapsed = clockElapsedMs(clock, now);
  const next =
    op === "start"
      ? { ...clock, running: true, baseMs: elapsed, startedAt: now }
      : op === "pause"
        ? { ...clock, running: false, baseMs: elapsed, startedAt: null }
        : op === "set"
          ? { ...clock, baseMs: Math.max(0, ms ?? 0), startedAt: clock.running ? now : null }
          : { ...clock, running: false, baseMs: 0, startedAt: null };
  return { ...scene, scoreboard: { ...scene.scoreboard, clock: next } };
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  return NextResponse.json({ live: liveSceneOf(program), draft: draftSceneOf(program) });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const body = (await request.json().catch(() => null)) as SceneRequest | null;
  let live = liveSceneOf(program);
  let draft = draftSceneOf(program);

  switch (body?.action) {
    case "patch":
      if (body.target === "draft" || body.target === "both") draft = mergeScene(draft, body.patch);
      if (body.target === "live" || body.target === "both") live = mergeScene(live, body.patch);
      break;
    case "take":
      // The clock keeps running on air; the preview's copy may be stale.
      live = { ...draft, scoreboard: { ...draft.scoreboard, clock: live.scoreboard.clock } };
      draft = live;
      break;
    case "clock": {
      const now = Date.now();
      live = applyClock(live, body.op, body.ms, now);
      draft = { ...draft, scoreboard: { ...draft.scoreboard, clock: live.scoreboard.clock } };
      break;
    }
    default:
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  await saveScenes(program, { live, draft });
  return NextResponse.json({ live, draft });
}
