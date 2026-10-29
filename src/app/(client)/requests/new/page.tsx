import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/form-fields";
import { requireClient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewRequestForm } from "./new-request-form";

export const metadata: Metadata = {
  title: "New request",
};

async function NewRequestContent({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  await requireClient();
  const { project } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, name, status")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  const projects = (data ?? []).map((p) => ({ id: p.id as string, name: p.name as string }));

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Requests are linked to a project. Once Team SYNCODE sets up your project, you can send requests here.
      </div>
    );
  }

  return <NewRequestForm projects={projects} defaultProjectId={projects.some((p) => p.id === project) ? project : undefined} />;
}

export default function NewRequestPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Requests"
        title="New request"
        description="Tell us what you'd like changed or added. We'll review it and reply, with a quote if it's extra work."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
        <NewRequestContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
