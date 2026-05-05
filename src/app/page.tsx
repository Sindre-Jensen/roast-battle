 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getOrCreateUserId } from "@/lib/user-id";
import { DEFAULT_ELO, getRank } from "@/lib/elo";

const LOCAL_ELO_KEY = "roast-battle-elo";
const LOCAL_RANK_KEY = "roast-battle-rank";

export default function Home() {
  const [elo, setElo] = useState<number | null>(null);
  const [rank, setRank] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    setUserId(getOrCreateUserId());
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;
    const fallbackEloRaw = window.localStorage.getItem(LOCAL_ELO_KEY);
    const fallbackElo = fallbackEloRaw ? Number(fallbackEloRaw) : DEFAULT_ELO;
    if (Number.isFinite(fallbackElo)) {
      setElo(fallbackElo);
      setRank(getRank(fallbackElo));
    } else {
      setElo(DEFAULT_ELO);
      setRank(getRank(DEFAULT_ELO));
    }

    const fallbackRank = window.localStorage.getItem(LOCAL_RANK_KEY);
    if (fallbackRank) {
      setRank(fallbackRank);
    }

    async function loadProfile() {
      try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(userId)}`);
        if (!response.ok) return;
        const data = (await response.json()) as { elo?: number; rank?: string };
        if (cancelled) return;
        if (typeof data.elo === "number") {
          setElo(data.elo);
          window.localStorage.setItem(LOCAL_ELO_KEY, String(data.elo));
        }
        if (typeof data.rank === "string") {
          setRank(data.rank);
          window.localStorage.setItem(LOCAL_RANK_KEY, data.rank);
        }
      } catch {
        // Keep home page usable even if profile fetch fails.
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
          <div className="mx-auto mb-5 inline-flex items-center gap-3 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-200">
            <span className="text-zinc-400">Your Elo</span>
            <span className="font-black text-zinc-50">{elo ?? "..."}</span>
            <span className="rounded-full border border-orange-300/40 bg-orange-400/15 px-2 py-0.5 text-[10px] tracking-[0.15em] text-orange-200">
              {rank || "NPC"}
            </span>
          </div>
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
