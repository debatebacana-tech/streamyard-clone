"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

function Preview() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  return (
    <div className="h-[55vh] w-full overflow-hidden rounded-lg bg-black">
      <GridLayout tracks={tracks} className="h-full w-full">
        <ParticipantTile />
      </GridLayout>
      <RoomAudioRenderer />
    </div>
  );
}

function GuestList() {
  const participants = useParticipants();
  const guests = participants.filter((p) => p.identity.startsWith("guest-"));

  async function removeGuest(identity: string) {
    await fetch("/api/room/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "removeParticipant", identity }),
    });
  }

  if (guests.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum convidado na sala ainda.</p>;
  }

  return (
    <ul className="space-y-2">
      {guests.map((g) => (
        <li key={g.identity} className="flex items-center justify-between rounded-md bg-neutral-800 px-3 py-2 text-sm">
          <span>{g.name || g.identity}</span>
          <button
            onClick={() => removeGuest(g.identity)}
            className="rounded bg-red-700/60 px-2 py-1 text-xs hover:bg-red-700"
          >
            Remover
          </button>
        </li>
      ))}
    </ul>
  );
}

function InviteLinkPanel() {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    const res = await fetch("/api/invite", { method: "POST" });
    const data = await res.json();
    setLink(data.link);
    setCopied(false);
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="space-y-2">
      <button onClick={generate} className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600">
        Gerar link de convite
      </button>
      {link && (
        <div className="flex items-center gap-2">
          <input readOnly value={link} className="flex-1 truncate rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1 text-xs" />
          <button onClick={copy} className="rounded-md bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600">
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}

function YoutubeKeyPanel() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [streamKey, setStreamKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/youtube-key")
      .then((r) => r.json())
      .then((d) => setHasKey(Boolean(d.hasKey)));
  }, []);

  async function save() {
    if (!streamKey.trim()) return;
    setSaving(true);
    await fetch("/api/settings/youtube-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamKey: streamKey.trim() }),
    });
    setStreamKey("");
    setSaving(false);
    setHasKey(true);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-400">
        Chave de transmissão do YouTube:{" "}
        {hasKey === null ? "verificando..." : hasKey ? "configurada ✓" : "não configurada"}
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          placeholder="Cole a chave de transmissão"
          value={streamKey}
          onChange={(e) => setStreamKey(e.target.value)}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
        />
        <button onClick={save} disabled={saving} className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-50">
          Salvar
        </button>
      </div>
    </div>
  );
}

function LowerThirdPanel() {
  const [text, setText] = useState("");

  async function apply() {
    await fetch("/api/room/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setMetadata", metadata: { lowerThirdText: text } }),
    });
  }

  return (
    <div className="flex gap-2">
      <input
        placeholder="Texto do rodapé (ex: nome e cargo)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm"
      />
      <button onClick={apply} className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600">
        Aplicar
      </button>
    </div>
  );
}

function GoLivePanel() {
  const [live, setLive] = useState(false);
  const [egressId, setEgressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goLive() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/egress/start", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha ao iniciar");
      return;
    }
    setEgressId(data.egressId);
    setLive(true);
  }

  async function endStream() {
    setLoading(true);
    await fetch("/api/egress/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ egressId }),
    });
    setLoading(false);
    setLive(false);
    setEgressId(null);
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {live ? (
        <button
          onClick={endStream}
          disabled={loading}
          className="w-full rounded-md bg-neutral-700 px-4 py-2 font-medium hover:bg-neutral-600 disabled:opacity-50"
        >
          {loading ? "Encerrando..." : "Encerrar transmissão"}
        </button>
      ) : (
        <button
          onClick={goLive}
          disabled={loading}
          className="w-full rounded-md bg-red-600 px-4 py-2 font-medium hover:bg-red-500 disabled:opacity-50"
        >
          {loading ? "Iniciando..." : "Ir ao vivo no YouTube"}
        </button>
      )}
    </div>
  );
}

export function Studio() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<{ token: string; wsUrl: string } | null>(null);

  useEffect(() => {
    fetch("/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Host" }),
    })
      .then((r) => r.json())
      .then((d) => setCredentials({ token: d.token, wsUrl: d.wsUrl }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (!credentials) {
    return <div className="flex flex-1 items-center justify-center">Conectando...</div>;
  }

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
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Estúdio</h1>
          <button onClick={logout} className="text-sm text-neutral-400 hover:text-neutral-200">
            Sair
          </button>
        </div>

        <Preview />
        <ControlBar controls={{ microphone: true, camera: true, screenShare: true, leave: false }} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="space-y-3 rounded-lg border border-neutral-800 p-4">
            <h2 className="font-medium">Transmissão</h2>
            <YoutubeKeyPanel />
            <GoLivePanel />
          </section>

          <section className="space-y-3 rounded-lg border border-neutral-800 p-4">
            <h2 className="font-medium">Overlay</h2>
            <LowerThirdPanel />
          </section>

          <section className="space-y-3 rounded-lg border border-neutral-800 p-4">
            <h2 className="font-medium">Convidados</h2>
            <InviteLinkPanel />
            <GuestList />
          </section>
        </div>
      </div>
    </LiveKitRoom>
  );
}
