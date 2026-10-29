import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  FolderKanban,
  MessageSquarePlus,
  Users,
} from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { colomboToday, formatMoney } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

async function AdminOverviewContent() {
  const session = await requireStaff();
  const supabase = await createClient();
  const isAdmin = session.profile.role === "admin";

  const [projectsRes, requestsRes, clientsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, status", { count: "exact" })
      .in("status", ["planning", "in_progress"]),
    supabase
      .from("feature_requests")
      .select("id, status", { count: "exact" })
      .not("status", "in", "(delivered,declined)"),
    supabase
      .from("clients")
      .select("id", { count: "exact" })
      .eq("status", "active"),
  ]);

  let pendingPaymentsCount = 0;
  let unpaidLkr = 0;
  let unpaidUsd = 0;
  let overdueCount = 0;

  if (isAdmin) {
    const [paymentsRes, invoicesRes] = await Promise.all([
      supabase
        .from("payments")
        .select("id", { count: "exact" })
        .eq("status", "pending"),
      supabase
        .from("invoices")
        .select("currency, total, amount_paid, status, due_date")
        .in("status", ["sent", "partially_paid"]),
    ]);

    pendingPaymentsCount = paymentsRes.count ?? 0;
    const today = colomboToday();
    for (const inv of invoicesRes.data ?? []) {
      if ((inv.due_date as string) < today) overdueCount += 1;
      const balance = Math.max(0, Number(inv.total) - Number(inv.amount_paid));
      if (inv.currency === "USD") {
        unpaidUsd += balance;
      } else {
        unpaidLkr += balance;
      }
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Team SYNCODE
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back, {session.profile.full_name.split(" ")[0] || "Team"}
          </h1>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/team"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-medium transition-colors hover:bg-secondary"
            >
              <Users className="size-3.5" />
              Manage Team & Invites
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Active Clients
            </span>
            <Building2 className="size-4" />
          </div>
          <p className="mt-3 text-3xl font-bold">{clientsRes.count ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Client businesses in the portal
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Active Projects
            </span>
            <FolderKanban className="size-4" />
          </div>
          <p className="mt-3 text-3xl font-bold">{projectsRes.count ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Planning or in progress
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Open Requests
            </span>
            <MessageSquarePlus className="size-4" />
          </div>
          <p className="mt-3 text-3xl font-bold">{requestsRes.count ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Waiting for review or delivery
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/admin/payments"
            className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-foreground/30"
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">
                Slips to Review
              </span>
              <CreditCard className="size-4" />
            </div>
            <p className="mt-3 text-3xl font-bold">{pendingPaymentsCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Unpaid: {formatMoney(unpaidLkr, "LKR")} ·{" "}
              {formatMoney(unpaidUsd, "USD")}
              {overdueCount > 0 && ` · ${overdueCount} overdue`}
            </p>
          </Link>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Getting started</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the sidebar to manage your team, invite clients, and track active projects.
        </p>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 animate-pulse rounded-2xl border border-border bg-card p-6" />
      }
    >
      <AdminOverviewContent />
    </Suspense>
  );
}
