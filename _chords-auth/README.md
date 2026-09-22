# Chords authentication service

A Cloudflare Worker handles GitHub App sign-in and chart commits for https://vkonton.github.io/chords/. GitHub Pages still hosts the website, charts and audio. The Worker has no database, build-time credentials or public write endpoint.

## Setup

1. Deploy `worker.mjs` with the included `wrangler.jsonc` to the website owner's Cloudflare account.
2. Register a private GitHub App owned by `vkonton`. Homepage: `https://vkonton.github.io/chords/`. Callback: `https://<worker-host>/callback`. Disable webhooks. Request only repository Contents read/write and mandatory Metadata read. Keep user token expiration enabled. Install it only on `vkonton/vkonton.github.io`.
3. Set Worker secrets `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET` (at least 32 random bytes encoded as base64url). Use Wrangler secret commands or the Cloudflare dashboard; never commit secrets.
4. Set `AUTH_ORIGIN` in `chords/auth-config.mjs` to the Worker's HTTPS origin and publish the Pages changes.
5. Sign in from the live song page and verify an unchanged Save returns “Already saved on GitHub.” A changed save creates one commit on `master` and starts the existing Pages deployment.

## Boundaries

- Sign-in uses OAuth state, a Secure/HttpOnly/SameSite=Lax cookie and PKCE S256.
- The browser gets an AES-GCM encrypted session, not the GitHub token. The login return is bound to the initiating browser tab's random state; the fragment is removed immediately.
- The session expires within eight hours and is saved in `sessionStorage`, never persistent local storage. Logout revokes the underlying GitHub user token.
- API calls allow only the exact Pages origin and require a bearer session. The server allows only the owner `vkonton` and the explicit song chart path, validates notation, reads the current blob, checks the draft base and writes with that blob SHA.
- The app installation restricts GitHub permissions to the selected repository. The server additionally restricts writes to the known chart file. No repository workflows, permissions or settings can be changed by these routes.
- No request logging is enabled; do not log authorization headers, callback codes or session fragments.
- An ambiguous PUT failure is reconciled by reading the file, not by blindly repeating the write.

Run the Node tests from the repository root. GitHub and Cloudflare requests are mocked in tests; real credentials are never needed for local tests.
