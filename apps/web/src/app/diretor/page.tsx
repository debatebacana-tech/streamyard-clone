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
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Área do Diretor</h1>
        <LogoutButton />
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {programs.map((p) => {
          const isLive = live?.programSlug === p.slug;
          return (
            <Link
              key={p.id}
              href={`/diretor/${p.slug}`}
              className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition hover:border-neutral-600"
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

      <section className="rounded-xl border border-neutral-800 p-5">
        <h2 className="mb-3 font-semibold">Canal do YouTube</h2>
        <ChannelSettings />
      </section>
    </main>
  );
}
