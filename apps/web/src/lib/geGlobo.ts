import { RELEGATION, type Competition } from "./competitions";
import type { BoardGroup, BoardMatch, BoardTeam, BracketRound, BracketSide, BracketTie } from "./scene";

// State championships ESPN doesn't cover (the Capixabão) from ge.globo's own
// table pages: always the current edition. Two formats exist: the new page
// embeds everything in a JSON script; the older one (Série B) names its phases
// and the rest comes from ge's table API by phase.

const PAGE = "https://ge.globo.com/es/futebol";
const API = "https://api.globoesporte.globo.com/tabela";
const CACHE_MS = 5 * 60_000;
const GREEN = "#22c55e";

type Raw = Record<string, unknown>;
const o = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const a = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

const g = globalThis as unknown as { __ge?: Map<string, { at: number; data: unknown }> };
const cache = (g.__ge ??= new Map());

async function fetchCached(url: string, json: boolean): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ge ${res.status}`);
  const data = json ? await res.json() : await res.text();
  cache.set(url, { at: Date.now(), data });
  if (cache.size > 80) cache.delete(cache.keys().next().value!);
  return data;
}

type Page =
  | { kind: "context"; ctx: Raw }
  | { kind: "legacy"; uuid: string; phases: { name: string; slug: string; type: string }[]; current: Raw };

function jsonAfter(html: string, marker: string): unknown {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  try {
    const start = html.slice(i + marker.length).search(/[[{]/);
    const text = html.slice(i + marker.length + start);
    // Walk to the matching bracket, then parse just that.
    let depth = 0;
    let inStr = false;
    for (let k = 0; k < text.length; k++) {
      const c = text[k];
      if (inStr) {
        if (c === "\\") k++;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth++;
      else if (c === "}" || c === "]") {
        depth--;
        if (depth === 0) return JSON.parse(text.slice(0, k + 1));
      }
    }
  } catch {}
  return null;
}

async function page(comp: Competition): Promise<Page> {
  const html = s(await fetchCached(`${PAGE}/${comp.page}/`, false));
  const ctx = /<script id="tabela-context" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (ctx) return { kind: "context", ctx: o(JSON.parse(ctx[1])) };
  const uuid = /tUUID:\s*"([a-f0-9-]{36})"/.exec(html)?.[1];
  const current = o(jsonAfter(html, "const classificacao = "));
  if (!uuid || !Object.keys(current).length) throw new Error("O ge mudou a página da tabela; não consegui ler agora");
  const phases = a(current.fases_navegacao).map(o).map((p) => ({ name: s(p.nome), slug: s(p.slug), type: "" }));
  return { kind: "legacy", uuid, phases, current };
}

const legacyPhase = async (uuid: string, slug: string) => o(await fetchCached(`${API}/${uuid}/fase/${slug}/classificacao/`, true));

function zone(range: string, color: string): string | null {
  if (!range && !color) return null;
  return /rebaix|descenso/i.test(range) ? RELEGATION : GREEN;
}

function team(name: unknown, abbr: unknown, badge: unknown): BoardTeam {
  const logo = s(badge);
  return { name: s(name).slice(0, 30) || "?", abbr: s(abbr).slice(0, 5).toUpperCase(), logo: logo.startsWith("https://") ? logo : null };
}

const newTeam = (c: unknown) => {
  const t = o(c);
  return team(t.popularName || t.name, t.abbreviation, t.badge);
};
const oldTeam = (c: unknown) => {
  const t = o(c);
  return team(t.nome_popular, t.sigla, t.escudo);
};

// ------------------------------------------------------------------- table

export async function geStandings(comp: Competition): Promise<{ groups: BoardGroup[]; logo: string | null; round: number | null }> {
  const p = await page(comp);
  let groups: BoardGroup[] = [];
  if (p.kind === "context") {
    const phases = a(o(o(o(p.ctx.getStandingData).body).standings).multisportStandings).map(o);
    const table = phases.find((ph) => s(o(a(ph.standing)[0]).__typename) === "RoundRobinStandingData");
    groups = a(table?.standing).map(o).map((grp, gi, all) => ({
      name: all.length > 1 ? s(grp.name).slice(0, 30) : "",
      rows: a(grp.standings).map(o).map((r) => {
        const col = (slug: string) => n(o(a(r.standingColumns).map(o).find((c) => c.slug === slug)).value);
        const range = o(r.classificationRange);
        return {
          rank: n(r.order),
          team: newTeam(o(r.contestant).contestantData),
          played: col("jogos"),
          wins: col("vitorias"),
          ties: col("empates"),
          losses: col("derrotas"),
          gf: col("gols-pro"),
          ga: col("gols-contra"),
          gd: col("saldo-de-gols"),
          points: col("pontos"),
          zone: zone(s(range.name), s(range.color)),
        };
      }),
    }));
  } else {
    const first = p.phases[0];
    const data = first ? await legacyPhase(p.uuid, first.slug) : {};
    const bands = a(data.faixas_classificacao).map(o);
    groups = a(data.grupos).map(o).map((grp, gi, all) => ({
      name: all.length > 1 ? s(grp.nome_grupo).replace(/^Chave\s+/i, "").slice(0, 30) : "",
      rows: a(grp.classificacao).map(o).map((r) => {
        const color = s(o(r.faixa_classificacao).cor) || s(r.faixa_classificacao_cor);
        const band = bands.find((b) => s(b.cor) === color);
        return {
          rank: n(r.ordem),
          team: oldTeam(r),
          played: n(r.jogos),
          wins: n(r.vitorias),
          ties: n(r.empates),
          losses: n(r.derrotas),
          gf: n(r.gols_pro),
          ga: n(r.gols_contra),
          gd: n(r.saldo_gols),
          points: n(r.pontos),
          zone: color ? zone(s(band?.nome), color) : null,
        };
      }),
    }));
  }
  groups = groups.filter((x) => x.rows.length).slice(0, 8);
  if (!groups.length) throw new Error("Tabela indisponível no ge agora");
  const played = groups.length === 1 ? groups[0].rows.map((r) => r.played).sort((x, y) => x - y) : [];
  return { groups, logo: comp.logo ?? null, round: played.length ? played[Math.floor(played.length / 2)] : null };
}

// ----------------------------------------------------------------- matches

type Leg = { home: BoardTeam; away: BoardTeam; hs: number | null; as: number | null; hp: number | null; ap: number | null; date: number; venue: string; started: boolean };

const when = (day: string, hour: string) => {
  const t = Date.parse(`${day.slice(0, 10)}T${(hour || "00:00").slice(0, 5)}:00-03:00`);
  return Number.isFinite(t) ? t : 0;
};

function newLeg(m: Raw): Leg {
  const sb = o(m.scoreboard);
  const pen = o(sb.penalty);
  const past = s(m.moment) === "PAST" || s(m.moment) === "NOW";
  return {
    home: newTeam(m.firstContestant),
    away: newTeam(m.secondContestant),
    hs: past ? num(sb.home) : null,
    as: past ? num(sb.away) : null,
    hp: num(pen.home),
    ap: num(pen.away),
    date: when(s(m.startDate), s(m.startHour)),
    venue: s(o(m.location).popularName),
    started: past,
  };
}

function oldLeg(m: Raw): Leg {
  const e = o(m.equipes);
  const started = m.jogo_ja_comecou === true;
  return {
    home: oldTeam(e.mandante),
    away: oldTeam(e.visitante),
    hs: started ? num(m.placar_oficial_mandante) : null,
    as: started ? num(m.placar_oficial_visitante) : null,
    hp: num(m.placar_penaltis_mandante),
    ap: num(m.placar_penaltis_visitante),
    date: when(s(m.data_realizacao), s(m.hora_realizacao)),
    venue: s(o(m.sede).nome_popular),
    started,
  };
}

const toMatch = (l: Leg, now: number): BoardMatch => {
  const state = l.hs === null ? "pre" : now - l.date < 2.5 * 3600_000 && now >= l.date ? "in" : "post";
  return {
    date: l.date,
    state,
    detail: state === "post" ? "ENCERRADO" : state === "in" ? "AO VIVO" : "",
    venue: l.venue.slice(0, 40),
    home: { ...l.home, score: l.hs },
    away: { ...l.away, score: l.as },
  };
};

// Knockout phases: [name, ties (each tie = its legs)].
async function knockout(p: Page): Promise<{ name: string; ties: Leg[][] }[]> {
  if (p.kind === "context") {
    const phases = a(o(o(o(p.ctx.getStandingData).body).standings).multisportStandings).map(o);
    return phases
      .filter((ph) => s(o(a(ph.standing)[0]).__typename) === "KnockoutStandingData")
      .map((ph) => ({
        name: s(o(ph.phase).name),
        ties: a(o(a(ph.standing)[0]).brackets)
          .map(o)
          .sort((x, y) => n(x.order) - n(y.order))
          .map((b) => a(b.events).map((e) => newLeg(o(o(e).match)))),
      }));
  }
  const out: { name: string; ties: Leg[][] }[] = [];
  for (const ph of p.phases.slice(1)) {
    const data = await legacyPhase(p.uuid, ph.slug).catch(() => ({}) as Raw);
    const keys = a(data.secao).flatMap((sec) => a(o(sec).chave)).map(o);
    if (!keys.length) continue;
    out.push({ name: ph.name, ties: keys.sort((x, y) => s(x.nome).localeCompare(s(y.nome))).map((k) => a(k.jogos).map((j) => oldLeg(o(j)))) });
  }
  return out;
}

export async function geMatches(comp: Competition, from: string, to: string): Promise<{ matches: BoardMatch[]; logo: string | null }> {
  const p = await page(comp);
  const start = Date.parse(`${from}T00:00:00-03:00`);
  const end = Date.parse(`${to}T23:59:59-03:00`);
  const legs: Leg[] = [];
  if (p.kind === "context") {
    for (const group of a(o(o(p.ctx.getMatchListData).body).matches)) for (const item of a(o(group).items)) legs.push(newLeg(o(o(item).match)));
  } else if (p.phases[0]) {
    // Round-robin rounds of the first phase, one request per round.
    for (let r = 1; r <= 20; r++) {
      const list = a(await fetchCached(`${API}/${p.uuid}/fase/${p.phases[0].slug}/rodada/${r}/jogos/`, true).catch(() => []));
      if (!list.length) break;
      legs.push(...list.map((j) => oldLeg(o(j))));
    }
  }
  for (const round of await knockout(p)) for (const tie of round.ties) legs.push(...tie);
  const now = Date.now();
  const seen = new Set<string>();
  const matches = legs
    .filter((l) => l.date >= start && l.date <= end)
    .filter((l) => {
      const k = `${l.home.name}|${l.away.name}|${l.date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => x.date - y.date)
    .map((l) => toMatch(l, now))
    .slice(0, 20);
  return { matches, logo: comp.logo ?? null };
}

