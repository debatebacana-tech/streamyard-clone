// Shared (client + server) shape of what the program output shows. The
// director edits a draft ("Prévia"), takes it to air ("No ar"), and the
// on-air scene is mirrored into the LiveKit room metadata that the
// composition renders from.

// "auto" is the grid: one row up to four, two rows beyond.
export type LayoutMode = "auto" | "spotlight" | "center" | "screen" | "solo" | "pip" | "vertical";

export const LAYOUTS: { mode: LayoutMode; label: string; hint: string }[] = [
  { mode: "auto", label: "Grade", hint: "Todos lado a lado (até 4 numa fila, depois duas fileiras)" },
  { mode: "spotlight", label: "Destaque", hint: "A janela (ou quem está em destaque) grande e os apresentadores numa coluna ao lado" },
  { mode: "center", label: "Janela no meio", hint: "A janela no centro e os apresentadores em volta, metade de cada lado" },
  { mode: "screen", label: "Só a janela", hint: "Só a tela compartilhada, grande (os apresentadores continuam sendo ouvidos)" },
  { mode: "pip", label: "PiP", hint: "Destaque em tela cheia com as outras em janelinhas" },
  { mode: "solo", label: "Só um", hint: "Apenas a pessoa em destaque" },
  { mode: "vertical", label: "Tela vertical", hint: "A tela compartilhada (Twitter, celular) numa moldura em pé, recortada no meio, com as câmeras ao lado" },
];

// Institutional full screens from the brand manual.
export type ScreenKind = "none" | "espera" | "intervalo" | "encerramento";

export type ScreenText = {
  label: string;
  title: string;
  subtitle: string;
  panelLabel: string;
  panelTitle: string;
  panelText: string;
};

export const SCREEN_DEFAULTS: Record<Exclude<ScreenKind, "none">, ScreenText> = {
  espera: {
    label: "SINAL DE ABERTURA",
    title: "COMEÇAMOS EM INSTANTES",
    subtitle: "A resenha vai começar.",
    panelLabel: "CONTAGEM",
    panelTitle: "",
    panelText: "MINUTOS / SEGUNDOS",
  },
  intervalo: {
    label: "PAUSA NA PROGRAMAÇÃO",
    title: "JÁ VOLTAMOS",
    subtitle: "A seguir, análise e resenha.",
    panelLabel: "A SEGUIR",
    panelTitle: "PÓS-JOGO",
    panelText: "Análise e comentários",
  },
  encerramento: {
    label: "FIM DE TRANSMISSÃO",
    title: "ATÉ A PRÓXIMA!",
    subtitle: "Valeu por acompanhar a resenha.",
    panelLabel: "ENCONTRE A GENTE",
    panelTitle: "YOUTUBE",
    panelText: "Instagram • TikTok",
  },
};

// redCards: sent-off players, shown as red cards next to the name (TV style).
export type Team = { name: string; score: number; crestUrl: string | null; color: string; redCards: number };

// Penalty shootout, kick by kick (shown TV-style under the scoreboard).
export type Kick = "goal" | "miss";
export type Penalties = { active: boolean; first: "home" | "away"; home: Kick[]; away: Kick[] };

export type ShootoutState = {
  homeGoals: number;
  awayGoals: number;
  // Kick slots to draw per team (5, then one more per sudden-death round).
  rounds: number;
  next: "home" | "away" | null;
  winner: "home" | "away" | null;
};

// Who's ahead, who kicks next and whether it's decided (5 kicks each, then
// sudden death until a round ends with different results).
export function shootoutState(p: Penalties): ShootoutState {
  const hk = p.home.length;
  const ak = p.away.length;
  const homeGoals = p.home.filter((k) => k === "goal").length;
  const awayGoals = p.away.filter((k) => k === "goal").length;
  let winner: "home" | "away" | null = null;
  if (hk <= 5 && ak <= 5) {
    if (homeGoals > awayGoals + (5 - ak)) winner = "home";
    else if (awayGoals > homeGoals + (5 - hk)) winner = "away";
  }
  if (!winner && hk >= 5 && hk === ak && homeGoals !== awayGoals) winner = homeGoals > awayGoals ? "home" : "away";
  const second = p.first === "home" ? "away" : "home";
  const next = winner ? null : p[p.first].length === p[second].length ? p.first : second;
  const nextLen = next ? p[next].length + 1 : 0;
  return { homeGoals, awayGoals, rounds: Math.max(5, hk, ak, nextLen), next, winner };
}

