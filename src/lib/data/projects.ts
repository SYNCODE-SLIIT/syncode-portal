import "server-only";
import { calculateProjectProgress } from "@/lib/domain";
import type { createClient } from "@/lib/supabase/server";
import type { MilestoneStatus, Project } from "@/lib/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Progress (0–100) for each project, from its milestones or its manual setting. */
export async function getProjectProgress(
  supabase: SupabaseServerClient,
  projects: Pick<Project, "id" | "progress_mode" | "manual_progress">[]
): Promise<Map<string, number>> {
  const progress = new Map<string, number>();
  if (projects.length === 0) return progress;

  const { data: milestones } = await supabase
    .from("milestones")
    .select("project_id, status, percent, weight")
    .in(
      "project_id",
      projects.map((p) => p.id)
    );

  const byProject = new Map<string, { status: MilestoneStatus; percent: number; weight: number }[]>();
  for (const m of milestones ?? []) {
    const list = byProject.get(m.project_id) ?? [];
    list.push({ status: m.status, percent: Number(m.percent), weight: Number(m.weight) });
    byProject.set(m.project_id, list);
  }

  for (const p of projects) {
    progress.set(p.id, calculateProjectProgress(p.progress_mode, p.manual_progress, byProject.get(p.id) ?? []));
  }
  return progress;
}
