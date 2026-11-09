"use client";

import { useEffect, useState } from "react";

type Status = {
  configured: boolean;
  state: string | null;
  exitNode: { name: string; online: boolean } | null;
  candidates: string[];
};

function describe(s: Status | null): { text: string; tone: "ok" | "warn" | "off" } {
  if (!s) return { text: "verificando...", tone: "off" };
  if (!s.configured) return { text: "não configurado", tone: "off" };
  if (s.state !== "Running") return { text: `servidor conectando ao Tailscale (${s.state ?? "iniciando"})...`, tone: "warn" };
  if (!s.exitNode) {
    return {
      text: s.candidates.length
        ? `aguardando usar ${s.candidates.join(", ")} como saída...`
        : "servidor conectado, mas nenhum computador está liberado como saída (passos 2 e 3)",
      tone: "warn",
    };
  }
  return s.exitNode.online
    ? { text: `funcionando: saindo por ${s.exitNode.name}`, tone: "ok" }
    : { text: `${s.exitNode.name} está desligado ou sem internet`, tone: "warn" };
}

export function TunnelSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/settings/tunnel")
        .then((r) => r.json())
        .then((d) => alive && setStatus(d))
        .catch(() => {});
    const first = setTimeout(load, 0);
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  async function save(authKey: string | null) {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/settings/tunnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authKey }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Falha ao salvar");
    setStatus(data);
    setKey("");
  }

  const d = describe(status);
  const color = d.tone === "ok" ? "text-emerald-400" : d.tone === "warn" ? "text-amber-400" : "text-neutral-400";

  return (
    <div className="space-y-4 text-sm">
      <p className="text-neutral-400">
        O Sofascore bloqueia o servidor da live. Com isto, só os acessos ao Sofascore passam pelo computador de casa
        (que ele aceita); o resto da transmissão continua saindo direto do servidor. O computador precisa estar
        ligado e com internet durante a live.
      </p>
      <p>
        Status: <span className={color}>{d.text}</span>
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-neutral-300">
        <li>
          No computador Windows de casa, instale o <b>Tailscale</b> (tailscale.com/download/windows) e entre com uma
          conta Google.
        </li>
        <li>
          No ícone do Tailscale perto do relógio: <b>Exit node → Run exit node</b> (ou &quot;Executar nó de
          saída&quot;).
        </li>
        <li>
          No site login.tailscale.com, aba <b>Machines</b>: nos três pontinhos desse computador, <b>Edit route
          settings</b> → marque <b>Use as exit node</b> → Save.
        </li>
        <li>
          Ainda no site: <b>Settings → Keys → Generate auth key</b> (pode deixar as opções como estão) → copie a chave
          e cole abaixo.
        </li>
        <li>
          No Windows, em Energia, deixe o computador <b>sem suspender</b> durante as lives.
        </li>
      </ol>
      <div className="flex max-w-xl gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={status?.configured ? "Colar uma nova chave para substituir" : "tskey-auth-..."}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2"
        />
        <button
          onClick={() => save(key)}
          disabled={saving || !key.trim()}
          className="rounded-md bg-neutral-700 px-4 py-2 hover:bg-neutral-600 disabled:opacity-50"
        >
          Salvar
        </button>
        {status?.configured && (
          <button
            onClick={() => confirm("Desligar o campinho via computador de casa?") && save(null)}
            className="rounded-md px-3 py-2 text-neutral-500 hover:text-red-400"
          >
            Desligar
          </button>
        )}
      </div>
      {error && <p className="text-red-400">{error}</p>}
    </div>
  );
}
