"use client";

import { useState } from "react";
import type { TweetCard } from "@/lib/scene";
import { useDirector } from "./context";
import { useProgramConfig } from "./rundown";

// X/Twitter: line up posts by link before or during the show and put each
// one on air as a card in the show's look, beside the cameras or centered.

const input = "rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";
const btn = "rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40";
const btnOn = "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500 disabled:opacity-40";

export function TwitterPanel() {
  const { slug, scenes, patch } = useDirector();
  const { config } = useProgramConfig();
  const [tweets, setTweets] = useState<TweetCard[] | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = tweets ?? config?.tweets ?? [];
  const live = scenes.live.tweet;
  const onAir = live.visible ? live.card : null;

  async function add() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/programs/${slug}/tweets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setTweets(data.tweets);
      setUrl("");
    } else setError(data.error ?? "Falha");
    setBusy(false);
  }

  async function remove(id: string) {
    const res = await fetch(`/api/programs/${slug}/tweets?id=${id}`, { method: "DELETE" });
    if (res.ok) setTweets((await res.json()).tweets);
  }

  const show = (card: TweetCard) => patch({ tweet: { card, visible: true } }, { air: true });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-3">
        <div className="space-y-1">
          <span className="text-xs text-neutral-400">Link do post (x.com ou twitter.com) — pode ir separando antes do programa</span>
          <div className="flex gap-2">
            <input
              className={`${input} min-w-0 flex-1`}
              value={url}
              placeholder="https://x.com/usuario/status/..."
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && url.trim() && add()}
            />
            <button className={btn} disabled={busy || !url.trim()} onClick={add}>
              {busy ? "Buscando..." : "Adicionar"}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="space-y-2 rounded-md bg-neutral-950 p-3 text-sm">
          <p className="font-semibold">No ar</p>
          {onAir ? (
            <p className="text-neutral-300">
              <b>@{onAir.handle}</b> — {onAir.text.slice(0, 80)}
              {onAir.text.length > 80 && "…"}
            </p>
          ) : (
            <p className="text-xs text-neutral-500">Nenhum post na tela.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["side", "Em pé, ao lado das câmeras"],
                ["center", "Grande no centro"],
              ] as const
            ).map(([mode, text]) => (
              <button
                key={mode}
                onClick={() => patch({ tweet: { mode } }, { air: true })}
                className={`rounded-md px-3 py-1.5 text-sm ${live.mode === mode ? "bg-[#DFFF00] font-semibold text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}
              >
                {text}
              </button>
            ))}
            {onAir && (
              <button className={btn} onClick={() => patch({ tweet: { visible: false } }, { air: true })}>
                Tirar do ar
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1 rounded-md bg-neutral-950 p-3 text-xs text-neutral-400">
          <p className="font-semibold text-neutral-300">Prefere mostrar a tela do Twitter ao vivo?</p>
          <p>Compartilhe a tela (ou o celular pelo OBS) e use o layout “Tela vertical”: a tela entra em pé, recortada no meio, com as câmeras ao lado.</p>
          <button className={btn} onClick={() => patch({ layout: "vertical" })}>
            Usar “Tela vertical” na prévia
          </button>
        </div>
      </div>

      <div className="flex max-h-[560px] flex-col overflow-hidden rounded-md border border-neutral-800">
        <p className="border-b border-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-400">POSTS SEPARADOS ({list.length})</p>
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {list.length === 0 && <li className="p-3 text-sm text-neutral-500">Cole o link de um post acima.</li>}
          {list.map((t) => {
            const on = onAir?.id === t.id;
            return (
              <li key={t.id} className={`flex items-start gap-2 rounded px-2 py-2 ${on ? "bg-red-900/30" : "hover:bg-neutral-800/60"}`}>
                {t.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatar} alt="" className="mt-0.5 h-9 w-9 rounded-full" />
                ) : (
                  <span className="mt-0.5 h-9 w-9 rounded-full bg-neutral-700" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p>
                    <b>{t.name}</b> <span className="text-neutral-500">@{t.handle}</span>
                  </p>
                  <p className="line-clamp-3 text-neutral-300">{t.text}</p>
                  {t.photo && <p className="text-xs text-neutral-500">🖼 com imagem</p>}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {on ? (
                    <button className={btn} onClick={() => patch({ tweet: { visible: false } }, { air: true })}>
                      Tirar
                    </button>
                  ) : (
                    <button className={btnOn} onClick={() => show(t)}>
                      Pôr no ar
                    </button>
                  )}
                  <button className="text-xs text-neutral-500 hover:text-red-400" onClick={() => remove(t.id)}>
                    apagar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
