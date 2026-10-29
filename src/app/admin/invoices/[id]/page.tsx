import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InvoicePaper } from "@/components/invoices/invoice-paper";
import { PaymentList, type PaymentRow } from "@/components/invoices/payment-list";
import { requireAdmin } from "@/lib/auth";
import { getInvoiceDetail, getSlipUrls, hasBankDetails } from "@/lib/data/invoices";
import { colomboToday, formatPortalDateTime, invoiceBalance } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import type { Payment } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";
import { InvoiceActions } from "./invoice-actions";

export const metadata: Metadata = {
  title: "Invoice",
};

async function AdminInvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [detail, { data: paymentRows }] = await Promise.all([
    getInvoiceDetail(supabase, id),
    supabase
      .from("payments")
      .select("*, submitter:profiles!payments_submitted_by_fkey(full_name)")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!detail) notFound();

  const payments: PaymentRow[] = (paymentRows ?? []).map((row) => {
    const { submitter, ...payment } = row as Payment & { submitter: { full_name: string } | null };
    return { ...payment, submitter_name: submitter?.full_name || null };
  });
  const slipUrls = await getSlipUrls(supabase, payments.map((p) => p.slip_path));
  const { invoice } = detail;

  return (
    <div className="space-y-6">
      <Link href="/admin/invoices" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Invoices
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoicePaper detail={detail} />
        </div>
        <div className="space-y-6">
          <InvoiceActions
            invoice={invoice}
            balance={invoiceBalance(invoice.total, invoice.amount_paid)}
            today={colomboToday()}
            hasBank={hasBankDetails(detail.settings)}
          />
          <PaymentList
            payments={payments}
            currency={invoice.currency}
            slipUrls={slipUrls}
            canReview
            emptyText={invoice.status === "draft" ? "Payments appear here once the invoice is sent." : "No payments yet."}
          />
          <section className="space-y-1 rounded-2xl border border-border bg-card p-6 text-xs text-muted-foreground">
            {detail.client && (
              <p>
                Client:{" "}
                <Link href={`/admin/clients/${detail.client.id}`} className="text-foreground hover:underline">
                  {detail.client.name}
                </Link>
              </p>
            )}
            {invoice.project_id && detail.projectName && (
              <p>
                Project:{" "}
                <Link href={`/admin/projects/${invoice.project_id}`} className="text-foreground hover:underline">
                  {detail.projectName}
                </Link>
              </p>
            )}
            <p>Created {formatPortalDateTime(invoice.created_at)}</p>
            {invoice.sent_at && <p>Sent {formatPortalDateTime(invoice.sent_at)}</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
      <AdminInvoiceDetail params={params} />
    </Suspense>
  );
}