// Removes the last kick taken (undo).
export function undoKick(p: Penalties): Penalties {
  const second = p.first === "home" ? "away" : "home";
  const last = p[p.first].length > p[second].length ? p.first : p[second].length > 0 ? second : null;
  return last ? { ...p, [last]: p[last].slice(0, -1) } : p;
}

export type Clock = {
  visible: boolean;
  running: boolean;
  // Elapsed = baseMs + (running ? now - startedAt : 0), so every viewer
  // (director, Egress) computes the same time without a server tick.
  baseMs: number;
  startedAt: number | null;
  period: string;
  // Stoppage time announced by the 4th official ("+3"), 0 = none.
  extra: number;
};

// Colors/branding of the competition the scoreboard belongs to. clock null =
// use the program's primary color (the original look, kept as "Padrão").
export type CompetitionTheme = {
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
  { label: "Brasileirão", theme: { name: "BRASILEIRÃO", logoUrl: null, elementUrl: null, elementOpacity: 0.18, dark: "#062e1f", light: "#f4f1ea", accent: "#ffd400", clock: "#00a859" } },
  { label: "Libertadores", theme: { name: "LIBERTADORES", logoUrl: null, elementUrl: null, elementOpacity: 0.18, dark: "#0b0b0b", light: "#f5f0e1", accent: "#d4af37", clock: "#b8902c" } },
  { label: "Sul-Americana", theme: { name: "SUL-AMERICANA", logoUrl: null, elementUrl: null, elementOpacity: 0.18, dark: "#1b1b3a", light: "#f4f1ea", accent: "#f2c94c", clock: "#2f6fd6" } },
  { label: "Copa do Brasil", theme: { name: "COPA DO BRASIL", logoUrl: null, elementUrl: null, elementOpacity: 0.18, dark: "#c2410c", light: "#fff7ed", accent: "#fde047", clock: "#f97316" } },
  { label: "Champions", theme: { name: "CHAMPIONS LEAGUE", logoUrl: null, elementUrl: null, elementOpacity: 0.18, dark: "#0b1d51", light: "#eef2ff", accent: "#9fb4ff", clock: "#1f3fae" } },
  { label: "Estadual", theme: { name: "ESTADUAL", logoUrl: null, elementUrl: null, elementOpacity: 0.18, dark: "#111111", light: "#ffffff", accent: "#e30613", clock: "#e30613" } },
];

export type WebPosition = "left" | "right" | "center" | "full";

export const WEB_POSITIONS: { position: WebPosition; label: string }[] = [
  { position: "left", label: "Painel à esquerda" },
  { position: "right", label: "Painel à direita" },
  { position: "center", label: "Central" },
  { position: "full", label: "Tela cheia" },
];

// Round fixtures / standings boards (football), filled from ESPN by the server.
export type BoardTeam = { name: string; abbr: string; logo: string | null };
export type BoardRow = {
  rank: number;
  team: BoardTeam;
  played: number;
  wins: number;
  ties: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  // Stripe color of the table zone (Libertadores, relegation...).
  zone: string | null;
};
export type BoardGroup = { name: string; rows: BoardRow[] };
export type BoardMatch = {
  date: number;
  state: "pre" | "in" | "post";
  detail: string;
  venue: string;
  home: BoardTeam & { score: number | null };
  away: BoardTeam & { score: number | null };
};
export type Board = {
  kind: "none" | "jogos" | "tabela";
  competition: string;
  title: string;
  subtitle: string;
  logo: string | null;
  groups: BoardGroup[];
  matches: BoardMatch[];
};

