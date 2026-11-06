"use client";

import { useEffect, useState } from "react";
import {
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useRoomInfo,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

type ShowMetadata = {
  lowerThirdText?: string;
  logoUrl?: string;
};

function parseMetadata(raw: string | undefined): ShowMetadata {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ShowMetadata;
  } catch {
    return {};
  }
}

function Composition() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  const { metadata } = useRoomInfo();
  const { lowerThirdText, logoUrl } = parseMetadata(metadata);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <GridLayout tracks={tracks} className="h-full w-full">
        <ParticipantTile />
      </GridLayout>
      <RoomAudioRenderer />

      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="absolute top-6 left-6 h-16 w-auto drop-shadow-lg" />
      )}

      {lowerThirdText && (
        <div className="absolute bottom-10 left-10 right-10 rounded-md bg-black/70 px-6 py-3">
          <p className="text-2xl font-semibold text-white">{lowerThirdText}</p>
        </div>
      )}
    </div>
  );
}

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
      className="h-screen w-screen"
    >
      <Composition />
    </LiveKitRoom>
  );
}
