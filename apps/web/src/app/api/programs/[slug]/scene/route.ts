import { NextResponse } from "next/server";
import { hostProgram } from "@/lib/hostProgram";
import { configOf, draftSceneOf, getProgram, liveSceneOf, saveScenes } from "@/lib/programs";
import type { ProgramConfig } from "@/lib/programConfig";
import { clockElapsedMs, mergeScene, type RundownStep, type Scene } from "@/lib/scene";
import { withLock } from "@/lib/locks";

type SceneRequest =
  // Edit the preview, the air, or both (e.g. a goal should hit air immediately).
  | { action: "patch"; target: "draft" | "live" | "both"; patch: unknown }
  // Send the prepared preview to air (animated when the arrangement changes).
  | { action: "take" }
  // Apply a change to the preview and take it at once ("direto no ar" scene buttons).
  | { action: "cut"; patch: unknown }
  // Clock operations run on server time so every viewer agrees.
  | { action: "clock"; op: "start" | "pause" | "reset" | "set"; ms?: number }
  // Background track (straight to air, synced by server time).
  | { action: "music"; op: "play"; url: string; title?: string; loop?: boolean; volume?: number }
  | { action: "music"; op: "stop" }
  | { action: "music"; op: "volume"; volume: number }
  // Show rundown: institutional screen + its track, straight to air.
  | { action: "rundown"; step: RundownStep; countdownMs?: number };


function startMusic(scene: Scene, url: string | null, now: number, loop: boolean, title = ""): Scene {
  if (!url) return { ...scene, music: { ...scene.music, startedAt: null } };
  return { ...scene, music: { ...scene.music, url, title, loop, startedAt: now } };
}

function applyRundown(scene: Scene, step: RundownStep, config: ProgramConfig, now: number, countdownMs?: number): Scene {
  return { ...rundownScreen(scene, step, config, now, countdownMs), step };
}

function rundownScreen(scene: Scene, step: RundownStep, config: ProgramConfig, now: number, countdownMs?: number): Scene {
  switch (step) {
    case "espera":
      return startMusic(
        {
          ...scene,
          screen: {
            ...config.screens.espera,
            kind: "espera",
            countdownTo: countdownMs && countdownMs > 0 ? now + countdownMs : null,
            mediaUrl: config.waitingMediaUrl,
          },
        },
        config.waitingTrackUrl,
        now,
        true,
        "Trilha de espera",
      );
    case "abertura": {
      // The opening stinger itself is cued by the director's client. Without
      // an opening track, whatever track is playing keeps playing.
      const shown = { ...scene, screen: { ...scene.screen, kind: "none" as const } };
      return config.openingTrackUrl ? startMusic(shown, config.openingTrackUrl, now, false, "Trilha de abertura") : shown;
    }
    case "aovivo":
      // The track keeps playing into the program (stop it in DESTAQUES).
      return { ...scene, screen: { ...scene.screen, kind: "none" } };
    case "intervalo":
      return startMusic(
        { ...scene, screen: { ...config.screens.intervalo, kind: "intervalo", countdownTo: null, mediaUrl: config.breakMediaUrl } },
        config.breakTrackUrl,
        now,
        true,
        "Trilha de intervalo",
      );
    case "encerramento":
      return startMusic(
        { ...scene, screen: { ...config.screens.encerramento, kind: "encerramento", countdownTo: null, mediaUrl: config.closingMediaUrl } },
        config.closingTrackUrl,
        now,
        false,
        "Trilha de encerramento",
      );
  }
}

// Air-only parts (music, screen, clock) are mirrored into the preview so a
// later "take" doesn't undo them.
function withAirState(draft: Scene, live: Scene): Scene {
  return { ...draft, music: live.music, screen: live.screen, step: live.step, scoreboard: { ...draft.scoreboard, clock: live.scoreboard.clock } };
}

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

