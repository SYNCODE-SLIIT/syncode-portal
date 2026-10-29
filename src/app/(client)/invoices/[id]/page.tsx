import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { InvoicePaper } from "@/components/invoices/invoice-paper";
import { PaymentList } from "@/components/invoices/payment-list";
import { secondaryButtonClass } from "@/components/ui/form-fields";
import { requireClient } from "@/lib/auth";
import { getInvoiceDetail, getSlipUrls, hasBankDetails } from "@/lib/data/invoices";
import { colomboToday, formatMoney, invoiceBalance } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import type { Payment } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";
import { PayForm } from "./pay-form";

export const metadata: Metadata = {
  title: "Invoice",
};

async function ClientInvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireClient();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  // Row-level security only returns this client's own invoices, and never drafts
  const supabase = await createClient();
  const [detail, { data: paymentRows }] = await Promise.all([
    getInvoiceDetail(supabase, id),
    supabase.from("payments").select("*").eq("invoice_id", id).order("created_at", { ascending: false }).returns<Payment[]>(),
  ]);
  if (!detail || !session.profile.client_id) notFound();

  const payments = paymentRows ?? [];
  const slipUrls = await getSlipUrls(supabase, payments.map((p) => p.slip_path));
  const { invoice } = detail;
  const balance = invoiceBalance(invoice.total, invoice.amount_paid);
  const pendingTotal = payments.filter((p) => p.status === "pending").reduce((sum, p) => sum + Number(p.amount), 0);
  const canPay = (invoice.status === "sent" || invoice.status === "partially_paid") && balance > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/invoices" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Invoices
        </Link>
        <a href={`/invoices/${invoice.id}/pdf`} className={`${secondaryButtonClass} h-9 px-4`}>
          <Download className="size-4" />
          Download PDF
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <InvoicePaper detail={detail} />
        </div>

        <div className="space-y-6">
          {canPay && (
            <section id="pay" className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <div>
                <h2 className="text-base font-semibold">Pay this invoice</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasBankDetails(detail.settings)
                    ? "Transfer the amount to the bank account on the invoice, then upload your bank slip here. We'll confirm it shortly."
                    : "Make the payment as agreed with Team SYNCODE, then upload your slip or receipt here."}
                </p>
              </div>
              <p className="rounded-xl bg-secondary px-4 py-3 text-sm">
                Balance due: <span className="font-semibold tabular-nums">{formatMoney(balance, invoice.currency)}</span>
              </p>
              {pendingTotal > 0 && (
                <p className="text-sm text-amber-300">
                  {formatMoney(pendingTotal, invoice.currency)} you sent is waiting for our review. Only send another slip for a different payment.
                </p>
              )}
              <PayForm
                invoiceId={invoice.id}
                clientId={session.profile.client_id}
                currency={invoice.currency}
                balance={balance}
                today={colomboToday()}
              />
            </section>
          )}

          {invoice.status === "paid" && (
            <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-sm text-emerald-300">
              This invoice is fully paid. Thank you!
            </section>
          )}

          <PaymentList payments={payments} currency={invoice.currency} slipUrls={slipUrls} emptyText="No payments yet." />
        </div>
      </div>
    </div>
  );
}

export default function ClientInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
      <ClientInvoiceDetail params={params} />
    </Suspense>
  );
}
