# SYNCODE Client Portal — Master Plan

**Product:** SYNCODE Client Portal
**Address:** https://portal.teamsyncode.com
**Owner:** Team SYNCODE (1166 Park Road, Pannipitiya 10230, Sri Lanka)
**Version:** 1.0 (draft for review) · 26 October 2026

This document is the single reference for building the portal. It describes what we build, in what order, and the rules the code must follow. Every build step ends with a review before the next one starts.

---

## 1. Goal

Give Team SYNCODE one place to manage clients, projects, feature requests and payments, and give each client a private, professional view of their own work.

**Success for Phase 1 means:**

- Every active client and project is in the portal instead of spreadsheets and chat threads.
- A client can log in and, without messaging us, see how their project is progressing, what was delivered recently, what they owe, and the status of every request they made.
- An invoice can go from "created" to "paid" entirely inside the portal (bank transfer slip upload, then approval).

**Not goals for Phase 1** (planned for later, see section 12): subscriptions and recurring invoices, card payments (PayHere), internal task board, time tracking, quotes as documents, a credential vault.

---

## 2. Decisions already made

| Topic | Decision |
|---|---|
| Location | Separate app at `portal.teamsyncode.com`, separate GitHub repo. The marketing website is not changed and does not link to the portal; clients reach it through their invitation email and the portal address. |
| Who it is for | Team SYNCODE only (one business). Not built as a product for other studios. |
| Payments (Phase 1) | Bank transfer: client uploads a slip, admin approves it. Cash and other methods can be recorded by admin. |
| Currency | Each invoice is in LKR or USD. No currency conversion. |
| Client login | Emailed magic link by default; clients may also set a password. |
| Internal task board | Not in Phase 1. The portal focuses on what clients see. |
| Credentials vault | Not built. Client passwords are shared through a password manager (e.g. Bitwarden), never stored in the portal. |

---

## 3. Users and roles

| Role | Who | Summary |
|---|---|---|
| **Admin** | Founder / managers | Everything, including billing, team management and settings |
| **Team** | SYNCODE staff | Clients, projects, milestones, updates and requests. No billing, no settings. |
| **Client** | A contact person at a client business | Only their own business's projects, updates, requests and invoices |

A client business can have several contacts (e.g. owner and manager). A person belongs to one client business.

### Permission matrix

| Action | Admin | Team | Client |
|---|---|---|---|
| Invite / deactivate team members | ✅ | — | — |
| Create / edit clients and contacts | ✅ | ✅ | — |
| Create / edit projects, milestones | ✅ | ✅ | — |
| Post project updates (internal or client-visible) | ✅ | ✅ | — |
| See internal updates and internal comments | ✅ | ✅ | — |
| Submit feature requests | ✅ (on behalf) | ✅ (on behalf) | ✅ own projects |
| Change request status / add quote | ✅ | ✅ | — |
| Comment on requests | ✅ | ✅ | ✅ own requests |
| Create / send / void invoices | ✅ | — | — |
| See invoices | ✅ | — | ✅ own |
| Upload payment slip | ✅ | — | ✅ own invoices |
| Approve / reject payments | ✅ | — | — |
| Business settings and bank details | ✅ | — | — |

---

## 4. Phase 1 features

### 4.1 Login and invitations
- Login page with SYNCODE branding: email magic link, or email and password.
- Admin invites team members; admin or team invite client contacts. The invite email contains a link that signs them in and asks them to set their name (and optionally a password).
- Users are sent to the right home page by role: staff to `/admin`, clients to `/dashboard`.
- Admin can deactivate a user (they can no longer sign in; their history stays).

### 4.2 Clients
- Fields: business name, type (e.g. hotel, retail, automotive), email, phone, address, notes (internal), status (active / inactive).
- Client detail page shows contacts, projects, invoices and open requests.

### 4.3 Projects
- Fields: name, client, type (website, web app, mobile app, e-commerce, AI system, design, hosting/maintenance, other), status (planning, in progress, on hold, completed, cancelled), description, live URL, staging URL, repository URL (internal only), start date, target date, assigned team members.
- Progress is calculated from milestones (weighted), or set manually if the admin chooses.

### 4.4 Milestones and progress
- Ordered list per project. Each milestone: title, description, weight (default 1), status (not started, in progress, done), percent complete, due date.
- Project progress = Σ(milestone percent × weight) / Σ(weight). "Done" counts as 100%.
- The client sees a progress bar and a milestone timeline (e.g. Design ✓ → Development 70% → Testing → Launch).

### 4.5 Project updates
- Short posts on a project ("Homepage design ready for review", with optional links or image attachments).
- Visibility: **client-visible** or **internal**. Clients never see internal updates.
- Client-visible updates appear on the client's dashboard and trigger an email.

