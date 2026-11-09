"use client";

import { useEffect, useState, type ReactNode } from "react";
import { VideoTrack, isTrackReference, useParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { dedupeTracks } from "@/components/ShowComposition";
import {
  LAYOUTS,
  THEME_PRESETS,
  WEB_POSITIONS,
  clockElapsedMs,
  extractEmbedUrl,
  formatClock,
  type CompetitionTheme,
  type Team,
} from "@/lib/scene";
import { ImagePicker } from "./assets";
import { useDirector } from "./context";
import { AggregateInput, ExtraSelect, PenaltyControls, RedCardButton } from "./matchExtras";

const input = "rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";
const btn = "rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40";
const btnOn = "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500";

export function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="studio-bar space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg leading-none uppercase" style={{ fontFamily: "var(--font-display), Impact, sans-serif", letterSpacing: "0.04em" }}>
          <span className="h-4 w-1.5 rounded-full bg-[var(--db-lime)]" />
          {title}
        </h2>
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

  const everyone = participants.map((p) => p.identity);
  const isOn = (scene: typeof draft, id: string) => scene.stageMode === "all" || scene.onStage.includes(id);

  // In "everyone" mode, picking someone out switches the scene to a manual
  // list starting from everyone, so the click does what it says.
  function toggleStage(identity: string) {
    const base = draft.stageMode === "all" ? everyone : draft.onStage;
    const onStage = base.includes(identity) ? base.filter((id) => id !== identity) : [...base, identity];
    return patch({
      stageMode: "manual",
      onStage,
      featured: onStage.includes(draft.featured ?? "") ? draft.featured : null,
    });
  }

  if (participants.length === 0) {
    return <p className="text-sm text-neutral-500">Ninguém na sala. Envie o link de convite aos apresentadores.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {draft.stageMode === "all" ? (
          <span className="rounded bg-emerald-900/50 px-2 py-1 text-emerald-300">
            Automático: todos que entrarem aparecem na tela
          </span>
        ) : (
          <>
            <span className="rounded bg-neutral-800 px-2 py-1 text-neutral-300">Manual: só quem você pôs em cena</span>
            <button className="rounded bg-neutral-700 px-2 py-1 hover:bg-neutral-600" onClick={() => patch({ stageMode: "all" })}>
              Voltar para todos
            </button>
          </>
        )}
      </div>
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {participants.map((p) => {
        const cam = cams.find((t) => t.participant.identity === p.identity);
        const mic = p.getTrackPublication(Track.Source.Microphone);
        const inDraft = isOn(draft, p.identity);
        const onAir = isOn(live, p.identity);
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
    </div>
  );
}

// ---------------------------------------------------------------------- layout

export function LayoutPanel() {
  const { scenes, patch } = useDirector();
  const { draft } = scenes;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 xl:grid-cols-4">
        {LAYOUTS.map((l) => (
          <button key={l.mode} title={l.hint} onClick={() => patch({ layout: l.mode })} className={draft.layout === l.mode ? btnOn : btn}>
            {l.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-neutral-500">{LAYOUTS.find((l) => l.mode === draft.layout)?.hint}</p>
      {(draft.layout === "spotlight" || draft.layout === "vertical") && (
        <div className="flex gap-2">
          {(
            [
              ["right", "Apresentadores à esquerda, janela à direita"],
              ["left", "Janela à esquerda, apresentadores à direita"],
            ] as const
          ).map(([s, label]) => (
            <button key={s} onClick={() => patch({ featuredSide: s })} className={`flex-1 rounded-md px-2 py-1.5 text-xs ${draft.featuredSide === s ? "bg-[#DFFF00] font-semibold text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}>
              {label}
            </button>
          ))}
        </div>
      )}
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
            <button key={p} onClick={() => patch({ scoreboard: { clock: { period: p, extra: 0 } } }, { air: true })} className={`rounded px-2 py-1 text-xs ${clock.period === p ? "bg-amber-500 text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}>
              {p}
            </button>
          ))}
          <span className="mx-1 text-neutral-600">|</span>
          <input className={`${input} w-20 py-1 text-xs`} value={setValue} onChange={(e) => setSetValue(e.target.value)} placeholder="mm:ss" />
          <button className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700" onClick={setClock}>Ajustar</button>
        </div>
      </div>
      <div className="space-y-2 rounded-md bg-neutral-950 p-3">
        <p className="text-xs font-semibold text-neutral-400">IGUAL NA TV (entra no ar na hora)</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-300">
          <span className="flex items-center gap-1">Cartões vermelhos: casa <RedCardButton side="home" /> visitante <RedCardButton side="away" /></span>
          <ExtraSelect />
        </div>
        <AggregateInput />
        <PenaltyControls />
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

// -------------------------------------------------------------------- identity

export function IdentityPanel() {
  const { slug, branding, setBranding, assets, addAsset } = useDirector();
  const [name, setName] = useState(branding.name);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/brand")
      .then((r) => r.json())
      .then((d) => setBrandLogo(d.logoUrl ?? null));
  }, []);

  async function patchProgram(body: Record<string, unknown>) {
    const res = await fetch(`/api/programs/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setBranding((await res.json()).program);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function saveBrandLogo(logoUrl: string | null) {
    setBrandLogo(logoUrl);
    await fetch("/api/settings/brand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl }),
    });
    await patchProgram({});
  }

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs text-neutral-400">Nome do programa (aparece no cabeçalho e no rodapé)</span>
        <div className="flex gap-2">
          <input className={`${input} flex-1`} value={name} onChange={(e) => setName(e.target.value)} />
          <button className={btn} disabled={!name.trim() || name === branding.name} onClick={() => patchProgram({ name })}>
            {saved ? "Salvo ✓" : "Salvar"}
          </button>
        </div>
      </label>
      <div className="flex gap-4 text-xs text-neutral-400">
        <label className="flex items-center gap-2">
          Cor principal
          <input
            type="color"
            value={branding.primaryColor}
            onChange={(e) => patchProgram({ primaryColor: e.target.value })}
            className="h-8 w-10 cursor-pointer bg-transparent"
          />
        </label>
        <label className="flex items-center gap-2">
          Cor do texto sobre ela
          <input
            type="color"
            value={branding.accentColor}
            onChange={(e) => patchProgram({ accentColor: e.target.value })}
            className="h-8 w-10 cursor-pointer bg-transparent"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs text-neutral-400">Logo Debate Bacana (vale para todos os programas)</p>
          <ImagePicker slug={slug} assets={assets} value={brandLogo} onChange={saveBrandLogo} onUploaded={addAsset} />
          <p className="text-[11px] text-neutral-500">De preferência PNG com fundo transparente.</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-neutral-400">Fundo (1280×720 ou maior)</p>
          <ImagePicker slug={slug} assets={assets} value={branding.backgroundUrl} onChange={(url) => patchProgram({ backgroundUrl: url })} onUploaded={addAsset} />
        </div>
      </div>
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

// ------------------------------------------------------------------------- OBS

type ObsInfo = { type: "whip" | "rtmp"; server: string; streamKey: string; status: string; error: string | null };

function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs text-neutral-400">{label}</p>
      <div className="flex gap-2">
        <input readOnly type={secret ? "password" : "text"} value={value} className={`${input} min-w-0 flex-1 font-mono text-xs`} />
        <button
          className={btn}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "✓" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export function ObsPanel() {
  const { slug } = useDirector();
  const [obs, setObs] = useState<ObsInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await fetch(`/api/programs/${slug}/obs`);
      const data = await res.json().catch(() => ({}));
      if (!alive) return;
      if (res.ok) setObs(data.obs);
      else setError(data.error ?? "Falha ao consultar o OBS");
    }
    const first = setTimeout(load, 0);
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [slug]);

  async function create(type: "whip" | "rtmp") {
    if (obs && !confirm("Gerar uma nova chave? A anterior deixa de funcionar.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/programs/${slug}/obs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setObs(data.obs);
    else setError(data.error ?? "Falha");
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">
        Mande a saída do OBS para cá: ela aparece em Participantes como <b>OBS</b> e entra na cena como qualquer convidado.
      </p>
      {obs ? (
        <>
          <p className="text-sm">
            Status: <span className={obs.status === "recebendo" ? "text-emerald-400" : "text-neutral-300"}>{obs.status}</span>
            {obs.error && <span className="text-red-400"> · {obs.error}</span>}
          </p>
          <CopyField label={obs.type === "whip" ? "Servidor (WHIP)" : "Servidor (RTMP)"} value={obs.server} />
          <CopyField label={obs.type === "whip" ? "Bearer Token" : "Chave de transmissão"} value={obs.streamKey} secret />
          <p className="text-xs text-neutral-500">
            {obs.type === "whip"
              ? "No OBS: Configurações → Transmissão → Serviço: WHIP. Cole o servidor e o Bearer Token. Use saída em 720p, 30fps, até 4000 kbps."
              : "No OBS: Configurações → Transmissão → Serviço: Personalizado. RTMP consome mais CPU do servidor; prefira WHIP (OBS 30 ou mais novo)."}
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-500">Nenhuma entrada de OBS criada para este programa.</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className={btnOn} disabled={busy} onClick={() => create("whip")}>
          {obs ? "Nova chave WHIP" : "Criar entrada WHIP (recomendado)"}
        </button>
        <button className={btn} disabled={busy} onClick={() => create("rtmp")}>
          {obs ? "Nova chave RTMP" : "Criar entrada RTMP"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ competition theme

type SavedTheme = { id: string; label: string; theme: CompetitionTheme };

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-neutral-400">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-8 cursor-pointer bg-transparent" />
      {label}
    </label>
  );
}

export function ThemePanel() {
  const { slug, scenes, patch, assets, addAsset } = useDirector();
  const theme = scenes.draft.scoreboard.theme;
  const [saved, setSaved] = useState<SavedTheme[]>([]);
  const [name, setName] = useState(theme.name);
  const [opacity, setOpacity] = useState(theme.elementOpacity);
  const setTheme = (t: Partial<CompetitionTheme>) => patch({ scoreboard: { theme: t } });

  useEffect(() => {
    fetch("/api/themes")
      .then((r) => r.json())
      .then((d) => setSaved(d.themes ?? []));
  }, []);

  function apply(t: CompetitionTheme) {
    setName(t.name);
    setOpacity(t.elementOpacity);
    return patch({ scoreboard: { theme: t } });
  }

  async function save() {
    const label = prompt("Nome do tema (ex: Paulistão 2026):", theme.name || "");
    if (!label?.trim()) return;
    const res = await fetch("/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, theme }),
    });
    if (res.ok) {
      const data = await res.json();
      setSaved((list) => [...list, data.theme]);
    }
  }

  async function remove(id: string) {
    if (!confirm("Apagar este tema salvo?")) return;
    await fetch(`/api/themes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setSaved((list) => list.filter((t) => t.id !== id));
  }

  const chip = "rounded px-2 py-1 text-xs hover:brightness-125";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {THEME_PRESETS.map((p) => (
          <button key={p.label} onClick={() => apply(p.theme)} className={chip} style={{ background: p.theme.dark, color: p.theme.accent, border: `1px solid ${p.theme.accent}55` }}>
            {p.label}
          </button>
        ))}
        {saved.map((t) => (
          <span key={t.id} className="group inline-flex items-center">
            <button onClick={() => apply(t.theme)} className={`${chip} rounded-r-none`} style={{ background: t.theme.dark, color: t.theme.accent }}>
              ★ {t.label}
            </button>
            <button onClick={() => remove(t.id)} className="rounded-r bg-neutral-800 px-1.5 py-1 text-xs text-neutral-500 hover:text-red-400">✕</button>
          </span>
        ))}
      </div>

      <input
        className={`${input} w-full uppercase`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name !== theme.name && setTheme({ name })}
        placeholder="Nome da competição no placar (ex: BRASILEIRÃO)"
      />

      <div className="flex flex-wrap gap-3">
        <ColorField label="Fundo" value={theme.dark} onChange={(v) => setTheme({ dark: v })} />
        <ColorField label="Faixas" value={theme.light} onChange={(v) => setTheme({ light: v })} />
        <ColorField label="Destaque" value={theme.accent} onChange={(v) => setTheme({ accent: v })} />
        {theme.clock ? (
          <span className="flex items-center gap-1">
            <ColorField label="Cronômetro" value={theme.clock} onChange={(v) => setTheme({ clock: v })} />
            <button onClick={() => setTheme({ clock: null })} className="text-[10px] text-neutral-500 hover:text-neutral-300" title="Usar a cor do programa">↺</button>
          </span>
        ) : (
          <button onClick={() => setTheme({ clock: theme.accent })} className="text-xs text-neutral-500 hover:text-neutral-300">
            cronômetro: cor do programa (trocar)
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs text-neutral-400">Logo da competição</p>
          <ImagePicker slug={slug} assets={assets} value={theme.logoUrl} onChange={(url) => setTheme({ logoUrl: url })} onUploaded={addAsset} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-neutral-400">Elemento no placar (taça, bola, símbolo)</p>
          <ImagePicker slug={slug} assets={assets} value={theme.elementUrl} onChange={(url) => setTheme({ elementUrl: url })} onUploaded={addAsset} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        Intensidade do elemento
        <input
          type="range"
          min={0}
          max={0.6}
          step={0.02}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          onPointerUp={() => setTheme({ elementOpacity: opacity })}
          onKeyUp={() => setTheme({ elementOpacity: opacity })}
          className="flex-1"
        />
      </label>
      <p className="text-[11px] text-neutral-500">Sem elemento enviado, o próprio logo vira a marca d&apos;água.</p>
      <button className={btn} onClick={save}>Salvar como tema</button>
    </div>
  );
}

// -------------------------------------------------------------- web overlay

export function WebPanel() {
  const { scenes, patch } = useDirector();
  const web = scenes.draft.web;
  const [url, setUrl] = useState(web.url);
  const [zoom, setZoom] = useState(web.zoom);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<string | null>(null);

  function show() {
    const embed = extractEmbedUrl(url);
    if (!embed) {
      setError("Não reconheci um link. Cole o endereço começando com https:// ou o código <iframe> do widget.");
      return;
    }
    setError(null);
    setUrl(embed);
    setCheck("Testando se o servidor da live consegue abrir a página...");
    fetch(`/api/web-check?url=${encodeURIComponent(embed)}`)
      .then((r) => r.json())
      .then((d) => setCheck(d.ok ? "✓ O servidor da live abre esta página." : `⚠ ${d.reason}. Na live (YouTube) ela pode ficar em branco, mesmo aparecendo aqui.`))
      .catch(() => setCheck(null));
    return patch({ web: { url: embed, visible: true } });
  }

  return (
    <div className="space-y-3">
      <input className={`${input} w-full`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link https://… ou código <iframe> do widget (365Scores, FotMob…)" />
      <div className="grid grid-cols-2 gap-2">
        {WEB_POSITIONS.map((p) => (
          <button key={p.position} onClick={() => patch({ web: { position: p.position } })} className={web.position === p.position ? btnOn : btn}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        Zoom {Math.round(zoom * 100)}%
        <input
          type="range"
          min={0.3}
          max={2}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          onPointerUp={() => patch({ web: { zoom } })}
          onKeyUp={() => patch({ web: { zoom } })}
          className="flex-1"
        />
      </label>
      <div className="flex gap-2">
        <button className={btnOn} disabled={!url.trim()} onClick={show}>
          Mostrar página
        </button>
        <button className={btn} disabled={!web.visible} onClick={() => patch({ web: { visible: false } })}>
          Ocultar
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {check && <p className={`text-xs ${check.startsWith("✓") ? "text-emerald-400" : check.startsWith("⚠") ? "text-amber-400" : "text-neutral-400"}`}>{check}</p>}
      {web.visible && !scenes.live.web.visible && (
        <p className="text-xs text-emerald-400">Na prévia. Clique em CORTAR para mandar pro ar.</p>
      )}
      <p className="text-[11px] text-neutral-500">
        Use o link de &quot;widget&quot; ou &quot;incorporar&quot; do site. Alguns sites bloqueiam aparecer dentro de outra página e ficam em branco. Confira na prévia antes de cortar pro ar.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------- quick score

// Always-visible scoreboard strip for football programs: goals, clock and
// on/off without leaving the current tab. Everything here hits air at once.
export function QuickScore() {
  const { scenes, patch, sceneRequest } = useDirector();
  const sb = scenes.live.scoreboard;
  const goal = (side: "home" | "away", delta: number) =>
    patch({ scoreboard: { [side]: { score: Math.max(0, sb[side].score + delta) } } }, { air: true });
  const team = (side: "home" | "away") => (
    <div className={`flex items-center gap-2 ${side === "away" ? "flex-row-reverse" : ""}`}>
      <span className="max-w-[9rem] truncate text-sm font-bold uppercase">{sb[side].name || (side === "home" ? "Casa" : "Visitante")}</span>
      <button className="rounded bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-700" onClick={() => goal(side, -1)} title="Tirar gol">
        −
      </button>
      <span className="w-8 text-center text-3xl font-black tabular-nums">{sb[side].score}</span>
      <button className="rounded bg-[#DFFF00] px-3 py-1 text-sm font-bold text-black hover:brightness-110" onClick={() => goal(side, 1)}>
        ＋ GOL
      </button>
      <RedCardButton side={side} />
    </div>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 studio-bar px-4 py-2 !border-[rgba(174,223,2,0.4)]">
      <span className="studio-label text-base">PLACAR</span>
      {team("home")}
      <div className="flex items-center gap-2">
        <LiveClock />
        {sb.clock.running ? (
          <button className={btn} onClick={() => sceneRequest({ action: "clock", op: "pause" })}>⏸</button>
        ) : (
          <button className={btnOn} onClick={() => sceneRequest({ action: "clock", op: "start" })}>▶</button>
        )}
        <span className="rounded bg-neutral-800 px-2 py-1 text-xs">{sb.clock.period}</span>
        <ExtraSelect />
      </div>
      {team("away")}
      <div className="flex items-center gap-2">
        {!sb.penalties.active && <PenaltyControls compact />}
        <Toggle
          on={sb.visible}
          onClick={() => patch({ scoreboard: { visible: !sb.visible } }, { air: true })}
          labels={["Mostrar no ar", "Tirar do ar"]}
        />
      </div>
      {sb.penalties.active && (
        <div className="w-full border-t border-neutral-800 pt-2">
          <PenaltyControls compact />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- modules

export function ModulesPanel({ scoreboardOn, onChange, football }: { scoreboardOn: boolean; onChange: (on: boolean) => void; football: boolean }) {
  return (
    <div className="space-y-2 text-sm">
      {football ? (
        <p className="text-neutral-400">No Futebol Bacana o placar e o cronômetro são parte principal e ficam sempre à vista.</p>
      ) : (
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={scoreboardOn} onChange={(e) => onChange(e.target.checked)} />
          <span>
            <b>Placar e cronômetro</b>
            <span className="block text-xs text-neutral-500">Mostra a aba Placar neste programa (para um jogo comentado no debate, por exemplo).</span>
          </span>
        </label>
      )}
    </div>
  );
}
