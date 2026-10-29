import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/ui/form-fields";
import { requireClient } from "@/lib/auth";
import { colomboToday, formatMoney, formatPortalDate, getInvoiceDisplayStatus, invoiceBalance } from "@/lib/domain";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Invoices",
};

async function ClientInvoiceList() {
  await requireClient();
  // Row-level security only returns this client's own invoices, and never drafts
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").order("issue_date", { ascending: false }).returns<Invoice[]>();
  const invoices = data ?? [];
  const today = colomboToday();

  if (invoices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <FileText className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">No invoices yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">Invoices from Team SYNCODE will appear here.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {invoices.map((inv) => {
        const display = getInvoiceDisplayStatus(inv.status, inv.due_date, today);
        const unpaid = inv.status === "sent" || inv.status === "partially_paid";
        return (
          <li key={inv.id}>
            <Link
              href={`/invoices/${inv.id}`}
              className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium tabular-nums">{inv.number}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPortalDate(inv.issue_date)}
                  {unpaid ? ` · Due ${formatPortalDate(inv.due_date)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 sm:justify-end">
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatMoney(inv.total, inv.currency)}</p>
                  {unpaid && (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatMoney(invoiceBalance(inv.total, inv.amount_paid), inv.currency)} to pay
                    </p>
                  )}
                </div>
                <StatusBadge className={INVOICE_STATUS_STYLES[display]}>{INVOICE_STATUS_LABELS[display]}</StatusBadge>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function ClientInvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Billing" title="Invoices" description="Open an invoice to download it or to send us your payment slip." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />}>
        <ClientInvoiceList />
      </Suspense>
    </div>
  );
}
