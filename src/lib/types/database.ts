export type UserRole = "admin" | "team" | "client";
export type ClientStatus = "active" | "inactive";
export type ProjectType =
  | "website"
  | "web_app"
  | "mobile_app"
  | "ecommerce"
  | "ai_system"
  | "design"
  | "hosting_maintenance"
  | "other";
export type ProjectStatus =
  | "planning"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";
export type ProgressMode = "auto" | "manual";
export type MilestoneStatus = "not_started" | "in_progress" | "done";
export type UpdateVisibility = "client" | "internal";
export type RequestPriority = "low" | "normal" | "high";
export type RequestStatus =
  | "submitted"
  | "under_review"
  | "quoted"
  | "approved"
  | "in_progress"
  | "delivered"
  | "declined";
export type CurrencyCode = "LKR" | "USD";
export type AttachmentOwnerType = "update" | "request" | "comment";
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "void";
export type DisplayInvoiceStatus = InvoiceStatus | "overdue";
export type PaymentMethod = "bank_transfer" | "cash" | "other";
export type PaymentStatus = "pending" | "approved" | "rejected";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  client_id: string | null;
  is_active: boolean;
  email_notifications: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  business_type: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: ClientStatus;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string | null;
  live_url: string | null;
  staging_url: string | null;
  repo_url: string | null;
  start_date: string | null;
  target_date: string | null;
  progress_mode: ProgressMode;
  manual_progress: number;
  created_by: string | null;
  created_at: string;
}

export interface ProjectMember {
  project_id: string;
  profile_id: string;
  created_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  position: number;
  weight: number;
  status: MilestoneStatus;
  percent: number;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  author_id: string | null;
  body: string;
  visibility: UpdateVisibility;
  created_at: string;
}

export interface FeatureRequest {
  id: string;
  project_id: string;
  client_id: string;
  submitted_by: string | null;
  title: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  estimate_hours: number | null;
  quote_amount: number | null;
  quote_currency: CurrencyCode | null;
  decline_reason: string | null;
  client_decision_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestComment {
  id: string;
  request_id: string;
  author_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface Attachment {
  id: string;
  owner_type: AttachmentOwnerType;
  owner_id: string;
  client_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  client_id: string;
  project_id: string | null;
  currency: CurrencyCode;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  sent_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  client_id: string;
  amount: number;
  method: PaymentMethod;
  paid_on: string;
  reference: string | null;
  slip_path: string | null;
  status: PaymentStatus;
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface PortalSettings {
  id: string;
  singleton_key: boolean;
  business_name: string;
  business_address: string;
  business_phone: string | null;
  business_email: string;
  logo_path: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_swift_code: string | null;
  invoice_prefix: string;
  next_invoice_seq: number;
  payment_terms_days: number;
  created_at: string;
  updated_at: string;
}
