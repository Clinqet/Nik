# FINAL PLAN — post-ranking follow-ups (the authority for the BUILD session)

> Written 2026-09-29 at the end of the design session (session 2). Every owner decision is logged verbatim in
> `PLAN.md` §10 (approvals) and §11 (mockup register) — **those two sections outrank anything below if they ever
> disagree.** This file tells the build session WHAT was decided, WHY, WHERE in the code, HOW to prove it, and what to
> watch for. Nothing in any repository has been changed yet.

---

## 0. HOW TO WORK — read before anything else (owner-mandated)

1. **Read `C:\Nik\CLAUDE.md` in full, then this file, then `PLAN.md` §10–§11, then the three design files and `FINDINGS-OOM.md`** (§1). Every
   CLAUDE rule applies — §0.7 schema, §0.7.1 gates, §0.8 integration tests on real engines, §0.14 comments, §0.16 clean
   tree, §0.18 test placement, §0.19 never `git checkout/restore/stash/reset/clean`, §0.21 linear history.
2. ‼️ **THIS PLAN IS A STARTING POINT, NOT AN ORDER.** The owner's words: the build session "is just not gonna plainly
   believe it. It's gonna use this and we'll brainstorm and making sure is this the best solution, and any suggestion it
   will ask me." So, for EVERY item: re-read the real code end to end, re-review the approved design, run your own
   edge-case review, and look for a better or more correct way. **If you find a gap, a doubt, a better solution, or an edge
   case the design does not handle — STOP and ASK the owner with your recommendation. Never assume, never silently
   deviate, never silently follow a design you believe is wrong.**
   ‼️ **You have creative freedom** (owner, 2026-09-29): wherever you see an opportunity to improve a design, a better
   industry-standard approach, or an edge case the approved solution does not handle, you are EXPECTED to raise it —
   propose it, explain why, and let the owner confirm. Freedom to propose; never freedom to assume.
3. ‼️ **Be interactive** (owner). Ask with the `AskUserQuestion` tool, in plain words (problem → proposal → why → the
   decision you need). Never point the owner at a file to go and read; put the question, the query, the explanation IN
   the chat. Never use a technical word the owner does not need.
4. ‼️ **An approval covers exactly what was shown.** Anything new you discover is PENDING until the owner says yes —
   log every new answer in `PLAN.md` §10 the moment it is given.
5. ‼️ **NO DEGRADATION** of Clinket AI (Ask Clinket), the AI receptionist, search or Insights — not by 0.01%. Every change
   that touches reading, pictures, ranking or Insights needs a before/after proof on real sandbox data (§5).
6. **Industry standard only, production-ready, no workaround, every edge case designed and tested.** Pre-prod: no
   feature flags, no backward-compat paths (memory `feedback-no-feature-flags-preprod`) — the ONE owner-requested switch
   is `ProviderScoring:SafetyNet:Enabled` (W11).
7. **Full sandbox permission** (CA + IN: Cosmos, SQL, Search, Storage, Service Bus). Connection strings:
   `C:\Nik\cosmosindexsetup\appsettings.{ca,in}.json`, `C:\Nik\clinqetfuncations\Clinqet.Communications\local.settings.{ca,in}.json`
   (‼️ NOT `local.settings.json` — its Service Bus namespace no longer exists). Never print a key.
8. **Build and test in an isolated copy** (robocopy to your scratchpad + `subst`), never in the shared trees while another
   session works (memory `feedback-never-build-while-another-session-works`). Scratch files only in your scratchpad.
9. **Owner pushes and deploys.** Commit locally per repo, `git fetch` + `git rebase origin/master` on a clean tree, prove
   `git rev-list --merges origin/master..HEAD` is empty; give the owner the push order (libraries → apps → hosts,
   `clinqetapi` last).
10. ‼️ **UI: you have full design freedom, with NO owner approval needed, as long as you follow §0a.**

---

## 0a. ‼️‼️ UI DESIGN FREEDOM + THE STANDARD IT MUST MEET (owner ruling, 2026-09-29, verbatim in `PLAN.md` §10)

**The four approved sheets are a STARTING POINT, not a limit.** When you build a screen and see a way to make it better
(more modern, more futuristic, smoother, a better use of the space, clearer words), **build the better one. Do not wait
for the owner's approval, and do not hesitate to change what the approved sheet shows**, as long as every rule below
holds. If the sheet is already the best answer, build it as drawn. This replaces the wait for mockup approval in
CLAUDE.md §0.7.1 for this programme's UI.

**The standard (every rule is required):**

1. **Modern and futuristic.** It should feel current and polished: smooth transitions, skeleton placeholders while
   loading (not a bare spinner), clear visual hierarchy, subtle motion that respects the device's reduce-motion setting.
   It still looks like Clinket, never like a different product (rule 4).
2. ‼️ **Use the space; do not waste it.** No large empty areas, no oversized padding, no half-empty cards. The user should
   see what matters **without scrolling** on a phone and on a laptop. Wide screens use the width (columns, side-by-side
   facts), never one stretched column. Short, compact rows. Dense but never cramped: tap targets stay at least 44 pt (iOS)
   / 48 dp (Android), and text stays readable.
