"use client";

import { useEffect, useState } from "react";
import { useMediaCues } from "@/components/MediaLayer";
import type { HotSound } from "@/lib/programConfig";
import { UploadButton } from "./assets";
import { useDirector } from "./context";
import { useProgramConfig } from "./rundown";

// The show's signature sounds ("GOL BACANA", "Ele é o nosso melhor amigo"):
// big buttons always on screen, with Z/X/C/V shortcuts, played over everything.

const KEYS = ["z", "x", "c", "v", "b", "n"];

function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  return Boolean(el.closest("input, textarea, select, [contenteditable]")) || e.ctrlKey || e.metaKey || e.altKey;
}

export function HotSoundsBar({ always }: { always: boolean }) {
  const { slug, addAsset } = useDirector();
  const { config, save } = useProgramConfig();
  const sendCue = useMediaCues();
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const sounds = config?.hotSounds ?? [];

  const play = (s: HotSound) => {
    if (!s.url) return;
    sendCue({ type: "play", id: crypto.randomUUID(), url: s.url, kind: /\.(mp4|webm)$/i.test(s.url) ? "video" : "audio", volume: 1 });
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
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && sounds[i]?.url) {
        e.preventDefault();
        play(sounds[i]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const update = (id: string, patch: Partial<HotSound>) => save({ hotSounds: sounds.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  if (!config || (!always && !sounds.some((s) => s.url) && !editing)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2">
      <span className="px-2 text-xs font-bold tracking-widest text-neutral-500">DESTAQUES</span>
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
      <button className="ml-auto rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700" onClick={() => sendCue({ type: "stop" })}>
        ⏹ Parar (Esc)
      </button>
    </div>
  );
}
