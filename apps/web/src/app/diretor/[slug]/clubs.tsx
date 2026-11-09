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

const isVideo = (url: string) => /\.(mp4|webm)$/i.test(url);

// Vinheta and hino are quick sounds played over the show (like the effect
// pads; Esc or "Parar" cuts them). A video vinheta still plays full screen.
export function ClubMediaButtons({ club, labels = false }: { club: Club; labels?: boolean }) {
  const sendCue = useMediaCues();
  const play = (url: string | null) =>
    url && sendCue({ type: "play", id: crypto.randomUUID(), url, kind: isVideo(url) ? "video" : "audio", volume: 1, toggle: true });
  return (
    <span className="inline-flex gap-1">
      <button className={small} disabled={!club.vinhetaUrl} title={club.vinhetaUrl ? `Vinheta do ${club.name}` : "Sem vinheta cadastrada"} onClick={() => play(club.vinhetaUrl)}>
        📣{labels && " Vinheta"}
      </button>
      <button className={small} disabled={!club.anthemUrl} title={club.anthemUrl ? `Hino do ${club.name}` : "Sem hino cadastrado"} onClick={() => play(club.anthemUrl)}>
        🎵{labels && " Hino"}
      </button>
    </span>
  );
}

// Áudio tab: the two clubs of today's game as big pads, plus any other club.
export function ClubPads() {
  const { scenes } = useDirector();
  const sendCue = useMediaCues();
  const { clubs } = useClubs();
  const [other, setOther] = useState("");
  const sb = scenes.live.scoreboard;
  const game = [clubFor(clubs, sb.home.name), clubFor(clubs, sb.away.name)].filter((c): c is Club => c !== null);
  const extra = clubs.find((c) => c.id === other);
  const list = [...game, ...(extra && !game.includes(extra) ? [extra] : [])];
  const play = (url: string | null) =>
    url && sendCue({ type: "play", id: crypto.randomUUID(), url, kind: isVideo(url) ? "video" : "audio", volume: 1, toggle: true });

  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-sm text-neutral-500">Escolha os clubes do jogo na aba Placar (ou um clube abaixo).</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-md bg-neutral-950 p-2" style={{ borderLeft: `5px solid ${c.color}` }}>
            <Crest url={c.crestUrl} size={44} />
            <span className="min-w-0 flex-1 truncate font-bold">{c.name}</span>
            <button
              className="rounded-md bg-[#DFFF00] px-4 py-3 text-sm font-bold text-black hover:brightness-110 disabled:opacity-30"
              disabled={!c.vinhetaUrl}
              onClick={() => play(c.vinhetaUrl)}
            >
              📣 Vinheta
            </button>
            <button
              className="rounded-md bg-neutral-200 px-4 py-3 text-sm font-bold text-black hover:bg-white disabled:opacity-30"
              disabled={!c.anthemUrl}
              onClick={() => play(c.anthemUrl)}
            >
              🎵 Hino
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={input} value={other} onChange={(e) => setOther(e.target.value)}>
          <option value="">Outro clube...</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className={small} onClick={() => sendCue({ type: "stop" })}>
          ⏹ Parar (Esc)
        </button>
      </div>
    </div>
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

// Type a few letters, pick the club: no long list to scroll.
function ClubSearch({ clubs, placeholder, onPick }: { clubs: Club[]; placeholder: string; onPick: (club: Club) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const results = q.trim() ? clubs.filter((c) => norm(`${c.name} ${c.short}`).includes(norm(q.trim()))).slice(0, 8) : [];
  const choose = (c: Club) => {
    onPick(c);
    setQ("");
    setOpen(false);
  };
  return (
    <div className="relative min-w-0 flex-1">
      <input
        className={`${input} w-full`}
        value={q}
        placeholder={placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) choose(results[0]);
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && q.trim() && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-neutral-700 bg-neutral-900 shadow-2xl">
          {results.length === 0 && <li className="px-3 py-2 text-xs text-neutral-500">Nenhum clube com esse nome</li>}
          {results.map((c) => (
            <li key={c.id}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => choose(c)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-800">
                <Crest url={c.crestUrl} size={22} />
                {c.name}
                {c.short && <span className="text-xs text-neutral-500">{c.short}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ClubsPanel() {
  const { slug, scenes, patch, addAsset } = useDirector();
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
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold">{sb[side].name || "—"}</p>
          <ClubSearch clubs={clubs} placeholder="Pesquisar e trocar o clube..." onPick={(c) => setTeam(side, c)} />
        </div>
      </div>
      {(side === "home" ? home : away) && <ClubMediaButtons club={(side === "home" ? home : away)!} labels />}
    </div>
  );

  // The library stays closed: search a club to edit it (the game's clubs show by default).
  const shown = filter
    ? clubs.filter((c) => c.id === filter)
    : [home, away].filter((c): c is Club => c !== null && c !== undefined);

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md bg-neutral-950 p-3">
        <p className="text-sm font-semibold">Jogo de hoje</p>
        <div className="grid grid-cols-2 gap-3">
          {pick("home")}
          {pick("away")}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button className={small} onClick={() => sendCue({ type: "stop" })}>
            ⏹ Parar vinheta/hino (Esc)
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Editar clube (vinheta, hino, escudo):</span>
          <ClubSearch clubs={clubs} placeholder={`Pesquisar entre ${clubs.length} clubes salvos...`} onPick={(c) => setFilter(c.id)} />
          {filter && (
            <button className={small} onClick={() => setFilter("")}>
              fechar
            </button>
          )}
        </div>
      </div>

      <ul className="max-h-[480px] space-y-1 overflow-y-auto">
        {clubs.length === 0 && <li className="text-sm text-neutral-500">Nenhum clube salvo ainda. Importe os times de um campeonato ou adicione um por um.</li>}
        {clubs.length > 0 && shown.length === 0 && <li className="text-xs text-neutral-500">Pesquise um clube acima para enviar vinheta, hino ou escudo.</li>}
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
            <UploadButton slug={slug} accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,video/mp4,video/webm" label="Vinheta" role="clube" onUploaded={async (a) => { addAsset(a); await call("PATCH", { id: c.id, vinhetaUrl: a.url }); }} />
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