// Tier list game: items (team crests, photos or text) placed live in tiers.
export type TierItem = { id: string; label: string; imageUrl: string | null; tier: number; placedAt: number | null };
export type Tier = { label: string; color: string };
export type TierList = {
  visible: boolean;
  // "full": whole screen; "split": board on the left, cameras on the right.
  mode: "full" | "split";
  title: string;
  tiers: Tier[];
  // tier = index in tiers, -1 = not ranked yet.
  items: TierItem[];
  // Show the not-yet-ranked items under the board.
  showPool: boolean;
  // Width of the tier name boxes in px (0 = fit the longest name).
  labelWidth: number;
  // Item size multiplier (1 = automatic size).
  itemScale: number;
};

export const DEFAULT_TIERS: Tier[] = [
  { label: "S", color: "#ff4d4d" },
  { label: "A", color: "#ff9f43" },
  { label: "B", color: "#feca57" },
  { label: "C", color: "#1dd1a1" },
  { label: "D", color: "#54a0ff" },
];

// A photo or video projected during the show. Video plays for everyone from
// startedAt (server time); pausedAt freezes it where it was.
export type ProjectedMedia = {
  visible: boolean;
  url: string | null;
  kind: "image" | "video";
  // "destaque": big with the cameras in a column beside it; "full": whole
  // screen; "pip": whole screen with the cameras in small windows.
  mode: "destaque" | "full" | "pip";
  startedAt: number | null;
  pausedAt: number | null;
  loop: boolean;
  volume: number;
};

export function mediaElapsedMs(m: ProjectedMedia, now: number): number {
  if (!m.startedAt) return 0;
  return Math.max(0, (m.pausedAt ?? now) - m.startedAt);
}

// A post from X/Twitter shown as a card in the show's look.
export type TweetCard = {
  id: string;
  name: string;
  handle: string;
  avatar: string | null;
  verified: boolean;
  text: string;
  photo: string | null;
  date: number;
  likes: number;
  replies: number;
};

// One YouTube live chat message, as shown on screen.
export type ChatMessage = { id: string; author: string; text: string; avatarUrl: string | null };

export type Scene = {
  // "all": everyone in the room is on stage automatically (join order);
  // "manual": only the identities in onStage.
  stageMode: "all" | "manual";
  // Side panel with the latest YouTube chat messages.
  chat: { visible: boolean };
  // A chat message picked by the director, shown big in the lower third slot.
  highlight: { visible: boolean; author: string; text: string; avatarUrl: string | null };
  // Scene title in the header, next to the program name (e.g. "CENTRAL DA PARTIDA").
  title: string;
  layout: LayoutMode;
  // Participants shown in the output; everyone else stays backstage (not seen or heard).
  onStage: string[];
  // Preferred window order in "all" mode (dragging windows on the monitors).
  order: string[];
  // Part of shared screens to show (fractions of the frame), e.g. only the
  // live pitch of a match page.
  screenCrop: { enabled: boolean; x: number; y: number; w: number; h: number };
  // Featured participant for spotlight/pip/solo; falls back to a screen share, then the first on stage.
  featured: string | null;
  // Where the featured window goes in "Destaque"/"Tela vertical": right =
  // presenters on the left (the show's usual arrangement).
  featuredSide: "left" | "right";
  // Lower third: subtitle is the lime label ("PAUTA DA MESA"), title the line.
  gc: { visible: boolean; title: string; subtitle: string; imageUrl: string | null };
  // Text running in the footer band.
  ticker: { visible: boolean; text: string };
  // Background track, synced for every viewer via startedAt (null = stopped).
  music: { url: string | null; title: string; volume: number; loop: boolean; startedAt: number | null };
  // Full-screen rundown screen: the team's own art (mediaUrl, image or video)
  // or, without it, the built-in text screen. countdownTo drives the pre-live timer.
  screen: { kind: ScreenKind; countdownTo: number | null; mediaUrl: string | null } & ScreenText;
  // "bar": full-width bottom bar (Hospício style); "bug": compact top-left corner, TV style.
  scoreboard: {
    visible: boolean;
    style: "bar" | "bug";
    theme: CompetitionTheme;
    home: Team;
    away: Team;
    clock: Clock;
    penalties: Penalties;
    // Two-legged ties: aggregate line under the score ("AGREGADO 3-2"), empty = hidden.
    aggregate: string;
  };
  // Embedded web page (e.g. a live pitch widget); zoom scales its content to fit.
  web: { visible: boolean; url: string; position: WebPosition; zoom: number };
  sponsor: { visible: boolean; imageUrl: string | null };
  showLogo: boolean;
  // Full-screen round fixtures or standings (football).
  board: Board;
  tierList: TierList;
  media: ProjectedMedia;
  // X/Twitter post on air: a tall card beside the cameras ("side") or big in the middle.
  tweet: { visible: boolean; mode: "side" | "center"; card: TweetCard | null };
  // When the last animated cut started (server time), so every output plays
  // the transition together.
  transitionAt: number | null;
  // Current rundown step (lights the right button in the ROTEIRO bar).
  step: RundownStep;
};

