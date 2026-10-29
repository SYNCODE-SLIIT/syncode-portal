"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/form-fields";
import { reviewPaymentAction } from "@/lib/actions/invoices";

/** Approve / reject buttons for a pending payment slip (admin). */
export function PaymentReview({ paymentId }: { paymentId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const review = (decision: "approved" | "rejected") => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await reviewPaymentAction(paymentId, decision, reason);
      if (!result.ok) setError(result.error ?? "Could not review the payment.");
      else setNotice(result.message ?? null);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={isPending} onClick={() => review("approved")} className="h-9 rounded-full px-4 text-sm font-semibold">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Approve
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => setRejecting(!rejecting)}
          className="h-9 rounded-full px-4 text-sm"
        >
          <X className="size-4" />
          Reject
        </Button>
      </div>
      {rejecting && (
        <div className="space-y-2">
          <Textarea
            aria-label="Reason for rejecting"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isPending}
            placeholder="The client sees this, e.g. The amount on the slip doesn't match. Please check and upload it again."
          />
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => review("rejected")}
            className="h-9 rounded-full px-4 text-sm"
          >
            Reject payment
          </Button>
        </div>
      )}
      <FormMessage error={error} notice={notice} />
    </div>
  );
}
