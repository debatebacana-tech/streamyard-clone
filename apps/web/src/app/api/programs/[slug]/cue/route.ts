import { NextResponse } from "next/server";
import { DataPacket_Kind } from "livekit-server-sdk";
import { hostProgram } from "@/lib/hostProgram";
import { getRoomServiceClient } from "@/lib/livekit";
import { roomForProgram } from "@/lib/programs";

// Plays a sound pad / stinger on air from anywhere (the phone control): the
// server sends the same cue the director's panel sends over the room's
// "media" data topic, so the output and every monitor play it.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  const body = await request.json().catch(() => null);

  let cue: Record<string, unknown>;
  if (body?.type === "stop") {
    cue = { type: "stop" };
  } else if (body?.type === "play" && typeof body.url === "string" && body.url.startsWith("/media/") && body.url.length <= 200) {
    cue = {
      type: "play",
      id: crypto.randomUUID(),
      url: body.url,
      kind: body.kind === "video" ? "video" : "audio",
      volume: typeof body.volume === "number" ? Math.min(1, Math.max(0, body.volume)) : 1,
      toggle: body.toggle === true,
    };
  } else {
    return NextResponse.json({ error: "Cue inválida" }, { status: 400 });
  }

  await getRoomServiceClient().sendData(roomForProgram(program.slug), new TextEncoder().encode(JSON.stringify(cue)), DataPacket_Kind.RELIABLE, {
    topic: "media",
  });
  return NextResponse.json({ ok: true });
}
