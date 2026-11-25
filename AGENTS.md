# Gateway Web Co

Rules for anyone (including agents) changing this repo.

## Stack

This is one Next.js app. The homepage is the Gateway Web Co marketing site. The free AI visibility check, the $49 report, and the $19/month watch live in the same app.

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

Tests cover how answers are read, how the score is calculated, and that the website-fix copy names Gateway Web Co.

## Conventions

- Keep the marketing page looking like the current site. Change words in `_data/site.yml` when the offer changes. Do not restyle `styles.css` for a new campaign unless Jalen asks.
- The check sells Gateway Web Co's website build. Use the price and promise in `_data/site.yml` (right now: first 10 local clients, $500, paid only when the owner is happy). The $49 report and $19/month watch stay as they are.
- The visibility check uses Perplexity only. Keys come from the environment, never from the database or the git history.
- Email stays in the outbox unless both `RESEND_API_KEY` and `EMAIL_FROM` are set. Then send through Resend and record sent or failed. A send failure must not crash the request. The Pages demo has no API routes and must not send mail.
- Do not add a second component library.

## Git

- Never push to main.
- Always open a pull request.
- Never merge your own pull request. Jalen reviews and merges.
- Never commit secrets. That includes `.env`, `.env.local`, API keys, and Stripe keys. `.env.example` lists the names only.

## Demo mode

If `PERPLEXITY_API_KEY` is missing, the check must still run from the form through the score, the locked report, checkout, and the contact note. Sample answers have to be labeled on the results page so nobody treats them as live. The score uses Perplexity only.

## Lessons / corrections

- Use Perplexity as the only AI engine for the visibility check (Jalen, Nov 25 2026).
- Add DATABASE_URL before PERPLEXITY_API_KEY. The daily cap and saved checks need a persistent database. On Render, turning on the Perplexity key without Postgres leaves rate limits on an ephemeral disk (QA review, Nov 25 2026).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
