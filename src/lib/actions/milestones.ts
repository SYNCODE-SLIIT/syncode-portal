"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MilestoneStatus } from "@/lib/types/database";
import { firstError, formFields, isUuid, milestoneSchema } from "@/lib/validation";
import type { ActionResult } from "./auth";

const MILESTONE_FIELDS = ["title", "description", "status", "percent", "weight", "due_date"] as const;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function projectIdOf(supabase: SupabaseServerClient, milestoneId: string): Promise<string | null> {
  if (!isUuid(milestoneId)) return null;
  const { data } = await supabase.from("milestones").select("project_id").eq("id", milestoneId).maybeSingle();
  return (data?.project_id as string | undefined) ?? null;
}

function refresh(projectId: string) {
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/admin/projects");
  revalidatePath("/dashboard");
}

/** Staff action: adds a milestone at the end of the project's list. */
export async function createMilestoneAction(projectId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireStaff();
  if (!isUuid(projectId)) return { ok: false, error: "Project not found." };
  const parsed = milestoneSchema.safeParse(formFields(formData, MILESTONE_FIELDS));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("milestones")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("milestones")
    .insert({ ...parsed.data, project_id: projectId, position: ((last?.position as number | undefined) ?? -1) + 1 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not add the milestone. Please try again." };

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "milestone",
    entity_id: data.id,
    action: "milestone.created",
    details: { project_id: projectId, title: parsed.data.title },
  });

  refresh(projectId);
  return { ok: true, message: "Milestone added." };
}

/** Staff action: edits a milestone. */
export async function updateMilestoneAction(milestoneId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireStaff();
  const parsed = milestoneSchema.safeParse(formFields(formData, MILESTONE_FIELDS));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const projectId = await projectIdOf(supabase, milestoneId);
  if (!projectId) return { ok: false, error: "Milestone not found." };

  const { error } = await supabase.from("milestones").update(parsed.data).eq("id", milestoneId);
  if (error) return { ok: false, error: "Could not save the milestone. Please try again." };

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "milestone",
    entity_id: milestoneId,
    action: "milestone.updated",
    details: { project_id: projectId, title: parsed.data.title, status: parsed.data.status, percent: parsed.data.percent },
  });

  refresh(projectId);
  return { ok: true, message: "Milestone saved." };
}

/** Staff action: quick status change from the milestone list. */
export async function setMilestoneStatusAction(milestoneId: string, status: MilestoneStatus): Promise<ActionResult> {
  const session = await requireStaff();
  if (!["not_started", "in_progress", "done"].includes(status)) return { ok: false, error: "Unknown status." };

  const supabase = await createClient();
  const projectId = await projectIdOf(supabase, milestoneId);
  if (!projectId) return { ok: false, error: "Milestone not found." };

  // The database sets percent to 100 for done and 0 for not started
  const { error } = await supabase.from("milestones").update({ status }).eq("id", milestoneId);
  if (error) return { ok: false, error: "Could not update the milestone." };

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "milestone",
    entity_id: milestoneId,
    action: status === "done" ? "milestone.completed" : "milestone.updated",
    details: { project_id: projectId, status },
  });

  refresh(projectId);
  return { ok: true };
}

/** Staff action: moves a milestone one place up or down. */
export async function moveMilestoneAction(milestoneId: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireStaff();
  const supabase = await createClient();
  const projectId = await projectIdOf(supabase, milestoneId);
  if (!projectId) return { ok: false, error: "Milestone not found." };

  const { data: rows } = await supabase
    .from("milestones")
    .select("id")
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const ids = (rows ?? []).map((r) => r.id as string);
  const index = ids.indexOf(milestoneId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return { ok: true };

  [ids[index], ids[target]] = [ids[target], ids[index]];
  // Rewrite positions 0..n so the order stays consistent even if old positions had gaps or duplicates
  const results = await Promise.all(ids.map((id, position) => supabase.from("milestones").update({ position }).eq("id", id)));
  if (results.some((r) => r.error)) return { ok: false, error: "Could not reorder the milestones." };

  refresh(projectId);
  return { ok: true };
}

/** Staff action: deletes a milestone. */
export async function deleteMilestoneAction(milestoneId: string): Promise<ActionResult> {
  const session = await requireStaff();
  const supabase = await createClient();
  const projectId = await projectIdOf(supabase, milestoneId);
  if (!projectId) return { ok: false, error: "Milestone not found." };

  const { data: deleted, error } = await supabase.from("milestones").delete().eq("id", milestoneId).select("title").maybeSingle();
  if (error) return { ok: false, error: "Could not delete the milestone." };

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "milestone",
    entity_id: milestoneId,
    action: "milestone.deleted",
    details: { project_id: projectId, title: deleted?.title ?? null },
  });

  refresh(projectId);
  return { ok: true, message: "Milestone deleted." };
}
