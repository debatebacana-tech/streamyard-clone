"use client";

import { useState } from "react";
import { shootoutState, undoKick, type Kick, type Penalties } from "@/lib/scene";
import { useDirector } from "./context";

// TV-style match extras on air: penalty shootout, red cards, stoppage time
// and two-legged aggregate. Every change goes straight to air.

const btn = "rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700 disabled:opacity-40";

function useScoreboard() {
  const { scenes, patch, sceneRequest } = useDirector();
  const sb = scenes.live.scoreboard;
  const air = (scoreboard: unknown) => patch({ scoreboard }, { air: true });
  return { sb, air, sceneRequest };
}

export function RedCardButton({ side }: { side: "home" | "away" }) {
  const { sb, air } = useScoreboard();
  const n = sb[side].redCards;
  return (
    <span className="inline-flex items-center gap-0.5">
      <button className={btn} title="Cartão vermelho" onClick={() => air({ [side]: { redCards: Math.min(5, n + 1) } })}>
        🟥{n > 0 && <b className="ml-0.5">{n}</b>}
      </button>
      {n > 0 && (
        <button className={btn} title="Tirar cartão" onClick={() => air({ [side]: { redCards: n - 1 } })}>
          −
        </button>
      )}
    </span>
  );
}

export function ExtraSelect() {
  const { sb, air } = useScoreboard();
  return (
    <select
      className="rounded bg-neutral-800 px-1.5 py-1 text-xs"
      title="Acréscimos"
      value={sb.clock.extra}
      onChange={(e) => air({ clock: { extra: Number(e.target.value) } })}
    >
      <option value={0}>sem acréscimo</option>
      {Array.from({ length: 15 }, (_, i) => i + 1).map((m) => (
        <option key={m} value={m}>
          +{m} acréscimo
        </option>
      ))}
    </select>
  );
}

export function AggregateInput() {
  const { sb, air } = useScoreboard();
  const [value, setValue] = useState(sb.aggregate);
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-300">
      Agregado
      <input
        className="w-44 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
        placeholder="ex: AGREGADO 3-2 (vazio = some)"
        value={value}
        maxLength={40}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== sb.aggregate && air({ aggregate: value })}
      />
    </label>
  );
}

// Penalty shootout controls: start, who kicks first, scored/missed per team, undo.
export function PenaltyControls({ compact = false }: { compact?: boolean }) {
  const { sb, air, sceneRequest } = useScoreboard();
  const p = sb.penalties;
  const st = shootoutState(p);
  const setPens = (next: Partial<Penalties>) => air({ penalties: next });

  async function start() {
    if (sb.clock.running) await sceneRequest({ action: "clock", op: "pause" });
    air({ visible: true, penalties: { active: true, home: [], away: [] }, clock: { period: "PÊN", extra: 0 } });
  }

  if (!p.active) {
    return (
      <button className="rounded bg-neutral-800 px-3 py-1 text-xs font-bold hover:bg-neutral-700" onClick={start}>
        ⚽ Pênaltis
      </button>
    );
  }

  const name = (side: "home" | "away") => sb[side].name || (side === "home" ? "Casa" : "Visitante");
  const kick = (side: "home" | "away", k: Kick) => setPens({ [side]: [...p[side], k] });
  const team = (side: "home" | "away") => (
    <span className={`flex items-center gap-1 rounded px-1.5 py-1 ${st.next === side ? "bg-[#DFFF00]/15 ring-1 ring-[#DFFF00]" : ""}`}>
      <b className="max-w-[7rem] truncate text-xs uppercase">{name(side)}</b>
      <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-bold hover:bg-emerald-500 disabled:opacity-40" disabled={!!st.winner} onClick={() => kick(side, "goal")}>
        ⚽ Fez
      </button>
      <button className="rounded bg-red-700 px-2 py-1 text-xs font-bold hover:bg-red-600 disabled:opacity-40" disabled={!!st.winner} onClick={() => kick(side, "miss")}>
        ✕ Perdeu
      </button>
      <b className="w-5 text-center tabular-nums">{side === "home" ? st.homeGoals : st.awayGoals}</b>
    </span>
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "rounded-md bg-neutral-950 p-2"}`}>
      <span className="text-xs font-bold text-[#DFFF00]">PÊNALTIS</span>
      {p.home.length + p.away.length === 0 && (
        <span className="flex items-center gap-1 text-xs text-neutral-400">
          começa:
          {(["home", "away"] as const).map((side) => (
            <button key={side} className={`${btn} ${p.first === side ? "ring-1 ring-[#DFFF00]" : ""}`} onClick={() => setPens({ first: side })}>
              {name(side)}
            </button>
          ))}
        </span>
      )}
      {team("home")}
      {team("away")}
      <span className="text-xs text-neutral-400">
        {st.winner ? <b className="text-[#DFFF00]">{name(st.winner)} venceu</b> : st.next && <>vez de <b className="text-neutral-200">{name(st.next)}</b></>}
      </span>
      <button className={btn} disabled={p.home.length + p.away.length === 0} onClick={() => setPens(undoKick(p))}>
        ↶ Desfazer
      </button>
      <button
        className={btn}
        onClick={() => confirm("Encerrar a disputa de pênaltis e tirar da tela?") && air({ penalties: { active: false, home: [], away: [] } })}
      >
        Encerrar
      </button>
    </div>
  );
}
