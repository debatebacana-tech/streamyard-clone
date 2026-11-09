"use client";

import { useEffect, useState } from "react";
import { matchesSavedScene, savedScenePatch, type SavedScene } from "@/lib/scene";
import { useDirector } from "./context";
import { UploadButton } from "./assets";
import { AssetSelect, useProgramConfig } from "./rundown";

// Keyboard row for scenes, so 1–9 stay with the sound pads.
const KEYS = ["q", "w", "e", "r", "t", "y", "u", "i"];

function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  return Boolean(el.closest("input, textarea, select, [contenteditable]")) || e.ctrlKey || e.metaKey || e.altKey;
}

// One click (or key) loads a saved arrangement into the preview, or straight
// to air with "direto no ar"; Space cuts the preview to air.
export function ScenesBar() {
  const { scenes, patch, direct, sceneRequest } = useDirector();
  const { config, save } = useProgramConfig();
  const [editing, setEditing] = useState(false);
  const list = config?.scenes ?? [];

  // "Direto no ar" cuts with the transition; otherwise it only loads the preview.
  const apply = (saved: SavedScene) =>
    direct ? sceneRequest({ action: "cut", patch: savedScenePatch(saved) }) : patch(savedScenePatch(saved));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (typing(e)) return;
      if (e.code === "Space" && !direct) {
        e.preventDefault();
        sceneRequest({ action: "take" });
        return;
      }
      const i = KEYS.indexOf(e.key.toLowerCase());
      if (i >= 0 && list[i]) {
        e.preventDefault();
        apply(list[i]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function saveCurrent() {
    const name = prompt("Nome da cena (ex: Todos + chat):");
    if (!name?.trim()) return;
    const d = scenes.draft;
    const scene: SavedScene = {
      id: crypto.randomUUID().slice(0, 8),
      name: name.trim().slice(0, 40),
      layout: d.layout,
      stageMode: d.stageMode,
      onStage: d.stageMode === "manual" ? d.onStage : [],
      featured: d.featured,
      featuredSide: d.featuredSide,
      chat: d.chat.visible,
    };
    save({ scenes: [...list, scene] });
  }

  function remove(id: string) {
    const target = list.find((s) => s.id === id);
    if (target && confirm(`Apagar a cena "${target.name}"?`)) save({ scenes: list.filter((s) => s.id !== id) });
  }

  return (
    <div className="studio-bar flex flex-wrap items-center gap-2 p-2">
      <span className="studio-label px-2 text-base">CENAS</span>
      {list.map((s, i) => {
        const inPreview = matchesSavedScene(scenes.draft, s);
        const onAir = matchesSavedScene(scenes.live, s);
        return (
          <span key={s.id} className="relative inline-flex">
            <button
              onClick={() => apply(s)}
              title={`${s.name}${KEYS[i] ? ` — tecla ${KEYS[i].toUpperCase()}` : ""}`}
              className={`rounded-md border-2 px-3 py-1.5 text-sm font-semibold ${
                onAir
                  ? "border-red-600 bg-red-600/20 text-white"
                  : inPreview
                    ? "border-emerald-500 bg-emerald-600/20 text-white"
                    : "border-transparent bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              }`}
            >
              {KEYS[i] && <span className="mr-1.5 rounded bg-black/40 px-1 font-mono text-[10px] text-neutral-400">{KEYS[i].toUpperCase()}</span>}
              {s.name}
            </button>
            {editing && (
              <button
                onClick={() => remove(s.id)}
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-700 text-[10px] leading-5 hover:bg-red-600"
                title="Apagar cena"
              >
                ✕
              </button>
            )}
          </span>
        );
      })}
      <button onClick={saveCurrent} className="rounded-md border border-dashed border-neutral-600 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-400">
        ＋ Salvar a prévia como cena
      </button>
      <button onClick={() => setEditing((e) => !e)} className="text-xs text-neutral-500 hover:text-neutral-300">
        {editing ? "pronto" : "editar"}
      </button>
      <span className="ml-auto pr-2 text-[11px] text-neutral-500">
        {direct ? "Direto no ar: a cena entra na hora" : "Escolha a cena e aperte Espaço (ou CORTAR) para ir ao ar"}
      </span>
    </div>
  );
}

// The animation between scenes: the team's own video (an OBS-style stinger,
// ideally a transparent .webm) or the built-in wipe in the program's colors.
export function TransitionPanel() {
  const { slug, assets, addAsset } = useDirector();
  const { config, save } = useProgramConfig();
  if (!config) return <p className="text-sm text-neutral-500">Carregando...</p>;
  const t = config.transition;
  const videos = assets.filter((a) => a.kind === "video");
  const set = (patch: Partial<typeof t>) => save({ transition: { ...t, ...patch } });

  return (
    <div className="space-y-3 text-sm">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={t.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Animar a troca de cena (CORTAR, Espaço e cenas direto no ar)
      </label>
      <AssetSelect
        label="Sua animação (vídeo)"
        hint="Vazio = animação padrão com as cores e o logo do programa. Use .webm com fundo transparente para a cena aparecer por trás."
        value={t.mediaUrl}
        options={videos}
        onChange={(url) => set({ mediaUrl: url })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <UploadButton slug={slug} accept="video/webm,video/mp4" label="Enviar animação" role="arte" onUploaded={addAsset} />
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          Troca a cena aos
          <input
            type="number"
            min={0}
            max={3000}
            step={50}
            className="w-20 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
            value={t.cutMs}
            onChange={(e) => set({ cutMs: Number(e.target.value) || 0 })}
          />
          ms
        </label>
      </div>
      <p className="text-[11px] text-neutral-500">
        “Troca a cena aos” é o momento em que a sua animação cobre a tela toda (no OBS isso se chama ponto de transição). A padrão usa 450 ms.
      </p>
    </div>
  );
}
