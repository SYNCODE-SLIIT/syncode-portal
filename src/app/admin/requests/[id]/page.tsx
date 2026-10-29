import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CommentThread } from "@/components/requests/comment-thread";
import { RequestSummary } from "@/components/requests/request-summary";
import { PageHeader } from "@/components/ui/form-fields";
import { requireStaff } from "@/lib/auth";
import { getRequestAttachments, getRequestComments } from "@/lib/data/requests";
import { getUserAccounts } from "@/lib/data/users";
import { createClient } from "@/lib/supabase/server";
import type { FeatureRequest } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";
import { RequestControls } from "./request-controls";

export const metadata: Metadata = {
  title: "Request",
};

type RequestRow = FeatureRequest & {
  projects: { id: string; name: string } | null;
  clients: { id: string; name: string } | null;
  profiles: { full_name: string } | null;
};

async function StaffRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("feature_requests")
    .select("*, projects(id, name), clients(id, name), profiles(full_name)")
    .eq("id", id)
    .maybeSingle<RequestRow>();
  if (!request) notFound();

  const [attachments, comments, accounts] = await Promise.all([
    getRequestAttachments(supabase, id),
    getRequestComments(supabase, id),
    getUserAccounts(request.submitted_by ? [request.submitted_by] : []),
  ]);
  const submitterEmail = request.submitted_by ? accounts.get(request.submitted_by)?.email : undefined;

  return (
    <div className="space-y-6">
      <Link href="/admin/requests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Requests
      </Link>

      <PageHeader
        eyebrow="Request"
        title={request.title}
        description={
          <>
            {request.clients ? (
              <Link href={`/admin/clients/${request.clients.id}`} className="hover:underline">
                {request.clients.name}
              </Link>
            ) : (
              "Client"
            )}{" "}
            ·{" "}
            {request.projects ? (
              <Link href={`/admin/projects/${request.projects.id}`} className="hover:underline">
                {request.projects.name}
              </Link>
            ) : (
              "Project"
            )}
            {request.profiles?.full_name ? ` · from ${request.profiles.full_name}` : ""}
            {submitterEmail ? ` (${submitterEmail})` : ""}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <RequestSummary request={request} attachments={attachments} />
          <CommentThread requestId={request.id} comments={comments} viewerIsStaff closed={false} />
        </div>
        <div>
          <RequestControls request={request} />
        </div>
      </div>
    </div>
  );
}

export default function StaffRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
      <StaffRequestDetail params={params} />
    </Suspense>
  );
}
