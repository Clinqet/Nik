Work in C:\Nik. You are finishing the AI Assistant number lifecycle programme. The backend, WhatsApp, the voice email templates, the heartbeat alert and the admin alert registration are DONE and every suite is green. Your job is the four UI surfaces, the dedicated test suites, the skills and memory, and then a full multidimensional audit of YOUR OWN work.

READ FIRST, IN THIS ORDER, COMPLETELY:
1. C:\Nik\Data\voice-number-lifecycle\BUILD-STATE.md — what is built, what is not, and the 8 decisions taken while building. This is your resume point.
2. C:\Nik\Data\voice-number-lifecycle\IMPLEMENTATION-AUDIT.md — the audit of the backend work, its 20 findings, and the 4 standing risks. Do not re-litigate what it already settled.
3. C:\Nik\Data\voice-number-lifecycle\FINAL-DESIGN.md and DECISIONS-2026-10-01.md — the approved design and the owner's decisions.
4. C:\Nik\Data\voice-number-lifecycle\UX-SPEC.md and DELIVERY.md — the states every screen must draw.
5. The approved mockup: C:\Nik\Data\mockups\voice-number-lifecycle\index.html
6. The skills for every area you touch: clinqet-voice-assistant, clinqet-partner-app, clinqet-provider-mobile, clinqet-admin-app, clinqet-ui-common, clinqet-testing, clinqet-notifications.

BUILD THESE, IN THIS ORDER:

1. PROVIDER WEB (clinqetwebpartnerapp) and PROVIDER MOBILE (clinqetmobilepartnerapp).
   Number choice step, setup-progress and "being arranged" states, held / removed / recovered states, the
   request-a-change dialog with its pending / declined / applied states.
   - EXTREMELY RESPONSIVE IS MANDATORY. Every screen correct at 360, 390, 768, 1024 and desktop widths. The
     owner opens the web app on a phone and on an iPad.
   - The mobile app must USE the platform: long-press, pull-to-refresh, haptics, native share, safe-area
     insets. Not a shrunken web page.
   - Brand, theme, colours, fonts exactly as the design system. Brand green for the chosen action.
   - EVERY string in all five language files per app (en, es, fr, gu, hi). No hardcoded user-facing text.
   - NO TECHNICAL WORD a provider can read (§0.20): no "partition", "token", "endpoint", "payload", "E.164",
     "DID", "forwarding target". Say number, calls, answering, saved.
   - You HAVE creative freedom to improve on the mockup for provider-facing screens, without asking — the
     owner granted this explicitly. Improve clarity and reduce jargon. Do not reduce scope.

2. ADMIN WEB (clinqetwebadmin) and ADMIN MOBILE (clinqetmobileadminapp).
   Requests queue (open requests across businesses, paged), selected-business view (Forwarding change ·
   Number · Activity), Numbers = carrier inventory with Keep and incident return, Voice Settings gains the
   three limits, and the alert → request deep link.
   - The 13 alert types are ALREADY registered in both apps with labels. Do not duplicate that work.
   - Admin may follow the mockup without full responsiveness (owner, 2026-10-01). Hardcoded English is fine
     for admin, as both admin apps already are.

2b. FIX R-1 — STOP THE ADMIN ALERT LISTS BEING HAND-MAINTAINED COPIES.
   Today clinqetwebadmin/src/pages/alerts/AlertsPage.jsx and clinqetmobileadminapp/src/services/alertTypes.ts
   each hold a hand-kept copy of clinqetshared/Enums/AdminAlertType.cs. The file comment says why: "The API
   does not publish these." When they drift, a new alert type still arrives and still renders but cannot be
   FILTERED for — a convenience gap, not a lost alert, which is why it is low severity and not urgent.
   ‼️ The fix is to DELETE THE DUPLICATION, not to guard it: add a small admin endpoint that returns
   Enum.GetValues<AdminAlertType>(), have both admin apps fetch and cache it, and remove both hard-coded
   lists. Keep the LABEL maps local in each app — labels are presentation, the list is data.
   Do NOT add a deploy-time comparison check: that adds a third thing to maintain and would block a deploy
   over a dropdown entry. Recorded as R-1 in IMPLEMENTATION-AUDIT.md.

