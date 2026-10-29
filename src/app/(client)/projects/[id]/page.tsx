import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CircleDot, ExternalLink, Globe, TestTube2 } from "lucide-react";
import { LinkifiedText } from "@/components/linkified-text";
import { PageHeader, ProgressBar, StatusBadge } from "@/components/ui/form-fields";
import { requireClient } from "@/lib/auth";
import { getProjectProgress } from "@/lib/data/projects";
import { formatPortalDate, formatPortalDateTime } from "@/lib/domain";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLES, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Milestone, Project } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Project",
};

async function ClientProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireClient();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  // Row-level security only returns this client's own project, milestones and client-visible updates
  const supabase = await createClient();
  const [{ data: project }, { data: milestones }, { data: updateRows }, { data: memberRows }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle<Project>(),
    supabase
      .from("milestones")
      .select("*")
      .eq("project_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .returns<Milestone[]>(),
    supabase
      .from("project_updates")
      .select("id, body, created_at, profiles(full_name)")
      .eq("project_id", id)
      .eq("visibility", "client")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("project_members").select("profiles(id, full_name)").eq("project_id", id),
  ]);
  if (!project) notFound();

  const progress = (await getProjectProgress(supabase, [project])).get(project.id) ?? 0;
  const milestoneList = milestones ?? [];
  const team = (memberRows ?? [])
    .map((row) => row.profiles as unknown as { id: string; full_name: string } | null)
    .filter((p): p is { id: string; full_name: string } => p !== null && Boolean(p.full_name));

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Dashboard
      </Link>

      <PageHeader
        eyebrow={PROJECT_TYPE_LABELS[project.type]}
        title={project.name}
        description={
          <StatusBadge className={PROJECT_STATUS_STYLES[project.status]}>{PROJECT_STATUS_LABELS[project.status]}</StatusBadge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Progress</h2>
            <ProgressBar value={progress} />
            {project.target_date && (
              <p className="text-sm text-muted-foreground">Target completion: {formatPortalDate(project.target_date)}</p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Milestones</h2>
            {milestoneList.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Team SYNCODE will add the project stages here soon.</p>
            ) : (
              <ol className="mt-5 space-y-0">
                {milestoneList.map((m, index) => {
                  const last = index === milestoneList.length - 1;
                  return (
                    <li key={m.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {!last && <span aria-hidden="true" className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-border" />}
                      <span
                        className={`relative flex size-7 shrink-0 items-center justify-center rounded-full border ${
                          m.status === "done"
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : m.status === "in_progress"
                              ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                              : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        {m.status === "done" ? <Check className="size-3.5" /> : m.status === "in_progress" ? <CircleDot className="size-3.5" /> : <span className="text-[11px]">{index + 1}</span>}
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className={`font-medium ${m.status === "not_started" ? "text-muted-foreground" : ""}`}>{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.status === "done"
                            ? `Completed${m.completed_at ? ` ${formatPortalDate(m.completed_at)}` : ""}`
                            : m.status === "in_progress"
                              ? `In progress · ${m.percent}%`
                              : "Not started"}
                          {m.status !== "done" && m.due_date ? ` · Due ${formatPortalDate(m.due_date)}` : ""}
                        </p>
                        {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card">
            <h2 className="border-b border-border px-6 py-4 text-base font-semibold">Updates</h2>
            {(updateRows ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No updates yet. You&apos;ll see news from the team here.</p>
            ) : (
              <ol className="divide-y divide-border">
                {(updateRows ?? []).map((u) => (
                  <li key={u.id as string} className="space-y-2 px-6 py-4">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {(u.profiles as unknown as { full_name: string } | null)?.full_name || "Team SYNCODE"}
                      </span>{" "}
                      · {formatPortalDateTime(u.created_at as string)}
                    </p>
                    <LinkifiedText text={u.body as string} className="text-sm leading-relaxed" />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {(project.live_url || project.staging_url) && (
            <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold">Links</h2>
              {project.live_url && <ExternalItem icon={Globe} label="Live site" href={project.live_url} />}
              {project.staging_url && <ExternalItem icon={TestTube2} label="Preview (staging)" href={project.staging_url} />}
            </section>
          )}

          {project.description && (
            <section className="space-y-2 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold">About this project</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{project.description}</p>
            </section>
          )}

          {team.length > 0 && (
            <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold">Your SYNCODE team</h2>
              <ul className="space-y-3">
                {team.map((person) => (
                  <li key={person.id} className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">
                      {person.full_name.slice(0, 2)}
                    </span>
                    <span className="truncate text-sm">{person.full_name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ExternalItem({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-xl p-2 -m-2 text-sm transition-colors hover:bg-secondary/50"
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="inline-flex max-w-full items-center gap-1">
          <span className="truncate">{href.replace(/^https?:\/\//, "")}</span>
          <ExternalLink className="size-3 shrink-0" />
        </span>
      </span>
    </a>
  );
}

export default function ClientProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
      <ClientProjectDetail params={params} />
    </Suspense>
  );
}