export type RundownStep = "espera" | "abertura" | "aovivo" | "intervalo" | "encerramento";
const RUNDOWN_STEPS = new Set<string>(["espera", "abertura", "aovivo", "intervalo", "encerramento"]);

export type ProgramFormat = "debate" | "futebol" | "especial";

export type ProgramBranding = {
  slug: string;
  name: string;
  format: ProgramFormat;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
};

// The program's transition between scenes: its own video (null = built-in wipe).
export type TransitionConfig = { enabled: boolean; mediaUrl: string | null; cutMs: number };
export const DEFAULT_TRANSITION: TransitionConfig = { enabled: true, mediaUrl: null, cutMs: 520 };

// sounds: quick-sound files every output keeps preloaded (pads play instantly).
export type ShowMetadata = { program: ProgramBranding; scene: Scene; chat?: ChatMessage[]; transition?: TransitionConfig; sounds?: string[] };

const DEFAULT_TEAM: Team = { name: "", score: 0, crestUrl: null, color: "#1E3A8A", redCards: 0 };

export const DEFAULT_SCENE: Scene = {
  stageMode: "manual",
  chat: { visible: false },
  highlight: { visible: false, author: "", text: "", avatarUrl: null },
  title: "",
  layout: "auto",
  onStage: [],
  order: [],
  screenCrop: { enabled: false, x: 0, y: 0, w: 1, h: 1 },
  featured: null,
  featuredSide: "right",
  gc: { visible: false, title: "", subtitle: "", imageUrl: null },
  ticker: { visible: false, text: "" },
  music: { url: null, title: "", volume: 0.5, loop: true, startedAt: null },
  screen: { kind: "none", countdownTo: null, mediaUrl: null, ...SCREEN_DEFAULTS.espera },
  scoreboard: {
    visible: false,
    style: "bug",
    theme: DEFAULT_THEME,
    home: { ...DEFAULT_TEAM, name: "CASA" },
    away: { ...DEFAULT_TEAM, name: "VISITANTE", color: "#B91C1C" },
    clock: { visible: true, running: false, baseMs: 0, startedAt: null, period: "1º T", extra: 0 },
    penalties: { active: false, first: "home", home: [], away: [] },
    aggregate: "",
  },
  web: { visible: false, url: "", position: "left", zoom: 1 },
  sponsor: { visible: false, imageUrl: null },
  showLogo: true,
  board: { kind: "none", competition: "bra.1", title: "", subtitle: "", logo: null, groups: [], matches: [] },
  tierList: { visible: false, mode: "split", title: "", tiers: DEFAULT_TIERS, items: [], showPool: true, labelWidth: 0, itemScale: 1 },
  tweet: { visible: false, mode: "side", card: null },
  media: { visible: false, url: null, kind: "image", mode: "destaque", startedAt: null, pausedAt: null, loop: false, volume: 1 },
  transitionAt: null,
  step: "aovivo",
};

const LAYOUT_MODES = new Set<string>(LAYOUTS.map((l) => l.mode));
const SCREEN_KINDS = new Set<string>(["none", "espera", "intervalo", "encerramento"]);

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

