# Implement the AI Assistant number lifecycle — entry point for the building session

Rewritten 1 October 2026 after the owner's final design review. Work in `C:\Nik`. Quality over speed. **No
application code exists yet.** This file tells you what to read, what is decided, and how to work. It does not
replace the files it points to.

## 1. Hard lines — read these first

1. **NEVER purchase, reserve, release or modify a phone number at Telnyx or Plivo — not on the sandbox accounts
   either; they are billed.** Every test uses carrier fixtures and fakes. Read-only (GET) carrier calls with the
   keys already in the tracked `appsettings*.json` are allowed.
2. Do not deploy, do not submit or change Meta templates, do not send real messages, do not delete real data.
3. Only the schema in `SCHEMA-APPROVAL-REQUEST.md` revision 3 may be written. Anything more: stop, present the
   `AGENTS.md` §0.7 table, wait for the owner.
4. No cross-partition Cosmos query. Nothing stored without a TTL. Every `IMemoryCache` write sets `Size = 1`.
5. A carrier purchase POST is never retried automatically; an unknown result is reconciled with the carrier.
6. A number this system did not itself buy or detach is never offered and never returned automatically.
7. Multiple sessions work uncommitted in these repositories: never `git checkout --`, `restore`, `reset`, `stash`
   or `clean`; history stays linear; the owner commits, pushes and deploys.

## 2. What is decided — order of authority

1. `DECISIONS-2026-10-01.md` — what the owner approved, in his words, and the items still pending.
2. `FINAL-DESIGN.md` — the single design to build. Its §14 lists every earlier statement it supersedes.
3. `SCHEMA-APPROVAL-REQUEST.md` (revision 3) — the only schema allowed.
4. `IMPLEMENTATION-CARRIER-EVIDENCE.md` — carrier facts, published and observed on the accounts.
5. `DESIGN-REVIEW.md` — why each choice was made, with its edge cases.
6. Older files, for detail the above do not repeat and **only where they do not conflict**: `ORIGINAL-ASK.md`,
   `APPROVED-HANDOFF.md`, `PLAN.md`, `RENEWAL-AUTOMATION.md`, `CARRIER-RESEARCH.md`, `EVIDENCE.md`, `SCHEMA-REVIEW.md`,
   `DELIVERY.md` (acceptance tests, UI state inventory), `EDGE-CASES.md`, `NOTIFICATIONS.md` (copy drafts, recipients),
   `UX-SPEC.md` (brand, responsive and native rules), `SIMPLE-OVERVIEW.md`, `REVIEW-STATUS.md`, `HANDOFF-CHECKLIST.md`
   (R01–R23), `CARRIER-SUPPORT-QUESTIONS.md`, `IMPLEMENTATION-STATE.md` (what the design session read and verified).

Approved mockup: `C:\Nik\Data\mockups\voice-number-lifecycle\index.html`, with the text amendments in
`FINAL-DESIGN.md` §12. Read it and inspect every scene and state in a browser before building any screen.

**Do not ask again for anything `DECISIONS-2026-10-01.md` marks APPROVED. Items it marks PENDING must be confirmed
with the owner before the code that depends on them.** If you find evidence that an approved choice is wrong,
explain it with the evidence, recommend, and get the owner's yes before departing from it. Ask when a fact is
missing; never guess a billing rule, a carrier behaviour or a spending policy.

## 3. Mandatory reading before writing code

