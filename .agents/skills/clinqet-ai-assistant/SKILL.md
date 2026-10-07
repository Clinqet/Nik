---
name: clinqet-ai-assistant
description: |
  **CORE FEATURE SKILL** — Work on the AI Assistant feature: multi-modal chat
  for providers (text + speech), MCP (Model Context Protocol) tool orchestration,
  document intelligence for provider onboarding, SSE streaming responses, session
  persistence in Cosmos with in-memory cache, AI rate limiting (request + token
  budget). AI provider is Azure OpenAI (GPT-5.4-mini) via Azure AI Foundry; speech
  via Azure Cognitive Services; document intel via Azure Document Intelligence.
  USE FOR: speech-to-text, text enhancement, MCP chat sessions, document
  extraction for provider setup, session lifecycle, tool discovery + execution
  via reflection, rate limiting (3 endpoints: text-enhancement, mcp-chat,
  document-intelligence), AI failure tracking with admin alerts, SSE streaming.
  Applies to clinqetapi Controllers/AI/AIAssistantController.cs,
  clinqetinfrastructure/Services/AI/ (McpService + McpSessionService + McpAIService
  + McpToolDiscoveryService + McpToolExecutionService + SpeechService +
  TextEnhancementService + DocumentIntelligenceService + AICompletionService +
  AiRateLimitingService + AiEnrichmentFailureTracker + JsonRepairHelper +
  ServiceMatchingHelper), clinqetshared/DTOs/AI/AIAssistantDtos.cs,
  clinqetshared/Enums/AudioLanguage + ChatInteractionType + ReasoningEffort.
---

> ‼️ **SUPERSEDED IN PART (2026-09-02) — the in-app CHAT assistant was DELETED.**
> `POST /api/v1/ai/chat`, its three `ai/sessions` endpoints, `IMcpAIService`/`McpAIService`,
> `IMcpToolGateway`/`McpToolGateway`, `ChatToolSessions`, `Mcp:ChatToolAllowlist`, the chat branch in the
> MCP's `McpToolGuard` and both repos' `ChatToolAllowlistConventionTests` no longer exist. Every passage
> below describing the chat assistant, its tool gateway or its allowlist is HISTORY, not current behaviour.
> The provider-facing replacement is **Business Search** — see `clinqet-business-search`.
> Still live and unchanged: speech-to-text, enhance-text, provider-setup document intelligence, the whole
> VOICE path, and `IMcpSessionService`/`McpSessionService`/`AiSession` (rewritten as the Business Search
> conversation store, member-scoped and CAS-guarded).

# CLINQET AI ASSISTANT — COMPREHENSIVE SKILL

## RECENT CHANGES — 2026-10-02/03 (AI setup reads like the knowledge ingest; BUILT, uncommitted, NOT deployed)

Authority `C:\Nik\Data\knowledge-reading-accuracy\BUILD-STATE.md` + `plans\PLAN-D-setup-and-drafts.md`. Reading rules, raw AI
bank and alert shape: `clinqet-voice-assistant` (2026-10-03 section).

- AI quick setup reads files through the same `KnowledgeDocumentParser` (furniture kept, figures closed, the conservation gate
  with page rebuild and plain-text floor).
- `ProviderSetupDocumentReader` returns every reading fact through `VisionReadingFacts.WithReading` (the one list, shared with
  the ingest): `Conservation` and unpaired price lines now reach setup. `ProviderSetupDocumentContent` is a record with
  `ContentHash` (SHA-256 of the upload), `TextNotCarried` and `ReusedKnowledgeDocId`. `ReadAsync` takes a `stopBy` deadline.
- Setup banks by the BYTES: `KnowledgeBlobPaths.OcrSetupDocumentKey` = `"setup"` (the file-name key is deleted); the whole-file
  DI read is banked at `OcrSetupReadingBlob` (`_ocr/{biz}/setup/{hash}/di.json.gz`, `provider-setup-docs`).
- `AIAssistant:ProviderAttachmentProcessing:MaxReadingPasses` (2): a pass that ran out of time carries on while it banks something new
  and the deadline leaves time. Setup reuses a Ready knowledge document's reading of the same bytes (`ReusedKnowledgeDocId`).
- Price gate before writes: `ProviderSetupServiceGate` (`AnchorNameTokenOverlap` 0.6) checks each price against the file;
  `ProviderSetupFactChecks` withholds a phone, address, day's hours, offer discount or duration the readings disagree on
  (`FactWithheld`). Offering check: `ProviderAttachmentProcessing:OfferingJudge` on sub-flow `AiSubFlows.SetupOfferingJudge`.
- `McpService` sends ONE `PublishReadingOutcomeAsync` (`ProviderSetupReadingNeedsReview`) in every terminal branch; the per-check
  alerts are deleted. The setup summary tells the provider (web `SetupReadingNotices.jsx`, phone `SetupReadingNotices.tsx`).
- A price above the review ceiling is KEPT and marked `PriceBeyondReviewCeiling` (judged in the business's currency; content limit
  `SetupPriceBeyondReviewCeiling`). `CatalogManifestService.Validate` no longer refuses a whole manifest over one price above
  `CatalogManifest:MaxAllowedPrice`; `Error_CatalogRecordPriceTooHigh` is removed.
- Tests: API `ProviderSetupDocumentReaderTests`, `McpServiceTests`, `CatalogManifestServiceTests`; integration
  `ProviderSetupReadingConservationIntegrationTests`.

## RECENT CHANGES — 2026-09-11 (‼️ THE DOCUMENT JUDGE THIS FLOW SHARES WAS REWRITTEN — knowledge extraction fix programme Phase 1 of 4; BUILT + GREEN, owner deploys)

(2026-10-03: `DocumentTranscriptComparer` is deleted — see the section above. The one-implementation rule still holds.)
**This matters here even though the programme is a knowledge/voice one:** `DocumentTranscriptComparer` +
`VisionDocumentTranscriptionService` have **one implementation and three callers** — knowledge ingest,
service-draft re-derivation and **AI profile setup / provider attachment processing**. Whatever a document
says after adjudication, this flow reads.

**The three readings:** **A** = Document Intelligence OCR markdown (handed to B as a whole-line prefix, with
a partial flag when cut), **B** = the vision page transcription (`gpt-5.6-luna`), **C** = the third-reader
verifier (`gpt-6.1-sol` since 2026-10-02). The adjudication is in code, not in a prompt. B, the picture captions and the
picture checks run on `AiModels.Reader` (`gpt-5.6-luna`, P4-B-38).

**The policy, owner-approved 2026-09-11** (`AdjudicationPolicyVersion = "2"`, folded into
`ValidationFingerprint`, so every banked page is re-verified under it):

1. **B wins on layout** — a two-column page the machine read across is not a dispute and costs no third
   reading.
2. **A wins on a value B dropped**, only where C confirms it is on that page, and never by pasting A's row
   over a richer B span (`MaxRepairWordLossPercent` = 25 — the key is in **this host's** appsettings too, at
   `AIAssistant:ProviderAttachmentProcessing:Vision`).
3. **"Answered: not on this page" ≠ "no answer"** (`AnsweredNotOnPage`). Collapsing the two reverted a whole
   page to OCR garbage.
4. **An invented price is removed only when C cannot find it** — deleting a real price is worse than keeping
   an unconfirmed one; amounts are compared through `KnowledgeFigures.Numbers`, so a re-format is not an
   invention.
5. **A revert needs evidence about the WHOLE page**, never one region.

Also relevant to this flow: the caption/classifier interface gained a `documentLanguage` parameter (the
description is written in the language the provider and the caller share), and `.tif` is now accepted by
`StorageConfiguration:ProviderSetupDocuments:AllowedExtensions` — the pipeline always read it while the
upload gate refused it.


‼️ **ONE MORE THING THIS FLOW SHARES — the hyphen rule (EX-32, 2026-09-11).** `DocumentIntelligenceService`
feeds provider setup from a RENDERED page, so it is on the side of the rule that DROPS a hyphen at a line
break (`KnowledgeText.DehyphenateRenderedPage`, applied in `ParseLayoutMarkdown`) — guarded by a three-letter
typographic minimum and by the document's own spelling elsewhere. A TYPED document (DOCX/XLSX/PPTX/HTML/TXT)
now **KEEPS** every hyphen it carries: `anti-` / `ageing` is `anti-ageing`, not the non-word `antiageing`.

Authority and evidence: `C:\Nik\Data\knowledge-extraction-fix-plan\PLAN.md` and
`phase-1\{AUDIT.md,HANDOVER.md}`. Tests:
`clinqetfuncations\Clinqet.Communications.UnitTests\Knowledge\DocumentTranscriptionAdjudicationTests.cs` (43).


## RECENT CHANGES — 2026-08-14 (chat→MCP gateway documented + DR-10 tool allowlist)

- **The chat assistant's tools are the VOICE MCP server's tools**, reached through `clinqetapi\Clinqet.API\Services\McpToolGateway.cs` (previously undocumented here): `CreateSessionAsync` mints a `VoiceCallScope.Partner` per-session token + a `VoiceCallSession` binding doc with call id `chat-{guid}` (`Clinqet.Shared.Constants.ChatToolSessions.CallIdPrefix`), and `McpAIService.StreamAIResponseAsync` feeds the gateway's `ListToolsAsync` catalog to the model each iteration (cached `Mcp:ToolCatalogCacheMinutes` = 5). Every chat tool call runs through the Clinqet.Mcp channel auth + `McpToolGuard` (caps/scope/audit) exactly like a voice call. On a stamp without the MCP server the chat runs toolless.
- **‼️ DR-10 (owner, 2026-08-13): chat sessions are restricted to `Mcp:ChatToolAllowlist`** (16 names — bookings/quotes/services/catalog/context reads). TWO layers: the MCP server's `McpToolGuard` REFUSES a non-allowlisted tool on a `chat-` call id ("This tool is not available in chat sessions.", Refused audit row) — the real boundary — and the gateway's `ListCatalogAsync` filters the catalog so the model never even sees excluded tools. **send/verify/OTP + voice-call-only tools are chat-refused** (a chat session could previously trigger customer-facing OTPs). The list's class default (`McpServerSettings.ChatToolAllowlist`) is mirrored byte-identically in the API **and** MCP appsettings; each repo pins its own file to the class default via `ChatToolAllowlistConventionTests`, so the two hosts cannot drift. A NEW MCP tool stays chat-invisible until deliberately added to the list.
- The legacy in-process `[MlcTool]` reflection layer (`McpToolDiscoveryService`/`McpToolExecutionService`) documented below still exists; the MCP gateway path above is how send-capable operations are reached, and is the one the allowlist governs.
- **Chat prompts truthed-up (audit fix):** `AIAssistant:BaseSystemPrompt` + `InteractionTypePrompts.SearchService` (Main API appsettings) referenced `search_services`, deleted from the MCP catalog 2026-07-28 — the SearchService focus prompt's only actionable instruction was uncallable. Both now describe `find_services` as what it IS (THIS provider's own catalog: keyword/group/price) and state that marketplace-wide search is not available in chat. There is NO marketplace-search chat tool anymore — do not "fix" a search complaint by re-pointing prompts at one.

