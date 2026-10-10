Dark Secrets Coffee — Phase 2 TEST checkout integration

This ZIP includes prepared customer checkout + Cloudflare Turnstile code.
The actual Place Order button remains DISABLED by default for safety.

Before enabling:
1. Verify the deployed Edge Function expects payload.items entries {name,packaging,quantity} and payload.pin {lat,lng}.
2. Add real server-side rate limiting / abuse protection to submit-order. CORS and Turnstile alone are not sufficient.
3. Set the PUBLIC site key in checkout-config.js. Never add the secret key to GitHub.
4. Verify Turnstile action order_submit and allowed hostname darksecretscafe.github.io.
5. Test with controlled orders and verify the admin dashboard.
6. Only then change enabled:false to enabled:true in TEST.

The existing admin.js and supabase-config.js are preserved unchanged.
The LIVE repository must not be updated with these files.
