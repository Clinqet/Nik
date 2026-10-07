Build the Provider Import programme for Clinket.

**Your authority is `C:\Nik\Data\provider-import\SOLUTION.md`. Read it completely before touching any code** — every owner
decision is in its §2 decision log, every verified code fact in §3, every rule in §5–§17, the admin screens in §18, the
refactors in §19, the cost model in §20, the edge-case contract in §21 (every row needs a test), the build order in §25 and
the mandatory audit in §27. The upload contract the scraping bots follow is
`C:\Nik\Data\provider-import\provider-import.schema.json` (schema 2.0, JSON Schema 2020-12; `provider-import.example.json`
validates against it).

**What we are building, in short.** Clinket is about to go live. Bots scrape public information about local service
businesses into one JSON file per batch. An admin uploads the file in the admin web app (new "Provider import" page). The
system checks the file against the schema — keeping only what the schema defines, ignoring every unknown field, dropping
optional values that break their rule and skipping only providers whose required parts are broken — cleans every value in
code (names capitalised, emails lower-case, phones formatted for the file's country, URLs, addresses, hours, prices with 0
meaning "no price"), merges records that are clearly one business and skips the ones that only share a contact, and shows
the admin the plan with an AI cost estimate. On "Start import", an Azure Functions worker (Service Bus, chained lanes, one
provider at a time per lane) first geocodes, runs ONE AI curation call per provider on a DEDICATED AI settings node and
dedicated model deployments (a second-opinion call only when needed; results banked by input hash + rules version),
verifies every AI answer against the source data in code so nothing is invented, and takes every "skip" decision — all
BEFORE any account exists. Only then does it ask Identity, through one private service-to-service endpoint, to create the
prepared account and its business (the same no-password account the admin "Provider setup" creates, with a deterministic
id so any retry converges), builds the whole profile hidden (`BusinessProfileStatus.Pending`) through the SHARED apply half
of the existing AI provider setup pipeline (refactored out of McpService with zero regression, every behaviour an explicit
option whose default is today's), then publishes it (Active) or holds it for admin review with plain-English reasons.
Imports send ONE summary alert per run; the per-event admin alerts of the provider web/app AI setup stay exactly as they
are (owner: no alert bombardment, and no regression). Re-uploading the same provider with more information fills only the
gaps; with less information it NEVER deletes or empties anything. Admins see every run, its summary (created / live / held /
skipped / merged / failed, each with its reason), every provider's source next to what was built, and can approve, edit
through the existing setup wizard, retry or remove. The same programme removes `UserProfile.IsAdminProvisioned`
(`ProvisionedAt` already says it) and fixes the "Guest User" name gaps after a provider takes over their account (N1–N4).

**Objectives, in priority order.** (1) Accuracy and correctness of every published profile — the owner accepts no
compromise; when unsure, hold for review, never publish a guess and never invent a fact. (2) AI cost as low as quality
allows. (3) Zero impact on live traffic (separate AI settings and deployments, throttled lanes). (4) Every edge case in §21
handled and tested. Time and speed do not matter.

**How to work (owner's standing orders — CLAUDE.md applies in full):**
- Read the skills first: `clinqet-prepared-providers`, `clinqet-ai-assistant`, `clinqet-provider-onboarding`,
  `clinqet-service-listing`, `clinqet-function-app`, `clinqet-deployment`, `clinqet-admin-app`, `clinqet-identity-api`,
  `clinqet-cosmos-data`, `clinqet-search-discovery`, `clinqet-testing`, `clinqet-notifications`; and
  `C:\Nik\Data\admin-provider-setup\PLAN.md` (prepared accounts — built 2026-10-06).
- **Every design decision is already made (SOLUTION §2, D1–D21) — this session is implementation.** The only owner step
  inside the build is approving the one mockup sheet (SOLUTION §14.3/§14.4, §25 step 9). §25 step 1 lists the few
  "verify, and ASK if…" points — ask one only if the code proves its condition.
- **No regression is a hard rule**: every shared piece you refactor (§19) keeps its existing callers' behaviour through
  options whose defaults equal today's; their existing tests pass unchanged before and after (record both runs).
- Anything unclear or that looks wrong once you read the code: STOP and ASK. No assumption, no workaround, no "TODO later".
- Schema changes: only those in SOLUTION §15.1 are approved. Anything else (SQL or Cosmos or search) → ask with the
  CLAUDE §0.7 table first. Apply the SQL migration to CA + IN via `cosmosindexsetup` (`dotnet run -- --all-regions
  --sql-only`) and prove it with `dotnet ef migrations list`.
- No cross-partition Cosmos query, ever. Every queue/container/setting/deployment: ARM + `deploy.ps1` + all three
  `local.settings` files in the same change. Every `IMemoryCache` write `Size = 1`. Class defaults equal appsettings.
- Admin screens: mockup gate WAIVED by the owner; build modern, dense, responsive (320/375/768/1024/1440) with the admin
  app's existing components. ‼️ The provider-facing name prompt (§14 N3) still needs a mockup in
  `C:\Nik\Data\mockups\provider-name-prompt\index.html`, registered, and the owner's approval BEFORE that UI is built;
  provider web and the provider phone app ship it together.
- Tests: unit AND real-engine integration (Testcontainers SQL + Cosmos emulator + Azurite) for every stage, every
  idempotency guard and every §21 row; tests live with the host that runs the code (CLAUDE §0.18); sabotage-check each
  guard; build EVERY project, test project and app before reporting.
- Never `git checkout --` / `restore` / `reset` / `stash` / `clean` (other sessions work uncommitted in these trees);
  linear history only; the owner commits, pushes and deploys. Leave the tree clean (§0.16).
- Before the audit: the pilot in §20 (20 then 200 sandbox providers, measured cost and an accuracy audit), the new skill
  `clinqet-provider-import` + skill updates ×4 + memory (§26).

**‼️‼️ MANDATORY FINAL STEP — THE MULTIDIMENSIONAL AUDIT (SOLUTION §27). DO NOT MARK THIS TASK COMPLETE WITHOUT IT. ‼️‼️**
**After the ENTIRE implementation is done, and before you report the task complete:**
1. **Audit everything** with independent reviewers, one per dimension (§27.2): no bugs, everything built exactly as the
   plan says (no missing functionality — walk every decision and section line by line), every edge case including
   re-uploads (the same provider uploaded again with MORE information fills only the gaps; with LESS information it must
   NEVER delete or empty anything already set up — §12.3), no loopholes, idempotency, best practice, accuracy of what
   customers see, cost, resilience, no regression, UX, localization, config/infra, tests, hygiene.
2. **Fix EVERY finding** in this same task, each with a test that fails without the fix.
3. **Re-check every fix on its own** — a reviewer confirms that fix really closes its finding and broke nothing; any "no"
   goes back to step 2.
Only then report complete, with the evidence listed in §27.5.
