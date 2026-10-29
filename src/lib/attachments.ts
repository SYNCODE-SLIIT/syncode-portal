/** File types the private "attachments" bucket accepts (the bucket also enforces 10 MB). */
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Payment slips: the private "slips" bucket accepts these types up to 5 MB. */
export const SLIP_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const MAX_SLIP_BYTES = 5 * 1024 * 1024;

/** A storage-safe version of an uploaded file's name (letters, numbers, dots, dashes), kept short. */
export function safeFileName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return cleaned.slice(-100) || "file";
}
