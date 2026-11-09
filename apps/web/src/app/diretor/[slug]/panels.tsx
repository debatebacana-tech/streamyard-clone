"use client";

import { useEffect, useState, type ReactNode } from "react";
import { VideoTrack, isTrackReference, useParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useMediaCues } from "@/components/MediaLayer";
import { dedupeTracks } from "@/components/ShowComposition";
import { LAYOUTS, clockElapsedMs, formatClock, type Team } from "@/lib/scene";
import { ImagePicker, UploadButton } from "./assets";
import { useDirector } from "./context";

const input = "rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";
const btn = "rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40";
const btnOn = "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500";

export function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Toggle({ on, onClick, labels = ["Mostrar", "Ocultar"] }: { on: boolean; onClick: () => void; labels?: [string, string] }) {
  return (
    <button onClick={onClick} className={on ? btnOn : btn}>
      {on ? labels[1] : labels[0]}
    </button>
  );
}

// ---------------------------------------------------------------- participants

export function StagePanel() {
  const { slug, scenes, patch } = useDirector();
  const participants = useParticipants().filter((p) => !p.identity.startsWith("layout-viewer"));
  const cams = dedupeTracks(useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false }));
  const { draft, live } = scenes;

  async function moderate(action: "remove" | "mute", identity: string, trackSid?: string) {
    await fetch(`/api/programs/${slug}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, identity, trackSid }),
    });
  }

  function toggleStage(identity: string) {
    const onStage = draft.onStage.includes(identity)
      ? draft.onStage.filter((id) => id !== identity)
      : [...draft.onStage, identity];
    return patch({ onStage, featured: onStage.includes(draft.featured ?? "") ? draft.featured : null });
  }

  if (participants.length === 0) {
    return <p className="text-sm text-neutral-500">Ninguém na sala. Envie o link de convite aos apresentadores.</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {participants.map((p) => {
        const cam = cams.find((t) => t.participant.identity === p.identity);
        const mic = p.getTrackPublication(Track.Source.Microphone);
        const inDraft = draft.onStage.includes(p.identity);
        const onAir = live.onStage.includes(p.identity);
        const name = p.isLocal ? `${p.name || "Diretor"} (você)` : p.name || p.identity;
        return (
          <li key={p.identity} className={`overflow-hidden rounded-lg border ${onAir ? "border-red-600" : inDraft ? "border-emerald-600" : "border-neutral-800"} bg-neutral-950`}>
            <div className="relative aspect-video bg-neutral-800">
              {cam && isTrackReference(cam) && !cam.publication.isMuted ? (
                <VideoTrack trackRef={cam} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl text-neutral-500">{name.charAt(0).toUpperCase()}</div>
              )}
              <div className="absolute top-1 left-1 flex gap-1 text-[10px] font-bold">
                {onAir && <span className="rounded bg-red-600 px-1.5">NO AR</span>}
                {inDraft && !onAir && <span className="rounded bg-emerald-600 px-1.5">PRÉVIA</span>}
                {draft.featured === p.identity && <span className="rounded bg-amber-500 px-1.5 text-black">★</span>}
              </div>
              {(!mic || mic.isMuted) && <span className="absolute top-1 right-1 rounded bg-black/70 px-1.5 text-[10px]">mic off</span>}
            </div>
            <div className="space-y-1.5 p-2">
              <p className="truncate text-sm font-medium" title={name}>{name}</p>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => toggleStage(p.identity)} className={`rounded px-2 py-1 text-xs ${inDraft ? "bg-neutral-700 hover:bg-neutral-600" : "bg-emerald-700 hover:bg-emerald-600"}`}>
                  {inDraft ? "Tirar de cena" : "Pôr em cena"}
                </button>
                <button onClick={() => patch({ featured: draft.featured === p.identity ? null : p.identity })} className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600" title="Destaque nos layouts Destaque, PiP e Só um">
                  ★
                </button>
                {!p.isLocal && mic && !mic.isMuted && (
                  <button onClick={() => moderate("mute", p.identity, mic.trackSid)} className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600">
                    Mutar
                  </button>
                )}
                {!p.isLocal && (
                  <button onClick={() => confirm(`Remover ${name} da sala?`) && moderate("remove", p.identity)} className="rounded bg-neutral-800 px-2 py-1 text-xs text-red-400 hover:bg-red-900/40">
                    ✕
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------- layout

export function LayoutPanel() {
  const { scenes, patch } = useDirector();
  const { draft } = scenes;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {LAYOUTS.map((l) => (
          <button key={l.mode} onClick={() => patch({ layout: l.mode })} className={draft.layout === l.mode ? btnOn : btn}>
            {l.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={draft.showLogo} onChange={(e) => patch({ showLogo: e.target.checked })} />
        Mostrar logo do programa no topo
      </label>
    </div>
  );
}

// -------------------------------------------------------------------------- GC

type Preset = { id: string; title: string; subtitle: string; imageUrl: string | null };

export function GcPanel() {
  const { slug, scenes, patch, assets, addAsset } = useDirector();
  const { draft, live } = scenes;
  const [title, setTitle] = useState(draft.gc.title);
  const [subtitle, setSubtitle] = useState(draft.gc.subtitle);
  const [imageUrl, setImageUrl] = useState<string | null>(draft.gc.imageUrl);
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    fetch(`/api/programs/${slug}/gc-presets`)
      .then((r) => r.json())
      .then((d) => setPresets(d.presets ?? []));
  }, [slug]);

  function show(gc: { title: string; subtitle: string; imageUrl: string | null }) {
    return patch({ gc: { ...gc, visible: true } });
  }

  async function savePreset() {
    if (!title.trim()) return;
    const res = await fetch(`/api/programs/${slug}/gc-presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subtitle, imageUrl }),
    });
    if (res.ok) {
      const { preset } = await res.json();
      setPresets((list) => [...list, preset]);
    }
  }

  async function deletePreset(id: string) {
    await fetch(`/api/programs/${slug}/gc-presets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setPresets((list) => list.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <ImagePicker slug={slug} assets={assets} value={imageUrl} onChange={setImageUrl} onUploaded={addAsset} />
        <div className="flex flex-1 flex-col gap-2">
          <input className={input} placeholder="Título (ex: PRESIDENTE DO FLU CANCELADO POR FRASE)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={input} placeholder="Etiqueta acima (opcional, ex: AO VIVO / NOME DO CONVIDADO)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btnOn} disabled={!title.trim()} onClick={() => show({ title, subtitle, imageUrl })}>
          Mostrar GC
        </button>
        <button className={btn} onClick={() => patch({ gc: { visible: false } })} disabled={!draft.gc.visible}>
          Ocultar GC
        </button>
        <button className={btn} onClick={savePreset} disabled={!title.trim()}>
          Salvar na lista
        </button>
      </div>
      {live.gc.visible && <p className="truncate text-xs text-red-400">No ar: {live.gc.title}</p>}
      {presets.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded bg-neutral-800/70 px-2 py-1">
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="h-6 w-6 object-contain" />
              )}
              <button
                className="flex-1 truncate text-left text-sm hover:text-white"
                title="Mostrar este GC"
                onClick={() => {
                  setTitle(p.title);
                  setSubtitle(p.subtitle);
                  setImageUrl(p.imageUrl);
                  show(p);
                }}
              >
                {p.title}
                {p.subtitle && <span className="text-neutral-500"> · {p.subtitle}</span>}
              </button>
              <button onClick={() => deletePreset(p.id)} className="text-xs text-neutral-500 hover:text-red-400">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ scoreboard

function LiveClock() {
  const { scenes } = useDirector();
  const clock = scenes.live.scoreboard.clock;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!clock.running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [clock.running]);
  return <span className="font-mono text-3xl tabular-nums">{formatClock(clockElapsedMs(clock, now))}</span>;
}

function TeamEditor({ side }: { side: "home" | "away" }) {
  const { slug, scenes, patch, assets, addAsset } = useDirector();
  const team: Team = scenes.draft.scoreboard[side];
  const liveScore = scenes.live.scoreboard[side].score;
  const [name, setName] = useState(team.name);
  const setTeam = (t: Partial<Team>, air = false) => patch({ scoreboard: { [side]: t } }, { air });

  return (
    <div className="space-y-2 rounded-md bg-neutral-950 p-2">
      <div className="flex items-center gap-2">
        <input className={`${input} min-w-0 flex-1 uppercase`} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== team.name && setTeam({ name })} placeholder={side === "home" ? "Time da casa" : "Visitante"} />
        <input type="color" value={team.color} onChange={(e) => setTeam({ color: e.target.value })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent" title="Cor do time" />
      </div>
      <ImagePicker slug={slug} assets={assets} value={team.crestUrl} onChange={(url) => setTeam({ crestUrl: url })} onUploaded={addAsset} />
      <div className="flex items-center justify-between">
        <button className={btn} onClick={() => setTeam({ score: Math.max(0, liveScore - 1) }, true)}>−</button>
        <span className="text-4xl font-bold tabular-nums">{liveScore}</span>
        <button className={btnOn} onClick={() => setTeam({ score: liveScore + 1 }, true)}>＋ GOL</button>
      </div>
    </div>
  );
}

const PERIODS = ["1º T", "INT", "2º T", "PRORR", "PÊN"];

export function ScoreboardPanel() {
  const { scenes, patch, sceneRequest } = useDirector();
  const { draft, live } = scenes;
  const clock = live.scoreboard.clock;
  const [setValue, setSetValue] = useState("45:00");

  function setClock() {
    const [m, s] = setValue.split(":").map((v) => parseInt(v, 10));
    if (Number.isNaN(m)) return;
    sceneRequest({ action: "clock", op: "set", ms: (m * 60 + (Number.isNaN(s) ? 0 : s)) * 1000 });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Toggle on={draft.scoreboard.visible} onClick={() => patch({ scoreboard: { visible: !draft.scoreboard.visible } })} labels={["Mostrar placar", "Ocultar placar"]} />
        <select className={input} value={draft.scoreboard.style} onChange={(e) => patch({ scoreboard: { style: e.target.value } })}>
          <option value="bug">Estilo selo (canto)</option>
          <option value="bar">Estilo barra (embaixo)</option>
        </select>
        <label className="flex items-center gap-1 text-sm text-neutral-300">
          <input type="checkbox" checked={draft.scoreboard.clock.visible} onChange={(e) => patch({ scoreboard: { clock: { visible: e.target.checked } } }, { air: true })} />
          cronômetro
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TeamEditor side="home" />
        <TeamEditor side="away" />
      </div>
      <div className="space-y-2 rounded-md bg-neutral-950 p-3">
        <div className="flex items-center justify-between">
          <LiveClock />
          <div className="flex gap-1">
            {clock.running ? (
              <button className={btn} onClick={() => sceneRequest({ action: "clock", op: "pause" })}>⏸ Pausar</button>
            ) : (
              <button className={btnOn} onClick={() => sceneRequest({ action: "clock", op: "start" })}>▶ Iniciar</button>
            )}
            <button className={btn} onClick={() => confirm("Zerar o cronômetro?") && sceneRequest({ action: "clock", op: "reset" })}>Zerar</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {PERIODS.map((p) => (
            <button key={p} onClick={() => patch({ scoreboard: { clock: { period: p } } }, { air: true })} className={`rounded px-2 py-1 text-xs ${clock.period === p ? "bg-amber-500 text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}>
              {p}
            </button>
          ))}
          <span className="mx-1 text-neutral-600">|</span>
          <input className={`${input} w-20 py-1 text-xs`} value={setValue} onChange={(e) => setSetValue(e.target.value)} placeholder="mm:ss" />
          <button className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700" onClick={setClock}>Ajustar</button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ ticker & sponsor

