"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaCues } from "@/components/MediaLayer";
import type { HotSound } from "@/lib/programConfig";
import { UploadButton } from "./assets";
import { useDirector } from "./context";
import { useProgramConfig } from "./rundown";
import { clubFor, useClubs } from "./clubs";

// The show's signature sounds ("GOL BACANA", "Ele é o nosso melhor amigo"):
// big buttons always on screen, with Z/X/C/V shortcuts, played over everything.

const KEYS = ["z", "x", "c", "v", "b", "n"];
// Today's clubs: home vinheta/hino on A/S, away on D/F.
const CLUB_KEYS = { home: ["a", "s"], away: ["d", "f"] } as const;

function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  return Boolean(el.closest("input, textarea, select, [contenteditable]")) || e.ctrlKey || e.metaKey || e.altKey;
}

// The background track at hand while the signature sounds play: volume, a
// quick "baixar" to talk over it (and back), stop.
function TrackControl() {
  const { scenes, sceneRequest } = useDirector();
  const music = scenes.live.music;
  const playing = Boolean(music.url && music.startedAt);
  const [volume, setVolume] = useState(music.volume);
  const [seen, setSeen] = useState(music.volume);
  if (music.volume !== seen) {
    setSeen(music.volume);
    setVolume(music.volume);
  }
  // Volume before "Baixar" (null = not lowered).
  const [before, setBefore] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const send = (v: number) => {
    setVolume(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => sceneRequest({ action: "music", op: "volume", volume: v }), 120);
  };
  const ducked = before !== null;
  if (!playing) {
    return <span className="rounded-md bg-neutral-900 px-2 py-1.5 text-xs text-neutral-500">🎵 sem trilha tocando</span>;
  }
  return (
    <span className="flex items-center gap-2 rounded-md bg-neutral-900 px-2 py-1" title={music.title}>
      <span className="max-w-36 truncate text-xs font-semibold">🎵 {music.title || "Trilha"}</span>
      <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => send(Number(e.target.value))} className="w-28 accent-[#DFFF00]" />
      <span className="w-8 text-right text-xs tabular-nums">{Math.round(volume * 100)}%</span>
      <button
        onClick={() => {
          if (before !== null) {
            send(before);
            setBefore(null);
          } else {
            setBefore(volume);
            send(Math.min(volume, 0.15));
          }
        }}
        className={`rounded px-2 py-1 text-xs font-bold ${ducked ? "bg-[#DFFF00] text-black" : "bg-neutral-700 hover:bg-neutral-600"}`}
        title="Abaixa a trilha para falar por cima; aperte de novo para voltar"
      >
        {ducked ? "🔊 Voltar" : "🔉 Baixar"}
      </button>
      <button onClick={() => sceneRequest({ action: "music", op: "stop" })} className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600" title="Parar a trilha (com fade)">
        ⏹
      </button>
    </span>
  );
}

