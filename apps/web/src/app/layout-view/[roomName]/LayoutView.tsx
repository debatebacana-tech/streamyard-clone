"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveKitRoom, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import "@livekit/components-styles";
import { ShowComposition } from "@/components/ShowComposition";

// Inside the stream host: tells it when this version is connected and has
// drawn the show (then it can take over), and listens for "activate".
function ReadySignal({ onActivate }: { onActivate: () => void }) {
  const room = useRoomContext();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ready = () => {
      // A few seconds for the cameras to arrive and the first frames to draw.
      timer ??= setTimeout(() => window.parent?.postMessage({ type: "layout-ready" }, window.location.origin), 5000);
    };
    if (room.metadata) ready();
    room.on(RoomEvent.Connected, ready).on(RoomEvent.RoomMetadataChanged, ready);
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === "layout-activate") onActivate();
    };
    window.addEventListener("message", onMessage);
    return () => {
      if (timer) clearTimeout(timer);
      room.off(RoomEvent.Connected, ready).off(RoomEvent.RoomMetadataChanged, ready);
      window.removeEventListener("message", onMessage);
    };
  }, [room, onActivate]);
  return null;
}

export function LayoutView({
  roomName,
  layoutViewToken,
  standby = false,
  offline = false,
}: {
  roomName: string;
  layoutViewToken: string;
  // A new version warming up behind the live one: silent until activated.
  standby?: boolean;
  // Rendering an offline recording (not a live).
  offline?: boolean;
}) {
  const [active, setActive] = useState(!standby);
  const [credentials, setCredentials] = useState<{ token: string; wsUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layoutViewToken }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Falha ao obter token");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setCredentials({ token: data.token, wsUrl: data.wsUrl });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [layoutViewToken]);

  const activate = useCallback(() => setActive(true), []);

  if (error) {
    return <div className="flex h-screen items-center justify-center bg-black text-red-400">{error}</div>;
  }

  if (!credentials) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">Conectando à sala {roomName}...</div>;
  }

  return (
    <LiveKitRoom
      serverUrl={credentials.wsUrl}
      token={credentials.token}
      connect
      audio={false}
      video={false}
      data-lk-theme="default"
      // Inline on purpose: the LiveKit stylesheet's .lk-room-container height
      // would otherwise beat Tailwind and collapse the canvas to 0px.
      style={{ position: "fixed", inset: 0, background: "#000" }}
    >
      <ShowComposition withAudio={active} media={active ? "play" : "silent"} offline={offline} />
      {standby && <ReadySignal onActivate={activate} />}
    </LiveKitRoom>
  );
}
