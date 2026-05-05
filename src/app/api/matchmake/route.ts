import { NextResponse } from "next/server";
import { insertUserIntoQueue, runFifoMatchmaking } from "@/lib/matchmaking";
import { assertSupabaseEnv, supabase } from "@/lib/supabase";

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

    const body = (await request.json()) as { userId?: string };
    const userId = body.userId?.trim();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId in request body" },
        { status: 400 }
      );
    }

    // If user already has an active match, keep returning it during polling.
    const { data: existingActiveMatch, error: existingActiveMatchError } = await supabase
      .from("matches")
      .select("id, user_a, user_b, status")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (existingActiveMatchError) {
      throw existingActiveMatchError;
    }

    if (existingActiveMatch) {
      return NextResponse.json({ matched: true, match: existingActiveMatch });
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
