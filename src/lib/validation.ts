import { z } from "zod";
import { PROJECT_STATUSES, PROJECT_TYPES } from "./labels.ts";

/** Trimmed text; an empty field becomes null. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value));

/** Optional web address; adds https:// when the scheme is missing. */
const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(500)
    .transform((value) => {
      if (value === "") return null;
      return /^https?:\/\//i.test(value) ? value : `https://${value}`;
    })
    .refine((value) => {
      if (value === null) return true;
      try {
        const url = new URL(value);
        return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
      } catch {
        return false;
      }
    }, `${label} must be a valid web address.`);

/** Optional date from an <input type="date"> (YYYY-MM-DD). */
const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a valid date.")
  .transform((value) => (value === "" ? null : value));

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Enter the business name.").max(120, "Business name is too long."),
  business_type: optionalText(80, "Business type"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email address.")
    .transform((value) => (value === "" ? null : value)),
  phone: optionalText(40, "Phone"),
  address: optionalText(300, "Address"),
  notes: optionalText(2000, "Notes"),
  status: z.enum(["active", "inactive"]),
});

export const projectSchema = z
  .object({
    client_id: z.uuid("Choose a client."),
    name: z.string().trim().min(2, "Enter the project name.").max(120, "Project name is too long."),
    type: z.enum(PROJECT_TYPES as [string, ...string[]]),
    status: z.enum(PROJECT_STATUSES as [string, ...string[]]),
    description: optionalText(4000, "Description"),
    live_url: optionalUrl("Live URL"),
    staging_url: optionalUrl("Staging URL"),
    repo_url: optionalUrl("Repository URL"),
    start_date: optionalDate,
    target_date: optionalDate,
    progress_mode: z.enum(["auto", "manual"]),
    manual_progress: z
      .string()
      .trim()
      .transform((value) => (value === "" ? 0 : Number(value)))
      .pipe(
        z
          .number("Progress must be a number from 0 to 100.")
          .int("Progress must be a whole number.")
          .min(0, "Progress can't be below 0%.")
          .max(100, "Progress can't be above 100%.")
      ),
    member_ids: z.array(z.uuid()).max(50),
  })
  .refine((p) => !p.start_date || !p.target_date || p.target_date >= p.start_date, {
    message: "The target date can't be before the start date.",
    path: ["target_date"],
  });

export type ClientInput = z.infer<typeof clientSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;

/** Reads named text fields from FormData, using "" for missing ones. */
export function formFields<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")])) as Record<K, string>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a UUID such as a route `[id]`; anything else should be a 404. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}
