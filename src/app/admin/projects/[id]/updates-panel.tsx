"use client";

import { useState, useTransition } from "react";
import { EyeOff, Loader2, Send, Trash2, Users } from "lucide-react";
import { LinkifiedText } from "@/components/linkified-text";
import { Button } from "@/components/ui/button";
import { FormMessage, StatusBadge, Textarea } from "@/components/ui/form-fields";
import { createProjectUpdateAction, deleteProjectUpdateAction } from "@/lib/actions/updates";
import { formatPortalDateTime } from "@/lib/domain";
import type { UpdateVisibility } from "@/lib/types/database";

export interface UpdateItem {
  id: string;
  body: string;
  visibility: UpdateVisibility;
  created_at: string;
  author_id: string | null;
  author_name: string | null;
}

export function UpdatesPanel({
  projectId,
  updates,
  currentUserId,
  isAdmin,
}: {
  projectId: string;
  updates: UpdateItem[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [visibility, setVisibility] = useState<UpdateVisibility>("client");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await createProjectUpdateAction(projectId, formData);
      if (!result.ok) {
        setError(result.error ?? "Could not post the update.");
      } else {
        setNotice(result.message ?? "Posted.");
        form.reset();
        setVisibility("client");
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this update? This can't be undone.")) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await deleteProjectUpdateAction(id);
      if (!result.ok) setError(result.error ?? "Could not delete the update.");
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold">Updates</h2>
        <p className="text-xs text-muted-foreground">Keep the client informed, or leave internal notes for the team.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 border-b border-border p-6" noValidate>
        <input type="hidden" name="visibility" value={visibility} />
        <label htmlFor="update-body" className="sr-only">
          Update
        </label>
        <Textarea
          id="update-body"
          name="body"
          rows={3}
          required
          disabled={isPending}
          placeholder={
            visibility === "client"
              ? "e.g. The homepage design is ready for your review: https://…"
              : "Internal note: only SYNCODE staff will see this."
          }
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="radiogroup" aria-label="Who can see this update" className="flex gap-1 rounded-full border border-border p-1 text-xs">
            <VisibilityOption
              active={visibility === "client"}
              onClick={() => setVisibility("client")}
              icon={<Users className="size-3.5" />}
              label="Client can see"
            />
            <VisibilityOption
              active={visibility === "internal"}
              onClick={() => setVisibility("internal")}
              icon={<EyeOff className="size-3.5" />}
              label="Internal only"
            />
          </div>
          <Button type="submit" disabled={isPending} className="h-9 rounded-full px-4 text-sm font-semibold">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
            Post
          </Button>
        </div>
        <FormMessage error={error} notice={notice} />
      </form>

      {updates.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">No updates yet.</p>
      ) : (
        <ol className="divide-y divide-border">
          {updates.map((u) => (
            <li key={u.id} className={`space-y-2 px-6 py-4 ${u.visibility === "internal" ? "bg-amber-500/[0.03]" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{u.author_name || "Former team member"}</span> ·{" "}
                  {formatPortalDateTime(u.created_at)}
                </p>
                <div className="flex items-center gap-2">
                  {u.visibility === "internal" && (
                    <StatusBadge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Internal</StatusBadge>
                  )}
                  {(u.author_id === currentUserId || isAdmin) && (
                    <button
                      type="button"
                      aria-label="Delete update"
                      title="Delete update"
                      disabled={isPending}
                      onClick={() => handleDelete(u.id)}
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <LinkifiedText text={u.body} className="text-sm leading-relaxed" />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function VisibilityOption({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
