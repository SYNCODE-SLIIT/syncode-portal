"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteUserAction } from "@/lib/actions/auth";

export function InviteContactForm({
  clientId,
  clientName,
  disabled,
}: {
  clientId: string;
  clientName: string;
  disabled: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await inviteUserAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not send the invitation.");
      } else {
        setNotice(result.message ?? "Invitation sent.");
        form.reset();
      }
    });
  };

  if (disabled) {
    return <p className="text-sm text-muted-foreground">Reactivate this client to invite contacts.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <h3 className="text-sm font-semibold">Invite a contact</h3>
        <p className="text-xs text-muted-foreground">
          They&apos;ll get an email to sign in and will only see {clientName}&apos;s projects and invoices.
        </p>
      </div>
      <input type="hidden" name="role" value="client" />
      <input type="hidden" name="client_id" value={clientId} />
      <fieldset disabled={isPending} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="contact_full_name">Full name</Label>
          <Input id="contact_full_name" name="full_name" required placeholder="e.g. Nimal Perera" className="h-11 rounded-xl px-3.5" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_email">Email address</Label>
          <Input
            id="contact_email"
            name="email"
            type="email"
            required
            placeholder="person@company.com"
            className="h-11 rounded-xl px-3.5"
          />
        </div>
        <Button type="submit" className="h-11 rounded-full px-5 text-sm font-semibold">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
          Send invitation
        </Button>
      </fieldset>
      <FormMessage error={error} notice={notice} />
    </form>
  );
}
