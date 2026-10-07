# Design review — what is standard practice, what was overkill, and what the real costs are

> **Later the same day the owner decided, and three points here changed:** row 9 uses the existing billing records
> (no SQL column); the Telnyx buffer is a fixed, admin-adjustable number (10), not demand-sized; one hourly job
> replaces the two checks. `DECISIONS-2026-10-01.md` and `FINAL-DESIGN.md` are the result; this file is the reasoning.

1 October 2026. The owner asked for every open schema row and decision to be reviewed "regardless of what our
solution says": is it industry standard, does it make sense, or is it overkill; with the edge cases; with a
recommendation. **Everything here is a recommendation. Nothing is approved until the owner says so.**
Evidence for every cost figure is in `IMPLEMENTATION-CARRIER-EVIDENCE.md` (read-only account calls, 1 Oct 2026).

## 1. What a number really costs (observed on the accounts)

| | Telnyx (Canada / US) | Plivo (India) |
|---|---|---|
| One-time fee per NEW number | **US$1.00, on top of rent** | None (0.00) |
| First month | Rent prorated by day, purchase day included (bought on the 13th of a 31-day month → 19/31 of $1) | A FULL month at purchase: ₹200 + 18% GST = **₹236** |
| Every month after | US$1.00 on the 1st (UTC) for every number owned | ₹236 on the number's own renewal date (purchase-day anniversary) |
| Returned early | Future months stop; nothing observed or published about a credit | Full month already paid; no refund |
| Price varies per number | Yes — one Hamilton number was $2.00 beside nine at $1.00 | No — every India number searched was the same |

So a brand-new Telnyx number costs **$1.00 one-time + up to $1.00 for the rest of that month, then $1.00 a month**.
The $1 one-time fee is NOT the first month.

### Cost of one 30-day trial

| Case | Telnyx | Plivo India |
|---|---|---|
| New number bought for the trial | $1.00 one-time + $0.03–$1.00 first month + $1.00 next month (a 30-day trial always crosses the 1st) = **$2.03–$3.00** | ₹236 at purchase + ₹236 at the renewal, because 30 days + the 1-day hold + the early-return margin runs past one month = **₹472** |
| Number reused from the pool | Only the months it stays owned: **$0–$1.00 more** | Only if its renewal falls inside the trial: **₹0–₹236** |
| A 14-day trial instead | New number: $2.03–$3.00 if it crosses the 1st, else $1.03–$2.00 | **₹236** (one month is enough) |

Two consequences:
- On Telnyx, **reusing a pool number saves the $1.00 one-time fee every time**. Reuse matters more than early return.
- On India, any trial longer than about 27 days costs a second month on a freshly bought number.

### Keep an idle number, or return it? (the owner's question, 1 Oct)

Telnyx. At month end an idle number can be kept (costs $1.00 for next month) or returned (costs nothing now).
If it is returned and a new business needs a number next month, a new one costs $1.00 one-time + the prorated
rest of the month (about $0.50 on average) = about $1.50. So:

- Kept and reused next month: $1.00 spent instead of about $1.50 — **saves about $0.50**.
- Kept and NOT reused: **$1.00 wasted**.
- Break-even: keeping only pays when a kept number is more likely than about 2 in 3 to be reused within the month.

Keeping EVERY idle number for an extra month would lose money whenever sign-ups slow down. Keeping NONE pays the
one-time fee again and again when sign-ups are steady. **Recommendation — a demand-sized buffer:**

1. Before the monthly renewal, keep at most as many idle, reusable numbers as the number of businesses that
   received a number in the last 30 days, up to a configured maximum.
2. Return every idle number beyond that.
3. A number that was kept once and is still idle at the next renewal is returned. One extra month, never more,
   unless an admin presses Keep.

India. There is no one-time fee and a new purchase always buys a full fresh month for the same ₹236, so keeping an
idle number is never cheaper than returning it and renting a new one later. **India buffer: zero — always return
idle numbers before their renewal.**

## 2. Schema rows — verdicts

