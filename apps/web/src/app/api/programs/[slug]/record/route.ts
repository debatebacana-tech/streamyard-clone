import { NextResponse } from "next/server";
import { hostProgram } from "@/lib/hostProgram";
import { getLiveState } from "@/lib/live";
import { getProgram, roomForProgram, syncProgramRoom } from "@/lib/programs";
import { getRecordingState, listRecordings, startRecording, stopRecording } from "@/lib/recording";
import { signLayoutViewToken } from "@/lib/signedLinks";

type Params = { params: Promise<{ slug: string }> };
const MIN_FREE = 2 * 1024 ** 3;

// Offline recording of this program (the composed show, without going live).
export async function GET(_request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  const rec = await getRecordingState();
  return NextResponse.json({
    recording: rec.programSlug === program.slug,
    otherRecording: rec.programSlug && rec.programSlug !== program.slug ? ((await getProgram(rec.programSlug))?.name ?? rec.programSlug) : null,
    startedAt: rec.programSlug === program.slug ? rec.startedAt : null,
  });
}

export async function POST(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  // One encoder fits the 2 vCPU server: no recording during a live.
  if ((await getLiveState()).programSlug) {
    return NextResponse.json({ error: "Há uma transmissão no ar. Encerre a live para gravar." }, { status: 409 });
  }
  const rec = await getRecordingState();
  if (rec.programSlug) {
    return NextResponse.json({ error: rec.programSlug === program.slug ? "Já está gravando" : "Outro programa está gravando" }, { status: 409 });
  }
  const { freeBytes } = await listRecordings();
  if (freeBytes !== null && freeBytes < MIN_FREE) {
    return NextResponse.json({ error: "Pouco espaço no servidor (menos de 2 GB). Baixe e apague gravações antigas em Ajustes → Gravações." }, { status: 507 });
  }
  const room = roomForProgram(program.slug);
  const appUrl = process.env.PUBLIC_APP_URL ?? new URL(request.url).origin;
  const token = await signLayoutViewToken({ room, role: "layout-viewer" });
  try {
    await syncProgramRoom(program);
    const file = await startRecording(program.slug, `${appUrl}/layout-view/${room}?token=${encodeURIComponent(token)}&rec=1`);
    return NextResponse.json({ ok: true, file });
  } catch (err) {
    console.error("recording failed", err);
    return NextResponse.json({ error: `Não deu para começar a gravar: ${err instanceof Error ? err.message : err}` }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await hostProgram(params);
  if (error) return error;
  await stopRecording();
  return NextResponse.json({ ok: true });
}
