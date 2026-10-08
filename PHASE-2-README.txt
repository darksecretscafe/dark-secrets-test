DARK SECRETS COFFEE - PHASE 2 ADMIN DASHBOARD (DEV ONLY)

New files:
  admin.html, admin.css, admin.js, supabase-config.js
Existing Phase 1 customer menu files remain unchanged.

1. Upload all ZIP contents to GitHub TEST repository (main/root).
2. In Supabase dashboard, locate Project URL and PUBLIC publishable/anon key.
3. Edit supabase-config.js placeholders. Only the PUBLIC key is allowed in GitHub.
   NEVER upload a secret key, service_role key, or database password.
4. Visit https://darksecretscafe.github.io/dark-secrets-test/admin.html
5. Sign in with the owner Auth account, not the database password.

IMPORTANT: This is a development scaffold. The customer checkout remains
UNDER CONSTRUCTION. No real orders are submitted. Do not share the admin URL
with customers. Hiding an admin URL is NOT security; Supabase RLS is essential.

Before production:
- Test authenticated admin SELECT and status UPDATE via real login.
- Test non-admin SELECT/UPDATE denied; remove any accidental public grants.
- Add server-enforced status transitions, immutable order data, and an
  admin membership check not inferred from an empty orders list.
- Build a secure order submission function with server-side prices.
- Test with dummy orders only; add rate limiting and abuse protection.
- Add backups, pagination, and monitoring.
