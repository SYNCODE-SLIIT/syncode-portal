"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { LinkifiedText } from "@/components/linkified-text";
import { Button } from "@/components/ui/button";
import { FormMessage, StatusBadge, Textarea } from "@/components/ui/form-fields";
import { addRequestCommentAction } from "@/lib/actions/requests";
import type { CommentItem } from "@/lib/data/requests";
import { formatPortalDateTime } from "@/lib/domain";

export function CommentThread({
  requestId,
  comments,
  viewerIsStaff,
  closed,
}: {
  requestId: string;
  comments: CommentItem[];
  viewerIsStaff: boolean;
  closed: boolean;
}) {
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await addRequestCommentAction(requestId, formData);
      if (!result.ok) setError(result.error ?? "Could not post the comment.");
      else {
        form.reset();
        setInternal(false);
      }
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card">
      <h2 className="border-b border-border px-6 py-4 text-base font-semibold">Conversation ({comments.length})</h2>

      {comments.length === 0 ? (
        <p className="px-6 py-5 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ol className="divide-y divide-border">
          {comments.map((c) => (
            <li key={c.id} className={`space-y-2 px-6 py-4 ${c.is_internal ? "bg-amber-500/[0.03]" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {c.author_name || (c.author_is_staff ? "Team SYNCODE" : "Client")}
                  </span>
                  {c.author_is_staff && !viewerIsStaff ? " · Team SYNCODE" : ""} · {formatPortalDateTime(c.created_at)}
                </p>
                {c.is_internal && <StatusBadge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Internal</StatusBadge>}
              </div>
              <LinkifiedText text={c.body} className="text-sm leading-relaxed" />
            </li>
          ))}
        </ol>
      )}

      {!closed && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-border p-6" noValidate>
          <label htmlFor="comment-body" className="sr-only">
            Comment
          </label>
          <Textarea
            id="comment-body"
            name="body"
            rows={3}
            required
            disabled={isPending}
            placeholder={internal ? "Internal note: the client won't see this." : "Write a reply…"}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {viewerIsStaff ? (
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="internal"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="size-4 accent-foreground"
                />
                Internal only (hidden from the client)
              </label>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isPending} className="h-9 rounded-full px-4 text-sm font-semibold">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
              {internal ? "Post internal note" : "Send"}
            </Button>
          </div>
          <FormMessage error={error} />
        </form>
      )}
    </section>
  );
}
