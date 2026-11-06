import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { getRoomServiceClient } from "@/lib/livekit";

const SHOW_ROOM = "show";

type ControlAction =
  | { action: "setMetadata"; metadata: Record<string, unknown> }
  | { action: "removeParticipant"; identity: string }
  | { action: "muteParticipantTrack"; identity: string; trackSid: string; muted: boolean };

// Host-only room controls used by the Studio page: update the layout/lower-third
// metadata that the layout-view page (and Egress output) reacts to, and
// moderate guests (mute/remove).
export async function POST(request: Request) {
  const session = await requireHostSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ControlAction | null;
  if (!body?.action) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const roomService = getRoomServiceClient();

  switch (body.action) {
    case "setMetadata": {
      await roomService.updateRoomMetadata(SHOW_ROOM, JSON.stringify(body.metadata));
      return NextResponse.json({ ok: true });
    }
    case "removeParticipant": {
      await roomService.removeParticipant(SHOW_ROOM, body.identity);
      return NextResponse.json({ ok: true });
    }
    case "muteParticipantTrack": {
      await roomService.mutePublishedTrack(SHOW_ROOM, body.identity, body.trackSid, body.muted);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  }
}
