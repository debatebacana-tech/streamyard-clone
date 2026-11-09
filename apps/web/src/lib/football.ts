import { competition, zoneColor } from "./competitions";
import type { BoardGroup, BoardMatch, BoardTeam } from "./scene";

export { COMPETITIONS } from "./competitions";

// Round fixtures and standings from ESPN's public site API (free, no key,
// with team crests). Fetched on the server so the browser and the Egress
// output only ever see the snapshot the director put on screen.

const BASE = process.env.FOOTBALL_API_BASE ?? "https://site.api.espn.com/apis";
const CACHE_MS = 30_000;

const g = globalThis as unknown as { __footballCache?: Map<string, { at: number; data: unknown }> };
const cache = (g.__footballCache ??= new Map());

async function getJson(path: string): Promise<unknown> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json", "User-Agent": "debate-bacana-studio" } });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = await res.json();
  cache.set(path, { at: Date.now(), data });
  if (cache.size > 200) cache.delete(cache.keys().next().value!);
  return data;
}

type Raw = Record<string, unknown>;
const o = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const a = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string => (typeof v === "string" ? v : "");

function httpsUrl(v: unknown): string | null {
  const url = s(v);
  return url.startsWith("https://") && url.length <= 300 ? url : null;
}

function team(raw: unknown): BoardTeam {
  const t = o(raw);
  const logo = httpsUrl(t.logo) ?? httpsUrl(o(a(t.logos)[0]).href);
  return {
    name: (s(t.shortDisplayName) || s(t.displayName) || s(t.name) || "?").slice(0, 30),
    abbr: (s(t.abbreviation) || s(t.shortDisplayName).slice(0, 3)).toUpperCase().slice(0, 5),
    logo,
  };
}

export async function fetchStandings(id: string): Promise<{ groups: BoardGroup[]; logo: string | null; round: number | null }> {
  const comp = competition(id);
  if (!comp) throw new Error("Competição desconhecida");
  const data = o(await getJson(`/v2/sports/soccer/${id}/standings`));
  const children = a(data.children).length ? a(data.children) : [data];
  const groups: BoardGroup[] = children
    .map((child) => {
      const c = o(child);
      const entries = a(o(c.standings).entries);
      const rows = entries.map((entry, i) => {
        const e = o(entry);
        const stat = (name: string) => {
          const found = o(a(e.stats).find((x) => o(x).name === name));
          return typeof found.value === "number" ? found.value : 0;
        };
        const rank = stat("rank") || i + 1;
        const zone = zoneColor(comp, rank, entries.length);
        return {
          rank,
          team: team(e.team),
          played: stat("gamesPlayed"),
          wins: stat("wins"),
          ties: stat("ties"),
          losses: stat("losses"),
          gf: stat("pointsFor"),
          ga: stat("pointsAgainst"),
          gd: stat("pointDifferential"),
          points: stat("points"),
          zone,
        };
      });
      rows.sort((x, y) => x.rank - y.rank);
      // Single tables are named after the season ("2026"); only groups keep their name.
      const name = children.length > 1 ? s(c.name).replace(/^Group\s+/i, "Grupo ").slice(0, 30) : "";
      return { name, rows: rows.slice(0, 24) };
    })
    .filter((group) => group.rows.length > 0)
    .slice(0, 8);
  // Leagues: the round most teams have played (groups/cups: none).
  const played = groups.length === 1 ? groups[0].rows.map((r) => r.played).sort((x, y) => x - y) : [];
  const round = played.length ? played[Math.floor(played.length / 2)] : null;
  return { groups, logo: await leagueLogo(id), round };
}

async function leagueLogo(id: string): Promise<string | null> {
  try {
    const page = o(await getJson(`/site/v2/sports/soccer/${id}/scoreboard`));
    return httpsUrl(o(a(o(a(page.leagues)[0]).logos)[0]).href);
  } catch {
    return null;
  }
}

const DAY_MS = 24 * 3600 * 1000;

function ymd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
}

function matchDetail(status: Raw): string {
  const type = o(status.type);
  const state = s(type.state);
  if (state === "in") return s(status.displayClock) || "AO VIVO";
  if (state === "post") return s(type.name).includes("POSTPONED") ? "ADIADO" : "ENCERRADO";
  if (s(type.name).includes("POSTPONED")) return "ADIADO";
  return "";
}

// Matches between two dates (inclusive, YYYY-MM-DD), one request per day
// (the API refuses date ranges).
export async function fetchMatches(id: string, from: string, to: string): Promise<{ matches: BoardMatch[]; logo: string | null }> {
  if (!competition(id)) throw new Error("Competição desconhecida");
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("Datas inválidas");
  const days: number[] = [];
  for (let t = start; t <= end && days.length < 14; t += DAY_MS) days.push(t);

  let logo: string | null = null;
  const pages = await Promise.all(days.map((day) => getJson(`/site/v2/sports/soccer/${id}/scoreboard?dates=${ymd(day)}`)));
  const byId = new Map<string, BoardMatch>();
  for (const page of pages) {
    const p = o(page);
    logo ??= httpsUrl(o(a(o(a(p.leagues)[0]).logos)[0]).href);
    for (const event of a(p.events)) {
      const ev = o(event);
      const comp = o(a(ev.competitions)[0]);
      const sides = a(comp.competitors).map(o);
      const home = sides.find((c) => c.homeAway === "home") ?? sides[0];
      const away = sides.find((c) => c.homeAway === "away") ?? sides[1];
      if (!home || !away) continue;
      const status = o(ev.status);
      const state = s(o(status.type).state);
      const score = (c: Raw) => (state === "pre" ? null : Number.parseInt(s(c.score), 10) || 0);
      byId.set(s(ev.id), {
        date: Date.parse(s(ev.date)) || 0,
        state: state === "in" || state === "post" ? state : "pre",
        detail: matchDetail(status),
        venue: (s(o(comp.venue).fullName) || s(o(ev.venue).displayName)).replace(/^Est[aá]dio\s+(d[oe]\s+)?/i, "").slice(0, 40),
        home: { ...team(home.team), score: score(home) },
        away: { ...team(away.team), score: score(away) },
      });
    }
  }
  const matches = [...byId.values()].sort((x, y) => x.date - y.date).slice(0, 20);
  return { matches, logo };
}