### 4.6 Feature requests
- Clients submit a request on one of their projects: title, description, priority (low, normal, high), optional attachment.
- Status flow: `submitted → under review → quoted → approved → in progress → delivered`, or `declined` (with reason) at any point before delivery.
- When staff set status to **quoted**, they enter an estimate (hours and/or amount and currency). The client clicks **Approve** or **Decline** on the quote.
- Comment thread per request. Staff can mark a comment as internal.

### 4.7 Invoices and payments
- Admin creates an invoice for a client (optionally linked to a project): line items (description, quantity, unit price), optional discount and tax line, currency, issue date, due date, notes.
- Invoice numbers are sequential and never reused: `SYN-2026-0001`, `SYN-2026-0002`, …
- Status: `draft → sent → partially paid → paid`, plus `overdue` (sent, unpaid and past due date, calculated automatically) and `void`.
- Draft invoices are invisible to clients. "Send" makes it visible and emails the client.
- PDF download of every sent invoice, showing SYNCODE business details and bank details from Settings.
- **Paying:** the client opens the invoice, uploads a bank slip (JPG, PNG or PDF, max 5 MB), enters the amount and transfer date. The payment is **pending** until an admin approves or rejects it (rejection needs a reason, which the client sees).
- Approved payments update the amount paid and the invoice status. Admin can also record a payment directly (cash, bank transfer seen on statement).

### 4.8 Notifications
In-app notification bell plus email, for these events:

| Event | Who is notified |
|---|---|
| Invited to the portal | The invited person |
| Client-visible project update posted | Client contacts of that project |
| Milestone marked done | Client contacts of that project |
| Feature request submitted | Admins and assigned team members |
| Request status changed or quoted | The client who submitted it |
| New comment on a request | The other side (client ↔ staff); internal comments notify staff only |
| Invoice sent | Client contacts |
| Payment slip uploaded | Admins |
| Payment approved or rejected | The client who uploaded it |

### 4.9 Dashboards
- **Admin dashboard:** active projects, open feature requests, payments waiting for review, unpaid total (shown separately for LKR and USD), overdue invoices, recent activity.
- **Client dashboard:** their projects with progress bars, latest updates, open requests, unpaid invoices with a "Pay" button.

### 4.10 Settings (admin)
Business name, address, phone, email, logo, bank details (bank, branch, account name, account number, SWIFT for USD), invoice prefix, default payment terms (days).

### 4.11 Activity log
Every important change (status changes, invoice sent, payment approved, user invited or deactivated) is recorded with who did it and when. Visible to admins.

---

## 5. Screens

**Public**
- `/login` · `/auth/callback` · `/welcome` (first sign-in: name and optional password)

**Staff (`/admin`)**
- `/admin` — dashboard
- `/admin/clients`, `/admin/clients/new`, `/admin/clients/[id]`
- `/admin/projects`, `/admin/projects/new`, `/admin/projects/[id]` (tabs: overview, milestones, updates, requests, team)
- `/admin/requests` — all requests, filter by status / client / project
- `/admin/invoices`, `/admin/invoices/new`, `/admin/invoices/[id]` *(admin only)*
- `/admin/payments` — review queue *(admin only)*
- `/admin/team` *(admin only)* · `/admin/settings` *(admin only)* · `/admin/activity` *(admin only)*

**Client**
- `/dashboard`
- `/projects/[id]` — progress, milestones, updates, live and staging links
- `/requests`, `/requests/new`, `/requests/[id]`
- `/invoices`, `/invoices/[id]` — view, download PDF, upload slip
- `/account` — name, password, email notification preference

Every screen must work on a phone; many clients will open the portal from a WhatsApp or email link.

---

## 6. Data model (PostgreSQL / Supabase)

All tables have `id uuid primary key default gen_random_uuid()` and `created_at timestamptz default now()` unless noted. Money is stored as `numeric(12,2)`.

