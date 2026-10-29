import type { ClientStatus, ProjectStatus, ProjectType, RequestPriority, RequestStatus } from "./types/database.ts";

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  website: "Website",
  web_app: "Web app",
  mobile_app: "Mobile app",
  ecommerce: "E-commerce",
  ai_system: "AI system",
  design: "Design",
  hosting_maintenance: "Hosting & maintenance",
  other: "Other",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  in_progress: "In progress",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Status colours only where meaning matters (Master Plan section 9)
export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planning: "border-border bg-secondary text-foreground",
  in_progress: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  on_hold: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  cancelled: "border-border bg-transparent text-muted-foreground",
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

export const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABELS) as ProjectType[];
export const PROJECT_STATUSES = Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  quoted: "Quote ready",
  approved: "Approved",
  in_progress: "In progress",
  delivered: "Delivered",
  declined: "Declined",
};

export const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  submitted: "border-border bg-secondary text-foreground",
  under_review: "border-border bg-secondary text-foreground",
  quoted: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  approved: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  in_progress: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  delivered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  declined: "border-destructive/30 bg-destructive/10 text-destructive",
};

export const REQUEST_PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

export const OPEN_REQUEST_STATUSES: RequestStatus[] = ["submitted", "under_review", "quoted", "approved", "in_progress"];
