import { NextResponse } from "next/server";
import { requireHostSession } from "@/lib/auth";
import { COMPETITIONS, fetchBracket, fetchMatches, fetchStandings } from "@/lib/football";

// Director-only: round fixtures or standings for the board screens.
// GET ?competition=bra.1&kind=tabela | &kind=jogos&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: Request) {
  if (!(await requireHostSession())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const id = q.get("competition") ?? "";
  if (!q.get("kind")) return NextResponse.json({ competitions: COMPETITIONS });
  try {
    if (q.get("kind") === "tabela") return NextResponse.json(await fetchStandings(id));
    if (q.get("kind") === "chave") return NextResponse.json(await fetchBracket(id));
    return NextResponse.json(await fetchMatches(id, q.get("from") ?? "", q.get("to") ?? ""));
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return NextResponse.json(
      { error: message.startsWith("ESPN") || message.startsWith("ge ") ? "Não consegui buscar os dados agora (tente de novo em instantes)" : message || "Falha" },
      { status: 502 },
    );
  }
}
