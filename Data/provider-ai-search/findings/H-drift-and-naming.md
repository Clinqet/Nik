# H — DRIFT + NAMING report (2026-09-02)

> Scope: PART 1 re-verifies every factual claim in `PLAN.md` §2 ("Locked code facts the design rests on")
> and §4 (Phase 1 backend), plus `02-OWN-FINDINGS-AND-DRAFT-DESIGN.md` §2.7, against the CURRENT trees.
> PART 2 maps the existing naming space and recommends a non-colliding name set.
>
> Trees read at: shared `e5bec24` · core `fd04b1a` · infra `6341780` · api `6a61450` · mcp `8406310` ·
> functions `43ec2c0` · web-partner `99ff26ba` · mobile-partner `bd630f0e`. Every line number below was
> re-grepped against these HEADs. Nothing was modified.
>
> **Result: 22 claims are DRIFTED or REFUTED (17 DRIFTED · 5 REFUTED). 68 claims VERIFIED.
> 3 claims are NOT VERIFIABLE FROM SOURCE (they rest on live-probe memory, not on code).**

---

## PART 1 — DRIFT

### 1.1 Knowledge index + `pageNumber` (PLAN §2 row 1 · 02 §2.7 bullet 1)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 1 | `pageNumber` exists on the knowledge card, retrievable | `clinqetcore/Entities/AISearch/KnowledgeSearchDocument.cs:92-94` — `[SimpleField] [JsonPropertyName("pageNumber")] public int? PageNumber` (no `IsHidden`, so retrievable) | **VERIFIED** — 02 §2.7 cited `:92-94`; still exactly those lines |
| 2 | Written from the chunk's block page; default `1` for non-paginated sources | `clinqetcore/Models/Knowledge/KnowledgeBlocks.cs:33` `public int PageNumber { get; init; } = 1;` · `clinqetcore/Models/Knowledge/KnowledgeChunk.cs:21` `int? PageNumber` · `clinqetinfrastructure/Services/Knowledge/KnowledgeChunker.cs:110,114,125,137,147,155,185` pass `block.PageNumber` into Text/Table/ImageCaption cards | **VERIFIED** (the misleading constant `1` is a real property default, not an inference) |
| 3 | NOT selected on the search path today | `clinqetinfrastructure/Services/Knowledge/ProviderKnowledgeSearchService.cs:52-56` — `SelectFields` = `id, businessId, docId, docName, docTitle, sectionTitle, content, linkedServiceIds, linkedServiceNames, chunkKind, docType, linkedGroupName`. No `pageNumber` | **VERIFIED** — 02 §2.7 cited `:52-56`; still exactly those lines |
| 4 | (implicit) `pageNumber` is nowhere in the service | `ProviderKnowledgeSearchService.cs:64-65` — `RefSelectFields` = `id, businessId, docId, docName, docTitle, sectionTitle, content, chunkKind, **pageNumber**`; surfaced on `KnowledgeCardRef.PageNumber` (`:327`) | **DRIFTED** — the send-by-ref read path ALREADY selects `pageNumber`. The plan's "NOT selected" is true only of the *search* path; the field is already plumbed to a model on the delivery path, so §4.3's new record has a working precedent to copy |
| 5 | `KnowledgePassage` carries no docId/chunkNo/page | `clinqetshared/Models/Voice/KnowledgeSearchModels.cs:31-54` — `{ Content, DocName, SectionTitle, LinkedOfferings, Ref?, ImageRef? }` only | **VERIFIED** (also carries no `DocTitle`: `DocName` receives `DocTitle ?? DocName` at `ProviderKnowledgeSearchService.cs:~138`) |
| 6 | Index field list as described in 02 §1.1 (`linkedServiceIds` + `linkedServiceName`) | `KnowledgeSearchDocument.cs:45-63` — the fields are `linkedServiceIds` (collection), **`linkedServiceNames`** (collection, plural) and **`linkedGroupName`**; `imageRef` at `:115-118` (`WhenWritingNull`) | **DRIFTED** — 02 §1.1 names a singular `linkedServiceName` that does not exist, and omits `linkedGroupName` entirely (a searchable field). `kind`/`sectionPath` absent — **VERIFIED** |
| 7 | (pre-existing defect, not a plan claim) `imageRef` is selected only while a kill switch is on | `ProviderKnowledgeSearchService.cs:58-61` comment says the select must be gated; `:143` and `:431` add it **unconditionally**, and no `Images*Enabled` setting exists in `clinqetshared/Models/VoiceKnowledgeSettings.cs` | **REFUTED (stale comment)** — report to the owner; harmless today (the field is deployed) but the comment now lies |

