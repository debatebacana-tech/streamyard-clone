"use client";

import { useRef, useState } from "react";
import { COMPETITIONS } from "@/lib/competitions";
import { DEFAULT_TIERS, type BoardGroup, type Tier, type TierItem, type TierList } from "@/lib/scene";
import { uploadAsset } from "./assets";
import { useDirector } from "./context";

// Tier list builder: create the items (photo and/or text: players, people,
// topics, anything), then click an item and a tier to rank it live.

const input = "rounded-md border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm outline-none focus:border-neutral-500";
const btn = "rounded-md bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600 disabled:opacity-40";
const btnOn = "rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-500 disabled:opacity-40";
const small = "rounded px-2 py-1 text-xs";

const newId = () => crypto.randomUUID().slice(0, 8);

function Chip({ item, selected, onClick }: { item: TierItem; selected: boolean; onClick: () => void }) {
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
      onClick={(e) => {
        // Don't let the click reach the tier row (which places the selection).
        e.stopPropagation();
        onClick();
      }}
      title={item.label}
      className={`flex h-14 shrink-0 items-center gap-1.5 rounded-md border-2 px-1.5 text-xs ${
        selected ? "border-[#DFFF00] bg-neutral-700" : "border-transparent bg-neutral-800 hover:bg-neutral-700"
      }`}
    >
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-11 w-11 rounded object-contain" />
      )}
      {(item.label || !item.imageUrl) && <span className="max-w-[110px] truncate font-semibold">{item.label || "?"}</span>}
    </button>
  );
}

// Applies on release, so dragging doesn't flood the air with updates.
function SizeSlider({ label, hint, min, max, step, value, onChange }: { label: string; hint: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setLocal(value);
  }
  return (
    <label className="block space-y-1 pt-2">
      <span className="flex justify-between text-xs text-neutral-400">
        {label} <span className="text-neutral-500">{hint}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onMouseUp={() => onChange(local)}
        onTouchEnd={() => onChange(local)}
        onKeyUp={() => onChange(local)}
        className="w-full"
      />
    </label>
  );
}

