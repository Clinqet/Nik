# Handoff coverage checklist

> **1 October 2026 — superseded in part.** The owner's final decisions are in `DECISIONS-2026-10-01.md` and the design to build is `FINAL-DESIGN.md` (its section 14 lists what changed). Read those first; **where this file differs, they win.** This file stays for the detail they do not repeat.

**MANDATORY CARRIER RESEARCH — COST IS SUPER IMPORTANT. The implementation session MUST research official Telnyx (Canada/US) and Plivo (India) billing online AGAIN: first and subsequent charges, proration/refunds, renewal calendar, month-end/leap dates, billing cutoff/timezone and available renewal APIs. Resolve conflicting information against the exact product/account and primary documentation, using authorized read-only evidence and written carrier confirmation when needed; ask the owner rather than guess. Read CARRIER-RESEARCH.md and RENEWAL-AUTOMATION.md fully. Save verified evidence and conservative UTC deadlines in the proposed partition-scoped Cosmos design after itemized schema approval; return eligible unused numbers with a default 24-hour lead. No unverified financial automation or promised refund.**

Rechecked 1 October 2026 against the conversation, preserved original ask and design package. This is a requirements index, not proof of implemented behavior. Mockup and solution are OWNER APPROVED. Final decisions in APPROVED-HANDOFF.md override earlier examples. Historical source evidence and original request remain unchanged.

| ID | Required scope | Authoritative detail |
|---|---|---|
| R01 | Admin-only forwarding changes; canonical verified country; national 10-digit input; no Verified/Locked labels; CA/US distinction; pending, reject, apply and reconnect | APPROVED-HANDOFF.md; PLAN.md §3 |
| R02 | Request alert plus existing AI Assistant queue without business search; same operation; business-scoped Number/Forwarding/Activity; global inventory clearly separate | APPROVED-HANDOFF.md |
| R03 | Approval evidence, actor, old/new number, immutable 365-day default retention setting; deadline snapshot; read/resolve/delete/bulk/TTL protections | RENEWAL-AUTOMATION.md |
| R04 | Self-service setup, registration and outcome alerts, notifications only after confirmed readiness, admin fallback | PLAN.md; NOTIFICATIONS.md |
| R05 | Allocation off local/lower, on production; backend enforced; lifecycle/returns independent; queued and unknown purchases handled safely | PLAN.md §4; DELIVERY.md |
| R06 | Pool first; rental runway then locality/verified-phone area/same country; no random cross-country assignment; one selected claim | PLAN.md §5 |
| R07 | Configurable choice count default 5; min available; 10-choice responsive dropdown/native picker; custom number request without budget bypass | RENEWAL-AUTOMATION.md; UX-SPEC.md |
| R08 | Telnyx CA/US USD1 monthly maximum; India Plivo proposed INR200 account-validated maximum; zero setup cap; currency/precision/price binding; daily and ongoing exposure limits | CARRIER-RESEARCH.md; RENEWAL-AUTOMATION.md |
| R09 | Any trial duration/card/extension; reminder T−24h, end T, detach T+24h; no extra quarantine default; authoritative regular billing history, not current payment amount | APPROVED-HANDOFF.md; RENEWAL-AUTOMATION.md |
| R10 | Prior regular period including 100%-off/credit/zero-dollar invoice/later trial uses 15-day default quarantine; separate settings; paid-through/dunning preserved | APPROVED-HANDOFF.md |
| R11 | Quarantine blocks reassignment only; automatic pre-renewal return; hourly scan/24h lead; real carrier dates; month end/leap/timezone uncertainty; overdue recovery | RENEWAL-AUTOMATION.md; CARRIER-RESEARCH.md |
| R12 | Keep/resume with reason, continued rent, actor/time, concurrency; no silent override of active call/assignment/entitlement | RENEWAL-AUTOMATION.md |
| R13 | Immediate deduplicated failure/unknown-return alerts, bounded retries, escalation, reconcile authoritative complete carrier inventory; no false refund or success | RENEWAL-AUTOMATION.md |
| R14 | Existing Function App, all executing API/worker settings, ARM/deploy/CI creation AND updates, both stamps, local defaults/options consistency | DELIVERY.md; RENEWAL-AUTOMATION.md |
| R15 | Email/in-app/eligible push, approved Utility WhatsApp templates/locales, recipient security, deduplication and failed delivery; no notification-driven indefinite hold | NOTIFICATIONS.md |
| R16 | Admin web + admin native + provider web + provider native; existing brand/fonts; mobile/iPad; gestures with visible equivalents; accessibility and localization | UX-SPEC.md; APPROVED-HANDOFF.md |
| R17 | Existing mutation defects, foreign ownership, application-save bypass, parsing, stale projection, unsafe POST retry; one coordinator | EVIDENCE.md; DELIVERY.md |
| R18 | Atomic business/number claims, ETags/generations, safe cleanup, no cross-partition queries, durable operations, claim/spend limits, schema approval | PLAN.md; SCHEMA-REVIEW.md; EDGE-CASES.md |
| R19 | All missing/error/offline/permission/limit/payment/ownership/callback races; native/web parity; real-engine tests, builds/lint and operational verification | EDGE-CASES.md; DELIVERY.md |
| R20 | Owner coding standards, mandatory full reading, no legacy scaffolding, bounded concurrency/disposal, no duplicate API calls, all-language strings, synchronized skills/memory, scratch cleanup, multidimensional audit | IMPLEMENTATION-PROMPT.md; AGENTS.md |
| R21 | Creative freedom to investigate gaps/security/cost leaks; concrete proposed departures require owner approval; unresolved questions must be asked, not guessed; update decisions and tests after approval | IMPLEMENTATION-PROMPT.md; APPROVED-HANDOFF.md |
| R22 | Exact hourly UTC schedule; purchase observation versus carrier facts; renewal evidence/precision/timezone; conservative conversion; lookahead and overdue catch-up; independent missed-run monitoring; cross-timezone tests | RENEWAL-AUTOMATION.md § Mandatory timezone-independent return schedule |
| R23 | Implementation MUST repeat official carrier web research; first and later charges, refunds/proration, calendar versus anniversary, month-end/leap, actual renewal APIs; resolve account/product/currency conflicts; persist evidence in approved SystemData asset/operation model; full monthly cap rather than first partial charge; financial readiness gate | CARRIER-RESEARCH.md; RENEWAL-AUTOMATION.md; SCHEMA-REVIEW.md; IMPLEMENTATION-PROMPT.md |

Implementation must extend this table with code paths, tests and actual results. Every row must be Implemented+Verified or explicitly Blocked with evidence; no omitted row, silent deferral or unsupported “all done”. Expand each row into its referenced edge cases. The preserved original ask is the final cross-check against accidental scope loss.

Remaining external facts are explicit: carrier billing cutoff/timezone and effective deletion deadline, Telnyx initial proration/unused-rent credit, current Plivo month-end/leap treatment for the exact India account, India account/product currency and compliance, quote-to-order binding and Meta template approval. Itemized schema approval is not replaced by mockup approval. No finite review proves every possible bug absent; report discovered gaps honestly.
