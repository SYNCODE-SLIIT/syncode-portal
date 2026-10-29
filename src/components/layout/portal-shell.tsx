"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import type { UserRole } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const STAFF_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Building2 },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/requests", label: "Requests", icon: MessageSquarePlus },
  { href: "/admin/invoices", label: "Invoices", icon: FileText, adminOnly: true },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, adminOnly: true },
  { href: "/admin/team", label: "Team", icon: Users, adminOnly: true },
  { href: "/admin/activity", label: "Activity", icon: Activity, adminOnly: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
];

const CLIENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/requests", label: "Requests", icon: MessageSquarePlus },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/account", label: "Account", icon: UserCircle },
];

export function PortalShell({
  role,
  fullName,
  email,
  children,
}: {
  role: UserRole;
  fullName: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isStaff = role === "admin" || role === "team";
  const items = isStaff
    ? STAFF_NAV.filter((item) => !item.adminOnly || role === "admin")
    : CLIENT_NAV;

  const isActive = (href: string) => {
    if (href === "/admin" || href === "/dashboard") {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <Image
            src="/syncode-logo.webp"
            alt="Team SYNCODE"
            width={32}
            height={32}
            className="rounded-full bg-foreground/10"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              SYNCODE Portal
            </p>
            <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
              {role === "admin"
                ? "Admin Workspace"
                : role === "team"
                  ? "Team Workspace"
                  : "Client Portal"}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3 space-y-2">
          <Link
            href="/account"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-secondary"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold uppercase">
              {(fullName || email || "U").slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {fullName || "User"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </Link>

          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-sidebar px-4 md:hidden">
        <div className="flex items-center gap-2.5">
          <Image
            src="/syncode-logo.webp"
            alt="Team SYNCODE"
            width={28}
            height={28}
            className="rounded-full bg-foreground/10"
          />
          <span className="text-sm font-semibold">SYNCODE Portal</span>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-3.5" />
            <span>Sign out</span>
          </button>
        </form>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-sidebar/95 px-2 py-2 backdrop-blur md:hidden"
      >
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
