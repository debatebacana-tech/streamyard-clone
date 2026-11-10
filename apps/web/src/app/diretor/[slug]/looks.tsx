"use client";

import { useLocalParticipant, useParticipants } from "@livekit/components-react";
import { SelfPhoto } from "@/components/SelfPhoto";
import { NEUTRAL_LOOK, personKey, type PersonLook } from "@/lib/scene";
import { ImagePicker } from "./assets";
import { useDirector } from "./context";
import { useProgramConfig } from "./rundown";

// Per person (by name, every program): the photo that fills their window
// while the camera is off (e.g. their caricature) and their camera colors.

function PersonRow({ name, look, onSave }: { name: string; look: PersonLook; onSave: (look: PersonLook | null) => void }) {
  const { slug, assets, addAsset } = useDirector();
  return (
    <div className="flex items-center gap-3 rounded-md bg-neutral-950 p-3">
      <p className="w-40 truncate text-sm font-bold">{name}</p>
      <ImagePicker slug={slug} assets={assets} value={look.photo} onChange={(photo) => onSave({ ...NEUTRAL_LOOK, photo })} onUploaded={addAsset} />
    </div>
  );
}

export function LooksPanel() {
  const { slug } = useDirector();
  const me = useLocalParticipant().localParticipant;
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
    if (!look || look.photo === null) delete next[key];
    else next[key] = look;
    save({ looks: next });
  };

  return (
    <div className="space-y-2">
      <SelfPhoto name={me.name || ""} slug={slug} />
      <p className="text-[11px] text-neutral-500">
        Cada convidado envia a própria foto pela tela dele (botão “Minha foto” embaixo da câmera). Aqui você também pode trocar a de qualquer um.
      </p>
      {!names.size && <p className="text-sm text-neutral-500">Ninguém na sala ainda.</p>}
      {[...names.entries()].map(([key, name]) => (
        <PersonRow key={key} name={name} look={looks[key] ?? NEUTRAL_LOOK} onSave={(look) => saveLook(key, look)} />
      ))}
      <p className="text-[11px] text-neutral-500">
        Fica guardado pelo nome da pessoa e vale nos 3 programas.
      </p>
    </div>
  );
}
