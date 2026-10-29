import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Attachment } from "@/lib/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface AttachmentLink {
  id: string;
  name: string;
  size: number;
  url: string | null;
}

/** Attachments for a request, each with a download link valid for one hour. */
export async function getRequestAttachments(supabase: SupabaseServerClient, requestId: string): Promise<AttachmentLink[]> {
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("owner_type", "request")
    .eq("owner_id", requestId)
    .order("created_at", { ascending: true })
    .returns<Attachment[]>();
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Storage policies decide who may sign each file, so this uses the signed-in user's client
  const { data: signed } = await supabase.storage.from("attachments").createSignedUrls(
    rows.map((r) => r.storage_path),
    60 * 60
  );
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return rows.map((r) => ({ id: r.id, name: r.file_name, size: Number(r.size_bytes), url: urls.get(r.storage_path) ?? null }));
}

export interface CommentItem {
  id: string;
  body: string;
  is_internal: boolean;
  created_at: string;
  author_name: string | null;
  author_is_staff: boolean;
}

/** Comments on a request. Row-level security hides internal comments from clients. */
export async function getRequestComments(supabase: SupabaseServerClient, requestId: string): Promise<CommentItem[]> {
  const { data } = await supabase
    .from("request_comments")
    .select("id, body, is_internal, created_at, profiles(full_name, role)")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((c) => {
    const author = c.profiles as unknown as { full_name: string; role: string } | null;
    return {
      id: c.id as string,
      body: c.body as string,
      is_internal: Boolean(c.is_internal),
      created_at: c.created_at as string,
      author_name: author?.full_name || null,
      // Clients can always see their own contacts, so an author they can't see is SYNCODE staff
      author_is_staff: author ? author.role !== "client" : true,
    };
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
