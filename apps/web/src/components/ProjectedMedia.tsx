"use client";

import { useEffect, useRef } from "react";
import { mediaElapsedMs, type ProjectedMedia } from "@/lib/scene";

// A projected video that every output plays at the same point: it seeks to
// the server-time position when it loads, when the director pauses/resumes
// or restarts, and corrects drift every few seconds.
function SyncedVideo({ media, withSound, fit }: { media: ProjectedMedia; withSound: boolean; fit: "contain" | "cover" }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      const target = mediaElapsedMs(media, Date.now()) / 1000;
      const duration = el.duration;
      const known = Number.isFinite(duration) && duration > 0;
      if (known && !media.loop && target >= duration) {
        el.pause();
        return;
      }
      const t = known && media.loop ? target % duration : target;
      if (Math.abs(el.currentTime - t) > 0.6) el.currentTime = t;
      if (media.pausedAt) el.pause();
      else if (el.paused)
        el.play().catch(() => {
          // A monitor tab may refuse autoplay with sound: keep it going muted.
          el.muted = true;
          el.play().catch(() => {});
        });
    };
    sync();
    el.addEventListener("loadedmetadata", sync);
    const id = setInterval(sync, 4000);
    return () => {
      clearInterval(id);
      el.removeEventListener("loadedmetadata", sync);
    };
  }, [media]);

  useEffect(() => {
    if (ref.current) ref.current.volume = media.volume;
  }, [media.volume]);

  return (
    <video
      ref={ref}
      src={media.url!}
      playsInline
      preload="auto"
      loop={media.loop}
      muted={!withSound}
      className={`h-full w-full bg-black ${fit === "cover" ? "object-cover" : "object-contain"}`}
    />
  );
}

export function ProjectedMediaView({ media, withSound, fit = "contain" }: { media: ProjectedMedia; withSound: boolean; fit?: "contain" | "cover" }) {
  if (!media.url) return null;
  return media.kind === "video" ? (
    <SyncedVideo key={media.url} media={media} withSound={withSound} fit={fit} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt="" className={`h-full w-full bg-black ${fit === "cover" ? "object-cover" : "object-contain"}`} />
  );
}
