"use client";

import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/lib/scene";

const FADE_MS = 1200;

// One fade at a time per element: a new fade cancels the running one, so
// volume changes never fight each other (that made the track pump).
const fades = new WeakMap<HTMLAudioElement, number>();
function fade(audio: HTMLAudioElement, to: number, done?: () => void) {
  const running = fades.get(audio);
  if (running) cancelAnimationFrame(running);
  const from = audio.volume;
  const start = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / FADE_MS);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) fades.set(audio, requestAnimationFrame(step));
    else {
      fades.delete(audio);
      done?.();
    }
  };
  fades.set(audio, requestAnimationFrame(step));
}

// The whole track is downloaded before it plays (a local copy), so a busy
// server or a slow link can't make it stutter mid-song.
const local = new Map<string, Promise<string>>();
function localCopy(url: string): Promise<string> {
  let job = local.get(url);
  if (!job) {
    job = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => URL.createObjectURL(b))
      .catch(() => {
        local.delete(url);
        return url;
      });
    local.set(url, job);
  }
  return job;
}

// Browsers block sound until the page is clicked; the air monitor shows a
// button then (see AudioUnlock) and playback retries on that click.
export const AUDIO_BLOCKED = "studio-audio-blocked";
export const AUDIO_UNLOCK = "studio-audio-unlock";

function play(audio: HTMLAudioElement, onPlaying: () => void) {
  audio
    .play()
    .then(onPlaying)
    .catch((err: DOMException) => {
      if (err?.name !== "NotAllowedError") return console.warn("music failed", err);
      window.dispatchEvent(new Event(AUDIO_BLOCKED));
      const retry = () => audio.play().then(onPlaying).catch(() => {});
      window.addEventListener(AUDIO_UNLOCK, retry, { once: true });
    });
}

// Background track. Position comes from the server's startedAt, so the
// Egress output and the director's monitor play in step and a late joiner
// starts mid-track; starts, stops and volume changes fade.
export function MusicLayer({ music }: { music: Scene["music"] }) {
  const current = useRef<{ audio: HTMLAudioElement; key: string } | null>(null);
  const playing = Boolean(music.url && music.startedAt);
  const key = `${music.url}|${music.startedAt}|${music.loop}`;
  const volume = useRef(music.volume);

  useEffect(() => {
    const old = current.current;
    if (old && (!playing || old.key !== key)) {
      fade(old.audio, 0, () => old.audio.pause());
      current.current = null;
    }
    if (!playing || current.current) return;

    const audio = new Audio();
    audio.loop = music.loop;
    audio.volume = 0;
    current.current = { audio, key };
    const startedAt = music.startedAt!;
    const loop = music.loop;
    localCopy(music.url!).then((src) => {
      if (current.current?.audio !== audio) return;
      audio.src = src;
      audio.addEventListener(
        "loadedmetadata",
        () => {
          // Position at the moment it actually starts (the download took time).
          const elapsed = Math.max(0, (Date.now() - startedAt) / 1000);
          if (!loop && elapsed >= audio.duration) return;
          audio.currentTime = loop && audio.duration ? elapsed % audio.duration : elapsed;
          play(audio, () => fade(audio, volume.current));
        },
        { once: true },
      );
    });
  }, [playing, key, music.url, music.startedAt, music.loop]);

  useEffect(() => {
    volume.current = music.volume;
    const c = current.current;
    if (c && !c.audio.paused) fade(c.audio, music.volume);
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

// "Ativar som" over the air monitor when the browser blocked the sound.
export function AudioUnlock() {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const on = () => setBlocked(true);
    window.addEventListener(AUDIO_BLOCKED, on);
    return () => window.removeEventListener(AUDIO_BLOCKED, on);
  }, []);
  if (!blocked) return null;
  return (
    <button
      onClick={() => {
        setBlocked(false);
        window.dispatchEvent(new Event(AUDIO_UNLOCK));
      }}
      className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 text-2xl font-black text-white"
    >
      <span className="rounded-xl bg-[#aedf02] px-6 py-3 text-black shadow-2xl">🔊 Ativar som do monitor</span>
    </button>
  );
}
