# PHASE 1 — Business Search backend foundation (copy-paste kickoff prompt)

You are implementing **Phase 1 of 5** of the Business Search programme for the Clinqet platform. Planning is
COMPLETE and OWNER-APPROVED. Do not re-plan, do not re-open settled decisions, do not build a mockup — build P1.

> ‼️ **PRECEDENCE:** `AUTHORIZATION-DESIGN.md` §6b (C1–C6) and `PLAN.md` §15c (S1–S11) override every other
> sentence in every document, **including this one**. Where this file and a correction disagree, the correction
> wins. Owner decisions locked 2026-09-02: knowledge search is **open to every member**, and the per-document
> `searchAudience` field + its enforcement **move into P1** (its UI stays in the later phase) so the restriction
> mechanism exists from the first line of code.

## 0. READ THESE FIRST, IN THIS ORDER, IN FULL
1. `C:\Nik\Data\provider-ai-search\PLAN.md` — **v3, the authority**. §2 architecture, §3 model, §4 coverage
   map, §5 pipeline, §9b limits + UI copy, §10 guardrails, §14 phases, §15 locked decisions, §15b schema impact.
2. `C:\Nik\Data\provider-ai-search\AUTHORIZATION-DESIGN.md` — **the contract for every tool**. The golden rule,
   the threat model, the rejected alternatives, every edge case (especially the SOLO provider), the tests owed.
3. `C:\Nik\Data\provider-ai-search\01-SESSION-STATE.md` — handover state (§0b: the codebase is clean and fully
   available; the page-cache key is settled).
4. `C:\Nik\CLAUDE.md` — **in full**. §0 is zero-tolerance and overrides everything.
5. As needed, the evidence files: `findings/A-knowledge-backend.md` (retrieval, isolation, images, page cache),
   `findings/B-mcp-server.md` (why not the MCP; what the chat gateway is), `findings/C-ai-assistant-models-streaming.md`
   (SSE, dials, sub-flows, what `/ai/chat` is made of), `findings/D-teams-authorization.md` (permissions,
   scopes, narrowing), `findings/G-storage-localization-search-deploy.md` (SAS, localization, deploy),
   `findings/H-drift-and-naming.md` (re-verified claims + the naming rules), `findings/J` + `findings/K`
   (the live model measurements).

## 1. ABSOLUTE RULES (owner-mandated — breaking one fails the phase)
- **Approval gate**: the SOLUTION is approved; if you discover something that changes the DESIGN, stop and ask
  the owner before coding it. Everything already in PLAN v3 you may build without asking.
- **§0.7 schema gate**: the ONLY approved schema change is `KnowledgeDocument.searchAudience` +
  `searchAudienceRoleKeys` — and that is **Phase 4**, not P1. Any other new field/column/index/search-field
  needs the §0.7 table and an explicit owner yes, in the conversation, first.
- **Never** `git checkout/restore/reset/stash/clean` anywhere under `C:\Nik`. Other AI sessions hold
  uncommitted work in these trees. Never commit, never push — the owner does that.
- **No feature flags, no shadow modes, no backward-compat branches.** Pre-prod: every change goes live.
- **No stubs.** A control that exists must work by the end of the phase.
- **No hardcoded user-facing text** — every string is a key in all 5 API files (and later all 5 web + 5 mobile).
- **No hardcoded numbers** — every limit is an appsettings dial with a mirrored class default (§9b).
- **Comments**: default none; one short line only for a non-obvious WHY.
- **Tests live with the runtime consumer (§0.18)** — this phase's code runs in `Clinqet.API`, so its tests go in
  `Clinqet.API.UnitTests` / `Clinqet.API.IntegrationTests`, never in the MCP or Functions suites.
- **RED first, then green, then sabotage.** A guard that has never failed is not evidence.
- **Leave the tree clean** (§0.16): scratch files only in the session scratchpad, never inside a repo; say what
  you removed.
- **Do not touch `clinqetmcp` behaviour for the voice path**, and do not add an MCP tool. The phone receptionist
  must be provably unaffected.

