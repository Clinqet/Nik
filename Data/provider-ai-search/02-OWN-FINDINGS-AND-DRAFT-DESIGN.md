# Provider AI Search — verified facts + draft design (session 1, 2026-09-01)

> Written by the planning session before the token limit. Everything in §1 was READ (memory files, SKILL
> sections, web docs) — sources are named. §2 is a DRAFT design, NOT approved by the owner; it exists so the
> next session does not re-derive it. The seven agent reports in `findings/` are the detailed evidence.

---

## 1. Verified facts (with where they came from)

### 1.1 The knowledge base as it exists today (memory files + voice-assistant SKILL)
- Knowledge lives in its OWN Azure AI Search index, alias `clinket-knowledge-{env}` (physical `…-v1`), region in the
  ENDPOINT not the name; Cosmos registry container `KnowledgeBase`, partition key **`/businessId`**; blob container
  `provider-knowledge` with layout `{businessId}/…`, images under `{businessId}/_images/{docId}/{imageId}.ext`, the
  content artefact at `{businessId}/_artifacts/{docId}.json.gz`, OCR page cache under `_ocr/{businessId}/…` (in-flight
  AI-cost session 4). Source: `knowledge-audit-runbook` memory, SKILL Phase A section (lines 39-258).
- Index fields (schema = `FieldBuilder().Build(typeof(KnowledgeSearchDocument))` in **clinqetcore**; adding a
  `[SimpleField]` there IS the schema change; `cosmosindexsetup --search-only` per region pushes it in place, no
  reindex): deterministic id `{businessId}_{docId}_{chunkNo}`, `businessId` (filter + per-row verify), `docId`
  (filterable), `docName`, `docTitle`, `docType` enum, `chunkKind` (Text/Table/FaqPair/DocSummary/ImageCaption…),
  `sectionTitle`, `content` (`standard.lucene`, one field five languages), `contentVector` (text-embedding-3-large),
  `linkedServiceIds` (collection) + `linkedServiceName`, `language`, `hasEmbedding`, `imageRef` (added 2026-08-25),
  `updatedAt`. ‼️ `kind`/`sectionPath` DO NOT EXIST. **No page-number field is documented anywhere** — but the
  parser's block model `KnowledgeBlock.PageNumber` exists (defaults to 1; recorded only for paginated sources —
  PDF pages, PPTX slides) and the image registry entry carries `page?`. ⇒ page numbers are DERIVABLE at chunk time
  for PDF/PPTX/images; they are NOT stored on cards today. Agent A confirms/denies in `findings/A-*.md`.
