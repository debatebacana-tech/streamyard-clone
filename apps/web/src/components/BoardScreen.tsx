"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Board, BoardGroup, BoardMatch, BoardRow, BoardTeam, BracketRound, BracketSide, BracketTie, ProgramBranding } from "@/lib/scene";
import { CONDENSED, DISPLAY } from "./showStyle";

// Full-screen round fixtures / standings in the Debate Bacana board look:
// black with lime, the brand logo, a spaced competition name over a heavy
// title, the competition logo, and dark cards with crests.

export const LIME = "#DFFF00";
const CARD = "#141414";
const LINE = "#2b2b2b";
const TZ = "America/Sao_Paulo";
const BODY = { top: 184, bottom: 700, left: 26, right: 1254 };

function Crest({ team, size }: { team: BoardTeam; size: number }) {
  return team.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={team.logo} alt="" style={{ width: size, height: size }} className="shrink-0 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
  ) : (
    <span style={{ width: size * 0.8, height: size * 0.8 }} className="shrink-0 rounded-full bg-neutral-700" />
  );
}

const delay = (i: number): CSSProperties => ({ animationDelay: `${150 + i * 45}ms` });

// Lime slashes in the corners, as in the team's board art.
export function Corners() {
  const bars = (style: CSSProperties, flip: boolean) => (
    <div className="absolute" style={style}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute"
          style={{
            width: i === 0 ? 80 : 26,
            height: i === 0 ? 22 : 10,
            background: LIME,
            transform: `skewX(${flip ? 40 : -40}deg)`,
            [flip ? "right" : "left"]: i === 0 ? 0 : 40 + i * 20,
            top: i === 0 ? 0 : 28,
          }}
        />
      ))}
    </div>
  );
  return (
    <>
      {bars({ top: 126, left: -30, width: 130, height: 40 }, true)}
      {bars({ top: 126, right: -30, width: 130, height: 40 }, false)}
      <span className="absolute" style={{ top: -10, left: -30, width: 120, height: 40, background: LIME, transform: "skewX(-40deg)" }} />
      <span className="absolute" style={{ top: -10, right: -30, width: 120, height: 40, background: LIME, transform: "skewX(40deg)" }} />
      <span className="absolute" style={{ bottom: -12, left: -30, width: 150, height: 34, background: LIME, transform: "skewX(40deg)" }} />
      <span className="absolute" style={{ bottom: -12, right: -30, width: 150, height: 34, background: LIME, transform: "skewX(-40deg)" }} />
    </>
  );
}

// "33ª RODADA": the leading number in lime. Shrinks to fit its box, so it
// never runs under the competition logo.
function Title({ text, size }: { text: string; size: number }) {
  const m = /^(\S*\d\S*)\s+(.*)$/.exec(text);
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(size);
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const measure = () => {
      const room = box.clientWidth;
      const natural = el.scrollWidth * (size / (parseFloat(getComputedStyle(el).fontSize) || size));
      setFit(natural > room ? Math.floor((size * room) / natural) : size);
    };
    measure();
    // Again once the display font has loaded (its width differs from the fallback).
    let alive = true;
    document.fonts?.ready.then(() => alive && measure());
    return () => {
      alive = false;
    };
  }, [text, size]);
  return (
    <span ref={ref} className="block leading-none whitespace-nowrap text-white uppercase" style={{ ...DISPLAY, fontSize: fit, paddingTop: 4 }}>
      {m ? (
        <>
          <span style={{ color: LIME }}>{m[1]}</span> {m[2]}
        </>
      ) : (
        text
      )}
    </span>
  );
}

function Header({ board, branding }: { board: Board; branding: ProgramBranding }) {
  const spaced = board.subtitle || "CAMPEONATO";
  if (board.kind === "jogos") return <BrandHeader branding={branding} over={<span style={{ letterSpacing: "0.42em" }}>{spaced}</span>} big={board.title || "JOGOS DA RODADA"} logo={board.logo} />;
  const over = (
    <span style={{ letterSpacing: "0.22em" }}>
      {spaced}
      {board.title && <span style={{ color: LIME }}> • {board.title}</span>}
    </span>
  );
  return <BrandHeader branding={branding} over={over} big={board.kind === "chave" ? "CHAVEAMENTO" : "CLASSIFICAÇÃO"} size={84} logo={board.logo} />;
}

