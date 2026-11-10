import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { YoutubeError, finishConnect } from "@/lib/youtubeLive";

// Google sends the director back here after "Permitir".
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = process.env.PUBLIC_APP_URL ?? url.origin;
  const jar = await cookies();
  const back = jar.get("yt_back")?.value ?? "/diretor";
  const done = (msg: string) => {
    const res = NextResponse.redirect(`${base}${back}${back.includes("?") ? "&" : "?"}youtube=${encodeURIComponent(msg)}`);
    res.cookies.delete({ name: "yt_state", path: "/api/youtube" });
    res.cookies.delete({ name: "yt_back", path: "/api/youtube" });
    return res;
  };
  if (!(await requireHostSession())) return NextResponse.redirect(`${base}/login`);
  if (url.searchParams.get("error")) return done("Você não permitiu o acesso ao YouTube");
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.get("state") !== jar.get("yt_state")?.value) return done("Login expirado, tente conectar de novo");
  try {
    const channel = await finishConnect(url.origin, code);
    return done(`ok:${channel}`);
  } catch (err) {
    return done(err instanceof YoutubeError ? err.message : "Falha ao conectar o YouTube");
  }
}
