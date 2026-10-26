import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden px-4 py-12">
      {/* Soft spotlight behind the form */}
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
            Welcome <span className="gradient-text">back</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to see your projects, updates and invoices.
          </p>
        </div>

        <LoginForm />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Need access? Contact{" "}
          <a
            href="mailto:team.syncode@gmail.com"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            team.syncode@gmail.com
          </a>
        </p>
      </div>
    </main>
  );
}
