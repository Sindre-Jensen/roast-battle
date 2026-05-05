"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ResultClient() {
  const searchParams = useSearchParams();
  const winner = searchParams.get("winner") === "you" ? "You" : "Opponent";
  const yourElo = searchParams.get("yourElo");
  const opponentElo = searchParams.get("opponentElo");
  const yourRank = searchParams.get("yourRank");
  const opponentRank = searchParams.get("opponentRank");
  const roastLine =
    winner === "You" ? "You served pure heat 🔥" : "You got cooked 🔥";

  return (
    <main className="arena-bg px-4 py-8 text-zinc-100">
      <div className="arena-shell text-center">
        <div className="arena-badge">
          <span className="arena-dot" />
          Battle complete
        </div>

        <h1 className="arena-title mt-7">Results</h1>

        <section className="arena-card mx-auto mt-8 max-w-2xl px-7 py-10">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-300/80">
            Arena verdict
          </p>
          <h2 className="mt-3 text-4xl font-black uppercase">Winner: {winner}</h2>
          <p className="mt-4 text-lg text-orange-200">{roastLine}</p>
          {(yourElo || opponentElo) && (
            <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-xl border border-white/15 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.15em] text-zinc-300">You</p>
                <p className="mt-1 text-lg font-bold text-zinc-100">
                  ELO: {yourElo ?? "N/A"}
                </p>
                <p className="text-sm text-orange-200">{yourRank ?? "NPC"}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.15em] text-zinc-300">
                  Opponent
                </p>
                <p className="mt-1 text-lg font-bold text-zinc-100">
                  ELO: {opponentElo ?? "N/A"}
                </p>
                <p className="text-sm text-orange-200">{opponentRank ?? "NPC"}</p>
              </div>
            </div>
          )}

          <Link
            href="/queue"
            className="arena-btn mt-8 inline-flex w-full items-center justify-center px-5 py-3.5 text-base"
          >
            Run it back
          </Link>
        </section>
      </div>
    </main>
  );
}
