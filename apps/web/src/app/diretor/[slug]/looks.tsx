"use client";

import { useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { NEUTRAL_LOOK, personKey, type PersonLook } from "@/lib/scene";
import { ImagePicker } from "./assets";
import { useDirector } from "./context";
import { useProgramConfig } from "./rundown";

// Per person (by name, every program): the photo that fills their window
// while the camera is off (e.g. their caricature) and their camera colors.

const SLIDERS: { key: keyof Omit<PersonLook, "photo">; label: string; min: number; max: number; step: number }[] = [
  { key: "brightness", label: "Brilho", min: 0.5, max: 1.6, step: 0.02 },
  { key: "contrast", label: "Contraste", min: 0.5, max: 1.6, step: 0.02 },
  { key: "saturation", label: "Cor (saturação)", min: 0, max: 2, step: 0.05 },
  { key: "warmth", label: "Temperatura (frio ↔ quente)", min: -1, max: 1, step: 0.05 },
];

function PersonRow({ name, look, onSave }: { name: string; look: PersonLook; onSave: (look: PersonLook | null) => void }) {
  const { slug, assets, addAsset } = useDirector();
  const [draft, setDraft] = useState(look);
  const [seen, setSeen] = useState(look);
  if (look !== seen) {
    setSeen(look);
    setDraft(look);
  }
  const changed = SLIDERS.some((s) => draft[s.key] !== NEUTRAL_LOOK[s.key]);
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md bg-neutral-950 p-3 md:grid-cols-[150px_1fr]">
      <div className="space-y-1">
        <p className="truncate text-sm font-bold">{name}</p>
        <span className="block text-[11px] text-neutral-500">Foto com a câmera desligada</span>
        <ImagePicker slug={slug} assets={assets} value={draft.photo} onChange={(photo) => onSave({ ...draft, photo })} onUploaded={addAsset} />
      </div>
      <div className="space-y-1.5">
        {SLIDERS.map((s) => (
          <label key={s.key} className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="w-44 shrink-0">{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={draft[s.key]}
              onChange={(e) => setDraft({ ...draft, [s.key]: Number(e.target.value) })}
              onPointerUp={() => onSave(draft)}
              onKeyUp={() => onSave(draft)}
              className="flex-1 accent-[#DFFF00]"
            />
            <span className="w-10 text-right tabular-nums">{s.key === "warmth" ? draft[s.key].toFixed(2) : `${Math.round(draft[s.key] * 100)}%`}</span>
          </label>
        ))}
        {changed && (
          <button onClick={() => onSave({ ...NEUTRAL_LOOK, photo: draft.photo })} className="text-xs text-neutral-500 underline hover:text-neutral-300">
            voltar as cores ao normal
          </button>
        )}
      </div>
    </div>
  );
}

export function LooksPanel() {
  const { config, save } = useProgramConfig();
  const people = useParticipants().filter((p) => !p.identity.startsWith("layout-viewer"));
  if (!config) return <p className="text-sm text-neutral-500">Carregando...</p>;
  const looks = config.looks;
  // Everyone in the room now, plus people saved before (they may join later).
  const names = new Map<string, string>();
  for (const p of people) {
    const name = (p.name || p.identity).trim();
    if (name) names.set(personKey(name), name);
  }
  for (const key of Object.keys(looks)) if (!names.has(key)) names.set(key, key.toUpperCase());

  const saveLook = (key: string, look: PersonLook | null) => {
    const next = { ...looks };
    if (!look || (look.photo === null && look.brightness === 1 && look.contrast === 1 && look.saturation === 1 && look.warmth === 0)) delete next[key];
    else next[key] = look;
    save({ looks: next });
  };

  if (!names.size) return <p className="text-sm text-neutral-500">Ninguém na sala ainda. Quando a pessoa entrar, ela aparece aqui.</p>;
  return (
    <div className="space-y-2">
      {[...names.entries()].map(([key, name]) => (
        <PersonRow key={key} name={name} look={looks[key] ?? NEUTRAL_LOOK} onSave={(look) => saveLook(key, look)} />
      ))}
      <p className="text-[11px] text-neutral-500">
        Fica guardado pelo nome da pessoa e vale nos 3 programas. A cor muda na transmissão e nos monitores; a câmera da pessoa continua igual no computador dela.
      </p>
    </div>
  );
}
