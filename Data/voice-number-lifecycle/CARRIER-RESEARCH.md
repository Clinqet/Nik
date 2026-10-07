# Carrier billing and acquisition research

> **1 October 2026 — superseded in part.** The owner's final decisions are in `DECISIONS-2026-10-01.md` and the design to build is `FINAL-DESIGN.md` (its section 14 lists what changed). Read those first; **where this file differs, they win.** This file stays for the detail they do not repeat.

**MANDATORY CARRIER RESEARCH — COST IS SUPER IMPORTANT. The implementation session MUST research official Telnyx (Canada/US) and Plivo (India) billing online AGAIN: first and subsequent charges, proration/refunds, renewal calendar, month-end/leap dates, billing cutoff/timezone and available renewal APIs. Resolve conflicting information against the exact product/account and primary documentation, using authorized read-only evidence and written carrier confirmation when needed; ask the owner rather than guess. Read CARRIER-RESEARCH.md and RENEWAL-AUTOMATION.md fully. Save verified evidence and conservative UTC deadlines in the proposed partition-scoped Cosmos design after itemized schema approval; return eligible unused numbers with a default 24-hour lead. No unverified financial automation or promised refund.**

Rechecked 1 October 2026, including the official Telnyx OpenAPI contract and current Plivo Numbers/billing documentation. Public documentation establishes the general policy; no authenticated account balances, contracts, invoices or rates were read. Sources below are primary carrier documentation. “Unknown” is intentional and must not be replaced with guessed financial facts.

## Direct answers

| Question | Telnyx | Plivo Voice/Numbers API |
|---|---|---|
| Renewal calendar | Monthly recurring charges occur at the start of each new month [T1] | Rental is billed from the rental date [P7]. Use each number’s `renewal_date`, including month-end handling [P2] |
| First purchase | Upfront and recurring prices are displayed and the order total is debited [T2]. Normal/prorated rental exists on invoices [T3], but the inspected sources do not establish a universal first-purchase proration formula | Monthly rental starts at purchase [P3, P7]; the historical official examples charge one full rental at purchase [P1]. Verify the actual India product/account receipt before launch |
| January 10 purchase: next rental | General policy points to February 1, not February 10 [T1] | February 10 is an illustrative expectation from rental-date billing, not a substitute for the actual owned-number renewal_date [P2, P7] |
| January 15 return: partial refund? | No public source inspected explicitly promises a refund for the unused remainder. Deletion stops recurring charges; repurchase can incur prorated charges [T2]. Budget **no refund** until account-specific confirmation | Current billing FAQ explicitly bills numbers removed mid-month for the full month [P3] |
| Does “park” stop rental? | No: the number is still owned; release is the relevant action | No: unused/inactive accounts still incur number rental [P4] |
| Does assignment to a new business reset rental? | No evidence of a new carrier purchase merely because Clinket changes its owner; preserve existing carrier rental facts | Same; read owned-number renewal_date, never derive it from Clinket reassignment |
| Do all 100 numbers renew together? | Normally yes under standard calendar-month MRC [T1] | Not necessarily. Per-number dates matter [P2, P7] |
| Price currency | Telnyx invoice guide says USD [T3]; acquisition quote supplies currency [T4] | Public acquisition API calls rental/setup values USD [P5]. Existing India adapter calls them configured INR. Must reconcile with this specific India account before launch |
| Exact daily charge cutoff/timezone | Not established by the inspected pages | `renewal_date` is a date, not a timestamp; cutoff/timezone not established [P2] |

**Do not use Plivo CX billing rules for this integration.** A separate Plivo CX article describes first-of-month prorated billing, while this code uses the Voice/Numbers API. The specific product/account and the actual renewal_date determine the policy. [P6]

## Consequences for the design

Keep a carrier-confirmed renewal date and the evidence’s granularity. Until the carrier confirms a cutoff timezone, convert the renewal date to the **earliest plausible boundary** using a conservative timezone range and subtract the configured safety lead. Show “renewal time unconfirmed” rather than inventing midnight UTC. Unknown date/currency removes a number from automatic allocation/return recommendations and opens manual reconciliation.

The current automated return lead is at least 24h before the conservative renewal boundary; see RENEWAL-AUTOMATION.md. This is an operational margin, not a carrier rule. It must cover timezone uncertainty, API latency/outage, live-call drain and human response. A request sent before renewal is not proof the carrier completed release before renewal. Track acknowledgement and confirm the number is absent from a successful account inventory read.

If Telnyx later confirms daily prorated refunds for release on this account, return idle numbers sooner when refund value exceeds reuse value. Until then, a no-refund cost assumption is conservative; it is not a factual claim that Telnyx never prorates release refunds.

