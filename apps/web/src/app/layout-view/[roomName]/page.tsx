import { LayoutView } from "./LayoutView";

export default async function LayoutViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomName: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { roomName } = await params;
  const { token } = await searchParams;

  if (!token) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">Token ausente</div>;
  }

  return <LayoutView roomName={roomName} layoutViewToken={token} />;
}
