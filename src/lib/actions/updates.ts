"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstError, formFields, isUuid, projectUpdateSchema } from "@/lib/validation";
import type { ActionResult } from "./auth";

function refresh(projectId: string) {
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/** Staff action: posts a project update (visible to the client, or internal). */
export async function createProjectUpdateAction(projectId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireStaff();
  if (!isUuid(projectId)) return { ok: false, error: "Project not found." };
  const parsed = projectUpdateSchema.safeParse(formFields(formData, ["body", "visibility"] as const));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_updates")
    .insert({ ...parsed.data, project_id: projectId, author_id: session.userId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not post the update. Please try again." };

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "project_update",
    entity_id: data.id,
    action: "update.posted",
    details: { project_id: projectId, visibility: parsed.data.visibility },
  });

  refresh(projectId);
  return {
    ok: true,
    message: parsed.data.visibility === "client" ? "Update posted. The client can see it." : "Internal note posted.",
  };
}

/** Staff action: deletes an update. Authors can delete their own; admins can delete any. */
export async function deleteProjectUpdateAction(updateId: string): Promise<ActionResult> {
  const session = await requireStaff();
  if (!isUuid(updateId)) return { ok: false, error: "Update not found." };

  const supabase = await createClient();
  const { data: update } = await supabase
    .from("project_updates")
    .select("project_id, author_id")
    .eq("id", updateId)
    .maybeSingle();
  if (!update) return { ok: false, error: "Update not found." };
  if (update.author_id !== session.userId && session.profile.role !== "admin") {
    return { ok: false, error: "Only the author or an admin can delete this update." };
  }

  const { error } = await supabase.from("project_updates").delete().eq("id", updateId);
  if (error) return { ok: false, error: "Could not delete the update." };

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "project_update",
    entity_id: updateId,
    action: "update.deleted",
    details: { project_id: update.project_id },
  });

  refresh(update.project_id as string);
  return { ok: true, message: "Update deleted." };
}
