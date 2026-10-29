import { Suspense } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireClient } from "@/lib/auth";

async function ClientLayoutInner({ children }: { children: React.ReactNode }) {
  const session = await requireClient();

  return (
    <PortalShell
      role={session.profile.role}
      fullName={session.profile.full_name}
      email={session.email}
    >
      {children}
    </PortalShell>
  );
}

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading portal...
        </div>
      }
    >
      <ClientLayoutInner>{children}</ClientLayoutInner>
    </Suspense>
  );
}
