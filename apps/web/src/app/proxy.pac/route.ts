// Kept so a stream renderer still configured with this PAC (from the removed
// home-computer tunnel) keeps working: everything goes direct.
export function GET() {
  return new Response('function FindProxyForURL(url, host) { return "DIRECT"; }\n', {
    headers: { "Content-Type": "application/x-ns-proxy-autoconfig", "Cache-Control": "no-store" },
  });
}
