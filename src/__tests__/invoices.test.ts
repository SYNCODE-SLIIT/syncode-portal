import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, colomboToday, invoiceBalance } from "../lib/domain.ts";
import { invoiceSchema, paymentSchema, requiredReasonSchema, settingsSchema } from "../lib/validation.ts";

const CLIENT_ID = "3f2b8c1e-5d4a-4b6f-9a1c-2e7d8f9a0b1c";

const baseInvoice = {
  client_id: CLIENT_ID,
  project_id: "",
  currency: "LKR",
  issue_date: "2026-10-30",
  due_date: "2026-11-13",
  discount: "",
  tax: "",
  notes: "",
  items: JSON.stringify([{ description: "Website design", quantity: "1", unit_price: "150,000" }]),
};

describe("Invoice dates and balances", () => {
  it("adds payment terms across month ends", () => {
    assert.equal(addDays("2026-10-30", 14), "2026-11-13");
    assert.equal(addDays("2026-12-25", 14), "2027-01-08");
  });

  it("reads today's date in Sri Lanka time", () => {
    // 20:00 UTC on 31 Oct is already 1 Nov in Colombo (UTC+5:30)
    assert.equal(colomboToday(new Date("2026-10-31T20:00:00Z")), "2026-11-01");
  });

  it("never shows a negative balance", () => {
    assert.equal(invoiceBalance(1000, 400.5), 599.5);
    assert.equal(invoiceBalance(1000, 1200), 0);
  });
});

describe("Invoice form", () => {
  it("accepts a valid invoice and reads amounts with commas", () => {
    const result = invoiceSchema.safeParse(baseInvoice);
    assert.ok(result.success);
    assert.equal(result.data.items[0].unit_price, 150000);
    assert.equal(result.data.project_id, null);
    assert.equal(result.data.discount, 0);
  });

  it("needs at least one line item", () => {
    const result = invoiceSchema.safeParse({ ...baseInvoice, items: "[]" });
    assert.equal(result.success, false);
  });

  it("rejects a due date before the invoice date", () => {
    const result = invoiceSchema.safeParse({ ...baseInvoice, due_date: "2026-10-01" });
    assert.equal(result.success, false);
  });

  it("rejects a discount larger than the subtotal", () => {
    const result = invoiceSchema.safeParse({ ...baseInvoice, discount: "200000" });
    assert.equal(result.success, false);
  });

  it("rejects a zero quantity and a missing price", () => {
    const zeroQty = JSON.stringify([{ description: "Hosting", quantity: "0", unit_price: "1000" }]);
    const noPrice = JSON.stringify([{ description: "Hosting", quantity: "1", unit_price: "" }]);
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, items: zeroQty }).success, false);
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, items: noPrice }).success, false);
  });

  it("rejects a zero total", () => {
    const free = JSON.stringify([{ description: "Consultation", quantity: "1", unit_price: "0" }]);
    assert.equal(invoiceSchema.safeParse({ ...baseInvoice, items: free }).success, false);
  });
});

describe("Payments", () => {
  it("accepts a past payment and rounds the amount", () => {
    const result = paymentSchema.safeParse({ amount: "75,000.456", paid_on: "2026-10-30", reference: "" });
    assert.ok(result.success);
    assert.equal(result.data.amount, 75000.46);
    assert.equal(result.data.reference, null);
  });

  it("rejects a zero amount and a future date", () => {
    assert.equal(paymentSchema.safeParse({ amount: "0", paid_on: "2026-10-30", reference: "" }).success, false);
    assert.equal(paymentSchema.safeParse({ amount: "100", paid_on: addDays(colomboToday(), 2), reference: "" }).success, false);
  });

  it("needs a reason to reject or void", () => {
    assert.equal(requiredReasonSchema.safeParse("  ").success, false);
    assert.ok(requiredReasonSchema.safeParse("Amount doesn't match").success);
  });
});

describe("Settings", () => {
  const base = {
    business_name: "Team SYNCODE",
    business_address: "1166 Park Road, Pannipitiya 10230, Sri Lanka",
    business_phone: "",
    business_email: "TEAM.syncode@gmail.com",
    bank_name: "",
    bank_branch: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_swift_code: "",
    invoice_prefix: "syn",
    payment_terms_days: "14",
  };

  it("normalises the prefix and email", () => {
    const result = settingsSchema.safeParse(base);
    assert.ok(result.success);
    assert.equal(result.data.invoice_prefix, "SYN");
    assert.equal(result.data.business_email, "team.syncode@gmail.com");
    assert.equal(result.data.payment_terms_days, 14);
  });

  it("rejects a prefix with symbols", () => {
    assert.equal(settingsSchema.safeParse({ ...base, invoice_prefix: "SY-N" }).success, false);
  });
});
