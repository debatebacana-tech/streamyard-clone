// Shared (client + server) shape of what the program output shows. The
// director edits a draft ("Prévia"), takes it to air ("No ar"), and the
// on-air scene is mirrored into the LiveKit room metadata that the
// composition renders from.

export type LayoutMode = "grid" | "spotlight" | "pip" | "solo";

export const LAYOUTS: { mode: LayoutMode; label: string }[] = [
  { mode: "grid", label: "Grade" },
  { mode: "spotlight", label: "Destaque" },
  { mode: "pip", label: "PiP" },
  { mode: "solo", label: "Só um" },
];

export type Team = { name: string; score: number; crestUrl: string | null; color: string };

export type Clock = {
  visible: boolean;
  running: boolean;
  // Elapsed = baseMs + (running ? now - startedAt : 0), so every viewer
  // (director, Egress) computes the same time without a server tick.
  baseMs: number;
  startedAt: number | null;
  period: string;
};

// Colors/branding of the competition the scoreboard belongs to. clock null =
// use the program's primary color (the original look, kept as "Padrão").
// Scoreboard designs for the corner ("selo") style.
export type ScoreboardVariant = "classic" | "br" | "ucl" | "conmebol";

export const SCOREBOARD_VARIANTS: { variant: ScoreboardVariant; label: string }[] = [
  { variant: "classic", label: "Clássico" },
  { variant: "br", label: "Brasileirão" },
  { variant: "ucl", label: "Champions" },
  { variant: "conmebol", label: "Conmebol (cápsula)" },
];

export type CompetitionTheme = {
  variant: ScoreboardVariant;
  // Show team crests instead of the 3-letter abbreviations.
  crests: boolean;
  name: string;
  logoUrl: string | null;
  // Decorative piece of the competition's identity (trophy, ball, symbol)
  // watermarked inside the scoreboard; falls back to the logo.
  elementUrl: string | null;
  elementOpacity: number;
  dark: string;
  light: string;
  accent: string;
  clock: string | null;
};

export const DEFAULT_THEME: CompetitionTheme = {
  variant: "classic",
  crests: false,
  name: "",
  logoUrl: null,
  elementUrl: null,
  elementOpacity: 0.18,
  dark: "#111111",
  light: "#f4f1ea",
  accent: "#fcd34d",
  clock: null,
};

// Starting points only: colors approximate each competition's look and are
// editable; logos are uploaded by the team.
export const THEME_PRESETS: { label: string; theme: CompetitionTheme }[] = [
  { label: "Padrão", theme: DEFAULT_THEME },
  { label: "Brasileirão", theme: { ...DEFAULT_THEME, variant: "br", crests: true, name: "BRASILEIRÃO", dark: "#5a6c9b", light: "#3aa6a0", accent: "#c8ff00", clock: "#0c1338" } },
  { label: "Copa do Brasil", theme: { ...DEFAULT_THEME, variant: "br", crests: true, name: "COPA DO BRASIL", dark: "#0b3a8a", light: "#14904c", accent: "#ffd60a", clock: "#061638" } },
  { label: "Champions", theme: { ...DEFAULT_THEME, variant: "ucl", name: "CHAMPIONS LEAGUE", dark: "#0b1a7a", light: "#e8edf5", accent: "#e11d48", clock: "#e8edf5" } },
  { label: "Libertadores", theme: { ...DEFAULT_THEME, variant: "conmebol", name: "LIBERTADORES", dark: "#0b0b0b", light: "#ffffff", accent: "#d4af37", clock: "#0b0b0b" } },
  { label: "Sul-Americana", theme: { ...DEFAULT_THEME, variant: "conmebol", name: "SUL-AMERICANA", dark: "#0b2a6f", light: "#ffffff", accent: "#d4af37", clock: "#0b2a6f" } },
  { label: "Estadual", theme: { ...DEFAULT_THEME, name: "ESTADUAL", dark: "#111111", light: "#ffffff", accent: "#e30613", clock: "#e30613" } },
];

