"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/scene";
import { useDirector } from "./context";

const input = "rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";
const btn = "rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40";
const btnOn = "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500 disabled:opacity-40";

type Status = { running: boolean; slug: string | null; videoId: string | null; error: string | null; here: boolean };

function ApiKeyForm({ onSaved }: { onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function save() {
    const res = await fetch("/api/settings/youtube-api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) onSaved();
    else setError(data.error ?? "Falha ao salvar");
  }
  return (
    <div className="space-y-3 rounded-md border border-amber-700/50 bg-amber-950/20 p-3 text-sm">
      <p className="font-semibold text-amber-300">Falta a chave da API do YouTube (uma vez só)</p>
      <ol className="list-decimal space-y-1 pl-5 text-neutral-300">
        <li>console.cloud.google.com → crie um projeto</li>
        <li>APIs e serviços → Biblioteca → “YouTube Data API v3” → Ativar</li>
        <li>APIs e serviços → Credenciais → Criar credenciais → Chave de API</li>
      </ol>
      <div className="flex gap-2">
        <input type="password" className={`${input} flex-1`} value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza..." />
        <button className={btn} disabled={!key.trim()} onClick={save}>
          Salvar
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function ChatTab() {
  const { slug, scenes, patch } = useDirector();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const live = scenes.live;

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${slug}/chat`);
    if (!res.ok) return;
    const data = await res.json();
    setStatus(data.status);
    setMessages(data.messages);
  }, [slug]);

  useEffect(() => {
    fetch("/api/settings/youtube-api-key")
      .then((r) => r.json())
      .then((d) => setHasKey(Boolean(d.hasKey)));
    const first = setTimeout(load, 0);
    const id = setInterval(load, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  async function action(body: Record<string, string>) {
    setBusy(true);
    const res = await fetch(`/api/programs/${slug}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (data?.status) {
      setStatus(data.status);
      setMessages(data.messages ?? []);
    }
    setBusy(false);
  }

  const highlight = (m: ChatMessage) =>
    patch({ highlight: { visible: true, author: m.author, text: m.text, avatarUrl: m.avatarUrl } }, { air: true });

  if (hasKey === false) return <ApiKeyForm onSaved={() => setHasKey(true)} />;

  const running = Boolean(status?.running && status.here);
  const elsewhere = Boolean(status?.running && !status.here);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs text-neutral-400">Link da live no YouTube (o da página da live, ou o “Compartilhar” do YouTube Studio)</p>
          <div className="flex gap-2">
            <input className={`${input} min-w-0 flex-1`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/live/..." />
            {running ? (
              <button className={btn} disabled={busy} onClick={() => action({ action: "stop" })}>
                Desconectar
              </button>
            ) : (
              <button className={btnOn} disabled={busy || !url.trim()} onClick={() => action({ action: "start", url })}>
                Conectar chat
              </button>
            )}
          </div>
          <p className={`text-xs ${running ? "text-emerald-400" : status?.error ? "text-red-400" : "text-neutral-500"}`}>
            {running
              ? "● Lendo o chat (atualiza a cada ~8 s)"
              : elsewhere
                ? `O chat está conectado em outro programa (${status?.slug}). Conectar aqui troca.`
                : (status?.error ?? "Desconectado")}
          </p>
        </div>

        <div className="space-y-2 rounded-md bg-neutral-950 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={scenes.draft.chat.visible} onChange={(e) => patch({ chat: { visible: e.target.checked } })} />
            Painel de chat na tela (ao lado das câmeras)
          </label>
          <p className="text-[11px] text-neutral-500">Também entra pelas cenas, como “Todos + chat”.</p>
        </div>

        <div className="space-y-2 rounded-md bg-neutral-950 p-3">
          <p className="text-sm font-semibold">Pergunta destacada</p>
          {live.highlight.visible ? (
            <>
              <p className="text-sm">
                <span className="text-red-400">No ar:</span> <b>{live.highlight.author}</b> — {live.highlight.text}
              </p>
              <button className={btn} onClick={() => patch({ highlight: { visible: false } }, { air: true })}>
                Tirar do ar
              </button>
            </>
          ) : (
            <p className="text-xs text-neutral-500">Clique em “Destacar” numa mensagem: ela entra grande na tela, no lugar do GC.</p>
          )}
        </div>
      </div>

      <div className="flex max-h-[420px] flex-col overflow-hidden rounded-md border border-neutral-800">
        <p className="border-b border-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-400">CHAT AO VIVO</p>
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {messages.length === 0 && <li className="p-3 text-sm text-neutral-500">As mensagens aparecem aqui quando o chat estiver conectado.</li>}
          {[...messages].reverse().map((m) => {
            const on = live.highlight.visible && live.highlight.text === m.text && live.highlight.author === m.author;
            return (
              <li key={m.id} className={`flex items-start gap-2 rounded px-2 py-1.5 ${on ? "bg-red-900/30" : "hover:bg-neutral-800/60"}`}>
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatarUrl} alt="" className="mt-0.5 h-7 w-7 rounded-full" />
                ) : (
                  <span className="mt-0.5 h-7 w-7 rounded-full bg-neutral-700" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <b className="text-neutral-300">{m.author}</b> <span className="text-neutral-100">{m.text}</span>
                </div>
                <button className={on ? btn : btnOn} onClick={() => (on ? patch({ highlight: { visible: false } }, { air: true }) : highlight(m))}>
                  {on ? "Tirar" : "Destacar"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
