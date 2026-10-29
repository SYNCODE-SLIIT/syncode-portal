import { formatMoney, formatPortalDate, getInvoiceDisplayStatus } from "@/lib/domain";
import type { InvoiceDetail } from "@/lib/data/invoices";
import { INVOICE_STATUS_LABELS } from "@/lib/labels";

/** The invoice as a printed page: white paper, business details, lines, totals and bank details. */
export function InvoicePaper({ detail }: { detail: InvoiceDetail }) {
  const { invoice, items, client, projectName, settings } = detail;
  const status = getInvoiceDisplayStatus(invoice.status, invoice.due_date);
  const balance = Math.max(0, Number(invoice.total) - Number(invoice.amount_paid));
  const money = (value: number) => formatMoney(value, invoice.currency);

  return (
    <article className="overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-xl">
      <header className="flex flex-col gap-6 bg-neutral-950 px-6 py-7 text-white sm:flex-row sm:items-start sm:justify-between sm:px-10">
        <div>
          <p className="text-xl font-extrabold tracking-[0.3em]">SYNCODE</p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            {settings?.business_name ?? "Team SYNCODE"}
            <br />
            {settings?.business_address}
            <br />
            {[settings?.business_email, settings?.business_phone].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-400">Invoice</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{invoice.number}</p>
          <p className="mt-2 inline-block rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-medium">
            {INVOICE_STATUS_LABELS[status]}
          </p>
        </div>
      </header>

      <div className="space-y-8 px-6 py-8 sm:px-10">
        <div className="grid gap-6 text-sm sm:grid-cols-3">
          <div className="sm:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Bill to</p>
            <p className="mt-1 font-semibold">{client?.name ?? "Client"}</p>
            {client?.address && <p className="whitespace-pre-line text-neutral-600">{client.address}</p>}
            {client?.email && <p className="text-neutral-600">{client.email}</p>}
            {client?.phone && <p className="text-neutral-600">{client.phone}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Invoice date</p>
            <p className="mt-1">{formatPortalDate(invoice.issue_date)}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Due date</p>
            <p className="mt-1">{formatPortalDate(invoice.due_date)}</p>
          </div>
          {projectName && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Project</p>
              <p className="mt-1">{projectName}</p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wider text-neutral-400">
                <th className="py-2 pr-4 font-semibold">Description</th>
                <th className="py-2 pr-4 text-right font-semibold">Qty</th>
                <th className="py-2 pr-4 text-right font-semibold">Price</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-neutral-100 align-top">
                  <td className="whitespace-pre-line py-3 pr-4">{item.description}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{Number(item.quantity)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{money(item.unit_price)}</td>
                  <td className="py-3 text-right tabular-nums">{money(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <Row label="Subtotal" value={money(invoice.subtotal)} />
            {Number(invoice.discount) > 0 && <Row label="Discount" value={`− ${money(invoice.discount)}`} />}
            {Number(invoice.tax) > 0 && <Row label="Tax" value={money(invoice.tax)} />}
            <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(invoice.total)}</dd>
            </div>
            {Number(invoice.amount_paid) > 0 && <Row label="Paid" value={`− ${money(invoice.amount_paid)}`} />}
            {invoice.status !== "void" && invoice.status !== "draft" && (
              <div className="flex justify-between rounded-lg bg-neutral-100 px-3 py-2 font-semibold">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{money(balance)}</dd>
              </div>
            )}
          </dl>
        </div>

        {invoice.status === "void" && (
          <p className="rounded-lg bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
            This invoice was voided{invoice.voided_at ? ` on ${formatPortalDate(invoice.voided_at)}` : ""}.
            {invoice.void_reason ? ` Reason: ${invoice.void_reason}` : ""}
          </p>
        )}

        {invoice.notes && (
          <div className="text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Notes</p>
            <p className="mt-1 whitespace-pre-line text-neutral-600">{invoice.notes}</p>
          </div>
        )}

        {settings?.bank_account_number && (
          <div className="rounded-xl border border-neutral-200 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Pay by bank transfer</p>
            <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <BankRow label="Account name" value={settings.bank_account_name} />
              <BankRow label="Account number" value={settings.bank_account_number} />
              <BankRow label="Bank" value={settings.bank_name} />
              <BankRow label="Branch" value={settings.bank_branch} />
              {invoice.currency === "USD" && <BankRow label="SWIFT code" value={settings.bank_swift_code} />}
            </dl>
            <p className="mt-3 text-xs text-neutral-500">Please use {invoice.number} as the payment reference.</p>
          </div>
        )}
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-neutral-600">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function BankRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <dt className="text-neutral-500">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
