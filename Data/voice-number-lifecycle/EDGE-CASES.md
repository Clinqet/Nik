# Edge cases and cost boundaries

> **1 October 2026 — superseded in part.** The owner's final decisions are in `DECISIONS-2026-10-01.md` and the design to build is `FINAL-DESIGN.md` (its section 14 lists what changed). Read those first; **where this file differs, they win.** This file stays for the detail they do not repeat.

**MANDATORY CARRIER RESEARCH — COST IS SUPER IMPORTANT. The implementation session MUST research official Telnyx (Canada/US) and Plivo (India) billing online AGAIN: first and subsequent charges, proration/refunds, renewal calendar, month-end/leap dates, billing cutoff/timezone and available renewal APIs. Resolve conflicting information against the exact product/account and primary documentation, using authorized read-only evidence and written carrier confirmation when needed; ask the owner rather than guess. Read CARRIER-RESEARCH.md and RENEWAL-AUTOMATION.md fully. Save verified evidence and conservative UTC deadlines in the proposed partition-scoped Cosmos design after itemized schema approval; return eligible unused numbers with a default 24-hour lead. No unverified financial automation or promised refund.**

**Owner approved solution and mockup, 30 September 2026.** Read [final approved handoff](APPROVED-HANDOFF.md) first: any trial duration, historical regular billing even at zero dollars, national 10-digit entry, and existing admin queue integration. Itemized schema approval remains separate.

**Current revision:** [Renewal automation and owner-requested controls](RENEWAL-AUTOMATION.md) governs automatic returns, Keep, regional caps, country lock, configurable choices and protected approval history. Earlier manual-return/fixed-five review notes below are superseded where they conflict.

Owner-approved design contract. This complements the acceptance tests; it does not claim that current code implements these outcomes.

## Ownership, recovery and concurrency

| Situation | Required outcome |
|---|---|
| Browser and native submit together | Same request ID returns the original operation. Different IDs contend on one business slot; only one may reserve/buy. Never reserve every displayed suggestion |
| Provider leaves while a purchase is pending | Durable operation continues. Reopening resumes it. Closing the dialog is not cancellation of a carrier order |
| Cancellation before purchase starts | Cancel operation and release its known internal reservation atomically. No carrier mutation |
| Cancellation after purchase may have started | Reconcile first. If ownership is confirmed, track the asset and decide return/hold under policy. Do not discard the operation or refund a customer payment because a network response was missing |
| Price changes between quote and order | Require a verified price-binding mechanism for a strict automatic cap. Without it, automatic buying stays disabled. A fresh quote alone is not a mathematical guarantee |
| Two admins apply the same request | Operation/target/version compare allows one decision. Retry returns that decision; conflicting decision requires reload |
| Team member edits personal phone | Never overwrite business routing. Ownership transfer changes who can authorize future requests, not the current destination |
| Phone formatting changes but digits do not | Normalize first; no false request or duplicate audit event |
| Extension, short code, premium or Clinket destination requested | Reject with a localized reason before admin work; final admin mutation runs the same destination validation |
| Forwarding source belongs to another country | No guessed country from +1 or client input. Validate service country and verified metadata; otherwise manual review |
| Business suspended/closed during provisioning | Block activation and alert admin; finish ownership reconciliation so the asset is not lost. Detach/return follows explicit suspension/closure policy |
| Scope/carrier/account changes | No automatic move across partitions. Require approved migration, asset transfer and call drain. A profile edit cannot relocate rental ownership |
| Asset disappears at carrier | Successful complete inventory response proves absence; failed/partial page does not. Disable inconsistent binding, alert and notify affected business |
| Account low on funds or restricted | Stop new purchases, retain requests, alert once per scope/reason. No unapproved cross-currency/carrier failover |
| DID acquired but routing configuration failed | Keep owned asset and pending repair visible, including rent. Do not publish active or buy a replacement automatically |
| Return timed out | Keep unavailable/claimed. Reconcile ownership; do not mark returned from a timeout |
| Recovery while detach is running | Serialize through business slot and reread SQL. Cancel removal if not committed. If detached but still owned, preferentially restore to the same business through a new generation, subject to no conflicting return |
| Payment and carrier DELETE cross | Return claim excludes allocation/recovery mutations; recheck entitlement before DELETE. Payment after that check cannot be atomic with an external carrier. Reconcile immediately; never promise same-number retention without evidence. If release won, provision an eligible replacement without charging the provider for the internal repair and explain the change |
| DID goes to another business | Quarantine, drain calls, clear old runtime persona/caller identity/knowledge binding, create new generation. Late callbacks/retries cannot act on new owner. Quarantine reduces risk; it cannot guarantee nobody remembers a number |

## Billing and deadlines