3. **Web is fully responsive.** Every web screen must look right on a phone browser (iPhone Safari, Android Chrome), an
   iPad (portrait and landscape), a laptop and a large monitor. Nothing breaks, overflows, scrolls sideways or wastes
   space at any width. Check at 360, 390, 768, 1024, 1280 and 1920 px wide, plus the tailwind breakpoints each app already
   defines (`xs` 320 … `5k` 3840 in the partner and customer web apps).
4. **The phone apps use the power of a phone**, never a squeezed copy of the web page: long press for a row's actions,
   swipe, bottom sheets, pull to refresh, haptics, native pickers and the native share sheet, safe areas respected. Check
   on iOS AND Android, in light AND dark (both the provider and customer apps have a dark theme).
5. **Brand, exactly: font, colours, sizes, theme.** Each app follows its OWN existing design system:
   - **Provider web, customer web, admin web, provider phone app, customer phone app** — font **Lufga** (all weights
     already bundled). Colours: brand green `#97EF29` for the chosen or pressed action (memory: brand green for pressed),
     soft green `#F4FFE4`, navy `#032858` for primary text and the brand blue; amber for limits, blue for processing (the
     house tokens, CLAUDE.md §0.20). Provider web's AI Knowledge screens use the `knowledge.*` palette in
     `tailwind.config.js`; both web apps use the `responsive-*` font sizes defined there. Both phone apps' tokens are in
     `src/theme/index.ts` (light + dark); the provider app's file also holds the spacing, corner and font-size scale.
   - **Admin phone app** (`clinqetmobileadminapp`) — its own theme `src/theme/theme.ts` (blue `#2563EB`, the system font,
     its own type scale). Keep it on that theme; never paint it in the provider palette.
   - Never introduce a new font, a new colour, or a new size outside the app's tokens.
6. **Words anyone understands.** Every label, notice and step is short, friendly and plain. No technical word
   (CLAUDE.md §0.20 list: passage, chunk, index, token, cache, stream, …). You MAY improve an approved wording for
   clarity, keeping its meaning; the change goes into every language file (five languages; the admin apps stay English).
   A sentence the server already sends is shown as sent, never re-invented on the screen.

**What does NOT change with this freedom:**
- The freedom is in how a screen LOOKS, is LAID OUT, is USED and is WORDED. What a feature DOES (the data shown, the rule
  behind it, what is stored) stays as approved; a change there is a §0 question for the owner.
