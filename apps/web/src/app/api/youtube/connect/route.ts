import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { YoutubeError, authUrl, publicOrigin } from "@/lib/youtubeLive";

// Sends the director to Google to allow the studio to manage the channel's lives.
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  if (!(await requireHostSession())) return NextResponse.redirect(`${origin}/login`);
  const back = new URL(request.url).searchParams.get("back") ?? "/diretor";
  const state = randomBytes(16).toString("hex");
  try {
    const res = NextResponse.redirect(await authUrl(origin, state));
    const cookie = { httpOnly: true, sameSite: "lax" as const, secure: origin.startsWith("https"), path: "/api/youtube", maxAge: 600 };
    res.cookies.set("yt_state", state, cookie);
    res.cookies.set("yt_back", back.startsWith("/") && !back.startsWith("//") ? back : "/diretor", cookie);
    return res;
  } catch (err) {
    const msg = err instanceof YoutubeError ? err.message : "Falha ao conectar";
    return NextResponse.redirect(`${origin}${back}?youtube=${encodeURIComponent(msg)}`);
  }
}
