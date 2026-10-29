import type {
  ClientStatus,
  DisplayInvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  ProjectStatus,
  ProjectType,
  RequestPriority,
  RequestStatus,
} from "./types/database.ts";

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

export const INVOICE_STATUS_LABELS: Record<DisplayInvoiceStatus, string> = {
  draft: "Draft",
  sent: "Unpaid",
  partially_paid: "Partly paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

export const INVOICE_STATUS_STYLES: Record<DisplayInvoiceStatus, string> = {
  draft: "border-border bg-transparent text-muted-foreground",
  sent: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  partially_paid: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  overdue: "border-destructive/30 bg-destructive/10 text-destructive",
  void: "border-border bg-transparent text-muted-foreground line-through",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Rejected",
};

export const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};
