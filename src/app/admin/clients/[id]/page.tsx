import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderKanban, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import {
  PageHeader,
  ProgressBar,
  StatusBadge,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form-fields";
import { requireStaff } from "@/lib/auth";
import { getProjectProgress } from "@/lib/data/projects";
import { getUserAccounts } from "@/lib/data/users";
import { formatMoney, formatPortalDate, getInvoiceDisplayStatus } from "@/lib/domain";
import {
  CLIENT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_STYLES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
  PROJECT_TYPE_LABELS,
} from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Client, Invoice, Profile, Project } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";
import { InviteContactForm } from "./invite-contact-form";

export const metadata: Metadata = {
  title: "Client",
};

async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const isAdmin = session.profile.role === "admin";
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [{ data: client }, { data: internal }, { data: contacts }, { data: projects }, { data: invoices }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle<Client>(),
    supabase.from("client_internal").select("notes").eq("client_id", id).maybeSingle<{ notes: string | null }>(),
    supabase
      .from("profiles")
      .select("*")
      .eq("client_id", id)
      .eq("role", "client")
      .order("created_at", { ascending: true })
      .returns<Profile[]>(),
    supabase.from("projects").select("*").eq("client_id", id).order("created_at", { ascending: false }).returns<Project[]>(),
    // Billing is admin-only; team members get an empty list from row-level security anyway
    isAdmin
      ? supabase.from("invoices").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(20).returns<Invoice[]>()
      : Promise.resolve({ data: [] as Invoice[] }),
  ]);

  if (!client) notFound();

  const contactList = contacts ?? [];
  const projectList = projects ?? [];
  const [accounts, progress] = await Promise.all([
    getUserAccounts(contactList.map((c) => c.id)),
    getProjectProgress(supabase, projectList),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/admin/clients" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Clients
      </Link>

      <PageHeader
        eyebrow={client.business_type || "Client"}
        title={client.name}
        description={
          client.status !== "active" ? (
            <StatusBadge className="border-border">{CLIENT_STATUS_LABELS[client.status]}</StatusBadge>
          ) : undefined
        }
        actions={
          <>
            <Link href={`/admin/clients/${client.id}/edit`} className={secondaryButtonClass}>
              <Pencil className="size-4" />
              Edit
            </Link>
            <Link href={`/admin/projects/new?client=${client.id}`} className={primaryButtonClass}>
              <Plus className="size-4" />
              New project
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Details */}
        <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Details</h2>
          <dl className="space-y-3 text-sm">
            <Detail icon={Mail} label="Email">
              {client.email ? (
                <a href={`mailto:${client.email}`} className="hover:underline">
                  {client.email}
                </a>
              ) : null}
            </Detail>
            <Detail icon={Phone} label="Phone">
              {client.phone ? (
                <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="hover:underline">
                  {client.phone}
                </a>
              ) : null}
            </Detail>
            <Detail icon={MapPin} label="Address">
              {client.address ? <span className="whitespace-pre-line">{client.address}</span> : null}
            </Detail>
          </dl>
          {internal?.notes && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Internal notes</p>
              <p className="mt-2 whitespace-pre-line text-sm">{internal.notes}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Added {formatPortalDate(client.created_at)}</p>
        </section>

        {/* Projects */}
        <section className="rounded-2xl border border-border bg-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">Projects ({projectList.length})</h2>
          </div>
          {projectList.length === 0 ? (
            <div className="p-8 text-center">
              <FolderKanban className="mx-auto size-7 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No projects for this client yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {projectList.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/admin/projects/${project.id}`}
                    className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {PROJECT_TYPE_LABELS[project.type]}
                        {project.target_date ? ` · Target ${formatPortalDate(project.target_date)}` : ""}
                      </p>
                    </div>
                    <ProgressBar value={progress.get(project.id) ?? 0} className="sm:w-40" />
                    <StatusBadge className={PROJECT_STATUS_STYLES[project.status]}>
                      {PROJECT_STATUS_LABELS[project.status]}
                    </StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isAdmin && (
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">Invoices ({(invoices ?? []).length})</h2>
            <Link href={`/admin/invoices/new?client=${client.id}`} className={`${secondaryButtonClass} h-9 px-4`}>
              <Plus className="size-4" />
              New invoice
            </Link>
          </div>
          {(invoices ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No invoices for this client yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(invoices ?? []).map((inv) => {
                const display = getInvoiceDisplayStatus(inv.status, inv.due_date);
                return (
                  <li key={inv.id}>
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-3 text-sm transition-colors hover:bg-secondary/50"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium tabular-nums">{inv.number}</span>
                        <span className="text-muted-foreground"> · {formatPortalDate(inv.issue_date)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums">{formatMoney(inv.total, inv.currency)}</span>
                        <StatusBadge className={INVOICE_STATUS_STYLES[display]}>{INVOICE_STATUS_LABELS[display]}</StatusBadge>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Contacts */}
      <section className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Contacts ({contactList.length})</h2>
          <p className="text-xs text-muted-foreground">
            People at {client.name} who can sign in to the portal and see this client&apos;s projects and invoices.
          </p>
        </div>
        {contactList.length > 0 && (
          <ul className="divide-y divide-border">
            {contactList.map((contact) => {
              const account = accounts.get(contact.id);
              return (
                <li key={contact.id} className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{contact.full_name || "Name not set yet"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {account?.email ?? ""}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {!contact.is_active
                      ? "Deactivated"
                      : account?.lastSignInAt
                        ? `Last signed in ${formatPortalDate(account.lastSignInAt)}`
                        : "Invited, hasn't signed in yet"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-border p-6">
          <InviteContactForm clientId={client.id} clientName={client.name} disabled={client.status !== "active"} />
        </div>
      </section>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="break-words">{children ?? <span className="text-muted-foreground">No {label.toLowerCase()}</span>}</dd>
      </div>
    </div>
  );
}

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
      <ClientDetail params={params} />
    </Suspense>
  );
}
