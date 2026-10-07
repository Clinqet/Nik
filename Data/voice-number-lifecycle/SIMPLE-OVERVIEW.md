# AI Assistant — simple solution and flow

> **1 October 2026 — superseded in part.** The owner's final decisions are in `DECISIONS-2026-10-01.md` and the design to build is `FINAL-DESIGN.md` (its section 14 lists what changed). Read those first; **where this file differs, they win.** This file stays for the detail they do not repeat.

**MANDATORY CARRIER RESEARCH — COST IS SUPER IMPORTANT. The implementation session MUST research official Telnyx (Canada/US) and Plivo (India) billing online AGAIN: first and subsequent charges, proration/refunds, renewal calendar, month-end/leap dates, billing cutoff/timezone and available renewal APIs. Resolve conflicting information against the exact product/account and primary documentation, using authorized read-only evidence and written carrier confirmation when needed; ask the owner rather than guess. Read CARRIER-RESEARCH.md and RENEWAL-AUTOMATION.md fully. Save verified evidence and conservative UTC deadlines in the proposed partition-scoped Cosmos design after itemized schema approval; return eligible unused numbers with a default 24-hour lead. No unverified financial automation or promised refund.**

**Owner approved solution and mockup, 30 September 2026.** Read [final approved handoff](APPROVED-HANDOFF.md) first: any trial duration, historical regular billing even at zero dollars, national 10-digit entry, and existing admin queue integration. Itemized schema approval remains separate.

**Owner-approved design. Nothing here has been implemented yet.**

## The idea

Let providers set up their assistant themselves. Reuse suitable numbers we already rent, buy affordable numbers only when needed, and involve an admin when something needs review.

We keep the existing billing and notification systems. We add a number register that tracks who has each number, its rental cost, and when it should be returned.

## 1. New provider setup

**Start trial or pay → complete setup → choose a number → activate assistant.**

1. First, check our pool for numbers that are safe to assign.
2. Show up to the appsetting limit (default five) choices, with one recommended and selected.
3. Prefer numbers with enough rental time remaining to cover the trial and one-day hold. Within that group, prefer the business's city, then its verified phone's area, then other areas in the same country.
4. If the pool has nothing suitable, look for a new carrier number within the approved budget. The recommendation is **US$1/month for Telnyx CA/US and ₹200/month for Plivo India**, with zero setup fee; India account currency/product must first be confirmed.
5. If none qualifies, save the request for an admin. Never buy an expensive number automatically.
6. Notify the provider when setup succeeds. Admins receive registration and outcome alerts.

If the provider is connecting an existing business number, they must also follow the forwarding instructions and complete a test call. A request for a special number goes to the admin.

### Automatic allocation can be switched on or off

An appsetting controls **only automatic number allocation**:

- **Lower environments: off by default.** Providers submit setup, and the admin allocates the number, like today.
- **Production: on by default.** Providers can choose a number and finish allocation themselves, within the safety and cost limits.
- Deployment automation sets the correct environment value when creating or updating the API and related workers. An explicit override can change it for testing or operations.
- **Even when off, number expiry, removal, safe reuse rules, automatic carrier returns and notifications still work.** Forwarding-change requests also keep working.

Turning it off does not abandon a number purchase already in progress; the system first confirms what happened and handles it safely.

## 2. Change the forwarding number

**Request a change → enter new number → admin verifies and applies → provider notified.**

The provider cannot directly change it. Their current number stays in place during review. After the change succeeds, send email and an in-app notification, plus push when available. This does not change their sign-in or security phone.

## 3. Trial ends without payment

| When | What happens |
|---|---|
| One day before expiry | Remind the provider and show the exact removal deadline |
| Trial expires | AI answering stops; hold their number for one more day |
| They pay during that day | Restore the assistant and keep the number |
| Still unpaid after the hold | Remove the number from their business and notify them |

Use email and in-app notices, eligible push, and WhatsApp only when its service-message template is approved. Paid renewal failures keep the existing payment-retry/grace rules. A payment still processing must be checked before removal.

## 4. What happens to the removed number?

**Remove from business → check safe reuse and renewal date → keep briefly or return to carrier.**

These are different actions:

- **Remove from business:** the provider loses the number, but we may still be paying its rent.
- **Return to carrier:** we give up the number to stop future rental charges.

**Trial-only accounts:** remove the number 24 hours after trial expiry, then no additional quarantine by default. **Previously paid accounts:** wait 15 days after removal before another business can receive it. Both waits are separate appsettings. Quarantine never prevents returning an unused number to the carrier before renewal.

An hourly Function App check automatically returns eligible unused numbers at least a day before renewal. Admins can select **Keep this number** to continue renting it. Failures immediately raise an admin alert; uncertain results stay under reconciliation. Quarantined numbers may be returned, but assigned numbers and recovery holds cannot.

**How rental works:** Telnyx Canada/US normally renews on the first of the next month. Plivo India uses each number's next rental date from its API. We save that evidence in the proposed regional number record in Cosmos, calculate an early UTC return deadline, and check every hour at minute 00. The server can be in either country and makes the same decision. Date-only information needs a conservative earlier deadline until the carrier confirms its billing timezone.

**Refunds:** Plivo bills a full rental month even when the number is returned early. Telnyx stops future recurring rent after deletion, but the checked pages do not promise unused-month refunds or a universal first-purchase proration formula. We budget no refund and verify the exact account before launch. Giving up a number before renewal saves the next rental.

## 5. How we control cost and mistakes

- Reuse eligible numbers before buying; check monthly cost, setup fee and currency.
- Set purchase limits and track ongoing rental exposure separately.
- An uncertain carrier response means “checking”, not “buy another number”.
- One number can belong to only one business at a time.
- Do not promise partial refunds. Giving up a prepaid number mainly avoids its next rental unless the carrier confirms a credit.
- A $1 monthly number can incur more than one rental during a trial that crosses renewal.

**Example:** if 100 numbers cost $1/month and 50 are returned before renewal, the next rental can fall from $100 to $50. That is $50 avoided next month, not a $50 refund for this month. Taxes and usage are excluded.

## Approved design and remaining evidence

The one-day recovery hold, separate trial (0-day) and paid-history (15-day) reuse waits, solution and mockup are approved. The country is fixed by the verified business-authority phone; forwarding approvals have protected history for 365 days by default. Exact schema approval and account billing evidence remain separate requirements.

Start with the [interactive mockup](../mockups/voice-number-lifecycle/index.html). The [full plan](PLAN.md) contains the approval decisions; [carrier research](CARRIER-RESEARCH.md) explains billing details and the account-specific checks still needed.
