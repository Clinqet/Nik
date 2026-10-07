# Carrier billing evidence — implementation-session re-research

Retrieved **1 October 2026** (pages fetched about 12:06 GMT). This is the fresh research the implementation prompt
requires; it does not replace `CARRIER-RESEARCH.md`, it records what was re-read today, what changed, and what is
still not published. **No carrier account, API key, purchase, release or support message was used or sent.** Every
account-specific fact below is still UNVERIFIED until the owner authorises read-only account calls or a written
carrier answer arrives.

Method: one research pass per carrier over official pages and the official Telnyx OpenAPI contract (commit
`e4130ae`, 2026-10-01T05:43Z), then the money-critical pages were fetched a second time independently by the
implementation session to cross-check the first pass.

## Telnyx — Canada / United States

### Established by official sources

| # | Fact | Source |
|---|---|---|
| T-1 | Number rental (MRC) is charged for the whole account at the **start of each calendar month**, in advance, deducted from the balance. No source mentions purchase-anniversary billing | support 4425088 "Guide to Billing Cycle"; support 8648864; Terms §4.2 |
| T-2 | A **one-time fee is separate from the monthly rent**. The cart shows an Upfront Cost (one-time activation) and a Monthly Cost per number; the order total is deducted at purchase; orders are final | support 4380325 |
| T-3 | Deleting a number stops FUTURE monthly charges | support 4380325 "How do I delete a number?" |
| T-4 | A deleted number is **held on the account for about 15 days** and can be re-purchased; a re-purchase carries a prorated monthly charge. A search returns your own recently deleted numbers unless `filter[exclude_held_numbers]` is set | support 4380325; number-search guide |
| T-5 | The owned-number resource has **no next-renewal, next-billing or price field**. It has `purchased_at`, `created_at`, `activated_at`, `billing_group_id`, `deletion_lock_enabled`, `status` | OpenAPI `PhoneNumberDetailed`; retrieve-a-phone-number |
| T-6 | `DELETE /v2/phone_numbers/{id}` is documented as synchronous (HTTP 200, `status: deleted`). A number with `deletion_lock_enabled` cannot be deleted through the API | OpenAPI; delete-a-phone-number |
| T-7 | `POST /v2/number_orders` has **no maximum-price parameter and no idempotency key**. Telnyx's own reliability guide says not to auto-retry a timed-out purchasing POST and to reconcile first | create-a-number-order; command-retries guide |
| T-8 | An order can carry a `customer_reference`, and `GET /v2/number_orders` filters on `filter[customer_reference]` — a carrier-side handle to find out whether a timed-out order was placed | list-number-orders |
| T-9 | A number reservation lasts 30 minutes (extendable once by 30) and gives exclusivity only; price is never mentioned | number-reservations guide |
| T-10 | Search results carry `cost_information { upfront_cost, monthly_cost, currency }`, all strings. Terms §4.1 price in USD unless agreed otherwise; invoices are USD | OpenAPI; Terms; support 6987563 |
| T-11 | Charges already incurred can be read back per number: `GET /v2/charges_breakdown` (MRC and one-time lines per number, 31-day window, end date exclusive), `GET /v2/charges_summary`, `GET /v2/balance` | OpenAPI |
| T-12 | Public list price for a standard local number (US "Direct Inward Dial", CA "Canada Direct Inward Dial"): **$1.00 per month plus $1.00 one-time**. A second Canadian row lists $0.35 per month plus $1.00 one-time. These are list prices, not a quote for a particular number | `api.telnyx.com/v2/pricing/products/global-numbers`; telnyx.com/pricing/numbers |
| T-13 | Taxes and regulatory fees are deducted daily, separately from rent. Optional per-number features cost extra each month (E911 $1.50, CNAM $0.40, SMS capability $0.10) | support 6420959; price list |
| T-14 | Terms allow an automatic 8% yearly fee increase unless Telnyx says otherwise in writing | Terms |

