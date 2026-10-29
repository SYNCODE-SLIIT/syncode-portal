"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeWelcomeAction } from "@/lib/actions/auth";

export function WelcomeForm({
  defaultName,
  defaultPhone,
  email,
}: {
  defaultName: string;
  defaultPhone: string;
  email: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await completeWelcomeAction(formData);
      if (!result.ok && result.error) {
        setError(result.error);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_10px_40px_-10px_hsl(0_0%_0%/0.4)]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Signed in as</Label>
          <Input
            id="email"
            type="email"
            value={email}
            disabled
            className="h-11 rounded-xl bg-secondary/50 px-3.5 text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="full_name">Your full name</Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            defaultValue={defaultName}
            placeholder="e.g. Kasun Perera"
            required
            disabled={isPending}
            className="h-11 rounded-xl px-3.5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone / WhatsApp (optional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaultPhone}
            placeholder="+94 77 123 4567"
            disabled={isPending}
            className="h-11 rounded-xl px-3.5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Set a password (optional)</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Leave blank to sign in with email links only"
            disabled={isPending}
            className="h-11 rounded-xl px-3.5"
          />
          <p className="text-xs text-muted-foreground">
            At least 8 characters if you choose to set one.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="h-11 w-full rounded-full text-sm font-semibold"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Continue to portal
              <ArrowRight data-icon="inline-end" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
