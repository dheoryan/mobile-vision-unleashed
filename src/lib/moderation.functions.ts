import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ModerationStatus = "pending" | "resolved" | "dismissed";
export type ModerationDecision = "dismiss" | "hide_content" | "suspend_user";

export type ModerationReport = {
  id: string;
  reporter_id: string | null;
  target_kind: "post" | "user" | "comment";
  target_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  due_at: string;
  status: ModerationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  action: string | null;
  moderator_notes: string | null;
  target_deleted_at: string | null;
  reporter: { display_name: string; handle: string | null } | null;
  target_label: string;
  target_preview: string | null;
};

async function requireModerator(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
) {
  const { data, error } = await supabase.rpc("current_user_is_moderator");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Moderator access required");
}

export const getModerationAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.undefined().parse(input))
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("current_user_is_moderator");
    if (error) throw new Error(error.message);
    return { moderator: !!data };
  });

export const listModerationReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ status: z.enum(["pending", "resolved", "dismissed", "all"]).default("pending") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ModerationReport[]> => {
    const { supabase } = context;
    await requireModerator(supabase);

    let query = supabase
      .from("reports")
      .select("id, reporter_id, target_kind, target_id, reason, details, created_at, due_at, status, reviewed_by, reviewed_at, action, moderator_notes, target_deleted_at")
      .order("due_at", { ascending: true })
      .limit(100);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const reports = rows ?? [];
    const reporterIds = Array.from(new Set(reports.map((row) => row.reporter_id).filter(Boolean))) as string[];
    const userTargetIds = reports
      .filter((row) => row.target_kind === "user")
      .map((row) => row.target_id);
    const postIds = reports.filter((row) => row.target_kind === "post").map((row) => row.target_id);
    const commentIds = reports.filter((row) => row.target_kind === "comment").map((row) => row.target_id);

    const [reportersResult, usersResult, postsResult, commentsResult] = await Promise.all([
      reporterIds.length
        ? supabase.from("profiles").select("id, display_name, handle").in("id", reporterIds)
        : Promise.resolve({ data: [], error: null }),
      userTargetIds.length
        ? supabase.from("profiles").select("id, display_name, handle").in("id", userTargetIds)
        : Promise.resolve({ data: [], error: null }),
      postIds.length
        ? supabase.from("posts").select("id, content").in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      commentIds.length
        ? supabase.from("comments").select("id, content").in("id", commentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [reportersResult, usersResult, postsResult, commentsResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    const reporters = new Map((reportersResult.data ?? []).map((row) => [row.id, row]));
    const users = new Map((usersResult.data ?? []).map((row) => [row.id, row]));
    const posts = new Map((postsResult.data ?? []).map((row) => [row.id, row.content]));
    const comments = new Map((commentsResult.data ?? []).map((row) => [row.id, row.content]));

    return reports.map((row) => {
      const targetUser = users.get(row.target_id);
      const targetPreview =
        row.target_kind === "post"
          ? posts.get(row.target_id)
          : row.target_kind === "comment"
            ? comments.get(row.target_id)
            : targetUser
              ? `@${targetUser.handle ?? "user"}`
              : null;
      return {
        ...row,
        status: row.status as ModerationStatus,
        reporter: row.reporter_id ? (reporters.get(row.reporter_id) ?? null) : null,
        target_label:
          row.target_kind === "user"
            ? targetUser?.display_name || "Deleted or unavailable user"
            : `${row.target_kind} ${row.target_id.slice(0, 8)}`,
        target_preview: targetPreview ? targetPreview.slice(0, 280) : null,
      } as ModerationReport;
    });
  });

export const decideModerationReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      report_id: z.string().uuid(),
      decision: z.enum(["dismiss", "hide_content", "suspend_user"]),
      notes: z.string().max(1000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase.rpc("moderate_report", {
      report_id: data.report_id,
      decision: data.decision,
      notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return row;
  });
