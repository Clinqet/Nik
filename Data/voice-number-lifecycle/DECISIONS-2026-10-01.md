# Owner decisions — 1 October 2026

Record of what the owner approved in conversation on 1 October 2026, after the carrier research, the read-only
account evidence and the "standard practice or overkill" review. **An entry is APPROVED only where the owner's own
words are quoted.** Where this file differs from any older file in this folder, this file is later and wins.
The design that implements these decisions is `FINAL-DESIGN.md`; reasons and edge cases are in `DESIGN-REVIEW.md`;
evidence is in `IMPLEMENTATION-CARRIER-EVIDENCE.md`.

## Standing rules from the owner

- **Never purchase a phone number through Telnyx or Plivo, not even on the sandbox accounts.** Read (GET) calls
  with the appsettings keys are allowed. *"just do not purchase make it down in the hard line"*
- Build only what is industry standard, best practice, performance- and cost-friendly and meets the business
  requirements; drop what is overkill. No workarounds.
- Nothing is stored without a TTL. *"it need to have the solid ttl so nothing without ttl"*
- 1 October was design, analysis and decisions only. **Coding is the next session.**
- Admin screens stay hardcoded English like the rest of both admin apps; the alert-to-request link is accepted as
  new work. *"both are good now"*

## Schema (final list: `SCHEMA-APPROVAL-REQUEST.md` revision 3)

| # | Item | Status | Owner's words |
|---|---|---|---|
| 1 | `VoiceNumberAsset` — one record per rented number | **APPROVED** | "#1 approved" |
| 2 | Per-business slot record | **REMOVED** | confirmed |
| 3 | `VoiceNumberRequest` — one live record per business per kind, with a TTL | **APPROVED** | "I am good and approved but it need to have the solid ttl" |
| 4 | Daily purchase counter; warning level 10 and stop level 25; admin-adjustable from Voice Settings without a deployment | **APPROVED** | "rest of the point is approved" |
| 5 | Partition key `voiceinv_telnyx` / `voiceinv_plivo` from the carrier setting; no new setting | **APPROVED** | "no need to do if it is overkill" |
| 6 | `numberAssignmentGeneration` on the business profile's assistant state and on the voiceline; no new document | **APPROVED** | "#6 approved" |
| 7 | One index path `/dueAt/?` on SystemData; ONE Function App job, **once an hour** | **APPROVED** | "I told you one hour" |
| 8 | Forwarding approvals recorded in the existing number audit with two new fields | **APPROVED** | "#8 approved" |
| 9 | Trial-only versus paid history from the existing billing records; no new SQL column | **APPROVED** | owner's proposal; "rest … approved" |
| — | Two dates on the number record (`assignedAt`, `availableSince`); three fields on `voicecfg_platform` (`numberPurchaseWarningPerDay`, `numberPurchaseLimitPerDay`, `idleNumberBuffer`) | **APPROVED** | "two field level confirmation. I'm okay with that" |

TTLs approved with row 3: number record 400 days rolling while owned and 365 days after a confirmed return;
request record 365 days rolling; daily counter 90 days.

## Decisions

| Decision | Status | Owner's words |
|---|---|---|
| Telnyx one-time fee cap US$1.00 as its own setting; monthly cap US$1.00; India one-time cap zero | **APPROVED** | "rest of the point is approved" |
| Automatic buying on Telnyx with the controls (local only, fresh quote, our reference, purchase never auto-retried, charge checked afterwards, daily limit, pool first) | **APPROVED** | same |
| India admin-led; removal, reuse wait and returns automatic; no buffer | **APPROVED** | "plivo logic remain what we discussed and had in solution correct" |
| Connected own number keeps self-service "Change"; the dedicated-mode "number to reach you on" is admin-only | **APPROVED** | "rest … approved" |
| Telnyx cost plan: reuse before buying; never return mid-month; keep a buffer at month end and return the rest; buffer admin-adjustable; monthly summary | **APPROVED — buffer 10** | "telnyx I am good with this logic just keep the buffer 10" |
| Balance alerts for both carrier accounts | **APPROVED** | "rest … approved" |
| The owner asks Telnyx himself about the buy-back fee | noted | "I will check with them for this" |

## PENDING — asked on 1 October, awaiting the owner's yes

| # | Item | Recommendation |
|---|---|---|
| P1 | **When the 24-hour hold starts.** Billing runs once a day (04:00 UTC), so a trial really ends at the first billing run after its end time; until then the AI keeps answering (existing behaviour). | Start the 24 hours when billing actually ends the service, and state the exact removal time in the "service ended" message. The one reminder goes out at least a full day before the end (AI reminder lead 2 days). No change to the billing clock. |
| P2 | **Text amendments to the approved mockup** (no redraw): the "own number · reconnect needed" forwarding state is not built; the trial timeline shows the exact removal time only once the service has ended; the inventory explains the buffer; the admin Voice Settings page gains three number inputs. | Accept as text amendments, like the voice-picker precedent in the mockup register. |

`FINAL-DESIGN.md` is written with P1 and P2 as recommended. If the owner chooses otherwise, §9 and §12 of that
file change before the dependent code is written.
