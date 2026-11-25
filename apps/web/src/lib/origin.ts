// The address the director's browser is on (behind the proxy, the request
// itself carries the container's own host, which nobody outside can open).
export function publicOrigin(request: Request) {
  if (process.env.PUBLIC_SITE_URL) return process.env.PUBLIC_SITE_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto.split(",")[0]}://${host.split(",")[0]}` : new URL(request.url).origin;
}
