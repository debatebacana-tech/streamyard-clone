import { LayoutView } from "../LayoutView";

// The actual composition, loaded inside the stream host page (see ../page.tsx).
// standby=1: a new version warming up, silent until the host activates it.
export default async function LayoutFramePage({
  params,
  searchParams,
}: {
  params: Promise<{ roomName: string }>;
  searchParams: Promise<{ token?: string; standby?: string; rec?: string }>;
}) {
  const { roomName } = await params;
  const { token, standby, rec } = await searchParams;
  if (!token) return <div className="flex h-screen items-center justify-center bg-black text-white">Token ausente</div>;
  return <LayoutView roomName={roomName} layoutViewToken={token} standby={standby === "1"} offline={rec === "1"} />;
}
