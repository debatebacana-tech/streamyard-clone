import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { recordingPath } from "@/lib/recording";

// Download of one recording (streamed, files can be gigabytes).
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await requireHostSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { name } = await params;
  const file = recordingPath(name);
  const st = file ? await stat(file).catch(() => null) : null;
  if (!file || !st?.isFile()) return NextResponse.json({ error: "Gravação não encontrada" }, { status: 404 });
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(st.size),
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