// ----------------------------------------------------------------- bracket

const ROUND = (name: string) =>
  /final/i.test(name) && !/semi|quarta|oitava/i.test(name) ? "FINAL" : /semi/i.test(name) ? "SEMIFINAL" : /quarta/i.test(name) ? "QUARTAS" : /oitava/i.test(name) ? "OITAVAS" : name.toUpperCase().slice(0, 24);

function tieOf(legs: Leg[]): BracketTie {
  if (!legs.length) return { a: null, b: null, winner: null, note: "" };
  const sorted = [...legs].sort((x, y) => x.date - y.date);
  const A = sorted[0].home;
  const B = sorted[0].away;
  const played = sorted.filter((l) => l.hs !== null);
  const goals = (t: BoardTeam) => (played.length ? played.reduce((sum, l) => sum + ((l.home.name === t.name ? l.hs : l.as) ?? 0), 0) : null);
  const ga = goals(A);
  const gb = goals(B);
  const last = sorted[sorted.length - 1];
  let winner: "a" | "b" | null = null;
  let note = "";
  const done = played.length === sorted.length && last.hs !== null;
  if (done && ga !== null && gb !== null) {
    if (ga !== gb) winner = ga > gb ? "a" : "b";
    else if (last.hp !== null && last.ap !== null && last.hp !== last.ap) {
      const homeWon = last.hp > last.ap;
      const lastHomeIsA = last.home.name === A.name;
      winner = homeWon === lastHomeIsA ? "a" : "b";
      note = `pên. ${Math.max(last.hp, last.ap)}-${Math.min(last.hp, last.ap)}`;
    }
  }
  const side = (t: BoardTeam, agg: number | null): BracketSide => ({ ...t, agg });
  return { a: side(A, ga), b: side(B, gb), winner, note };
}