export function normalizeTheme(input: unknown): CompetitionTheme {
  const t = obj(input);
  const d = DEFAULT_THEME;
  return {
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

// Accepts a plain link or a pasted embed snippet (<iframe src="...">) and
// returns the https URL to embed, or "" if there isn't one. Only https pages
// can be embedded (the Egress browser loads them).
export function extractEmbedUrl(input: string): string {
  const text = input.trim();
  const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(text)?.[1] ?? text;
  const candidate = src.replace(/&amp;/g, "&").trim();
  if (candidate.length > 1000) return "";
  try {
    return new URL(candidate).protocol === "https:" ? candidate : "";
  } catch {
    return "";
  }
}

function int(value: unknown, min: number, max: number): number {
  return Math.round(num(value, 0, min, max));
}

function boardTeam(input: unknown): BoardTeam {
  const t = obj(input);
  const logo = url(t.logo);
  return { name: str(t.name, 30, "?"), abbr: str(t.abbr, 5), logo: logo?.startsWith("https://") || logo?.startsWith("/media/") ? logo : null };
}

function boardScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(99, Math.max(0, value))) : null;
}

export function normalizeBoard(input: unknown): Board {
  const b = obj(input);
  const kind = b.kind === "jogos" || b.kind === "tabela" ? b.kind : "none";
  const groups = Array.isArray(b.groups) ? b.groups.slice(0, 8) : [];
  const matches = Array.isArray(b.matches) ? b.matches.slice(0, 20) : [];
  return {
    kind,
    competition: str(b.competition, 40, "bra.1"),
    title: str(b.title, 60),
    subtitle: str(b.subtitle, 80),
    logo: url(b.logo),
    groups: groups.map((raw) => {
      const g = obj(raw);
      const rows = Array.isArray(g.rows) ? g.rows.slice(0, 24) : [];
      return {
        name: str(g.name, 30),
        rows: rows.map((r) => {
          const row = obj(r);
          return {
            rank: int(row.rank, 0, 99),
            team: boardTeam(row.team),
            played: int(row.played, 0, 999),
            wins: int(row.wins, 0, 999),
            ties: int(row.ties, 0, 999),
            losses: int(row.losses, 0, 999),
            gf: int(row.gf, 0, 999),
            ga: int(row.ga, 0, 999),
            gd: int(row.gd, -999, 999),
            points: int(row.points, 0, 999),
            zone: typeof row.zone === "string" && /^#[0-9a-fA-F]{6}$/.test(row.zone) ? row.zone : null,
          };
        }),
      };
    }),
    matches: matches.map((m) => {
      const match = obj(m);
      return {
        date: num(match.date, 0, 0, 1e14),
        state: match.state === "in" || match.state === "post" ? match.state : "pre",
        detail: str(match.detail, 20),
        venue: str(match.venue, 40),
        home: { ...boardTeam(match.home), score: boardScore(obj(match.home).score) },
        away: { ...boardTeam(match.away), score: boardScore(obj(match.away).score) },
      };
    }),
  };
}

export function normalizeTierList(input: unknown): TierList {
  const t = obj(input);
  const tiers = Array.isArray(t.tiers)
    ? t.tiers.slice(0, 8).map((raw, i) => {
        const tier = obj(raw);
        return { label: str(tier.label, 14, "?"), color: color(tier.color, DEFAULT_TIERS[i % DEFAULT_TIERS.length].color) };
      })
    : DEFAULT_TIERS;
  const seen = new Set<string>();
  const items = (Array.isArray(t.items) ? t.items.slice(0, 48) : [])
    .map((raw) => {
      const item = obj(raw);
      const tier = Math.round(num(item.tier, -1, -1, tiers.length - 1));
      return {
        id: str(item.id, 40),
        label: str(item.label, 40),
        imageUrl: url(item.imageUrl),
        tier,
        placedAt: tier >= 0 && typeof item.placedAt === "number" ? item.placedAt : null,
      };
    })
    .filter((item) => item.id && !seen.has(item.id) && (seen.add(item.id), true));
  return {
    visible: bool(t.visible, false),
    mode: t.mode === "full" ? "full" : "split",
    title: str(t.title, 60),
    tiers: tiers.length ? tiers : DEFAULT_TIERS,
    items,
    showPool: bool(t.showPool, true),
    labelWidth: Math.round(num(t.labelWidth, 0, 0, 400)),
    itemScale: num(t.itemScale, 1, 0.6, 2),
  };
}