- Every state the server can reach is drawn (empty, loading, error, no permission, limit reached, offline, and the
  sheet's own states). You may add states; never drop one.
- Web and phone ship together in the same session (provider web ⇔ provider phone app, customer web ⇔ customer app,
  admin web ⇔ admin phone app).
- ‼️ **Keep the record honest (CLAUDE.md §0.20):** when what you build differs from its sheet, UPDATE the sheet itself in
  `C:\Nik\Data\mockups\<sheet>\index.html` so it shows what shipped, and add a line to that sheet's row in `PLAN.md` §11
  saying what changed and why. No waiting for approval — this is only so the next person can find the truth.
- In the final audit, show the owner screenshots of every changed screen at phone, iPad and laptop width, both phone
  apps in light and dark.

---

## 1. The documents (all in `C:\Nik\Data\post-ranking-followups\`)

| File | What it is |
|---|---|
| `PLAN.md` | the original brief + **§10 every owner decision (verbatim)** + **§11 mockup register** |
| `FINDINGS-OOM.md` | the measured cause of the exit-137 kills |
| `DESIGN-TALL-PAGES.md` | APPROVED design — oversize pages read in sections (revised: no overlap cut) |
| `DESIGN-PICTURES.md` | APPROVED design — pictures beyond 40 (ceiling 300), resumable descriptions |
| `DESIGN-PROVIDER-SCORING-SCALE.md` | APPROVED direction — event-driven scoring (§3) + the Insights two-step roll-up (§7.0); brainstorming input |
| `DECISIONS-PENDING.md` | the session-2 question list — **historical**; every row was answered and is superseded by `PLAN.md` §10 |
| `tools\` | the investigation harnesses (sources only — rebuild them in your scratchpad) — §8 |
| `NEXT-SESSION-PROMPT.md` | the prompt that starts the build session |

Approved mockups (register `PLAN.md` §11, index `Data\mockups\REGISTER.md`):
`knowledge-reading-progress`, `provider-trust-ranking-effect`, `customer-cards-serves-area`,
`bookings-list-book-again-no-show` — each under `C:\Nik\Data\mockups\<sheet>\index.html`.

---

## 2. What was measured (the facts every decision rests on)

- **Dev Flex instances are 512 MB** (`azureautomation\deploy.ps1:924`), prod 2048. The India kills: 11 rows on
  `clinket-functions-in-dev`, many instances, `exceptions.type == "Microsoft.Azure.WebJobs.Script.Workers.WorkerProcessExitException"`,
  `outerMessage` "…exited with code 137 (0x89)" (both `dotnet` and `…/FunctionsNetHost` forms).
- **One render of the Glanza page = ~400 MB NATIVE memory** (PDFium decodes all 51 pictures at full size to draw a
  92-px-wide bitmap); managed heap < 60 MB. `RenderFlags.LimitImageCacheSize` → **167 MB with byte-identical pixels**.
  Renders from different documents stack (2 → 1.0 GB, 8 → 1.8 GB). `MALLOC_ARENA_MAX=2`: peak −23%, held afterwards −28%.
- **Every page is rendered before the page cache is checked** (`VisionDocumentTranscriptionService.cs:81`) — continuations,
  Read again and the analytics fallback re-render banked pages.
- **Docnet.Core 2.6.0 bundles PDFium chromium/5445 (Sept 2023)**; current `bblanchon.PDFium` = 156.0.8076. Docnet's only
  user is `DocumentPageRasterizer`. Clipped section renders on current PDFium peak ≤ 95 MB.
- **Document Intelligence read the 15 × 166 in page as 2,453 chars of noise**; the same page cut into a section and sent as
  a 150-dpi image read **98.5% of the file's own words** (the whole spec table). A cropped one-page PDF gave the IDENTICAL
  reading (it reads pixels either way).
- **Corpus** (India, business 6TCWOI + HG3QFI; Canada NKN607 + ZEKIKT): 10 of 22 India brochures are oversize (8 two-page
  SPREADS 23–27 × 8–9 in; Baleno 15 × 70 in; Glanza 15 × 166 in); 12 of 22 lose pictures to the 40 cap (max 95 past the
  floor: hilux). hilux and ebella have NO text layer.
- A picture adds ~0.8–1.2 KB to the Cosmos document row (2 MB item limit). Picture cards count against the business's
  searchable parts; the overflow gate refuses a document WHOLE.
- The page-cache policy includes the infrastructure assembly MVID ⇒ any infrastructure change re-reads every page on its
  next reprocess — "byte-identical cards" can only be proved by feeding OLD banked readings into NEW code (§5).
- The nightly scoring visits only providers with an analytics signal in the last 30 days (`SmartAnalyticsAggregationService.cs:153-160`);
  the Insights job loads ~two months of every provider's Parquet into one process. Service Bus is **Standard**
  (1,000 ops/s per namespace; 5 GB queues, 80 GB partitioned).
- Azure AI Search accepts `serviceAreas/any(a: a/radius le R and geo.distance(a/center, geography'POINT(lon lat)') le R)`
  on the public services index (verified live 2026-09-29) — containment is expressible with existing fields.

---

## 3. The work items

Each item: **decision** (from §10) · **code** · **build** · **tests** (host per §0.18) · **proof** · **watch for**.
‼️ Every `file:line` below is as of HEAD on 2026-09-29 (all repos clean, level with origin). Code moves — locate each by its
symbol name, never by the number alone, and re-read it end to end before changing it.

### W1 — The out-of-memory fix (PLAN §1)
- **Decision**: render flag + render only pages not yet banked + heavy-work gate around RENDERING and PICTURE DECODING
  only (never around model calls) + dev instances to 2 GB + `MALLOC_ARENA_MAX=2`. Gate size **3** everywhere.
- **Code**: `clinqetinfrastructure\Services\AI\DocumentPageRasterizer.cs` (all renders; `LimitImageCacheSize` on every
  one — W2 carries it into the new binding); `VisionDocumentTranscriptionService.cs:72-300` (today rasterizes every page
  at line 81, then checks the cache per page inside `Parallel.ForEachAsync`) → check the cache first, render on a miss,
  one page at a time, released at once; `DocumentTranscriptionVerifier.RenderAsync:126-139`; picture decodes in
  `KnowledgeImageNormalizer.NormalizeAsync`, `KnowledgeImageCaptionClassifier` (downscale `Image.Load` ~line 99),
  `ProviderSetupImageService` (API host). New singleton gate (`SemaphoreSlim`) in infrastructure, registered in BOTH hosts
  that render (Functions, API); setting `Voice:Knowledge:HeavyWorkConcurrency` = 3 (class default = appsettings, §0.12;
  the API host gets the key only if it reads it). The wait takes the ingest's deadline token (never outlives the delivery;
  lock renewal is automatic up to `maxAutoLockRenewalDuration` 1 h).
- **Infra**: `deploy.ps1:924` → 2048 for every environment; `MALLOC_ARENA_MAX = "2"` in the Functions `Merge-AppSettings`
  block (~line 7428) — fixed value, no parameter. Re-measure MALLOC in the build before relying on it.
- **Tests (Functions unit + integration)**: the gate bounds concurrency (N+1 waiters, never > N inside); a waiter honours
  cancellation; banked pages are never rendered (a counting fake rasterizer); the flag is passed on every render.
- **Proof**: the harness (§8) under a 2 GB Linux container: Glanza, Baleno, MG Windsor, hilux, 8 concurrent — peaks
  before/after; Glanza replayed in the sandbox after W3 ends Ready.

### W2 — Replace Docnet with current PDFium (PLAN §3 library decision)
- **Decision**: `bblanchon.PDFium.Linux` + `bblanchon.PDFium.Win32` 156.x + a small in-house binding (≈20 calls), ONE
  process-wide lock around every PDFium call (PDFium is not thread-safe). Remove `Docnet.Core` from
  `Clinqet.Infrastructure.csproj`.
- **Calls needed** (all verified in `tools\clip` / `tools\crop`): `FPDF_InitLibrary`, `FPDF_LoadMemDocument`,
  `FPDF_GetPageCount`, `FPDF_LoadPage`, `FPDF_GetPageWidthF/HeightF`, `FPDFBitmap_Create/FillRect/GetBuffer/GetStride/Destroy`,
  `FPDF_RenderPageBitmapWithMatrix` (flags `FPDF_ANNOT | FPDF_RENDER_LIMITEDIMAGECACHE` = 0x201), `FPDFText_LoadPage` +
  text extraction (replaces Docnet `GetText` for the text layer), close/destroy. Password-protected detection stays with
  PdfPig (`DocumentPageCounter`).
- **Watch for**: `/Rotate` handling (render + dimensions in the displayed frame — test a rotated fixture); the native
  library resolves on Flex Linux (publish includes `runtimes/linux-x64/native/libpdfium.so`); the API host (setup lane)
  uses the same class.
- **Tests**: every existing `DocumentPageRasterizerTests` stays green; new: clipped render equals the region, bounded
  memory on a synthetic 100-picture page, rotated page, invisible text layer rule, encrypted file.
- **Proof** (DESIGN-TALL-PAGES §12.5): every page of every regression document rendered by old and new PDFium, pixel
  difference measured page by page; fresh re-read fact comparison (§5).

### W3 — Oversize pages read in sections (PLAN §3; DESIGN-TALL-PAGES.md, APPROVED as revised)
- Build exactly the approved design: trigger (17 in edge OR < 0.6 × A4 scale), section shape S = clamp(short edge, 842,
  1224) pt, cut evidence (text layer + picture boxes + ink profile; scanned pages: line boxes from windowed Document
  Intelligence reads), recursive X-Y cut, **text never cut, no overlap cut** (§4.5), tables cut only between rows with the
  header carried, sections read like pages (DI on a 150-dpi clipped render, the reading model on the 1024 box, the source
  check on the 2048 box), **all sections of a page read in PARALLEL, and a section whose table continues from the previous
  one re-read once with the header on top** (owner-approved — so provider setup's 5-minute budget reads long pages too), per-section banks + the stitched page banked under the ORDINARY page key (Ask Clinket's page
  viewer `BusinessSearchDocumentService` reads it), stitching rules §6, pictures §7 (a cut picture merged back into one
  figure; crops rendered by us), caps with the notice (never a refusal), the setup lane (`ProviderSetupDocumentReader`,
  API host) gets the same sections (owner-approved).
- **Owner emphasis (verbatim)**: "page cut and how we are handling that and all other edge case that is extremely
  extremely important so we can make sure not just that one but all other should properly work".
- **Code**: `VisionDocumentTranscriptionService`, `DocumentPageRasterizer` (clipped API), `DocumentTranscriptionVerifier`,
  `KnowledgeIngestProcessorFunction.TranscribeWithVisionAsync:1425-1486` + `ExtractAsync` (page figures replaced for
  sectioned pages before `BindPdfImagesAsync`), `KnowledgeImageExtractor` (section figures, our crops),
  `PageMarkdownSplicer` (the stitched page), `KnowledgeBlobPaths` (section keys under `_di/{docId}` and `_ocr/{biz}/{docId}/`),
  `VoiceKnowledgeSettings` (new `Oversize` section — settings list in the design §10), the continuation/progress rules
  (units = pages + sections), the page-cache policy (section rules folded in).
- **Notice**: `Info_KnowledgePageTooLongToReadFully` — wording as in the approved sheet `knowledge-reading-progress` (G),
  which supersedes the design's §11 draft wording. Server en/es/fr/gu/hi + both partner apps.
- **Tests**: every row of design §4.2/§4.4/§6/§14 as a unit test on synthetic layouts (Functions host); integration on
  Azurite (section banks, crash after k of n, purge); rasterizer tests (W2).
- **Proof & live**: design §12 in full — Glanza, Baleno, a spread, plus a long infographic, a tall menu, a tall price
  table, a Hindi and a Gujarati tall page (build the last five), uploaded THROUGH THE PRODUCT, watched to Ready, asked in
  Ask Clinket and the receptionist path. State the added cost (sections × DI page + reading call).

### W4 — Pictures beyond 40 (PLAN §4; DESIGN-PICTURES.md, APPROVED)
- Ceiling `Images:MaxImagesPerDocument` 40 → **300**; row-size guard `Images:MaxRegistryBytes` 1,000,000;
  `MaxTranscribedPictures` 5 → **50**; `Images:PicturesPerPass` 40; `Images:PicturePassSeconds` 600; per-picture
  description bank `_ocr/{biz}/{docId}/cap-{pictureHash}-{fingerprint}.json` (inside `OcrPrefix`, purged); the space rule
  (text first — pictures trimmed to fit the business's searchable parts, `Info_KnowledgePicturesLeftOutSpaceFull`);
  near-duplicates only "the same picture at another size" (32×32 colour ≤ 2% + aspect ≤ 1%) — measure on the corpus and
  SHOW the owner every collapse before it ships; the superseded-follow-up rule (design §8); `StaleProcessingMinutes`
  re-derived (330 → ~430; convention tests in BOTH hosts).
- **Owner Q&A to keep in mind**: text is always read and kept; a re-run keeps the same 300 largest; a stopped pass
  resumes from the next picture and never pays twice; 300 is about the Cosmos row and cost, not timeouts.
- **Schema (§0.7, APPROVED)**: `KnowledgeDocument.readingProgress` `{ stage: "Pages" | "Pictures", done, total }` —
  nullable, **absent when nothing is being read** (no bytes stored), written once per pass, cleared in the `CommitAsync`
  funnel whenever the status is not Processing (the `cardsRewriting` invariant). Not indexed (`KnowledgeBase` excludes `/*`).
- **UI (APPROVED sheet `knowledge-reading-progress`)**: "Reading pages — n of N" / "Reading pictures — n of N" on the row,
  states A–H, partner web + partner phone app, keys `knowledge.row.readingPagesProgress`,
  `knowledge.row.readingPicturesProgress` in all five languages both apps; server notices in all five server catalogues.
- **Code**: `RunImageLaneAsync:2031-2538`, `CaptionAndClassifyAsync:3152-3170`, `TranscribePictureTextAsync:3019-3078`,
  continuation `ShouldCarryOnReading/CarriesOn:3578-3606`, `KnowledgeIngestQueue` (message derivation), the overflow gate
  `:1125-1150` (the space rule), `KnowledgeReadingNotices`, `KnowledgeManagementService.ListAsync` + DTO, the partner
  knowledge list (web + mobile).
- **Coordination (never merge it)**: the teammates' branches `plan_searchable_parts` / `admin_searchableparts_limit`
  (clinqetinfrastructure, clinqetapi, clinqetcore, clinqetshared, clinqetfuncations, both partner apps) tie the
  searchable-parts cap to subscriptions. The admin per-business override + pickup gate are already on master
  (`GetMaxPassagesAsync`, `RefuseWhenSpaceIsFullAsync`). The space rule must read the cap ONLY through that one method,
  so whichever cap source ships, the rule is unchanged. If their branch has landed by the time you build, re-read it first.
- **Tests + proof**: design §10–§11 (≤ 40 single delivery byte-identical from the same descriptions; 108/300 through
  three+ passes; crash between passes; delete mid-chain; the space rule on a real index count). Live: 0, 12, 40, 108, 300
  pictures incl. the team's 108-picture document and MG Windsor, asked in Ask Clinket + the receptionist ("show me the …").
  Report the measured cost and time per 100 pictures (descriptions + picture-text readings) to the owner.

### W5 — The knowledge dead-letter handler (PLAN §2A, APPROVED)
- New Functions function on `%ServiceBusSettings:KnowledgeIngestQueueName%/$DeadLetterQueue` (NOT session-enabled —
  proven in repo: `Data\knowledge-extraction-fix-plan\phase-2\AUDIT.md:210`), takes `ServiceBusMessageActions`, settles
  explicitly. Verify the binding resolves with the `/$DeadLetterQueue` suffix.
- Per message: reasons our handler already alerted and stamped (`KnowledgeIngestProcessingFailed`,
  `KnowledgeDocumentDeletionFailed`, `InvalidMessageFormat`, `JsonDeserializationError`, `InvalidKnowledgeDocumentIdentity`)
  → delete, no second alert. Otherwise (`MaxDeliveryCountExceeded`, TTL expiry, unknown): ONE admin alert with the full
  body (dedupe key = MessageId → deterministic EventId → the Cosmos id), then mark Failed + notify the provider ONLY for
  the SAME reading, then delete.
- **"Same reading" = the row's `ProcessingSince`** (never `UpdatedAt`, which moves on every write): stamp only when
  `Status == Processing && ProcessingSince.Ticks <= message.ReadingEpoch`, inside an ETag CAS loop that RE-CHECKS the
  condition on every attempt. **`BeginRecutAsync` (`:3519-3533`) sets `ProcessingSince` = the message's epoch** so a
  worker-started re-cut obeys the same rule. Delete-mode → `ReportDeletionGhostAsync`. Analytics-mode → the job's
  generation-scoped failure commit (`CommitAnalyticsAsync`, `KnowledgeServiceDraftAnalyticsJob.cs:1413`), row untouched.
- **Owner condition (verbatim)**: "not bumbarding the provider and admin same alert again and again that is extremely
  important". Guarantees to build and test: one admin alert per dead message (deterministic id; the main handler's own
  DLQ alerts are never repeated); the provider notice once per reading (`NotifyDocumentFailedAsync` EventId includes the
  row generation); a redelivered DLQ message produces nothing new; a burst = one row per message (each is its own
  document's evidence — owner-approved).
- **Remove** the nightly DLQ drain: `KnowledgeMaintenanceFunction.DrainIngestDeadLetterAsync:81-131`,
  `ServiceBusService.DrainDeadLetterAsync:852-916`, the `IServiceBusService` member + `DeadLetterEnvelope`/`DeadLetterDrainResult`,
  `VoiceKnowledgeSettings.DeadLetterDrainMaxMessages` + its appsettings keys, and the test doubles in every host
  (compile-required edits, §0.18.3).
- Handler failure: transient → the host's bounded retry; past the DLQ message's own delivery bound → a last-resort alert
  with the full body, then complete. Never swallow; never delete before the alert is durable.
- **The two India messages**: `a3d2d508…` (MaxDeliveryCountExceeded) → alert + Failed; after W1–W3 press Read again → must
  end Ready with correct cards. `d1ec7d72…` (KnowledgeIngestProcessingFailed; document Ready) → deleted, no alert, row untouched.
- **Tests**: unit (every reason, every mode, same/newer reading, row missing, Deleting, body unparseable, redelivery,
  last-resort bound) — the FIRST tests to build a `ServiceBusReceivedMessage` with `deadLetterReason`; integration on the
  Cosmos emulator (the CAS re-check against a concurrent reprocess).

### W6 — Out-of-memory alert (PLAN §2B, APPROVED)
- A `scheduledQueryRule` in `azureautomation\analytics-alerts.json` (workspace-scoped like its siblings), to the existing
  action group `clinket-alerts-{env}`, every 5 min, split by instance:
  `AppExceptions | where AppRoleName startswith "clinket-functions-"` (+ the existing non-prod `endswith "-<env>"` rule)
  `| where ExceptionType == "Microsoft.Azure.WebJobs.Script.Workers.WorkerProcessExitException" and OuterMessage has "code 137"`.
  **Table and columns VERIFIED by the owner in `clinket-workspace-nonprod` (PLAN §10)** — both message forms contain
  "code 137". `deploy.ps1` already deploys this template (POST-PHASE B).

### W7 — O1 global scoring statistics (APPROVED incl. the leads matcher)
- `ScoringStatistics = ScoringStatistics.Global` on typed queries: `AzureSearchQuery.cs` `Options()` `:1619-1641` (covers
  every expansion phase) and the semantic leg `:1887-1892`; `BroadcastMatchingService.cs:792-814` (+ its semantic leg).
  Private plane (Ask Clinket, receptionist) untouched. Proof: before/after on sandbox clones (order stability + latency)
  for BOTH customer search and lead matching (recipe: memory `local-api-on-sandbox-clones-recipe`).

### W8 — O2 "Serves Hamilton · Based in Toronto" (APPROVED; sheet `customer-cards-serves-area`)
- **No new index field.** Inside = the customer within one of the SERVICE's areas (`ServiceAreaCoverage.Evaluate`); the
  area named = the containing one (nearest centre if several); outside = the nearest area by CENTRE and its distance;
  "Based in {address city}" hidden when it equals the served city; at-business-only services unchanged; no customer point
  ⇒ no "Serves" line; km/mi by the existing country rule.
- **Distance sort**: "serves you here" = 0, ordered by rating, first; then everything else by distance — made EXACT for
  every result the list can show by an index read that checks containment itself (the verified `serviceAreas/any(...)`
  filter, radius buckets per unit + an exact in-memory check), then the distance read, merged and de-duplicated.
- **Code**: `AzureSearchQuery` `CalculateLocationMetrics:3176-3249`, `ApplySorting:3261-3284`, `IndexOrderFor:4007-4014`,
  the Distance branch `:3863-3879`; `ProviderSearchService` `ResolveDistanceKm:853-866`, `BuildOrderBy:748-753`,
  `ExplicitSortComparer` `:402-406`; `RecommendationSearchService.ApplyProviderSort:497-506`; `PublicFanOutMerger`;
  `CardDistancePoint`; mappers; DTOs (`ServiceSearchResultDto`, `RecommendedProviderSearchResultDto`: add `servedArea`
  {name, distanceKm, inside} and `basedInCity`); `RecentlyViewedHydrationService`. UI: web `ServicePageContent.jsx`,
  `ProviderPageContent.jsx`, `workerViewedCard.jsx`, the rails, `service/[id]/page.js`, `utils/cardDistance.js`; mobile
  `searchScreenDetails/index.tsx`, `homeScreen/index.tsx`, `DiscoveryScreen.tsx`, `utils/cardDistance.ts`. Keys per the
  sheet, five languages, web + customer app.
- **Proof**: before/after lists for a travelling provider and a local one in the same city (sandbox clones).

### W9 — O3 `listingReviewCount` (APPROVED §0.7)
- Public SERVICES index only: `Edm.Int32`, sortable only, **null when the card shows no count**, `WhenWritingNull`,
  written by `AzureSearchIndexer.CreateServiceSearchDocumentAsync` (~`:1768`) as `RatingValue.ServiceOrBusiness(...).ReviewCount`;
  browse "Most reviewed" orders at the index (`listingReviewCount desc, serviceRatingSortScore desc, id asc` — a new
  `IndexOrderFor` arm); the card keeps reading the same value. The provider list needs nothing. Convention tests
  (`SearchOrderByIsSortable`, `SearchSelectFields`, `SearchPlane`, `SearchProjection`). The field is added in place
  (`CreateOrUpdateIndex`), then every business reindexed (sandbox indexes may be rebuilt; no backfill).

### W10 — `deploy.ps1` required settings (APPROVED; NO YAML guard)
- Add the six missing Cosmos binding names to `$script:RequiredFunctionAppSettings` (`deploy.ps1:2168-2249`):
  `CosmosDb__DatabaseName`, `CosmosDb__ContainerNames__ProviderData`, `CosmosDb__ContainerNames__Transactions`,
  `CosmosDb__ChangeFeed__LeaseContainerName`, `CosmosDb__ChangeFeed__ProviderDataUnifiedLeasePrefix`,
  `CosmosDb__ChangeFeed__TransactionsOfferLeasePrefix` — and every NEW `%…%` token this programme adds (new lease
  prefixes, the two queues). Hardcoded names, no user parameter. The CI YAML guard is NOT built (owner).

### W11 — Provider scoring, event-driven (APPROVED; DESIGN-PROVIDER-SCORING-SCALE §3–§6, §8)
- Build the approved flow: queue `provider-score-refresh` (session = businessId, duplicate detection 1 day, unlimited TTL);
  every evidence change (bookings incl. manual, customer waits, lead responses, opening hours, listed/unlisted/suspended/
  closed/reopened) sends `{businessId}:night:{date}` at the provider's hashed night slot — **100 bookings = one rescore
  that night**; the worker recomputes with the SAME evaluator and patches only on change; the next time point (window exit,
  fade step) is scheduled into that day's nightly id; override expiry = its own exact-minute message (audit FIRST, then
  clear); NO new profile fields (stateless; outdated messages recompute and change nothing); hidden providers paused and
  resumed by the ProviderData change feed (verify EVERY lifecycle change writes the Cosmos profile — SQL-only changes get
  the trigger at their write); deleted ⇒ no-op; safety net = the SQL registry sliced 1/30 per night, setting
  `ProviderScoring:SafetyNet:Enabled` (**default true**, owner-requested) + `SliceDays` 30; first deployment = one
  throttled backfill. Remove scoring + `ExpireIfLapsedAsync` from `SmartAnalyticsAggregationService` (`:273`, `:675-741`)
  and the expiry call from `SearchIndexAuditFunction.cs:351` (one path only) — that function also queued a reindex after a
  lapse (`:231-235`): the expiry message's profile write reaches search through the existing ProviderData change feed;
  prove the provider's rows re-project after an expiry.
- **Service Bus (owner)**: runs on Standard until volume demands Premium — never limited by Standard, never a workaround.
- **Proof**: scores identical before/after for every sandbox provider the old job scores; the frozen quiet provider now
  fades on its day; an override expires on the minute with exactly one audit entry.

### W12 — Insights two-step daily roll-up (APPROVED; DESIGN-PROVIDER-SCORING-SCALE §7.0)
- Step 1 (per finished day, per file, queue `insights-day-rollup`) writes
  `analytics/insights-daily/day={date}/group={000-255}/part-{sourceFileId}.parquet`; step 2 (per group, nightly) writes each
  provider's ONE `ProviderInsightsRollup` in `SystemData` with TODAY's formulas; the screen = one point read, cached
  `ReadCacheSeconds` (300). Collection and its Parquet schema untouched. Refactor the formulas in
  `SmartAnalyticsAggregationService` to consume counts instead of raw events — the numbers must be IDENTICAL.
- **Build checks (ASK the owner if any fails)**: raw-file retention / lifecycle rules on `analytics`; every consumer of the
  rollup record; late data (re-roll the day); "top searched" summed per term; future uniques = a mergeable sketch per day.
- **Proof**: every sandbox provider's Insights record identical before/after (field by field).

### W13 — §12.5 override fixes (APPROVED)
- (a) `ProviderScoreOverrideService` (`:88-92`, `:144-197`): write the audit entry (fixed id) BEFORE the profile patch for
  set / change / clear — the lapse path already does. (b) is W11's exact expiry message.

### W14 — Provider Trust ranking effect (APPROVED, NEW; sheet `provider-trust-ranking-effect`)
- `GET …/admin/providers/{businessId}/scores` gains each score's effect and the provider's total factor (browse + typed);
  new admin-only `POST …/scores/preview` runs `ProviderBoostComposer.Compose` with the LIVE `SearchBoostSettings` +
  `ProviderScoringSettings` for proposed numbers; the legend is read from the live settings; every override box shows the
  provider's REAL measured number ("Measured: 50"), never pre-filled. Admin web `ProviderScoresCard.jsx` +
  `providerTrustService.js`; admin mobile `ProviderScoresSection.tsx` + `adminService.ts`. English (the admin app has no
  translations — 0 of 66 screens).

### W15 — Book again on the bookings list after a provider no-show (APPROVED; sheet `bookings-list-book-again-no-show`)
- Web `bookingsInfoBox.jsx:35` (`canBookAgain` = Completed OR NoShowProvider), mobile `BookingListScreen.tsx:162-173`;
  the same add-to-cart action; existing copy only. Check the mobile detail slug fallback (`BookingDetailScreen.tsx:683`)
  resolves.

### W16 — Live tests (PLAN §7)
- **B2**: a sandbox business open Saturday only; ≥ 10 customer waits (seed `replyCycles` in `Communications`, pk = the
  provider's userNumber) asked Monday, answered Saturday; run the W11 worker in-process → the response score reflects open
  hours (expected ≈ 92 vs ≈ 25 on the wall clock — worked example in the session-2 research); plus "no hours on record"
  and "closed every day". Show the owner the admin Provider Trust screen.
- **§12.5**: set, change, clear, and let one lapse — each writes exactly one audit alert; a stale edit (two admins) is refused.
- **Book again**: web + customer app, list and detail.
- Record every result in `PLAN.md`.

---

## 4. Build order (dependencies)

1. W10 + W6 (infra only) · 2. W2 (library) → W1 (memory) → W3 (oversize) → W4 (pictures) → W5 (dead-letter) — one
   ingest chain, proved together on the regression set · 3. W7, W9, W8 (search; one clone set, one index rebuild) ·
   4. W11 → W13 → W14 → W12 (scores then Insights) · 5. W15 · 6. W16 live tests · 7. the audit.
The owner's standing action FIRST (§6).

## 5. Proof plan (the golden rule)

- **Regression set**: every Canada sandbox document (NKN607 + ZEKIKT) + every India document below the oversize trigger.
  For each: (1) the trigger says "no" (a test on the real files); (2) the OLD build's banked page readings and DI reads
  fed into the NEW build's extraction ⇒ byte-identical cards; (3) three fresh re-reads compared value by value.
- **Library**: page-by-page pixel difference, old vs new PDFium, the whole regression set.
- **Oversize + pictures**: design §12 / §10 — facts present before/after, real uploads, Ask Clinket + receptionist.
- **Search**: clone indexes from the new definitions (memory `local-api-on-sandbox-clones-recipe`) — before/after lists.
- **Scores + Insights**: identical numbers for every sandbox provider; the new behaviours shown on the admin screen.

## 6. Owner actions (tell the owner at the START of the build session)

- **Now** (independent of this programme): run `deploy.ps1` for BOTH regions — `TransactionsOfferProcessor` is disabled on
  the deployed India app until `CosmosDb__ChangeFeed__TransactionsOfferLeasePrefix` exists (it is in `deploy.ps1`).
- `clinqetfuncations\Clinqet.Communications\local.settings.json` points at a Service Bus namespace that no longer exists
  (`clinket-servicebus-in-v2-nonprod`); the `.ca` / `.in` files are correct.
- After the build: `deploy.ps1` again (dev 2 GB, MALLOC, the two queues, new settings), then the pushes in order.

## 7. Definition of done

Every W item built and proven live with before/after evidence; every new question answered by the owner and logged in
§10; unit + integration tests green with no skips in every affected suite; ESLint clean on every changed app; a
multi-dimensional audit (correctness, logical gaps, performance, memory, thread safety, disposal, alerts, localization,
web/mobile parity, security) with EVERY finding fixed in the same session (memory `feedback-audit-findings-fixed-this-session`);
skills ×4 updated (voice-assistant knowledge sections, business-search, search-discovery, function-app, infrastructure,
deployment, integration-health, smart-analytics, booking-lifecycle, customer/provider mobile, partner/user/admin apps); memory updated; scratch deleted; `git status` clean in every repo;
linear history; the push order given.

## 7a. Closed on purpose — do NOT reopen without the owner

| Item | Why closed |
|---|---|
| CI (YAML) deploy guard, and the same for API/MCP | owner: "Only fix deploy.ps1, no YAML" (W10) |
| Dead-letter alert for the other queues | already exists — `analytics-alerts.json` `dlq-depth-N` per namespace |
| Moving dead-lettered messages back to the main queue | owner: never — "Read again" / admin reindex is the retry; delete after alert + Failed |
| Overlap cuts on oversize pages | rejected in the second review (text-only de-duplication would be a loophole) |
| Docnet internal clipped render via reflection | a workaround — rejected |
| Grey-scale perceptual-hash near-duplicates | would throw away colour variants (car brochures) |
| Profile schedule fields for scoring (`scoreNextEvaluationAt` …) | owner-confirmed stateless design — not added |
| Cosmos per-provider day records for Insights | superseded by the two-step roll-up |
| Azure Data Explorer for Insights | deferred by the owner (cost pre-launch); the migration path stays open |
| Admin app translations for the Provider Trust card | the admin app has none anywhere; the card follows it |

## 7b. Open decisions: NONE

Every decision, design and mockup in this programme is APPROVED (PLAN §10–§11). Nothing waits on the owner before the
build starts. The only owner action is §6 (run `deploy.ps1`), and it does not block any design work. Anything NEW the
build session finds — a better way, a gap, an unhandled edge case — is raised under §0 item 2.

## 8. Tools (sources in `tools\` — rebuild in your scratchpad, never in a repo)

- `tools\harness` — runs the REAL rasterizer / parser / binder / picture lane on one file, sampling native + managed
  memory every 20 ms; `Harness <pdf> <di.json.gz> <functions-appsettings.json> [copies] [render|bind|all]`; run under
  `docker run --memory=2g --cpus=1 mcr.microsoft.com/dotnet/aspnet:10.0` for the Flex shape. Copy `tools\harness` to
  `<scratch>\harness` and robocopy `clinqetinfrastructure`, `clinqetcore`, `clinqetshared` (no bin/obj/.git) into
  `<scratch>\mirror\` — the project references `..\mirror\clinqetinfrastructure`.
- `tools\clip` — clipped vs whole-page render memory + pixel comparison on current PDFium.
- `tools\crop` — a section sent to Document Intelligence as a cropped PDF and as an image, scored against the text layer
  (needs `DI_ENDPOINT` / `DI_KEY` from `local.settings.in.json`; never print them).
- `tools\scan` — `scan <folder> pages` (size in inches, rotation, letters, pictures, decoded MB, scale vs A4, over the 17 in
  limit, per page) and `scan <folder> pictures` (placements, distinct stored pictures, pictures past the decorative floor).
- `tools\cread` — partition-scoped Cosmos point reads / queries (`CREAD_DB=Clinket-nonprod`).
- Corpus: every sandbox knowledge source lists with `az storage blob list --container-name provider-knowledge` (connection
  string from `cosmosindexsetup\appsettings.{region}.json`); download to your scratchpad only.
