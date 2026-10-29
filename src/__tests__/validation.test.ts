import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientSchema,
  featureRequestSchema,
  isUuid,
  milestoneSchema,
  projectSchema,
  projectUpdateSchema,
  quoteSchema,
} from "../lib/validation.ts";

const CLIENT_ID = "3f2b8c1e-5d4a-4b6f-9a1c-2e7d8f9a0b1c";

const baseProject = {
  client_id: CLIENT_ID,
  name: "Hotel booking website",
  type: "website",
  status: "planning",
  description: "",
  live_url: "",
  staging_url: "",
  repo_url: "",
  start_date: "",
  target_date: "",
  progress_mode: "auto",
  manual_progress: "",
  member_ids: [],
};

describe("Client form validation", () => {
  it("turns empty optional fields into null and lower-cases the email", () => {
    const result = clientSchema.parse({
      name: "  Hotel Seven Way ",
      business_type: "",
      email: " Info@HotelSevenWay.LK ",
      phone: "",
      address: "",
      notes: "",
      status: "active",
    });
    assert.equal(result.name, "Hotel Seven Way");
    assert.equal(result.business_type, null);
    assert.equal(result.email, "info@hotelsevenway.lk");
    assert.equal(result.notes, null);
  });

  it("rejects a missing name, a bad email and an unknown status", () => {
    const base = { business_type: "", phone: "", address: "", notes: "" };
    assert.equal(clientSchema.safeParse({ ...base, name: "", email: "", status: "active" }).success, false);
    assert.equal(clientSchema.safeParse({ ...base, name: "Valor", email: "not-an-email", status: "active" }).success, false);
    assert.equal(clientSchema.safeParse({ ...base, name: "Valor", email: "", status: "deleted" }).success, false);
  });
});

describe("Project form validation", () => {
  it("accepts a minimal project and defaults manual progress to 0", () => {
    const result = projectSchema.parse(baseProject);
    assert.equal(result.live_url, null);
    assert.equal(result.start_date, null);
    assert.equal(result.manual_progress, 0);
  });

  it("adds https:// to web addresses typed without it", () => {
    const result = projectSchema.parse({ ...baseProject, live_url: "www.valorclothing.lk", repo_url: "https://github.com/x/y" });
    assert.equal(result.live_url, "https://www.valorclothing.lk");
    assert.equal(result.repo_url, "https://github.com/x/y");
  });

  it("rejects addresses that aren't web links", () => {
    assert.equal(projectSchema.safeParse({ ...baseProject, live_url: "javascript:alert(1)" }).success, false);
    assert.equal(projectSchema.safeParse({ ...baseProject, staging_url: "not a url" }).success, false);
  });

  it("rejects a target date before the start date", () => {
    const result = projectSchema.safeParse({ ...baseProject, start_date: "2026-11-10", target_date: "2026-11-01" });
    assert.equal(result.success, false);
    assert.equal(projectSchema.safeParse({ ...baseProject, start_date: "2026-11-01", target_date: "2026-11-01" }).success, true);
  });

  it("requires manual progress to be a whole number from 0 to 100", () => {
    assert.equal(projectSchema.parse({ ...baseProject, progress_mode: "manual", manual_progress: "70" }).manual_progress, 70);
    for (const bad of ["150", "-5", "12.5", "abc"]) {
      assert.equal(projectSchema.safeParse({ ...baseProject, progress_mode: "manual", manual_progress: bad }).success, false, bad);
    }
  });

  it("rejects an invalid client or team member id", () => {
    assert.equal(projectSchema.safeParse({ ...baseProject, client_id: "abc" }).success, false);
    assert.equal(projectSchema.safeParse({ ...baseProject, member_ids: ["abc"] }).success, false);
  });

  it("recognises route ids", () => {
    assert.equal(isUuid(CLIENT_ID), true);
    assert.equal(isUuid("new"), false);
  });
});

describe("Milestone and update validation", () => {
  const base = { title: "Design", description: "", status: "not_started", percent: "", weight: "", due_date: "" };

  it("defaults weight to 1 and progress to 0", () => {
    const result = milestoneSchema.parse(base);
    assert.equal(result.weight, 1);
    assert.equal(result.percent, 0);
    assert.equal(result.due_date, null);
  });

  it("rejects out-of-range progress, zero weight and unknown statuses", () => {
    assert.equal(milestoneSchema.safeParse({ ...base, status: "in_progress", percent: "120" }).success, false);
    assert.equal(milestoneSchema.safeParse({ ...base, weight: "0" }).success, false);
    assert.equal(milestoneSchema.safeParse({ ...base, status: "blocked" }).success, false);
    assert.equal(milestoneSchema.safeParse({ ...base, title: "" }).success, false);
  });

  it("accepts fractional weights", () => {
    assert.equal(milestoneSchema.parse({ ...base, weight: "2.5" }).weight, 2.5);
  });

  it("requires update text and a known visibility", () => {
    assert.equal(projectUpdateSchema.safeParse({ body: "  ", visibility: "client" }).success, false);
    assert.equal(projectUpdateSchema.safeParse({ body: "Design is ready", visibility: "public" }).success, false);
    assert.equal(projectUpdateSchema.parse({ body: " Design is ready ", visibility: "internal" }).body, "Design is ready");
  });
});

describe("Request and quote validation", () => {
  it("requires a project, a title and some detail", () => {
    const ok = { project_id: CLIENT_ID, title: "Add a gallery page", description: "A page with our hotel photos.", priority: "normal" };
    assert.equal(featureRequestSchema.safeParse(ok).success, true);
    assert.equal(featureRequestSchema.safeParse({ ...ok, project_id: "" }).success, false);
    assert.equal(featureRequestSchema.safeParse({ ...ok, description: "short" }).success, false);
    assert.equal(featureRequestSchema.safeParse({ ...ok, priority: "urgent" }).success, false);
  });

  it("needs a price or hours, and reads amounts with thousands separators", () => {
    assert.equal(quoteSchema.safeParse({ estimate_hours: "", quote_amount: "", quote_currency: "LKR" }).success, false);
    const quote = quoteSchema.parse({ estimate_hours: "", quote_amount: "25,000.505", quote_currency: "LKR" });
    assert.equal(quote.quote_amount, 25000.51);
    assert.equal(quote.estimate_hours, null);
    assert.equal(quoteSchema.parse({ estimate_hours: "6", quote_amount: "", quote_currency: "USD" }).estimate_hours, 6);
  });

  it("rejects negative or non-numeric quotes", () => {
    assert.equal(quoteSchema.safeParse({ estimate_hours: "-1", quote_amount: "", quote_currency: "LKR" }).success, false);
    assert.equal(quoteSchema.safeParse({ estimate_hours: "", quote_amount: "abc", quote_currency: "LKR" }).success, false);
    assert.equal(quoteSchema.safeParse({ estimate_hours: "", quote_amount: "100", quote_currency: "EUR" }).success, false);
  });
});
