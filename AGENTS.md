# Two Forks Studio

Rules for anyone (including agents) changing this repo. The GitHub repo, Render service, and package name stay `Patty2330/gateway-web-co`.

## Stack

This is one Next.js app. The homepage is the Two Forks Studio marketing site. The free AI visibility check, the $10 report, and the $19/month watch live in the same app.

- Next.js (App Router), TypeScript, Tailwind, and shadcn/ui for the check.
- The marketing page keeps the original CSS in `styles.css` and the words in `_data/site.yml`.
- SQLite on your computer. Postgres when `DATABASE_URL` is set.
- Node.js 22 or newer.

## How to run and test

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:43123

```bash
npm test
```

Tests cover how answers are read, how the score is calculated, and that the website-fix copy names Two Forks Studio.

## Conventions

- Keep the marketing page looking like the current site. Change words in `_data/site.yml` when the offer changes. Do not restyle `styles.css` for a new campaign unless Jalen asks.
- The check sells Two Forks Studio's website build. Use the price and promise in `_data/site.yml` (right now: first 10 local clients, $500, paid only when the owner is happy). The full report is $10 (1000 cents). The $19/month watch stays as it is.
- The visibility check queries Perplexity, ChatGPT, and Gemini through Perplexity's Agent API (`POST https://api.perplexity.ai/v1/agent`) with a single `PERPLEXITY_API_KEY`. Keys come from the environment, never from the database or the git history.
- Email stays in the outbox unless both `RESEND_API_KEY` and `EMAIL_FROM` are set. Then send through Resend and record sent or failed. A send failure must not crash the request. The Pages demo has no API routes and must not send mail.
- Do not add a second component library.

## Git

- Never push to main.
- Always open a pull request.
- Work goes on a branch and PR, never a direct push to main. Code Reviewer must give a PASS with proof, then Web Chief merges (Jalen confirmed Nov 25, 2026).
- Never merge your own pull request.
- Never commit secrets. That includes `.env`, `.env.local`, API keys, and Stripe keys. `.env.example` lists the names only.

## Demo mode

If `PERPLEXITY_API_KEY` is missing, the check must still run from the form through the score, the locked report, checkout, and the contact note. Sample answers have to be labeled on the results page so nobody treats them as live. Live scores use Perplexity, ChatGPT, and Gemini through that one key.

## Lessons / corrections

