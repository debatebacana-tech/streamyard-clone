import type { Program } from "@prisma/client";
import { prisma } from "./db";
import { withLock } from "./locks";
import { getRoomServiceClient } from "./livekit";
import { normalizeProgramConfig, type ProgramConfig } from "./programConfig";
import { chatMessages } from "./youtubeChat";
import { normalizeScene, type ProgramBranding, type ProgramFormat, type Scene, type ShowMetadata } from "./scene";

const ROOM_PREFIX = "prog-";

export function roomForProgram(slug: string): string {
  return `${ROOM_PREFIX}${slug}`;
}

export function programSlugFromRoom(room: string): string | null {
  return room.startsWith(ROOM_PREFIX) ? room.slice(ROOM_PREFIX.length) : null;
}

export function listPrograms() {
  return prisma.program.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export function getProgram(slug: string) {
  return prisma.program.findUnique({ where: { slug } });
}

const FORMATS = new Set(["debate", "futebol", "especial"]);

// The Debate Bacana signature (ShowSettings.logoUrl) is shared by every
// program; a program-specific logo overrides it.
export async function brandLogo(): Promise<string | null> {
  const settings = await prisma.showSettings.findUnique({ where: { id: "default" } });
  return settings?.logoUrl ?? null;
}

export function brandingOf(program: Program, sharedLogo: string | null = null): ProgramBranding {
  return {
    slug: program.slug,
    name: program.name,
    format: (FORMATS.has(program.format) ? program.format : "debate") as ProgramFormat,
    primaryColor: program.primaryColor,
    accentColor: program.accentColor,
    logoUrl: program.logoUrl ?? sharedLogo,
    backgroundUrl: program.backgroundUrl,
  };
}

export function configOf(program: Program): ProgramConfig {
  try {
    return normalizeProgramConfig(JSON.parse(program.configJson), program.name);
  } catch {
    return normalizeProgramConfig({}, program.name);
  }
}

function parseScene(json: string): Scene {
  try {
    return normalizeScene(JSON.parse(json));
  } catch {
    return normalizeScene({});
  }
}

export function liveSceneOf(program: Program): Scene {
  return parseScene(program.sceneJson);
}

export function draftSceneOf(program: Program): Scene {
  return parseScene(program.draftSceneJson);
}

// Quick sounds to keep preloaded on every output: the signature sounds, the
// effect pads and today's clubs' vinheta/hino.
async function quickSounds(program: Program, scene: Scene): Promise<string[]> {
  const config = configOf(program);
  const [effects, clubs] = await Promise.all([
    // Effect pads (audio) and stingers (video): one library for every program.
    prisma.asset.findMany({ where: { role: "efeito" }, select: { fileName: true } }),
    prisma.club.findMany({
      where: { name: { in: [scene.scoreboard.home.name, scene.scoreboard.away.name].filter(Boolean) } },
      select: { vinhetaUrl: true, anthemUrl: true },
    }),
  ]);
  const urls = [
    config.openingVideoUrl,
    ...config.hotSounds.map((s) => s.url),
    ...effects.map((a) => `/media/${a.fileName}`),
    ...clubs.flatMap((c) => [c.vinhetaUrl, c.anthemUrl]),
  ];
  return [...new Set(urls.filter((u): u is string => typeof u === "string" && u.startsWith("/media/")))].slice(0, 80);
}

async function metadataFor(program: Program): Promise<string> {
  const metadata: ShowMetadata = {
    program: brandingOf(program, await brandLogo()),
    scene: liveSceneOf(program),
    chat: chatMessages(program.slug).slice(-12),
    transition: configOf(program).transition,
    sounds: await quickSounds(program, liveSceneOf(program)).catch(() => []),
    looks: configOf(program).looks,
  };
  return JSON.stringify(metadata);
}

// Pushes the stored branding/on-air scene into the program's LiveKit room
// metadata, which every output renders from. Runs one at a time per program
// and always reads the latest stored state, so an older push can't overwrite a
// newer one (that made the air monitor jump back to a previous scene).
export async function syncProgramRoom(program: Program) {
  return withLock(`sync:${program.slug}`, async () => {
    const fresh = (await getProgram(program.slug)) ?? program;
    const roomService = getRoomServiceClient();
    const name = roomForProgram(fresh.slug);
    const metadata = await metadataFor(fresh);
    try {
      await roomService.updateRoomMetadata(name, metadata);
    } catch {
      // No room yet: create it with the metadata.
      await roomService.createRoom({ name, emptyTimeout: 10 * 60, metadata });
      await roomService.updateRoomMetadata(name, metadata).catch(() => {});
    }
  });
}

export async function saveScenes(program: Program, scenes: { live?: Scene; draft?: Scene }) {
  const updated = await prisma.program.update({
    where: { id: program.id },
    data: {
      ...(scenes.live && { sceneJson: JSON.stringify(scenes.live) }),
      ...(scenes.draft && { draftSceneJson: JSON.stringify(scenes.draft) }),
    },
  });
  if (scenes.live) {
    // Never let a slow LiveKit call hold the scene queue: wait at most 4 s
    // (the push keeps going in the background and the next one catches up).
    const sync = syncProgramRoom(updated).catch((err) => console.error("room sync failed", err));
    await Promise.race([sync, new Promise((resolve) => setTimeout(resolve, 4000))]);
  }
  return updated;
}
