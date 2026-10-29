import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { getUserAccounts } from "@/lib/data/users";
import { renderEmail, renderEmailText } from "@/lib/email/layout";
import { createAdminClient } from "@/lib/supabase/admin";

/** Who should hear about an event. Every option is combined; inactive users are always skipped. */
export interface Audience {
  profileIds?: (string | null | undefined)[];
  /** Every client contact of this client business */
  clientContactsOf?: string | null;
  /** Every admin */
  admins?: boolean;
  /** Staff assigned to this project */
  projectStaffOf?: string | null;
}

export interface NotifyInput {
  to: Audience;
  /** The person who caused the event; they're never notified about their own action. */
  actorId?: string;
  type: string;
  title: string;
  body?: string;
  /** Path inside the portal, e.g. `/invoices/<id>` */
  link: string;
  email: {
    eyebrow: string;
    subject: string;
    paragraphs: string[];
    buttonLabel: string;
    reason: string;
  };
}

const DEFAULT_FROM = "Team SYNCODE <portal@teamsyncode.com>";

/**
 * Records an in-app notification for each recipient and emails those who want emails.
 * Runs after the response is sent, so it never slows down or breaks the user's action.
 */
export function notify(input: NotifyInput) {
  after(async () => {
    try {
      await deliver(input);
    } catch (error) {
      console.error("[notify] failed", input.type, error);
    }
  });
}

async function deliver(input: NotifyInput) {
  const admin = createAdminClient();
  const ids = await resolveAudience(admin, input.to);
  ids.delete(input.actorId ?? "");
  if (ids.size === 0) return;

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, is_active, email_notifications")
    .in("id", [...ids])
    .eq("is_active", true);
  const recipients = profiles ?? [];
  if (recipients.length === 0) return;

  await admin.from("notifications").insert(
    recipients.map((r) => ({
      recipient_id: r.id,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link,
    }))
  );

  const apiKey = process.env.RESEND_API_KEY;
  const wantsEmail = recipients.filter((r) => r.email_notifications);
  if (!apiKey || wantsEmail.length === 0) return;

  const origin = await portalOrigin();
  const accounts = await getUserAccounts(wantsEmail.map((r) => r.id as string));
  const messages = wantsEmail
    .map((r) => {
      const to = accounts.get(r.id as string)?.email;
      if (!to) return null;
      const content = {
        ...input.email,
        heading: input.title,
        greetingName: r.full_name as string,
        buttonUrl: `${origin}${input.link}`,
      };
      return {
        from: process.env.NOTIFY_FROM_EMAIL || DEFAULT_FROM,
        reply_to: "team.syncode@gmail.com",
        to: [to],
        subject: input.email.subject,
        html: renderEmail(content),
        text: renderEmailText(content),
      };
    })
    .filter((m) => m !== null);
  if (messages.length === 0) return;

  // One request for up to 100 emails
  const response = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!response.ok) {
    console.error("[notify] email failed", input.type, response.status, await response.text());
  }
}

async function resolveAudience(admin: ReturnType<typeof createAdminClient>, to: Audience): Promise<Set<string>> {
  const ids = new Set<string>((to.profileIds ?? []).filter((id): id is string => Boolean(id)));

  const [contacts, admins, members] = await Promise.all([
    to.clientContactsOf
      ? admin.from("profiles").select("id").eq("role", "client").eq("client_id", to.clientContactsOf)
      : Promise.resolve({ data: [] }),
    to.admins ? admin.from("profiles").select("id").eq("role", "admin") : Promise.resolve({ data: [] }),
    to.projectStaffOf
      ? admin.from("project_members").select("profile_id").eq("project_id", to.projectStaffOf)
      : Promise.resolve({ data: [] }),
  ]);
  for (const row of contacts.data ?? []) ids.add(row.id as string);
  for (const row of admins.data ?? []) ids.add(row.id as string);
  for (const row of members.data ?? []) ids.add((row as { profile_id: string }).profile_id);
  return ids;
}

/** The portal's public address for links in emails. Set PORTAL_URL once the custom domain is live. */
async function portalOrigin(): Promise<string> {
  if (process.env.PORTAL_URL) return process.env.PORTAL_URL.replace(/\/$/, "");
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "syncode-portal.vercel.app";
  const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