**FIRST-PERIOD PRORATION IS NOT A CANCELLATION REFUND. Compare the configured monthly cap with the full normal recurring rental, never a discounted/prorated first charge. A US$2/month number does not qualify for a US$1 cap merely because today's partial charge is US$0.50. Forecast every renewal crossed during the trial and recovery hold, plus setup, enabled paid features and applicable fees.**

## Cost model

For each currency independently:

`new outlay = setup charges + first rental charges + rentals crossed while held + enabled paid features + usage + applicable taxes/fees`.

`next rental exposure = Σ recurring rental for numbers still owned at their individual next charge boundary`.

`avoidable next rental = Σ recurring rental for eligible idle numbers successfully returned before that boundary`.

Prepaid rent already incurred is sunk. Reuse is valuable only if safe and it avoids another acquisition or rental expense. Do not retain an otherwise useless number past renewal merely because its original month was paid.

Example assumptions: 100 numbers, each US$1/month, zero setup, tax and usage excluded. First-cycle rental up to $100. If 50 remain useful and 50 are confirmed returned before the next relevant boundary, up to $50 of the next cycle is avoided. This is **not a $50 refund**. A number removed from Clinket but still held at the carrier still costs $1 at renewal.

The revised design uses zero extra trial-only quarantine after the 24h recovery hold and 15 days for ended paid service. Both are configurable. Return an unused number before renewal even if quarantine has not ended; quarantine blocks reassignment, not carrier return. Shorter quarantine increases wrong-business-call risk and requires complete routing/context cleanup.

For a trial spanning two Telnyx calendar periods, plan for two rental charges even when each charge respects the $1 ceiling. For Plivo, an initial 14-day trial usually fits inside one monthly rental period, but acquisition history and the carrier renewal_date must confirm this. No launch forecast should assume first-month proration or refunds without account evidence.

## Search and purchase constraints

Telnyx supports country, locality/rate center, administrative area and area-code searches, and returns cost_information. A number must have appeared in a recent search before ordering; some numbers support a temporary reservation. Reservation eligibility is not proof that the price is locked. [T4]

Plivo exposes city/region/type/capability filters, setup/rental rates and regulatory restrictions. The documented search maximum is 20 results per page. Accepted compliance applications may be required for purchase; India documentation requires prior identity compliance. [P5, P7]

The current string-only search interface loses information needed to enforce these constraints. Proposed structured search output should carry the actual price/currency, location, voice capability, restriction status, quote time and carrier reference. Do not infer emergency/SMS features or buy paid add-ons merely because a marketing page says they are available.

**Strict price guarantee gap:** the inspected code orders by number/application, without a maximum-price condition. Requoting immediately reduces stale-price risk but is not an atomic carrier-enforced $1 promise. Before enabling automatic buying, verify a carrier price-binding contract, account-level purchasing control, or documented quote/order guarantee. If no such guarantee exists, disclose this limitation to the owner and keep automatic purchase disabled while permitting pool allocation/manual review. No unsupported API field or assumed idempotency key belongs in implementation.

## Account-specific confirmations before launch

| Confirmation | Evidence required | Safe behavior until resolved |
|---|---|---|
| USD vs CAD vs INR ceiling | Owner currency decision + carrier quote/invoice units for the exact account | No automatic buy in an unconfirmed currency |
| Telnyx mid-cycle release credit | Written carrier policy/account terms | Assume zero recoverable refund in forecast |
| Renewal timezone/cutoff | Carrier confirmation plus owned-number/report sample | Conservative early deadline, date-only label |
| Plivo month-end behavior | Actual renewal_date for month-end examples | Refresh actual date; never AddMonths from original purchase forever |
| Quote-to-order price binding | Documented contract/control | Auto-buy stays gated, not “guaranteed” by a fresh quote |
| India compliance and suballocation | Account’s accepted applications and end-business obligations | Manual provisioning when evidence unavailable |
| Exactly how an unknown purchase/delete is reconciled | Read-only API fixtures + sandbox contract verification | Unknown remains owned/claimed, no second buy or false release |
| Available local numbers at ≤US$1 | Live read-only account search at rollout | Manual fallback; public “from” pricing is not inventory |

No carrier purchase, release, provider message or Meta template submission was performed.

## Primary sources

