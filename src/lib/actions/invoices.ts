"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireClient } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { SLIP_TYPES, MAX_SLIP_BYTES } from "@/lib/attachments";
import { formatMoney, formatPortalDate, invoiceBalance } from "@/lib/domain";
import { notify } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Invoice } from "@/lib/types/database";
import {
  firstError,
  formFields,
  invoiceSchema,
  isUuid,
  paymentSchema,
  recordPaymentSchema,
  requiredReasonSchema,
} from "@/lib/validation";
import type { ActionResult } from "./auth";

const INVOICE_FIELDS = ["client_id", "project_id", "currency", "issue_date", "due_date", "discount", "tax", "notes", "items"] as const;

/** Activity is written with the service role because clients can't write the log themselves. */
async function logActivity(actorId: string, entityType: string, entityId: string, action: string, details: Record<string, unknown>) {
  try {
    await createAdminClient().from("activity_log").insert({ actor_id: actorId, entity_type: entityType, entity_id: entityId, action, details });
  } catch {
    // Logging must never block the user's action
  }
}

function refresh(invoiceId?: string, clientId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/payments");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  if (invoiceId) {
    revalidatePath(`/admin/invoices/${invoiceId}`);
    revalidatePath(`/invoices/${invoiceId}`);
  }
  if (clientId) revalidatePath(`/admin/clients/${clientId}`);
}

/** Admin action: creates a draft invoice, or saves changes to one. */
export async function saveInvoiceAction(invoiceId: string | null, formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (invoiceId !== null && !isUuid(invoiceId)) return { ok: false, error: "Invoice not found." };

  const parsed = invoiceSchema.safeParse(formFields(formData, INVOICE_FIELDS));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  // One database call saves the invoice and its lines together
  const supabase = await createClient();
  const { data: savedId, error } = await supabase.rpc("save_invoice_draft", {
    p_invoice_id: invoiceId,
    p_client_id: input.client_id,
    p_project_id: input.project_id,
    p_currency: input.currency,
    p_issue_date: input.issue_date,
    p_due_date: input.due_date,
    p_discount: input.discount,
    p_tax: input.tax,
    p_notes: input.notes,
    p_items: input.items,
  });
  if (error || !savedId) {
    if (error?.message.includes("Only draft")) return { ok: false, error: "This invoice has already been sent, so it can't be edited." };
    if (error?.message.includes("does not belong")) return { ok: false, error: "That project belongs to a different client." };
    return { ok: false, error: "Could not save the invoice. Please try again." };
  }

  const id = savedId as string;
  await logActivity(session.userId, "invoice", id, invoiceId ? "invoice.updated" : "invoice.created", { client_id: input.client_id });
  refresh(id, input.client_id);
  await setFlash(invoiceId ? "Invoice saved." : "Draft invoice created.");
  redirect(`/admin/invoices/${id}`);
}

/** Admin action: makes a draft invoice visible to the client. */
export async function sendInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!isUuid(invoiceId)) return { ok: false, error: "Invoice not found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "sent" })
    .eq("id", invoiceId)
    .eq("status", "draft")
    .gt("total", 0)
    .select("number, client_id, total, currency, due_date")
    .maybeSingle<Pick<Invoice, "number" | "client_id" | "total" | "currency" | "due_date">>();
  if (error || !data) return { ok: false, error: "Only a draft invoice with a total above 0 can be sent." };

  await logActivity(session.userId, "invoice", invoiceId, "invoice.sent", { number: data.number });
  const amount = formatMoney(data.total, data.currency);
  notify({
    to: { clientContactsOf: data.client_id },
    actorId: session.userId,
    type: "invoice_sent",
    title: `New invoice ${data.number}`,
    body: `${amount} · due ${formatPortalDate(data.due_date)}`,
    link: `/invoices/${invoiceId}`,
    email: {
      eyebrow: "New invoice",
      subject: `Invoice ${data.number} from Team SYNCODE (${amount})`,
      paragraphs: [
        `Team SYNCODE has sent you invoice ${data.number} for ${amount}, due on ${formatPortalDate(data.due_date)}.`,
        "You can view and download it in the portal. Once you've paid by bank transfer, upload the slip on the invoice page and we'll confirm it.",
      ],
      buttonLabel: "View invoice",
      reason: "You're receiving this because you're a billing contact for your business.",
    },
  });
  refresh(invoiceId, data.client_id as string);
  return { ok: true, message: `Invoice ${data.number} sent. The client can see it now.` };
}

