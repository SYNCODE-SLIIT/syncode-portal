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

## 4. Email delivery

Supabase's built-in email only delivers to members of your Supabase organisation and is limited to a few emails per hour. That's enough to test with your own address. Before inviting real clients, connect Resend (Phase 1 step 9): **Authentication → Emails → SMTP Settings**.

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
