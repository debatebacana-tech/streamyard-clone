"use client";

import { useCallback, useEffect, useState } from "react";
import { useDirector } from "./context";
import { ImagePicker } from "./assets";

// "Programar live": signs in to the channel once, then creates the lives on
// YouTube from here (title, date, thumbnail). The studio keeps the stream key
// by itself and "Iniciar transmissão" goes straight into the chosen live.

type Status = { hasClient: boolean; clientId: string; connected: boolean; channel: string | null; redirectUri: string };
type Broadcast = { id: string; title: string; scheduledStart: string | null; privacy: string; status: string; thumbnail: string | null; url: string };

const input = "w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500";
const PRIVACY: Record<string, string> = { public: "Pública", unlisted: "Não listada", private: "Privada" };
const STATUS: Record<string, string> = { ready: "programada", created: "programada", testing: "testando", live: "AO VIVO", complete: "encerrada" };

// Next full half hour, as a datetime-local value in the director's own time zone.
function nextSlot() {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function YoutubeLivePanel() {
  const { slug, branding, assets, addAsset } = useDirector();
  const [status, setStatus] = useState<Status | null>(null);
  const [lives, setLives] = useState<Broadcast[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [client, setClient] = useState({ id: "", secret: "" });
  const [form, setForm] = useState({ title: branding.name, description: "", start: nextSlot(), privacy: "public", thumbnailUrl: null as string | null });

  const load = useCallback(async () => {
    const s = (await fetch("/api/youtube/oauth").then((r) => r.json())) as Status;
    setStatus(s);
    if (!s.connected) return;
    const res = await fetch("/api/youtube/broadcasts");
    const data = await res.json();
    if (!res.ok) return setMsg({ ok: false, text: data.error });
    setLives(data.broadcasts);
    setActiveId(data.activeBroadcastId);
  }, []);

  useEffect(() => {
    // Back from Google's consent screen: ?youtube=ok:<channel> or an error.
    const back = new URLSearchParams(location.search).get("youtube");
    if (back) {
      setTimeout(() => setMsg(back.startsWith("ok:") ? { ok: true, text: `Canal ${back.slice(3)} conectado ✓` } : { ok: false, text: back }), 0);
      history.replaceState(null, "", location.pathname);
    }
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  async function call(method: string, url: string, body?: unknown, okText?: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "Sem conexão" };
    setBusy(false);
    if (!res?.ok) {
      setMsg({ ok: false, text: data.error ?? "Falhou" });
      return null;
    }
    if (okText || data.warning) setMsg({ ok: !data.warning, text: data.warning ?? okText });
    await load();
    return data;
  }

  if (!status) return <p className="text-sm text-neutral-500">Carregando...</p>;
  const note = msg && <p className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-emerald-900/50 text-emerald-200" : "bg-red-900/50 text-red-200"}`}>{msg.text}</p>;

  if (!status.hasClient) {
    return (
      <div className="space-y-3 text-sm">
        {note}
        <p className="text-neutral-300">Configuração de uma vez só (uns 10 minutos), no mesmo projeto do Google Cloud da chave do chat:</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-neutral-400">
          <li>
            <b className="text-neutral-200">APIs e serviços → Tela de consentimento OAuth</b>: tipo <b>Externo</b>, nome “Estúdio Debate Bacana”, seu e-mail. Em
            <b> Público-alvo</b>, clique em <b>Publicar app</b> (assim o acesso não expira em 7 dias).
          </li>
          <li>
            <b className="text-neutral-200">Credenciais → Criar credenciais → ID do cliente OAuth</b> → tipo <b>Aplicativo da Web</b>.
          </li>
          <li>
            Em <b>URIs de redirecionamento autorizados</b>, cole exatamente:
            <code className="mt-1 block rounded bg-black px-2 py-1 text-xs text-[#DFFF00] select-all">{status.redirectUri}</code>
          </li>
          <li>Criar → copie o <b>ID do cliente</b> e a <b>Chave secreta do cliente</b> e cole aqui embaixo.</li>
        </ol>
        <input className={input} placeholder="ID do cliente (termina com .apps.googleusercontent.com)" value={client.id} onChange={(e) => setClient({ ...client, id: e.target.value })} />
        <input className={input} type="password" placeholder="Chave secreta do cliente" value={client.secret} onChange={(e) => setClient({ ...client, secret: e.target.value })} />
        <button
          disabled={busy || !client.id || !client.secret}
          onClick={() => call("POST", "/api/youtube/oauth", { clientId: client.id, clientSecret: client.secret }, "Salvo. Agora conecte o canal.")}
          className="rounded-md bg-[#DFFF00] px-4 py-2 font-bold text-black disabled:opacity-40"
        >
          Salvar
        </button>
      </div>
    );
  }

  if (!status.connected) {
    return (
      <div className="space-y-3 text-sm">
        {note}
        <a href={`/api/youtube/connect?back=${encodeURIComponent(`/diretor/${slug}`)}`} className="inline-block rounded-md bg-red-600 px-4 py-2.5 font-bold hover:bg-red-500">
          ▶ Conectar canal do YouTube
        </a>
        <p className="text-[11px] text-neutral-500">
          Entre com a conta dona do canal e clique em Permitir. Se o Google avisar “app não verificado”, clique em <b>Avançado → Acessar Estúdio Debate Bacana</b> (o app é de vocês).
        </p>
        <button onClick={() => confirm("Trocar o ID do cliente OAuth?") && call("DELETE", "/api/youtube/oauth").then(() => setStatus({ ...status, hasClient: false }))} className="text-xs text-neutral-500 underline">
          trocar ID do cliente
        </button>
      </div>
    );
  }

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "sem data");

  return (
    <div className="space-y-4 text-sm">
      {note}
      <div className="flex items-center justify-between gap-2">
        <span className="text-neutral-300">
          Canal: <b>{status.channel}</b> ✓
        </span>
        <button onClick={() => confirm("Desconectar o canal do YouTube?") && call("DELETE", "/api/youtube/oauth")} className="text-xs text-neutral-500 underline">
          desconectar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <input className={input} placeholder="Título da live" maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className={`${input} h-24`} placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <input type="datetime-local" className={input} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            <select className={input} value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value })}>
              {Object.entries(PRIVACY).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-neutral-400">Miniatura (opcional, JPG/PNG até 2 MB, 1280×720)</span>
          <ImagePicker slug={slug} assets={assets} value={form.thumbnailUrl} onChange={(url) => setForm({ ...form, thumbnailUrl: url })} onUploaded={addAsset} />
        </div>
      </div>
      <button
        disabled={busy || !form.title.trim() || !form.start}
        onClick={() =>
          call(
            "POST",
            "/api/youtube/broadcasts",
            { ...form, start: new Date(form.start).toISOString() },
            "Live programada no YouTube ✓ É só apertar “Iniciar transmissão” na hora: ela entra direto nessa live.",
          )
        }
        className="w-full rounded-md bg-red-600 py-3 text-base font-black hover:bg-red-500 disabled:opacity-40"
      >
        {busy ? "Falando com o YouTube…" : "📅 Programar live no YouTube"}
      </button>

      <div className="space-y-2">
        <p className="text-xs font-bold tracking-widest text-neutral-500">LIVES PROGRAMADAS</p>
        {lives.length === 0 && <p className="text-xs text-neutral-500">Nenhuma live programada no canal.</p>}
        {lives.map((b) => {
          const on = b.id === activeId;
          return (
            <div key={b.id} className={`flex items-center gap-3 rounded-md p-2 ${on ? "bg-red-950/60 ring-1 ring-red-500" : "bg-neutral-900"}`}>
              {b.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{b.title}</p>
                <p className="text-xs text-neutral-400">
                  {when(b.scheduledStart)} · {PRIVACY[b.privacy] ?? b.privacy} · {STATUS[b.status] ?? b.status}
                </p>
              </div>
              {on ? (
                <span className="rounded bg-red-600 px-2 py-1 text-xs font-bold">o estúdio vai para esta</span>
              ) : (
                <button disabled={busy} onClick={() => call("PATCH", "/api/youtube/broadcasts", { id: b.id }, `“${b.title}” escolhida ✓`)} className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600">
                  Usar esta
                </button>
              )}
              <button onClick={() => navigator.clipboard?.writeText(b.url)} className="text-xs text-neutral-400 hover:text-white" title="Copiar o link para divulgar">
                🔗 link
              </button>
              <a href={b.url} target="_blank" rel="noreferrer" className="text-xs text-neutral-400 hover:text-white">
                abrir
              </a>
              <button
                disabled={busy}
                onClick={() => confirm(`Apagar a live “${b.title}” do YouTube?`) && call("DELETE", `/api/youtube/broadcasts?id=${b.id}`)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
