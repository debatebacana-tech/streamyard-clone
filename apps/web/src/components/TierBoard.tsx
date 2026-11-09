"use client";

import type { CSSProperties } from "react";
import type { ProgramBranding, TierItem, TierList } from "@/lib/scene";
import { BrandHeader, Corners, LIME } from "./BoardScreen";
import { CONDENSED, DISPLAY } from "./showStyle";

// Tier list game on air: colored tier labels with the ranked items (crests,
// photos or text). Full screen in the board look, or as a panel next to the
// cameras ("split") so the table can argue while it fills.

export const TIER_W = 720;
const ROW_BG = "#141414";
const LINE = "#2b2b2b";

function Tile({ item, size, scale = 1, font }: { item: TierItem; size: number; scale?: number; font?: number }) {
  if (!item.imageUrl) {
    return (
      <span
        className="tier-pop flex shrink-0 items-center justify-center rounded-lg px-2 text-center leading-none text-white uppercase"
        style={{ ...CONDENSED, fontWeight: 700, height: size, minWidth: Math.min(size, 40), fontSize: font ?? Math.max(13, size * 0.32 * scale), background: "#262626", border: `1px solid ${LINE}`, whiteSpace: "nowrap" }}
      >
        {item.label}
      </span>
    );
  }
  const caption = item.label && size >= 70;
  return (
    <span className="tier-pop flex shrink-0 flex-col items-center justify-center" style={{ width: size, height: size }} title={item.label}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl}
        alt=""
        className="min-h-0 w-full flex-1 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
        style={{ borderRadius: 6 }}
      />
      {caption && (
        <span className="w-full truncate text-center leading-none text-white" style={{ ...CONDENSED, fontWeight: 700, fontSize: Math.min(16, size * 0.18), marginTop: 3 }}>
          {item.label}
        </span>
      )}
    </span>
  );
}

// Tier name box: one line when it fits, else two; the font shrinks to fit the box.
function labelFont(label: string, width: number, rowH: number): number {
  const len = Math.max(1, label.length);
  if (len <= 2) return Math.min(rowH * 0.55, 60, (width - 12) / (0.55 * len));
  const words = label.split(/\s+/);
  const lines = len > 7 && words.length > 1 ? 2 : 1;
  const perLine = lines === 2 ? Math.max(...words.map((w) => w.length), Math.ceil(len / 2)) : len;
  return Math.max(10, Math.min(rowH * (lines === 2 ? 0.36 : 0.45), 34, (width - 14) / (0.47 * perLine)));
}

