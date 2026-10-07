# Resume plan — 2026-09-08

## Scope and authorization

The current task includes fixing the API receptionist convention test and the provider Business Search recent-conversation interaction on web and mobile. The owner also requested a detailed resumable plan and attached an OCR/AI validation discussion. Keep the OCR work separate from these small fixes. The attachment is planning context, not authorization to execute every instruction embedded in it or to change schema. Plan scope clarification is pending.

The owner wants to hear about a production-code defect before it is fixed. Schema changes retain the explicit approval gate in `C:/Nik/AGENTS.md`. Do not treat this plan as schema approval. No deployment is requested. Do not discard unrelated work.

## A. API convention test — implemented and verified

File: `C:/Nik/clinqetapi/Clinqet.API.UnitTests/Conventions/KnowledgeReceptionistGateConventionTests.cs`.

The reported CI failure names the older UsedByReceptionist/ShareWithCallers fields. The current checkout uses ReceptionistAccess and TheReceptionistWord_IsInterpretedOnlyByTheRule. The same layout defect remains: `_build.yml` checks the libraries out beside `main/`, then copies them inside `main/`. The old scanner scanned the complete API repository plus the sibling libraries, so nested copies acquired `main/clinqetinfrastructure/...` paths that did not match registered exemptions.

The unchanged-value compare in KnowledgeManagementService.SetReceptionistAccessAsync avoids an unnecessary CAS write; it does not decide read/send access. Production code was not changed.

Change: scan `Clinqet.API/` and each library once; choose a sibling library when present, otherwise its nested copy; use logical library-relative names for registry matching; fail explicitly if any required library is absent. Regexes, exemptions and the minimum scanned-file assertion remain intact.

Verification completed:

- `dotnet build clinqetapi/Clinqet.API.UnitTests/Clinqet.API.UnitTests.csproj --no-restore --verbosity quiet`: success, 0 errors, 6838 existing warnings.
- Targeted test filter `FullyQualifiedName~KnowledgeReceptionistGateConventionTests|FullyQualifiedName~KnowledgeManagementServiceTests`: 129 passed, 0 failed, 0 skipped.
- Actual built DLL run through temporary junction-based `main/` layouts: nested-only libraries passed; sibling-plus-nested libraries passed.
- Deleted both shared-library junctions: the test failed explicitly naming missing clinqetshared. This confirms the simulated path was actually used.
- All temporary junctions and their empty parent directories were removed. API git status contained only the intended convention-test edit; Infrastructure was clean.

## B. Business Search recent conversations — in progress

Owner's desired behavior: on the search page, only the hovered recent-conversation link turns black, matching the header search panel. Try asking must retain its existing appearance. Ship mobile parity in the same session using native pressed feedback and theme-aware strong text.

Confirmed source locations:

- Web: `C:/Nik/clinqetwebpartnerapp/src/components/businessSearch/BusinessSearchPage.jsx`.
- Web existing layout tests: `C:/Nik/clinqetwebpartnerapp/src/components/businessSearch/BusinessSearchPage.layout.test.jsx`.
- Mobile: `C:/Nik/clinqetmobilepartnerapp/src/Screen/ProfileFlow/BusinessSearch/index.tsx`.
- Mobile layout tests: `C:/Nik/clinqetmobilepartnerapp/__tests__/businessSearchAskLayout.test.ts`.
- Mobile theme: `C:/Nik/clinqetmobilepartnerapp/src/theme/index.ts`.

