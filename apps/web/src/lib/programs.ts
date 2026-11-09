import type { Program } from "@prisma/client";
import { prisma } from "./db";
import { getRoomServiceClient } from "./livekit";
import { normalizeScene, type ProgramBranding, type Scene, type ShowMetadata } from "./scene";

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

export function brandingOf(program: Program): ProgramBranding {
  return {
    slug: program.slug,
    name: program.name,
    primaryColor: program.primaryColor,
    accentColor: program.accentColor,
    logoUrl: program.logoUrl,
    backgroundUrl: program.backgroundUrl,
  };
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

function metadataFor(program: Program): string {
  const metadata: ShowMetadata = { program: brandingOf(program), scene: liveSceneOf(program) };
  return JSON.stringify(metadata);
}

// Creates the program's LiveKit room if needed and pushes the stored
// branding/on-air scene into its metadata, which the composition renders from.
export async function syncProgramRoom(program: Program) {
  const roomService = getRoomServiceClient();
  const name = roomForProgram(program.slug);
  const metadata = metadataFor(program);
  await roomService.createRoom({ name, emptyTimeout: 10 * 60, metadata });
  await roomService.updateRoomMetadata(name, metadata);
}

export async function saveScenes(program: Program, scenes: { live?: Scene; draft?: Scene }) {
  const updated = await prisma.program.update({
    where: { id: program.id },
    data: {
      ...(scenes.live && { sceneJson: JSON.stringify(scenes.live) }),
      ...(scenes.draft && { draftSceneJson: JSON.stringify(scenes.draft) }),
    },
  });
  if (scenes.live) await syncProgramRoom(updated);
  return updated;
}
