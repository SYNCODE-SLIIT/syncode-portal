import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, FileText } from "lucide-react";
import { PaymentReview } from "@/components/invoices/payment-review";
import { PageHeader, StatusBadge } from "@/components/ui/form-fields";
import { requireAdmin } from "@/lib/auth";
import { getSlipUrls } from "@/lib/data/invoices";
import { formatMoney, formatPortalDate, formatPortalDateTime, invoiceBalance } from "@/lib/domain";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_STYLES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { CurrencyCode, Payment } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Payments",
};

type Row = Payment & {
  invoices: { id: string; number: string; currency: CurrencyCode; total: number; amount_paid: number } | null;
  clients: { name: string } | null;
  submitter: { full_name: string } | null;
};

const SELECT =
  "*, invoices(id, number, currency, total, amount_paid), clients(name), submitter:profiles!payments_submitted_by_fkey(full_name)";

async function PaymentQueue() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: pendingRows }, { data: recentRows }] = await Promise.all([
    supabase.from("payments").select(SELECT).eq("status", "pending").order("created_at", { ascending: true }).returns<Row[]>(),
    supabase.from("payments").select(SELECT).neq("status", "pending").order("created_at", { ascending: false }).limit(25).returns<Row[]>(),
  ]);
  const pending = pendingRows ?? [];
  const recent = recentRows ?? [];
  const slipUrls = await getSlipUrls(supabase, pending.map((p) => p.slip_path));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Waiting for review ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <CreditCard className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">All caught up.</p>
            <p className="mt-1 text-sm text-muted-foreground">When a client uploads a bank slip, it appears here for you to check.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((p) => {
              const currency = p.invoices?.currency ?? "LKR";
              const slipUrl = p.slip_path ? slipUrls.get(p.slip_path) : undefined;
              return (
                <li key={p.id} className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0 space-y-1">
                    <p className="text-lg font-semibold tabular-nums">{formatMoney(p.amount, currency)}</p>
                    <p className="text-sm">
                      {p.clients?.name ?? "Client"} ·{" "}
                      {p.invoices ? (
                        <Link href={`/admin/invoices/${p.invoices.id}`} className="font-medium hover:underline">
                          {p.invoices.number}
                        </Link>
                      ) : (
                        "Invoice"
                      )}
                      {p.invoices && (
                        <span className="text-muted-foreground">
                          {" "}
                          (still owes {formatMoney(invoiceBalance(p.invoices.total, p.invoices.amount_paid), currency)})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Paid {formatPortalDate(p.paid_on)}
                      {p.reference ? ` · Ref ${p.reference}` : ""} · Sent {formatPortalDateTime(p.created_at)}
                      {p.submitter?.full_name ? ` by ${p.submitter.full_name}` : ""}
                    </p>
                    {slipUrl && (
                      <a
                        href={slipUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                      >
                        <FileText className="size-3.5" />
                        View payment slip
                      </a>
                    )}
                  </div>
                  <div className="md:w-72">
                    <PaymentReview paymentId={p.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Recently reviewed</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 px-5 py-3 text-sm sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium tabular-nums">{formatMoney(p.amount, p.invoices?.currency ?? "LKR")}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {p.clients?.name ?? "Client"} · {p.invoices?.number ?? "Invoice"} · {PAYMENT_METHOD_LABELS[p.method]}
                    </span>
                  </p>
                  {p.reject_reason && <p className="truncate text-xs text-muted-foreground">Reason: {p.reject_reason}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {p.invoices && (
                    <Link href={`/admin/invoices/${p.invoices.id}`} className="text-xs text-muted-foreground hover:text-foreground">
                      Open invoice
                    </Link>
                  )}
                  <StatusBadge className={PAYMENT_STATUS_STYLES[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billing" title="Payments" description="Check each bank slip against your account before approving it." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />}>
        <PaymentQueue />
      </Suspense>
    </div>
  );
}
