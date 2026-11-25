"use client";

import type { CSSProperties } from "react";
import type { TweetCard as Card } from "@/lib/scene";
import { CONDENSED, DISPLAY } from "./showStyle";

// An X/Twitter post in the show's look (black, lime accents), tall beside the
// cameras or big in the middle of the screen.

export const TWEET_W = 440;
const LIME = "#DFFF00";

const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".0", "")} mi` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(".0", "")} mil` : String(n);

function fontFor(text: string, photo: boolean, big: boolean): number {
  const len = text.length + (photo ? 140 : 0);
  const base = len < 120 ? 34 : len < 220 ? 29 : len < 350 ? 24 : 20;
  return big ? base * 1.12 : base;
}

export function TweetCardView({ card, style, big = false }: { card: Card; style: CSSProperties; big?: boolean }) {
  const date = card.date ? new Date(card.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" }) : "";
  const avatar = big ? 72 : 60;
  return (
    <div
      className="chat-panel absolute flex flex-col overflow-hidden rounded-2xl shadow-2xl"
      style={{ ...style, background: "#0b0b0b", border: "2px solid #2b2b2b", borderLeft: `6px solid ${LIME}` }}
    >
      <div className="flex items-center gap-3 px-5 pt-5">
        {card.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.avatar} alt="" className="shrink-0 rounded-full" style={{ width: avatar, height: avatar, border: `3px solid ${LIME}` }} />
        ) : (
          <span className="shrink-0 rounded-full bg-neutral-700" style={{ width: avatar, height: avatar }} />
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-white" style={{ ...CONDENSED, fontWeight: 700, fontSize: big ? 32 : 27 }}>
              {card.name}
            </span>
            {card.verified && (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0] text-sm font-black text-white">✓</span>
            )}
          </div>
          <span className="block truncate text-neutral-400" style={{ ...CONDENSED, fontWeight: 500, fontSize: big ? 24 : 21 }}>
            @{card.handle}
          </span>
        </div>
        <span className="self-start text-4xl leading-none text-white" style={DISPLAY}>
          𝕏
        </span>
      </div>
      <p
        className="px-5 pt-4 whitespace-pre-line text-white"
        style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif", fontWeight: 600, fontSize: fontFor(card.text, Boolean(card.photo), big), lineHeight: 1.28 }}
      >
        {card.text}
      </p>
      {card.photo && (
        <div className="mx-5 mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border border-neutral-800 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.photo} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      {!card.photo && <div className="flex-1" />}
      <div className="flex items-center gap-5 px-5 py-4 text-neutral-300" style={{ ...CONDENSED, fontWeight: 700, fontSize: 21 }}>
        <span className="flex-1 text-neutral-400">{date}</span>
        {card.replies > 0 && <span>💬 {compact(card.replies)}</span>}
        {card.likes > 0 && (
          <span>
            <span style={{ color: "#f91880" }}>♥</span> {compact(card.likes)}
          </span>
        )}
      </div>
    </div>
  );
}
