"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/scene";
import { useDirector } from "./context";

// The YouTube chat always in sight, in a column beside the air monitor:
// newest at the bottom, a click puts a message on air (highlight).
export function ChatDock({ onClose }: { onClose: () => void }) {
  const { slug, scenes, patch } = useDirector();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [running, setRunning] = useState<boolean | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const live = scenes.live.highlight;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch(`/api/programs/${slug}/chat`).catch(() => null);
      if (!alive || !res?.ok) return;
      const data = await res.json();
      setRunning(Boolean(data.status?.running && data.status?.here));
      setMessages(data.messages ?? []);
    };
    const first = setTimeout(load, 0);
    const id = setInterval(load, 3000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [slug]);

  // Follow new messages unless the director scrolled up to read.
  const count = messages.length;
  useEffect(() => {
    const el = list.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <div className="studio-bar flex w-72 shrink-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-bold tracking-widest">CHAT DO YOUTUBE</span>
        <span className="flex items-center gap-2">
          <span className={`text-[10px] ${running ? "text-emerald-400" : "text-neutral-500"}`}>{running ? "● ao vivo" : running === null ? "" : "desconectado"}</span>
          <button onClick={onClose} className="text-xs text-neutral-500 hover:text-white" title="Esconder o chat">
            ✕
          </button>
        </span>
      </div>
      {live.visible && (
        <button
          onClick={() => patch({ highlight: { visible: false } }, { air: true })}
          className="border-b border-red-500/40 bg-red-950/50 px-3 py-1.5 text-left text-[11px] text-red-200 hover:bg-red-900/50"
          title="Tirar a mensagem do ar"
        >
          No ar: <b>{live.author}</b> — clique para tirar
        </button>
      )}
      <div ref={list} className="flex-1 space-y-1 overflow-y-auto p-2" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <p className="p-2 text-xs text-neutral-500">{running ? "Nenhuma mensagem ainda." : "Conecte o chat na aba Chat (cole o link da live)."}</p>
        )}
        {messages.map((m) => {
          const on = live.visible && live.text === m.text && live.author === m.author;
          return (
            <button
              key={m.id}
              onClick={() => (on ? patch({ highlight: { visible: false } }, { air: true }) : patch({ highlight: { visible: true, author: m.author, text: m.text, avatarUrl: m.avatarUrl } }, { air: true }))}
              className={`flex w-full items-start gap-2 rounded-md p-1.5 text-left text-sm ${on ? "bg-red-900/60 ring-1 ring-red-500" : "hover:bg-white/5"}`}
              title={on ? "No ar — clique para tirar" : "Clique para destacar no ar"}
            >
              {m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatarUrl} alt="" className="mt-0.5 h-6 w-6 shrink-0 rounded-full" />
              ) : (
                <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-neutral-700" />
              )}
              <span className="min-w-0 leading-snug">
                <b className="block truncate text-[11px] text-[#DFFF00]">{m.author}</b>
                <span className="break-words text-neutral-200">{m.text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
