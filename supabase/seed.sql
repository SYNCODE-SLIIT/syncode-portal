-- =============================================================================
-- SYNCODE Client Portal — Development Seed Data
-- =============================================================================
-- Safe to run multiple times (uses fixed UUIDs and ON CONFLICT DO NOTHING).
-- Note: Real client data is never hardcoded in production migrations per Rule 10.
-- =============================================================================

insert into public.settings (
  singleton_key,
  business_name,
  business_address,
  business_email,
  invoice_prefix,
  next_invoice_seq,
  payment_terms_days
)
values (
  true,
  'Team SYNCODE',
  '1166 Park Road, Pannipitiya 10230, Sri Lanka',
  'team.syncode@gmail.com',
  'SYN',
  1,
  14
)
on conflict (singleton_key) do nothing;
