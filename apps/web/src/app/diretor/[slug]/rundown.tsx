"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaCues } from "@/components/MediaLayer";
import type { ProgramConfig } from "@/lib/programConfig";
import type { ScreenText } from "@/lib/scene";
import { UploadButton, type AssetItem } from "./assets";
import { useDirector } from "./context";

const input = "rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";

export function useProgramConfig() {
  const { slug } = useDirector();
  const [config, setConfig] = useState<ProgramConfig | null>(null);

  useEffect(() => {
    fetch(`/api/programs/${slug}/config`)
      .then((r) => r.json())
      .then((d) => setConfig(d.config));
  }, [slug]);

  async function save(patch: Partial<ProgramConfig> | { screens: Partial<Record<string, Partial<ScreenText>>> }) {
    // Optimistic for simple fields so toggles and selects respond at once.
    if (!("screens" in patch)) setConfig((c) => (c ? { ...c, ...patch } : c));
    const res = await fetch(`/api/programs/${slug}/config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setConfig((await res.json()).config);
  }

  return { config, save };
}

// ------------------------------------------------------------- rundown bar

type Step = "espera" | "abertura" | "aovivo" | "intervalo" | "encerramento";

const STEPS: { step: Step; label: string; hint: string }[] = [
  { step: "espera", label: "Pré-live", hint: "Sua arte de pré-live, com contagem e trilha" },
  { step: "abertura", label: "Abertura", hint: "Sua vinheta de abertura e trilha, depois a mesa" },
  { step: "aovivo", label: "Programa", hint: "Volta para a mesa (câmeras e grafismos)" },
  { step: "intervalo", label: "Intervalo", hint: "Sua arte de intervalo com trilha" },
  { step: "encerramento", label: "Encerramento", hint: "Sua arte de encerramento com trilha" },
];

// Show flow in five clicks. Each step goes straight to air (no preview/take).
export function RundownBar() {
  const { slug, scenes, sceneRequest } = useDirector();
  const sendCue = useMediaCues();
  const [minutes, setMinutes] = useState(5);
  // The step being switched to: lit at once, before the server answers.
  const [going, setGoing] = useState<Step | null>(null);
  const { config } = useProgramConfig();
  // What each step shows: the team's own art/video, or the built-in screen.
  const missing: Partial<Record<Step, string>> = config
    ? {
        espera: config.waitingMediaUrl ? "" : "tela padrão",
        abertura: config.openingVideoUrl ? "" : "sem vinheta",
        intervalo: config.breakMediaUrl ? "" : "tela padrão",
        encerramento: config.closingMediaUrl ? "" : "tela padrão",
      }
    : {};
  const [autoOpen, setAutoOpen] = useState(false);
  const current: Step = going ?? scenes.live.step;

  async function go(step: Step) {
    if (going) return;
    setGoing(step);
    try {
      if (step === "abertura") {
        // The loaded settings answer at once; read them only if not loaded yet.
        const opening =
          config?.openingVideoUrl ??
          ((await fetch(`/api/programs/${slug}/config`).then((r) => r.json())) as { config: ProgramConfig }).config.openingVideoUrl;
        if (opening) sendCue({ type: "play", id: crypto.randomUUID(), url: opening, kind: "video", volume: 1 });
      }
      await sceneRequest({ action: "rundown", step, countdownMs: step === "espera" ? minutes * 60_000 : undefined });
    } finally {
      setGoing(null);
    }
  }

  // Pre-live countdown reached zero: start the opening by itself (if ticked).
  const countdownTo = scenes.live.step === "espera" ? scenes.live.screen.countdownTo : null;
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  useEffect(() => {
    if (!autoOpen || !countdownTo) return;
    const wait = countdownTo - Date.now();
    if (wait < -5000) return;
    const id = setTimeout(() => goRef.current("abertura"), Math.max(0, wait));
    return () => clearTimeout(id);
  }, [autoOpen, countdownTo]);

  return (
    <div className="studio-bar flex flex-wrap items-stretch gap-2 p-2">
      <span className="studio-label flex items-center px-2 text-base">ROTEIRO</span>
      {STEPS.map(({ step, label, hint }, i) => {
        const on = current === step;
        return (
          <div key={step} className="flex items-stretch">
            <button
              onClick={() => go(step)}
              title={hint}
              disabled={going !== null && going !== step}
              className={`rounded-md px-4 py-2 text-sm font-bold transition ${
                on ? "bg-[#DFFF00] text-black" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              } ${going === step ? "animate-pulse" : ""} disabled:opacity-50`}
            >
              <span className="mr-1.5 text-xs opacity-60">{i + 1}</span>
              {label}
              {going === step && <span className="ml-1.5 text-xs">…</span>}
              {missing[step] && (
                <span
                  className={`ml-1.5 rounded px-1 text-[10px] font-semibold ${on ? "bg-black/15" : "bg-white/10 text-neutral-400"}`}
                  title="Escolha a arte/vídeo em Roteiro"
                >
                  {missing[step]}
                </span>
              )}
            </button>
            {step === "espera" && (
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="ml-1 rounded-md border border-neutral-700 bg-neutral-800 px-1 text-xs"
                title="Contagem regressiva da espera"
              >
                {[0, 1, 2, 3, 5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "sem contagem" : `${m} min`}
                  </option>
                ))}
              </select>
            )}
            {step === "espera" && (
              <label className="ml-1 flex items-center gap-1 text-[11px] text-neutral-400" title="Quando a contagem do pré-live zerar, entra a Abertura sozinha">
                <input type="checkbox" checked={autoOpen} onChange={(e) => setAutoOpen(e.target.checked)} />
                abrir ao zerar
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------- rundown settings

export function AssetSelect({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  options: AssetItem[];
  onChange: (url: string | null) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-400">{label}</span>
      <select className={`${input} w-full`} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— nenhuma —</option>
        {options.map((a) => (
          <option key={a.id} value={a.url}>
            {a.kind === "video" ? "🎬 " : a.kind === "image" ? "🖼 " : "♪ "}
            {a.name}
          </option>
        ))}
      </select>
      {hint && <span className="block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

function ScreenTexts({ kind, text, onSave }: { kind: string; text: ScreenText; onSave: (t: ScreenText) => void }) {
  const [form, setForm] = useState(text);
  const [saved, setSaved] = useState(false);
  const field = (key: keyof ScreenText, label: string) => (
    <label className="block space-y-0.5">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <input className={`${input} w-full`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );
  return (
    <details className="rounded-md bg-neutral-950 p-2 text-sm">
      <summary className="cursor-pointer text-xs text-neutral-400">Sem arte? Usar tela de texto (editar)</summary>
      <div className="mt-2 space-y-2">
        {field("label", "Etiqueta")}
        {field("title", "Título grande")}
        {field("subtitle", "Frase")}
        <div className="grid grid-cols-2 gap-2">
          {field("panelLabel", "Quadro: etiqueta")}
          {field("panelTitle", kind === "espera" ? "Quadro: título (sem contagem)" : "Quadro: título")}
        </div>
        {field("panelText", "Quadro: texto")}
        <button
          className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600"
          onClick={() => {
            onSave(form);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          }}
        >
          {saved ? "Salvo ✓" : "Salvar textos"}
        </button>
      </div>
    </details>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-sm font-bold">
        <span className="mr-2 text-neutral-500">{n}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

export function RundownSettings() {
  const { slug, assets, addAsset } = useDirector();
  const { config, save } = useProgramConfig();
  if (!config) return <p className="text-sm text-neutral-500">Carregando...</p>;

  const tracks = assets.filter((a) => a.kind === "audio" && a.role === "trilha");
  const videos = assets.filter((a) => a.kind === "video");
  const art = assets.filter((a) => a.kind === "image" || a.kind === "video");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        Envie aqui suas artes e vídeos:
        <UploadButton slug={slug} accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" label="Arte ou vídeo" role="arte" onUploaded={addAsset} />
        <UploadButton slug={slug} accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a" label="Trilha" role="trilha" onUploaded={addAsset} />
        <span className="text-neutral-500">Imagens e vídeos em 1280×720 ou 1920×1080.</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StepCard n={1} title="Pré-live">
          <AssetSelect label="Sua arte ou vídeo" hint="Vídeo roda em loop. A contagem aparece num selo no canto." value={config.waitingMediaUrl} options={art} onChange={(url) => save({ waitingMediaUrl: url })} />
          <AssetSelect label="Trilha" value={config.waitingTrackUrl} options={tracks} onChange={(url) => save({ waitingTrackUrl: url })} />
          <ScreenTexts kind="espera" text={config.screens.espera} onSave={(t) => save({ screens: { espera: t } })} />
        </StepCard>
        <StepCard n={2} title="Abertura">
          <AssetSelect label="Sua vinheta de abertura (vídeo)" hint="Toca em tela cheia; quando acaba, entra a mesa." value={config.openingVideoUrl} options={videos} onChange={(url) => save({ openingVideoUrl: url })} />
          <AssetSelect label="Trilha (toca uma vez)" hint="Deixe vazio se a trilha já está no vídeo." value={config.openingTrackUrl} options={tracks} onChange={(url) => save({ openingTrackUrl: url })} />
        </StepCard>
        <StepCard n={4} title="Intervalo">
          <AssetSelect label="Sua arte ou vídeo" value={config.breakMediaUrl} options={art} onChange={(url) => save({ breakMediaUrl: url })} />
          <AssetSelect label="Trilha" value={config.breakTrackUrl} options={tracks} onChange={(url) => save({ breakTrackUrl: url })} />
          <ScreenTexts kind="intervalo" text={config.screens.intervalo} onSave={(t) => save({ screens: { intervalo: t } })} />
        </StepCard>
        <StepCard n={5} title="Encerramento">
          <AssetSelect label="Sua arte ou vídeo" value={config.closingMediaUrl} options={art} onChange={(url) => save({ closingMediaUrl: url })} />
          <AssetSelect label="Trilha (toca uma vez)" value={config.closingTrackUrl} options={tracks} onChange={(url) => save({ closingTrackUrl: url })} />
          <ScreenTexts kind="encerramento" text={config.screens.encerramento} onSave={(t) => save({ screens: { encerramento: t } })} />
        </StepCard>
      </div>
    </div>
  );
}
