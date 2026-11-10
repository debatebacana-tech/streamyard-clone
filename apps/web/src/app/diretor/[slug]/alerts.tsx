"use client";

import { useState } from "react";
import { useProgramConfig } from "./rundown";

// Donation alerts (LivePix): the overlay link goes over the stream, like a
// browser source in OBS. One link for every program.
export function AlertsPanel() {
  const { config, save } = useProgramConfig();
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  if (!config) return <p className="text-sm text-neutral-500">Carregando...</p>;
  const current = config.alertsUrl;

  function apply() {
    const value = url.trim();
    if (!/^https:\/\/\S{4,}$/.test(value)) return setMsg("Cole o link completo do overlay (começa com https://)");
    save({ alertsUrl: value });
    setUrl("");
    setMsg("Pronto! Faça um teste de alerta no LivePix e veja no monitor NO AR.");
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-neutral-400">
        {current ? (
          <>
            <span className="font-semibold text-emerald-400">● Ligado</span> — os alertas aparecem por cima da transmissão, com som.
          </>
        ) : (
          "Desligado."
        )}
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-neutral-400">
        <li>
          No LivePix, abra <b className="text-neutral-200">Overlays → Alertas</b> e copie o <b className="text-neutral-200">link do overlay</b> (o mesmo que se coloca no OBS).
        </li>
        <li>Cole aqui e salve. Vale para os 3 programas.</li>
      </ol>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
          placeholder={current ? "Colar um link novo para trocar" : "https://..."}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button onClick={apply} disabled={!url.trim()} className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium hover:bg-emerald-500 disabled:opacity-40">
          Salvar
        </button>
      </div>
      {current && (
        <button onClick={() => (save({ alertsUrl: null }), setMsg("Alertas desligados"))} className="text-xs text-neutral-500 underline hover:text-neutral-300">
          desligar alertas
        </button>
      )}
      {msg && <p className="text-xs text-neutral-300">{msg}</p>}
    </div>
  );
}