export function normalizeTweetCard(input: unknown): TweetCard | null {
  const c = obj(input);
  const id = str(c.id, 25);
  if (!/^\d+$/.test(id)) return null;
  const https = (v: unknown) => {
    const u = url(v);
    return u?.startsWith("https://") ? u : null;
  };
  return {
    id,
    name: str(c.name, 60),
    handle: str(c.handle, 30),
    avatar: https(c.avatar),
    verified: bool(c.verified, false),
    text: str(c.text, 600),
    photo: https(c.photo),
    date: num(c.date, 0, 0, 1e14),
    likes: Math.round(num(c.likes, 0, 0, 1e10)),
    replies: Math.round(num(c.replies, 0, 0, 1e10)),
  };
}

export function normalizeTransition(input: unknown): TransitionConfig {
  const t = obj(input);
  const mediaUrl = url(t.mediaUrl);
  return {
    enabled: bool(t.enabled, DEFAULT_TRANSITION.enabled),
    mediaUrl: mediaUrl?.startsWith("/media/") ? mediaUrl : null,
    cutMs: Math.round(num(t.cutMs, DEFAULT_TRANSITION.cutMs, 0, 3000)),
  };
}

function webUrl(value: unknown): string {
  return typeof value === "string" ? extractEmbedUrl(value) : "";
}

const WEB_POSITION_SET = new Set<string>(WEB_POSITIONS.map((p) => p.position));

function normalizeTeam(input: unknown, fallback: Team): Team {
  const t = obj(input);
  return {
    name: str(t.name, 40, fallback.name),
    score: Math.round(num(t.score, fallback.score, 0, 999)),
    crestUrl: "crestUrl" in t ? url(t.crestUrl) : fallback.crestUrl,
    color: color(t.color, fallback.color),
    redCards: Math.round(num(t.redCards, 0, 0, 5)),
  };
}

function kicks(value: unknown): Kick[] {
  return Array.isArray(value) ? value.filter((k): k is Kick => k === "goal" || k === "miss").slice(0, 30) : [];
}