## 2. WHAT IS ALREADY TRUE (do not rediscover, do not re-litigate)
- **Name**: `BusinessSearch`, route `api/v{version:apiVersion}/business/search`, folder
  `clinqetinfrastructure/Services/BusinessSearch/`, contracts `clinqetcore/Interfaces/BusinessSearch/`,
  settings section `BusinessSearch`, sub-flow `AiSubFlows.BusinessSearchAnswer = "I1-business-search-answer"`.
  ‼️ `ProviderSearch*` is the CUSTOMER-side "search for providers" family (218 references) — never use it.
- **Model**: `gpt-5.6-luna` with `reasoning_effort: "none"` — **mandatory**, not tuning: luna + tools with any
  higher effort returns HTTP 400. Measured: 15/15 tool-planning, $0.00025/answer, 899 ms first token.
  Deployment is a dial (`BusinessSearch:Answer:DeploymentName`).
- **Architecture**: the agent runs IN `Clinqet.API` (the only host with `TenantContext`), calling the SAME
  infrastructure services the MCP tools wrap. The MCP is not involved.
- ‼️ **Two more DI gaps the sweep found (M8d)**: `ProviderCatalogSearchService` and `FullProviderContextService`
  both require `IOptions<VoiceCatalogSettings>`, which `Clinqet.API/Program.cs` never binds — add a
  `Voice:Catalog` appsettings block + `Configure<VoiceCatalogSettings>`. And `CatalogSearchDependencies` needs a
  **service-index** `SearchClient`; the API registers only a `KnowledgeSearchClient`. Without both,
  `search_services` and `get_business_profile` cannot be constructed at all.
- **API host DI gaps you must fill**: `IProviderKnowledgeSearch`, `KnowledgeSearchDependencies`,
  `IProviderCatalogSearch`, `CatalogSearchDependencies`, `ICatalogAlarm` (write an API-side implementation
  mirroring `FunctionsCatalogIsolationAlarm`), `IFullProviderContextService` are **not** registered in
  `clinqetapi/Clinqet.API/Program.cs` today. `KnowledgeSearchClient`, `IEmbeddingService`,
  `IAICompletionService`, `VoiceKnowledgeSettings`, `IKnowledgeDocumentRepository` **are**.
- **Page numbers are free**: the knowledge index already stores `pageNumber`; it is simply not in the `select`
  list today. Real only for PDF/photo/TIFF/PPTX; a placeholder `1` for DOCX/XLSX/HTML/TXT — branch on the file
  extension before showing a page.
- **"Show page N" cache key** (`KnowledgeBlobPaths.OcrPageBlob`) includes a **deployment-name segment**:
  `_ocr/{businessId}/{documentKey}/{contentHash}/{deploymentName}/v{promptVersion}/p{NNN}.md`. Build it ONLY
  through `KnowledgeBlobPaths`, never by hand. The API must bind
  `Voice:Knowledge:Vision:{TranscribeDeploymentName,TranscribePromptVersion}`, which means extending
  `VoiceKnowledgeSettingsConventionTests.ReadByThisHost` (a build-failing guard).
- **`MaterialExcerptBuilder`** (`clinqetinfrastructure/Services/Knowledge/`) is pure and reusable: it
  re-tabulates `label: value | …` rows, lays out Q/A cards, drops the chunker's sentence overlap and rejoins
  split rows. Use it so the passage a provider reads matches the PDF a caller receives.
