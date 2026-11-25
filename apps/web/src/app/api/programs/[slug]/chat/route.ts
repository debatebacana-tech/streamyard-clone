import { NextResponse } from "next/server";
import { hostProgram } from "@/lib/hostProgram";
import { getProgram, syncProgramRoom } from "@/lib/programs";
import { chatMessages, chatStatus, startChat, stopChat } from "@/lib/youtubeChat";

type Params = { params: Promise<{ slug: string }> };

// New messages refresh the room metadata, which carries the on-air chat panel.
async function pushToRoom(slug: string) {
  const program = await getProgram(slug);
  if (program) await syncProgramRoom(program).catch((err) => console.error("chat sync failed", err));
}

export async function GET(_request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  const status = chatStatus();
  return NextResponse.json({
    status: { ...status, here: status.slug === program.slug },
    messages: chatMessages(program.slug),
  });
}

export async function POST(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  const body = await request.json().catch(() => null);

  if (body?.action === "start" && typeof body.url === "string") {
    const status = await startChat(program.slug, body.url, (slug) => void pushToRoom(slug));
    return NextResponse.json({ status: { ...status, here: true }, messages: chatMessages(program.slug) });
  }
  if (body?.action === "stop") {
    stopChat();
    await pushToRoom(program.slug);
    return NextResponse.json({ status: { ...chatStatus(), here: true }, messages: [] });
  }
  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