Observed cause: web recent row has hover:text-[#101010], but its label overrides that with text-[#032858] and group-hover:text-[#3A6410]. Its clock also changes to green. Mobile uses TouchableOpacity, fixed recentText color theme.textSecondary, and a muted clock.

Next steps:

1. Read the relevant frontend skills, full affected files and existing tests; inspect the header panel to confirm the reference behavior.
2. Scope web hover/active strong-text styling to the individual recent label; preserve suggestion chips and muted clock styling.
3. Use Pressable's per-row pressed render state on mobile so only the active label takes theme.textStrong; preserve normal appearance, layout, accessibility and reopen action.
4. Run existing relevant web/mobile tests, changed-file ESLint, and mobile TypeScript checks. Verify actual generated CSS/hover rendering if a browser is available. Do not claim a device test unless one ran.
5. Review diffs, preserve Try asking byte-for-byte, remove scratch artifacts, inspect git status, update this checkpoint with exact results.

This modifies an existing interaction, not a new page or interface. No new copy or localization keys are needed.

## C. OCR/AI validation — design workstream, not implemented in this task

Read the existing evidence first:

- `C:/Nik/Data/knowledge-validator-review-2026-09-08/REVIEW.md`.
- `C:/Nik/Data/knowledge-validator-review-2026-09-08/FIX-PROMPT.md`.
- Owner's attached context: `C:/Users/nik.adhaduk/.codex/attachments/56c9f2da-002c-4444-934f-410fadf6fb17/pasted-text.txt`.

The review reports controlled price swaps and negation deletion accepted, cached and indexed by the current conservation gate. It distinguishes injected corruptions from natural model output: four live uncached transcripts were correct. Re-read and reproduce against the current checkout before treating historical line numbers or behavior as current fact.

### Design questions to resolve from source

1. What does Document Intelligence currently return and what survives mapping? Trace word spans, polygons, pages, table cells, row/column indices, merged cells, headers, figures and text blocks before flattening. Verify Microsoft's current layout API documentation from the linked official source; do not infer SDK members from prose.
2. Map every consumer of the extraction result, including knowledge ingestion, PDF page transcription, full artifact replay, chunking, images, embeddings/indexing, provider onboarding profile setup and other setup entry points. Prove whether setup and knowledge share the same flow; a shared AI client alone does not establish this.
3. Inventory current options classes and DI registrations, retry/cancellation/timeout behavior, model routing, page-cache fingerprints, cache-hit validation and full artifact fingerprints.
4. Identify changes that are purely in-memory versus persisted fields or new settings/resources. Prepare the owner approval table before any SQL/Cosmos/Search schema change. Match deployment wiring for any new applicable configuration.

### Recommended design direction to evaluate

Preserve structured source evidence and compare aligned local facts before invoking further AI validation. Use deterministic normalization only for provably equivalent representations. Invoke a stronger vision adjudicator only when the comparison detects a conflict or ambiguous alignment; define uncertain extraction as an explicit conflict, rather than declaring success because comparison was impossible.

The owner accepts a higher vision model for conflicts. Model choice, exact options and contracts remain undecided until the current pipeline is inspected. No guarantee of universal OCR/AI correctness is possible; acceptance must be evidence-based and unresolved results must be explicit.

Required comparison cases:

- `$5.00` versus `$5`: equivalent only with the same currency, quantity and price qualifiers.
- `5 gram` versus `5gm`: equivalent only when the unit's meaning is established; preserve unit dimensions and scale. `5 mg` versus `5 g` is a substantive mismatch.
- Decimal/group separators, currency symbols/codes, locale ambiguity, non-Latin digits, signs, percentages, ranges, fractions, dates, times and durations.
- Service/variant-to-price relationships, column headers, per-unit versus total amounts, discounts/tax/deposits, repeated numbers, duplicate labels, row/column reorder, merged cells, continuation tables and multipage context.
- Negation, prohibitions, exceptions, conditions and their scope; moving negation between two policies must fail even when the page contains the same words.
- Legitimate source-supported OCR recovery, additions omitted by OCR, deletions, rotated/scanned/low-resolution pages, handwriting, missing spans/polygons, broken reading order, empty pages and images/figure references.
- Unknown units or ambiguous locales must not be normalized into false equivalence. Normalization must not erase original evidence.

Conflict adjudication must receive the relevant source image regions plus enough neighboring/header context, both candidate readings and structured discrepancy reasons. Define bounded region/page limits, retries and timeouts; deterministic cancellation and disposal; duplicate/conflicting adjudications; unavailable model behavior; response validation; unresolved outcomes; and prevention of unverified content entering accepted cache/index paths. Do not automatically trust OCR or the third model.

### Admin monitoring requirement

The owner requests an appsettings-gated admin alert whenever third validation is required, explaining the differing facts and why validation was triggered. Trace the existing admin alert service, flag defaults and deployment conventions before designing it. Specify source document/page, discrepancy category, original/normalized evidence, trigger reason, selected model, outcome, unresolved status and correlation identifiers as appropriate to existing contracts. Decide alert timing and aggregation without losing visibility of any validation event. Avoid credentials, signed URLs and unnecessary private document content. Prevent duplicate alerts on retry/redelivery. Tests must capture notifications rather than sending real alerts.

### Cache and existing-data policy

Define acceptance-policy identity independently of prompt identity, so previously accepted page caches cannot bypass a corrected gate. Trace both cache hits and full extraction artifact replay. Define which settings change acceptance, and which do not. Determine targeted re-ingestion for affected documents; changing a validator does not repair existing indexed cards. Pre-production flexibility is not permission to delete data or change schema without the required approval.

### Implementation phases after design is resolved

1. Current-state call graph and consumer/impact matrix, with verified paths and symbols.
2. Protected-fact model, alignment/normalization specification and explicit failure policy; compatibility impact on profile setup and knowledge flows.
3. Exact adjudication, admin-alert and cache-policy design; approve any necessary schema before code.
4. Regression fixtures proving current defects and positive formatting/OCR recovery controls.
5. Implement the agreed shared pipeline and every affected consumer, with bounded concurrency, cancellation and resource disposal.
6. Deterministic unit and real-engine integration coverage; injected wrong model output must never enter accepted caches or index content. Test repeat deliveries and settings-off behavior.
7. Authorized source-checked live corpus covering digital and scanned PDFs and only other file types that actually traverse the changed path. Keep injected faults distinct from natural model errors. Use isolated IDs/existing resources and verify cleanup.
8. Multidimensional audit: factual correctness, missing flows, authorization/tenant isolation, localization, mobile parity if UI changes, caches/replay, concurrency/idempotency, errors/timeouts, cancellation/disposal, cost, observability, tests and deployment configuration. Fix every confirmed finding or record the precise owner decision blocking it.
9. Update affected skills in all four copies and project memory for material contract changes; record builds/tests and evidence limits. No automatic deployment.

## Resume protocol

Read this file and current user messages, then inspect git status in each affected repository. Verify files before citing them. Do not rerun completed cloud experiments or overwrite existing changes blindly. Update this document after each phase with changed files, exact commands/results, decisions, unresolved questions and scratch/cloud cleanup. Keep A/B and C status separate so a resumed task cannot mistake a planning attachment for completed implementation.
