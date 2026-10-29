import { FileText, Paperclip } from "lucide-react";
import { LinkifiedText } from "@/components/linkified-text";
import { StatusBadge } from "@/components/ui/form-fields";
import { formatFileSize, type AttachmentLink } from "@/lib/data/requests";
import { formatMoney, formatPortalDate } from "@/lib/domain";
import { REQUEST_PRIORITY_LABELS, REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES } from "@/lib/labels";
import type { FeatureRequest } from "@/lib/types/database";

/** Request description, attachments and quote, shared by the client and staff views. */
export function RequestSummary({ request, attachments }: { request: FeatureRequest; attachments: AttachmentLink[] }) {
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge className={REQUEST_STATUS_STYLES[request.status]}>{REQUEST_STATUS_LABELS[request.status]}</StatusBadge>
        {request.priority !== "normal" && (
          <StatusBadge className={request.priority === "high" ? "border-amber-500/30 text-amber-300" : "border-border text-muted-foreground"}>
            {REQUEST_PRIORITY_LABELS[request.priority]} priority
          </StatusBadge>
        )}
        <span className="text-xs text-muted-foreground">Submitted {formatPortalDate(request.created_at)}</span>
      </div>

      <LinkifiedText text={request.description} className="text-sm leading-relaxed" />

      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li key={a.id}>
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary/50"
                >
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{a.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(a.size)}</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="size-4" />
                  {a.name} (unavailable)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {(request.quote_amount !== null || request.estimate_hours !== null) && (
        <div className="rounded-xl border border-border bg-secondary/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quote</p>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
            {request.quote_amount !== null && (
              <p>
                <span className="block text-xs text-muted-foreground">Price</span>
                <span className="text-lg font-semibold">{formatMoney(Number(request.quote_amount), request.quote_currency ?? "LKR")}</span>
              </p>
            )}
            {request.estimate_hours !== null && (
              <p>
                <span className="block text-xs text-muted-foreground">Estimated time</span>
                <span className="text-lg font-semibold">
                  {Number(request.estimate_hours)} {Number(request.estimate_hours) === 1 ? "hour" : "hours"}
                </span>
              </p>
            )}
          </div>
          {request.client_decision_at && (request.status === "approved" || request.status === "declined") && (
            <p className="mt-2 text-xs text-muted-foreground">
              {request.status === "approved" ? "Approved" : "Declined"} by the client on {formatPortalDate(request.client_decision_at)}
            </p>
          )}
        </div>
      )}

      {request.status === "declined" && request.decline_reason && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</p>
          <p className="mt-1 whitespace-pre-line">{request.decline_reason}</p>
        </div>
      )}
    </section>
  );
}
