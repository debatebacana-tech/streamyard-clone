"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";
import { ShowComposition } from "@/components/ShowComposition";

export function LayoutView({
  roomName,
  layoutViewToken,
}: {
  roomName: string;
  layoutViewToken: string;
}) {
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
      <ShowComposition withAudio media="play" />
    </LiveKitRoom>
  );
}
