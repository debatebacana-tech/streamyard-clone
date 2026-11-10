import { prisma } from "./db";
import { decrypt } from "./crypto";
import { zoneColor, type Competition } from "./competitions";
import type { BoardGroup, BoardMatch, BoardTeam } from "./scene";

// API-Football (api-sports.io) for the championships ESPN doesn't cover,
// like the Capixabão. Free plan: 100 requests a day, so answers are cached
// and the league is looked up once.

const BASE = process.env.API_FOOTBALL_BASE ?? "https://v3.football.api-sports.io";
const CACHE_MS = 10 * 60_000;

type Raw = Record<string, unknown>;
const o = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const a = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string => (typeof v === "string" ? v : "");
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const g = globalThis as unknown as { __apif?: { cache: Map<string, { at: number; data: unknown }>; leagues: Map<string, { id: number; season: number; logo: string | null }> } };
const store = (g.__apif ??= { cache: new Map(), leagues: new Map() });

export function forgetApiFootball() {
  store.cache.clear();
  store.leagues.clear();
}

export class ApiFootballError extends Error {}

async function key(): Promise<string> {
  const settings = await prisma.showSettings.findUnique({ where: { id: "default" } });
  if (!settings?.apiFootballKeyCipher) throw new ApiFootballError("Cadastre a chave da API-Football (aparece aqui no painel)");
  return decrypt(settings.apiFootballKeyCipher);
}

async function get(path: string): Promise<unknown[]> {
  const hit = store.cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return a(o(hit.data).response);
  const res = await fetch(`${BASE}${path}`, { headers: { "x-apisports-key": await key() }, signal: AbortSignal.timeout(15_000) });
  const data = o(await res.json().catch(() => ({})));
  // Errors come back as 200 with an "errors" object (bad key, plan limits, quota).
  const errors = Object.values(o(data.errors)).map(s).filter(Boolean);
  if (!res.ok || errors.length) {
    const text = errors.join(" ") || `HTTP ${res.status}`;
    if (/token|key/i.test(text)) throw new ApiFootballError("A API-Football recusou a chave (confira em “My Access”)");
    if (/limit|requests/i.test(text)) throw new ApiFootballError("Acabaram as 100 consultas grátis de hoje da API-Football; amanhã libera de novo");
    if (/plan|season/i.test(text)) throw new ApiFootballError(`O plano da API-Football não libera essa temporada: ${text}`);
    throw new ApiFootballError(`API-Football: ${text}`);
  }
  store.cache.set(path, { at: Date.now(), data });
  if (store.cache.size > 100) store.cache.delete(store.cache.keys().next().value!);
  return a(data.response);
}

// "Capixaba" (1ª) or "Capixaba - 2" / "Série B" (2ª): found by name, then
// the season marked as current (or the latest).
async function league(comp: Competition) {
  const known = store.leagues.get(comp.id);
  if (known) return known;
  // The API refuses country + search together: search by name, keep Brazil's.
  const found = (await get(`/leagues?search=${encodeURIComponent(comp.search ?? comp.short)}`))
    .map(o)
    .filter((l) => !s(o(l.country).name) || /brazil|brasil/i.test(s(o(l.country).name)));
  const second = (name: string) => /\b(2|B|II|Série B|Serie B|Segunda)\b/i.test(name);
  const pick = found.find((l) => (comp.division === 2 ? second(s(o(l.league).name)) : !second(s(o(l.league).name))));
  if (!pick) {
    const names = found.map((l) => s(o(l.league).name)).join(", ");
    throw new ApiFootballError(`A API-Football não tem essa divisão${names ? ` (encontrei: ${names})` : ""}`);
  }
  const seasons = a(pick.seasons).map(o);
  const season = seasons.find((x) => x.current === true) ?? seasons.sort((x, y) => n(y.year) - n(x.year))[0];
  const info = { id: n(o(pick.league).id), season: n(season?.year) || new Date().getFullYear(), logo: s(o(pick.league).logo) || null };
  store.leagues.set(comp.id, info);
  return info;
}

function team(raw: unknown): BoardTeam {
  const t = o(raw);
  const name = s(t.name).slice(0, 30) || "?";
  const logo = s(t.logo);
  return { name, abbr: name.replace(/[^A-Za-zÀ-ú]/g, "").slice(0, 3).toUpperCase(), logo: logo.startsWith("https://") ? logo : null };
}

export async function apifStandings(comp: Competition): Promise<{ groups: BoardGroup[]; logo: string | null; round: number | null }> {
  const lg = await league(comp);
  const res = (await get(`/standings?league=${lg.id}&season=${lg.season}`)).map(o);
  const tables = a(o(res[0]?.league).standings).map(a);
  if (!tables.length) throw new ApiFootballError(`Tabela da temporada ${lg.season} ainda não disponível na API-Football`);
  const groups: BoardGroup[] = tables.slice(0, 8).map((rows) => {
    const list = rows.map(o);
    return {
      name: tables.length > 1 ? s(list[0]?.group).slice(0, 30) : "",
      rows: list.slice(0, 24).map((r) => {
        const all = o(r.all);
        const goals = o(all.goals);
        const rank = n(r.rank);
        return {
          rank,
          team: team(r.team),
          played: n(all.played),
          wins: n(all.win),
          ties: n(all.draw),
          losses: n(all.lose),
          gf: n(goals.for),
          ga: n(goals.against),
          gd: n(r.goalsDiff),
          points: n(r.points),
          zone: zoneColor(comp, rank, list.length),
        };
      }),
    };
  });
  const played = groups.length === 1 ? groups[0].rows.map((r) => r.played).sort((x, y) => x - y) : [];
  return { groups, logo: comp.logo ?? lg.logo, round: played.length ? played[Math.floor(played.length / 2)] : null };
}

const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const DONE = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

export async function apifMatches(comp: Competition, from: string, to: string): Promise<{ matches: BoardMatch[]; logo: string | null }> {
  const lg = await league(comp);
  const res = (await get(`/fixtures?league=${lg.id}&season=${lg.season}&from=${from}&to=${to}&timezone=America/Sao_Paulo`)).map(o);
  const matches: BoardMatch[] = res
    .map((f) => {
      const fx = o(f.fixture);
      const st = o(fx.status);
      const short = s(st.short);
      const state = LIVE.has(short) ? "in" : DONE.has(short) ? "post" : "pre";
      const goals = o(f.goals);
      const score = (v: unknown) => (state === "pre" ? null : n(v));
      return {
        date: Date.parse(s(fx.date)) || 0,
        state,
        detail: state === "in" ? (short === "HT" ? "INTERVALO" : `${n(st.elapsed)}'`) : state === "post" ? "ENCERRADO" : /PST|CANC/.test(short) ? "ADIADO" : "",
        venue: s(o(fx.venue).name).replace(/^Est[aá]dio\s+(d[oe]\s+)?/i, "").slice(0, 40),
        home: { ...team(o(f.teams).home), score: score(goals.home) },
        away: { ...team(o(f.teams).away), score: score(goals.away) },
      } as BoardMatch;
    })
    .sort((x, y) => x.date - y.date)
    .slice(0, 20);
  return { matches, logo: comp.logo ?? lg.logo };
}
