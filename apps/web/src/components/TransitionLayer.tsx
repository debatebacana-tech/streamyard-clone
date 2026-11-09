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
      {/* Backdrop behind the caricature: rotating lime rays, a glow, dots and stripes. */}
      <div className="wipe-stage absolute inset-0 overflow-hidden">
        <div className="wipe-rays absolute top-1/2 left-1/2 h-[2400px] w-[2400px] -translate-x-1/2 -translate-y-[38%]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_78%,rgba(174,223,2,0.55),rgba(174,223,2,0.08)_42%,transparent_62%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.13)_1.5px,transparent_1.6px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_50%_60%,black_20%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,rgba(174,223,2,0.07)_0_14px,transparent_14px_42px)]" />
        <span className="absolute -top-4 -left-10 h-14 w-64 -skew-x-[30deg] bg-[#aedf02]" />
        <span className="absolute -right-10 -bottom-4 h-14 w-64 -skew-x-[30deg] bg-[#aedf02]" />
        <span className="absolute top-14 -left-10 h-4 w-40 -skew-x-[30deg] bg-[#aedf02]/70" />
        <span className="absolute -right-10 bottom-14 h-4 w-40 -skew-x-[30deg] bg-[#aedf02]/70" />
      </div>
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