### Not published — must not be assumed

| # | Open fact | Safe behaviour until answered |
|---|---|---|
| T-A | The time of day and timezone of the start-of-month charge, and the latest moment a deletion still avoids it | Treat the boundary as the earliest possible start of the 1st (UTC+14) and return 24 hours before that |
| T-B | Whether a NEW mid-month purchase is prorated, and by what formula (proration is stated only for re-purchase) | Budget a full month at purchase |
| T-C | Whether deleting mid-month credits any rent | Budget no credit |
| T-D | Whether re-purchasing our own held number charges the one-time fee again | Exclude held numbers from automatic search |
| T-E | Whether the price charged always equals the `cost_information` last seen, and how long a search result stays orderable | Re-quote immediately before ordering, verify the charge afterwards, cap the day's orders |
| T-F | Which price row applies to an ordinary Canadian local number | Use the per-number `cost_information`, never the list |
| T-G | The error returned when deleting a locked number; whether DELETE is always synchronous | Confirm removal by a successful owned-number read |

### Conflicts between official Telnyx sources

Hold length (15 days versus two weeks plus two weeks of "aging"); order status values (the contract lists three,
the guide five); reservation status names; two Canadian price rows; `purchased_at` described differently in two
schemas. None changes a decision above; each is handled by reading the live value rather than a documented one.

## Plivo — India

`help.plivo.com` (the new help centre) needs a console login and was not read. Three of the sources that state the
renewal model most plainly have been taken down by Plivo and survive only in the Internet Archive; they are
marked "archived" and are evidence of past behaviour, not of today's.

### Established by official sources

| # | Fact | Source |
|---|---|---|
| P-1 | The owned-number resource exposes `added_on` ("Date rented", `YYYY-MM-DD`) and `renewal_date` ("Next billing date", `YYYY-MM-DD`), per number. The list accepts `renewal_date` filters (`__gt`, `__gte`, `__lt`, `__lte`); page size maximum 20. DELETE returns 204 with no body | plivo.com/docs/numbers/account-phone-numbers |
| P-2 | Rental is charged "on a calendar-month basis starting from the date of purchase"; numbers removed mid-month are billed for the full month. Terms §5.3: fees once paid are non-refundable | billing-concepts; plivo.com/legal/tos (updated 29 Apr 2026) |
| P-3 | Search and owned-number rates (`setup_rate`, `monthly_rental_rate`) are described as USD and carry **no currency field**. The buy call accepts `app_id`, `compliance_application_id`, `cnam_lookup`, `subaccount` — **no price limit and no idempotency key**. Buying needs main-account credentials | plivo.com/docs/numbers/phone-numbers |
| P-4 | The India price page lists Domestic Numbers (Voice, SIP Trunking) at **₹200.00 per month**. Archived captures to 16 March 2026 showed ₹250 — the list price changed within six months. No setup-fee row is shown | plivo.com/phone-numbers/pricing/in; archive |
| P-5 | India numbers can be rented only by an India-registered business on an India data-region account, with a compliance application in `accepted` status. Without one the buy call returns 400. **Plivo states that a reseller needs a separate compliance application per end customer** | docs/numbers/rent-india-numbers; docs/numbers/compliance |
| P-6 | India accounts are INR only and **cannot use auto-recharge**; they are funded manually (card minimum ₹2,000 with a 2% fee; netbanking minimum ₹10,000). 18% GST applies to invoiced amounts | faq payments; faq taxes |
| P-7 | No per-number rental ledger API exists. The Usage Summary API returns one aggregate "Number Charges" row with `meta.currency`; invoices are console-only | docs/account/api/usage-summary; faq invoices |
| P-8 | An account-wide monthly usage limit exists; when it is reached API requests fail with 403 until it is raised or the calendar month resets (UTC) | docs/voice/concepts/account-limits |
| P-9 (archived) | From 14 April 2023 the full monthly fee is deducted on the rental day and on the same date each following month; numbers rented earlier keep renewing on the 1st. Worked examples: rented 31 March → renews 30 April → the 30th thereafter; rented 31 January → 28 February → the 28th thereafter | archived changelog (capture 2024-07-21); archived support article 360041830391 (capture 2025-08-05) |
| P-10 (archived) | An unrented number is reserved for five days, then returned to the carrier; reclaiming it is charged like a new purchase | archived support articles (2024–2025) |

