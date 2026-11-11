import { NextResponse } from "next/server";
import { IngressInput, type IngressInfo } from "livekit-server-sdk";
import { hostProgram } from "@/lib/hostProgram";
import { getIngressClient, ingressEndpoints } from "@/lib/livekit";
import { roomForProgram } from "@/lib/programs";

type Params = { params: Promise<{ slug: string }> };

// IngressState.Status values from the LiveKit protocol.
const STATUS = ["aguardando o OBS", "conectando", "recebendo", "erro", "encerrado"];

function present(info: IngressInfo | undefined) {
  if (!info) return null;
  const endpoints = ingressEndpoints();
  const whip = info.inputType === IngressInput.WHIP_INPUT;
  return {
    type: whip ? "whip" : "rtmp",
    server: whip ? endpoints.whip : endpoints.rtmp,
    streamKey: info.streamKey,
    status: STATUS[info.state?.status ?? 0] ?? "desconhecido",
    error: info.state?.error || null,
  };
}

async function programIngresses(slug: string) {
  return getIngressClient().listIngress({ roomName: roomForProgram(slug) });
}

export async function GET(_request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  try {
    const [info] = await programIngresses(program.slug);
    return NextResponse.json({ obs: present(info) });
  } catch (err) {
    return NextResponse.json({ error: `Ingress indisponível: ${err instanceof Error ? err.message : err}` }, { status: 502 });
  }
}

// Creates (or replaces) the program's OBS input.
export async function POST(request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const whip = body?.type !== "rtmp";
  try {
    const client = getIngressClient();
    for (const old of await programIngresses(program.slug)) await client.deleteIngress(old.ingressId);
    const info = await client.createIngress(whip ? IngressInput.WHIP_INPUT : IngressInput.RTMP_INPUT, {
      name: `OBS ${program.name}`,
      roomName: roomForProgram(program.slug),
      participantIdentity: `obs-${program.slug}`,
      participantName: "OBS",
      // WHIP passes OBS's encode straight through (no server CPU); RTMP must transcode.
      enableTranscoding: !whip,
    });
    return NextResponse.json({ obs: present(info) });
  } catch (err) {
    return NextResponse.json({ error: `Falha ao criar entrada do OBS: ${err instanceof Error ? err.message : err}` }, { status: 502 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { program, error } = await hostProgram(params);
  if (error) return error;
  const client = getIngressClient();
  for (const old of await programIngresses(program.slug)) await client.deleteIngress(old.ingressId);
  return NextResponse.json({ ok: true });
}
