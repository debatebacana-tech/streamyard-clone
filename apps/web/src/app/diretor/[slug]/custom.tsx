"use client";

import { useRef, useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { CUSTOM_PRESETS, type CustomSlot, type SavedScene } from "@/lib/scene";
import { useDirector } from "./context";
import { useProgramConfig } from "./rundown";

// StreamYard-style layout builder: draw the windows on a 16:9 frame, pick who
// goes in each one (camera or shared screen), and it lands on the preview;
// CORTAR takes it to air. "Salvar como modelo" keeps it as a scene button.

const COLORS = ["#DFFF00", "#38bdf8", "#f472b6", "#fb923c", "#a78bfa", "#34d399", "#f87171", "#facc15", "#94a3b8"];
const snap = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type Drag = { index: number; mode: "move" | "resize"; startX: number; startY: number; slot: CustomSlot };

export function CustomLayoutPanel() {
  const { scenes, patch } = useDirector();
  const { config, save } = useProgramConfig();
  const people = useParticipants().filter((p) => !p.identity.startsWith("layout-viewer"));
  const draft = scenes.draft;
  const [slots, setSlots] = useState<CustomSlot[]>(draft.custom);
  const [selected, setSelected] = useState(0);
  // The preview changed elsewhere (a scene button, another director): follow it.
  const [seen, setSeen] = useState(JSON.stringify(draft.custom));
  const incoming = JSON.stringify(draft.custom);
  if (incoming !== seen) {
    setSeen(incoming);
    setSlots(draft.custom);
  }
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const active = draft.layout === "custom";

  const commit = (next: CustomSlot[]) => {
    setSlots(next);
    setSeen(JSON.stringify(next));
    void patch({ layout: "custom", custom: next });
  };
  const update = (i: number, change: Partial<CustomSlot>) => commit(slots.map((s, j) => (j === i ? { ...s, ...change } : s)));

  function onPointerDown(e: React.PointerEvent, index: number, mode: Drag["mode"]) {
    e.preventDefault();
    e.stopPropagation();
    setSelected(index);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { index, mode, startX: e.clientX, startY: e.clientY, slot: slots[index] };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    const box = frame.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = (e.clientX - d.startX) / box.width;
    const dy = (e.clientY - d.startY) / box.height;
    const s = d.slot;
    const next =
      d.mode === "move"
        ? { ...s, x: snap(clamp(s.x + dx, 0, 1 - s.w)), y: snap(clamp(s.y + dy, 0, 1 - s.h)) }
        : { ...s, w: snap(clamp(s.w + dx, 0.08, 1 - s.x)), h: snap(clamp(s.h + dy, 0.08, 1 - s.y)) };
    setSlots((all) => all.map((x, j) => (j === d.index ? next : x)));
  }
  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    commit(slots);
  }

  function add() {
    if (slots.length >= 9) return;
    const n = slots.length;
    commit([...slots, { x: snap(0.05 + (n % 4) * 0.05), y: snap(0.12 + (n % 4) * 0.05), w: 0.3, h: 0.3, who: null, name: "", source: "camera" }]);
    setSelected(n);
  }
  function remove(i: number) {
    commit(slots.filter((_, j) => j !== i));
    setSelected(0);
  }
  function toFront(i: number) {
    const next = [...slots];
    const [s] = next.splice(i, 1);
    next.push(s);
    commit(next);
    setSelected(next.length - 1);
  }
  function saveModel() {
    if (!config) return;
    const name = prompt("Nome do modelo (ex: Entrevista 2 câmeras):");
    if (!name?.trim()) return;
    const scene: SavedScene = {
      id: crypto.randomUUID().slice(0, 8),
      name: name.trim().slice(0, 40),
      layout: "custom",
      stageMode: draft.stageMode,
      onStage: draft.stageMode === "manual" ? draft.onStage : [],
      featured: draft.featured,
      featuredSide: draft.featuredSide,
      chat: draft.chat.visible,
      custom: slots,
    };
    save({ scenes: [...config.scenes, scene] });
  }

  const label = (s: CustomSlot) => {
    const person = s.who ? people.find((p) => p.identity === s.who)?.name || s.name || "pessoa fora da sala" : "Próximo da fila";
    return `${person}${s.source === "screen" ? " · tela" : ""}`;
  };
  const sel = slots[selected];

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {!active && (
          <button onClick={() => commit(slots)} className="rounded-md bg-red-600 px-3 py-1.5 font-semibold hover:bg-red-500">
            Usar este layout na prévia
          </button>
        )}
        {active && <span className="rounded bg-emerald-700/40 px-2 py-1 text-xs text-emerald-200">Na prévia: arraste e veja ao lado. CORTAR leva ao ar.</span>}
        <span className="text-xs text-neutral-500">Modelos prontos:</span>
        {CUSTOM_PRESETS.map((p) => (
          <button key={p.name} onClick={() => commit(p.slots)} className="rounded-md bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700">
            {p.name}
          </button>
        ))}
      </div>

      <div
        ref={frame}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative aspect-video w-full max-w-3xl touch-none overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 select-none"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: "10% 10%" }}
      >
        {/* Where the logo + AO VIVO sit, so windows can avoid them. */}
        <div className="pointer-events-none absolute top-[2%] right-[2%] h-[11%] w-[20%] rounded border border-dashed border-red-500/50 text-center text-[9px] leading-[1.6] text-red-300/70">logo · AO VIVO</div>
        {slots.map((s, i) => (
          <div
            key={i}
            onPointerDown={(e) => onPointerDown(e, i, "move")}
            className={`absolute flex cursor-move items-center justify-center rounded-md border-2 text-center text-xs font-bold ${selected === i ? "ring-2 ring-white" : ""}`}
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              width: `${s.w * 100}%`,
              height: `${s.h * 100}%`,
              zIndex: i + 1,
              borderColor: COLORS[i % COLORS.length],
              background: `${COLORS[i % COLORS.length]}33`,
            }}
          >
            <span className="pointer-events-none rounded bg-black/70 px-1.5 py-0.5 text-white">
              {i + 1}. {label(s)}
            </span>
            <span
              onPointerDown={(e) => onPointerDown(e, i, "resize")}
              className="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize rounded-tl"
              style={{ background: COLORS[i % COLORS.length] }}
              title="Arraste para mudar o tamanho"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={add} disabled={slots.length >= 9} className="rounded-md bg-neutral-700 px-3 py-1.5 hover:bg-neutral-600 disabled:opacity-40">
          ＋ Janela
        </button>
        <button onClick={saveModel} className="rounded-md bg-[#DFFF00] px-3 py-1.5 font-semibold text-black">
          💾 Salvar como modelo
        </button>
        <span className="text-[11px] text-neutral-500">O modelo vira um botão na barra CENAS (com tecla de atalho).</span>
      </div>

      {sel && (
        <div className="flex flex-wrap items-end gap-3 rounded-md bg-neutral-900 p-3" style={{ borderLeft: `4px solid ${COLORS[selected % COLORS.length]}` }}>
          <span className="font-bold">Janela {selected + 1}</span>
          <label className="space-y-1">
            <span className="block text-[11px] text-neutral-400">Quem aparece</span>
            <select
              className="rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5"
              value={sel.who ?? ""}
              onChange={(e) => {
                const p = people.find((x) => x.identity === e.target.value);
                update(selected, { who: p?.identity ?? null, name: p?.name ?? "" });
              }}
            >
              <option value="">Próximo da fila (automático)</option>
              {people.map((p) => (
                <option key={p.identity} value={p.identity}>
                  {p.name || p.identity}
                </option>
              ))}
              {sel.who && !people.some((p) => p.identity === sel.who) && <option value={sel.who}>{sel.name || "pessoa fora da sala"}</option>}
            </select>
          </label>
          <div className="flex overflow-hidden rounded-md border border-neutral-700">
            {(["camera", "screen"] as const).map((src) => (
              <button
                key={src}
                onClick={() => update(selected, { source: src })}
                className={`px-3 py-1.5 text-xs ${sel.source === src ? "bg-[#DFFF00] font-semibold text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}
              >
                {src === "camera" ? "📷 Câmera" : "🖥 Tela compartilhada"}
              </button>
            ))}
          </div>
          <button onClick={() => update(selected, { x: 0, y: 0, w: 1, h: 1 })} className="rounded-md bg-neutral-800 px-2 py-1.5 text-xs hover:bg-neutral-700">
            Tela cheia
          </button>
          <button onClick={() => toFront(selected)} className="rounded-md bg-neutral-800 px-2 py-1.5 text-xs hover:bg-neutral-700">
            Trazer para frente
          </button>
          <button onClick={() => remove(selected)} className="rounded-md bg-red-800 px-2 py-1.5 text-xs hover:bg-red-700">
            Apagar janela
          </button>
        </div>
      )}
      <p className="text-[11px] text-neutral-500">
        Clique numa janela para escolher quem aparece nela. “Próximo da fila” preenche com quem está no palco, na ordem. A pessoa escolhida aparece e é ouvida mesmo sem estar no palco. Um modelo salvo reconhece a pessoa pelo nome quando ela entra de outro computador.
      </p>
    </div>
  );
}
