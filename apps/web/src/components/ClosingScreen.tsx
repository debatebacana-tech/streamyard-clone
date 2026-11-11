import type { ProgramBranding } from "@/lib/scene";
import { CONDENSED, DISPLAY } from "./showStyle";

// Built-in animated closing screen ("Obrigado por assistir!") in the Debate
// Bacana look: lines and arcs draw in, the logo drops, the words slam in, the
// handle and the networks rise; then chevrons, dots and glow keep it alive.
// Used when the program has no closing art of its own. It has no sound: the
// closing track plays over it.

// The programs whose closing is this screen (it carries the Debate Bacana signature).
export const ANIMATED_CLOSING = new Set(["debate-bacana", "futebol-bacana"]);

const LIME = "#c8f000";
const BRAND_LOGO = "/brand/debate-bacana.png";

function Chevrons({ side }: { side: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 90 60"
      className={`end-chevrons absolute top-[300px] h-[60px] w-[90px] ${side === "left" ? "left-[80px]" : "right-[80px]"}`}
      style={{ animationDelay: side === "left" ? "1.6s" : "1.75s", transform: side === "right" ? "scaleX(-1)" : undefined }}
    >
      {[0, 34].map((x, i) => (
        <path key={x} className="end-chevron" style={{ animationDelay: `${i * 0.18}s` }} d={`M${x + 6} 8 L${x + 30} 30 L${x + 6} 52`} fill="none" stroke={LIME} strokeWidth="6" strokeLinejoin="miter" />
      ))}
    </svg>
  );
}

const ICONS = {
  youtube: (
    <svg viewBox="0 0 48 34" className="h-[30px] w-[42px]">
      <rect x="0" y="0" width="48" height="34" rx="9" fill={LIME} />
      <path d="M19 9 L33 17 L19 25 Z" fill="#050505" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 40 40" className="h-[36px] w-[36px]" fill="none" stroke={LIME} strokeWidth="4">
      <rect x="3" y="3" width="34" height="34" rx="10" />
      <circle cx="20" cy="20" r="8" />
      <circle cx="30" cy="10" r="1.6" fill={LIME} stroke="none" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 40 44" className="h-[38px] w-[34px]">
      <path d="M22 2 h7 c0.6 5 4 8.5 9 9 v7 c-3.4 0-6.4-1-9-2.8 V30 a12 12 0 1 1-12-12 c0.7 0 1.4 0 2 0.2 v7.3 a5 5 0 1 0 3 4.5 Z" fill={LIME} />
    </svg>
  ),
};

export function ClosingScreen({ branding }: { branding: ProgramBranding }) {
  const logo = BRAND_LOGO;
  const networks = [
    ["youtube", "YOUTUBE"],
    ["instagram", "INSTAGRAM"],
    ["tiktok", "TIKTOK"],
  ] as const;
  return (
    <div className="absolute inset-0 z-40 overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 45%, #111 0%, #050505 70%)" }}>
      {/* Arcs and corner lines drawing in, then the arcs turn slowly. */}
      <svg viewBox="0 0 1280 720" className="absolute inset-0 h-full w-full">
        <g className="end-spin" style={{ transformOrigin: "640px 370px" }}>
          <circle className="end-draw" cx="640" cy="370" r="460" fill="none" stroke={LIME} strokeWidth="2.5" pathLength={100} strokeDasharray="38 12" style={{ animationDelay: "0.1s" }} />
        </g>
        {[
          ["M30 195 L180 45", "0.2s"],
          ["M120 280 L280 120", "0.35s"],
          ["M1100 135 L1240 0", "0.25s"],
          ["M40 690 L150 580", "0.4s"],
          ["M1150 720 L1250 620", "0.3s"],
        ].map(([d, delay]) => (
          <path key={d} className="end-draw" d={d} stroke={LIME} strokeWidth="2.5" pathLength={100} strokeDasharray="100 100" style={{ animationDelay: delay }} />
        ))}
      </svg>
      {/* Dot grids in the corners. */}
      <div className="end-dots absolute top-[8px] left-[8px] h-[140px] w-[150px]" style={{ background: `radial-gradient(${LIME} 2.2px, transparent 2.6px) 0 0 / 18px 18px`, maskImage: "linear-gradient(135deg, black 35%, transparent 80%)" }} />
      <div className="end-dots absolute right-[8px] bottom-[8px] h-[150px] w-[170px]" style={{ background: `radial-gradient(${LIME} 2.2px, transparent 2.6px) 0 0 / 18px 18px`, maskImage: "linear-gradient(315deg, black 35%, transparent 80%)", animationDelay: "0.5s" }} />
      <Chevrons side="left" />
      <Chevrons side="right" />

      {/* Logo drops in, then the light sweep of the corner logo now and then. */}
      <div className="end-logo absolute inset-x-0 top-[22px] flex justify-center">
        <span className="logo-anim relative inline-block" style={{ animationDelay: "2.2s" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={branding.name} className="block h-[190px] w-auto drop-shadow-[0_0_24px_rgba(200,240,0,0.35)]" />
        </span>
      </div>

      <div className="absolute inset-x-0 top-[222px] flex flex-col items-center leading-[0.92]" style={DISPLAY}>
        <span className="end-word text-[168px] text-white" style={{ animationDelay: "0.75s" }}>
          OBRIGADO
        </span>
        <span className="end-word end-glow text-[178px]" style={{ color: LIME, animationDelay: "1.05s" }}>
          POR ASSISTIR!
        </span>
      </div>

      <div className="absolute inset-x-0 top-[588px] flex items-center justify-center gap-6">
        <span className="end-line h-[3px] w-[190px] origin-right" style={{ background: LIME }} />
        <span className="end-rise text-[34px] font-bold italic text-white" style={{ ...CONDENSED, animationDelay: "1.45s" }}>
          @DEBATEBACANA
        </span>
        <span className="end-line h-[3px] w-[190px] origin-left" style={{ background: LIME }} />
      </div>

      <div className="absolute inset-x-0 top-[640px] flex items-center justify-center" style={CONDENSED}>
        {networks.map(([key, label], i) => (
          <div key={key} className="end-rise flex items-center" style={{ animationDelay: `${1.65 + i * 0.15}s` }}>
            {i > 0 && <span className="mx-8 h-[40px] w-[3px]" style={{ background: LIME }} />}
            <span className="flex items-center gap-3">
              {ICONS[key]}
              <span className="text-[34px] font-bold text-white">{label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
