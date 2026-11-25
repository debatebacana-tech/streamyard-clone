"use client";

import { useEffect, useState } from "react";
import type { Board, BoardMatch, BoardRow, BoardTeam, LiveRoundData, RoundAlertData } from "@/lib/scene";
import { LIME } from "./BoardScreen";
import { playQuickSound, preloadSounds } from "./MediaLayer";
import { CONDENSED, DISPLAY } from "./showStyle";

// Live round on screen: the fixtures/table boards take the live data while the
// round is followed, and every goal (or change in the relegation zone) pops a
// banner at the top of the stream, one after the other, with the Gol Bacana
// sound on the stream itself.

const SHOW_MS = { gol: 7000, z4: 8000 };

export function isLiveBoard(board: Board, round: LiveRoundData | null | undefined): boolean {
  return Boolean(round && round.competition === board.competition && (board.kind === "jogos" || board.kind === "tabela"));
}

export function withLiveRound(board: Board, round: LiveRoundData | null | undefined): Board {
  if (!round || !isLiveBoard(board, round)) return board;
  if (board.kind === "jogos" && round.matches.length) return { ...board, matches: round.matches };
  if (board.kind === "tabela" && round.table.length) return { ...board, groups: round.table };
  return board;
}

function Crest({ team, size }: { team: BoardTeam; size: number }) {
  return team.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={team.logo} alt="" style={{ width: size, height: size }} className="shrink-0 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]" />
  ) : (
    <span style={{ width: size * 0.8, height: size * 0.8 }} className="shrink-0 rounded-full bg-neutral-600" />
  );
}

// A football drawn in SVG (emoji fonts are not on every output machine).
function Ball({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="drop-shadow-[0_0_10px_rgba(223,255,0,0.8)]">
      <circle cx="50" cy="50" r="47" fill="#fff" stroke="#111" strokeWidth="4" />
      <polygon points="50,30 69,44 62,66 38,66 31,44" fill="#111" />
      <path d="M50 30 L50 4 M69 44 L93 36 M62 66 L77 88 M38 66 L23 88 M31 44 L7 36" stroke="#111" strokeWidth="4" />
    </svg>
  );
}

function GoalBanner({ alert }: { alert: Extract<RoundAlertData, { kind: "gol" }> }) {
  // The side that scored stands out (bigger crest, lime name); the other steps back.
  const side = (s: "home" | "away") => {
    const team = s === "home" ? alert.home : alert.away;
    const mine = alert.side === s;
    const crest = mine ? (
      <span className="goal-crest flex">
        <Crest team={team} size={80} />
      </span>
    ) : (
      <Crest team={team} size={40} />
    );
    const name = (
      <span
        className="min-w-0 truncate uppercase"
        style={{ ...CONDENSED, fontWeight: 700, fontSize: mine ? 36 : 26, color: mine ? LIME : "rgba(255,255,255,0.55)", textShadow: mine ? "0 0 14px rgba(223,255,0,0.55)" : undefined }}
      >
        {team.abbr || team.name}
      </span>
    );
    return (
      <span className={`flex items-center gap-3 ${mine ? "goal-side" : "opacity-80"}`}>
        {s === "home" ? (
          <>
            {crest}
            {name}
          </>
        ) : (
          <>
            {name}
            {crest}
          </>
        )}
      </span>
    );
  };
  const number = (s: "home" | "away") => {
    const mine = alert.side === s;
    return (
      <span className="relative" style={{ color: mine ? LIME : "#fff" }}>
        {s === "home" ? alert.home.score : alert.away.score}
        {/* The ball pops out of the score that changed and stays above it. */}
        {mine && (
          <span className="goal-ball absolute left-1/2" style={{ top: -10, marginLeft: -23 }}>
            <Ball size={46} />
          </span>
        )}
      </span>
    );
  };
  return (
    // Not clipped: the ball rises above the banner's edge.
    <div className="flex h-full items-stretch rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)]" style={{ background: "#0c0c0c", border: `3px solid ${LIME}` }}>
      <div className="round-alert-flash flex w-[170px] shrink-0 items-center justify-center rounded-l-[13px]" style={{ background: LIME }}>
        <span className="goal-word text-black" style={{ ...DISPLAY, fontSize: 70, lineHeight: 1 }}>
          GOL!
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-5">
        <div className="flex items-center gap-4">
          {side("home")}
          <span className="flex items-baseline gap-3 tabular-nums" style={{ ...DISPLAY, fontSize: 60, lineHeight: 1 }}>
            {number("home")}
            <span className="text-white/60" style={{ fontSize: 34 }}>
              ×
            </span>
            {number("away")}
          </span>
          {side("away")}
        </div>
        <p className="mt-1 truncate uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 25 }}>
          <span style={{ color: LIME }}>GOL DO {alert.team.name}</span>
          <span className="text-white/80">
            {alert.minute && ` · ${alert.minute}`}
            {alert.player && ` · ${alert.player}`}
          </span>
        </p>
      </div>
    </div>
  );
}

