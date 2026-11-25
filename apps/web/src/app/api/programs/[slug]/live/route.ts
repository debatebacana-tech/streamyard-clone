import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { hostProgram } from "@/lib/hostProgram";
import { clearLive, getLiveState, markLive } from "@/lib/live";
import { liveViewers } from "@/lib/youtubeChat";
import { getRecordingState } from "@/lib/recording";
import { startYoutubeEgress, stopEgress } from "@/lib/livekit";
import { getProgram, roomForProgram, syncProgramRoom } from "@/lib/programs";
import { signLayoutViewToken } from "@/lib/signedLinks";

const DEFAULT_YOUTUBE_RTMP_BASE = "rtmp://a.rtmp.youtube.com/live2";

type Params = { params: Promise<{ slug: string }> };

async function otherLiveName(liveSlug: string | null, slug: string) {
  if (!liveSlug || liveSlug === slug) return null;
  return (await getProgram(liveSlug))?.name ?? liveSlug;
}

export async function GET(_request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const live = await getLiveState();
  const here = live.programSlug === program.slug;
  return NextResponse.json({
    live: here,
    otherLive: await otherLiveName(live.programSlug, program.slug),
    lastError: live.lastError,
    startedAt: here ? live.startedAt : null,
    viewers: here ? await liveViewers().catch(() => null) : null,
  });
}

export async function POST(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const live = await getLiveState();
  const other = await otherLiveName(live.programSlug, program.slug);
  if (other) {
    return NextResponse.json({ error: `${other} já está no ar. Encerre antes de iniciar outro programa.` }, { status: 409 });
  }
  if (live.programSlug === program.slug) {
    return NextResponse.json({ ok: true });
  }
  if ((await getRecordingState()).programSlug) {
    return NextResponse.json({ error: "Há uma gravação em andamento. Pare a gravação para ir ao vivo." }, { status: 409 });
  }

  const settings = await prisma.showSettings.findUnique({ where: { id: "default" } });
  if (!settings?.youtubeStreamKeyCipher) {
    return NextResponse.json({ error: "Nenhuma chave de transmissão do YouTube configurada ainda" }, { status: 400 });
  }

  let streamKey: string;
  try {
    streamKey = decrypt(settings.youtubeStreamKeyCipher);
  } catch {
    return NextResponse.json({ error: "Falha ao descriptografar a chave de transmissão" }, { status: 500 });
  }

  const room = roomForProgram(program.slug);
  const appUrl = process.env.PUBLIC_APP_URL ?? new URL(request.url).origin;
  const rtmpBase = process.env.YOUTUBE_RTMP_BASE_URL ?? DEFAULT_YOUTUBE_RTMP_BASE;
  const layoutViewToken = await signLayoutViewToken({ room, role: "layout-viewer" });
  const layoutUrl = `${appUrl}/layout-view/${room}?token=${encodeURIComponent(layoutViewToken)}`;

  try {
    await syncProgramRoom(program);
    const egressInfo = await startYoutubeEgress({ layoutUrl, rtmpUrl: `${rtmpBase}/${streamKey}` });
    await markLive(program.slug, egressInfo.egressId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to start egress", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Falha ao iniciar a transmissão: ${detail}` }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const live = await getLiveState();
  if (live.programSlug !== program.slug || !live.egressId) {
    return NextResponse.json({ ok: true });
  }

  try {
    await stopEgress(live.egressId);
  } catch (err) {
    console.error("Failed to stop egress", err);
    return NextResponse.json({ error: "Falha ao encerrar a transmissão" }, { status: 502 });
  }
  await clearLive();
  return NextResponse.json({ ok: true });
}
