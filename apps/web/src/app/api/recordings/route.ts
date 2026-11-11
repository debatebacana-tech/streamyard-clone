import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { deleteRecording, getRecordingState, listRecordings } from "@/lib/recording";

// The recordings on the server, with the free space left.
export async function GET() {
  if (!(await requireHostSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const [list, rec] = await Promise.all([listRecordings(), getRecordingState()]);
  return NextResponse.json({ ...list, inProgress: rec.file });
}

export async function DELETE(request: Request) {
  if (!(await requireHostSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const name = new URL(request.url).searchParams.get("name") ?? "";
  const rec = await getRecordingState();
  if (rec.file === name) return NextResponse.json({ error: "Essa gravação ainda está em andamento" }, { status: 409 });
  try {
    await deleteRecording(name);
  } catch (err) {
    console.error("delete recording", err);
    return NextResponse.json({ error: "Não consegui apagar esse arquivo no servidor" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