| Row (revision 1) | Verdict | Recommendation |
|---|---|---|
| 1. Number record (`VoiceNumberAsset`) | **Industry standard.** Every reseller of numbers keeps an inventory record per number with a status, an owner and a renewal date | Keep, with six fields removed |
| 2. Per-business slot | **Overkill.** A request record whose id is built from the business id already allows only one at a time | Remove |
| 3. Operation record | **Standard, but revision 1 kept too many.** A durable record before a purchase is the standard way to survive a lost answer from a carrier that offers no idempotency | Keep as one live record per business per kind of request; history stays in the existing audit |
| 4. Daily purchase budget | **Sensible circuit breaker.** Free trials without a card are an open door to anyone who signs up in bulk | Keep, two fields, with a warning level and a hard limit that each raise their own admin alert |
| 5. Partition key with a new setting | **Overkill** | Use the carrier name: `voiceinv_telnyx`, `voiceinv_plivo` |
| 6. Generation number on profile and line | **Industry standard** (a fencing token). Without it a delayed retry can undo a newer change | Keep |
| 7. One index path `/dueAt` | **Standard** for any due-time work list | Keep |
| 8. New undeletable alert type for approvals | **Overkill.** The existing number audit is already kept 365 days and cannot be deleted or resolved | Record approvals in the existing audit with two new small fields |
| 9. SQL column `RegularBillingStartedAt` | **Needed** for the rule the owner approved; nothing existing can answer it | Keep |

Net: revision 1 had four new document families, two new fields, an alert-type protocol, five index items in the
original and one SQL column. Revision 2 has **three families, four small new fields, one index path, one SQL column**.

## 3. Edge cases each row must survive

### Number record
- **Two environments share one carrier account** (dev and a second environment on the same sandbox). A number this
  environment did not itself buy or detach enters as "needs review" and is NEVER offered or returned automatically.
  Without this rule one environment's return job could delete a number another environment assigned.
- A number bought in the carrier console, or left by old code: same — needs review until an admin adopts it.
- A number in our records that the carrier no longer lists (only after a complete, successful listing): line
  disabled, business notified, admin alert. A failed or partial listing proves nothing.
- Rent found above the cap at reconciliation (price change, or a $2 number adopted by an admin): stays owned and
  visible, never offered to a trial.
- Renewal date missing or changed earlier: recomputed; if the new target is already past, the return is due now.
- Carrier deletion lock on: alert before the deadline; never unlocked automatically.
- Reserved by a request that died before buying: released by the sweep; once a purchase may have started, never
  released until the carrier is asked.

### Request record
- Phone and laptop submit together with the same request id: one record, same answer to both.
- Different request ids together: the second collides, reads the first and is told a request is already open.
- Same request id with a different number: refused as a conflict, never a second purchase.
- The provider closes the page mid-purchase: the worker finishes; reopening shows the same request.
- The carrier answer is lost: the record already says "purchase started" with our reference. Telnyx is asked for
  the order by that reference; Plivo is asked whether we own the number. Only a clear "no" allows another attempt.
- Allocation is switched off while a request waits: before a purchase starts it goes to the admin; after, it is
  finished and reconciled.
- The trial ends while setup is still running: no purchase starts without a live entitlement.
- Two admins decide the same forwarding request: the ETag lets one win; the other is told to reload.
- The saved number changed after the request was made: the apply step compares the expected old number and stops.
- Payment arrives while removal is running: both go through the one service-end record; removal not yet committed
  is cancelled, the number is kept.
- A notice fails to send: the record keeps the unsent notice and retries with the same event id; the removal
  deadline does not move.

### Daily budget
- 50 sign-ups in an hour: purchases stop at the hard limit, later requests go to the admin queue, one alert at the
  warning level and one at the limit.
- An order whose result is unknown keeps its place in the day's count until reconciled.
- Count resets with the UTC day; a retried, already-counted purchase is not counted twice.

### Generation number
- Worker A stalls after claiming number N for business X. N is detached and given to business Y. A wakes and tries
  to write X onto the line: refused, because the line now carries a higher generation.
- The same for the profile: a late "assigned" cannot land after the removal.

### SQL column
- Trial → paid with a 100% discount → cancelled: column set at the paid switch ⇒ 15-day wait.
- First paid period at zero price: the renewal finalisation still runs ⇒ column set.
- Paid, cancelled, later given a second trial that ends: column still set ⇒ 15-day wait.
- Trial of any length ending without conversion: column empty ⇒ no extra wait.
- Admin-comped assistant with no add-on row: class Unknown ⇒ treated as paid for reuse, still returnable.

