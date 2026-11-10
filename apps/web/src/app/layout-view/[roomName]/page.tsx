import { LayoutHost } from "./LayoutHost";

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

  return <LayoutHost roomName={roomName} token={token} />;
}
