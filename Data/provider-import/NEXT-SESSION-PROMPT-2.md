# Provider Import — continue the build (session 2 hand-over, written 2026-10-07)

Copy everything below the line into a new session.

---

Continue building the **Provider Import programme** for Clinket. The previous session built Phases 2–4, most of Phase 5,
Phase 6 code, Phase 7 and most of Phase 9, then stopped for a clean hand-over. Everything is committed and pushed on branch
**`claude/affectionate-davinci-wdczbr`** in every repo. Develop and push on that same branch. Never create a merge commit
(CLAUDE.md §0.21): use `git fetch` + `git rebase`, and prove `git rev-list --merges origin/<branch>..HEAD` prints nothing.

## 0. Where things are
- In a cloud session every repo is at `/home/user/<repo>`. The owner's `C:\Nik\<repo>` is the same repo. `C:\Nik\Data\...`
  is the **`Nik` repo's** `Data/` folder (`/home/user/Nik/Data/...`).
- Repos involved:
  - `clinqetshared`, `clinqetcore`, `clinqetinfrastructure`: libraries every host compiles in.
  - `clinqetapi`: Main API.
  - `clinqetidentity`: Identity API.
  - `clinqetfuncations`: Functions host `Clinqet.Communications`; the folder name is misspelt on purpose.
  - `cosmosindexsetup`
  - `azureautomation`: ARM + `deploy.ps1`.
  - `clinqetwebadmin`: admin web.
  - `clinqetwebpartnerapp`: provider web.
  - `clinqetwebuserapp`: customer web.
  - `clinqetmobilepartnerapp`: provider phone.
  - `clinqetmobileuserapp`: customer phone.
  - `Nik`: CLAUDE.md, skills, Data.
- .NET: `export PATH=/opt/dotnet:$PATH DOTNET_ROOT=/opt/dotnet`. Docker is available, so Testcontainers integration tests
  run (start `dockerd` if `docker info` fails). Builds are slow (a test project takes ~5 min), so run **targeted** test
  filters while working and each FULL suite **once** at the end of a phase. The owner explicitly asked not to re-run full
  suites repeatedly.
- Scratch files go only in the session scratchpad. Never `git checkout --`/`restore`/`reset`/`stash`/`clean`
  (§0.19). Do a sabotage check by copying the file to the scratchpad, mutating it, then copying it back and `diff`ing.

## 1. The project in one paragraph
Clinket is a two-sided local-services marketplace.
- **Input.** Bots scrape public data on local businesses into one JSON file per batch (schema 2.0:
  `Data/provider-import/provider-import.schema.json`; `provider-import.example.json` validates).
- **Check file.** An admin uploads the file on a new admin page, "Provider import". The system checks it against the
  schema: it keeps only what the schema defines, ignores unknown fields, prunes broken optional values, and skips only
  providers whose required parts are broken. It then cleans every value in code, merges records that are clearly one
  business, skips conflicting duplicates, matches against existing Clinket accounts, and shows a plan with a cost estimate.
- **Start import.** A Functions worker processes providers one at a time per lane (Service Bus, chained lanes):
  1. geocode;
  2. ONE AI curation call per provider, on a DEDICATED AI settings node and deployments, banked by input hash + rules version;
  3. verify every AI answer in code — nothing invented;
  4. a second opinion only when needed;
  5. take every skip decision BEFORE any account exists;
  6. call a private Identity endpoint to create the prepared (passwordless) account and its business, with deterministic ids;
  7. build the profile hidden (`BusinessProfileStatus.Pending`) through the SHARED apply half of the AI provider setup;
  8. set a web name;
  9. publish it (silent Pending → Active) or hold it for admin review with plain reasons.
- **Rules.** One summary alert per run; the provider web/app per-event alerts are unchanged. A re-upload with MORE
  information fills gaps; with LESS it NEVER deletes anything.
- **Same programme, also:**
  - removes `UserProfile.IsAdminProvisioned`;
  - fixes "Guest User" names after a take-over (N1–N5);
  - stops inventing default opening hours (owner decision A: "Hours not listed").

