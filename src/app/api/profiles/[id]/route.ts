import { NextResponse } from "next/server";
import { DEFAULT_ELO, getRank } from "@/lib/elo";
import { assertSupabaseEnv, supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSupabaseEnv();
    const { id } = await params;

    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id, elo: DEFAULT_ELO }, { onConflict: "id", ignoreDuplicates: true });

    if (upsertError) {
      throw upsertError;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, elo")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const elo = typeof data.elo === "number" ? data.elo : DEFAULT_ELO;
    return NextResponse.json({ id: data.id, elo, rank: getRank(elo) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