- T1: [Telnyx monthly charges](https://support.telnyx.com/en/articles/4425088-reporting-monthly-charges).
- T2: [Telnyx search, buy, delete and restore](https://support.telnyx.com/en/articles/4380325-search-and-buy-numbers).
- T3: [Telnyx invoice overview](https://support.telnyx.com/en/articles/6987563-invoice-overview).
- T4: [Telnyx Number Search API guide](https://developers.telnyx.com/docs/numbers/phone-numbers/number-search/).
- T5: [Telnyx owned-number details](https://developers.telnyx.com/api-reference/phone-number-configurations/retrieve-a-phone-number).
- T6: [Telnyx number deletion](https://developers.telnyx.com/api-reference/phone-number-configurations/delete-a-phone-number).
- T7: [Telnyx order details](https://developers.telnyx.com/api-reference/phone-number-orders/retrieve-a-number-order).
- T8: [Telnyx official OpenAPI contract](https://raw.githubusercontent.com/team-telnyx/openapi/master/openapi/spec3.json), linked by its [documentation index](https://developers.telnyx.com/llms.txt). The inspected contract includes monthly charge summary/breakdown operations; these report incurred charges, not an exact future renewal timestamp.
- P1: [Legacy Plivo phone number charges link](https://support.plivo.com/hc/en-us/articles/360041830391-Plivo-Phone-Number-Charges) redirects to the numbers overview on final re-check. Historical day-clamping examples are therefore not treated as an authoritative current algorithm; use P2.
- P2: [Plivo account phone numbers API](https://www.plivo.com/docs/numbers/account-phone-numbers).
- P3: [Plivo billing concepts](https://www.plivo.com/docs/faq/billing-and-invoices/billing-concepts).
- P4: [Plivo number management FAQ](https://support.plivo.com/hc/en-us/sections/360008204892-General).
- P5: [Plivo search and buy API](https://www.plivo.com/docs/numbers/phone-numbers).
- P6: [Separate Plivo CX billing policy — do not substitute](https://support-cx.plivo.com/hc/en-us/articles/13822518738073-What-s-the-billing-cycle-for-phone-numbers).
- P7: [Plivo numbers overview and compliance](https://docs.plivo.com/docs/numbers).

## India rental cap and revised automation

Plivo lists domestic Voice SIP Trunking numbers at ₹200/month: https://www.plivo.com/phone-numbers/pricing/in/. Proposed India cap is INR200, subject to product/account currency validation; public API rental amounts are described as USD. Do not relabel those amounts INR. See [current return and configuration design](RENEWAL-AUTOMATION.md).

## Billing re-verification — 1 October 2026

**Confirmed recurring calendar, not confirmed exact charge instant.** Telnyx's [monthly charges guide](https://support.telnyx.com/en/articles/4425088-reporting-monthly-charges) specifies the beginning of each month. Its [purchase/delete guide](https://support.telnyx.com/en/articles/4380325-search-and-buy-numbers) says order totals are deducted from balance, deletion ends future MRC, and repurchase incurs prorated MRC. Its [invoice guide](https://support.telnyx.com/en/articles/6987563-invoice-overview) includes normal/prorated rent and one-time purchase charges. These do not establish a universal initial-purchase proration formula or unused-rent deletion refund. Do not infer either.

Plivo's [billing concepts](https://www.plivo.com/docs/faq/billing-and-invoices/billing-concepts) confirms monthly rental from purchase date and full-month charges for mid-month removal. Its [owned-number API](https://www.plivo.com/docs/numbers/account-phone-numbers) exposes date-only added_on and renewal_date. Historical indexed official support examples show March31→April30→30th thereafter and January31→February28→28th thereafter, but that old support URL redirects today; do not implement a permanent clamping algorithm or leap-year rule from the search cache. Refresh the actual next renewal_date instead.

**Rental renewal, invoice issue and balance recharge are THREE DIFFERENT events.** Plivo [invoices](https://www.plivo.com/docs/faq/billing-and-invoices/invoices) are generated on the first business day for the preceding month; that does not make every number renew on the first. Telnyx reports/invoices similarly must not substitute for carrier billing events.

[Telnyx account funding](https://support.telnyx.com/en/articles/4280500-billing-setup-billing-groups): configurable scheduled payments and threshold-based auto-recharge are separate from rental. Auto-recharge restores balance to threshold plus recharge amount, so a large rent debit can trigger a larger payment than the configured recharge amount. [Plivo payments](https://www.plivo.com/docs/faq/billing-and-invoices/payments): current documentation explicitly says auto-recharge is unavailable for India INR accounts; these need manual recharge. Do not apply USD auto-recharge behavior to India. Forecast low-balance exposure and alert before funding is exhausted; do not silently add an automatic money-transfer feature.

**Still requires written account-specific confirmation:** billing timezone and effective charge cutoff; when successful number deletion must complete to avoid renewal; Telnyx initial-rental proration and unused-rent credit; Plivo India account/product currency and renewal semantics. Ask each carrier: “For our exact account and domestic DID product, what timezone/cutoff applies to renewal, what timestamp proves release stopped the next rental, what happens for month-end/leap-year purchases, and are initial/final partial periods prorated? Please provide a sample per-number ledger and applicable documentation.” No support message has been sent. Read-only account evidence is needed; do not buy/delete a live number as a test without authorization.

The existing UTC hourly sweep and conservative earlier deadline remain the design. They reduce risk but do not turn unknown carrier timing into a verified exact timestamp or guarantee no charge during outages.

## Verified API use and evidence limits

| Carrier / region | Verified operations | What they can establish | What they do not establish |
|---|---|---|---|
| Plivo India Voice/Numbers | GET `https://api.plivo.com/v1/Account/{auth_id}/Number/`; GET and DELETE `https://api.plivo.com/v1/Account/{auth_id}/Number/{number}/` [P2] | Owned number, date-only `added_on`, next date `renewal_date`, rental rate. The list supports renewal-date filters and bounded pagination. DELETE unrents the number | An exact billing hour/timezone or a promised unused-period refund. API monetary units must be checked against the INR account |
| Telnyx Canada/US | GET `https://api.telnyx.com/v2/phone_numbers`; GET and DELETE `https://api.telnyx.com/v2/phone_numbers/{id}`; GET `https://api.telnyx.com/v2/number_orders/{number_order_id}` [T5–T8] | Ownership/status, carrier `purchased_at`, order status/time and deleted-number representation. Use the carrier number ID, not E.164, for the `{id}` route | No next-renewal date/time field was found in the inspected owned-number/order schemas. `purchased_at`, `activated_at` and order creation are different facts; none makes rental an anniversary cycle |
| Telnyx actual-charge reconciliation | GET `https://api.telnyx.com/v2/charges_breakdown`; GET `https://api.telnyx.com/v2/charges_summary` [T8] | Historical number charges and account totals for a date range, useful to reconcile first and subsequent charges. Ranges are limited to 31 days and the end date is exclusive | A binding quote, guaranteed refund or forward-looking exact renewal cutoff. Reports cannot replace pre-renewal scheduling |

**DO NOT INVENT A TELNYX RENEWAL API/FIELD. Use its verified standard first-of-month calendar policy plus confirmed account cutoff evidence. For Plivo use the actual owned-number `renewal_date`, refreshed after purchase and renewal. If a future API adds stronger evidence, reverify its contract and obtain approval for any required schema change.**

## Month-end and leap-year interpretation

The historical official Plivo support article (published April 2023, still indexed but redirected today) showed March 31 → April 30 → subsequent 30ths and January 31 → February 28 → subsequent 28ths. This warns that a shortened month may shift later renewals; it is not evidence to implement a perpetual original-purchase anniversary. The current documentation does not specify an exact leap-year algorithm. [P1, P2]

**NEVER GUESS WHETHER PLIVO WILL CHOOSE FEBRUARY 28, FEBRUARY 29, MARCH 28, MARCH 29 OR MARCH 31. Read and save its next actual `renewal_date` each cycle. Test 28/29/30/31-day dates and a changed anniversary with carrier fixtures; fixtures prove our handling of returned dates, not an undocumented carrier algorithm. Telnyx's standard first-of-month calendar naturally spans variable month lengths; never substitute purchase + 30 days.**

## Conflicting evidence and financial readiness

Public documentation is not always sufficient for this exact account. Examples: legacy Plivo invoice wording can imply first-day debits while its number documentation gives rental-date renewal; Plivo CX publishes a different calendar policy; India payment documentation specifies INR while generic Number API attributes say USD. Telnyx's proration examples establish repurchase, not every initial purchase or release credit. Record these differences rather than silently choosing the cheapest interpretation.

**WHEN SOURCES CONFLICT, confirm product, account, region, currency, effective date and applicable contract; compare current official API documentation with authorized read-only number/ledger/invoice evidence. Obtain written carrier confirmation for unresolved differences through an owner-authorized support request. Do not infer resolution from invoice issue date, bank-card recharge time, number country or the Function App region. Record the source, retrieval date, raw date/precision and resolution. Until resolved, block the affected automatic purchase/claim of exact timing, retain a conservative return deadline where a reliable renewal date exists, and raise an actionable incident for missing/conflicting dates. Never silently drop an owned number from monitoring.**

The implementation session must repeat this research and produce a per-account evidence checklist for: first-charge amount/proration, later renewal date, month-end/leap treatment, billing timezone and earliest effective charge boundary, deletion completion deadline, refund policy, number quote currency and enabled feature charges. Written confirmation and account evidence are readiness checks; this design has not sent support messages or accessed authenticated accounts.

**COST PROTECTION: confirmed carrier return before the next applicable boundary avoids future rental; it does not refund prepaid rental. Keep, assigned service, recovery holds, active-call drain and outages can prevent a return and incur a documented renewal. Warn and escalate those exceptions. Do not promise zero charges without evidence that the carrier completed release in time.**
