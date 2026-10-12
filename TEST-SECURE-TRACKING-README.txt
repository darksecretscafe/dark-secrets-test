DARK SECRETS COFFEE — DEV / TEST ONLY

This ZIP is a staged TEST frontend build based on the user's latest TEST repo upload.
It adds My Orders, private track.html, and secure checkout credential support.
Existing admin.html, admin.js, admin.css, admin-sw.js, push-config.js, and admin assets are unchanged.

DEPLOYMENT ORDER: Do not upload or deploy until coordinated with the updated DEV submit-order Edge Function. The current deployed function and new frontend must be switched together to avoid checkout failures.

1. Verify the updated DEV submit-order function uses create_customer_order_secure, accepts checkoutCredentialHash, and returns {order_number, tracking_token}. Preserve Turnstile and rate limiting. Do not deploy to LIVE.
2. Upload this frontend ONLY to the dark-secrets-test GitHub repository, in a coordinated TEST deployment window, then deploy updated DEV submit-order. Checkout may fail during the transition.
3. Run controlled real end-to-end DEV tests (new order, retry after a simulated lost response, My Orders, status changes, invalid token, and admin notifications). No test can guarantee production readiness.
4. Do not upload to LIVE or modify Admin PWA.

SECURITY NOTES:
- Checkout credentials are 32 cryptographically random bytes; only SHA-256 hash is sent to submit-order. Local browser stores raw credential and idempotency key for retries. Treat browser storage as sensitive.
- A fingerprint of the order payload is used to reuse the same credentials across retries/reloads. If the user changes the payload after a failed submission, a new order attempt is created. Avoid changes until status is confirmed.
- Private tracking token is stored in browser localStorage and placed in URL fragment. Anyone with the link can view order status. The tracking endpoint must return no customer PII.
- The existing track-order IP rate limit trusts x-forwarded-for; verify trusted proxy behavior before LIVE.
- The older create_customer_order_once RPC remains service-role callable; ensure no other publicly accessible function can disclose tracking tokens through it.
