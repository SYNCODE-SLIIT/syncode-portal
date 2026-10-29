import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { PageHeader, StatusBadge, primaryButtonClass } from "@/components/ui/form-fields";
import { requireAdmin } from "@/lib/auth";
import { colomboToday, formatMoney, formatPortalDate, getInvoiceDisplayStatus, invoiceBalance } from "@/lib/domain";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Invoices",
};

const FILTERS = {
  open: "Open",
  draft: "Drafts",
  unpaid: "Unpaid",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
  all: "All",
} as const;

type FilterKey = keyof typeof FILTERS;
type Row = Invoice & { clients: { name: string } | null };

async function InvoiceList({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status } = await searchParams;
  const filter: FilterKey = status && status in FILTERS ? (status as FilterKey) : "open";

  const supabase = await createClient();
  const today = colomboToday();
  let query = supabase.from("invoices").select("*, clients(name)").order("created_at", { ascending: false }).limit(300);
  if (filter === "open") query = query.in("status", ["draft", "sent", "partially_paid"]);
  if (filter === "draft") query = query.eq("status", "draft");
  if (filter === "unpaid") query = query.in("status", ["sent", "partially_paid"]);
  if (filter === "overdue") query = query.in("status", ["sent", "partially_paid"]).lt("due_date", today);
  if (filter === "paid") query = query.eq("status", "paid");
  if (filter === "void") query = query.eq("status", "void");
  const { data } = await query.returns<Row[]>();
  const invoices = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-full border border-border p-1 text-xs sm:w-fit">
        {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
          <Link
            key={key}
            href={{ pathname: "/admin/invoices", query: { status: key } }}
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
              filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {FILTERS[key]}
          </Link>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No invoices here.</p>
          <p className="mt-1 text-sm text-muted-foreground">Create an invoice for a client and send it when it&apos;s ready.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {invoices.map((inv) => {
            const display = getInvoiceDisplayStatus(inv.status, inv.due_date, today);
            const balance = invoiceBalance(inv.total, inv.amount_paid);
            return (
              <li key={inv.id}>
                <Link
                  href={`/admin/invoices/${inv.id}`}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      <span className="tabular-nums">{inv.number}</span>
                      <span className="text-muted-foreground"> · {inv.clients?.name ?? "Client"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatPortalDate(inv.issue_date)} · Due {formatPortalDate(inv.due_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:justify-end">
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatMoney(inv.total, inv.currency)}</p>
                      {inv.status === "partially_paid" && (
                        <p className="text-xs tabular-nums text-muted-foreground">{formatMoney(balance, inv.currency)} left</p>
                      )}
                    </div>
                    <StatusBadge className={INVOICE_STATUS_STYLES[display]}>{INVOICE_STATUS_LABELS[display]}</StatusBadge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        actions={
          <Link href="/admin/invoices/new" className={primaryButtonClass}>
            <Plus className="size-4" />
            New invoice
          </Link>
        }
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />}>
        <InvoiceList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
