"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select, Textarea, secondaryButtonClass } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveInvoiceAction } from "@/lib/actions/invoices";
import { addDays, calculateInvoiceTotals, formatMoney } from "@/lib/domain";
import type { CurrencyCode, Invoice, InvoiceItem } from "@/lib/types/database";

const INPUT = "h-11 rounded-xl px-3.5";

interface Line {
  key: number;
  description: string;
  quantity: string;
  unit_price: string;
}

/** Reads a typed amount for the live preview; the server validates properly. */
function toNumber(value: string): number {
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function InvoiceForm({
  invoice,
  items = [],
  clients,
  projects,
  defaultClientId = "",
  defaultProjectId = "",
  today,
  paymentTermsDays,
}: {
  invoice?: Invoice;
  items?: InvoiceItem[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; client_id: string }[];
  defaultClientId?: string;
  defaultProjectId?: string;
  today: string;
  paymentTermsDays: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [clientId, setClientId] = useState(invoice?.client_id ?? defaultClientId);
  const [projectId, setProjectId] = useState(invoice?.project_id ?? defaultProjectId);
  const [currency, setCurrency] = useState<CurrencyCode>(invoice?.currency ?? "LKR");
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? today);
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? addDays(today, paymentTermsDays));
  const [discount, setDiscount] = useState(invoice && Number(invoice.discount) > 0 ? String(invoice.discount) : "");
  const [tax, setTax] = useState(invoice && Number(invoice.tax) > 0 ? String(invoice.tax) : "");
  const [lines, setLines] = useState<Line[]>(
    items.length > 0
      ? items.map((item, index) => ({
          key: index,
          description: item.description,
          quantity: String(Number(item.quantity)),
          unit_price: String(Number(item.unit_price)),
        }))
      : [{ key: 0, description: "", quantity: "1", unit_price: "" }]
  );
  const [nextKey, setNextKey] = useState(lines.length);

  const clientProjects = projects.filter((p) => p.client_id === clientId);
  const totals = calculateInvoiceTotals(
    lines.map((l) => ({ quantity: toNumber(l.quantity), unit_price: toNumber(l.unit_price) })),
    toNumber(discount),
    toNumber(tax)
  );
  const cancelHref = invoice ? `/admin/invoices/${invoice.id}` : "/admin/invoices";

  const updateLine = (key: number, field: keyof Omit<Line, "key">, value: string) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, [field]: value } : l)));

  const addLine = () => {
    setLines((current) => [...current, { key: nextKey, description: "", quantity: "1", unit_price: "" }]);
    setNextKey(nextKey + 1);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set(
      "items",
      JSON.stringify(
        lines
          .filter((l) => l.description.trim() || l.unit_price.trim())
          .map(({ description, quantity, unit_price }) => ({ description, quantity, unit_price }))
      )
    );
    startTransition(async () => {
      const result = await saveInvoiceAction(invoice?.id ?? null, formData);
      if (!result.ok) setError(result.error ?? "Could not save the invoice.");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <fieldset disabled={isPending} className="space-y-6">
        <section className="grid gap-5 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
          <h2 className="text-base font-semibold sm:col-span-2">Invoice</h2>

          <div className="space-y-2">
            <Label htmlFor="client_id">Client</Label>
            <Select
              id="client_id"
              name="client_id"
              required
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setProjectId("");
              }}
            >
              <option value="" disabled>
                Choose a client…
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project_id">Project (optional)</Label>
            <Select id="project_id" name="project_id" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!clientId}>
              <option value="">No specific project</option>
              {clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
              <option value="LKR">LKR (Sri Lankan rupees)</option>
              <option value="USD">USD (US dollars)</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="issue_date">Invoice date</Label>
              <Input
                id="issue_date"
                name="issue_date"
                type="date"
                value={issueDate}
                onChange={(e) => {
                  const value = e.target.value;
                  // Keep the payment terms when the date moves, unless the due date was set by hand
                  if (value && dueDate === addDays(issueDate, paymentTermsDays)) setDueDate(addDays(value, paymentTermsDays));
                  setIssueDate(value);
                }}
                className={INPUT}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" name="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={INPUT} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">Line items</h2>
            <p className="text-xs text-muted-foreground">What the client is paying for. Amounts are in {currency}.</p>
          </div>

          <div className="space-y-3 p-6">
            <div className="hidden grid-cols-[1fr_90px_150px_130px_40px] gap-3 text-xs font-medium text-muted-foreground sm:grid">
              <span>Description</span>
              <span>Qty</span>
              <span>Price</span>
              <span className="text-right">Amount</span>
              <span />
            </div>
            {lines.map((line, index) => (
              <div key={line.key} className="grid grid-cols-[1fr_1fr_auto] gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_90px_150px_130px_40px] sm:items-center sm:border-0 sm:p-0">
                <Input
                  aria-label={`Line ${index + 1} description`}
                  value={line.description}
                  onChange={(e) => updateLine(line.key, "description", e.target.value)}
                  placeholder="e.g. Website design and development"
                  maxLength={300}
                  className={`${INPUT} col-span-3 sm:col-span-1`}
                />
                <Input
                  aria-label={`Line ${index + 1} quantity`}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, "quantity", e.target.value)}
                  className={INPUT}
                />
                <Input
                  aria-label={`Line ${index + 1} price`}
                  inputMode="decimal"
                  value={line.unit_price}
                  onChange={(e) => updateLine(line.key, "unit_price", e.target.value)}
                  placeholder="0.00"
                  className={INPUT}
                />
                <p className="col-span-2 self-center text-sm tabular-nums text-muted-foreground sm:col-span-1 sm:text-right">
                  {formatMoney(toNumber(line.quantity) * toNumber(line.unit_price), currency)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove line ${index + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                  className="justify-self-end"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addLine} disabled={lines.length >= 50} className="h-9 rounded-full px-4 text-sm">
              <Plus className="size-4" />
              Add line
            </Button>
          </div>

          <div className="grid gap-6 border-t border-border p-6 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-3 self-start">
              <div className="space-y-2">
                <Label htmlFor="discount">Discount</Label>
                <Input id="discount" name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0.00" className={INPUT} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax">Tax</Label>
                <Input id="tax" name="tax" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0.00" className={INPUT} />
              </div>
            </div>
            <dl className="space-y-1.5 text-sm sm:pl-6">
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(totals.subtotal, currency)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">− {formatMoney(totals.discount, currency)}</dd>
                </div>
              )}
              {totals.tax > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Tax</dt>
                  <dd className="tabular-nums">{formatMoney(totals.tax, currency)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney(totals.total, currency)}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border border-border bg-card p-6">
          <Label htmlFor="notes">Notes (the client sees these)</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={invoice?.notes ?? ""}
            placeholder="e.g. 50% advance for the website project. The balance is due on delivery."
          />
        </section>
      </fieldset>

      <FormMessage error={error} />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={secondaryButtonClass}>
          Cancel
        </Link>
        <Button type="submit" disabled={isPending} className="h-10 rounded-full px-6 text-sm font-semibold">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {invoice ? "Save draft" : "Create draft"}
        </Button>
      </div>
      <p className="text-right text-xs text-muted-foreground">Drafts stay hidden from the client until you send them.</p>
    </form>
  );
}
