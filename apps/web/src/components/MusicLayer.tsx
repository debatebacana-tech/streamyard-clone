"use client";

import { useEffect, useRef } from "react";
import type { Scene } from "@/lib/scene";

const FADE_MS = 1200;

function fade(audio: HTMLAudioElement, to: number, done?: () => void) {
  const from = audio.volume;
  const start = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / FADE_MS);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

// Background track. Position comes from the server's startedAt, so the
// Egress output and the director's monitor play in step and a late joiner
// starts mid-track; starts, stops and volume changes fade.
export function MusicLayer({ music }: { music: Scene["music"] }) {
  const current = useRef<{ audio: HTMLAudioElement; key: string } | null>(null);
  const playing = Boolean(music.url && music.startedAt);
  const key = `${music.url}|${music.startedAt}|${music.loop}`;

  useEffect(() => {
    const old = current.current;
    if (old && (!playing || old.key !== key)) {
      fade(old.audio, 0, () => old.audio.pause());
      current.current = null;
    }
    if (!playing || current.current) return;

    const audio = new Audio(music.url!);
    audio.loop = music.loop;
    audio.volume = 0;
    current.current = { audio, key };
    const startedAt = music.startedAt!;
    const target = music.volume;
    audio.addEventListener(
      "loadedmetadata",
      () => {
        const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
        if (!music.loop && elapsed >= audio.duration) return;
        audio.currentTime = music.loop && audio.duration ? elapsed % audio.duration : elapsed;
        audio
          .play()
          .then(() => fade(audio, target))
          .catch((err) => console.warn("music failed", err));
      },
      { once: true },
    );
  }, [playing, key, music.url, music.startedAt, music.loop, music.volume]);

  useEffect(() => {
    const c = current.current;
    if (c && c.audio.volume !== music.volume) fade(c.audio, music.volume);
  }, [music.volume]);

  useEffect(
    () => () => {
      current.current?.audio.pause();
      current.current = null;
    },
    [],
  );

  return null;
}
