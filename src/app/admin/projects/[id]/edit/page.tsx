import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/form-fields";
import { requireStaff } from "@/lib/auth";
import { getClientOptions, getStaffOptions } from "@/lib/data/options";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = {
  title: "Edit project",
};

async function EditProjectContent({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: project }, { data: members }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle<Project>(),
    supabase.from("project_members").select("profile_id").eq("project_id", id),
  ]);
  if (!project) notFound();

  const [clients, staff] = await Promise.all([getClientOptions(supabase, project.client_id), getStaffOptions(supabase)]);

  return (
    <>
      <PageHeader eyebrow="Edit project" title={project.name} />
      <ProjectForm
        project={project}
        memberIds={(members ?? []).map((m) => m.profile_id as string)}
        clients={clients}
        staff={staff}
      />
    </>
  );
}

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
        <EditProjectContent params={params} />
      </Suspense>
    </div>
  );
}
