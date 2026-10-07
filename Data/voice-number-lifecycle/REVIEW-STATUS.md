# Design delivery and verification

> **1 October 2026 — superseded in part.** The owner's final decisions are in `DECISIONS-2026-10-01.md` and the design to build is `FINAL-DESIGN.md` (its section 14 lists what changed). Read those first; **where this file differs, they win.** This file stays for the detail they do not repeat.

**MANDATORY CARRIER RESEARCH — COST IS SUPER IMPORTANT. The implementation session MUST research official Telnyx (Canada/US) and Plivo (India) billing online AGAIN: first and subsequent charges, proration/refunds, renewal calendar, month-end/leap dates, billing cutoff/timezone and available renewal APIs. Resolve conflicting information against the exact product/account and primary documentation, using authorized read-only evidence and written carrier confirmation when needed; ask the owner rather than guess. Read CARRIER-RESEARCH.md and RENEWAL-AUTOMATION.md fully. Save verified evidence and conservative UTC deadlines in the proposed partition-scoped Cosmos design after itemized schema approval; return eligible unused numbers with a default 24-hour lead. No unverified financial automation or promised refund.**

**Owner approved solution and mockup, 30 September 2026.** Read [final approved handoff](APPROVED-HANDOFF.md) first: any trial duration, historical regular billing even at zero dollars, national 10-digit entry, and existing admin queue integration. Itemized schema approval remains separate.

**Current revision:** [Renewal automation and owner-requested controls](RENEWAL-AUTOMATION.md) governs automatic returns, Keep, regional caps, country lock, configurable choices and protected approval history. Earlier manual-return/fixed-five review notes below are superseded where they conflict.

30 September 2026 · **solution and mockup approved by owner**; itemized schema gate remains.

## Delivered

- PLAN: proposed architecture, existing-system boundaries, D1–D12 decisions, mockup register.
- EVIDENCE: scoped source findings and real source links, including pre-automation defects.
- CARRIER-RESEARCH: primary carrier references, cost arithmetic, date/currency uncertainty and account launch checks.
- SCHEMA-REVIEW: exact proposed document/field/index/retention changes and their readers, writers, cost and necessity; no migration or application entity written.
- NOTIFICATIONS: reuse policy, recipient/channel behavior, draft Utility copy and localization requirements. No messages/templates submitted.
- DELIVERY: ordered phases, API behavior, UI state matrix, real-engine acceptance tests and rollout controls.
- UX-SPEC and EDGE-CASES: responsive/brand/native interactions, concurrency, cancellation, recovery, billing, rental and policy trade-offs.
- Registered isolated HTML mockup with the existing Lufga fonts and a historical forwarding review image (predates the final 10-digit-entry refinement; index.html is authoritative).

## Checks actually performed

The HTML JavaScript parses. Browser inspection traversed **71 selectable states**, checking that web and native frames rendered meaningful content and that no runtime error was logged. Main screens were checked at **360, 390, 768, 1024 and 1440 px** (25 screen/width combinations). After adding inventory filters, its five widths were checked again. No horizontal overflow was found in these checks. Screenshots were inspected for the main layout, phone browser and forwarding dialog/native sheet.

Interactive checks covered invalid and unchanged forwarding numbers, successful request preserving the typed number, pending state, admin verification validation, return review, native number-action menu, keyboard candidate selection, and inventory filtering with matching web rows/native cards. Currency formatting and partial-result states were corrected during QA. The saved screenshot is a deliberate review artifact, not an investigation screenshot left in a repository.

The browser prototype demonstrates layout and state transitions. It does not execute native haptics, OS sharing, real verification, payment, call routing or carrier APIs. The pointer-hold/right-click interaction is authored in the prototype; the equivalent visible menu and keyboard path were exercised. Native device behavior, translated strings, dark mode and real-engine concurrency are specified implementation checks, not claimed as tested here.

All ten inspected application/infrastructure repositories had clean `git status --porcelain` at final review. No app code, schema, deployment configuration or live account was changed. No scratch files were created in those repositories, and no temporary scripts/logs remain. The local preview process is intentionally left running for review; the HTML also works directly from its saved folder.

## Remaining approvals and evidence

Owner design/mockup approval is recorded in APPROVED-HANDOFF.md. Exact schema approval remains required by AGENTS.md. Carrier account currency, exact renewal cutoff/timezone, quote-to-order price protection and applicable India compliance must be confirmed before automatic spend/return launch. They are not facts obtainable from unauthenticated public pricing alone.

No application build, unit test or integration test was run for this design-only delivery. The acceptance matrix specifies those required for implementation.

## 30 September revision verification

Updated HTML: locked Canadian example country, configurable 5/10 limit with 3/7/12 eligible fixture controls, large-list picker, automatic-return messaging, Keep/resume dialog with required reason, and protected approval-history explanation. Verified 10 choices and 3-choice truncation, Keep save, no horizontal page overflow at 360/390/768/1024/1440 pixels, and no browser console errors. Updated forwarding-preview.png replaces the obsolete editable-country screenshot. This revision is a prototype, not a carrier-connected system; complete production phone metadata, immutable audit enforcement and real native gestures require implementation and integration tests. Additional regional fixtures and detailed audit screens remain implementation acceptance criteria.

No application code/schema/deployment changed. No scratch scripts were created; the preview server was launched inline. Carrier cutoff timezone, India account currency/product, and binding acquisition price remain launch checks, not confirmed facts.

## 1 October carrier and handoff revision

Rechecked current official billing/number documentation and Telnyx's official OpenAPI contract. CARRIER-RESEARCH.md records verified GET/DELETE/report endpoints, the absence of a next-renewal field in the inspected Telnyx number/order schemas, Plivo date-only renewal evidence, historical month-end examples and unresolved account differences. It deliberately does not promise a universal Telnyx first-proration/refund formula or an undocumented Plivo leap-year algorithm.

Added the owner's bold mandatory fresh-research/cost requirement to every editable planning, solution, flow, UX, evidence and handoff document, including IMPLEMENTATION-PROMPT.md. ORIGINAL-ASK.md remains the preserved original request. Updated the Cosmos precision proposals and implementation acceptance cases, and added R23 to the handoff requirement matrix. Removed stale manual-return, notification-extended-hold and pending-design wording from the authoritative plan. The approved HTML/mockup and approval date remain unchanged.

These are documentation changes only. No new schema, application code, resource, account access, carrier purchase/return or external message was performed. Exact account billing evidence and itemized schema approval remain outstanding implementation gates; the same implementation prompt path is retained.

Final checks: all 14 editable planning/handoff files contain the bold mandatory research notice; the prompt references all 14 required supporting design files; R01–R23 are present once; no local Markdown link is broken; canonical HTML and register exist. All ten application/infrastructure repositories again had clean git status. No scratch artifacts were created or left behind. No application tests/builds were run for documentation-only changes.
