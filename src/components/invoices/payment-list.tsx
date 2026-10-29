import { FileText } from "lucide-react";
import { StatusBadge } from "@/components/ui/form-fields";
import { formatMoney, formatPortalDate, formatPortalDateTime } from "@/lib/domain";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_STYLES } from "@/lib/labels";
import type { CurrencyCode, Payment } from "@/lib/types/database";
import { PaymentReview } from "./payment-review";

export type PaymentRow = Payment & { submitter_name?: string | null };

/** Payments on one invoice. Admins get approve / reject controls on pending slips. */
export function PaymentList({
  payments,
  currency,
  slipUrls,
  canReview = false,
  emptyText,
}: {
  payments: PaymentRow[];
  currency: CurrencyCode;
  slipUrls: Map<string, string>;
  canReview?: boolean;
  emptyText: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <h2 className="border-b border-border px-6 py-4 text-base font-semibold">Payments ({payments.length})</h2>
      {payments.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border">
          {payments.map((p) => {
            const slipUrl = p.slip_path ? slipUrls.get(p.slip_path) : undefined;
            return (
              <li key={p.id} className="space-y-3 px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums">{formatMoney(p.amount, currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      {PAYMENT_METHOD_LABELS[p.method]} · paid {formatPortalDate(p.paid_on)}
                      {p.reference ? ` · Ref ${p.reference}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.submitter_name ? `From ${p.submitter_name} · ` : ""}
                      Sent {formatPortalDateTime(p.created_at)}
                    </p>
                  </div>
                  <StatusBadge className={PAYMENT_STATUS_STYLES[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</StatusBadge>
                </div>
                {slipUrl && (
                  <a
                    href={slipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                  >
                    <FileText className="size-3.5" />
                    View payment slip
                  </a>
                )}
                {p.status === "rejected" && p.reject_reason && (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                    Not accepted: {p.reject_reason}
                  </p>
                )}
                {canReview && p.status === "pending" && <PaymentReview paymentId={p.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
