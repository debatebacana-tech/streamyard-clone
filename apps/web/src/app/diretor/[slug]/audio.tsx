"use client";

import { useEffect, useState } from "react";
import { useMediaCues } from "@/components/MediaLayer";
import { UploadButton, type AssetItem } from "./assets";
import { useDirector } from "./context";

const AUDIO_TYPES = "audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a";

function DeleteButton({ asset }: { asset: AssetItem }) {
  const { removeAsset } = useDirector();
  return (
    <button
      onClick={() => confirm(`Apagar "${asset.name}"?`) && removeAsset(asset.id)}
      className="absolute top-1 right-1 hidden rounded bg-black/60 px-1 text-[10px] text-red-300 group-hover:block"
      title="Apagar"
    >
      ✕
    </button>
  );
}

// ------------------------------------------------------------ background track

export function MusicPanel() {
  const { slug, scenes, sceneRequest, assets, addAsset } = useDirector();
  const music = scenes.live.music;
  const playing = Boolean(music.url && music.startedAt);
  const tracks = assets.filter((a) => a.kind === "audio" && a.role === "trilha").reverse();
  const [volume, setVolume] = useState(music.volume);

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-3 rounded-md px-3 py-2 ${playing ? "bg-emerald-900/40" : "bg-neutral-950"}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${playing ? "animate-pulse bg-emerald-400" : "bg-neutral-600"}`} />
        <span className="min-w-0 flex-1 truncate text-sm">
          {playing ? (
            <>
              Tocando: <b>{music.title || tracks.find((t) => t.url === music.url)?.name || "trilha"}</b>
              {!music.loop && <span className="text-neutral-400"> (uma vez)</span>}
            </>
          ) : (
            <span className="text-neutral-400">Nenhuma trilha tocando</span>
          )}
        </span>
        {playing && (
          <button onClick={() => sceneRequest({ action: "music", op: "stop" })} className="rounded bg-neutral-700 px-3 py-1 text-xs hover:bg-neutral-600">
            ■ Parar (fade)
          </button>
        )}
      </div>

      {tracks.length === 0 ? (
        <p className="text-sm text-neutral-500">Envie as trilhas (MP3/WAV). Elas tocam em loop, uma de cada vez, por baixo das vozes.</p>
      ) : (
        <ul className="space-y-1">
          {tracks.map((t) => {
            const active = playing && music.url === t.url;
            return (
              <li key={t.id} className="group relative flex items-center gap-2 rounded bg-neutral-800/70 px-2 py-1.5">
                <button
                  onClick={() =>
                    active
                      ? sceneRequest({ action: "music", op: "stop" })
                      : sceneRequest({ action: "music", op: "play", url: t.url, title: t.name, loop: true, volume })
                  }
                  className={`w-8 rounded py-1 text-sm ${active ? "bg-emerald-600" : "bg-neutral-700 hover:bg-neutral-600"}`}
                  title={active ? "Parar" : "Tocar em loop"}
                >
                  {active ? "■" : "▶"}
                </button>
                <span className="flex-1 truncate text-sm">{t.name}</span>
                <DeleteButton asset={t} />
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2 text-xs text-neutral-400">
          Volume da trilha
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            onPointerUp={() => sceneRequest({ action: "music", op: "volume", volume })}
            onKeyUp={() => sceneRequest({ action: "music", op: "volume", volume })}
            className="flex-1"
          />
          <span className="w-8 text-right">{Math.round(volume * 100)}%</span>
        </label>
        <UploadButton slug={slug} accept={AUDIO_TYPES} label="Trilha" role="trilha" onUploaded={addAsset} />
      </div>
    </div>
  );
}

// ------------------------------------------------------ effects and stingers

export function EffectsPanel() {
  const { slug, assets, addAsset } = useDirector();
  const sendCue = useMediaCues();
  const [volume, setVolume] = useState(0.9);
  // Oldest first, so keyboard shortcuts stay put as new pads are added.
  const pads = assets.filter((a) => (a.kind === "audio" || a.kind === "video") && a.role === "efeito").reverse();

  const play = (pad: AssetItem) =>
    sendCue({ type: "play", id: crypto.randomUUID(), url: pad.url, kind: pad.kind === "video" ? "video" : "audio", volume });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") sendCue({ type: "stop" });
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && pads[n - 1]) {
        const pad = pads[n - 1];
        sendCue({ type: "play", id: crypto.randomUUID(), url: pad.url, kind: pad.kind === "video" ? "video" : "audio", volume });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pads, sendCue, volume]);

  return (
    <div className="space-y-3">
      {pads.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Envie efeitos (MP3/WAV) e vinhetas em vídeo (MP4/WEBM). Eles tocam por cima de tudo, inclusive da trilha.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {pads.map((pad, i) => (
            <div key={pad.id} className="group relative">
              <button
                onClick={() => play(pad)}
                className={`flex h-16 w-full flex-col items-start justify-between rounded-md p-2 text-left text-xs font-semibold active:scale-95 ${
                  pad.kind === "video" ? "bg-indigo-800 hover:bg-indigo-700" : "bg-neutral-700 hover:bg-neutral-600"
                }`}
              >
                <span className="text-[10px] text-white/60">
                  {i < 9 ? `tecla ${i + 1}` : ""} {pad.kind === "video" ? "· vinheta" : ""}
                </span>
                <span className="line-clamp-2">{pad.name}</span>
              </button>
              <DeleteButton asset={pad} />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-bold hover:bg-red-600" onClick={() => sendCue({ type: "stop" })} title="Tecla Esc">
          ■ PARAR
        </button>
        <label className="flex flex-1 items-center gap-2 text-xs text-neutral-400">
          Volume
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="flex-1" />
        </label>
        <UploadButton slug={slug} accept={`${AUDIO_TYPES},video/mp4,video/webm`} label="Efeito/vinheta" role="efeito" onUploaded={addAsset} />
      </div>
    </div>
  );
}