- Retrieval (`search_knowledge`, `clinqetmcp\Tools\KnowledgeTools.cs` → **`ProviderKnowledgeSearchService` in
  `clinqetinfrastructure\Services\Knowledge\`** — reusable in-process by the API host): ONE hybrid request (BM25 over
  content/sectionTitle/docName/docTitle/linkedServiceName + vector), embedding fail-soft to keyword-only,
  `RetrievalTopK` 8, `RetrievalMaxTokens` 1500 binds FIRST (cards are all-or-nothing), NO min-score cutoff, NO LLM
  inside retrieval (pinned by a ctor-reflection test), `RetrievalTimeoutMs` 4000. **D22 isolation = four layers:
  server-stamped `businessId` filter, refuse-to-send guard, per-row verify, fail CLOSED + alarm; the model never
  supplies businessId.** Live image allow-list `ListSendableImageRefsAsync` read in parallel (untick/tombstone ⇒
  absent ⇒ fails closed). Source name spoken = `DocTitle ?? DocName`.
- Stored card text is plain `label: value | label: value` (HTML was removed 2026-08-18; "No path stores source
  markup any more") ⇒ NO raw HTML ever needs rendering in a UI — markdown tables from the model are enough.
- Three model-facing serializers must use `UnsafeRelaxedJsonEscaping` (default STJ encoder escapes `<` and every
  non-ASCII char: +54% tokens on Hindi/Gujarati). Any new tool-result serializer must set `Encoder` explicitly.
- `answer_catalog_question` (`CatalogTools` → `ProviderCatalogAnswerService` in `Services\Voice\`) = the expert
  rung: plain `IProviderCatalogSearch.LookupAsync` first, D8 short-circuit, `RetrieveCandidatesAsync` (isolation
  fortress, per-row verify THROWS on a foreign row), ONE strict-schema gpt-5.4-mini call. Reusable.
- `send_material_info` (delivery): the AI passes only `ref`s of 1–4 cards; server fetches + validates them under the
  bound business and renders a deterministic QuestPDF "Information from {Business}"; WhatsApp (`clinket_info_ready`
  DOCUMENT template, `clinket_info_picture` for pictures) or email. Never the whole file. Per-document switch
  **`shareWithCallers`** (Cosmos `KnowledgeDocument`, default true) = "Send details to callers". Pictures: sendable ⇔
  `document.ShareWithCallers AND image.Sendable`.
- Knowledge API (`KnowledgeController`): `GET knowledge/documents` (COUNTS only — polled; a read-SAS is a storage
  round trip), `GET knowledge/documents/{docId}/images` (`voice.read`, the ONLY SAS-minting path, `ImageSasConcurrency`
  8, wire shape `thumbnailUrl`/`url` so the apps' shared `getThumbSrc`/`getOriginalSrc` work), `PATCH …/sendable`,
  `DELETE …/images/{imageId}` (`voice.settings.manage`), `PATCH documents/{docId}` edits type/link only (no rename).
- Permissions today: `voice.read` (view), `voice.settings.manage` (write) govern the whole knowledge page. No per-
  document audience/ACL exists.
- Caps (settings): 20 documents / 30 MB (raised from 20 in session 4) / 100 pages / 2,000 passages / 200 FAQs per
  business. A business's whole registry is ≤ ~220 rows in ONE partition ⇒ cheap to read per request.
- UI placement today: **"AI Knowledge" is its OWN menu item below the AI Receptionist entry in the PROFILE menu**
  (web `profile\layout.jsx` ~133-144; mobile `ProfileScreen/index.tsx` ~1067-1075), route `/dashboard/profile/…`.
  Page = two tabs "Documents & FAQs" / "Service suggestions" (v5.2 mockup `C:\Nik\Data\mockups\knowledge-page-layout-v5`).
  Web file `src/components/Profile/knowledge/KnowledgePage.jsx`; mobile `src/Screen/ProfileFlow/Knowledge/index.tsx`.
- The in-app TEXT chat assistant (`AIAssistantController`, `Services/AI/*`) reaches the REAL MCP server over HTTP
  with a `chat-`-prefixed call id minted by the API gateway (`McpToolGateway`), restricted by `Mcp:ChatToolAllowlist`
  (16 read tools; `search_knowledge` + `answer_catalog_question` deliberately OFF it). MCP auth = secret path +
  per-call bearer + binding doc (`VoiceCallSession`); server-to-server = `X-Internal-Api-Key`. MCP knows only
  `BusinessId` + `VoiceCallScope` — no member, no permissions. (SKILL §3, §4, 2026-08-14 block.)
- MCP host traps: typed `AddHttpClient<,>` is BANNED there; the deployed MCP cannot be probed from a dev machine
  (`403 Ip Forbidden`); new MCP tool params must be TAIL-appended.

### 1.2 Models, pricing, capabilities (web, 2026-09-01; Azure Retail Prices API eastus2, Global Standard)
| Model | Input /1M | Cached /1M | Output /1M | Tools via Chat Completions | Notes |
|---|---|---|---|---|---|
| gpt-5.4-mini (2026-03-17) | $0.75 | $0.075 | $4.50 | Yes (Functions, tools, parallel) | 400k ctx; the platform's proven default (`AIService:DeploymentName`) |
| gpt-5.4-nano (2026-03-17) | $0.20 | $0.02 | $1.25 | Yes | weaker; classification/extraction tier |
| gpt-5.6-luna (2026-07-09) | $0.20 (short ctx) | $0.02 | $1.20 | **Yes, BUT on Azure: Chat Completions + function tools only when `reasoning_effort` is `none`; otherwise use the Responses API** (Microsoft Learn, GPT-5.6 note) | 1.05M ctx; OpenAI doc: streaming, structured_outputs, function_calling, image_input, prompt_caching; effort none/low/medium(default)/high/xhigh/max; knowledge cutoff 2026-02-16 |
Sources: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure ·
https://developers.openai.com/api/docs/models/gpt-5.6-luna · https://prices.azure.com/api/retail/prices (filters
`contains(tolower(meterName),'luna')` / `'5.4'`, `armRegionName eq 'eastus2'`).
- ‼️ **The owner's belief "Luna doesn't support tool calling" is REFUTED by both vendors' docs** — with the Azure
  caveat above (effort `none` on Chat Completions, or the Responses API).
- Repo facts about luna (memory `ai-cost-quality-phase7-8`, `…session4`): deployed on the shared **East US 2**
  account only (India's Sweden Central is realtime-only); rejects any non-default `temperature` (HTTP 400) — seam
  `AIService:DefaultTemperatureOnlyDeployments` now omits it; its `ClinketContentFilter` is ASSIGNED but NOT
  ENFORCED (indirect-attack injection inside a provider price list returned 200 on luna, 400 on mini); reproducible
  HTTP 500s on some image inputs (not reproduced on a small page image in session 4); ~4.5× slower per call than
  mini on the B1 enrichment (reasoning tokens) — latency at effort `none` is UNMEASURED.
- Every AI call site in this codebase is a registered **sub-flow** (`clinqetshared/Constants/AiSubFlows.cs`) with
  its own `MaxCompletionTokens` dial + cutoff alerts (`AiBudgetCutoffAlerts`), pinned per host by
  `AiModelPinConventionTests`; model names are constants in the NEW `clinqetshared/Constants/AiModels.cs`
  (untracked, from the in-flight AI-cost session). A new search flow MUST register the same way.

### 1.3 Owner rules that bind this project (memory + CLAUDE.md)
Approval before any code edit (in the current conversation) · mockup gate: web + mobile, every state, approved
before integrated UI · mobile mirrors web in the SAME session (matching rendering rules; keys in all 5 web
`public/lang/{en-US,es-US,fr-CA,gu-IN,hi-IN}.json` + 5 mobile `src/Locales/{en,es,fr,gu,hi}.json` + 5 API
`Resources/Localization/*.json`) · NO feature flags / old paths (dials yes, switches no) · §0.7 schema table for
any new index field / Cosmos field / SQL column · no stubs · no AI-looking icons/emoji (brand: lime #97EF29 on
navy #032858, heroicons-style strokes on web, react-native-svg on mobile) · never `git checkout/restore/reset/
stash` in `C:\Nik` · owner pushes + deploys (order: shared → core → infra → non-hosts → hosts last) · scratch files
only in the session scratchpad · tests live with the runtime consumer (§0.18) · every `IMemoryCache` write `Size=1`.

### 1.4a ‼️ RE-BASELINE 2026-09-02 06:30 — §1.4 below is STALE, keep it only as history
Between the research pass and this note the owner **committed and pulled everything**: every repo is now
**CLEAN** at a **NEW HEAD** — `clinqetshared e5bec24` ("Add Noice cancellation details") · `clinqetcore fd04b1a`
("Add Invoice payment options") · `clinqetinfrastructure 6341780` · `clinqetapi 6a61450` ("Fixed the unit test
cases") · `clinqetmcp 8406310` · `clinqetfuncations 43ec2c0` · `clinqetidentity aaece54` ("knowledge base and AI
model more changes") · `clinqetwebpartnerapp 99ff26ba` · `clinqetmobilepartnerapp bd630f0e` · `azureautomation
2cdefa2` · `cosmosindexsetup 9e755d8`. Consequences:
- **The AI Cost & Quality session-4 work LANDED** (`clinqetshared/Constants/AiModels.cs`,
  `IVisionDocumentTranscriptionService.cs`, `VisionDocumentTranscriptionService.cs`,
  `VisionTranscriptionSettings.cs` are all TRACKED now) ⇒ findings A/C's luna/vision facts are current, not
  pending. The tree is clean, so anything uncommitted from here is OURS.
- **Line numbers in `findings/A–G` were taken against the PREVIOUS trees** — spot checks show most are exact
  (`KnowledgeSearchDocument.PageNumber` 92-94 → **94**, `SelectFields` **52**, `McpToolGateway` **57/78**,
  `McpAIService.CompleteChatStreamingAsync` **187**) but some drifted (`SURFACE_PERMISSIONS` 1165 → **1168**).
  **Re-grep before editing any file.** `findings/H-drift-and-naming.md` holds the systematic re-verification.
- ‼️ **`TenancyRoleCatalogDefinition.CatalogVersion` is now 4** (finding D says 3) ⇒ the permission catalogue
  changed again after D was written; D's key count/grants are re-verified in its closed version.
- ‼️ **NAMING COLLISION: `ProviderSearch` is already taken.** `Error_ProviderSearchUnavailable` is used by the
  **customer-side** provider discovery/search (`clinqetapi/Clinqet.API/Controllers/Discovery/
  DiscoveryController.cs:163`, `Controllers/Search/SearchController.cs:857`). The new internal feature must NOT
  be named `ProviderSearch*` — in this codebase that phrase means "search FOR providers". A non-colliding name
  set is recommended in `findings/H-drift-and-naming.md`; PLAN.md must be renamed accordingly before build.

### 1.4 Baseline of the working trees (2026-09-01, `git status --porcelain`, all on `master`) — HISTORICAL
EVERY repo carries UNCOMMITTED foreign work from two concurrent programmes — the AI Cost & Quality session 4
(`C:\Nik\ai-cost-quality\SESSION4-HANDOVER.md`: luna temperature seam, attempt budget, vision OCR wiring, F3/C1
deletions, 30 MB cap) and D15 Part 2 (category correction). Files this project will most likely also touch and
that are ALREADY dirty: `clinqetinfrastructure/Services/AI/AICompletionService.cs`, the 5 API localization jsons,
API/FN/MCP `appsettings.json`, `clinqetshared/Models/AIServiceSettings.cs`, `clinqetwebpartnerapp` 5 lang files +
`KnowledgePage.jsx`, mobile 5 locales + `Knowledge/index.tsx` + `AIAssistantModal.tsx`, `azureautomation/deploy.ps1`.
**Edit additively; never revert a hunk you did not write; never checkout.** HEADs: shared 54cb297 · core 707afad ·
infra 8822b2a · api 7f9f014 · mcp 47c01b3 · functions fb7f4f0 · identity 8eb1c47 · web-partner fa0f2ee7 ·
mobile-partner 56736bdb · azureautomation dd69f31 · cosmosindexsetup 9e755d8 (clean).

---

## 2. DRAFT design (not approved — the owner explicitly asked for a short explanation first)

### 2.1 Placement (needs Agent E/F facts to finalize; owner decision)
- **Recommended:** a first-class **Search** surface: (web) a search field in the dashboard header on every page +
  a nav-rail entry "Search" that opens `/dashboard/search`; (mobile) a header search icon + the same screen. Reason:
  the owner scopes it to "everything about my business", so it must not hide under Profile → AI Knowledge.
- Alternative: a tab on the AI Knowledge page (rejected: wrong mental model once bookings/leads are answerable).
- Label decision for the owner: "Search" (plain magnifier, house icon set) vs "Ask". Placeholder copy:
  "Ask anything about your business…" (localized ×5 ×2 apps).

### 2.2 Backend shape — "same engine, different door" (STRONGLY recommended)
- New API surface in **Clinqet.API** (the host that already owns `TenantContext`, `[RequiresPermission]`, the
  permission snapshot, and the provider JWT): `POST /api/v1/provider-search/ask` streaming **SSE**.
- The agentic loop runs IN the API host with a tool-calling text model. Tools are thin adapters over the SAME
  infrastructure services the MCP tools wrap — `IProviderKnowledgeSearch` (`ProviderKnowledgeSearchService`),
  `IProviderCatalogSearch`, `IProviderCatalogAnswer` — called with the server-stamped `businessId` from the token.
  **clinqetmcp is NOT touched ⇒ zero impact on the phone receptionist.** (Calling MCP over HTTP with a new token
  kind was considered and rejected: MCP knows no member/permissions, is a peer host, and cannot be probed from
  dev; teaching it roles would put the voice path at risk for nothing the API cannot do in-process.)
- Isolation guardrail (the "bankrupt in a day" risk): the model never sees or supplies a businessId; every tool takes
  it from `TenantContext`; every retrieval re-verifies each returned row's `businessId` (D22 layers reused
  unchanged); tool results are the ONLY source of citation ids/URLs (server builds citations from tool results —
  a model-invented id resolves to nothing); pinned by unit + real-emulator integration tests incl. a hostile
  "other business's doc id" probe.
- Model: deployment name is a dial (`ProviderSearch:Answer:DeploymentName`), registered as a sub-flow with its own
  token dials. Recommend **default gpt-5.4-mini** (proven tools + RAI filter enforced) and run the standard A/B on
  **gpt-5.6-luna at `reasoning_effort: none`** (3.75× cheaper) before flipping — the owner's rule: a dial moves only
  on a labelled measurement. Streaming + `reasoning_effort` low/none + cached stable prefix + retrieval budget ≈
  $0.005/query on mini, ≈ $0.0013 on luna (estimate: 3.5k uncached + 2.5k cached input, 400 output).
- Follow-up questions: short session (last N turns) via the existing chat-session persistence pattern (Agent C
  names the class); rate/budget limits via `AiRateLimitingService` pattern (per member + per business).
- No LLM inside retrieval (D23 stays); catalog plain-search short-circuit first (D8 pattern).

### 2.3 Streaming + rendering
SSE events (proposed): `meta` → `status` (what is being searched) → `delta` (markdown text) → `citation` (built
server-side from tool results) → `image` (thumbnail SAS for a ref that came back from retrieval and is on the live
allow-list) → `done` (usage) / `error`. Markdown only (tables incl.), sanitized renderer, no raw HTML. Images render
inline via `thumbnailUrl`, viewer opens `url` (existing shape). Web needs a markdown renderer if none is installed
(Agent E); mobile likewise (Agent F).

### 2.4 Citations
- Knowledge: `docTitle ?? docName` + section + **page (if stored — see §3 item 1)**; "Open document" = a short-TTL
  read-SAS to the original blob with inline disposition, minted LAZILY on click (no proxying through the API, no
  per-render storage calls); the cited passage text itself is shown from the card (free).
- Service: name + breadcrumb Category › Subcategory › Service via the cached category lookup; deep-link to the
  service editor (web route + mobile deep link from Agent G/F).

### 2.5 Business questions with authorization (add-on 1) — proposed to be Phase 2 of the same programme
Tools declared with a required permission key + honoring the member's resource scope from `TenantContext`
(e.g. list/count bookings, leads, quotes, invoice totals, availability, team members). The model only ever
receives the tools the asking member may use (filtered by the permission snapshot) AND every tool re-checks in
code (defense in depth). "My" = the caller's membership; another member's name resolves via the member list (only
when the caller's scope allows). Forbidden ⇒ a localized "you don't have access to X" answer, never data. The
voice MCP is untouched, so a caller can never ask "how many bookings do I have". Agent D's table maps each example
question to its permission key + scope filter.

### 2.6 Per-document visibility for team search (add-on 2) — proposed as Phase 3, designed now
- One new Cosmos field on `KnowledgeDocument` (§0.7 approval needed): `searchAudience` = `Team` (default: everyone
  in the business) | `Roles` + `searchAudienceRoleKeys[]`. NO index change: at query time the API loads the
  business's registry (one partition read, ≤ 220 rows, cacheable Size=1), computes the docIds the member may NOT
  see and adds `not search.in(docId,'…')` to the server-stamped filter — "re-derive from the source, never trust a
  projection" (the live image allow-list precedent). FAQs stay visible to all (they are caller-facing anyway).
- UI copy principle (non-technical): two clearly separated boxes in the document details editor —
  **"Phone receptionist"** (existing "Send details to callers" switch) and **"Team search"** with ONE question
  "Who can find this document when searching?" → "Everyone on my team" (default) / "Only these roles…". Never the
  words index/passage/knowledge base. Mockup owed (web + mobile, every state).

---

## 2.7 Reconciliation after reading findings A, E, F (2026-09-02) — these CORRECT the draft above
- **Page numbers need NO index change.** `pageNumber` (Int32?, retrievable) already exists on every card
  (`KnowledgeSearchDocument.cs:92-94`), written from the chunk's block page; real for PDF/photos/TIFF (DI
  PageBreak) and PPTX (slide); a misleading constant `1` for DOCX/XLSX/HTML/TXT/MD/JSON; `null` for FAQ/overview
  cards. Today it is NOT selected on the search path (`ProviderKnowledgeSearchService.cs:52-56`) — the provider
  search needs a richer, NEW result record (docId, chunkNo, pageNumber, sectionTitle, chunkKind, imageRef) and a
  display rule "page only for paginated sources" (branch on the row's file extension / `PageCount != null`).
  The voice `KnowledgePassage` contract is pinned by tests — add a new method/record, do not widen it. §3 item 1
  is therefore WITHDRAWN (no §0.7 needed for pages).
- **No endpoint returns the original file to the provider** (web or mobile). "Open document" = a NEW endpoint
  minting a short read-SAS (inline) — web can host it in the existing `DocumentPreviewModal` (iframe for PDF,
  image, new-tab fallback); mobile opens it with `Linking.openURL` / the installed in-app browser.
- **API host DI gap:** `API\Program.cs` registers `KnowledgeSearchClient`, `IEmbeddingService`,
  `IAICompletionService` but NOT `IProviderKnowledgeSearch`, `KnowledgeSearchDependencies`, `ICatalogAlarm`
  (only MCP does, with `McpCatalogIsolationAlarm`). The API needs those registrations + an API-side alarm.
- **`shareWithCallers` governs SENDING only** — switched-off documents are still retrieved and spoken by the
  receptionist. The only retrieval-time document filter is the fail-closed `ListRetrievableDocIdsAsync`
  allow-list (status ≠ Deleting), applied AFTER search — the natural hook for the per-document team-search
  audience (extend the allow-list computation with the member's roles; no index change).
- **Web has no markdown renderer** (`react-markdown`/`remark`/`rehype`/`marked`/`@tailwindcss/typography` all
  absent; `dompurify` present; `html-to-react` an unused orphan). **Mobile has none either** (only
  `react-native-render-html` 6.3.4 without a table plugin). Both need a NEW dependency (owner approval): web
  `react-markdown` + `remark-gfm` (React elements, no raw HTML), mobile `react-native-markdown-display`.
- **Web shell facts:** no search input/command palette exists anywhere; the header right cluster is full
  (workspace chip · language (hidden < lg) · bell · share · logout); rail = flat permission-derived array,
  order owner-fixed, compact at ≥10 rows; a new rail row needs `SURFACE_PERMISSIONS {permission, controller,
  method, route}` (verified by an API convention test), `Access.Surface.<x>` ×5, a custom SVG icon +
  `[data-anim]` CSS, `SurfaceGate`, registry tests, header title case, `inferSurfaceFromPath`, AASA/mobile
  deep-link parity. Full-height chat-shaped route precedent = inbox (`FULL_HEIGHT_ROUTES`). Existing SSE client
  = fetch + `getReader` + `TextDecoder` (`aiServices.js:147-200`) with no abort/stall/401/403 handling.
- **Mobile shell facts:** bottom tabs = Dashboard · Bookings · ⊕FAB · Leads · Inbox (no drawer, no Profile
  tab); Profile menu row "AI Knowledge" under "Your business"; dashboard header row = title · language · bell ·
  share · avatar. A new screen = FIVE-file registration (`constant.tsx`, `types.ts`, `linking.ts`, stack route,
  `analyticsTracker.screenMap`) + a visible entrance + web AASA parity. Streaming = XHR `onprogress` + 330 s
  stall guard (single-purpose; needs cancel, short stall, `event:` types, 401/403/429). Mobile DOES have a
  document details editor (`renderDetailsEditor`, type + offering link + "Send relevant details to callers").
  Knowledge route has no `docId` param. `Linking.openURL` is the file-open precedent. RN core `Clipboard` is
  deprecated (a "Copy" action needs `@react-native-clipboard/clipboard` or the deprecated core API).
  Mobile forbids inline ICU plurals (`_one/_other` siblings); es locale authored but unregistered on BOTH apps.
- **Permission model correction:** Knowledge page is `voice.read` (a SETTINGS permission: "View AI voice
  assistant settings and knowledge"); services are `catalog.service.read`. For team search, gating knowledge
  retrieval on `voice.read` would defeat "everyone on my team can find this document". Recommendation for the
  owner: the Search surface is open to EVERY member (like Dashboard, `permission: null`), knowledge + service
  retrieval are open to every member (services are public on the Open Page; documents follow their own
  team-search audience), and business-data tools (phase 2) follow their existing keys. No new permission key
  ⇒ no grant-change playbook.
- **Mockup corrections owed (v1 → v2):** remove the mobile bottom "Search" tab (the tab bar has no free slot
  and adding one is a bigger decision) → header magnifier on the Dashboard screen + a Profile-menu row
  "Search" beside AI Knowledge; keep the web header field as Decision 2 (no precedent, desktop ≥ lg only);
  fill the no-stub map with the real names (`GET knowledge/documents/{docId}/images` exists; view-URL endpoint,
  provider-search endpoint, audience PATCH are NEW).
- **Cost facts:** one read-SAS mint = one storage round trip (`EnsureContainerExistsAsync`), 60-min TTL
  (`InternalSasExpiryMinutes`); a knowledge search = 1 embedding + 2 search requests + 1–3 partition queries,
  zero LLM; `RetrievalMaxTokens` is 3000 (memory said 1500 — stale).

## 2.8 ‼️ A ZERO-EGRESS ANSWER TO THE OWNER'S "cost-friendly alternative" QUESTION (verified 2026-09-02)
The owner asked: *"we're not gonna let them download the document, because then we'll be raising our Azure cost
… rather we'll just give a link … or maybe is there any other alternative cost-friendly approach."*
**There is a better one, and it already exists in the platform.** The AI-cost programme's vision-OCR work (now
landed) writes a **per-page markdown cache**:
- Path `_ocr/{businessId}/{docKey}/{contentHash}/v{promptVersion}/p{NNN}.md`, content type
  `text/markdown; charset=utf-8` (`clinqetcore/Models/Knowledge/KnowledgeBlobPaths.cs:107-119`), written and
  read by `clinqetinfrastructure/Services/AI/VisionDocumentTranscriptionService.cs:84-91,113,158-191`
  (`TryReadCacheAsync`/`TryWriteCacheAsync`, fail-soft both ways), in the document's own container
  (`provider-knowledge` for knowledge; proven by `KnowledgeOcrPageCacheIntegrationTests`).
- Deleted with the document (`KnowledgeDocumentDataPurger.cs:61` purges `OcrPrefix`) and swept on business
  closure; lifecycle rule cools at 50 d / deletes at 180 d.
⇒ **"Show page 4" can render the FULL cited page as text for a few KB** — no PDF download, no big-file egress,
no viewer dependency, and it works identically on web and mobile (it is markdown, which the answer renderer
already draws). The original-file SAS link stays as a secondary explicit action ("Open the original file").
Limits to honour: the cache exists only for documents that went through the Document-Intelligence/vision path
(PDF · JPG/JPEG/PNG/TIFF/BMP/HEIF · WEBP/GIF) — exactly the formats that HAVE real page numbers; DOCX/XLSX/
HTML/TXT/MD/JSON have neither a cache nor a real page, so they show section only. The read MUST use the
registry row's current `contentHash` + the current `TranscribePromptVersion`, and MUST fall back (to the cited
passage text, then to the original-file link) on a miss — a 180-day-old document can have no cache.

## 2.9 Citation breadcrumb + phase-2 authorization — verified primitives (2026-09-02, current HEADs)
- **The breadcrumb is already pre-computed.** `Category.FullPath` (`clinqetcore/Entities/COSMOS/Cosmos.cs:369`,
  comment `// e.g., "Appliance Services > Washing Machine"`) plus `Category.ParentCategoryId` (`:345`) — a
  subcategory IS a category with a parent, exactly as the owner described. Names come from
  `ICategoryCacheService.GetOrSetGlobalCategoriesAsync` (`clinqetcore/Interfaces/Services/
  ICategoryCacheService.cs`), whose cache write correctly sets `Size = 1`
  (`clinqetinfrastructure/Services/CategoryServices/CategoryCacheService.cs:85`) ⇒ the breadcrumb costs one
  cached lookup, no extra Cosmos read per citation.
- ‼️ **Category names are NOT localized** — `Category` has a single `Name`/`Description`/`FullPath` string and
  no translation mechanism exists anywhere (`grep categoryTranslation|LocalizedCategory|NameLocalized` over
  `clinqetcore` + `clinqetinfrastructure` ⇒ NOT FOUND). The breadcrumb will therefore render in the stored
  language whatever the member's UI language is. That is the platform's existing behaviour (the customer app
  shows the same names) — state it to the owner, do not invent a translation layer for this feature.
- **Phase-2 authorization needs no new mechanism.** Template: `ProviderInboxService`
  (`clinqetinfrastructure/Services/Tenancy/ProviderInboxService.cs:20,69,179,187-198`) is a SERVICE that takes
  `TenantContext tenant` as a parameter, derives `WorkListNarrowing` from `tenant.ScopeFor(key)` and re-checks
  every row with the evaluator. `WorkListNarrowing.For(tenant, permissionKey)`
  (`clinqetcore/Services/Tenancy/WorkListNarrowing.cs:43-70`) yields
  `None | AssignedToMembership | AssignedToTeams | MatchesNothing | Unsupported` and `BuildPredicate` emits the
  `ARRAY_CONTAINS` SQL that `CosmosDbRepository` (`Data/COSMOS/Base/CosmosDbRepository.cs:63`) applies to the
  WHERE **and** the COUNT. The narrowing overloads already exist on the exact queries the owner's questions
  need: `BookingRepository.GetPaginatedBookingsAsync(..., narrowing)` (`:192`),
  `GetAssignedCustomerIdsAsync(businessId, narrowing)` (`:486`), `QuoteRepository.GetPaginatedQuotesAsync`
  (`:95`), `InvoiceRepository` paginated (`:79`), summary (`:214`), overdue summary (`:241`) and
  ‼️ **`GetPaidInvoicesInRangeAsync(businessId, start, end, ct, narrowing)` (`:331`) — which literally answers
  "how much money did we receive through invoices last week" at the asker's own scope.**
- ‼️ **A structural pin to respect:** `ProviderKnowledgeSearchServiceTests.RetrievalService_TakesNoCompletionDependency`
  (`clinqetmcp/Clinqet.Mcp.UnitTests/Services/ProviderKnowledgeSearchServiceTests.cs:1048-1051`) reflects over
  the **constructor** and refuses any `*Completion*` dependency — adding a METHOD to `IProviderKnowledgeSearch`
  is fine, adding an LLM dependency to the retrieval service is not (our design keeps the model in the agent
  layer). The interface's own comments carry a written TENANT-ISOLATION and PERFORMANCE contract
  (`clinqetcore/Interfaces/Knowledge/IProviderKnowledgeSearch.cs:5-31`) that any new method must honour; and
  because that pin lives in the MCP test project, the API host needs its **own** equivalent guard once it
  becomes a consumer (§0.18).
- `KnowledgePassage` is a `record` with `required` members and `[JsonIgnore(WhenWritingNull)]` send-handles
  (`clinqetshared/Models/Voice/KnowledgeSearchModels.cs:31-53`) ⇒ the provider surface gets its OWN result
  record; widening the voice wire is not an option.

## 3. Owner decisions / §0.7 items to raise (do NOT build before "yes")
1. **Page numbers on cards**: new index field(s) on `KnowledgeSearchDocument` (`pageStart`/`pageEnd` or `page`) filled
   from `KnowledgeBlock.PageNumber` for paginated sources (PDF/PPTX/images), null otherwise ⇒ §0.7 table + reindex
   (pre-prod: Reprocess per document or re-upload). Cost: one small int per card, not searchable.
2. **`searchAudience` (+ role keys) on `KnowledgeDocument`** (Cosmos, §0.7).
3. **Search session storage** (if a new Cosmos document family is needed vs reusing the chat-session store).
4. Placement + label (Search vs Ask), and whether the header search bar ships on every dashboard page.
5. Model default (mini now, luna after A/B) — or luna-first at effort `none` accepting the RAI-filter gap.
6. Phase split: Phase 1 knowledge+services search · Phase 2 business questions with permissions · Phase 3 per-
   document audience — or fold 3 into 1.
