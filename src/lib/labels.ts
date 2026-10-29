import type { ClientStatus, ProjectStatus, ProjectType } from "@/lib/types/database";

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