export type WebPosition = "left" | "right" | "center" | "full";

export const WEB_POSITIONS: { position: WebPosition; label: string }[] = [
  { position: "left", label: "Painel à esquerda" },
  { position: "right", label: "Painel à direita" },
  { position: "center", label: "Central" },
  { position: "full", label: "Tela cheia" },
];

export type Scene = {
  layout: LayoutMode;
  // Participants shown in the output; everyone else stays backstage (not seen or heard).
  onStage: string[];
  // Featured participant for spotlight/pip/solo; falls back to a screen share, then the first on stage.
  featured: string | null;
  gc: { visible: boolean; title: string; subtitle: string; imageUrl: string | null };
  ticker: { visible: boolean; text: string };
  // "bar": full-width bottom bar (Hospício style); "bug": compact top-left corner, TV style.
  scoreboard: { visible: boolean; style: "bar" | "bug"; theme: CompetitionTheme; home: Team; away: Team; clock: Clock };
  // Embedded web page (e.g. a live pitch widget); zoom scales its content to fit.
  web: { visible: boolean; url: string; position: WebPosition; zoom: number };
  sponsor: { visible: boolean; imageUrl: string | null };
  showLogo: boolean;
};

export type ProgramBranding = {
  slug: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
};

export type ShowMetadata = { program: ProgramBranding; scene: Scene };

const DEFAULT_TEAM: Team = { name: "", score: 0, crestUrl: null, color: "#1E3A8A" };

export const DEFAULT_SCENE: Scene = {
  layout: "grid",
  onStage: [],
  featured: null,
  gc: { visible: false, title: "", subtitle: "", imageUrl: null },
  ticker: { visible: false, text: "" },
  scoreboard: {
    visible: false,
    style: "bug",
    theme: DEFAULT_THEME,
    home: { ...DEFAULT_TEAM, name: "CASA" },
    away: { ...DEFAULT_TEAM, name: "VISITANTE", color: "#B91C1C" },
    clock: { visible: true, running: false, baseMs: 0, startedAt: null, period: "1º T" },
  },
  web: { visible: false, url: "", position: "left", zoom: 1 },
  sponsor: { visible: false, imageUrl: null },
  showLogo: true,
};

const LAYOUT_MODES = new Set<string>(LAYOUTS.map((l) => l.mode));

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function str(value: unknown, max: number, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}
function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
// Only our own uploads (/media/...) or https images are rendered.
function url(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  return value.startsWith("/media/") || value.startsWith("https://") ? value : null;
}
function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

const VARIANT_SET = new Set<string>(SCOREBOARD_VARIANTS.map((v) => v.variant));

export function normalizeTheme(input: unknown): CompetitionTheme {
  const t = obj(input);
  const d = DEFAULT_THEME;
  return {
    variant: typeof t.variant === "string" && VARIANT_SET.has(t.variant) ? (t.variant as ScoreboardVariant) : d.variant,
    crests: bool(t.crests, d.crests),
    name: str(t.name, 40, d.name),
    logoUrl: url(t.logoUrl),
    elementUrl: url(t.elementUrl),
    elementOpacity: num(t.elementOpacity, d.elementOpacity, 0, 1),
    dark: color(t.dark, d.dark),
    light: color(t.light, d.light),
    accent: color(t.accent, d.accent),
    clock: t.clock === null || t.clock === undefined ? null : color(t.clock, d.accent),
  };
}

// Only https pages can be embedded (the Egress browser loads them).
function webUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 1000) return "";
  try {
    return new URL(value).protocol === "https:" ? value : "";
  } catch {
    return "";
  }
}

const WEB_POSITION_SET = new Set<string>(WEB_POSITIONS.map((p) => p.position));