3. DEDICATED TEST SUITES — this is the largest remaining risk, because this code deploys STRAIGHT TO
   PRODUCTION with no lower-environment soak.
   - Unit AND integration tests for VoiceNumberCoordinator, VoiceNumberAllocationService,
     VoiceNumberLifecycleService, VoiceNumberPurchaseService, VoiceNumberBillingGate, VoicelineProjector.
   - §0.18: a library class is tested from the suite of the HOST that invokes it. The hourly job, the queue
     processor and the billing tails run in the FUNCTIONS host ⇒ Clinqet.Communications.UnitTests /
     .IntegrationTests. Provider/admin endpoints ⇒ Clinqet.API.*.
   - Integration tests against REAL engines via Testcontainers (SQL Server + the Cosmos emulator) for: the
     atomic daily counter, ETag claims, TTL, billing-history reads, and the generation fence. EF InMemory
     cannot prove any of these.
   - Virtual clocks, never Thread.Sleep. Carrier FIXTURES only.
   - ‼️ NEVER purchase, reserve, release or modify a number at Telnyx or Plivo, not even on sandbox. It is
     billed. Read-only GET calls are allowed.

4. SKILLS ×4 AND MEMORY. Update clinqet-voice-assistant (and any other skill whose area changed) in ALL FOUR
   AI-tool directories: .claude/skills, .github/skills, .agents/skills, .cursor/rules. Add a memory entry and
   a one-line pointer in MEMORY.md.

5. ‼️ THEN RUN A FULL MULTIDIMENSIONAL AUDIT OF YOUR OWN WORK — this is a GATE, not a report. Write it into
   C:\Nik\Data\voice-number-lifecycle\IMPLEMENTATION-AUDIT.md as a second part, in the same shape as part one.
   Audit every dimension and FIX EVERY FINDING IN THE SAME SESSION:
   - Correctness: every state the server can produce is drawn; every transition; empty, loading, error,
     permission-denied, limit-reached, offline.
   - Security: authorization and business isolation on every new endpoint call; no cross-tenant leak; no
     secrets or PII in logs or analytics.
   - Concurrency and thread safety: no shared mutable state; no races in hooks or effects; no torn reads.
   - Memory and CPU: no leaked timers, listeners, subscriptions or intervals; no unbounded lists; no leaked
     native resources on mobile; every effect cleaned up on unmount.
   - Performance: no duplicate API calls, no render loops, pagination honoured, images sized.
   - UI/parity: web AND mobile; 360/390/768/1024/desktop; keyboard and screen reader; every language renders
     without overflow — Hindi and Gujarati are LONGER than English and will break a fixed-width button.
   - Deployment: create AND update paths; both stamps; any new setting in appsettings, local.settings, ARM
     and deploy.ps1 together.
   - Tests: affected builds, lint zero errors, suites green, no skipped or empty-scan tests.
   State plainly what you verified versus what you assumed. A dimension you could not audit is marked NOT
   AUDITED with the reason — never silently omitted.

RULES THAT ARE NOT NEGOTIABLE:
- Every rule in C:\Nik\CLAUDE.md, in particular §0.6 (never a cross-partition Cosmos query), §0.7 (ANY schema
  change needs owner approval FIRST — the approved schema is SCHEMA-APPROVAL-REQUEST.md revision 3 and
  nothing beyond it), §0.14 (no narrating comments), §0.16 (leave the tree clean), §0.18 (tests live with the
  runtime consumer), §0.19 (NEVER git checkout --/restore/reset/stash/clean — other sessions work uncommitted
  in these repos), §0.21 (linear history, never a merge commit).
- Owner approval before any schema change. Do not ask again about anything DECISIONS-2026-10-01.md marks
  approved.
- No feature flags, no old code paths, no stubs, no workarounds. Pre-prod: refactor freely, delete what is
  unused — in code, in config, in email templates and at Meta.
- The owner commits, pushes and deploys. Do not push.

WHEN YOU ARE DONE: report what you built, the audit findings and their fixes, which repositories changed, and
anything genuinely blocked. Run git status on every touched repository and confirm no scratch files remain.
