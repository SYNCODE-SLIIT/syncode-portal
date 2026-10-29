"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireClient, requireStaff } from "@/lib/auth";
import { REQUEST_STATUS_LABELS } from "@/lib/labels";
import { notify } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain";
import type { RequestStatus } from "@/lib/types/database";
import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import {
  commentSchema,
  declineReasonSchema,
  featureRequestSchema,
  firstError,
  formFields,
  isUuid,
  quoteSchema,
} from "@/lib/validation";
import type { ActionResult } from "./auth";

export interface CreateRequestResult extends ActionResult {
  requestId?: string;
  clientId?: string;
}

/** Activity is written with the service role because clients can't write the log themselves. */
async function logActivity(actorId: string, entityId: string, action: string, details: Record<string, unknown>) {
  try {
    await createAdminClient().from("activity_log").insert({
      actor_id: actorId,
      entity_type: "feature_request",
      entity_id: entityId,
      action,
      details,
    });
  } catch {
    // Logging must never block the user's action
  }
}

function refresh(requestId: string, projectId?: string | null) {
  revalidatePath("/requests");
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
  if (projectId) {
    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}`);
  }
}

/** Client action: submits a new feature request on one of their projects. */
export async function createRequestAction(formData: FormData): Promise<CreateRequestResult> {
  const session = await requireClient();
  const clientId = session.profile.client_id;
  if (!clientId) return { ok: false, error: "Your account isn't linked to a business yet. Please contact Team SYNCODE." };

  const parsed = featureRequestSchema.safeParse(formFields(formData, ["project_id", "title", "description", "priority"] as const));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  // Row-level security only accepts projects that belong to this client
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_requests")
    .insert({ ...parsed.data, client_id: clientId, submitted_by: session.userId, status: "submitted" })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not submit the request. Please try again." };

  await logActivity(session.userId, data.id, "request.submitted", { title: parsed.data.title, project_id: parsed.data.project_id });
  notify({
    to: { admins: true, projectStaffOf: parsed.data.project_id },
    actorId: session.userId,
    type: "request_submitted",
    title: `New request: ${parsed.data.title}`,
    body: `From ${session.profile.full_name || "a client"}`,
    link: `/admin/requests/${data.id}`,
    email: {
      eyebrow: "New request",
      subject: `New request: ${parsed.data.title}`,
      paragraphs: [
        `${session.profile.full_name || "A client"} submitted a new request${parsed.data.priority === "high" ? " (high priority)" : ""}:`,
        parsed.data.title,
        parsed.data.description,
      ],
      buttonLabel: "Review the request",
      reason: "You're receiving this because you're on the SYNCODE team for this project.",
    },
  });
  refresh(data.id, parsed.data.project_id);
  return { ok: true, requestId: data.id, clientId, message: "Request submitted." };
}

/** Records a file the client already uploaded to storage for their request. */
export async function recordRequestAttachmentAction(
  requestId: string,
  file: { path: string; name: string; type: string; size: number }
): Promise<ActionResult> {
  const session = await requireClient();
  const clientId = session.profile.client_id;
  if (!clientId || !isUuid(requestId)) return { ok: false, error: "Request not found." };

  const expectedPrefix = `${clientId}/requests/${requestId}/`;
  if (!file.path.startsWith(expectedPrefix) || file.path.includes("..")) return { ok: false, error: "Invalid file location." };
  if (!ATTACHMENT_TYPES.includes(file.type)) return { ok: false, error: "Only JPG, PNG, WebP and PDF files can be attached." };
  if (!(file.size > 0 && file.size <= MAX_ATTACHMENT_BYTES)) return { ok: false, error: "Files can be up to 10 MB." };

  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert({
    owner_type: "request",
    owner_id: requestId,
    client_id: clientId,
    storage_path: file.path,
    file_name: file.name.slice(0, 200),
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: session.userId,
  });
  if (error) return { ok: false, error: "The file uploaded, but couldn't be attached to the request." };

  refresh(requestId);
  return { ok: true };
}

/** Client or staff action: adds a comment. Only staff can post internal comments. */
export async function addRequestCommentAction(requestId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireAuth();
  if (!isUuid(requestId)) return { ok: false, error: "Request not found." };
  const parsed = commentSchema.safeParse(formFields(formData, ["body"] as const));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const isStaff = session.profile.role !== "client";
  const isInternal = isStaff && formData.get("internal") === "on";

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("feature_requests")
    .select("project_id, title, submitted_by")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { ok: false, error: "Request not found." };

  const { error } = await supabase
    .from("request_comments")
    .insert({ request_id: requestId, author_id: session.userId, body: parsed.data.body, is_internal: isInternal });
  if (error) return { ok: false, error: "Could not post the comment. Please try again." };

  const author = session.profile.full_name || (isStaff ? "Team SYNCODE" : "The client");
  const commentEmail = {
    eyebrow: "New comment",
    subject: `New comment on "${request.title}"`,
    paragraphs: [`${author} wrote:`, parsed.data.body],
    buttonLabel: "Reply in the portal",
  };
  // Staff hear about every comment; the client only about comments they can see
  notify({
    to: { admins: true, projectStaffOf: request.project_id as string },
    actorId: session.userId,
    type: "request_comment",
    title: `${isInternal ? "Internal comment" : "New comment"} on "${request.title}"`,
    body: `${author}: ${parsed.data.body.slice(0, 160)}`,
    link: `/admin/requests/${requestId}`,
    email: { ...commentEmail, reason: "You're receiving this because you're on the SYNCODE team for this project." },
  });
  if (isStaff && !isInternal) {
    notify({
      to: { profileIds: [request.submitted_by as string | null] },
      actorId: session.userId,
      type: "request_comment",
      title: `New comment on "${request.title}"`,
      body: `${author}: ${parsed.data.body.slice(0, 160)}`,
      link: `/requests/${requestId}`,
      email: { ...commentEmail, reason: "You're receiving this because you submitted this request." },
    });
  }

  refresh(requestId, request.project_id as string);
  return { ok: true, message: isInternal ? "Internal comment posted." : "Comment posted." };
}

/** Staff action: moves a request to a new status (quotes use sendQuoteAction). */
export async function setRequestStatusAction(
  requestId: string,
  status: RequestStatus,
  declineReason?: string
): Promise<ActionResult> {
  const session = await requireStaff();
  if (!isUuid(requestId)) return { ok: false, error: "Request not found." };
  const allowed: RequestStatus[] = ["submitted", "under_review", "approved", "in_progress", "delivered", "declined"];
  if (!allowed.includes(status)) return { ok: false, error: "Use the quote form to send a quote." };

  const reason = declineReasonSchema.safeParse(declineReason ?? "");
  if (!reason.success) return { ok: false, error: firstError(reason.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_requests")
    .update({ status, decline_reason: status === "declined" ? reason.data : null })
    .eq("id", requestId)
    .select("project_id, title, submitted_by")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not update the request." };

  await logActivity(session.userId, requestId, `request.${status}`, { status });
  if (status !== "submitted") {
    notify({
      to: { profileIds: [data.submitted_by as string | null] },
      actorId: session.userId,
      type: "request_status",
      title: `"${data.title}" is now ${REQUEST_STATUS_LABELS[status].toLowerCase()}`,
      body: status === "declined" && reason.data ? reason.data : undefined,
      link: `/requests/${requestId}`,
      email: {
        eyebrow: "Request update",
        subject: `Your request "${data.title}": ${REQUEST_STATUS_LABELS[status]}`,
        paragraphs: [
          `Your request "${data.title}" is now ${REQUEST_STATUS_LABELS[status].toLowerCase()}.`,
          ...(status === "declined" && reason.data ? [`Reason: ${reason.data}`] : []),
        ],
        buttonLabel: "View the request",
        reason: "You're receiving this because you submitted this request.",
      },
    });
  }
  refresh(requestId, data.project_id as string);
  return { ok: true, message: "Status updated." };
}

/** Staff action: sends a quote (hours and/or price) for the client to approve. */
export async function sendQuoteAction(requestId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireStaff();
  if (!isUuid(requestId)) return { ok: false, error: "Request not found." };
  const parsed = quoteSchema.safeParse(formFields(formData, ["estimate_hours", "quote_amount", "quote_currency"] as const));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_requests")
    .update({
      status: "quoted",
      estimate_hours: parsed.data.estimate_hours,
      quote_amount: parsed.data.quote_amount,
      quote_currency: parsed.data.quote_amount !== null ? parsed.data.quote_currency : null,
      decline_reason: null,
      client_decision_at: null,
    })
    .eq("id", requestId)
    .in("status", ["submitted", "under_review", "quoted", "declined"])
    .select("project_id, title, submitted_by")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not send the quote. Requests that are already approved can't be re-quoted." };

  await logActivity(session.userId, requestId, "request.quoted", parsed.data);
  const quoteParts = [
    parsed.data.quote_amount !== null ? formatMoney(parsed.data.quote_amount, parsed.data.quote_currency) : null,
    parsed.data.estimate_hours !== null ? `about ${parsed.data.estimate_hours} hours` : null,
  ].filter(Boolean);
  notify({
    to: { profileIds: [data.submitted_by as string | null] },
    actorId: session.userId,
    type: "request_quoted",
    title: `Quote ready for "${data.title}"`,
    body: quoteParts.join(" · "),
    link: `/requests/${requestId}`,
    email: {
      eyebrow: "Quote ready",
      subject: `Quote for "${data.title}"`,
      paragraphs: [`We've prepared a quote for your request "${data.title}": ${quoteParts.join(", ")}.`, "Please approve or decline it in the portal."],
      buttonLabel: "Review the quote",
      reason: "You're receiving this because you submitted this request.",
    },
  });
  refresh(requestId, data.project_id as string);
  return { ok: true, message: "Quote sent to the client." };
}

