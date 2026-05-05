"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getOrCreateUserId } from "@/lib/user-id";

type MatchPayload = {
  id: string;
  user_a: string;
  user_b: string;
  status: string;
};

export default function QueuePage() {
  const router = useRouter();
  const [status, setStatus] = useState("Finding opponent...");
  const hasMatchedRef = useRef(false);
  const userId = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return getOrCreateUserId();
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let active = true;

    async function joinAndTryMatch() {
      if (hasMatchedRef.current) {
        return;
      }

      try {
        const response = await fetch("/api/matchmake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });

        const data = (await response.json()) as {
          matched?: boolean;
          match?: MatchPayload | null;
          error?: string;
        };

        if (!active || hasMatchedRef.current) {
          return;
        }

        if (!response.ok) {
          setStatus(data.error ?? "Could not join queue. Retrying...");
          return;
        }

        if (data.match?.id) {
          hasMatchedRef.current = true;
          router.replace(`/match/${data.match.id}?u=${encodeURIComponent(userId)}`);
        }
      } catch {
        if (!active || hasMatchedRef.current) {
          return;
        }
        setStatus("Network issue while matchmaking. Retrying...");
      }
    }

    void joinAndTryMatch();

    const channel = supabase
      .channel(`queue-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `user_a=eq.${userId}`,
        },
        (payload) => {
          if (hasMatchedRef.current) {
            return;
          }
          const row = payload.new as MatchPayload;
          hasMatchedRef.current = true;
          router.replace(`/match/${row.id}?u=${encodeURIComponent(userId)}`);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `user_b=eq.${userId}`,
        },
        (payload) => {
          if (hasMatchedRef.current) {
            return;
          }
          const row = payload.new as MatchPayload;
          hasMatchedRef.current = true;
          router.replace(`/match/${row.id}?u=${encodeURIComponent(userId)}`);
        }
      )
      .subscribe();

    const pollingInterval = window.setInterval(() => {
      void joinAndTryMatch();
    }, 2500);

    return () => {
      active = false;
      window.clearInterval(pollingInterval);
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  return (
    <main className="arena-bg px-4 py-8 text-zinc-100">
      <div className="arena-shell text-center">
        <div className="arena-badge">
          <span className="arena-dot" />
          Matchmaking live
        </div>
        <h1 className="arena-title mt-6">Queue</h1>

        <div className="arena-card mx-auto mt-8 max-w-2xl px-7 py-10">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-300/85">
            Finding opponent
          </p>
          <p className="mt-4 text-xl font-semibold text-zinc-100">{status}</p>
          <div className="mx-auto mt-7 h-3 w-3 animate-ping rounded-full bg-violet-300" />
          <p className="arena-subtle mt-6 text-sm">
            Stay ready. Match will auto-start as soon as another player joins.
          </p>
        </div>
      </div>
    </main>
  );
}
