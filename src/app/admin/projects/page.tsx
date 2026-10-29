import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { PageHeader, ProgressBar, StatusBadge, primaryButtonClass } from "@/components/ui/form-fields";
import { requireStaff } from "@/lib/auth";
import { getProjectProgress } from "@/lib/data/projects";
import { formatPortalDate } from "@/lib/domain";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLES, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectStatus } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Projects",
};

const FILTERS = {
  active: { label: "Active", statuses: ["planning", "in_progress", "on_hold"] },
  completed: { label: "Completed", statuses: ["completed"] },
  cancelled: { label: "Cancelled", statuses: ["cancelled"] },
  all: { label: "All", statuses: null },
} satisfies Record<string, { label: string; statuses: ProjectStatus[] | null }>;

type FilterKey = keyof typeof FILTERS;

async function ProjectsContent({ searchParams }: { searchParams: Promise<{ status?: string; mine?: string }> }) {
  const session = await requireStaff();
  const params = await searchParams;
  const filter: FilterKey = params.status && params.status in FILTERS ? (params.status as FilterKey) : "active";
  const onlyMine = params.mine === "1";

  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("*, clients(name)")
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  const statuses = FILTERS[filter].statuses;
  if (statuses) query = query.in("status", statuses);

  if (onlyMine) {
    const { data: memberships } = await supabase.from("project_members").select("project_id").eq("profile_id", session.userId);
    const ids = (memberships ?? []).map((m) => m.project_id as string);
    query = query.in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data } = await query.returns<(Project & { clients: { name: string } | null })[]>();
  const projects = data ?? [];
  const progress = await getProjectProgress(supabase, projects);

  const linkFor = (status: FilterKey, mine: boolean) => ({
    pathname: "/admin/projects",
    query: { status, ...(mine ? { mine: "1" } : {}) },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full border border-border p-1 text-xs">
          {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
            <Link
              key={key}
              href={linkFor(key, onlyMine)}
              className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
                filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {FILTERS[key].label}
            </Link>
          ))}
        </div>
        <Link
          href={linkFor(filter, !onlyMine)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            onlyMine ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {onlyMine ? "✓ " : ""}Assigned to me
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FolderKanban className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No projects here.</p>
          <p className="mt-1 text-sm text-muted-foreground">Create a project for a client to start tracking its progress.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/admin/projects/${project.id}`}
                  className="grid gap-3 px-5 py-4 transition-colors hover:bg-secondary/50 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_10rem_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {project.clients?.name ?? "Unknown client"} · {PROJECT_TYPE_LABELS[project.type]}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {project.target_date ? `Target ${formatPortalDate(project.target_date)}` : "No target date"}
                  </p>
                  <ProgressBar value={progress.get(project.id) ?? 0} />
                  <StatusBadge className={`justify-self-start ${PROJECT_STATUS_STYLES[project.status]}`}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string; mine?: string }> }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Every client project, its status and progress."
        actions={
          <Link href="/admin/projects/new" className={primaryButtonClass}>
            <Plus className="size-4" />
            New project
          </Link>
        }
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />}>
        <ProjectsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