- **REFUTED — do not act on these**: "luna cannot tool-call" (false — measured); "the Functions host composes
  the knowledge search" (it composes only the catalog half); "no endpoint returns a document" is about **read**
  SAS (an upload-SAS path exists); a blanket `Size = 1` on every cache write (the rule is "every write sets a
  Size"; `FullProviderContextService` sizes by content).
- **Measured traps**: the Bash tool cannot parse a heredoc containing an apostrophe (author files with Write);
  Glob times out on `C:\Nik` (use `ls`/`grep --include`/`sed -n` with explicit paths, excluding bin/obj/
  node_modules); `--no-build` test runs can report green on stale binaries; working trees are mixed LF/CRLF.
- **The codebase is fully available.** The vision/OCR work that was in flight earlier is finished and
  committed; all eleven repos are clean. Any uncommitted change you see is yours.
- **Settled fact** you must honour: the page-cache key is
  `KnowledgeBlobPaths.OcrPageBlob(businessId, documentKey, contentHash, deploymentName, promptVersion, page)`
  → `_ocr/{businessId}/{documentKey}/{contentHash}/{deploymentName}/v{promptVersion}/p{NNN}.md`. Build it only
  through that helper, and keep the fallback chain (a document over the page ceiling has no cached page).

## 3. PHASE 1 SCOPE — backend only, no UI

### 3.1 Delete the dormant in-app chat assistant (PLAN §2.3)
Surgical, test-first. **Delete**: `POST /ai/chat` (`ProcessChatInput`) and the three `ai/sessions` endpoints ·
`IMcpAIService`/`McpAIService` · `IMcpToolGateway`/`McpToolGateway` · `Mcp:ChatToolAllowlist` +
`ChatToolSessions` + the chat branch in the MCP's `McpToolGuard` + both repos' `ChatToolAllowlistConventionTests`
· the `AIAssistant:Mcp:*` chat-only settings.
**Keep, untouched and still working**: `POST ai/speech-to-text`, `POST ai/enhance-text`, the whole
`provider-setup` pipeline (all three also carry `ai.assistant.use`, so that permission does NOT become
orphaned — verify against `OrphanPermissionRegistryTests`).
**Keep and reuse**: `IMcpSessionService` + `AiSession` as the Business Search session store.
This closes a real gap: any `ai.assistant.use` holder previously got whole-business Partner scope on the MCP.

### 3.2 The endpoint + agent
`BusinessSearchController` (`Controllers/BusinessSearch/`), `[Authorize]` + tenant context required:
- `POST ask` → SSE. Body `{ question, sessionId?, language? }`.
- `GET documents/{docId}/pages/{page}` → the cached page markdown (§5.5 level 2).
- `GET documents/{docId}/view-url` → short read-SAS. ‼️ **Inline disposition ONLY for `application/pdf` and
  images; every other type (html, htm, svg, unrecognised) MUST be `Content-Disposition: attachment` (S1)** —
  `.html` is an allowed knowledge upload and the blob's Content-Type comes from the client's PUT, so an inline
  SAS would execute attacker HTML on the storage origin. Pinned by a per-extension test.
- `GET sessions/{sessionId}` → replay, **member-scoped** (see §3.4).
SSE wire shape: `data: {json}` with an in-JSON `eventType` (`meta`/`status`/`delta`/`citation`/`image`/`done`/
`error`) — there is no `event:` line anywhere in this platform. `: ping` every 15 s while a tool runs.
Cancellation via `HttpContext.RequestAborted`; bounded channel + linked CTS.

### 3.3 Group A tools (PLAN §4.1) — read-only, each on `BusinessSearchToolBase`
`search_knowledge` (knowledge documents **and** typed FAQs — same index, `chunkKind = FaqPair`) ·
`search_services` · `list_offers` · `get_business_profile` · `get_availability`.
Add a NEW method + result record to `IProviderKnowledgeSearch` for the provider surface carrying `docId`,
`chunkNo`, `pageNumber`, `sectionTitle`, `chunkKind`, `imageRef` — **do not widen `KnowledgePassage`** (it is the
pinned voice wire) and **do not add any `*Completion*` dependency to the retrieval service**
(`RetrievalService_TakesNoCompletionDependency` reflects over its constructor).

### 3.4 Authorization + isolation (AUTHORIZATION-DESIGN.md is the contract — READ §6b FIRST)
‼️ `AUTHORIZATION-DESIGN.md` **§6b carries six corrections that OVERRIDE the earlier sections**, and `PLAN.md`
§15c carries eleven more beyond authorization. They are not optional polish — each one closes a hole the
adversarial audit found in the first draft. The six that change code you are about to write:
**C1** every endpoint carries `[RequiresPermission("business.profile.read", PermissionScope.Business)]` (all ten
roles hold it; this keeps the businessId-mismatch, BillingOnly and live-recheck guards) ·
**C2** the `CitationRegistry` is NOT an auth gate — `pages/{page}` and `view-url` are separate HTTP requests and
authorize themselves via business scope + the audience rule ·
**C3** ‼️ pictures must NOT reuse the caller-sendability allow-list (that is the "send to a phone caller" gate;
reusing it would let the receptionist switch control what the provider's own team sees) ·
**C4** "my" is an intent filter on top of scope, and only ever narrows ·
**C5** the profile tool returns a projection with no licence numbers ·
**C6** a failed/timed-out search must surface as "temporarily unavailable", never as "nothing found".
Plus from PLAN §15c: **S1** inline-disposition SAS only for PDF and images (html ⇒ attachment — stored-XSS
risk), **S2** add the SAS overload that takes a disposition, **S3** `MaterialExcerptBuilder`'s useful members
are private/internal — use `Build(...)` or widen deliberately, **S5** the rate-limit config switch needs a code
change, **S11** the session write must be ETag/CAS-guarded.

`BusinessSearchAuthorizationContext` computed once per turn · tool list filtered per member · every tool
re-checks · parameters can never widen scope · **solo providers**: no predicate, no team tools, no `memberName`
in any schema · sessions stamped with `MembershipId` and required on read · citation/page/view endpoints re-run
every check · everything fails closed · a convention test asserting every tool inherits the base and declares
its permission.

### 3.5 Citations + rendering support
`CitationRegistry` per answer: `[n]` resolves only to ids returned by THIS request's tools. Document cards
(title, section, page only for paginated sources), service cards (breadcrumb from `Category.FullPath` +
`ICategoryCacheService`), offer cards. ‼️ **Images: a picture is included when ITS DOCUMENT is visible to that
member. Do NOT call `ListSendableImageRefsAsync` (C3)** — that is the caller-send gate, and reusing it would let
the receptionist's `sendable`/`shareWithCallers` switches decide what the provider's own team can see. Bounded
SAS mints, `MaxImagesPerAnswer` 4.

### 3.6 Config, dials, alerts, localization
`BusinessSearch:*` (§9b) with class defaults mirrored · `AIAssistant:RateLimiting:BusinessSearch` ·
`AiSubFlows.BusinessSearchAnswer` + its entry in `AiBudgetCutoffAlerts.BudgetDialBySubFlow` + the pin in
`AiModelPinConventionTests` · the API's `Voice:Knowledge` block gains the retrieval + `Vision` keys with
`VoiceKnowledgeSettingsConventionTests` updated · `deploy.ps1` gains
`BusinessSearch__Answer__DeploymentName` · every API-side message key in all five
`clinqetinfrastructure/Resources/Localization/*.json` (§9b copy table).

### 3.7 Tests (API suite)
Unit: role × tool matrix, parameter-widening, solo-provider shape, empty-queue copy, citation registry drops
unknown handles, page-display rule per extension, SSE frame shapes, no-result-no-number, the convention test.
Integration (Testcontainers, real engines): cross-business probes (foreign docId/imageRef/page/citation ⇒
nothing), a foreign row injected into a search response ⇒ whole set discarded + alarm, member A cannot replay
member B's session, rate-limit 429, `BillingOnly` 403, a full SSE round trip against a fake model server.
Sabotage each guard once.

## 4. DEFINITION OF DONE — all four, or the phase is not done
1. Everything in §3 built, all affected projects **building**, all affected tests **green** (real rebuilds — a
   `--no-build` pass is not evidence).
2. ‼️ **The multi-dimensional audit has run** and every finding is fixed or refuted with evidence, written to
   `C:\Nik\Data\provider-ai-search\findings\AUDIT-P1-<date>.md`. Dimensions, every one: correctness &
   contracts · tenant isolation and authorization · data safety & idempotency · cost & performance ·
   memory/resource leaks & thread safety · config hygiene · localization · tests (placement, fail-first,
   sabotage) · deployment · **did we miss anything the owner asked for**. Use independent agents per dimension
   and then skeptics who try to REFUTE each finding.
3. `C:\Nik\Data\provider-ai-search\PHASE-2-PROMPT.md` written for the next session (P2 = web **and** mobile UI
   together) — and **the same text pasted into the chat reply**, because a file path alone is not delivery.
4. The tree is clean of scratch files, `git status` reviewed, nothing committed or pushed, and the summary says
   plainly what was built, what was audited, what was fixed, and what remains.
