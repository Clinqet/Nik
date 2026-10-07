# PHASE 2 PROMPT — copy-paste everything below the line into a fresh Claude Code session in `C:\Nik`

---

Read `C:\Nik\voice-answer-ladder\PLAN.md` **completely, top to bottom, before writing any code** — it is the
single source of truth: the owner's coding standards VERBATIM (§0.1 — they bind every line you write), every
locked decision D1–D33 with rationale, the full designs (§5–§7), the retrieval contract (§7.9), the Move-2
expert-check design (§6), the cross-cutting edge-case sweep (§7.16, X1–X16), verified prices (§2.4), the
§0.18 test-placement map (§9), the three-phase execution model (§10), and the traps list (§12). Also read
`C:\Nik\CLAUDE.md` in full, the `clinqet-voice-assistant` skill, and the memory entry
`voice-out-of-scope-answers-design-2026-08-16.md`.

**Everything is OWNER-APPROVED (2026-08-18).** No further approval gates — build.

## YOU ARE PHASE 2 OF 3: the `clinqetmcp` surface

Phase 1 shipped everything EXCEPT the MCP tools. Phase 3 audits the whole program end to end.

---

# WHAT PHASE 1 ALREADY SHIPPED (verified green — do not rebuild any of it)

## Move 1 — the knowledge policy (DONE)

