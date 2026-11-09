import { NextResponse } from "next/server";
import { hostProgram } from "@/lib/hostProgram";
import { getRoomServiceClient } from "@/lib/livekit";
import { roomForProgram } from "@/lib/programs";

type ParticipantAction =
  | { action: "remove"; identity: string }
  | { action: "mute"; identity: string; trackSid: string }
  | { action: "rename"; identity: string; name: string };

// Guest moderation. Muting is one-way on purpose: LiveKit only lets the
// participant themselves unmute, so a guest can't be hot-mic'd remotely.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const body = (await request.json().catch(() => null)) as ParticipantAction | null;
  if (!body || typeof body.identity !== "string") {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const room = roomForProgram(program.slug);
  const roomService = getRoomServiceClient();

  switch (body.action) {
    case "remove":
      await roomService.removeParticipant(room, body.identity);
      return NextResponse.json({ ok: true });
    case "mute":
      if (typeof body.trackSid !== "string") {
        return NextResponse.json({ error: "Faixa inválida" }, { status: 400 });
      }
      await roomService.mutePublishedTrack(room, body.identity, body.trackSid, true);
      return NextResponse.json({ ok: true });
    case "rename": {
      // The name shown on the participant's window (director or guest).
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
      if (!name) return NextResponse.json({ error: "Nome vazio" }, { status: 400 });
      await roomService.updateParticipant(room, body.identity, { name });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  }
}
