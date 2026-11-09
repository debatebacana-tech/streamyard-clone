"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import {
  clockElapsedMs,
  formatClock,
  parseShowMetadata,
  type Clock,
  type ProgramBranding,
  type Scene,
  type Team,
} from "@/lib/scene";

// The output is designed on a fixed 720p canvas (what Egress records) and
// scaled to fit wherever it's shown, so preview monitors match the air exactly.
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

const DISPLAY: CSSProperties = { fontFamily: "var(--font-display), Impact, sans-serif" };
const CONDENSED: CSSProperties = { fontFamily: "var(--font-condensed), 'Arial Narrow', sans-serif" };
const FRAME = "#111111";

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

function ScoreboardBug({ scene, branding }: { scene: Scene; branding: ProgramBranding }) {
  const { home, away, clock } = scene.scoreboard;
  const team = (t: Team) => (
    <div className="flex items-center gap-2 px-3">
      <Crest team={t} size={40} />
      <span className="text-3xl uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>{t.name.slice(0, 3)}</span>
    </div>
  );
  return (
    <div className="absolute top-6 left-6 flex h-14 items-stretch overflow-hidden rounded-lg shadow-2xl" style={{ background: "#fff", color: FRAME }}>
      {team(home)}
      <div className="flex items-center gap-2 px-4 text-4xl" style={{ ...DISPLAY, background: FRAME, color: "#fff" }}>
        <span>{home.score}</span>
        <span className="text-xl opacity-60">x</span>
        <span>{away.score}</span>
      </div>
      {team(away)}
      {clock.visible && (
        <div className="flex flex-col items-center justify-center px-3 leading-none" style={{ background: branding.primaryColor, color: branding.accentColor }}>
          <span className="text-3xl tabular-nums" style={DISPLAY}><ClockText clock={clock} /></span>
          <span className="text-sm uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>{clock.period}</span>
        </div>
      )}
    </div>
  );
}

const BAR_H = 92;

function ScoreboardBar({ scene, bottom }: { scene: Scene; bottom: number }) {
  const { home, away, clock } = scene.scoreboard;
  const name = (t: Team, align: "left" | "right") => (
    <div
      className={`flex flex-1 items-center px-8 text-5xl uppercase ${align === "right" ? "justify-end" : ""}`}
      style={{ ...DISPLAY, background: "#f4f1ea", color: FRAME }}
    >
      {t.name}
    </div>
  );
  return (
    <div className="absolute right-6 left-6 flex items-center" style={{ bottom, height: BAR_H }}>
      <div className="z-10 -mr-6 flex items-center justify-center rounded-full bg-white shadow-xl" style={{ width: BAR_H + 12, height: BAR_H + 12 }}>
        <Crest team={home} size={BAR_H - 8} />
      </div>
      <div className="flex h-[70px] flex-1 items-stretch overflow-hidden rounded-md shadow-2xl" style={{ border: `4px solid ${FRAME}` }}>
        {name(home, "left")}
        <div className="flex flex-col items-center justify-center px-6" style={{ background: FRAME, color: "#fff" }}>
          <span className="text-5xl leading-none" style={DISPLAY}>
            {home.score} <span className="text-2xl text-amber-300">vs</span> {away.score}
          </span>
          {clock.visible && (
            <span className="text-lg tabular-nums uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>
              <ClockText clock={clock} /> · {clock.period}
            </span>
          )}
        </div>
        {name(away, "right")}
      </div>
      <div className="z-10 -ml-6 flex items-center justify-center rounded-full bg-white shadow-xl" style={{ width: BAR_H + 12, height: BAR_H + 12 }}>
        <Crest team={away} size={BAR_H - 8} />
      </div>
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
  // Sound pads / stingers: played, shown muted, or ignored.
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
  const order = new Map(scene.onStage.map((id, i) => [id, i]));
  const stage = dedupeTracks(tracks)
    .filter((t) => order.has(t.participant.identity))
    .sort((a, b) => order.get(a.participant.identity)! - order.get(b.participant.identity)!);

  const tickerOn = scene.ticker.visible && scene.ticker.text.trim() !== "";
  const gcOn = scene.gc.visible && scene.gc.title.trim() !== "";
  const barOn = scene.scoreboard.visible && scene.scoreboard.style === "bar";
  const bugOn = scene.scoreboard.visible && scene.scoreboard.style === "bug";

  // Bottom-up stack: ticker, scoreboard bar, GC; the stage fills what's left.
  let y = tickerOn ? TICKER_H + 12 : 18;
  const barBottom = y;
  if (barOn) y += BAR_H + 14;
  const gcBottom = y;
  if (gcOn) y += GC_H + 22;
  const headerOn = scene.showLogo;
  const box: Box = { top: headerOn ? 128 : bugOn ? 92 : 24, left: 24, right: 24, bottom: Math.max(y, 24) };

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
        <Stage stage={stage} scene={scene} branding={branding} box={box} />
        <Header scene={scene} branding={branding} bugOn={bugOn} />
        {bugOn && <ScoreboardBug scene={scene} branding={branding} />}
        {barOn && <ScoreboardBar scene={scene} bottom={barBottom} />}
        {gcOn && <GcBar scene={scene} branding={branding} bottom={gcBottom} />}
        {tickerOn && <Ticker scene={scene} branding={branding} />}
        {media !== "off" && <MediaLayer silent={media === "silent"} />}
        {stage.length === 0 && emptyHint && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-3xl text-white/70" style={CONDENSED}>
            {emptyHint}
          </div>
        )}
      </div>
      {withAudio &&
        audioTracks
          .filter((t) => order.has(t.participant.identity))
          .map((t) => <AudioTrack key={t.publication.trackSid} trackRef={t} />)}
    </ScaledCanvas>
  );
}
