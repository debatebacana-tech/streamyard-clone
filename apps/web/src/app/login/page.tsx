"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      // Back to where the login was asked for (e.g. the phone control page).
      const next = new URLSearchParams(window.location.search).get("next") ?? "";
      if (/^\/(diretor|controle)(\/[\w-]*)?$/.test(next)) {
        // Full load: the client router may still hold the redirect to /login.
        window.location.assign(next);
        return;
      }
      router.push("/diretor");
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Falha ao entrar");
      setLoading(false);
    }
  }

  return (
    <main className="studio-bg flex flex-1 items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="studio-bar w-full max-w-sm space-y-4 p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/debate-bacana.png" alt="Debate Bacana" className="mx-auto h-24 w-auto drop-shadow-[0_0_16px_rgba(174,223,2,0.4)]" />
        <h1 className="text-center text-2xl uppercase" style={{ fontFamily: "var(--font-display), Impact, sans-serif" }}>
          Área do Diretor
        </h1>
        <input
          type="password"
          autoFocus
          placeholder="Senha do diretor"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[var(--db-lime)] px-3 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
