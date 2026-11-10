// Competitions the board screens can pull from ESPN (shared client/server).

export type Competition = {
  id: string;
  label: string;
  // Spaced word over the title ("BRASILEIRÃO").
  short: string;
  // Table zone stripes: ranks up to `until` get `color`; the last `bottom`
  // rows get red; everyone else `rest` (null = no stripe).
  zones: { until: number; color: string }[];
  bottom: number;
  rest: string | null;
  // The team's own logo for dark backgrounds (else ESPN's, shown on a light badge).
  logo?: string;
  // Has knockout rounds: offers the bracket ("chaveamento").
  knockout?: boolean;
  // Only knockout (no table at all).
  cup?: boolean;
};

const BLUE = "#2f7cf6";
const ORANGE = "#f59e0b";
const GREEN = "#22c55e";
export const RELEGATION = "#ef4444";

export const COMPETITIONS: Competition[] = [
  { id: "bra.1", label: "Brasileirão Série A", short: "BRASILEIRÃO", zones: [{ until: 4, color: BLUE }, { until: 5, color: ORANGE }], bottom: 4, rest: GREEN, logo: "/brand/competicoes/brasileirao.png" },
  { id: "bra.2", label: "Brasileirão Série B", short: "SÉRIE B", zones: [{ until: 4, color: BLUE }], bottom: 4, rest: GREEN, logo: "/brand/competicoes/serie-b.png" },
  { id: "bra.copa_do_brazil", label: "Copa do Brasil", short: "COPA DO BRASIL", zones: [], bottom: 0, rest: null, knockout: true, cup: true },
  { id: "conmebol.libertadores", label: "Libertadores", short: "LIBERTADORES", zones: [{ until: 2, color: GREEN }, { until: 3, color: ORANGE }], bottom: 0, rest: null, knockout: true },
  { id: "conmebol.sudamericana", label: "Sul-Americana", short: "SUL-AMERICANA", zones: [{ until: 1, color: GREEN }, { until: 2, color: ORANGE }], bottom: 0, rest: null, knockout: true },
  { id: "uefa.champions", label: "Champions League", short: "CHAMPIONS", zones: [{ until: 8, color: BLUE }, { until: 24, color: ORANGE }], bottom: 0, rest: null, knockout: true },
  { id: "bra.camp.paulista", label: "Paulistão", short: "PAULISTÃO", zones: [{ until: 2, color: GREEN }], bottom: 0, rest: null },
  { id: "bra.camp.carioca", label: "Carioca", short: "CARIOCA", zones: [{ until: 4, color: GREEN }], bottom: 0, rest: null },
  { id: "bra.camp.mineiro", label: "Mineiro", short: "MINEIRO", zones: [{ until: 2, color: GREEN }], bottom: 0, rest: null },
  { id: "bra.camp.gaucho", label: "Gaúcho", short: "GAUCHÃO", zones: [{ until: 2, color: GREEN }], bottom: 0, rest: null },
];

export function competition(id: string): Competition | null {
  return COMPETITIONS.find((c) => c.id === id) ?? null;
}

export function zoneColor(comp: Competition, rank: number, total: number): string | null {
  if (comp.bottom && rank > total - comp.bottom) return RELEGATION;
  return comp.zones.find((z) => rank <= z.until)?.color ?? comp.rest;
}
