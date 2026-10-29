"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Check, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select, Textarea } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createMilestoneAction,
  deleteMilestoneAction,
  moveMilestoneAction,
  setMilestoneStatusAction,
  updateMilestoneAction,
} from "@/lib/actions/milestones";
import { formatPortalDate } from "@/lib/domain";
import type { Milestone, MilestoneStatus } from "@/lib/types/database";
import type { ActionResult } from "@/lib/actions/auth";

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

const INPUT = "h-10 rounded-xl px-3.5";

export function MilestonesPanel({ projectId, milestones }: { projectId: string; milestones: Milestone[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>, onSuccess?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else onSuccess?.();
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="text-base font-semibold">Milestones ({milestones.length})</h2>
          <p className="text-xs text-muted-foreground">The client sees these as a timeline. Progress is weighted by each milestone&apos;s weight.</p>
        </div>
        {!adding && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            className="h-9 shrink-0 rounded-full px-4 text-xs"
          >
            <Plus className="size-3.5" />
            Add
          </Button>
        )}
      </div>

      {error && (
        <div className="px-6 pt-4">
          <FormMessage error={error} />
        </div>
      )}

      {milestones.length === 0 && !adding ? (
        <p className="p-6 text-sm text-muted-foreground">
          No milestones yet. Break the project into stages, such as Design, Development, Testing and Launch.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {milestones.map((m, index) =>
            editingId === m.id ? (
              <li key={m.id} className="p-6">
                <MilestoneForm
                  milestone={m}
                  pending={isPending}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(formData) => run(() => updateMilestoneAction(m.id, formData), () => setEditingId(null))}
                />
              </li>
            ) : (
              <li key={m.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                      m.status === "done" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground"
                    }`}
                  >
                    {m.status === "done" ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.status === "in_progress" ? `${m.percent}% · ` : ""}
                      {m.due_date ? `Due ${formatPortalDate(m.due_date)}` : "No due date"}
                      {Number(m.weight) !== 1 ? ` · Weight ${Number(m.weight)}` : ""}
                    </p>
                    {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pl-9 sm:pl-0">
                  <Select
                    aria-label={`Status of ${m.title}`}
                    value={m.status}
                    disabled={isPending}
                    onChange={(e) => run(() => setMilestoneStatusAction(m.id, e.target.value as MilestoneStatus))}
                    className="h-9 w-36 text-xs"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <IconButton label="Move up" disabled={isPending || index === 0} onClick={() => run(() => moveMilestoneAction(m.id, "up"))}>
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={isPending || index === milestones.length - 1}
                    onClick={() => run(() => moveMilestoneAction(m.id, "down"))}
                  >
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Edit"
                    disabled={isPending}
                    onClick={() => {
                      setEditingId(m.id);
                      setAdding(false);
                    }}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton
                    label="Delete"
                    disabled={isPending}
                    onClick={() => {
                      if (window.confirm(`Delete the milestone "${m.title}"?`)) run(() => deleteMilestoneAction(m.id));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </li>
            )
          )}
          {adding && (
            <li className="p-6">
              <MilestoneForm
                pending={isPending}
                onCancel={() => setAdding(false)}
                onSubmit={(formData) => run(() => createMilestoneAction(projectId, formData), () => setAdding(false))}
              />
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function MilestoneForm({
  milestone,
  pending,
  onSubmit,
  onCancel,
}: {
  milestone?: Milestone;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<MilestoneStatus>(milestone?.status ?? "not_started");
  const idPrefix = milestone ? `m-${milestone.id}` : "m-new";

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
      className="space-y-4"
    >
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-title`}>{milestone ? "Edit milestone" : "New milestone"}</Label>
          <Input
            id={`${idPrefix}-title`}
            name="title"
            required
            autoFocus
            defaultValue={milestone?.title}
            placeholder="e.g. Design, Development, Testing, Launch"
            className={INPUT}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select
            id={`${idPrefix}-status`}
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
            className="h-10"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {status === "in_progress" ? (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-percent`}>Progress (%)</Label>
            <Input
              id={`${idPrefix}-percent`}
              name="percent"
              type="number"
              min={0}
              max={100}
              defaultValue={milestone?.percent ?? 0}
              className={INPUT}
            />
          </div>
        ) : (
          <input type="hidden" name="percent" value={status === "done" ? "100" : "0"} />
        )}
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-due`}>Due date</Label>
          <Input id={`${idPrefix}-due`} name="due_date" type="date" defaultValue={milestone?.due_date ?? ""} className={INPUT} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-weight`}>Weight</Label>
          <Input
            id={`${idPrefix}-weight`}
            name="weight"
            type="number"
            min={0.1}
            step={0.1}
            defaultValue={milestone ? Number(milestone.weight) : 1}
            className={INPUT}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-description`}>Description (optional)</Label>
          <Textarea
            id={`${idPrefix}-description`}
            name="description"
            rows={2}
            defaultValue={milestone?.description ?? ""}
            className="min-h-16"
            placeholder="What this stage covers. The client can see this."
          />
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending} className="h-9 rounded-full px-4 text-sm">
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="h-9 rounded-full px-4 text-sm font-semibold">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {milestone ? "Save" : "Add milestone"}
        </Button>
      </div>
    </form>
  );
}
