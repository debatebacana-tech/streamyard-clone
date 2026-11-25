"use client";

import { useEffect, useState } from "react";
import type { Board, BoardMatch, BoardRow, BoardTeam, LiveRoundData, RoundAlertData } from "@/lib/scene";
import { LIME } from "./BoardScreen";
import { playQuickSound } from "./MediaLayer";
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

function GoalBanner({ alert }: { alert: Extract<RoundAlertData, { kind: "gol" }> }) {
  const scored = (side: "home" | "away") => (alert.side === side ? LIME : "#fff");
  return (
    <div className="flex h-full items-stretch overflow-hidden rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.7)]" style={{ background: "#0c0c0c", border: `3px solid ${LIME}` }}>
      <div className="round-alert-flash flex w-[190px] shrink-0 items-center justify-center" style={{ background: LIME }}>
        <span className="text-black" style={{ ...DISPLAY, fontSize: 74, lineHeight: 1 }}>
          GOL!
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-6">
        <div className="flex items-center gap-4">
          <Crest team={alert.home} size={56} />
          <span className="min-w-0 truncate text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 32 }}>
            {alert.home.abbr || alert.home.name}
          </span>
          <span className="flex items-baseline gap-3 tabular-nums" style={{ ...DISPLAY, fontSize: 60, lineHeight: 1 }}>
            <span style={{ color: scored("home") }}>{alert.home.score}</span>
            <span className="text-white/70" style={{ fontSize: 36 }}>
              ×
            </span>
            <span style={{ color: scored("away") }}>{alert.away.score}</span>
          </span>
          <span className="min-w-0 truncate text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: 32 }}>
            {alert.away.abbr || alert.away.name}
          </span>
          <Crest team={alert.away} size={56} />
        </div>
        <p className="mt-1 truncate text-white/85 uppercase" style={{ ...CONDENSED, fontWeight: 600, fontSize: 24 }}>
          <span style={{ color: LIME }}>{alert.team.name}</span>
          {alert.minute && <span> · {alert.minute}</span>}
          {alert.player && <span> · {alert.player}</span>}
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

export function RoundAlerts({ alerts, withSound }: { alerts: RoundAlertData[]; withSound: boolean }) {
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

  if (!current) return null;
  return (
    <div
      key={current.id}
      className="round-alert pointer-events-none absolute left-1/2 z-[57]"
      style={{ top: 18, width: 860, height: 132, marginLeft: -430, animationDuration: `${SHOW_MS[current.kind]}ms` }}
    >
      {current.kind === "gol" ? <GoalBanner alert={current} /> : <Z4Banner alert={current} />}
    </div>
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
export function RoundStrip({ matches, bottom }: { matches: BoardMatch[]; bottom: number }) {
  const pages = Math.max(1, Math.ceil(matches.length / PAGE));
  const page = useTick(PAGE_MS, pages > 1) % pages;
  const shown = matches.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div
      className="absolute z-[31] flex overflow-hidden rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
      style={{ left: 24, right: 24, bottom, height: STRIP_H, background: "#0c0c0c", border: `2px solid ${LIME}` }}
    >
      <div className="flex w-[92px] shrink-0 flex-col items-center justify-center text-black" style={{ background: LIME }}>
        <span style={{ ...DISPLAY, fontSize: 22, lineHeight: 1 }}>RODADA</span>
        <span className="live-dot text-[13px] font-bold text-red-700" style={CONDENSED}>
          ● AO VIVO
        </span>
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
                {m.state === "in" ? m.detail : m.state === "post" ? "FIM" : new Date(m.date).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
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
export function MiniTable({
  rows,
  title,
  logo,
  top,
  bottom,
  right,
}: {
  rows: BoardRow[];
  title: string;
  logo: string | null;
  top: number;
  bottom: number;
  right: number;
}) {
  const head = 46;
  // The table fills the whole column, down to the scores strip (no gap under it).
  const height = 720 - top - bottom;
  const rowH = Math.floor((height - head - 4) / Math.max(1, rows.length));
  const crest = Math.min(44, rowH - 14);
  return (
    <div
      className="absolute z-[31] flex flex-col overflow-hidden rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
      style={{ top, right, width: MINI_W, height, background: "#0c0c0c", border: `2px solid ${LIME}` }}
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
