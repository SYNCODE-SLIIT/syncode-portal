# Supabase & Vercel setup

One-time configuration for the SYNCODE Client Portal. Do these in order.
Supabase project: `rtehtwauklndjxxtkgfk` (Mumbai).

## 1. Database

Supabase dashboard → **SQL Editor** → New query. Paste and run each file in `supabase/migrations/`, oldest first:

1. `20261027000001_initial_schema.sql`
2. `20261029000001_grants_and_security_fixes.sql`
3. `20261030000001_staff_only_fields.sql` (moves internal notes and repository links to staff-only tables)

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

**Authentication → Emails → Templates.** Replace the link in two templates so sign-in works on any device (the default links don't work with server-side sign-in).

**Magic Link**, subject `Your SYNCODE Client Portal sign-in link`:

```html
<h2>Sign in to the SYNCODE Client Portal</h2>
<p>Click the button below to sign in. The link expires in 1 hour and can be used once.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

**Invite user**, subject `You're invited to the SYNCODE Client Portal`:

```html
<h2>Welcome to the SYNCODE Client Portal</h2>
<p>Team SYNCODE has invited you to the client portal, where you can follow your projects, updates and invoices.</p>
<p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">Accept the invitation</a></p>
```

The app always sends a redirect URL that already contains `?`, which is why the templates start with `&`.

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
