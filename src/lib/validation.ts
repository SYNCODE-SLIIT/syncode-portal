import { z } from "zod";
import { calculateInvoiceTotals, colomboToday } from "./domain.ts";
import { PROJECT_STATUSES, PROJECT_TYPES } from "./labels.ts";

/** Trimmed text; an empty field becomes null. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value));

/** Optional web address; adds https:// when the scheme is missing. */
const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(500)
    .transform((value) => {
      if (value === "") return null;
      return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    })
    .refine((value) => {
      if (value === null) return true;
      try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
      } catch {
        return false;
      }
    }, `${label} must be a valid web address.`);

/** Optional date from an <input type="date"> (YYYY-MM-DD). */
const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a valid date.")
  .transform((value) => (value === "" ? null : value));

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Enter the business name.").max(120, "Business name is too long."),
  business_type: optionalText(80, "Business type"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.")
    .transform((value) => (value === "" ? null : value)),
  phone: optionalText(40, "Phone"),
  address: optionalText(300, "Address"),
  notes: optionalText(2000, "Notes"),
  status: z.enum(["active", "inactive"]),
});

export const projectSchema = z
  .object({
    client_id: z.uuid("Choose a client."),
    name: z.string().trim().min(2, "Enter the project name.").max(120, "Project name is too long."),
    type: z.enum(PROJECT_TYPES as [string, ...string[]]),
    status: z.enum(PROJECT_STATUSES as [string, ...string[]]),
    description: optionalText(4000, "Description"),
    live_url: optionalUrl("Live URL"),
    staging_url: optionalUrl("Staging URL"),
    repo_url: optionalUrl("Repository URL"),
    start_date: optionalDate,
    target_date: optionalDate,
    progress_mode: z.enum(["auto", "manual"]),
    manual_progress: z
      .string()
      .trim()
      .transform((value) => (value === "" ? 0 : Number(value)))
      .pipe(
        z
          .number("Progress must be a number from 0 to 100.")
          .int("Progress must be a whole number.")
          .min(0, "Progress can't be below 0%.")
          .max(100, "Progress can't be above 100%.")
      ),
    member_ids: z.array(z.uuid()).max(50),
  })
  .refine((p) => !p.start_date || !p.target_date || p.target_date >= p.start_date, {
    message: "The target date can't be before the start date.",
    path: ["target_date"],
  });

export const milestoneSchema = z.object({
  title: z.string().trim().min(2, "Enter the milestone title.").max(120, "Milestone title is too long."),
  description: optionalText(1000, "Description"),
  status: z.enum(["not_started", "in_progress", "done"]),
  percent: z
    .string()
    .trim()
    .transform((value) => (value === "" ? 0 : Number(value)))
    .pipe(
      z
        .number("Progress must be a number from 0 to 100.")
        .int("Progress must be a whole number.")
        .min(0, "Progress can't be below 0%.")
        .max(100, "Progress can't be above 100%.")
    ),
  weight: z
    .string()
    .trim()
    .transform((value) => (value === "" ? 1 : Number(value)))
    .pipe(
      z
        .number("Weight must be a number.")
        .min(0.1, "Weight must be at least 0.1.")
        .max(100, "Weight can't be more than 100.")
    ),
  due_date: optionalDate,
});

export const projectUpdateSchema = z.object({
  body: z.string().trim().min(2, "Write the update first.").max(5000, "Updates can be up to 5,000 characters."),
  visibility: z.enum(["client", "internal"]),
});

export const featureRequestSchema = z.object({
  project_id: z.uuid("Choose the project this request is for."),
  title: z.string().trim().min(3, "Give the request a short title.").max(120, "The title is too long."),
  description: z
    .string()
    .trim()
    .min(10, "Describe what you need in a sentence or two.")
    .max(5000, "The description can be up to 5,000 characters."),
  priority: z.enum(["low", "normal", "high"]),
});

const optionalAmount = (label: string, max: number) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value.replace(/,/g, ""))))
    .pipe(
      z
        .number(`${label} must be a number.`)
        .min(0, `${label} can't be negative.`)
        .max(max, `${label} is too large.`)
        .transform((value) => Math.round(value * 100) / 100)
        .nullable()
    );

export const quoteSchema = z
  .object({
    estimate_hours: optionalAmount("Estimated hours", 100000),
    quote_amount: optionalAmount("Quote amount", 9_999_999_999),
    quote_currency: z.enum(["LKR", "USD"]),
  })
  .refine((q) => q.estimate_hours !== null || q.quote_amount !== null, {
    message: "Enter the estimated hours, the price, or both.",
    path: ["quote_amount"],
  });

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment first.").max(3000, "Comments can be up to 3,000 characters."),
});

