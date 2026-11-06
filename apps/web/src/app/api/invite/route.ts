import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { signGuestInvite } from "@/lib/signedLinks";

const SHOW_ROOM = "show";

export async function POST(request: Request) {
  const session = await requireHostSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const inviteToken = await signGuestInvite({ room: SHOW_ROOM, role: "guest" });
  const origin = new URL(request.url).origin;
  const link = `${origin}/join/${inviteToken}`;

  return NextResponse.json({ link, inviteToken });
}