## 2. The authority — read these FIRST, fully
1. **`/home/user/Nik/Data/provider-import/SOLUTION.md`** — the design. It contains:
   - §2 owner decisions D1–D21;
   - §3 verified code facts;
   - §5–§19 rules, including:
     - §7 check file;
     - §8 cleaning;
     - §9 AI;
     - §10 verdict/review;
     - §11 processing stages P1–P5 / S1–S6, lanes, failures, sweeper;
     - §11A Identity endpoint;
     - §12 re-uploads;
     - §15 storage;
     - §16 queues/alerts/limits;
     - §17 settings;
     - §18 admin web;
     - §19 refactors;
   - §20 pilot;
   - §21 the edge-case catalogue (every row needs a test; test names carry the row IDs);
   - §25 build order;
   - §26 skills/memory;
   - **§27 the MANDATORY multidimensional audit**.
2. **`/home/user/Nik/Data/provider-import/BUILD-LOG.md`** — what was found and decided while building:
   - §1 pre-existing defects;
   - §2/§2a before/after test runs;
   - §3 the V-1/V-2 sweeps and fixes;
   - owner decisions of 2026-10-07 (see §3 below);
   - §5 refactor design;
   - §6 traps;
   - §7 mockup;
   - §8 Phase 2;
   - §9 R-4..R-10 Phase 4–5 design;
   - §10 R-11..R-18 orchestration decisions.
3. **`/home/user/Nik/Data/provider-import/handoff/*.md`** — one file per unfinished area. Exact file paths, what is done with
   test counts, and what is not done. **Work from these lists.** Also in that folder:
   `ProviderImportFunctions.cs.txt`, the parked Functions entry points (see §5.1).
4. The original programme prompt: `/home/user/Nik/Data/provider-import/NEXT-SESSION-PROMPT.md` (objectives, standing orders).
5. `/home/user/Nik/CLAUDE.md` — every rule is binding. Most relevant:
   - §0.6 no cross-partition Cosmos queries;
   - §0.7 no schema change beyond SOLUTION §15.1 without asking with the table;
   - §0.8 unit + real-engine integration tests;
   - §0.14 terse comments;
   - §0.16 clean tree;
   - §0.17/§0.18 test placement;
   - §0.19 no checkout/restore;
   - §0.21 linear history;
   - §0.23 bank rules versions.
6. Skills to read: `clinqet-prepared-providers`, `clinqet-ai-assistant`, `clinqet-provider-onboarding`,
   `clinqet-service-listing`, `clinqet-function-app`, `clinqet-deployment`, `clinqet-admin-app`, `clinqet-identity-api`,
   `clinqet-cosmos-data`, `clinqet-search-discovery`, `clinqet-testing`, `clinqet-notifications`, `clinqet-auth-sessions`.
   They are in `/home/user/Nik/.claude/skills/`. Note: `.github/skills` and `.cursor/rules` do NOT exist in the Nik checkout;
   update the copies that exist and say so.

## 3. Owner decisions made in the previous session (binding)
- **Hours — decision A, approved: "follow best practice, do not over-complicate".**
  - No default hours are ever stored for any business.
  - Editors (provider web/phone, admin wizard) suggest 9–5 labelled "Suggested" and store only on Save.
  - Customers see "Hours not listed", never "Closed".
  - The search index stores null (unknown) per day when a business has no rows; the day filter is unchanged (`eq true`).
  - Existing data is left alone. AI setup saves only the days it read.
- **B1:** an FAQ an admin deleted on an UNCLAIMED business comes back if a later upload carries it.
- **B2:** the admin apps' hours notice is English.
- **Mockups:** admin mockup gate waived. The provider name prompt mockup (`Data/mockups/provider-name-prompt`) is registered;
  the owner waived waiting for approval.
- **Process:** do not stop; ask only when genuinely unsure (never assume). Quality over speed. Modern, responsive design in
  the house theme.
- **Sandbox keys:** the sandbox keys in tracked appsettings are ACCEPTED. Do not report or rotate them.

