import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface UserAccountInfo {
  email: string;
  lastSignInAt: string | null;
}

/**
 * Email and last sign-in for the given users, read from Supabase Auth with the
 * service role. Only call this from staff-only pages. Returns an empty map if the
 * service role key is not configured.
 */
export async function getUserAccounts(userIds: string[]): Promise<Map<string, UserAccountInfo>> {
  const accounts = new Map<string, UserAccountInfo>();
  if (userIds.length === 0) return accounts;

  try {
    const admin = createAdminClient();
    const results = await Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id)));
    for (const { data } of results) {
      if (data.user) {
        accounts.set(data.user.id, {
          email: data.user.email ?? "",
          lastSignInAt: data.user.last_sign_in_at ?? null,
        });
      }
    }
  } catch {
    // Missing SUPABASE_SERVICE_ROLE_KEY: show the page without emails
  }
  return accounts;
}
