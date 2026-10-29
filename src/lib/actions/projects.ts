"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstError, formFields, projectSchema, type ProjectInput } from "@/lib/validation";
import type { ActionResult } from "./auth";

const PROJECT_FIELDS = [
  "client_id",
  "name",
  "type",
  "status",
  "description",
  "live_url",
  "staging_url",
  "repo_url",
  "start_date",
  "target_date",
  "progress_mode",
  "manual_progress",
] as const;

function parseProject(formData: FormData) {
  return projectSchema.safeParse({
    ...formFields(formData, PROJECT_FIELDS),
    member_ids: formData.getAll("member_ids").map(String),
  });
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Keeps only active staff in the member list, so clients can never be assigned. */
async function validStaffIds(supabase: SupabaseServerClient, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("id", ids)
    .in("role", ["admin", "team"])
    .eq("is_active", true);
  return (data ?? []).map((row) => row.id as string);
}

/** The columns of the projects table. Team members and the repository link are stored separately. */
function projectRow(input: ProjectInput): Omit<ProjectInput, "member_ids" | "repo_url"> {
  const row: Partial<ProjectInput> = { ...input };
  delete row.member_ids;
  delete row.repo_url;
  return row as Omit<ProjectInput, "member_ids" | "repo_url">;
}

/** Staff action: creates a project with its team, then opens it. */
export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  const session = await requireStaff();
  const parsed = parseProject(formData);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...projectRow(parsed.data), created_by: session.userId })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Could not create the project. Check the client still exists and try again." };
  }

  if (parsed.data.repo_url) {
    await supabase.from("project_internal").insert({ project_id: data.id, repo_url: parsed.data.repo_url });
  }

  const memberIds = await validStaffIds(supabase, parsed.data.member_ids);
  if (memberIds.length > 0) {
    await supabase.from("project_members").insert(memberIds.map((profile_id) => ({ project_id: data.id, profile_id })));
  }

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "project",
    entity_id: data.id,
    action: "project.created",
    details: { name: parsed.data.name, client_id: parsed.data.client_id },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/clients/${parsed.data.client_id}`);
  redirect(`/admin/projects/${data.id}`);
}

/** Staff action: updates a project and replaces its team. */
export async function updateProjectAction(projectId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireStaff();
  const parsed = parseProject(formData);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update(projectRow(parsed.data))
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Could not save the project. Please try again." };
  }

  await supabase
    .from("project_internal")
    .upsert({ project_id: projectId, repo_url: parsed.data.repo_url, updated_at: new Date().toISOString() });

  const memberIds = await validStaffIds(supabase, parsed.data.member_ids);
  const { data: current } = await supabase.from("project_members").select("profile_id").eq("project_id", projectId);
  const currentIds = (current ?? []).map((row) => row.profile_id as string);
  const toRemove = currentIds.filter((id) => !memberIds.includes(id));
  const toAdd = memberIds.filter((id) => !currentIds.includes(id));

  if (toRemove.length > 0) {
    await supabase.from("project_members").delete().eq("project_id", projectId).in("profile_id", toRemove);
  }
  if (toAdd.length > 0) {
    await supabase.from("project_members").insert(toAdd.map((profile_id) => ({ project_id: projectId, profile_id })));
  }

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "project",
    entity_id: projectId,
    action: "project.updated",
    details: { name: parsed.data.name, status: parsed.data.status },
  });

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  revalidatePath(`/admin/clients/${parsed.data.client_id}`);
  redirect(`/admin/projects/${projectId}`);
}