export const declineReasonSchema = z
  .string()
  .trim()
  .max(1000, "Keep the reason under 1,000 characters.")
  .transform((value) => (value === "" ? null : value));

/** A number typed into a text field (commas allowed), rounded to 2 decimals. Empty counts as `empty`. */
const numberText = (label: string, { min, max, empty }: { min: number; max: number; empty: number | null }) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? empty : Number(value.replace(/,/g, ""))))
    .pipe(
      z
        .number(`${label} must be a number.`)
        .min(min, min > 0 ? `${label} must be more than 0.` : `${label} can't be negative.`)
        .max(max, `${label} is too large.`)
        .transform((value) => Math.round(value * 100) / 100)
    );

const MAX_MONEY = 9_999_999_999;

const requiredDate = (message: string) => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, message);

export const invoiceItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Every line needs a description.")
    .max(300, "Line descriptions can be up to 300 characters."),
  quantity: numberText("Quantity", { min: 0.01, max: 100_000, empty: null }),
  unit_price: numberText("Price", { min: 0, max: MAX_MONEY, empty: null }),
});

export const invoiceSchema = z
  .object({
    client_id: z.uuid("Choose a client."),
    project_id: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .pipe(z.uuid("Choose a valid project.").nullable()),
    currency: z.enum(["LKR", "USD"]),
    issue_date: requiredDate("Enter the invoice date."),
    due_date: requiredDate("Enter the due date."),
    discount: numberText("Discount", { min: 0, max: MAX_MONEY, empty: 0 }),
    tax: numberText("Tax", { min: 0, max: MAX_MONEY, empty: 0 }),
    notes: optionalText(2000, "Notes"),
    items: z
      .string()
      .transform((value, ctx) => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          ctx.addIssue({ code: "custom", message: "Add at least one line item." });
          return z.NEVER;
        }
      })
      .pipe(z.array(invoiceItemSchema).min(1, "Add at least one line item.").max(50, "An invoice can have up to 50 lines.")),
  })
  .refine((i) => i.due_date >= i.issue_date, { message: "The due date can't be before the invoice date.", path: ["due_date"] })
  .refine((i) => calculateInvoiceTotals(i.items, 0, 0).subtotal >= i.discount, {
    message: "The discount can't be more than the subtotal.",
    path: ["discount"],
  })
  .refine((i) => calculateInvoiceTotals(i.items, i.discount, i.tax).total > 0, {
    message: "The invoice total must be more than 0.",
    path: ["items"],
  });

/** A payment the client reports, or one an admin records. */
export const paymentSchema = z.object({
  amount: numberText("Amount", { min: 0.01, max: MAX_MONEY, empty: null }),
  paid_on: requiredDate("Enter the date you paid.").refine((d) => d <= colomboToday(), "The payment date can't be in the future."),
  reference: optionalText(120, "Reference"),
});

export const recordPaymentSchema = paymentSchema.extend({
  method: z.enum(["bank_transfer", "cash", "other"]),
});

export const requiredReasonSchema = z
  .string()
  .trim()
  .min(3, "Please give a short reason.")
  .max(500, "Keep the reason under 500 characters.");

export const settingsSchema = z.object({
  business_name: z.string().trim().min(2, "Enter the business name.").max(120, "Business name is too long."),
  business_address: z.string().trim().min(5, "Enter the business address.").max(300, "Address is too long."),
  business_phone: optionalText(40, "Phone"),
  business_email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  bank_name: optionalText(120, "Bank name"),
  bank_branch: optionalText(120, "Branch"),
  bank_account_name: optionalText(120, "Account name"),
  bank_account_number: optionalText(40, "Account number"),
  bank_swift_code: optionalText(20, "SWIFT code"),
  invoice_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "The invoice prefix must be 2–10 letters or numbers, e.g. SYN."),
  payment_terms_days: z
    .string()
    .trim()
    .transform((value) => (value === "" ? 14 : Number(value)))
    .pipe(
      z
        .number("Payment terms must be a number of days.")
        .int("Payment terms must be a whole number of days.")
        .min(0, "Payment terms can't be negative.")
        .max(365, "Payment terms can be up to 365 days.")
    ),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;

/** Reads named text fields from FormData, using "" for missing ones. */
export function formFields<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")])) as Record<K, string>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a UUID such as a route `[id]`; anything else should be a 404. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}
