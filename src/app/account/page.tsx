import { Suspense } from "react";
import type { Metadata } from "next";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireAuth } from "@/lib/auth";
import { AccountForm } from "./account-form";

export const metadata: Metadata = {
  title: "Account Settings",
};

async function AccountContent() {
  const session = await requireAuth();

  return (
    <PortalShell
      role={session.profile.role}
      fullName={session.profile.full_name}
      email={session.email}
    >
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Profile & Preferences
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Account Settings
          </h1>
        </div>

        <AccountForm profile={session.profile} email={session.email} />
      </div>
    </PortalShell>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading account...
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