### Not published — must not be assumed

| # | Open fact | Safe behaviour until answered |
|---|---|---|
| P-A | Whether an INR account receives `monthly_rental_rate`, `setup_rate` and `cash_credits` in rupees or dollars | No automatic purchase on the India stamp; never relabel the number as INR |
| P-B | Time of day and timezone of the renewal charge; how late an unrent still avoids it | Earliest possible start of `renewal_date` (UTC+14), minus the 24-hour lead |
| P-C | What happens to a number when the balance is short at renewal | Balance monitoring and a manual-funding alert |
| P-D | Today's month-end and 29 February rule | Read `renewal_date` after every renewal; never compute it |
| P-E | Whether India numbers carry a setup fee; whether GST is debited with the ₹200 or at invoice | Read `setup_rate` per number; show tax as separate and unknown |
| P-F | Whether the monthly usage limit also blocks the unrent call | Alert well before the limit; treat a 403 on unrent as an incident, never as "returned" |
| P-G | Whether one number may be moved between end businesses under a single compliance application | No automatic pool reuse across businesses on the India stamp until answered |
| P-H | Whether a purchase that returns `pending` is already charged | Track it as owned and rented |

### Conflicts between official Plivo sources

The live billing sentence ("calendar-month basis starting from the date of purchase") is ambiguous; the explicit
anniversary rule exists only in removed pages. The docs' own example object shows `added_on` 2023-02-14 with
`renewal_date` 2023-05-10 — different days of the month. API rates are described as USD while India accounts are INR
only. KYC documents are "any one of" on one page and "both" on another. The separate Plivo CX billing article now
redirects to the login-only help centre, and the main console lives at `cx.plivo.com`, so the product boundary
itself needs written confirmation.

## Account evidence — read-only calls, 1 October 2026, about 12:30 UTC

