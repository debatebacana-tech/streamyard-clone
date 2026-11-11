import { NextResponse } from "next/server";
import { hostProgram } from "@/lib/hostProgram";
import { roomForProgram } from "@/lib/programs";
import { signGuestInvite } from "@/lib/signedLinks";
import { publicOrigin } from "@/lib/origin";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const inviteToken = await signGuestInvite({ room: roomForProgram(program.slug), role: "guest" });
  const link = `${publicOrigin(request)}/join/${inviteToken}`;
  return NextResponse.json({ link });
}
