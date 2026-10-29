import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  calculateInvoiceTotals,
  calculateLineItemAmount,
  calculateProjectProgress,
  formatInvoiceNumber,
  formatMoney,
  formatPortalDate,
  getInvoiceDisplayStatus,
} from "../lib/domain.ts";

describe("Business logic & domain rules (Master Plan Section 6 & 9)", () => {
  it("formats sequential invoice numbers cleanly (SYN-2026-0001)", () => {
    assert.equal(formatInvoiceNumber("SYN", 2026, 1), "SYN-2026-0001");
    assert.equal(formatInvoiceNumber("syn", 2026, 42), "SYN-2026-0042");
    assert.equal(formatInvoiceNumber("SYN", 2026, 10005), "SYN-2026-10005");
  });

  it("calculates weighted project progress from milestones accurately", () => {
    // Design (done, weight 1) -> 100%
    // Development (70%, weight 2) -> 140
    // Testing (not_started, weight 1) -> 0
    // Total = (100*1 + 70*2 + 0*1) / 4 = 240 / 4 = 60%
    const progress = calculateProjectProgress("auto", 0, [
      { status: "done", percent: 20, weight: 1 }, // 'done' always counts as 100%
      { status: "in_progress", percent: 70, weight: 2 },
      { status: "not_started", percent: 50, weight: 1 }, // 'not_started' counts as 0%
    ]);
    assert.equal(progress, 60);
  });

  it("respects manual progress mode when selected", () => {
    const progress = calculateProjectProgress("manual", 85, [
      { status: "not_started", percent: 0, weight: 1 },
    ]);
    assert.equal(progress, 85);
  });

  it("calculates invoice totals with exact cent precision (no floating-point drift)", () => {
    // Classic JS float trap: 0.1 + 0.2 = 0.30000000000000004
    assert.equal(calculateLineItemAmount(3, 19.99), 59.97);

    const totals = calculateInvoiceTotals(
      [
        { quantity: 1, unit_price: 125000.5 },
        { quantity: 2, unit_price: 15000.25 },
      ],
      5000.0,
      2500.0
    );

    assert.equal(totals.subtotal, 155001.0);
    assert.equal(totals.discount, 5000.0);
    assert.equal(totals.tax, 2500.0);
    assert.equal(totals.total, 152501.0);
  });

  it("derives overdue status only for sent or partially_paid invoices past due_date", () => {
    assert.equal(
      getInvoiceDisplayStatus("sent", "2026-10-10", "2026-10-27"),
      "overdue"
    );
    assert.equal(
      getInvoiceDisplayStatus("partially_paid", "2026-10-26", "2026-10-27"),
      "overdue"
    );
    assert.equal(
      getInvoiceDisplayStatus("sent", "2026-10-27", "2026-10-27"),
      "sent"
    );
    assert.equal(
      getInvoiceDisplayStatus("paid", "2026-10-01", "2026-10-27"),
      "paid"
    );
    assert.equal(
      getInvoiceDisplayStatus("draft", "2026-10-01", "2026-10-27"),
      "draft"
    );
  });

  it("formats LKR and USD currency and Sri Lanka dates per design guidelines", () => {
    assert.equal(formatMoney(125000, "LKR"), "LKR 125,000.00");
    assert.equal(formatMoney(1200.5, "USD"), "USD 1,200.50");
    assert.equal(formatPortalDate("2026-10-26"), "26 Oct 2026");
  });
});

describe("Database migration & RLS policy verification (Master Plan Section 6 & 7)", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261027000001_initial_schema.sql"
  );
  const sql = readFileSync(migrationPath, "utf8");

  const requiredTables = [
    "profiles",
    "clients",
    "projects",
    "project_members",
    "milestones",
    "project_updates",
    "feature_requests",
    "request_comments",
    "attachments",
    "invoices",
    "invoice_items",
    "payments",
    "notifications",
    "activity_log",
    "settings",
  ];

  it("defines all 15 required tables and enables RLS on every single table", () => {
    for (const table of requiredTables) {
      assert.match(
        sql,
        new RegExp(`create table if not exists public\\.${table}\\b`, "i"),
        `Missing CREATE TABLE for ${table}`
      );
      assert.match(
        sql,
        new RegExp(
          `alter table public\\.${table} enable row level security`,
          "i"
        ),
        `Missing ENABLE ROW LEVEL SECURITY for ${table}`
      );
    }
  });

  it("defines RLS helper functions is_admin(), is_staff(), and current_client_id()", () => {
    assert.match(sql, /create or replace function public\.is_admin\(\)/i);
    assert.match(sql, /create or replace function public\.is_staff\(\)/i);
    assert.match(
      sql,
      /create or replace function public\.current_client_id\(\)/i
    );
  });

  it("prevents clients from reading another client's data or internal updates/comments/drafts", () => {
    // Clients restricted to own client_id
    assert.match(sql, /client_id = public\.current_client_id\(\)/i);
    // Project updates restricted to visibility = 'client'
    assert.match(sql, /visibility = 'client'/i);
    // Request comments restricted to is_internal = false
    assert.match(sql, /is_internal = false/i);
    // Invoices restricted to status <> 'draft' for clients, and admin-only for staff
    assert.match(sql, /status <> 'draft'/i);
  });

  it("enforces database triggers for sequential invoice numbers, immutable sent items, and payment totals", () => {
    assert.match(sql, /create or replace function public\.next_invoice_number/i);
    assert.match(
      sql,
      /Line items of a sent or voided invoice cannot be modified/i
    );
    assert.match(
      sql,
      /create or replace function public\.recalculate_invoice_payments/i
    );
  });
});
