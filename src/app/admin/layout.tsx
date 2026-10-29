import { Suspense } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { requireStaff } from "@/lib/auth";

async function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
          Loading workspace...
        </div>
      }
    >
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  );
}
