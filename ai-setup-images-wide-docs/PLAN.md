# AI QUICK PROFILE SETUP — WIDE DOCUMENT TYPES + PHOTO ROUTING
## Program plan & locked design (authority document)

Owner-approved 2026-08-28 (this conversation). Mockup authority: `C:\Nik\mockups\ai-setup-images-wide-docs\index.html`
(approved; one owner change applied: Start-button bolt → brand green four-point sparkle, both apps).
Quality over speed. 100% accuracy bar. Mobile is a first-class surface — every item below ships web + mobile in the same program.

---

## 0. LOCKED DECISIONS (owner, 2026-08-28)

| # | Decision | Ruling |
|---|---|---|
| D1 | PDF/photo DI mode | **prebuilt-layout + markdown + figures** (the knowledge lane) for the setup path, settings-driven like knowledge (`ExtractionModelId`/`OutputFormat` pattern). Cost controls in §6. |
| D2 | Accepted types | **Knowledge parity**: `.pdf .docx .xlsx .pptx .txt .md .html .htm .jpg .jpeg .png .gif .webp .tiff .bmp .heic .heif` (+ `.json` = catalog manifest, web-only, unchanged). `.pptx` unconditional on this surface. |
| D3 | Refusals | `.csv/.tsv/.xls` → "save as Excel (.xlsx)", `.doc` → "save as Word (.docx)", `.ppt` → "save as PowerPoint (.pptx)". Client hint (both apps) + localized server error keys. |
| D4 | Size cap | 20 MB effective (raise `AIAssistant:ProviderAttachmentProcessing:MaxFileSizeBytes` 10 MB → 20 MB; storage constraint already 20 MB). |
| D5 | Rate limiting | Per-business, appsettings-driven, on BOTH `/provider-setup/upload-urls` and `/provider-setup/process`: existing per-minute in-memory limiter + NEW durable per-business **daily** cap (atomic Cosmos counter pattern) + token budget wired (was dead config). |
| D6 | Portfolio projects | **In v1**, strict gates (§4.4), behind appsettings switch. Anything short of every gate → global Photos. |
| D7 | Profile picture | **In v1**, only when `ProfilePictureUrl` empty, layered logic (§4.5). Fail-closed: doubt ⇒ don't set. |
| D8 | Image→service matching | AI-forward (§4.3): code eligibility gates → AI proposer → **vision verify on winners only** (per proposed pair, not all photos × all services) → conflict resolution in code. Locality = evidence + contradiction-veto only, never a silence-veto. |
| D9 | Knowledge parity | Knowledge draft services adopt the SAME shared matcher: extracted document images (registry) matched + vision-verified onto drafts; existing approve path copies to the service. Remote-image draft attach also goes through the verify. |
| D10 | Pre-existing defects | **ALL fixed** (§7), plus anything else found during build/audit — standing policy. |
| D11 | Feedback UI | As mocked: Portfolio row (new), Services subtitle "+N photos added", Profile subtitle "Profile photo added", new progress step "Adding your photos...", skips silent. Counts ride SSE metadata; clients localize. |
| D12 | Reflection | After a run, the page the provider is standing on reflects every change immediately (photo/address/socials/services/areas/availability/offers/onboarding progress) — web + mobile (§8). |
| D13 | Onboarding guard | Every new tap target routes through the guarded `openSummaryTarget` (web+mobile); guard TESTS added on both apps (none exist today). Memory: `ai-setup-onboarding-escape-guard`. |
| D14 | Final audit | Mandatory multi-dimensional audit phase before "done" (§10). |
| D15 | Start-button icon | Lightning bolt → brand green four-point sparkle (platform's single AI mark), web + mobile. |

**No §0.7 schema changes anywhere** — service images ride `Service.ServiceImages`, portfolio rides `Portfolios.Images`
(global doc `Global_{businessId}`), profile picture rides `BusinessProfile.ProfilePicture*`. No new containers, queues,
ARM or deploy.ps1 entries. No search-index changes.

---

## 1. VERIFIED BASELINE (what exists — investigated 2026-08-28)

- Setup endpoints: `POST api/v1.0/ai/provider-setup/upload-urls` (SAS; **no rate limit today**) + `POST …/process`
  (SSE; per-minute limiter only; token budget dead). Permission `ai.document_intelligence.use`; Partner-only;
  business from token. `AIAssistantController.cs:550/:655`.
- `UseVisionAPI=false` ⇒ photos AND PDFs both go DI `prebuilt-read` OCR → text → `ExecuteThreePhaseExtractionAsync`
  (Phase1 structured extraction, Phase2 Levenshtein 0.85 `ServiceMatchingHelper`, Phase3 AI semantic dedup ≥0.8).
- Apply is server-side, ordered: profile → taxonomy → areas → availability → selected categories → services
  (batch 4, `ProviderSetupServiceWriter`) → pricing notifications → subcategory counts → derivatives → offers →
  onboarding steps → final `Content` SSE event with `Metadata` counts (triplicated in 3 branches).
- Writer image rule (manifest path): images only when service has NONE (`ServiceImages?.Count is null or 0`);
  create rides initial write; derivatives after persist. `ServiceImages.MaxFileCount = 1` ⇒ ONE hero image per service.
- Knowledge harness (all in `clinqetinfrastructure`): `KnowledgeDocumentParser` (+`.OpenXml`/`.Pptx` partials;
  `ParseLayoutMarkdown/ParseHtml/ParseText/ParseJson/ParseDocx/ParseXlsx/ParsePptx`, `collectImages`),
  `KnowledgeImageExtractor` (PDF hybrid: DI figures+PdfPig, IoU, rotation-safe), `KnowledgeImageNormalizer`
  (EXIF/metadata-strip/2048 cap/CMYK/bomb-guard), blocks model with `ImageMarker` positions.
- Caption+classify (caption/kind/quality; kinds Product/Photo/Diagram/Logo/Decorative/TextSnapshot/Unclassified;
  quality Ok/Blurry/Tiny) lives INSIDE `KnowledgeIngestProcessorFunction` (`CaptionAndClassifyAsync` + schema +
  1024px downscale + `BuildBusinessImageMapAsync` contentHash reuse) — must be HOISTED to infrastructure (§4.2).
- Portfolio: one entity; global = `Global_{businessId}` doc (auto-created); `POST business/portfolio/{id}/sas-urls`
  + `confirm-uploads`; derivative parent `Portfolio`; caps 40/request, 10 MB; onboarding Portfolio step = ≥1 doc
  with ≥1 image; global images feed the Open Page AND search cards (`BuildPortfolioImages` Take(4)).
- Profile picture: single image + thumb/medium/status; multipart path re-encodes (2000px); derivative parent
  `BusinessProfile` (conditional-on-URL patch); container `profilepictures`.
- Server-byte-write precedents: `KnowledgeDraftApprovalService.CopyDraftImageAsync` (blob copy → serviceimages →
  `PreparedImages` → writer), `RemoteImageIngestionService` (SSRF-hardened fetch, deterministic ids),
  `UploadDerivativeBlobAsync` primitive.
- Frontends: web `AIAssistantModal.jsx` (8 mount hosts; `entryContext` guard in `openSummaryTarget`), mobile
  `AIAssistantModal.tsx` (6 mounts; guard + `isAppShellMounted`); progress = client-side animation; both clients
  BUFFER the whole SSE body today; mobile process timeout 180 s (< server 300 s). No guard tests. AI-success paths
  don't invalidate the 30 s business-profile cache.

---

## 2. DOCUMENT TYPE ROUTING (Part A)

In `McpService.ProcessAttachmentProviderSetupAsync`, after validation, route by extension:

| Type | Text | Images | DI cost |
|---|---|---|---|
| `.json` | Catalog manifest short-circuit (unchanged) | manifest `ImageUrls` (unchanged) | $0 |
| `.pdf` | DI **prebuilt-layout + markdown** → `ParseLayoutMarkdown` → blocks | DI `output=figures` + `KnowledgeImageExtractor.BindPdfImagesAsync` | layout/page |
| photos (jpg/jpeg/png/tiff/bmp/heic/heif) | DI layout+markdown on the photo → blocks | the uploaded photo itself (Origin=Upload) | layout/page |
| `.webp/.gif` | Normalize→JPEG/PNG first (DI won't take them), then DI | the normalized photo | layout/page |
| `.docx` | `ParseDocx` | embedded (unconditional) | $0 |
| `.xlsx` | `ParseXlsx(collectImages:true)` | `DrawingsPart` | $0 |
| `.pptx` | `ParsePptx(collectImages:true)` — slides only, notes/masters skipped, hidden slides skipped | slide pictures | $0 |
| `.html/.htm` | `ParseHtml(collectImages:true)` | `data:` URIs inline + remote `<img>` via the SSRF-policed fetch (bounded) | $0 |
| `.txt/.md` | `ParseText` | none | $0 |

Then: **blocks → flattener → `ExtractFromTextAsync`** (the existing three-phase pipeline — knowledge-draft-proven seam).
Flattener (new, deterministic, unit-tested): headings as lines; paragraphs verbatim; lists as bullet lines; tables as
compact `header: value` rows (the chunker-proven shape); page/slide markers preserved for the image lane's locality.

Validation updates: `Storage:ProviderSetupDocuments` allowed lists (+ class defaults in `StorageConfiguration`),
`FileValidationHelper.IsExtensionMimeTypeConsistent` pairs, `FileSignature` (xlsx/pptx = ZIP `PK`, tiff II*/MM*, bmp BM;
heic ftyp brands), `MaxFilenameLength` enforced at upload-urls (defect ⑨), 20 MB cap.
Page cap: refuse PDFs over `MaxPdfPages` (default 100 — knowledge parity) with an honest localized error (cost bound + DoS bound).
Frontends: web `ACCEPTED_TYPES`/`accept`/`isAcceptedFile` + convert-hint map (mirrors `knowledgeMeta.convertHintFor`);
mobile picker widened (allFiles + extension gate, like the knowledge picker) + same convert hints.

**Behavior invariants:** empty text + no images ⇒ existing "no content" error; truncation contract unchanged;
manifest path untouched; existing image/PDF *outcomes* preserved or improved (layout ⊃ read content fidelity).

---

## 3. TEXT PIPELINE UNCHANGED (the 100% guarantee)

`ExtractFromTextAsync` and everything after it (prompts, schema, matcher, taxonomy resolver, area service, availability,
offers, writer semantics, notifications, onboarding update) is byte-identical for existing flows. New types simply feed
better-structured text into the same brain. The vision extraction schema is NOT modified (strict-subset rule: enum +
description only).

---

## 4. IMAGE LANE (Part B) — the routing engine

### 4.1 Extract → normalize → dedupe
Reuse `KnowledgeImageExtractor` + parsers (`collectImages:true`) + `KnowledgeImageNormalizer`.
ContentHash SHA-256 dedupe within the document (same image on every page = one candidate; markers kept for locality).
Caps (new settings, §6): `MaxImagesPerDocument` (default 15 for setup), `EmbeddedImageMinBytes` floor,
min-pixel floor (reuse `ImageCaptionMinPixels`-equivalent), HTML remote-fetch cap. All fail-soft: the image lane can
never fail the run (platform rule: "an image is never worth failing the service it belongs to").

### 4.2 Caption + classify (HOIST — shared with knowledge)
New infrastructure service `IImageCaptionClassifier` (name final at build): the schema, prompt, 1024px downscale,
kind/quality mapping and failure fallbacks move VERBATIM from `KnowledgeIngestProcessorFunction` into infrastructure;
the ingest function calls the shared service (behavior identical — pinned by existing Functions tests, which stay in the
Functions suite per §0.18). Setup calls it on `AiWorkloadLane.Interactive`. Caption reuse: consult knowledge's
business-wide contentHash map (`BuildBusinessImageMapAsync` — hoisted or exposed) so an image the business already
captioned anywhere costs $0 here (cost item §6).

### 4.3 Routing gates (service hero image)
- **Gate A (code, absolute):** target = only services created/updated by THIS run; target has NO existing image;
  photo quality == Ok; kind ∈ {Product, Photo}. (Diagram → portfolio-eligible only.)
- **Gate B (AI proposer, one structured text call):** captions + per-photo document position (nearest heading /
  page / slide / sheet anchor) + the run's service list (name/description/category) → per photo:
  `{assign: serviceRef | portfolio | discard, confidence: high|medium|low}` (strict schema, enums only).
- **Gate C (AI vision verify — WINNERS ONLY):** for each proposed photo↔service pair (at most one photo per service),
  one vision call with the actual pixels + the actual service: "Is this a photo of {service}?" → clear yes ⇒ attach;
  anything else ⇒ portfolio. Bounded by services-getting-a-photo (typically 0–5 calls).
- **Gate D (locality, code):** position is EVIDENCE handed to B and C; one restrictive rule only — if the photo
  verifiably sits inside a DIFFERENT service's section than proposed ⇒ portfolio. Absence of locality is never a veto.
- **Gate E (conflict, code):** two photos verified for one service ⇒ highest confidence takes the single hero slot,
  loser → portfolio. One photo can be proposed for only one service (schema shape).

### 4.4 Portfolio routing
- Default bucket for every verified-good photo not placed on a service/profile: **global Photos**
  (`Global_{businessId}` doc; server-side append reusing the confirm-uploads persistence semantics:
  `PortfolioImage` with `ProcessingStatus=Pending` + `Portfolio` derivative message + `RefreshPortfolioStep`).
- Dropped (never added, silent): Blurry/Tiny, Decorative, TextSnapshot, Unclassified, Logo (unless §4.5), floors, over-cap.
- **Projects (D6, appsettings switch):** create a project ONLY when ALL hold: title appears **verbatim** in the document
  text; it heads an explicit project/gallery section; ≥1 verified photo sits inside that section; optional fields
  (completionDate/clientName) only when literally stated — never invented; per-run project cap. Otherwise → global.
- Idempotency: `imageId = DeterministicGuid(businessId, "setup-image", contentHash)`; skip when an entry with that
  imageId already exists on the target doc; blobs at deterministic paths ⇒ re-run of the same file adds NOTHING twice.
- Respect per-request caps (40) by chunking; portfolio has no cumulative cap (verified).

### 4.5 Profile picture (D7 — fail-closed)
Only when `ProfilePictureUrl` null/empty. Candidate: kind==Logo, quality Ok, min-edge floor. Structural signal:
first page/slide/header OR repeats across pages. Dedicated vision verify: "Is this the brand mark for a business named
'{businessName}' (name/initials/branding visible or matching)?" Ambiguity (two non-matching logo candidates) ⇒ set
nothing. Persist: bytes → `profilepictures/{businessId}/…` via the existing re-encode/upload primitive semantics +
`ProfilePicture*` fields set + `BusinessProfile` derivative message (ETag-safe on the profile write; runs before the
final onboarding re-read).

### 4.6 Uploaded-photo-as-input
When the upload IS a photo: the photo itself runs the same classify+route (a genuine work photo → portfolio or
service; a photographed flyer/menu = TextSnapshot ⇒ not placed). heic/heif: DI reads text; pixels degrade gracefully
(ImageSharp has no HEIF decoder — same known hole as knowledge; Magick.NET remains the open owner decision there).

### 4.7 Ordering + failure
Image lane runs AFTER services persist (targets must exist), BEFORE the final metadata event; each placement is
individually fail-soft and counted. Derivative messages after parent writes (P4 ordering rule). Run cancellation
mid-lane loses only unplaced photos — never corrupts a document.

### 4.8 Knowledge draft images (D9)
The shared matcher (B+C gates, Bulk lane) runs in the draft tail over the document's registry images (captions already
paid) → best verified image attached per draft (bytes copied to the draft blob path so dismissal cleanup stays correct);
the existing remote-HTML image attach also gains the verify gate. Approve path unchanged (already copies to
serviceimages + derivatives). No new UI (drafts already render an image).

---

## 5. FEEDBACK UI + PROGRESS (mockup-approved)

- Metadata (all THREE branches → refactored to ONE builder): `serviceImageCount`, `portfolioPhotoCount`,
  `portfolioProjectCount`, `profileImageSet`, `imagesSkippedCount` (analytics only, not rendered).
- Web rows/subtitles + mobile parity exactly as mocked; Portfolio row deep-links via `openSummaryTarget`
  (onboarding-safe by construction); guard tests added BOTH apps (D13).
- Progress: new SSE Analyzer events per phase (incl. `SSE_ProcessingImages` → "Adding your photos...");
  **web** switches to fetch+ReadableStream incremental SSE parse; **mobile** to incremental XHR text reads;
  % eases within a phase, phases advance on real events; buffered parse kept as fallback. 5-step list as mocked.
- Start button sparkle (D15). Upload-card copy keys updated; note/tip structure untouched.
- Localization: every new key ×5 languages, web catalogs + mobile i18next (`_one/_other`) + API `en.json`+4.

---

## 6. SETTINGS (all new keys — appsettings + class defaults MUST match)

Under `AIAssistant:ProviderAttachmentProcessing`:
- `MaxFileSizeBytes` 10 MB → **20 MB** (D4); `MaxPdfPages` 100; `ExtractionModelId` "prebuilt-layout",
  `ExtractionOutputFormat` "markdown" (settings-driven like knowledge).
- `Images:` `Enabled` (kill switch), `MaxImagesPerDocument` 15, `MinImageBytes`, `MinImageEdgePixels`,
  `MaxRemoteImagesPerHtmlDoc`, `CaptionConcurrency`, `VerifyConfidence` wording lives in prompts (enums only in schema),
  `ProfilePictureEnabled`, `PortfolioProjectsEnabled`, `MaxProjectsPerRun` 3, `ProfilePictureMinEdgePixels`.
- `RateLimiting:DocumentIntelligence` — per-minute (existing) + **`RequestsPerDay`** durable cap + token budget WIRED;
  applied to upload-urls AND process. 429 + Retry-After, localized.
Knowledge tail: `VoiceKnowledge:ServiceDrafts:ImageMatch*` keys for D9 (Functions host carries what it reads; convention
tests updated). Cost posture: $0 DI for Office/HTML/text; PDFs layout-priced with the page cap; captions deduped
in-doc + reused business-wide; ONE proposer call; verify winners-only; gpt-5.4-mini; 1024px downscale everywhere.

---

## 7. PRE-EXISTING DEFECTS — ALL IN SCOPE (D10)

① web ACCEPTED_TYPES offers bmp/tiff server rejects → resolved by D2. ② mobile process timeout 180 s → raise above
server 300 s (settings-driven). ③ AI-success paths don't invalidate the 30 s profile cache → fixed via §8. ④ no
onboarding-guard tests → added both apps. ⑤ `VisionSupportedContentTypes` lists bmp/tiff Azure vision would reject →
corrected. ⑥ metadata triplication → one builder. ⑦ upload-urls has no rate limit → D5. ⑧ token budget dead config →
wired. ⑨ `MaxFilenameLength` unenforced → enforced at upload-urls. ⑩ no admin alert on systematic extraction failure →
`AiEnrichmentFailureTracker` component "ProviderSetupExtraction" wired (respects existing gates/cooldowns). ⑪ fake
progress/buffered SSE → §5. ⑫ `DetermineChanges` ignores description/duration → both counted as changes; on update,
duration written when extracted; description filled ONLY when existing is blank (provider-authored text never clobbered).
⑬ Pricing full-replace on update → audit + pin with tests (null-extracted preserves; unusable-extracted preserves when
existing usable; range↔fixed transitions leave no stale fields); fix any hole found. ⑭ exact-name match overriding a
"create" verdict → verified as the deliberate dedupe safety net (unreachable when Phase 2 ran; load-bearing for
manifest/knowledge); pinned by test + one-line comment. ⑮ `IsAtStore/IsAtCustomersLocation` create-only → deliberate
(protects per-service manual settings); pinned by test + comment. ⑯ rename-re-run duplicate services → irreducible
without a review queue; documented limitation (knowledge drafts are the reviewed path). ⑰ orphaned `AISetup.*` keys +
dead 0-byte `GalleryTabs.jsx` → deleted. ⑱ mobile Photos-tab picker missing `checkMediaFile` + count cap (parity bug
found in investigation) → fixed. Plus: anything else found during build/audit gets fixed — standing policy.

---

## 8. REFLECTION MATRIX (D12) — assert on web AND mobile

On run success: `invalidateBusinessProfile()` (web) / mobile profile cache equivalent + per-host refetch:
| Host page | Must reflect immediately |
|---|---|
| BusinessDetails (onboarding step 1 / dashboard Business Info) | name, description, socials, years/employees, **profile photo**, address flags |
| BusinessAddress | address |
| ServiceArea | new areas (+ default) |
| BusinessCategory | selections |
| ManageServicesPrice | services incl. hero photos |
| SetAvailability | hours |
| Offers | offers |
| Onboarding wizard header | progress bar + step ticks (incl. Portfolio step completed by added photos) |
Same matrix on the mobile mount screens. Each row = an audit assertion.

---

## 9. TEST PLAN (per §0.8 — integration mandatory: Service Bus + storage involved)

- Unit (per host, §0.18 placement): routing per extension; flattener shapes; every gate A–E kills independently
  (sabotage-verified); classifier hoist byte-parity; dedupe/idempotency; caps; profile-picture fail-closed branches;
  project verbatim-title gate; metadata builder; rate limiter (minute+day+tokens); refusal hints; DetermineChanges
  additions; writer pins (⑬⑭⑮); knowledge tail image attach; convention tests for new settings (both-ways where the
  host pattern demands).
- Integration (real Cosmos emulator + Azurite): end-to-end process for a real .docx/.xlsx/.pptx/.html fixture →
  services + areas + availability + offers persisted; image lane → blobs at deterministic paths + derivative messages +
  Service/Portfolio/Profile docs patched + onboarding steps; **replay**: same file twice ⇒ zero duplicates, no
  overwrites; cancellation mid-lane leaves consistent state; knowledge draft with matched image approved → service
  carries it. Functions integration for the tail change.
- Frontends: jest guard tests (D13), rendering-rule parity suites (web+mobile), locale completeness ×5, ESLint zero
  errors, `next build` clean, mobile tsc + jest green.

## 10. FINAL MULTI-DIMENSIONAL AUDIT (D14 — mandatory phase)

Adversarial pass over the program's own diff: correctness / concurrency (ETag, parallel batches, cache races) /
cost (RU, DI pages, vision calls) / security (SSRF, tenancy scoping, blob path traversal, SAS scope) /
localization ×5 / web↔mobile parity / reflection matrix walk / onboarding-guard walk / edge-case sweep
(corrupt files, 0-byte images, password-protected office files, 40-image decks, logo-on-every-page, duplicate
images across pages, huge XLSX, HTML with 200 remote imgs, cancelled runs, cap collisions, permission-limited
team members, business-context switch mid-run, concurrent runs same business, re-run after manual edits) —
every finding fixed or explicitly owner-reported. Trees clean (§0.16). Skills ×4 + memory updated (§0.9).

## 11. EXECUTION ORDER

P1 backend foundations: settings + validation + routing + flattener + rate limits + defect fixes ⑤⑥⑧⑨⑩⑫⑬⑭⑮ + tests →
P2 image lane (hoist, gates, persistence, metadata) + knowledge D9 + tests →
P3 web UI (mockup-faithful) + streaming progress + reflection + guard tests →
P4 mobile parity (all of P3) + picker widening + timeout fix →
P5 localization sweep ×5 ×(web, mobile, API) →
P6 cleanup (⑰⑱, orphans) + skills ×4 + memory →
P7 the audit (§10). Owner pushes/deploys per the standing rule (shared→core→infrastructure→functions→api→web→mobile).
