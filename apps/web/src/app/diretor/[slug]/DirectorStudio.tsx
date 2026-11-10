"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ControlBar, LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { ShowComposition } from "@/components/ShowComposition";
import { AudioUnlock } from "@/components/MusicLayer";
import type { ProgramBranding } from "@/lib/scene";
import type { AssetItem } from "./assets";
import { DirectorContext, useDirector, type DirectorCtx, type SceneRequest, type Scenes } from "./context";
import { scoreboardEnabled } from "@/lib/programConfig";
import { EffectsPanel, MusicPanel } from "./audio";
import {
  GcPanel,
  IdentityPanel,
  InvitePanel,
  LayoutPanel,
  ModulesPanel,
  ObsPanel,
  Panel,
  QuickScore,
  ScoreboardPanel,
  StagePanel,
  ThemePanel,
  TickerSponsorPanel,
  WebPanel,
} from "./panels";
import { RundownBar, RundownSettings, useProgramConfig } from "./rundown";
import { ScenesBar, TransitionPanel } from "./scenes";
import { BoardAutoRefresh, BoardPanel } from "./board";
import { TierListPanel } from "./tierlist";
import { TwitterPanel } from "./twitter";
import { MediaPanel } from "./media";
import { ClubPads, ClubsPanel } from "./clubs";
import { MyName, savedDirectorName } from "./names";
import { CropPanel } from "./crop";
import { HotSoundsBar } from "./hotsounds";
import { ChatTab } from "./chat";

function clientId(): string {
  const key = "studio-client-id";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

type LiveStatus = { live: boolean; otherLive: string | null; lastError: string | null };

function LiveControl({ slug }: { slug: string }) {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/programs/${slug}/live`);
    if (!res.ok) return;
    const next: LiveStatus = await res.json();
    setStatus(next);
    if (next.lastError) setError(`A transmissão caiu: ${next.lastError}`);
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
    if (status?.live && !confirm("Encerrar a transmissão no YouTube?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/programs/${slug}/live`, { method: status?.live ? "DELETE" : "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Falha");
    await refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="max-w-md truncate text-xs text-red-400" title={error}>{error}</span>}
      {status?.otherLive && !status.live && <span className="text-xs text-amber-400">{status.otherLive} está no ar</span>}
      {status?.live && <span className="animate-pulse rounded bg-red-600 px-2 py-1 text-xs font-bold">● AO VIVO</span>}
      <button
        onClick={toggle}
        disabled={busy || !status || Boolean(status.otherLive && !status.live)}
        className={`rounded-md px-4 py-2 text-sm font-bold disabled:opacity-40 ${
          status?.live ? "bg-neutral-700 hover:bg-neutral-600" : "bg-red-600 hover:bg-red-500"
        }`}
      >
        {busy ? "Aguarde..." : status?.live ? "Encerrar transmissão" : "Ir ao vivo no YouTube"}
      </button>
    </div>
  );
}

function Monitor({ label, tone, children }: { label: string; tone: "green" | "red"; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  // Whole-screen view of the monitor (Esc or the button again to leave).
  const toggle = () => {
    const job = document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen();
    job?.catch(() => {});
  };
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <p className={`flex items-center gap-2 text-xs font-bold tracking-widest ${tone === "red" ? "text-red-500" : "text-emerald-500"}`}>
        <span>
          {label} <span className="font-normal tracking-normal text-neutral-500">· arraste uma janela sobre outra para trocar</span>
        </span>
        <button
          onClick={toggle}
          className="ml-auto rounded border border-white/10 px-2 py-0.5 text-[11px] font-semibold tracking-normal text-neutral-300 hover:border-white/30 hover:text-white"
          title="Ver este monitor em tela cheia (Esc para sair)"
        >
          ⛶ Tela cheia
        </button>
      </p>
      <div
        ref={box}
        className={`relative overflow-hidden bg-black ${full ? "h-full w-full" : `aspect-video rounded-md border-2 ${tone === "red" ? "border-red-600" : "border-emerald-600"}`}`}
      >
        {children}
        {full && (
          <button
            onClick={toggle}
            className="absolute top-3 right-3 z-[80] rounded-md bg-black/60 px-3 py-1.5 text-sm text-white opacity-30 hover:opacity-100"
          >
            ✕ Sair da tela cheia
          </button>
        )}
      </div>
    </div>
  );
}

