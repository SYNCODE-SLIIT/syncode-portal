"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoticeToast } from "@/components/ui/toaster";
import { updateAccountAction } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types/database";

export function AccountForm({
  profile,
  email,
}: {
  profile: Profile;
  email: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const res = await updateAccountAction(formData);
      if (!res.ok) {
        setError(res.error ?? "Failed to update account.");
      } else {
        setNotice(res.message ?? "Saved.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            value={email}
            disabled
            className="h-11 rounded-xl bg-secondary/50 px-3.5 text-muted-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="full_name">Full name</Label>
          <Input
            id="full_name"
            name="full_name"
            defaultValue={profile.full_name}
            required
            disabled={isPending}
            className="h-11 rounded-xl px-3.5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone / WhatsApp</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile.phone ?? ""}
            placeholder="+94 77 123 4567"
            disabled={isPending}
            className="h-11 rounded-xl px-3.5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new_password">Change password (optional)</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            placeholder="Leave blank to keep your current password"
            disabled={isPending}
            className="h-11 rounded-xl px-3.5"
          />
        </div>

        <label className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="email_notifications"
            defaultChecked={profile.email_notifications}
            disabled={isPending}
            className="size-4 rounded border-input accent-primary"
          />
          <span>
            Email me about project updates, request changes, and invoices
          </span>
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {notice && <NoticeToast message={notice} />}

        <Button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-full px-6 text-sm font-semibold"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save changes
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
