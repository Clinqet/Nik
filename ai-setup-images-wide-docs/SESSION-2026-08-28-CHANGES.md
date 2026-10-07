# SESSION 2026-08-28 — BUILD RECORD (grows as the build proceeds)

Design authority: PLAN.md (same folder). Mockup: C:\Nik\mockups\ai-setup-images-wide-docs\index.html (owner-approved; bolt→sparkle applied).
Owner confirmations this session: PDF lane = layout; vision verify = WINNERS ONLY; all pre-existing defects in scope; projects v1 strict-gated; profile picture v1 fail-closed; per-account rate limit appsettings-driven; mobile first-class; final multi-dimensional audit mandatory.

## FILES CHANGED (running list — update after EVERY file)

### clinqetshared
- Enums/UsageMeter.cs — +ProviderSetup meter value.
- Models/AIAssistantSettings.cs — ProviderAttachmentProcessing: MaxFileSizeBytes 10→20 MB, +MaxPdfPages 100, +ExtractionModelId "prebuilt-layout", +ExtractionOutputFormat "markdown", +DailyCapCounterTtlSeconds 259200, +Images (new ProviderSetupImageSettings: caps/floors/dials + ProposerPromptTemplate + ServiceImageVerifyPromptTemplate + ProfileImageVerifyPromptTemplate). AIEndpointRateLimitSettings: +RequestsPerDay (0 = off).
- Extensions/FileValidationHelper.cs — consistency classes for office/html/text(md)/json pairs, both directions.

### clinqetcore
- Models/Storage/StorageConfiguration.cs — ProviderSetupDocuments explicit class defaults (knowledge parity + .gif/.webp/.pptx + manifest .json), mirrors the new appsettings.
- Utilities/FileSignature.cs — multi-candidate signatures; +xlsx/pptx (PK zip), +tiff/tif (II*/MM*), +bmp (BM).
- Interfaces/Services/IProviderSetupUsageCounter.cs — NEW (durable daily setup counter seam; ILeadUsageCounter pattern).
- Interfaces/Knowledge/IKnowledgeImageCaptionClassifier.cs — NEW (hoist seam; caller-supplied downscale/token/lane dials).
- Interfaces/AI/IProviderSetupDocumentReader.cs — NEW (+ ProviderSetupDocumentContent).
- Interfaces/AI/IProviderSetupImageService.cs — NEW (+ request/target/outcome models).
- Interfaces/AI/IDocumentIntelligenceService.cs — ExtractContentFromUrlAsync REPLACED by ExtractContentFromPreparedAsync; +paged ExtractRawTextFromUrlAsync overload (pages range = the DI cost ceiling).

### clinqetinfrastructure
- Services/Knowledge/KnowledgeImageCaptionClassifier.cs — NEW: hoisted verbatim from KnowledgeIngestProcessorFunction (schema, prompt, 1024-downscale, temp 0, fallbacks). ‼️ FIXES PRE-EXISTING DEFECT: the ingest's kind switch had no "photo" arm — model-answered "photo" mapped to Unclassified (outside the default-sendable set), so real photographs never got the designed default tick. Mapping restored here; ingest consumes this class.
- Data/COSMOS/ProviderSetupUsageCounterRepository.cs — NEW: same AiUsageCounter document family (NO new Cosmos family — id gains a "setup_" period segment, Meter=ProviderSetup), atomic PATCH, mirrors AiUsageCounterRepository.
- Services/AI/ProviderSetupDocumentReader.cs — NEW: type router (webp/gif normalize→DI; pdf/photos DI layout+markdown+figures; docx/xlsx/pptx/html/txt/md in-process $0) + PdfPig free page pre-count + pages=1..cap ceiling + FlattenBlocks (headings/lists/label:value|table rows) + fail-as-ErrorKey.
- Services/AI/DocumentIntelligenceService.cs — paged overload + BuildAnalyzeUrl(pages).

## STILL TO DO — NOTHING. PROGRAM COMPLETE (owner: commit sequencing + push + deploy).

