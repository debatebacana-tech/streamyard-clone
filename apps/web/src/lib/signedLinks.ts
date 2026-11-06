import { SignJWT, jwtVerify } from "jose";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET env var must be set to a string of at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export type GuestInvitePayload = {
  room: string;
  role: "guest";
};

export type LayoutViewPayload = {
  room: string;
  role: "layout-viewer";
};

export async function signGuestInvite(payload: GuestInvitePayload, ttl = "7d"): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getSecretKey());
}

export async function verifyGuestInvite(token: string): Promise<GuestInvitePayload> {
  const { payload } = await jwtVerify(token, getSecretKey());
  if (payload.role !== "guest" || typeof payload.room !== "string") {
    throw new Error("Invalid invite token");
  }
  return { room: payload.room, role: "guest" };
}

// Short-lived: only needs to live long enough for the headless browser
// Egress spins up to load the layout-view page and join the room.
export async function signLayoutViewToken(payload: LayoutViewPayload, ttl = "15m"): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getSecretKey());
}

export async function verifyLayoutViewToken(token: string): Promise<LayoutViewPayload> {
  const { payload } = await jwtVerify(token, getSecretKey());
  if (payload.role !== "layout-viewer" || typeof payload.room !== "string") {
    throw new Error("Invalid layout view token");
  }
  return { room: payload.room, role: "layout-viewer" };
}
