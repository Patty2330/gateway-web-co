# Gateway Web Co

One site for Jalen's Clarksville web business. The homepage sells the websites. The free AI visibility check is the lead magnet, and the $49 report and $19-a-month watch are the paid add-ons.

The marketing words live in `_data/site.yml`. The look lives in `styles.css`. The check asks Perplexity eight questions a customer would ask ("best plumber in Clarksville") and scores whether the business gets named.

## Run it on your computer

You need Node.js 22 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Leave the AI keys blank. The check runs in **sample mode** and the results page says so. The homepage, the free check, the locked report, the practice checkout, the PDF, and both contact forms all work without keys.

```bash
npm test
```

## What the pages are

| Page | What it is |
| --- | --- |
| `/` | The Gateway Web Co site: pricing, what's included, concepts, FAQ, and a quote form |
| `/check` | The free AI visibility check |
| `/scans/...` | The score, the top 3 fixes, and the locked or unlocked report |

The quote form and the "get it fixed" form on a report both save a lead in the database. Nothing is emailed until you connect a mail provider. See `src/lib/email.ts`.

## Sample mode and live mode

Leave `PERPLEXITY_API_KEY` blank and every answer is a labeled sample. Cost is $0. Set the key and the same eight questions go to Perplexity. That is the only engine.

The same business is reused for 24 hours so a refresh does not call Perplexity again. Each connection gets 5 new checks a day.

Copy `.env.example` to `.env.local`. The check needs `PERPLEXITY_API_KEY` (Agent API, model `perplexity/sonar`). Stripe test mode, Postgres, and the monthly cron secret are separate.

Stripe, without a secret key, opens a practice checkout that is labeled as a practice and does not charge a card. With `sk_test_...`, Checkout is real test mode. Card `4242 4242 4242 4242`.

## What a scan costs

A live scan asks Perplexity 8 questions. Sample mode is free. Prices below are from Perplexity's public rate card in November 2026. They move.

`perplexity/sonar` is $0.25 per million input tokens and $2.50 per million output tokens, plus $0.0025 per web search. Each question does one search. **One scan is about 3 to 8 cents.** Twenty different businesses in a day is roughly $0.60 to $1.60. Stripe's fee on a $49 card is about $1.72.

## Deploy on Render

GitHub Pages cannot run this app. It needs Node, and the database should be Postgres because Render's disk is wiped on every deploy.

1. Create a Render Postgres database and copy the internal URL into `DATABASE_URL`. Set `PGSSL=require`.
2. Create a web service from this repo. Build: `npm install && npm run build`. Start: `npm start`. The start script listens on `0.0.0.0` and `$PORT`.
3. Set `APP_URL` to the public https address. Add `PERPLEXITY_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `CRON_SECRET`. A `render.yaml` in this repo creates the web service and Postgres and wires `DATABASE_URL`.
4. Health check path: `/api/health`.
5. In Stripe, add a webhook at `https://YOUR-DOMAIN/api/stripe/webhook` for `checkout.session.completed`. Keep the test key until you mean to charge real cards.
6. Add a Render cron job that POSTs to `/api/cron/monitor` once a month with `Authorization: Bearer <CRON_SECRET>`.

The old GitHub Pages site was a Jekyll page at `https://patty2330.github.io/gateway-web-co/`. This app replaces that. After you merge and point a domain (or the Render URL) at it, turn GitHub Pages off so people are not looking at the old page.

`_data/site.yml` is still the place to edit the marketing words. A Render deploy picks up those edits.
