"use client";

import { useState, useTransition } from "react";
import { Loader2, Send, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoticeToast } from "@/components/ui/toaster";
import {
  inviteUserAction,
  toggleUserActiveAction,
} from "@/lib/actions/auth";
import { formatPortalDate } from "@/lib/domain";
import type { Client, Profile, UserRole } from "@/lib/types/database";

export function TeamManagementClient({
  currentUserId,
  profiles,
  clients,
}: {
  currentUserId: string;
  profiles: Profile[];
  clients: Pick<Client, "id" | "name">[];
}) {
  const [role, setRole] = useState<UserRole>("team");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleInvite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const res = await inviteUserAction(formData);
      if (!res.ok) {
        setError(res.error ?? "Failed to send invite.");
      } else {
        setNotice(res.message ?? "Invitation sent.");
        form.reset();
      }
    });
  };

  const handleToggleActive = (profileId: string, makeActive: boolean) => {
    setNotice(null);
    setError(null);
    startTransition(async () => {
      const res = await toggleUserActiveAction(profileId, makeActive);
      if (!res.ok) {
        setError(res.error ?? "Could not update user.");
      } else {
        setNotice(res.message ?? "User status updated.");
      }
    });
  };

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-8">
      {/* Invite Form */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Invite to SYNCODE Portal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send an email invitation link to a SYNCODE staff member or a client contact.
        </p>

        <form onSubmit={handleInvite} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              placeholder="e.g. Nimal Perera"
              required
              disabled={isPending}
              className="h-11 rounded-xl px-3.5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="person@company.com"
              required
              disabled={isPending}
              className="h-11 rounded-xl px-3.5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              disabled={isPending}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="team">Team (SYNCODE Staff)</option>
              <option value="admin">Admin (Founder / Manager)</option>
              <option value="client">Client Contact</option>
            </select>
          </div>

          {role === "client" && (
            <div className="space-y-2">
              <Label htmlFor="client_id">Client business</Label>
              <select
                id="client_id"
                name="client_id"
                required
                disabled={isPending}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select client business...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="text-xs text-amber-400">
                  Create a client business in Clients first before inviting a client contact.
                </p>
              )}
            </div>
          )}

          <div className="sm:col-span-2 flex items-center justify-end pt-2">
            <Button
              type="submit"
              disabled={isPending || (role === "client" && clients.length === 0)}
              className="h-10 rounded-full px-5 text-sm font-semibold"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {notice && <NoticeToast message={notice} />}
      </div>

      {/* People List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Portal Users ({profiles.length})</h2>
          <p className="text-xs text-muted-foreground">
            Staff members and invited client contacts. Deactivated users can no longer sign in.
          </p>
        </div>

        {profiles.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No users found yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {profiles.map((p) => {
              const isSelf = p.id === currentUserId;
              const clientName = p.client_id ? clientMap.get(p.client_id) : null;
              return (
                <div
                  key={p.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {p.full_name || "Pending first sign-in"}
                      </span>
                      <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider">
                        {p.role}
                      </span>
                      {clientName && (
                        <span className="text-xs text-muted-foreground">
                          · {clientName}
                        </span>
                      )}
                      {!p.is_active && (
                        <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Added {formatPortalDate(p.created_at)}
                    </p>
                  </div>

                  {!isSelf && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleToggleActive(p.id, !p.is_active)}
                      className="self-start rounded-full text-xs sm:self-auto"
                    >
                      {p.is_active ? (
                        <>
                          <UserX className="size-3.5" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="size-3.5" />
                          Reactivate
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