## RECENT CHANGES - 2026-08-14 (setup pricing status and remediation delivery)

- A successfully persisted AI-uploaded service with complete usable pricing is `Approved` immediately. Only a new service with missing, malformed, non-positive, incomplete-range, or inverted pricing becomes the existing `PendingProviderCompletion` status. An existing service whose trusted complete price is preserved is not treated as incomplete.
- Tax remains evidence-only. `Pricing.TaxIncluded` and `Pricing.TaxRate` change only when the document supplies explicit usable tax evidence; otherwise setup leaves new values unset and preserves existing values.
- After incomplete services are committed, the setup path batches actual returned `Service` objects. It emits one durable silent exact-service notification per incomplete service and one transient upload summary per recipient, only when at least one incomplete service persisted. The run identity is the validated canonical blob host/path without SAS query data.
- The aggregate live message never creates an extra notification-center row. Outside onboarding it opens Notifications; during provider onboarding its tap is non-navigating so it cannot bypass the wizard.

## RECENT CHANGES — 2026-08-13 (provider setup production hardening)

The flyer/PDF provider-setup path now treats the global catalog as a preferred vocabulary, not a forced nearest-match list:

- The extraction and vision prompts receive the complete global category/subcategory hierarchy plus the provider's bounded `ContextMessage`. The AI must try to reuse a genuine global pair, but it may return `CustomProposal` when the catalog does not fit. `taxonomyConfidence` is advisory evidence in the 0–1 range; it is not a server-side acceptance threshold.
- `ProviderSetupTaxonomyResolver` owns the write-side decision. A valid global category and subcategory are reused. If only the parent category fits, the global parent is retained and only a deterministic business-scoped custom subcategory is created. If no parent fits, a deterministic custom parent and child are created. Claimed IDs, parent-child relationships, bounded names, business ownership and the `AllowCustomCategoryCreation` switch are validated before any write.
- AI-owned custom taxonomy creation has a required `CustomCategoryAlertService` dispatch. Replays may retry the same deterministic event so a failed dispatch can heal, while `AdminAlertProcessor` uses that event identity as the Cosmos id and treats conflict as success; therefore the logical admin alert cannot be skipped or duplicated. Reusing global taxonomy or an existing non-AI custom node does not create alert noise.
- `ProviderSetupProfileService` fills only missing profile/address facts, geocodes a new full address, uses ETag retries, and preserves provider-authored values. `ProviderSetupServiceAreaService` resolves explicit extracted countries before the profile-address fallback, keeps every read business-partition scoped, and creates deterministic geocoded areas only above the configured area confidence.
- Pricing completeness is semantic: fixed/hourly must be finite and positive; ranges require finite positive start and max values with `max >= start`. Existing trusted pricing survives unusable OCR. New incomplete services become `PendingProviderCompletion` and the exact affected service IDs drive the client summary.
- Extracted `Pricing.TaxIncluded` / `Pricing.TaxRate` are written only from explicit usable document evidence. Missing or ambiguous evidence leaves new values unset and never overwrites existing values. This is separate from the nullable business-inherited `Service.Taxable` / `Service.AcceptsOnlinePayments` defaults controlled by the setup dialog.
- Availability fills missing business-level days without overwriting existing days. Offers use a canonical business-owned blob path for deterministic identity, so rotating a SAS query or replaying the same upload does not duplicate an offer.
- Provider web and provider mobile share the same complete-price rules and the SSE completion contract, including the exact-service IDs needed for follow-up editing. No new UI surface was introduced.

### Offer + availability vocabulary contract (Phase 4 audit, 2026-08-14)

‼️ **The AI's recurrence vocabulary must match what `OfferValidationService` matches on at booking time, or a schedule silently stops applying.** That validator compares `ByWeekDays` against two-letter ISO codes (`MO`…`SU`), so a stored `"MONDAY"` makes a weekly offer valid on **no** day, and it *ignores* constraints it cannot parse, so a half-built recurrence silently becomes an **always-active** offer. Three layers now defend this, and all three must stay:

1. **Prompt** — instruction 12 states the ISO codes are the only accepted values and that a time window is set both-or-neither. Class defaults in `AIAssistantSettings` **and** the `appsettings.json` override must both carry it; config wins at runtime, so editing only the class default changes nothing.
2. **Schema** — `DocumentIntelligenceService.BuildExtractionSchema` constrains `repeat.frequency`, `byWeekDays`, `byMonthDays`, `byMonths`, `discountType`, `priceType` and `businessHours.dayOfWeek` with `enum`. ‼️ **`enum` only.** The call sends `strict: true`, whose supported subset excludes `minimum`/`maximum`/`pattern`/`minItems`; an unsupported keyword can 400 the entire extraction. Express integer ranges as an `enum` (see `MonthDayValues`/`MonthValues`). The OCR path has **no** schema (JSON mode only), which is why layer 3 is mandatory.
3. **Server** — `McpService.TryBuildOfferRepeat` re-validates everything and returns false for an explicit-but-malformed recurrence, so `SaveExtractedOffersAsync` **skips the offer** rather than storing a wrong one. Overnight windows (start after end) are **legitimate** — the validator supports them; never reject those. Inverted offer dates and a recurrence ending before the offer starts are skipped too, because `GetActiveOffersAsync` could never return them.

- **A skipped offer is provider-visible.** `SaveExtractedOffersAsync` returns `(Saved, Skipped)`; `offerSkippedCount` rides the existing Content-event metadata and both clients render a warning in the existing summary (web `AISetup.SummarySkippedOffers*`, mobile `SUMMARY_SKIPPED_OFFERS_*`), reusing the `noPriceCount` warning pattern. ‼️ The clients read **metadata counts**; `profileUpdates` is only a presence flag whose individual strings are never rendered — a backend-only localized line would be invisible.
- ‼️ **D-A6 (search-topology Phase 3C, 2026-09-25) — an offer the provider DELETED stays deleted and is NOT counted in
  `offerSkippedCount`.** A re-run of the same file lands on the id of an offer deleted since the earlier run; the create
  conflicts, `GetOfferByIdIncludingDeletedAsync` finds it `IsDeleted`, and it is left alone (logged). Counting it as
  skipped showed the skipped-offer warning (the summary line described above) for an offer the provider removed
  on purpose.
- Offer dedup signatures are computed **symmetrically from the resolved stored scope** (`GetServiceNamesFromCategories`) plus the full normalized schedule and end date, for both existing offers and new candidates. `StartDate` is excluded because it is defaulted at save and cannot round-trip. Signing raw extracted service names duplicated on replay whenever a name failed to resolve.
- Closed availability days store **null** start/end times, matching the manual availability controller, and an explicitly closed day with null times is kept, not dropped.
- Media-derivative messages are enqueued **only after** the parent service write persists, on the update path as well as create; otherwise a failed update publishes derivatives for image IDs no document carries.
- The schema carries **no keyword outside the strict subset** — the Phase-1 `minimum`/`maximum` on `taxonomyConfidence` was removed (owner-approved 2026-08-14) because it risked a whole-call 400 and bought nothing: `TaxonomyConfidence` is logged only, never thresholded. `DocumentIntelligenceServiceTests` fails the build if `minimum`/`maximum`/`pattern`/`minLength`/`maxLength`/`minItems`/`maxItems`/`multipleOf`/`uniqueItems` reappears.

### Tax from a flyer: what "plus tax" means (2026-08-14)

`QuotePriceCalculator` and `BookingTaxResolver` are both **tri-state on `PaymentConfig.TaxEnabled`**: `false` ⇒ no tax; `true` ⇒ the business rate wins and the per-service rate is only a fallback; `null` ⇒ honour whatever is baked into `Pricing` (`taxInclusive = pricing.TaxIncluded == true`, and an amount only when `pricing.TaxRate is > 0`). The two `Pricing` tax fields are therefore applied **independently**, which makes partial evidence usable without inventing anything:

| Document says | `TaxIncluded` | `TaxRate` | Why |
|---|---|---|---|
| "plus tax" / "+ tax", no % | `false` | untouched (null) | Exclusivity is explicit; the provider's own `PaymentConfig`/jurisdiction rate supplies the number. With `TaxEnabled == null` this is identical to doing nothing, so it is safe in every configuration. |
| "tax included", no % | `true` | untouched (null) | Correctly treats the printed price as tax-inclusive. |
| "13% HST" | as stated | `0.13` (fraction) | Fully explicit. |
| nothing / ambiguous | untouched | untouched | Frozen owner rule: never infer tax from country, address, currency, category, or service type. |

‼️ **A bare `TaxRate` of 0 is never written** (`svc.TaxRate is > 0 and <= 1`). Zero behaves exactly like no rate at every consumer, but writing it would **wipe a provider's real stored rate on an update** — pure loss, no gain. The prompt forbids reporting 0 to mean "no tax stated" and requires null.

**A money amount must never become a rate**, and this is enforced in three places because no single one is sufficient:

1. **Field description in the schema** — `taxRate` and `taxIncluded` carry a `description`. ‼️ `description` **is** inside the strict subset (it is an annotation, not a validation keyword), which makes it the only way to state a numeric rule on the field itself, since `minimum`/`maximum` would risk a 400. Use this pattern for any future numeric field.
2. **Prompt** — instruction 5a states `taxRate` is only ever a percentage and that a money amount (`"+ $6.50 tax"`) must set `taxIncluded = false` with a null rate, never be converted into a rate. Class default **and** `appsettings.json`.
3. **Server guard** — `is > 0 and <= 1` refuses `6.50`, `13`, and `1.13` outright. This is the actual enforcement: it holds even if the model ignores everything above, and the **OCR path has no schema at all**.