The owner authorised read calls against both sandbox accounts on 1 October 2026 ("you can call their APIs for the
get and all — just do not purchase"). **Only HTTP GET was used. Nothing was purchased, reserved, released or
changed.** Keys were read from the tracked API `appsettings.json` inside the script and never printed. Raw responses
were held in the session scratchpad and deleted after this section was written; phone numbers are shortened here.

### Telnyx account (Canada / US)

| # | Observation | What it settles |
|---|---|---|
| TA-1 | Search, Canada, local, 25 results: every one `monthly_cost 1.00000`, `upfront_cost 1.0000000`, `currency USD`. Toronto (10 results): the same. **Hamilton (10 results): nine at 1.00 a month and ONE at 2.00 a month, same locality, same one-time fee** | The one-time fee is real on this account (T-12). Price varies per number inside one locality, so the cap must be checked per number (T-F) |
| TA-2 | Search, United States, no type filter: 14 of 25 results were toll-free numbers at **40.00 a month with a 500.00 one-time fee**; with `filter[phone_number_type]=local` all 25 were 1.00 + 1.00 | Every automatic search must ask for local numbers only, and the cap must hold even so |
| TA-3 | Search by area code 905, by `starts_with 905`, and by locality New York: **HTTP 400, code 10031 "No numbers found for the given filters. Please try again with best_effort=true"**. Search by locality Hamilton or Toronto: 200 | "No inventory" arrives as a 400, not an empty list. Area-code search can find nothing while locality search succeeds |
| TA-4 | Charges, May 2026: toll-free number bought 13 May → `otc numbers -1.00000` and `partial-mrc numbers -0.61290` (19 of 31 days) | **The first month IS prorated by day, purchase day included, on this account** (T-B). The one-time fee is charged in full |
| TA-5 | Charges, July 2026: local number with `purchased_at 2026-07-01T00:20:46Z` → one-time 1.00 and a FULL month 1.00 in July, nothing in June | The month boundary this account bills on is at or very near 00:00 UTC, not a North-American timezone (T-A) |
| TA-6 | Charges read at 12:35 UTC on 1 October for the single day 1 October: the October rent for both owned numbers had already posted | The monthly charge runs early on the 1st (UTC). A return must be complete before the month ends in UTC (T-A) |
| TA-7 | April 2026: the account's first number shows one-time 0.00 and partial rent 0.00 | A first-number promotion existed; it is not a rule to budget on |
| TA-8 | `GET /v2/balance`: balance **−2.53 USD**, credit limit 5.00, available credit 2.47. Auto-recharge is **disabled** | The account is running on its credit line. Telnyx documents that a balance negative for a month leads to numbers being deleted |
| TA-9 | Owned: one Canadian local number and one toll-free number, both `deletion_lock_enabled false`; order history carries no `customer_reference` | Today's orders cannot be found by reference; the new flow must set one |

### Plivo account (India)

| # | Observation | What it settles |
|---|---|---|
| PA-1 | Owned India numbers report `monthly_rental_rate "2.50000"`. Usage Summary for the same account reports `currency INR` and a "Number Charges" line of **236 per number per month** (200 + 18% GST); before August it was 295 (250 + GST) | **The API's rate field is NOT rupees** (P-A). The real charge is ₹200 plus GST. Today's adapter would read 2.50 as ₹2.50 and pass any ceiling |
| PA-2 | Number added 2026-06-30: charged on 30 June, 30 August, 30 September; `renewal_date` now 2026-10-30. Number added 2026-09-01: charged 1 September (full month at purchase) and 1 October; `renewal_date` now 2026-11-01 | Renewal is per number on the purchase-day anniversary, a full month is charged at purchase, and `renewal_date` is the next charge date (P-9 confirmed for this account) |
| PA-3 | At 12:32 UTC on 1 October the 1 October renewal had already been charged and sat in the usage bucket for the UTC day 1 October; the 30 September renewal sat in the UTC day 30 September | The renewal charge runs inside the UTC day of `renewal_date`, before about 12:30 UTC (P-B). An India-midnight run would have landed in the previous UTC day. The hour is still not shown: hourly granularity returns the same day buckets for this line |
| PA-4 | Search, India: 5,060 numbers; `type fixed`, `sub_type local`; all first-page results Mumbai (022); pattern 80 returns 595 Bangalore numbers; pattern 79 (Ahmedabad) and a city filter return none. Every result: `monthly_rental_rate 2.50000`, `setup_rate 0.00000` | No setup fee in India (P-E). Inventory exists for a few cities only |
| PA-5 | One compliance application, status `accepted`, in the name of the platform's own company; both owned numbers are attached to it | Numbers are rented under the platform's own KYC. Plivo's "separate application per end customer" rule for resellers (P-5) is therefore an open compliance question, not a technical one |
| PA-6 | Account: `billing_mode prepaid`, `auto_recharge false`, `timezone UTC`, `cash_credits 4.30674` (unit not stated; the API documents it as USD) | Manual funding only. The next renewal (30 October, ₹236) needs the balance checked in the console |

### What the account evidence changes

- T-A, T-B and T-F are answered for this account by observation; P-A, P-D (for the 30th and the 1st), P-E are
  answered. T-C, T-D, T-E, P-B (exact hour), P-C, P-F, P-G, P-H remain open and stay on the conservative path.
- Observation is not a written carrier commitment. The conservative return deadline is kept; the evidence says it
  is safe, not that it can be shortened.
