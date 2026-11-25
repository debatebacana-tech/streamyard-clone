import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { createParticipantToken, getWsUrl } from "@/lib/livekit";
import { getProgram, programSlugFromRoom, roomForProgram, syncProgramRoom } from "@/lib/programs";
import { verifyGuestInvite, verifyLayoutViewToken } from "@/lib/signedLinks";

// A stable per-browser id keeps a participant's identity across reconnects,
// so being "on stage" survives a page refresh.
function identityFor(prefix: string, clientId: unknown): string {
  const id = typeof clientId === "string" && /^[a-z0-9-]{8,40}$/.test(clientId) ? clientId : randomUUID();
  return `${prefix}-${id}`;
}

async function syncRoomFor(room: string) {
  const slug = programSlugFromRoom(room);
  const program = slug ? await getProgram(slug) : null;
  if (program) await syncProgramRoom(program);
}

// Mints a LiveKit participant token for one of three callers:
// - the director (session cookie), for a given program
// - a guest holding a valid invite token
// - the layout-view page the Egress service loads (holding a layout-view token)
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : undefined;

  const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken : undefined;
  if (inviteToken) {
    let room: string;
    try {
      room = (await verifyGuestInvite(inviteToken)).room;
    } catch {
      return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 401 });
    }
    await syncRoomFor(room);
    const token = await createParticipantToken({
      room,
      identity: identityFor("guest", body?.clientId),
      name: name ?? "Convidado",
      role: "guest",
    });
    return NextResponse.json({ token, wsUrl: getWsUrl(), room });
  }

  const layoutViewToken = typeof body?.layoutViewToken === "string" ? body.layoutViewToken : undefined;
  if (layoutViewToken) {
    try {
      const layoutView = await verifyLayoutViewToken(layoutViewToken);
      const token = await createParticipantToken({
        room: layoutView.room,
        identity: `layout-viewer-${randomUUID()}`,
        name: "Layout",
        role: "layout-viewer",
      });
      return NextResponse.json({ token, wsUrl: getWsUrl(), room: layoutView.room });
    } catch {
      return NextResponse.json({ error: "Token de layout inválido ou expirado" }, { status: 401 });
    }
  }

  const session = await getSession();
  if (session.isHost) {
    const program = typeof body?.program === "string" ? await getProgram(body.program) : null;
    if (!program) {
      return NextResponse.json({ error: "Programa não encontrado" }, { status: 404 });
    }
    await syncProgramRoom(program);
    const room = roomForProgram(program.slug);
    const token = await createParticipantToken({
      room,
      identity: identityFor("host", body?.clientId),
      name: name ?? "Diretor",
      role: "host",
    });
    return NextResponse.json({ token, wsUrl: getWsUrl(), room });
  }

  return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
}