| Situation | Required outcome |
|---|---|
| Regular plan expires while AI remains paid, or the reverse | Follow AI add-on entitlement for this number. Do not downgrade an unrelated plan |
| Card trial converts successfully | Normal renewal confirmation; no warning that removal is inevitable |
| Renewal declines into existing dunning | Apply existing grace decision, not no-card expiry shortcut. Show true deadline |
| Bank settlement pending | Defer removal within configured reconciliation bounds; escalate overdue unknown settlement without declaring success or unlimited free AI |
| 7/14/30-day or extended trial | Derive dates from SQL trial end; version/reschedule stale work. No magic day-15 branch |
| Trial ends before setup completes | Stop new purchase/activation without renewed entitlement. Reconcile in-flight purchase. Show actual dates; no silent trial reset or invented extension |
| Pause, private mode or exhausted minutes | No recycling: these are not billing lapse |
| Warning missed during worker outage | Send current factual status, not obsolete tomorrow copy. Do not extend the 24h hold for notification failure; recover overdue work and expose actual extra rent |
| DST, clock skew, month-end | UTC instants and injectable clock; business-local display. Keep carrier date-only precision separate; never model a month as 30 days |
| Accepted notice later bounces | Existing delivery feedback/suppression handles it. No infinite hold awaiting read receipt |
| Notification persistence or queue acceptance fails | Retry durable intent, do not falsely stamp sent. Escalate bounded failure and rental exposure |
| Paid cancellation takes effect | Respect paid-through service and completed dunning. Recommend same 24h number hold after effective end, with advance notice; label paid service, not trial |
| Legal/security hold | Exclude from automatic reuse/return; authorized resolution required. Show continuing monthly exposure |

## Rental arithmetic

Illustrations assume confirmed US$1 monthly rent, no setup and no refund. Taxes, calling, AI minutes, SMS, optional features and account minimums are excluded. These are not account quotes.

| Scenario | Implication and recommendation |
|---|---|
| Buy 100; return 50 before next renewal | First rental up to $100 is already incurred. Next cycle falls from $100 to $50. Report $50 potential next rental avoided, then reconcile actual charges |
| Keep those 50 idle past renewal | Another $50, even if parked. Return before deadline unless paid retention is justified |
| Trial-only versus paid-service expiry | Trial: 24h hold then default 0 extra days; paid: default 15 days after detach. Return before renewal during either quarantine. Converted trials use paid policy; unknown history requires review |
| Telnyx trial crosses month boundary | Two rental assessments may occur. $1/month is not $1 total trial cost |
| Pool has three weeks vs one week remaining, 14-day trial + one-day hold | Prefer three-week band, then locality; it covers the horizon |
| Only short-runway inventory exists | Compare incremental renewal exposure with new acquisition cost under approved budget. Neither pool nor new inventory can bypass funding rules |
| 0, 1, 3 or 100 eligible numbers | Show min(eligible count, configured limit), default 5; test limit 10. No fake fifth choice or unlimited search-refresh loop |
| Local costs $1.50, owned nonlocal costs $1 | Geography does not authorize overspend. Offer honestly labeled same-country option or custom request |
| INR quote with USD budget | No currency-free comparison or stale automatic FX. Unknown currency blocks buying; use the approved regional cap only after account currency validation |
| Manual release deadline missed | Another rental may occur. Escalate overdue; dashboard alone cannot guarantee zero renewals. Automatic return is approved; monitor missed runs and reconcile |
| First partial rental is below cap, full monthly rental is above cap | Reject the number. A small initial debit never authorizes a larger recurring obligation |
| Plivo purchase on 29/30/31, leap February or later anniversary drift | Consume the API's actual next date each cycle, preserve date-only precision, recalculate the early deadline. Do not invent a permanent clamping algorithm |
| Carrier renewal evidence changes to an earlier date | Update the same asset safely; if already past the target, make return immediately due and raise risk. A stale future job cannot hide the earlier charge |
| Telnyx owned-number API has no renewal field | Apply verified first-of-month account policy with cutoff evidence; do not invent a JSON field or use purchased_at + one month |
| Carrier date missing/conflicting, account currency ambiguous, invoice and rental wording differ | Durable incident, targeted read-only reconciliation and applicable written confirmation; gate affected automatic spending. Never quietly omit the rented asset or use invoice/recharge as renewal authority |
| Telnyx deletion lock, account access lost or changed number ownership | Alert immediately with deadline/cost, do not bypass protection or mark returned. Revalidate account/number/generation before remediation |
| Plivo India balance needs recharge | Monitor approved funding thresholds and alert for manual funding; do not assume USD auto-recharge exists on the INR account |

Consider incremental outlay and upcoming obligations. Daily acquisition caps do not cap recurring inventory rental. Track total currency-separated monthly exposure, committed rentals through trial/hold, idle days and overdue returns. Never add USD and INR into one saved amount.

## Flexibility

The owner confirmed that the allocation appsetting defaults off in lower environments and on in production, with deployment automation writing the environment value on create/update. Off means admin-led allocation only; lifecycle removal, quarantine, reconciliation and admin returns continue. An off transition before purchase routes the request to admin; an already-started or uncertain carrier order must still be reconciled. An on transition does not automatically buy numbers for old manual requests. See PLAN §4 for the complete switch contract.

Validated settings with region/account overrides cover currency/monthly/setup caps, total trial exposure, daily count/spend, request cooldowns, choice limit, quote freshness, reservation duration, concurrency, retries, pending-payment threshold, hold, quarantine, release margin and feature switches. Final setting names must match approved options/DI and ARM/deploy/local configuration.

Fixed states remain enums. No new policy database/UI for values already managed through deployment configuration. Reject incompatible settings: negative caps, missing currency, unfunded retention, release lead shorter than drain/safety allowance, or auto-buy without verified price semantics.

Premium/vanity exceptions need a quote, payer arrangement and explicit one-operation approval. No global disable-cap switch. A provider request cannot authorize spending. Ownership/quarantine overrides are separately restricted, justified and audited. An expensive owned asset is not eligible for the trial pool by default.