## 4. Done so far (committed)
| Phase | State |
|---|---|
| 0 Research + notes | done (BUILD-LOG) |
| 2 Shared enums/settings, `PersonName`, `IsAdminProvisioned` removal + migration, PUT UserProfile marketing bug | done. ‼️ Confirm the migration is APPLIED to CA + IN: `cd cosmosindexsetup && dotnet run -- --all-regions --sql-only`, then `dotnet ef migrations list` for CA + IN (needs the owner's environment; if not possible here, list it in the final report) |
| 3 Refactors §19 (`IProviderSetupApplier` + options, `IBusinessProfileBootstrapService`, AlertMode/collector, silent `ActivateImportedAsync`, reactivate narrowing, `CreateFaqIfAbsentAsync`) | done, zero-regression proof recorded (API unit 16,411 pass; Identity integration 660) |
| 3b City-level address readers (A-1..A-6) + no-hours readers (H-1..H-5) + decision A (UI + backend: no seeded hours, `Availability.IsConfigured`, search `bool?` per day) | done |
| 4 Identity: provisioning core (`ImportProviderAccountAsync`), internal endpoint `api/v1/internal/provider-import/accounts` + `/friendly-name` (API-key filter, rate limit), `FriendlyNameService.TrySetAsync`, N1/N2/N4/N5 server, take-over lifts Pending (`LiftImportHoldAsync` + High `ProviderImportActivationFailed`), `PhoneNumberNormalizer.ParseForRegion` | code done + unit tests. **Integration tests for the endpoint + take-over NOT written** → `handoff/phase4-identity-tests-TODO.md`. Names follow-ups → `handoff/phase4-names-TODO.md` |
| 5 Functions worker | partly — see §5 |
| 6 Main API admin controller + trust-page approve | code + unit tests (187 pass). Integration tests, sabotage, full suite → `handoff/phase6-admin-api-TODO.md` |
| 7 Infra (ARM queues/container, model deployments `gpt-6-luna-import`/`gpt-6.1-sol-import`, Key Vault `ProviderImportInternalApiKey`, deploy.ps1 settings, local.settings ×3) | done |
| 9 N3 name prompt (provider web + phone), N2 UI greetings, N4 clients, snoozable dismissal, `ClaimedAt` on the profile DTO, `NamePrompt:SnoozeDays` | mostly. Customer phone N4 + greeting, provider phone N4 tests, integration runs, viewport checks → `handoff/phase9-ui-TODO.md` |
| 8, 10, 11, 12 | not started |

## 5. Phase 5 (the ongoing phase) — exact state

### Built AND tested
- **File validator (§7.2 validate-then-prune):** JsonSchema.Net 9.4.0, 39 tests, 5,000 providers in ~2.5 s.
  - `IProviderImportFileValidator`, `ProviderImportFileValidator`, `ProviderImportSchemaModel`, `ProviderImportValidationResult`;
  - schema embedded in `Clinqet.Communications/Resources/ProviderImport/`.
  - Not handled: F3 (the stamp's served countries) is left to the caller — see §5.3.
- **Cleaner / skip rules / in-file merge (§8, §7.4, §7.5):** 188 tests.
  - `NormalizedProvider`, `ImportTextRules`, `ProviderRecordNormalizer`, `ProviderImportSkipRules`, `ProviderImportDeduplicator`, `ProviderImportMerger`.
  - Sabotage not done → `handoff/phase5-normalizer-TODO.md`.
- **AI curation + verification + bank (§9):** 396 tests under `ProviderImport|BankRulesVersion`; bank pin `(1, "64f4a480857ce7ee")`.
  - In `Services/ProviderImport/Ai/`: `CurationAnswer`, `CurationPrompt`, `ProviderImportCurator`, `CurationVerifier`.
  - System prompts in Functions appsettings equal the class defaults.
  - Sabotage + DI registration still to do → `handoff/phase5-ai-curation-TODO.md`.

### Built and compiling, NOT yet tested
- **Location preparer (P1) + profile writer (S2/S3):** `ProviderImportLocationPreparer`, `ProviderImportProfileWriter` →
  `handoff/phase5-writer-preparer-TODO.md`.
- **Orchestration (Functions host, `Clinqet.Communications/Services/ProviderImport/`):** tests → `handoff/phase5-orchestration-tests-TODO.md`.
  - `ProviderImportValidationRunner` (§7.2 steps 1–9, plan, lanes, counters);
  - `ProviderImportItemProcessor` (claim, P1–P5, S1–S6, verdict, finish, pause, `Reconcile` for the second opinion);
  - `ProviderImportItemAiMeter` (§16.6 limits + warnings);
  - `ProviderImportLaneAdvancer` (send-then-complete chain, finish + recompute + summary alerts + slot release);
  - `ProviderImportSweeper` (§11.7);
  - `ProviderImportAlerts`.
- **Also built:**
  - `ProviderImportExistingMatcher` (§12.1/12.2);
  - `ProviderImportIdentityClient` (status mapping + transient retry; test file `ProviderImportIdentityClientTests.cs` exists — run it);
  - `FriendlyNameCandidates` (§11.5);
  - repositories `ProviderImportRunRepository` / `ProviderImportItemRepository`;
  - `ProviderImportBlobStore`;
  - `ProviderImportRunSlots` / `ProviderImportStatuses`;
  - `ProviderImportStageContracts.cs` (preparer, writer, photo-copier interfaces);
  - `AddProviderImportWorker` registration (partial).
- **Fixed at hand-over:** the item repository point-reads/patches now map the item KEY to the document id
  (`ProviderImportKeys.ItemId(runId, itemKey)`); `item.ItemId` is the 16-hex key. Prove it with the repository integration
  test (Phase 6 TODO 1) and check every fake/test agrees.

### 5.1 NOT done in Phase 5 — do in this order
1. **Photos S5 (§11.6):**
   - Add `IngestPublicMediaAsync(url, target)` to the EXISTING `RemoteImageIngestionService`, reusing every guard (https,
     public DNS re-checked at connect, no redirects, MIME + magic bytes, streaming size cap, max pixels). Use the PublicHost
     policy with NO extension requirement, writing to the PUBLIC media containers already used for service images,
     portfolio and profile pictures.
   - Derivatives go through the existing media-derivative queue. Image ids are deterministic:
     `DeterministicGuid(businessId, "import-image", sha256(url))`.
   - Implement `IProviderImportPhotoCopier`, mapping each source field to its target:
     - `media.logoUrl` → profile picture, only when unset;
     - `services[].imageUrls[0]` → that service (the service id is `DeterministicGuid(businessId,"import-service",SourceNameKey)`);
     - `portfolio[]` → projects;
     - `media.galleryImageUrls` → the global portfolio.
   - Caps come from §16.6. A failed image never fails the provider. No AI captions.
2. **Host wiring (§16.2 DI audit, traps T-4/T-5):**
   - Call `AddProviderImportWorker` from Functions `Program.cs` AND `FunctionAppFactory`.
   - Register: `ProviderImportCurator`, `ProviderRecordNormalizer`, `ProviderImportDeduplicator`, `IProviderImportFileValidator`,
     `IProviderImportExistingMatcher`, `IProviderImportAccountStore`, the photo copier, and the Functions services
     (`ProviderImportValidationRunner`, `ProviderImportItemProcessor`, `ProviderImportLaneAdvancer`, `ProviderImportSweeper`,
     `ProviderImportAlerts`).
   - Make sure the host has `IProviderSetupApplier` and ALL its dependencies, `IKnowledgeManagementService` (with
     `IReceptionistAvailability`, `IKnowledgeRefreshLimiter`), `IBusinessProfileBootstrapService`,
     `IProviderLifecycleService`, `ICategoryPromptService` (global categories only — `businessId: null`), `Discovery:CountryDefaults`
     in Functions appsettings (else India gets 50 km), `MaxAllowedPrice`, `CategoryAlert` settings.
   - Lifetimes: no singleton capturing a scoped dependency (`ValidateScopes`).
   - Then move `handoff/ProviderImportFunctions.cs.txt` back to `clinqetfuncations/Clinqet.Communications/Functions/ProviderImportFunctions.cs`.
     It was parked so a deployed host never runs triggers whose services are unregistered.
   - Prove the host boots: run the Functions integration factory's DI validation test.
3. **Tests for everything in "built, not tested"** — exact lists in `handoff/phase5-orchestration-tests-TODO.md` and
   `handoff/phase5-writer-preparer-TODO.md`.
   - Unit with fakes honouring ETags.
   - **Real-engine integration** (Cosmos emulator + SQL + Azurite via `FunctionAppFactory` in `Clinqet.Communications.IntegrationTests`):
     - validate → plan → start → process one provider end to end with the AI and Identity mocked at the HTTP boundary;
     - a redelivery at every checkpoint converges (no second account/service/FAQ/area/alert);
     - the writer twice (and with LESS data) leaves every document's `_etag` unchanged;
     - the finish race;
     - the sweeper.
   - Sabotage every guard.
4. **Known open items in the code:**
   - **F3:** a file whose `batch.countryCode` this stamp does not serve must fail the envelope. Find how a stamp declares
     its served countries; ASK if none exists.
   - **Offers with a `MinimumSpend` are not imported** (the applier's `ExtractedOfferDto` has no minimum). ASK the owner
     before widening the shared DTO.
   - Two CS8601 warnings in `ProviderImportProfileWriter.cs` (~L487-490).
   - `TimezoneMismatch` (§8.5.8) has no reason/note code. Decide with the owner or record it in the log.
   - `ProviderImportItemProcessor.Reconcile` is `internal static`, and Communications has no `InternalsVisibleTo` for its tests.
   - Check that the AI-outage rule R-11 (BUILD-LOG §10) stays below the queue's maxDeliveryCount 5.
   - `AiModelPinConventionTests` registry for the import deployments.
5. **Skills + memory for Phase 5.**

### 5.2 Other phases left
- **Phase 4:** `handoff/phase4-identity-tests-TODO.md` (integration tests, including a SUSPECTED DEFECT: two concurrent
  requests with the same userId may answer 500 instead of AlreadyCreated — prove it with a test, then fix) and
  `handoff/phase4-names-TODO.md` (full suite runs, "Account owner" label call sites, the GET friendlyname check onto the
  shared rules, skills).
- **Phase 6:** `handoff/phase6-admin-api-TODO.md`.
- **Phase 8 — admin web (`clinqetwebadmin`, SOLUTION §18):**
  - nav;
  - runs list `/provider-imports`;
  - new import `/provider-imports/new` (upload via the SAS link, check, plan panels "Fields we ignored" / "Values we dropped");
  - run page `/provider-imports/:runId` (counts with drill-down, items table with status filter + paging, item drawer with
    the source next to what was built, approve / bulk approve / retry / remove with typed-name confirm, cancel / resume /
    retry-failed / cost-limit / discard, CSV reports, polling every `PollSeconds`);
  - `ProviderTrustPage.jsx` Approve for a Pending business;
  - the 9 new `AdminAlertType` labels on the Alerts page;
  - admin phone `alertTypes.ts`;
  - the three `AdminPushSettings:PushableTypes` lists for the High types.
  - English (admin-internal). Modern, dense, responsive (320/375/768/1024/1440), built from the admin app's existing
    components and the `react-icons` set.
  - Tests + ESLint 0.
- **Phase 9:** `handoff/phase9-ui-TODO.md` (customer phone N4 + greeting, provider phone N4 tests, integration runs,
  viewport/simulator checks).
- **Phases 10–11:**
  - Pilot (§20) as far as the environment allows: run the pipeline on the example file and the Ontario sample with mocked
    or real sandbox AI, and record the cost/accuracy numbers in SOLUTION §20.
  - New skill `clinqet-provider-import` in every skill directory that exists, registered in the instruction files' skill
    tables (count 42 → 43).
  - Update the skills listed in SOLUTION §26.
  - Memory entry.
- **Phase 12 — the §27 MULTIDIMENSIONAL AUDIT. MANDATORY. The task is not complete without it.**
  1. Independent reviewers, one per dimension (the 15 dimensions in §27.2), audit everything.
  2. Fix EVERY finding, each with a test that fails without the fix.
  3. A reviewer who did not write the fix re-verifies EACH fix.
  4. Report with the §27.5 evidence: findings table, every suite's totals, before/after regression runs, pilot numbers,
     migration proof, clean `git status`, `git rev-list --merges` empty.

## 6. How to work
- First: read SOLUTION.md, BUILD-LOG.md and every `handoff/*.md`. `git log --oneline -15` in each repo to see the
  previous session's commits.
- Then, in order: Phase 5 §5.1 → Phase 4 TODOs → Phase 6 TODOs → Phase 8 → Phase 9 TODOs → 10–11 → 12.
- Parallel sub-agents are fine for independent pieces. Give each the exact files, the CLAUDE.md rules, "do not commit", and
  "on a build lock wait 20 s and retry; never edit another agent's in-progress file".
- Before each commit:
  - build every touched project;
  - run targeted tests;
  - delete scratch files;
  - commit per repo with clear messages ending in the session's attribution lines;
  - `git fetch` + rebase; prove no merge commits; push with `git push -u origin claude/affectionate-davinci-wdczbr`.
- Delete each `handoff/*.md` item as it is finished, and the folder when empty. Record every new decision in BUILD-LOG.md.
- Ask the owner only when genuinely unsure, with the §0.7 table for any schema question. Never assume.
