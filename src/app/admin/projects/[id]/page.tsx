import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, GitBranch, Globe, Pencil, TestTube2 } from "lucide-react";
import { PageHeader, ProgressBar, StatusBadge, secondaryButtonClass } from "@/components/ui/form-fields";
import { requireStaff } from "@/lib/auth";
import { getProjectProgress } from "@/lib/data/projects";
import { getUserAccounts } from "@/lib/data/users";
import { formatPortalDate } from "@/lib/domain";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLES, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Project } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Project",
};

async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: project }, { data: memberRows }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, clients(id, name)")
      .eq("id", id)
      .maybeSingle<Project & { clients: { id: string; name: string } | null }>(),
    supabase.from("project_members").select("profiles(id, full_name, role)").eq("project_id", id),
  ]);
  if (!project) notFound();

  const members = (memberRows ?? [])
    .map((row) => row.profiles as unknown as Pick<Profile, "id" | "full_name" | "role"> | null)
    .filter((p): p is Pick<Profile, "id" | "full_name" | "role"> => p !== null);
  const [progress, accounts] = await Promise.all([
    getProjectProgress(supabase, [project]),
    getUserAccounts(members.map((m) => m.id)),
  ]);
  const percent = progress.get(project.id) ?? 0;

  return (
    <div className="space-y-6">
      <Link
        href={project.clients ? `/admin/clients/${project.clients.id}` : "/admin/projects"}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {project.clients?.name ?? "Projects"}
      </Link>

      <PageHeader
        eyebrow={PROJECT_TYPE_LABELS[project.type]}
        title={project.name}
        description={
          <StatusBadge className={PROJECT_STATUS_STYLES[project.status]}>{PROJECT_STATUS_LABELS[project.status]}</StatusBadge>
        }
        actions={
          <Link href={`/admin/projects/${project.id}/edit`} className={secondaryButtonClass}>
            <Pencil className="size-4" />
            Edit
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Progress</h2>
              <span className="text-xs text-muted-foreground">
                {project.progress_mode === "manual" ? "Set manually" : "From milestones"}
              </span>
            </div>
            <ProgressBar value={percent} />
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Start</dt>
                <dd>{project.start_date ? formatPortalDate(project.start_date) : "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Target</dt>
                <dd>{project.target_date ? formatPortalDate(project.target_date) : "Not set"}</dd>
              </div>
            </dl>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Description</h2>
            {project.description ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{project.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description yet. Add one so the client knows what&apos;s being built.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Links</h2>
            <ProjectLink icon={Globe} label="Live site" href={project.live_url} />
            <ProjectLink icon={TestTube2} label="Staging" href={project.staging_url} />
            <ProjectLink icon={GitBranch} label="Repository (internal)" href={project.repo_url} />
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Team ({members.length})</h2>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one assigned yet.</p>
            ) : (
              <ul className="space-y-3">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">
                      {(m.full_name || "?").slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.full_name || "Name not set"}</p>
                      <p className="truncate text-xs text-muted-foreground">{accounts.get(m.id)?.email ?? m.role}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="px-1 text-xs text-muted-foreground">Created {formatPortalDate(project.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

function ProjectLink({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string | null;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 hover:underline">
            <span className="truncate">{href.replace(/^https?:\/\//, "")}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          <p className="text-muted-foreground">Not set</p>
        )}
      </div>
    </div>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
      <ProjectDetail params={params} />
    </Suspense>
  );
}
