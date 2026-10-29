import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { requireAuth } from "@/lib/auth";
import { WelcomeForm } from "./welcome-form";

export const metadata: Metadata = {
  title: "Welcome",
};

async function WelcomeContent() {
  const session = await requireAuth({ allowIncompleteProfile: true });

  return (
    <WelcomeForm
      defaultName={session.profile.full_name}
      defaultPhone={session.profile.phone ?? ""}
      email={session.email}
    />
  );
}

export default function WelcomePage() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] max-w-[200vw] -translate-x-1/2
                   rounded-full bg-[radial-gradient(closest-side,hsl(0_0%_100%/0.07),transparent)]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/syncode-logo.webp"
            alt="Team SYNCODE"
            width={56}
            height={56}
            priority
            className="rounded-full bg-foreground/10"
          />
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Client Portal
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Finish setting <span className="gradient-text">up</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirm your name and optionally set a password for future sign-ins.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-80 animate-pulse rounded-2xl border border-border bg-card p-6" />
          }
        >
          <WelcomeContent />
        </Suspense>
      </div>
    </main>
  );
}
