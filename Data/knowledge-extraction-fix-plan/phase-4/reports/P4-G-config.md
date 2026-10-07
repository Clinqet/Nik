# P4-G — Config / ARM / deploy hygiene and secrets posture (AI Knowledge) — closing audit

Auditor G · read-only · 2026-09-25 · code AS IT IS NOW (HEAD + working tree of every repo; no build, no test, no git write).
No secret value appears anywhere in this report. Sandbox keys in tracked settings files are owner-accepted (CLAUDE.md §19)
and are not reported.

---

## 1. Scope actually read

**Read in full**

| File | Lines |
|---|---|
| `clinqetshared/Models/VoiceKnowledgeSettings.cs` (Voice:Knowledge + Images + ServiceDrafts) | 534 |
| `clinqetshared/Models/VisionTranscriptionSettings.cs` | 149 |
| `clinqetshared/Models/SearchTopologySettings.cs` | 92 |
| `clinqetshared/Models/BusinessSearchSettings.cs` | 300 |
| `clinqetshared/Models/AIServiceSettings.cs` | 151 |
| `clinqetcore/Models/Storage/StorageConfiguration.cs` | 96 |
| `clinqetshared/Models/PriceReviewCeiling.cs`, `RemoteImageIngestionSettings.cs`, `ServiceBusSettings.cs`, `Constants/KnowledgeRefusedFormats.cs`, `Constants/AiModels.cs` (values) | ~70 / 40 / 70 / 40 |
| `clinqetcore/Models/Knowledge/KnowledgeProcessingRules.cs`, `KnowledgeDraftAnalyticsRules.cs` | 45 / 20 |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeSpaceReservation.cs` | 128 |
| `clinqetfuncations/Clinqet.Communications/Services/KnowledgeDocumentFormats.cs` | 58 |
| `clinqetfuncations/Clinqet.Communications/host.json` | 36 |
| API `Conventions/VoiceKnowledgeSettingsConventionTests.cs` · `KnowledgeIngestTimeoutParityConventionTests.cs` · `OcrPageCacheKeyTests.cs` · `ScriptThresholdsAgreeAcrossHostsTests.cs` | 265 / 71 / ~110 / 96 |
| Functions `Conventions/VoiceKnowledgeSettingsConventionTests.cs` · `KnowledgeParseRoutingConventionTests.cs` | 179 / 58 |
| MCP `Conventions/VoiceAnswerLadderSettingsConventionTests.cs` | 254 |

**Read in part (the stated ranges, end to end)**

- `KnowledgeIngestProcessorFunction.cs` (3,730): 180-520, 560-600, 760-830, 1380-1425, 1570-1640, 2960-2990, 3180-3380, 3490-3540.
- `KnowledgeServiceDraftAnalyticsJob.cs` (1,585): 40-75, 140-150, 180-330, 400-490, 540-556, 720-740, 880-892.
- `KnowledgeManagementService.cs`: 150-340, 395-470, 600-720. `KnowledgeController.cs` (1,264): 130-405, 1060-1080, 1210-1255.
- `KnowledgeDocumentParser.cs` 1-80; `ProviderSetupDocumentReader.cs` 40-290; `BusinessSearchDocumentService.cs` 40-100, 200-240;
  `KnowledgeBlobPaths.cs` 1-175; `KnowledgeIngestQueue.cs` 20-110; `KnowledgeAnalyticsQueue.cs` 40-74; `AiBudgetGovernor.cs` 17-75;
  `RemoteImageIngestionService.cs` 80-100, 300-345; `FileValidationHelper.cs` 20-90; `DocumentIntelligenceService.cs` 1250-1275;
  `KnowledgeServiceCandidateDetector.cs` 160-250; `KnowledgeCandidates.cs` 40-60.
- Program.cs of API (665-700, 895-915, 995-1060, 1115-1135), Functions (480-490, 505-512, 645-655, 740-750, 810-885), MCP (130-140, 250-305, 370-380) — every knowledge registration.
- `azureautomation/deploy.ps1` (692 KB — NOT read end to end; grep-driven): 1640-1705, 1725-1740, 1851-1910, 1972-2012, 2076-2232, 7314-7450, 7680-7720, 7964-7980, 8060-8110, 8263-8420, 8720-8810, 8950-8985. `events.json` 1130-1200 (knowledge-ingest queue). `storage.json` 28-56, 268-360, 700-725. `networking.json` 690-720 (storage WAF).
- Web `knowledgeMeta.js` 1-60, 90-235; `UploadKnowledgeModal.jsx` 50-95; `KnowledgePage.jsx` 318-335; `knowledgeGuards.test.js` 525-660; `public/lang/en-US.json` 6954-6957.
- Mobile `Util/mediaLimits.ts` 1-120; `Screen/ProfileFlow/Knowledge/index.tsx` 205-295, 540-590, 800-890; `__tests__/knowledgeImagesParity.test.ts` 266-300.
- Authority docs: AGENT-BRIEF, PHASE-4 prompt, PLAN.md, FINDINGS §2.E/F/H/§3/§9/§10, phase-1/2/3 AUDIT config sections, PROGRESS-SESSION2 §8 + §15 (gotchas 11-28), LIVE-ACCEPTANCE §7.11/§7.18-7.20, memory `appsettings-class-defaults-are-appended-not-replaced`.

**Settings files — knowledge sections extracted mechanically** (a scratch JSONC reader in the session scratchpad; values of
secret-named keys redacted at extraction): API `appsettings{,.ca,.in,.Development}.json`, Functions `appsettings.json`,
MCP `appsettings{,.ca,.in}.json`, Identity `appsettings{,.ca,.in}.json`, cosmosindexsetup `appsettings{,.ca,.in}.json`.
Functions `local.settings{,.ca,.in}.json`: **key structure only**.

**Also run (read-only):** the `%binding%` survey (§A4), a reader scan of every settings property (`\.Prop\b`) over all
non-test source, the v5 Service Bus extension's own option names (from the NuGet cache), and a count — never a print —
of repo files containing the value in `secrets\ca-servicebus.txt`.

Not in scope / not done: live app settings on Azure (no portal/CLI access from a read-only pass — marked NEEDS-LIVE-PROOF
where it matters), dimension-C/D/F behaviour beyond what the config trace needed.

Cross-reference: several defects below were ALSO found by other dimensions (their ids are named). They are listed here
because checks 2, 6 and 8 of this dimension require the cross-layer list and the arithmetic; the orchestrator should
de-duplicate on the named id.

---

## 2. Findings

### 2.1 Summary

| Id | Sev | Title | Same defect elsewhere |
|---|---|---|---|
| P4-G-01 | **High** | `.csv` and `.tif` are accepted by the API extension gate and read by the Functions pipeline, but refused by BOTH provider clients before upload; tests pin the refusal | = P4-F-05 |
| P4-G-02 | **High** | Even with the clients fixed, the API's knowledge `AllowedMimeTypes` refuses `application/vnd.ms-excel` — the MIME Windows+Excel sends for a `.csv`, which the server's own consistency helper was written to accept | new |
| P4-G-03 | **High** | The three `SpaceEstimate*` dials are read only by `GetSpaceBudgetAsync`, which nothing calls: the "approved 2026-09-18" upload-time reservation is dead, the dials are configured nowhere, and the API guard forbids configuring them | = P4-C-04 (config view) |
| P4-G-04 | **High** | `ServiceDrafts:TimeoutSeconds` = 3600 s exceeds the host's `functionTimeout` 2700 s, contradicting the class's own rule; the job's budget branch is unreachable | = P4-D-01 (+ live app setting, P4-G-19) |
| P4-G-05 | **High** | `AdminAlertPriceMultiplier` and `MaxAllowedPriceByCurrency` are configured and read by NOTHING; `PriceReviewCeiling.AdminAlertFor` has no caller — the owner's "different ceiling for admin alert" is not implemented | = P4-D-10 |
| P4-G-06 | Medium | `StaleProcessingMinutes` (160) is derived from ONE delivery chain (30 min × 5) and is shorter than a healthy multi-pass / queued / retried reading | = P4-C-09 (arithmetic here) |
| P4-G-07 | Medium | `QueuedStaleAfterMinutes` (180) is shorter than the analytics ladder's own worst case at the current `TimeoutSeconds` (261 min) — a coupled dial that did not move (gotcha 22) | partly P4-D-01 fix note |
| P4-G-08 | Medium | `ProcessingMaxMinutes` serves the per-DELIVERY deadline (30) as if it were the document's ceiling; after E12 continuations the row says "a long scan can take up to 30 minutes" and both apps stop watching at ~30 min | new |
| P4-G-09 | Medium | Retry message ids are not generation-scoped, so the queue's PT10M duplicate window can silently swallow a later reading's retry | = P4-C-10 |
| P4-G-10 | Low | The API host reads 5 parser keys (and the 3 `SpaceEstimate*`) it does not configure; its "exactly what this host reads" registry is wrong about the parser constructor | new |
| P4-G-11 | Low | The Functions host configures 8 `Voice:Knowledge` keys it never reads (+2 read nowhere), and its guard REQUIRES them to be present | new |
| P4-G-12 | Low | `Voice__Knowledge__Vision__VerifyDeploymentName` is stamped on the API app and REQUIRED by the deploy check, but nothing in the API reads it; three deploy.ps1 comments claim a page-cache key shape the code explicitly rejects | new |
| P4-G-13 | Low | host.json carries two keys the Service Bus v5 extension does not map (`serviceBus.autoComplete`, `sessionHandlerOptions.messageWaitTimeout`) | new (P4-J confirmed `maxConcurrentSessions` IS mapped) |
| P4-G-14 | Low | Inline `GetValue` / class defaults that disagree with appsettings: `AiBudget:MaxBulkConcurrency` 2 vs 4, `AzureAIFoundry:TimeoutSeconds` 30 vs 100, cosmosindexsetup `KnowledgeIndexVersion` null vs `v2` | new |
| P4-G-15 | Low | `StorageConfiguration:ProviderKnowledge:MaxFileCount` = 20 is read by nothing — the removed document cap's number survives as a dead knob | = P4-I INC-6 |
| P4-G-16 | Low | Two admin-alert "dial" labels name settings that do not exist (`Search:KnowledgeIndexName`, `Voice:Knowledge:MaxAllowedPrice`) | MaxAllowedPrice half = P4-D-10 |
| P4-G-17 | Low | Collection defaults appended by the binder: `PriceFieldLabels` binds 48 entries (24 × 2), `DefaultTemperatureOnlyDeployments` 2, `RemoteImageIngestion` lists doubled; the guards compare JSON, not the bound object | new |
| P4-G-18 | Low | Stale numbers inside settings comments ("20 MB upload limit", "a 500-page document", "5 rounds", a ceiling-based "3300s") | new |
| P4-G-19 | Low · NEEDS-LIVE-PROOF | A hand-set Functions app setting `Voice__Knowledge__ServiceDrafts__TimeoutSeconds` (3600) exists outside deploy.ps1 and would survive a fix to appsettings | new |
| P4-G-20 | Improvement | Missing cross-layer guards (allow-list ⇄ pipeline ⇄ pickers; budgets ⇄ host.json; stale windows ⇄ ladders; ARM retention ⇄ app setting; two file-size knobs) | new |

**Counts: High 5 · Medium 4 · Low 10 · Improvement 1 (20).** Of these, 8 are the same defect another dimension also found.

---

### P4-G-01 · High · `.csv` / `.tif` accepted by server and pipeline, refused by both provider clients

**Where / evidence**
- API accepts both: `clinqetapi/Clinqet.API/appsettings.json:3136-3157` —
  `"AllowedExtensions": [ ".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md", ".json", ".csv", ".html", ".htm", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".tif", ".bmp" ]`.
- Functions reads both: `Functions/KnowledgeIngestProcessorFunction.cs:1621-1622` `case ".csv": return _parser.ParseCsv(KnowledgeTextDecoder.Decode(blobBytes));`;
  `Services/KnowledgeDocumentFormats.cs:14-17` `DiExtensions = { ".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp" }`.
- Web refuses: `clinqetwebpartnerapp/src/components/Profile/knowledge/knowledgeMeta.js:6-25` `ACCEPTED_EXTENSIONS` (no `.csv`, no `.tif`);
  `:36-37` `const CONVERT_HINTS = { ".csv": "knowledge.upload.convertToExcel", …`; `UploadKnowledgeModal.jsx:63-73` rejects on the hint first,
  then on `!isAcceptedKnowledgeExtension(ext)`. `EXTENSION_MIME` (`knowledgeMeta.js:206-225`) has no `.csv`/`.tif` either.
- Mobile refuses: `clinqetmobilepartnerapp/src/Util/mediaLimits.ts:40-47` — comment *"Mirrors StorageConfiguration:ProviderKnowledge"* over
  `allowedExtensions: ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.md', '.json', '.html', '.htm', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp']`;
  `Screen/ProfileFlow/Knowledge/index.tsx:215-216` `const CONVERT_HINTS … = { '.csv': 'excel', …`; `:246-251` `resolvePickedRejection`.
- Tests pin the refusal: web `knowledgeGuards.test.js:617` *"CSV parsing was considered and DEFERRED"* and `:622`
  `it.each([[".csv"], [".tsv"], [".xls"]])("sends %s to Excel", …)`; mobile `__tests__/knowledgeImagesParity.test.ts:276`
  `expect(flat).toContain("'.csv': 'excel'");`. The web suite header (`knowledgeGuards.test.js:528-530`) claims the list
  *"mirrors the server's always-on StorageConfiguration:ProviderKnowledge contract"* — it does not (18 vs 16 extensions).
- Same class, provider-setup lane: API `ProviderSetupDocuments.AllowedExtensions` includes `.tif`; web `AIAssistantModal.jsx:49` and mobile
  `AIAssistantModal.tsx:90` list `.tiff` only.

**Violates.** A19 (Phase 1 added `.tif` "end to end"; Phase 2 §8 "`.csv` in" — *"A CSV is the format most likely to BE a price list"*); the
U-12 sheet ("every accepted kind named to the phone's file picker"); owner ruling 1 (A19 is a §2.A extraction item ⇒ High).

**Failure scenario.** A provider picks `rates.csv` (a dealer export) or a scanner's `menu.tif` on web or phone → the row is refused before
upload ("open it in Excel, save as .xlsx" / "type not allowed") → the Phase-2 CSV table reader and the Phase-1 `.tif` fix are unreachable
from every UI; only a direct API call reaches them.

**Fix direction.** Add `.csv`/`.tif` to both accept lists and MIME maps, drop `.csv` from both convert maps (keep `.tsv/.xls/.doc`), rewrite
the two pinning tests with the reason, then add the guard in P4-G-20. **Confidence:** high.

---

### P4-G-02 · High · The API's knowledge MIME allow-list refuses the MIME Windows sends for a `.csv`

**Where / evidence**
- Gate order, `KnowledgeController.cs:237-257`: extension allow-list → `var mimeAllowed = constraints.AllowedMimeTypes.Contains(file.ContentType, …);`
  `if (!mimeAllowed || !FileValidationHelper.IsExtensionMimeTypeConsistent(extension, file.ContentType))` → `Error_UploadUnsupportedMimeType`.
- The list, `appsettings.json:3159-3176`: `"AllowedMimeTypes": [ …, "text/plain", "text/markdown", "application/json", "text/csv", "application/csv", "text/html", … ]`
  — **no `application/vnd.ms-excel`**.
- The server's own helper deliberately accepts that pair, `clinqetshared/Extensions/FileValidationHelper.cs:52-58`:
  *"‼️ Windows with Excel installed reports a .csv as an EXCEL type, and the browser sends what the operating system says — refusing that pair
  would refuse most Windows uploads of an ordinary CSV."* `… || mimeType.Equals("application/vnd.ms-excel", …) || mimeType.Equals("text/plain", …)`.
- The web client sends the browser's type first (`knowledgeMeta.js:227` `file?.type || EXTENSION_MIME[…] || "application/octet-stream"`).

**Violates.** Phase 2 §8 (`.csv` in); the helper's stated intent; FINDINGS A19. Masked today only because P4-G-01 refuses `.csv` earlier.

**Failure scenario.** After P4-G-01 is fixed, a provider on Windows with Excel installed uploads `prices.csv` → browser Content-Type
`application/vnd.ms-excel` → the per-file slot fails "unsupported file type" → the commonest desktop CSV never reaches the reader.
(Android pickers may report `text/comma-separated-values`, also absent — UNCERTAIN, needs a device.)

**Fix direction.** Add `application/vnd.ms-excel` (and evaluate `text/comma-separated-values`) to `StorageConfiguration:ProviderKnowledge:AllowedMimeTypes`
— safe, because the extension gate binds first (`.xls` stays refused by extension). Pin with a test that feeds every extension×MIME pair the
helper calls coherent through the real bound allow-list. **Confidence:** high on code; browser MIME NEEDS-LIVE-PROOF.

---

### P4-G-03 · High · `SpaceEstimate*` read only by dead code; the approved upload-time reservation is not wired

**Where / evidence**
- The dials, `VoiceKnowledgeSettings.cs:22-31`: *"‼️ Upload-time space reservation (approved 2026-09-18) … the upload gate RESERVES an estimate … Read by the API
  upload gate only"* → `SpaceEstimateDefaultPassages = 100`, `SpaceEstimateSampleSize = 20`, `SpaceEstimateMinSamples = 3`.
- Their only reader: `KnowledgeSpaceReservation.EstimateNewFile` (`KnowledgeSpaceReservation.cs:51-80`), reached only from
  `KnowledgeManagementService.GetSpaceBudgetAsync` (`:654-671`). **No caller of `GetSpaceBudgetAsync` exists in any repo, and no test references
  `KnowledgeSpaceReservation` or `GetSpaceBudgetAsync`** (grep over all repos, bin/obj excluded).
- The SAS gate still applies the pre-reservation rule, `KnowledgeController.cs:195-196`:
  `var (usedPassages, maxPassages) = await _knowledgeService.GetPassageUsageAsync(businessId); if (usedPassages >= maxPassages)`.
- Config: the API `Voice:Knowledge` block (`appsettings.json:230-278`) has no `SpaceEstimate*`; the API guard's registry
  (`Conventions/VoiceKnowledgeSettingsConventionTests.cs:33-122`) omits them, so ADDING them fails `TheBlockContainsExactlyTheKeysThisHostReads`
  ("unread but configured"); meanwhile the Functions guard exempts them because *"clinqetapi upload gate … reads"* them
  (`Functions/…/VoiceKnowledgeSettingsConventionTests.cs:47-49`). Two guards, two contradictory claims, both green.
- History: infrastructure `69e3d44` + Functions `dfb097a` (2026-09-23) added the reservation and the Functions pickup gate; the API repo has no
  matching commit (last controller change `b149cb5`, search topology).

**Violates.** The approval the code itself records (2026-09-18); §0.12 / check 2 (a dial read in a host that does not configure it); §22.2 (dead code).

**Failure scenario.** A provider at 1,950 / 2,000 parts drops ten 100-part brochures → every file gets an upload link (`1,950 < 2,000`) → the
first reads, the rest are refused at pickup (`SpaceFullNotRead`) after the provider watched them upload — exactly what the reservation's own
doc comment says it exists to prevent.

**Fix direction.** Wire `GetSpaceBudgetAsync` into the SAS gate per file (and the reprocess gate), configure the three keys in the API and list
them in the API registry, add unit + integration tests — or delete the class, the method, the three settings and the Functions exemption.
Needs the owner to say which. **Confidence:** high that it is unwired; the "approved" status rests on the code comment only (no PLAN/SKILL/memory
records it).

---

### P4-G-04 · High · Drafts job budget (3600 s) is longer than the host's function timeout (2700 s)

**Where / evidence**
- `VoiceKnowledgeSettings.cs:496-503`: *"Owner-set 25 min (2026-08-29); must stay under host.json functionTimeout (45 min) and the 1 h lock renewal."*
  … `public int TimeoutSeconds { get; set; } = 3600;` Functions `appsettings.json:1351` `"TimeoutSeconds": 3600`; API `appsettings.json:274` (served as
  `analyticsMaxMinutes` = 60, `KnowledgeController.cs:151`).
- `host.json:4` `"functionTimeout": "00:45:00"`; `:32` `"maxAutoLockRenewalDuration": "01:00:00"`. No deploy.ps1 override of either (grep).
- The job runs INSIDE `ProcessKnowledgeIngest` (`KnowledgeIngestProcessorFunction.cs:502-505` `if (message.Mode == KnowledgeIngestMode.Analytics) { await _analyticsJob.RunAsync(…, hostCancellation); return; }`),
  so the host's 45-min limit bounds it. Its own budget: `KnowledgeServiceDraftAnalyticsJob.cs:45-46` `MinTimeoutSeconds = 1; MaxTimeoutSeconds = 3600;`
  `:206-208` `budget.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_settings.TimeoutSeconds, MinTimeoutSeconds, MaxTimeoutSeconds)));`
- A host timeout lands in `:228-234` `catch (OperationCanceledException) when (hostCancellation.IsCancellationRequested) { … "interrupted by host shutdown … it will be redelivered." … throw; }`
  — not in the budget branch that stamps `Error_KnowledgeDraftAnalyticsTookTooLong` and raises `ReportTimeBudgetExceededAsync` naming the dial.
- The class's own ceiling arithmetic already exceeds the host limit: `VoiceKnowledgeSettings.cs:510` *"At 4 a cap-1000 document needs 3300s of the 3600s budget"* (3,300 > 2,700).
- History: raised 1500 → 3000 with `BulkHttpTimeoutSeconds` (LIVE-ACCEPTANCE row 27, X-07), later 3600; nobody reconciled it with `functionTimeout`
  (knowledge-analytics-job `PLAN.md:32` D5 set the 45-min timeout precisely as the bound for these budgets).

**Violates.** The invariant stated in the setting itself; gotcha 22 (coupled dials); gotcha 25 (the three failure branches must each land).

**Failure scenario.** A throttled 1,000-candidate run passes 45 min → the host cancels → logged as a graceful drain → the same attempt redelivers
and restarts from scratch (row still `Queued`, attempt unchanged), up to `maxDeliveryCount` 5 → Service Bus dead-letters it with no `FailAsync`,
no provider sentence, no alert naming the dial; the row says "Analysing" until the 180-min stale window. Up to 5 × 45 min of repeated judge +
extractor spend. (Whether a function timeout also recycles the worker — cancelling every other in-flight invocation on that instance — is
UNCERTAIN / NEEDS-LIVE-PROOF.)

**Fix direction.** Make `TimeoutSeconds` < `functionTimeout` − pre-run load (e.g. 2400) or raise `functionTimeout` (≤ lock renewal) together; extend
`WarnIfTheBudgetCannotCoverOneCallAsync` to check the host timeout; pin both with a test that reads `host.json`; remove the hand-set app setting
(P4-G-19). **Confidence:** high on the numbers; runtime blast radius NEEDS-LIVE-PROOF.

---

### P4-G-05 · High · The admin price ceiling and the per-currency override are dials nothing reads

**Where / evidence**
- `VoiceKnowledgeSettings.cs:422-429`: *"‼️ The SECOND threshold, and it is a MULTIPLE of the first … an admin hears only about the genuinely odd ones"*
  `AdminAlertPriceMultiplier = 10m`; *"A lane may state an absolute review threshold for any currency here"* `MaxAllowedPriceByCurrency`.
  Configured: Functions `appsettings.json:1328-1329`.
- Readers: **none** — the only occurrences of either name are the class and that appsettings block (repo-wide grep).
- `PriceReviewCeiling.cs:57-66` `AdminAlertFor(...)` (*"THE SECOND, HIGHER THRESHOLD — the one that pages an ADMIN (owner, 2026-09-12: "different ceiling for admin alert")"*) — **no caller**.
- The only ceiling computation passes no overrides: `DocumentIntelligenceService.cs:1267-1268` `=> price > PriceReviewCeiling.For(maxAllowedPrice, currency?.ToString());`
- The admin alert fires on the PROVIDER's threshold: `KnowledgeServiceDraftAnalyticsJob.cs:726-731` `var beyondCeiling = extractedServices.Count(s => s.PriceBeyondReviewCeiling); …`
  `"KnowledgeDraftPriceBeyondReviewCeiling", "Voice:Knowledge:MaxAllowedPrice", (int)_settings.MaxAllowedPrice, …` (label and number: P4-G-16).
- Commit `f90cc0a` (Functions) message: *"A second, higher threshold (AdminAlertPriceMultiplier) decides when an ADMIN hears about it … plus an optional absolute per-currency override from settings."*

**Violates.** The owner ruling quoted in the code (2026-09-12); check 2 (two orphan dials).

**Failure scenario.** An INR price list with prices between ₹30 crore (review ceiling 5,000,000 × 60) and ₹300 crore pages an admin although the
design says only ≥10× should; an operator who sets `MaxAllowedPriceByCurrency:INR` sees no effect anywhere.

**Fix direction.** Compute `beyondAdminCeiling` with `AdminAlertFor(MaxAllowedPrice, currency, AdminAlertPriceMultiplier, MaxAllowedPriceByCurrency)`
and gate the alert on it; pass `MaxAllowedPriceByCurrency` into `For(...)`; or delete both dials and `AdminAlertFor`. **Confidence:** high.

---

### P4-G-06 · Medium · `StaleProcessingMinutes` (160) is shorter than a healthy reading can legitimately take

**Where / evidence**
- `VoiceKnowledgeSettings.cs:237-240`: *"Above IngestTimeoutSeconds x RetrySettings:MaxDeliveryCount (30 min x 5 = 150 min), so a run that is merely slow is never cut off by its own owner clicking Try again."* → `160`.
- The clock is `ProcessingSince`, stamped at confirm/replace (`KnowledgeManagementService.cs:194, 231`), reprocess (`:433`) and re-cut (Functions `:3215`) —
  **never** by a continuation (`KnowledgeIngestProcessorFunction.cs:788-798` enqueues pass N+1 and returns with no row write) or a scheduled retry (`:340-352`).
  Rule: `KnowledgeProcessingRules.cs:22-24`.
- Arithmetic (all values from Functions `appsettings.json`):
  - E12 chain: `MaxReadingContinuations` 8 ⇒ 9 passes; per pass up to `Vision.TimeBudgetSeconds` 900 s + `PipelineReserveSeconds` 180 s
    ⇒ 9 × 1,080 s = **9,720 s = 162 min > 160**, before DI time, contention (the setting's own note: 3.45×) or queueing.
  - Session FIFO: `KnowledgeIngestQueue.SessionId(businessId) => businessId` (`KnowledgeIngestQueue.cs:24`); a continuation *"queues behind that business's other work"* (`:76-78`).
    N documents uploaded together ⇒ the N-th document's clock runs while the other N−1 read.
  - Scheduled retries with nothing wrong with the file: `IngestRetryAttempts` 5, delays `30 × 4^(n−1)` capped 1,800 ⇒ 30 + 120 + 480 + 1,800 = 2,430 s waiting
    + 5 × 1,800 s runs ⇒ up to **190.5 min**.
- Effects: `Stopped: true` in the DTO (`KnowledgeController.cs:1216`) ⇒ both apps show "stopped part way" + Try again; `ReprocessAsync` accepts it
  (`KnowledgeManagementService.cs:425-427`), re-stamps `ProcessingSince`, clears `ContentHash`, and queues a second Full ticket behind the live one.

**Violates.** U-04's premise (stale = nothing drives it); the owner rule "never promise an outcome the code does not deliver" (PLAN approval change 3).

**Failure scenario.** Three 100-page scans uploaded together under load (~6 passes each, interleaved on one session) → at minute 160 all still-reading
rows flip to "This one stopped part way through" → the provider presses Read again → a second chain is queued behind each live one.

**Fix direction.** Refresh a liveness stamp per pass/retry, or derive the window from `(MaxReadingContinuations+1) × IngestTimeoutSeconds` + retry waits and
refuse Reprocess while a ticket for the row is queued. **Confidence:** high on arithmetic; multi-document chain NEEDS-LIVE-PROOF.

---

### P4-G-07 · Medium · `QueuedStaleAfterMinutes` (180) is shorter than the analytics ladder at `TimeoutSeconds` 3600

**Where / evidence**
- `VoiceKnowledgeSettings.cs:518-520` *"A Queued ticket older than this has no live run behind it"* → `QueuedStaleAfterMinutes = 180`.
- Measured from the GENERATION stamp: `KnowledgeDraftAnalyticsRules.cs:12-14` `… && analytics.RunAt > utcNow.AddMinutes(-Math.Max(1, staleAfterMinutes));`
  and a retry keeps the generation (`KnowledgeAnalyticsQueue.cs:49-62`, `messageId: MessageId(businessId, docId, generationTicks, attempt)`), so the window spans the whole ladder.
- Ladder: `MaxAttempts` 4; per attempt `TimeoutSeconds` 3600 (host-capped 2700, P4-G-04); back-off `KnowledgeServiceDraftAnalyticsJob.cs:243`
  `RetryBackoffSeconds * 2^(attempt−1)` = 180 + 360 + 720 = 1,260 s.
  Worst case 4 × 3,600 + 1,260 = **15,660 s = 261 min** (at the host cap 4 × 2,700 + 1,260 = 201 min) > 180. The window was sized for 1500 s
  (4 × 1,500 + 1,260 = 121 min — LIVE-ACCEPTANCE §7.11 *"4 × (1500 + 180) ≈ 112 minutes"*) and did not move when the budget did.
- Effects: `KnowledgeController.cs:1245` maps it to Failed `Error_KnowledgeDraftAnalyticsStalled`; `KnowledgeDraftApprovalService.cs:1104` lets Re-run start
  a new generation over a live ladder. (The old ladder's pending attempt then runs the NEW generation with its own attempt number — it reads the
  generation from the row, `KnowledgeServiceDraftAnalyticsJob.cs:194` `var generation = stamp.RunAt.Ticks;` — so the new run can start with fewer retries left.)

**Violates.** Gotcha 22 (coupled dials); "never promise an outcome the code does not deliver".

**Failure scenario.** A throttled platform makes each attempt run ~50 min and fail transiently → at 3 h the provider sees "stalled, Try again"
while attempt 4 is still queued → Re-run doubles the AI spend.

**Fix direction.** Derive the window from `MaxAttempts × (min(TimeoutSeconds, functionTimeout) + max back-off)` + margin, or re-stamp a per-attempt
liveness field; pin it with a coupled-dials test. **Confidence:** high on arithmetic; low frequency.

---

### P4-G-08 · Medium · `ProcessingMaxMinutes` serves ONE delivery's deadline as the document's ceiling

**Where / evidence**
- Served: `KnowledgeController.cs:152` `(int)Math.Ceiling(Math.Max(1, _settings.IngestTimeoutSeconds) / 60.0)` ⇒ 30.
- `IngestTimeoutSeconds` is per delivery (`KnowledgeIngestProcessorFunction.cs:264-271` `deadline.CancelAfter(TimeSpan.FromSeconds(deadlineSeconds))` for each message).
- Rendered as a promise: web `KnowledgePage.jsx:326-330` `intl.formatMessage({ id }, { minutes: processingMaxMinutes })` with
  `en-US.json:6956` `"knowledge.row.readingLongScan": "a long scan can take up to {minutes} minutes"`; mobile mirrors (`index.tsx:1447`, `:2093`).
- Watching stops at that budget: `knowledgeMeta.js:157-176` `POLL_STEPS_MS = [20000, 45000, 90000, 180000, 300000]` repeated until
  `processingMaxMinutes` is spent (`MAX_POLLS = 24`); mobile `index.tsx:546, 563`.
- After E12 a single document legitimately spans several deliveries (P4-G-06 arithmetic; the setting's own note: *"a full 100-page document needs about 1,465s against a 900s window — two passes"*),
  plus scheduled retries of up to 1,800 s each.

**Violates.** E8/U-03's intent ("the ladder ends at the server's own deadline … so the two can never disagree again", `knowledgeMeta.js:130-133`) —
E12 made the served number no longer the deadline of the reading; PLAN approval change 3.

**Failure scenario.** A 100-page scan needs two passes (~32 min) → at minute 30 the row still says "can take up to 30 minutes" and the page stops
refreshing; when it finishes the provider only learns by reloading.

**Fix direction.** Serve a document-level ceiling (e.g. `(MaxReadingContinuations+1) × IngestTimeoutSeconds`, or better the row's own pass
count/elapsed) and word the long-scan line without a hard ceiling the pipeline does not enforce. **Confidence:** high.

---

### P4-G-09 · Medium · Retry ids are not generation-scoped; the PT10M duplicate window can drop a later reading's retry

**Where / evidence**
- `KnowledgeIngestQueue.cs:70-72`: *"The ATTEMPT is the identity"* `messageId: $"{businessId}:{docId}:{mode}:retry{attempt}"`; a fresh Full ticket has
  `Attempt = 1` (`KnowledgeIngestQueueMessage.cs:21`), so every generation's first retry is `…:Full:retry2`.
- Queue: `azureautomation/events.json:1171-1176` `"requiresDuplicateDetection": true … "duplicateDetectionHistoryTimeWindow": "PT10M"`.
- Contrast: the analytics lane scopes by generation (`KnowledgeAnalyticsQueue.cs:62` `MessageId(businessId, docId, generationTicks, attempt)`).

**Failure scenario.** A DI 503 fails reading A → `…:Full:retry2` sent at T0; it succeeds → Ready. The provider presses Read again (or replaces) at T0+3 min and
DI flaps again → `…:Full:retry2` inside the 10-min window → accepted-and-dropped by the broker, the current message completes, the row sits Processing
with nothing driving it (no alert — the send "succeeded") until the 160-min stopped window.

**Fix direction.** Include the generation (e.g. `ProcessingSince` ticks) in the retry and continuation ids. **Confidence:** medium (depends on the
broker's send-time duplicate semantics for scheduled messages — standard behaviour, not proven live here).

---

### P4-G-10 · Low · API reads keys it does not configure; its registry misdescribes the parser

**Where / evidence**
- The API registers the parser as a singleton (`clinqetapi/Clinqet.API/Program.cs:900`); its constructor reads nine `Voice:Knowledge` values
  (`KnowledgeDocumentParser.cs:29-41`: `EmbeddedImageMinBytes`, `Images.MaxSourceImageBytes`, `JsonTableMinRows`, `JsonTableMinKeyOverlap`, `JsonMaxPathDepth`,
  `Images.MaxFigureAreaRatio`, `Images.MaxTotalMediaBytes`, `Images.MaxSectionsPerImage`, `XlsxRegionBlankRowGap`).
- The API block configures four of them; **`EmbeddedImageMinBytes`, `JsonTableMinRows`, `JsonTableMinKeyOverlap`, `JsonMaxPathDepth`, `XlsxRegionBlankRowGap` are not configured**
  in the API. The registry says (`API VoiceKnowledgeSettingsConventionTests.cs:45-47`) *"‼️ KnowledgeDocumentParser reads these THREE IN ITS CONSTRUCTOR"* — it reads nine.
- Plus the three `SpaceEstimate*` (P4-G-03) and `Vision.TranscribePromptTemplate` (folded into `PromptFingerprint`, `BusinessSearchDocumentService.cs:65-66, 235-236`;
  that one IS pinned equal to the Functions copy by `OcrPageCacheKeyTests.TheTwoHosts_ShipTheSamePromptTemplate_OrTheCacheNeverHits` — verified OK).

**Violates.** §0.12 / check 2 ("no key READ in a host that does not configure it"); the E-25 lesson (a hand-written registry that agrees with appsettings
while neither agrees with the code). The source-reading guard only scans `ServiceDrafts` keys in two files (`:209-238`).

**Failure scenario.** An operator tunes `XlsxRegionBlankRowGap` in the Functions file; the knowledge lane changes, the provider-setup lane (same parser, API
host) silently stays on the class default. Values are equal today — no behaviour difference yet.

**Fix direction.** Configure the five keys in the API block and list them in the registry; extend the source-reading guard to the parser constructor.
**Confidence:** high.

---

### P4-G-11 · Low · The Functions host configures keys it never reads, and its guard requires them

**Where / evidence**
- Configured in Functions `appsettings.json` but read by no class registered in the Functions host (readers are `KnowledgeManagementService`,
  `KnowledgeDraftApprovalService`, `KnowledgeController` — API only): `MaxTypedFaqs` (`:1272`), `MaxLinkedServicesPerDocument` (`:1273`),
  `StaleProcessingMinutes` (`:1307`; the Functions host only names it in an alert label, `KnowledgeIngestProcessorFunction.cs:2977`), `UsualProcessingMinutes` (`:1308`),
  `ServiceDrafts:ApprovedTtlDays` (`:1335`), `ServiceDrafts:DraftsPageSize` (`:1336`), `ServiceDrafts:ApproveBatchSize` (`:1337`), `ServiceDrafts:QueuedStaleAfterMinutes` (`:1355`).
  Read nowhere at all: `ServiceDrafts:AdminAlertPriceMultiplier`, `ServiceDrafts:MaxAllowedPriceByCurrency` (`:1328-1329`, P4-G-05).
- The guard demands every non-exempt property be present: `Functions/…/VoiceKnowledgeSettingsConventionTests.cs:109-110`
  `Assert.True(configuredNames.Contains(property.Name), $"{pathPrefix}:{property.Name} exists on the class but is missing from this host's appsettings.json.");`
  — its own header admits (`:25-26`) *"a key absent from this list is NOT thereby proven to be read."*

**Violates.** CLAUDE.md §4 ("Never add a setting to a project that doesn't use it"); the CONFIG TRAP the API and MCP blocks were already trimmed for.

**Failure scenario.** Someone lowers `StaleProcessingMinutes` or `QueuedStaleAfterMinutes` in the Functions app to cure P4-G-06/07 — nothing changes; the API owns both.

**Fix direction.** Add the eight to `NotReadByThisHost` with their real readers and remove them from the Functions appsettings. **Confidence:** high.

---

### P4-G-12 · Low · An API app setting nothing reads, required by the deploy check, justified by comments the code contradicts

**Where / evidence**
- `azureautomation/deploy.ps1:2112-2115` (`$script:RequiredApiAppSettings`): *"Both halves of the page-cache acceptance key. This host READS knowledge pages the Functions host wrote, so a stamp on one side alone silently misses every cached page."* `"Voice__Knowledge__Vision__VerifyDeploymentName",`
  — enforced by `Assert-RequiredAppSettings` (`:7975`); also merged `:7709-7711` (*"both keys carry the acceptance-policy hash this name feeds"*) and `:8107`;
  also in the API region files `appsettings.ca.json:246-250`, `appsettings.in.json:76-80`.
- Functions comment `deploy.ps1:7431-7433`: *"the page-cache key now also carries the ACCEPTANCE POLICY hash, and this name is folded into it (VisionTranscriptionSettings.ValidationFingerprint)."*
- The code says the opposite, `clinqetcore/Models/Knowledge/KnowledgeBlobPaths.cs:146-151`: *"‼️ The ACCEPTANCE POLICY is NOT in the key, it is inside the entry … a reader that only wants to show the provider the page … does not need to reproduce it at all."*
  Writer and reader both compose `OcrPageBlob(…, TranscribeDeploymentName, PromptFingerprint, page)` (`VisionDocumentTranscriptionService.cs:140-142`; `BusinessSearchDocumentService.cs:65-66`);
  the policy is checked only by the writer (`VisionDocumentTranscriptionService.cs:152`).
- No API reader: `Voice:Knowledge:Vision` is only ever a settings path in the Functions host (`KnowledgeIngestProcessorFunction.cs:1362, 2735`; `KnowledgeServiceDraftAnalyticsJob.cs:474`).

**Violates.** CLAUDE.md §4 (orphan setting); §0.14 (a comment that misstates behaviour is worse than none). On the Functions host the key IS read — only the reason given is wrong.

**Fix direction.** Drop `Voice__Knowledge__Vision__VerifyDeploymentName` from the API (required list, merge, `$apiSettings`, region files) and rewrite the two Functions
comments to "the verifier deployment (read by this host)". **Confidence:** high.

---

### P4-G-13 · Low · host.json keys the Service Bus v5 extension does not map

**Where / evidence**
- `host.json:29` `"autoComplete": false,` and `:33-36` `"sessionHandlerOptions": { "maxConcurrentSessions": 8, "messageWaitTimeout": "00:00:30" }`.
- Package `Microsoft.Azure.Functions.Worker.Extensions.ServiceBus` 5.24.0 (csproj). The v5 host extension's options are `AutoCompleteMessages`, `SessionIdleTimeout`,
  `MaxConcurrentSessions`, … (`ServiceBusOptions` XML docs), plus a legacy map whose literal keys (read out of the 5.17.0 DLL) are
  `MessageHandlerOptions:AutoComplete`, `SessionHandlerOptions:AutoComplete`, `SessionHandlerOptions:MaxConcurrentSessions`, `SessionHandlerOptions:MessageWaitTime`, ….
  ⇒ `maxConcurrentSessions` **is** honoured (agrees with P4-J); **`messageWaitTimeout` is not** (the mapped name is `MessageWaitTime`), so `SessionIdleTimeout`
  falls back to the retry `TryTimeout` (60 s by default, per the option's doc); **top-level `autoComplete` is not** (v5 name `autoCompleteMessages`), so
  `AutoCompleteMessages` stays at its default `true`.
- Knowledge impact: none functional — every path of `ProcessKnowledgeIngest` settles explicitly (`KnowledgeIngestProcessorFunction.cs:226, 252, 305, 311, 328, 349, 424, 432`), and the
  host abandons on a thrown exception either way; an idle business session holds a session slot ~60 s instead of 30 s.

**Fix direction.** Rename to `autoCompleteMessages` / `sessionIdleTimeout` (or delete them) so host.json states what runs. **Confidence:** high on the mapping (read from the
package); exact 5.24 behaviour NEEDS-LIVE-PROOF.

---

### P4-G-14 · Low · Inline / class defaults that disagree with appsettings (§0.12)

- `AiBudgetGovernor.cs:56` `configuration.GetValue("AiBudget:MaxBulkConcurrency", 2)` vs API `appsettings.json:2139` and Functions `appsettings.json:1614` `4`
  (MCP 2). The drafts job's effective concurrency is `min(ServiceDrafts:Concurrency 4, this)` (`KnowledgeServiceDraftAnalyticsJob.cs:331`) and the setting's own comment
  says a cap-1000 document needs 6,000 s at 2 — a lost `AiBudget` block would silently halve the knowledge bulk lane.
- `AzureAIFoundry:TimeoutSeconds`: code default 30 in all three hosts (API `Program.cs:1158`, Functions `:744`, MCP `:269`) vs API/Functions appsettings `100`;
  MCP has no `AzureAIFoundry` block in base appsettings (deploy.ps1 sets model/dims, not the timeout) ⇒ the phone's query-embedding client runs at 30 s
  (harmless under the 4 s retrieval budget, but not stated anywhere).
- cosmosindexsetup `Program.cs:94` `public string? KnowledgeIndexVersion { get; set; }` (null ⇒ falls back to `IndexVersion` "v1") vs `appsettings.json:17` `"v2"`;
  losing the key would build/repoint `private-knowledge-<cell><env>` onto a `-v1` physical index. No test pins it.

**Fix direction.** Make each code/class default equal to the shipped value (2→4, 30→100 or configure MCP, null→"v2"). **Confidence:** high.

---

### P4-G-15 · Low · `StorageConfiguration:ProviderKnowledge:MaxFileCount` = 20 is a dead knob (= P4-I INC-6)

- API `appsettings.json:3138` `"MaxFileCount": 20`; class initializer `StorageConfiguration.cs:49-53` `new() { MaxFileSizeBytes = 30 * 1024 * 1024, MaxFileCount = 20 }`.
- Readers of `MaxFileCount` are Broadcast/License/ServiceImages paths only (grep); the knowledge SAS gate bounds a request with the DTO's
  `[MaxLength(50, ErrorMessage = "Error_KnowledgeTooManyFilesInRequest")]` (`KnowledgeDtos.cs:13, 52`); the mobile mirror sets `maxFileCount: Number.MAX_SAFE_INTEGER`
  with *"‼️ NO COUNT CAP"* (`mediaLimits.ts:43-46`).
- Risk: the removed "20-document cap" number survives as configuration that looks live. **Fix:** delete it from both (or set it to the real per-request 50 and read it). **Confidence:** high.

---

### P4-G-16 · Low · Admin-alert "dial" labels that name settings which do not exist

- `KnowledgeIngestProcessorFunction.cs:3507-3508, 3515-3516` `ReportCapacityPressureAsync("KnowledgeIndexDidNotTakeCards", "Search:KnowledgeIndexName", …)` — no host has
  such a key; since the search-topology programme the index is `Search:Topology:Private:Cells:<cell>:KnowledgeAlias` (deploy.ps1:1886).
- `KnowledgeServiceDraftAnalyticsJob.cs:730-731` `"Voice:Knowledge:MaxAllowedPrice", (int)_settings.MaxAllowedPrice` — the real path is
  `Voice:Knowledge:ServiceDrafts:MaxAllowedPrice`, and the number shown is the lane default, not the per-currency ceiling that fired (INR: ×60).
- Violates the platform's own alert contract (*"the alert names its own fix: the dial"*, gotcha 27). **Fix:** correct both labels; pass the applied ceiling. **Confidence:** high.

---

### P4-G-17 · Low · Collection defaults APPENDED by the binder (memory `appsettings-class-defaults-are-appended-not-replaced`)

Effective bound values (class default ∪ configured):

| Setting | Class default | Configured | Effective | Effect |
|---|---|---|---|---|
| `Voice:Knowledge:ServiceDrafts:PriceFieldLabels` (Functions) | 24 words (`VoiceKnowledgeSettings.cs:525-532`) | same 24 (`appsettings.json:1356-…`) | **48 (each word twice)** | matching unaffected (`KnowledgePriceMarks.IsPriceLabel` scans the list); **no word can ever be removed from config**; an indexed env override lands at index 24+ |
| `AIService:DefaultTemperatureOnlyDeployments` (API/Functions/MCP) | `[AiModels.Luna]` (`AIServiceSettings.cs:42`) | `["gpt-5.6-luna"]` | `["gpt-5.6-luna","gpt-5.6-luna"]` | harmless duplicate; cannot be emptied |
| `AIService:TokenPricing` | 4 models | same 4 | 4 (dictionary merges by key) | a seeded model cannot be removed |
| `RemoteImageIngestion:BlockedHosts` (knowledge-draft image fetches) | 9 hosts | same 9 | 18 | deny-list can only grow — acceptable |
| `RemoteImageIngestion:AllowedHosts` (setup/catalog lane, not knowledge) | `["s7d2.scene7.com"]` | same | 2 entries | the documented kill *"Empty ⇒ every fetch is refused"* (`RemoteImageIngestionSettings.cs:10-12`) cannot be exercised from config |
| `ServiceDrafts:MaxAllowedPriceByCurrency` | empty | `{}` | empty | correct shape (and unused, P4-G-05) |
| `StorageConfiguration:*:AllowedExtensions/AllowedMimeTypes` | empty (`StorageConfiguration.cs:62-70`) | lists | = configured | correct; pinned against the BOUND object by `MediaAllowListsAreNotAppendedTests` |
| `Search:Topology:*` (`Countries`, `Cells`, `OpenCells`), cosmosindexsetup `PrivateCells`/`PublicCountries` | empty | per-stamp | = configured | correct |

The Functions guard compares the JSON array to the class default (`VoiceKnowledgeSettingsConventionTests.cs:142-146` `SequenceEqual`) — which GUARANTEES the doubling
and can never see it (the memory's rule: *"Assert against the BOUND object, not the JSON"*).
**Fix:** give `PriceFieldLabels` (and `DefaultTemperatureOnlyDeployments`, `AllowedHosts`) an empty class default with the words in appsettings, or keep the words in code
and drop the config key; bind-and-check for duplicates. **Confidence:** high.

---

### P4-G-18 · Low · Stale numbers inside settings comments

- `VoiceKnowledgeSettings.cs:345-356` *"the 20 MB upload limit bounds the container … 64 MB is 3.2x the whole upload limit … 256 MB is 8x"* — the limit is 30 MB (`:18`, 31,457,280).
- `:43` *"Eight leaves room for that and for a 500-page document"* — `MaxPagesPerDocument` is 100 (`:19`); a 500-page file is refused.
- `:499-502` *"at 1000 candidates that is 5 rounds × the bulk ceiling = 1500s"* — 5 rounds is Concurrency 2; the dial is 4 (3 judge rounds).
- `:510` *"At 4 a cap-1000 document needs 3300s"* — the rounds × ceiling estimate the platform disowned (gotcha 27), and > the 2,700 s host limit (P4-G-04).
- `:222-224` IngestTimeoutSeconds *"Owner-set 30 min"* is correct; the drafts line `:497-498` *"Owner-set 25 min … must stay under … 45 min"* sits above `= 3600`.
**Fix:** correct the numbers when P4-G-04 is resolved. **Confidence:** high.

---

### P4-G-19 · Low · NEEDS-LIVE-PROOF · A hand-set Functions app setting outside deploy.ps1

- LIVE-ACCEPTANCE §7.18-7.19: *"Owner flipped `Voice__Knowledge__ServiceDrafts__TimeoutSeconds` 3600 → 30 on the Functions app … Owner reverted the dial to 3600."*
- deploy.ps1 contains no `Voice__Knowledge__ServiceDrafts__*` key (grep); `Merge-AppSettings` preserves every existing key it is not given (`deploy.ps1:1983-2004`).
- If still present, it overrides appsettings.json for ever: fixing P4-G-04 in appsettings alone would change nothing live.
**Settle with:** `az functionapp config appsettings list` on each stamp; delete it (or manage it in deploy.ps1). **Confidence:** medium (depends on live state).

---

### P4-G-20 · Improvement · Guards that would have caught most of the above

1. API `ProviderKnowledge.AllowedExtensions` + `AllowedMimeTypes` ⇄ Functions readable set (`KnowledgeDocumentFormats` + the `case` switch) ⇄ both clients'
   accept lists / convert maps / MIME maps. `MediaExtensionCoverageTests` covers media containers only; `KnowledgeParseRoutingConventionTests` compares two Functions switches only;
   `knowledgeGuards.test.js` tests a hand-copied subset. (Today API and Functions agree exactly — 18/18; the clients do not.)
2. `IngestTimeoutSeconds`, `ServiceDrafts:TimeoutSeconds` < `host.json functionTimeout` ≤ `maxAutoLockRenewalDuration` — no test reads host.json (grep).
3. `StaleProcessingMinutes` / `QueuedStaleAfterMinutes` ≥ their ladders (P4-G-06/07).
4. `storage.json knowledgePreviousVersionRetentionDays` (60) == `Voice:Knowledge:PreviousVersionRetentionDays` (60): equal today, held only by two comments; deploy.ps1 never passes the parameter (per §0.17 rule 4 the check belongs there).
5. Two knobs for one cap: the API uses `Math.Min(StorageConfiguration:ProviderKnowledge:MaxFileSizeBytes, Voice:Knowledge:MaxFileSizeBytes)` (`KnowledgeController.cs:153, 184, 365`), the worker only the latter (`KnowledgeIngestProcessorFunction.cs:574`) — equal today (31,457,280).
6. Functions/MCP partial `BusinessSearch:Scripts` blocks (`CacheMinutes`, `UnresolvedCacheSeconds`, `LookupTimeoutMs`) are pinned in no test of their own repo (values equal to class defaults today).

---

## 3. Closure check (original ids in this dimension)

| Id | Status |
|---|---|
| **A19** format gaps | Server side FIXED-AND-VERIFIED-IN-CODE (`.tif` + `.csv` in `appsettings.json:3139-3157`; `.tif` in `KnowledgeDocumentFormats.cs:14-17`; `ParseCsv` `KnowledgeIngestProcessorFunction.cs:1621`; HEIF branch gone; legacy/macro refused with `KnowledgeRefusedFormats` sentences, `KnowledgeController.cs:237-249`). **End to end: NOT-FIXED** — both clients refuse `.csv`/`.tif` (P4-G-01) and the MIME list refuses Windows CSV (P4-G-02). |
| **U-12** phone picker names every accepted kind / MIME repair | PARTIAL — MIME repair covers every kind the phone accepts (`index.tsx:260-283`); `.csv`/`.tif` are not accepted kinds on the phone → NOT-FIXED for those two (P4-G-01). |
| **F10** blank search endpoint | SUPERSEDED-BY search topology: `KnowledgeSearchClient` deleted (no non-test occurrence); blank = absent (`SearchTopologySettings.cs:25-34` `IsConfigured`); deploy writes blanks on an unprovisioned stamp (`deploy.ps1:7283`). |
| **F11** (config half: orphan `Retrieval*` in Functions, voice-only keys in API) | FIXED-AND-VERIFIED-IN-CODE — Functions block has no `Retrieval*` key and its guard asserts their absence (`VoiceKnowledgeSettingsConventionTests.cs:34-50, 100-106`); API block keeps only the three the Business Search leg reads. |
| **E8 / U-03** served ingest budget | Fixed in code (`KnowledgeController.cs:152`, ladder `knowledgeMeta.js:157-176`) but **REGRESSED in meaning by E12** — the served number is one delivery, not the reading (P4-G-08). |
| **E9** passage cap single source | FIXED-AND-VERIFIED-IN-CODE — the index answers (`KnowledgeManagementService.cs:648-652` `GetPassageUsageAsync` → `_indexer.CountCardsAsync`; Functions pickup gate `KnowledgeIngestProcessorFunction.cs:3335-3350`). |
| E (verified OK) "settings parity pinned in both hosts" | Still pinned (API, Functions, MCP guards) — with the gaps P4-G-10/11/17. |
| E (verified OK) "lock 5 min + 1 h renewal ≥ 30 min deadline ≤ 45 min function timeout" | Still true for the INGEST (1,800 ≤ 2,700 ≤ 3,600); **false for the drafts job** (3,600 > 2,700) — P4-G-04. |
| **G-L1** index visibility wait | FIXED-AND-VERIFIED-IN-CODE — `IndexVisibilityWaitSeconds` 15 = class 15 (Functions `appsettings.json`), reader `KnowledgeIngestProcessorFunction.cs:3536`. |
| **L-11** drain timer binding | FIXED-AND-VERIFIED-IN-CODE — `%KnowledgeMaintenance:TimerSchedule%` (`KnowledgeMaintenanceFunction.cs:49`) resolvable in `local.settings.json` (`:` form), `.ca`/`.in` (`__` form), deploy.ps1 required list `:2169`, merge `:7361`, emit `:8332`; proven live 2026-09-15 per LIVE-ACCEPTANCE row 7. |
| `Voice:Knowledge:CjkFieldEnabled` | ABSENT as a setting — no property, appsettings key, env var or deploy entry. Only historical mentions stating its deletion: a test comment (`KnowledgeCjkFieldTests.cs:40-42`) and SKILL ×4 (`clinqet-search-discovery` "THE SWITCH IS GONE"). OK. |
| H4 (SKILL settings list drift) | Not re-audited here (dimension I). |

---

## 4. Verified OK

**Class default ⇄ appsettings (check 1)**
- Every configured `Voice:Knowledge` value in API (40 paths), Functions (full block) and MCP (20 paths) equals its class default — compared value by value
  (e.g. `IngestTimeoutSeconds` 1800, `MaxReadingContinuations` 8, `MaxPassagesPerBusiness` 2000, `Vision.TimeBudgetSeconds` 900 = the owner class's `new() { TimeBudgetSeconds = 900 }`,
  `ServiceDrafts.Concurrency` 4, `ExtractorMaxCompletionTokens` 12000, `Vision.VerifyDeploymentName` `gpt-5.6-sol` = `AiModels.Sol`). Pinned by the three hosts' guards.
- `BusinessSearch` (API) mirrors the class both ways — `BusinessSearchConventionTests.TheAppsettingsBlock_MirrorsTheClassDefaults` (`:358-382`); `Scripts` thresholds
  identical API ⇄ Functions ⇄ class ⇄ `TextScriptDetector` constants (`ScriptThresholdsAgreeAcrossHostsTests`); readers are the two indexers via
  `configuration.GetValue("BusinessSearch:Scripts:…", TextScriptDetector.Default…)` (`KnowledgeSearchIndexer.cs:46-49`, `AzureSearchIndexer.cs:162-165`).
- `AIService:HttpTimeoutSeconds` 90 / `BulkHttpTimeoutSeconds` 300 / `MaxRetries` 3 equal in API and Functions and to the class.
- `StorageConfiguration:ProviderKnowledge` sizes equal the class initializer (31,457,280 / 20) and `ProviderSetupDocuments` (10,485,760 / 1); `AdminAlertSettings`
  `EnableKnowledgeIngestFailureAlerts`/`EnableHighPriceAlerts` true = class; `RetrySettings:MaxDeliveryCount` 5 = class (`FailureNotificationHelper.cs:1204-1207`) = ARM `maxDeliveryCount` 5.
- `Search:Topology` base blocks: endpoints blank, no countries/cells (the merge trap avoided); `CellDirectory` 15/30/10 = class in all three hosts.

**Per-host readers ⇄ configuration (check 2)**
- MCP: the 20 configured `Voice:Knowledge` paths are exactly the ones read (`KnowledgeTools`, `MaterialExcerptAssembler`, `ProviderKnowledgeSearchService.SearchAsync`/`GetByRefsAsync`,
  `RealtimeSessionPayloadBuilder`); `ProviderCatalogAnswerService` (the only other `SearchAsync` caller) is MCP-only (`Program.cs:325`).
- API: every configured path has a reader in a class the API registers (`Program.cs:675-694, 900-913, 1042-1043, 1133-1134`); the Business Search leg reads only the provider half of
  `ProviderKnowledgeSearchService` (`.Provider.cs:44-253`).
- Functions: every key it reads is configured (the guard enforces it); exemptions for MCP/API-only keys are correct except as noted in P4-G-03.
- Identity carries only the knowledge queue NAME (region files), by the deliberate all-hosts entity map (`deploy.ps1:1654-1702`).

**Bindings (check 4)** — 62 `%…%` matches, 61 real (one is a comment, `SearchIndexSyncFunction.cs:234`). Every knowledge binding resolves in the Functions HOST:
`ServiceBusSettings:KnowledgeIngestQueueName` (local.settings ×3; deploy `:1692` map, `:2185` required, `:8153/8308`), `KnowledgeMaintenance:TimerSchedule` (above),
`SearchIndexAudit:CronSchedule` (×3; `:2163/7357/8324`), `CosmosDb:*` change-feed bindings (×3; deploy). Trigger connection `ServiceBusConnection__fullyQualifiedNamespace` (`deploy.ps1:7330`).
(Non-knowledge: `ServiceBusSettings:EmailDeliveryFailuresQueueName` is missing from the default `local.settings.json` — present in `.ca`/`.in` and deploy; local-only.)

**ARM / deploy (check 5)**
- `knowledge-ingest` queue (`events.json:1162-1182`): `requiresSession: true` (= trigger `IsSessionsEnabled = true`, `KnowledgeIngestProcessorFunction.cs:204`), `lockDuration: PT5M`,
  `maxDeliveryCount: 5`, `requiresDuplicateDetection: true`, `PT10M`, `defaultMessageTimeToLive: P7D` (> max scheduled delay 1,800 s), dead-letter on expiry. There is **no separate
  knowledge-analytics queue**: the analytics lane is session `{businessId}:analytics` on the same queue (`KnowledgeAnalyticsQueue`), so it inherits these properties.
- Queue name reaches every host from one map (`deploy.ps1:1654-1702`), guarded against a class addition not listed (`:1703-…`).
- `provider-knowledge` container, `publicAccess: None` (`storage.json:711-722`); lifecycle rules for `_sent/` (invoice retention), `_previous/` (cool 30, delete `knowledgePreviousVersionRetentionDays` 60 = app setting 60),
  `_ocr/` (cool 50, delete 180) — prefixes match the code's top-level shapes (`KnowledgeBlobPaths.cs:114-141`); no lifecycle on `{businessId}/ai-cache/` (correct: it now holds the vectors).
- KnowledgeBase Cosmos container created by cosmosindexsetup (`Program.cs:187`, env-suffixed `:1163`); name stamped to API/Functions/MCP (`deploy.ps1:7697, 7375, 8745`).
- Private knowledge alias `private-knowledge-<cell><env>` composed identically by deploy (`:1886`) and cosmosindexsetup (`Program.cs:1359`) from one cell list (`deploy.ps1:1737`, passed `:8980`); MCP gets the private plane only (`:8801`).
- Storage WAF has `requestBodyCheck: Disabled` (`networking.json:703-706`), so 30 MB uploads through Front Door are not body-inspected/limited.
- Host timings for the INGEST: `IngestTimeoutSeconds` 1,800 ≤ `functionTimeout` 2,700 ≤ lock renewal 3,600; per pass reading 900 + reserve 180 ≤ 1,800; AI attempts per delivery 6,000/5 = 1,200, per document 6,000 carried across continuations (`KnowledgeIngestProcessorFunction.cs:279-282`, `:3292-3299`).

**Allow-lists and caps (checks 6, 7, 9)**
- API allow-list (18) == Functions readable set (18): `.webp/.gif` normalized (`:1389`), `DiExtensions` 7, `case` switch 9; ingest and drafts switches identical (guarded).
- Size cap 31,457,280 everywhere: API SAS gate + confirm re-measure of the real blob (`KnowledgeController.cs:184, 365-400`), worker pre-buffer check (`KnowledgeIngestProcessorFunction.cs:574-583`),
  clients use the served `maxFileSizeBytes` with a 30 MiB fallback (web `knowledgeMeta.js:49`, mobile `index.tsx:655`).
- `KnowledgeMaxPassages` override: one rule in both hosts — override ≥ 1 wins, else `MaxPassagesPerBusiness` (2000 in class, API and Functions) (`KnowledgeManagementService.cs:697-706`, `KnowledgeIngestProcessorFunction.cs:3316-3326`).

**Secrets posture (check 10)**
- `git grep` over all 14 repos: 0 tracked files mention `knowledge-extraction-fix-plan`, `ca-servicebus` or the fix-plan `secrets` path. The SKILL files at `C:\Nik\.claude|.github|.agents|.cursor`
  cite `PLAN.md`, `phase-*` and `tools\kprobe.py` only — never `secrets\`.
- The Canada Service Bus key from `secrets\ca-servicebus.txt` appears in **0 tracked and 0 working-tree files** across the 11 backend/app repos (counted without printing).
- Per CLAUDE.md §19 ruling, sandbox values in tracked settings files (including the tracked Functions `local.settings*.json`) were not examined or reported.

---

## Appendix A — Arithmetic (check 8)

| Clock | Value | Source |
|---|---|---|
| host `functionTimeout` | 2,700 s | `host.json:4` |
| Service Bus lock / auto-renew | 300 s / 3,600 s | `events.json:1169`; `host.json:32` |
| Ingest deadline per delivery | 1,800 s | `IngestTimeoutSeconds` |
| Vision reading per pass | min(900, deadline − now − 180) | `VisionDocumentTranscriptionService.cs:346-348` |
| Passes per document | ≤ 9 (8 continuations) | `MaxReadingContinuations` |
| Scheduled ingest retries | 5 attempts; waits 30/120/480/1,800 s (= 2,430 s) | `IngestRetry*`; `KnowledgeIngestProcessorFunction.cs:440-450` |
| Deliveries per message | 5 | ARM + `RetrySettings` |
| Stale "stopped" window | 160 min from `ProcessingSince` (confirm) | `StaleProcessingMinutes` |
| Drafts attempt budget | 3,600 s (clamp ≤ 3,600) — host caps at 2,700 | `ServiceDrafts:TimeoutSeconds` |
| Drafts attempts / back-off | 4 / 180·2ⁿ⁻¹ (= 1,260 s) | `MaxAttempts`, `RetryBackoffSeconds` |
| Drafts stale window | 180 min from generation stamp | `QueuedStaleAfterMinutes` |

- Ingest, one delivery chain: 5 × 1,800 s = 150 min < 160 ✓ (the comment's case).
- E12 chain: 9 × (900 + 180) = 162 min > 160 ✗; under the setting's own 3.45× contention a 100-page scan ≈ 6 passes ≈ 90-100 min per document before queueing; N documents of one business serialize on one session.
- Retries: 2,430 s waits + 5 × 1,800 s = 190.5 min > 160 ✗.
- Drafts, gotcha 22 at cap 1,000: judge rounds ⌈⌈1000/100⌉/min(4, MaxBulkConcurrency 4)⌉ = 3; extractor ⌈⌈1000/50⌉/4⌉ = 5; ceiling bound 8 × 300 s = 2,400 s (per-call ceiling, retries excluded; the class claims 3,300 s) vs host 2,700 s; measured healthy run 1,122 s (LIVE-ACCEPTANCE §7.19/§15.22).
- Drafts ladder: 4 × 3,600 + 1,260 = 261 min (host-capped 201 min) > 180 ✗.

## Appendix B — Voice:Knowledge read ⇄ configured, per host

| Host | Read, not configured | Configured, not read |
|---|---|---|
| API | `EmbeddedImageMinBytes`, `JsonTableMinRows`, `JsonTableMinKeyOverlap`, `JsonMaxPathDepth`, `XlsxRegionBlankRowGap` (parser ctor); `SpaceEstimate*` ×3 (dead reader); `Vision.TranscribePromptTemplate` via `PromptFingerprint` (pinned equal by `OcrPageCacheKeyTests`) | none in base; `Vision.VerifyDeploymentName` in region files + deploy (P4-G-12) |
| Functions | none (guard-enforced) | `MaxTypedFaqs`, `MaxLinkedServicesPerDocument`, `StaleProcessingMinutes`, `UsualProcessingMinutes`, `ServiceDrafts:{ApprovedTtlDays, DraftsPageSize, ApproveBatchSize, QueuedStaleAfterMinutes}`; read nowhere: `ServiceDrafts:{AdminAlertPriceMultiplier, MaxAllowedPriceByCurrency}` |
| MCP | none | none |

## Appendix C — Method note
Mechanical extraction scripts lived only in the session scratchpad (deleted at the end of the pass) and printed redacted values;
nothing was written under `C:\Nik`.
