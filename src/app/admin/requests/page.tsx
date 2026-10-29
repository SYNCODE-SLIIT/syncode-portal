import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/ui/form-fields";
import { requireStaff } from "@/lib/auth";
import { formatPortalDate } from "@/lib/domain";
import { OPEN_REQUEST_STATUSES, REQUEST_PRIORITY_LABELS, REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { FeatureRequest, RequestStatus } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Requests",
};

const FILTERS = {
  needs_action: { label: "Needs action", statuses: ["submitted", "under_review", "approved"] },
  open: { label: "All open", statuses: OPEN_REQUEST_STATUSES },
  quoted: { label: "Waiting for client", statuses: ["quoted"] },
  closed: { label: "Closed", statuses: ["delivered", "declined"] },
  all: { label: "All", statuses: null },
} satisfies Record<string, { label: string; statuses: RequestStatus[] | null }>;

type FilterKey = keyof typeof FILTERS;

type Row = FeatureRequest & { projects: { name: string } | null; clients: { name: string } | null };

async function RequestsInbox({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff();
  const { status } = await searchParams;
  const filter: FilterKey = status && status in FILTERS ? (status as FilterKey) : "needs_action";

  const supabase = await createClient();
  let query = supabase
    .from("feature_requests")
    .select("*, projects(name), clients(name)")
    .order("updated_at", { ascending: false })
    .limit(200);
  const statuses = FILTERS[filter].statuses;
  if (statuses) query = query.in("status", statuses);
  const { data } = await query.returns<Row[]>();
  const requests = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 rounded-full border border-border p-1 text-xs sm:w-fit">
        {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
          <Link
            key={key}
            href={{ pathname: "/admin/requests", query: { status: key } }}
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
              filter === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {FILTERS[key].label}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <MessageSquarePlus className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing here.</p>
          <p className="mt-1 text-sm text-muted-foreground">Requests that clients submit from their portal appear here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {requests.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/requests/${r.id}`}
                className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.priority === "high" && <span className="mr-2 text-xs font-semibold text-amber-300">HIGH</span>}
                    {r.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.clients?.name ?? "Client"} · {r.projects?.name ?? "Project"} · Updated {formatPortalDate(r.updated_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {r.priority === "low" && <span className="text-xs text-muted-foreground">{REQUEST_PRIORITY_LABELS.low}</span>}
                  <StatusBadge className={REQUEST_STATUS_STYLES[r.status]}>{REQUEST_STATUS_LABELS[r.status]}</StatusBadge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Workspace" title="Requests" description="Feature and change requests from clients." />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />}>
        <RequestsInbox searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
