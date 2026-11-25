import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { YoutubeError, createBroadcast, deleteBroadcast, listBroadcasts, oauthStatus, selectBroadcast } from "@/lib/youtubeLive";

const PRIVACY = new Set(["public", "unlisted", "private"]);

async function guard<T>(fn: () => Promise<T>) {
  if (!(await requireHostSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof YoutubeError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("youtube", err);
    return NextResponse.json({ error: "Sem resposta do YouTube, tente de novo" }, { status: 502 });
  }
}

// Scheduled and running lives on the channel, plus the one the studio goes to.
export async function GET() {
  return guard(async () => {
    const status = await oauthStatus();
    if (!status.connected) return { connected: false, broadcasts: [], activeBroadcastId: null };
    return { connected: true, channel: status.channel, broadcasts: await listBroadcasts(), activeBroadcastId: status.activeBroadcastId };
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return guard(async () => {
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 100) : "";
    if (!title) throw new YoutubeError("Dê um título para a live");
    const start = typeof body?.start === "string" ? new Date(body.start) : null;
    if (!start || Number.isNaN(start.getTime())) throw new YoutubeError("Escolha a data e a hora");
    if (start.getTime() < Date.now() - 5 * 60_000) throw new YoutubeError("A data/hora precisa ser no futuro");
    return createBroadcast({
      title,
      description: typeof body?.description === "string" ? body.description.slice(0, 4900) : "",
      start: start.toISOString(),
      privacy: PRIVACY.has(body?.privacy) ? body.privacy : "public",
      thumbnailUrl: typeof body?.thumbnailUrl === "string" && body.thumbnailUrl.startsWith("/media/") ? body.thumbnailUrl : null,
    });
  });
}

// { id }: make this live the one "Iniciar transmissão" goes to.
export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  return guard(async () => {
    if (typeof body?.id !== "string" || !/^[\w-]{6,20}$/.test(body.id)) throw new YoutubeError("Live inválida");
    await selectBroadcast(body.id);
    return { ok: true };
  });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  return guard(async () => {
    if (!/^[\w-]{6,20}$/.test(id)) throw new YoutubeError("Live inválida");
    await deleteBroadcast(id);
    return { ok: true };
  });
}
