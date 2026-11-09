"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_TRANSITION, type ProgramBranding, type TransitionConfig } from "@/lib/scene";
import { FRAME } from "./showStyle";

// Plays the program's transition when a cut starts (scene.transitionAt): its
// own video (an OBS-style stinger, ideally a transparent .webm) or a built-in
// wipe with the hosts' caricature. The server swaps the scene at the cut point,
// while this covers the screen.

const BUILT_IN_MS = 1150;
// The show's signature for every program: the hosts' caricature on the
// Debate Bacana colors.
const CARICATURE = "/brand/caricatura.png";
const BRAND_LOGO = "/brand/debate-bacana.png";
const LIME = "#aedf02";
// Ignore cuts that started long ago (e.g. when the page loads).
const MAX_AGE_MS = 1500;

export function TransitionLayer({
  at,
  config = DEFAULT_TRANSITION,
  branding,
  withSound,
}: {
  at: number | null;
  config?: TransitionConfig;
  branding: ProgramBranding;
  withSound: boolean;
}) {
  const [playing, setPlaying] = useState<number | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!at || !config.enabled || Date.now() - at > MAX_AGE_MS) return;
    const start = setTimeout(() => setPlaying(at), 0);
    const el = video.current;
    if (config.mediaUrl && el) {
      el.currentTime = 0;
      el.play().catch(() => {
        // Autoplay with sound may be refused in a monitor tab: retry muted.
        el.muted = true;
        el.play().catch(() => setPlaying(null));
      });
      return () => clearTimeout(start);
    }
    const end = setTimeout(() => setPlaying(null), BUILT_IN_MS + 50);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [at, config.enabled, config.mediaUrl]);

  if (config.mediaUrl) {
    return (
      <video
        ref={video}
        src={config.mediaUrl}
        preload="auto"
        playsInline
        muted={!withSound}
        onEnded={() => setPlaying(null)}
        onError={() => setPlaying(null)}
        className="pointer-events-none absolute inset-0 z-[60] h-full w-full object-cover"
        style={{ opacity: playing ? 1 : 0 }}
      />
    );
  }

  // Kept in the page (invisible) so the images are loaded before the first cut.
  const preload = (
    <div className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={CARICATURE} alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND_LOGO} alt="" />
    </div>
  );
  if (!playing) return preload;
  return (
    <div key={playing} className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
      {preload}
      <div className="wipe-band" style={{ background: LIME, animationDelay: "0ms" }} />
      <div className="wipe-band" style={{ background: FRAME, animationDelay: "70ms" }} />
      <div className="wipe-band" style={{ background: "#0d1a02", animationDelay: "140ms" }} />
      <div className="wipe-logo absolute inset-x-0 top-[34px] flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_LOGO} alt="" className="h-[120px] w-auto drop-shadow-[0_0_18px_rgba(174,223,2,0.5)]" />
      </div>
      <div className="wipe-caricature absolute inset-x-0 bottom-0 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CARICATURE} alt={branding.name} className="h-[540px] w-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]" />
      </div>
    </div>
  );
}
