import { competition, zoneColor } from "./competitions";
import type { BoardGroup, BoardMatch, BoardTeam, BracketRound, BracketSide, BracketTie } from "./scene";

import { geBracket, geMatches, geStandings } from "./geGlobo";

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
  if (comp.provider === "ge") return geStandings(comp);
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
  const own = competition(id)?.logo;
  if (own) return own;
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
  const known = competition(id);
  if (!known) throw new Error("Competição desconhecida");
  if (known.provider === "ge") return geMatches(known, from, to);
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
  return { matches, logo: competition(id)?.logo ?? logo };
}

// ------------------------------------------------------------ knockout bracket

// ESPN round slugs/labels → the names used on air.
const ROUND_NAMES: [RegExp, string, number][] = [
  [/round[\s-]of[\s-]32/i, "16 AVOS", 16],
  [/round[\s-]of[\s-]16/i, "OITAVAS", 8],
  [/quarter/i, "QUARTAS", 4],
  [/semi/i, "SEMIFINAL", 2],
  [/^final$|(^|[\s-])final$/i, "FINAL", 1],
];

function roundOf(label: string): { name: string; size: number } | null {
  if (/third|3rd/i.test(label)) return null;
  for (const [re, name, size] of ROUND_NAMES) if (re.test(label)) return { name, size };
  return null;
}

type Leg = { home: BoardTeam & { score: number | null }; away: BoardTeam & { score: number | null }; state: string; date: number; note: string };

function winnerFromNote(note: string, a: BoardTeam, b: BoardTeam): "a" | "b" | null {
  const m = /\b([A-Z]{2,5})\s+(win|advance)/.exec(note);
  if (!m) return null;
  if (m[1] === a.abbr) return "a";
  if (m[1] === b.abbr) return "b";
  return null;
}

