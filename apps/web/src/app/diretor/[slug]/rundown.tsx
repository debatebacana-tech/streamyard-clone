"use client";

import { useEffect, useState } from "react";
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
  { step: "espera", label: "Espera", hint: "Tela “Começamos em instantes” com contagem e trilha de espera" },
  { step: "abertura", label: "Abertura", hint: "Vinheta e trilha de abertura, depois a mesa" },
  { step: "aovivo", label: "Programa", hint: "Volta para a mesa (câmeras e grafismos)" },
  { step: "intervalo", label: "Intervalo", hint: "Tela “Já voltamos” com trilha" },
  { step: "encerramento", label: "Encerramento", hint: "Tela “Até a próxima” com trilha de encerramento" },
];

// Show flow in five clicks. Each step goes straight to air (no preview/take).
export function RundownBar() {
  const { slug, scenes, sceneRequest } = useDirector();
  const sendCue = useMediaCues();
  const [minutes, setMinutes] = useState(5);
  const kind = scenes.live.screen.kind;
  const current: Step = kind === "none" ? "aovivo" : kind;

  async function go(step: Step) {
    if (step === "abertura") {
      // Read fresh: the stinger may have just been chosen in the Roteiro tab.
      const { config } = (await fetch(`/api/programs/${slug}/config`).then((r) => r.json())) as { config: ProgramConfig };
      if (config.openingVideoUrl) {
        sendCue({ type: "play", id: crypto.randomUUID(), url: config.openingVideoUrl, kind: "video", volume: 1 });
      }
    }
    await sceneRequest({ action: "rundown", step, countdownMs: step === "espera" ? minutes * 60_000 : undefined });
  }

  return (
    <div className="flex flex-wrap items-stretch gap-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2">
      <span className="flex items-center px-2 text-xs font-bold tracking-widest text-neutral-500">ROTEIRO</span>
      {STEPS.map(({ step, label, hint }, i) => {
        const on = current === step;
        return (
          <div key={step} className="flex items-stretch">
            <button
              onClick={() => go(step)}
              title={hint}
              className={`rounded-md px-4 py-2 text-sm font-bold ${
                on ? "bg-[#DFFF00] text-black" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              }`}
            >
              <span className="mr-1.5 text-xs opacity-60">{i + 1}</span>
              {label}
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
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------- rundown settings

function AssetSelect({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string | null;
  options: AssetItem[];
  onChange: (url: string | null) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-neutral-200">{label}</span>
      <select className={`${input} w-full`} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— nenhuma —</option>
        {options.map((a) => (
          <option key={a.id} value={a.url}>
            {a.name}
          </option>
        ))}
      </select>
      <span className="block text-[11px] text-neutral-500">{hint}</span>
    </label>
  );
}

function ScreenEditor({ kind, title, text, onSave }: { kind: string; title: string; text: ScreenText; onSave: (t: ScreenText) => void }) {
  const [form, setForm] = useState(text);
  const [saved, setSaved] = useState(false);
  const field = (key: keyof ScreenText, label: string) => (
    <label className="block space-y-0.5">
      <span className="text-[11px] text-neutral-500">{label}</span>
      <input className={`${input} w-full`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  );
  return (
    <div className="space-y-2 rounded-md bg-neutral-950 p-3" data-screen={kind}>
      <p className="text-sm font-semibold">{title}</p>
      {field("label", "Etiqueta (limão)")}
      {field("title", "Título grande")}
      {field("subtitle", "Frase")}
      <div className="grid grid-cols-2 gap-2">
        {field("panelLabel", "Painel: etiqueta")}
        {field("panelTitle", kind === "espera" ? "Painel: título (sem contagem)" : "Painel: título")}
      </div>
      {field("panelText", "Painel: texto")}
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
  );
}

export function RundownSettings() {
  const { slug, assets, addAsset } = useDirector();
  const { config, save } = useProgramConfig();
  if (!config) return <p className="text-sm text-neutral-500">Carregando...</p>;

  const tracks = assets.filter((a) => a.kind === "audio" && a.role === "trilha");
  const videos = assets.filter((a) => a.kind === "video");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AssetSelect
          label="Vinheta de abertura (vídeo)"
          hint="Toca em tela cheia ao clicar em Abertura."
          value={config.openingVideoUrl}
          options={videos}
          onChange={(url) => save({ openingVideoUrl: url })}
        />
        <AssetSelect
          label="Trilha de abertura"
          hint="Começa junto com a abertura e toca uma vez."
          value={config.openingTrackUrl}
          options={tracks}
          onChange={(url) => save({ openingTrackUrl: url })}
        />
        <AssetSelect
          label="Trilha de espera"
          hint="Em loop na tela “Começamos em instantes”."
          value={config.waitingTrackUrl}
          options={tracks}
          onChange={(url) => save({ waitingTrackUrl: url })}
        />
        <AssetSelect
          label="Trilha de intervalo"
          hint="Em loop na tela “Já voltamos”."
          value={config.breakTrackUrl}
          options={tracks}
          onChange={(url) => save({ breakTrackUrl: url })}
        />
        <AssetSelect
          label="Trilha de encerramento"
          hint="Toca uma vez na tela “Até a próxima”."
          value={config.closingTrackUrl}
          options={tracks}
          onChange={(url) => save({ closingTrackUrl: url })}
        />
        <div className="flex flex-wrap items-end gap-2">
          <UploadButton slug={slug} accept="video/mp4,video/webm" label="Vídeo de vinheta" role="efeito" onUploaded={addAsset} />
          <UploadButton slug={slug} accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a" label="Trilha" role="trilha" onUploaded={addAsset} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ScreenEditor kind="espera" title="Tela de espera" text={config.screens.espera} onSave={(t) => save({ screens: { espera: t } })} />
        <ScreenEditor kind="intervalo" title="Tela de intervalo" text={config.screens.intervalo} onSave={(t) => save({ screens: { intervalo: t } })} />
        <ScreenEditor
          kind="encerramento"
          title="Tela de encerramento"
          text={config.screens.encerramento}
          onSave={(t) => save({ screens: { encerramento: t } })}
        />
      </div>
    </div>
  );
}
