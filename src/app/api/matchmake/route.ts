import { NextResponse } from "next/server";
import { insertUserIntoQueue, runFifoMatchmaking } from "@/lib/matchmaking";
import {
  assertSupabaseEnv,
  assertSupabaseServiceRoleEnv,
  supabaseServer,
} from "@/lib/supabase";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Failed to run matchmaking";
}

export async function POST(request: Request) {
  try {
    assertSupabaseEnv();
    assertSupabaseServiceRoleEnv();

    const body = (await request.json()) as { userId?: string };
    const userId = body.userId?.trim();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId in request body" },
        { status: 400 }
      );
    }

    // If user already has an active match, keep returning it during polling.
    const { data: existingActiveMatch, error: existingActiveMatchError } =
      await supabaseServer
      .from("matches")
      .select("id, user_a, user_b, status, created_at")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingActiveMatchError) {
      throw existingActiveMatchError;
    }

    if (existingActiveMatch) {
      const createdAtRaw = (existingActiveMatch as { created_at?: string }).created_at;
      const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : NaN;
      const isRecentActiveMatch =
        Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 3 * 60 * 1000;

      if (isRecentActiveMatch) {
        return NextResponse.json({ matched: true, match: existingActiveMatch });
      }

      // Auto-expire stale active matches to avoid ghost rejoin loops.
      const { error: staleCloseError } = await supabaseServer
        .from("matches")
        .update({ status: "ended" })
        .eq("id", existingActiveMatch.id)
        .eq("status", "active");

      if (staleCloseError) {
        throw staleCloseError;
      }
    }

    await insertUserIntoQueue(userId);
    const newMatch = await runFifoMatchmaking();

    if (!newMatch) {
      return NextResponse.json({
        matched: false,
        match: null,
      });
    }

    return NextResponse.json({ matched: true, match: newMatch });
  } catch (error) {
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
