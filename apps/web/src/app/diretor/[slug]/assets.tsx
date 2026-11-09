"use client";

import { useRef, useState } from "react";

export type AssetItem = {
  id: string;
  kind: "image" | "audio" | "video";
  // "trilha" (background track) or "efeito" (sound pad / stinger).
  role: string;
  name: string;
  url: string;
  size: number;
};

export async function uploadAsset(slug: string, file: File, role?: "trilha" | "efeito" | "arte" | "midia"): Promise<AssetItem> {
  const form = new FormData();
  form.append("file", file);
  if (role) form.append("role", role);
  form.append("name", file.name.replace(/\.[^.]+$/, ""));
  const res = await fetch(`/api/programs/${slug}/assets`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falha no envio");
  return data.asset;
}

export function UploadButton({
  slug,
  accept,
  label = "Enviar arquivo",
  role,
  onUploaded,
}: {
  slug: string;
  accept: string;
  label?: string;
  role?: "trilha" | "efeito" | "arte" | "midia";
  onUploaded: (asset: AssetItem) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) onUploaded(await uploadAsset(slug, file, role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no envio");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className="inline-flex flex-col">
      <input ref={input} type="file" accept={accept} multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="rounded-md border border-dashed border-neutral-600 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-400 disabled:opacity-50"
      >
        {busy ? "Enviando..." : `＋ ${label}`}
      </button>
      {error && <span className="mt-1 text-xs text-red-400">{error}</span>}
    </span>
  );
}

// Choose an uploaded image (or none) for a slot like logo, crest or sponsor.
export function ImagePicker({
  slug,
  assets,
  value,
  onChange,
  onUploaded,
}: {
  slug: string;
  assets: AssetItem[];
  value: string | null;
  onChange: (url: string | null) => void;
  onUploaded: (asset: AssetItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const images = assets.filter((a) => a.kind === "image");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-12 w-16 items-center justify-center overflow-hidden rounded border border-neutral-700 bg-neutral-800"
          title="Escolher imagem"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-neutral-500">nenhuma</span>
          )}
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-neutral-400 hover:text-neutral-200">
          {open ? "fechar" : "trocar"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="text-xs text-neutral-500 hover:text-red-400">
            remover
          </button>
        )}
      </div>
      {open && (
        <div className="rounded-md border border-neutral-800 bg-neutral-950 p-2">
          <div className="grid max-h-40 grid-cols-5 gap-2 overflow-y-auto">
            {images.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.name}
                onClick={() => {
                  onChange(a.url);
                  setOpen(false);
                }}
                className={`flex h-12 items-center justify-center overflow-hidden rounded border bg-neutral-800 ${
                  value === a.url ? "border-red-500" : "border-neutral-700 hover:border-neutral-500"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
          <div className="mt-2">
            <UploadButton
              slug={slug}
              accept="image/png,image/jpeg,image/webp,image/gif"
              label="Enviar imagem"
              onUploaded={(asset) => {
                onUploaded(asset);
                onChange(asset.url);
                setOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