- `clinqetinfrastructure\Services\Voice\RealtimeSessionPayloadBuilder.cs`:
  - the privacy line was **rescoped** — it now reads *"Never reveal information about other customers or
    their contact details, and never state a price, availability, an offering, or a commitment on the
    business's behalf that is not in the profile below or in a tool result."* (the old
    `"or anything not in the profile below"` blanket clause is GONE and a test asserts it stays gone);
  - a **knowledge-policy block** sits immediately ABOVE the Map/Full catalog-mode branch, so both regimes
    and both carriers carry it. It covers: expert requirement-translation ("translate it yourself into the
    terms an expert in this trade would use", try more than one phrasing), brief hedged general trade
    answers, the absolute no-inference rule for price/availability/stock/commitments, professional-judgment
    questions ("never a verdict or a diagnosis"), and graded honesty ("word anything you inferred from
    expertise as typical").
- `clinqetmcp\Clinqet.Mcp\Tools\CatalogTools.cs` — `find_services`' `[Description]` now says *"Pass the
  caller's words **or the expert terms their requirement implies**"* + *"If the first phrasing returns
  nothing, try the expert term for it before telling the caller it isn't offered."* **This was the ONLY
  `clinqetmcp` edit in Phase 1.**
- Tests: `Clinqet.Communications.UnitTests\Voice\RealtimeSessionPayloadBuilderTests.cs` — 5 new pins
  (both carriers × both catalog modes, privacy-clause rescope, price-inference still forbidden, owner
  standing instructions still last + supreme, base-prompt budget guard ≤36k chars).

## The knowledge stack (DONE)

### Cosmos
- **New container `KnowledgeBase`, partition key `/businessId`** — policy
  `CosmosContainerPolicies.KnowledgeBase` (trimmed index: `type`, `docId`, `status`, `docType`,
  `sourceKind`, `contentHash`, `createdAt`, `updatedAt`; one composite `(type, createdAt DESC)`), wired into
  `cosmosindexsetup`'s `CosmosDbInitializer` + `ContainerNameSettings.KnowledgeBase` + the envSuffix block.
- Entity `clinqetcore\Entities\COSMOS\KnowledgeDocument.cs` (registry row = the ingestion **work order**).
- Enum value `DocumentType.KnowledgeDocument` (appended last).
- New enums in `clinqetshared\Enums\`: `KnowledgeDocType` (Other/SpecSheet/Faq/Policy/PriceList),
  `KnowledgeDocumentStatus` (Processing/Ready/Failed), `KnowledgeSourceKind` (File/TypedFaq),
  `KnowledgeChunkKind` (Text/Table/FaqPair/ImageCaption/DocSummary).
- Repository `clinqetinfrastructure\Data\COSMOS\KnowledgeDocumentRepository.cs` —
  `IKnowledgeDocumentRepository` (`clinqetcore\Interfaces\COSMOS\`): Get, List, Count(bySourceKind),
  FindByContentHash, Upsert, **TryReplaceAsync (ETag CAS → Replaced|Conflict|Gone)**, Delete. Every member
  is partition-scoped; there is no cross-business read by construction.
  ‼️ It is registered in `CosmosCompositeIndexContractTests.RepositoryToContainer` — a new repository must be.

### The search index
- **`clinket-knowledge`** (+ `-{env}` suffix; same name in both regions, the region lives in the endpoint).
- POCO `clinqetcore\Entities\AISearch\KnowledgeSearchDocument.cs` — fields: `id` (key, deterministic
  `{businessId}_{docId}_{chunkNo}`), `businessId` (filterable), `docId` (filterable), `docName`,
  `docType`, `linkedServiceId` (filterable), `linkedServiceName` (searchable), `sectionTitle`, `content`,
  `contentVector` (`[FieldBuilderIgnore]`, 3072), `docTitle`, `chunkKind`, `pageNumber`, `language`,
  `updatedAt`, `hasEmbedding` (hidden filterable guard). All value types nullable.
- Initializer `cosmosindexsetup\KnowledgeSearchIndexInitializer.cs` — ‼️ **its OWN file** because
  `ProviderIndexDefinitionConventionTests` text-splits `Program.cs`. HNSW mirror (M=10/EfC=400/EfS=500),
  `standard.lucene` on every searchable field (D27), one TextWeights-only `knowledgeRelevance` profile
  (docTitle 3.0 / sectionTitle 2.0 / content 1.0) set as `DefaultScoringProfile`, **NO scoring functions,
  NO suggester, NO semantic config, NO vectorizer**. Invoked in `Main` after the provider index.
- Name constant: `Clinqet.Core.Utilities.SearchScoringProfiles.KnowledgeRelevance`.
- **Wrapper type `Clinqet.Core.Interfaces.Search.KnowledgeSearchClient`** (a second bare `SearchClient`
  cannot be DI-registered) — registered in the API and Functions hosts from `AISearch:KnowledgeIndexName`.
- Writer `clinqetinfrastructure\Services\Knowledge\KnowledgeSearchIndexer.cs` /
  `IKnowledgeSearchIndexer` (`clinqetcore\Interfaces\Knowledge\`): `UpsertCardsAsync` (validates id +
  businessId + docId + **3072-dim embedding** before sending; inspects EVERY per-document result because
  Azure returns 200 for a batch with failures; poison-isolates then still throws — a document is all-in or
  all-out), `PruneCardsAtOrAboveAsync` (gapless replace), `DeleteCardsForDocumentAsync`,
  `DeleteAllCardsForBusinessAsync`, `CountCardsAsync`, `BuildCardId`.
  ‼️ **D22 is implemented here**: every filter LEADS with `businessId eq '…'` (single-quote-escaped), and
  **every returned row's `businessId` is re-verified — one mismatch throws and deletes NOTHING.**

### Infra
- Queue **`knowledge-ingest`**, `requiresSession: true` (D25) + dedup on, `lockDuration PT5M`, TTL P7D,
  maxDelivery 5 — `azureautomation\events.json` (no ARM parameter needed; queue names are literals + the
  shared `queueNameSuffix`).
- Blob container **`provider-knowledge`** (`publicAccess: None`) — `azureautomation\storage.json`.
- `ServiceBusSettings.KnowledgeIngestQueueName` (default `knowledge-ingest`) **+ the
  `ServiceBusService._senders` dictionary entry** (the #1 forgotten step — done).
- DTO `clinqetshared\DTOs\Messages\KnowledgeIngestQueueMessage.cs` — carries **only
  `{BusinessId, DocId}`** (+ base correlation/SchemaVersion 2).
- `deploy.ps1`: `$qKnowledgeIngest`, `$cKnowledgeBase`, `$knowledgeSearchIndexName`;
  `ServiceBusSettings__KnowledgeIngestQueueName` in all four queue blocks;
  `CosmosDb__ContainerNames__KnowledgeBase` in all five container blocks;
  `AISearch__KnowledgeIndexName` in the Function + API applied and emit blocks;
  `StorageConfiguration__Containers__ProviderKnowledge`; **`AzureDocumentIntelligence__Endpoint/__ApiKey/
  __AiDeploymentName` duplicated into the Function App blocks** (§7.7 Gap 3);
  `ServiceBusSettings__KnowledgeIngestQueueName` added to `$script:RequiredFunctionAppSettings`.
- All three `local.settings*.json` carry the queue name, `AISearch__KnowledgeIndexName` and the DocIntel
  trio (‼️ `local.settings.json` uses `:` separators; the `.ca`/`.in` files use `__`).

### Settings
- `clinqetshared\Models\VoiceKnowledgeSettings.cs` bound from **`Voice:Knowledge`** in the API and Functions
  hosts; class defaults MIRROR appsettings in both. Every §7.15 knob is present, including the ones **Phase 2
  consumes**: `RetrievalTopK` 5, `RetrievalMaxTokens` 1500, `RetrievalTimeoutMs` 4000,
  `RetrievalSlowWarnMs` 1500 (D23/D27). ‼️ **The MCP host does NOT bind this section yet — Phase 2 must add
  `builder.Services.Configure<VoiceKnowledgeSettings>(builder.Configuration.GetSection("Voice:Knowledge"))`
  and the matching `clinqetmcp\appsettings.json` block, or the retrieval knobs silently run on class
  defaults.**
- `StorageConfiguration.ProviderKnowledge` constraints (20 MB, 20 files, the D14/D28 extension + MIME
  allowlists) + `Containers.ProviderKnowledge`. `FileValidationHelper`'s image-extension list was widened
  to accept `.tiff/.tif/.bmp/.heif/.heic`.

### API
- `clinqetapi\Clinqet.API\Controllers\Knowledge\KnowledgeController.cs`, route
  `api/v{version}/knowledge`, gates REUSE **`voice.read`** (list) / **`voice.settings.manage`** (everything
  else) — D17, no new permission key:
  `GET documents` · `POST documents/sas-urls` · `POST documents/confirm` · `DELETE documents/{docId}` ·
  `POST documents/{docId}/reprocess` · `PATCH documents/{docId}` · `POST faqs` · `PUT faqs/{docId}` ·
  `DELETE faqs/{docId}`.
- Orchestrator `clinqetinfrastructure\Services\Knowledge\KnowledgeManagementService.cs` /
  `IKnowledgeManagementService`: confirm→enqueue (session `sessionId = businessId`), the **X5 delete order
  (cards → registry row → blob; a failed card purge throws and LEAVES the row)**, reprocess (Ready/Failed
  only, clears `contentHash`), FAQ create/edit/delete **synchronously** (chunk + embed + upsert inside the
  request — live instantly; edit re-embeds and prunes; **X7 ETag 412 on a concurrent edit**), details patch.
- DTOs in `clinqetshared\DTOs\Knowledge\KnowledgeDtos.cs`.

### The chunker + parsers (`clinqetinfrastructure\Services\Knowledge\`)
- `KnowledgeChunker.cs` / `IKnowledgeChunker` — **pure, dependency-free, deterministic** (D24): 350/512/120
  tokens, ~4 chars/token, 15% whole-sentence overlap, heading→paragraph→sentence-end→word-boundary,
  danda terminators, decimal + abbreviation guards, dehyphenation, heading fold, `sectionPath` depth 3
  `" › "`-joined clamped 120, lists atomic-or-between-items with the intro repeated, tables
  atomic-or-row-groups **with headers repeated** (HTML stored / compact serialization embedded), headerless
  row-1 heuristic, oversize-row cell-wise split, per-document dedupe, tiny-doc = 1 card, min-tail merge,
  `ChunkFaq` (one card; oversize answer repeats the question line).
  **The prefix is `docTitle — docType — sectionPath — offering (group)` and lives INSIDE `content`, so BM25
  and the vector both reach it.** Category/subcategory is prefix-only — there is no category index field.
- `KnowledgeDocumentParser.cs` + `.OpenXml.cs` / `IKnowledgeDocumentParser` — **D28 local-first routing**:
  layout-markdown reader (page-furniture strip, PageBreak join, `<table>`→span-expanded grid, `<figure>`
  text, fences), DOCX via OpenXML (styles→headings, native tables, **embedded images auto-detected via
  image parts, skipped under `EmbeddedImageMinBytes`**), XLSX (per-sheet sections, header heuristic, cached
  VALUES, hidden sheets skipped), HTML (script/style/nav/header/footer/iframe deleted, h1–h6→headings,
  `<table>` kept, anchor text kept / hrefs dropped), TXT/MD/JSON (full-JSON flatten to `key: value`).
- New packages in `clinqetinfrastructure`: `DocumentFormat.OpenXml` 3.3.0, `HtmlAgilityPack` 1.11.71.
- `IDocumentIntelligenceService` gained **`ExtractRawTextFromUrlAsync(fileUrl, modelId, outputContentFormat, ct)`**
  and **`ExtractRawTextFromBytesAsync(...)`** returning `DocumentRawExtractionResult { Content, PageCount }`.
  The shared onboarding `ModelId` default is untouched; knowledge passes its own `ExtractionModelId`.

### The ingestion function
`clinqetfuncations\Clinqet.Communications\Functions\KnowledgeIngestProcessorFunction.cs`
(`[Function("ProcessKnowledgeIngest")]`, `IsSessionsEnabled = true`). Pipeline: **read the registry row (the
work order)** → download blob → hash → **X9 hash-twin refresh** / **case-C same-hash short-circuit** →
extract (D28 routing; DI gets a **read-SAS**) → page cap → **D11 one `gpt-5.4-mini` structured call**
(`{title,summary,language}`, first ~6k chars + heading outline, temp 0, degrade = filename title) → chunk →
**D26 image captions** (downscaled, pixel floor) → `DocSummary` card → **D25 overflow gate AFTER chunking,
BEFORE any embed spend** (grace ×1.10; beyond ⇒ whole document Failed) → batch embed (**empty array ⇒ fail
the document**) → ‼️ **tombstone ETag-CAS re-read immediately before the final commit** (row gone ⇒ purge own
writes, exit without committing) → upsert → **prune `chunkNo ≥ newCount`** → registry `Ready`.
`OperationCanceledException`-first catch, explicit dead-letter reasons, terminal-vs-retryable failure split,
localized `failureReasonKey` on every failure.
Registered in the Functions host with DocIntel + settings (‼️ `ValidateOnBuild = true` — a missing
registration is a whole-host boot failure).

### Teardown
`BusinessClosureTeardown` now also: purges **knowledge index cards** for the business (explicit, like the
services index — the change feed carries no deletes), adds **`KnowledgeBase`** to the container purge list,
and purges the **blob prefix** `{businessId}/`. Its ctor grew two dependencies, so
`ServiceRegistrationSelfContainmentTests`' declared contract and the one integration construction site were
updated.

### UI (both platforms, same session)
- **Web** (`clinqetwebpartnerapp`): route `ProfileRoute.AiKnowledge = "/dashboard/profile/knowledge"`;
  `app\dashboard\profile\knowledge\{page.jsx,layout.js}`; the Profile-menu entry immediately after the AI
  entry inside the same `aiAssistantEnabled` spread; `components\Profile\knowledge\` (KnowledgePage +
  UploadKnowledgeModal + KnowledgeFaqModal + DocumentDetailsModal + KnowledgeModalShell + knowledgeMeta);
  `KnowledgeNudge.jsx` inserted in `ActivePanel.jsx` above the cancel row (D31);
  `services\knowledgeServices.js`; `api\url.js` endpoints; the `profile.knowledge` analytics surface;
  registered in `profileScreensAreCapabilityGated.test.js`; **68 `knowledge.*` keys in all five
  `public\lang` catalogues**.
- **Mobile** (`clinqetmobilepartnerapp`): the five-file registration (`constant.tsx` `KNOWLEDGE`,
  `Screen\ProfileFlow\Knowledge\{index,style}`, `gateOn('voice.read', …)`, stack registration,
  `linking.ts` `dashboard/profile/knowledge` + `types.ts`); the ProfileScreen menu row after the AI entry;
  multi-file picker (`allowMultiSelection` + `keepLocalCopy`) uploading via **`putBlobToSasUrl` (XHR — fetch
  breaks the SAS signature)**; `knowledgeDocuments` in `MEDIA_LIMITS`; `services\knowledgeService.ts`;
  the D31 nudge in the VoiceAssistant screen; `Knowledge: 'profile.knowledge'` in the analytics `screenMap`;
  the `KNOWLEDGE` block in all five `src\Locales` files (SCREAMING_SNAKE, `{{}}`, no inline ICU).
- Status chips are **D33**: green Ready · **blue + spinner Processing** · red Failed · amber only for
  limit/space warnings. Brand green `#97EF29` only on CTAs.

### API-side localization
14 `Error_Knowledge*` keys (WEBP, doc limit, replace-target, not-found, reprocess state, FAQ limit, space
full, FAQ conflict, password-protected, unreadable, too-many-pages, no-readable-content,
unsupported-format, generic-retry) in **`clinqetinfrastructure\Resources\Localization\{en,es,fr,gu,hi}.json`**.

### Phase-1 proof
Functions unit **2271/2271** · API unit **9384/9384** · MCP unit **574/574** · cosmosindexsetup **70/70** ·
web jest gates **76 + 26** · mobile tsc clean + **123** jest across 6 gates · web ESLint **0**.
Sabotage-verified: tombstone CAS, gapless-replace prune, and all three D22 isolation pins each FAILED
against deliberately broken code and re-greened after restore.

---

# WHAT YOU BUILD IN PHASE 2

Everything below lives in `clinqetmcp` except the payload-builder/prompt edits (which live in
`clinqetinfrastructure` and are tested from the **Functions** suite per §0.18).

## 1. `search_knowledge` — the retrieval tool (PLAN §7.9, D22/D23/D27)

- New service `clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs` +
  `clinqetcore\Interfaces\Knowledge\IProviderKnowledgeSearch.cs`.
- **ONE hybrid request** — BM25 over `content`/`sectionTitle`/`docName`/`docTitle`/`linkedServiceName`
  **and** the vector over `contentVector`, sent together in a single Azure AI Search call. Deliberately
  NOT the catalog service's sequential lexical-then-vector ladder.
- **Isolation, four layers** — copy `ProviderCatalogSearchService`'s proven shape and the Phase-1
  `KnowledgeSearchIndexer` (both already do this): sealed construction taking the CallContext businessId,
  model input never reaching the filter, a pre-send assert that the filter LEADS with
  `businessId eq '<bound>'`, and **per-row `businessId` re-verification — one mismatch discards the WHOLE
  result set, alarms via `ICatalogAlarm`, and fails CLOSED** (never a degrade).
- **Query embedding**: `IEmbeddingService` (already registered in the MCP host) — it CACHES by
  `emb_{deployment}_{sha256}` with single-flight, and ‼️ **returns an EMPTY array on failure rather than
  throwing**. On empty or slow, send the request **keyword-only in the same round trip** — never make the
  caller wait on the vector leg. Filter vector queries with `hasEmbedding eq true`.
- **Budgets**: `RetrievalTopK` 5 and `RetrievalMaxTokens` 1500 — **the token budget binds FIRST**, so the
  effective card count self-adjusts (~5 small text cards, ~3 when table cards dominate). Hard ceiling
  `RetrievalTimeoutMs` 4000; warn-but-succeed at `RetrievalSlowWarnMs` 1500 under a stable log marker.
- ‼️ **NO minimum-score cutoff, ever** (D27b — RRF scores are rank-derived and not comparable across
  queries; this platform already learned "never floor raw RRF"). Zero results ⇒ the honest degrade.
- ‼️ **NO LLM anywhere in this path** (D23). Semantic reranking stays OFF.
- **Optional narrowing**: accept `linkedServiceId` so "what's the dig depth on THAT one" resolves against
  the right spec sheet.
- **Returns** passages with `docName` (+ `sectionTitle`) so the model can attribute naturally.
- **Degrade**: index unavailable/timeout ⇒ the honest "the owner will confirm" + take a message. Never
  "we don't have that", never a guess, never silence.
- Tool in `clinqetmcp\Clinqet.Mcp\Tools\` (a new `KnowledgeTools` class, or extend `CatalogTools` if it
  stays cohesive): explicit snake_case `[McpServerTool(Name = "search_knowledge", …)]`, runs through
  `McpToolGuard` (`partnerOnly: false`), **consumes 1 unit** of the per-call allowance, `[Description]`
  written as the model-steering surface it is — generic across all 300+ categories (D21).

## 2. `answer_catalog_question` — the expert check (PLAN §6, D4–D8)

- **Map mode ONLY** (a fully embedded catalog needs no round trip — same rule that gates `find_services`).
- New `clinqetinfrastructure\Services\Voice\ProviderCatalogAnswerService.cs` +
  `clinqetcore\Interfaces\Voice\IProviderCatalogAnswer.cs`. Ladder:
  1. **Server short-circuit (D8)** — run the existing catalog search FIRST; a small clearly-matching set
     (≤ `LookupTooBroadThreshold`, not requirement-shaped) returns those rows and **never calls the LLM**.
     Economy is enforced in code, never trusted to the model.
  2. **Retrieve wide** — up to `MaxCandidates` (150) rows **with FULL descriptions** (the 160-char
     `LookupSummaryMaxChars` clamp exists only to protect the realtime context and must NOT apply here),
     clamped per row at `CandidateDescriptionMaxChars` (600).
  3. **Reason once** — one `IAICompletionService` structured call: which candidates meet the requirement,
     using expert knowledge of typical specs where descriptions are silent. Strict JSON schema,
     `reasoning_effort: low`, `max_completion_tokens ≈ 500`, `temperature 0`. Returns ids + confidence
     (`stated`/`likely`/`unknown`) + a one-line spoken reason each.
  4. **Return small** — ≤5 rows, spoken-ready, plus a `note` telling the model to hedge anything `likely`
     and to offer the owner's confirmation (D20).
  5. **(Synergy, now available)** if the business has knowledge documents, pull the linked spec passages for
     the candidates via the Phase-1 `linkedServiceId` filter and feed them in.
- **Settings `Voice:ExpertCheck`** (§6.4) — new class, class defaults mirroring appsettings in every host
  that binds it: `Enabled` true, `DeploymentName` `gpt-5.4-mini`, `MaxCandidates` 150,
  `CandidateDescriptionMaxChars` 600, `MaxResults` 5, `TimeoutMs` 8000, `SlowWarnMs` 3000,
  `AllowanceUnits` 2, `ReasoningEffort` low, `MaxCompletionTokens` 500.
- **Usage control, four layers** (§6.3): prompt ladder order · the tool description repeating the boundary ·
  the server short-circuit · hard caps — **2 units of the EXISTING 8-unit `VoiceCallSession.CatalogLookupCount`
  allowance (D6 — weighted consumption on the SAME field, zero schema change) ⇒ max 4 per call** + the
  `McpToolRateLimiter` + the `Voice:ExpertCheck:Enabled` kill switch + an `McpAudit` row per use.
- **Degrade ladder (§6.5)**: LLM timeout/error ⇒ fall back to the plain `find_services` result set for the
  same query, **never "we don't have that"**; zero candidates ⇒ the existing `None` shape; allowance spent ⇒
  the existing `Exhausted` note; **isolation violation ⇒ rethrow and fail closed**; malformed JSON ⇒ strict
  schema + one bounded `JsonRepairHelper` repair, then degrade; a price/availability requirement ⇒ refuse
  with guidance to the listed price; cancellation ⇒ honour the token, no orphaned LLM calls.
- ‼️ **Register `IAICompletionService` + its named `HttpClient` in the MCP host** — currently only the
  embedding service is wired via `AzureAIFoundry`.

## 3. Prompt wiring (`RealtimeSessionPayloadBuilder`)

- Add both tools to **`ResolveAllowedTools`**: `answer_catalog_question` **Map mode only**;
  `search_knowledge` only when the business **has ≥1 `Ready` knowledge document** (zero tokens and zero
  tool surface for everyone else).
- Add the **knowledge block** (§7.10) only when that same signal is true: what the tool is for
  (provider-specific facts not in the offering list), the absolute rule that **provider-specific claims come
  ONLY from returned passages**, the preamble requirement, natural attribution ("our rental terms say…"),
  and ‼️ **never the words "document", "passage", "index" or "link" to the caller** (the existing
  `send_service_info` speech rule is the precedent).
- Add the **ladder-order rule** (§6.3 layer 1): profile instantly → `find_services` for anything NAMED →
  the expert check ONLY for a requirement/constraint/comparison keyword search cannot express, or after
  `find_services` found nothing for a requirement-shaped ask → never for prices, hours, availability or
  booking.
- **X13**: a prompt rule for reading a TABLE card aloud — speak the VALUES naturally ("the CAT 340's dig
  depth is 52 feet"), never markup, never column separators, never the word "table".
- `hasKnowledge` signal: `FullProviderContextService` gains a cheap count read, **cached alongside the
  existing catalog-binding resolve — do NOT add a per-call round trip** (§7.10). The Phase-1
  `IKnowledgeSearchIndexer.CountCardsAsync` and the registry `CountAsync` are both available; prefer
  whichever keeps the warm path free.

## 4. Tests (§0.18 placement — get this right)

- **`Clinqet.Mcp.UnitTests`**: `search_knowledge` (isolation incl. a foreign row discarding everything,
  keyword-only fail-soft when the embedding returns empty, top-K + token budget, timeout degrade, narrowing
  by `linkedServiceId`, allowance consumption of 1, cancellation); `answer_catalog_question` (short-circuit
  fires and skips the LLM, LLM leg fires when it should, confidence→note mapping, timeout degrades to plain
  results, isolation rethrows, **allowance weighting consumes 2**, malformed JSON repaired then degraded,
  settings honoured, cancellation propagates).
- **`Clinqet.Mcp.IntegrationTests`**: ‼️ **add BOTH tool names to the curated tool-catalog contract list in
  `McpToolIntegrationTests.cs` (~line 47) — omitting this turns the suite red** (the 2026-07-31 scar);
  scope refusal, rate-limit refusal, end-to-end against the emulator with a seeded catalog.
- **`Clinqet.Communications.UnitTests`**: `ResolveAllowedTools` includes/excludes each tool correctly by
  mode and by `hasKnowledge`, on **both** payload builders; the knowledge block and ladder-order rule appear
  only when they should; the existing Move-1 pins stay green.
- ‼️ **`Mcp:ChatToolAllowlist`** — the in-app CHAT assistant is refused anything not on that list. Decide
  deliberately whether either tool belongs there (a chat session has no catalog binding and no live caller;
  the safe default is to leave both OFF) and pin the decision.
- Confirm the test projects RECOMPILED (never trust a `--no-build` pass) and **sabotage-verify** the
  isolation pin and the short-circuit pin: break each deliberately, watch the test fail, restore, re-green.

## 5. Probe calls (if a dev voiceline is available)

The excavator scenario end to end ("I need one that can dig 50 feet") plus 2–3 other trades to prove D21
trade-agnosticism. Note that live phone verification cannot be done from a dev environment — state plainly
what was and was not exercised.

---

# NON-NEGOTIABLES

Every rule in `CLAUDE.md` §0 and PLAN §0.1 verbatim: zero assumptions/hallucinations/workarounds; settings
not magic numbers (class defaults mirror appsettings in EVERY host that binds them); every `IMemoryCache`
write sets `Size = 1`; no cross-partition Cosmos queries; terse comments only for a non-obvious WHY;
never edit repo files with PowerShell `Get-Content`/`Set-Content`; §0.16 leave the tree clean and SAY what
you removed; thread-safe, leak-free, `await using`, honour every `CancellationToken`; **no new permission
keys**; no hardcoded user-facing text; **no industry vocabulary anywhere** (D21).

Traps that already cost time on this program: the curated MCP tool list going stale; a constructor parameter
added without grepping EVERY construction site (unit factories AND integration call sites); `--no-build`
reporting green on stale binaries; a DI-composition convention test that declares each extension's
dependency contract (Phase 1 had to update `ServiceRegistrationSelfContainmentTests` when a ctor grew);
`CosmosCompositeIndexContractTests.RepositoryToContainer` requiring every repository file.

# WHEN PHASE-2 CODE IS COMPLETE — two mandatory closing steps (§10)

1. **Multi-dimensional audit of YOUR OWN Phase-2 output**: adversarial cross-business retrieval attempt;
   the short-circuit's economy proven, not assumed; degrade ladders exercised (timeout, empty embedding,
   zero results, allowance spent); the retrieval latency budget and the no-LLM-in-`search_knowledge`
   guarantee; prompt token cost when `hasKnowledge` is false (must be zero); every affected suite green with
   recompilation confirmed; sabotage-verify the critical pins; tree clean.
2. **WRITE `C:\Nik\voice-answer-ladder\PHASE-3-PROMPT.md`** — a complete, self-contained copy-paste prompt
   for Phase 3 (the full-program end-to-end audit per PLAN §10): what Phases 1 and 2 shipped and where, what
   Phase 3 must audit (§7.8b + §7.11b line by line, the races exercised rather than assumed, adversarial
   isolation, cost paths, performance, localization parity, web responsiveness at 360/768/1024, mobile
   parity, all suites green with recompilation, sabotage-verification of the critical pins), and Phase 3's
   own close-out duties (§0.9 — update the `clinqet-voice-assistant` SKILL in **all four** AI-tool
   directories + the memory entry; §0.16 tree clean with removals reported). Then report to the owner: what
   shipped, what the audit found and fixed, proof of green, and the Phase-3 prompt path.