### 1.2 Retrieval + isolation layers (PLAN §2 row 2 · §4.4)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 8 | ONE hybrid request + overview companion | `ProviderKnowledgeSearchService.cs:180` (`mainSearch`) + `:181-183` (`companionSearch`, gated `RetrievalOverviewCompanionEnabled`) | **VERIFIED** |
| 9 | Scope-led filter builder | `:672-698` `BuildScopeFilter` — `businessId eq '…'` first, then optional `linkedServiceIds/any(...)` **or `not linkedServiceIds/any()`**, then optional `hasEmbedding eq true` | **VERIFIED** |
| 10 | `AssertScoped` before the request leaves | `:700-709` (asserts `filter.StartsWith("businessId eq '…'")`, else `CatalogIsolationException`); called at `:132` and `:292` | **VERIFIED** |
| 11 | Vector `PreFilter` | `:164` `FilterMode = VectorFilterMode.PreFilter` | **VERIFIED** |
| 12 | Per-row verify-and-throw | `:505-510` (search path) and `:305-310` (read-by-key path) — `LogCritical` + `_alarm.RaiseCrossTenantLeak` + `throw new CatalogIsolationException` | **VERIFIED** |
| 13 | Fail-closed Cosmos allow-list `ListRetrievableDocIdsAsync` | `clinqetcore/Interfaces/COSMOS/IKnowledgeDocumentRepository.cs:37`; impl `clinqetinfrastructure/Data/COSMOS/KnowledgeDocumentRepository.cs:259-279`; started early at `ProviderKnowledgeSearchService.cs:126`, fault rethrown at `:193`, applied at `:195-196` to BOTH main and companion | **VERIFIED** |
| 14 | No LLM in retrieval | no `IAICompletionService`/`ChatClient` in the file's ctor (`:78-92`) or body | **VERIFIED** |
| 15 | `RetrievalMaxTokens` 3000 binds first | `clinqetshared/Models/VoiceKnowledgeSettings.cs:57` `= 3000`; `clinqetmcp/Clinqet.Mcp/appsettings.json:101` and `clinqetfuncations/Clinqet.Communications/appsettings.json:1185` both `3000`; consumed at `ProviderKnowledgeSearchService.cs:634` (`charBudget = RetrievalMaxTokens * 4 - EnvelopeChars`) before any per-passage seat | **VERIFIED** (02 §2.7's correction of the stale 1500 memory is right) |
| 16 | Live image allow-list read in parallel, fail-soft | `:387` `ListSendableImageRefsAsync` + `ListRefSuppressedDocIdsAsync` inside `ReadRefGatesSafeAsync` (`:378-…`), catches `OperationCanceledException` | **VERIFIED** |
| 17 | Model-facing serializer uses `UnsafeRelaxedJsonEscaping` | `:33-36` `PayloadShape` | **VERIFIED** |
| 18 | Search cost = 1 embedding + 2 search requests + 1–3 partition queries (02 §2.7) | 2 searches (`:180`,`:181`); partition reads = `ReadRetrievableDocIdsAsync` (1) + `ListRefSuppressedDocIdsAsync` + `ListSendableImageRefsAsync` (2) ⇒ up to 3 | **VERIFIED** |

### 1.3 Per-document visibility / `shareWithCallers` (PLAN §2 row 3 · §5)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 19 | No per-document visibility field on `KnowledgeDocument` | `clinqetcore/Entities/COSMOS/KnowledgeDocument.cs:10-93` — full field list is `businessId, docId, docName, docTitle, docType, linkedServiceIds, status, failureReasonKey, sizeBytes, pageCount, passageCount, contentHash, blobPath, sourceKind, shareWithCallers(:71), faqQuestion, faqAnswer, serviceDraftAnalytics, images, droppedImages`. **No `searchAudience`, no role keys, no ACL** | **VERIFIED** |
| 20 | Role keys are stored on no Cosmos entity today | `grep -rn "RoleKeys\|roleKeys" clinqetcore/Entities/COSMOS/` ⇒ zero hits | **VERIFIED** |
| 21 | `shareWithCallers` gates SENDING only | it is read by the ref gate (`ListRefSuppressedDocIdsAsync`, `ProviderKnowledgeSearchService.cs:389`) which only strips `Ref`/`ImageRef`; the only retrieval-time doc filter is `ListRetrievableDocIdsAsync` | **VERIFIED** |
| 22 | The write endpoint is `PATCH …/sendable` (02 §1.1) | `clinqetapi/Clinqet.API/Controllers/Knowledge/KnowledgeController.cs:478` is `[HttpPatch("documents/{docId}/sharing")]`; `:556` `[HttpPatch("documents/{docId}/images/{imageId}/sendable")]` is the per-IMAGE one | **DRIFTED** — §5.1's "mirrors `SetShareWithCallersAsync`" is right; the route name in 02 §1.1 is wrong |
| 23 | §5.1/§5.3: "the whole business's registry (≤ 220 rows) is read in one partition query **already used by retrieval**" ⇒ zero extra cost | `KnowledgeDocumentRepository.cs:263-266` — the existing query is `SELECT VALUE c.docId FROM c WHERE c.type = @type AND (NOT IS_DEFINED(c.status) OR c.status != @status)`. It is a **projection of docId only**; `searchAudience`/`searchAudienceRoleKeys`/`status` never leave Cosmos | **REFUTED** — the audience rule needs the projection WIDENED (or a second method). Still one query in one partition, but the §0.7 cost row ("zero index change, no extra read") must say "the existing projection is widened from `c.docId` to `c.docId, c.searchAudience, c.searchAudienceRoleKeys`", which changes bytes-per-row, not the query count. **The §0.7 table must be corrected before it is put to the owner.** |
| 24 | §5.3 predicate `registry.Where(r => r.Status is Ready && …)` | the live gate is `status != Deleting` (`:264-266`), i.e. `Processing`, `Failed` and status-less rows are ALREADY on the allow-list today | **DRIFTED** — tightening to `Ready` inside the same call would silently change voice retrieval behaviour. The audience predicate must be `AND`-ed onto the EXISTING `!= Deleting` gate, not replace it |
| 25 | Caps: 20 documents / 30 MB / 100 pages / 2000 passages / 200 FAQs ⇒ ≤ ~220 rows | `VoiceKnowledgeSettings.cs:13` `MaxDocumentsPerBusiness = 20` · `:14` `MaxFileSizeBytes = 31457280` (30 MB) · `:15` `MaxPagesPerDocument = 100` · `:16` `MaxPassagesPerBusiness = 2000` · `:25` `MaxTypedFaqs = 200` | **VERIFIED** |

### 1.4 Original-file access (PLAN §2 row 4 · 02 §2.7 bullet 2)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 26 | No endpoint returns the original knowledge file to a provider (web or mobile) | `KnowledgeController.cs` endpoint map: `GET documents` (:73, counts only), `POST documents/sas-urls` (:135), `POST documents/confirm` (:319), `DELETE documents/{docId}` (:373), `POST …/reprocess` (:402), `PATCH documents/{docId}` (:436), `PATCH …/sharing` (:478), `GET …/images` (:522), `PATCH …/images/{imageId}/sendable` (:556), `DELETE …/images/{imageId}` (:604), `POST …/rerun-analytics` (:646), `POST service-drafts/rerun-all` (:685), FAQ CRUD (:709/:752/:801). `GetUrlForReadAsync` appears exactly once, at `:876`, inside the images helper. Web has no url constant for it (`clinqetwebpartnerapp/src/api/url.js`), mobile none (`clinqetmobilepartnerapp/src/apiManager/constant.tsx`) | **VERIFIED** |
| 27 | "the only SAS-minting path is the per-document images endpoint" | `KnowledgeController.cs:262-267` — `POST documents/sas-urls` mints **`BlobSasPermissions.Create \| Write`** upload SAS via `GenerateBulkSasUrlsAsync` | **DRIFTED** — true only of **read** SAS. Say "the only READ-SAS-minting path"; an upload-SAS path exists and is a different permission set |
| 28 | 60-min `InternalSasExpiryMinutes`; one storage round trip per URL | `clinqetapi/Clinqet.API/appsettings.json:2654` `"InternalSasExpiryMinutes": 60`; `clinqetinfrastructure/Services/Storage/AzureStorageService.cs:852-865` `GetUrlForReadAsync` → `GenerateSasUrlAsync` → `EnsureContainerExistsAsync` at `:1232` | **VERIFIED** |
| 29 | `KnowledgeBlobPaths.IsDirectSourceBlob` is the blob-path guard (§4.4.5) | `clinqetcore/Models/Knowledge/KnowledgeBlobPaths.cs:18` | **VERIFIED** |
| 30 | Web can host the view URL in `DocumentPreviewModal`; `DerivativeImage` + lightbox exist | `clinqetwebpartnerapp/src/components/common/DocumentPreviewModal.jsx`; `DerivativeImage` used at `src/app/dashboard/inbox/page.jsx` and `src/components/booking/BookingsDetails.jsx`; `yet-another-react-lightbox ^3.25.0` in `package.json` | **VERIFIED** |

### 1.5 API host DI gaps (PLAN §2 row 5 · 02 §2.7 bullet 3) — the biggest drift

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 31 | API registers `KnowledgeSearchClient` | `clinqetapi/Clinqet.API/Program.cs:987-999` | **VERIFIED** |
| 32 | API registers `IEmbeddingService` | `Program.cs:1021` `AddSingleton<IEmbeddingService, AzureAIFoundryEmbeddingService>()` | **VERIFIED** |
| 33 | API registers `IAICompletionService` | `Program.cs:783` `AddHttpClient<IAICompletionService, AICompletionService>()` | **VERIFIED** |
| 34 | API registers `VoiceKnowledgeSettings` | `Program.cs:666` `Configure<VoiceKnowledgeSettings>(GetSection("Voice:Knowledge"))` | **VERIFIED** |
| 35 | API registers `IKnowledgeDocumentRepository` | `Program.cs:667` | **VERIFIED** |
| 36 | API does NOT register `IProviderKnowledgeSearch`, `KnowledgeSearchDependencies`, `IProviderCatalogSearch`, `CatalogSearchDependencies`, `ICatalogAlarm`, `IFullProviderContextService` | zero hits for all six in `Program.cs` (1723 lines); no infrastructure DI extension method registers them either (the host's only extension calls are `AddNotificationRouting`, `AddApiVoiceProvisioningSeam`, `AddPaymentServices`, `AddTenancyServices`, `AddBusinessSeatServices`, `AddTeamManagement`, `AddTenancyAuthorization`, `AddBusinessClosure`, `AddBusinessActivityFeed`, `AddBranchResolution` — `Program.cs:657,700,704,711,713,716,718,721,726,727`) | **VERIFIED — all six are missing** |
| 37 | "the Functions host proves these compose outside the MCP" | `clinqetfuncations/Clinqet.Communications/Program.cs` registers only FOUR: `IFullProviderContextService` (:459), `ICatalogAlarm` → `FunctionsCatalogIsolationAlarm` (:464), `CatalogSearchDependencies` (:467), `IProviderCatalogSearch` (:469). `grep -rn "IProviderKnowledgeSearch\|KnowledgeSearchDependencies" clinqetfuncations` ⇒ **zero hits, anywhere in the repo**. Only `clinqetmcp/Clinqet.Mcp/Program.cs:288-289` composes the knowledge search | **REFUTED** — the Functions host proves the CATALOG half composes outside the MCP; the KNOWLEDGE half has exactly one host precedent (the MCP). §3.1's "the search services are library classes already composed by the Functions host outside the MCP (B §3.2 Option B)" overstates it for `ProviderKnowledgeSearchService`. The plan's conclusion still holds (it is a plain library class with a 5-arg ctor, `ProviderKnowledgeSearchService.cs:78-92`) — but the *evidence* cited is wrong and must be restated |
| 38 | 02 §2.7: "`ICatalogAlarm` (only MCP does, with `McpCatalogIsolationAlarm`)" | MCP `Program.cs:276` AND Functions `Program.cs:464` both register it | **REFUTED** — two hosts, two implementations. PLAN §4.4.2's "mirror `FunctionsCatalogIsolationAlarm`" is the correct reading |
| 39 | API host binds `McpServerSettings` (needed if `IFullProviderContextService` is reused) | `Program.cs:816` `Configure<McpServerSettings>(GetSection("Mcp"))`; but the API's `Mcp` section (`appsettings.json:2037-2065`) carries no `ProviderContextCacheMinutes`, so the class default applies — `clinqetshared/Models/McpServerSettings.cs:16` `= 5` | **VERIFIED**, and §4.3's "cached 5 min" is right by class default |
| 40 | §4.3 `get_business_profile()` → `IFullProviderContextService.GetPartnerContextAsync(businessId)` | `clinqetcore/Interfaces/Voice/IFullProviderContextService.cs:7` — exact signature | **VERIFIED** |
| 41 | §1 hard constraint "`IMemoryCache` `Size=1`" | `clinqetinfrastructure/Services/Voice/FullProviderContextService.cs:93-99` writes `Size = Math.Clamp(1 + context.Services.Count / 25, 1, 64)` with a comment explaining that a flat 1 mis-sized a large catalog. API cache `SizeLimit` is set at `clinqetapi/Clinqet.API/Program.cs:213-216` | **DRIFTED** — the rule is "every write sets a Size", and the service §4.3 reuses is the live precedent for a content-proportional size. A new answer/citation cache should follow that precedent, not a blanket `Size = 1` |

### 1.6 MCP client / chat allowlist (PLAN §2 row 6)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 42 | `chat-`-prefixed call id, minted only by the API gateway | `clinqetshared/Constants/ChatToolSessions.cs:8` `CallIdPrefix = "chat-"` | **VERIFIED** |
| 43 | 16-tool allowlist | `clinqetapi/Clinqet.API/appsettings.json:2047-2064` — exactly 16 entries | **VERIFIED** |
| 44 | `search_knowledge` deliberately off the chat allowlist | absent from `:2047-2064` (so is `answer_catalog_question`) | **VERIFIED** |
| 45 | MCP knows BusinessId only — no member, no permissions, no SQL | `clinqetmcp/Clinqet.Mcp/Program.cs` registers no `TenantContext`/`IResourceScopeEvaluator`/`AppDbContext`; `CatalogLookupQuery` carries no businessId by construction (`clinqetshared/Models/Voice/VoiceCatalogModels.cs:5-16`) | **VERIFIED** |

### 1.7 `McpAIService` streaming loop + the Chat-Completions-only fact (PLAN §2 rows 7-8 · §3.3)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 46 | `McpAIService` is the ONLY streaming + tool-calling loop | `grep -rn "CompleteChatStreamingAsync\|CompleteChatAsync" clinqet{infrastructure,api,mcp,funcations}` (production sources) ⇒ one hit: `clinqetinfrastructure/Services/AI/McpAIService.cs:187`. `options.Tools.Add` / `ChatTool.CreateFunctionTool` ⇒ only `:180` and `:472`, same file | **VERIFIED** |
| 47 | Azure.AI.OpenAI 2.1.0 | `clinqetinfrastructure/Clinqet.Infrastructure.csproj:19` `Version="2.1.0"` | **VERIFIED** |
| 48 | Chat Completions; **no Responses API anywhere** | no `ResponsesClient` / `GetOpenAIResponseClient` / `/responses` endpoint in any of the six backend repos (the only `responses/` hits are the Broadcast controller's own route) | **VERIFIED** |
| 49 | Hardwires temperature 0.7 | `McpAIService.cs:173-177` `new ChatCompletionOptions { Temperature = _settings.Mcp.Temperature, MaxOutputTokenCount = _settings.Mcp.MaxTokens }` — unconditional, no `AcceptsTemperature` check. `clinqetshared/Models/AIAssistantSettings.cs:43` `= 0.7f`; `clinqetapi/Clinqet.API/appsettings.json:2096` `"Temperature": 0.7` | **VERIFIED** |
| 50 | No reasoning effort in the loop | no `ReasoningEffort` anywhere in `McpAIService.cs` | **VERIFIED** |
| 51 | Loop cancellation via a linked CTS | `McpAIService.cs:96` `ProduceResponsesAsync(channel.Writer, …, linked.Token)` | **VERIFIED** |
| 52 | `MaxToolIterations` dial | `McpAIService.cs:134`; `AIAssistantSettings.cs:182` `= 5`; `appsettings.json:2118` `5` | **VERIFIED** (§4.3 proposes 4 — a new dial, fine) |
| 53 | NO client calls `/ai/chat` on either app | web `src/api/url.js:259-261` declares only `ai/enhance-text`, `ai/provider-setup/upload-urls`, `ai/provider-setup/process`; mobile `src/apiManager/constant.tsx:131-136` declares `ai/enhance-text`, `ai/speech-to-text`, the two provider-setup URLs, and carries a comment at `:133-134` recording that an `ai/chat/attachment` constant was REMOVED because no such route exists | **VERIFIED** |
| 54 | `AICompletionService` = non-streaming seam with structured output, reasoning effort, luna temperature omission, budget governor, attempt budget, cutoff alerts, cost line | `clinqetinfrastructure/Services/AI/AICompletionService.cs` — `HttpClient` `:20` / `SendAsync` `:423` (raw HTTP, not the SDK) · `response_format`+`json_schema` `:60-75`,`:373` · `reasoning_effort` `:56-58`,`:387-398` · `AcceptsTemperature` `:517-518` over `AIService:DefaultTemperatureOnlyDeployments` · `IAiBudgetGovernor` `:21` · `AiAttemptBudgetScope` `:408-410` · `ReportCentralCutoffAsync` `:471` · cost line `:556` | **VERIFIED** |
| 55 | (addition) the seam cannot tool-call | `CompletionRequestBody` `:44-63` has NO `tools` property; zero `Tools` references in the file | **VERIFIED — confirms §3.3's premise that a new streaming/tool loop is unavoidable** |

### 1.8 New-AI-flow registration requirements (PLAN §2 row 9 · §10)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 56 | Must add an `AiSubFlows` id | `clinqetshared/Constants/AiSubFlows.cs:9-39` — 28 constants: `A1-A3, B1-B3, C2-C3, D1-D4, E1-E4, F1-F3, G1-G5, H1-H3` + `unattributed` | **VERIFIED** (see PART 2 for the free letter) |
| 57 | Must add the dial to `AiBudgetCutoffAlerts.BudgetDialBySubFlow` | `clinqetinfrastructure/Services/AI/AiBudgetCutoffAlerts.cs:22` (the dictionary) and `:148-150` (the "no dial registered" fallback message) | **VERIFIED** |
| 58 | Must pin in `AiModelPinConventionTests` | `clinqetapi/Clinqet.API.UnitTests/Conventions/AiModelPinConventionTests.cs` AND `clinqetfuncations/Clinqet.Communications.UnitTests/Conventions/AiModelPinConventionTests.cs` — one per host (§0.15) | **VERIFIED** |
| 59 | Must add an `AiRateLimitingService` policy | `clinqetinfrastructure/Services/AI/AiRateLimitingService.cs:224-234` — a hard-coded `switch` over exactly three endpoint names (`text-enhancement`, `mcp-chat`, `document-intelligence`) | **VERIFIED**, but see #61 |
| 60 | §4.6's key path `AIAssistant:RateLimiting:ProviderSearch:{RequestsPerWindow, TokensPerWindow}` | `clinqetshared/Models/AIAssistantSettings.cs:185-192` `AIRateLimitingSettings { Enabled, EnableTokenBasedLimiting, TextEnhancement, McpChat, DocumentIntelligence }`; live values `clinqetapi/Clinqet.API/appsettings.json:2200-2221` | **VERIFIED** — the proposed shape matches exactly |
| 61 | §10 "appsettings only" | adding a 4th policy needs a **code** change in TWO files (a new `AIEndpointRateLimitSettings` property at `AIAssistantSettings.cs:185-192` + a new `switch` arm at `AiRateLimitingService.cs:224-234`), not appsettings alone | **DRIFTED** — §10's "appsettings only" is wrong for the rate limit |
| 62 | §4.6 "daily caps via … a new `provider_search_daily_limit` entitlement" | `AIAssistantSettings.cs:194-202` — `AIEndpointRateLimitSettings.RequestsPerDay` already exists ("Durable per-business daily cap (atomic counter — survives restarts and scale-out). 0 = off") and is already in use: `appsettings.json:2220` `"RequestsPerDay": 50` on DocumentIntelligence | **DRIFTED** — the cheapest correct option (CLAUDE.md §0.7) is the existing `RequestsPerDay` field, not a new entitlement. A per-MEMBER cap is genuinely new; the per-BUSINESS cap is not |
| 63 | "per-flow keys are NOT written by `deploy.ps1`" | `azureautomation/deploy.ps1` writes **11 per-flow deployment-name env keys**: `AIService__DeploymentName`, `AzureDocumentIntelligence__AiDeploymentName`, `AzureDocumentIntelligence__VisionAiDeploymentName`, `BroadcastClassification__AiDeploymentName`, `BroadcastClassification__VisionDeploymentName`, `SearchIndexEnrichment__DeploymentName` (`:6973`, `:7176`), `Search__SpellCheck__Llm__DeploymentName`, `ServiceApproval__CategoryValidationDeploymentName`, `ServiceApproval__ContentValidationDeploymentName`, `VoiceCall__SummaryDeploymentName`, `VoiceCall__TranslationDeploymentName`, `Voice__ExpertCheck__DeploymentName` | **REFUTED** — the house convention is that a per-flow `DeploymentName` IS env-mapped so the region's provisioned model name flows in. §10's "no ARM change, no deploy.ps1 entry" would make the new flow the only per-flow deployment name that cannot be steered per region, and CLAUDE.md §0.7.1 forbids a new key with no matching `deploy.ps1` entry. **A `deploy.ps1` entry must be added to the plan.** |

### 1.9 Models and prices (PLAN §2 row 10 · 02 §1.2)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 64 | mini $0.75 / $0.075 / $4.50 per 1M | `clinqetapi/Clinqet.API/appsettings.json:2031` `"gpt-5.4-mini": { "InputPer1M": 0.75, "CachedInputPer1M": 0.075, "OutputPer1M": 4.50 }` | **VERIFIED** |
| 65 | luna $0.20 / $0.02 / $1.20 per 1M | `:2032` `"gpt-5.6-luna": { "InputPer1M": 0.20, "CachedInputPer1M": 0.02, "OutputPer1M": 1.20 }` | **VERIFIED** |
| 66 | Platform default deployment = mini | `:2020` `"AIService": { … "DeploymentName": "gpt-5.4-mini" }`; `clinqetshared/Constants/AiModels.cs:11,13` | **VERIFIED** |
| 67 | luna rejects non-default temperature (seam omits it) | `:2017` `"DefaultTemperatureOnlyDeployments": ["gpt-5.6-luna"]`; honoured at `AICompletionService.cs:517-518` | **VERIFIED** |
| 68 | Repo comment "5.6 cannot tool-call on Chat Completions" exists and is UNMEASURED | `clinqetshared/Constants/AiModels.cs:9-10` — "Locked for A3 (assistant chat): gpt-5.6 cannot do tool calls on Chat Completions, and A3 has no per-flow deployment key, so the host default `AIService:DeploymentName` is its only defence." No test, probe artefact or measurement is cited anywhere in the tree | **VERIFIED (the comment) · claim of "unmeasured" VERIFIED by absence** |
| 69 | luna content filter NOT enforced; luna 500s on some image inputs | not assertable from source (the RAI assignment happens in `deploy.ps1`'s model loop; the failures are live-probe results recorded in memory `ai-cost-quality-phase7-8`) | **NOT VERIFIABLE FROM SOURCE** — keep it flagged as a live-probe finding, never as a code fact |
| 70 | Azure doc rule "tools on Chat Completions only with `reasoning_effort: none`, else the Responses API" | external vendor documentation, not in the tree | **NOT VERIFIABLE FROM SOURCE** |
| 71 | luna latency at effort `none` is unmeasured | no artefact in the tree | **NOT VERIFIABLE FROM SOURCE** — §4.8's probe is therefore mandatory, as the plan says |

### 1.10 Authorization (PLAN §2 rows 11-12 · §6)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 72 | "92 keys" | `clinqetinfrastructure/Data/SQL/TenancyRoleCatalogDefinition.cs:50-178` — **94** `PermissionDefinition` entries (92 string literals + `ManagePayoutAccountPermissionKey` and `TransferOwnershipPermissionKey` constants), no duplicates | **DRIFTED → 94.** (CLAUDE.md §1 and the `clinqet-provider-teams` skill both still say 89 — both stale) |
| 73 | 10 roles | `:196-297` — `primary_owner(1), administrator(2), operations_manager(3), sales_representative(4), dispatcher(5), technician(6), catalog_manager(7), finance(8), contractor(9), read_only_auditor(10)` | **VERIFIED** |
| 74 | Only `Business` and `Assigned` scopes granted | `grep -oE "PermissionScope\.[A-Za-z]+"` over the catalogue ⇒ `Assigned` ×1, `Business` ×2. `clinqetshared/Enums/PermissionScope.cs:9-17` declares 7 (`None, CreatedByMe, Participating, Assigned, Branch, Team, Business`) | **VERIFIED** |
| 75 | `CatalogVersion` | `TenancyRoleCatalogDefinition.cs:18` `= 4` | **VERIFIED** (the coordinator's own drift note is correct) |
| 76 | `WorkListNarrowing` pushes `ARRAY_CONTAINS(c.assignedMembershipIds,@m)` | `clinqetcore/Services/Tenancy/WorkListNarrowing.cs:64-76` — the predicate is `ARRAY_CONTAINS(c.assignedMembershipIds, @{parameterPrefix}Membership)`, not `@m`; `WorkListNarrowing.For` at `:43-59` maps `Business→None`, `Assigned→AssignedToMembership|MatchesNothing`, `Team→AssignedToTeams|MatchesNothing`, else `Unsupported` | **DRIFTED** (parameter name only — but a plan that quotes SQL should quote it exactly) |
| 77 | `/assignedMembershipIds/[]/?` is an IncludedPath | `clinqetcore/Cosmos/Setup/CosmosContainerPolicies.cs:245`, `:460` (work container) and `:459` in the Communications block | **VERIFIED** |
| 78 | `createdByMembershipId` exists but is unindexed | `clinqetcore/Entities/COSMOS/ProviderOwnedEntity.cs:24-26` and `Cosmos.cs:1150-1151`; zero `createdByMembershipId` IncludedPath in `CosmosContainerPolicies.cs` | **VERIFIED** — §6's note on "quotes Gaurav sent" stands |
| 79 | `TenantContext` carries what §4/§5/§6 need | `clinqetshared/Models/TenantContext.cs:10-26` — `BusinessId`, `MembershipId`, `AccessScope`, `RoleKeys`, `ScopeFor(key)`, `Has(key, minimumScope)` | **VERIFIED** (§5.3's `tenant.RoleKeys` and §6's `tenant.Has`/`ScopeFor` all exist) |
| 80 | `AccessScope == Full` / `BillingOnly` (§4.1) | `clinqetshared/Enums/BusinessAccessScope.cs:8-12` — exactly `Full`, `BillingOnly` | **VERIFIED** |
| 81 | Knowledge page = `voice.read`, held by owner/admin/ops/dispatcher only | `TenancyRoleCatalogDefinition.cs:149` declares it; granted at `:213` (operations_manager) and `:240` (dispatcher), plus `primary_owner`/`administrator` via `everything`/`administrator` (`:196-197`) | **VERIFIED** |
| 82 | `ai.assistant.use` excludes technician/contractor/finance/auditor | declared `:155`; granted at `:214` (operations_manager), `:227` (sales_representative), `:241` (dispatcher), `:268` (catalog_manager) + owner/admin. Not in the `technician(:245)`, `finance(:273)`, `contractor(:289)`, `read_only_auditor(:297)` blocks | **VERIFIED** |
| 83 | §6 tool data paths exist with narrowing overloads | `clinqetcore/Interfaces/COSMOS/IBookingRepository.cs:35` `GetPaginatedBookingsAsync(businessId, queryDto, ct, narrowing)` · `IQuoteRepository.cs:18` · `IInvoiceRepository.cs:19,21,23,33` · `IInvoiceService.cs:51,54,58` (incl. `GetEarningsGraphAsync`) | **VERIFIED** |

### 1.11 Phase-1 contract details (PLAN §4)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 84 | SSE error-frame precedent at `AIAssistantController.cs:1256-1291` | `clinqetapi/Clinqet.API/Controllers/AI/AIAssistantController.cs` — `EnsureSSEResponseHeaders` `:1256-1265`, `WriteSSEEvent` `:1267-1273`, `WriteErrorResponse` `:1275-1291` (file is 1293 lines) | **VERIFIED — exact** |
| 85 | §4.2 "new event names; `data:` frames" vs §8 "`event`-typed frames" | the only SSE writer in the tree emits `data: {json}\n\n` (`:1271`) with the type carried INSIDE the payload as `eventType`; the web reader keys on `event?.eventType === "Content"` (`clinqetwebpartnerapp/src/services/aiServices.js:132`). **No `event:` line is emitted anywhere** | **DRIFTED** — §4.2 and §8 contradict each other. Named `event:` lines would be a NEW wire shape needing a new parser on both clients; the in-JSON `eventType` discriminator is the reusable precedent. Pick one before build |
| 86 | Existing web SSE reader = `fetch` + `getReader` + `TextDecoder`, no abort/stall/401/403 | `clinqetwebpartnerapp/src/services/aiServices.js:147-200` (`StreamProviderSetupDocument`), reader at `:179-181`; no `AbortController`, no timer, no 401 refresh | **VERIFIED — exact range** |
| 87 | Mobile streaming = XHR `onprogress` with a 330 s stall guard, single-purpose | `clinqetmobilepartnerapp/src/services/aiServices.ts:352-354` `PROVIDER_SETUP_STALL_TIMEOUT_MS = 330000`, `streamSetupOnce` `:372`, `new XMLHttpRequest()` `:379`, `xhr.onprogress` `:427`, retry wrapper `:477-484` | **VERIFIED** |
| 88 | §4.3 catalog tool → `IProviderCatalogSearch.LookupAsync(businessId, source, CatalogLookupQuery{IncludeUnapproved:true})` | `clinqetcore/Interfaces/Voice/IProviderCatalogSearch.cs:16-20`; `clinqetshared/Models/Voice/VoiceCatalogModels.cs:7-16` — `{ Text, Group, MinPrice, MaxPrice, ExcludeIds, IncludeUnapproved }`, maps 1:1 onto the proposed `search_services(query?, group?, minPrice?, maxPrice?)` | **VERIFIED** |
| 89 | A point read is needed for `categoryId`/`subcategoryId` | `VoiceCatalogModels.cs:32-40` — `CatalogLookupItem { ServiceId, Name, Group, PriceText, Summary, Duration }`: no category ids, no `isActive`, no `approvalStatus`. `clinqetcore/Interfaces/COSMOS/IServiceRepository.cs:15` `GetServiceByIdAsync(serviceId, businessId, ct)` (composite id `{businessId}_{serviceId}`) | **VERIFIED** |
| 90 | §4.3 session = `IMcpSessionService`/`AiSession`, "Communications container, **pk = businessId**", cache `Size=1` | container name resolved from `CosmosDb:ContainerNames:Communications` (`clinqetinfrastructure/Data/COSMOS/AiSessionRepository.cs:27-28`); the container's **partition-key PATH is `/userNumber`** (`clinqetcore/Cosmos/Setup/CosmosContainerPolicies.cs:443`); the businessId is written into that property (`clinqetcore/Entities/COSMOS/AiSession.cs:18-19`, passed as the partition key at `AiSessionRepository.cs:33-42`); cache `Size = 1` at `clinqetinfrastructure/Services/AI/McpSessionService.cs:196-204` | **DRIFTED** — the pk PATH is `/userNumber`, the businessId is only its VALUE. Any new query or document family in that container must write `userNumber`, not `businessId`, or it lands in the wrong partition |
| 91 | §4.3 `MaxConversationRounds` exists | `clinqetshared/Models/AIAssistantSettings.cs:170` `= 10`; `appsettings.json:2112` `10` | **VERIFIED** |
| 92 | §4.3 `InteractionType = ProviderSearch` on the session | `clinqetshared/Enums/ChatInteractionType.cs:7-20` — 4 values, and one is **already `SearchService = 1`** | **VERIFIED that the enum exists · NAMING COLLISION** (see PART 2) |
| 93 | §4.5 service card `route: /dashboard/services?serviceId=` | `/dashboard/services` **has never been a route**: `clinqetwebpartnerapp/src/lib/tenancy/renderingRules.js:1172-1174` ("TD-25: the row opens the screen that EXISTS (`/dashboard/profile/manage-services-price`); `/dashboard/services` was never a route"), `src/components/dashboard/layout/Sidebar.jsx:81-89` uses `ProfileRoute.ManageServicesPrice`, and `src/app/dashboard/` contains no `services` directory | **REFUTED** — the card route must be `/dashboard/profile/manage-services-price` (`ProfileRoute.ManageServicesPrice`). §4.5's own parenthetical says so; the literal in the table is wrong and would ship a dead link |
| 94 | §4.5 PPTX labelled "Slide"; label keys reused | web `clinqetwebpartnerapp/public/lang/en-US.json:5741-5742` `"knowledge.images.page": "Page {page}"`, `"knowledge.images.slide": "Slide {page}"` | **VERIFIED (web)** |
| 95 | §4.7 "page/slide labels reuse `knowledge.images.page/slide`" on mobile too | mobile keys are `KNOWLEDGE.IMAGES_PAGE = "Page {{page}}"` and `KNOWLEDGE.IMAGES_SLIDE = "Slide {{page}}"` (`clinqetmobilepartnerapp/src/Locales/en.json`, under the flat `KNOWLEDGE` object) | **DRIFTED** — different key names and a different interpolation syntax (`{{page}}` i18next vs `{page}` ICU). §4.7 must name both |
| 96 | §4.4.2 "mirror `FunctionsCatalogIsolationAlarm`" | `clinqetfuncations/Clinqet.Communications/Program.cs:464` registers `Clinqet.Communications.Services.FunctionsCatalogIsolationAlarm`; `ICatalogAlarm` contract at `clinqetcore/Interfaces/Voice/IProviderCatalogSearch.cs:44-52` (`RaiseCrossTenantLeak`, `RaiseLookupTimeout`) | **VERIFIED** |
| 97 | §4.4.1 no tool schema carries a businessId | `VoiceCatalogModels.cs:5-6` states it by construction for the catalog; `KnowledgeSearchQuery` likewise takes it as a separate server argument (`ProviderKnowledgeSearchService.cs:94-97`) | **VERIFIED** |

### 1.12 Web shell (PLAN §2 row 13 · §7 · 02 §2.7)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 98 | No search input / command palette anywhere in the provider web app | the only `search`-ish localization values in `public/lang/en-US.json` are the literal strings `"Search"` and `"Search..."` used as **list filter-box** labels; no palette component exists | **VERIFIED** |
| 99 | Rail = flat permission-derived array, owner-fixed order | `src/components/dashboard/layout/Sidebar.jsx:65-131` (9 head rows: dashboard, calendar, services, leads, inbox, bookings, quotes, invoices, customers) + `:216-282` (6 pushed tail rows: insights, team, billing ×2 arms, callFollowUps, activity, refundRequests). Order pinned by `src/components/dashboard/layout/sidebarRailConsistency.test.js:106-147` ("the tail is now ordered by…", "puts every tail row after Customers, the last untouched row", "pushes the tail rather than splicing") | **VERIFIED** |
| 100 | `SURFACE_PERMISSIONS {permission, controller, method, route}`, verified by an API test | `src/lib/tenancy/renderingRules.js:1168-1188` — 15 entries, that exact shape; `clinqetapi/Clinqet.API.UnitTests/Conventions/NavigationGatesMatchControllerPermissionsTests.cs` reads the literal (per the comment at `renderingRules.js:1161-1164`) | **VERIFIED** |
| 101 | `permission: null` = everyone (Dashboard precedent) | `renderingRules.js:1169` `dashboard: { permission: null, controller: null, method: null, route: null }` — the ONLY null entry; `surfaceVisible` returns `true` on null (`:1196-1201`) | **VERIFIED** |
| 102 | §7's registry checklist | it omits a SECOND registry that also gates the count: `src/app/dashboard/dashboardSurfacesAreGated.test.js:22-38,42-45` asserts `Object.keys(PAGE_FOR_SURFACE) ∪ SELF_GATED === Object.keys(SURFACE_PERMISSIONS)`, and `:47-51` asserts each page file contains `surface="<key>"` and imports `@/components/tenancy/SurfaceAccess` | **DRIFTED (incomplete)** — a new surface key fails that test until `PAGE_FOR_SURFACE` (or `SELF_GATED`) also names it. Add it to §7 |
| 103 | Full-height route precedent = inbox | `src/app/dashboard/layout.jsx:27` `const FULL_HEIGHT_ROUTES = ["/dashboard/inbox"];`, applied at `:36` | **VERIFIED** |
| 104 | No markdown renderer on web | `clinqetwebpartnerapp/package.json` dependencies: no `react-markdown`, `remark*`, `rehype*`, `marked`, `markdown-it`, `@tailwindcss/typography`. `dompurify ^3.3.3` present. `html-to-react ^1.7.0` present with **zero imports in `src/`** | **VERIFIED** (the orphan status of `html-to-react` re-confirmed) |
| 105 | `inferSurfaceFromPath` already yields `dashboard.search` | `src/services/analyticsTracker.js:173` `if (pathname.startsWith("/dashboard/")) { return \`dashboard.${pathname.split("/")[2] || "root"}\`; }` — reached only after 50 explicit cases (`:121-172`), none of which is `search` | **VERIFIED** |
| 106 | §7's analytics helpers exist | `analyticsTracker.js:550-572` `trackSearchAction({action, searchQuery, categoryId, subcategoryId, surface, metadata, resultCount, durationMs})` · `:574-602` `trackResultClick` · `:764` `trackAIAssistant` · `useDwell` in `src/hooks/` (used by `app/dashboard/explore/page.jsx`) | **VERIFIED** |
| 107 | (new risk, not a plan claim) the provider's natural-language question would flow into analytics | `analyticsTracker.js:224-227` — `searchQuery: scrubPii(event.searchQuery)`; the Parquet analytics pipeline stores it. A provider question can name a customer ("what did Sarah Chen book?") | **RAISE WITH THE OWNER** — either omit `searchQuery` for this surface or state that the question text is stored scrubbed |

### 1.13 Mobile shell (PLAN §2 row 14 · §8 · 02 §2.7)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 108 | Tabs = Dashboard · Bookings · ⊕ · Leads · Inbox, no free slot | `clinqetmobilepartnerapp/src/appNavigation/BottomNavigation-Route.tsx:112-113` (`MYDASHBOARDROUTE`, label `BOTTOM_NAVIGATION.DASHBOARD` `:139`), `:158-164` (`BookingRoute`), `:181-185` (`navigations.BUSINESSPROFILE`, `tabBarLabel: ''` — the centre FAB), `:194-200` (`BroadcastRoute` = Leads), `:217-244` (`InboxRoute`) | **VERIFIED** |
| 109 | Profile row "AI Knowledge" | `src/Screen/ProfileFlow/ProfileScreen/index.tsx:1147-1155` — `key: "knowledge"`, `label: t("KNOWLEDGE.MENU_LABEL")` = `"AI Knowledge"` (`src/Locales/en.json` `KNOWLEDGE.MENU_LABEL`), last row of the `PROFILE_SCREEN.BUSINESS_MANAGEMENT` group (`:1068-1069`), directly beneath `voice_assistant` (`:1138-1145`) | **VERIFIED** |
| 110 | §8 "Profile row beside AI Knowledge; gate = business context only" | both the `voice_assistant` and `knowledge` rows carry `visible: payments.aiAssistantEnabled === true` (`:1142`, `:1150`) | **DRIFTED** — an ungated Search row placed inside that pair would appear for businesses that have the AI package switched OFF, sitting where two package-gated rows used to be. Either place it in a different group or state the gate difference explicitly |
| 111 | Five-file screen registration | `src/appNavigation/constant.tsx` (`navigations.*`), `types.ts` (route params — e.g. `AddService` at `:80`, `:166`, `:191`), `linking.ts` (path map), a stack route file (`MyDashboard-Route.tsx`), `src/services/analyticsTracker.ts` `screenMap` (`:121-240`) | **VERIFIED** |
| 112 | AASA / web-URL parity required | `src/appNavigation/linking.ts:7` — every deep link is a `business.clinket.com/dashboard/...` URL; e.g. `:104` `Knowledge: 'dashboard/profile/knowledge'` | **VERIFIED** |
| 113 | Knowledge route has no `docId` param | `linking.ts:104` is a bare path; contrast `:61` `BookingDetails: 'dashboard/bookings/:bookingId'` | **VERIFIED** |
| 114 | `react-native-render-html` present, no markdown lib | `package.json` — `react-native-render-html ^6.3.4`; no `react-native-markdown-display`, no `marked` | **VERIFIED** |
| 115 | No PDF viewer | no `react-native-pdf` / `react-native-pdf-lib` | **VERIFIED**, but `react-native-webview ^13.16.1` and `react-native-inappbrowser-reborn ^3.7.1` ARE present — so a viewer exists in practice; say "no dedicated PDF component" |
| 116 | `@react-native-clipboard/clipboard` absent (a "Copy" action needs a new dep) | not in `package.json` dependencies | **VERIFIED** |
| 117 | `AddService {serviceId, businessId, entryContext}` deep link exists | `src/appNavigation/types.ts:80` `AddService: { serviceId?: string; businessId?: string; entryContext?: 'onboarding' \| 'profile' } \| undefined` (repeated `:166`, `:191`) | **VERIFIED** |
| 118 | `screenMap` naming style | `src/services/analyticsTracker.ts:121-240` — mixes snake_case (`dashboard_home`, `booking_detail`, `call_followups`) and dotted (`dashboard.billing`, `profile.knowledge`, `profile.locations`); **no `search` entry** | **VERIFIED** |
| 119 | es locale authored but unregistered | `src/Locales/i18n.ts:3-6` imports en/fr/gu/hi only; `:10` "Spanish is fully authored but remains hidden until product approves picker integration" | **VERIFIED** |

### 1.14 Localization counts (PLAN §2 row 15 · §4.7)

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 120 | API `Resources/Localization/{en,es,fr,gu,hi}.json` — **3047** keys, parity-tested | `clinqetinfrastructure/Resources/Localization/` — 5 files; flat objects; **3121** keys each (all five identical) | **DRIFTED → 3121** |
| 121 | Web `public/lang/{en-US,es-US,fr-CA,hi-IN,gu-IN}.json` — **5,792** keys | `clinqetwebpartnerapp/public/lang/` — 5 files; flat; **5929** keys each | **DRIFTED → 5929** |
| 122 | Mobile `src/Locales/{en,es,fr,gu,hi}.json` — **5,477** leaves | `clinqetmobilepartnerapp/src/Locales/` — 5 files; nested (284 top-level groups); **5619** leaves in `en.json` | **DRIFTED → 5619** (284 top-level) |
| 123 | Mobile `_one/_other` plurals, no inline ICU | e.g. `KNOWLEDGE.META_PAGES_ONE` / `META_PAGES_MANY`, `PREFLIGHT_PAGES_ONE` / `_MANY` | **VERIFIED** (the suffixes in use are `_ONE`/`_MANY` as well as `_one`/`_other` — name the actual pair when writing keys) |

### 1.15 Other 02 §2.7 items

| # | Claim | Current path:line | Verdict |
|---|---|---|---|
| 124 | Display rule can branch on `PageCount != null` | `clinqetcore/Entities/COSMOS/KnowledgeDocument.cs:50` `public int? PageCount { get; set; }` | **VERIFIED** |
| 125 | Knowledge page is `voice.read`, a SETTINGS permission; services are `catalog.service.read` | `TenancyRoleCatalogDefinition.cs:149` (`voice.read`, category `"Voice"`), `:58` (`catalog.service.read`, category `"CatalogService"`); enforced at `KnowledgeController.cs:79,528` (`voice.read`) and `:142,326,379,409,443,486,564,612,653,691,715,760,807` (`voice.settings.manage`) | **VERIFIED** |
| 126 | Stored card text is plain `label: value`, no HTML ⇒ nothing to sanitize from the source | `KnowledgeSearchDocument.cs:69-74` — `content` is "the passage BODY only", header composed at read time; `KnowledgeChunkKind` = `Text, Table, FaqPair, ImageCaption, DocSummary, DocAggregate` (`clinqetshared/Enums/KnowledgeChunkKind.cs`) | **VERIFIED** |

---

## PART 2 — NAMING COLLISION

### 2.1 The collision is far larger than one localization key

The programme brief flagged `Error_ProviderSearchUnavailable`. Confirmed at exactly the cited lines —
`clinqetapi/Clinqet.API/Controllers/Discovery/DiscoveryController.cs:163` and
`clinqetapi/Clinqet.API/Controllers/Search/SearchController.cs:857`, resolving
`clinqetinfrastructure/Resources/Localization/en.json:2474`
("Provider search is temporarily unavailable. Please try again in a moment.").

But that key is the smallest part of it. **`ProviderSearch` is the established name of the CUSTOMER-side
"search for providers" stack: 218 references across 13 files and 11 distinct symbols.**

| Existing symbol | Path |
|---|---|
| `ProviderSearchDocument` (an Azure AI Search index entity) | `clinqetcore/Entities/AISearch/ProviderSearchDocument.cs:16` |
| `IProviderSearchIndexer` | `clinqetcore/Interfaces/Search/IProviderSearchIndexer.cs:5` |
| `IProviderSearchService`, `ProviderSearchResult`, `ProviderSearchHit` | `clinqetcore/Interfaces/Search/IProviderSearchService.cs:10,21,34` |
| `ProviderSearchClient` | `clinqetcore/Interfaces/Search/ProviderSearchClient.cs:7` |
| `ProviderSearchExecutionResult` | `clinqetcore/Interfaces/Services/IRecommendationSearchService.cs:61` |
| `SearchInvocationMode.ProviderSearch` (an enum MEMBER) | `clinqetshared/Enums/SearchInvocationMode.cs:11` |
| `RecommendedProviderSearchResultDto` | `clinqetshared/DTOs/Discovery/RecommendedProvidersResponseDto.cs:56` |
| `ProviderSearchFilterBuilder` | `clinqetinfrastructure/Services/Search/ProviderSearchFilterBuilder.cs:16` |
| `ProviderSearchIndexer` | `clinqetinfrastructure/Services/Search/ProviderSearchIndexer.cs:27` |
| `ProviderSearchService`, `ProviderSearchResultMapper` | `clinqetinfrastructure/Services/Search/ProviderSearchService.cs`, `…/ProviderSearchResultMapper.cs` |
| 5 test classes (`ProviderSearchCancellationTests`, `…FilterBuilderTests`, `…IndexerTests`, `…ResultMapperTests`, `…ServiceFacetTests`) | `clinqetapi/Clinqet.API.UnitTests/Search/`, `…/Services/` |

Semantically it is the exact **inverse** of the new feature: `ProviderSearch` today means *a customer
searching FOR providers*; the new surface is *a provider searching WITHIN their own business*. Shipping
`ProviderSearchController` next to `ProviderSearchService` would be a permanent reading hazard, and
`ProviderSearchAgent` / `IProviderSearchTool` / `ProviderSearch:*` would all sit inside the customer
stack's vocabulary.

`provider-search` as a kebab **route** and `providerSearch` in the frontends are technically free
(zero hits), so only the C#/settings/localization identifiers collide outright — but the route would
still read as the customer feature, one segment away from the live `api/search/providers`.

### 2.2 The existing naming space

**API route prefixes** (68 distinct `[Route(...)]` literals under `clinqetapi/Clinqet.API/Controllers/`):

| Family | Prefix | Owner |
|---|---|---|
| Customer search | `api/[controller]` ⇒ **`api/search`** (unversioned!) — `SearchController.cs:29`; endpoints `services`(:257), `track`(:601), **`providers`(:685)**, `suggest`(:904), `filters`(:1372) | customer |
| Customer discovery | `api/v{v}/discovery` (`DiscoveryController.cs:20`), `api/v{v}/public/discovery` | customer |
| Admin search | `api/v{v}/admin/search` (`SearchAdminController.cs:26`) | admin |
| AI assistant | `api/v{v}/ai` (`AIAssistantController.cs:32`); endpoints `speech-to-text`, `enhance-text`, **`chat`** (:423, dormant), `provider-setup/upload-urls`, `provider-setup/process`, `sessions`, `sessions/{id}` | provider |
| Knowledge | `api/v{v}/knowledge`, `api/v{v}/knowledge/service-drafts` | provider |
| **Provider/tenant-scoped family (24 prefixes, 22 controllers)** | `api/v{v}/business/{access, activity, availability, bookings, branches, broadcast, closure, inbox, invoices, leads, licenses, members, notifications, offers, portfolio, profile, quotes, service/areas, services, team/invitation, team/invitations, teams}` | provider |
| Other | `api/v{v}/{bookings, quotes, invoices, cart, categories, conversations, dashboard, locale, notifications, provider, provider/billing, voice-assistant, whatsapp, app-config, …}` | mixed |

**`api/v{v}/business/search` is FREE** — no controller, no sub-route (`grep '[HttpGet("search")]'` etc.
returns only the admin prefix).

**appsettings sections** — 96 top level in `clinqetapi/Clinqet.API/appsettings.json`. The search-adjacent ones:

| Section | Contents (abridged) |
|---|---|
| `Search` | 57 keys — the customer hybrid-search dial block (BM25/vector/semantic weights, RRF, `SpellCheck`, `Expansion`, `Facets`, …) |
| `AISearch` | `IndexName: clinket-dev`, **`ProviderIndexName: clinket-providers-dev`**, `KnowledgeIndexName: clinket-knowledge-dev`, `MaxRetryAttempts`, `RetryDelays` |
| `SearchService` | customer result-shaping (`DefaultSearchText`, `Facets`, `SelectFields`, …) |
| `SearchIndexEnrichment` | the B1 AI enrichment flow's dials |
| `AzureSearchIndex` | `VectorSearchDimensions` |
| `Suggestion` | 38 keys — the customer suggester |
| `Discovery`, `SeoDiscovery`, `RecommendationSettings`, `RecommendationCache` | customer discovery |
| `Voice` | `Carrier`, `Knowledge` (the knowledge ingest+retrieval block) |
| `Mcp` | `PublicUrl, SecretPath, TokenSigningKey, InternalApiKey, TokenIssuer, TokenAudience, SessionTtlMinutes, ChatToolSessionLifetimeMinutes, ToolCatalogCacheMinutes, ChatToolAllowlist` |
| `AIAssistant` | `TextEnhancement`, `Mcp`, `ProviderAttachmentProcessing`, **`RateLimiting:{TextEnhancement, McpChat, DocumentIntelligence}`** |
| `AIService` / `AiBudget` | the central seam + budget governor |

A top-level `ProviderSearch` section is unused today, but it would sit one identifier away from
`AISearch:ProviderIndexName` — the customer provider index.

**`AiSubFlows` ids** — `A1-A3` (assistant), `B1-B3` (search/content/category), `C2-C3` (quote classify),
`D1-D4` (setup extract), `E1-E4` (setup images), `F1-F3` (knowledge), `G1-G5` (drafts), `H1-H3` (voice),
plus `unattributed` (`clinqetshared/Constants/AiSubFlows.cs:9-39`). **`I` is the first unused letter.**
Note `B1-search-enrichment` already owns the word "search" in this namespace.

**C# folders** — `clinqetinfrastructure/Services/Search/` IS the customer search stack (it contains
`ProviderSearchService.cs`, `ProviderSearchIndexer.cs`, `ProviderSearchFilterBuilder.cs`,
`ProviderSearchResultMapper.cs`); `Clinqet.Core.Interfaces.Search` holds `IProviderSearchService`,
`IProviderSearchIndexer`, `ProviderSearchClient`, `KnowledgeSearchClient`. `Services/Knowledge/`,
`Services/Voice/`, `Services/Discovery/`, `Services/AI/`, `Services/Tenancy/` are all taken by other
concerns. `Clinqet.Core.Interfaces.{AI, Knowledge, Search, Voice, Tenancy, Discovery}` likewise.

**Web** — routes under `src/app/dashboard/`: `activity, ai-billing, analytics, billing, bookings,
calendar, call-follow-ups, customers, explore, inbox, invoices, leads, myQuotes, notifications, profile,
refund-requests, team`. No `search`, and **no `services`** (see claim #93). Rail surface keys (15):
`dashboard, calendar, services, leads, inbox, bookings, quotes, invoices, customers, insights,
refundRequests, billing, team, activity, callFollowUps` — camelCase for multiword. Analytics surfaces
from `inferSurfaceFromPath` (`analyticsTracker.js:121-176`): `home, onboarding, public_provider,
dashboard_home, lead_list/lead_detail, booking_list/booking_detail, quote_list/quote_detail,
invoice_*, customer_crm, messaging_inbox, calendar, notifications, call_followups, explore_*,
profile.*` and the `dashboard.<segment>` fallback.

**Mobile** — `screenMap` (`src/services/analyticsTracker.ts:121-240`) has no `search`; `types.ts`,
`constant.tsx` and `linking.ts` have no `Search` screen.

**Localization** — API: `Search_*` = 37 keys (all customer search: `Search_Expansion_*`,
`Search_MatchQuality_*`, `Search_SpellCorrection_*`, `Search_ServiceArea_*`, `Search_Unit_*`,
`Search_Track_Accepted`, `Search_Location_Fallback`), `Error_Provider*` = 31 keys, `Voice_*` = 23 keys.
Web: `knowledge.*` is the knowledge namespace. Mobile: `KNOWLEDGE.*`.

**The user-facing word "Search" is already spoken for as a FILTER-BOX label.** Mobile has ~25
`*.SEARCH*` keys — `MY_BOOKINGS_SCREEN.SEARCH_PLACEHOLDER`, `MY_QUOTES_SCREEN.SEARCH_LABEL`,
`CUSTOMERS_SCREEN.QUICK_SEARCH`, `CHAT_SCREEN.SEARCH`, `EXPLORE_SCREEN.SEARCH_PLACEHOLDER`,
`MANAGE_SERVICE_SCREEN.SEARCH_PLACEHOLDER`, `REVIEWS_SCREEN.SEARCH_PLACEHOLDER`,
`OFFERS_SCREEN.SEARCH_PLACEHOLDER`, `BUSINESS_CATEGORY.SEARCH_PLACEHOLDER`, … — and web uses the bare
strings `"Search"` / `"Search..."`. A nav row labelled "Search" competes with twelve in-page filters.

Also collides: **`ChatInteractionType` already has `SearchService = 1`**
(`clinqetshared/Enums/ChatInteractionType.cs:9-10`), so §4.3's session discriminator must not be
`Search` or `ProviderSearch`.

### 2.3 Availability probe of the candidate families

`grep -rEl` over `clinqetcore clinqetshared clinqetinfrastructure clinqetapi clinqetmcp clinqetfuncations`
(C#) and `clinqetwebpartnerapp/src clinqetmobilepartnerapp/src` (JS/TS), plus both `appsettings.json`
and all 15 localization files:

| Candidate | Hits | Note |
|---|---|---|
| `ProviderSearch` | **218** | the customer provider-search stack — unusable |
| `BusinessSearch` / `businessSearch` / `BUSINESS_SEARCH` | **0** | free everywhere; `business/*` is already the provider-scoped route family |
| `WorkspaceSearch` | 0 | free, but "workspace" appears in the UI only as the workspace-switcher chip |
| `TeamSearch` | 0 | free, but pre-commits the name to the team-visibility feature (§5), which is one setting, not the whole surface |
| `BusinessAsk` / `AskBusiness` / `BusinessQuestion` / `BusinessAnswer` / `BusinessAssist` | 0 | free; `Ask*` reads oddly as a route segment |

### 2.4 RECOMMENDED NAME SET — `BusinessSearch` / `business-search`

One coherent family, chosen because `api/v{v}/business/*` is already the 24-prefix provider-scoped route
family, `BusinessSearch*` is free in every namespace checked, and "business search" reads as the exact
inverse of "provider search" — search *within my business*, not *for a provider*.

| Thing | Recommended | Why (one line) | Would collide with |
|---|---|---|---|
| **API route** | `[Route("api/v{version:apiVersion}/business/search")]` — `POST ask`, `GET documents/{docId}/view-url`, `GET sessions/{sessionId}` | joins the existing provider-scoped `business/*` family (22 controllers) so no new top-level prefix is invented, and the URL states the tenancy | `api/v1/provider-search` reads as the customer feature and sits beside the live `api/search/providers`; `api/search/*` is the unversioned customer controller; `api/v1/ai/*` is the assistant family whose `chat` is dormant and would blur the two |
| **Controller** | `BusinessSearchController` in a new `Controllers/BusinessSearch/` folder | matches `BusinessMemberController` / `BusinessActivityController` / `BusinessAccessController` in the same route family | `ProviderSearchController` (would sit next to `ProviderSearchService`, a different feature); `SearchController` and `SearchAdminController` are taken |
| **appsettings section** | top-level `BusinessSearch` — `BusinessSearch:Answer:{DeploymentName, ReasoningEffort, MaxCompletionTokens, MaxToolIterations}` and `BusinessSearch:{ToolResultMaxChars, SnippetMaxChars, MaxImagesPerAnswer, DocumentViewSasMinutes}`; **plus** the rate limit as `AIAssistant:RateLimiting:BusinessSearch` (that is where `AIRateLimitingSettings` binds its per-endpoint children — `AIAssistantSettings.cs:185-192`), and a `BusinessSearch__Answer__DeploymentName` env entry in `azureautomation/deploy.ps1` (claim #63) | free among the 96 sections; keeps the model dial beside the other 11 per-flow deployment names that deploy.ps1 steers per region | `ProviderSearch` would read as a sibling of `AISearch:ProviderIndexName`; `Search:*` is the 57-key customer dial block; `SearchService`/`Suggestion`/`Discovery`/`SeoDiscovery` are all customer-side |
| **`AiSubFlows` id** | `AiSubFlows.BusinessSearchAnswer = "I1-business-search-answer"` | `I` is the first unused family letter (A–H all taken) and the id keeps the `<letter><n>-<kebab>` pattern the pin test and `BudgetDialBySubFlow` key on | any `A*`–`H*` id; a bare `search` would be indistinguishable from `B1-search-enrichment`, the customer enrichment flow |
| **C# namespace / folder** | `Clinqet.Infrastructure.Services.BusinessSearch` (`clinqetinfrastructure/Services/BusinessSearch/`), contracts in `Clinqet.Core.Interfaces.BusinessSearch` (`clinqetcore/Interfaces/BusinessSearch/`); types `BusinessSearchAgent`, `IBusinessSearchTool`, `BusinessSearchCitationRegistry`, `KnowledgeHit` | keeps the new agent out of the customer search stack's folder and namespace entirely | `Services/Search` + `Core/Interfaces/Search` hold `ProviderSearchService`, `ProviderSearchIndexer`, `ProviderSearchFilterBuilder`, `ProviderSearchResultMapper`, `IProviderSearchService`, `IProviderSearchIndexer`, `ProviderSearchClient`; `Services/Knowledge` is ingest+retrieval; `Services/AI` is the seam + MCP chat |
| **Web route + rail surface key** | route `/dashboard/search`; rail/gate key **`businessSearch`** in `SURFACE_PERMISSIONS` (`permission: null`), plus the same key in `PAGE_FOR_SURFACE` (claim #102) and in `Access.Surface.businessSearch` ×5 | the URL is what the member reads, so keep it short; the surface KEY is a code identifier and must not read like the customer feature — camelCase matches `refundRequests`/`callFollowUps` | surface key `search` is ambiguous beside the 37 `Search_*` customer keys and the ~12 in-page "Search" filter boxes. **Keep the analytics surface as `dashboard.search`** — `inferSurfaceFromPath` (`analyticsTracker.js:173`) derives it from the URL for free and mobile's map already uses `dashboard.*` for `billing`/`analytics` |
| **Mobile screen name** | `BusinessSearch` — `navigations.BUSINESSSEARCH` in `constant.tsx`, `BusinessSearch: undefined` in `types.ts`, `BusinessSearch: 'dashboard/search'` in `linking.ts`, `BusinessSearch: 'dashboard.search'` in `screenMap` | free in all five registration files; the deep-link path mirrors the web URL exactly, which the AASA-parity guard requires | `Search` would collide conceptually with `ExploreScreen` (the customer-facing browse) and with the ~25 `*.SEARCH*` filter keys |
| **Localization prefix** | API `BusinessSearch_*` (Status/NothingFound/NoAccess_*/Error_*/LimitReached/PartialAnswer); web `businessSearch.*`; mobile `BUSINESS_SEARCH.*` (with `_ONE`/`_MANY` for counts, and `{{x}}` interpolation) | free in all 15 files; leaves `Search_*` (37 customer keys) and `knowledge.*` untouched | `ProviderSearch_*` sits next to `Error_ProviderSearchUnavailable` and would be read as its family |
| **`ChatInteractionType` member** | `BusinessSearch = 5` (`+ [Display(Name = "ChatInteractionType_BusinessSearch")]` and the localized string ×5) | the enum already has `SearchService = 1`, so the new member must be unambiguous; values are explicit ints, so 5 is next | `Search` or `ProviderSearch` (indistinguishable from `SearchService`, the customer-catalog chat mode) |
| **User-facing LABEL** (owner decision 1) | **not the bare word "Search"** — e.g. "Ask Clinket" or "Business answers" | "Search"/"Search..." is already the in-page filter label on ~12 provider screens; a rail row with the same word teaches the member the wrong thing | — |

**Rejected alternatives, with the reason:** `ProviderSearch` (218 existing references, inverse meaning);
`Search` / `AiSearch` (`Search:*`, `AISearch:*`, `SearchService:*`, `SearchIndexEnrichment:*` and
`Services/Search` all belong to the customer stack); `TeamSearch` (names the §5 visibility setting, not
the surface — and §5 may be dropped); `KnowledgeSearch` (`KnowledgeSearchClient`,
`KnowledgeSearchDocument`, `KnowledgeSearchDependencies`, `KnowledgeSearchIndexer`,
`KnowledgeSearchModels` all exist, and the surface answers service-catalogue and later booking
questions too); `Assistant*` / `Copilot*` (`AIAssistantController`, `AIAssistantSettings`,
`ai.assistant.use`, `AIAssistantModal` are the dormant MCP chat — reusing the word invites the two to be
confused, and `AIAssistantModal.jsx` is one of the files carrying the onboarding-escape guard).

---

## PART 3 — items that must change in PLAN.md before it goes to the owner

Ordered by consequence.

1. **§10 + §4.6 — `deploy.ps1` entry is required** (claim #63). The plan says no ARM/deploy change; the
   house convention env-maps all 11 per-flow deployment names, and §0.7.1 forbids a new key without it.
2. **§5.1 §0.7 table — the "already read" cost row is wrong** (claim #23). The existing partition query
   projects `c.docId` only. Restate as "the existing projection widens by two fields; still one query".
3. **§5.3 — the status predicate must be `!= Deleting`, not `is Ready`** (claim #24), or voice retrieval
   changes behaviour as a side effect.
4. **§4.5 — the service-card route is `/dashboard/profile/manage-services-price`** (claim #93);
   `/dashboard/services` has never existed and the plan's own §4.5 parenthetical says so.
5. **§3.1/§2 row 5 — restate the Functions-host evidence** (claims #37, #38). Knowledge search composes
   only in the MCP today; the Functions host proves the catalog half. `ICatalogAlarm` has two host
   implementations, not one.
6. **§4.2 vs §8 — pick ONE SSE wire shape** (claim #85). No `event:` line exists anywhere; the reusable
   precedent is `data:` + an in-JSON `eventType`.
7. **§10 "appsettings only" is wrong for the rate limit** (claim #61) — two code files change.
8. **§4.6 — use the existing `RequestsPerDay` for the per-business daily cap** (claim #62) before
   proposing a new entitlement (§0.7's "cheapest correct option wins").
9. **§4.3 — the session container's partition-key path is `/userNumber`** (claim #90).
10. **§7 — add `PAGE_FOR_SURFACE`/`SELF_GATED` to the registry checklist** (claim #102).
11. **§4.7 — name the mobile keys `KNOWLEDGE.IMAGES_PAGE`/`IMAGES_SLIDE` and the `{{x}}` syntax**
    (claim #95).
12. **§1 — restate the cache constraint as "every write sets a Size"** (claim #41); the service §4.3
    reuses deliberately sizes by content.
13. **§8 — state the AI-package gate difference for the mobile Profile row** (claim #110).
14. **§2 row 11 — 94 permission keys, not 92** (claim #72); quote the predicate parameter correctly
    (claim #76).
15. **§2 row 15 — refresh the three localization counts** to 3121 / 5929 / 5619 (claims #120-122).
16. **§2 row 4 — say "the only READ-SAS-minting path"** (claim #27).
17. **New risk to raise: the question text reaches the analytics Parquet pipeline** via
    `trackSearchAction`'s `searchQuery` (claim #107).
18. **Pre-existing defect to report: `imageRef` select is unconditional** while its comment claims a
    kill-switch gate (claim #7).
19. **Rename the whole feature** per PART 2.4 before any file is created.
