import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { decrypt, encrypt } from "./crypto";
import { UPLOAD_DIR, isSafeFileName, mimeForFileName } from "./assets";
export { publicOrigin } from "./origin";

// Schedules lives on the channel with the YouTube Data API, the way
// StreamYard does: the director signs in with Google once (OAuth, offline
// access), then each scheduled live is created on YouTube and bound to one
// reusable stream whose key the studio keeps, so nobody copies keys again.
// enableAutoStart: the live goes public as soon as "Iniciar transmissão" sends video.

const API_BASE = process.env.YOUTUBE_API_BASE ?? "https://www.googleapis.com/youtube/v3";
const UPLOAD_BASE = process.env.YOUTUBE_UPLOAD_BASE ?? "https://www.googleapis.com/upload/youtube/v3";
const AUTH_URL = process.env.GOOGLE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/youtube";

export class YoutubeError extends Error {}


export function redirectUri(origin: string) {
  return `${origin}/api/youtube/callback`;
}

async function settings() {
  return prisma.showSettings.findUnique({ where: { id: "default" } });
}

export async function oauthStatus() {
  const s = await settings();
  return {
    hasClient: Boolean(s?.youtubeClientId && s.youtubeClientSecretCipher),
    clientId: s?.youtubeClientId ?? "",
    connected: Boolean(s?.youtubeRefreshTokenCipher),
    channel: s?.youtubeChannelTitle ?? null,
    activeBroadcastId: s?.youtubeBroadcastId ?? null,
  };
}

export async function saveClient(clientId: string, clientSecret: string) {
  const data = { youtubeClientId: clientId, youtubeClientSecretCipher: encrypt(clientSecret) };
  await prisma.showSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
}

export async function disconnect() {
  const data = { youtubeRefreshTokenCipher: null, youtubeChannelTitle: null, youtubeStreamId: null, youtubeBroadcastId: null };
  await prisma.showSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  token = null;
}

async function client() {
  const s = await settings();
  if (!s?.youtubeClientId || !s.youtubeClientSecretCipher) throw new YoutubeError("Cadastre o ID e a chave secreta do cliente OAuth primeiro");
  return { id: s.youtubeClientId, secret: decrypt(s.youtubeClientSecretCipher), refresh: s.youtubeRefreshTokenCipher ? decrypt(s.youtubeRefreshTokenCipher) : null };
}

