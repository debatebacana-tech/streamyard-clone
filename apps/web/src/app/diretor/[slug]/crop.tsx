"use client";

import { useRef, useState } from "react";
import { VideoTrack, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useDirector } from "./context";

// Draw a rectangle on the shared screen: only that part goes on air (e.g.
// the live pitch of a match page, without menus or ads).

type Rect = { x: number; y: number; w: number; h: number };

export function CropPanel() {
  const { scenes, patch } = useDirector();
  const screens = useTracks([Track.Source.ScreenShare]);
  const screen = screens[0];
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; rect: Rect } | null>(null);
  const crop = scenes.draft.screenCrop;
  const live = scenes.live.screenCrop;

  const dims = screen?.publication?.dimensions;
  const aspect = dims && dims.width && dims.height ? dims.width / dims.height : 16 / 9;

  const point = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const shown: Rect | null = drag?.rect ?? (crop.enabled ? crop : null);

  if (!screen) {
    return (
      <p className="text-sm text-neutral-400">
        Ninguém está compartilhando a tela agora. Clique em <b>Share screen</b> (embaixo dos monitores), escolha a aba com o campinho e o recorte aparece aqui.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">
        Arraste o mouse sobre a tela para marcar a parte que vai ao ar (ex.: só o campinho). Clique numa cena ou use “direto no ar” para mandar.
      </p>
      <div
        ref={box}
        className="relative w-full max-w-2xl cursor-crosshair touch-none overflow-hidden rounded-md bg-black select-none"
        style={{ aspectRatio: String(aspect) }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const p = point(e);
          setDrag({ x0: p.x, y0: p.y, rect: { x: p.x, y: p.y, w: 0, h: 0 } });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const p = point(e);
          setDrag({ ...drag, rect: { x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) } });
        }}
        onPointerUp={() => {
          if (drag && drag.rect.w > 0.04 && drag.rect.h > 0.04) patch({ screenCrop: { enabled: true, ...drag.rect } });
          setDrag(null);
        }}
      >
        <VideoTrack trackRef={screen} className="pointer-events-none h-full w-full object-fill" />
        {shown && (
          <>
            {/* Dim everything outside the selection. */}
            <div
              className="pointer-events-none absolute border-2 border-[#aedf02] shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
              style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }}
            />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          className="rounded-md bg-neutral-700 px-3 py-1.5 hover:bg-neutral-600 disabled:opacity-40"
          disabled={!crop.enabled}
          onClick={() => patch({ screenCrop: { enabled: false } })}
        >
          Tela inteira (sem recorte)
        </button>
        <button
          className="rounded-md bg-red-600 px-3 py-1.5 font-medium hover:bg-red-500 disabled:opacity-40"
          disabled={!crop.enabled}
          onClick={() => patch({ screenCrop: crop }, { air: true })}
        >
          Pôr o recorte no ar agora
        </button>
        <span className="text-xs text-neutral-500">
          No ar: {live.enabled ? `recorte de ${Math.round(live.w * 100)}% × ${Math.round(live.h * 100)}% da tela` : "tela inteira"}
        </span>
      </div>
    </div>
  );
}
