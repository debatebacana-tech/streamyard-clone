import { LayoutHost } from "./LayoutHost";

export default async function LayoutViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomName: string }>;
  searchParams: Promise<{ token?: string; rec?: string }>;
}) {
  const { roomName } = await params;
  const { token, rec } = await searchParams;

  if (!token) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">Token ausente</div>;
  }

  // rec=1: an offline recording (no "AO VIVO" badge on the video).
  return <LayoutHost roomName={roomName} token={token} offline={rec === "1"} />;
}
