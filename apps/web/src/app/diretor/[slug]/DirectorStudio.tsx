"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ControlBar, LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { ShowComposition } from "@/components/ShowComposition";
import type { ProgramBranding } from "@/lib/scene";
import type { AssetItem } from "./assets";
import { DirectorContext, useDirector, type DirectorCtx, type SceneRequest, type Scenes } from "./context";
import {
  GcPanel,
  IdentityPanel,
  InvitePanel,
  LayoutPanel,
  ObsPanel,
  Panel,
  ScoreboardPanel,
  SoundPanel,
  StagePanel,
  TickerSponsorPanel,
} from "./panels";

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
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <p className={`text-xs font-bold tracking-widest ${tone === "red" ? "text-red-500" : "text-emerald-500"}`}>{label}</p>
      <div className={`aspect-video overflow-hidden rounded-md border-2 bg-black ${tone === "red" ? "border-red-600" : "border-emerald-600"}`}>
        {children}
      </div>
    </div>
  );
}

function Workspace() {
  const { scenes, direct, setDirect, sceneRequest } = useDirector();
  const pending = JSON.stringify(scenes.draft) !== JSON.stringify(scenes.live);

  return (
    <div className="space-y-4">
      <div className="flex items-stretch gap-3">
        <Monitor label="PRÉVIA" tone="green">
          <ShowComposition scene={scenes.draft} emptyHint="Ninguém em cena — use “Pôr em cena” nos participantes" />
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
          <ShowComposition media="play" emptyHint="Ninguém em cena" />
        </Monitor>
      </div>
      <ControlBar controls={{ microphone: true, camera: true, screenShare: true, leave: false, chat: false }} />
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
      body: JSON.stringify({ program: slug, name: "Diretor", clientId: clientId() }),
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
        <div className="mx-auto w-full max-w-[1500px] flex-1 space-y-4 p-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/diretor" className="text-sm text-neutral-400 hover:text-neutral-200">← Programas</Link>
              <span className="h-6 w-1.5 rounded" style={{ background: branding.primaryColor }} />
              <h1 className="text-xl font-bold">{branding.name}</h1>
            </div>
            <LiveControl slug={slug} />
          </header>

          <Workspace />

          <Panel title="Participantes">
            <StagePanel />
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4">
              <Panel title="Layout">
                <LayoutPanel />
              </Panel>
              <Panel title="GC (gerador de caracteres)">
                <GcPanel />
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel title="Placar e cronômetro">
                <ScoreboardPanel />
              </Panel>
              <Panel title="Letreiro e patrocínio">
                <TickerSponsorPanel />
              </Panel>
            </div>
            <div className="space-y-4">
              <Panel title="Central de áudio e vinhetas" right={<span className="text-[10px] text-neutral-500">teclas 1–9 · Esc para parar</span>}>
                <SoundPanel />
              </Panel>
              <Panel title="Identidade do programa">
                <IdentityPanel />
              </Panel>
              <Panel title="Convidados">
                <InvitePanel />
              </Panel>
              <Panel title="OBS">
                <ObsPanel />
              </Panel>
            </div>
          </div>
        </div>
      </LiveKitRoom>
    </DirectorContext.Provider>
  );
}