// Whether a take changes what's on screen enough to deserve the transition
// (a new GC or score alone just appears).
function arrangementChanged(a: Scene, b: Scene): boolean {
  return (
    a.layout !== b.layout ||
    a.stageMode !== b.stageMode ||
    a.featured !== b.featured ||
    a.featuredSide !== b.featuredSide ||
    (a.layout === "custom" && JSON.stringify(a.custom) !== JSON.stringify(b.custom)) ||
    a.chat.visible !== b.chat.visible ||
    a.board.kind !== b.board.kind ||
    a.web.visible !== b.web.visible ||
    a.tierList.visible !== b.tierList.visible ||
    a.tierList.mode !== b.tierList.mode ||
    (a.stageMode === "manual" && a.onStage.join() !== b.onStage.join())
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Take with the program's transition: the outputs start the animation at
// transitionAt and the scene swaps underneath it at the cut point.
async function take(slug: string, patch?: unknown) {
  let program = await getProgram(slug);
  if (!program) return null;
  let live = liveSceneOf(program);
  let draft = draftSceneOf(program);
  if (patch !== undefined) draft = mergeScene(draft, patch);
  const config = configOf(program);
  const transition = config.transition;
  // CORTAR during the abertura also ends it: the vinheta leaves under the
  // animation and the show goes to the program (like "Cortar para o programa").
  const endsOpening = live.step === "abertura";
  if (transition.enabled && (endsOpening || arrangementChanged(draft, live))) {
    const at = Date.now();
    await saveScenes(program, { live: { ...live, transitionAt: at }, draft });
    await sleep(transition.cutMs);
    program = (await getProgram(slug)) ?? program;
    live = liveSceneOf(program);
    draft = draftSceneOf(program);
  }
  // Clock, track and screen keep running on air; the preview's copy may be stale.
  live = { ...withAirState(draft, live), transitionAt: live.transitionAt };
  if (endsOpening && live.step === "abertura") live = applyRundown(live, "aovivo", config, Date.now());
  await saveScenes(program, { live, draft: live });
  return { live, draft: live };
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  return NextResponse.json({ live: liveSceneOf(program), draft: draftSceneOf(program) });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { program: found, error } = await hostProgram(params);
  if (error) return error;
  const body = (await request.json().catch(() => null)) as SceneRequest | null;
  // Changes to a program's scenes apply one at a time, each on the latest
  // stored state (a take never cuts a stale preview, a goal never undoes a cut).
  return withLock(`scene:${found.slug}`, async () => {
    const program = (await getProgram(found.slug)) ?? found;
    return applyRequest(program, body);
  });
}

async function applyRequest(program: NonNullable<Awaited<ReturnType<typeof getProgram>>>, body: SceneRequest | null) {
  // Rundown steps (pré-live, abertura, programa...) also go through the
  // transition so the screen never jumps; an opening stinger video covers the
  // abertura by itself.
  if (body?.action === "rundown") {
    const config = configOf(program);
    const before = liveSceneOf(program);
    const covered = body.step === "abertura" && Boolean(config.openingVideoUrl);
    let current = program;
    if (config.transition.enabled && !covered) {
      await saveScenes(program, { live: { ...before, transitionAt: Date.now() } });
      await sleep(config.transition.cutMs);
      current = (await getProgram(program.slug)) ?? program;
    } else if (covered) {
      // Let the opening video (cued by the director) cover the screen first.
      await sleep(350);
    }
    const airNow = liveSceneOf(current);
    const live = mergeScene(applyRundown(airNow, body.step, config, Date.now(), body.countdownMs), {});
    const draft = withAirState(draftSceneOf(current), live);
    await saveScenes(current, { live, draft });
    return NextResponse.json({ live, draft });
  }

  if (body?.action === "take" || body?.action === "cut") {
    return NextResponse.json(await take(program.slug, body.action === "cut" ? body.patch : undefined));
  }
  let live = liveSceneOf(program);
  let draft = draftSceneOf(program);

  switch (body?.action) {
    case "patch":
      if (body.target === "draft" || body.target === "both") draft = mergeScene(draft, body.patch);
      if (body.target === "live" || body.target === "both") live = mergeScene(live, body.patch);
      break;
    case "clock":
      live = applyClock(live, body.op, body.ms, Date.now());
      draft = withAirState(draft, live);
      break;
    case "music": {
      const now = Date.now();
      if (body.op === "play") {
        // mergeScene validates the URL (only /media uploads play).
        const started = startMusic(live, body.url, now, body.loop ?? true, body.title ?? "");
        live = mergeScene(started, { music: { volume: body.volume ?? live.music.volume } });
      } else if (body.op === "stop") {
        live = { ...live, music: { ...live.music, startedAt: null } };
      } else {
        live = mergeScene(live, { music: { volume: body.volume } });
      }
      draft = withAirState(draft, live);
      break;
    }
    default:
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  await saveScenes(program, { live, draft });
  return NextResponse.json({ live, draft });
}
