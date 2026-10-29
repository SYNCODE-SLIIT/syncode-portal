import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeHtml, renderEmail, renderEmailText } from "../lib/email/layout.ts";

const content = {
  eyebrow: "New comment",
  heading: 'Comment on "Logo <update>"',
  greetingName: "Nimal Perera",
  paragraphs: ["Line one\nLine two", "<script>alert(1)</script>"],
  buttonLabel: "Open",
  buttonUrl: "https://portal.teamsyncode.com/requests/1?a=1&b=2",
  reason: "You're receiving this because you submitted this request.",
};

describe("Notification emails", () => {
  it("escapes HTML in every dynamic value", () => {
    assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    const html = renderEmail(content);
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("Logo &lt;update&gt;"));
    assert.ok(html.includes('href="https://portal.teamsyncode.com/requests/1?a=1&amp;b=2"'));
  });

  it("greets by first name and keeps line breaks", () => {
    const html = renderEmail(content);
    assert.ok(html.includes("Hi Nimal,"));
    assert.ok(html.includes("Line one<br>Line two"));
  });

  it("has a plain-text version with the link", () => {
    const text = renderEmailText({ ...content, greetingName: null });
    assert.ok(text.startsWith("Hi there,"));
    assert.ok(text.includes("Open: https://portal.teamsyncode.com/requests/1?a=1&b=2"));
  });
});
