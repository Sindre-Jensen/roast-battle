import { supabase } from "./supabase";
import { DEFAULT_ELO } from "./elo";

const ACTIVE_QUEUE_WINDOW_SECONDS = 10;

export type QueueRow = {
  id: string;
  created_at: string;
  status: "waiting" | "matched";
};

export type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  status: string;
};

export async function insertUserIntoQueue(userId: string) {
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      elo: DEFAULT_ELO,
    },
    {
      onConflict: "id",
      ignoreDuplicates: true,
    }
  );

  if (profileError) {
    throw profileError;
  }

  const { error } = await supabase.from("queue").insert({
    id: userId,
    status: "waiting",
  });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    throw error;
  }

  if (error && error.message.toLowerCase().includes("duplicate")) {
    const { error: updateError } = await supabase
      .from("queue")
      .update({
        status: "waiting",
        // Treat repeated queue pings as heartbeat for active matchmaking.
        created_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      throw updateError;
    }
  }
}

export async function fetchTwoWaitingUsers() {
  const activeCutoff = new Date(
    Date.now() - ACTIVE_QUEUE_WINDOW_SECONDS * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("queue")
    .select("id, created_at, status")
    .eq("status", "waiting")
    .gte("created_at", activeCutoff)
    .order("created_at", { ascending: true })
    .limit(2);

  if (error) {
    throw error;
  }

  return (data ?? []) as QueueRow[];
}

export async function cleanupStaleWaitingUsers() {
  const staleCutoff = new Date(
    Date.now() - ACTIVE_QUEUE_WINDOW_SECONDS * 1000
  ).toISOString();

  const { error } = await supabase
    .from("queue")
    .delete()
    .eq("status", "waiting")
    .lt("created_at", staleCutoff);

  if (error) {
    throw error;
  }
}

export async function createMatchAndMarkUsersMatched(
  userA: string,
  userB: string
) {
  const activeCutoff = new Date(
    Date.now() - ACTIVE_QUEUE_WINDOW_SECONDS * 1000
  ).toISOString();

  const { data: claimedUsers, error: claimError } = await supabase
    .from("queue")
    .update({ status: "matched" })
    .in("id", [userA, userB])
    .eq("status", "waiting")
    .gte("created_at", activeCutoff)
    .select("id");

  if (claimError) {
    throw claimError;
  }

  if ((claimedUsers ?? []).length < 2) {
    return null;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("matches")
    .insert({
      user_a: userA,
      user_b: userB,
      status: "active",
    })
    .select("id, user_a, user_b, status")
    .single();

  if (insertError) {
    const { error: rollbackError } = await supabase
      .from("queue")
      .update({ status: "waiting" })
      .in("id", [userA, userB]);

    if (rollbackError) {
      throw rollbackError;
    }

    throw insertError;
  }

  return inserted as MatchRow;
}

export async function runFifoMatchmaking() {
  await cleanupStaleWaitingUsers();

  const waiting = await fetchTwoWaitingUsers();

  if (waiting.length < 2) {
    return null;
  }

  const [first, second] = waiting;

  const { data: stillWaiting, error: guardError } = await supabase
    .from("queue")
    .select("id")
    .in("id", [first.id, second.id])
    .eq("status", "waiting");

  if (guardError) {
    throw guardError;
  }

  if ((stillWaiting ?? []).length < 2) {
    return null;
  }

  return createMatchAndMarkUsersMatched(first.id, second.id);
}
