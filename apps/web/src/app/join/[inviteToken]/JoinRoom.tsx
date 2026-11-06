"use client";

import { useState } from "react";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

function RoomView() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex-1 overflow-hidden rounded-lg bg-black">
        <GridLayout tracks={tracks} className="h-full w-full">
          <ParticipantTile />
        </GridLayout>
        <RoomAudioRenderer />
      </div>
      <ControlBar controls={{ microphone: true, camera: true, screenShare: false, leave: true }} />
    </div>
  );
}

export function JoinRoom({ inviteToken }: { inviteToken: string }) {
  const [name, setName] = useState("");
  const [credentials, setCredentials] = useState<{ token: string; wsUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteToken, name: name.trim() || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível entrar");
      return;
    }
    setCredentials({ token: data.token, wsUrl: data.wsUrl });
  }

  if (credentials) {
    return (
      <LiveKitRoom
        serverUrl={credentials.wsUrl}
        token={credentials.token}
        connect
        audio
        video
        data-lk-theme="default"
        className="flex flex-1 flex-col"
      >
        <RoomView />
      </LiveKitRoom>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-8">
        <h1 className="text-xl font-semibold">Entrar no programa</h1>
        <input
          autoFocus
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={join}
          disabled={loading}
          className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </main>
  );
}
