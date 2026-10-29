import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceDetail } from "@/lib/data/invoices";
import { renderInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";

/**
 * Downloads an invoice as a PDF. Used by both admins and clients:
 * row-level security only returns invoices the signed-in user may see (clients never see drafts).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Please sign in", { status: 401 });

  const detail = await getInvoiceDetail(supabase, id);
  if (!detail) return new NextResponse("Not found", { status: 404 });

  const pdf = await renderInvoicePdf(detail);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${detail.invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