function Workspace() {
  const { scenes, direct, setDirect, sceneRequest, patch } = useDirector();
  const pending = JSON.stringify(scenes.draft) !== JSON.stringify(scenes.live);

  return (
    <div className="space-y-4">
      <div className="flex items-stretch gap-3">
        <Monitor label="PRÉVIA" tone="green">
          <ShowComposition
            scene={scenes.draft}
            emptyHint="Ninguém em cena — use “Pôr em cena” nos participantes"
            onArrange={(p) => patch(p)}
          />
        </Monitor>
        <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-2">
          <button
            onClick={() => sceneRequest({ action: "take" })}
            disabled={direct || !pending}
            className="w-full rounded-md bg-red-600 py-4 text-sm font-black tracking-wider hover:bg-red-500 disabled:opacity-30"
            title="Envia a prévia para o ar"
          >
            CORTAR ▶
          </button>
          <label className="flex items-center gap-1 text-center text-[11px] leading-tight text-neutral-400">
            <input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} />
            direto no ar
          </label>
        </div>
        <Monitor label="NO AR" tone="red">
          <ShowComposition media="play" emptyHint="Ninguém em cena" onArrange={(p) => patch(p, { air: true })} />
          <AudioUnlock />
        </Monitor>
      </div>
      <ControlBar controls={{ microphone: true, camera: true, screenShare: true, leave: false, chat: false }} />
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Espaço", "Cortar a prévia para o ar (com a animação)"],
  ["Q W E R T Y U I", "Cenas da barra CENAS (1ª, 2ª, 3ª...)"],
  ["Z X C V B N", "Destaques (Gol Bacana, Eduardo Pires...)"],
  ["A / S", "Vinheta / hino do clube da casa"],
  ["D / F", "Vinheta / hino do visitante"],
  ["1 a 9", "Efeitos da aba Áudio (com a aba aberta)"],
  ["Esc", "Para efeitos, vinhetas e hinos"],
  ["?", "Mostra esta cola"],
];

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-xl border border-neutral-700 bg-neutral-900 p-5" onClick={(e) => e.stopPropagation()}>
        <p className="text-lg font-bold">Atalhos de teclado</p>
        <ul className="space-y-1.5 text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <li key={k} className="flex gap-3">
              <kbd className="w-32 shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-center font-mono text-xs text-[#DFFF00]">{k}</kbd>
              <span className="text-neutral-300">{v}</span>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="w-full rounded-md bg-neutral-700 py-1.5 text-sm hover:bg-neutral-600">
          Fechar
        </button>
      </div>
    </div>
  );
}

type TabId = "midia" | "twitter" | "tier" | "rodada" | "cena" | "chat" | "grafismos" | "placar" | "audio" | "roteiro" | "ajustes";