/** Admin action: cancels a sent invoice. It stays on record with the reason. */
export async function voidInvoiceAction(invoiceId: string, reason: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!isUuid(invoiceId)) return { ok: false, error: "Invoice not found." };
  const parsedReason = requiredReasonSchema.safeParse(reason);
  if (!parsedReason.success) return { ok: false, error: firstError(parsedReason.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "void", void_reason: parsedReason.data })
    .eq("id", invoiceId)
    .in("status", ["sent", "partially_paid", "paid"])
    .select("number, client_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "This invoice can't be voided." };

  await logActivity(session.userId, "invoice", invoiceId, "invoice.voided", { number: data.number, reason: parsedReason.data });
  refresh(invoiceId, data.client_id as string);
  return { ok: true, message: `Invoice ${data.number} voided.` };
}

/** Admin action: deletes a draft that was never sent. */
export async function deleteDraftInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!isUuid(invoiceId)) return { ok: false, error: "Invoice not found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("status", "draft")
    .select("number, client_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Only draft invoices can be deleted." };

  await logActivity(session.userId, "invoice", invoiceId, "invoice.deleted", { number: data.number });
  refresh(undefined, data.client_id as string);
  await setFlash(`Draft ${data.number} deleted.`);
  redirect("/admin/invoices");
}

/** Admin action: records a payment received outside the portal (cash, a transfer seen on the statement). */
export async function recordPaymentAction(invoiceId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!isUuid(invoiceId)) return { ok: false, error: "Invoice not found." };
  const parsed = recordPaymentSchema.safeParse(formFields(formData, ["amount", "paid_on", "reference", "method"] as const));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("client_id, status, total, amount_paid")
    .eq("id", invoiceId)
    .maybeSingle<Pick<Invoice, "client_id" | "status" | "total" | "amount_paid">>();
  if (!invoice || (invoice.status !== "sent" && invoice.status !== "partially_paid")) {
    return { ok: false, error: "Payments can only be recorded on an unpaid, sent invoice." };
  }
  if (parsed.data.amount > invoiceBalance(invoice.total, invoice.amount_paid)) {
    return { ok: false, error: "The amount is more than what's still owed on this invoice." };
  }

  const { error } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    client_id: invoice.client_id,
    ...parsed.data,
    status: "approved",
    submitted_by: session.userId,
    reviewed_by: session.userId,
    reviewed_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: "Could not record the payment. Please try again." };

  await logActivity(session.userId, "invoice", invoiceId, "payment.recorded", { amount: parsed.data.amount, method: parsed.data.method });
  refresh(invoiceId, invoice.client_id);
  return { ok: true, message: "Payment recorded." };
}

