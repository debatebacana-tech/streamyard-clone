"use client";

import { useState } from "react";
import { mediaElapsedMs, type ProjectedMedia } from "@/lib/scene";
import { UploadButton, type AssetItem } from "./assets";
import { useDirector } from "./context";

// Project a photo or video during the show: pick it from the library and put
// it on air big with the cameras beside it, full screen, or full screen with
// the cameras in small windows. Videos play with sound, in sync everywhere.

const btn = "rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40";
const btnOn = "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500 disabled:opacity-40";

const MODES: { mode: ProjectedMedia["mode"]; label: string }[] = [
  { mode: "destaque", label: "Grande + câmeras ao lado" },
  { mode: "full", label: "Tela cheia" },
  { mode: "pip", label: "Tela cheia + câmeras em janelinhas" },
];

// Event-time clock (kept outside render for the purity lint).
const clock = () => Date.now();

function Thumb({ asset }: { asset: AssetItem }) {
  return asset.kind === "video" ? (
    <video src={`${asset.url}#t=1`} preload="metadata" muted className="h-full w-full bg-black object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={asset.url} alt="" className="h-full w-full bg-black object-cover" />
  );
}

export function MediaPanel() {
  const { slug, scenes, patch, assets, addAsset, removeAsset } = useDirector();
  const live = scenes.live.media;
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const library = assets.filter((a) => (a.kind === "image" || a.kind === "video") && a.role !== "clube" && (filter === "all" || a.kind === filter));
  const air = (media: Partial<ProjectedMedia>) => patch({ media }, { air: true });
  const onAir = live.visible ? live.url : null;
  const paused = live.pausedAt !== null;

  function show(a: AssetItem) {
    air({ visible: true, url: a.url, kind: a.kind === "video" ? "video" : "image", startedAt: clock(), pausedAt: null });
  }

  function togglePause() {
    const now = clock();
    if (paused) air({ startedAt: now - mediaElapsedMs(live, now), pausedAt: null });
    else air({ pausedAt: now });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.mode}
              onClick={() => air({ mode: m.mode })}
              className={`rounded-md px-3 py-1.5 text-sm ${live.mode === m.mode ? "bg-[#DFFF00] font-semibold text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="space-y-2 rounded-md bg-neutral-950 p-3 text-sm">
          <p className="font-semibold">No ar</p>
          {onAir ? (
            <>
              <p className="truncate text-neutral-300">{assets.find((a) => a.url === onAir)?.name ?? "mídia"}</p>
              {live.kind === "video" && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button className={btn} onClick={togglePause}>
                      {paused ? "▶ Continuar" : "⏸ Pausar"}
                    </button>
                    <button className={btn} onClick={() => {
                        const now = clock();
                        air({ startedAt: now, pausedAt: paused ? now : null });
                      }}>
                      ⟲ Do começo
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-neutral-300">
                      <input type="checkbox" checked={live.loop} onChange={(e) => air({ loop: e.target.checked })} />
                      repetir
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-neutral-400">
                    Volume
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      defaultValue={live.volume}
                      onMouseUp={(e) => air({ volume: Number((e.target as HTMLInputElement).value) })}
                      onTouchEnd={(e) => air({ volume: Number((e.target as HTMLInputElement).value) })}
                      className="flex-1"
                    />
                  </label>
                </div>
              )}
              <button className={btnOn} onClick={() => air({ visible: false })}>
                Tirar do ar
              </button>
            </>
          ) : (
            <p className="text-xs text-neutral-500">Nada projetado. Clique numa foto ou vídeo ao lado.</p>
          )}
        </div>

        <UploadButton slug={slug} accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm" label="Enviar fotos ou vídeos (até 150 MB)" role="midia" onUploaded={addAsset} />
        <p className="text-[11px] text-neutral-500">
          Vídeo: prefira .mp4. O som do vídeo vai para a transmissão. Ao trocar de mídia, a anterior sai sozinha.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex gap-1 text-xs">
          {(
            [
              ["all", "Tudo"],
              ["image", "Fotos"],
              ["video", "Vídeos"],
            ] as const
          ).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded px-2 py-1 ${filter === f ? "bg-neutral-600" : "bg-neutral-800 hover:bg-neutral-700"}`}>
              {label}
            </button>
          ))}
        </div>
        {library.length === 0 && <p className="text-sm text-neutral-500">Nenhuma foto ou vídeo enviado ainda.</p>}
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {library.map((a) => {
            const on = onAir === a.url;
            return (
              <li key={a.id} className={`group relative overflow-hidden rounded-md border-2 ${on ? "border-red-600" : "border-transparent"}`}>
                <button className="block aspect-video w-full" onClick={() => (on ? air({ visible: false }) : show(a))} title={on ? "Tirar do ar" : "Pôr no ar"}>
                  <Thumb asset={a} />
                </button>
                <div className="flex items-center gap-1 bg-neutral-900 px-1.5 py-1 text-[11px]">
                  <span>{a.kind === "video" ? "🎬" : "🖼"}</span>
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  {on ? (
                    <span className="font-bold text-red-400">NO AR</span>
                  ) : (
                    <button className="text-neutral-500 hover:text-red-400" onClick={() => confirm(`Apagar "${a.name}"?`) && removeAsset(a.id)}>
                      ✕
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
