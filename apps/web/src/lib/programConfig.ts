// Per-program show rundown settings (shared client/server): the opening
// stinger and tracks, and the texts of the institutional screens.
import {
  DEFAULT_SAVED_SCENES,
  SCREEN_DEFAULTS,
  normalizeSavedScene,
  normalizeTransition,
  type TransitionConfig,
  type SavedScene,
  type ScreenKind,
  type ScreenText,
} from "./scene";

export type ProgramConfig = {
  openingVideoUrl: string | null;
  openingTrackUrl: string | null;
  waitingTrackUrl: string | null;
  breakTrackUrl: string | null;
  closingTrackUrl: string | null;
  // The team's own art (image or video) for each screen; the built-in text
  // screen is only a fallback when none is chosen.
  waitingMediaUrl: string | null;
  breakMediaUrl: string | null;
  closingMediaUrl: string | null;
  // Scoreboard tools in the director panel: always on for football programs,
  // an optional module elsewhere (null = follow the program's format).
  scoreboardModule: boolean | null;
  // Saved arrangements for the scenes bar (defaults until the team edits them).
  scenes: SavedScene[];
  // Animation between scenes on a cut.
  transition: TransitionConfig;
  screens: Record<Exclude<ScreenKind, "none">, ScreenText>;
};

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function media(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/media/") && value.length <= 200 ? value : null;
}

function text(value: unknown, max: number, fallback: string): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function screen(input: unknown, d: ScreenText): ScreenText {
  const s = obj(input);
  return {
    label: text(s.label, 40, d.label),
    title: text(s.title, 60, d.title),
    subtitle: text(s.subtitle, 120, d.subtitle),
    panelLabel: text(s.panelLabel, 40, d.panelLabel),
    panelTitle: text(s.panelTitle, 40, d.panelTitle),
    panelText: text(s.panelText, 120, d.panelText),
  };
}

export function normalizeProgramConfig(input: unknown, programName = "programa"): ProgramConfig {
  const c = obj(input);
  const screens = obj(c.screens);
  const closing = { ...SCREEN_DEFAULTS.encerramento, subtitle: `Valeu por acompanhar o ${programName}.` };
  return {
    openingVideoUrl: media(c.openingVideoUrl),
    openingTrackUrl: media(c.openingTrackUrl),
    waitingTrackUrl: media(c.waitingTrackUrl),
    breakTrackUrl: media(c.breakTrackUrl),
    closingTrackUrl: media(c.closingTrackUrl),
    waitingMediaUrl: media(c.waitingMediaUrl),
    breakMediaUrl: media(c.breakMediaUrl),
    closingMediaUrl: media(c.closingMediaUrl),
    scoreboardModule: typeof c.scoreboardModule === "boolean" ? c.scoreboardModule : null,
    scenes: Array.isArray(c.scenes)
      ? c.scenes.map(normalizeSavedScene).filter((x): x is SavedScene => x !== null).slice(0, 12)
      : DEFAULT_SAVED_SCENES,
    transition: normalizeTransition(c.transition),
    screens: {
      espera: screen(screens.espera, SCREEN_DEFAULTS.espera),
      intervalo: screen(screens.intervalo, SCREEN_DEFAULTS.intervalo),
      encerramento: screen(screens.encerramento, closing),
    },
  };
}

export function mergeProgramConfig(current: ProgramConfig, patch: unknown, programName?: string): ProgramConfig {
  const p = obj(patch);
  const screens = obj(p.screens);
  return normalizeProgramConfig(
    {
      ...current,
      ...p,
      transition: { ...current.transition, ...obj(p.transition) },
      screens: {
        espera: { ...current.screens.espera, ...obj(screens.espera) },
        intervalo: { ...current.screens.intervalo, ...obj(screens.intervalo) },
        encerramento: { ...current.screens.encerramento, ...obj(screens.encerramento) },
      },
    },
    programName,
  );
}

export function scoreboardEnabled(config: ProgramConfig | null, format: string): boolean {
  return format === "futebol" || config?.scoreboardModule === true;
}