export async function authUrl(origin: string, state: string) {
  const c = await client();
  const params = new URLSearchParams({
    client_id: c.id,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

let token: { value: string; expires: number } | null = null;

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") throw new YoutubeError("O acesso ao YouTube expirou ou foi revogado. Conecte o canal de novo.");
    throw new YoutubeError(`Google recusou o login: ${data.error_description ?? data.error ?? res.status}`);
  }
  token = { value: data.access_token, expires: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000 };
  return data;
}

export async function finishConnect(origin: string, code: string) {
  const c = await client();
  const data = await tokenRequest({ code, client_id: c.id, client_secret: c.secret, redirect_uri: redirectUri(origin), grant_type: "authorization_code" });
  if (!data.refresh_token) throw new YoutubeError("O Google não devolveu acesso permanente. Remova o acesso do app na sua conta Google e conecte de novo.");
  await prisma.showSettings.upsert({
    where: { id: "default" },
    create: { id: "default", youtubeRefreshTokenCipher: encrypt(data.refresh_token) },
    update: { youtubeRefreshTokenCipher: encrypt(data.refresh_token), youtubeStreamId: null },
  });
  const channels = await api<{ items?: { snippet: { title: string } }[] }>("GET", "/channels?part=snippet&mine=true");
  const title = channels.items?.[0]?.snippet.title;
  if (!title) throw new YoutubeError("Essa conta Google não tem canal do YouTube");
  await prisma.showSettings.update({ where: { id: "default" }, data: { youtubeChannelTitle: title } });
  return title;
}

async function accessToken() {
  if (token && token.expires > Date.now()) return token.value;
  const c = await client();
  if (!c.refresh) throw new YoutubeError("Conecte o canal do YouTube primeiro");
  await tokenRequest({ refresh_token: c.refresh, client_id: c.id, client_secret: c.secret, grant_type: "refresh_token" });
  return token!.value;
}

const REASONS: Record<string, string> = {
  liveStreamingNotEnabled: "O canal ainda não tem transmissões ao vivo liberadas (YouTube Studio → Transmitir ao vivo; leva até 24 h na primeira vez)",
  insufficientLivePermissions: "Essa conta não tem permissão de transmitir neste canal",
  invalidScheduledStartTime: "Data/hora inválida (precisa ser no futuro)",
  quotaExceeded: "A cota diária da API do YouTube acabou; tente amanhã",
  forbidden: "O YouTube não permitiu (verifique se o canal pode usar miniaturas personalizadas)",
};

async function api<T>(method: string, pathAndQuery: string, body?: unknown, base = API_BASE, raw?: { data: Buffer; type: string }): Promise<T> {
  const res = await fetch(`${base}${pathAndQuery}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(raw ? { "Content-Type": raw.type } : body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: raw ? new Uint8Array(raw.data) : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {} as T;
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; errors?: { reason?: string }[] } };
  if (!res.ok) {
    const reason = data.error?.errors?.[0]?.reason ?? "";
    throw new YoutubeError(REASONS[reason] ?? `YouTube: ${data.error?.message ?? res.status}`);
  }
  return data;
}

type Stream = { id: string; cdn: { ingestionInfo: { streamName: string } } };

// One reusable stream for every scheduled live; its key goes into the studio.
async function ensureStream(): Promise<string> {
  const s = await settings();
  if (s?.youtubeStreamId) {
    const found = await api<{ items?: Stream[] }>("GET", `/liveStreams?part=cdn&id=${s.youtubeStreamId}`);
    const stream = found.items?.[0];
    if (stream) {
      await saveKey(stream);
      return stream.id;
    }
  }
  const stream = await api<Stream>("POST", "/liveStreams?part=snippet,cdn,contentDetails", {
    snippet: { title: "Estúdio Debate Bacana" },
    cdn: { ingestionType: "rtmp", resolution: "variable", frameRate: "variable" },
    contentDetails: { isReusable: true },
  });
  await prisma.showSettings.update({ where: { id: "default" }, data: { youtubeStreamId: stream.id } });
  await saveKey(stream);
  return stream.id;
}

async function saveKey(stream: Stream) {
  const key = stream.cdn?.ingestionInfo?.streamName;
  if (key) await prisma.showSettings.update({ where: { id: "default" }, data: { youtubeStreamKeyCipher: encrypt(key) } });
}

export type Broadcast = {
  id: string;
  title: string;
  description: string;
  scheduledStart: string | null;
  privacy: string;
  status: string;
  thumbnail: string | null;
  url: string;
};

type ApiBroadcast = {
  id: string;
  snippet: { title: string; description?: string; scheduledStartTime?: string; thumbnails?: Record<string, { url: string }> };
  status: { privacyStatus: string; lifeCycleStatus: string };
};

function toBroadcast(b: ApiBroadcast): Broadcast {
  const t = b.snippet.thumbnails ?? {};
  return {
    id: b.id,
    title: b.snippet.title,
    description: b.snippet.description ?? "",
    scheduledStart: b.snippet.scheduledStartTime ?? null,
    privacy: b.status.privacyStatus,
    status: b.status.lifeCycleStatus,
    thumbnail: (t.medium ?? t.high ?? t.default)?.url ?? null,
    url: `https://www.youtube.com/watch?v=${b.id}`,
  };
}

export async function listBroadcasts(): Promise<Broadcast[]> {
  const [upcoming, active] = await Promise.all(
    ["upcoming", "active"].map((status) =>
      api<{ items?: ApiBroadcast[] }>("GET", `/liveBroadcasts?part=snippet,status&broadcastStatus=${status}&broadcastType=all&maxResults=25`),
    ),
  );
  return [...(active.items ?? []), ...(upcoming.items ?? [])]
    .map(toBroadcast)
    .sort((a, b) => (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""));
}

async function setThumbnail(videoId: string, mediaUrl: string) {
  const file = mediaUrl.replace(/^\/media\//, "");
  if (!isSafeFileName(file)) return;
  const type = mimeForFileName(file);
  if (!type?.startsWith("image/")) return;
  const data = await readFile(path.join(UPLOAD_DIR, file));
  if (data.length > 2 * 1024 * 1024) throw new YoutubeError("A miniatura precisa ter no máximo 2 MB");
  await api("POST", `/thumbnails/set?videoId=${videoId}`, undefined, UPLOAD_BASE, { data, type });
}

// Only the chosen live listens to the studio's stream: with auto start, another
// scheduled live still bound to it could go on air instead.
async function bindOnly(id: string, streamId: string) {
  const upcoming = await api<{ items?: { id: string; contentDetails?: { boundStreamId?: string } }[] }>(
    "GET",
    "/liveBroadcasts?part=id,contentDetails&broadcastStatus=upcoming&broadcastType=all&maxResults=50",
  );
  for (const b of upcoming.items ?? []) {
    if (b.id !== id && b.contentDetails?.boundStreamId === streamId) await api("POST", `/liveBroadcasts/bind?part=id&id=${b.id}`);
  }
  await api("POST", `/liveBroadcasts/bind?part=id&id=${encodeURIComponent(id)}&streamId=${streamId}`);
}

export type NewBroadcast = { title: string; description: string; start: string; privacy: "public" | "unlisted" | "private"; thumbnailUrl: string | null };

// Creates the live on YouTube, binds it to the studio's stream and makes it the
// one "Iniciar transmissão" goes to. A thumbnail problem doesn't undo the live.
export async function createBroadcast(input: NewBroadcast): Promise<{ broadcast: Broadcast; warning: string | null }> {
  const streamId = await ensureStream();
  const created = await api<ApiBroadcast>("POST", "/liveBroadcasts?part=snippet,status,contentDetails", {
    snippet: { title: input.title, description: input.description, scheduledStartTime: input.start },
    status: { privacyStatus: input.privacy, selfDeclaredMadeForKids: false },
    contentDetails: { enableAutoStart: true, enableAutoStop: true, enableDvr: true, monitorStream: { enableMonitorStream: false } },
  });
  await bindOnly(created.id, streamId);
  await prisma.showSettings.update({ where: { id: "default" }, data: { youtubeBroadcastId: created.id } });
  let warning: string | null = null;
  if (input.thumbnailUrl) {
    await setThumbnail(created.id, input.thumbnailUrl).catch((err) => {
      warning = `Live criada, mas a miniatura não foi: ${err instanceof Error ? err.message : err}`;
    });
  }
  return { broadcast: toBroadcast(created), warning };
}

// Points the studio at an existing scheduled live (e.g. one made in YouTube Studio).
export async function selectBroadcast(id: string) {
  const streamId = await ensureStream();
  await bindOnly(id, streamId);
  await prisma.showSettings.update({ where: { id: "default" }, data: { youtubeBroadcastId: id } });
}

export async function deleteBroadcast(id: string) {
  await api("DELETE", `/liveBroadcasts?id=${encodeURIComponent(id)}`);
  const s = await settings();
  if (s?.youtubeBroadcastId === id) await prisma.showSettings.update({ where: { id: "default" }, data: { youtubeBroadcastId: null } });
}
