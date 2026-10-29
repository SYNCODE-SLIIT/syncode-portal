"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select, Textarea, secondaryButtonClass } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRequestAction, recordRequestAttachmentAction } from "@/lib/actions/requests";
import { createClient } from "@/lib/supabase/client";
import { ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

const MAX_FILES = 3;

function safeFileName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-100) || "file";
}

export function NewRequestForm({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; name: string }[];
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addFiles = (list: FileList | null) => {
    setError(null);
    const picked = Array.from(list ?? []);
    for (const file of picked) {
      if (!ATTACHMENT_TYPES.includes(file.type)) return setError(`"${file.name}" isn't a JPG, PNG, WebP or PDF file.`);
      if (file.size > MAX_ATTACHMENT_BYTES) return setError(`"${file.name}" is larger than 10 MB.`);
    }
    setFiles((current) => [...current, ...picked].slice(0, MAX_FILES));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createRequestAction(formData);
      if (!result.ok || !result.requestId || !result.clientId) {
        setError(result.error ?? "Could not submit the request.");
        return;
      }

      // Files go straight to private storage; storage policies only allow this client's own folder
      const supabase = createClient();
      const failed: string[] = [];
      for (const file of files) {
        const path = `${result.clientId}/requests/${result.requestId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const upload = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
        const recorded = upload.error
          ? { ok: false }
          : await recordRequestAttachmentAction(result.requestId, { path, name: file.name, type: file.type, size: file.size });
        if (!recorded.ok) failed.push(file.name);
      }

      router.push(`/requests/${result.requestId}${failed.length ? "?upload=failed" : ""}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6" noValidate>
      <fieldset disabled={isPending} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
          <div className="space-y-2">
            <Label htmlFor="project_id">Project</Label>
            <Select id="project_id" name="project_id" required defaultValue={defaultProjectId ?? (projects.length === 1 ? projects[0].id : "")}>
              <option value="" disabled>
                Choose a project…
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" name="priority" defaultValue="normal">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">What do you need?</Label>
          <Input id="title" name="title" required maxLength={120} placeholder="e.g. Add a gallery page" className="h-11 rounded-xl px-3.5" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Details</Label>
          <Textarea
            id="description"
            name="description"
            rows={6}
            required
            maxLength={5000}
            placeholder="Describe the change, where it should appear, and any examples or deadlines."
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Attachments (optional)</p>
          <p className="text-xs text-muted-foreground">Screenshots or documents: JPG, PNG, WebP or PDF, up to 10 MB each, {MAX_FILES} files at most.</p>
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                    className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {files.length < MAX_FILES && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Paperclip className="size-4" />
              Add a file
              <input
                type="file"
                accept={ATTACHMENT_TYPES.join(",")}
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </fieldset>

      <FormMessage error={error} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/requests" className={secondaryButtonClass}>
          Cancel
        </Link>
        <Button type="submit" disabled={isPending} className="h-10 rounded-full px-5 text-sm font-semibold">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending && files.length > 0 ? "Uploading…" : "Send request"}
        </Button>
      </div>
    </form>
  );
}
