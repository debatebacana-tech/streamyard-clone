import { prisma } from "./db";
import { decrypt } from "./crypto";
import type { ChatMessage } from "./scene";

// Reads a YouTube live chat with the official Data API (videos.list once,
// then liveChatMessages.list at the interval YouTube asks for) and keeps the
// latest messages in memory for the director and the on-air chat panel.
// One live is on air at a time, so one reader serves the whole app.

const API_BASE = process.env.YOUTUBE_API_BASE ?? "https://www.googleapis.com/youtube/v3";
// Each poll costs 5 units of the free 10k/day quota: 8 s ≈ 2 250 units/hour.
const MIN_INTERVAL_MS = 8000;
const MAX_RUN_MS = 4 * 3600 * 1000;
const KEEP = 60;

export type ChatStatus = {
  running: boolean;
  slug: string | null;
  videoId: string | null;
  error: string | null;
};

type State = ChatStatus & {
  liveChatId: string | null;
  pageToken: string | null;
  messages: ChatMessage[];
  timer: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  generation: number;
  onMessages: ((slug: string) => void) | null;
};

// Survives dev hot reloads; in production there is a single server process.
const g = globalThis as unknown as { __ytChat?: State };
const state: State = (g.__ytChat ??= {
  running: false,
  slug: null,
  videoId: null,
  error: null,
  liveChatId: null,
  pageToken: null,
  messages: [],
  timer: null,
  startedAt: 0,
  generation: 0,
  onMessages: null,
});