// Everything below the provider: header, rundown, monitors and the tabs.
function Desk() {
  const { slug, branding } = useDirector();
  const { config, save } = useProgramConfig();
  const football = branding.format === "futebol";
  const scoreboard = scoreboardEnabled(config, branding.format);
  const [tab, setTab] = useState<TabId>("cena");

  // In the order the team uses them most.
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "cena", label: "Cenas", icon: "🎬" },
    { id: "audio", label: "Áudios", icon: "🔊" },
    { id: "chat", label: "Chat", icon: "💬" },
    ...(scoreboard
      ? [
          { id: "placar" as const, label: "Placar", icon: "⚽" },
          { id: "rodada" as const, label: "Rodada e tabela", icon: "🏆" },
        ]
      : []),
    { id: "grafismos", label: "Textos", icon: "🅰️" },
    { id: "midia", label: "Foto e vídeo", icon: "🖼️" },
    { id: "tier", label: "Tier list", icon: "📊" },
    { id: "twitter", label: "Twitter", icon: "𝕏" },
    { id: "roteiro", label: "Roteiro", icon: "🗂️" },
    { id: "ajustes", label: "Ajustes", icon: "⚙️" },
  ];
  const active = tabs.some((t) => t.id === tab) ? tab : "cena";
  const [help, setHelp] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "?") setHelp((h) => !h);
      if (e.key === "Escape") setHelp(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const header = (
    <header className="studio-bar flex flex-wrap items-center justify-between gap-3 px-4 py-2">
      <div className="flex items-center gap-4">
        <Link href="/diretor" className="flex items-center gap-3" title="Todos os programas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/debate-bacana.png" alt="Debate Bacana" className="h-12 w-auto drop-shadow-[0_0_12px_rgba(174,223,2,0.35)]" />
        </Link>
        <span className="h-10 w-px bg-white/15" />
        <div className="leading-tight">
          <Link href="/diretor" className="text-[11px] tracking-widest text-neutral-500 uppercase hover:text-neutral-300">
            ← Programas
          </Link>
          <h1 className="text-2xl leading-none uppercase" style={{ fontFamily: "var(--font-display), Impact, sans-serif" }}>
            {branding.name}
          </h1>
        </div>
        {/* The program's own logo (e.g. Sábado Bacana) next to the brand. */}
        {branding.logoUrl && !branding.logoUrl.includes("debate") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="h-12 w-auto object-contain" />
        )}
        <span className="hidden items-center gap-[3px] md:flex">
          <span className="h-1 w-6 rounded-full bg-[var(--db-lime)]" />
          <span className="h-1 w-1 rounded-full bg-[var(--db-lime)]" />
          <span className="h-1 w-1 rounded-full bg-[var(--db-lime)]" />
        </span>
      </div>
      <div className="flex items-center gap-3">
        <MyName />
        <a
          href={`/controle/${slug}`}
          target="_blank"
          className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:border-[var(--db-lime)] hover:text-white"
          title="Abra no celular: botões grandes de sons, placar e cenas"
        >
          📱 Controle no celular
        </a>
        <button
          onClick={() => setHelp(true)}
          className="h-8 w-8 rounded-full border border-white/10 text-sm text-neutral-300 hover:border-[var(--db-lime)] hover:text-white"
          title="Atalhos de teclado (?)"
        >
          ?
        </button>
        <LiveControl slug={slug} />
      </div>
    </header>
  );

  const helpModal = help && <ShortcutsHelp onClose={() => setHelp(false)} />;

  return (
    <div className="studio-bg min-h-full w-full flex-1">
    <div className="mx-auto w-full max-w-[1500px] space-y-4 p-4">
      {header}
      {helpModal}

      <RundownBar />
      <ScenesBar />
      <Workspace />
      {football && <QuickScore />}
      <HotSoundsBar always={football} />
      <BoardAutoRefresh />

      <nav className="studio-bar flex flex-wrap gap-1.5 p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              active === t.id
                ? "bg-[var(--db-lime)] text-black shadow-[0_0_18px_rgba(174,223,2,0.35)]"
                : "text-neutral-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {active === "cena" && (
        <div className="space-y-4">
          <Panel title="Participantes">
            <StagePanel />
          </Panel>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Layout e título">
              <LayoutPanel />
            </Panel>
            <Panel title="Página web (widget)">
              <WebPanel />
            </Panel>
          </div>
          <Panel title="Recortar tela compartilhada (campinho)">
            <CropPanel />
          </Panel>
          <Panel title="Transição entre cenas">
            <TransitionPanel />
          </Panel>
        </div>
      )}

      {active === "midia" && (
        <Panel title="Projetar foto ou vídeo">
          <MediaPanel />
        </Panel>
      )}

      {active === "twitter" && (
        <Panel title="Twitter / X">
          <TwitterPanel />
        </Panel>
      )}

      {active === "tier" && (
        <Panel title="Tier list">
          <TierListPanel />
        </Panel>
      )}

      {active === "rodada" && (
        <Panel title="Jogos da rodada e classificação">
          <BoardPanel />
        </Panel>
      )}

      {active === "chat" && (
        <Panel title="Chat do YouTube">
          <ChatTab />
        </Panel>
      )}

      {active === "grafismos" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="GC — pauta da mesa">
            <GcPanel />
          </Panel>
          <Panel title="Letreiro e apoio">
            <TickerSponsorPanel />
          </Panel>
        </div>
      )}

      {active === "placar" && (
        <div className="space-y-4">
          <Panel title="Clubes — escudo, vinheta e hino">
            <ClubsPanel />
          </Panel>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Placar e cronômetro">
              <ScoreboardPanel />
            </Panel>
            <Panel title="Competição">
              <ThemePanel />
            </Panel>
          </div>
        </div>
      )}

      {active === "audio" && scoreboard && (
        <Panel title="Clubes do jogo — vinheta e hino" right={<span className="text-[10px] text-neutral-500">áudios rápidos · por cima da trilha</span>}>
          <ClubPads />
        </Panel>
      )}

      {active === "audio" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Trilha de fundo" right={<span className="text-[10px] text-neutral-500">uma por vez · em loop</span>}>
            <MusicPanel />
          </Panel>
          <Panel title="Efeitos e vinhetas" right={<span className="text-[10px] text-neutral-500">teclas 1–9 · Esc para parar</span>}>
            <EffectsPanel />
          </Panel>
        </div>
      )}

      {active === "roteiro" && (
        <Panel title="Abertura, espera, intervalo e encerramento">
          <RundownSettings />
        </Panel>
      )}

      {active === "ajustes" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Identidade">
            <IdentityPanel />
          </Panel>
          <div className="space-y-4">
            <Panel title="Módulos">
              <ModulesPanel football={football} scoreboardOn={scoreboard} onChange={(on) => save({ scoreboardModule: on })} />
            </Panel>
            <Panel title="Convidados">
              <InvitePanel />
            </Panel>
            <Panel title="OBS">
              <ObsPanel />
            </Panel>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

export function DirectorStudio({ program, initialScenes }: { program: ProgramBranding; initialScenes: Scenes }) {
  const slug = program.slug;
  const [credentials, setCredentials] = useState<{ token: string; wsUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branding, setBranding] = useState(program);
  const [scenes, setScenes] = useState<Scenes>(initialScenes);
  const [direct, setDirect] = useState(false);
  const [assets, setAssets] = useState<AssetItem[]>([]);

  useEffect(() => {
    fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program: slug, name: savedDirectorName(), clientId: clientId() }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Falha ao conectar");
        setCredentials({ token: d.token, wsUrl: d.wsUrl });
      })
      .catch((e) => setError(e.message));
    fetch(`/api/programs/${slug}/assets`)
      .then((r) => r.json())
      .then((d) => setAssets(d.assets ?? []));
  }, [slug]);

  const sceneRequest = useCallback(
    async (body: SceneRequest) => {
      const res = await fetch(`/api/programs/${slug}/scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) setScenes(await res.json());
    },
    [slug],
  );

  const ctx = useMemo<DirectorCtx>(
    () => ({
      slug,
      branding,
      setBranding,
      scenes,
      direct,
      setDirect,
      patch: (patch, opts) => sceneRequest({ action: "patch", target: direct || opts?.air ? "both" : "draft", patch }),
      sceneRequest,
      assets,
      addAsset: (asset) => setAssets((list) => [asset, ...list]),
      removeAsset: async (id) => {
        await fetch(`/api/programs/${slug}/assets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        setAssets((list) => list.filter((a) => a.id !== id));
      },
    }),
    [slug, branding, scenes, direct, sceneRequest, assets],
  );

  if (error) return <div className="flex flex-1 items-center justify-center text-red-400">{error}</div>;
  if (!credentials) return <div className="flex flex-1 items-center justify-center">Conectando ao {program.name}...</div>;

  return (
    <DirectorContext.Provider value={ctx}>
      <LiveKitRoom
        serverUrl={credentials.wsUrl}
        token={credentials.token}
        connect
        audio={false}
        video={false}
        data-lk-theme="default"
        className="flex flex-1 flex-col"
      >
        <RoomAudioRenderer />
        <Desk />
      </LiveKitRoom>
    </DirectorContext.Provider>
  );
}
