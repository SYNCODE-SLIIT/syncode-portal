"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select, Textarea } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendQuoteAction, setRequestStatusAction } from "@/lib/actions/requests";
import type { ActionResult } from "@/lib/actions/auth";
import type { FeatureRequest, RequestStatus } from "@/lib/types/database";

/** The next sensible steps for each status; staff can also jump anywhere via "Change status". */
const NEXT_STEPS: Partial<Record<RequestStatus, { status: RequestStatus; label: string }[]>> = {
  submitted: [{ status: "under_review", label: "Start review" }],
  under_review: [{ status: "approved", label: "Approve without a quote" }],
  approved: [{ status: "in_progress", label: "Start work" }],
  in_progress: [{ status: "delivered", label: "Mark delivered" }],
};

const MANUAL_STATUSES: { value: RequestStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
];

export function RequestControls({ request }: { request: FeatureRequest }) {
  const [panel, setPanel] = useState<"none" | "quote" | "decline">("none");
  const [declineReason, setDeclineReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else {
        setNotice(result.message ?? null);
        setPanel("none");
      }
    });
  };

  const canQuote = ["submitted", "under_review", "quoted", "declined"].includes(request.status);
  const canDecline = request.status !== "declined" && request.status !== "delivered";
  const nextSteps = NEXT_STEPS[request.status] ?? [];

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">Actions</h2>

      {request.status === "quoted" && (
        <p className="text-sm text-muted-foreground">Waiting for the client to approve or decline the quote.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {nextSteps.map((step) => (
          <Button
            key={step.status}
            type="button"
            disabled={isPending}
            onClick={() => run(() => setRequestStatusAction(request.id, step.status))}
            className="h-9 rounded-full px-4 text-sm font-semibold"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {step.label}
          </Button>
        ))}
        {canQuote && (
          <Button type="button" variant="outline" disabled={isPending} onClick={() => setPanel(panel === "quote" ? "none" : "quote")} className="h-9 rounded-full px-4 text-sm">
            {request.status === "quoted" ? "Revise quote" : "Send a quote"}
          </Button>
        )}
        {canDecline && (
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => setPanel(panel === "decline" ? "none" : "decline")} className="h-9 rounded-full px-4 text-sm">
            Decline request
          </Button>
        )}
      </div>

      {panel === "quote" && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            run(() => sendQuoteAction(request.id, formData));
          }}
          className="space-y-4 rounded-xl border border-border p-4"
        >
          <p className="text-sm text-muted-foreground">The client sees the price and/or estimated hours and can approve or decline.</p>
          <fieldset disabled={isPending} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="quote_amount">Price</Label>
              <Input
                id="quote_amount"
                name="quote_amount"
                inputMode="decimal"
                defaultValue={request.quote_amount ?? ""}
                placeholder="e.g. 25000"
                className="h-10 rounded-xl px-3.5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote_currency">Currency</Label>
              <Select id="quote_currency" name="quote_currency" defaultValue={request.quote_currency ?? "LKR"} className="h-10">
                <option value="LKR">LKR</option>
                <option value="USD">USD</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimate_hours">Estimated hours</Label>
              <Input
                id="estimate_hours"
                name="estimate_hours"
                inputMode="decimal"
                defaultValue={request.estimate_hours ?? ""}
                placeholder="e.g. 6"
                className="h-10 rounded-xl px-3.5"
              />
            </div>
          </fieldset>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} className="h-9 rounded-full px-4 text-sm font-semibold">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Send quote to client
            </Button>
          </div>
        </form>
      )}

      {panel === "decline" && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <Label htmlFor="decline-reason">Reason (the client sees this)</Label>
          <Textarea
            id="decline-reason"
            rows={3}
            maxLength={1000}
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            disabled={isPending}
            placeholder="e.g. This is outside the agreed scope; we can quote it as a separate project."
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => run(() => setRequestStatusAction(request.id, "declined", declineReason))}
              className="h-9 rounded-full px-4 text-sm"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Decline request
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Label htmlFor="manual-status" className="shrink-0 text-xs text-muted-foreground">
          Change status
        </Label>
        <Select
          id="manual-status"
          value=""
          disabled={isPending}
          onChange={(e) => {
            const value = e.target.value as RequestStatus;
            if (value) run(() => setRequestStatusAction(request.id, value));
          }}
          className="h-9 text-xs"
        >
          <option value="">Choose…</option>
          {MANUAL_STATUSES.filter((s) => s.value !== request.status).map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <FormMessage error={error} notice={notice} />
    </section>
  );
}
