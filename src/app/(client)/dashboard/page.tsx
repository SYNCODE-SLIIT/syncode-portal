import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, FolderKanban } from "lucide-react";
import { LinkifiedText } from "@/components/linkified-text";
import { ProgressBar, StatusBadge } from "@/components/ui/form-fields";
import { requireClient } from "@/lib/auth";
import { getProjectProgress } from "@/lib/data/projects";
import { colomboToday, formatMoney, formatPortalDate, formatPortalDateTime, getInvoiceDisplayStatus, invoiceBalance } from "@/lib/domain";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES, PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLES, PROJECT_TYPE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Client, Invoice, Milestone, Project } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function ClientDashboardContent() {
  const session = await requireClient();
  const supabase = await createClient();

  // Row-level security limits every query to this client's own data
  const [{ data: client }, { data: projectRows }, { data: updateRows }, { data: unpaidRows }] = await Promise.all([
    session.profile.client_id
      ? supabase.from("clients").select("*").eq("id", session.profile.client_id).maybeSingle<Client>()
      : Promise.resolve({ data: null }),
    supabase.from("projects").select("*").order("created_at", { ascending: false }).returns<Project[]>(),
    supabase
      .from("project_updates")
      .select("id, body, created_at, project_id, projects(name), profiles(full_name)")
      .eq("visibility", "client")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("invoices")
      .select("*")
      .in("status", ["sent", "partially_paid"])
      .order("due_date", { ascending: true })
      .returns<Invoice[]>(),
  ]);
  const unpaidInvoices = unpaidRows ?? [];
  const today = colomboToday();

  // Current work first; completed and cancelled projects after
  const order = { in_progress: 0, planning: 1, on_hold: 2, completed: 3, cancelled: 4 } as const;
  const projects = (projectRows ?? []).sort((a, b) => order[a.status] - order[b.status]);
  const progress = await getProjectProgress(supabase, projects);

  const { data: milestoneRows } = projects.length
    ? await supabase
        .from("milestones")
        .select("project_id, title, status, due_date, position")
        .in("project_id", projects.map((p) => p.id))
        .neq("status", "done")
        .order("position", { ascending: true })
        .returns<Pick<Milestone, "project_id" | "title" | "status" | "due_date" | "position">[]>()
    : { data: [] };
  const nextMilestone = new Map<string, { title: string; due_date: string | null }>();
  for (const m of milestoneRows ?? []) {
    if (!nextMilestone.has(m.project_id)) nextMilestone.set(m.project_id, { title: m.title, due_date: m.due_date });
  }

  const firstName = session.profile.full_name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{client?.name ?? "Client portal"}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Hello, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s where your projects with Team SYNCODE stand.</p>
      </div>

      {unpaidInvoices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Invoices to pay</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {unpaidInvoices.map((inv) => {
              const display = getInvoiceDisplayStatus(inv.status, inv.due_date, today);
              return (
                <li key={inv.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium tabular-nums">
                        {formatMoney(invoiceBalance(inv.total, inv.amount_paid), inv.currency)}
                        <span className="font-normal text-muted-foreground"> · {inv.number}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Due {formatPortalDate(inv.due_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge className={INVOICE_STATUS_STYLES[display]}>{INVOICE_STATUS_LABELS[display]}</StatusBadge>
                    <Link
                      href={`/invoices/${inv.id}#pay`}
                      className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
                    >
                      Pay
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <FolderKanban className="size-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Your projects will appear here</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Once Team SYNCODE sets up your project, you&apos;ll see its progress, milestones and updates here.
          </p>
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Your projects</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {projects.map((project) => {
              const next = nextMilestone.get(project.id);
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{PROJECT_TYPE_LABELS[project.type]}</p>
                    </div>
                    <StatusBadge className={PROJECT_STATUS_STYLES[project.status]}>{PROJECT_STATUS_LABELS[project.status]}</StatusBadge>
                  </div>
                  <ProgressBar value={progress.get(project.id) ?? 0} />
                  <div className="flex items-end justify-between gap-3 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">
                      {project.status === "completed"
                        ? "Completed"
                        : next
                          ? `Next: ${next.title}${next.due_date ? ` · ${formatPortalDate(next.due_date)}` : ""}`
                          : project.target_date
                            ? `Target ${formatPortalDate(project.target_date)}`
                            : ""}
                    </span>
                    <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(updateRows ?? []).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Latest updates</h2>
          <ol className="divide-y divide-border rounded-2xl border border-border bg-card">
            {(updateRows ?? []).map((u) => (
              <li key={u.id as string} className="space-y-2 px-6 py-4">
                <p className="text-xs text-muted-foreground">
                  <Link href={`/projects/${u.project_id}`} className="font-medium text-foreground hover:underline">
                    {(u.projects as unknown as { name: string } | null)?.name ?? "Project"}
                  </Link>{" "}
                  · {(u.profiles as unknown as { full_name: string } | null)?.full_name || "Team SYNCODE"} ·{" "}
                  {formatPortalDateTime(u.created_at as string)}
                </p>
                <LinkifiedText text={u.body as string} className="line-clamp-4 text-sm leading-relaxed" />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export default function ClientDashboardPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border bg-card p-6" />}>
      <ClientDashboardContent />
    </Suspense>
  );
}