function Rows({ list, width, height, labelW: baseLabelW }: { list: TierList; width: number; height: number; labelW: number }) {
  const pool = list.items.filter((i) => i.tier < 0);
  const showPool = list.showPool && pool.length > 0;
  const gap = 6;
  const poolH = showPool ? Math.min(70, height * 0.16) : 0;
  const rowH = Math.floor((height - poolH - (showPool ? 10 : 0) - gap * (list.tiers.length - 1)) / list.tiers.length);
  // Automatic width fits the longest tier name (names like "FEZ HISTÓRIA").
  const longest = Math.max(...list.tiers.map((t) => t.label.length));
  const autoW = longest <= 2 ? baseLabelW : Math.min(width * 0.4, Math.max(baseLabelW, Math.ceil(longest * Math.min(rowH * 0.4, 28) * 0.5 + 24)));
  const labelW = list.labelWidth > 0 ? Math.min(list.labelWidth, width * 0.5) : autoW;
  const inner = width - labelW - 16;

  // Tiles shrink when a row gets crowded, so nothing falls off the screen.
  const tileFor = (count: number, max: number) =>
    Math.max(26, Math.min(max * list.itemScale, max * 1.6, Math.floor((inner - (count - 1) * 8) / Math.max(1, count))));

  return (
    <div className="flex flex-col" style={{ width, height, gap }}>
      {list.tiers.map((tier, i) => {
        const items = list.items.filter((it) => it.tier === i).sort((a, b) => (a.placedAt ?? 0) - (b.placedAt ?? 0));
        // Fit the row: text items get the largest font that still fits on one
        // line of tiles; when even a small font doesn't fit, use two lines.
        const fit = (h: number, lines: number) => {
          const images = items.filter((it) => it.imageUrl);
          const texts = items.filter((it) => !it.imageUrl);
          const fixed = images.length * h + texts.length * 16 + Math.max(0, items.length - 1) * 8;
          const chars = texts.reduce((n, it) => n + Math.max(2, it.label.length), 0);
          const room = inner * lines - fixed;
          const font = Math.max(10, Math.min(Math.max(13, h * 0.32 * list.itemScale), chars ? room / (chars * 0.5) : 99));
          return { font, ok: chars === 0 ? room >= 0 : room / (chars * 0.5) >= 12 };
        };
        let size = Math.min(rowH - 8, tileFor(items.length, rowH - 12));
        let fitted = fit(size, 1);
        const twoLines = !fitted.ok && items.length > 1;
        if (twoLines) {
          size = Math.floor((rowH - 14) / 2);
          fitted = fit(size, 2);
        }
        return (
          <div key={i} className="flex overflow-hidden rounded-xl" style={{ height: rowH, background: ROW_BG, border: `1px solid ${LINE}` }}>
            <span
              className="flex shrink-0 items-center justify-center px-1.5 text-center leading-[0.95] break-words uppercase"
              style={{ ...DISPLAY, width: labelW, background: tier.color, color: "#111", fontSize: labelFont(tier.label, labelW, rowH) }}
            >
              {tier.label}
            </span>
            <div className={`flex min-w-0 flex-1 items-center gap-2 px-2 ${twoLines ? "flex-wrap content-center gap-y-1.5" : ""}`}>
              {items.map((item) => (
                <Tile key={`${item.id}-${i}`} item={item} size={size} scale={list.itemScale} font={fitted.font} />
              ))}
            </div>
          </div>
        );
      })}
      {showPool && (
        <div className="mt-1 flex items-center gap-2 overflow-hidden rounded-xl px-2" style={{ height: poolH, border: `1px dashed ${LINE}`, background: "rgba(0,0,0,0.45)" }}>
          <span className="shrink-0 pr-1 text-sm text-neutral-400 uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>
            Falta
          </span>
          {pool.map((item) => (
            <Tile key={`${item.id}-pool`} item={item} size={tileFor(pool.length, poolH - 10)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TierScreen({ list, branding }: { list: TierList; branding: ProgramBranding }) {
  return (
    <div className="absolute inset-0 z-[34] overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 35%, #161616, #050505 75%)" }}>
      <Corners />
      <BrandHeader
        branding={branding}
        over={<span style={{ letterSpacing: "0.42em" }}>TIER LIST</span>}
        big={list.title || "TIER LIST"}
        size={list.title.length > 14 ? 64 : 88}
      />
      <div className="absolute" style={{ top: 184, left: 26 }}>
        <Rows list={list} width={1228} height={512} labelW={110} />
      </div>
    </div>
  );
}

// Panel version beside the cameras.
export function TierPanel({ list, top, bottom }: { list: TierList; top: number; bottom: number }) {
  const height = 720 - top - bottom;
  const style: CSSProperties = { left: 24, top, width: TIER_W, height };
  return (
    <div className="chat-panel absolute flex flex-col overflow-hidden rounded-2xl p-2.5" style={{ ...style, background: "rgba(5,5,5,0.88)", border: `2px solid ${LIME}` }}>
      <div className="flex items-baseline gap-3 px-1 pb-2">
        <span className="text-[15px] text-white/70 uppercase" style={{ ...CONDENSED, fontWeight: 700, letterSpacing: "0.3em" }}>
          Tier list
        </span>
        <span className="truncate text-[30px] leading-none text-white uppercase" style={DISPLAY}>
          {list.title}
        </span>
      </div>
      <Rows list={list} width={TIER_W - 20} height={height - 20 - 42} labelW={70} />
    </div>
  );
}