‼️ **Known residual limit:** the guard cannot distinguish a money amount that is itself ≤ 1 (a flyer's "+ $0.50 tax" arriving as `0.50` is indistinguishable from 50%). Closing it would need a configured plausibility ceiling (no real-world tax rate exceeds ~28%); the owner was told and it is deliberately not added yet.

## RECENT CHANGES — 2026-07-29 (structured CATALOG MANIFEST import + remote image ingestion)

Provider setup gained a **second input class beside the flyer/PDF**: a versioned JSON *catalog manifest*. Where a flyer is OCR'd and then guessed at by the AI, a manifest is already typed — so the manifest branch **skips OCR and skips AI extraction entirely**. Nothing about a serial number, price or hour reading is ever inferred. Built for onboarding an equipment dealer (685 machines), but the mechanism is generic.

- **Detection + parse + projection**: `ICatalogManifestService` / `CatalogManifestService` (`clinqetinfrastructure\Services\AI\`). `LooksLikeManifest(fileName, contentType)` is a cheap `.json`/`application/json` gate so a flyer never pays for a parse attempt. `ReadAsync` downloads, parses, and validates (version, chunk cap, DataAnnotations walked **manually** over records/areas/attributes because `Validator` does not recurse into collections). `ProjectAsync` resolves the taxonomy + service areas and emits the **same `AttachmentExtractionResultDto`** the rest of the pipeline already consumes, so every downstream step is reused untouched.
- ‼️ **ORDERING IS LOAD-BEARING.** `ProjectAsync` runs **BEFORE** `_categoryPromptService.GetCategoryPromptDataAsync` in `McpService.ProcessAttachmentProviderSetupAsync`. Projection *creates* the business-scoped categories the records reference; a lookup taken earlier would reject every record as an unknown category. Do not "tidy" the reads back into one `Task.WhenAll`.
- **Taxonomy is business-scoped, resolved BY NAME, and prefers the shared catalog.** Per pair it tries an exact-name global top-level → the business's own custom → else creates `IsCustom=true, Approved=true, IsActive=true, BusinessId=<provider>`, with `FullPath = "Parent > Child"`. Resolving by name removes any id round-trip or ordering dependency between chunks. Verified safe: `GetGlobalCategoriesAsync` is pinned to `GLOBAL_BUSINESS_ID` so the consumer catalog/SEO/facets never see these, while the voice catalog map (`FullProviderContextService`) and `AzureSearchIndexer` both resolve names via `GetCategoryByIdAsync(id, businessId)`, which point-reads global **then** the business partition.
- ‼️ **The manifest path uses its OWN price ceiling.** `ProviderAttachmentProcessing.MaxAllowedPrice` (99,999.99) exists to catch OCR misreads; a manifest has no OCR, and heavy equipment clears that by an order of magnitude (median $99k, max $1.88M). `CatalogManifest.MaxAllowedPrice` (5,000,000) applies instead, selected inline off `manifest != null`. Without this the guard would have stripped the price from 340+ machines.
- **`ExtractedServiceDto` gained** `DescriptionParagraphs` (multi-paragraph, preferred over `Description` when non-empty), `ExternalId`, `ImageUrls`, `Currency`, `PriceNote` (already localized + formatted, lands on `Pricing.Notes` verbatim), `ServiceAreaIds` (per-record; a manifest bypasses `ResolveSetupServiceAreaIdsAsync` because each record names its own branch).
- ‼️ **Identity is `ExternalId`, never the name.** When `ExternalId` is present the existing-service lookup is a deterministic-id point match and `FindBestNameMatch` is **skipped** — fuzzy name matching would let two similarly-named machines claim each other's document. `ServiceId = DeterministicGuid.Create(businessId, "service", externalId)` (RFC 4122 v5), so re-importing a chunk targets the same document instead of duplicating it. This is what makes manual chunk-by-chunk operation safe.
- **Remote images**: `IRemoteImageIngestionService` / `RemoteImageIngestionService` (`Services\Storage\`) fetches operator-supplied URLs into our own `serviceimages` container, then queues the **existing** `MediaDerivativeQueueMessage` so the existing processor makes the WebP thumb/medium. Images are ingested **before** the Cosmos create so they ride the initial write; on the update path only when the service has no images yet, so a re-run re-downloads nothing. Derivative messages are drained from a `ConcurrentBag` **after** the batch loop — never before the parent document exists.
- ‼️ **SSRF controls are not optional** — the URLs are operator-supplied and fetched server-side. https only; host allow-list (`RemoteImageIngestion:AllowedHosts`, empty ⇒ refuse everything); DNS resolution rejected if **any** address is loopback/private/link-local/CGNAT/multicast/unique-local; `AllowAutoRedirect = false` on the named client and a 3xx is a **failure**, not a hop; `Content-Type` **and** magic bytes checked; size capped **while streaming** (a lying `Content-Length` cannot get an unbounded body into memory).
- **A failed image never fails its service** — it is reported and the service is still created. Image count is capped by `min(MaxImagesPerRecord, Storage:ServiceImages:MaxFileCount)`; the container constraint is the single source of truth, so raising the platform cap automatically raises what imports take.
- **Settings**: `AIAssistant:ProviderAttachmentProcessing:CatalogManifest` (`Enabled`, `MaxRecordsPerChunk` 50, `MaxFeaturesPerRecord` 60, `MaxDescriptionParagraphLength` 4000, `MaxAllowedPrice` 5000000, `MaxImagesPerRecord` 1) + top-level `RemoteImageIngestion`. `.json`/`application/json` added to `Storage:ProviderSetupDocuments`. **No new Service Bus queue, Function, ARM or deploy.ps1 change.** Also corrected a pre-existing drift: `ProcessingTimeoutSeconds` class default 120 → 300 to match appsettings (600 in class and appsettings since 2026-09-01).
- **New localization keys** (all 5 files, en/fr/es/hi/gu at parity): `SSE_ImportingCatalog`, `Label_CatalogAttr_*` (10, one per `CatalogAttributeLabel`), `Label_CatalogFeatures`, `Label_CatalogDeposit`, and the `Error_Catalog*` set. Attribute labels are **customer-facing** — they render inside the service description — so they are resolved through `ILocalizationService` at import time, not baked in by the offline tool.
- **Offline prep tool** (`C:\Nik\providerAIOnbording\tools\`, Node, deliberately NOT shipped — it hits a third-party site once per machine). Stages: `normalize` → `scrape` → `manifests`. It emits branch-aligned chunks and self-validates every chunk against the DTO contract before writing, so a contract breach is caught at build time rather than mid-import.
- ‼️ **The web AI Quick Setup dialog accepts `.json`; the MOBILE one deliberately does NOT.** `AIAssistantModal.jsx` adds `application/json` to `ACCEPTED_TYPES`, a `.json` extension check in `isAcceptedFile` (some platforms report an empty `File.type`), `.json` on the input's `accept`, and derives `contentType` from the extension when `File.type` is empty so the server's allowed-MIME check cannot reject it. This is the ONE sanctioned break in the web/mobile lockstep — nobody imports a dealer catalog from a phone. Without it the operator cannot select the manifest at all and the whole path is unreachable.
- ‼️ **The listing page's own `<meta itemprop="image">` is the only reliable image anchor** — it appears exclusively inside the product media block, so it never picks up the ~120 related-machine thumbnails also on the page. The same microdata carries `price`/`priceCurrency`/`brand`/`model`, which the tool cross-checks against the export.


## ARCHITECTURE OVERVIEW

```
Provider (text or voice)
   ↓
AIAssistantController endpoint (multipart/form-data)
   ↓ rate-limit check
   ↓ if audio → SpeechService.ConvertSpeechToTextAsync
   ↓
McpService (orchestrator)
   ↓
McpSessionService — load/create session (Cosmos + 5-min in-memory cache)
   ↓
McpAIService.StreamAIResponseAsync — Azure OpenAI ChatClient (streaming)
   ↓ tool calls (if any) → McpToolExecutionService
   ↓ token usage → AiRateLimitingService.RecordTokenUsageAsync
   ↓
SSE chunks (text/event-stream) → frontend
```

Sessions persisted in Cosmos `SystemData` container as `AiSession` documents (pk `/pk`) with 7-day TTL. Conversation history truncated after `MaxConversationRounds`. First 3 turns get full content; later turns truncated to `TruncatedContentLength` (300 chars).

---

## CONTROLLER — `AIAssistantController.cs` (`clinqetapi\Clinqet.API\Controllers\AI\`)

All endpoints `[Authorize]`. Multipart/form-data inputs for audio uploads.

| # | Verb | Route | DTO In | Out | Rate-Limit Endpoint |
|---|------|-------|--------|-----|----------------------|
| 1 | POST | `/api/v1/ai/speech-to-text` | `SpeechToTextFormRequestDto` (audio file + optional `SourceVoiceLanguage`) | `ApiResponse<SpeechToTextResponseDto>` | `speech-to-text` |
| 2 | POST | `/api/v1/ai/enhance-text` | `TextEnhancementFormRequestDto` (text OR audio + `EnhancementType`) | `ApiResponse<TextEnhancementResponseDto>` | `text-enhancement` |
| 3 | POST | `/api/v1/ai/chat` | `ChatInputFormRequestDto` (message OR audio + sessionId + ChatInteractionType) | **SSE stream** (`AiResponseDto` per event) | `mcp-chat` |
| 4 | POST | `/api/v1/ai/provider-setup/upload-urls` | `ProviderSetupUploadUrlRequestDto` | `ApiResponse<ProviderSetupUploadUrlResponseDto>` | — |
| 5 | POST | `/api/v1/ai/provider-setup/process` | `ProviderSetupProcessRequestDto` | **SSE stream** (extraction progress) | `document-intelligence` |
| 6 | GET | `/api/v1/ai/sessions` | — | `ApiResponse<List<AiSessionSummaryDto>>` | — |
| 7 | GET | `/api/v1/ai/sessions/{sessionId}` | — | `ApiResponse<AiConversationContext>` | — |
| 8 | DELETE | `/api/v1/ai/sessions/{sessionId}` | — | `ApiResponse` | — |

SSE response headers (set in `EnsureSSEResponseHeaders`):
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
- Buffering disabled via `IHttpResponseBodyFeature.DisableBuffering()`.

Each SSE event format: `data: {json}\n\n` with `AiResponseDto` (EventType + Message + optional payloads).

---

## SERVICES (`clinqetinfrastructure\Services\AI\`)

### `McpService.cs` — Orchestrator
Deps: `IMcpSessionService, IMcpAIService, ISpeechService, IDocumentIntelligenceService`, Cosmos repos.

Public:
- `ProcessTextInputAsync(McpTextInputRequestDto, businessId, language, country) → IAsyncEnumerable<AiResponseDto>` — validates message, loads/creates session, calls `McpAIService.StreamAIResponseAsync()`.
- `ProcessVoiceInputAsync(McpVoiceInputRequestDto, businessId, language, country) → IAsyncEnumerable<AiResponseDto>` — transcribes via SpeechService → calls ProcessTextInputAsync.
- `ProcessAttachmentProviderSetupAsync(ProviderSetupProcessRequestDto, businessId, userId, language, country) → IAsyncEnumerable<AiResponseDto>` — downloads document → DocumentIntelligenceService.ExtractFromDocumentAsync → creates/updates services + profile, streaming progress events.
- `ClearSessionAsync(sessionId, businessId)` — removes from Cosmos + cache.

Routed per `ChatInteractionType`.

### `McpSessionService.cs` — Cosmos + in-memory cache
Storage: `IAiSessionRepository` → `AiSession` doc in SystemData (pk `/pk`).
Cache: in-memory dictionary keyed by `ai_session_{businessId}_{sessionId}`, 5-min TTL.

Public:
- `GetOrCreateSessionAsync(sessionId, businessId, interactionType) → AiConversationContext`.
- `GetSessionByIdAsync(sessionId, businessId)`.
- `UpdateSessionAsync(AiConversationContext)` — persist + re-cache.
- `RemoveSessionAsync(sessionId, businessId) → bool`.
- `AddTurnAsync(sessionId, businessId, ConversationTurn)`.
- `RecordTokenUsageAsync(sessionId, businessId, tokensUsed)`.
- `AddToolExecutionAsync` + `AddToolExecutionsBatchAsync`.
- `IsSessionWithinLimitsAsync()` — checks `MaxConversationRounds`, `MaxSessionTokens`.
- `GetSessionLimitStatusAsync() → SessionLimitStatus { ConversationRoundPercentage, TokenUsagePercentage }`.

### `McpAIService.cs` — Azure OpenAI chat
Client: `ChatClient` from `Azure.AI.OpenAI` SDK. Deployment from `AIServiceSettings.DeploymentName` (e.g. `gpt-5.4-mini`).

Public:
- `StreamAIResponseAsync(userMessage, AiConversationContext, businessId, language, country) → IAsyncEnumerable<AiResponseDto>`.

Flow:
1. Session-limit precondition: `IsSessionWithinLimitsAsync` (rounds + tokens).
2. Build system prompt: `BaseSystemPrompt + InteractionTypePrompts[interactionType]`.
3. Call `_chatClient.CompleteStreamingAsync(messages, tools, options)`.
4. For each token chunk: yield `AiResponseDto { EventType = Content, Message = token }`.
5. On tool call: yield `ToolExecution` event → `_toolExecutionService.ExecuteToolAsync()`.
6. Loop up to `Tools.MaxToolIterations` (default 5) for sequential tool calls.
7. Yield final `TokenUsage` event with prompt + completion tokens.

Uses `System.Threading.Channels.Channel<AiResponseDto>` for thread-safe token buffering.

### `McpToolDiscoveryService.cs` — Tool discovery via reflection
- Scans Clinqet.API assembly for methods marked with `[MlcTool]` attribute.
- Builds `AiToolInfo { name, description, schema, parameters, tags, interactionTypes[] }`.
- Caches schemas for 30 min, embeddings for 60 min (if `UseEmbeddingForToolSelection=true`).

Public:
- `DiscoverToolsAsync() → IReadOnlyList<AiToolInfo>`.
- `GetToolsForInteractionTypeAsync(ChatInteractionType)`.
- `GetToolByNameAsync(string)`.
- `GenerateSchema(AiToolInfo, simplified) → object`.
- `InitializeToolEmbeddingsAsync()` — pre-compute embeddings for semantic ranking.

### `McpToolExecutionService.cs` — Tool invocation
Filter pipeline:
1. By `InteractionType` (each tool declares supported types).
2. Optional ranking by embedding similarity to user message.
3. Top `Tools.MaxToolsPerRequest` (default 10).

System tools always included: `get_available_tools`, `get_tool_schema`.

Public:
- `GetAvailableToolsAsync()`.
- `GetRelevantToolsAsync(userMessage, ChatInteractionType, maxTools)`.
- `ExecuteToolAsync(toolName, arguments, context, ct) → AiToolResult<T>` — calls API controller method via reflection + DI; records to session.

### `AiRateLimitingService.cs` — In-memory budgets
`ConcurrentDictionary<string, RateLimitBucket>` keyed by `{endpoint}:{businessId}`. Cleanup timer every 5 min.

Endpoints:
- `text-enhancement` → `RateLimiting.TextEnhancement`.
- `mcp-chat` → `RateLimiting.McpChat`.
- `document-intelligence` → `RateLimiting.DocumentIntelligence`.

Public:
- `CheckRateLimitAsync(endpoint, businessId) → RateLimitResult { IsAllowed, RemainingRequests, RemainingTokens, RetryAfter, Message }`.
- `CheckTokenRateLimitAsync(endpoint, businessId, tokensToConsume) → RateLimitResult`.
- `RecordTokenUsageAsync(endpoint, businessId, tokensUsed)`.
- `GetStatusAsync(endpoint, businessId) → RateLimitStatus`.

Defaults: 10 requests/min for all three; token budgets 50k (text), 100k (chat), 100k (docs).

### `SpeechService.cs` — Azure Speech SDK
- Region: `centralindia` (from `AzureSpeechSettings.Region`).
- Supported audio: `wav, mp3, m4a, webm, ogg, flac`.
- Audio config: PCM 16kHz, 16-bit, mono.

Public:
- `ConvertSpeechToTextAsync(audioStream, audioFormat, targetLanguage, sourceLanguage?, ct) → SpeechToTextResult`.
- `IsAudioFormatSupported(format) → bool`.

If `EnableTranslation=true` → Speech Translation API (all languages, ~$2.50/hr). Else → Speech-to-Text English-only (~$1.00/hr).

Auto-detect supported for 4 languages: `en-US, fr-FR, es-ES, hi-IN`. Returns `{ Success, TranscribedText, OriginalText, DetectedLanguage, WasTranslated, Confidence, ErrorMessage? }`.

### `TextEnhancementService.cs`
Uses same OpenAI deployment as chat.

Public:
- `EnhanceTextAsync(TextEnhancementRequestDto, language, ct) → TextEnhancementResponseDto`. Max input 5000 chars; max output 1500 tokens.
- `EnhanceTextWithAudioAsync(audioStream, audioFormat, EnhancementType, language, sourceVoiceLanguage?, ct)`.

`TextEnhancementType`: `Proofread, Professionalize, Summarize, ServiceDescription`.

### Document transcription verification (2026-09-10) — the contextual gate, the third check and its alerts

> ‼️ **SUPERSEDED 2026-10-03.** `DocumentTranscriptComparer`, `DocumentValueEquivalence`, the per-check Required / Outcome
> alerts and `TranscriptionVerificationAlertsTests` are deleted. Pages are decided by `Services/AI/Reading/` from a raw answer
> bank, and each flow sends one reading-outcome alert (`clinqet-voice-assistant`, 2026-10-03). Kept below as history.

‼️ **The page-wide bag of numbers and long words is GONE.** It accepted `Haircut 500; Colour 1200` becoming
`Haircut 1200; Colour 500` and `not` deleted from a refund policy, both at word coverage 1.00, because every
number and every word was still somewhere on the page (measured 2026-09-08). `KnowledgeTranscriptConservation`
and `MinTextConservation` no longer exist.

**What replaced it** — `DocumentTranscriptUnits` + `DocumentTranscriptComparer` (both `clinqetinfrastructure/Services/AI/`):

- The page is segmented into the units a fact lives in: HTML `<table>` rows (Document Intelligence's shape),
  pipe-table rows, headings, list items and **one line per unit** for prose. `<figure>` blocks are excluded —
  `PageMarkdownSplicer.CarryFigures` puts their text back verbatim, so demanding it of the transcript rejected
  good pages.
- Units align one-to-one inside a window, with two repair passes: **absorption** (several machine-reading lines
  became one transcript paragraph — scored by COVERAGE, not symmetric similarity) and **extension** (one line
  became several). Both directions of re-wrapping are handled without merging lines up front, which would make a
  transcript that legitimately recovered rows look like one changed paragraph.
- Aligned table rows compare **cell by cell**; everything else compares by an LCS token diff. Each changed run is
  judged by `DocumentValueEquivalence` in every role it could be playing (money, percentage, time, date, text,
  quantity), first as it stands and then with one surviving token restored on each side, so `5gram`/`5 g` keeps
  the number it belongs to and `Deposit $5.00`/`Deposit $5` is money once the word is out of the way.
- **Insertions count inside a CELL and not in prose.** A cell holds one value; prose can gain text the machine
  reading missed, which is why the vision lane exists.
- Locale and currency are inferred from the DOCUMENT, never the account's region. An unmapped currency symbol
  stays itself, so `$5.00`/`$5` on a page that never names its currency is not a paid check.
- Scope is passed explicitly (`TranscriptionValidationScope`): knowledge protects every fact; the service flows
  protect service identity and pricing only, so a description that changed meaning is a knowledge fact and never
  on its own a service price question.

**The third check** — `IDocumentTranscriptionVerifier` / `DocumentTranscriptionVerifier`:

- Re-renders the page from SOURCE bytes at `VerifyPageRenderMaxEdgePixels` (2048), not by enlarging the 1024 the
  transcription pass already downsampled.
- Asks `gpt-5.6-sol` @ High to **transcribe** the disputed regions. It is never told which answer is expected: a
  model told what is expected agrees with it. Adjudication happens in code, against both existing readings.
- ‼️ **A region is located by a PRINTED PHRASE, never an ordinal.** Located by "Paragraph 2" the model answered
  about a different paragraph and that unrelated sentence was written into the document (measured live,
  2026-09-10). `TranscriptDiscrepancy.Anchor` is the opening phrase both readings agree on — and never contains
  the disputed value, or a correct reading would look off-target. A reading that does not carry the anchor read
  somewhere else and is discarded.
- The answer is validated: unknown ids, duplicates, over-long regions and answers covering none of the requested
  regions are unusable evidence, classified and never applied.
- Adjudication is one-way containment (the check legitimately reads a little wider); a reading that carries BOTH
  answers confirms the LONGER one, because those extra words are demonstrably on the page. One matching neither
  AND far wider than the region read the neighbours and settles nothing.
- **The ANSWER is written, never the check's raw text**, and only into the span the discrepancy owns, back to
  front. A span shared by several source units is never repaired in place — that would delete the others — so the
  whole page falls back to the machine reading, which carries them all.

**Dispositions** (`TranscriptionVerificationDisposition`) and what each flow does, per owner decision:

| Outcome | Knowledge | Provider setup | Service drafts |
|---|---|---|---|
| Resolved to either reading | uses it | uses it, normal lifecycle | uses it |
| Uncertain third reading | publishes it, review flagged | withholds actionable pricing | draft with null `Price` |
| No usable third reading | keeps the machine reading | withholds actionable pricing | draft with null `Price` |
| Existing service, usable saved price | — | **keeps the saved price**, asks for review | — |
| Name disputed | uses the third name | uses it, no confirmation gate | uses it, no confirmation gate |

`TranscriptionDisputeIndex` binds an unconfirmed reading to a service **by name, never by list position** —
chunked extraction, de-duplication and duplicate names all reorder the list.

**Alerts** — `ITranscriptionVerificationAlerts` / `TranscriptionVerificationAlerts`,
`AdminAlertType.DocumentTranscriptionVerification`:

- ‼️ MANDATORY for every check in all three flows, including the ones that resolve cleanly and the ones that
  never start. A **Required** obligation is raised BEFORE the call is scheduled; a correlated **Outcome** follows.
- `EventId` is deterministic per (check, phase, flow) so a transport redelivery deduplicates while a different
  page, phase or consuming flow keeps its own; `CorrelationId` is the verification id. Deliberately NOT on the
  capacity-alert path — its per-business cooldown would swallow the second disputed document of a price list.
- A failed build or send is logged at Error and the authorized workflow continues; nothing claims delivery and there is
  no replay store. The one-per-reading `ReadingOutcomeReport` alert is re-told by the ingest's "already Ready" exit.
- Metadata shape is the owner-approved `PERSISTENCE-APPROVAL.md` contract exactly — pinned by
  `TranscriptionVerificationAlertsTests`. No duplicated identity: the business lives on the alert, once.
- `AdminAlertSettings.EnableDocumentTranscriptionVerificationAlerts` (default true) gates the per-check alerts and the
  value items of the reading outcome alert; content lost and a broken reading rule are always sent.
  ‼️ The API host bound **no** `AdminAlertSettings` section at all before this change.

**Cache** — the page entry is a JSON envelope `{markdown, policy, review}` at `…/pNNN.json`.
‼️ The acceptance policy (`VisionTranscriptionSettings.ValidationFingerprint`) is INSIDE the entry, not in the
key: two hosts compose that path, and a policy hash in the key would need every comparison dial mirrored across
both repositories or every page would silently miss for ever. A hit under a different policy is a miss. A
replayed page keeps its review obligation, and `KnowledgeContentArtifact.Reviews` carries it through an artefact
replay too.

**Deployment** — `gpt-5.6-sol`, version `2026-07-09`, `NoAutoUpgrade`, inside `$modelDeployments` in
`azureautomation/deploy.ps1` so the RAI content-filter loop covers it (it is shown provider-uploaded pixels).
`Voice__Knowledge__Vision__VerifyDeploymentName` is stamped on the Function App AND the API app;
`AIAssistant__ProviderAttachmentProcessing__Vision__VerifyDeploymentName` on the API.

**Measured live (Canada sandbox, 2026-09-10)**, five source-verified PDFs, real Document Intelligence + luna +
Sol: every clean run preserved every source fact with **zero** verifier calls; ten injected corruptions across
five documents (swapped cells, dropped negation, mg→g, USD→CAD) were all caught, alerted and resolved to the
source reading. Producer → Service Bus → `AdminAlertProcessor` → Cosmos → admin type filter proven end to end,
with the redelivery deduplicated and every created document deleted.

**Tests**: Functions `DocumentTranscriptComparerTests`, `DocumentTranscriptionVerifierTests`,
`TranscriptionVerificationAlertsTests`, `TranscriptionDisputeIndexTests`, `VisionTranscriptConservationTests`,
`KnowledgeServiceDraftBuilderTests`, `KnowledgeOcrPageCacheIntegrationTests`; API `McpServiceTests`,
`KnowledgeDraftApprovalServiceTests`.

### `DocumentIntelligenceService.cs`
- Raw DI results now retain `DocumentRawExtractionResult.SourceEvidence` (`clinqetcore/Models/AI/DocumentSourceEvidence.cs`), mapped by `DocumentSourceEvidenceReader` from the same billed response: words/confidence/spans, page geometry, paragraphs, table cells/row associations, captions/footnotes, figures and sections. This mapping is independent of figure-image downloads. Unknown fields stay nullable; malformed optional fields are recorded by source JSON path without dropping valid siblings or shifting source array references.
- Source span offsets use the returned `StringIndexType`; live DI currently returns `textElements`, which is not a C# UTF-16 string offset. Do not slice strings with those offsets without conversion. Empty `InvalidPaths` does not certify complete or accurate evidence. Preserve source text. This evidence mapping is the foundation the contextual comparison and the third check are built on (below).
- Azure Document Intelligence (formerly Form Recognizer).
- Model `prebuilt-read` (API version `2024-11-30`).
- Optional Azure Vision fallback for images and complex PDFs (`UseVisionAPI`).
- Plan §3 vision transcription (2026-09-01/02, AI cost programme; the gate and cache format were replaced 2026-09-10 — see above): every Document Intelligence read in the setup lane (`ProviderSetupDocumentReader` — PDFs, photos, converted photos) routes the DI markdown through `IVisionDocumentTranscriptionService`: `AIAssistant:ProviderAttachmentProcessing:Vision` (luna @ Medium, 300 s time budget ⇒ whole-document DI fallback + alert, 6000-token page budget), per-page blob cache `_ocr/{businessId}/setup/{bytes hash}/{deployment}/v{PromptFingerprint}/pNNN.json` in `provider-setup-docs` (keyed by the bytes, not the file name, since 2026-10-03) (the deployment segment is what stops a model swap replaying the previous model's transcripts), sub-flow `D4-setup-transcribe-vision`. `ProviderAttachmentProcessing:MaxExtractedCharacters` (2 600 000) refuses at parse with `Error_ProviderSetupTooManyCharacters` + `CharacterCount`; `McpService` raises the `ProviderSetupExtractedCharacters` alert and never falls back to `ExtractWithVisionAsync` for that refusal. `.heif/.heic` are refused (no decoder). The web and mobile AI setup modals pre-flight the size cap (exact) and the PDF page cap (advisory) before upload (`AISetup.ErrorFileTooLarge` / `AISetup.PagesOverCap`; mobile `AI_ASSISTANT_MODAL.ERROR_FILE_TOO_LARGE` / `PAGES_OVER_CAP`). ‼️ **Both caps are DELIVERED, never mirrored as client constants** (2026-09-02): `GET /api/v1/app-config` → `AppConfigDto.ProviderSetupUpload` carries `maxFileSizeBytes` (the SMALLER of `Storage:ProviderSetupDocuments` and `ProviderAttachmentProcessing:MaxFileSizeBytes` — the smaller dial is what actually refuses the file) and `maxPdfPages`. Web reads it via `useProviderSetupUploadLimits()`, mobile via `useAppConfig().providerSetupUpload`; the launch defaults (10 MB / 20 pages) hold only until the first read resolves, and a cap that is not a positive number keeps the default rather than refusing every file. Tests: API `ProviderSetupDocumentReaderTests`, `McpServiceTests`.

Public:
- `ExtractFromDocumentAsync(fileUrl, businessId, language, ct) → AttachmentExtractionResultDto` — downloads blob → OCR → calls OpenAI with extraction prompt → repairs truncated JSON (`JsonRepairHelper`) → returns structured business/services/offers data.

Extraction shape: business info (name, description, phone, address, years of experience, employees), social links (Facebook/Instagram/YouTube/LinkedIn/Twitter/Website), business hours per day, offers (with discount + repeat rule), services (with category match).

### `AICompletionService.cs`
Validation completion shared with search enrichment.

Public:
- `ValidateServiceAsync(ServiceValidationRequest, ct) → ServiceValidationResponse` — strict structured output (JSON schema) for service approval flow (cross-link `clinqet-service-listing` skill).

### `AiEnrichmentFailureTracker.cs`
Background hosted service. Sliding-window failure tracking per AI component.

- Records success/failure per component.
- Window: 10 min (default).
- Threshold: 50% failure rate over min 5 samples → AdminAlert (`AIEnrichmentFailureSpike`).
- Cooldown: 30 min between alerts (no spam).

### `JsonRepairHelper.cs`
Public:
- `TryRepairTruncatedJson(string json) → string` — closes truncated arrays/objects gracefully (typical streaming-output failure mode).

### `ServiceMatchingHelper.cs`
Public:
- `NormalizeName(string) → string` — lowercase + strip punctuation + collapse whitespace.
- `CalculateSimilarity(string, string) → double` — Levenshtein-style for service dedup against existing.

---

## ENUMS (`clinqetshared\Enums\`)

### `AudioLanguage`
Verbatim: `en, fr, es, hi, de, it, pt, zh, ja, ko, ar, ru, nl, tr, pl, vi, th, id, ms, fil, bn, ta, te, mr, gu, kn, pa, ur`. (Auto-detect supports only first 4: en/fr/es/hi.)

### `ChatInteractionType`
Verbatim: `SearchService = 1, ManageBooking = 2, ManageQuote = 3, ManageService = 4`.

### `ReasoningEffort`
Verbatim: `None, Low, Medium, High`. Used for OpenAI o1/o3 reasoning models.

### `TextEnhancementType` (in AIAssistantDtos.cs)
Verbatim: `Proofread = 0, Professionalize = 1, Summarize = 2, ServiceDescription = 3`.

### `AiEventType` (in AIAssistantDtos.cs)
Verbatim: `Analyzer, Content, FinalContent, TokenUsage, Context, Error, UserInput, ToolExecution, ToolResult`.

All have `[JsonConverter(typeof(JsonStringEnumConverter))]`.

---

## DTOs (`clinqetshared\DTOs\AI\AIAssistantDtos.cs`)

Input:
- `SpeechToTextFormRequestDto` — `IFormFile AudioFile` + `AudioLanguage? SourceVoiceLanguage`.
- `TextEnhancementFormRequestDto` — text (MaxLength 5000) OR audio + `EnhancementType` + `AdditionalInstructions` + `SourceVoiceLanguage?`.
- `TextEnhancementRequestDto` — text (Required, MaxLength 5000) + `EnhancementType` + `AdditionalInstructions`.
- `ChatInputFormRequestDto` — message (MaxLength 2000) OR audio + `SessionId` + `InteractionType` + `SourceVoiceLanguage?`.
- `McpTextInputRequestDto` — `SessionId, Message (Required, MaxLength 2000), InteractionType (default SearchService)`.
- `McpVoiceInputRequestDto` — `SessionId, AudioData (byte[] Required), AudioFormat (default "wav"), SourceVoiceLanguage?, InteractionType (default SearchService)`.
- `ProviderSetupUploadUrlRequestDto` — `FileName, ContentType, FileSize (Range 1..long.MaxValue)`.
- `ProviderSetupProcessRequestDto` — `FileUrl (Required, Url, MaxLength 2048), FileName?, ContentType?, FileSize, ContextMessage? (MaxLength 1000), AutoUpdateBusinessProfile (default true), AutoCreateServices (default false)`.

Output:
- `SpeechToTextResponseDto` — `TranscribedText, OriginalText?, DetectedLanguage?, WasTranslated, Confidence`.
- `TextEnhancementResponseDto` — `OriginalText, TranscribedText, EnhancedText, EnhancementType, InputTokens, OutputTokens`.
- `AiResponseDto` (SSE event payload) — `EventType, Message, ErrorCode?, ErrorDetails, Context, TokenUsage, ToolInfo, ExtractedServices, Metadata, Timestamp`.
- `TokenUsageDto` — `PromptTokens, CompletionTokens, TotalTokens`.
- `AiConversationContext` — `SessionId, BusinessId, InteractionType?, History, ToolExecutions, TotalTokensUsed, CreatedAt, LastActivity`.
- `ConversationTurn` — `Role ("user"|"assistant"), Content, Timestamp`.
- `ToolExecutionEntry` — `ToolCallId, ToolName, Arguments (JSON), Success, ErrorMessage, ResultSummary, ExecutionTimeMs, Timestamp`.
- `ExtractedServiceDto` — `Name, Description, CategoryId, CategoryName, SubcategoryId, SubcategoryName, Price?, MaxPrice?, PriceType, DurationMinutes?, Confidence, Action ("create"|"update"), MatchedServiceId, MatchConfidence, Changes[]`.
- `AttachmentExtractionResultDto` — Success/Error + RawText + ExtractedServices + business info + social links + business hours + offers + token usage.
- `SessionLimitStatus` — `ConversationRounds/Max, TotalTokensUsed/Max, IsWithinLimits, ConversationRoundPercentage, TokenUsagePercentage`.

---

## SETTINGS (`clinqetshared\Models\`)

### `AIAssistantSettings`
```
Enabled = true
SupportedAudioFormats = ["wav","mp3","m4a","webm","ogg","flac"]
MaxAudioSizeBytes = 10485760  // 10MB

TextEnhancement: { Enabled, SpeechProcessingEnabled, SystemPrompt, MaxInputLength=5000, MaxOutputTokens=1500 }

Mcp: {
  Enabled, SpeechProcessingEnabled,
  BaseSystemPrompt,
  InteractionTypePrompts: { "SearchService": "...", "ManageBooking": "...", ... },  // localizable
  Temperature = 0.7,
  MaxTokens = 10000,
  MaxContextTokens = 8000,
  Session: {
    MaxConversationRounds = 10,
    MaxSessionTokens = 50000,
    SessionTimeoutMinutes = 60,
    SessionTtlDays = 7,
    TrackTokenUsage = true,
    FullContentTurns = 3,
    TruncatedContentLength = 300
  },
  Tools: {
    UseEmbeddingForToolSelection = true,
    MaxToolsPerRequest = 10,
    MaxToolIterations = 5,
    CacheToolSchemas = true,
    SchemaCacheMinutes = 30,
    CacheToolEmbeddings = true,
    EmbeddingCacheMinutes = 60
  }
}

SpeechToText: { Enabled, RateLimiting: { ... } }
ProviderAttachmentProcessing: { Enabled, MaxFileSizeBytes=10485760, ProcessingTimeoutSeconds=600, ServiceCreationBatchSize=4 }

RateLimiting: {
  Enabled = true,
  EnableTokenBasedLimiting = true,
  TextEnhancement: { Enabled, RequestsPerWindow=10, WindowMinutes=1, TokensPerWindow=50000 },
  McpChat: { ..., TokensPerWindow=100000 },
  DocumentIntelligence: { ..., TokensPerWindow=100000 }
}
```

### `AIServiceSettings`
```
Endpoint = "https://clinket-ai-foundry-{env}-eastus2.cognitiveservices.azure.com/"
ApiKey  = (Key Vault reference)
DeploymentName = "gpt-5.4-mini"
ApiVersion = "2025-01-01-preview"
MaxCompletionTokens = 5000
HttpTimeoutSeconds = 90
MaxRetries = 3
RetryInitialDelayMs = 1000
RetryMaxDelayMs = 10000
RetryBackoffMultiplier = 2.0
ReasoningEffort = ReasoningEffort.Medium
```

### `AzureSpeechSettings`
```
ApiKey = (Key Vault)
Region = "centralindia"
TimeoutSeconds = 30
MaxRetryAttempts = 3
RetryDelayMs = 1000
EnableTranslation = true   // false = English-only, cheaper
```

### `AzureDocumentIntelligenceSettings`
```
Endpoint = "https://clinket-doc-{stamp}-v2-{env}.cognitiveservices.azure.com/"
ApiKey = (Key Vault)
TimeoutSeconds = 60
ModelId = "prebuilt-read"
ApiVersion = "2024-11-30"
AiDeploymentName = "gpt-5.4-mini"
AiHttpTimeoutSeconds = 180
MaxCompletionTokens = 5000
Temperature = 0.1
SimilarityThreshold = 0.85
UseVisionAPI = false
```

Class-default values must mirror `appsettings.json` defaults (memory `feedback_appsettings_class_defaults`).

---

## SESSION ENTITY — `AiSession`

Container: `SystemData`. Partition key: `/pk`. Document id: `{sessionId}`. TTL: `SessionTtlDays * 86400` seconds (default 7 days).

Fields:
- `id` / `sessionId`
- `userNumber` (businessId)
- `pk` (partition key field)
- `history: List<AiConversationTurn>`
- `toolExecutions: List<AiToolExecution>`
- `interactionType: ChatInteractionType?`
- `createdAt, lastActivity: DateTime`
- `totalTokensUsed: int`
- `ttl: int`

---

## STREAMING RESPONSE FORMAT (SSE)

Each event:
```
data: {"eventType":"Analyzer","message":"...","timestamp":"2026-05-16T..."}

data: {"eventType":"Content","message":"token...","timestamp":"..."}

data: {"eventType":"ToolExecution","toolInfo":{"name":"SearchServices","arguments":"{...}"},"timestamp":"..."}

data: {"eventType":"TokenUsage","tokenUsage":{"promptTokens":150,"completionTokens":47,"totalTokens":197},"timestamp":"..."}

data: {"eventType":"FinalContent","message":"[final]","timestamp":"..."}

data: {"eventType":"Error","message":"Rate limit exceeded","errorCode":"AI_RATE_LIMITED","timestamp":"..."}
```

Frontend consumes via `EventSource` (browser native). Errors set `Retry-After` header on rate-limit responses.

---

## RATE LIMITING DETAILS

Bucket key: `{endpoint}:{businessId}`. Windows roll every 1 minute. Token budgets reset with the window.

Order of checks per request:
1. `CheckRateLimitAsync` (requests-per-window) — fail-fast 429 if exceeded.
2. After AI completion: `RecordTokenUsageAsync` (accumulates).
3. Subsequent calls also check `CheckTokenRateLimitAsync(tokensEstimate)` proactively if `EnableTokenBasedLimiting=true`.

429 response carries `Retry-After: {seconds}` header.

---

## DOCUMENT EXTRACTION FLOW (provider setup — widened to knowledge parity, 2026-08-28)

**Accepted types (16, `Storage:ProviderSetupDocuments`)**: `.pdf .docx .xlsx .pptx .txt .md .html .htm .jpg .jpeg .png .gif .webp .tiff .bmp` + `.json` (catalog manifest, web-only); `.heif/.heic` refused since 2026-09-01 (no decoder — web converts a HEIC pick to JPEG client-side before upload). Convertible refusals name the fix: `.csv/.tsv/.xls` → "save as Excel", `.doc` → Word, `.ppt` → PowerPoint (`Error_ProviderSetupConvertTo*`, mirrored as client hints in BOTH apps). Size ceiling 10 MB (`Storage:ProviderSetupDocuments` and `ProviderAttachmentProcessing.MaxFileSizeBytes` are both 10 MB since 2026-09-01).

1. Provider uploads document → `POST /provider-setup/upload-urls` (per-minute limiter + `MaxFilenameLength` + convert-hint refusals) returns SAS URLs.
2. Client uploads to blob.
3. Client calls `POST /provider-setup/process` (per-minute limiter + token budget + durable per-business **daily cap** — `IProviderSetupUsageCounter`, atomic-PATCH SystemData doc in the AiUsageCounter family with a `setup_` id segment; cap breach → localized 429 + `AdminAlertType.ProviderSetupDailyCapReached`).
4. `ProviderSetupDocumentReader` routes by type: pdf/photos → DI **prebuilt-layout + markdown** (+figures/PdfPig binder for pdf when images are on; free PdfPig page pre-count + `pages=1-{MaxPdfPages}` cost ceiling); webp/gif → normalize → DI bytes; docx/xlsx/pptx/html/txt/md → the knowledge parsers **in-process ($0 DI)**. Output = `ProviderSetupDocumentContent` (text via `FlattenBlocks` + the full `KnowledgeExtractionOutput` for the image lane). Unreadable → localized error key.
5. `DocumentIntelligenceService.ExtractContentFromPreparedAsync` (vision fork preserved for photos-without-text) → `ExtractFromTextAsync` three-phase pipeline with `{categoryList}` injected (NEVER hardcoded service names — §3.7 CLAUDE.md); JSON repair on truncation via `JsonRepairHelper`.
6. Service-matching against existing services via `ServiceMatchingHelper` (`DetermineChanges` now counts price/duration/description; on UPDATE the OCR description fills ONLY a blank existing one — never overwrites provider copy).
7. If `AutoUpdateBusinessProfile=true` → patch profile fields.
8. If `AutoCreateServices=true` → create extracted services (batched `ServiceCreationBatchSize=4`).
9. **Image lane** (`ProviderSetupImageService.RouteAndPersistAsync`, after services persist, before the final metadata event — see next section).
10. Stream progress events (`Analyzer` per phase incl. `SSE_ProcessingImages`) → final `Content` event whose metadata is built by ONE builder (`BuildSetupSummaryMetadata`) in all three branches: created/updated/profile counts + `serviceImageCount`/`portfolioPhotoCount`/`portfolioProjectCount`/`profileImageSet`/`imagesSkippedCount`.

Analytics: token usage + processing time + extracted counts + image counts (`ProviderSetupAnalyticsData`) captured to analytics blob (cross-link `clinqet-search-discovery` skill, "provider-setup" stream).

---

## PROVIDER SETUP IMAGE LANE (`clinqetinfrastructure\Services\AI\ProviderSetupImageService.cs`)

Pictures inside the uploaded document are routed to: **service hero image** (ONLY services this run created/updated that have NO existing image — write-time re-check on the real row), **global portfolio** (`Portfolios` doc `Global_{businessId}`, id `{businessId}_Global_{businessId}`, localized default title), **strictly-gated portfolio projects** (title must BE a document heading, photos under that heading, never a service name; `PortfolioProjectsEnabled` + `MaxProjectsPerRun`), or **business profile picture** (ONLY when `ProfilePictureUrl` is unset; single first-page Logo; fail-closed).

Pipeline: collect (ImageMarker blocks + HTML remote fetch ≤ `MaxRemoteImagesPerHtmlDoc`, SHA-256 dedupe, deterministic `ImageId = DeterministicGuid(businessId, "setup-image", contentHash)` so replays converge) → `KnowledgeImageStore.SelectWithinCap` → normalize + caption/classify via the SHARED `IKnowledgeImageCaptionClassifier` (hoisted from knowledge ingest; business-wide caption-reuse map avoids re-captioning known bytes) → kind gates in CODE (Product/Photo proposable; Diagram portfolio-only; Logo profile-only; rest discarded; non-Ok quality or caption-less dropped) → ONE proposer structured call (enum indexes, remove-only) → locality contradiction veto vs ALL run services → one-hero-per-service (high only) → **pixel verify WINNERS ONLY** (`SetupImageVerifier`, yes+high, fail-closed) → persist through existing rails + `MediaDerivativeQueueMessage` per parent. Every placement fail-soft and counted; photos are strictly additive to the run.

`SetupImageVerifier` (`ISetupImageVerifier`, DI-scoped since 2026-08-29) is the ONE pixel-verify implementation shared with the knowledge draft lane (D9) — setup uses the Interactive lane, drafts the Bulk lane. It runs under `AiCompletionBudgetGuard`: a `finish_reason: "length"` answer (reasoning tokens share `max_completion_tokens`) retries ONCE at 3× the budget, then fails CLOSED and raises ONE `AiCompletionBudgetExhausted` admin alert naming the setting (`AIAssistant:ProviderAttachmentProcessing:Images:VerifyMaxCompletionTokens` 600 · `ImageReasoningEffort` Medium; the caption budget `CaptionMaxTokens` is 1500 — at 200 it produced EMPTY captions on the dev deployment).

**D9 — knowledge drafts adopt the same matching** (`clinqetinfrastructure\Services\Knowledge\KnowledgeDraftImageMatcher.cs`, consumed by `KnowledgeServiceDraftAnalyticsJob` in the Functions host — the analytics is its own queue ticket since 2026-08-29): the document's registry images (captions already paid at ingest; eligibility = Product/Photo + Quality Ok + not Deleted + captioned) are matched onto still-imageless drafts via ONE Bulk proposer call, winners pixel-verified, and the winner's bytes **copied to the draft blob path** (`KnowledgeBlobPaths.DraftImageBlob`) so dismissal cleanup owns them; the pre-existing remote-`<img>` attach also passes the verify now (refused ⇒ blob deleted, draft imageless). Settings `VoiceKnowledge:ServiceDrafts:ImageMatch*` (kill switch + prompts + dials, Functions appsettings). Approve path unchanged.

Settings `AIAssistant:ProviderAttachmentProcessing:Images` (kill switch, caps, floors, 3 prompt templates — class defaults mirror appsettings). Rate limiting: `RateLimiting:DocumentIntelligence` per-minute + `RequestsPerDay` (0 = off) + token budget, applied to upload-urls AND process.

### Availability + service areas on created services

`ProviderSetupProcessRequestDto` (`clinqetshared\DTOs\AI\AIAssistantDtos.cs`) carries `bool IsAtStore`, `bool IsAtCustomersLocation`, and `List<string> ServiceAreaIds` (non-null-initialized). These are applied to **every** service the run creates. `McpService` previously hardcoded both availability flags to `true` — never restore that.

The DTO implements `IValidatableObject`:
```csharp
if (AutoCreateServices && !IsAtStore && !IsAtCustomersLocation)
    yield return new ValidationResult("Error_ServiceAvailabilityRequired", ...);
if (ServiceAreaIds.Any(string.IsNullOrWhiteSpace))
    yield return new ValidationResult("Error_ServiceAreaIdInvalid", ...);
```
The availability gate is `AutoCreateServices`-conditional — a run with `AutoCreateServices == false` legitimately passes with both flags false.

`AIAssistantController` rejects service-area ids the provider does not own with a **400** (`Error_ServiceAreaNotFound`), checked against `GetByBusinessIdAsync(businessId)` before the run starts.

`McpService.ResolveSetupServiceAreaIdsAsync` decides what actually gets attached:
- **0 owned areas** ⇒ none attached (empty list).
- **exactly 1** ⇒ auto-attached — which is *why* the dialog hides the picker below two areas.
- **2+** ⇒ the requested ids filtered to owned + deduped; if that leaves nothing, fall back to the default area (`FirstOrDefault(a => a.IsDefault)`, then oldest by `(CreatedAt, Id)`).

The resolved list is `.ToList()`-copied per service so concurrent creations do not alias one list.

**Created services leave `Taxable` and `AcceptsOnlinePayments` NULL** so they follow the business defaults the dialog just set. Do not stamp them here — see `clinqet-service-listing` (TRI-STATE FULL-REPLACE).

---

## AI ENRICHMENT FAILURE TRACKING

`AiEnrichmentFailureTracker` is a singleton hosted service shared with the search enrichment flow.

- Each AI call (chat completion, embedding, document intel, service validation) reports success/fail.
- Sliding window (default 10 min).
- If `failureRate >= 50% AND samples >= 5` → AdminAlert `AIEnrichmentFailureSpike` (severity High).
- 30-min cooldown between alerts.

---

## FRONTEND — Partner App

AI Assistant UI lives in the partner app (search for `AssistantPanel`/`AiChat`/`AIAssistant` in `clinqetwebpartnerapp\src\components` — exact location may vary). Streaming consumed via `EventSource`. Voice input via Web Speech API or platform MediaRecorder → uploaded as `IFormFile`.

Mobile-first responsive (memory `feedback_clinqet_engineering_standards`).

### AI Quick Profile Setup dialog

Web: `clinqetwebpartnerapp\src\components\common\AIAssistantModal.jsx`. Mobile: `clinqetmobilepartnerapp\src\components\AIAssistantModal.tsx`. The two are kept behaviorally in lockstep — change one, change the other.

**Layout (web).** The dialog is `max-h-[90vh] ... overflow-hidden flex flex-col` with a `shrink-0` header, a `flex-1 min-h-0 overflow-y-auto` body, and a `shrink-0` footer. The body scrolls **under a permanently visible Start button** — the footer must never scroll away. `min-h-0` on the body is load-bearing; without it the flex child refuses to shrink and the footer is pushed off-screen.

**Start gating.** `canSubmit = Boolean(file) && hasAvailability && hasArea`, where `hasAvailability = isAtStore || isAtCustomersLocation`, `showAreaPicker = serviceAreas.length > 1`, and `hasArea = !showAreaPicker || serviceAreaIds.length > 0`. When blocked, a line renders naming exactly what is missing (`AISetup.StillNeeded` on web / `AI_ASSISTANT_MODAL.STILL_NEEDED` on mobile, joined from the missing requirements). Mirrors the server-side `IValidatableObject` gate above.

**Availability starts UNCHECKED on both surfaces** (`useState(false)` ×2). Do not default them to true — that was the old hardcoded behavior the whole change removed.

**Service-area picker.** Rendered only when `serviceAreas.length > 1` (a sole area is auto-attached server-side). Web **reuses `ServiceAreaSelection.jsx`** (`src/components/onboarding/add-business-information/ServiceAreaSelection.jsx`) so the dialog and the service form cannot drift — keep the reuse. Both surfaces pre-tick the default area (`areas.filter(a => a.isDefault)`). Mobile renders a hand-rolled chip list rather than a shared component (known asymmetry).

**Keep the two tax contracts separate.** `persistBillingDefaults()` writes nullable business-inherited `Service.Taxable` / `Service.AcceptsOnlinePayments` defaults through the existing `provider/billing/tax-settings` and `provider/billing/payment-settings` endpoints. Document extraction may independently carry per-service `Pricing.TaxIncluded` / `Pricing.TaxRate`; those fields are applied only when the document contains explicit usable tax evidence. Missing or ambiguous evidence does nothing, and existing service tax values are preserved.

**The info / tip note cards are unchanged — owner-mandated. Do not restyle or reword them.**

**Streaming progress (2026-08-28).** Both apps read the process SSE INCREMENTALLY — web `StreamProviderSetupDocument` (fetch + ReadableStream, buffered fallback), mobile the XHR progressive-`responseText` variant (RN fetch cannot stream; 330 s STALL guard, not a run budget; 401 refresh-once retry). Steps are FIVE (`[0,20,45,70,85]`, "Adding your photos..." at index 3) and advance on real server `Analyzer` events (`step = min(1 + analyzerCount, len-2)` + progress floors) — never restore the pure-timer guess. Non-2xx throws a response-shaped error so the modal surfaces the server's LOCALIZED refusal (size/page/daily-cap/convert hints).

**File accept (both apps).** Extension gate mirrors the server's 18-type list (mobile drops `.json` — dealer catalogs are desktop-only); convert hints fire BEFORE the generic refusal; content type derived from extension when the platform reports none. Mobile's Files picker opens `types.allFiles` (SAF/UTI filters can't surface `.md`/`.html`) and gates by extension.

**Setup Complete summary (both apps).** Services subtitle appends "+N photos added"; NEW Portfolio row (`portfolioPhotoCount || portfolioProjectCount`, deep-links `ProfileRoute.Portfolio` / mobile `UploadGallery`); Profile row condition widened to `profileUpdates?.length > 0 || profileImageSet` with "Profile photo added" joined by `·`. ‼️ Every row routes through the guarded `openSummaryTarget` (onboarding never navigates — memory `ai-setup-onboarding-escape-guard`); guard TESTS pin this on both apps (`aiServices.providerSetup.test.js` web, `aiAssistantModalParity.test.ts` mobile). Web calls `invalidateBusinessProfile()` on success so the 30 s-cached profile never outlives the run; mobile hosts refetch via `onSuccess`.

### AI mark — no robot

The robot icon is gone platform-wide (no robot assets, no lucide `Bot` import anywhere; orphan assets deleted). The single AI mark is a **green four-point sparkle on a navy gradient**: `bg-gradient-to-br from-[#032858] to-[#064a9e]` with the sparkle at `#97EF29`. Both hexes are brand-kit colors. Used in `AIAssistantModal.jsx`, `FloatingAIButtons.jsx`, `AIQuickSetupNudge.jsx`, the customer app's `QuoteButton.jsx` / `AIQuoteNudge.jsx` (which add a `via-[#0869d4]` third stop), and mobile via `LinearGradient colors={['#032858','#064a9e']}`. Any new AI surface uses this mark — never reintroduce a robot.

---

## TESTS

Unit:
- `McpServiceTests` — text + voice input routing, audio decode failures.
- `McpSessionServiceTests` — cache TTL, ETag concurrency on UpdateSessionAsync, session-limit gates.
- `McpAIServiceTests` — streaming token yield, tool-call iteration limit, system-prompt assembly.
- `McpToolDiscoveryServiceTests` — `[MlcTool]` discovery via reflection, embedding caching.
- `McpToolExecutionServiceTests` — filter by interaction type, max-tools cap, execution timing.
- `AiRateLimitingServiceTests` — window rollover, token budget exhaustion.
- `SpeechServiceTests` — translation vs STT-only paths, supported-format gate.
- `TextEnhancementServiceTests` — each EnhancementType prompt assembly.
- `DocumentIntelligenceServiceTests` — JSON-repair fallback, service-match dedup, prepared-content seam.
- `AiEnrichmentFailureTrackerTests` — sliding window correctness, cooldown.
- `ProviderSetupDocumentReaderTests` — type routing, FlattenBlocks, PDF page-cap, binder degrade, error keys.
- `ProviderSetupImageServiceTests` — every routing gate with real ImageSharp pixels (kind/quality/caption floors, contradiction veto, one-hero, verify winners-only, profile fail-closed, project zero-invention).
- `KnowledgeDraftImageMatcherTests` (Functions, §0.18 — the tail is the runtime consumer) — eligibility matrix, remove-only, high+verified, kill switch, Bulk-lane pin.
- Integration (real Cosmos emulator + Azurite): `ProviderSetupUsageCounterCosmosIntegrationTests` (atomic 20-parallel, business/period isolation, AiText-family bucket collision pin), `ProviderSetupImagePersistenceIntegrationTests` (service attach + Azurite blob + derivative contract + REDELIVERY convergence; portfolio create + replay dedupe), tail `RegistryImageCopy_LandsInRealAzurite_AndTheDeleteCascadeRemovesIt`.

Integration:
- POST /chat → SSE end-to-end with mocked AI provider; correct event sequence.
- POST /provider-setup/process → mocked document → extraction → service creation.

---

## CROSS-LINKS

- Search enrichment / spell-check / AI completion: `clinqet-search-discovery` SKILL (shares `AIServiceSettings`).
- Service approval validation: `clinqet-service-listing` SKILL.
- Onboarding: `clinqet-provider-onboarding` SKILL — document intel auto-creates services + profile fields.
- Rate limit on uploads + Service Bus integration: `clinqet-deployment` SKILL.
- AdminAlerts (failure tracker): `clinqet-notifications` SKILL.
- Session storage in SystemData: `clinqet-cosmos-data` SKILL.

---

## CHECKLIST BEFORE MERGE

- [ ] Cosmos session writes partition-scoped on `/pk`. NO cross-partition.
- [ ] Sessions have `ttl = SessionTtlDays * 86400` (Cosmos auto-expiry).
- [ ] System prompts NEVER hardcode service or category names (§3.7 CLAUDE.md). Use `{categoryList}` template substitution from cached categories.
- [ ] Rate-limit + token budget checked BEFORE invoking AI provider.
- [ ] Token usage `RecordTokenUsageAsync` called AFTER each completion.
- [ ] SSE response headers set; buffering disabled.
- [ ] Tool execution wrapped in try/catch → returns failure result + logs.
- [ ] AI failures recorded to `AiEnrichmentFailureTracker` for spike detection.
- [ ] Audio file size + format validated against `AIAssistantSettings.MaxAudioSizeBytes` + `SupportedAudioFormats`.
- [ ] Document size validated against `ProviderAttachmentProcessing.MaxFileSizeBytes`.
- [ ] Localization keys for all user-facing AI prompts AND error messages (memory `feedback_clinqet_engineering_standards`).
- [ ] All API keys live in Key Vault references in `appsettings.json`; real values via ARM env vars (§19 CLAUDE.md).
- [ ] Unit + integration tests for every new endpoint / service path.
- [ ] No hardcoded magic numbers — everything in `AIAssistantSettings`, `AIServiceSettings`, `AzureSpeechSettings`, `AzureDocumentIntelligenceSettings`.
- [ ] Provider-setup availability flags come from the request — NEVER hardcoded to `true`.
- [ ] Service-area ids validated as provider-owned (400 otherwise) before the run starts.
- [ ] Services created by a setup run leave `Taxable` / `AcceptsOnlinePayments` NULL (inherit business).
- [ ] Dialog: availability starts unchecked; Start disabled until file + availability + (2+ areas ⇒ area); footer stays visible (`shrink-0` + `flex-1 min-h-0` body).
- [ ] Business tax/payment defaults use `provider/billing/{tax,payment}-settings`; extracted `Pricing.TaxIncluded` / `Pricing.TaxRate` require explicit usable document evidence and never overwrite on missing/ambiguous evidence.
- [ ] AI mark is the green sparkle on the navy gradient — no robot icon anywhere.

## 2026-09-02 (Gate 3) — provider-setup reader
- A blank Document Intelligence result now reaches the vision primitive first; `Error_ProviderSetupNoTextExtracted` is returned only when the TRANSCRIPT is also empty (a photo stays exempt — its pixels are read downstream). The duplicate emptiness check after the PDF branch is gone.
- `Error_ProviderSetupVisionUnsupported` exists in all five API localization catalogs; it was returned to providers while present in none of them.
- `AzureDocumentIntelligence:AiHttpTimeoutSeconds` is **90**: the shared AI client's `AIService:HttpTimeoutSeconds` aborts first, so anything above it could never take effect.
- The setup lane passes `MaxPdfPages` as the rasterizer's page ceiling, and its cache key carries the transcription deployment.
- `AIService:ImagePromptTokenEstimate` is what the budget governor charges for one embedded image; the seam subtracts the image's **serialized** length from the payload estimate, so JSON escaping leaves no residue.


---

## ‼️ P1.5 (2026-09-03) — RAW DICTATION IS ITS OWN ROUTE AND ITS OWN ENGINE

### The two speech seams — do NOT merge them

| | `ISpeechService` (unchanged) | `IAudioTranscriptionService` (**new**) |
|---|---|---|
| Engine | Azure Speech **SDK**, real-time | Azure Speech **Fast Transcription**, REST |
| Does | transcribe **AND translate** | transcribe, **VERBATIM** |
| Serves | `ai/enhance-text` | `POST api/v1/speech/transcribe` |
| Price | ~$1.00/hr | **$0.36/hr** |

‼️ **Enhancement and dictation are different products.** A search query comes back verbatim, because a
mis-heard trade term must be correctable before it spends one of the member's daily questions. **Never route
dictation through a rewriting step, and never merge the two seams.**

‼️ **`POST api/v1/ai/speech-to-text` IS DELETED.** Mobile's four call sites moved to `speech/transcribe`.
The permission stays `ai.assistant.use` — renaming it forces a `CatalogVersion` bump, a pin update, a sweep
and a logout for every mobile member.

### ‼️ NEVER send an empty `locales` array

Measured on live Azure 2026-09-02: with `locales` omitted **or empty**, Gujarati speech came back as
**romanized English** labelled `en-US`, with a profanity mask over an ordinary word — **HTTP 200**. It does
not fail; it produces confident nonsense. `SpeechCandidateLocales.Build(...)` can never return empty, and a
convention test pins it.

### Other measured facts

- `api-version=2025-10-15` works; **`2025-05-15-preview` 404s** on these accounts.
- **429 is an everyday response** — one burst of four returned it after holding the connection **10.7 s**.
  Retry with backoff, inside the request timeout.
- ‼️ **Punjabi is identified as Hindi and written in Devanagari**, even with `pa-IN` in the candidate list.
  The one-tap correction chip (`ForceLocale`, a SINGLE locale) is the only recovery a Punjabi speaker has.
- Latency: **~500–850 ms in-region** for a 4–7 s clip.

### Settings

`AIAssistant:SpeechToText` — `MaxRecordingSeconds`, `AllowedLocales`, `MaxCandidateLocales`,
`RequestTimeoutSeconds`, `MaxRetryAttempts`, `RetryDelayMs`, `ApiVersion`.
`AzureSpeech:Endpoint` — the ACCOUNT endpoint, stamped by `deploy.ps1`; an account with a custom subdomain
is **not** reachable at the regional form.
‼️ The mic's caps are **DELIVERED to both clients through AppConfig** (`dictation`), never mirrored as
client constants.

<!-- search-topology-phase5 -->
## Sol 6.1 (search-topology Phase 5, D-120, 2026-10-02)

Every `gpt-6-sol` reference became `gpt-6.1-sol` (all hosts' appsettings, region files, Functions local.settings, class
defaults, `TokenPricing` $2 / cached $0.10 / $10, `deploy.ps1` deployment row with model version 2026-09-29). Luna and
gpt-5.x were not touched; `AdjudicationRulesVersion` was not raised. ‼️ Side effect by design (§0.23): the vision page-
reading bank keys on the reading model, so a document re-read after this deploys pays for its page readings once more
under 6.1 Sol (the picture-text pin in `KnowledgePictureDescriptionBankTests` moved to `7a8dcc1cd2fef3d1`; no version
raise — an input changed, not the logic).
