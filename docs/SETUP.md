# Supabase & Vercel setup

One-time configuration for the SYNCODE Client Portal. Do these in order.
Supabase project: `rtehtwauklndjxxtkgfk` (Mumbai).

## 1. Database

Supabase dashboard → **SQL Editor** → New query. Paste and run each file in `supabase/migrations/`, oldest first:

1. `20261027000001_initial_schema.sql`
2. `20261029000001_grants_and_security_fixes.sql`
3. `20261030000001_staff_only_fields.sql` (moves internal notes and repository links to staff-only tables)
4. `20261031000001_invoices_and_payments.sql` (saves invoices in one step, locks sent invoices, keeps payment slips in the client's own folder)

All of them are safe to run again.

## 2. Sign-in settings

**Authentication → Sign In / Providers → Email**
- Turn **off** "Allow new users to sign up". People only join by invitation; admin invites still work.
- Keep the Email provider enabled.

**Authentication → URL Configuration**
- Site URL: `https://portal.teamsyncode.com`
- Redirect URLs (add all three):
  - `https://portal.teamsyncode.com/**`
  - `https://syncode-portal.vercel.app/**`
  - `http://localhost:3100/**`

## 3. Email templates

**Authentication → Emails → Templates.** The branded templates live in [`supabase/templates/`](../supabase/templates). For each row below, open the template in Supabase, set the subject, then replace the whole **Message body** with the contents of the file (open the file, select all, copy, paste).

| Supabase template | Subject | File |
|---|---|---|
| Invite user | `You're invited to the SYNCODE Client Portal` | `invite.html` |
| Magic link | `Your SYNCODE Client Portal sign-in link` | `magic-link.html` |
| Reset password | `Reset your SYNCODE Client Portal password` | `reset-password.html` |
| Change email address | `Confirm your new email address` | `change-email.html` |
| Reauthentication | `Your SYNCODE Client Portal verification code` | `reauthentication.html` |
| Confirm sign up | `Confirm your email for the SYNCODE Client Portal` | `confirm-signup.html` |

Notes:

- The invite and magic-link templates start their link with `{{ .RedirectTo }}&…` because the app always sends a redirect URL that already contains `?`. Don't change that to `{{ .ConfirmationURL }}`: the default links don't work with server-side sign-in.
- The other templates build their link from `{{ .SiteURL }}`, so keep **URL Configuration → Site URL** pointing at the live portal (change it to `https://portal.teamsyncode.com` once the domain is connected).
- Sign-ups are turned off, so "Confirm sign up" isn't normally sent; it's styled anyway so nothing ever goes out with the default look.
- A password reset signs the person in and opens their **Account** page, where they choose a new password.

## 4. Email delivery (Resend)

Supabase's built-in email only delivers to members of your Supabase organisation and is limited to a few emails per hour. Resend sends both the sign-in emails and the portal's notification emails from `portal@teamsyncode.com`.

**a. Verify the domain in Resend**

1. Create a free account at [resend.com](https://resend.com) with `team.syncode@gmail.com`.
2. **Domains → Add domain** → `teamsyncode.com`, region **Tokyo (ap-northeast-1)** (closest to Sri Lanka).
3. Resend shows 3–4 DNS records. In Namecheap: **Domain List → teamsyncode.com → Manage → Advanced DNS → Add new record**, one per Resend record:

   | Resend shows | Namecheap type | Namecheap "Host" |
   |---|---|---|
   | MX `send` → `feedback-smtp….amazonses.com`, priority 10 | **MX Record** (needs *Mail Settings* = **Custom MX**; if it currently shows *Email Forwarding* in use, check before switching, as that would stop the forwarding) | `send` |
   | TXT `send` → `v=spf1 include:amazonses.com ~all` | **TXT Record** | `send` |
   | TXT `resend._domainkey` → `p=MIGf…` | **TXT Record** | `resend._domainkey` |
   | TXT `_dmarc` → `v=DMARC1; p=none;` (optional, recommended) | **TXT Record** | `_dmarc` |

   Namecheap adds `.teamsyncode.com` itself, so type only the part shown in the Host column. Copy each value from Resend exactly. These records sit on the `send.` subdomain, so they don't affect the website or any existing email.
4. Back in Resend, click **Verify DNS records**. It usually turns green within 15 minutes (it can take a few hours).

**b. Notification emails (the portal)**

1. Resend → **API Keys → Create API key**, name `syncode-portal`, permission **Sending access**, domain `teamsyncode.com`.
2. Vercel → syncode-portal → Settings → Environment Variables → add `RESEND_API_KEY` with that key (Production and Preview). Also add it to `.env.local` for local testing. Never share or commit it.
3. Push any commit (or wait for the next one) so Vercel picks it up.

Until `RESEND_API_KEY` is set, notifications still appear in the portal's bell; only the emails are skipped.

**c. Sign-in and invitation emails (Supabase)**

Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**:

| Field | Value |
|---|---|
| Sender email | `portal@teamsyncode.com` |
| Sender name | `Team SYNCODE` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a Resend API key (you can create a second key just for Supabase) |

Then **Authentication → Rate Limits** → raise "emails sent per hour" (for example to 100).

## 5. Keys

- **Local:** add `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API Keys → secret key, `sb_secret_…`) to `.env.local`. Never commit it.
- **Vercel:** Project → Settings → Environment Variables → add the same `SUPABASE_SERVICE_ROLE_KEY` for Production and Preview, then redeploy.

## 6. First admin account

1. **Authentication → Users → Add user → Create new user**: your email, a strong password, tick "Auto Confirm User".
2. SQL Editor, replacing the email and name:

```sql
update public.profiles
set role = 'admin', client_id = null, full_name = 'Sachithra Wijesinghe'
where id = (select id from auth.users where email = 'you@example.com');
```

3. Sign in at the portal with "Use a password instead". You land on `/admin`, and can invite the team and clients from **Team**.
