import { connection } from "next/server";
import { pacScript } from "@/lib/tunnel";

// Proxy auto-config for the Egress browser (chrome_flags in egress.extra.yaml).
// Rendered per request so TUNNEL_PROXY is read at runtime, not at build time.
export async function GET() {
  await connection();
  return new Response(pacScript(), {
    headers: { "Content-Type": "application/x-ns-proxy-autoconfig", "Cache-Control": "no-store" },
  });
}