Read every file in §2 fully, in bounded chunks, and keep a reading checklist in `IMPLEMENTATION-STATE.md`. Read
`C:\Nik\AGENTS.md`. Read these skills in full under `C:\Nik\.agents\skills\` before touching their area (each is
prefixed `clinqet-`): voice-assistant, payments, provider-teams, auth-sessions, main-api, infrastructure,
shared-core, cosmos-data, function-app, deployment, notifications, whatsapp, admin-app, partner-app,
provider-mobile, ui-common, testing. Read the code paths end to end before changing them — `FINAL-DESIGN.md` §16
lists what the design session did NOT trace and you must. Re-verify the design's code facts against the tree you
find; other sessions may have changed it.

## 4. Scope

Everything in `FINAL-DESIGN.md`, end to end: shared/core/infrastructure, the API, the regional Function App, the
billing hooks, both carrier adapters, deployment (ARM, `deploy.ps1`, `events.json`, local settings), admin web AND
admin app, provider web AND provider app, localization in every language file, notifications and email
templates, alerts, reconciliation and monitoring. Both stamps: Telnyx (Canada/US, automatic) and Plivo (India,
admin-led). Every `HANDOFF-CHECKLIST.md` row ends Implemented+Verified or Blocked with evidence. Never call a stub
or a partial phase complete.

Suggested order (each step ends with its builds and tests green before the next):
1. Enums, entities, settings, repositories for the three document families; index path; settings fields.
2. Carrier adapters: lossless price parsing, structured search, order reference and reconciliation, owned-number
   list with renewal facts, delete with confirmation, balance; the purchase POST out of the retry policy.
3. The coordinator (claim, generation, projections) and the existing admin assign / change / remove routed through it.
4. Setup flow: choices, pool assignment, the queue worker for purchases, fallback to the admin.
5. Forwarding-change and specific-number requests; admin decision; audit evidence.
6. Billing hooks, hold, removal, recovery, own-number safety block, business closure.
7. The hourly job: carrier read, due work, keep-or-return with the buffer, daily checks, balance, summary, heartbeat.
8. API endpoints; then admin web + admin app; then provider web + provider app, with all strings and notices.
9. Deployment changes; skills (all four AI-tool copies) and memory; the audit.

## 5. Required audit after implementation

Create `IMPLEMENTATION-AUDIT.md` here: requirement ids, files changed, test evidence, findings, fixes, re-runs,
remaining risks. Audit all changed code and the flows that depend on it, not a diff skim:
- **Correctness:** every lifecycle transition; trials of any length; paid history including promo-to-zero;
  conversion, cancellation, dunning, payment races; hold, removal, reuse wait; renewal boundaries.
- **Security:** authorization and business isolation on every endpoint; admin-only forwarding application;
  country and destination validation; replay; spoofed ids; secrets and PII in logs.
- **Concurrency:** assignment versus return, Keep, recovery; atomic claims and the counter; ETags and generations;
  redelivery; two job instances; stale callbacks.
- **Reliability:** timeout after external success; partial carrier pages; SQL or carrier unavailable; crash at
  every step of §6 and §9 of the design; DLQ; delayed notices; missed job runs.
- **Cost/performance:** RU-scoped reads and point reads only; the caps, the daily limit, the buffer; quote
  freshness; no duplicate UI calls; pagination; resource disposal.
- **UI/parity:** admin web and app, provider web and app; brand and fonts; every language; 360, 390, 768, 1024 and
  desktop widths; keyboard and screen reader; every state in `DELIVERY.md`; deep links.
- **Deployment:** create AND update; both stamps; options, appsettings, local settings and `deploy.ps1` aligned;
  the retired keys removed everywhere.
- **Tests:** affected builds and lint; unit AND integration tests in the suite of the host that runs the code;
  real Cosmos and SQL engines for claims, the counter, TTL and billing-history reads; virtual clocks; carrier
  fixtures; no skipped or empty-scan tests.
Fix every finding in the same session and re-run. Reconcile `ORIGINAL-ASK.md` and every checklist row before
reporting done. Check `git status` of every touched repository; remove scratch files; list changed repositories,
validation, and anything genuinely blocked.

## 6. Coding standards supplied by the owner

1. Zero assumptions, zero hallucinations, zero workarounds. Plan first, then execute.
2. Pre-production: no legacy compatibility layers, no speculative backfills; the correct end state.
3. Backend: performance- and cost-aware; bounded, thread-safe concurrency; correct disposal and cancellation.
4. Frontend: existing theme, fonts and components; mobile-first and tablet-ready; no redundant API calls.
5. Resilience: latency, disconnects, missing data, retries and every documented edge case, back and front.
6. Comments: none by default; one short line only for a non-obvious why.
7. When alternatives are needed, state the recommended one and why.
All `AGENTS.md` rules apply through the final audit.
