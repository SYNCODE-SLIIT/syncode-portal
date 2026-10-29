"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clientSchema, firstError, formFields } from "@/lib/validation";
import type { ActionResult } from "./auth";

const CLIENT_FIELDS = ["name", "business_type", "email", "phone", "address", "notes", "status"] as const;

/** Staff action: creates a client business, then opens its page. */
export async function createClientAction(formData: FormData): Promise<ActionResult> {
  const session = await requireStaff();
  const parsed = clientSchema.safeParse(formFields(formData, CLIENT_FIELDS));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { notes, ...client } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").insert(client).select("id").single();
  if (error || !data) {
    return { ok: false, error: "Could not create the client. Please try again." };
  }
  if (notes) {
    await supabase.from("client_internal").insert({ client_id: data.id, notes });
  }

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "client",
    entity_id: data.id,
    action: "client.created",
    details: { name: parsed.data.name },
  });

  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${data.id}`);
}

/** Staff action: updates a client's details. */
export async function updateClientAction(clientId: string, formData: FormData): Promise<ActionResult> {
  const session = await requireStaff();
  const parsed = clientSchema.safeParse(formFields(formData, CLIENT_FIELDS));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const { notes, ...client } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update(client)
    .eq("id", clientId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Could not save the client. Please try again." };
  }
  const { error: notesError } = await supabase
    .from("client_internal")
    .upsert({ client_id: clientId, notes, updated_at: new Date().toISOString() });
  if (notesError) {
    return { ok: false, error: "The client was saved, but the internal notes could not be. Please try again." };
  }

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "client",
    entity_id: clientId,
    action: "client.updated",
    details: { name: parsed.data.name, status: parsed.data.status },
  });

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  redirect(`/admin/clients/${clientId}`);
}
