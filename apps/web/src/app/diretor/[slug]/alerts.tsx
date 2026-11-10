"use client";

import { useState } from "react";
import { useProgramConfig } from "./rundown";
import { useDirector } from "./context";
import { ImagePicker } from "./assets";

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

// Pix QR code card: the LivePix QR widget link or a picture of the code,
// shown on one side of the screen; on/off here or in the DESTAQUES bar.
export function PixQrPanel() {
  const { slug, assets, addAsset } = useDirector();
  const { config, save } = useProgramConfig();
  const [url, setUrl] = useState("");
  if (!config) return <p className="text-sm text-neutral-500">Carregando...</p>;
  const qr = config.qr;
  const ready = Boolean(qr.url || qr.image);
  const set = (patch: Partial<typeof qr>) => save({ qr: { ...qr, ...patch } });
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={!ready}
          onClick={() => set({ visible: !qr.visible })}
          className={`rounded-md px-4 py-2 font-bold disabled:opacity-40 ${qr.visible ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
        >
          {qr.visible ? "Tirar o QR Code do ar" : "Mostrar o QR Code no ar"}
        </button>
        <div className="flex overflow-hidden rounded-md border border-neutral-700">
          {(["left", "right"] as const).map((side) => (
            <button key={side} onClick={() => set({ side })} className={`px-3 py-1.5 text-xs ${qr.side === side ? "bg-[#DFFF00] font-semibold text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}>
              {side === "left" ? "Lado esquerdo" : "Lado direito"}
            </button>
          ))}
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-neutral-400">Texto em cima do QR</span>
        <input className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5" defaultValue={qr.label} maxLength={40} onBlur={(e) => e.target.value.trim() !== qr.label && set({ label: e.target.value.trim() })} />
      </label>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs text-neutral-400">Imagem do QR Code (baixe no LivePix ou no app do banco)</span>
          <ImagePicker slug={slug} assets={assets} value={qr.image} onChange={(image) => set({ image })} onUploaded={addAsset} />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-neutral-400">ou o link do widget de QR Code do LivePix</span>
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5" placeholder={qr.url ? "link salvo ✓ (cole outro para trocar)" : "https://..."} value={url} onChange={(e) => setUrl(e.target.value)} />
            <button
              disabled={!/^https:\/\/\S{4,}$/.test(url.trim())}
              onClick={() => {
                set({ url: url.trim() });
                setUrl("");
              }}
              className="rounded-md bg-neutral-700 px-3 py-1.5 hover:bg-neutral-600 disabled:opacity-40"
            >
              Salvar
            </button>
          </div>
          {qr.url && (
            <button onClick={() => set({ url: null })} className="text-xs text-neutral-500 underline">
              apagar link
            </button>
          )}
          <p className="text-[11px] text-neutral-500">Se tiver imagem e link, vale a imagem. Vale para os 3 programas.</p>
        </div>
      </div>
    </div>
  );
}
