import { Suspense } from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Profile } from "@/lib/types/database";
import { TeamManagementClient } from "./team-client";

export const metadata: Metadata = {
  title: "Team & Invitations",
};

async function TeamContent() {
  const session = await requireAdmin();
  const supabase = await createClient();

  const [profilesRes, clientsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<Profile[]>(),
    supabase
      .from("clients")
      .select("id, name")
      .eq("status", "active")
      .order("name", { ascending: true })
      .returns<Pick<Client, "id" | "name">[]>(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Administration
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Team & Invitations
        </h1>
      </div>

      <TeamManagementClient
        currentUserId={session.userId}
        profiles={profilesRes.data ?? []}
        clients={clientsRes.data ?? []}
      />
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card p-6" />
      }
    >
      <TeamContent />
    </Suspense>
  );
}