export function normalizeScene(input: unknown): Scene {
  const raw = obj(input);
  const gc = obj(raw.gc);
  const ticker = obj(raw.ticker);
  const sb = obj(raw.scoreboard);
  const clock = obj(sb.clock);
  const sponsor = obj(raw.sponsor);
  const web = obj(raw.web);
  const music = obj(raw.music);
  const screen = obj(raw.screen);
  const d = DEFAULT_SCENE;
  const chat = obj(raw.chat);
  const highlight = obj(raw.highlight);
  const screenKind = typeof screen.kind === "string" && SCREEN_KINDS.has(screen.kind) ? (screen.kind as ScreenKind) : "none";

  return {
    stageMode: raw.stageMode === "all" ? "all" : "manual",
    chat: { visible: bool(chat.visible, false) },
    highlight: {
      visible: bool(highlight.visible, false),
      author: str(highlight.author, 80),
      text: str(highlight.text, 300),
      avatarUrl: url(highlight.avatarUrl),
    },
    title: str(raw.title, 60),
    layout: typeof raw.layout === "string" && LAYOUT_MODES.has(raw.layout) ? (raw.layout as LayoutMode) : d.layout,
    onStage: Array.isArray(raw.onStage)
      ? [...new Set(raw.onStage.filter((id): id is string => typeof id === "string" && id.length <= 64))].slice(0, 16)
      : d.onStage,
    order: Array.isArray(raw.order)
      ? [...new Set(raw.order.filter((id): id is string => typeof id === "string" && id.length <= 64))].slice(0, 24)
      : [],
    screenCrop: (() => {
      const c = obj(raw.screenCrop);
      const x = num(c.x, 0, 0, 0.95);
      const y = num(c.y, 0, 0, 0.95);
      return {
        enabled: bool(c.enabled, false),
        x,
        y,
        w: num(c.w, 1, 0.05, 1 - x),
        h: num(c.h, 1, 0.05, 1 - y),
      };
    })(),
    featured: typeof raw.featured === "string" && raw.featured.length <= 64 ? raw.featured : null,
    featuredSide: raw.featuredSide === "left" ? "left" : "right",
    gc: {
      visible: bool(gc.visible, false),
      title: str(gc.title, 120),
      subtitle: str(gc.subtitle, 160),
      imageUrl: url(gc.imageUrl),
    },
    ticker: { visible: bool(ticker.visible, false), text: str(ticker.text, 400) },
    music: {
      url: url(music.url),
      title: str(music.title, 80),
      volume: num(music.volume, d.music.volume, 0, 1),
      loop: bool(music.loop, true),
      startedAt: typeof music.startedAt === "number" ? music.startedAt : null,
    },
    screen: {
      kind: screenKind,
      countdownTo: typeof screen.countdownTo === "number" ? screen.countdownTo : null,
      mediaUrl: url(screen.mediaUrl),
      label: str(screen.label, 40, d.screen.label),
      title: str(screen.title, 60, d.screen.title),
      subtitle: str(screen.subtitle, 120, d.screen.subtitle),
      panelLabel: str(screen.panelLabel, 40, d.screen.panelLabel),
      panelTitle: str(screen.panelTitle, 40, d.screen.panelTitle),
      panelText: str(screen.panelText, 120, d.screen.panelText),
    },
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
        extra: Math.round(num(clock.extra, 0, 0, 30)),
      },
      penalties: {
        active: bool(obj(sb.penalties).active, false),
        first: obj(sb.penalties).first === "away" ? "away" : "home",
        home: kicks(obj(sb.penalties).home),
        away: kicks(obj(sb.penalties).away),
      },
      aggregate: str(sb.aggregate, 40),
    },
    web: {
      visible: bool(web.visible, false),
      url: webUrl(web.url),
      position: typeof web.position === "string" && WEB_POSITION_SET.has(web.position) ? (web.position as WebPosition) : d.web.position,
      zoom: num(web.zoom, 1, 0.3, 2),
    },
    sponsor: { visible: bool(sponsor.visible, false), imageUrl: url(sponsor.imageUrl) },
    showLogo: bool(raw.showLogo, true),
    board: normalizeBoard(raw.board),
    tierList: normalizeTierList(raw.tierList),
    media: (() => {
      const m = obj(raw.media);
      const mediaUrl = url(m.url);
      return {
        visible: bool(m.visible, false) && mediaUrl !== null,
        url: mediaUrl,
        kind: m.kind === "video" ? "video" : "image",
        mode: m.mode === "full" || m.mode === "pip" ? m.mode : "destaque",
        startedAt: typeof m.startedAt === "number" ? m.startedAt : null,
        pausedAt: typeof m.pausedAt === "number" ? m.pausedAt : null,
        loop: bool(m.loop, false),
        volume: num(m.volume, 1, 0, 1),
      } as ProjectedMedia;
    })(),
    tweet: {
      visible: bool(obj(raw.tweet).visible, false),
      mode: obj(raw.tweet).mode === "center" ? "center" : "side",
      card: normalizeTweetCard(obj(raw.tweet).card),
    },
    transitionAt: typeof raw.transitionAt === "number" ? raw.transitionAt : null,
    step: typeof raw.step === "string" && RUNDOWN_STEPS.has(raw.step) ? (raw.step as RundownStep) : screenKind !== "none" ? (screenKind as RundownStep) : "aovivo",
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
    music: { ...current.music, ...obj(p.music) },
    chat: { ...current.chat, ...obj(p.chat) },
    highlight: { ...current.highlight, ...obj(p.highlight) },
    screen: { ...current.screen, ...obj(p.screen) },
    board: { ...current.board, ...obj(p.board) },
    tierList: { ...current.tierList, ...obj(p.tierList) },
    screenCrop: { ...current.screenCrop, ...obj(p.screenCrop) },
    tweet: { ...current.tweet, ...obj(p.tweet) },
    media: { ...current.media, ...obj(p.media) },
    // Only the server's animated cut sets this.
    transitionAt: current.transitionAt,
    scoreboard: {
      ...current.scoreboard,
      ...sb,
      theme: { ...current.scoreboard.theme, ...obj(sb.theme) },
      home: { ...current.scoreboard.home, ...obj(sb.home) },
      away: { ...current.scoreboard.away, ...obj(sb.away) },
      clock: { ...current.scoreboard.clock, ...obj(sb.clock) },
      penalties: { ...current.scoreboard.penalties, ...obj(sb.penalties) },
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
    return {
      program: { ...parsed.program, format: parsed.program.format ?? "debate" },
      scene: normalizeScene(parsed.scene),
      chat: Array.isArray(parsed.chat) ? parsed.chat.slice(-12) : [],
      transition: normalizeTransition(parsed.transition),
      sounds: Array.isArray(parsed.sounds)
        ? parsed.sounds.filter((u): u is string => typeof u === "string" && u.startsWith("/media/")).slice(0, 80)
        : [],
    };
  } catch {
    return null;
  }
}

