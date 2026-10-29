import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquarePlus, Plus } from "lucide-react";
import { PageHeader, StatusBadge, primaryButtonClass } from "@/components/ui/form-fields";
import { requireClient } from "@/lib/auth";
import { formatPortalDate } from "@/lib/domain";
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { FeatureRequest } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Requests",
};

async function RequestsContent() {
  await requireClient();
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_requests")
    .select("*, projects(name)")
    .order("updated_at", { ascending: false })
    .returns<(FeatureRequest & { projects: { name: string } | null })[]>();
  const requests = data ?? [];
  const waiting = requests.filter((r) => r.status === "quoted");

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <MessageSquarePlus className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">No requests yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Need a change or a new feature? Send a request and Team SYNCODE will review it and reply with a quote if needed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {waiting.length > 0 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {waiting.length === 1 ? "1 quote is" : `${waiting.length} quotes are`} waiting for your approval.
        </p>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {requests.map((r) => (
          <li key={r.id}>
            <Link href={`/requests/${r.id}`} className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.projects?.name ?? "Project"} · Updated {formatPortalDate(r.updated_at)}
                </p>
              </div>
              <StatusBadge className={`self-start sm:self-auto ${REQUEST_STATUS_STYLES[r.status]}`}>
                {REQUEST_STATUS_LABELS[r.status]}
              </StatusBadge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RequestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client portal"
        title="Requests"
        description="Changes and new features you've asked for, with quotes and replies."
        actions={
          <Link href="/requests/new" className={primaryButtonClass}>
            <Plus className="size-4" />
            New request
          </Link>
        }
      />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />}>
        <RequestsContent />
      </Suspense>
    </div>
  );
}
