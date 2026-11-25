import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hostProgram } from "@/lib/hostProgram";
import { configOf } from "@/lib/programs";
import { fetchTweet, parseTweetId } from "@/lib/twitter";
import type { ProgramConfig } from "@/lib/programConfig";

type Params = { params: Promise<{ slug: string }> };

async function saveTweets(id: string, config: ProgramConfig, tweets: ProgramConfig["tweets"]) {
  await prisma.program.update({ where: { id }, data: { configJson: JSON.stringify({ ...config, tweets }) } });
}

// Lines up an X/Twitter post for the show: POST { url } fetches it now.
export async function POST(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  const body = await request.json().catch(() => null);
  const id = parseTweetId(typeof body?.url === "string" ? body.url : "");
  if (!id) return NextResponse.json({ error: "Cole o link de um post (x.com/.../status/...)" }, { status: 400 });
  try {
    const card = await fetchTweet(id);
    const config = configOf(program);
    const tweets = [card, ...config.tweets.filter((t) => t.id !== id)].slice(0, 30);
    await saveTweets(program.id, config, tweets);
    return NextResponse.json({ card, tweets });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha" }, { status: 502 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  const id = new URL(request.url).searchParams.get("id");
  const config = configOf(program);
  const tweets = id ? config.tweets.filter((t) => t.id !== id) : [];
  await saveTweets(program.id, config, tweets);
  return NextResponse.json({ tweets });
}
