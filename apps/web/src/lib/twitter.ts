import type { TweetCard } from "./scene";

// Reads a public post from X/Twitter through the embed syndication endpoint
// (no login or key) and keeps what the on-air card needs.

const BASE = process.env.TWITTER_SYNDICATION_BASE ?? "https://cdn.syndication.twimg.com";

export function parseTweetId(input: string): string | null {
  const text = input.trim();
  if (/^\d{1,25}$/.test(text)) return text;
  const m = /(?:twitter\.com|x\.com)\/(?:[^/]+\/)?(?:status|statuses)\/(\d{1,25})/i.exec(text);
  return m ? m[1] : null;
}

// The endpoint wants this token (the same one the official embed computes).
function token(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

type Raw = Record<string, unknown>;
const o = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const s = (v: unknown): string => (typeof v === "string" ? v : "");
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function decode(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

export async function fetchTweet(id: string): Promise<TweetCard> {
  const res = await fetch(`${BASE}/tweet-result?id=${id}&token=${token(id)}&lang=pt`, { headers: { Accept: "application/json" } });
  if (res.status === 404) throw new Error("Post não encontrado (apagado ou de conta privada)");
  if (!res.ok) throw new Error("O X não respondeu agora, tente de novo");
  const data = o(await res.json());
  if (data.__typename === "TweetTombstone" || !data.user) throw new Error("Esse post não pode ser exibido (apagado, privado ou com restrição)");
  const user = o(data.user);
  const range = Array.isArray(data.display_text_range) ? (data.display_text_range as number[]) : null;
  let text = s(data.text);
  // Drop the trailing media link (t.co) outside the display range.
  if (range) text = Array.from(text).slice(range[0], range[1]).join("");
  text = decode(text).replace(/\s*https?:\/\/t\.co\/\w+\s*$/g, "").trim();
  const media = (Array.isArray(data.mediaDetails) ? data.mediaDetails : []).map(o);
  const photo = media.find((m) => s(m.media_url_https).startsWith("https://"));
  const avatar = s(user.profile_image_url_https).replace("_normal.", "_400x400.");
  return {
    id,
    name: s(user.name).slice(0, 60),
    handle: s(user.screen_name).slice(0, 30),
    avatar: avatar.startsWith("https://") ? avatar : null,
    verified: Boolean(user.is_blue_verified || user.verified),
    text: text.slice(0, 600),
    photo: photo ? s(photo.media_url_https) : null,
    date: Date.parse(s(data.created_at)) || 0,
    likes: n(data.favorite_count),
    replies: n(data.conversation_count),
  };
}
