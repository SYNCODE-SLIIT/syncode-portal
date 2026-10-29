"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getHomePathForRole, requireAdmin, requireAuth, requireStaff } from "@/lib/auth";
import { setFlash } from "@/lib/flash";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types/database";

export interface ActionResult {
  ok: boolean;
  message?: string;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getOriginUrl(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Sends a magic login link to the user's email address.
 */
export async function sendMagicLinkAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const origin = await getOriginUrl();
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      // The email template appends `&token_hash=…&type=email` (see docs/SETUP.md),
      // so this URL must already contain a query string.
      emailRedirectTo: `${origin}/auth/callback?flow=login`,
    },
  });

  if (error) {
    if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return {
        ok: false,
        error: "Too many login emails were requested. Please wait a few minutes and try again, or sign in with your password.",
      };
    }
    // Do not leak raw database/auth errors to clients (Master Plan Rule 5)
    return {
      ok: false,
      error:
        "We couldn't send a login link to that address. Make sure you are using the email address invited by Team SYNCODE.",
    };
  }

  return {
    ok: true,
    message: "Check your inbox — we sent you a sign-in link.",
  };
}

/**
 * Signs in with email and password, then redirects to the user's role home page.
 */
export async function signInWithPasswordAction(
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: "Please enter your password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return {
      ok: false,
      error: "Incorrect email or password.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single<Profile>();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: "Your account has been deactivated. Please contact Team SYNCODE.",
    };
  }

  if (!profile.full_name || profile.full_name.trim().length === 0) {
    redirect("/welcome");
  }

  redirect(getHomePathForRole(profile.role));
}

/**
 * Signs the current user out and redirects to `/login`.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Completes first-time onboarding (`/welcome`): saves the user's full name, phone, and optional password.
 */
export async function completeWelcomeAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAuth({ allowIncompleteProfile: true });
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");

  if (fullName.length < 2 || fullName.length > 120) {
    return {
      ok: false,
      error: "Please enter your full name (at least 2 characters).",
    };
  }

  if (password && password.length < 8) {
    return {
      ok: false,
      error: "Password must be at least 8 characters long.",
    };
  }

  const supabase = await createClient();

  if (password) {
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      return {
        ok: false,
        error: "Could not set your password. Please try a stronger password.",
      };
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
    })
    .eq("id", session.userId);

  if (profileError) {
    return {
      ok: false,
      error: "Could not save your profile details. Please try again.",
    };
  }

  await setFlash("You're all set. Welcome to the SYNCODE portal!");
  redirect(getHomePathForRole(session.profile.role));
}

/**
 * Updates account preferences (`/account`): name, phone, email notifications, and optional new password.
 */
export async function updateAccountAction(
  formData: FormData
): Promise<ActionResult> {
  const session = await requireAuth();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const emailNotifications = formData.get("email_notifications") === "on";
  const newPassword = String(formData.get("new_password") ?? "");

  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "Please enter your full name." };
  }

  if (newPassword && newPassword.length < 8) {
    return {
      ok: false,
      error: "New password must be at least 8 characters long.",
    };
  }

  const supabase = await createClient();

  if (newPassword) {
    const { error: pwError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (pwError) {
      return {
        ok: false,
        error: "Could not update your password. Please try again.",
      };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      email_notifications: emailNotifications,
    })
    .eq("id", session.userId);

  if (error) {
    return {
      ok: false,
      error: "Could not save your account changes.",
    };
  }

  revalidatePath("/account");
  return { ok: true, message: "Your account settings have been saved." };
}

/**
 * Admin action: Invites a staff member (`admin` or `team`) or a `client` contact via Supabase Auth Admin API.
 */
export async function inviteUserAction(
  formData: FormData
): Promise<ActionResult> {
  // Admins invite anyone; team members may invite client contacts only (Master Plan 4.1)
  const adminSession = await requireStaff();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "team") as UserRole;
  const clientIdInput = String(formData.get("client_id") ?? "").trim() || null;

  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  if (!["admin", "team", "client"].includes(roleInput)) {
    return { ok: false, error: "Invalid user role selected." };
  }

  if (roleInput !== "client" && adminSession.profile.role !== "admin") {
    return { ok: false, error: "Only admins can invite SYNCODE team members." };
  }

  if (fullName.length < 2 || fullName.length > 120) {
    return { ok: false, error: "Please enter the person's full name." };
  }

  if (roleInput === "client" && !clientIdInput) {
    return {
      ok: false,
      error: "A client contact must be linked to a client business.",
    };
  }

  try {
    const adminClient = createAdminClient();
    const origin = await getOriginUrl();

    // Only the display name goes in user metadata. Role and client are set on the
    // profile below with the service role; the database never trusts user metadata for them.
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: fullName },
        redirectTo: `${origin}/auth/callback?next=/welcome`,
      }
    );

    if (error || !data.user) {
      return {
        ok: false,
        error:
          error?.message ||
          "Could not send the invitation. Check if this email is already registered.",
      };
    }

    // Set the role and client on the profile (the sign-up trigger creates it as a client with no business)
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      role: roleInput,
      client_id: roleInput === "client" ? clientIdInput : null,
      is_active: true,
    });

    if (profileError) {
      // Roll back so the person can't sign in with the wrong role, and the invite can be retried
      await adminClient.auth.admin.deleteUser(data.user.id);
      return {
        ok: false,
        error: "Could not save the new user's role, so the invitation was cancelled. Please try again.",
      };
    }

    // Record in activity_log
    await adminClient.from("activity_log").insert({
      actor_id: adminSession.userId,
      entity_type: "profile",
      entity_id: data.user.id,
      action: "user.invited",
      details: { email, role: roleInput, full_name: fullName },
    });

    revalidatePath("/admin/team");
    revalidatePath("/admin/clients");
    return {
      ok: true,
      message: `Invitation sent to ${email}.`,
    };
  } catch {
    return {
      ok: false,
      error:
        "Server configuration error: make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local.",
    };
  }
}

/**
 * Admin action: Activates or deactivates a user profile (`is_active`).
 * Deactivated users cannot sign in, while their history stays intact (Master Plan 4.1).
 */
export async function toggleUserActiveAction(
  targetProfileId: string,
  makeActive: boolean
): Promise<ActionResult> {
  const adminSession = await requireAdmin();

  if (targetProfileId === adminSession.userId && !makeActive) {
    return {
      ok: false,
      error: "You cannot deactivate your own admin account.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: makeActive })
    .eq("id", targetProfileId);

  if (error) {
    return {
      ok: false,
      error: "Could not update user status.",
    };
  }

  await supabase.from("activity_log").insert({
    actor_id: adminSession.userId,
    entity_type: "profile",
    entity_id: targetProfileId,
    action: makeActive ? "user.activated" : "user.deactivated",
    details: { is_active: makeActive },
  });

  revalidatePath("/admin/team");
  return {
    ok: true,
    message: makeActive ? "User reactivated." : "User deactivated.",
  };
}