// The board header: brand logo | spaced line over a heavy title | logo on the right.
export function BrandHeader({
  branding,
  over,
  big,
  size = 92,
  logo,
}: {
  branding: ProgramBranding;
  over: ReactNode;
  big: string;
  size?: number;
  logo?: string | null;
}) {
  return (
    <>
      <div className="absolute flex items-center justify-center" style={{ top: 14, left: 150, width: 230, height: 140 }}>
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-5xl text-white uppercase" style={DISPLAY}>
            {branding.name}
          </span>
        )}
      </div>
      <span className="absolute" style={{ top: 30, left: 470, width: 3, height: 122, background: "#fff" }} />
      {/* Text, then the competition logo beside it (never on top of it). */}
      <div className="absolute flex items-center gap-6" style={{ top: 4, left: 498, right: 150, height: 150 }}>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {/* Room between the two lines so accents (Ç, Ã) never touch the line above. */}
          <span className="mb-3 text-[27px] leading-none whitespace-nowrap text-white uppercase" style={{ ...CONDENSED, fontWeight: 700 }}>
            {over}
          </span>
          <Title text={big} size={size} />
        </div>
        {logo && <CompetitionLogo src={logo} />}
      </div>
      <span className="absolute inset-x-0" style={{ top: 166, height: 3, background: LIME }} />
    </>
  );
}

