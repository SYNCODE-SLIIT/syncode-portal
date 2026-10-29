import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/form-fields";
import { requireStaff } from "@/lib/auth";
import { getClientOptions, getStaffOptions } from "@/lib/data/options";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = {
  title: "New project",
};

async function NewProjectContent({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const session = await requireStaff();
  const { client } = await searchParams;
  const supabase = await createClient();
  const [clients, staff] = await Promise.all([getClientOptions(supabase), getStaffOptions(supabase)]);

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Projects belong to a client.{" "}
        <Link href="/admin/clients/new" className="text-foreground underline underline-offset-4">
          Add a client first
        </Link>
        .
      </div>
    );
  }

  return (
    <ProjectForm
      clients={clients}
      staff={staff}
      memberIds={[session.userId]}
      defaultClientId={clients.some((c) => c.id === client) ? client : undefined}
    />
  );
}

export default function NewProjectPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Projects" title="New project" />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
        <NewProjectContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
