import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostSession } from "@/lib/auth";
import { getLiveState } from "@/lib/live";
import { listPrograms } from "@/lib/programs";
import { ChannelSettings, LogoutButton } from "./ChannelSettings";

export default async function DirectorHome() {
  if (!(await requireHostSession())) redirect("/login");

  const [programs, live] = await Promise.all([listPrograms(), getLiveState().catch(() => null)]);

  return (
    <main className="studio-bg w-full flex-1">
    <div className="mx-auto w-full max-w-5xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/debate-bacana.png" alt="Debate Bacana" className="h-16 w-auto drop-shadow-[0_0_14px_rgba(174,223,2,0.35)]" />
          <h1 className="text-3xl uppercase" style={{ fontFamily: "var(--font-display), Impact, sans-serif" }}>
            Área do Diretor
          </h1>
        </div>
        <LogoutButton />
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {programs.map((p) => {
          const isLive = live?.programSlug === p.slug;
          return (
            <Link
              key={p.id}
              href={`/diretor/${p.slug}`}
              className="studio-bar group relative overflow-hidden p-5 transition hover:!border-[rgba(174,223,2,0.5)]"
            >
              <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: p.primaryColor }} />
              {isLive && (
                <span className="absolute top-4 right-4 rounded bg-red-600 px-2 py-0.5 text-xs font-bold tracking-wide">
                  NO AR
                </span>
              )}
              <div className="flex h-20 items-center">
                {p.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logoUrl} alt="" className="max-h-20 max-w-full object-contain" />
                ) : (
                  <span className="text-3xl uppercase" style={{ fontFamily: "var(--font-display)", color: p.primaryColor }}>
                    {p.name}
                  </span>
                )}
              </div>
              <p className="mt-3 font-medium">{p.name}</p>
              <p className="text-sm text-neutral-400 group-hover:text-neutral-200">Abrir painel →</p>
            </Link>
          );
        })}
      </section>

      <section className="studio-bar p-5">
        <h2 className="mb-3 font-semibold">Canal do YouTube</h2>
        <ChannelSettings />
      </section>
    </div>
    </main>
  );
}
