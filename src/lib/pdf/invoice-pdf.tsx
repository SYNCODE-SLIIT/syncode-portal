import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { InvoiceDetail } from "@/lib/data/invoices";
import { formatMoney, formatPortalDate, getInvoiceDisplayStatus } from "@/lib/domain";
import { INVOICE_STATUS_LABELS } from "@/lib/labels";

const INK = "#0a0a0a";
const MUTED = "#71717a";
const LINE = "#e4e4e7";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: INK, paddingBottom: 48 },
  header: { backgroundColor: INK, color: "#ffffff", paddingHorizontal: 40, paddingVertical: 28, flexDirection: "row", justifyContent: "space-between" },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 18, letterSpacing: 5 },
  headerMuted: { color: "#a1a1aa", fontSize: 8.5, lineHeight: 1.5, marginTop: 6 },
  label: { fontSize: 7.5, color: MUTED, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  number: { fontFamily: "Helvetica-Bold", fontSize: 18, marginTop: 4, textAlign: "right" },
  status: { fontSize: 8.5, color: "#d4d4d8", textAlign: "right", marginTop: 4 },
  body: { paddingHorizontal: 40, paddingTop: 28 },
  meta: { flexDirection: "row", marginBottom: 24 },
  metaCol: { flex: 1, paddingRight: 12 },
  metaValue: { marginTop: 3, fontSize: 10, lineHeight: 1.4 },
  bold: { fontFamily: "Helvetica-Bold" },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 5 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f4f4f5", paddingVertical: 7 },
  desc: { flex: 1, paddingRight: 10 },
  qty: { width: 40, textAlign: "right" },
  price: { width: 95, textAlign: "right" },
  amount: { width: 95, textAlign: "right" },
  totals: { marginTop: 16, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, color: "#52525b" },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, marginTop: 4, paddingTop: 6, fontFamily: "Helvetica-Bold", fontSize: 12 },
  balance: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f4f4f5", borderRadius: 4, padding: 7, marginTop: 6, fontFamily: "Helvetica-Bold" },
  box: { marginTop: 24, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 12 },
  bankRow: { flexDirection: "row", marginTop: 4 },
  bankLabel: { width: 95, color: MUTED },
  small: { fontSize: 8.5, color: MUTED, marginTop: 8 },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, textAlign: "center", fontSize: 7.5, color: "#a1a1aa" },
});

