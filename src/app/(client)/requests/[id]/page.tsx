import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CommentThread } from "@/components/requests/comment-thread";
import { RequestSummary } from "@/components/requests/request-summary";
import { PageHeader } from "@/components/ui/form-fields";
import { requireClient } from "@/lib/auth";
import { getRequestAttachments, getRequestComments } from "@/lib/data/requests";
import { createClient } from "@/lib/supabase/server";
import type { FeatureRequest } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";
import { QuoteDecision } from "./quote-decision";

export const metadata: Metadata = {
  title: "Request",
};

async function ClientRequestDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upload?: string }>;
}) {
  await requireClient();
  const { id } = await params;
  const { upload } = await searchParams;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("feature_requests")
    .select("*, projects(id, name)")
    .eq("id", id)
    .maybeSingle<FeatureRequest & { projects: { id: string; name: string } | null }>();
  if (!request) notFound();

  const [attachments, comments] = await Promise.all([getRequestAttachments(supabase, id), getRequestComments(supabase, id)]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/requests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Requests
      </Link>

      <PageHeader
        eyebrow={request.projects?.name ?? "Request"}
        title={request.title}
      />

      {upload === "failed" && (
        <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Your request was sent, but one or more files couldn&apos;t be uploaded. You can share them in the conversation below.
        </p>
      )}

      <RequestSummary request={request} attachments={attachments} />

      {request.status === "quoted" && <QuoteDecision requestId={request.id} />}

      <CommentThread
        requestId={request.id}
        comments={comments}
        viewerIsStaff={false}
        closed={request.status === "delivered" || request.status === "declined"}
      />
    </div>
  );
}

export default function ClientRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upload?: string }>;
}) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse rounded-2xl border border-border bg-card" />}>
      <ClientRequestDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}
