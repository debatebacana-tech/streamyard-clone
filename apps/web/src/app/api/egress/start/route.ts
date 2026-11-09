import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { startYoutubeEgress } from "@/lib/livekit";
import { signLayoutViewToken } from "@/lib/signedLinks";

const SHOW_ROOM = "show";
const DEFAULT_YOUTUBE_RTMP_BASE = "rtmp://a.rtmp.youtube.com/live2";

export async function POST(request: Request) {
  const session = await requireHostSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const settings = await prisma.showSettings.findUnique({ where: { id: "default" } });
  if (!settings?.youtubeStreamKeyCipher) {
    return NextResponse.json(
      { error: "Nenhuma chave de transmissão do YouTube configurada ainda" },
      { status: 400 },
    );
  }

  const appUrl = process.env.PUBLIC_APP_URL ?? new URL(request.url).origin;
  const rtmpBase = process.env.YOUTUBE_RTMP_BASE_URL ?? DEFAULT_YOUTUBE_RTMP_BASE;

  let streamKey: string;
  try {
    streamKey = decrypt(settings.youtubeStreamKeyCipher);
  } catch {
    return NextResponse.json({ error: "Falha ao descriptografar a chave de transmissão" }, { status: 500 });
  }

  const layoutViewToken = await signLayoutViewToken({ room: SHOW_ROOM, role: "layout-viewer" });
  const layoutUrl = `${appUrl}/layout-view/${SHOW_ROOM}?token=${encodeURIComponent(layoutViewToken)}`;
  const rtmpUrl = `${rtmpBase}/${streamKey}`;

  try {
    const egressInfo = await startYoutubeEgress({ roomName: SHOW_ROOM, layoutUrl, rtmpUrl });
    return NextResponse.json({ egressId: egressInfo.egressId });
  } catch (error) {
    console.error("Failed to start egress", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Falha ao iniciar a transmissão: ${detail}` }, { status: 502 });
  }
}
