import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { ProxyAgent, fetch } from "undici";
import { extractEmbedUrl } from "@/lib/scene";
import { TUNNEL_PROXY, isTunneledHost } from "@/lib/tunnel";

// Fetches an embed URL from this server, which shares its IP with the Egress
// browser that renders the live output, so the director learns whether the
// site blocks servers (e.g. a 403 for datacenter IPs) before going to air.
export async function GET(request: Request) {
  if (!(await requireHostSession())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const url = extractEmbedUrl(new URL(request.url).searchParams.get("url") ?? "");
  if (!url) return NextResponse.json({ ok: false, reason: "Link inválido" });

  const host = new URL(url).hostname;
  // Only public sites: no IP literals or internal service names.
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.includes(":")) {
    return NextResponse.json({ ok: false, reason: "Endereço não permitido" });
  }

  // Same route the Egress browser takes (see /proxy.pac).
  const tunneled = isTunneledHost(host);
  try {
    const res = await fetch(url, {
      ...(tunneled && { dispatcher: new ProxyAgent(TUNNEL_PROXY) }),
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        Accept: "text/html,*/*",
      },
    });
    const xfo = res.headers.get("x-frame-options");
    const csp = res.headers.get("content-security-policy") ?? "";
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        reason: tunneled
          ? `O site recusou mesmo passando pelo computador de casa (erro ${res.status})`
          : `O site recusou o servidor da live (erro ${res.status})`,
      });
    }
    if (xfo || /frame-ancestors\s+('none'|'self')/i.test(csp)) {
      return NextResponse.json({ ok: false, reason: "O site não permite ser exibido dentro de outra página" });
    }
    return NextResponse.json({ ok: true, tunneled });
  } catch {
    return NextResponse.json({
      ok: false,
      reason: tunneled
        ? "O computador de casa não está conectado (veja \"Campinho via computador de casa\" na Área do Diretor)"
        : "O servidor da live não conseguiu abrir o site",
    });
  }
}
