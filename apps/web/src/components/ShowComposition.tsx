"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AudioTrack,
  VideoTrack,
  isTrackReference,
  useRoomContext,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import { MediaLayer } from "./MediaLayer";
import { MusicLayer } from "./MusicLayer";
import { BoardScreen } from "./BoardScreen";
import { TransitionLayer } from "./TransitionLayer";
import { TIER_W, TierPanel, TierScreen } from "./TierBoard";
import { CONDENSED, DISPLAY, FRAME } from "./showStyle";
import {
  clockElapsedMs,
  formatClock,
  parseShowMetadata,
  type ChatMessage,
  type Clock,
  type CompetitionTheme,
  type ProgramBranding,
  type Scene,
  type Team,
} from "@/lib/scene";

// The output is designed on a fixed 720p canvas (what Egress records) and
// scaled to fit wherever it's shown, so preview monitors match the air exactly.
export const CANVAS_W = 1280;
export const CANVAS_H = 720;


// Room metadata (branding + on-air scene) is in the join response, so read it
// as soon as signaling connects instead of waiting for media to connect.
function useRoomMetadata(): string | undefined {
  const room = useRoomContext();
  const [metadata, setMetadata] = useState(room.metadata);
  useEffect(() => {
    const update = () => setMetadata(room.metadata);
    room.on(RoomEvent.SignalConnected, update).on(RoomEvent.Connected, update).on(RoomEvent.RoomMetadataChanged, update);
    return () => {
      room.off(RoomEvent.SignalConnected, update).off(RoomEvent.Connected, update).off(RoomEvent.RoomMetadataChanged, update);
    };
  }, [room]);
  return metadata;
}

