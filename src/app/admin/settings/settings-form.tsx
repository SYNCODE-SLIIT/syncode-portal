"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSettingsAction } from "@/lib/actions/settings";
import type { PortalSettings } from "@/lib/types/database";

const INPUT = "h-11 rounded-xl px-3.5";

export function SettingsForm({ settings, nextInvoiceNumber }: { settings: PortalSettings | null; nextInvoiceNumber: string }) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateSettingsAction(formData);
      if (!result.ok) setError(result.error ?? "Could not save the settings.");
      else setNotice(result.message ?? "Saved.");
    });
  };

  const field = (name: keyof PortalSettings, label: string, placeholder = "", hint?: string) => (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={(settings?.[name] as string | null) ?? ""} placeholder={placeholder} className={INPUT} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset disabled={isPending} className="space-y-6">
        <section className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-base font-semibold">Business details</h2>
            <p className="text-xs text-muted-foreground">Shown at the top of every invoice.</p>
          </div>
          {field("business_name", "Business name", "Team SYNCODE")}
          {field("business_email", "Email", "team.syncode@gmail.com")}
          {field("business_phone", "Phone", "+94 77 000 0000")}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="business_address">Address</Label>
            <Textarea id="business_address" name="business_address" rows={2} defaultValue={settings?.business_address ?? ""} />
          </div>
        </section>

        <section className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-base font-semibold">Bank details</h2>
            <p className="text-xs text-muted-foreground">Clients see these on invoices and when they pay by bank transfer.</p>
          </div>
          {field("bank_account_name", "Account name")}
          {field("bank_account_number", "Account number")}
          {field("bank_name", "Bank", "e.g. Commercial Bank of Ceylon PLC")}
          {field("bank_branch", "Branch", "e.g. Kottawa")}
          {field("bank_swift_code", "SWIFT code (for USD invoices)", "", "Only shown on USD invoices. Ask your bank for the right code.")}
        </section>

        <section className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-base font-semibold">Invoices</h2>
            <p className="text-xs text-muted-foreground">The next invoice will be {nextInvoiceNumber}. Numbers are never reused.</p>
          </div>
          {field("invoice_prefix", "Invoice number prefix", "SYN")}
          <div className="space-y-2">
            <Label htmlFor="payment_terms_days">Payment terms (days)</Label>
            <Input
              id="payment_terms_days"
              name="payment_terms_days"
              inputMode="numeric"
              defaultValue={settings?.payment_terms_days ?? 14}
              className={INPUT}
            />
            <p className="text-xs text-muted-foreground">New invoices are due this many days after the invoice date.</p>
          </div>
        </section>
      </fieldset>

      <FormMessage error={error} notice={notice} />

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="h-10 rounded-full px-6 text-sm font-semibold">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save settings
        </Button>
      </div>
    </form>
  );
}
