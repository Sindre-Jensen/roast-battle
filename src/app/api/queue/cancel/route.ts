import { NextResponse } from "next/server";
import {
  assertSupabaseEnv,
  assertSupabaseServiceRoleEnv,
  supabaseServer,
} from "@/lib/supabase";

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

    const { error } = await supabaseServer
      .from("queue")
      .delete()
      .eq("id", userId)
      .eq("status", "waiting");

    if (error) {
      throw error;
    }

    return NextResponse.json({ cancelled: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel queue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