export async function geBracket(comp: Competition): Promise<{ bracket: BracketRound[]; logo: string | null }> {
  const rounds = (await knockout(await page(comp))).slice(-4);
  if (!rounds.length) throw new Error("Essa competição não tem mata-mata no ge");
  const ties = rounds.map((r) => r.ties.map(tieOf));
  // From the final back: each earlier tie goes where its teams play next.
  for (let r = ties.length - 2; r >= 0; r--) {
    const pool = [...ties[r]];
    const ordered: BracketTie[] = [];
    for (const next of ties[r + 1]) {
      for (const t of [next.a, next.b]) {
        const k = t ? pool.findIndex((x) => x.a?.name === t.name || x.b?.name === t.name) : -1;
        if (k >= 0) ordered.push(pool.splice(k, 1)[0]);
      }
    }
    ties[r] = [...ordered, ...pool];
  }
  // Level on aggregate with no penalties (decided by the first phase's
  // campaign): whoever plays the next round went through.
  for (let r = 0; r < ties.length - 1; r++) {
    const next = new Set(ties[r + 1].flatMap((t) => [t.a?.name, t.b?.name]).filter(Boolean));
    ties[r] = ties[r].map((t) => (t.winner ? t : { ...t, winner: t.a && next.has(t.a.name) ? "a" : t.b && next.has(t.b.name) ? "b" : null }));
  }
  const bracket = rounds.map((r, i) => ({ name: ROUND(r.name), ties: ties[i].slice(0, 16) }));
  return { bracket, logo: comp.logo ?? null };
}
