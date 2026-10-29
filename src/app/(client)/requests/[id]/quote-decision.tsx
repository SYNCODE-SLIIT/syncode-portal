"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/form-fields";
import { respondToQuoteAction } from "@/lib/actions/requests";

export function QuoteDecision({ requestId }: { requestId: string }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const decide = (decision: "approved" | "declined") => {
    setError(null);
    startTransition(async () => {
      const result = await respondToQuoteAction(requestId, decision, decision === "declined" ? reason : undefined);
      if (!result.ok) setError(result.error ?? "Could not save your decision.");
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6">
      <div>
        <h2 className="text-base font-semibold">Your decision</h2>
        <p className="text-sm text-muted-foreground">
          Approve the quote and the team will start on this request. If it doesn&apos;t work for you, decline and tell us why.
        </p>
      </div>

      {declining ? (
        <div className="space-y-3">
          <label htmlFor="decline-reason" className="text-sm font-medium">
            Reason (optional)
          </label>
          <Textarea
            id="decline-reason"
            rows={3}
            value={reason}
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
            placeholder="e.g. Over budget for now, or the scope needs to change"
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => setDeclining(false)} className="h-10 rounded-full px-5">
              Back
            </Button>
            <Button type="button" variant="destructive" disabled={isPending} onClick={() => decide("declined")} className="h-10 rounded-full px-5">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              Decline quote
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => setDeclining(true)} className="h-10 rounded-full px-5">
            Decline
          </Button>
          <Button type="button" disabled={isPending} onClick={() => decide("approved")} className="h-10 rounded-full px-5 font-semibold">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Approve quote
          </Button>
        </div>
      )}

      <FormMessage error={error} />
    </section>
  );
}
