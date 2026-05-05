import Link from "next/link";

export default function Home() {
  return (
    <main className="arena-bg px-4 py-8 text-center text-zinc-100">
      <div className="arena-shell">
        <div className="arena-badge">
          <span className="arena-dot" />
          Live 1v1 Roast Arena
        </div>

        <h1 className="arena-title mt-7">FLAMEGLE</h1>

        <div className="arena-badge mt-5">
          <span className="arena-dot" />
          Real-time chaos online
        </div>

        <section className="arena-card mx-auto mt-8 max-w-2xl px-7 py-10">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-300/80">
            Enter the arena
          </p>
          <h2 className="mt-3 text-4xl font-black uppercase tracking-tight">
            Start Camera Check
          </h2>
          <p className="arena-subtle mx-auto mt-4 max-w-lg text-sm">
            Get matched with a random opponent, run two 30-second roast rounds,
            and let fate pick the winner.
          </p>

          <Link
            href="/queue"
            className="arena-btn mt-8 inline-flex w-full items-center justify-center px-5 py-3.5 text-base"
          >
            Start Roast Battle
          </Link>
        </section>
      </div>
    </main>
  );
}
