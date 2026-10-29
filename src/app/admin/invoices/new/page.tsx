import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/form-fields";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data/invoices";
import { getClientOptions } from "@/lib/data/options";
import { colomboToday } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "../invoice-form";

export const metadata: Metadata = {
  title: "New invoice",
};

async function NewInvoiceContent({ searchParams }: { searchParams: Promise<{ client?: string; project?: string }> }) {
  await requireAdmin();
  const { client, project } = await searchParams;
  const supabase = await createClient();
  const [clients, { data: projects }, settings] = await Promise.all([
    getClientOptions(supabase),
    supabase.from("projects").select("id, name, client_id").order("name", { ascending: true }),
    getSettings(supabase),
  ]);

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Invoices are sent to a client.{" "}
        <Link href="/admin/clients/new" className="text-foreground underline underline-offset-4">
          Add a client first
        </Link>
        .
      </div>
    );
  }

  const projectOptions = (projects ?? []).map((p) => ({ id: p.id as string, name: p.name as string, client_id: p.client_id as string }));
  const defaultProject = projectOptions.find((p) => p.id === project);
  const defaultClientId = defaultProject?.client_id ?? (clients.some((c) => c.id === client) ? client : undefined);

  return (
    <InvoiceForm
      clients={clients}
      projects={projectOptions}
      defaultClientId={defaultClientId}
      defaultProjectId={defaultProject?.id}
      today={colomboToday()}
      paymentTermsDays={settings?.payment_terms_days ?? 14}
    />
  );
}

export default function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string; project?: string }> }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Invoices" title="New invoice" description="The invoice number is given automatically when you create the draft." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
        <NewInvoiceContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
