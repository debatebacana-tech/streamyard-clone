import {
  AccessToken,
  EgressClient,
  EncodingOptionsPreset,
  RoomServiceClient,
  StreamOutput,
  StreamProtocol,
  type VideoGrant,
} from "livekit-server-sdk";

export type ParticipantRole = "host" | "guest" | "layout-viewer";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getCredentials() {
  return {
    apiKey: requireEnv("LIVEKIT_API_KEY"),
    apiSecret: requireEnv("LIVEKIT_API_SECRET"),
    httpUrl: requireEnv("LIVEKIT_HTTP_URL"), // e.g. https://livekit.yourdomain.com
    wsUrl: requireEnv("NEXT_PUBLIC_LIVEKIT_WS_URL"), // e.g. wss://livekit.yourdomain.com
  };
}

export function getRoomServiceClient(): RoomServiceClient {
  const { httpUrl, apiKey, apiSecret } = getCredentials();
  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

export function getEgressClient(): EgressClient {
  const { httpUrl, apiKey, apiSecret } = getCredentials();
  return new EgressClient(httpUrl, apiKey, apiSecret);
}

function grantForRole(room: string, role: ParticipantRole): VideoGrant {
  switch (role) {
    case "host":
      return { room, roomJoin: true, canPublish: true, canSubscribe: true, roomAdmin: true };
    case "guest":
      return { room, roomJoin: true, canPublish: true, canSubscribe: true };
    case "layout-viewer":
      // The page the Egress service loads: it only needs to see/hear the
      // room, never publish, and must stay invisible so it doesn't render
      // itself as a tile inside its own composited output.
      return {
        room,
        roomJoin: true,
        canPublish: false,
        canSubscribe: true,
        canPublishData: false,
        hidden: true,
      };
  }
}

export async function createParticipantToken(params: {
  room: string;
  identity: string;
  name?: string;
  role: ParticipantRole;
}): Promise<string> {
  const { apiKey, apiSecret } = getCredentials();
  const token = new AccessToken(apiKey, apiSecret, {
    identity: params.identity,
    name: params.name ?? params.identity,
    ttl: "4h",
  });
  token.addGrant(grantForRole(params.room, params.role));
  return token.toJwt();
}

export function getWsUrl(): string {
  return getCredentials().wsUrl;
}

export async function startYoutubeEgress(params: {
  layoutUrl: string;
  rtmpUrl: string;
}) {
  const egress = getEgressClient();
  const output = new StreamOutput({
    protocol: StreamProtocol.RTMP,
    urls: [params.rtmpUrl],
  });
  // Web Egress loads an arbitrary URL in a headless browser and streams
  // whatever that page renders/plays. Our layout-view page itself joins the
  // LiveKit room as a hidden viewer and draws the composed tiles, so this
  // is effectively a fully custom "room composite" without needing a
  // separately-hosted LiveKit template server.
  return egress.startWebEgress(params.layoutUrl, output, {
    awaitStartSignal: false,
    // 720p30 to start (see docs/plans cost/quality decision). Bump to
    // H264_1080P_30 later plus a bigger VPS — no other change needed.
    encodingOptions: EncodingOptionsPreset.H264_720P_30,
  });
}

export async function stopEgress(egressId: string) {
  const egress = getEgressClient();
  return egress.stopEgress(egressId);
}
