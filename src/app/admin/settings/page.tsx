import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/form-fields";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/data/invoices";
import { colomboToday, formatInvoiceNumber } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings",
};

async function SettingsContent() {
  await requireAdmin();
  const supabase = await createClient();
  const settings = await getSettings(supabase);
  const nextNumber = formatInvoiceNumber(
    settings?.invoice_prefix ?? "SYN",
    Number(colomboToday().slice(0, 4)),
    settings?.next_invoice_seq ?? 1
  );
  return <SettingsForm settings={settings} nextInvoiceNumber={nextNumber} />;
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Admin" title="Settings" />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