// The last rounds of a cup (up to oitavas → final), each tie with its
// aggregate and who went through, ordered so every tie feeds the next one.
export async function fetchBracket(id: string): Promise<{ bracket: BracketRound[]; logo: string | null }> {
  const comp = competition(id);
  if (!comp?.knockout) throw new Error("Essa competição não tem mata-mata");
  if (comp.provider === "ge") return geBracket(comp);
  const page = o(await getJson(`/site/v2/sports/soccer/${id}/scoreboard`));
  const league = o(a(page.leagues)[0]);
  const entries = a(o(a(league.calendar)[0]).entries).map(o);
  const rounds = entries
    .map((e) => ({ label: s(e.label), start: Date.parse(s(e.startDate)), end: Date.parse(s(e.endDate)), round: roundOf(s(e.label)) }))
    .filter((r) => r.round && Number.isFinite(r.start) && Number.isFinite(r.end))
    // Up to the oitavas: four rounds fit the screen.
    .slice(-4);
  if (!rounds.length) throw new Error("A ESPN ainda não tem o mata-mata dessa competição");

  // One request per day (the API refuses ranges); a round spans a few weeks at most.
  const days = new Set<string>();
  for (const r of rounds) {
    const from = Math.max(r.start, r.end - 28 * DAY_MS);
    for (let t = from; t <= r.end; t += DAY_MS) days.add(ymd(t));
  }
  const list = [...days];
  const pages: unknown[] = [];
  for (let i = 0; i < list.length; i += 10) {
    pages.push(...(await Promise.all(list.slice(i, i + 10).map((d) => getJson(`/site/v2/sports/soccer/${id}/scoreboard?dates=${d}`).catch(() => ({}))))));
  }

  // Legs grouped by round (event season slug) and by the pair of teams.
  const legs = new Map<string, Map<string, Leg[]>>();
  const seen = new Set<string>();
  for (const p of pages) {
    for (const event of a(o(p).events)) {
      const ev = o(event);
      if (seen.has(s(ev.id))) continue;
      seen.add(s(ev.id));
      const round = roundOf(s(o(ev.season).slug).replace(/-/g, " "));
      if (!round) continue;
      const c = o(a(ev.competitions)[0]);
      const sides = a(c.competitors).map(o);
      const home = sides.find((x) => x.homeAway === "home") ?? sides[0];
      const away = sides.find((x) => x.homeAway === "away") ?? sides[1];
      if (!home || !away) continue;
      const state = s(o(o(ev.status).type).state);
      const score = (x: Raw) => (state === "pre" ? null : Number.parseInt(s(x.score), 10) || 0);
      const leg: Leg = {
        home: { ...team(home.team), score: score(home) },
        away: { ...team(away.team), score: score(away) },
        state,
        date: Date.parse(s(ev.date)) || 0,
        note: a(c.notes).map((n) => s(o(n).headline)).join(" "),
      };
      const pair = [leg.home.name, leg.away.name].sort().join("|");
      const byPair = legs.get(round.name) ?? new Map<string, Leg[]>();
      byPair.set(pair, [...(byPair.get(pair) ?? []), leg]);
      legs.set(round.name, byPair);
    }
  }

  const tiesOf = (name: string): BracketTie[] =>
    [...(legs.get(name)?.values() ?? [])]
      .map((list) => list.sort((x, y) => x.date - y.date))
      .sort((x, y) => x[0].date - y[0].date)
      .map((list) => {
        const first = list[0];
        const A: BoardTeam = { name: first.home.name, abbr: first.home.abbr, logo: first.home.logo };
        const B: BoardTeam = { name: first.away.name, abbr: first.away.abbr, logo: first.away.logo };
        const played = list.filter((l) => l.state !== "pre");
        const goals = (t: BoardTeam) =>
          played.length ? played.reduce((sum, l) => sum + ((l.home.name === t.name ? l.home.score : l.away.score) ?? 0), 0) : null;
        const ga = goals(A);
        const gb = goals(B);
        const last = list[list.length - 1];
        let winner = winnerFromNote(list.map((l) => l.note).join(" "), A, B);
        const done = played.length === list.length && last.state === "post";
        if (!winner && done && ga !== null && gb !== null && ga !== gb && (list.length >= 2 || name === "FINAL")) winner = ga > gb ? "a" : "b";
        const pens = /(\d+)-(\d+) on penalties/i.exec(list.map((l) => l.note).join(" "));
        const sideA: BracketSide = { ...A, agg: ga };
        const sideB: BracketSide = { ...B, agg: gb };
        return { a: sideA, b: sideB, winner, note: pens ? `pên. ${pens[1]}-${pens[2]}` : "" };
      });

  // From the final back: each earlier tie goes where its teams play next.
  const names = rounds.map((r) => r.round!.name);
  const sizes = rounds.map((r) => r.round!.size);
  const result: BracketTie[][] = names.map(tiesOf);
  for (let r = names.length - 2; r >= 0; r--) {
    const next = result[r + 1];
    const pool = [...result[r]];
    const ordered: (BracketTie | null)[] = [];
    for (let i = 0; i < sizes[r + 1]; i++) {
      const tie = next[i];
      for (const t of [tie?.a, tie?.b]) {
        const k = t ? pool.findIndex((p) => p.a?.name === t.name || p.b?.name === t.name) : -1;
        ordered.push(k >= 0 ? pool.splice(k, 1)[0] : null);
      }
    }
    // Ties whose next match isn't known yet fill the free slots in date order.
    result[r] = ordered.map((t) => t ?? pool.shift() ?? { a: null, b: null, winner: null, note: "" });
  }
  const bracket = names.map((name, i) => ({
    name,
    ties: Array.from({ length: sizes[i] }, (_, k) => result[i][k] ?? { a: null, b: null, winner: null, note: "" }),
  }));
  // A next-round tie not scheduled yet shows whoever already went through.
  for (let r = 1; r < bracket.length; r++) {
    bracket[r].ties = bracket[r].ties.map((tie, i) => {
      const through = (t: BracketTie | undefined): BracketSide | null =>
        t?.winner ? { ...(t.winner === "a" ? t.a! : t.b!), agg: null } : null;
      return {
        ...tie,
        a: tie.a ?? through(bracket[r - 1].ties[2 * i]),
        b: tie.b ?? through(bracket[r - 1].ties[2 * i + 1]),
      };
    });
  }
  if (!bracket.some((r) => r.ties.some((t) => t.a || t.b))) throw new Error("O mata-mata dessa competição ainda não começou");
  return { bracket, logo: await leagueLogo(id) };
}
