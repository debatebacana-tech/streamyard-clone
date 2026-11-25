import { competition, zoneColor } from "./competitions";
import { fetchMatches, fetchStandings } from "./football";
import type { BoardMatch, BoardRow, BoardTeam, LiveRoundData, RoundAlertData } from "./scene";

// "Rodada ao vivo": while it runs for a program, the server follows the
// round's matches (ESPN), recomputes the table as if the games ended now, and
// raises alerts for goals and for teams entering/leaving the relegation zone.
// Everything lives in memory (like the YouTube chat) and goes to the screens
// through the room metadata; nobody has to press anything during the games.

const POLL_MS = 20_000;
// Scores straight from the source on every poll; the table a bit less often.
const MATCHES_MAX_AGE = 10_000;
const TABLE_MAX_AGE = 60_000;
const MAX_RUN_MS = 6 * 3600 * 1000;
const KEEP_ALERTS = 8;

export type RoundAlert = RoundAlertData;
export type LiveRound = LiveRoundData;

export type LiveRoundStatus = {
  running: boolean;
  competition: string | null;
  from: string | null;
  to: string | null;
  updatedAt: number | null;
  live: number;
  finished: number;
  error: string | null;
};

type State = {
  slug: string;
  competition: string;
  from: string;
  to: string;
  sound: string | null;
  data: LiveRound | null;
  error: string | null;
  timer: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  generation: number;
  // Last seen score per match id, to spot goals.
  scores: Map<string, [number, number]>;
  // Relegation zone at the last poll (null = first poll).
  z4: Set<string> | null;
  // Games each team had played before this round (learned before kickoff).
  basePlayed: Map<string, number>;
  onUpdate: (slug: string) => void;
};

const g = globalThis as unknown as { __liveRounds?: Map<string, State> };
const rounds: Map<string, State> = (g.__liveRounds ??= new Map());

const key = (t: BoardTeam) => t.id || t.name;

export function liveRoundStatus(slug: string): LiveRoundStatus {
  const st = rounds.get(slug);
  if (!st) return { running: false, competition: null, from: null, to: null, updatedAt: null, live: 0, finished: 0, error: null };
  const matches = st.data?.matches ?? [];
  return {
    running: true,
    competition: st.competition,
    from: st.from,
    to: st.to,
    updatedAt: st.data?.updatedAt ?? null,
    live: matches.filter((m) => m.state === "in").length,
    finished: matches.filter((m) => m.state === "post").length,
    error: st.error,
  };
}

// What the screens need (the matches without their goal lists).
export function liveRoundOf(slug: string): LiveRound | null {
  const data = rounds.get(slug)?.data;
  if (!data) return null;
  return { ...data, matches: data.matches.map((m) => ({ ...m, goals: undefined })) };
}

export function startLiveRound(slug: string, input: { competition: string; from: string; to: string; sound: string | null }, onUpdate: (slug: string) => void): LiveRoundStatus {
  if (!competition(input.competition)) throw new Error("Competição desconhecida");
  stopLiveRound(slug);
  const st: State = {
    slug,
    ...input,
    data: null,
    error: null,
    timer: null,
    startedAt: Date.now(),
    generation: Math.random(),
    scores: new Map(),
    z4: null,
    basePlayed: new Map(),
    onUpdate,
  };
  rounds.set(slug, st);
  void poll(st, st.generation);
  return liveRoundStatus(slug);
}

export function stopLiveRound(slug: string) {
  const st = rounds.get(slug);
  if (!st) return;
  if (st.timer) clearTimeout(st.timer);
  rounds.delete(slug);
  st.onUpdate(slug);
}

// A made-up goal (first match of the round) to rehearse the alert and its sound.
export function testGoalAlert(slug: string): boolean {
  const st = rounds.get(slug);
  const m = st?.data?.matches[0];
  if (!st?.data || !m) return false;
  const home = { ...m.home, score: (m.home.score ?? 0) + 1 };
  const away = { ...m.away, score: m.away.score ?? 0 };
  pushAlert(st.data, { id: `teste-${Date.now()}`, kind: "gol", at: Date.now(), team: m.home, home, away, side: "home", minute: "TESTE", player: "", sound: st.sound });
  st.onUpdate(slug);
  return true;
}

function pushAlert(data: LiveRound, alert: RoundAlert) {
  data.alerts = [...data.alerts, alert].slice(-KEEP_ALERTS);
}

