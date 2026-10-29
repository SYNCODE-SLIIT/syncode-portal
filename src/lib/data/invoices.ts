import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Client, Invoice, InvoiceItem, PortalSettings } from "@/lib/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface InvoiceDetail {
  invoice: Invoice;
  items: InvoiceItem[];
  client: Pick<Client, "id" | "name" | "email" | "phone" | "address"> | null;
  projectName: string | null;
  settings: PortalSettings | null;
}

/** Everything needed to show or print one invoice. Row-level security decides whether the viewer may see it. */
export async function getInvoiceDetail(supabase: SupabaseServerClient, invoiceId: string): Promise<InvoiceDetail | null> {
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle<Invoice>();
  if (!invoice) return null;

  const [{ data: items }, { data: client }, { data: project }, { data: settings }] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position", { ascending: true })
      .returns<InvoiceItem[]>(),
    supabase.from("clients").select("id, name, email, phone, address").eq("id", invoice.client_id).maybeSingle(),
    invoice.project_id
      ? supabase.from("projects").select("name").eq("id", invoice.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("settings").select("*").eq("singleton_key", true).maybeSingle<PortalSettings>(),
  ]);

  return {
    invoice,
    items: items ?? [],
    client: client as InvoiceDetail["client"],
    projectName: (project?.name as string | undefined) ?? null,
    settings: settings ?? null,
  };
}

export async function getSettings(supabase: SupabaseServerClient): Promise<PortalSettings | null> {
  const { data } = await supabase.from("settings").select("*").eq("singleton_key", true).maybeSingle<PortalSettings>();
  return data ?? null;
}

/** Download links for payment slips, valid for one hour. Storage policies decide who may sign each file. */
export async function getSlipUrls(supabase: SupabaseServerClient, paths: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unique.length === 0) return new Map();
  const { data } = await supabase.storage.from("slips").createSignedUrls(unique, 60 * 60);
  const urls = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

/** True when the bank details needed for a bank transfer are filled in. */
export function hasBankDetails(settings: PortalSettings | null): boolean {
  return Boolean(settings?.bank_name && settings.bank_account_name && settings.bank_account_number);
}
