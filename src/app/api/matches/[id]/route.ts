import { NextResponse } from "next/server";
import {
  assertSupabaseEnv,
  assertSupabaseServiceRoleEnv,
  supabaseServer,
} from "@/lib/supabase";
import { DEFAULT_ELO, getNewElo, getRank } from "@/lib/elo";

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

  return "Failed to fetch match";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSupabaseEnv();
    assertSupabaseServiceRoleEnv();

    const { id } = await params;
    const { data, error } = await supabaseServer
      .from("matches")
      .select("id, user_a, user_b, status")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ match: data });
  } catch (error) {
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type MatchData = {
  id: string;
  user_a: string;
  user_b: string;
  status: string;
  winner_user_id: string | null;
};

type ProfileRow = {
  id: string;
  elo: number | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSupabaseEnv();
    assertSupabaseServiceRoleEnv();

    const body = (await request.json()) as { winnerUserId?: string };
    const winnerUserId = body.winnerUserId?.trim();
    if (!winnerUserId) {
      return NextResponse.json(
        { error: "Missing winnerUserId in request body" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const { data: match, error: matchError } = await supabaseServer
      .from("matches")
      .select("id, user_a, user_b, status, winner_user_id")
      .eq("id", id)
      .maybeSingle<MatchData>();

    if (matchError || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (winnerUserId !== match.user_a && winnerUserId !== match.user_b) {
      return NextResponse.json(
        { error: "winnerUserId must be one of the match players" },
        { status: 400 }
      );
    }

    const loserUserId = winnerUserId === match.user_a ? match.user_b : match.user_a;

    const { error: ensureProfilesError } = await supabaseServer.from("profiles").upsert(
      [
        { id: winnerUserId, elo: DEFAULT_ELO },
        { id: loserUserId, elo: DEFAULT_ELO },
      ],
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (ensureProfilesError) {
      throw ensureProfilesError;
    }

    const { data: finalized, error: finalizeError } = await supabaseServer
      .from("matches")
      .update({
        status: "ended",
        winner_user_id: winnerUserId,
      })
      .eq("id", id)
      .eq("status", "active")
      .select("id, user_a, user_b, status, winner_user_id")
      .maybeSingle<MatchData>();

    if (finalizeError) {
      throw finalizeError;
    }

    if (finalized) {
      const { data: currentProfiles, error: profilesError } = await supabaseServer
        .from("profiles")
        .select("id, elo")
        .in("id", [winnerUserId, loserUserId]);

      if (profilesError) {
        throw profilesError;
      }

      const byId = new Map(
        ((currentProfiles ?? []) as ProfileRow[]).map((row) => [
          row.id,
          row.elo ?? DEFAULT_ELO,
        ])
      );

      const winnerCurrentElo = byId.get(winnerUserId) ?? DEFAULT_ELO;
      const loserCurrentElo = byId.get(loserUserId) ?? DEFAULT_ELO;
      const winnerElo = getNewElo(winnerCurrentElo, true);
      const loserElo = getNewElo(loserCurrentElo, false);

      const { error: winnerUpdateError } = await supabaseServer
        .from("profiles")
        .update({ elo: winnerElo })
        .eq("id", winnerUserId);

      if (winnerUpdateError) {
        throw winnerUpdateError;
      }

      const { error: loserUpdateError } = await supabaseServer
        .from("profiles")
        .update({ elo: loserElo })
        .eq("id", loserUserId);

      if (loserUpdateError) {
        throw loserUpdateError;
      }

      return NextResponse.json({
        match: finalized,
        winnerUserId,
        loserUserId,
        winnerEloBefore: winnerCurrentElo,
        winnerEloAfter: winnerElo,
        loserEloBefore: loserCurrentElo,
        loserEloAfter: loserElo,
        winnerRank: getRank(winnerElo),
        loserRank: getRank(loserElo),
      });
    }

    const { data: endedMatch, error: endedMatchError } = await supabaseServer
      .from("matches")
      .select("id, user_a, user_b, status, winner_user_id")
      .eq("id", id)
      .maybeSingle<MatchData>();

    if (endedMatchError || !endedMatch || !endedMatch.winner_user_id) {
      return NextResponse.json(
        { error: "Match was already finalized without winner data" },
        { status: 409 }
      );
    }

    const endedLoserUserId =
      endedMatch.winner_user_id === endedMatch.user_a
        ? endedMatch.user_b
        : endedMatch.user_a;

    const { data: endedProfiles, error: endedProfilesError } = await supabaseServer
      .from("profiles")
      .select("id, elo")
      .in("id", [endedMatch.winner_user_id, endedLoserUserId]);

    if (endedProfilesError) {
      throw endedProfilesError;
    }

    const endedById = new Map(
      ((endedProfiles ?? []) as ProfileRow[]).map((row) => [
        row.id,
        row.elo ?? DEFAULT_ELO,
      ])
    );

    const endedWinnerElo =
      endedById.get(endedMatch.winner_user_id) ?? DEFAULT_ELO;
    const endedLoserElo = endedById.get(endedLoserUserId) ?? DEFAULT_ELO;

    return NextResponse.json({
      match: endedMatch,
      winnerUserId: endedMatch.winner_user_id,
      loserUserId: endedLoserUserId,
      winnerEloBefore: Math.max(0, endedWinnerElo - 15),
      winnerEloAfter: endedWinnerElo,
      loserEloBefore: endedLoserElo + 15,
      loserEloAfter: endedLoserElo,
      winnerRank: getRank(endedWinnerElo),
      loserRank: getRank(endedLoserElo),
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