async function poll(st: State, generation: number) {
  if (rounds.get(st.slug) !== st || st.generation !== generation) return;
  if (Date.now() - st.startedAt > MAX_RUN_MS) {
    stopLiveRound(st.slug);
    return;
  }
  try {
    const [{ matches }, standings] = await Promise.all([
      fetchMatches(st.competition, st.from, st.to, MATCHES_MAX_AGE),
      fetchStandings(st.competition, TABLE_MAX_AGE).catch(() => null),
    ]);
    if (rounds.get(st.slug) !== st) return;
    const before = JSON.stringify(st.data && { m: st.data.matches, t: st.data.table, a: st.data.alerts.length });
    const data: LiveRound = st.data ?? { competition: st.competition, matches: [], table: [], alerts: [], updatedAt: 0 };
    data.matches = matches;
    const now = Date.now();

    // Goals: a side's score went up since the last poll.
    for (const m of matches) {
      if (!m.id || m.home.score === null || m.away.score === null) continue;
      const prev = st.scores.get(m.id);
      st.scores.set(m.id, [m.home.score, m.away.score]);
      if (!prev) continue;
      for (const side of ["home", "away"] as const) {
        const now_ = side === "home" ? m.home.score : m.away.score;
        const was = side === "home" ? prev[0] : prev[1];
        if (now_ <= was) continue;
        const goal = [...(m.goals ?? [])].reverse().find((g) => g.side === side);
        const player = goal ? `${goal.player}${goal.penalty ? " (pên.)" : ""}${goal.ownGoal ? " (contra)" : ""}` : "";
        pushAlert(data, {
          id: `${m.id}-${m.home.score}-${m.away.score}`,
          kind: "gol",
          at: now,
          team: side === "home" ? m.home : m.away,
          home: { ...m.home, score: m.home.score },
          away: { ...m.away, score: m.away.score },
          side,
          minute: goal?.minute ?? m.detail,
          player,
          sound: st.sound,
        });
      }
    }

    if (standings && standings.groups.length === 1) {
      const table = liveTable(st, standings.groups[0].rows, matches);
      data.table = [{ name: "", rows: table }];
      // Relegation zone changes.
      const comp = competition(st.competition);
      if (comp?.bottom) {
        const z4 = new Set(table.slice(-comp.bottom).map((r) => key(r.team)));
        if (st.z4) {
          const entered = table.filter((r) => z4.has(key(r.team)) && !st.z4!.has(key(r.team))).map((r) => r.team);
          const left = table.filter((r) => !z4.has(key(r.team)) && st.z4!.has(key(r.team))).map((r) => r.team);
          if (entered.length || left.length) {
            pushAlert(data, { id: `z4-${now}`, kind: "z4", at: now, entered, left });
          }
        }
        st.z4 = z4;
      }
    }

    data.updatedAt = now;
    st.data = data;
    st.error = null;
    const after = JSON.stringify({ m: data.matches, t: data.table, a: data.alerts.length });
    if (before !== after) st.onUpdate(st.slug);
  } catch (err) {
    st.error = err instanceof Error && !err.message.startsWith("ESPN") ? err.message : "Não consegui buscar os placares agora (tento de novo em instantes)";
  }
  if (rounds.get(st.slug) === st && st.generation === generation) {
    st.timer = setTimeout(() => void poll(st, generation), POLL_MS);
  }
}

type Tally = { played: number; wins: number; ties: number; losses: number; gf: number; ga: number; points: number };

function apply(t: Tally, gf: number, ga: number, sign: 1 | -1) {
  t.played += sign;
  t.gf += sign * gf;
  t.ga += sign * ga;
  if (gf > ga) {
    t.wins += sign;
    t.points += sign * 3;
  } else if (gf === ga) {
    t.ties += sign;
    t.points += sign;
  } else t.losses += sign;
}

// Brasileirão order: points, wins, goal difference, goals scored.
function order(a: Tally & { name: string }, b: Tally & { name: string }) {
  return b.points - a.points || b.wins - a.wins || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name);
}

// The table "if the games ended now": the official table without this
// round's games (in case the source already counted some), plus the current
// score of every game of the round that has started.
function liveTable(st: State, official: BoardRow[], matches: BoardMatch[]): BoardRow[] {
  const comp = competition(st.competition)!;
  const games = new Map<string, { gf: number; ga: number; playing: string | null }>();
  for (const m of matches) {
    const live = m.state === "in";
    // Before the final whistle the source has not counted the game yet: what
    // the table shows is the team's count before the round (remembered, so it
    // still holds after the game ends and the source adds it).
    if (m.state !== "post") {
      for (const t of [m.home, m.away]) {
        const row = official.find((r) => key(r.team) === key(t));
        if (row) st.basePlayed.set(key(t), row.played);
      }
    }
    if (m.state === "pre" || m.home.score === null || m.away.score === null) continue;
    // Each team sees its own goals first ("2×0" for the side winning 2-0).
    games.set(key(m.home), { gf: m.home.score, ga: m.away.score, playing: live ? `${m.home.score}×${m.away.score}` : null });
    games.set(key(m.away), { gf: m.away.score, ga: m.home.score, playing: live ? `${m.away.score}×${m.home.score}` : null });
  }

  const rows = official.map((r) => {
    const k = key(r.team);
    const t: Tally & { name: string; row: BoardRow } = { name: r.team.name, row: r, played: r.played, wins: r.wins, ties: r.ties, losses: r.losses, gf: r.gf, ga: r.ga, points: r.points };
    const game = games.get(k);
    // A game already over when the round started being followed: the source
    // has counted it.
    const base = st.basePlayed.get(k) ?? r.played - 1;
    if (game && r.played > base) apply(t, game.gf, game.ga, -1);
    return t;
  });
  const baseRank = new Map([...rows].sort(order).map((t, i) => [key(t.row.team), i + 1]));
  for (const t of rows) {
    const game = games.get(key(t.row.team));
    if (game) apply(t, game.gf, game.ga, 1);
  }
  const sorted = [...rows].sort(order);
  return sorted.map((t, i) => {
    const rank = i + 1;
    const k = key(t.row.team);
    return {
      rank,
      team: t.row.team,
      played: t.played,
      wins: t.wins,
      ties: t.ties,
      losses: t.losses,
      gf: t.gf,
      ga: t.ga,
      gd: t.gf - t.ga,
      points: t.points,
      zone: zoneColor(comp, rank, sorted.length),
      move: (baseRank.get(k) ?? rank) - rank,
      playing: games.get(k)?.playing ?? null,
    };
  });
}

// For checks: the live table from given data, with the counts before the round.
export function liveTableFrom(competitionId: string, official: BoardRow[], matches: BoardMatch[], basePlayed: Map<string, number>): BoardRow[] {
  const st = { competition: competitionId, basePlayed } as unknown as State;
  return liveTable(st, official, matches);
}
