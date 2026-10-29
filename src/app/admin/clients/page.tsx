import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus, Search } from "lucide-react";
import { PageHeader, StatusBadge, primaryButtonClass } from "@/components/ui/form-fields";
import { requireStaff } from "@/lib/auth";
import { CLIENT_STATUS_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Client, ClientStatus } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Clients",
};

type Filter = "active" | "inactive" | "all";

async function ClientsContent({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireStaff();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 80);
  const filter: Filter = params.status === "inactive" || params.status === "all" ? params.status : "active";

  const supabase = await createClient();
  let clientsQuery = supabase.from("clients").select("*").order("name", { ascending: true });
  if (filter !== "all") clientsQuery = clientsQuery.eq("status", filter);
  if (query) {
    // Escape characters that have meaning in PostgREST filters and LIKE patterns
    const pattern = `"%${query.replace(/[%_,()"\\]/g, " ")}%"`;
    clientsQuery = clientsQuery.or(`name.ilike.${pattern},business_type.ilike.${pattern},email.ilike.${pattern}`);
  }

  const [{ data: clients }, { data: projects }, { data: contacts }] = await Promise.all([
    clientsQuery.returns<Client[]>(),
    supabase.from("projects").select("client_id, status"),
    supabase.from("profiles").select("client_id").eq("role", "client").eq("is_active", true),
  ]);

  const activeProjects = new Map<string, number>();
  for (const p of projects ?? []) {
    if (p.status === "planning" || p.status === "in_progress" || p.status === "on_hold") {
      activeProjects.set(p.client_id, (activeProjects.get(p.client_id) ?? 0) + 1);
    }
  }
  const contactCounts = new Map<string, number>();
  for (const c of contacts ?? []) {
    if (c.client_id) contactCounts.set(c.client_id, (contactCounts.get(c.client_id) ?? 0) + 1);
  }

  const list = clients ?? [];

  return (
    <div className="space-y-6">
      <form className="flex flex-col gap-3 sm:flex-row sm:items-center" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Search clients</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Search by name, type or email"
            className="h-11 w-full rounded-xl border border-input bg-input/30 pl-10 pr-3.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <input type="hidden" name="status" value={filter} />
        <div className="flex gap-1 rounded-full border border-border p-1 text-xs">
          {(["active", "inactive", "all"] as const).map((value) => (
            <Link
              key={value}
              href={{ pathname: "/admin/clients", query: { status: value, ...(query ? { q: query } : {}) } }}
              className={`rounded-full px-3 py-1.5 font-medium capitalize transition-colors ${
                filter === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {value}
            </Link>
          ))}
        </div>
      </form>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{query || filter !== "active" ? "No clients match this search." : "No clients yet."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a client business, then create its projects and invite its contacts.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((client) => (
            <li key={client.id}>
              <Link
                href={`/admin/clients/${client.id}`}
                className="block h-full rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{client.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{client.business_type || "Business type not set"}</p>
                  </div>
                  {client.status !== "active" && (
                    <StatusBadge className="border-border text-muted-foreground">
                      {CLIENT_STATUS_LABELS[client.status as ClientStatus]}
                    </StatusBadge>
                  )}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {plural(activeProjects.get(client.id) ?? 0, "active project")} ·{" "}
                  {plural(contactCounts.get(client.id) ?? 0, "contact")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Clients"
        description="Client businesses, their contacts and projects."
        actions={
          <Link href="/admin/clients/new" className={primaryButtonClass}>
            <Plus className="size-4" />
            New client
          </Link>
        }
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border bg-card" />}>
        <ClientsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
