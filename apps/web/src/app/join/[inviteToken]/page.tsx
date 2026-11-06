import { JoinRoom } from "./JoinRoom";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  const { inviteToken } = await params;
  return <JoinRoom inviteToken={inviteToken} />;
}
