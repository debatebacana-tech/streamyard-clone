// A club saved for match days (shared client/server shape).
export type Club = {
  id: string;
  name: string;
  short: string;
  color: string;
  crestUrl: string | null;
  vinhetaUrl: string | null;
  anthemUrl: string | null;
};

function url(value: unknown, allowHttps: boolean): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  return value.startsWith("/media/") || (allowHttps && value.startsWith("https://")) ? value : null;
}

// Validated fields from a create/update request (only those present).
export function clubFields(input: unknown): Partial<Omit<Club, "id">> {
  const b = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const out: Partial<Omit<Club, "id">> = {};
  if (typeof b.name === "string" && b.name.trim()) out.name = b.name.trim().slice(0, 40);
  if (typeof b.short === "string") out.short = b.short.trim().toUpperCase().slice(0, 4);
  if (typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color)) out.color = b.color;
  if ("crestUrl" in b) out.crestUrl = url(b.crestUrl, true);
  // Media played on air must be our own uploads.
  if ("vinhetaUrl" in b) out.vinhetaUrl = url(b.vinhetaUrl, false);
  if ("anthemUrl" in b) out.anthemUrl = url(b.anthemUrl, false);
  return out;
}