export function TierListPanel() {
  const { slug, scenes, sceneRequest, addAsset } = useDirector();
  const list = scenes.live.tierList;
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competition, setCompetition] = useState("bra.1");
  const files = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(list.title);

  // Tier list edits always hit air and preview together: it's a live game.
  const update = (patch: Partial<TierList>) => sceneRequest({ action: "patch", target: "both", patch: { tierList: patch } });
  const setItems = (items: TierItem[]) => update({ items });

  function place(id: string, tier: number) {
    setItems(list.items.map((it) => (it.id === id ? { ...it, tier, placedAt: tier >= 0 ? Date.now() : null } : it)));
    setSelected(null);
  }

  function addText() {
    const text = label.trim();
    const url = imageUrl.trim();
    if (!text && !url) return;
    if (url && !url.startsWith("https://")) {
      setError("O link da imagem precisa começar com https://");
      return;
    }
    setItems([...list.items, { id: newId(), label: text.slice(0, 40), imageUrl: url || null, tier: -1, placedAt: null }]);
    setLabel("");
    setImageUrl("");
    setError(null);
  }

  async function addPhotos(fileList: FileList | null) {
    if (!fileList?.length) return;
    setBusy(true);
    setError(null);
    const added: TierItem[] = [];
    try {
      for (const file of Array.from(fileList)) {
        const asset = await uploadAsset(slug, file);
        addAsset(asset);
        added.push({ id: newId(), label: asset.name.slice(0, 40), imageUrl: asset.url, tier: -1, placedAt: null });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio");
    }
    if (added.length) await setItems([...list.items, ...added]);
    setBusy(false);
    if (files.current) files.current.value = "";
  }

  async function importTeams() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/football?competition=${competition}&kind=tabela`);
      const data = (await res.json()) as { groups?: BoardGroup[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha");
      const have = new Set(list.items.map((i) => i.label));
      const teams = (data.groups ?? []).flatMap((g) => g.rows.map((r) => r.team)).filter((t) => !have.has(t.name));
      await setItems([...list.items, ...teams.map((t) => ({ id: newId(), label: t.name, imageUrl: t.logo, tier: -1, placedAt: null }))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    }
    setBusy(false);
  }

  function renameItem(id: string) {
    const item = list.items.find((i) => i.id === id);
    const name = item && prompt("Nome do item:", item.label);
    if (item && name !== null && name !== undefined) setItems(list.items.map((i) => (i.id === id ? { ...i, label: name.trim().slice(0, 40) } : i)));
  }

  const setTiers = (tiers: Tier[]) =>
    update({ tiers, items: list.items.map((it) => (it.tier >= tiers.length ? { ...it, tier: -1, placedAt: null } : it)) });

  const sel = list.items.find((i) => i.id === selected) ?? null;
  const pool = list.items.filter((i) => i.tier < 0);

  const dropZone = (tier: number) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      if (id) place(id, tier);
    },
    onClick: () => sel && place(sel.id, tier),
  });

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
      {/* ------------------------------------------------ setup */}
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-neutral-400">Tema da tier list</span>
          <input
            className={`${input} w-full`}
            value={title}
            maxLength={60}
            placeholder="ex: MELHORES CAMISAS, ATACANTES DO BRASIL..."
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== list.title && update({ title: title.trim() })}
          />
        </label>

        <div className="flex gap-2">
          {(
            [
              ["split", "Ao lado das câmeras"],
              ["full", "Tela cheia"],
            ] as const
          ).map(([mode, text]) => (
            <button
              key={mode}
              onClick={() => update({ mode })}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm ${list.mode === mode ? "bg-[#DFFF00] font-semibold text-black" : "bg-neutral-800 hover:bg-neutral-700"}`}
            >
              {text}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {list.visible ? (
            <button className={btn} onClick={() => update({ visible: false })}>
              Tirar do ar
            </button>
          ) : (
            <button className={btnOn} onClick={() => update({ visible: true })}>
              Pôr no ar
            </button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            <input type="checkbox" checked={list.showPool} onChange={(e) => update({ showPool: e.target.checked })} />
            mostrar na tela os itens que faltam
          </label>
        </div>

        <div className="space-y-2 rounded-md bg-neutral-950 p-3">
          <p className="text-sm font-semibold">Adicionar itens</p>
          <div className="flex gap-2">
            <input
              className={`${input} min-w-0 flex-1`}
              value={label}
              maxLength={40}
              placeholder="Nome (jogador, assunto...)"
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addText()}
            />
            <button className={btn} onClick={addText} disabled={!label.trim() && !imageUrl.trim()}>
              Adicionar
            </button>
          </div>
          <input
            className={`${input} w-full`}
            value={imageUrl}
            placeholder="(opcional) link de uma imagem https://..."
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addText()}
          />
          <input ref={files} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          <button
            className="w-full rounded-md border border-dashed border-neutral-600 px-3 py-2 text-sm text-neutral-300 hover:border-neutral-400 disabled:opacity-50"
            disabled={busy}
            onClick={() => files.current?.click()}
          >
            {busy ? "Enviando..." : "＋ Enviar fotos (várias de uma vez — o nome do arquivo vira o nome do item)"}
          </button>
          <details className="text-xs text-neutral-400">
            <summary className="cursor-pointer">Atalho: escudos dos times de um campeonato</summary>
            <div className="mt-2 flex gap-2">
              <select className={`${input} flex-1`} value={competition} onChange={(e) => setCompetition(e.target.value)}>
                {COMPETITIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button className={btn} disabled={busy} onClick={importTeams}>
                Adicionar times
              </button>
            </div>
          </details>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <details open className="rounded-md bg-neutral-950 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Faixas ({list.tiers.map((t) => t.label).join(" ")})</summary>
          <div className="mt-2 space-y-1.5">
            {list.tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={tier.color}
                  onChange={(e) => setTiers(list.tiers.map((t, j) => (j === i ? { ...t, color: e.target.value } : t)))}
                  className="h-8 w-10 cursor-pointer rounded bg-transparent"
                />
                <input
                  className={`${input} flex-1`}
                  defaultValue={tier.label}
                  maxLength={14}
                  onBlur={(e) => e.target.value !== tier.label && setTiers(list.tiers.map((t, j) => (j === i ? { ...t, label: e.target.value } : t)))}
                />
                <button className={`${small} bg-neutral-800 hover:bg-red-700`} disabled={list.tiers.length <= 2} onClick={() => setTiers(list.tiers.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                className={btn}
                disabled={list.tiers.length >= 8}
                onClick={() => setTiers([...list.tiers, { label: "E", color: "#a29bfe" }])}
              >
                ＋ Faixa
              </button>
              <button className={btn} onClick={() => setTiers(DEFAULT_TIERS)}>
                Voltar para S A B C D
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">Pode trocar os nomes: “REI DELAS”, “FEZ HISTÓRIA”, “NÃO DÁ”...</p>
            <SizeSlider
              label="Largura das caixas das faixas"
              hint={list.labelWidth === 0 ? "automática (cabe o nome mais longo)" : `${list.labelWidth} px`}
              min={0}
              max={360}
              step={10}
              value={list.labelWidth}
              onChange={(v) => update({ labelWidth: v })}
            />
            <SizeSlider
              label="Tamanho dos itens"
              hint={`${Math.round(list.itemScale * 100)}%`}
              min={0.6}
              max={2}
              step={0.1}
              value={list.itemScale}
              onChange={(v) => update({ itemScale: v })}
            />
          </div>
        </details>

        <div className="flex flex-wrap gap-2">
          <button
            className={btn}
            disabled={!list.items.some((i) => i.tier >= 0)}
            onClick={() => confirm("Tirar todos os itens das faixas (voltam para “Falta”)?") && setItems(list.items.map((i) => ({ ...i, tier: -1, placedAt: null })))}
          >
            Recomeçar
          </button>
          <button
            className={btn}
            disabled={!list.items.length}
            onClick={() => confirm("Apagar todos os itens desta tier list?") && update({ items: [] })}
          >
            Apagar tudo
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ board */}
      <div className="space-y-2">
        <p className="text-xs text-neutral-400">
          {sel ? (
            <>
              <b className="text-[#DFFF00]">{sel.label || "Item"}</b> selecionado — clique na faixa onde ele entra (ou arraste).{" "}
              <button className="underline" onClick={() => renameItem(sel.id)}>
                renomear
              </button>{" "}
              ·{" "}
              <button
                className="text-red-400 underline"
                onClick={() => {
                  setItems(list.items.filter((i) => i.id !== sel.id));
                  setSelected(null);
                }}
              >
                apagar
              </button>
            </>
          ) : (
            "Clique num item e depois na faixa (ou arraste). Cada jogada entra no ar na hora."
          )}
        </p>
        {list.tiers.map((tier, i) => (
          <div
            key={i}
            {...dropZone(i)}
            className={`flex min-h-[64px] cursor-pointer overflow-hidden rounded-md border ${sel ? "border-neutral-600 hover:border-[#DFFF00]" : "border-neutral-800"}`}
          >
            <span className="flex w-16 shrink-0 items-center justify-center text-lg font-black text-black" style={{ background: tier.color }}>
              {tier.label}
            </span>
            <div className="flex flex-1 flex-wrap items-center gap-1.5 bg-neutral-900 p-1.5">
              {list.items
                .filter((it) => it.tier === i)
                .map((it) => (
                  <Chip
                    key={it.id}
                    item={it}
                    selected={selected === it.id}
                    onClick={() => setSelected(selected === it.id ? null : it.id)}
                  />
                ))}
            </div>
          </div>
        ))}
        <div {...dropZone(-1)} className="rounded-md border border-dashed border-neutral-700 p-2">
          <p className="mb-1.5 text-xs font-semibold text-neutral-400">FALTA RANQUEAR ({pool.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {pool.length === 0 && <span className="text-xs text-neutral-500">Adicione itens à esquerda.</span>}
            {pool.map((it) => (
              <Chip
                key={it.id}
                item={it}
                selected={selected === it.id}
                onClick={() => setSelected(selected === it.id ? null : it.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
