import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { saveAuthKey, tunnelStatus } from "@/lib/tunnel";

const unauthorized = () => NextResponse.json({ error: "Não autorizado" }, { status: 401 });

export async function GET() {
  if (!(await requireHostSession())) return unauthorized();
  return NextResponse.json(await tunnelStatus());
}

// Saves (or clears, with null) the Tailscale auth key the server joins with.
export async function POST(request: Request) {
  if (!(await requireHostSession())) return unauthorized();
  const body = await request.json().catch(() => null);
  const key = typeof body?.authKey === "string" ? body.authKey.trim() : body?.authKey === null ? null : undefined;
  if (key === undefined || (key !== null && !/^tskey-[A-Za-z0-9-]{10,200}$/.test(key))) {
    return NextResponse.json({ error: "Chave inválida: ela começa com tskey-" }, { status: 400 });
  }
  await saveAuthKey(key);
  return NextResponse.json(await tunnelStatus());
}
