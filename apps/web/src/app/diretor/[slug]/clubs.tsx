"use client";

import { useCallback, useEffect, useState } from "react";
import { useMediaCues } from "@/components/MediaLayer";
import type { Club } from "@/lib/clubs";
import { COMPETITIONS } from "@/lib/competitions";
import type { BoardGroup } from "@/lib/scene";
import { UploadButton } from "./assets";
import { useDirector } from "./context";

// Club library for match days: crest, color, stinger and anthem saved once.
// Pick the two clubs of the game and the scoreboard fills itself; the
// stinger/anthem buttons play them on air.

const input = "rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";
const btn = "rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40";
const small = "rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700 disabled:opacity-40";
const CHANGED = "clubs-changed";

export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const load = useCallback(async () => {
    const res = await fetch("/api/clubs");
    if (res.ok) setClubs((await res.json()).clubs);
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0);
    window.addEventListener(CHANGED, load);
    return () => {
      clearTimeout(first);
      window.removeEventListener(CHANGED, load);
    };
  }, [load]);
  return { clubs, reload: () => window.dispatchEvent(new Event(CHANGED)) };
}

export function clubFor(clubs: Club[], name: string): Club | null {
  const n = name.trim().toLowerCase();
  return clubs.find((c) => c.name.toLowerCase() === n || (c.short && c.short.toLowerCase() === n)) ?? null;
}

// 🎬 / 🎵 buttons for one club (stinger as a full-screen cue, anthem as the background track).
export function ClubMediaButtons({ club, labels = false }: { club: Club; labels?: boolean }) {
  const { sceneRequest } = useDirector();
  const sendCue = useMediaCues();
  return (
    <span className="inline-flex gap-1">
      <button
        className={small}
        disabled={!club.vinhetaUrl}
        title={club.vinhetaUrl ? `Vinheta do ${club.name}` : "Sem vinheta cadastrada"}
        onClick={() => club.vinhetaUrl && sendCue({ type: "play", id: crypto.randomUUID(), url: club.vinhetaUrl, kind: "video", volume: 1 })}
      >
        🎬{labels && " Vinheta"}
      </button>
      <button
        className={small}
        disabled={!club.anthemUrl}
        title={club.anthemUrl ? `Hino do ${club.name}` : "Sem hino cadastrado"}
        onClick={() => club.anthemUrl && sceneRequest({ action: "music", op: "play", url: club.anthemUrl, title: `Hino — ${club.name}`, loop: false, volume: 0.9 })}
      >
        🎵{labels && " Hino"}
      </button>
    </span>
  );
}

function Crest({ url, size = 32 }: { url: string | null; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="shrink-0 object-contain" style={{ width: size, height: size }} />
  ) : (
    <span className="shrink-0 rounded-full bg-neutral-700" style={{ width: size * 0.8, height: size * 0.8 }} />
  );
}

