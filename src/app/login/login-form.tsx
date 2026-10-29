"use client";

import { useState, useTransition } from "react";
import { ArrowRight, KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendMagicLinkAction,
  signInWithPasswordAction,
} from "@/lib/actions/auth";

type Mode = "link" | "password";

export function LoginForm({ initialError }: { initialError?: string | null }) {
  const [mode, setMode] = useState<Mode>("link");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setError(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result =
        mode === "link"
          ? await sendMagicLinkAction(formData)
          : await signInWithPasswordAction(formData);

      if (!result.ok && result.error) {
        setError(result.error);
      } else if (result.ok && result.message) {
        setNotice(result.message);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_10px_40px_-10px_hsl(0_0%_0%/0.4)]">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            disabled={isPending}
            className="h-11 rounded-xl px-3.5"
          />
        </div>

        {mode === "password" && (
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isPending}
              className="h-11 rounded-xl px-3.5"
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="h-11 w-full rounded-full text-sm font-semibold"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {mode === "link" ? "Sending link..." : "Signing in..."}
            </>
          ) : (
            <>
              {mode === "link" ? "Email me a login link" : "Sign in"}
              <ArrowRight data-icon="inline-end" />
            </>
          )}
        </Button>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300"
          >
            {notice}
          </p>
        )}
      </form>

      <div className="mt-5 border-t border-border pt-4 text-center">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "link" ? "password" : "link");
            setNotice(null);
            setError(null);
          }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "link" ? (
            <KeyRound className="size-4" />
          ) : (
            <Mail className="size-4" />
          )}
          {mode === "link"
            ? "Use a password instead"
            : "Email me a login link instead"}
        </button>
      </div>
    </div>
  );
}
