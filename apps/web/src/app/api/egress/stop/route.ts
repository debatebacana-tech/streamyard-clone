import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { listActiveEgress, stopEgress } from "@/lib/livekit";

const SHOW_ROOM = "show";

export async function POST(request: Request) {
  const session = await requireHostSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  let egressId = typeof body?.egressId === "string" ? body.egressId : undefined;

  if (!egressId) {
    const active = await listActiveEgress(SHOW_ROOM);
    egressId = active[0]?.egressId;
  }

  if (!egressId) {
    return NextResponse.json({ error: "Nenhuma transmissão ativa encontrada" }, { status: 404 });
  }

  try {
    await stopEgress(egressId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to stop egress", error);
    return NextResponse.json({ error: "Falha ao encerrar a transmissão" }, { status: 502 });
  }
}