export function TickerSponsorPanel() {
  const { slug, scenes, patch, assets, addAsset } = useDirector();
  const { draft } = scenes;
  const [text, setText] = useState(draft.ticker.text);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-neutral-400">Letreiro (texto correndo no rodapé)</p>
        <textarea className={`${input} h-16 w-full resize-none`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex: Mande sua pergunta no chat! • Siga @debatebacana" />
        <div className="flex gap-2">
          <button className={btnOn} disabled={!text.trim()} onClick={() => patch({ ticker: { text, visible: true } })}>Mostrar letreiro</button>
          <button className={btn} disabled={!draft.ticker.visible} onClick={() => patch({ ticker: { visible: false } })}>Ocultar</button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-neutral-400">Patrocinador (canto superior direito)</p>
        <div className="flex items-center gap-3">
          <ImagePicker slug={slug} assets={assets} value={draft.sponsor.imageUrl} onChange={(url) => patch({ sponsor: { imageUrl: url } })} onUploaded={addAsset} />
          <Toggle on={draft.sponsor.visible} onClick={() => patch({ sponsor: { visible: !draft.sponsor.visible } })} />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- sound pads

export function SoundPanel() {
  const { slug, assets, addAsset, removeAsset } = useDirector();
  const sendCue = useMediaCues();
  const [volume, setVolume] = useState(0.8);
  // Oldest first, so keyboard shortcuts stay put as new pads are added.
  const pads = assets.filter((a) => a.kind === "audio" || a.kind === "video").reverse();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") sendCue({ type: "stop" });
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && pads[n - 1]) {
        const pad = pads[n - 1];
        sendCue({ type: "play", id: crypto.randomUUID(), url: pad.url, kind: pad.kind === "video" ? "video" : "audio", volume });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pads, sendCue, volume]);

  return (
    <div className="space-y-3">
      {pads.length === 0 ? (
        <p className="text-sm text-neutral-500">Envie áudios (MP3/WAV) e vinhetas em vídeo (MP4/WEBM) para criar os botões.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {pads.map((pad, i) => (
            <div key={pad.id} className="group relative">
              <button
                onClick={() => sendCue({ type: "play", id: crypto.randomUUID(), url: pad.url, kind: pad.kind === "video" ? "video" : "audio", volume })}
                className={`flex h-16 w-full flex-col items-start justify-between rounded-md p-2 text-left text-xs font-semibold active:scale-95 ${pad.kind === "video" ? "bg-indigo-800 hover:bg-indigo-700" : "bg-neutral-700 hover:bg-neutral-600"}`}
              >
                <span className="text-[10px] text-white/60">{i < 9 ? `tecla ${i + 1}` : ""} {pad.kind === "video" ? "· vinheta" : ""}</span>
                <span className="line-clamp-2">{pad.name}</span>
              </button>
              <button
                onClick={() => confirm(`Apagar "${pad.name}"?`) && removeAsset(pad.id)}
                className="absolute top-1 right-1 hidden rounded bg-black/60 px-1 text-[10px] text-red-300 group-hover:block"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-bold hover:bg-red-600" onClick={() => sendCue({ type: "stop" })} title="Tecla Esc">
          ■ PARAR
        </button>
        <label className="flex flex-1 items-center gap-2 text-xs text-neutral-400">
          Volume
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="flex-1" />
        </label>
        <UploadButton slug={slug} accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,video/mp4,video/webm" label="Áudio/vinheta" onUploaded={addAsset} />
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- identity

export function IdentityPanel() {
  const { slug, branding, setBranding, assets, addAsset } = useDirector();
  const [form, setForm] = useState(branding);
  const [saved, setSaved] = useState(false);

  async function save() {
    const res = await fetch(`/api/programs/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setBranding((await res.json()).program);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="space-y-3">
      <input className={`${input} w-full`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="flex gap-4 text-xs text-neutral-400">
        <label className="flex items-center gap-2">
          Cor principal
          <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="h-8 w-10 cursor-pointer bg-transparent" />
        </label>
        <label className="flex items-center gap-2">
          Cor do texto
          <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="h-8 w-10 cursor-pointer bg-transparent" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs text-neutral-400">Logo (topo da tela)</p>
          <ImagePicker slug={slug} assets={assets} value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} onUploaded={addAsset} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-neutral-400">Fundo (1280×720 ou maior)</p>
          <ImagePicker slug={slug} assets={assets} value={form.backgroundUrl} onChange={(url) => setForm({ ...form, backgroundUrl: url })} onUploaded={addAsset} />
        </div>
      </div>
      <button className={btnOn} onClick={save}>
        {saved ? "Salvo ✓" : "Salvar identidade"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------- invite

export function InvitePanel() {
  const { slug } = useDirector();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    const res = await fetch(`/api/programs/${slug}/invite`, { method: "POST" });
    setLink((await res.json()).link);
    setCopied(false);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-400">Link para apresentadores e convidados entrarem nos bastidores deste programa (válido por 7 dias).</p>
      <button onClick={generate} className={btn}>Gerar link de convite</button>
      {link && (
        <div className="flex gap-2">
          <input readOnly value={link} className={`${input} min-w-0 flex-1 text-xs`} />
          <button
            className={btn}
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}
