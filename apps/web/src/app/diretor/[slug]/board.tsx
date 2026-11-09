"use client";

import { useEffect, useState } from "react";
import { COMPETITIONS } from "@/lib/competitions";
import type { Board, BoardGroup, BoardMatch } from "@/lib/scene";
import { useDirector } from "./context";

// Round fixtures and standings pulled automatically (ESPN) and shown full
// screen in the show's look.

const input = "rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";
const btn = "rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40";
const btnOn = "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500 disabled:opacity-40";
const btnGo = "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40";

type Kind = "tabela" | "jogos";
type Data = { groups?: BoardGroup[]; matches?: BoardMatch[]; logo: string | null; round?: number | null };

const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

async function fetchBoard(competition: string, kind: Kind, from: string, to: string): Promise<Data> {
  const q = new URLSearchParams({ competition, kind, from, to });
  const res = await fetch(`/api/football?${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Falha ao buscar");
  return data;
}

function boardPatch(kind: Kind, competition: string, title: string, subtitle: string, data: Data): Partial<Board> {
  return {
    kind,
    competition,
    title,
    subtitle,
    logo: data.logo,
    groups: kind === "tabela" ? (data.groups ?? []) : [],
    matches: kind === "jogos" ? (data.matches ?? []) : [],
  };
}

const label = (id: string) => COMPETITIONS.find((c) => c.id === id)?.label ?? "";
const short = (id: string) => COMPETITIONS.find((c) => c.id === id)?.short ?? "";

export function BoardPanel() {
  const { scenes, patch, direct } = useDirector();
  const [competition, setCompetition] = useState(scenes.draft.board.competition || "bra.1");
  const [from, setFrom] = useState(() => isoDay(-3));
  const [to, setTo] = useState(() => isoDay(3));
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState(() => short(scenes.draft.board.competition || "bra.1"));
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ kind: Kind; data: Data } | null>(null);
  const live = scenes.live.board;
  const draft = scenes.draft.board;

  async function load(kind: Kind) {
    setBusy(kind);
    setError(null);
    try {
      const data = await fetchBoard(competition, kind, from, to);
      setData({ kind, data });
      // Suggest the round from the table (leagues only); the director can edit it.
      if (!title.trim()) {
        const table = kind === "tabela" ? data : await fetchBoard(competition, "tabela", from, to).catch(() => null);
        const played = table?.round;
        const ahead = kind === "jogos" && (data.matches ?? []).some((m) => m.state === "pre");
        if (played) setTitle(`${played + (ahead ? 1 : 0)}ª RODADA`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    }
    setBusy(null);
  }

  function show(air: boolean) {
    if (!data) return;
    patch({ board: boardPatch(data.kind, competition, title.trim(), subtitle.trim(), data.data) }, { air });
  }

  function pickCompetition(id: string) {
    setCompetition(id);
    setSubtitle(short(id));
    setTitle("");
    setData(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-neutral-400">Competição</span>
          <select className={`${input} w-full`} value={competition} onChange={(e) => pickCompetition(e.target.value)}>
            {COMPETITIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-xs text-neutral-400">Competição (texto espaçado)</span>
            <input className={`${input} w-full`} value={subtitle} maxLength={80} onChange={(e) => setSubtitle(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-neutral-400">Rodada (preenche sozinho)</span>
            <input className={`${input} w-full`} value={title} maxLength={60} placeholder="ex: 33ª RODADA" onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>

        <div className="space-y-2 rounded-md bg-neutral-950 p-3">
          <p className="text-sm font-semibold">Classificação</p>
          <button className={btn} disabled={busy !== null} onClick={() => load("tabela")}>
            {busy === "tabela" ? "Buscando..." : "Buscar tabela atualizada"}
          </button>
        </div>

        <div className="space-y-2 rounded-md bg-neutral-950 p-3">
          <p className="text-sm font-semibold">Jogos da rodada</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            de <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
            até <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className={btn} disabled={busy !== null} onClick={() => load("jogos")}>
            {busy === "jogos" ? "Buscando..." : "Buscar jogos"}
          </button>
          <p className="text-[11px] text-neutral-500">Pegue as datas da rodada (ex: sábado a quarta). Placares ao vivo atualizam sozinhos enquanto a tela estiver no ar.</p>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="space-y-2 rounded-md bg-neutral-950 p-3 text-sm">
          <p>
            <span className="text-neutral-400">No ar: </span>
            {live.kind === "none" ? "nenhuma" : live.kind === "tabela" ? "Classificação" : "Jogos da rodada"}
            {live.kind !== "none" && <span className="text-neutral-500"> · {label(live.competition)}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {draft.kind !== "none" && !direct && (
              <button className={btn} onClick={() => patch({ board: { kind: "none" } })}>
                Tirar da prévia
              </button>
            )}
            {live.kind !== "none" && (
              <button className={btn} onClick={() => patch({ board: { kind: "none" } }, { air: true })}>
                Tirar do ar
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex max-h-[520px] flex-col overflow-hidden rounded-md border border-neutral-800">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
          <p className="flex-1 text-xs font-semibold text-neutral-400">
            {data ? (data.kind === "tabela" ? "CLASSIFICAÇÃO" : "JOGOS") : "PRÉVIA DOS DADOS"}
          </p>
          {data && !direct && (
            <button className={btnGo} onClick={() => show(false)}>
              Mandar para a prévia
            </button>
          )}
          {data && (
            <button className={btnOn} onClick={() => show(true)}>
              Pôr no ar
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 text-sm">
          {!data && <p className="p-3 text-neutral-500">Escolha a competição e clique em buscar.</p>}
          {data?.kind === "tabela" &&
            (data.data.groups ?? []).map((g, gi) => (
              <div key={gi} className="mb-2">
                {g.name && <p className="px-1 text-xs font-bold text-neutral-400">{g.name}</p>}
                {g.rows.map((r) => (
                  <p key={r.rank + r.team.name} className="flex gap-2 px-1 py-0.5">
                    <span className="w-6 text-right text-neutral-500">{r.rank}</span>
                    <span className="flex-1">{r.team.name}</span>
                    <span className="w-10 text-right text-neutral-500">{r.played}j</span>
                    <span className="w-10 text-right font-bold">{r.points}</span>
                  </p>
                ))}
              </div>
            ))}
          {data?.kind === "jogos" &&
            ((data.data.matches ?? []).length === 0 ? (
              <p className="p-3 text-neutral-500">Nenhum jogo nessas datas.</p>
            ) : (
              (data.data.matches ?? []).map((m, i) => (
                <p key={i} className="flex gap-2 px-1 py-0.5">
                  <span className="w-24 text-neutral-500">
                    {new Date(m.date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="flex-1 text-right">{m.home.name}</span>
                  <span className="w-14 text-center font-bold">{m.home.score === null ? "×" : `${m.home.score} - ${m.away.score}`}</span>
                  <span className="flex-1">{m.away.name}</span>
                  {m.state === "in" && <span className="text-red-400">● {m.detail}</span>}
                </p>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}

// Keeps live scores fresh while the fixtures board is on air (mounted for the
// whole director session, whatever tab is open).
export function BoardAutoRefresh() {
  const { scenes, sceneRequest } = useDirector();
  const board = scenes.live.board;
  const live = board.kind === "jogos" && board.matches.some((m) => m.state !== "post");
  const dates = board.matches.map((m) => m.date);
  const range = dates.length
    ? [Math.min(...dates), Math.max(...dates)].map((d) => new Date(d).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }))
    : null;
  const key = live && range ? `${board.competition}|${range[0]}|${range[1]}` : null;

  useEffect(() => {
    if (!key) return;
    const [competition, from, to] = key.split("|");
    const id = setInterval(async () => {
      try {
        const data = await fetchBoard(competition, "jogos", from, to);
        await sceneRequest({ action: "patch", target: "both", patch: { board: { matches: data.matches ?? [] } } });
      } catch {}
    }, 60_000);
    return () => clearInterval(id);
  }, [key, sceneRequest]);

  return null;
}
