import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/form-fields";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data/invoices";
import { getClientOptions } from "@/lib/data/options";
import { colomboToday } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceItem } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";
import { InvoiceForm } from "../../invoice-form";

export const metadata: Metadata = {
  title: "Edit invoice",
};

async function EditInvoiceContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle<Invoice>();
  if (!invoice) notFound();
  // Sent invoices are locked; they can only be voided
  if (invoice.status !== "draft") redirect(`/admin/invoices/${id}`);

  const [{ data: items }, clients, { data: projects }, settings] = await Promise.all([
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("position", { ascending: true }).returns<InvoiceItem[]>(),
    getClientOptions(supabase, invoice.client_id),
    supabase.from("projects").select("id, name, client_id").order("name", { ascending: true }),
    getSettings(supabase),
  ]);

  return (
    <>
      <PageHeader eyebrow="Edit draft" title={invoice.number} />
      <InvoiceForm
        invoice={invoice}
        items={items ?? []}
        clients={clients}
        projects={(projects ?? []).map((p) => ({ id: p.id as string, name: p.name as string, client_id: p.client_id as string }))}
        today={colomboToday()}
        paymentTermsDays={settings?.payment_terms_days ?? 14}
      />
    </>
  );
}

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
        <EditInvoiceContent params={params} />
      </Suspense>
    </div>
  );
}
