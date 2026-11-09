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
import { MusicLayer } from "./MusicLayer";
import {
  clockElapsedMs,
  formatClock,
  parseShowMetadata,
  type Clock,
  type ProgramBranding,
  type Scene,
  type Team,
} from "@/lib/scene";

// Output canvas: 1280×720 (what Egress records). Every measure below is the
// brand manual's 1920×1080 grid scaled by 2/3, so the program monitors and
// the YouTube output match the manual's scenes.
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

// Brand manual palette ("grafite e limão").
const C = {
  bg: "#0B0D0F",
  black: "#090909",
  panel: "#1A1F22",
  lime: "#DFFF00",
  white: "#F7F8F7",
  gray: "#A3A3A3",
  alert: "#FF2D2D",
  rule: "#353D41",
};

const ANTON: CSSProperties = { fontFamily: "var(--font-display), Impact, sans-serif", fontWeight: 400 };
const ARCHIVO: CSSProperties = { fontFamily: "var(--font-text), Arial, sans-serif" };
const LABEL: CSSProperties = { ...ARCHIVO, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" };

const MX = 43; // side margins (64 px @1080)
const HEADER_LINE = 96; // header rule (y = 144 @1080)
const FOOTER_LINE = 656; // footer rule (y = 984 @1080)
const TOP = 112; // first row of content
const BOTTOM = 640; // last row of content
const CONTENT_W = CANVAS_W - 2 * MX;
const GAP = 21; // between blocks (32 px @1080)

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

// ---------------------------------------------------------------- brand marks

// "Sinal de abertura": a lime rule and two dots that open each block.
function Signal({ size = 1 }: { size?: number }) {
  return (
    <span className="flex items-center" style={{ gap: 3 * size }}>
      <span style={{ width: 22 * size, height: 4 * size, background: C.lime }} />
      <span style={{ width: 4 * size, height: 4 * size, background: C.lime }} />
      <span style={{ width: 4 * size, height: 4 * size, background: C.lime }} />
    </span>
  );
}

function Rule({ y }: { y: number }) {
  return <div className="absolute" style={{ left: MX, right: MX, top: y, height: 1, background: C.rule }} />;
}

function Logo({ branding, height, style }: { branding: ProgramBranding; height: number; style: CSSProperties }) {
  return branding.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={branding.logoUrl} alt="" className="absolute object-contain" style={{ ...style, height, width: "auto" }} />
  ) : (
    <span className="absolute leading-none uppercase" style={{ ...style, ...ANTON, fontSize: height * 0.42, color: C.lime }}>
      DEBATE
      <br />
      BACANA
    </span>
  );
}

// -------------------------------------------------------------------- tiles

type Rect = { left: number; top: number; width: number; height: number };

