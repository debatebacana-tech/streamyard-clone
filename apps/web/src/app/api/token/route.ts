import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { createParticipantToken, getWsUrl } from "@/lib/livekit";
import { verifyGuestInvite, verifyLayoutViewToken } from "@/lib/signedLinks";

const SHOW_ROOM = "show";

// Mints a LiveKit participant token for one of three callers:
// - the authenticated host (session cookie)
// - a guest holding a valid invite token
// - the layout-view page the Egress service loads (holding a layout-view token)
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : undefined;

  const session = await getSession();
  if (session.isHost) {
    const token = await createParticipantToken({
      room: SHOW_ROOM,
      identity: `host-${randomUUID()}`,
      name: name ?? "Host",
      role: "host",
    });
    return NextResponse.json({ token, wsUrl: getWsUrl(), room: SHOW_ROOM });
  }

  const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken : undefined;
  if (inviteToken) {
    try {
      const invite = await verifyGuestInvite(inviteToken);
      const token = await createParticipantToken({
        room: invite.room,
        identity: `guest-${randomUUID()}`,
        name: name ?? "Convidado",
        role: "guest",
      });
      return NextResponse.json({ token, wsUrl: getWsUrl(), room: invite.room });
    } catch {
      return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 401 });
    }
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

  return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
}
