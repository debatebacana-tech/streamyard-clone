import { cookies } from "next/headers";
import { connection } from "next/server";
import { getIronSession, type SessionOptions } from "iron-session";

export type SessionData = {
  isHost?: boolean;
};

const sessionOptions: SessionOptions = {
  password: requireSessionSecret(),
  cookieName: "streamyard_clone_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
};

function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET env var must be set to a string of at least 32 characters");
  }
  return secret;
}

export async function getSession() {
  // iron-session checks expiry with Date.now(); keep it out of prerendering.
  await connection();
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireHostSession() {
  const session = await getSession();
  if (!session.isHost) {
    return null;
  }
  return session;
}
