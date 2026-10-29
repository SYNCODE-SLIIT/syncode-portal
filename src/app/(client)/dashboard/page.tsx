import { Suspense } from "react";
import type { Metadata } from "next";
import { FolderKanban, FileText, MessageSquarePlus } from "lucide-react";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Project } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Dashboard",
};

async function ClientDashboardContent() {
  const session = await requireClient();
  const supabase = await createClient();

  const [clientRes, projectsRes] = await Promise.all([
    session.profile.client_id
      ? supabase
          .from("clients")
          .select("*")
          .eq("id", session.profile.client_id)
          .single<Client>()
      : Promise.resolve({ data: null }),
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<Project[]>(),
  ]);

  const projects = projectsRes.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {clientRes.data?.name ?? "Client Portal"}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Hello, {session.profile.full_name.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your active projects, progress updates, feature requests, and invoices.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
            <FolderKanban className="size-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold">
            Your projects will appear here
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Once Team SYNCODE adds your project milestones and updates, you will see real-time progress bars, staging links, and deliverables right here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl border border-border bg-card p-6 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{project.name}</h2>
                <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs capitalize">
                  {project.status.replace("_", " ")}
                </span>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <MessageSquarePlus className="size-4 text-muted-foreground" />
            <span>Feature Requests</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Need a change or new feature on your project? Submit a request and review quotes here.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <FileText className="size-4 text-muted-foreground" />
            <span>Invoices & Payments</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Download PDF invoices and upload bank transfer slips for quick approval.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ClientDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card p-6" />
      }
    >
      <ClientDashboardContent />
    </Suspense>
  );
}