function normalizeTeam(input: unknown, fallback: Team): Team {
  const t = obj(input);
  return {
    name: str(t.name, 40, fallback.name),
    score: Math.round(num(t.score, fallback.score, 0, 999)),
    crestUrl: "crestUrl" in t ? url(t.crestUrl) : fallback.crestUrl,
    color: color(t.color, fallback.color),
  };
}

export function normalizeScene(input: unknown): Scene {
  const raw = obj(input);
  const gc = obj(raw.gc);
  const ticker = obj(raw.ticker);
  const sb = obj(raw.scoreboard);
  const clock = obj(sb.clock);
  const sponsor = obj(raw.sponsor);
  const web = obj(raw.web);
  const d = DEFAULT_SCENE;

  return {
    layout: typeof raw.layout === "string" && LAYOUT_MODES.has(raw.layout) ? (raw.layout as LayoutMode) : d.layout,
    onStage: Array.isArray(raw.onStage)
      ? [...new Set(raw.onStage.filter((id): id is string => typeof id === "string" && id.length <= 64))].slice(0, 16)
      : d.onStage,
    featured: typeof raw.featured === "string" && raw.featured.length <= 64 ? raw.featured : null,
    gc: {
      visible: bool(gc.visible, false),
      title: str(gc.title, 120),
      subtitle: str(gc.subtitle, 160),
      imageUrl: url(gc.imageUrl),
    },
    ticker: { visible: bool(ticker.visible, false), text: str(ticker.text, 400) },
    scoreboard: {
      visible: bool(sb.visible, false),
      style: sb.style === "bar" ? "bar" : "bug",
      theme: normalizeTheme(sb.theme),
      home: normalizeTeam(sb.home, d.scoreboard.home),
      away: normalizeTeam(sb.away, d.scoreboard.away),
      clock: {
        visible: bool(clock.visible, d.scoreboard.clock.visible),
        running: bool(clock.running, false),
        baseMs: num(clock.baseMs, 0, 0, 24 * 3600 * 1000),
        startedAt: typeof clock.startedAt === "number" ? clock.startedAt : null,
        period: str(clock.period, 12, d.scoreboard.clock.period),
      },
    },
    web: {
      visible: bool(web.visible, false),
      url: webUrl(web.url),
      position: typeof web.position === "string" && WEB_POSITION_SET.has(web.position) ? (web.position as WebPosition) : d.web.position,
      zoom: num(web.zoom, 1, 0.3, 2),
    },
    sponsor: { visible: bool(sponsor.visible, false), imageUrl: url(sponsor.imageUrl) },
    showLogo: bool(raw.showLogo, true),
  };
}

// Applies a partial update from the director on top of a scene (one level of
// nesting for overlays, two for the scoreboard).
export function mergeScene(current: Scene, patch: unknown): Scene {
  const p = obj(patch);
  const sb = obj(p.scoreboard);
  return normalizeScene({
    ...current,
    ...p,
    gc: { ...current.gc, ...obj(p.gc) },
    ticker: { ...current.ticker, ...obj(p.ticker) },
    sponsor: { ...current.sponsor, ...obj(p.sponsor) },
    web: { ...current.web, ...obj(p.web) },
    scoreboard: {
      ...current.scoreboard,
      ...sb,
      theme: { ...current.scoreboard.theme, ...obj(sb.theme) },
      home: { ...current.scoreboard.home, ...obj(sb.home) },
      away: { ...current.scoreboard.away, ...obj(sb.away) },
      clock: { ...current.scoreboard.clock, ...obj(sb.clock) },
    },
  });
}

export function clockElapsedMs(clock: Clock, now: number): number {
  return clock.baseMs + (clock.running && clock.startedAt ? Math.max(0, now - clock.startedAt) : 0);
}

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function parseShowMetadata(raw: string | undefined): ShowMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ShowMetadata>;
    if (!parsed.program) return null;
    return { program: parsed.program, scene: normalizeScene(parsed.scene) };
  } catch {
    return null;
  }
}
