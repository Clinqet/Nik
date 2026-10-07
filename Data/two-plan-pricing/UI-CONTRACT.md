# Two plans — UI contract (backend already changed, 2026-10-04)

Read `PLAN.md` beside this file first. The backend changes below are DONE; every UI must match them.

## API contract changes

| Surface | Change |
|---|---|
| `SubscriptionTier` | Only `"Free"` and `"Premium"`. `"Basic"` and `"PremiumMax"` no longer exist anywhere. |
| `GET provider/billing/overview` | `isPromo` REMOVED. `founderOffer` REMOVED. `subscription.pendingTier` + `subscription.pendingSwitchEffectiveAt` REMOVED (no paid-to-paid switching exists any more: Free→Premium = subscribe, Premium→Free = cancel). `entitlements.badge` REMOVED. `entitlements.analyticsAdvanced` is now a **boolean**. `plans` has 2 rows (Free, Premium). |
| Plan prices | Premium: US$4.99 · C$5.99 · ₹299 per month. Yearly = "2 months free" (`annualPriceMinor` from the API; never hardcode). |
| `overview.plans[]` | NEW per plan: `leadsPerMonth`, `whatsAppPerDay`, `teamSeats` (number, or `null` = unlimited). Plan cards MUST show these numbers from the API (admin can change them) — never hardcode 5 / 10 / 200 / 50. |
| `GET analytics/insights` | `tier` is `"Free"` or `"Premium"` only (`"Max"` REMOVED). Premium receives EVERY metric (the old Max-only cards — lead funnel, time to bid, peak times, voice calls, unmet demand, 8-week trend, suggested price, avg response time — are now Premium). Free = profile views + locked teasers. Remove every "MAX" tag/badge. |
| `GET app-config` | `payments.sunsetAnnounceAtUtc`, `sunsetCutoverAtUtc`, `sunsetTrialDays` REMOVED. The whole sunset countdown banner feature is DELETED (web + mobile) with its keys. |
| `GET provider/billing/whatsapp-usage` | NEW `upgradeAvailable: boolean` — true only for a provider with a higher plan to move to (Free). Limit copy offers Premium ONLY when true; when false (Premium) say the limit resets tomorrow, never "upgrade"/"higher plans". |
| `GET business/broadcast/lead-usage` | NEW `upgradeAvailable` (same rule). Premium is unlimited ⇒ no meter. `cap: 0` is now real (no normal leads; rescue leads still arrive). |
| Leads inbox + lead detail | `access` gains `"LimitReached"`: a locked card (category + area only, like `Waiting`/`Missed`). The detail endpoint now RETURNS that locked card (200) instead of a 429 when the monthly limit is used. Bid / ask still return 429 `lead_quota_exceeded`. Show: "You've used this month's free leads — Premium opens every request" + "Unlock with Premium" (plan screen) or "Start free trial" when a trial offer is live. Members without `billing.read` see the text without the button. |
| Leads | Free providers now get requests 30 minutes after Premium (the server's `reachesYouAt` already says when). Any copy naming "Basic"/"Max"/"higher plans get new requests first" must say **Premium gets new requests first**. |
| Notifications | `NotificationType` values `SunsetAnnouncement`, `SunsetCutoverSoon`, `SunsetCutoverTomorrow`, `SunsetTrialStarted`, `SubscriptionUpgraded` REMOVED — delete from every client map (navigation, providerStateEvents, push handling, tests). NEW in-app/push `SystemNotification` with data `Type: "LeadQuotaReached"` (deep link `/dashboard/profile/plan-billing`, web; mobile → Plan & Billing). `SystemNotification` with `Type: "WhatsAppSendCapReached"` / `"WhatsAppPlanBlocked"` must also open Plan & Billing on mobile (today it opens nothing). |
| Customer badges | `ProviderBadge` `TopPro` and `Pro` REMOVED (a plan never buys a trust mark). Delete their chips, styles, keys (`badge.topPro`, `badge.pro`, `badge.meaning.topPro`, `badge.meaning.pro`; mobile `BADGE.TOP_PRO/PRO/MEANING_*`) and tests. |
| Customer homepage banner | Premium provider slides now arrive with `isPaid: true` ⇒ the existing "Sponsored" label shows. Make sure it renders clearly on web + mobile. |
| Customer search | NEW small "How results are ranked" link/info near the results (web + mobile, all 5 languages): opens a short explanation — "Results are ordered by how well they match your search, distance, ratings and reviews. Providers on Clinket Premium get a small boost." Plain words, no technical vocabulary. |
| Admin | `PLAN_TIERS` = `["Premium"]`; `MARKETPLACE_TIERS` = `["Free","Premium"]`; labels Free/Premium only (promo codes, trial offers, audiences). |

## Plan copy (provider apps)

Two cards, Free and Premium:
- **Free** — "Run your whole business, free": get found in search; bookings, calendar and invoices; customers in one place; get paid online; AI writing help; `{leadsPerMonth}` customer requests a month (and requests no one else can take); WhatsApp alerts `{whatsAppPerDay}` a day; team up to `{teamSeats}`.
- **Premium** — "Get every customer request, first" (marked recommended): every customer request, first in line; unlimited requests (when `leadsPerMonth` is null); featured on the Clinket homepage; higher in search; full Insights (busiest days, price comparison, lead funnel, peak hours, suggested price); WhatsApp up to `{whatsAppPerDay}` a day; team up to `{teamSeats}` people.
- Numbers in `{}` come from `overview.plans[]`; a `null` renders the "unlimited" wording.
No "Everything in Basic, plus". No "Top Pro" badge bullet (badges are gone). Plain words only (CLAUDE.md §0.20 — no technical words).

## Rules (non-negotiable)

- CLAUDE.md §24.1 UI DESIGN STANDARD: modern, house theme only, no large empty space, web fully responsive (phone/iPad/desktop), mobile uses native patterns, every state designed.
- Every string is a key in EVERY language file of that app (en, es, fr, hi, gu). Delete keys that are no longer used.
- No hardcoded prices; prices come from the API.
- Update/remove tests with the code; jest/vitest 100% pass; ESLint zero errors.
- Mobile mirrors web (provider web ↔ provider mobile; customer web ↔ customer mobile).
- Never `git checkout/restore/reset/stash/clean`; never commit. Leave no scratch files in the repo.
