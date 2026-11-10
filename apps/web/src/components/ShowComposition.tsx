"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
import { AUDIO_BLOCKED, AUDIO_UNLOCK, MusicLayer } from "./MusicLayer";
import { BoardScreen } from "./BoardScreen";
import { TransitionLayer } from "./TransitionLayer";
import { TIER_W, TierPanel, TierScreen } from "./TierBoard";
import { TWEET_W, TweetCardView } from "./TweetCard";
import { ProjectedMediaView } from "./ProjectedMedia";
import { CONDENSED, DISPLAY, FRAME } from "./showStyle";
import {
  clockElapsedMs,
  formatClock,
  parseShowMetadata,
  shootoutState,
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

// Monitors let the director drag one window onto another to swap them.
const SwapContext = createContext<((from: string, to: string) => void) | null>(null);
const DRAG_TYPE = "application/x-studio-identity";

function Tile({
  trackRef,
  branding,
  framed = true,
  crop = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  branding: ProgramBranding;
  framed?: boolean;
  // Fill the frame (cutting the sides) instead of letterboxing a screen share.
  crop?: boolean;
}) {
  const isScreen = trackRef.source === Track.Source.ScreenShare;
  const name = trackRef.participant.name || trackRef.participant.identity;
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  const swap = useContext(SwapContext);
  const [over, setOver] = useState(false);
  const identity = trackRef.participant.identity;
  const drag = swap
    ? {
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.setData(DRAG_TYPE, identity);
          e.dataTransfer.effectAllowed = "move";
        },
        onDragOver: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
          e.preventDefault();
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setOver(false);
          const from = e.dataTransfer.getData(DRAG_TYPE);
          if (from && from !== identity) swap(from, identity);
        },
      }
    : {};

  return (
    <div
      {...drag}
      className={`relative h-full w-full overflow-hidden bg-neutral-900 ${framed ? "rounded-2xl" : ""} ${swap ? "cursor-grab active:cursor-grabbing" : ""} ${over ? "outline outline-[6px] outline-[#aedf02]" : ""}`}
      style={framed ? { border: `5px solid ${FRAME}`, boxShadow: "0 8px 24px rgba(0,0,0,.45)" } : undefined}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className={`h-full w-full ${isScreen && !crop ? "bg-black object-contain" : "object-cover"}`}
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

// A projected photo/video takes the stage: big with the cameras in a column
// ("destaque"), or full screen with the cameras in small windows ("pip").
function MediaStage({ stage, scene, branding, box, withSound }: {
  stage: TrackReferenceOrPlaceholder[];
  scene: Scene;
  branding: ProgramBranding;
  box: Box;
  withSound: boolean;
}) {
  const key = (t: TrackReferenceOrPlaceholder) => `${t.participant.identity}-${t.source}`;
  const cams = stage.filter((t) => t.source !== Track.Source.ScreenShare);
  if (scene.media.mode === "pip") {
    return (
      <>
        <div className="absolute inset-0 bg-black">
          <ProjectedMediaView media={scene.media} withSound={withSound} />
        </div>
        <div className="absolute flex gap-4" style={{ right: 28, bottom: box.bottom }}>
          {cams.slice(0, 3).map((t) => (
            <div key={key(t)} style={{ width: 256, height: 144 }}>
              <Tile trackRef={t} branding={branding} />
            </div>
          ))}
        </div>
      </>
    );
  }
  return (
    <div className={`absolute flex gap-4 ${scene.featuredSide === "right" ? "flex-row-reverse" : ""}`} style={box}>
      <div
        className="min-w-0 flex-[2.6] overflow-hidden rounded-2xl bg-black"
        style={{ border: `5px solid ${FRAME}`, boxShadow: "0 8px 24px rgba(0,0,0,.45)" }}
      >
        <ProjectedMediaView media={scene.media} withSound={withSound} />
      </div>
      {cams.length > 0 && (
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {cams.slice(0, 3).map((t) => (
            <div key={key(t)} className="min-h-0 flex-1">
              <Tile trackRef={t} branding={branding} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  // Tall frame for a shared phone/Twitter screen (center of the share), cameras beside it.
  if (scene.layout === "vertical") {
    const height = CANVAS_H - box.top - box.bottom;
    const width = Math.round(height * 0.6);
    const cols = others.length <= 2 ? 1 : 2;
    return (
      <div className={`absolute flex gap-4 ${scene.featuredSide === "right" ? "flex-row-reverse" : ""}`} style={box}>
        <div className="shrink-0" style={{ width, height }}>
          <Tile trackRef={featured} branding={branding} crop />
        </div>
        {others.length > 0 && (
          <div
            className="grid min-w-0 flex-1 gap-4"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}
          >
            {others.slice(0, 6).map((t) => (
              <Tile key={key(t)} trackRef={t} branding={branding} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (scene.layout === "solo" || (scene.layout === "spotlight" && others.length === 0)) {
    return (
      <div className="absolute" style={box}>
        <Tile trackRef={featured} branding={branding} />
      </div>
    );
  }

  // Only the shared window (falls back to whoever is featured).
  if (scene.layout === "screen") {
    const screen = stage.find((t) => t.source === Track.Source.ScreenShare && t.participant.identity === scene.featured)
      ?? stage.find((t) => t.source === Track.Source.ScreenShare)
      ?? featured;
    return (
      <div className="absolute" style={box}>
        <Tile trackRef={screen} branding={branding} />
      </div>
    );
  }

  // Window in the middle, presenters stacked on both sides: one edge-to-edge
  // band (TV-panel style), tiles touching with thin dividers.
  if (scene.layout === "center") {
    const left = box.left > 24 ? box.left : 0;
    const right = box.right > 24 ? box.right : 0;
    const width = CANVAS_W - left - right;
    const cams = others.slice(0, 4);
    // Side tiles ~1.45:1 next to a 16:9 window fill the width exactly.
    const sides = cams.length ? 2 : 0;
    let h = Math.floor(width / (16 / 9 + sides * 0.725));
    h = Math.min(h, CANVAS_H - box.top - box.bottom);
    const sideW = cams.length ? Math.floor((width - (h * 16) / 9) / 2) : 0;
    const top = box.top + Math.max(0, Math.floor((CANVAS_H - box.top - box.bottom - h) / 2));
    const half = Math.ceil(cams.length / 2);
    const column = (list: TrackReferenceOrPlaceholder[]) => (
      <div className="flex shrink-0 flex-col gap-[3px]" style={{ width: sideW }}>
        {list.map((t) => (
          <div key={key(t)} className="min-h-0 flex-1">
            <Tile trackRef={t} branding={branding} framed={false} />
          </div>
        ))}
      </div>
    );
    return (
      <div
        className="absolute flex gap-[3px] p-[3px] shadow-2xl"
        style={{ top, left, width, height: h, background: FRAME, justifyContent: "center" }}
      >
        {cams.length > 0 && column(cams.slice(0, half))}
        <div className="min-w-0 flex-1">
          <Tile trackRef={featured} branding={branding} framed={false} />
        </div>
        {cams.length > 1 && column(cams.slice(half))}
      </div>
    );
  }

  if (scene.layout === "spotlight") {
    return (
      <div className={`absolute flex gap-4 ${scene.featuredSide === "right" ? "flex-row-reverse" : ""}`} style={box}>
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

function CompetitionTab({ theme, className = "" }: { theme: CompetitionTheme; className?: string }) {
  if (!theme.name && !theme.logoUrl) return null;
  return (
    <div
      className={`flex h-9 items-center gap-2 rounded-t-md px-3 text-lg whitespace-nowrap uppercase ${className}`}
      style={{ ...CONDENSED, fontWeight: 700, background: theme.dark, color: theme.accent }}
    >
      {theme.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme.logoUrl}
          alt=""
          className="h-[30px] w-auto object-contain"
          // A thin light outline keeps dark logos readable on a dark tab.
          style={{ filter: "drop-shadow(0 0 1px rgba(255,255,255,0.85)) drop-shadow(0 0 6px rgba(255,255,255,0.25))" }}
        />
      )}
      {theme.name}
    </div>
  );
}

// Sent-off players: small red cards next to the team (TV style).
function RedCards({ n, size = 14 }: { n: number; size?: number }) {
  if (n <= 0) return null;
  return (
    <span className="flex gap-[3px]">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="rounded-[2px] bg-[#e11d2a] shadow" style={{ width: size * 0.68, height: size }} />
      ))}
    </span>
  );
}

// Stoppage time chip ("+3") next to the clock.
function Extra({ minutes, theme }: { minutes: number; theme: CompetitionTheme }) {
  if (minutes <= 0) return null;
  return (
    <span className="rounded px-1 text-[18px] leading-tight" style={{ ...DISPLAY, background: theme.accent, color: theme.dark }}>
      +{minutes}
    </span>
  );
}

function KickDot({ kick, next, size }: { kick: "goal" | "miss" | undefined; next: boolean; size: number }) {
  const base = { width: size, height: size, fontSize: size * 0.62 } as const;
  if (kick === "goal")
    return (
      <span className="chat-in flex items-center justify-center rounded-full bg-[#16a34a] font-black text-white shadow" style={base}>
        ✓
      </span>
    );
  if (kick === "miss")
    return (
      <span className="chat-in flex items-center justify-center rounded-full bg-[#dc2626] font-black text-white shadow" style={base}>
        ✕
      </span>
    );
  return <span className={`rounded-full border-2 ${next ? "live-dot border-white bg-white/40" : "border-white/45"}`} style={base} />;
}

// Shootout panel: one row per team with a dot per kick, the shootout score,
// and the winner line once it's decided.
function PenaltyStrip({ scene, width }: { scene: Scene; width?: number }) {
  const { home, away, penalties, theme } = scene.scoreboard;
  const st = shootoutState(penalties);
  const shown = Math.min(st.rounds, 10);
  const offset = st.rounds - shown;
  const size = shown > 7 ? 20 : 24;
  const row = (team: Team, side: "home" | "away") => {
    const goals = side === "home" ? st.homeGoals : st.awayGoals;
    const won = st.winner === side;
    return (
      <div className="flex items-center gap-2 px-3 py-1" style={won ? { background: "rgba(255,255,255,0.12)" } : undefined}>
        <Crest team={team} size={26} />
        <span className="w-14 text-2xl uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>
          {team.name.slice(0, 3)}
        </span>
        <span className="flex flex-1 gap-1.5">
          {Array.from({ length: shown }, (_, i) => (
            <KickDot key={i} kick={penalties[side][offset + i]} next={st.next === side && penalties[side].length === offset + i} size={size} />
          ))}
        </span>
        <span className="w-8 text-right text-3xl tabular-nums" style={{ ...DISPLAY, color: won ? theme.accent : "#fff" }}>
          {goals}
        </span>
      </div>
    );
  };
  return (
    <div className="chat-panel overflow-hidden rounded-lg shadow-2xl" style={{ width, background: theme.dark, color: "#fff", border: `3px solid ${theme.dark}` }}>
      <div className="px-3 pt-1 text-sm tracking-[0.25em] uppercase" style={{ ...CONDENSED, fontWeight: 700, color: theme.accent }}>
        Disputa de pênaltis
      </div>
      {row(home, "home")}
      {row(away, "away")}
      {st.winner && (
        <div className="chat-in px-3 py-1.5 text-center text-xl uppercase" style={{ ...CONDENSED, fontWeight: 700, background: theme.accent, color: theme.dark }}>
          {(st.winner === "home" ? home : away).name} vence nos pênaltis
        </div>
      )}
    </div>
  );
}

function ScoreboardBug({ scene, branding }: { scene: Scene; branding: ProgramBranding }) {
  const { home, away, clock, theme } = scene.scoreboard;
  const team = (t: Team) => (
    <div className="relative z-10 flex items-center gap-2 px-3">
      <Crest team={t} size={40} />
      <span className="text-3xl uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>{t.name.slice(0, 3)}</span>
      <RedCards n={t.redCards} />
    </div>
  );
  const pens = scene.scoreboard.penalties;
  const st = pens.active ? shootoutState(pens) : null;
  const aggregate = scene.scoreboard.aggregate.trim();
  return (
    <div className="absolute top-6 left-6 flex flex-col items-start">
      <CompetitionTab theme={theme} className="ml-2" />
      <div className="relative flex h-14 items-stretch rounded-lg shadow-2xl" style={{ background: theme.light, color: theme.dark, border: `3px solid ${theme.dark}` }}>
        {team(home)}
        <div className="relative z-10 flex items-center gap-2 px-4 text-4xl" style={{ ...DISPLAY, background: theme.dark, color: "#fff" }}>
          {/* Two-legged tie: the aggregate hangs right under the score. */}
          {aggregate && !st && (
            <span
              className="absolute top-full left-1/2 -translate-x-1/2 rounded-b-md px-2.5 pt-[3px] pb-0.5 text-[15px] leading-none whitespace-nowrap uppercase"
              style={{ ...CONDENSED, fontWeight: 700, background: theme.dark, color: theme.accent }}
            >
              {aggregate}
            </span>
          )}
          <span>{home.score}</span>
          {st && <span className="text-2xl" style={{ color: theme.accent }}>({st.homeGoals})</span>}
          <span className="text-xl" style={{ color: theme.accent }}>x</span>
          {st && <span className="text-2xl" style={{ color: theme.accent }}>({st.awayGoals})</span>}
          <span>{away.score}</span>
        </div>
        {team(away)}
        {clock.visible && (
          <div
            // Time and period stacked and centered inside the bar height.
            className="relative z-10 -my-[3px] -mr-[3px] flex min-w-[88px] flex-col items-center justify-center gap-[3px] rounded-r-lg px-3"
            style={{ background: theme.clock ?? branding.primaryColor, color: theme.clock ? "#fff" : branding.accentColor }}
          >
            {st ? (
              <span className="text-2xl leading-none" style={DISPLAY}>PÊNALTIS</span>
            ) : (
              <span className="flex items-center gap-1.5 text-[27px] leading-none tabular-nums" style={DISPLAY}>
                <ClockText clock={clock} />
                <Extra minutes={clock.extra} theme={theme} />
              </span>
            )}
            {!st && (
              <span className="text-[12px] leading-none tracking-wider uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>
                {clock.period}
              </span>
            )}
          </div>
        )}
      </div>
      {st && (
        <div className="mt-2">
          <PenaltyStrip scene={scene} width={420} />
        </div>
      )}
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
      <span className={`relative z-10 flex items-center gap-3 ${side === "away" ? "flex-row-reverse" : ""}`}>
        {t.name}
        <RedCards n={t.redCards} size={26} />
      </span>
    </div>
  );
  const pens = scene.scoreboard.penalties;
  const st = pens.active ? shootoutState(pens) : null;
  const aggregate = scene.scoreboard.aggregate.trim();
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
        <div className="absolute -top-9 left-1/2 -translate-x-1/2">
          <CompetitionTab theme={theme} />
        </div>
        <div className="flex flex-1 items-stretch overflow-hidden rounded-[3px]">
          {name(home, "home")}
          <div className="flex flex-col items-center justify-center px-6" style={{ background: theme.dark, color: "#fff" }}>
            <span className="text-5xl leading-none" style={DISPLAY}>
              {home.score}
              {st && <span className="text-3xl" style={{ color: theme.accent }}> ({st.homeGoals})</span>}{" "}
              <span className="text-2xl" style={{ color: theme.accent }}>vs</span>
              {st && <span className="text-3xl" style={{ color: theme.accent }}> ({st.awayGoals})</span>} {away.score}
            </span>
            {st ? (
              <span className="text-lg uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>Pênaltis</span>
            ) : (
              clock.visible && (
                <span className="text-lg tabular-nums uppercase" style={{ ...CONDENSED, fontWeight: 700, color: "#fff" }}>
                  <ClockText clock={clock} />
                  {clock.extra > 0 && <span style={{ color: theme.accent }}> +{clock.extra}</span>} · {clock.period}
                </span>
              )
            )}
            {aggregate && !st && (
              <span className="text-sm uppercase" style={{ ...CONDENSED, fontWeight: 700, color: theme.accent }}>{aggregate}</span>
            )}
          </div>
          {name(away, "away")}
        </div>
      </div>
      {crest(away, "away")}
      {st && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: BAR_H + 30 }}>
          <PenaltyStrip scene={scene} width={480} />
        </div>
      )}
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
// A looping video that never stays frozen: if the browser blocks sound, it
// plays muted and the air monitor offers "Ativar som".
function LoopVideo({ src, withSound }: { src: string; withSound: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = !withSound;
    const unlock = () => {
      el.muted = false;
      el.play().catch(() => {});
    };
    el.play().catch((err: DOMException) => {
      if (err?.name !== "NotAllowedError") return;
      el.muted = true;
      el.play().catch(() => {});
      if (withSound) {
        window.dispatchEvent(new Event(AUDIO_BLOCKED));
        window.addEventListener(AUDIO_UNLOCK, unlock, { once: true });
      }
    });
    return () => window.removeEventListener(AUDIO_UNLOCK, unlock);
  }, [withSound]);
  return <video ref={ref} src={src} loop playsInline preload="auto" className="h-full w-full object-cover" />;
}

function ScreenMedia({ scene, withSound }: { scene: Scene; withSound: boolean }) {
  const s = scene.screen;
  const isVideo = /\.(mp4|webm)$/i.test(s.mediaUrl ?? "");
  return (
    <div className="absolute inset-0 z-40 bg-black">
      {isVideo ? (
        <LoopVideo key={s.mediaUrl} src={s.mediaUrl!} withSound={withSound} />
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
  onArrange,
}: {
  // Renders this scene instead of the on-air one (preview monitor).
  scene?: Scene;
  // Plays on-stage participants' audio (the Egress output needs it).
  withAudio?: boolean;
  // Sound pads, stingers and background track: played, shown muted, or ignored.
  media?: "play" | "silent" | "off";
  emptyHint?: string;
  // Dragging a window onto another calls this with the scene change to apply.
  onArrange?: (patch: Partial<Scene>) => void;
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
  // In "all", the director's own browser only counts once it shows a camera.
  const showsVideo = (t: TrackReferenceOrPlaceholder) => isTrackReference(t) && !t.publication.isMuted;
  const onStageIds =
    scene.stageMode === "all"
      ? [...new Set(all.filter((t) => !t.participant.identity.startsWith("host-") || showsVideo(t)).map((t) => t.participant.identity))]
      : scene.onStage;
  // "all" follows the order the director arranged by dragging; newcomers go last.
  const ranked =
    scene.stageMode === "all" && scene.order.length
      ? [...onStageIds].sort((a, b) => {
          const ia = scene.order.indexOf(a);
          const ib = scene.order.indexOf(b);
          return (ia < 0 ? 1e6 + onStageIds.indexOf(a) : ia) - (ib < 0 ? 1e6 + onStageIds.indexOf(b) : ib);
        })
      : onStageIds;
  const order = new Map(ranked.map((id, i) => [id, i]));
  const stage = all
    .filter((t) => order.has(t.participant.identity))
    .sort((a, b) => order.get(a.participant.identity)! - order.get(b.participant.identity)!);

  // Swap two windows: with the big window involved, the other becomes the
  // featured one; otherwise they trade places in the order.
  const swap = onArrange
    ? (from: string, to: string) => {
        const featuredLayout = scene.layout !== "auto";
        const featuredId = featuredLayout ? pickFeatured(stage, scene)?.participant.identity : undefined;
        if (featuredId && (from === featuredId || to === featuredId)) {
          onArrange({ featured: from === featuredId ? to : from });
          return;
        }
        // Manual: swap inside the director's list (keeps people who are offline).
        const ids = scene.stageMode === "manual" ? [...scene.onStage] : [...new Set(stage.map((s) => s.participant.identity))];
        const a = ids.indexOf(from);
        const b = ids.indexOf(to);
        if (a < 0 || b < 0) return;
        [ids[a], ids[b]] = [ids[b], ids[a]];
        onArrange(scene.stageMode === "manual" ? { onStage: ids } : { order: ids });
      }
    : null;

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
  const tweet = scene.tweet.visible ? scene.tweet.card : null;
  const mediaOn = scene.media.visible && scene.media.url !== null;
  // Beside the cameras: left, or right when the tier list panel holds the left.
  const tweetSide = tweet && scene.tweet.mode === "side" ? (tierSplit || side === "left" ? "right" : "left") : null;

  // Bottom-up stack: ticker, scoreboard bar, GC; the stage fills what's left.
  let y = tickerOn ? TICKER_H + 12 : 18;
  const barBottom = y;
  if (barOn) y += BAR_H + (themeTab ? 40 : 14);
  const gcBottom = y;
  if (gcOn || highlightOn) y += GC_H + 22;
  const headerOn = scene.showLogo;
  const top = headerOn ? 128 : bugOn ? (themeTab ? 128 : 92) : 24;
  const box: Box = {
    top,
    left: tierSplit ? 24 + TIER_W + 16 : side === "left" ? 24 + SIDE_W + 16 : tweetSide === "left" ? 24 + TWEET_W + 16 : 24,
    right:
      (side === "right" ? 24 + SIDE_W + 16 : 24) + (chatOn ? CHAT_W + 16 : 0) + (tweetSide === "right" ? TWEET_W + 16 : 0),
    bottom: Math.max(y, 24),
  };
  // Re-keys the stage when the arrangement changes, so a cut fades in.
  const arrangement = `${scene.layout}:${scene.featuredSide}|${stage.map((t) => `${t.participant.identity}:${t.source}`).join(",")}|${chatOn}|${side}|${tierSplit}|${tweetSide}|${mediaOn ? `${scene.media.mode}:${scene.media.url}` : ""}`;

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
        <SwapContext.Provider value={swap}>
        <div key={arrangement} className="scene-fade absolute inset-0">
          {mediaOn && scene.media.mode !== "full" ? (
            <MediaStage stage={stage} scene={scene} branding={branding} box={box} withSound={media === "play"} />
          ) : (
            <Stage stage={stage} scene={scene} branding={branding} box={box} />
          )}
        </div>
        </SwapContext.Provider>
        {mediaOn && scene.media.mode === "full" && (
          <div className="scene-fade absolute inset-0 z-[31]">
            <ProjectedMediaView media={scene.media} withSound={media === "play"} />
          </div>
        )}
        {tierSplit && <TierPanel list={scene.tierList} top={box.top} bottom={box.bottom} />}
        {tweet && tweetSide && (
          <TweetCardView
            key={tweet.id}
            card={tweet}
            style={{
              top: box.top,
              height: CANVAS_H - box.top - box.bottom,
              width: TWEET_W,
              ...(tweetSide === "left" ? { left: 24 } : { right: 24 + (chatOn ? CHAT_W + 16 : 0) }),
            }}
          />
        )}
        {tweet && !tweetSide && (
          <>
            <div className="scene-fade absolute inset-0 z-[33] bg-black/55" />
            <div className="absolute inset-0 z-[33] flex items-center justify-center">
              <TweetCardView
                key={tweet.id}
                big
                card={tweet}
                style={{ position: "relative", width: tweet.photo ? 700 : 800, height: tweet.photo ? 648 : undefined, maxHeight: 648 }}
              />
            </div>
          </>
        )}
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
        {media !== "off" && <MediaLayer silent={media === "silent"} preload={show.sounds} />}
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
