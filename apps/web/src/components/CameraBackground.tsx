"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import type { LocalVideoTrack } from "livekit-client";

// Background behind the person on their own camera (blur or a picture), done
// in their own browser (it costs their computer, not the stream). Off by
// default; the choice is remembered in this browser.

type Mode = "none" | "blur" | "cenario" | "escuro" | "cruzeiro" | "atletico" | "flamengo";
const OPTIONS: { mode: Mode; label: string }[] = [
  { mode: "none", label: "Sem fundo" },
  { mode: "blur", label: "Desfocar" },
  { mode: "cenario", label: "Cenário Debate Bacana" },
  { mode: "escuro", label: "Fundo escuro" },
  // Each host's podcast corner in their club's colors.
  { mode: "cruzeiro", label: "💙 Cruzeiro" },
  { mode: "atletico", label: "🖤 Atlético" },
  { mode: "flamengo", label: "❤️ Flamengo" },
];
const IMAGES: Partial<Record<Mode, string>> = {
  cenario: "/brand/cenario-camera.jpg",
  escuro: "/brand/fundo-escuro-camera.jpg",
  cruzeiro: "/brand/fundo-cruzeiro.jpg",
  atletico: "/brand/fundo-atletico.jpg",
  flamengo: "/brand/fundo-flamengo.jpg",
};
const KEY = "studio-camera-background";

function saved(): Mode {
  try {
    const v = localStorage.getItem(KEY) as Mode | null;
    return v && OPTIONS.some((o) => o.mode === v) ? v : "none";
  } catch {
    return "none";
  }
}

type Processor = Awaited<ReturnType<typeof makeProcessor>>;
async function makeProcessor(mode: Mode) {
  const lib = await import("@livekit/track-processors");
  return mode === "blur"
    ? lib.BackgroundProcessor({ mode: "background-blur", blurRadius: 14 })
    : lib.BackgroundProcessor({ mode: "virtual-background", imagePath: IMAGES[mode]! });
}

export function CameraBackground() {
  const { cameraTrack } = useLocalParticipant();
  const track = cameraTrack?.track as LocalVideoTrack | undefined;
  const [mode, setMode] = useState<Mode>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processor = useRef<Processor | null>(null);
  const applied = useRef<{ track: LocalVideoTrack | undefined; mode: Mode }>({ track: undefined, mode: "none" });

  useEffect(() => {
    const id = setTimeout(() => setMode(saved()), 0);
    return () => clearTimeout(id);
  }, []);

  // Apply (again) whenever the choice or the camera track changes.
  useEffect(() => {
    if (!track) return;
    if (applied.current.track === track && applied.current.mode === mode) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        if (mode === "none") {
          if (track.getProcessor()) await track.stopProcessor();
          processor.current = null;
        } else if (processor.current && track.getProcessor() === processor.current) {
          await processor.current.switchTo(mode === "blur" ? { mode: "background-blur", blurRadius: 14 } : { mode: "virtual-background", imagePath: IMAGES[mode]! });
        } else {
          const lib = await import("@livekit/track-processors");
          if (!lib.supportsBackgroundProcessors()) throw new Error("Este navegador não faz fundo de câmera (use o Chrome ou o Edge atualizado)");
          const p = await makeProcessor(mode);
          if (cancelled) return;
          await track.setProcessor(p);
          processor.current = p;
        }
        applied.current = { track, mode };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não deu para aplicar o fundo");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track, mode]);

  function choose(next: Mode) {
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm">
      <span className="font-semibold">Fundo da minha câmera</span>
      {OPTIONS.map((o) => (
        <button
          key={o.mode}
          disabled={busy || !track}
          onClick={() => choose(o.mode)}
          className={`rounded-md px-2.5 py-1 text-xs disabled:opacity-50 ${mode === o.mode ? "bg-[#DFFF00] font-bold text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}
        >
          {o.label}
        </button>
      ))}
      <span className="w-full text-[11px] text-neutral-500">
        {error ?? (!track ? "Ligue a câmera para escolher." : busy ? "Aplicando…" : "Feito no seu computador: se a sua câmera engasgar, volte para “Sem fundo”.")}
      </span>
    </div>
  );
}
