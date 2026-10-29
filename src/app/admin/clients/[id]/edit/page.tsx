import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/form-fields";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types/database";
import { isUuid } from "@/lib/validation";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = {
  title: "Edit client",
};

async function EditClientContent({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle<Client>();
  if (!client) notFound();

  return (
    <>
      <PageHeader eyebrow="Edit client" title={client.name} />
      <ClientForm client={client} />
    </>
  );
}

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />}>
        <EditClientContent params={params} />
      </Suspense>
    </div>
  );
}