function Tile({ trackRef, rect, nameBar = true }: { trackRef: TrackReferenceOrPlaceholder; rect: Rect; nameBar?: boolean }) {
  const isScreen = trackRef.source === Track.Source.ScreenShare;
  const name = trackRef.participant.name || trackRef.participant.identity;
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  const barH = Math.max(20, Math.min(26, rect.height * 0.09));

  return (
    <div className="absolute" style={rect}>
      <div className="absolute inset-0 overflow-hidden" style={{ background: C.panel, outline: `2px solid ${C.rule}`, outlineOffset: -2 }}>
        {hasVideo ? (
          <VideoTrack
            trackRef={trackRef}
            className={`h-full w-full ${isScreen ? "object-contain" : "object-cover"}`}
            style={{ background: C.black }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                ...ANTON,
                width: rect.height * 0.32,
                height: rect.height * 0.32,
                fontSize: rect.height * 0.16,
                background: C.bg,
                color: C.lime,
              }}
            >
              {name.trim().charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      {nameBar && !isScreen && (
        <div className="absolute right-0 bottom-0 left-0 flex items-center" style={{ height: barH, background: `${C.bg}e6` }}>
          <span style={{ width: 3, height: "100%", background: C.lime }} />
          <span className="truncate" style={{ ...ARCHIVO, fontWeight: 700, fontSize: barH * 0.62, color: C.white, paddingLeft: 8 }}>
            {name}
          </span>
        </div>
      )}
    </div>
  );
}

function pickFeatured(stage: TrackReferenceOrPlaceholder[], scene: Scene) {
  if (scene.featured) {
    const own = stage.filter((t) => t.participant.identity === scene.featured);
    const pick = own.find((t) => t.source === Track.Source.ScreenShare) ?? own[0];
    if (pick) return pick;
  }
  return stage.find((t) => t.source === Track.Source.ScreenShare) ?? stage[0];
}

function fit(maxW: number, maxH: number) {
  const w = Math.min(maxW, maxH * (16 / 9));
  return { w, h: w * (9 / 16) };
}

// n boxes in a row, centered in the content width.
function row(n: number, top: number, w: number, h: number): Rect[] {
  const total = n * w + (n - 1) * GAP;
  const left = MX + (CONTENT_W - total) / 2;
  return Array.from({ length: n }, (_, i) => ({ left: left + i * (w + GAP), top, width: w, height: h }));
}

// A column of camera boxes beside a main area (manual: "tela + N câmeras").
function column(n: number, left: number, width: number, top: number, bottom: number): Rect[] {
  const gap = 12;
  const h = Math.min(width * 0.63, (bottom - top - (n - 1) * gap) / n);
  const total = n * h + (n - 1) * gap;
  const start = top + (bottom - top - total) / 2;
  return Array.from({ length: n }, (_, i) => ({ left, top: start + i * (h + gap), width, height: h }));
}

const SIDE_W = 288; // camera column (432 px @1080)
const MAIN_W = CONTENT_W - SIDE_W - GAP; // main area beside the camera column
const PANEL_W = 368; // single-camera side panel

type Placed = { t: TrackReferenceOrPlaceholder; rect: Rect; full?: boolean };

// Positions for everyone on stage, following the manual's grids.
function arrange(
  stage: TrackReferenceOrPlaceholder[],
  scene: Scene,
  top: number,
  bottom: number,
  sidePanel: boolean,
  // A web page owns the main area on this side; cameras take the other column.
  mainTaken: "left" | "right" | null,
): Placed[] {
  if (stage.length === 0) return [];
  const height = bottom - top;
  const featured = pickFeatured(stage, scene);
  const others = stage.filter((t) => t !== featured);

  // Something else (web page) owns the main area: everyone goes to the column.
  if (mainTaken) {
    const colLeft = mainTaken === "left" ? MX + MAIN_W + GAP : MX;
    return column(Math.min(stage.length, 4), colLeft, SIDE_W, top, bottom).map((rect, i) => ({ t: stage[i], rect }));
  }

  const screenShared = featured.source === Track.Source.ScreenShare;

  if (scene.layout === "pip") {
    return [
      { t: featured, rect: { left: 0, top: 0, width: CANVAS_W, height: CANVAS_H }, full: true },
      ...others.slice(0, 3).map((t, i) => ({
        t,
        rect: { left: CANVAS_W - MX - 240 - i * 252, top: BOTTOM - 135, width: 240, height: 135 },
      })),
    ];
  }

  if (scene.layout === "solo" || (stage.length === 1 && !screenShared)) {
    const { w, h } = fit(sidePanel ? CONTENT_W - PANEL_W - GAP : CONTENT_W, height);
    const left = sidePanel ? MX : MX + (CONTENT_W - w) / 2;
    return [{ t: featured, rect: { left, top: top + (height - h) / 2, width: w, height: h } }];
  }

  if (scene.layout === "spotlight" || screenShared) {
    // Featured (or the shared screen) big, the rest in a column on the right.
    const { w, h } = fit(MAIN_W, height);
    const colLeft = MX + w + GAP;
    return [
      { t: featured, rect: { left: MX, top: top + (height - h) / 2, width: w, height: h } },
      ...column(Math.min(others.length, 4), colLeft, CANVAS_W - MX - colLeft, top, bottom).map((rect, i) => ({ t: others[i], rect })),
    ];
  }

  // "Mesa": the manual's grid for 2 to 5 cameras.
  const list = stage.slice(0, 5);
  let rects: Rect[];
  if (list.length === 2) {
    const { w, h } = fit((CONTENT_W - GAP) / 2, height);
    rects = row(2, top + (height - h) / 2, w, h);
  } else if (list.length === 3) {
    const w = (CONTENT_W - 2 * GAP) / 3;
    const h = Math.min(w * 0.85, height);
    rects = row(3, top + (height - h) / 2, w, h);
  } else if (list.length === 4) {
    const h = Math.min(240, (height - GAP) / 2);
    const w = h * (672 / 328);
    const y = top + (height - (2 * h + GAP)) / 2;
    rects = [...row(2, y, w, h), ...row(2, y + h + GAP, w, h)];
  } else {
    const h = Math.min(220, (height - GAP) / 2);
    const w = Math.min((CONTENT_W - 2 * GAP) / 3, h * (576 / 304));
    const y = top + (height - (2 * h + GAP)) / 2;
    rects = [...row(3, y, w, h), ...row(2, y + h + GAP, w, h)];
  }
  return rects.map((rect, i) => ({ t: list[i], rect }));
}

// ------------------------------------------------------------- overlays

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

function TeamMark({ team, size }: { team: Team; size: number }) {
  return team.crestUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={team.crestUrl} alt="" className="object-contain" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex items-center justify-center"
      style={{ ...ANTON, width: size, height: size, fontSize: size * 0.6, background: C.bg, color: C.lime, border: `1px solid ${C.rule}` }}
    >
      {team.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

const SCORE_W = 400;
const SCORE_H = 56;

// Manual "Central da partida": crest, abbreviation, score, abbreviation,
// crest, with the clock under the score and a lime (or competition) rule.
function Scoreboard({ scene, left, top }: { scene: Scene; left: number; top: number }) {
  const { home, away, clock, theme } = scene.scoreboard;
  const accent = theme.clock ?? C.lime;
  const abbr = (t: Team) => t.name.slice(0, 3).toUpperCase();
  return (
    <div className="absolute flex items-center gap-4" style={{ left, top }}>
      <div
        className="flex items-center justify-between px-3"
        style={{ width: SCORE_W, height: SCORE_H, background: C.panel, border: `1px solid ${C.rule}`, borderBottom: `3px solid ${accent}` }}
      >
        <div className="flex items-center gap-2">
          <TeamMark team={home} size={34} />
          <span style={{ ...ARCHIVO, fontWeight: 700, fontSize: 17, color: C.white }}>{abbr(home)}</span>
        </div>
        <div className="flex flex-col items-center leading-none">
          <span style={{ ...ANTON, fontSize: 34, color: C.white }}>
            {home.score} <span style={{ ...ARCHIVO, fontWeight: 700, color: accent, fontSize: 20, verticalAlign: "middle" }}>×</span>{" "}
            {away.score}
          </span>
          {clock.visible && (
            <span className="mt-0.5 tabular-nums" style={{ ...ARCHIVO, fontWeight: 600, fontSize: 11, color: C.gray }}>
              <ClockText clock={clock} /> / {clock.period}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span style={{ ...ARCHIVO, fontWeight: 700, fontSize: 17, color: C.white }}>{abbr(away)}</span>
          <TeamMark team={away} size={34} />
        </div>
      </div>
      <div className="flex flex-col items-start gap-1">
        <span className="px-1.5 py-0.5" style={{ ...LABEL, fontSize: 9, background: C.alert, color: C.bg }}>
          AO VIVO
        </span>
        {(theme.name || theme.logoUrl) && (
          <span className="flex items-center gap-2" style={{ ...ARCHIVO, fontWeight: 700, fontSize: 15, color: C.white }}>
            {theme.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" className="h-6 w-auto object-contain" />
            )}
            {theme.name}
          </span>
        )}
      </div>
    </div>
  );
}

// Lower third ("Pauta da mesa"): lime label over a white line, lime stripe.
function GcBar({ scene, rect }: { scene: Scene; rect: Rect }) {
  const { gc } = scene;
  return (
    <div className="absolute flex items-stretch" style={{ ...rect, background: C.panel }}>
      <span style={{ width: 4, background: C.lime }} />
      {gc.imageUrl && (
        <div className="flex items-center justify-center px-2" style={{ background: C.bg }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gc.imageUrl} alt="" className="object-contain" style={{ height: rect.height - 10, width: "auto" }} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center px-3">
        {gc.subtitle.trim() && (
          <span className="truncate" style={{ ...LABEL, fontSize: 9, color: C.lime }}>
            {gc.subtitle}
          </span>
        )}
        <span className="truncate" style={{ ...ARCHIVO, fontWeight: 700, fontSize: 17, color: C.white }}>
          {gc.title}
        </span>
      </div>
    </div>
  );
}

// One camera: the GC becomes the manual's side panel ("Na mesa / A rodada em pauta").
function GcPanel({ scene, rect }: { scene: Scene; rect: Rect }) {
  const { gc } = scene;
  return (
    <div className="absolute flex flex-col p-5" style={{ ...rect, background: C.panel, border: `1px solid ${C.rule}` }}>
      {gc.subtitle.trim() && <span style={{ ...LABEL, fontSize: 9, color: C.gray }}>{gc.subtitle}</span>}
      <span className="mt-2 leading-[1.02] uppercase" style={{ ...ANTON, fontSize: 32, color: C.white }}>
        {gc.title}
      </span>
      {gc.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={gc.imageUrl} alt="" className="mt-auto max-h-24 w-auto self-start object-contain" />
      )}
    </div>
  );
}

function WebFrame({ scene, rect, framed }: { scene: Scene; rect: Rect; framed: boolean }) {
  const { url, zoom } = scene.web;
  return (
    <div className="absolute overflow-hidden bg-white" style={{ ...rect, ...(framed && { outline: `2px solid ${C.rule}`, outlineOffset: -2 }) }}>
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

function Header({ scene, branding, overVideo }: { scene: Scene; branding: ProgramBranding; overVideo: boolean }) {
  const sponsorOn = scene.sponsor.visible && scene.sponsor.imageUrl;
  return (
    <>
      {overVideo && (
        <div className="absolute inset-x-0 top-0" style={{ height: HEADER_LINE + 1, background: `linear-gradient(${C.bg}f2, ${C.bg}99)` }} />
      )}
      <div className="absolute flex flex-col gap-2" style={{ left: MX, top: 32 }}>
        <Signal />
        <span style={{ ...LABEL, fontSize: 11, color: C.gray }}>{branding.name}</span>
      </div>
      {scene.title.trim() && (
        <span className="absolute uppercase" style={{ ...ANTON, left: 220, top: 42, fontSize: 24, lineHeight: 1, color: C.white }}>
          {scene.title}
        </span>
      )}
      {sponsorOn && (
        <div className="absolute flex items-center gap-2" style={{ right: MX + 130, top: 34 }}>
          <span style={{ ...LABEL, fontSize: 8, color: C.gray }}>APOIO</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene.sponsor.imageUrl!} alt="" className="h-8 max-w-[120px] object-contain" />
        </div>
      )}
      {scene.showLogo && <Logo branding={branding} height={64} style={{ right: MX, top: 16 }} />}
      <Rule y={HEADER_LINE} />
    </>
  );
}

function Footer({ scene, branding, overVideo }: { scene: Scene; branding: ProgramBranding; overVideo: boolean }) {
  const tickerOn = scene.ticker.visible && scene.ticker.text.trim() !== "";
  return (
    <>
      {overVideo && <div className="absolute inset-x-0 bottom-0" style={{ top: FOOTER_LINE, background: `${C.bg}d9` }} />}
      <Rule y={FOOTER_LINE} />
      <div className="absolute flex items-center gap-5 overflow-hidden" style={{ left: MX, right: MX, top: FOOTER_LINE + 18, height: 24 }}>
        {tickerOn ? (
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="ticker-scroll whitespace-nowrap" style={{ ...ARCHIVO, fontWeight: 600, fontSize: 15, color: C.white }}>
              {scene.ticker.text}
            </div>
          </div>
        ) : (
          <span className="flex-1" style={{ ...LABEL, fontSize: 9, color: C.gray }}>
            {branding.name} • futebol em voz alta
          </span>
        )}
        <span style={{ ...LABEL, fontSize: 9, color: C.lime }}>DEBATE BACANA</span>
      </div>
    </>
  );
}

// ------------------------------------------------------- institutional screens

function Countdown({ to }: { to: number }) {
  const now = useNow(true);
  return <>{formatClock(Math.max(0, to - now))}</>;
}

// "Começamos em instantes", "Já voltamos" and "Até a próxima" from the manual.
function InstitutionalScreen({ scene, branding }: { scene: Scene; branding: ProgramBranding }) {
  const s = scene.screen;
  return (
    <div className="absolute inset-0" style={{ background: C.bg }}>
      <Logo branding={branding} height={72} style={{ left: MX + 10, top: 36 }} />
      <div className="absolute flex flex-col" style={{ left: MX + 10, top: 196, width: 720 }}>
        <Signal size={1.2} />
        <span className="mt-3" style={{ ...LABEL, fontSize: 13, color: C.lime }}>
          {s.label}
        </span>
        <span className="mt-2 uppercase" style={{ ...ANTON, fontSize: 84, lineHeight: 0.98, color: C.white }}>
          {s.title}
        </span>
        <span className="mt-5" style={{ ...ARCHIVO, fontSize: 19, color: C.gray }}>
          {s.subtitle}
        </span>
      </div>
      <div className="absolute flex flex-col p-7" style={{ left: 870, top: 216, width: 350, height: 300, background: C.panel }}>
        <Signal />
        <span className="mt-4" style={{ ...LABEL, fontSize: 11, color: C.lime }}>
          {s.panelLabel}
        </span>
        <span className="mt-2 uppercase tabular-nums" style={{ ...ANTON, fontSize: 54, lineHeight: 1, color: C.white }}>
          {s.kind === "espera" && s.countdownTo ? <Countdown to={s.countdownTo} /> : s.panelTitle}
        </span>
        <span className="mt-3" style={{ ...ARCHIVO, fontWeight: 600, fontSize: 13, color: C.gray }}>
          {s.panelText}
        </span>
      </div>
      <Rule y={FOOTER_LINE} />
      <div className="absolute flex justify-between" style={{ left: MX, right: MX, top: FOOTER_LINE + 20 }}>
        <span style={{ ...LABEL, fontSize: 9, color: C.gray }}>DEBATE BACANA</span>
        <span style={{ ...LABEL, fontSize: 9, color: C.lime }}>{branding.name}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ program

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
        <div className="h-full w-full" style={{ background: C.bg }} />
      </ScaledCanvas>
    );
  }

  const branding = show.program;
  const scene = sceneOverride ?? show.scene;
  const order = new Map(scene.onStage.map((id, i) => [id, i]));
  const stage = dedupeTracks(tracks)
    .filter((t) => order.has(t.participant.identity))
    .sort((a, b) => order.get(a.participant.identity)! - order.get(b.participant.identity)!);

  const scoreOn = scene.scoreboard.visible;
  const scoreTop = scoreOn && scene.scoreboard.style === "bug";
  const scoreBottom = scoreOn && scene.scoreboard.style === "bar";
  const gcOn = scene.gc.visible && scene.gc.title.trim() !== "";
  const webOn = scene.web.visible && scene.web.url !== "";
  const webMain = webOn && (scene.web.position === "left" || scene.web.position === "right");
  const pip = scene.layout === "pip" && stage.length > 0 && !webMain;

  // One camera + GC: the GC becomes a side panel (manual "Uma câmera").
  const singleCam =
    !webMain && !pip && (scene.layout === "solo" || stage.length === 1) && pickFeatured(stage, scene)?.source !== Track.Source.ScreenShare;
  const gcAsPanel = gcOn && singleCam && stage.length > 0;
  const gcAsBar = gcOn && !gcAsPanel;

  const top = TOP + (scoreTop ? SCORE_H + 18 : 0);
  const bottomBand = gcAsBar || scoreBottom;
  const bottom = BOTTOM - (bottomBand ? 64 : 0);
  const webSide = webMain ? (scene.web.position as "left" | "right") : null;
  const placed = arrange(stage, scene, top, bottom, gcAsPanel, webSide);
  const bandTop = BOTTOM - 50;
  const gcLeft = scoreBottom ? MX + SCORE_W + GAP : MX;
  const webLeft = webSide === "right" && stage.length > 0 ? MX + SIDE_W + GAP : MX;

  return (
    <ScaledCanvas>
      <div
        className="relative h-full w-full"
        style={{ background: branding.backgroundUrl ? `center / cover no-repeat url(${JSON.stringify(branding.backgroundUrl)})` : C.bg }}
      >
        {webMain && (
          <WebFrame
            scene={scene}
            framed
            rect={{
              left: webLeft,
              top,
              width: stage.length ? MAIN_W : CONTENT_W,
              height: bottom - top,
            }}
          />
        )}
        {placed.map(({ t, rect, full }) => (
          <Tile key={`${t.participant.identity}-${t.source}`} trackRef={t} rect={rect} nameBar={!full} />
        ))}
        {gcAsPanel && <GcPanel scene={scene} rect={{ left: CANVAS_W - MX - PANEL_W, top, width: PANEL_W, height: bottom - top }} />}
        {webOn && !webMain && (
          <WebFrame
            scene={scene}
            framed={scene.web.position !== "full"}
            rect={
              scene.web.position === "full"
                ? { left: 0, top: 0, width: CANVAS_W, height: CANVAS_H }
                : { left: 190, top: 120, width: 900, height: 500 }
            }
          />
        )}

        <Header scene={scene} branding={branding} overVideo={pip} />
        {scoreTop && <Scoreboard scene={scene} left={MX} top={TOP} />}
        {scoreBottom && <Scoreboard scene={scene} left={MX} top={bandTop - 4} />}
        {gcAsBar && <GcBar scene={scene} rect={{ left: gcLeft, top: bandTop, width: CANVAS_W - MX - gcLeft, height: 50 }} />}
        <Footer scene={scene} branding={branding} overVideo={pip} />

        {stage.length === 0 && !webOn && emptyHint && (
          <div className="absolute inset-x-0 text-center" style={{ top: 350, ...ARCHIVO, fontSize: 22, color: C.gray }}>
            {emptyHint}
          </div>
        )}

        {scene.screen.kind !== "none" && <InstitutionalScreen scene={scene} branding={branding} />}
        {media !== "off" && <MediaLayer silent={media === "silent"} />}
      </div>
      {media === "play" && <MusicLayer music={scene.music} />}
      {withAudio &&
        audioTracks
          .filter((t) => order.has(t.participant.identity))
          .map((t) => <AudioTrack key={t.publication.trackSid} trackRef={t} />)}
    </ScaledCanvas>
  );
}
