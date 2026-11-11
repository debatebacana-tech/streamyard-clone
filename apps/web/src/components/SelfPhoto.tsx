"use client";

import { useEffect, useRef, useState } from "react";

// "Minha foto": each person sends their own photo (e.g. their caricature),
// shown filling their window on air while their camera is off.
export function SelfPhoto({ name, inviteToken, slug }: { name: string; inviteToken?: string; slug?: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const auth: Record<string, string> = inviteToken ? { inviteToken } : { slug: slug ?? "" };

  useEffect(() => {
    if (!name.trim()) return;
    const q = new URLSearchParams({ name, ...auth });
    fetch(`/api/self-photo?${q}`)
      .then((r) => r.json())
      .then((d) => setPhoto(d.photo ?? null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, inviteToken, slug]);

  async function send(file: File | null) {
    setBusy(true);
    setMsg(null);
    const form = new FormData();
    form.append("name", name);
    for (const [k, v] of Object.entries(auth)) form.append(k, v);
    if (file) form.append("file", file);
    const res = await fetch("/api/self-photo", { method: "POST", body: form }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "Sem conexão" };
    setBusy(false);
    if (!res?.ok) return setMsg(data.error ?? "Falhou");
    setPhoto(data.photo ?? null);
    setMsg(file ? "Pronto! Com a câmera desligada, aparece a sua foto." : "Foto removida");
  }

  return (
    <div className="flex items-center gap-3 rounded-lg bg-neutral-900 px-3 py-2 text-sm">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-12 w-12 rounded-md object-cover" />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-md bg-neutral-800 text-xl">🙂</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Minha foto com a câmera desligada</p>
        <p className="text-xs text-neutral-400">{msg ?? "Ex.: sua caricatura. Ela preenche a sua janela no ar quando a câmera estiver fechada."}</p>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => send(e.target.files?.[0] ?? null)} />
      <button disabled={busy || !name.trim()} onClick={() => input.current?.click()} className="rounded-md bg-[#DFFF00] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40">
        {busy ? "Enviando…" : photo ? "Trocar" : "Enviar foto"}
      </button>
      {photo && (
        <button disabled={busy} onClick={() => send(null)} className="text-xs text-neutral-500 underline">
          remover
        </button>
      )}
    </div>
  );
}
