import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { disconnect, oauthStatus, publicOrigin, redirectUri, saveClient } from "@/lib/youtubeLive";

// The Google Cloud OAuth client ("ID do cliente" + "chave secreta") and the
// connection status for "Programar live".
export async function GET(request: Request) {
  if (!(await requireHostSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ ...(await oauthStatus()), redirectUri: redirectUri(publicOrigin(request)) });
}

export async function POST(request: Request) {
  if (!(await requireHostSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret = typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";
  if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
    return NextResponse.json({ error: "O ID do cliente termina com .apps.googleusercontent.com" }, { status: 400 });
  }
  if (clientSecret.length < 10) return NextResponse.json({ error: "Cole a chave secreta do cliente" }, { status: 400 });
  await saveClient(clientId, clientSecret);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  if (!(await requireHostSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  await disconnect();
  return NextResponse.json({ ok: true });
}
