"use client";

import { useEffect, useState } from "react";
import type { ChatMessage, BoardGroup, BoardMatch, TweetCard } from "@/lib/scene";
import { useDirector } from "./context";
import { useProgramConfig } from "./rundown";

// Modo AO VIVO, right column: everything prepared for the show one click from
// air (GCs, posts, photos/videos, tier list, table, chat), plus a panic
// "limpar tela". Every click here goes straight to air.

type Preset = { id: string; title: string; subtitle: string; imageUrl: string | null };

const card = "space-y-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2";
const head = "flex items-center justify-between text-[11px] font-bold tracking-widest text-neutral-500";
const item = (on: boolean) =>
  `w-full truncate rounded px-2 py-1.5 text-left text-sm ${on ? "bg-red-600/30 ring-1 ring-red-600" : "bg-neutral-800 hover:bg-neutral-700"}`;
const off = "rounded bg-neutral-800 px-2 py-0.5 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-700";

// Event-time clock (outside render for the purity lint).
const clock = () => Date.now();

const isoDay = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export function LiveQueue({ scoreboard, onPrepare }: { scoreboard: boolean; onPrepare: (tab: string) => void }) {
  const { slug, scenes, patch, assets } = useDirector();
  const { config } = useProgramConfig();
  const live = scenes.live;
  const air = (p: unknown) => patch(p, { air: true });
  const [presets, setPresets] = useState<Preset[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [boardBusy, setBoardBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/programs/${slug}/gc-presets`)
      .then((r) => r.json())
      .then((d) => setPresets(d.presets ?? []));
    const load = () =>
      fetch(`/api/programs/${slug}/chat`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setChat((d.messages ?? []).slice(-6).reverse()));
    const first = setTimeout(load, 0);
    const id = setInterval(load, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [slug]);

  const media = assets.filter((a) => (a.kind === "image" || a.kind === "video") && a.role !== "clube").slice(0, 9);
  const tweets: TweetCard[] = config?.tweets ?? [];

  async function board(kind: "tabela" | "jogos") {
    setBoardBusy(kind);
    const competition = live.board.competition || "bra.1";
    const q = new URLSearchParams({ competition, kind, from: isoDay(-3), to: isoDay(3) });
    const res = await fetch(`/api/football?${q}`);
    const data = (await res.json().catch(() => ({}))) as { groups?: BoardGroup[]; matches?: BoardMatch[]; logo?: string | null };
    if (res.ok)
      air({
        board: {
          kind,
          competition,
          logo: data.logo ?? null,
          groups: kind === "tabela" ? (data.groups ?? []) : [],
          matches: kind === "jogos" ? (data.matches ?? []) : [],
        },
      });
    setBoardBusy(null);
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() =>
          air({
            gc: { visible: false },
            tweet: { visible: false },
            media: { visible: false },
            tierList: { visible: false },
            board: { kind: "none" },
            highlight: { visible: false },
          })
        }
        className="w-full rounded-lg bg-neutral-200 py-2 text-sm font-black tracking-wide text-black hover:bg-white"
        title="Tira GC, post, foto/vídeo, tier list, tabela e pergunta destacada"
      >
        🧹 LIMPAR TELA (só câmeras)
      </button>

      <div className={card}>
        <p className={head}>
          GC
          {live.gc.visible && (
            <button className={off} onClick={() => air({ gc: { visible: false } })}>
              tirar
            </button>
          )}
        </p>
        {presets.length === 0 && (
          <button className="text-xs text-neutral-500 underline" onClick={() => onPrepare("grafismos")}>
            salve GCs em Textos e grafismos
          </button>
        )}
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {presets.map((p) => {
            const on = live.gc.visible && live.gc.title === p.title;
            return (
              <button
                key={p.id}
                className={item(on)}
                onClick={() => (on ? air({ gc: { visible: false } }) : air({ gc: { title: p.title, subtitle: p.subtitle, imageUrl: p.imageUrl, visible: true } }))}
              >
                {p.subtitle && <span className="mr-1 text-[10px] text-[#DFFF00] uppercase">{p.subtitle}</span>}
                {p.title}
              </button>
            );
          })}
        </div>
      </div>

      {chat.length > 0 && (
        <div className={card}>
          <p className={head}>
            CHAT
            {live.highlight.visible && (
              <button className={off} onClick={() => air({ highlight: { visible: false } })}>
                tirar pergunta
              </button>
            )}
          </p>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {chat.map((m) => {
              const on = live.highlight.visible && live.highlight.text === m.text;
              return (
                <button
                  key={m.id}
                  className={item(on)}
                  title="Destacar na tela"
                  onClick={() =>
                    on ? air({ highlight: { visible: false } }) : air({ highlight: { visible: true, author: m.author, text: m.text, avatarUrl: m.avatarUrl } })
                  }
                >
                  <b className="text-neutral-400">{m.author}:</b> {m.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tweets.length > 0 && (
        <div className={card}>
          <p className={head}>
            TWITTER
            {live.tweet.visible && (
              <button className={off} onClick={() => air({ tweet: { visible: false } })}>
                tirar
              </button>
            )}
          </p>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {tweets.map((t) => {
              const on = live.tweet.visible && live.tweet.card?.id === t.id;
              return (
                <button key={t.id} className={item(on)} onClick={() => (on ? air({ tweet: { visible: false } }) : air({ tweet: { card: t, visible: true } }))}>
                  <b>@{t.handle}</b> {t.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {media.length > 0 && (
        <div className={card}>
          <p className={head}>
            FOTO E VÍDEO
            {live.media.visible && (
              <button className={off} onClick={() => air({ media: { visible: false } })}>
                tirar
              </button>
            )}
          </p>
          <div className="grid grid-cols-3 gap-1">
            {media.map((a) => {
              const on = live.media.visible && live.media.url === a.url;
              return (
                <button
                  key={a.id}
                  title={a.name}
                  className={`relative aspect-video overflow-hidden rounded ${on ? "ring-2 ring-red-600" : "hover:opacity-80"}`}
                  onClick={() =>
                    on
                      ? air({ media: { visible: false } })
                      : air({ media: { visible: true, url: a.url, kind: a.kind === "video" ? "video" : "image", startedAt: clock(), pausedAt: null } })
                  }
                >
                  {a.kind === "video" ? (
                    <video src={`${a.url}#t=1`} preload="metadata" muted className="h-full w-full bg-black object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="h-full w-full bg-black object-cover" />
                  )}
                  {a.kind === "video" && <span className="absolute right-0.5 bottom-0.5 text-[10px]">🎬</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={card}>
        <p className={head}>TELAS</p>
        <div className="flex flex-wrap gap-1">
          <button
            className={item(live.tierList.visible)}
            style={{ width: "auto" }}
            onClick={() => air({ tierList: { visible: !live.tierList.visible } })}
          >
            📊 Tier list{live.tierList.title && `: ${live.tierList.title}`}
          </button>
          <button className="px-1 text-xs text-neutral-500 underline" onClick={() => onPrepare("tier")}>
            montar
          </button>
          {scoreboard && (
            <>
              <button
                className={item(live.board.kind === "tabela")}
                style={{ width: "auto" }}
                disabled={boardBusy !== null}
                onClick={() => (live.board.kind === "tabela" ? air({ board: { kind: "none" } }) : board("tabela"))}
              >
                {boardBusy === "tabela" ? "..." : "🏆 Classificação"}
              </button>
              <button
                className={item(live.board.kind === "jogos")}
                style={{ width: "auto" }}
                disabled={boardBusy !== null}
                onClick={() => (live.board.kind === "jogos" ? air({ board: { kind: "none" } }) : board("jogos"))}
              >
                {boardBusy === "jogos" ? "..." : "📅 Jogos da rodada"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
