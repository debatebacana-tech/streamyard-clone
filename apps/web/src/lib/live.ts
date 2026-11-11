import { EgressStatus } from "livekit-server-sdk";
import { prisma } from "./db";
import { getEgressClient } from "./livekit";

export type LiveState = {
  programSlug: string | null;
  egressId: string | null;
  // Set when the last stream ended on its own (e.g. YouTube rejected it).
  lastError: string | null;
  // When the stream started (ms), from Egress.
  startedAt: number | null;
};

const SETTINGS_ID = "default";

export async function clearLive() {
  await prisma.showSettings.updateMany({
    where: { id: SETTINGS_ID },
    data: { liveProgramSlug: null, liveEgressId: null },
  });
}

// Reconciles the stored "who is live" with Egress, so a stream that died on
// its own doesn't keep blocking every other program.
export async function getLiveState(): Promise<LiveState> {
  const settings = await prisma.showSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!settings?.liveEgressId) {
    return { programSlug: null, egressId: null, lastError: null, startedAt: null };
  }

  const [info] = await getEgressClient().listEgress({ egressId: settings.liveEgressId });
  const active =
    info &&
    (info.status === EgressStatus.EGRESS_STARTING ||
      info.status === EgressStatus.EGRESS_ACTIVE ||
      info.status === EgressStatus.EGRESS_ENDING);

  if (!active) {
    await clearLive();
    return { programSlug: null, egressId: null, lastError: info?.error || null, startedAt: null };
  }
  const started = info.startedAt ? Number(info.startedAt / BigInt(1_000_000)) : 0;
  return { programSlug: settings.liveProgramSlug, egressId: settings.liveEgressId, lastError: null, startedAt: started > 0 ? started : null };
}

export async function markLive(programSlug: string, egressId: string) {
  await prisma.showSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, liveProgramSlug: programSlug, liveEgressId: egressId },
    update: { liveProgramSlug: programSlug, liveEgressId: egressId },
  });
}