/** Client action: approves or declines a quote. */
export async function respondToQuoteAction(
  requestId: string,
  decision: "approved" | "declined",
  reason?: string
): Promise<ActionResult> {
  const session = await requireClient();
  if (!isUuid(requestId) || (decision !== "approved" && decision !== "declined")) return { ok: false, error: "Request not found." };

  const parsedReason = declineReasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { ok: false, error: firstError(parsedReason.error) };

  // A database trigger only lets clients move a quoted request to approved or declined
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_requests")
    .update({ status: decision, decline_reason: decision === "declined" ? parsedReason.data : null })
    .eq("id", requestId)
    .eq("status", "quoted")
    .select("project_id, title")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "This quote can no longer be changed. Refresh the page to see its current status." };

  await logActivity(session.userId, requestId, decision === "approved" ? "request.quote_approved" : "request.quote_declined", {});
  notify({
    to: { admins: true, projectStaffOf: data.project_id as string },
    actorId: session.userId,
    type: "request_decision",
    title: `Quote ${decision} for "${data.title}"`,
    body: decision === "declined" && parsedReason.data ? parsedReason.data : undefined,
    link: `/admin/requests/${requestId}`,
    email: {
      eyebrow: decision === "approved" ? "Quote approved" : "Quote declined",
      subject: `Quote ${decision}: "${data.title}"`,
      paragraphs: [
        `${session.profile.full_name || "The client"} ${decision} the quote for "${data.title}".`,
        ...(decision === "declined" && parsedReason.data ? [`Reason: ${parsedReason.data}`] : []),
      ],
      buttonLabel: "Open the request",
      reason: "You're receiving this because you're on the SYNCODE team for this project.",
    },
  });
  refresh(requestId, data.project_id as string);
  return { ok: true, message: decision === "approved" ? "Quote approved. The team will start on it." : "Quote declined." };
}