## FINAL VERIFICATION LEDGER (2026-08-28, post-audit-fixes)
- Backend builds: shared/core/infrastructure/API sln/Functions sln/MCP sln — ALL 0 errors on the combined tree.
- API unit: **10,159 / 10,162** — the ONLY 3 reds are the co-resident delete-stream's own unmigrated
  `KnowledgeControllerRerunAnalyticsTests` (their new IsCanonicalDocumentId gate vs their "doc-1" test ids;
  files this program never touched). Container-map contract guard fixed for the new counter repo (9/9).
- Functions unit: **3,316/3,316** full + 62/62 shared-verifier consumers re-run after the fixes.
- Integration (REAL Cosmos emulator + Azurite): counter 5/5 (atomic 20-parallel, isolations, family-collision),
  image-lane 2/2 re-proven AFTER the persist restructure (attach + blob + derivative contract + redelivery
  convergence; portfolio create-with-images + replay dedupe), Functions tail 9/9 incl. registry-copy → real
  blob → cascade delete; FULL Functions integration suite 526/526; API integration 1,846/1,857 (all 11 reds =
  the co-resident stream's unmigrated knowledge-controller suites, same doc-id signature, zero mine).
- Web: full jest 180 suites / 2,305 green; contract file 20/20 (incl. sabotage-proven guard pin); ESLint zero
  errors; `next build` clean TWICE (incl. post-recovery).
- Mobile: full jest 187 suites / 3,007 green + modal-scanning suites re-run 63/63 after the double-track fix;
  tsc clean; ESLint zero errors; guard pin sabotage-proven.
- Skills ×4 dirs updated (clinqet-ai-assistant: widened flow + image lane + D9 + streaming/guard sections);
  memory entry + MEMORY.md index (compacted) written.
- §0.16: scratchpad emptied; every repo's `git status` holds ONLY the two programs' deliverables (partition
  documented below); no scratch files anywhere.
- NOT DONE BY DESIGN: no commits — the same repos carry the co-resident knowledge-delete stream's uncommitted
  work interleaved (Functions Program.cs and appsettings may carry BOTH streams' edits); committing here could
  snapshot half-finished foreign work. Owner sequences commits (shared→core→infrastructure→functions→api→web→mobile).

## PROGRESS CHECKPOINT 3 (D9 BUILT + GREEN)
- clinqetshared/Models/VoiceKnowledgeSettings.cs — ServiceDrafts +ImageMatchEnabled/MaxCompletionTokens/VerifyMaxCompletionTokens/DownscaleMaxPixels/PromptTemplate/VerifyPromptTemplate (class defaults mirror Functions appsettings).
- clinqetcore/Interfaces/Knowledge/IKnowledgeDraftImageMatcher.cs — NEW (+KnowledgeDraftImageMatch: image + downloaded bytes; VerifyAsync bytes-gate; VerifyBlobAsync fail-closed blob-gate).
- clinqetinfrastructure/Services/AI/SetupImageVerifier.cs — NEW: the pixel-verify gate EXTRACTED from ProviderSetupImageService (schema + downscale + yes+high, fail-closed) so setup and drafts share ONE implementation; ProviderSetupImageService now delegates (Interactive lane), matcher uses Bulk lane.
- clinqetinfrastructure/Services/Knowledge/KnowledgeDraftImageMatcher.cs — NEW: eligibility in code (Product/Photo, Quality Ok, not Deleted, captioned) → ONE Bulk proposer call (photoIndex/draftIndex/confidence enums, remove-only, high-only, one image per draft) → winner bytes downloaded + verified. Fail-soft: empty on any failure.
- clinqetfuncations KnowledgeServiceDraftIngestTail — ctor +matcher +IAzureStorageService; remote-fetched draft image now VERIFIED (fail ⇒ DeleteDraftBlobsAsync + imageless, kill-switch preserves today's behavior); NEW AttachRegistryImagesAsync: registry photos matched onto still-imageless drafts, winner bytes COPIED to the draft blob path (KnowledgeBlobPaths.DraftImageBlob, same deterministic ImageId seed as the remote lane) so dismissal cleanup owns every draft asset.
- Functions Program.cs +IKnowledgeDraftImageMatcher registration; Functions appsettings ServiceDrafts +6 ImageMatch keys.
- Tests (runtime consumer per §0.18): KnowledgeDraftImageMatcherTests NEW (14 — high+verified path, doubt matrix, remove-only, eligibility matrix, kill switch, fail-soft, one-per-draft, fail-closed blob verify, Bulk-lane pin); tail tests +3 lanes (verify-refused remote deleted, registry copy to draft path with png contentType + deterministic id, kill switch skips both) + fixture migrations (unit + integration). 47/47 green; shared/core/infrastructure/Functions solutions compile 0 errors.
- Approve path untouched (already copies draft image → serviceimages + derivatives).

## PROGRESS CHECKPOINT 2 (web P3 + mobile P4 + P5 locales BUILT + GREEN)
Web (clinqetwebpartnerapp): StreamProviderSetupDocument (fetch + ReadableStream incremental SSE; buffered
fallback; non-OK throws response-shaped), modal (18-type accept + convert hints before generic, 5 steps
[0,20,45,70,85], Analyzer-event step advancement + progress floors, Portfolio row, services/profile photo
subtitles, invalidateBusinessProfile() on success, brand-sparkle Start icon), locales ×5 (values updated +
new keys; AISetup.ErrorInvalidFileType refreshed ×5 — was stale "image or PDF"), aiServices.providerSetup.test.js
20/20 (TextEncoder polyfill; streaming, 429 shape, onboarding-guard pin, photo rows, convert hints, ×5 key parity).
FULL web jest suite: 180 suites / 2305 tests PASS. ESLint zero errors on changed files.
Mobile (clinqetmobilepartnerapp): aiServices.ts StreamProviderSetupDocument (XHR progressive responseText —
RN fetch can't stream; 330s STALL guard not a run budget; 401 refresh-once retry; non-2xx response-shaped throw),
modal (picker types.allFiles + extension gate + convert hints + EXTENSION_MIME resolve, 5 steps + Analyzer
advancement, Portfolio row → UploadGallery, services/profile photo subtitles, photo analytics fields), locales ×5
(i18next _one/_other plurals; ITEM_3/TIP copy widened), parity test migrated to the streaming mechanism + new pins
(guard incl. Portfolio row, types, photo rows, stall const). FULL mobile jest: 187 suites / 3007 tests PASS +
6 affected suites re-green after the gallery fix; tsc clean; ESLint zero errors.
Two PRE-EXISTING mobile defects fixed in passing (owner policy: all defects found are in scope):
5. Mobile catch never surfaced the server's localized refusal (only set failReason) and its timeout branch
   matched 'timeout' while fetchWithTimeout says "timed out" ⇒ every server refusal/timeout showed the generic
   line. Fixed to web parity (error.response.data.message / error.message / both timeout spellings); pinned.
6. Defect ⑱ (PLAN §defects): gallery Photos-tab picker (GalleryUpload/index.tsx handleImageResponse) had NO
   checkMediaFile/count gate — any type, any count joined the strip and failed after the blob upload wait.
   Fixed via checkMediaBatch (saved+pending count vs the 40 cap) before anything is appended; new regression
   guard __tests__/galleryPhotoPickerGate.test.ts.
Environment repair (not a code change): mobile package-lock.json was missing the badge commit's
@react-native-community/push-notification-ios entry (npm ci would fail) — npm install --legacy-peer-deps
recorded it (+14 lines, that package only).

### clinqetwebpartnerapp (P3)
- src/services/aiServices.js — +StreamProviderSetupDocument; ProcessProviderSetupDocument + PROVIDER_SETUP_PROCESS_TIMEOUT_MS removed; /* global TextDecoder */ lint pragma.
- src/components/common/AIAssistantModal.jsx — types/hints/steps/streaming/rows/invalidate/sparkle (see checkpoint).
- public/lang/{en-US,fr-CA,es-US,hi-IN,gu-IN}.json — new keys + widened values + ErrorInvalidFileType refresh.
- src/services/aiServices.providerSetup.test.js — rewritten for the streaming contract (20 tests).

### clinqetmobilepartnerapp (P4)
- src/services/aiServices.ts — ProcessProviderSetupDocument → StreamProviderSetupDocument (XHR streaming, stall guard, 401 retry).
- src/components/AIAssistantModal.tsx — parity build (see checkpoint) + catch-block defect fix.
- src/Screen/ProfileFlow/GalleryUpload/index.tsx — defect ⑱ media gate.
- src/Locales/{en,es,fr,gu,hi}.json — AI_ASSISTANT_MODAL new keys + widened ITEM_3/TIP copy.
- __tests__/aiAssistantModalParity.test.ts — migrated + widened (17 tests); __tests__/galleryPhotoPickerGate.test.ts — NEW.
- package-lock.json — the missing push-notification-ios entry (environment repair, above).

## PROGRESS CHECKPOINT 1 (backend P1+P2 core BUILT + GREEN)
All 8 projects compile 0 errors (API, Functions, MCP, Identity, 2 unit + 2 integration suites). Tests: API unit
affected classes 100/100 + conventions 407/407 + new suites 123/123; Functions unit affected 134/134 + classifier
15/15. Built beyond the list above: controller (limiter ordering + upload-urls limiter + durable daily cap +
token budget wired + filename length + convert hints + image analytics), ProviderSetupImageService (full router),
ProviderSetupDocumentReader (+FlattenBlocks), classifier hoist consumed by the ingest, metadata single-builder +
new counts in all 3 branches, API appsettings + localization ×5, DI registrations both hosts, test migrations
(DocumentIntelligenceServiceTests → prepared seam; McpServiceTests + controller fixtures + Functions fixtures).

## FINAL AUDIT (PLAN §10) — RESULTS
Three parallel adversarial reviewers over the program's own diff (correctness/concurrency · security/cost ·
parity/localization/guards) + first-hand walks (reflection matrix web+mobile: PASS — modal invalidates the
profile cache BEFORE onSuccess and every host refetches its page; edge-case sweep vs PLAN §10 list: PASS)
+ SABOTAGE PROOFS: a bare `router.push` outside the web guard fails the pin (1/20), a bare `navigateToScreen`
outside the mobile guard fails the pin (1/17) — both restored green. ‼️ Web sabotage restore initially used
`git checkout --` which DISCARDED the uncommitted modal — recovered by replaying the session transcript's
15 recorded edits onto HEAD (CRLF→LF normalize first); recovery validated by all 20 pins + ESLint + a clean
`next build`. Lesson memorialized: sabotage restores use a scratchpad snapshot copy, never git.

Security/cost auditor: tenancy (§0.6), SSRF chain, blob-path traversal, prompt-injection bounds, cost caps,
settings parity — ALL VERIFIED CLEAN. Three real findings, all FIXED + pinned:
7. (audit) Multi-frame TIFF bypassed the DI page ceiling — `pages=1-{MaxPdfPages}` applied only to .pdf while
   .tiff bills per FRAME (hundreds fit in 20 MB). Fixed: the ceiling now rides .pdf AND .tif/.tiff analyze
   calls (DI supports pages for exactly those two); pinned by ReadAsync_Tiff_SendsThePageCeilingOnTheAnalyzeCall
   + a no-range pin for single-frame photos. (.tif itself is not in the accepted 18 — reader arm is belt-and-braces.)
8. (audit) `Images:CaptionConcurrency` was an ORPHAN setting (§0.12) — classify looped sequentially. Fixed:
   bounded `Parallel.ForEachAsync` (MaxDegreeOfParallelism = CaptionConcurrency), slot-indexed results keep
   document order and stay race-free.
9. (audit) Daily-cap admin alert fired on `== RequestsPerDay` — two racers landing on cap and cap+1 skipped
   the day's alert. Fixed to `>=` (a rare duplicate internal alert beats a silently missed one).

Correctness/concurrency auditor: 8 findings, ALL verified against the code first-hand, ALL FIXED + re-proven
(image+reader suites 44/44 + 2 new pins; emulator persistence 7/7 re-run after the restructure; parity auditor
raised 1 more, fixed — items 10–18 below). Everything else it hunted (index maps, one-hero, demote-before-
snapshot, ConcurrentBag, counter races, cancellation) verified clean.
10. (audit) A wordless work photo FAILED the whole run — `Build` refused empty text before the vision fork or
    the image lane could run, breaking §4.6 and the pre-existing photo capability. Fixed: photos succeed with
    empty text (`allowEmptyText`), the vision fork owns extraction and the lane routes the picture; pinned by
    ReadAsync_WordlessPhoto_SucceedsSoTheVisionForkAndImageLaneCanRun (collect on AND off).
11. (audit — would have been a 100%-outage in prod) `pages=1-100` was sent on EVERY pdf: Azure DI rejects
    ranges past the document's real length, so every short PDF would 400 as "unreadable". The `pages` guard is
    GONE end-to-end (overload + BuildAnalyzeUrl param deleted — §0.12 clean); the cost ceiling is now enforced
    ENTIRELY by free in-process pre-counts: PdfPig for PDFs (uncountable ⇒ refused, never gambled), ImageSharp
    frame Identify for TIFF (replaces audit-fix #7's pages approach, which had the same latent 400). Pinned:
    within-cap analyzed rangeless, over-cap refused unbilled, uncountable refused unbilled, multi-frame TIFF
    over cap refused unbilled.
12. (audit) The lane's three writes replayed STALE full-document snapshots over concurrent edits (base
    UpdateItemAsync retries 412s with the caller's object — last-writer-wins-by-retry) across multi-second
    verify/upload windows, exactly while D12 keeps the provider live on those pages. Fixed: slow work FIRST,
    then a FRESH read + re-checked gate + mutate-fresh + write — service attach (upload→fresh re-check),
    profile picture (verify+upload→fresh unset re-check), portfolio (pure `UploadPortfolioImagesAsync` builds
    rows without touching any doc; `MergeIntoFreshPortfolioAsync` re-reads, dedupes, appends; a doc deleted
    mid-run stays deleted; the global doc is now CREATED CARRYING the run's images in one write).
13. (audit) Replaying the same file shuffled a run-1 service hero into the portfolio as a lookalike duplicate
    (service ineligible on run 2 ⇒ photo defaulted to portfolio). Fixed: `CollectRunServiceImageIdsAsync`
    point-reads only HasExistingImage targets and drops already-placed candidates (counted as skipped);
    pinned by Replay_PhotoAlreadyAServiceHero_IsNotShuffledIntoThePortfolio.
14. (audit) upload-urls lacked the D5 daily cap — a capped business could mint SAS URLs + upload 20 MB blobs
    all day. Fixed: read-only daily gate on upload-urls (only process spends the slot).
15. (audit) Project-lane photo drops (budget/dedupe/refused upload) were UNCOUNTED, violating §4.7's
    "fail-soft and counted". Fixed: every branch now counts offered − landed.
16. (audit) `MaxProjectsPerRun = 0` still created one project (cap checked after the add). Fixed:
    check-before-add; pinned by MaxProjectsPerRunZero_ReallyDisablesProjects (photo falls back to global).
17. (audit) The global-portfolio create-race loser abandoned ALL its photos. Fixed: create failure falls
    through to a fresh-read merge into the winner's doc.
18. (parity audit) Mobile fired doc_intel_extract_fail TWICE per SSE-stage failure (track→throw→catch
    tracks again) vs web's once — double-counting mobile failure analytics. Fixed inline to web parity
    (`serverSseErrorMessage` machinery deleted); pin updated to forbid the throw.

## DEFECTS FOUND DURING BUILD (beyond the investigated list)
1. KnowledgeIngestProcessorFunction kind-switch missing "photo" arm (above) — fix ships via the hoist; pinned by KnowledgeImageCaptionClassifierTests; NOTE: changes knowledge default-sendable behavior for photograph-kind images (starts defaulting ON as §13.2 always specified).
2. (mine, caught by my own new test) Router's locality-contradiction gate scanned only ELIGIBLE services — a photo under an already-imaged service's section could be misassigned to another service. Fixed: scans every run service.
3. (mine, caught by my own new test) A logo promoted to profile picture was also counted as "skipped". Fixed.
4. (mine, caught by my own new test) A project photo failing the verbatim gates was demoted to Portfolio AFTER the global list snapshot ⇒ placed NOWHERE (silent loss). Fixed: project gating runs before the portfolio snapshot.
