import type {
  CurrencyCode,
  DisplayInvoiceStatus,
  InvoiceStatus,
  MilestoneStatus,
  ProgressMode,
} from "@/lib/types/database";

/**
 * Formats an invoice number such as `SYN-2026-0001`.
 */
export function formatInvoiceNumber(
  prefix: string,
  year: number,
  sequence: number
): string {
  const cleanPrefix = prefix.trim().toUpperCase() || "SYN";
  const seqStr = String(Math.max(1, Math.floor(sequence))).padStart(4, "0");
  return `${cleanPrefix}-${year}-${seqStr}`;
}

/**
 * Calculates project progress (0–100) from milestones or manual setting.
 * Per Master Plan 4.4:
 * Project progress = Σ(milestone percent × weight) / Σ(weight). "Done" counts as 100%.
 */
export function calculateProjectProgress(
  mode: ProgressMode,
  manualProgress: number,
  milestones: ReadonlyArray<{
    status: MilestoneStatus;
    percent: number;
    weight: number;
  }>
): number {
  if (mode === "manual") {
    return Math.min(100, Math.max(0, Math.round(manualProgress)));
  }

  if (milestones.length === 0) {
    return 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const milestone of milestones) {
    const weight = Number(milestone.weight);
    if (!Number.isFinite(weight) || weight <= 0) continue;

    const effectivePercent =
      milestone.status === "done"
        ? 100
        : milestone.status === "not_started"
          ? 0
          : Math.min(100, Math.max(0, Number(milestone.percent)));

    weightedSum += effectivePercent * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(weightedSum / totalWeight)));
}

/**
 * Integer-cents arithmetic helper to avoid JS floating-point drift (Master Plan Rule 6).
 */
function toCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

export function calculateLineItemAmount(
  quantity: number,
  unitPrice: number
): number {
  const rawCents = Math.round(Number(quantity) * Number(unitPrice) * 100);
  return fromCents(Math.max(0, rawCents));
}

export function calculateInvoiceTotals(
  items: ReadonlyArray<{ quantity: number; unit_price: number }>,
  discount = 0,
  tax = 0
): {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
} {
  let subtotalCents = 0;
  for (const item of items) {
    subtotalCents += Math.max(
      0,
      Math.round(Number(item.quantity) * Number(item.unit_price) * 100)
    );
  }

  const discountCents = Math.max(0, toCents(discount));
  const taxCents = Math.max(0, toCents(tax));
  const totalCents = Math.max(0, subtotalCents - discountCents + taxCents);

  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    tax: fromCents(taxCents),
    total: fromCents(totalCents),
  };
}

/**
 * Derives display status including `overdue` (sent or partially_paid and due_date < today).
 * Per Master Plan 6: overdue is derived, not stored.
 */
export function getInvoiceDisplayStatus(
  status: InvoiceStatus,
  dueDate: string,
  todayIsoDate?: string
): DisplayInvoiceStatus {
  if (status === "sent" || status === "partially_paid") {
    const today =
      todayIsoDate ??
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

    if (dueDate < today) {
      return "overdue";
    }
  }
  return status;
}

/**
 * Formats money with explicit currency code (`LKR 125,000.00`, `USD 1,200.00`) per Section 9.
 */
export function formatMoney(amount: number, currency: CurrencyCode): string {
  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

  return `${currency} ${formattedNumber}`;
}

/**
 * Formats an ISO date or timestamp as `26 Oct 2026` in Sri Lanka time (Asia/Colombo).
 */
export function formatPortalDate(dateInput: string | Date): string {
  const date =
    typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
      ? new Date(`${dateInput}T00:00:00+05:30`)
      : new Date(dateInput);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).format(date);
}
