import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/form-fields";
import { ClientForm } from "../client-form";

export const metadata: Metadata = {
  title: "New client",
};

// The admin layout checks the session; the create action re-checks it on submit
export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Clients" title="New client" description="Add a client business. You can invite its contacts next." />
      <ClientForm />
    </div>
  );
}
