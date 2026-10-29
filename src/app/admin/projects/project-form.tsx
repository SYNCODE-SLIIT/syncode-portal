"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select, Textarea, secondaryButtonClass } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProjectAction, updateProjectAction } from "@/lib/actions/projects";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, PROJECT_TYPES, PROJECT_TYPE_LABELS } from "@/lib/labels";
import type { Project, ProgressMode } from "@/lib/types/database";

const INPUT = "h-11 rounded-xl px-3.5";

export interface StaffOption {
  id: string;
  name: string;
  role: string;
}

export function ProjectForm({
  project,
  memberIds = [],
  clients,
  staff,
  defaultClientId,
}: {
  project?: Project;
  memberIds?: string[];
  clients: { id: string; name: string }[];
  staff: StaffOption[];
  defaultClientId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [progressMode, setProgressMode] = useState<ProgressMode>(project?.progress_mode ?? "auto");
  const [isPending, startTransition] = useTransition();
  const cancelHref = project ? `/admin/projects/${project.id}` : "/admin/projects";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = project ? await updateProjectAction(project.id, formData) : await createProjectAction(formData);
      if (!result.ok) setError(result.error ?? "Could not save the project.");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset disabled={isPending} className="space-y-6">
        <section className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
          <h2 className="text-base font-semibold sm:col-span-2">Project</h2>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" required defaultValue={project?.name} placeholder="e.g. Hotel booking website" className={INPUT} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <Select id="client_id" name="client_id" required defaultValue={project?.client_id ?? defaultClientId ?? ""}>
              <option value="" disabled>
                Choose a client…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select id="type" name="type" defaultValue={project?.type ?? "website"}>
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROJECT_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={project?.status ?? "planning"}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" name="start_date" type="date" defaultValue={project?.start_date ?? ""} className={INPUT} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_date">Target date</Label>
              <Input id="target_date" name="target_date" type="date" defaultValue={project?.target_date ?? ""} className={INPUT} />
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={project?.description ?? ""}
              placeholder="What is being built? The client can see this."
            />
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-base font-semibold">Links</h2>
            <p className="text-xs text-muted-foreground">The client sees the live and staging links. The repository is staff-only.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="live_url">Live URL</Label>
            <Input id="live_url" name="live_url" defaultValue={project?.live_url ?? ""} placeholder="www.example.com" className={INPUT} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staging_url">Staging URL</Label>
            <Input
              id="staging_url"
              name="staging_url"
              defaultValue={project?.staging_url ?? ""}
              placeholder="example.vercel.app"
              className={INPUT}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="repo_url">Repository URL (internal)</Label>
            <Input
              id="repo_url"
              name="repo_url"
              defaultValue={project?.repo_url ?? ""}
              placeholder="github.com/SYNCODE-SLIIT/…"
              className={INPUT}
            />
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-base font-semibold">Progress</h2>
            <p className="text-xs text-muted-foreground">
              Automatic progress is calculated from the project&apos;s milestones (added on the project page).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="progress_mode">Progress</Label>
            <Select
              id="progress_mode"
              name="progress_mode"
              value={progressMode}
              onChange={(e) => setProgressMode(e.target.value as ProgressMode)}
            >
              <option value="auto">Automatic, from milestones</option>
              <option value="manual">Set manually</option>
            </Select>
          </div>
          {progressMode === "manual" && (
            <div className="space-y-2">
              <Label htmlFor="manual_progress">Progress (%)</Label>
              <Input
                id="manual_progress"
                name="manual_progress"
                type="number"
                min={0}
                max={100}
                step={1}
                defaultValue={project?.manual_progress ?? 0}
                className={INPUT}
              />
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <h2 className="text-base font-semibold">Team</h2>
            <p className="text-xs text-muted-foreground">SYNCODE staff working on this project. The client sees their names.</p>
          </div>
          {staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active staff yet. Invite team members from the Team page.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {staff.map((person) => (
                <label
                  key={person.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-2.5 text-sm transition-colors hover:bg-secondary/50 has-checked:border-foreground/40"
                >
                  <input
                    type="checkbox"
                    name="member_ids"
                    value={person.id}
                    defaultChecked={memberIds.includes(person.id)}
                    className="size-4 accent-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate">{person.name}</span>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{person.role}</span>
                </label>
              ))}
            </div>
          )}
        </section>
      </fieldset>

      <FormMessage error={error} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={secondaryButtonClass}>
          Cancel
        </Link>
        <Button type="submit" disabled={isPending || clients.length === 0} className="h-10 rounded-full px-5 text-sm font-semibold">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {project ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