export function parseVideoId(input: string): string | null {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  try {
    const u = new URL(text);
    const v = u.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = /\/(?:live|embed|shorts|video)\/([\w-]{11})/.exec(u.pathname) ?? /^\/([\w-]{11})$/.exec(u.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function apiKey(): Promise<string | null> {
  const settings = await prisma.showSettings.findUnique({ where: { id: "default" } });
  if (!settings?.youtubeApiKeyCipher) return null;
  try {
    return decrypt(settings.youtubeApiKeyCipher);
  } catch {
    return null;
  }
}

function explain(status: number, body: string): string {
  if (body.includes("quotaExceeded")) return "Cota diária da API do YouTube esgotada (volta amanhã)";
  if (body.includes("liveChatEnded")) return "O chat desta live foi encerrado";
  if (body.includes("liveChatDisabled")) return "O chat está desativado nesta live";
  if (status === 400 || body.includes("keyInvalid") || body.includes("API_KEY_INVALID")) return "Chave da API do YouTube inválida";
  if (status === 403) return "A chave não tem acesso à YouTube Data API v3 (ative a API no Google Cloud)";
  return `O YouTube respondeu com erro ${status}`;
}

type ChatItem = {
  id: string;
  snippet?: { displayMessage?: string; type?: string };
  authorDetails?: { displayName?: string; profileImageUrl?: string };
};

function toMessage(item: ChatItem): ChatMessage | null {
  const text = item.snippet?.displayMessage?.trim();
  if (!text) return null;
  const avatar = item.authorDetails?.profileImageUrl ?? null;
  return {
    id: item.id,
    author: (item.authorDetails?.displayName ?? "Anônimo").slice(0, 60),
    text: text.slice(0, 300),
    avatarUrl: avatar && avatar.startsWith("https://") ? avatar : null,
  };
}

function stopTimer() {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
}

async function poll(generation: number, key: string) {
  if (generation !== state.generation || !state.running || !state.liveChatId) return;
  if (Date.now() - state.startedAt > MAX_RUN_MS) {
    stopChat("Leitura do chat pausada após 4 horas (clique em Conectar para continuar)");
    return;
  }
  let wait = MIN_INTERVAL_MS;
  try {
    const params = new URLSearchParams({ liveChatId: state.liveChatId, part: "snippet,authorDetails", maxResults: "200" });
    if (state.pageToken) params.set("pageToken", state.pageToken);
    const res = await fetch(`${API_BASE}/liveChat/messages?${params}`, { headers: { "X-Goog-Api-Key": key } });
    const body = await res.text();
    if (generation !== state.generation) return;
    if (!res.ok) {
      stopChat(explain(res.status, body));
      return;
    }
    const data = JSON.parse(body) as { items?: ChatItem[]; nextPageToken?: string; pollingIntervalMillis?: number };
    const fresh = (data.items ?? []).map(toMessage).filter((m): m is ChatMessage => m !== null);
    // The first page is the backlog: keep only its tail so the panel starts current.
    const added = state.pageToken ? fresh : fresh.slice(-10);
    state.pageToken = data.nextPageToken ?? state.pageToken;
    wait = Math.max(MIN_INTERVAL_MS, data.pollingIntervalMillis ?? 0);
    state.error = null;
    if (added.length) {
      const seen = new Set(state.messages.map((m) => m.id));
      state.messages = [...state.messages, ...added.filter((m) => !seen.has(m.id))].slice(-KEEP);
      if (state.slug) state.onMessages?.(state.slug);
    }
  } catch {
    state.error = "Sem resposta do YouTube, tentando de novo";
  }
  state.timer = setTimeout(() => poll(generation, key), wait);
}

export async function startChat(slug: string, input: string, onMessages: (slug: string) => void): Promise<ChatStatus> {
  const videoId = parseVideoId(input);
  if (!videoId) return { ...chatStatus(), error: "Não reconheci o link da live" };
  const key = await apiKey();
  if (!key) return { ...chatStatus(), error: "Cadastre a chave da API do YouTube na Área do Diretor" };

  stopTimer();
  const generation = ++state.generation;
  Object.assign(state, {
    running: false,
    slug,
    videoId,
    error: null,
    liveChatId: null,
    pageToken: null,
    messages: [],
    startedAt: Date.now(),
    onMessages,
  });

  const params = new URLSearchParams({ part: "liveStreamingDetails", id: videoId });
  try {
    const res = await fetch(`${API_BASE}/videos?${params}`, { headers: { "X-Goog-Api-Key": key } });
    const body = await res.text();
    if (!res.ok) return { ...chatStatus(), error: (state.error = explain(res.status, body)) };
    const data = JSON.parse(body) as { items?: { liveStreamingDetails?: { activeLiveChatId?: string } }[] };
    const liveChatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
    if (!liveChatId) {
      state.error = data.items?.length
        ? "Essa live não tem chat ativo agora (ela já começou? o chat está ligado?)"
        : "Vídeo não encontrado (confira o link)";
      return chatStatus();
    }
    state.liveChatId = liveChatId;
    state.running = true;
    poll(generation, key);
    return chatStatus();
  } catch {
    state.error = "Sem resposta do YouTube";
    return chatStatus();
  }
}

export function stopChat(reason: string | null = null) {
  stopTimer();
  state.generation++;
  state.running = false;
  state.error = reason;
}

export function chatStatus(): ChatStatus {
  return { running: state.running, slug: state.slug, videoId: state.videoId, error: state.error };
}

export function chatMessages(slug: string): ChatMessage[] {
  return state.slug === slug ? state.messages : [];
}

// People watching the live right now (YouTube's concurrent viewers), for the
// director's header. The live is the one scheduled from the studio or the one
// whose chat is being read. Cached 30 s (each call costs 1 unit of quota).
let viewers: { at: number; videoId: string; count: number | null } | null = null;

export async function liveViewers(): Promise<number | null> {
  const settings = await prisma.showSettings.findUnique({ where: { id: "default" } });
  const videoId = settings?.youtubeBroadcastId ?? state.videoId;
  if (!videoId) return null;
  if (viewers && viewers.videoId === videoId && Date.now() - viewers.at < 30_000) return viewers.count;
  const key = await apiKey();
  if (!key) return null;
  let count: number | null = null;
  try {
    const params = new URLSearchParams({ part: "liveStreamingDetails", id: videoId });
    const res = await fetch(`${API_BASE}/videos?${params}`, { headers: { "X-Goog-Api-Key": key }, signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = (await res.json()) as { items?: { liveStreamingDetails?: { concurrentViewers?: string } }[] };
      const raw = data.items?.[0]?.liveStreamingDetails?.concurrentViewers;
      count = raw !== undefined ? Number(raw) : null;
    }
  } catch {}
  viewers = { at: Date.now(), videoId, count };
  return count;
}
