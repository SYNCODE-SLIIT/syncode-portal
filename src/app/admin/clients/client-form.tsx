"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select, Textarea, secondaryButtonClass } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientAction, updateClientAction } from "@/lib/actions/clients";
import type { Client } from "@/lib/types/database";

const INPUT = "h-11 rounded-xl px-3.5";

export function ClientForm({ client }: { client?: Client }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cancelHref = client ? `/admin/clients/${client.id}` : "/admin/clients";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = client ? await updateClientAction(client.id, formData) : await createClientAction(formData);
      if (!result.ok) setError(result.error ?? "Could not save the client.");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6" noValidate>
      <fieldset disabled={isPending} className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Business name</Label>
          <Input id="name" name="name" required defaultValue={client?.name} placeholder="e.g. Hotel Seven Way" className={INPUT} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_type">Business type</Label>
          <Input
            id="business_type"
            name="business_type"
            defaultValue={client?.business_type ?? ""}
            placeholder="e.g. Hotel, Retail, Automotive"
            className={INPUT}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={client?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Business email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={client?.email ?? ""}
            placeholder="info@company.com"
            className={INPUT}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={client?.phone ?? ""}
            placeholder="+94 77 123 4567"
            className={INPUT}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" name="address" rows={2} defaultValue={client?.address ?? ""} className="min-h-16" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Internal notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={client?.notes ?? ""}
            placeholder="Only SYNCODE staff can see these notes."
          />
        </div>
      </fieldset>

      <FormMessage error={error} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={secondaryButtonClass}>
          Cancel
        </Link>
        <Button type="submit" disabled={isPending} className="h-10 rounded-full px-5 text-sm font-semibold">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {client ? "Save changes" : "Create client"}
        </Button>
      </div>
    </form>
  );
}
