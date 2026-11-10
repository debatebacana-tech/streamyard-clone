"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataChannel } from "@livekit/components-react";
import { AUDIO_BLOCKED } from "./MusicLayer";

// Sound pads and video stingers ("vinhetas"). The director broadcasts a cue
// over the room's data channel; the layout-view page (what Egress records)
// plays it, which puts it in the stream. LiveKit doesn't echo a sender's own
// data back, so the director's own monitors get it through a local bus.

export const MEDIA_TOPIC = "media";

// toggle: pressing a pad again while its sound is playing stops it.
export type MediaCue =
  | { type: "play"; id: string; url: string; kind: "audio" | "video"; volume: number; toggle?: boolean }
  | { type: "stop" };

// Quick sounds stay in memory: each file is downloaded once into a local
// blob and kept in its own audio element, so a pad plays the instant it's
// pressed instead of fetching and buffering first.
const pool = new Map<string, HTMLAudioElement>();
const loading = new Map<string, Promise<void>>();

function warm(url: string): Promise<void> {
  let job = loading.get(url);
  if (!job) {
    job = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        const el = new Audio(URL.createObjectURL(blob));
        el.preload = "auto";
        el.load();
        pool.set(url, el);
      })
      .catch(() => {
        loading.delete(url);
      });
    loading.set(url, job);
  }
  return job;
}

// The in-memory element when ready; otherwise stream it this once (and
// keep loading it for the next press).
const fallback = new Map<string, HTMLAudioElement>();
function audioFor(url: string): HTMLAudioElement {
  const ready = pool.get(url);
  if (ready) return ready;
  void warm(url);
  let el = fallback.get(url);
  if (!el) {
    el = new Audio(url);
    fallback.set(url, el);
  }
  return el;
}

// Stinger videos (opening, effect videos) are downloaded ahead too, so they
// start at once and never stall mid-way (the opening used to catch near its end).
const videoBlobs = new Map<string, string>();
const videoLoading = new Set<string>();
function warmVideo(url: string) {
  if (videoBlobs.has(url) || videoLoading.has(url)) return;
  videoLoading.add(url);
  fetch(url)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((b) => videoBlobs.set(url, URL.createObjectURL(b)))
    .catch(() => {})
    .finally(() => videoLoading.delete(url));
}

export function preloadSounds(urls: string[]) {
  if (typeof window === "undefined") return;
  for (const url of urls) {
    if (!url.startsWith("/media/")) continue;
    if (/\.(mp4|webm)$/i.test(url)) warmVideo(url);
    else void warm(url);
  }
}

const localBus = typeof window !== "undefined" ? new EventTarget() : null;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function useMediaCues() {
  const { send } = useDataChannel(MEDIA_TOPIC);
  return useCallback(
    (cue: MediaCue) => {
      localBus?.dispatchEvent(new CustomEvent<MediaCue>("cue", { detail: cue }));
      return send(encoder.encode(JSON.stringify(cue)), { reliable: true });
    },
    [send],
  );
}

function parseCue(payload: Uint8Array): MediaCue | null {
  try {
    const cue = JSON.parse(decoder.decode(payload)) as MediaCue;
    if (cue.type === "stop") return cue;
    if (cue.type === "play" && typeof cue.url === "string" && cue.url.startsWith("/media/")) return cue;
  } catch {}
  return null;
}

// Renders inside the composition canvas. `silent` shows stingers without
// playing sound (preview monitors).
// `step` is the on-air rundown step: leaving the abertura (the director pressed
// "Programa") cuts the opening video right there, under the transition, instead
// of letting its long tail play out.
export function MediaLayer({ silent = false, preload = [], step }: { silent?: boolean; preload?: string[]; step?: string }) {
  // inOpening: the video was on screen during the abertura step.
  const [video, setVideo] = useState<(Extract<MediaCue, { type: "play" }> & { inOpening?: boolean }) | null>(null);
  const playing = useRef(new Map<string, HTMLAudioElement>());

  const preloadKey = preload.join("|");
  useEffect(() => {
    if (preloadKey) preloadSounds(preloadKey.split("|"));
  }, [preloadKey]);

  const handle = useCallback(
    (cue: MediaCue) => {
      if (cue.type === "stop") {
        playing.current.forEach((a) => {
          a.pause();
          a.currentTime = 0;
        });
        playing.current.clear();
        setVideo(null);
        return;
      }
      if (cue.kind === "video") {
        setVideo((current) => (cue.toggle && current?.url === cue.url ? null : cue));
        return;
      }
      if (silent) return;
      // Second press while it plays: stop it.
      const current = playing.current.get(cue.url);
      if (cue.toggle && current && !current.paused) {
        current.pause();
        current.currentTime = 0;
        playing.current.delete(cue.url);
        return;
      }
      const audio = audioFor(cue.url);
      audio.volume = Math.min(1, Math.max(0, cue.volume));
      audio.currentTime = 0;
      playing.current.set(cue.url, audio);
      audio.onended = () => {
        if (playing.current.get(cue.url) === audio) playing.current.delete(cue.url);
      };
      audio.play().catch((err: DOMException) => {
        // Sound blocked until the page is clicked: the monitor offers "Ativar som".
        if (err?.name === "NotAllowedError") window.dispatchEvent(new Event(AUDIO_BLOCKED));
        else console.warn("audio cue failed", err);
      });
    },
    [silent],
  );

  useDataChannel(MEDIA_TOPIC, (msg) => {
    const cue = parseCue(msg.payload);
    if (cue) handle(cue);
  });

  useEffect(() => {
    if (!localBus) return;
    const listener = (e: Event) => handle((e as CustomEvent<MediaCue>).detail);
    localBus.addEventListener("cue", listener);
    return () => localBus.removeEventListener("cue", listener);
  }, [handle]);

  useEffect(() => {
    const current = playing.current;
    return () => current.forEach((a) => a.pause());
  }, []);

  // A video playing during the abertura (the opening, cued a moment before the
  // step switches) goes away as soon as the show leaves the abertura.
  if (video && step === "abertura" && !video.inOpening) setVideo({ ...video, inOpening: true });
  const cutShort = Boolean(video?.inOpening && step !== "abertura");
  if (cutShort) setVideo(null);
  if (!video || cutShort) return null;
  return (
    <video
      key={video.id + video.url}
      src={videoBlobs.get(video.url) ?? video.url}
      autoPlay
      muted={silent}
      playsInline
      onEnded={() => setVideo(null)}
      onError={() => setVideo(null)}
      ref={(el) => {
        if (!el) return;
        el.volume = Math.min(1, Math.max(0, video.volume));
        // Sound blocked until a click: show the stinger muted instead of skipping it.
        el.play().catch((err: DOMException) => {
          if (err?.name !== "NotAllowedError") return;
          el.muted = true;
          el.play().catch(() => {});
          if (!silent) window.dispatchEvent(new Event(AUDIO_BLOCKED));
        });
      }}
      className="absolute inset-0 z-50 h-full w-full bg-black object-cover"
    />
  );
}
