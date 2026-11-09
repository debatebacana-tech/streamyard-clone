"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataChannel } from "@livekit/components-react";

// Sound pads and video stingers ("vinhetas"). The director broadcasts a cue
// over the room's data channel; the layout-view page (what Egress records)
// plays it, which puts it in the stream. LiveKit doesn't echo a sender's own
// data back, so the director's own monitors get it through a local bus.

export const MEDIA_TOPIC = "media";

export type MediaCue =
  | { type: "play"; id: string; url: string; kind: "audio" | "video"; volume: number }
  | { type: "stop" };

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
export function MediaLayer({ silent = false }: { silent?: boolean }) {
  const [video, setVideo] = useState<Extract<MediaCue, { type: "play" }> | null>(null);
  const audios = useRef(new Set<HTMLAudioElement>());

  const handle = useCallback(
    (cue: MediaCue) => {
      if (cue.type === "stop") {
        audios.current.forEach((a) => a.pause());
        audios.current.clear();
        setVideo(null);
        return;
      }
      if (cue.kind === "video") {
        setVideo(cue);
        return;
      }
      if (silent) return;
      const audio = new Audio(cue.url);
      audio.volume = Math.min(1, Math.max(0, cue.volume));
      audios.current.add(audio);
      audio.addEventListener("ended", () => audios.current.delete(audio));
      audio.play().catch((err) => console.warn("audio cue failed", err));
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
    const playing = audios.current;
    return () => playing.forEach((a) => a.pause());
  }, []);

  if (!video) return null;
  return (
    <video
      key={video.id + video.url}
      src={video.url}
      autoPlay
      muted={silent}
      playsInline
      onEnded={() => setVideo(null)}
      onError={() => setVideo(null)}
      ref={(el) => {
        if (el) el.volume = Math.min(1, Math.max(0, video.volume));
      }}
      className="absolute inset-0 z-50 h-full w-full bg-black object-cover"
    />
  );
}
