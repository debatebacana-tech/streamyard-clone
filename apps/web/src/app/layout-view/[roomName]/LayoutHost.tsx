"use client";

import { useEffect, useRef, useState } from "react";

// What the Egress browser (the YouTube output) loads. It shows the
// composition in a frame and, when the site is updated, loads the new version
// in a second, silent frame behind it; once that one is connected and drawn,
// it takes over and the old one closes. The live never needs a restart to
// get updates, and viewers don't see a black screen.

type Frame = { key: number; src: string; active: boolean };

const CHECK_MS = 20_000;
const READY_TIMEOUT_MS = 60_000;

export function LayoutHost({ roomName, token }: { roomName: string; token: string }) {
  const base = `/layout-view/${encodeURIComponent(roomName)}/frame?token=${encodeURIComponent(token)}`;
  const [frames, setFrames] = useState<Frame[]>([{ key: 0, src: base, active: true }]);
  const version = useRef<string | null>(null);
  const swapping = useRef(false);
  const refs = useRef(new Map<number, HTMLIFrameElement>());

  // Watch for a new deploy.
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version: v } = (await res.json()) as { version: string };
        if (version.current === null) version.current = v;
        else if (v !== version.current && !swapping.current && !stop) {
          version.current = v;
          swapping.current = true;
          const key = Date.now();
          setFrames((list) => [...list, { key, src: `${base}&standby=1&v=${key}`, active: false }]);
          // Give up on a version that never gets ready (the old one stays).
          setTimeout(() => {
            if (!swapping.current) return;
            swapping.current = false;
            setFrames((list) => list.filter((f) => f.active));
          }, READY_TIMEOUT_MS);
        }
      } catch {}
    };
    check();
    const id = setInterval(check, CHECK_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [base]);

  // The standby frame says when it's connected and drawn: switch to it.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "layout-ready") return;
      setFrames((list) => {
        const next = list.find((f) => !f.active && refs.current.get(f.key)?.contentWindow === e.source);
        if (!next) return list;
        refs.current.get(next.key)?.contentWindow?.postMessage({ type: "layout-activate" }, window.location.origin);
        swapping.current = false;
        return [{ ...next, active: true }];
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {frames.map((f) => (
        <iframe
          key={f.key}
          ref={(el) => {
            if (el) refs.current.set(f.key, el);
            else refs.current.delete(f.key);
          }}
          src={f.src}
          title="layout"
          allow="autoplay"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
            // The warming-up version sits underneath, invisible.
            opacity: f.active ? 1 : 0,
            zIndex: f.active ? 2 : 1,
          }}
        />
      ))}
    </div>
  );
}