- Work goes on a branch and PR, never a direct push to main. Code Reviewer must give a PASS with proof, then Web Chief merges (Jalen confirmed Nov 25, 2026).
- Public brand name is Two Forks Studio (Nov 25, 2026); keep internal repo/service names unchanged.
- All user-facing copy, pages, emails, reports, and docs must use **Two Forks Studio**. Never leave leftover `Gateway Web Co`, `gatewaywebco`, or `Red River Sites` in customer-facing text. Keep live GitHub repo URLs (`Patty2330/gateway-web-co`), live Render URLs (`gateway-web-co.onrender.com`), the GitHub Pages path `/gateway-web-co`, and deployment-sensitive internal identifiers (package name, Render service/database names, storage keys, source file names) unchanged. The live site is `https://twoforksstudio.com`. The contact email is `hello@twoforksstudio.com`. `EMAIL_FROM` stays env-var driven and should keep using `onboarding@resend.dev` until `twoforksstudio.com` is verified in Resend; do not hard-code `hello@twoforksstudio.com` as the from-address default. (Jalen / Web Chief naming consistency rule, Nov 27 2026; domain and inbox updated the same day).
- (Nov 25, 2026, from Jalen) No agent may call work done. Every branch or PR goes to Code Reviewer, which builds and tests it, checks it in a real browser, and gives a PASS with proof (commands, output, screenshots). Web Chief merges or shows Jalen only after that PASS.
- Use Perplexity's Agent API as the only AI path for the visibility check. Query Perplexity, ChatGPT, and Gemini with one `PERPLEXITY_API_KEY`. Do not add OpenAI or Google keys, and do not switch to `/chat/completions` or Orchestrator. (Jalen, Nov 25 2026; three-model upgrade Nov 27 2026).
- Add DATABASE_URL before PERPLEXITY_API_KEY. The daily cap and saved checks need a persistent database. On Render, turning on the Perplexity key without Postgres leaves rate limits on an ephemeral disk (QA review, Nov 25 2026).
- Cap Agent API concurrency at 2, pace live starts at about 1 QPS, and retry 429s and brief 5xx errors with backoff. A live three-model check (24 calls) has a hard 120-second wall-clock cap: abort in-flight requests at the deadline and return "The check didn't finish" if the completeness bar is not met (16/24 overall, and at least two models with 6 usable answers each; a one-model or older 8-answer record still finishes at 6/8). Never score or cache a scan below that bar. Any non-complete scan must be rejected by checkout (409) and must not consume the daily rate limit, aside from a small cap on unfinished retries. /api/health reports the database type as postgres or sqlite, without the URL (QA live-scan review, Nov 25 2026; three-model pacing updated Nov 27 2026).
- On Render, trust CF-Connecting-IP by default (RENDER=true). Cloudflare rejects a client-supplied value on public traffic (403, error 1000). Do not use the right-most X-Forwarded-For hop on Render; that is a proxy, and every visitor would share one bucket. X-Forwarded-For is only for local/dev. Only private-network callers can fake CF-Connecting-IP. Do not trust X-Real-IP. (Code Reviewer, PR #7, Nov 25 2026).
- Check proxy-header behavior against the real host's docs or a live echo before changing IP trust. (Code Reviewer, PR #7, Nov 25 2026).
- Keep input typed on /check before the page finishes loading. Do not remount the form in a Suspense fallback and wipe the business name. (Code Reviewer, PR #5 follow-up, Nov 25 2026).
- The "5 a day" / "enough free checks for today" message must mention that unfinished checks don't count. (Code Reviewer, PR #5 follow-up, Nov 25 2026).
- The Sample mode banner must not cover the header on a phone. Keep the banner in document flow, not sticky over the nav. (Code Reviewer, PR #5 follow-up, Nov 25 2026).
- Reset the daily free-check limit at midnight America/Chicago, not UTC. (Code Reviewer, PR #5 follow-up, Nov 25 2026).
- Retry sleeps must honor abort, so a cancelled check does not keep waiting on Retry-After. (Code Reviewer, PR #5 follow-up, Nov 25 2026).
- Reject website hosts like _.com and port 0. Underscores are allowed only in a label that also has a letter or digit, such as joes_pizza.com. (Code Reviewer, PR #5 follow-up, Nov 25 2026).
- Count IPv6 rate limits by the /64 prefix, and treat IPv4-mapped addresses (::ffff:1.2.3.4) as IPv4, so rotating the interface id cannot bypass the daily cap. (Web Tester, PR #7 follow-up, Nov 25 2026).
- Unfinished report PDF tests must reject "null / 100" and "null/100", not only 0/100. (Code Reviewer, PR #6/#7 follow-up, Nov 25 2026).
- Log only a short rate-limit bucket hash prefix on each scan request. Never log the raw client IP or RATE_LIMIT_SALT. (Web Chief, PR #7 follow-up, Nov 25 2026).
- When parsing IPv6 with an embedded IPv4 tail, keep the "::" compression marker. Addresses such as 64:ff9b::1.2.3.4 and ::1.2.3.4 must still group by /64. (Web Tester / Code Reviewer, PR #7 nits, Nov 25 2026).
- On Render, if CF-Connecting-IP is missing and the app falls back to the shared local bucket, log one warning with no IP in it, and throttle it if it repeats. (Code Reviewer, PR #7 nits, Nov 25 2026).
- Setting TRUST_CF_CONNECTING_IP=false on Render puts every visitor into one shared daily count. Say so in .env.example. (Code Reviewer, PR #7 nits, Nov 25 2026).
- The leads rate-limit (429) message reads exactly: "That's enough notes for today. Jalen at Two Forks Studio will see the ones you already sent." This replaces the earlier no-Jalen wording. Keep the button text "Send a note to Jalen". The contact email is `hello@twoforksstudio.com`. (Web Chief, Nov 25 2026; replaces Code Reviewer PR #7 nit; email updated Nov 27 2026).
- The public visual system is the Riverbend redesign (Concept B mark: `public/images/logo-riverbend-light.svg` on light surfaces, `logo-riverbend-dark.svg` on dark). Favicons and app icons must be generated from those Concept B SVGs, never from `logos/export/` (Concept A). Sample work cards must stay labeled as sample sites, not real clients. Keep the quote form on `/api/leads` and the AI check on `/api/scans` (or `/check` with prefilled inputs). (Web Chief / Creative, Nov 27 2026).
- AI Visibility Check must match possessives (`Appleton's` / `Appleton’s`), distinctive aliases (`Appleton HD`, `Appleton H-D`), and the submitted `websiteUrl` registrable domain in answer text or citation hosts (ignore `www.` / subdomains; never credit yelp.com / facebook.com / google.com unless that is the submitted site). Run `textIncludesName` on each raw list-item line, not only the split head. Log one short JSON line per question and per scan (provider, model, HTTP/error class, latencyMs, mentioned, rank) with no raw IPs, API keys, or prompt dumps. Bump `VISIBILITY_CACHE_VERSION` in `buildCacheKey` when matcher or provider behavior changes so old cached 0s are never reused. (Web Chief, Appleton Harley-Davidson 0-score fix, Nov 27 2026).
- `twoforksstudio.com` and `hello@twoforksstudio.com` are live. Keep metadata, JSON-LD, mailto links, and docs on that domain and inbox. Preserve `APP_URL` / `SITE_URL` / `NEXT_PUBLIC_SITE_URL` overrides so local dev and Render preview URLs still work. `EMAIL_FROM` is independent of the public contact address and must stay env-var only, with no code default, until the domain is verified in Resend. (Web Chief, Nov 27 2026).
- The AI Visibility Check Full Report price is **$10** (`1000` cents). The monthly watch stays $19 (`1900` cents). Do not change the $500 first-10 website offer or the $1,000 normal website price. Checkout uses inline `price_data.unit_amount`; there is no `STRIPE_*_PRICE_ID` env var. (Web Chief, Nov 27 2026).
- Render internal Postgres URLs (dpg-xxxx-a) use self-signed TLS. With PGSSL=require, do not verify the certificate for them (rejectUnauthorized false, or PGSSL_NO_VERIFY=1), or every connection fails, /api/health returns 503, and the deploy never goes live. Give the pg pool a connect timeout, never cache a failed store connection, and log the error code without the URL. (Web Chief, DATABASE_URL deploy, Nov 25 2026).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
