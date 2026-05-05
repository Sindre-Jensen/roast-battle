"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ResultClient() {
  const searchParams = useSearchParams();
  const winner = searchParams.get("winner") === "you" ? "You" : "Opponent";
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