function InvoiceDocument({ detail }: { detail: InvoiceDetail }) {
  const { invoice, items, client, projectName, settings } = detail;
  const money = (value: number) => formatMoney(value, invoice.currency);
  const status = getInvoiceDisplayStatus(invoice.status, invoice.due_date);
  const balance = Math.max(0, Number(invoice.total) - Number(invoice.amount_paid));
  const bank = [
    ["Account name", settings?.bank_account_name],
    ["Account number", settings?.bank_account_number],
    ["Bank", settings?.bank_name],
    ["Branch", settings?.bank_branch],
    ...(invoice.currency === "USD" ? [["SWIFT code", settings?.bank_swift_code]] : []),
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <Document title={`Invoice ${invoice.number}`} author={settings?.business_name ?? "Team SYNCODE"}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>SYNCODE</Text>
            <Text style={s.headerMuted}>
              {[settings?.business_name ?? "Team SYNCODE", settings?.business_address, [settings?.business_email, settings?.business_phone].filter(Boolean).join("  ·  ")]
                .filter(Boolean)
                .join("\n")}
            </Text>
          </View>
          <View>
            <Text style={[s.label, { color: "#a1a1aa", textAlign: "right" }]}>Invoice</Text>
            <Text style={s.number}>{invoice.number}</Text>
            <Text style={s.status}>{INVOICE_STATUS_LABELS[status]}</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={s.meta}>
            <View style={[s.metaCol, { flex: 1.4 }]}>
              <Text style={s.label}>Bill to</Text>
              <Text style={[s.metaValue, s.bold]}>{client?.name ?? "Client"}</Text>
              <Text style={{ color: "#52525b", fontSize: 10, lineHeight: 1.4 }}>
                {[client?.address, client?.email, client?.phone].filter(Boolean).join("\n")}
              </Text>
            </View>
            <View style={s.metaCol}>
              <Text style={s.label}>Invoice date</Text>
              <Text style={s.metaValue}>{formatPortalDate(invoice.issue_date)}</Text>
              <Text style={[s.label, { marginTop: 10 }]}>Due date</Text>
              <Text style={s.metaValue}>{formatPortalDate(invoice.due_date)}</Text>
            </View>
            {projectName && (
              <View style={s.metaCol}>
                <Text style={s.label}>Project</Text>
                <Text style={s.metaValue}>{projectName}</Text>
              </View>
            )}
          </View>

          <View style={s.tableHead}>
            <Text style={[s.label, s.desc]}>Description</Text>
            <Text style={[s.label, s.qty]}>Qty</Text>
            <Text style={[s.label, s.price]}>Price</Text>
            <Text style={[s.label, s.amount]}>Amount</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={s.row} wrap={false}>
              <Text style={s.desc}>{item.description}</Text>
              <Text style={s.qty}>{Number(item.quantity)}</Text>
              <Text style={s.price}>{money(item.unit_price)}</Text>
              <Text style={s.amount}>{money(item.amount)}</Text>
            </View>
          ))}

          <View style={s.totals} wrap={false}>
            <View style={s.totalRow}>
              <Text>Subtotal</Text>
              <Text>{money(invoice.subtotal)}</Text>
            </View>
            {Number(invoice.discount) > 0 && (
              <View style={s.totalRow}>
                <Text>Discount</Text>
                <Text>- {money(invoice.discount)}</Text>
              </View>
            )}
            {Number(invoice.tax) > 0 && (
              <View style={s.totalRow}>
                <Text>Tax</Text>
                <Text>{money(invoice.tax)}</Text>
              </View>
            )}
            <View style={s.grandTotal}>
              <Text>Total</Text>
              <Text>{money(invoice.total)}</Text>
            </View>
            {Number(invoice.amount_paid) > 0 && (
              <View style={[s.totalRow, { marginTop: 4 }]}>
                <Text>Paid</Text>
                <Text>- {money(invoice.amount_paid)}</Text>
              </View>
            )}
            {invoice.status !== "void" && invoice.status !== "draft" && (
              <View style={s.balance}>
                <Text>Balance due</Text>
                <Text>{money(balance)}</Text>
              </View>
            )}
          </View>

          {invoice.status === "void" && (
            <View style={s.box}>
              <Text>This invoice was voided.{invoice.void_reason ? ` Reason: ${invoice.void_reason}` : ""}</Text>
            </View>
          )}

          {invoice.notes && (
            <View style={{ marginTop: 20 }} wrap={false}>
              <Text style={s.label}>Notes</Text>
              <Text style={{ marginTop: 3, color: "#52525b", fontSize: 10, lineHeight: 1.4 }}>{invoice.notes}</Text>
            </View>
          )}

          {bank.length > 0 && (
            <View style={s.box} wrap={false}>
              <Text style={s.label}>Pay by bank transfer</Text>
              {bank.map(([label, value]) => (
                <View key={label} style={s.bankRow}>
                  <Text style={s.bankLabel}>{label}</Text>
                  <Text style={s.bold}>{value}</Text>
                </View>
              ))}
              <Text style={s.small}>Please use {invoice.number} as the payment reference.</Text>
            </View>
          )}
        </View>

        <Text style={s.footer} fixed>
          {settings?.business_name ?? "Team SYNCODE"}  ·  www.teamsyncode.com  ·  Thank you for your business.
        </Text>
      </Page>
    </Document>
  );
}

export function renderInvoicePdf(detail: InvoiceDetail): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument detail={detail} />);
}
