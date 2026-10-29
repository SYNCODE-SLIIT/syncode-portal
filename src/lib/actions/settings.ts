"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstError, formFields, settingsSchema } from "@/lib/validation";
import type { ActionResult } from "./auth";

const SETTINGS_FIELDS = [
  "business_name",
  "business_address",
  "business_phone",
  "business_email",
  "bank_name",
  "bank_branch",
  "bank_account_name",
  "bank_account_number",
  "bank_swift_code",
  "invoice_prefix",
  "payment_terms_days",
] as const;

/** Admin action: saves the business and bank details shown on invoices. */
export async function updateSettingsAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = settingsSchema.safeParse(formFields(formData, SETTINGS_FIELDS));
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("singleton_key", true);
  if (error) return { ok: false, error: "Could not save the settings. Please try again." };

  await supabase.from("activity_log").insert({
    actor_id: session.userId,
    entity_type: "settings",
    action: "settings.updated",
    details: {},
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/invoices", "layout");
  revalidatePath("/invoices", "layout");
  return { ok: true, message: "Settings saved." };
}
