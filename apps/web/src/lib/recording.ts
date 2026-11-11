import { readdir, stat, statfs, unlink } from "node:fs/promises";
import path from "node:path";
import { EgressStatus, EncodedFileOutput, EncodedFileType, EncodingOptionsPreset } from "livekit-server-sdk";
import { prisma } from "./db";
import { getEgressClient } from "./livekit";

// Offline recording of a program: the same composed page the stream shows,
// written by Egress to an MP4 in a folder shared with this app (see
// infra/docker-compose.yml), then downloaded from the director's panel.
export const RECORDINGS_DIR = process.env.RECORDINGS_DIR ?? "/recordings";
const ID = "default";

export type RecordingState = { programSlug: string | null; file: string | null; startedAt: number | null };

export async function getRecordingState(): Promise<RecordingState> {
  const s = await prisma.showSettings.findUnique({ where: { id: ID } });
  if (!s?.recordEgressId) return { programSlug: null, file: null, startedAt: null };
  const [info] = await getEgressClient().listEgress({ egressId: s.recordEgressId }).catch(() => []);
  const active =
    info && (info.status === EgressStatus.EGRESS_STARTING || info.status === EgressStatus.EGRESS_ACTIVE || info.status === EgressStatus.EGRESS_ENDING);
  if (!active) {
    await clearRecording();
    return { programSlug: null, file: null, startedAt: null };
  }
  return { programSlug: s.recordProgramSlug, file: s.recordFile, startedAt: s.recordStartedAt?.getTime() ?? null };
}

async function clearRecording() {
  await prisma.showSettings.updateMany({ where: { id: ID }, data: { recordEgressId: null, recordProgramSlug: null, recordFile: null, recordStartedAt: null } });
}

const stamp = () => new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).replace(" ", "_").replace(/:/g, "h").slice(0, 16);

export async function startRecording(slug: string, layoutUrl: string) {
  const file = `${slug}_${stamp()}.mp4`;
  const output = new EncodedFileOutput({ fileType: EncodedFileType.MP4, filepath: path.posix.join(RECORDINGS_DIR, file) });
  const info = await getEgressClient().startWebEgress(layoutUrl, output, { awaitStartSignal: false, encodingOptions: EncodingOptionsPreset.H264_720P_30 });
  const data = { recordEgressId: info.egressId, recordProgramSlug: slug, recordFile: file, recordStartedAt: new Date() };
  await prisma.showSettings.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  return file;
}

export async function stopRecording() {
  const s = await prisma.showSettings.findUnique({ where: { id: ID } });
  if (s?.recordEgressId) await getEgressClient().stopEgress(s.recordEgressId).catch(() => {});
  await clearRecording();
}

export type RecordingFile = { name: string; size: number; date: number };

const SAFE = /^[\w-]+\.mp4$/;

export async function listRecordings(): Promise<{ files: RecordingFile[]; freeBytes: number | null }> {
  const names = await readdir(RECORDINGS_DIR).catch(() => [] as string[]);
  const files: RecordingFile[] = [];
  for (const name of names.filter((n) => SAFE.test(n))) {
    const st = await stat(path.join(RECORDINGS_DIR, name)).catch(() => null);
    if (st?.isFile()) files.push({ name, size: st.size, date: st.mtimeMs });
  }
  files.sort((a, b) => b.date - a.date);
  const fs = await statfs(RECORDINGS_DIR).catch(() => null);
  return { files, freeBytes: fs ? fs.bavail * fs.bsize : null };
}

export function recordingPath(name: string): string | null {
  return SAFE.test(name) ? path.join(RECORDINGS_DIR, name) : null;
}

export async function deleteRecording(name: string) {
  const p = recordingPath(name);
  if (p) await unlink(p);
}
