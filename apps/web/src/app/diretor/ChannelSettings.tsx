"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function ChannelSettings() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [streamKey, setStreamKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/youtube-key")
      .then((r) => r.json())
      .then((d) => setHasKey(Boolean(d.hasKey)));
  }, []);

  async function save() {
    if (!streamKey.trim()) return;
    setSaving(true);
    const res = await fetch("/api/settings/youtube-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamKey: streamKey.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setStreamKey("");
      setHasKey(true);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-400">
        Chave de transmissão (usada por todos os programas):{" "}
        {hasKey === null ? "verificando..." : hasKey ? "configurada ✓" : "não configurada"}
      </p>
      <div className="flex max-w-xl gap-2">
        <input
          type="password"
          placeholder={hasKey ? "Colar uma nova chave para substituir" : "Cole a chave de transmissão do YouTube"}
          value={streamKey}
          onChange={(e) => setStreamKey(e.target.value)}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm"
        />
        <button
          onClick={save}
          disabled={saving || !streamKey.trim()}
          className="rounded-md bg-neutral-700 px-4 py-2 text-sm hover:bg-neutral-600 disabled:opacity-50"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="text-sm text-neutral-400 hover:text-neutral-200"
    >
      Sair
    </button>
  );
}