## 4. The four decisions — verdicts

### Decision 1 — Telnyx one-time fee
Capping only the monthly rent is not standard practice; a buyer caps every charge the order creates. With a zero
one-time cap, no Telnyx number can ever be bought automatically (every local number on the account carries $1.00).
**Recommendation: one-time cap US$1.00 as its own setting on the Canada/US stamp; monthly cap stays US$1.00; India
one-time cap stays zero.**
Edge cases: the $2.00 Hamilton number is refused on rent; toll-free at $40 + $500 is refused twice over and is not
even searched (local only); a missing, unreadable or non-USD price is "unknown" and refused — never read as zero.

### Decision 2 — automatic buying with no carrier price limit
No carrier offers a "do not charge more than X" order. The standard control is: quote the exact number, order it
at once with our own reference, verify what was charged, and cap the day.
**Recommendation: enable automatic buying on Telnyx with all of:** local numbers only; both caps checked on a
quote no older than a configured number of seconds; our reference on the order; the purchase POST never retried
automatically; the real charge read back from the charges report and an alert if it differs from the quote; the
daily warning level and hard limit; pool first.
Residual risk, stated plainly: a price that changes in the seconds between quote and order is paid once, for one
number, and is alerted. It cannot be made zero.
Edge cases: the carrier returns "pending" — the number is tracked as possibly owned; the 400 "no numbers found"
answer means no inventory, not an error; our own recently returned numbers are excluded from search (Telnyx holds
them about 15 days and re-buying may charge the one-time fee again).

### Decision 3 — India
**Recommendation: India ships admin-led.** No automatic purchase and no automatic hand-over of a pool number to a
different business. Reasons, all observed:
- Both India numbers are rented under the platform's own company KYC, and Plivo's rule for resellers is one
  compliance application per end customer. Whether one number may serve another business, or move between
  businesses, is a compliance answer only Plivo can give.
- The API quotes 2.50 while the account is charged ₹236. A rupee cap cannot be checked against that field.
- Numbers exist for a few cities only (Mumbai, Bangalore observed).
- The account is prepaid with no auto-recharge.
Still automatic in India: trial reminders, service end, removal, the reuse wait, and **returning idle numbers
before their renewal** (it uses the carrier's own renewal date and only saves money).

### Decision 4 — changing a connected own number
Standard practice for changing where calls go is proof of control of the new number plus a notice to the existing
contacts. For a connected own number the existing test call IS that proof, and it is stronger than anything an
admin can check by hand. For a dedicated assistant number, the "number to reach you on" is a number WE dial on
every call, with no proof step today, so that is where review is needed.
**Recommendation: keep self-service (the "Change" control and the test call) for a connected own number; make the
dedicated-mode "number to reach you on" admin-only, as designed.**
Edge cases: premium and service prefixes are already refused in the connect flow and the same check is added to
the admin apply step; a country different from the business is refused; a provider who connects their own number
and later disconnects ends up with that proven number as the ring-through number — acceptable, control was proven;
ownership transfer never changes the saved number by itself.

## 5. Other recommendations from the evidence (new, need a yes)

| # | Recommendation | Why |
|---|---|---|
| R1 | Demand-sized idle buffer on Telnyx, zero on India (section 1) | The one-time fee makes "return everything" more expensive than keeping what will be reused |
| R2 | India cap expressed in the unit the carrier quotes (2.50) with the real rupee charge checked afterwards from the usage report | The quoted field is not rupees |
| R3 | Balance watch with an admin alert on both accounts | Telnyx is at −$2.53 on a $5 credit line with auto-recharge off; Plivo is prepaid and manual |

## 6. Things to fix inside the approved scope (no decision needed)

Search asks for local numbers only and excludes our own held numbers; a 400 "no numbers found" is treated as "no
inventory"; area search falls back from area code to locality; the Telnyx order carries our reference; the Plivo
buy call sends the compliance application id; an unreadable price is unknown, never zero; the purchase POST leaves
the automatic retry policy; the deployed India ceiling (25000, from the old ₹250 price) is replaced.
