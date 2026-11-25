import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listPrograms, syncProgramRoom } from "@/lib/programs";

const unauthorized = () => NextResponse.json({ error: "Não autorizado" }, { status: 401 });

export async function GET() {
  if (!(await requireHostSession())) return unauthorized();
  const settings = await prisma.showSettings.findUnique({ where: { id: "default" } });
  return NextResponse.json({ logoUrl: settings?.logoUrl ?? null });
}

// The Debate Bacana signature, shown by every program without its own logo.
export async function POST(request: Request) {
  if (!(await requireHostSession())) return unauthorized();
  const body = await request.json().catch(() => null);
  const logoUrl =
    typeof body?.logoUrl === "string" && body.logoUrl.startsWith("/media/") && body.logoUrl.length <= 200
      ? body.logoUrl
      : null;
  await prisma.showSettings.upsert({
    where: { id: "default" },
    create: { id: "default", logoUrl },
    update: { logoUrl },
  });
  // Rooms that exist pick up the new logo now; others get it when they open.
  await Promise.allSettled((await listPrograms()).map((p) => syncProgramRoom(p)));
  return NextResponse.json({ logoUrl });
}
