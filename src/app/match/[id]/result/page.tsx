"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const VIRAL_CAPTIONS = [
  "Aura difference was insane",
  "This was not close",
  "You violated them verbally",
  "Chat is still recovering",
  "Absolute demolition",
];

function toNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function MatchResultPage() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 40);
    return () => window.clearTimeout(id);
  }, []);

  const didWin = searchParams.get("winner") === "you";
  const heroText = didWin ? "YOU COOKED THEM 🔥" : "YOU GOT COOKED 💀";

  const yourEloBefore = toNumber(searchParams.get("yourEloBefore"));
  const yourEloAfter = toNumber(searchParams.get("yourEloAfter"));
  const opponentEloBefore = toNumber(searchParams.get("opponentEloBefore"));
  const opponentEloAfter = toNumber(searchParams.get("opponentEloAfter"));
  const yourRank = searchParams.get("yourRank") ?? "NPC";
  const opponentRank = searchParams.get("opponentRank") ?? "NPC";

  const caption = useMemo(() => {
    const index = Math.floor(Math.random() * VIRAL_CAPTIONS.length);
    return VIRAL_CAPTIONS[index];
  }, []);

  return (
    <main className="arena-bg min-h-screen px-4 py-8 text-zinc-100">
      <div
        className={`mx-auto w-full max-w-3xl transition-all duration-500 ${
          show ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"
        }`}
      >
        <section className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Match Result
          </p>
          <h1
            className={`mt-4 text-5xl font-black uppercase leading-[0.95] tracking-[-0.03em] sm:text-6xl ${
              didWin
                ? "text-lime-300 drop-shadow-[0_0_24px_rgba(163,230,53,0.6)]"
                : "text-rose-300 drop-shadow-[0_0_24px_rgba(251,113,133,0.6)]"
            }`}
          >
            {heroText}
          </h1>
        </section>

        <section className="arena-card mt-8 space-y-5 p-5 sm:p-7">
          <p className="text-center text-xs uppercase tracking-[0.26em] text-zinc-300/80">
            ELO Change
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/15 bg-black/25 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">You</p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">
                {yourEloBefore ?? "?"} {"->"} {yourEloAfter ?? "?"}
              </p>
              <p
                className={`mt-2 text-xl font-black ${
                  didWin ? "text-lime-300" : "text-rose-300"
                }`}
              >
                {didWin ? "+15 ELO" : "-15 ELO"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-black/25 p-4 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Opponent</p>
              <p className="mt-2 text-2xl font-black sm:text-3xl">
                {opponentEloBefore ?? "?"} {"->"} {opponentEloAfter ?? "?"}
              </p>
              <p
                className={`mt-2 text-xl font-black ${
                  didWin ? "text-rose-300" : "text-lime-300"
                }`}
              >
                {didWin ? "-15 ELO" : "+15 ELO"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">You</p>
            <p className="mt-2 text-3xl font-black text-zinc-100">
              {yourEloAfter ?? "?"}
            </p>
            <p className="mt-1 text-sm uppercase tracking-[0.18em] text-zinc-300">
              {yourRank}
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-black/25 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Opponent</p>
            <p className="mt-2 text-3xl font-black text-zinc-100">
              {opponentEloAfter ?? "?"}
            </p>
            <p className="mt-1 text-sm uppercase tracking-[0.18em] text-zinc-300">
              {opponentRank}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/15 bg-black/30 p-5 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Clip Moment</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-orange-200 sm:text-3xl">
            "{caption}"
          </p>
        </section>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/queue"
            className="inline-flex items-center justify-center rounded-xl border border-orange-300/60 bg-gradient-to-r from-orange-600 to-orange-400 px-5 py-3 text-base font-black uppercase tracking-[0.08em] text-zinc-50"
          >
            Run it back
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-base font-black uppercase tracking-[0.08em] text-zinc-100"
          >
            Back to main menu
          </Link>
        </div>
      </div>
    </main>
  );
}
