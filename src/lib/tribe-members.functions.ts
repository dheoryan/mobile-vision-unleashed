import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TribeMemberSummary } from "@/lib/tribe-members";

const MEMBER_COLUMNS = "id, display_name, handle, avatar_emoji, avatar_url";
const MEMBER_PAGE_SIZE = 200;

export const listTribeMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tribe_id: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: viewer, error: viewerError } = await supabase
      .from("profiles")
      .select("tribe_ids")
      .eq("id", userId)
      .single();
    if (viewerError) throw new Error(viewerError.message);
    if (!(viewer.tribe_ids ?? []).includes(data.tribe_id)) {
      throw new Error("Join this Tribe to see its members.");
    }

    const {
      data: rows,
      count,
      error,
    } = await supabase
      .from("profiles")
      .select(MEMBER_COLUMNS, { count: "exact" })
      .contains("tribe_ids", [data.tribe_id])
      .order("display_name", { ascending: true })
      .limit(MEMBER_PAGE_SIZE);
    if (error) throw new Error(error.message);

    const members = (rows ?? []).map((row) => ({
      id: row.id,
      display_name: row.display_name?.trim() || row.handle || "Member",
      handle: row.handle,
      avatar_emoji: row.avatar_emoji,
      avatar_url: row.avatar_url,
    })) satisfies TribeMemberSummary[];

    return {
      members,
      total: count ?? rows?.length ?? 0,
      has_more: (count ?? 0) > MEMBER_PAGE_SIZE,
    };
  });