function ScaledCanvas({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(Math.min(width / CANVAS_W, height / CANVAS_H));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={outer} className="relative h-full w-full overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 overflow-hidden"
        style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

function Tile({
  trackRef,
  branding,
  framed = true,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  branding: ProgramBranding;
  framed?: boolean;
}) {
  const isScreen = trackRef.source === Track.Source.ScreenShare;
  const name = trackRef.participant.name || trackRef.participant.identity;
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-neutral-900 ${framed ? "rounded-2xl" : ""}`}
      style={framed ? { border: `5px solid ${FRAME}`, boxShadow: "0 8px 24px rgba(0,0,0,.45)" } : undefined}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={`h-full w-full ${isScreen ? "bg-black object-contain" : "object-cover"}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-800">
          <span
            className="flex h-28 w-28 items-center justify-center rounded-full text-6xl"
            style={{ ...DISPLAY, background: branding.primaryColor, color: branding.accentColor }}
          >
            {name.trim().charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      {!isScreen && (
        <span
          className="absolute bottom-2 left-2 rounded px-3 py-0.5 text-2xl uppercase"
          style={{ ...CONDENSED, fontWeight: 700, background: FRAME, color: "#fff" }}
        >
          {name}
        </span>
      )}
    </div>
  );
}

// useTracks can return both a placeholder and the real track for the same
// participant/source while publications settle; keep the real one.
export function dedupeTracks(tracks: TrackReferenceOrPlaceholder[]): TrackReferenceOrPlaceholder[] {
  const byKey = new Map<string, TrackReferenceOrPlaceholder>();
  for (const t of tracks) {
    const key = `${t.participant.identity}-${t.source}`;
    const seen = byKey.get(key);
    if (!seen || (!isTrackReference(seen) && isTrackReference(t))) byKey.set(key, t);
  }
  return [...byKey.values()];
}

function pickFeatured(stage: TrackReferenceOrPlaceholder[], scene: Scene) {
  if (scene.featured) {
    const own = stage.filter((t) => t.participant.identity === scene.featured);
    const pick = own.find((t) => t.source === Track.Source.ScreenShare) ?? own[0];
    if (pick) return pick;
  }
  return stage.find((t) => t.source === Track.Source.ScreenShare) ?? stage[0];
}

type Box = { top: number; left: number; right: number; bottom: number };

function Stage({ stage, scene, branding, box }: {
  stage: TrackReferenceOrPlaceholder[];
  scene: Scene;
  branding: ProgramBranding;
  box: Box;
}) {
  if (stage.length === 0) return null;
  const featured = pickFeatured(stage, scene);
  const others = stage.filter((t) => t !== featured);
  const key = (t: TrackReferenceOrPlaceholder) => `${t.participant.identity}-${t.source}`;

  if (scene.layout === "pip") {
    return (
      <>
        <div className="absolute inset-0">
          <Tile trackRef={featured} branding={branding} framed={false} />
        </div>
        <div className="absolute flex gap-4" style={{ right: 28, bottom: box.bottom }}>
          {others.slice(0, 3).map((t) => (
            <div key={key(t)} style={{ width: 288, height: 162 }}>
              <Tile trackRef={t} branding={branding} />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (scene.layout === "solo" || (scene.layout === "spotlight" && others.length === 0)) {
    return (
      <div className="absolute" style={box}>
        <Tile trackRef={featured} branding={branding} />
      </div>
    );
  }

  if (scene.layout === "spotlight") {
    return (
      <div className="absolute flex gap-4" style={box}>
        <div className="min-w-0 flex-[2.6]">
          <Tile trackRef={featured} branding={branding} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {others.slice(0, 3).map((t) => (
            <div key={key(t)} className="min-h-0 flex-1">
              <Tile trackRef={t} branding={branding} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Grid: a single row up to 4 (like the reference), two rows beyond that.
  const cols = stage.length <= 4 ? stage.length : Math.ceil(stage.length / 2);
  return (
    <div
      className="absolute grid gap-4"
      style={{ ...box, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}
    >
      {stage.map((t) => (
        <Tile key={key(t)} trackRef={t} branding={branding} />
      ))}
    </div>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function ClockText({ clock }: { clock: Clock }) {
  const now = useNow(clock.running);
  return <>{formatClock(clockElapsedMs(clock, now))}</>;
}

function Crest({ team, size }: { team: Team; size: number }) {
  return team.crestUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={team.crestUrl} alt="" className="object-contain" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full" style={{ width: size * 0.7, height: size * 0.7, background: team.color }} />
  );
}

function Watermark({ theme, className }: { theme: CompetitionTheme; className: string }) {
  const src = theme.elementUrl ?? theme.logoUrl;
  if (!src || theme.elementOpacity <= 0) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`pointer-events-none absolute object-contain ${className}`} style={{ opacity: theme.elementOpacity }} />
  );
}

function CompetitionTab({ theme, className = "" }: { theme: CompetitionTheme; className?: string }) {
  if (!theme.name && !theme.logoUrl) return null;
  return (
    <div
      className={`flex h-8 items-center gap-2 rounded-t-md px-3 text-lg whitespace-nowrap uppercase ${className}`}
      style={{ ...CONDENSED, fontWeight: 700, background: theme.dark, color: theme.accent }}
    >
      {theme.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={theme.logoUrl} alt="" className="h-6 w-auto object-contain" />
      )}
      {theme.name}
    </div>
  );
}

function ScoreboardBug({ scene, branding }: { scene: Scene; branding: ProgramBranding }) {
  const { home, away, clock, theme } = scene.scoreboard;
  const team = (t: Team) => (
    <div className="relative z-10 flex items-center gap-2 px-3">
      <Crest team={t} size={40} />
      <span className="text-3xl uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>{t.name.slice(0, 3)}</span>
    </div>
  );
  return (
    <div className="absolute top-6 left-6 flex flex-col items-start">
      <CompetitionTab theme={theme} className="ml-2" />
      <div className="relative flex h-14 items-stretch overflow-hidden rounded-lg shadow-2xl" style={{ background: theme.light, color: theme.dark, border: `3px solid ${theme.dark}` }}>
        <Watermark theme={theme} className="top-1/2 left-1/2 h-[180%] -translate-x-1/2 -translate-y-1/2 -rotate-12" />
        {team(home)}
        <div className="relative z-10 flex items-center gap-2 px-4 text-4xl" style={{ ...DISPLAY, background: theme.dark, color: "#fff" }}>
          <span>{home.score}</span>
          <span className="text-xl" style={{ color: theme.accent }}>x</span>
          <span>{away.score}</span>
        </div>
        {team(away)}
        {clock.visible && (
          <div
            className="relative z-10 flex flex-col items-center justify-center px-3 leading-none"
            style={{ background: theme.clock ?? branding.primaryColor, color: theme.clock ? "#fff" : branding.accentColor }}
          >
            <span className="text-3xl tabular-nums" style={DISPLAY}><ClockText clock={clock} /></span>
            <span className="text-sm uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>{clock.period}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const BAR_H = 92;

function ScoreboardBar({ scene, bottom }: { scene: Scene; bottom: number }) {
  const { home, away, clock, theme } = scene.scoreboard;
  const name = (t: Team, side: "home" | "away") => (
    <div
      className={`relative flex flex-1 items-center overflow-hidden px-8 text-5xl uppercase ${side === "away" ? "justify-end" : ""}`}
      style={{ ...DISPLAY, background: theme.light, color: theme.dark }}
    >
      <Watermark
        theme={theme}
        className={`top-1/2 h-[190%] -translate-y-1/2 ${side === "home" ? "right-4 -rotate-12" : "left-4 rotate-12"}`}
      />
      <span className="relative z-10">{t.name}</span>
    </div>
  );
  const crest = (t: Team, side: "home" | "away") => (
    <div
      className={`z-10 flex items-center justify-center rounded-full bg-white shadow-xl ${side === "home" ? "-mr-6" : "-ml-6"}`}
      style={{ width: BAR_H + 12, height: BAR_H + 12, border: `4px solid ${theme.dark}` }}
    >
      <Crest team={t} size={BAR_H - 12} />
    </div>
  );
  return (
    <div className="absolute right-6 left-6 flex items-center" style={{ bottom, height: BAR_H }}>
      {crest(home, "home")}
      <div className="relative flex h-[70px] flex-1 items-stretch rounded-md shadow-2xl" style={{ border: `4px solid ${theme.dark}` }}>
        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
          <CompetitionTab theme={theme} />
        </div>
        <div className="flex flex-1 items-stretch overflow-hidden rounded-[3px]">
          {name(home, "home")}
          <div className="flex flex-col items-center justify-center px-6" style={{ background: theme.dark, color: "#fff" }}>
            <span className="text-5xl leading-none" style={DISPLAY}>
              {home.score} <span className="text-2xl" style={{ color: theme.accent }}>vs</span> {away.score}
            </span>
            {clock.visible && (
              <span className="text-lg tabular-nums uppercase" style={{ ...CONDENSED, fontWeight: 700, color: "#fff" }}>
                <ClockText clock={clock} /> · {clock.period}
              </span>
            )}
          </div>
          {name(away, "away")}
        </div>
      </div>
      {crest(away, "away")}
    </div>
  );
}

const SIDE_W = 340;

// An embedded page (e.g. a live pitch widget). It's rendered at 1/zoom size and
// scaled, so a widget designed for a big page can be shrunk to fit the slot.
function WebOverlay({ scene, box }: { scene: Scene; box: Box }) {
  const { url, position, zoom } = scene.web;
  const rect =
    position === "full"
      ? { top: 0, left: 0, width: CANVAS_W, height: CANVAS_H }
      : position === "center"
        ? { top: 110, left: 190, width: 900, height: 500 }
        : {
            top: box.top,
            left: position === "left" ? 24 : CANVAS_W - 24 - SIDE_W,
            width: SIDE_W,
            height: CANVAS_H - box.top - box.bottom,
          };
  const framed = position !== "full";
  return (
    <div
      className={`absolute overflow-hidden bg-white ${framed ? "rounded-2xl" : ""}`}
      style={{ ...rect, ...(framed && { border: `5px solid ${FRAME}`, boxShadow: "0 8px 24px rgba(0,0,0,.45)" }) }}
    >
      <iframe
        src={url}
        title="overlay"
        sandbox="allow-scripts allow-same-origin allow-popups"
        allow="autoplay"
        className="origin-top-left border-0"
        style={{ width: rect.width / zoom, height: rect.height / zoom, transform: `scale(${zoom})` }}
      />
    </div>
  );
}

const GC_H = 84;

function GcBar({ scene, branding, bottom }: { scene: Scene; branding: ProgramBranding; bottom: number }) {
  const { gc } = scene;
  return (
    <div className="absolute right-6 left-6 flex items-stretch shadow-2xl" style={{ bottom, height: GC_H }}>
      <div className="flex items-center justify-center rounded-l-md px-3" style={{ background: FRAME, minWidth: GC_H }}>
        {gc.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gc.imageUrl} alt="" className="h-[72px] w-auto object-contain" />
        ) : (
          <span className="h-10 w-3 rounded" style={{ background: branding.primaryColor }} />
        )}
      </div>
      <div className="relative flex flex-1 flex-col justify-center rounded-r-md px-8" style={{ background: "#f4f1ea", border: `4px solid ${FRAME}`, borderLeft: "none" }}>
        {gc.subtitle.trim() && (
          <span
            className="absolute -top-5 left-6 rounded px-3 py-0.5 text-xl uppercase"
            style={{ ...CONDENSED, fontWeight: 700, background: branding.primaryColor, color: branding.accentColor }}
          >
            {gc.subtitle}
          </span>
        )}
        <span className="truncate text-[44px] leading-none uppercase" style={{ ...DISPLAY, color: FRAME }}>
          {gc.title}
        </span>
      </div>
    </div>
  );
}

const TICKER_H = 44;

function Ticker({ scene, branding }: { scene: Scene; branding: ProgramBranding }) {
  return (
    <div
      className="absolute right-0 bottom-0 left-0 flex items-center overflow-hidden"
      style={{ height: TICKER_H, background: branding.primaryColor, color: branding.accentColor }}
    >
      <div className="ticker-scroll text-2xl whitespace-nowrap uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>
        {scene.ticker.text}
      </div>
    </div>
  );
}

function Header({ scene, branding, bugOn }: { scene: Scene; branding: ProgramBranding; bugOn: boolean }) {
  const sponsorOn = scene.sponsor.visible && scene.sponsor.imageUrl;
  // Center the title in the space the scoreboard bug and sponsor leave free.
  const left = bugOn ? 470 : sponsorOn ? 200 : 24;
  const right = sponsorOn ? 200 : 24;
  return (
    <>
      {scene.showLogo && (
        <div className="absolute top-3 flex h-[108px] items-center justify-center" style={{ left, right }}>
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="max-h-full max-w-full object-contain drop-shadow-xl" />
          ) : (
            <span
              className={`${bugOn || sponsorOn ? "text-6xl" : "text-7xl"} truncate whitespace-nowrap uppercase`}
              style={{ ...DISPLAY, color: "#fff", WebkitTextStroke: `3px ${FRAME}`, textShadow: `5px 5px 0 ${FRAME}` }}
            >
              {branding.name}
            </span>
          )}
        </div>
      )}
      {sponsorOn && (
        <div className="absolute top-4 right-6 rounded-md bg-white px-3 py-2 shadow-xl" style={{ border: `3px solid ${FRAME}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene.sponsor.imageUrl!} alt="" className="h-12 max-w-[150px] object-contain" />
        </div>
      )}
    </>
  );
}

const CHAT_W = 330;

// Latest YouTube chat messages beside the cameras ("Todos + chat").
function ChatPanel({ messages, branding, top, bottom }: { messages: ChatMessage[]; branding: ProgramBranding; top: number; bottom: number }) {
  return (
    <div
      className="chat-panel absolute flex flex-col overflow-hidden rounded-2xl shadow-2xl"
      style={{ right: 24, top, bottom, width: CHAT_W, background: "#f4f1ea", border: `5px solid ${FRAME}` }}
    >
      <span className="px-4 py-2 text-xl uppercase" style={{ ...CONDENSED, fontWeight: 700, background: branding.primaryColor, color: branding.accentColor }}>
        Chat ao vivo
      </span>
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden p-3">
        {messages.length === 0 && (
          <span className="text-center text-lg text-neutral-500" style={CONDENSED}>
            Mande sua mensagem no chat!
          </span>
        )}
        {messages.slice(-7).map((m) => (
          <div key={m.id} className="chat-in flex items-start gap-2">
            {m.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.avatarUrl} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
            ) : (
              <span className="mt-0.5 h-8 w-8 shrink-0 rounded-full" style={{ background: branding.primaryColor }} />
            )}
            <div className="min-w-0 leading-tight">
              <span className="text-[15px] uppercase" style={{ ...CONDENSED, fontWeight: 700, color: FRAME }}>
                {m.author}
              </span>
              <p className="line-clamp-3 text-[17px] text-neutral-800" style={{ ...CONDENSED, fontWeight: 500 }}>
                {m.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// A chat message picked by the director, in the lower third slot.
function HighlightBar({ scene, branding, bottom }: { scene: Scene; branding: ProgramBranding; bottom: number }) {
  const h = scene.highlight;
  return (
    <div className="chat-in absolute right-6 left-6 flex items-stretch shadow-2xl" style={{ bottom, height: GC_H }}>
      <div className="flex items-center justify-center rounded-l-md px-3" style={{ background: FRAME, minWidth: GC_H }}>
        {h.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={h.avatarUrl} alt="" className="h-[60px] w-[60px] rounded-full" />
        ) : (
          <span className="text-4xl" style={{ ...DISPLAY, color: "#fff" }}>💬</span>
        )}
      </div>
      <div className="relative flex flex-1 flex-col justify-center rounded-r-md px-8" style={{ background: "#f4f1ea", border: `4px solid ${FRAME}`, borderLeft: "none" }}>
        <span
          className="absolute -top-5 left-6 rounded px-3 py-0.5 text-xl uppercase"
          style={{ ...CONDENSED, fontWeight: 700, background: branding.primaryColor, color: branding.accentColor }}
        >
          Pergunta do chat · {h.author}
        </span>
        <span className="line-clamp-2 text-[28px] leading-tight" style={{ ...CONDENSED, fontWeight: 700, color: FRAME }}>
          {h.text}
        </span>
      </div>
    </div>
  );
}

function Countdown({ to }: { to: number }) {
  const now = useNow(true);
  return <>{formatClock(Math.max(0, to - now))}</>;
}

// The team's own pre-live / break / closing art: an image, or a looping video
// (heard only where the composition plays media: Egress and the air monitor).
function ScreenMedia({ scene, withSound }: { scene: Scene; withSound: boolean }) {
  const s = scene.screen;
  const isVideo = /\.(mp4|webm)$/i.test(s.mediaUrl ?? "");
  return (
    <div className="absolute inset-0 z-40 bg-black">
      {isVideo ? (
        <video key={s.mediaUrl} src={s.mediaUrl!} autoPlay loop playsInline muted={!withSound} className="h-full w-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.mediaUrl!} alt="" className="h-full w-full object-cover" />
      )}
      {s.kind === "espera" && s.countdownTo && (
        <span
          className="absolute right-8 bottom-8 rounded-xl px-5 py-2 text-5xl tabular-nums shadow-2xl"
          style={{ ...DISPLAY, background: FRAME, color: "#fff" }}
        >
          <Countdown to={s.countdownTo} />
        </span>
      )}
    </div>
  );
}

// Fallback rundown screens (pré-live, intervalo, encerramento) in the show's own look.
function InstitutionalScreen({ scene, branding }: { scene: Scene; branding: ProgramBranding }) {
  const s = scene.screen;
  return (
    <div
      className="absolute inset-0 z-40"
      style={{
        background: branding.backgroundUrl
          ? `center / cover no-repeat url(${JSON.stringify(branding.backgroundUrl)})`
          : `radial-gradient(circle at 50% 0%, ${branding.primaryColor}, #0b0b0b 75%)`,
      }}
    >
      <div className="absolute top-8 left-1/2 flex h-[110px] -translate-x-1/2 items-center">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="max-h-full w-auto object-contain drop-shadow-xl" />
        ) : (
          <span
            className="text-6xl whitespace-nowrap uppercase"
            style={{ ...DISPLAY, color: "#fff", WebkitTextStroke: `3px ${FRAME}`, textShadow: `5px 5px 0 ${FRAME}` }}
          >
            {branding.name}
          </span>
        )}
      </div>
      <div className="absolute flex flex-col items-start" style={{ left: 80, top: 230, width: 700 }}>
        <span
          className="rounded px-3 py-1 text-2xl uppercase"
          style={{ ...CONDENSED, fontWeight: 700, background: branding.primaryColor, color: branding.accentColor }}
        >
          {s.label}
        </span>
        <span
          className="mt-4 text-[92px] leading-[0.95] uppercase"
          style={{ ...DISPLAY, color: "#fff", WebkitTextStroke: `3px ${FRAME}`, textShadow: `6px 6px 0 ${FRAME}` }}
        >
          {s.title}
        </span>
        <span className="mt-5 text-3xl text-white/85" style={{ ...CONDENSED, fontWeight: 500 }}>
          {s.subtitle}
        </span>
      </div>
      <div
        className="absolute flex flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ right: 80, top: 250, width: 360, background: "#f4f1ea", border: `5px solid ${FRAME}` }}
      >
        <span
          className="px-5 py-2 text-xl uppercase"
          style={{ ...CONDENSED, fontWeight: 700, background: branding.primaryColor, color: branding.accentColor }}
        >
          {s.panelLabel}
        </span>
        <span className="px-5 pt-4 text-[64px] leading-none tabular-nums uppercase" style={{ ...DISPLAY, color: FRAME }}>
          {s.kind === "espera" && s.countdownTo ? <Countdown to={s.countdownTo} /> : s.panelTitle}
        </span>
        <span className="px-5 pt-2 pb-5 text-xl uppercase" style={{ ...CONDENSED, fontWeight: 700, color: "#444" }}>
          {s.panelText}
        </span>
      </div>
    </div>
  );
}

export function ShowComposition({
  scene: sceneOverride,
  withAudio = false,
  media = "off",
  emptyHint,
}: {
  // Renders this scene instead of the on-air one (preview monitor).
  scene?: Scene;
  // Plays on-stage participants' audio (the Egress output needs it).
  withAudio?: boolean;
  // Sound pads, stingers and background track: played, shown muted, or ignored.
  media?: "play" | "silent" | "off";
  emptyHint?: string;
}) {
  const show = parseShowMetadata(useRoomMetadata());
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const audioTracks = useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio], { onlySubscribed: true });

  if (!show) {
    return (
      <ScaledCanvas>
        <div className="h-full w-full bg-black" />
      </ScaledCanvas>
    );
  }

  const branding = show.program;
  const scene = sceneOverride ?? show.scene;
  const all = dedupeTracks(tracks);
  // "all": everyone in the room, in join order; otherwise the director's picks.
  const onStageIds =
    scene.stageMode === "all" ? [...new Set(all.map((t) => t.participant.identity))] : scene.onStage;
  const order = new Map(onStageIds.map((id, i) => [id, i]));
  const stage = all
    .filter((t) => order.has(t.participant.identity))
    .sort((a, b) => order.get(a.participant.identity)! - order.get(b.participant.identity)!);

  const tickerOn = scene.ticker.visible && scene.ticker.text.trim() !== "";
  const highlightOn = scene.highlight.visible && scene.highlight.text.trim() !== "";
  // The highlighted chat question takes the lower third slot while it's up.
  const gcOn = !highlightOn && scene.gc.visible && scene.gc.title.trim() !== "";
  const chatOn = scene.chat.visible;
  const barOn = scene.scoreboard.visible && scene.scoreboard.style === "bar";
  const bugOn = scene.scoreboard.visible && scene.scoreboard.style === "bug";
  const themeTab = Boolean(scene.scoreboard.theme.name || scene.scoreboard.theme.logoUrl);
  const webOn = scene.web.visible && scene.web.url !== "";
  const tierOn = scene.tierList.visible;
  const tierSplit = tierOn && scene.tierList.mode === "split";
  // The tier list panel takes the left side; a side web widget then goes right.
  const webSide = webOn && (scene.web.position === "left" || scene.web.position === "right") ? scene.web.position : null;
  const side = tierSplit && webSide ? "right" : webSide;

  // Bottom-up stack: ticker, scoreboard bar, GC; the stage fills what's left.
  let y = tickerOn ? TICKER_H + 12 : 18;
  const barBottom = y;
  if (barOn) y += BAR_H + (themeTab ? 36 : 14);
  const gcBottom = y;
  if (gcOn || highlightOn) y += GC_H + 22;
  const headerOn = scene.showLogo;
  const top = headerOn ? 128 : bugOn ? (themeTab ? 124 : 92) : 24;
  const box: Box = {
    top,
    left: tierSplit ? 24 + TIER_W + 16 : side === "left" ? 24 + SIDE_W + 16 : 24,
    right: (side === "right" ? 24 + SIDE_W + 16 : 24) + (chatOn ? CHAT_W + 16 : 0),
    bottom: Math.max(y, 24),
  };
  // Re-keys the stage when the arrangement changes, so a cut fades in.
  const arrangement = `${scene.layout}|${stage.map((t) => `${t.participant.identity}:${t.source}`).join(",")}|${chatOn}|${side}|${tierSplit}`;

  return (
    <ScaledCanvas>
      <div
        className="relative h-full w-full"
        style={{
          background: branding.backgroundUrl
            ? `center / cover no-repeat url(${JSON.stringify(branding.backgroundUrl)})`
            : `radial-gradient(circle at 50% 0%, ${branding.primaryColor}, #0b0b0b 75%)`,
        }}
      >
        <div key={arrangement} className="scene-fade absolute inset-0">
          <Stage stage={stage} scene={scene} branding={branding} box={box} />
        </div>
        {tierSplit && <TierPanel list={scene.tierList} top={box.top} bottom={box.bottom} />}
        {chatOn && <ChatPanel messages={show.chat ?? []} branding={branding} top={box.top} bottom={box.bottom} />}
        {webOn && <WebOverlay scene={scene} box={box} />}
        <Header scene={scene} branding={branding} bugOn={bugOn} />
        {bugOn && <ScoreboardBug scene={scene} branding={branding} />}
        {barOn && <ScoreboardBar scene={scene} bottom={barBottom} />}
        {gcOn && <GcBar scene={scene} branding={branding} bottom={gcBottom} />}
        {highlightOn && <HighlightBar scene={scene} branding={branding} bottom={gcBottom} />}
        {tickerOn && <Ticker scene={scene} branding={branding} />}
        {stage.length === 0 && emptyHint && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-3xl text-white/70" style={CONDENSED}>
            {emptyHint}
          </div>
        )}
        {tierOn && !tierSplit && <TierScreen list={scene.tierList} branding={branding} />}
        {scene.board.kind !== "none" && <BoardScreen board={scene.board} branding={branding} />}
        {scene.screen.kind !== "none" &&
          (scene.screen.mediaUrl ? (
            <ScreenMedia scene={scene} withSound={media === "play"} />
          ) : (
            <InstitutionalScreen scene={scene} branding={branding} />
          ))}
        {media !== "off" && <MediaLayer silent={media === "silent"} />}
        {!sceneOverride && media !== "off" && (
          <TransitionLayer at={scene.transitionAt} config={show.transition} branding={branding} withSound={media === "play"} />
        )}
      </div>
      {media === "play" && <MusicLayer music={scene.music} />}
      {withAudio &&
        audioTracks
          .filter((t) => order.has(t.participant.identity))
          .map((t) => <AudioTrack key={t.publication.trackSid} trackRef={t} />)}
    </ScaledCanvas>
  );
}
