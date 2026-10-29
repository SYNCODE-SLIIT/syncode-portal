import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Active clients for pickers, plus one extra client (e.g. a project's current, now inactive client). */
export async function getClientOptions(supabase: SupabaseServerClient, includeId?: string) {
  const { data } = await supabase.from("clients").select("id, name, status").order("name", { ascending: true });
  return (data ?? [])
    .filter((c) => c.status === "active" || c.id === includeId)
    .map((c) => ({ id: c.id as string, name: c.name as string }));
}

/** Active SYNCODE staff (admin and team) for project assignment. */
export async function getStaffOptions(supabase: SupabaseServerClient) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["admin", "team"])
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id as string,
    name: (p.full_name as string) || "Name not set",
    role: p.role as string,
  }));
}
