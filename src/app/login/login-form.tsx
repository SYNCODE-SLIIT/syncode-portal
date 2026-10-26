"use client";

import { useState } from "react";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "link" | "password";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("link");
  const [notice, setNotice] = useState<string | null>(null);

  // Sign-in is connected to Supabase in build step 3 (login and roles).
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("Sign-in isn't switched on yet. It will work after the next setup step.");
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
              className="h-11 rounded-xl px-3.5"
            />
          </div>
        )}

        <Button type="submit" className="h-11 w-full rounded-full text-sm font-semibold">
          {mode === "link" ? "Email me a login link" : "Sign in"}
          <ArrowRight data-icon="inline-end" />
        </Button>

        {notice && (
          <p role="status" className="rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
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
          }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "link" ? <KeyRound className="size-4" /> : <Mail className="size-4" />}
          {mode === "link" ? "Use a password instead" : "Email me a login link instead"}
        </button>
      </div>
    </div>
  );
}