| Table | Key columns |
|---|---|
| `profiles` | `id` (= `auth.users.id`), `full_name`, `role` (`admin` \| `team` \| `client`), `phone`, `client_id` (null for staff), `is_active`, `email_notifications` (bool) |
| `clients` | `name`, `business_type`, `email`, `phone`, `address`, `notes` (internal), `status` (`active` \| `inactive`) |
| `projects` | `client_id`, `name`, `type`, `status`, `description`, `live_url`, `staging_url`, `repo_url`, `start_date`, `target_date`, `progress_mode` (`auto` \| `manual`), `manual_progress` (0–100), `created_by` |
| `project_members` | `project_id`, `profile_id` (staff assigned to a project); primary key on both |
| `milestones` | `project_id`, `title`, `description`, `position`, `weight`, `status`, `percent` (0–100), `due_date`, `completed_at` |
| `project_updates` | `project_id`, `author_id`, `body` (markdown), `visibility` (`client` \| `internal`) |
| `feature_requests` | `project_id`, `client_id`, `submitted_by`, `title`, `description`, `priority`, `status`, `estimate_hours`, `quote_amount`, `quote_currency`, `decline_reason`, `client_decision_at`, `updated_at` |
| `request_comments` | `request_id`, `author_id`, `body`, `is_internal` |
| `attachments` | `owner_type` (`update` \| `request` \| `comment`), `owner_id`, `client_id`, `storage_path`, `file_name`, `mime_type`, `size_bytes`, `uploaded_by` |
| `invoices` | `number` (unique), `client_id`, `project_id` (nullable), `currency` (`LKR` \| `USD`), `issue_date`, `due_date`, `status`, `subtotal`, `discount`, `tax`, `total`, `amount_paid`, `notes`, `sent_at`, `voided_at`, `void_reason`, `created_by` |
| `invoice_items` | `invoice_id`, `position`, `description`, `quantity`, `unit_price`, `amount` |
| `payments` | `invoice_id`, `client_id`, `amount`, `method` (`bank_transfer` \| `cash` \| `other`), `paid_on`, `reference`, `slip_path`, `status` (`pending` \| `approved` \| `rejected`), `submitted_by`, `reviewed_by`, `reviewed_at`, `reject_reason` |
| `notifications` | `recipient_id`, `type`, `title`, `body`, `link`, `read_at` |
| `activity_log` | `actor_id`, `entity_type`, `entity_id`, `action`, `details` (jsonb) |
| `settings` | single row: business details, bank details, `invoice_prefix`, `next_invoice_seq`, `payment_terms_days`, `logo_path` |

**Rules enforced in the database**
- Invoice numbers come from a database function that locks the settings row and increments `next_invoice_seq`, so two invoices can never get the same number.
- `invoices.amount_paid` and `status` are recalculated by a trigger whenever a payment is approved or reverted. Clients can never change them.
- A sent invoice's line items cannot be edited; it must be voided and re-issued.
- `overdue` is derived (status `sent` or `partially paid` and `due_date < today`), not stored, so it is always correct.

**File storage (Supabase Storage, all private)**
- `slips/{client_id}/{payment_id}/…` · `attachments/{client_id}/…` · `branding/…`
- Files are served only through short-lived signed URLs after a permission check.

---

## 7. Security and privacy

- **Row-level security (RLS) on every table.** Helper functions `is_staff()`, `is_admin()` and `current_client_id()` drive the policies:
  - Staff read all client data; only admins read or write invoices, payments, settings, activity log and team management.
  - Clients read only rows whose `client_id` is their own; project updates only where `visibility = 'client'`; comments only where `is_internal = false`; invoices only when not `draft`.
  - Clients may insert only: feature requests and comments on their own projects, payments (pending) on their own invoices, and their own file uploads.
- The Supabase **service-role key is used only on the server** (invitations, notifications, PDF generation) and never reaches the browser.
- Every server action validates input with Zod and re-checks the user's role; the UI hiding a button is never the only protection.
- Uploads: allowed types and size checked on the server; file names sanitised.
- **Personal data (Sri Lanka PDPA No. 9 of 2022):** collect only what is needed, keep the portal's privacy notice linked from the login page, allow admins to export or delete a client's data on request.
- No client credentials (hosting, admin panels, passwords) are ever stored in the portal.
- Backups: Supabase daily backups (requires the Pro plan, see section 10).

---

## 8. Technology

| Area | Choice |
|---|---|
| Framework | Next.js (latest stable, App Router), TypeScript in strict mode |
| UI | Tailwind CSS, shadcn/ui components, lucide-react icons |
| Look and feel | Matches teamsyncode.com: dark, monochrome, Inter font, rounded cards, subtle borders |
| Database, auth, files | Supabase (PostgreSQL, Auth, Storage) via `@supabase/ssr` |
| Forms and validation | React Hook Form + Zod |
| Data changes | Next.js Server Actions; reads in Server Components |
| PDF invoices | `@react-pdf/renderer`, generated on the server |
| Email | Resend + React Email, sent from `portal@teamsyncode.com` |
| Dates and money | `date-fns`; `Intl.NumberFormat` for LKR and USD |
| Database changes | Supabase CLI migrations, committed to the repo |
| Testing | Vitest for business logic (progress, totals, numbering); Playwright for key flows (invite → login, request flow, invoice → slip → approval) |
| Hosting | Vercel project on `portal.teamsyncode.com` |

**Machine note:** on the development PC, the default npm registry is blocked; install packages with `--registry=https://registry.npmmirror.com`.

---

