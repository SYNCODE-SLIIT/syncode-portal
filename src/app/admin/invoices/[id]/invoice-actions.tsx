"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Download, Loader2, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select, Textarea, secondaryButtonClass } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteDraftInvoiceAction, recordPaymentAction, sendInvoiceAction, voidInvoiceAction } from "@/lib/actions/invoices";
import type { ActionResult } from "@/lib/actions/auth";
import { formatMoney } from "@/lib/domain";
import type { Invoice } from "@/lib/types/database";

export function InvoiceActions({ invoice, balance, today, hasBank }: { invoice: Invoice; balance: number; today: string; hasBank: boolean }) {
  const [panel, setPanel] = useState<"none" | "record" | "void" | "delete">("none");
  const [voidReason, setVoidReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
      else {
        setNotice(result.message ?? null);
        setPanel("none");
      }
    });
  };

  const isDraft = invoice.status === "draft";
  const isOpen = invoice.status === "sent" || invoice.status === "partially_paid";
  const canVoid = invoice.status !== "draft" && invoice.status !== "void";

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">Actions</h2>

      {isDraft && (
        <p className="text-sm text-muted-foreground">
          This is a draft, so the client can&apos;t see it yet. Check it, then send it.
          {!hasBank && " Tip: add your bank details in Settings so they appear on the invoice."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <>
            <Button type="button" disabled={isPending} onClick={() => run(() => sendInvoiceAction(invoice.id))} className="h-9 rounded-full px-4 text-sm font-semibold">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send to client
            </Button>
            <Link href={`/admin/invoices/${invoice.id}/edit`} className={`${secondaryButtonClass} h-9 px-4`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </>
        )}
        {isOpen && (
          <Button type="button" disabled={isPending} onClick={() => setPanel(panel === "record" ? "none" : "record")} className="h-9 rounded-full px-4 text-sm font-semibold">
            Record a payment
          </Button>
        )}
        <a href={`/invoices/${invoice.id}/pdf`} className={`${secondaryButtonClass} h-9 px-4`}>
          <Download className="size-4" />
          PDF
        </a>
        {canVoid && (
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => setPanel(panel === "void" ? "none" : "void")} className="h-9 rounded-full px-4 text-sm">
            Void invoice
          </Button>
        )}
        {isDraft && (
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => setPanel(panel === "delete" ? "none" : "delete")} className="h-9 rounded-full px-4 text-sm">
            <Trash2 className="size-4" />
            Delete draft
          </Button>
        )}
      </div>

      {panel === "record" && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            run(() => recordPaymentAction(invoice.id, formData));
          }}
          className="space-y-4 rounded-xl border border-border p-4"
        >
          <p className="text-sm text-muted-foreground">
            For money you&apos;ve already received, e.g. cash or a transfer you saw on your statement. It counts as approved straight away.
          </p>
          <fieldset disabled={isPending} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({invoice.currency})</Label>
              <Input id="amount" name="amount" inputMode="decimal" defaultValue={balance.toFixed(2)} className="h-10 rounded-xl px-3.5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid_on">Date received</Label>
              <Input id="paid_on" name="paid_on" type="date" defaultValue={today} max={today} className="h-10 rounded-xl px-3.5" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">Method</Label>
              <Select id="method" name="method" defaultValue="bank_transfer" className="h-10">
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference (optional)</Label>
              <Input id="reference" name="reference" maxLength={120} placeholder="e.g. receipt number" className="h-10 rounded-xl px-3.5" />
            </div>
          </fieldset>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} className="h-9 rounded-full px-4 text-sm font-semibold">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Record payment
            </Button>
          </div>
        </form>
      )}

      {panel === "void" && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">
            Voiding cancels the invoice for good. It stays on record, and its number isn&apos;t reused.
            {Number(invoice.amount_paid) > 0 && ` ${formatMoney(invoice.amount_paid, invoice.currency)} has already been paid on it.`}
          </p>
          <Label htmlFor="void-reason">Reason (the client sees this)</Label>
          <Textarea
            id="void-reason"
            rows={2}
            maxLength={500}
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            disabled={isPending}
            placeholder="e.g. Replaced by invoice SYN-2026-0004 with the corrected amount."
          />
          <div className="flex justify-end">
            <Button type="button" variant="destructive" disabled={isPending} onClick={() => run(() => voidInvoiceAction(invoice.id, voidReason))} className="h-9 rounded-full px-4 text-sm">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Void invoice
            </Button>
          </div>
        </div>
      )}

      {panel === "delete" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Delete this draft? This can&apos;t be undone.</p>
          <Button type="button" variant="destructive" disabled={isPending} onClick={() => run(() => deleteDraftInvoiceAction(invoice.id))} className="h-9 rounded-full px-4 text-sm">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Delete draft
          </Button>
        </div>
      )}

      <FormMessage error={error} notice={notice} />
    </section>
  );
}
