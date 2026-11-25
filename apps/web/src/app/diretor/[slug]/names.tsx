"use client";

import { useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { useDirector } from "./context";

// Names shown on the windows: each director browser remembers its own, and
// the director can rename anyone in the room (a guest who typed it wrong).

const KEY = "director-name";

export function savedDirectorName(): string {
  try {
    return localStorage.getItem(KEY)?.trim() || "Diretor";
  } catch {
    return "Diretor";
  }
}

export function useRename() {
  const { slug } = useDirector();
  return async (identity: string, current: string, isLocal: boolean): Promise<string | null> => {
    const name = prompt("Nome que aparece na janela:", current)?.trim();
    if (!name || name === current) return null;
    if (isLocal) {
      try {
        localStorage.setItem(KEY, name);
      } catch {}
    }
    await fetch(`/api/programs/${slug}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", identity, name }),
    });
    return name;
  };
}

// "Você: Paulo ✎" in the studio header.
export function MyName() {
  const { localParticipant } = useLocalParticipant();
  const rename = useRename();
  // The local participant doesn't always re-render on its own name change.
  const [renamed, setRenamed] = useState<string | null>(null);
  const name = renamed ?? (localParticipant.name || "Diretor");
  return (
    <button
      onClick={async () => {
        const next = await rename(localParticipant.identity, name, true);
        if (next) setRenamed(next);
      }}
      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:border-[var(--db-lime)] hover:text-white"
      title="Trocar o nome que aparece na sua janela"
    >
      Você: <b className="text-white">{name}</b> ✎
    </button>
  );
}