// Pre-live / closing track one click away (second click stops it).
function TrackShortcuts({ waiting, closing }: { waiting: string | null; closing: string | null }) {
  const { scenes, sceneRequest } = useDirector();
  const music = scenes.live.music;
  const on = (url: string | null) => Boolean(url && music.url === url && music.startedAt);
  return (
    <>
      {(
        [
          ["Pré-live", waiting, "Trilha de espera", true],
          ["Encerramento", closing, "Trilha de encerramento", false],
        ] as const
      ).map(([label, url, title, loop]) => (
        <button
          key={label}
          disabled={!url}
          onClick={() =>
            on(url)
              ? sceneRequest({ action: "music", op: "stop" })
              : sceneRequest({ action: "music", op: "play", url: url!, title, loop, volume: music.volume || 0.6 })
          }
          title={url ? (on(url) ? "Parar" : `Tocar a ${title.toLowerCase()}`) : `Escolha a ${title.toLowerCase()} na aba Roteiro`}
          className={`rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-35 ${on(url) ? "bg-[#DFFF00] text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}
        >
          {on(url) ? "⏹" : "▶"} {label}
        </button>
      ))}
    </>
  );
}

// Volume of the effect pads (signature sounds, club vinheta/hino): applies to
// what is playing now and to the next presses. Kept in this browser.
const FX_KEY = "studio-fx-volume";
function readFx() {
  try {
    const v = Number(localStorage.getItem(FX_KEY));
    return v > 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

export function HotSoundsBar({ always }: { always: boolean }) {
  const { slug, addAsset, scenes } = useDirector();
  const { clubs } = useClubs();
  const sb = scenes.live.scoreboard;
  // Club vinheta/hino only while a match is on (the scoreboard is on screen).
  const game = sb.visible
    ? (["home", "away"] as const)
        .map((side) => ({ side, club: clubFor(clubs, sb[side].name) }))
        .filter((g) => g.club && (g.club.vinhetaUrl || g.club.anthemUrl))
    : [];
  const [fx, setFx] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => setFx(readFx()), 0);
    return () => clearTimeout(id);
  }, []);
  const changeFx = (v: number) => {
    setFx(v);
    try {
      localStorage.setItem(FX_KEY, String(v));
    } catch {}
    sendCue({ type: "volume", volume: v });
  };
  const playUrl = (url: string | null, flashId: string) => {
    if (!url) return;
    sendCue({ type: "play", id: crypto.randomUUID(), url, kind: /\.(mp4|webm)$/i.test(url) ? "video" : "audio", volume: fx, toggle: true });
    setFlash(flashId);
    setTimeout(() => setFlash((f) => (f === flashId ? null : f)), 600);
  };
  const { config, save } = useProgramConfig();
  const sendCue = useMediaCues();
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const sounds = config?.hotSounds ?? [];

  const play = (s: HotSound) => {
    if (!s.url) return;
    sendCue({ type: "play", id: crypto.randomUUID(), url: s.url, kind: /\.(mp4|webm)$/i.test(s.url) ? "video" : "audio", volume: fx, toggle: true });
    setFlash(s.id);
    setTimeout(() => setFlash((f) => (f === s.id ? null : f)), 600);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        sendCue({ type: "stop" });
        return;
      }
      if (typing(e)) return;
      const key = e.key.toLowerCase();
      const i = KEYS.indexOf(key);
      if (i >= 0 && sounds[i]?.url) {
        e.preventDefault();
        play(sounds[i]);
        return;
      }
      for (const g of game) {
        const k = CLUB_KEYS[g.side].indexOf(key as never);
        const url = k === 0 ? g.club!.vinhetaUrl : k === 1 ? g.club!.anthemUrl : null;
        if (url) {
          e.preventDefault();
          playUrl(url, `${g.side}-${k}`);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const update = (id: string, patch: Partial<HotSound>) => save({ hotSounds: sounds.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const trackOn = Boolean(scenes.live.music.url && scenes.live.music.startedAt);
  if (!config || (!always && !sounds.some((s) => s.url) && !game.length && !editing && !trackOn)) return null;

  return (
    <div className="studio-bar flex flex-wrap items-center gap-2 p-2">
      <span className="studio-label px-2 text-base">DESTAQUES</span>
      {sounds.map((s, i) =>
        editing ? (
          <span key={s.id} className="flex items-center gap-1 rounded-md bg-neutral-800 p-1">
            <input
              type="color"
              value={s.color}
              onChange={(e) => update(s.id, { color: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded bg-transparent"
            />
            <input
              className="w-56 rounded bg-neutral-900 px-2 py-1 text-sm"
              defaultValue={s.label}
              maxLength={60}
              onBlur={(e) => e.target.value.trim() && e.target.value !== s.label && update(s.id, { label: e.target.value.trim() })}
            />
            <UploadButton
              slug={slug}
              accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a"
              label={s.url ? "Trocar áudio" : "Áudio"}
              role="efeito"
              onUploaded={(a) => {
                addAsset(a);
                update(s.id, { url: a.url });
              }}
            />
            <button className="px-1 text-xs text-neutral-500 hover:text-red-400" onClick={() => save({ hotSounds: sounds.filter((x) => x.id !== s.id) })}>
              ✕
            </button>
          </span>
        ) : s.url ? (
          <button
            key={s.id}
            onClick={() => play(s)}
            title={`Tecla ${KEYS[i]?.toUpperCase() ?? ""}`}
            className={`rounded-md px-4 py-2 text-sm font-black text-black uppercase shadow transition ${flash === s.id ? "scale-95 brightness-125" : "hover:brightness-110"}`}
            style={{ background: s.color }}
          >
            {KEYS[i] && <span className="mr-2 rounded bg-black/25 px-1.5 font-mono text-[11px]">{KEYS[i].toUpperCase()}</span>}
            {s.label}
          </button>
        ) : (
          <span key={s.id} className="flex items-center gap-1 rounded-md border border-dashed border-neutral-600 px-2 py-1 text-xs text-neutral-400">
            {s.label}
            <UploadButton
              slug={slug}
              accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a"
              label="enviar áudio"
              role="efeito"
              onUploaded={(a) => {
                addAsset(a);
                update(s.id, { url: a.url });
              }}
            />
          </span>
        ),
      )}
      {!editing &&
        game.map(({ side, club }) => (
          <span key={side} className="flex items-center gap-1 rounded-md bg-neutral-800 p-1 pl-2" style={{ borderLeft: `4px solid ${club!.color}` }}>
            {club!.crestUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club!.crestUrl} alt="" className="h-6 w-6 object-contain" />
            )}
            <span className="pr-1 text-xs font-bold uppercase">{club!.short || club!.name}</span>
            {([
              [club!.vinhetaUrl, "📣 Vinheta", 0],
              [club!.anthemUrl, "🎵 Hino", 1],
            ] as const).map(([url, label, k]) =>
              url ? (
                <button
                  key={k}
                  onClick={() => playUrl(url, `${side}-${k}`)}
                  title={`Tecla ${CLUB_KEYS[side][k].toUpperCase()}`}
                  className={`rounded px-2.5 py-1.5 text-xs font-bold text-black transition ${flash === `${side}-${k}` ? "scale-95 brightness-125" : "hover:brightness-110"}`}
                  style={{ background: k === 0 ? "#DFFF00" : "#e5e5e5" }}
                >
                  <span className="mr-1 rounded bg-black/20 px-1 font-mono text-[10px]">{CLUB_KEYS[side][k].toUpperCase()}</span>
                  {label}
                </button>
              ) : null,
            )}
          </span>
        ))}
      {editing && sounds.length < KEYS.length && (
        <button
          className="rounded-md border border-dashed border-neutral-600 px-3 py-1.5 text-xs text-neutral-300"
          onClick={() => save({ hotSounds: [...sounds, { id: crypto.randomUUID().slice(0, 8), label: "NOVO ÁUDIO", url: null, color: "#f472b6" }] })}
        >
          ＋ Destaque
        </button>
      )}
      <button onClick={() => setEditing((e) => !e)} className="text-xs text-neutral-500 hover:text-neutral-300">
        {editing ? "pronto" : "editar"}
      </button>
      <span className="flex items-center gap-2 rounded-md bg-neutral-900 px-2 py-1" title="Volume dos efeitos (destaques, vinheta e hino)">
        <span className="text-xs font-semibold">🔔 Efeitos</span>
        <input type="range" min={0.05} max={1} step={0.05} value={fx} onChange={(e) => changeFx(Number(e.target.value))} className="w-24 accent-[#DFFF00]" />
        <span className="w-8 text-right text-xs tabular-nums">{Math.round(fx * 100)}%</span>
      </span>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        <span className="studio-label px-1 text-sm">TRILHAS</span>
        <TrackShortcuts waiting={config.waitingTrackUrl} closing={config.closingTrackUrl} />
        <TrackControl />
      </span>
      <button className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700" onClick={() => sendCue({ type: "stop" })}>
        ⏹ Parar (Esc)
      </button>
    </div>
  );
}
