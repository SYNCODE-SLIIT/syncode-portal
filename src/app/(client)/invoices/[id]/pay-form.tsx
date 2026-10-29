"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPaymentAction } from "@/lib/actions/invoices";
import { MAX_SLIP_BYTES, SLIP_TYPES, safeFileName } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";
import type { CurrencyCode } from "@/lib/types/database";

const INPUT = "h-11 rounded-xl px-3.5";

/** Client form: upload a bank slip and say how much was paid and when. */
export function PayForm({
  invoiceId,
  clientId,
  currency,
  balance,
  today,
}: {
  invoiceId: string;
  clientId: string;
  currency: CurrencyCode;
  balance: number;
  today: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!file) {
      setError("Attach a photo or PDF of your bank slip.");
      return;
    }
    if (!SLIP_TYPES.includes(file.type) || file.size > MAX_SLIP_BYTES) {
      setError("Upload the slip as a JPG, PNG or PDF up to 5 MB.");
      return;
    }
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      // The slip goes straight to private storage; storage policies only allow this client's own folder
      const path = `${clientId}/${invoiceId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const upload = await createClient().storage.from("slips").upload(path, file, { contentType: file.type });
      if (upload.error) {
        setError("The slip couldn't be uploaded. Please check your connection and try again.");
        return;
      }
      const result = await submitPaymentAction(invoiceId, formData, { path, type: file.type, size: file.size });
      if (!result.ok) setError(result.error ?? "Could not send your payment details.");
      else {
        setNotice(result.message ?? "Payment sent.");
        setFile(null);
        formRef.current?.reset();
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <fieldset disabled={isPending} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount paid ({currency})</Label>
          <Input id="amount" name="amount" inputMode="decimal" defaultValue={balance.toFixed(2)} className={INPUT} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paid_on">Date paid</Label>
          <Input id="paid_on" name="paid_on" type="date" defaultValue={today} max={today} className={INPUT} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="reference">Bank reference (optional)</Label>
          <Input id="reference" name="reference" maxLength={120} placeholder="The reference number on your slip" className={INPUT} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="slip">Bank slip</Label>
          <label
            htmlFor="slip"
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 text-sm transition-colors hover:bg-secondary/50"
          >
            {file ? <Paperclip className="size-4 shrink-0" /> : <Upload className="size-4 shrink-0 text-muted-foreground" />}
            <span className={file ? "truncate" : "text-muted-foreground"}>{file ? file.name : "Choose a photo or PDF of the slip (max 5 MB)"}</span>
          </label>
          <input
            id="slip"
            type="file"
            accept={SLIP_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </fieldset>

      <FormMessage error={error} notice={notice} />

      <Button type="submit" disabled={isPending} className="h-10 w-full rounded-full px-6 text-sm font-semibold sm:w-auto">
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Send payment slip
      </Button>
    </form>
  );
}