// The team's own logos are made for dark backgrounds; ESPN's (often dark
// text, e.g. Libertadores, Champions) go on a light badge to be readable.
function CompetitionLogo({ src }: { src: string }) {
  const own = src.startsWith("/brand/") || src.startsWith("/media/");
  return own ? (
    <div className="flex h-[130px] w-[130px] shrink-0 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-full max-w-full object-contain" style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.25))" }} />
    </div>
  ) : (
    <div className="flex h-[124px] w-[124px] shrink-0 items-center justify-center rounded-2xl p-3 shadow-[0_0_18px_rgba(223,255,0,0.25)]" style={{ background: "#f4f1ea", border: `3px solid ${LIME}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-h-full max-w-full object-contain" />
    </div>
  );
}

// ---------------------------------------------------------------- bracket

function BracketCard({ tie, top, left, width, height, final }: { tie: BracketTie; top: number; left: number; width: number; height: number; final?: boolean }) {
  // "pên. 5-4" is winner-loser: shown TV style next to each score, "2 (5)".
  const pens = /(\d+)-(\d+)/.exec(tie.note);
  const pen = (me: "a" | "b") => {
    if (!pens || !tie.winner) return null;
    const hi = Math.max(+pens[1], +pens[2]);
    const lo = Math.min(+pens[1], +pens[2]);
    return tie.winner === me ? hi : lo;
  };
  const row = (side: BracketSide | null, me: "a" | "b") => {
    const lost = tie.winner !== null && tie.winner !== me;
    const won = tie.winner === me;
    const crest = Math.round(height * (final ? 0.36 : 0.34));
    return (
      <div className="flex min-h-0 flex-1 items-center gap-2 px-2" style={{ opacity: lost ? 0.42 : 1 }}>
        {side ? <Crest team={side} size={crest} /> : <span style={{ width: crest, height: crest }} className="shrink-0 rounded-full border-2 border-dashed border-neutral-600" />}
        <span className="min-w-0 flex-1 truncate text-white uppercase" style={{ ...CONDENSED, fontWeight: 700, fontSize: Math.min(final ? 30 : 24, height * 0.3) }}>
          {side ? side.abbr || side.name : "A definir"}
        </span>
        {side?.agg !== null && side?.agg !== undefined && (
          <span className="flex items-baseline gap-1 tabular-nums" style={{ ...DISPLAY, fontSize: Math.min(final ? 34 : 28, height * 0.34), color: won ? LIME : "#fff" }}>
            {side.agg}
            {pen(me) !== null && <span style={{ fontSize: "0.62em", opacity: 0.85 }}>({pen(me)})</span>}
          </span>
        )}
      </div>
    );
  };
  return (
    <div
      className="board-row absolute flex flex-col overflow-hidden rounded-lg"
      style={{ top, left, width, height, background: CARD, border: `2px solid ${final ? LIME : LINE}`, boxShadow: final ? "0 0 24px rgba(223,255,0,0.25)" : undefined }}
    >
      {row(tie.a, "a")}
      <span className="h-px shrink-0" style={{ background: LINE }} />
      {row(tie.b, "b")}
    </div>
  );
}

// Two-sided bracket: the first rounds split left and right, the final in the middle.
function Bracket({ rounds }: { rounds: BracketRound[] }) {
  const sideRounds = rounds.slice(0, -1);
  const final = rounds[rounds.length - 1];
  const n = sideRounds.length;
  const gap = 18;
  const cols = 2 * n + 1;
  const colW = Math.min(230, Math.floor((BODY.right - BODY.left - gap * (cols - 1)) / cols));
  const totalW = colW * cols + gap * (cols - 1);
  const x0 = BODY.left + Math.floor((BODY.right - BODY.left - totalW) / 2);
  const labelH = 36;
  const top = BODY.top + labelH;
  const H = BODY.bottom - top;
  const first = Math.max(1, sideRounds[0]?.ties.length ?? 1) / 2;
  const cardH = Math.min(96, Math.floor((H / Math.max(1, first)) * 0.72));
  const lines: ReactNode[] = [];
  const cards: ReactNode[] = [];
  const labels: ReactNode[] = [];
  const centerY = (count: number, i: number) => top + (H / count) * (i + 0.5);

  const label = (text: string, x: number, key: string, lime = false) =>
    labels.push(
      <span key={key} className="absolute text-center text-[22px] uppercase" style={{ ...CONDENSED, fontWeight: 700, top: BODY.top, left: x, width: colW, color: lime ? LIME : "#bdbdbd", letterSpacing: "0.12em" }}>
        {text}
      </span>,
    );

  sideRounds.forEach((round, r) => {
    const half = round.ties.length / 2;
    for (const side of ["left", "right"] as const) {
      const col = side === "left" ? r : cols - 1 - r;
      const x = x0 + col * (colW + gap);
      label(round.name, x, `${side}-${r}`);
      const ties = side === "left" ? round.ties.slice(0, half) : round.ties.slice(half);
      ties.forEach((tie, i) => {
        const cy = centerY(ties.length, i);
        cards.push(<BracketCard key={`${side}-${r}-${i}`} tie={tie} top={cy - cardH / 2} left={x} width={colW} height={cardH} />);
        // Elbow to the next round (or to the final).
        const toNext = r + 1 < n ? centerY(ties.length / 2, Math.floor(i / 2)) : centerY(1, 0);
        const xEdge = side === "left" ? x + colW : x;
        const xMid = side === "left" ? x + colW + gap / 2 : x - gap / 2;
        lines.push(<path key={`l-${side}-${r}-${i}`} d={`M${xEdge} ${cy} H${xMid} V${toNext} H${side === "left" ? xMid + gap / 2 : xMid - gap / 2}`} fill="none" stroke={LIME} strokeOpacity={0.55} strokeWidth={2} />);
      });
    }
  });
  const fx = x0 + n * (colW + gap);
  const finalH = Math.round(cardH * 1.25);
  label(final.name, fx, "final", true);
  cards.push(<BracketCard key="final" tie={final.ties[0]} top={centerY(1, 0) - finalH / 2} left={fx} width={colW} height={finalH} final />);
  return (
    <>
      <svg className="pointer-events-none absolute inset-0" width={1280} height={720}>
        {lines}
      </svg>
      {labels}
      {cards}
    </>
  );
}

// ---------------------------------------------------------------- fixtures

function dateLine(m: BoardMatch): string {
  const d = new Date(m.date);
  const date = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return [date, time, m.venue].filter(Boolean).join("  •  ");
}

function MatchCard({ m, top, height, width, left, index }: { m: BoardMatch; top: number; height: number; width: number; left: number; index: number }) {
  const crest = Math.round(height * 0.86);
  const name = Math.min(30, height * 0.4);
  const score = Math.min(64, height * 0.78);
  // Shrink long names ("Internacional") to fit their side instead of cutting them.
  const avail = (width - 118 - 2 * (crest + 24) - 24) / 2;
  const nameStyle = (n: string): CSSProperties => ({ ...CONDENSED, fontWeight: 700, fontSize: Math.min(name, avail / (0.46 * Math.max(1, n.length))) });
  const live = m.state === "in";
  const scored = m.home.score !== null && m.away.score !== null;
  return (
    <div className="board-row absolute" style={{ ...delay(index), top, left, width, height: height + 14 }}>
      <div
        className="absolute inset-x-0 top-0 flex items-center rounded-xl"
        style={{ height, background: CARD, border: `1px solid ${LINE}`, borderLeft: `5px solid ${LIME}` }}
      >
        <span className="min-w-0 flex-1 truncate pl-3 text-right text-white" style={nameStyle(m.home.name)}>
          {m.home.name}
        </span>
        <span className="mx-3 flex">
          <Crest team={m.home} size={crest} />
        </span>
        <span className="flex w-[118px] shrink-0 items-center justify-center gap-3 leading-none" style={DISPLAY}>
          {scored ? (
            <>
              <span style={{ color: LIME, fontSize: score }}>{m.home.score}</span>
              <span className="text-white" style={{ ...CONDENSED, fontWeight: 700, fontSize: score * 0.62 }}>×</span>
              <span style={{ color: LIME, fontSize: score }}>{m.away.score}</span>
            </>
          ) : (
            <span style={{ ...CONDENSED, fontWeight: 700, color: LIME, fontSize: score * 0.9 }}>×</span>
          )}
        </span>
        <span className="mx-3 flex">
          <Crest team={m.away} size={crest} />
        </span>
        <span className="min-w-0 flex-1 truncate pr-3 text-white" style={nameStyle(m.away.name)}>
          {m.away.name}
        </span>
      </div>
      <span className="absolute inset-x-0 flex justify-center" style={{ top: height - 12 }}>
        <span className="bg-black px-3 text-[17px] leading-[24px] text-white" style={{ ...CONDENSED, fontWeight: 500 }}>
          {live ? (
            <span className="live-dot font-bold text-red-500">● AO VIVO {m.detail}</span>
          ) : m.detail === "ADIADO" ? (
            "ADIADO"
          ) : (
            dateLine(m)
          )}
        </span>
      </span>
    </div>
  );
}

function Matches({ matches }: { matches: BoardMatch[] }) {
  const cols = matches.length <= 5 ? 1 : 2;
  const perCol = Math.ceil(matches.length / cols);
  const pitch = Math.min(102, Math.floor((BODY.bottom - BODY.top) / perCol));
  const height = Math.round(pitch * 0.76);
  const gap = 40;
  const colW = cols === 1 ? 820 : (BODY.right - BODY.left - gap) / 2;
  const lefts = cols === 1 ? [(1280 - colW) / 2] : [BODY.left, BODY.left + colW + gap];
  return (
    <>
      {cols === 2 && <span className="absolute" style={{ top: BODY.top + 6, height: BODY.bottom - BODY.top - 10, left: 639, width: 2, background: LIME }} />}
      {matches.map((m, i) => {
        const c = Math.floor(i / perCol);
        const r = i % perCol;
        return <MatchCard key={`${m.date}${m.home.name}`} m={m} index={i} top={BODY.top + 8 + r * pitch} left={lefts[c]} width={colW} height={height} />;
      })}
    </>
  );
}

// ---------------------------------------------------------------- standings

type Col = { label: string; width: number; value: (r: BoardRow) => string | number; lime?: boolean };

const COLS: Col[] = [
  { label: "PTS", width: 56, value: (r) => r.points, lime: true },
  { label: "PJ", width: 44, value: (r) => r.played },
  { label: "V", width: 40, value: (r) => r.wins },
  { label: "E", width: 40, value: (r) => r.ties },
  { label: "D", width: 40, value: (r) => r.losses },
  { label: "GP", width: 44, value: (r) => r.gf },
  { label: "GC", width: 44, value: (r) => r.ga },
  { label: "SG", width: 46, value: (r) => r.gd },
];
const COMPACT: Col[] = [COLS[0], COLS[1], COLS[7]];

function TablePanel({ rows, cols, name, start, rowH, style }: { rows: BoardRow[]; cols: Col[]; name?: string; start: number; rowH: number; style: CSSProperties }) {
  const big = Math.min(32, rowH * 0.66);
  const text = Math.min(23, rowH * 0.48);
  return (
    <div className="absolute overflow-hidden rounded-xl" style={{ ...style, background: "#0e0e0e", border: `1px solid ${LINE}` }}>
      <div
        className="flex items-center text-[16px] text-neutral-300"
        style={{ ...CONDENSED, fontWeight: 600, height: 44, borderLeft: `5px solid ${LIME}`, background: "#121212" }}
      >
        <span className="w-[52px] pl-3">{name ? "" : "POS"}</span>
        <span className="flex-1 pl-[46px]" style={name ? { color: LIME, fontWeight: 700, fontSize: 19, paddingLeft: 0 } : undefined}>
          {name || "CLUBE"}
        </span>
        {cols.map((c) => (
          <span key={c.label} className="text-center" style={{ width: c.width, color: c.lime ? LIME : undefined, fontSize: c.lime ? 19 : undefined, fontWeight: c.lime ? 700 : undefined }}>
            {c.label}
          </span>
        ))}
      </div>
      {rows.map((r, i) => (
        <div
          key={r.rank + r.team.name}
          className="board-row flex items-center"
          style={{ ...delay(start + i), height: rowH, background: i % 2 ? "#181818" : "#121212", borderLeft: `5px solid ${r.zone ?? "transparent"}` }}
        >
          <span className="w-[52px] pl-3 tabular-nums" style={{ ...DISPLAY, color: LIME, fontSize: big }}>
            {r.rank}
          </span>
          <span className="flex w-[46px] justify-center">
            <Crest team={r.team} size={rowH - 10} />
          </span>
          <span
            className="min-w-0 flex-1 truncate pl-2 text-white"
            style={{ ...CONDENSED, fontWeight: 700, fontSize: cols === COMPACT && r.team.abbr.length > 3 ? text * 0.8 : text }}
          >
            {cols === COMPACT ? r.team.abbr || r.team.name : r.team.name}
          </span>
          {cols.map((c) => (
            <span
              key={c.label}
              className="text-center tabular-nums"
              style={c.lime ? { ...DISPLAY, width: c.width, color: LIME, fontSize: big } : { ...CONDENSED, fontWeight: 500, width: c.width, color: "#fff", fontSize: text * 0.95 }}
            >
              {c.value(r)}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Standings({ groups }: { groups: BoardGroup[] }) {
  const height = BODY.bottom - BODY.top - 4;
  if (groups.length === 1) {
    const rows = groups[0].rows;
    const perCol = Math.ceil(rows.length / 2);
    const rowH = Math.min(52, Math.floor((height - 44) / perCol));
    const gap = 40;
    const w = (BODY.right - BODY.left - gap) / 2;
    return (
      <>
        <span className="absolute" style={{ top: BODY.top + 6, height, left: 639, width: 2, background: LIME }} />
        {[rows.slice(0, perCol), rows.slice(perCol)].map((col, c) => (
          <TablePanel
            key={c}
            rows={col}
            cols={COLS}
            start={c * perCol}
            rowH={rowH}
            style={{ top: BODY.top, left: BODY.left + c * (w + gap), width: w, height: 44 + rowH * col.length + 2 }}
          />
        ))}
      </>
    );
  }
  const cols = groups.length <= 2 ? groups.length : groups.length <= 6 ? 3 : 4;
  const rowsOfPanels = Math.ceil(groups.length / cols);
  const gap = 18;
  const w = (BODY.right - BODY.left - gap * (cols - 1)) / cols;
  const panelH = (height - gap * (rowsOfPanels - 1)) / rowsOfPanels;
  const maxRows = Math.max(...groups.map((g) => g.rows.length));
  const rowH = Math.min(48, Math.floor((panelH - 46) / maxRows));
  return (
    <>
      {groups.map((g, i) => (
        <TablePanel
          key={g.name + i}
          rows={g.rows}
          cols={COMPACT}
          name={g.name}
          start={i * 4}
          rowH={rowH}
          style={{
            top: BODY.top + Math.floor(i / cols) * (panelH + gap),
            left: BODY.left + (i % cols) * (w + gap),
            width: w,
            height: 44 + rowH * g.rows.length + 2,
          }}
        />
      ))}
    </>
  );
}

export function BoardScreen({ board, branding }: { board: Board; branding: ProgramBranding }) {
  const empty = board.kind === "tabela" ? board.groups.length === 0 : board.kind === "chave" ? board.bracket.length === 0 : board.matches.length === 0;
  return (
    <div className="absolute inset-0 z-[35] overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 35%, #161616, #050505 75%)" }}>
      <Corners />
      <Header board={board} branding={branding} />
      {empty ? (
        <span className="absolute inset-x-0 text-center text-4xl text-white/80 uppercase" style={{ ...CONDENSED, fontWeight: 700, top: 400 }}>
          {board.kind === "tabela" ? "Tabela indisponível" : board.kind === "chave" ? "Chaveamento indisponível" : "Sem jogos nesse período"}
        </span>
      ) : board.kind === "chave" ? (
        <Bracket rounds={board.bracket} />
      ) : board.kind === "tabela" ? (
        <Standings groups={board.groups} />
      ) : (
        <Matches matches={board.matches} />
      )}
    </div>
  );
}