function Z4Banner({ alert }: { alert: Extract<RoundAlertData, { kind: "z4" }> }) {
  const line = (label: string, teams: BoardTeam[], color: string) =>
    teams.length > 0 && (
      <div className="flex items-center gap-3">
        <span className="shrink-0 uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 24, color }}>
          {label}
        </span>
        {teams.map((t) => (
          <span key={t.id ?? t.name} className="flex items-center gap-2">
            <Crest team={t} size={40} />
            <span className="text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 28 }}>
              {t.name}
            </span>
          </span>
        ))}
      </div>
    );
  return (
    <div className="flex h-full items-stretch overflow-hidden rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)]" style={{ background: "#0c0c0c", border: "3px solid #ef4444" }}>
      <div className="round-alert-flash flex w-[190px] shrink-0 flex-col items-center justify-center bg-[#ef4444] text-center text-white">
        <span style={{ ...DISPLAY, fontSize: 30, lineHeight: 1 }}>ZONA DE</span>
        <span style={{ ...DISPLAY, fontSize: 30, lineHeight: 1.1 }}>REBAIXA-</span>
        <span style={{ ...DISPLAY, fontSize: 30, lineHeight: 1 }}>MENTO</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-5">
        {line("ENTROU", alert.entered, "#ef4444")}
        {line("SAIU", alert.left, LIME)}
      </div>
    </div>
  );
}

// badge: the corner score tag is on screen. Goals then grow out of the tag
// (top-left) instead of dropping in at the top center, and the tag hides
// while the goal is up.
export function RoundAlerts({
  alerts,
  withSound,
  badge = null,
}: {
  alerts: RoundAlertData[];
  withSound: boolean;
  badge?: { matches: BoardMatch[]; logo: string | null } | null;
}) {
  const soundKey = [...new Set(alerts.map((a) => (a.kind === "gol" ? a.sound : null)).filter((u): u is string => Boolean(u)))].join("|");
  useEffect(() => {
    if (withSound && soundKey) preloadSounds(soundKey.split("|"));
  }, [soundKey, withSound]);
  // Alerts already there when this screen opened are old news.
  const [seen] = useState(() => new Set(alerts.map((a) => a.id)));
  const [queue, setQueue] = useState<RoundAlertData[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    const fresh = alerts.filter((a) => !seen.has(a.id));
    if (!fresh.length) return;
    for (const a of fresh) seen.add(a.id);
    const id = setTimeout(() => setQueue((q) => [...q, ...fresh]), 0);
    return () => clearTimeout(id);
  }, [alerts, seen]);

  useEffect(() => {
    if (!current) return;
    if (withSound && current.kind === "gol" && current.sound) playQuickSound(current.sound);
    const id = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS[current.kind]);
    return () => clearTimeout(id);
  }, [current, withSound]);

  const tag = badge && badge.matches.length > 0 ? <ScoreBadge matches={badge.matches} logo={badge.logo} /> : null;
  if (!current) return tag;
  if (badge && current.kind === "gol") {
    // The tag flashes first, then the goal grows out of it and folds back in.
    return (
      <>
        <div key={`flash-${current.id}`} className="tag-flash">
          {tag}
        </div>
        <div
          key={current.id}
          className="goal-from-tag pointer-events-none absolute z-[57]"
          style={{ left: 24, top: 22, width: 860, height: 132, animationDuration: `${SHOW_MS.gol}ms`, animationDelay: "650ms" }}
        >
          <GoalBanner alert={current} />
        </div>
      </>
    );
  }
  return (
    <>
    {tag}
    <div
      key={current.id}
      className="round-alert pointer-events-none absolute left-1/2 z-[57]"
      style={{ top: 18, width: 860, height: 132, marginLeft: -430, animationDuration: `${SHOW_MS[current.kind]}ms` }}
    >
      {current.kind === "gol" ? <GoalBanner alert={current} /> : <Z4Banner alert={current} />}
    </div>
    </>
  );
}

// ------------------------------------------------ over the cameras

export const STRIP_H = 58;
export const MINI_W = 300;
const PAGE = 5;
const PAGE_MS = 8000;

function useTick(ms: number, active: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms, active]);
  return n;
}

// Every score of the round in a strip under the cameras, five at a time.
type Rect = { left: number; top: number; width: number; height: number; zIndex?: number };

