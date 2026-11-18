# Release — November 18, 2026

This document supersedes the pre-release blockers in FINAL-AUDIT.md where behavior has changed.

## Application

The existing interface and 108 listings are preserved. 104 are eligible for recommendations; Pennharmonics, Urban Gaming Club, Enactus and Happy Valley VC remain browsable on hold. Existence and recent activity remain separate. No new approved machine-readable Discover feed or API access was established in the bounded release check; CSV/JSON imports remain supported. A public involvement-fair PDF lists names but does not provide sufficiently complete records for unattended import.

Groq remains the only AI provider. Unknown IDs, held records, unsupported facts and undocumented logistics are rejected. One transient/schema/validation retry is allowed with exponential backoff and jitter inside one 25-second deadline. Authentication and quota errors are not retried. Provider failure returns useful, explicitly labeled deterministic catalog matching. HTTP request abuse still receives 429 rather than consuming unlimited service resources.

Production uses shared Upstash controls: 10 requests per IP per ten-minute window, 100 admitted quiz requests per UTC day by default, an atomic global AI admission interval of 65 seconds, and a hashed identical-request lease. Busy/duplicate requests receive non-AI results. No raw quiz answers or generated results are stored in Redis. Daily admitted requests may each invoke Groq at most twice. Local memory is used only outside Vercel. Missing/invalid/failed shared controls prevent all paid AI calls and return an explicit non-AI configuration notice.

## Required Vercel configuration

Use the single `club-sorting-hat-ai` project, connected to `Bhavya-1007/club-sorting-hat-ai-2`. Do not modify SetFlow projects.

Set these server-side variables for Production and Preview:

| Variable | Value |
| --- | --- |
| GROQ_API_KEY | Existing secret from local .env.local |
| GROQ_MODEL | openai/gpt-oss-20b |
| UPSTASH_REDIS_REST_URL | HTTPS REST URL from your Upstash Redis database |
| UPSTASH_REDIS_REST_TOKEN | Writable REST token from that database |
| AI_DAILY_REQUEST_LIMIT | 100 |
| AI_MIN_INTERVAL_SECONDS | 65 |

Get the two Upstash values from https://console.upstash.com after creating/selecting a Redis database. Use its REST URL and writable REST token, not the TCP connection URL or read-only token. Keep them in .env.local locally and Vercel's environment-variable settings remotely; never commit or paste secrets in chat. A Groq-enabled public launch requires the shared controls to pass the live check below.

Vercel framework: Other. Build: `node scripts/build.mjs`. Output: `dist`. Node: 24.x (22+ supported). Serverless functions live in `api/`; no frontend framework or production dependencies are required. Redeploy after changing environment variables.

## Release verification

```powershell
node --test
node --check app.js
node scripts/build.mjs
node --env-file=.env.local scripts/check-production.mjs --live
node scripts/smoke-release.mjs --url=https://YOUR-DEPLOYMENT --require-ai
```

The production check prints configuration names and pass/fail only. Its live Redis test uses one unique temporary key with expiry and deletes only that key. The HTTP smoke sends three synthetic profiles, checks catalog eligibility, simultaneous duplicate requests, secret-file denial and differing recommendations. It deliberately spaces profiles by 66 seconds. `--require-ai` fails if no live AI response succeeds; fallback must not be mistaken for activation. Use an authenticated browser to test protected previews.

Before promotion, verify the deployed quiz on desktop/mobile and inspect that project's runtime logs. Never treat mocked Redis tests as proof that real production Redis credentials work. If credentials are missing, the site remains usable through clearly labeled fallback, but full AI activation is incomplete.

Implementation references: https://upstash.com/docs/redis/features/restapi and https://vercel.com/docs/headers/request-headers . The Vercel-generated client IP header is trusted only on Vercel; local clients cannot bypass limits by supplying forwarded-IP headers.