/** Admin action: approves or rejects a payment slip. Approving updates what the invoice shows as paid. */
export async function reviewPaymentAction(
  paymentId: string,
  decision: "approved" | "rejected",
  reason?: string
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!isUuid(paymentId) || (decision !== "approved" && decision !== "rejected")) return { ok: false, error: "Payment not found." };

  let rejectReason: string | null = null;
  if (decision === "rejected") {
    const parsedReason = requiredReasonSchema.safeParse(reason ?? "");
    if (!parsedReason.success) return { ok: false, error: "Tell the client why the payment was rejected." };
    rejectReason = parsedReason.data;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .update({ status: decision, reject_reason: rejectReason, reviewed_by: session.userId, reviewed_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("invoice_id, client_id, amount, submitted_by, invoices(number, currency)")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "This payment has already been reviewed." };

  const inv = data.invoices as unknown as { number: string; currency: Invoice["currency"] } | null;
  const paidText = formatMoney(data.amount as number, inv?.currency ?? "LKR");
  notify({
    to: { profileIds: [data.submitted_by as string | null] },
    actorId: session.userId,
    type: decision === "approved" ? "payment_approved" : "payment_rejected",
    title: decision === "approved" ? `Payment confirmed for ${inv?.number ?? "your invoice"}` : `Payment not accepted for ${inv?.number ?? "your invoice"}`,
    body: decision === "approved" ? paidText : (rejectReason ?? undefined),
    link: `/invoices/${data.invoice_id}`,
    email: {
      eyebrow: decision === "approved" ? "Payment confirmed" : "Payment not accepted",
      subject:
        decision === "approved"
          ? `Payment received: ${inv?.number ?? "invoice"} (${paidText})`
          : `Please check your payment for ${inv?.number ?? "your invoice"}`,
      paragraphs:
        decision === "approved"
          ? [`Thank you! We've received your payment of ${paidText} for invoice ${inv?.number ?? ""}.`]
          : [`We couldn't confirm your payment of ${paidText} for invoice ${inv?.number ?? ""}.`, `Reason: ${rejectReason}`, "Please check and upload the slip again, or contact us."],
      buttonLabel: "View invoice",
      reason: "You're receiving this because you sent this payment.",
    },
  });

  await logActivity(session.userId, "payment", paymentId, decision === "approved" ? "payment.approved" : "payment.rejected", {
    invoice_id: data.invoice_id,
    amount: data.amount,
    reason: rejectReason,
  });
  refresh(data.invoice_id as string, data.client_id as string);
  return { ok: true, message: decision === "approved" ? "Payment approved." : "Payment rejected. The client can see the reason." };
}

/** Client action: reports a bank transfer, with the slip they already uploaded to storage. */
export async function submitPaymentAction(
  invoiceId: string,
  formData: FormData,
  slip: { path: string; type: string; size: number }
): Promise<ActionResult> {
  const session = await requireClient();
  const clientId = session.profile.client_id;
  if (!clientId || !isUuid(invoiceId)) return { ok: false, error: "Invoice not found." };

  const parsed = paymentSchema.safeParse(formFields(formData, ["amount", "paid_on", "reference"] as const));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  // The slip must be in this client's folder for this invoice
  if (!slip.path.startsWith(`${clientId}/${invoiceId}/`) || slip.path.includes("..")) {
    return { ok: false, error: "The slip upload didn't work. Please try again." };
  }
  if (!SLIP_TYPES.includes(slip.type) || slip.size > MAX_SLIP_BYTES) {
    return { ok: false, error: "Upload the slip as a JPG, PNG or PDF up to 5 MB." };
  }

  // Row-level security only returns this client's own sent invoices
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("number, status, total, amount_paid, currency")
    .eq("id", invoiceId)
    .maybeSingle<Pick<Invoice, "number" | "status" | "total" | "amount_paid" | "currency">>();
  if (!invoice || (invoice.status !== "sent" && invoice.status !== "partially_paid")) {
    return { ok: false, error: "This invoice isn't waiting for payment." };
  }
  if (parsed.data.amount > invoiceBalance(invoice.total, invoice.amount_paid)) {
    return { ok: false, error: "The amount is more than what's still owed on this invoice." };
  }

  const { data, error } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      client_id: clientId,
      ...parsed.data,
      method: "bank_transfer",
      slip_path: slip.path,
      status: "pending",
      submitted_by: session.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not send your payment details. Please try again." };

  await logActivity(session.userId, "payment", data.id, "payment.submitted", { invoice_id: invoiceId, number: invoice.number, amount: parsed.data.amount });
  const paid = formatMoney(parsed.data.amount, invoice.currency);
  notify({
    to: { admins: true },
    actorId: session.userId,
    type: "payment_submitted",
    title: `Payment slip for ${invoice.number}`,
    body: `${paid} from ${session.profile.full_name || "a client"}`,
    link: "/admin/payments",
    email: {
      eyebrow: "Payment slip",
      subject: `Payment slip uploaded: ${invoice.number} (${paid})`,
      paragraphs: [
        `${session.profile.full_name || "A client"} uploaded a bank slip for ${paid} against invoice ${invoice.number}, paid on ${formatPortalDate(parsed.data.paid_on)}.`,
        "Check it against your bank account, then approve or reject it.",
      ],
      buttonLabel: "Review the payment",
      reason: "You're receiving this because you're a SYNCODE portal admin.",
    },
  });
  refresh(invoiceId, clientId);
  return { ok: true, message: "Thanks! Your payment slip was sent. We'll confirm it shortly." };
}
