import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/lib/types/database";

export interface AuthSession {
  userId: string;
  email: string;
  profile: Profile;
}

export function getHomePathForRole(role: UserRole): string {
  return role === "client" ? "/dashboard" : "/admin";
}

/**
 * Reads the currently signed-in user and their `profiles` row.
 * Returns null if not signed in or if the user has been deactivated.
 */
export async function getOptionalAuth(): Promise<AuthSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile || !profile.is_active) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
  };
}

/**
 * Requires an active authenticated user, redirecting to `/login` otherwise.
 * If the user has not set their full name yet, redirects to `/welcome` unless `allowIncompleteProfile` is set.
 */
export async function requireAuth(options?: {
  allowIncompleteProfile?: boolean;
}): Promise<AuthSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    redirect("/login?error=profile_missing");
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=deactivated");
  }

  if (
    !options?.allowIncompleteProfile &&
    (!profile.full_name || profile.full_name.trim().length === 0)
  ) {
    redirect("/welcome");
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
  };
}

/**
 * Requires a staff user (`admin` or `team`), redirecting clients to `/dashboard`.
 */
export async function requireStaff(): Promise<AuthSession> {
  const session = await requireAuth();
  if (session.profile.role !== "admin" && session.profile.role !== "team") {
    redirect("/dashboard");
  }
  return session;
}

/**
 * Requires an `admin` user, redirecting team members to `/admin` and clients to `/dashboard`.
 */
export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireAuth();
  if (session.profile.role !== "admin") {
    redirect(getHomePathForRole(session.profile.role));
  }
  return session;
}

/**
 * Requires a `client` user, redirecting staff to `/admin`.
 */
export async function requireClient(): Promise<AuthSession> {
  const session = await requireAuth();
  if (session.profile.role !== "client") {
    redirect("/admin");
  }
  return session;
}