function matchClock(m: BoardMatch) {
  return m.state === "in" ? m.detail : m.state === "post" ? "FIM" : new Date(m.date).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

// Tall box (drawn layouts): the scores as a list, a page at a time.
function ScoresList({ matches, logo, rect }: { matches: BoardMatch[]; logo: string | null; rect: Rect }) {
  const head = 46;
  const perPage = Math.max(1, Math.min(matches.length, Math.floor((rect.height - head - 4) / 40)));
  const pages = Math.max(1, Math.ceil(matches.length / perPage));
  const page = useTick(PAGE_MS, pages > 1) % pages;
  const shown = matches.slice(page * perPage, page * perPage + perPage);
  const rowH = Math.min(64, Math.floor((rect.height - head - 4) / perPage));
  return (
    <div className="absolute flex flex-col overflow-hidden rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.55)]" style={{ zIndex: 31, ...rect, background: "#0c0c0c", border: `2px solid ${LIME}` }}>
      <div className="flex shrink-0 items-center gap-2 px-3" style={{ height: head, background: "#141414", borderBottom: `2px solid ${LIME}` }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-8 w-8 shrink-0 object-contain" />
        )}
        <span className="flex-1 uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 20, color: LIME }}>
          Jogos da rodada
        </span>
        <span className="live-dot text-[15px] font-bold text-red-500">●</span>
      </div>
      <div key={page} className="round-strip-page flex min-h-0 flex-1 flex-col">
        {shown.map((m, i) => (
          <div key={m.id ?? i} className="flex items-center justify-center gap-2 px-2" style={{ height: rowH, background: i % 2 ? "#181818" : "#121212" }}>
            <span className="w-[52px] text-right text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 19 }}>
              {m.home.abbr}
            </span>
            <Crest team={m.home} size={Math.min(34, rowH - 10)} />
            <span className="flex w-[64px] flex-col items-center leading-none">
              <span className="tabular-nums" style={{ ...DISPLAY, fontSize: 24, color: m.state === "pre" ? "#9a9a9a" : LIME }}>
                {m.home.score === null ? "×" : `${m.home.score}-${m.away.score}`}
              </span>
              <span className={`text-[12px] font-bold ${m.state === "in" ? "text-red-500" : "text-neutral-400"}`} style={CONDENSED}>
                {matchClock(m)}
              </span>
            </span>
            <Crest team={m.away} size={Math.min(34, rowH - 10)} />
            <span className="w-[52px] text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 19 }}>
              {m.away.abbr}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoundStrip({ matches, logo, rect }: { matches: BoardMatch[]; logo: string | null; rect: Rect }) {
  if (rect.height > rect.width * 0.45) return <ScoresList matches={matches} logo={logo} rect={rect} />;
  return <ScoresStrip matches={matches} logo={logo} rect={rect} />;
}

function ScoresStrip({ matches, logo, rect }: { matches: BoardMatch[]; logo: string | null; rect: Rect }) {
  const pages = Math.max(1, Math.ceil(matches.length / PAGE));
  const page = useTick(PAGE_MS, pages > 1) % pages;
  const shown = matches.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div
      className="absolute z-[31] flex overflow-hidden rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
      style={{ zIndex: 31, ...rect, background: "#0c0c0c", border: `2px solid ${LIME}` }}
    >
      {/* The competition's logo opens the strip. */}
      <div className="flex shrink-0 items-center justify-center px-2" style={{ width: Math.max(64, rect.height * 1.25), background: "#141414", borderRight: `2px solid ${LIME}` }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="max-h-[86%] max-w-full object-contain" />
        ) : (
          <span style={{ ...DISPLAY, fontSize: 20, color: LIME }}>RODADA</span>
        )}
      </div>
      <div key={page} className="round-strip-page flex min-w-0 flex-1">
        {shown.map((m, i) => (
          <div key={m.id ?? i} className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-1" style={{ borderLeft: i ? "1px solid #2b2b2b" : undefined }}>
            <Crest team={m.home} size={30} />
            <span className="text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 19 }}>
              {m.home.abbr}
            </span>
            <span className="flex flex-col items-center leading-none">
              <span className="tabular-nums" style={{ ...DISPLAY, fontSize: 26, color: m.state === "pre" ? "#9a9a9a" : LIME }}>
                {m.home.score === null ? "×" : `${m.home.score}-${m.away.score}`}
              </span>
              <span className={`text-[12px] font-bold ${m.state === "in" ? "text-red-500" : "text-neutral-400"}`} style={CONDENSED}>
                {matchClock(m)}
              </span>
            </span>
            <span className="text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 19 }}>
              {m.away.abbr}
            </span>
            <Crest team={m.away} size={30} />
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex w-[34px] shrink-0 flex-col items-center justify-center gap-1">
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className="h-2 w-2 rounded-full" style={{ background: i === page ? LIME : "#3a3a3a" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// A slice of the live table (e.g. 12º to 18º, the relegation fight) in the corner.
export function MiniTable({ rows, title, logo, rect }: { rows: BoardRow[]; title: string; logo: string | null; rect: Rect }) {
  const head = 46;
  // The table fills its whole box (no gap under it).
  const height = rect.height;
  const rowH = Math.floor((height - head - 4) / Math.max(1, rows.length));
  const crest = Math.min(44, rowH - 14);
  return (
    <div
      className="absolute z-[31] flex flex-col overflow-hidden rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
      style={{ zIndex: 31, ...rect, background: "#0c0c0c", border: `2px solid ${LIME}` }}
    >
      <div className="flex shrink-0 items-center gap-2 px-3" style={{ height: head, background: "#141414", borderBottom: `2px solid ${LIME}` }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-8 w-8 shrink-0 object-contain" />
        )}
        <span className="min-w-0 flex-1 truncate uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: title.length > 20 ? 17 : 20, color: LIME }}>
          {title}
        </span>
        <span className="live-dot shrink-0 text-[15px] font-bold text-red-500">●</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={`${r.rank}-${r.team.name}-${r.points}`}
          className="board-row flex min-h-0 flex-1 items-center gap-1.5 pr-2"
          style={{ background: i % 2 ? "#181818" : "#121212", borderLeft: `5px solid ${r.zone ?? "transparent"}`, animationDelay: `${i * 40}ms` }}
        >
          <span className="w-[34px] text-center tabular-nums" style={{ ...DISPLAY, color: LIME, fontSize: Math.min(32, rowH * 0.55) }}>
            {r.rank}
          </span>
          <span className="w-[30px] text-center tabular-nums" style={{ ...CONDENSED, fontWeight: 700, fontSize: 15, color: (r.move ?? 0) > 0 ? "#22c55e" : (r.move ?? 0) < 0 ? "#ef4444" : "#6b6b6b" }}>
            {(r.move ?? 0) > 0 ? `▲${r.move}` : (r.move ?? 0) < 0 ? `▼${-(r.move ?? 0)}` : "–"}
          </span>
          <Crest team={r.team} size={crest} />
          <span className="min-w-0 flex-1 truncate text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: Math.min(20, rowH * 0.45) }}>
            {r.team.name.length > 10 ? r.team.abbr || r.team.name : r.team.name}
          </span>
          {r.playing && (
            <span className="rounded px-1 tabular-nums text-white" style={{ ...CONDENSED, fontWeight: 700, fontSize: 15, background: "#b91c1c" }}>
              {r.playing}
            </span>
          )}
          <span className="w-[36px] text-right tabular-nums" style={{ ...DISPLAY, color: LIME, fontSize: Math.min(32, rowH * 0.55) }}>
            {r.points}
          </span>
        </div>
      ))}
    </div>
  );
}

// Small score tag in the top-left corner: the games in progress (one at a
// time when several), else the round's latest result or next game.
export function ScoreBadge({ matches, logo }: { matches: BoardMatch[]; logo: string | null }) {
  const live = matches.filter((m) => m.state === "in");
  const pool = live.length ? live : matches.filter((m) => m.state === "post").slice(-1).concat(matches.filter((m) => m.state === "pre").slice(0, 1)).slice(0, 1);
  const i = useTick(6000, pool.length > 1) % Math.max(1, pool.length);
  const m = pool[i];
  if (!m) return null;
  return (
    <div
      key={m.id ?? i}
      className="round-strip-page absolute z-[31] flex items-center gap-2 rounded-xl px-3 shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
      style={{ left: 24, top: 22, height: 54, background: "#0c0c0c", border: `2px solid ${LIME}` }}
    >
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-9 w-9 shrink-0 object-contain" />
      )}
      <Crest team={m.home} size={32} />
      <span className="text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 22 }}>
        {m.home.abbr}
      </span>
      <span className="tabular-nums" style={{ ...DISPLAY, fontSize: 30, color: m.state === "pre" ? "#9a9a9a" : LIME }}>
        {m.home.score === null ? "×" : `${m.home.score}-${m.away.score}`}
      </span>
      <span className="text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 22 }}>
        {m.away.abbr}
      </span>
      <Crest team={m.away} size={32} />
      <span className={`ml-1 rounded px-1.5 text-[15px] font-bold ${m.state === "in" ? "live-dot bg-[#b91c1c] text-white" : "bg-neutral-800 text-neutral-300"}`} style={CONDENSED}>
        {matchClock(m)}
      </span>
    </div>
  );
}
