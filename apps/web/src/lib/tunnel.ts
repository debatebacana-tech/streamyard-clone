import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

// Sites that refuse datacenter IPs and must be fetched through the team's home
// computer (Tailscale exit node, see infra/tailscale/run.sh).
export const TUNNELED_DOMAINS = ["sofascore.com", "sofascore.app"];

// The tailscale container's outbound HTTP proxy, on the compose network.
export const TUNNEL_PROXY = process.env.TUNNEL_PROXY ?? "http://tailscale:1055";

const DATA_DIR = process.env.DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
const KEY_FILE = path.join(/*turbopackIgnore: true*/ DATA_DIR, "tailscale-authkey");
const STATUS_FILE =
  process.env.TUNNEL_STATUS ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "tunnel", "status.json");

export function isTunneledHost(host: string): boolean {
  return TUNNELED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export async function saveAuthKey(key: string | null) {
  await mkdir(DATA_DIR, { recursive: true });
  if (key) await writeFile(KEY_FILE, key, { mode: 0o644 });
  else await unlink(KEY_FILE).catch(() => {});
}

type Peer = { HostName?: string; Online?: boolean; ExitNode?: boolean; ExitNodeOption?: boolean };
type RawStatus = { BackendState?: string; Peer?: Record<string, Peer> };

export type TunnelStatus = {
  configured: boolean;
  // Tailscale backend state on the server: Running, NeedsLogin, Starting...
  state: string | null;
  // Home computer currently used as exit node.
  exitNode: { name: string; online: boolean } | null;
  // Computers offering to be an exit node (for diagnostics).
  candidates: string[];
};

export async function tunnelStatus(): Promise<TunnelStatus> {
  const configured = await readFile(KEY_FILE, "utf8").then((k) => k.trim() !== "", () => false);
  let raw: RawStatus = {};
  try {
    raw = JSON.parse(await readFile(STATUS_FILE, "utf8"));
  } catch {}
  const peers = Object.values(raw.Peer ?? {});
  const exit = peers.find((p) => p.ExitNode);
  return {
    configured,
    state: raw.BackendState ?? null,
    exitNode: exit ? { name: exit.HostName ?? "?", online: Boolean(exit.Online) } : null,
    candidates: peers.filter((p) => p.ExitNodeOption).map((p) => p.HostName ?? "?"),
  };
}

export function pacScript(): string {
  const conditions = TUNNELED_DOMAINS.map((d) => `dnsDomainIs(host, "${d}") || host == "${d}"`).join(" || ");
  const proxy = new URL(TUNNEL_PROXY).host;
  // DIRECT fallback: if the tunnel is down the embed fails as before, nothing else breaks.
  return `function FindProxyForURL(url, host) {\n  if (${conditions}) return "PROXY ${proxy}; DIRECT";\n  return "DIRECT";\n}\n`;
}