## 9. Design guidelines

- Same brand as teamsyncode.com: near-black background, white text, muted grey secondary text, white primary buttons. Status colours only where meaning matters (green paid/done, amber pending/overdue, red rejected/declined).
- Layout: left sidebar on desktop (collapsible), bottom navigation on mobile for clients.
- Clients should never see empty, confusing screens: every empty state explains what will appear there.
- Money always shows currency: `LKR 125,000.00`, `USD 1,200.00`.
- Dates shown as `26 Oct 2026`; times in Sri Lanka time (Asia/Colombo).
- Accessible: keyboard navigation, visible focus, labels on every input, sufficient contrast.

---

## 10. Accounts and costs

| Service | Plan | Notes |
|---|---|---|
| Supabase | Free to start; **Pro (about USD 25/month) before launch** | Free projects pause after a week of inactivity and have no daily backups, which is not acceptable for client billing data |
| Vercel | Existing account | Add the `portal` subdomain to the new project |
| Resend | Free tier | Needs DNS records on `teamsyncode.com` to send from `@teamsyncode.com` |
| GitHub | New repo `syncode-portal` | Private |
| Domain | Existing `teamsyncode.com` | Only a new DNS record for `portal`; no new domain |

---

## 11. Build steps (Phase 1)

Each step ends with a demo on a preview link. We move on only after review.

| # | Step | Done when |
|---|---|---|
| 1 | **Project setup** — Next.js app, Tailwind, shadcn/ui, Supabase connection, branding, deploy to `portal.teamsyncode.com` | The live address shows a branded login page |
| 2 | **Database and security** — all tables, triggers, numbering function, RLS policies, storage buckets, seed data | Automated tests prove a client cannot read another client's data |
| 3 | **Login, roles, invitations** — magic link and password, welcome screen, role-based redirect, team management | Admin invites a test client; the client signs in and lands on an empty dashboard |
| 4 | **Clients and projects** — lists, detail pages, forms, team assignment | Staff add a client with contacts and two projects |
| 5 | **Milestones and updates** — milestone editor, progress calculation, update feed with visibility | Client sees the progress bar and only client-visible updates |
| 6 | **Client dashboard and project page** | A client can understand their project status without asking anyone |
| 7 | **Feature requests** — submit, statuses, quote, approve/decline, comments, attachments | Full request cycle works between a client and staff |
| 8 | **Invoices and payments** — editor, numbering, send, PDF, slip upload, review queue, status updates | Invoice goes draft → sent → slip uploaded → approved → paid |
| 9 | **Notifications** — in-app bell, emails for every event in 4.8, email preference | Each event produces the right notification for the right people only |
| 10 | **Pilot and launch** — import real clients, test with one friendly client, fix issues, switch Supabase to Pro | All active clients invited and able to sign in |

---

## 12. Later phases

**Phase 2 — Recurring business**
- Subscriptions/retainers (hosting, maintenance, support) with automatic monthly or yearly invoices.
- Payment reminders (before due date, on due date, when overdue).
- Renewals tracker: client domains, hosting and SSL expiry dates with alerts 30 days ahead.
- Guides and documents library per client (manuals, onboarding checklists, videos).
- PayHere card payments, including recurring payments.

**Phase 3 — Team tools**
- Internal task board (Kanban) linked to projects and feature requests.
- Time tracking per project and request.
- Quotes and estimates as documents, with client sign-off on scope changes.
- Reports: revenue by month and client, project profitability, request turnaround time.

---

## 13. Rules for whoever writes the code (people or AI)

1. Follow the build steps in order. Do not start the next step until the current one is reviewed.
2. Never rely on the UI for security: RLS policies plus server-side role checks for every read and write.
3. Never expose the service-role key or any secret to the browser. Secrets live only in environment variables.
4. Every database change is a migration file in the repo. No manual changes in the Supabase dashboard.
5. Validate all input with Zod on the server. Handle and show errors clearly; never show raw error messages to clients.
6. Money calculations happen in the database or server code with `numeric` precision, never with JavaScript floating point on the client.
7. Keep components small and typed; no `any`. Follow the existing folder structure.
8. Every screen works on a 375 px wide phone and in keyboard-only use.
9. Write tests for the business rules in section 6 and the key flows in section 8.
10. Do not invent business details, prices or client data. Use the settings table and real data only.

---

## 14. Open questions (defaults apply until changed)

| Question | Default |
|---|---|
| Should team members see invoices? | No, admin only |
| Should clients see the names of team members on their project? | Yes, name and role only |
| Tax line on invoices? | Optional, 0 by default |
| Payment terms | 14 days |
| Should clients be able to download all their data? | Admin exports on request (Phase 1) |
| Languages | English only in Phase 1 |