// A saved arrangement ("cena") the director switches to with one click. It
// sets who is on stage and how they're arranged; GC, scoreboard, ticker and
// music stay as they are.
export type SavedScene = {
  id: string;
  name: string;
  layout: LayoutMode;
  stageMode: "all" | "manual";
  onStage: string[];
  featured: string | null;
  featuredSide?: "left" | "right";
  chat: boolean;
};

export const DEFAULT_SAVED_SCENES: SavedScene[] = [
  { id: "todos-chat", name: "Todos + chat", layout: "auto", stageMode: "all", onStage: [], featured: null, chat: true },
  { id: "todos", name: "Todos", layout: "auto", stageMode: "all", onStage: [], featured: null, chat: false },
  { id: "projecao", name: "Janelas + projeção", layout: "spotlight", stageMode: "all", onStage: [], featured: null, chat: false },
  { id: "janela-meio", name: "Janela no meio", layout: "center", stageMode: "all", onStage: [], featured: null, chat: false },
  { id: "so-janela", name: "Só a janela", layout: "screen", stageMode: "all", onStage: [], featured: null, chat: false },
];

export function normalizeSavedScene(input: unknown): SavedScene | null {
  const s = obj(input);
  const name = str(s.name, 40).trim();
  if (!name) return null;
  return {
    id: str(s.id, 40) || Math.random().toString(36).slice(2, 10),
    name,
    layout: typeof s.layout === "string" && LAYOUT_MODES.has(s.layout) ? (s.layout as LayoutMode) : "auto",
    stageMode: s.stageMode === "manual" ? "manual" : "all",
    onStage: Array.isArray(s.onStage) ? s.onStage.filter((x): x is string => typeof x === "string").slice(0, 16) : [],
    featured: typeof s.featured === "string" ? s.featured.slice(0, 64) : null,
    featuredSide: s.featuredSide === "left" ? "left" : "right",
    chat: bool(s.chat, false),
  };
}

// The scene patch that switches to a saved arrangement.
export function savedScenePatch(saved: SavedScene) {
  return {
    layout: saved.layout,
    stageMode: saved.stageMode,
    ...(saved.stageMode === "manual" && { onStage: saved.onStage }),
    featured: saved.featured,
    featuredSide: saved.featuredSide ?? "right",
    chat: { visible: saved.chat },
  };
}

// Whether the scene on screen matches a saved arrangement (to light its button).
export function matchesSavedScene(scene: Scene, saved: SavedScene): boolean {
  return (
    scene.layout === saved.layout &&
    scene.stageMode === saved.stageMode &&
    scene.chat.visible === saved.chat &&
    scene.featuredSide === (saved.featuredSide ?? "right") &&
    (saved.stageMode === "all" || JSON.stringify(scene.onStage) === JSON.stringify(saved.onStage))
  );
}
