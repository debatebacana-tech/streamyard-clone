"use client";

import { useCallback, useEffect, useState } from "react";
import type { Club } from "@/lib/clubs";
import type { HotSound, ProgramConfig } from "@/lib/programConfig";
import { matchesSavedScene, savedScenePatch, type ProgramBranding, type Scene } from "@/lib/scene";

// Stream-deck style control for a phone or tablet: the show's sounds, the
// score and the scenes as big buttons. Every press goes to the server (no
// video here), and the button flashes green when the server confirms.

type Flash = Record<string, "ok" | "err">;

export function ControlPad({ program, initialLive }: { program: ProgramBranding; initialLive: Scene }) {
  const slug = program.slug;
  const [live, setLive] = useState<Scene>(initialLive);
  const [config, setConfig] = useState<ProgramConfig | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [effects, setEffects] = useState<{ id: string; name: string; url: string; kind: string }[]>([]);
  const [flash, setFlash] = useState<Flash>({});

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/programs/${slug}/scene`).catch(() => null);
    if (res?.ok) setLive((await res.json()).live);
  }, [slug]);

  useEffect(() => {
    fetch(`/api/programs/${slug}/config`)
      .then((r) => r.json())
      .then((d) => setConfig(d.config));
    fetch(`/api/programs/${slug}/assets`)
      .then((r) => r.json())
      .then((d) =>
        setEffects(
          (d.assets ?? []).filter((a: { role: string; kind: string }) => a.role === "efeito" && (a.kind === "audio" || a.kind === "video")),
        ),
      );
    fetch("/api/clubs")
      .then((r) => r.json())
      .then((d) => setClubs(d.clubs ?? []));
    const id = setInterval(refresh, 2500);
    // Keep the phone screen awake during the show.
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => {
      clearInterval(id);
      lock?.release().catch(() => {});
    };
  }, [slug, refresh]);

  async function send(key: string, path: string, body: unknown) {
    const res = await fetch(`/api/programs/${slug}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setFlash((f) => ({ ...f, [key]: res?.ok ? "ok" : "err" }));
    setTimeout(() => setFlash((f) => ({ ...f, [key]: undefined as never })), 700);
    if (res?.ok && path === "scene") setLive((await res.json()).live);
  }

  const sound = (key: string, url: string | null) =>
    url && send(key, "cue", { type: "play", url, kind: /\.(mp4|webm)$/i.test(url) ? "video" : "audio", volume: 1 });
  const air = (key: string, patch: unknown) => send(key, "scene", { action: "patch", target: "both", patch });

  const ring = (key: string) => (flash[key] === "ok" ? "ring-4 ring-emerald-400" : flash[key] === "err" ? "ring-4 ring-red-500" : "");
  const big = "rounded-2xl px-3 py-5 text-lg font-black uppercase leading-tight shadow active:scale-95 transition";

  const sb = live.scoreboard;
  const clubFor = (name: string) => clubs.find((c) => c.name.toLowerCase() === name.trim().toLowerCase()) ?? null;
  const game = (["home", "away"] as const).map((side) => ({ side, club: clubFor(sb[side].name) }));
  const sounds: HotSound[] = (config?.hotSounds ?? []).filter((s) => s.url);
  const football = program.format === "futebol" || config?.scoreboardModule === true;

  return (
    <div className="min-h-screen space-y-5 bg-neutral-950 p-3 pb-32 text-white select-none">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-black">{program.name}</h1>
        <span className="text-xs text-neutral-500">controle · verde = entrou no ar</span>
      </header>

      {config && sounds.length === 0 && effects.length === 0 && !game.some((g) => g.club?.vinhetaUrl || g.club?.anthemUrl) && (
        <div className="space-y-2 rounded-2xl border border-dashed border-neutral-600 p-4 text-sm text-neutral-300">
          <p className="font-bold text-white">Nenhum áudio cadastrado ainda</p>
          <p>Os botões aparecem aqui assim que os áudios forem enviados no painel do computador:</p>
          <ul className="list-disc space-y-1 pl-5 text-neutral-400">
            <li>
              Barra <b>DESTAQUES</b> (embaixo do placar): clique em <b>enviar áudio</b> no Gol Bacana e no Eduardo Pires
            </li>
            <li>
              Aba <b>Áudio → Efeitos e vinhetas</b>: <b>＋ Efeito/vinheta</b>
            </li>
            <li>
              Aba <b>Placar → Clubes</b>: <b>＋ Vinheta</b> e <b>＋ Hino</b> de cada time
            </li>
          </ul>
          <button onClick={() => location.reload()} className="w-full rounded-xl bg-neutral-800 py-3 font-bold">
            ↻ Já enviei, atualizar
          </button>
        </div>
      )}

      {sounds.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold tracking-widest text-neutral-500">DESTAQUES</p>
          <div className="grid grid-cols-2 gap-2">
            {sounds.map((s) => (
              <button key={s.id} onClick={() => sound(s.id, s.url)} className={`${big} text-black ${ring(s.id)}`} style={{ background: s.color }}>
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {football && game.some((g) => g.club?.vinhetaUrl || g.club?.anthemUrl) && (
        <section className="space-y-2">
          <p className="text-xs font-bold tracking-widest text-neutral-500">CLUBES DO JOGO</p>
          {game.map(({ side, club }) =>
            club && (club.vinhetaUrl || club.anthemUrl) ? (
              <div key={side} className="flex items-center gap-2 rounded-2xl bg-neutral-900 p-2" style={{ borderLeft: `6px solid ${club.color}` }}>
                {club.crestUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={club.crestUrl} alt="" className="h-10 w-10 object-contain" />
                )}
                <span className="min-w-0 flex-1 truncate font-bold">{club.name}</span>
                <button
                  disabled={!club.vinhetaUrl}
                  onClick={() => sound(`${side}-v`, club.vinhetaUrl)}
                  className={`rounded-xl bg-[#DFFF00] px-4 py-4 font-black text-black disabled:opacity-25 ${ring(`${side}-v`)}`}
                >
                  📣
                </button>
                <button
                  disabled={!club.anthemUrl}
                  onClick={() => sound(`${side}-h`, club.anthemUrl)}
                  className={`rounded-xl bg-neutral-200 px-4 py-4 font-black text-black disabled:opacity-25 ${ring(`${side}-h`)}`}
                >
                  🎵
                </button>
              </div>
            ) : null,
          )}
        </section>
      )}

      {effects.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold tracking-widest text-neutral-500">EFEITOS E VINHETAS</p>
          <div className="grid grid-cols-2 gap-2">
            {effects.map((a) => (
              <button
                key={a.id}
                onClick={() => sound(`fx-${a.id}`, a.url)}
                className={`rounded-2xl bg-neutral-800 px-3 py-4 text-base font-bold leading-tight active:scale-95 ${ring(`fx-${a.id}`)}`}
              >
                {a.kind === "video" ? "🎬 " : ""}
                {a.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="pt-4 text-xs font-bold tracking-widest text-neutral-600">MAIS CONTROLES</p>

      {football && (
        <section className="space-y-2">
          <p className="text-xs font-bold tracking-widest text-neutral-500">PLACAR</p>
          <div className="grid grid-cols-2 gap-2">
            {(["home", "away"] as const).map((side) => (
              <div key={side} className="space-y-2 rounded-2xl bg-neutral-900 p-2 text-center">
                <p className="truncate text-sm font-bold uppercase">{sb[side].name}</p>
                <p className="text-5xl font-black tabular-nums">{sb[side].score}</p>
                <button
                  onClick={() => air(`${side}+`, { scoreboard: { [side]: { score: sb[side].score + 1 } } })}
                  className={`w-full rounded-xl bg-[#DFFF00] py-4 text-xl font-black text-black ${ring(`${side}+`)}`}
                >
                  ＋ GOL
                </button>
                <button
                  onClick={() => air(`${side}-`, { scoreboard: { [side]: { score: Math.max(0, sb[side].score - 1) } } })}
                  className={`w-full rounded-xl bg-neutral-800 py-2 text-sm ${ring(`${side}-`)}`}
                >
                  − tirar gol
                </button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => send("clock", "scene", { action: "clock", op: sb.clock.running ? "pause" : "start" })}
              className={`${big} ${sb.clock.running ? "bg-neutral-700" : "bg-red-600"} ${ring("clock")}`}
            >
              {sb.clock.running ? "⏸ Pausar relógio" : "▶ Iniciar relógio"}
            </button>
            <button onClick={() => air("sbvis", { scoreboard: { visible: !sb.visible } })} className={`${big} bg-neutral-800 ${ring("sbvis")}`}>
              {sb.visible ? "Tirar placar" : "Mostrar placar"}
            </button>
          </div>
        </section>
      )}

      {config && config.scenes.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-bold tracking-widest text-neutral-500">CENAS (entram direto no ar)</p>
          <div className="grid grid-cols-2 gap-2">
            {config.scenes.map((s) => {
              const on = matchesSavedScene(live, s);
              return (
                <button
                  key={s.id}
                  onClick={() => send(`scene-${s.id}`, "scene", { action: "cut", patch: savedScenePatch(s) })}
                  className={`${big} ${on ? "bg-red-600" : "bg-neutral-800"} ${ring(`scene-${s.id}`)}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <button
        onClick={() =>
          air("clean", {
            gc: { visible: false },
            tweet: { visible: false },
            media: { visible: false },
            tierList: { visible: false },
            board: { kind: "none" },
            highlight: { visible: false },
          })
        }
        className={`${big} w-full bg-neutral-200 text-black ${ring("clean")}`}
      >
        🧹 Limpar tela
      </button>

      {/* Always at hand while scrolling through the pads. */}
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/90 to-transparent p-3 pt-6">
        <button onClick={() => send("stop", "cue", { type: "stop" })} className={`${big} w-full bg-red-700 ${ring("stop")}`}>
          ⏹ Parar sons
        </button>
      </div>
    </div>
  );
}
