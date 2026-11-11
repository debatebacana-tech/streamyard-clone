"use client";

import { useCallback, useEffect, useState } from "react";

// Offline recording: "⏺ Gravar" in the header records the composed show to an
// MP4 on the server (never during a live), listed in Ajustes → Gravações.

function Clock({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return <span className="font-mono tabular-nums">{`${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`}</span>;
}

type Status = { recording: boolean; otherRecording: string | null; startedAt: number | null };

export function RecordControl({ slug }: { slug: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/programs/${slug}/record`).catch(() => null);
    if (res?.ok) setStatus(await res.json());
  }, [slug]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  async function toggle() {
    if (status?.recording && !confirm("Parar a gravação? O vídeo fica em Ajustes → Gravações.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/programs/${slug}/record`, { method: status?.recording ? "DELETE" : "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "Sem conexão" };
    if (!res?.ok) setError(data.error ?? "Falhou");
    await refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="max-w-xs truncate text-xs text-red-400" title={error}>
          {error}
        </span>
      )}
      {status?.otherRecording && !status.recording && <span className="text-xs text-amber-400">{status.otherRecording} está gravando</span>}
      <button
        onClick={toggle}
        disabled={busy || Boolean(status?.otherRecording)}
        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-40 ${
          status?.recording ? "bg-red-950 text-red-200 ring-1 ring-red-500" : "bg-neutral-800 hover:bg-neutral-700"
        }`}
        title="Grava o programa num vídeo no servidor, sem ir ao vivo"
      >
        {status?.recording ? (
          <>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> Gravando {status.startedAt && <Clock since={status.startedAt} />} · Parar
          </>
        ) : busy ? (
          "…"
        ) : (
          "⏺ Gravar"
        )}
      </button>
    </div>
  );
}

type Rec = { name: string; size: number; date: number };

const size = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1024 ** 2))} MB`);

export function RecordingsPanel() {
  const [data, setData] = useState<{ files: Rec[]; freeBytes: number | null; inProgress: string | null } | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/recordings").catch(() => null);
    if (res?.ok) setData(await res.json());
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  if (!data) return <p className="text-sm text-neutral-500">Carregando...</p>;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-neutral-400">
        Grave com <b>⏺ Gravar</b> no topo (sem estar ao vivo). Cada hora ocupa ~1,5 GB.
        {data.freeBytes !== null && (
          <>
            {" "}
            Espaço livre no servidor: <b className={data.freeBytes < 5 * 1024 ** 3 ? "text-amber-400" : "text-neutral-200"}>{size(data.freeBytes)}</b>
          </>
        )}
      </p>
      {data.files.length === 0 && <p className="text-xs text-neutral-500">Nenhuma gravação ainda.</p>}
      {data.files.map((f) => {
        const live = f.name === data.inProgress;
        return (
          <div key={f.name} className="flex items-center gap-3 rounded-md bg-neutral-950 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{f.name}</p>
              <p className="text-xs text-neutral-500">
                {new Date(f.date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {size(f.size)}
                {live && <span className="ml-2 text-red-400">● gravando</span>}
              </p>
            </div>
            {!live && (
              <>
                <a href={`/api/recordings/${encodeURIComponent(f.name)}`} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-bold hover:bg-emerald-600">
                  ⬇ Baixar
                </a>
                <button
                  onClick={async () => {
                    if (!confirm(`Apagar ${f.name} do servidor?`)) return;
                    await fetch(`/api/recordings?name=${encodeURIComponent(f.name)}`, { method: "DELETE" });
                    await load();
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  apagar
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
