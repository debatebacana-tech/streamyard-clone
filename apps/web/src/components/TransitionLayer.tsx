"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_TRANSITION, type ProgramBranding, type TransitionConfig } from "@/lib/scene";
import { FRAME } from "./showStyle";

// Plays the program's transition when a cut starts (scene.transitionAt): its
// own video (an OBS-style stinger, ideally a transparent .webm) or a built-in
// wipe in the program's colors. The server swaps the scene at the cut point,
// while this covers the screen.

const BUILT_IN_MS = 900;
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

  if (!playing) return null;
  return (
    <div key={playing} className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
      <div className="wipe-band" style={{ background: branding.accentColor, animationDelay: "0ms" }} />
      <div className="wipe-band" style={{ background: FRAME, animationDelay: "60ms" }} />
      <div className="wipe-band" style={{ background: branding.primaryColor, animationDelay: "120ms" }} />
      <div className="wipe-logo absolute inset-0 flex items-center justify-center">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="max-h-[260px] max-w-[60%] object-contain drop-shadow-2xl" />
        ) : (
          <span className="text-8xl text-white uppercase" style={{ fontFamily: "var(--font-display), Impact, sans-serif" }}>
            {branding.name}
          </span>
        )}
      </div>
    </div>
  );
}
