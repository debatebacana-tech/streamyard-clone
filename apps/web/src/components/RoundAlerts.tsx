"use client";

import { useEffect, useState } from "react";
import type { Board, BoardTeam, LiveRoundData, RoundAlertData } from "@/lib/scene";
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