export function ClubsPanel() {
  const { slug, scenes, patch, sceneRequest, addAsset } = useDirector();
  const sendCue = useMediaCues();
  const { clubs, reload } = useClubs();
  const [name, setName] = useState("");
  const [competition, setCompetition] = useState("bra.1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const sb = scenes.live.scoreboard;
  const home = clubFor(clubs, sb.home.name);
  const away = clubFor(clubs, sb.away.name);

  async function call(method: string, body?: unknown, query = "") {
    setError(null);
    const res = await fetch(`/api/clubs${query}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Falha");
    reload();
    return res.ok;
  }

  async function importTeams() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/football?competition=${competition}&kind=tabela`);
      const data = (await res.json()) as { groups?: BoardGroup[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha");
      const teams = (data.groups ?? []).flatMap((g) => g.rows.map((r) => r.team));
      await call("POST", { clubs: teams.map((t) => ({ name: t.name, short: t.abbr, crestUrl: t.logo })) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    }
    setBusy(false);
  }

  const setTeam = (side: "home" | "away", club: Club | undefined) =>
    club && patch({ scoreboard: { [side]: { name: club.name, crestUrl: club.crestUrl, color: club.color, score: 0, redCards: 0 } } }, { air: true });

  // Pre-match ritual: both stingers back to back would collide, so one at a time.
  const pick = (side: "home" | "away") => (
    <div className="space-y-1">
      <span className="text-xs text-neutral-400">{side === "home" ? "Casa" : "Visitante"}</span>
      <div className="flex items-center gap-2">
        <Crest url={(side === "home" ? home : away)?.crestUrl ?? sb[side].crestUrl} />
        <select
          className={`${input} min-w-0 flex-1`}
          // Always "choose": picking the club already named still re-applies crest and color.
          value=""
          onChange={(e) => setTeam(side, clubs.find((c) => c.id === e.target.value))}
        >
          <option value="">{sb[side].name ? `${sb[side].name} (no placar) — trocar…` : "— escolha o clube —"}</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {(side === "home" ? home : away) && <ClubMediaButtons club={(side === "home" ? home : away)!} labels />}
    </div>
  );

  const shown = clubs.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md bg-neutral-950 p-3">
        <p className="text-sm font-semibold">Jogo de hoje</p>
        <div className="grid grid-cols-2 gap-3">
          {pick("home")}
          {pick("away")}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button className={small} onClick={() => sceneRequest({ action: "music", op: "stop" })}>
            ⏹ Parar hino
          </button>
          <button className={small} onClick={() => sendCue({ type: "stop" })}>
            ⏹ Parar vinheta
          </button>
        </div>
        <p className="text-[11px] text-neutral-500">Escolher o clube já põe nome, escudo e cor no placar (e zera o placar).</p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${input} w-48`}
            value={name}
            placeholder="Novo clube (nome)"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={async (e) => e.key === "Enter" && name.trim() && (await call("POST", { name })) && setName("")}
          />
          <button className={btn} disabled={!name.trim()} onClick={async () => (await call("POST", { name })) && setName("")}>
            Adicionar
          </button>
          <span className="text-xs text-neutral-500">ou todos de</span>
          <select className={input} value={competition} onChange={(e) => setCompetition(e.target.value)}>
            {COMPETITIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button className={btn} disabled={busy} onClick={importTeams}>
            {busy ? "Buscando..." : "Importar com escudos"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {clubs.length > 8 && <input className={`${input} w-full`} placeholder="Procurar clube..." value={filter} onChange={(e) => setFilter(e.target.value)} />}
      </div>

      <ul className="max-h-[480px] space-y-1 overflow-y-auto">
        {clubs.length === 0 && <li className="text-sm text-neutral-500">Nenhum clube salvo ainda. Importe os times de um campeonato ou adicione um por um.</li>}
        {shown.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-md bg-neutral-900 px-2 py-1.5 text-sm">
            <Crest url={c.crestUrl} />
            <input
              type="color"
              value={c.color}
              title="Cor do clube no placar"
              onChange={(e) => call("PATCH", { id: c.id, color: e.target.value })}
              className="h-7 w-8 cursor-pointer rounded bg-transparent"
            />
            <span className="min-w-[8rem] flex-1 font-semibold">
              {c.name} {c.short && <span className="text-xs text-neutral-500">{c.short}</span>}
            </span>
            <span className={`text-xs ${c.vinhetaUrl ? "text-emerald-400" : "text-neutral-500"}`}>{c.vinhetaUrl ? "✓ vinheta" : "sem vinheta"}</span>
            <UploadButton slug={slug} accept="video/mp4,video/webm" label="Vinheta" role="clube" onUploaded={async (a) => { addAsset(a); await call("PATCH", { id: c.id, vinhetaUrl: a.url }); }} />
            <span className={`text-xs ${c.anthemUrl ? "text-emerald-400" : "text-neutral-500"}`}>{c.anthemUrl ? "✓ hino" : "sem hino"}</span>
            <UploadButton slug={slug} accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a" label="Hino" role="clube" onUploaded={async (a) => { addAsset(a); await call("PATCH", { id: c.id, anthemUrl: a.url }); }} />
            <UploadButton slug={slug} accept="image/png,image/jpeg,image/webp" label="Escudo" role="clube" onUploaded={async (a) => { addAsset(a); await call("PATCH", { id: c.id, crestUrl: a.url }); }} />
            <ClubMediaButtons club={c} />
            <button className="text-xs text-neutral-500 hover:text-red-400" onClick={() => confirm(`Apagar ${c.name}?`) && call("DELETE", undefined, `?id=${c.id}`)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
