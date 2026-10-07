# Finding C — In-app AI assistant machinery, AI completion services, streaming, model inventory

> **COMPLETE.** Written 2026-09-02, then closed against the CURRENT trees (`clinqetshared` e5bec24,
> `clinqetcore` fd04b1a, `clinqetinfrastructure` 6341780, `clinqetapi` 6a61450, `clinqetmcp` 8406310,
> `clinqetfuncations` 43ec2c0, `clinqetwebpartnerapp` 99ff26ba, `clinqetmobilepartnerapp` bd630f0e).
> Every claim carries `path:line`, re-verified at these HEADs. "NOT FOUND" means the grep/read/find
> returned nothing — never inferred.
> READ-ONLY session: no repo file was created, edited or deleted; this is the only file written.

Repos read: `clinqetapi`, `clinqetinfrastructure`, `clinqetcore`, `clinqetshared`, `clinqetfuncations`
(Functions host `Clinqet.Communications`), `clinqetmcp` (`Clinqet.Mcp`), `azureautomation`, plus the
provider web (`clinqetwebpartnerapp`) and provider mobile (`clinqetmobilepartnerapp`) clients, the
skill file `C:\Nik\.claude\skills\clinqet-ai-assistant\SKILL.md`, and the memory files named in the brief.

**Line numbers that DRIFTED since the first pass** (recorded so a reader of the earlier draft is not
misled): API `Program.cs` DI block moved ~+5 lines (`IMcpToolGateway` 821→826, `IAiRateLimitingService`
841→846); the India-toolless comment 812-813→817-818; `TenancyRoleCatalogDefinition` AI permission keys
151→155-156 and its grants 210/223/237/264→214/227/241/268 (`CatalogVersion` is now **4**);
`AIAssistant:RateLimiting` block ends at 2220 not 2221; `AIEndpointRateLimitSettings` spans 194-202.
Everything else re-verified unchanged.

---

## 0. Executive summary

1. **One text-chat assistant exists**: `POST /api/v1/ai/chat` (`clinqetapi\Clinqet.API\Controllers\AI\AIAssistantController.cs:423-619`) → `McpService.ProcessTextInputAsync` (`clinqetinfrastructure\Services\AI\McpService.cs:127-183`) → `McpAIService.StreamAIResponseAsync` (`clinqetinfrastructure\Services\AI\McpAIService.cs:62-109`). It streams SSE token-by-token and does tool calling through the **Chat Completions API via the `Azure.AI.OpenAI` 2.1.0 SDK `ChatClient`** (`McpAIService.cs:1,11,55-59,187`). **No Responses API usage exists anywhere** (grep `/responses`, `ResponsesClient`, `OpenAIResponseClient` → NOT FOUND in all four .NET repos).
2. **Tools are MCP tools** fetched from the voice MCP server (`Clinqet.Mcp`) through `McpToolGateway` (`clinqetapi\Clinqet.API\Services\McpToolGateway.cs:48-133`), filtered by `Mcp:ChatToolAllowlist` (16 names, `clinqetapi\Clinqet.API\appsettings.json:2047-2064`), declared to the model with `ChatTool.CreateFunctionTool(name, description, BinaryData.FromString(inputSchemaJson))` (`McpAIService.cs:466-479`). Agentic loop: `while (iteration < maxIterations)` (`McpAIService.cs:142`), default 5 (`appsettings.json:2110`), parallel execution of tools whose MCP `IdempotentHint` is true (`McpToolGateway.cs:122`, `McpAIService.cs:535-599`).
3. **Streaming exists ONLY in `McpAIService`** (`CompleteChatStreamingAsync`, `McpAIService.cs:187`). The shared seam `AICompletionService` is **non-streaming** (single POST, whole body read: `clinqetinfrastructure\Services\AI\AICompletionService.cs:423,457`; request body has no `stream` field: `:44-63`) and **takes no tools** (body fields are messages / max_completion_tokens / temperature / reasoning_effort / response_format only, `:44-63`). `TextEnhancementService` is also raw-HTTP, non-streaming, toolless (`clinqetinfrastructure\Services\AI\TextEnhancementService.cs:143-164`).
4. **SSE contract**: `data: {camelCase AiResponseDto}\n\n`, flushed per event (`AIAssistantController.cs:1267-1273`), headers `text/event-stream` / `no-cache` / `keep-alive` + `DisableBuffering()` (`:1256-1265`). No `event:` names, no `id:`, no heartbeat (NOT FOUND in the controller — read end to end, 1293 lines). Event order for chat: `UserInput` → `Analyzer` → `Content`* → (`ToolExecution` → `ToolResult`)* → `TokenUsage` → `FinalContent`, or `Error` (`McpService.cs:151-157`; `McpAIService.cs:146-153,196-201,220-230,266-284,298-305,312-318,328-334`).
5. **Neither provider client calls `/ai/chat` today** (grep `ai/chat` in `clinqetwebpartnerapp\src` → only `url.js` entries for `enhance-text` + `provider-setup/process` at `:252,254`; mobile `constant.tsx:131-136` explicitly notes the removed `ai/chat/attachment` and declares no chat URL). The SSE readers that DO exist are for provider-setup: web `fetch` + `ReadableStream.getReader()` (`clinqetwebpartnerapp\src\services\aiServices.js:147-200`), RN `XMLHttpRequest` progressive `responseText` + 330 s stall guard + 401 refresh-once (`clinqetmobilepartnerapp\src\services\aiServices.ts:352-508`). `EventSource` is used by neither (skill claim at `SKILL.md:475,562` is stale).
6. **Model inventory** (`azureautomation\deploy.ps1:2652-2661`): `gpt-5.4-mini` (2026-03-17), `gpt-5.6-luna` (2026-07-09), `text-embedding-3-large` (v1), `gpt-realtime-mini` (2025-12-15), `gpt-realtime-2` (2026-05-07, `:533`), `gpt-4o-mini-transcribe` (2025-12-15). All chat/embedding on the shared East US 2 Foundry account (`:839-849`). **The only deployment used WITH tool calling today is `AIService:DeploymentName` = `gpt-5.4-mini`** (`appsettings.json:2020`), consumed by `McpAIService` (`:59,179-180`). Every other chat sub-flow is toolless and most are pinned to `gpt-5.6-luna` (table in §4).
7. **luna in the repo**: `AiModels.Luna = "gpt-5.6-luna"` (`clinqetshared\Constants\AiModels.cs:13`). The repo's only statement about tool calling is a code comment: *"Locked for A3 (assistant chat): gpt-5.6 cannot do tool calls on Chat Completions, and A3 has no per-flow deployment key"* (`AiModels.cs:9-10`), repeated as prose in the convention test's XML doc and method comment (`AiModelPinConventionTests.cs:15-18,53-54`). **CLOSED: the test file cites NO measurement for that sentence** — see §5.3, where the contrast is now demonstrable (two OTHER pins in the SAME file DO cite their measurements). What IS proven live: luna rejects any non-default `temperature` with HTTP 400 (`AICompletionService.cs:396-397`, `AICompletionServiceTests.cs:663-671`, memory `ai-cost-quality-session4-2026-09-02.md:12`); luna failed 8/8 on locally generated image inputs mini handled (memory `ai-cost-quality-phase7-8-2026-08-31.md:24-29`); luna's content filter is assigned but not enforced on the data plane (same file `:30-36`). **`McpAIService` sends `Temperature = 0.7` unconditionally (`McpAIService.cs:175`) and never sets `reasoning_effort`** (`:173-177`), so pointing it at luna as-is would 400 on temperature before any tool-calling question arises.
8. **Model recommendation shortlist (facts only)**: (a) **`gpt-5.4-mini`** — the only deployment the repo has ever driven with tools + streaming (A3); pricing $0.75/$0.075/$4.50 per 1M (`appsettings.json:2031`); RAI filter enforced (memory phase7-8 `:30-33`). (b) **`gpt-5.6-luna`** — 3.75× cheaper on input and output (`:2032`), deployed on the same account (`deploy.ps1:2654`), but (i) the repo asserts (unmeasured) that it cannot tool-call on Chat Completions, (ii) it needs the temperature omitted (`AICompletionService.cs:517-518`), (iii) its content filter is not enforced, (iv) it 500s on some image inputs. The coordinator notes public Azure docs say luna supports function calling on Chat Completions only with `reasoning_effort: none`, otherwise via the Responses API — **the repo neither confirms nor refutes this; a dev probe with `reasoning_effort=none` + tools on `gpt-5.6-luna` is the cheapest way to settle it.** (c) `gpt-5.4` / `gpt-4.1` have pricing rows (`:2033-2034`) but were removed from `$modelDeployments` (`deploy.ps1:2612-2616`) — not deployable via the repo. (d) Realtime/transcribe deployments are voice-only (`deploy.ps1:2624-2635`) — out of scope per the brief.
9. **Sessions**: `AiSession` documents live in the **`Communications` container** (`clinqetinfrastructure\Data\COSMOS\AiSessionRepository.cs:27`), partition key value = businessId (`new PartitionKey(session.UserNumber)`, `:41,76,97,117,131,159,188`) — **the skill's "SystemData / pk `/pk`" statement (`SKILL.md:127,170,443`) is wrong**. In-memory cache `ai_session_{businessId}_{sessionId}` with `Size = 1` (`McpSessionService.cs:195-207`).
10. **Business scoping**: `GetCurrentBusinessId() => Tenant?.BusinessId` (`clinqetapi\Clinqet.API\Controllers\Base\BaseController.cs:232`); every AI endpoint carries `[RequiresPermission("ai.assistant.use" | "ai.document_intelligence.use", PermissionScope.Business)]` (`AIAssistantController.cs:232,322,431,626,758,1162,1192,1228`); chat/sessions/setup additionally require `UserType.Partner` (`:1247-1254`). The MCP token is minted bound to that businessId (`McpToolGateway.cs:57,74-82`) and **no MCP tool takes a `businessId` argument from the model** (grep of `clinqetmcp\Clinqet.Mcp\Tools\*.cs` for a `[Description]` parameter named businessId → NOT FOUND; guard reads `context.BusinessId`, `Tools\McpToolGuard.cs:55-58`). Full resolution chain, both sides, in §8.
11. **Cost/quality plumbing a new flow must join**: `AiSubFlows` id (`clinqetshared\Constants\AiSubFlows.cs:9-36`, **28** constants = 27 flows + `Unattributed`), the one KQL-summable usage line (`AICompletionService.cs:551-559`, `McpAIService.cs:355-365`, `TextEnhancementService.cs:206-219`), `IAiBudgetCutoffAlerts.ReportCentralCutoffAsync` on `finish_reason == length` (`McpAIService.cs:236-242`), `AiRateLimitingService` per-endpoint request+token buckets (`AIAssistantController.cs:452-458`, `McpAIService.cs:234`), the daily abuse cap `ai_text_daily_limit` (`AIAssistantController.cs:173-198`), `AiModelPinConventionTests` pins per-flow deployment keys (`:62-83`). Details §6; the ordered build list is §11.
12. **Skill file is stale in several places** (§1): `McpToolDiscoveryService`/`McpToolExecutionService`/`[MlcTool]` do not exist (grep across `clinqetapi`, `clinqetinfrastructure`, `clinqetcore`, `clinqetshared` → NOT FOUND); `EventSource` not used; sessions not in SystemData; `AzureDocumentIntelligence:AiDeploymentName` is luna not mini (`appsettings.json:2234`); all seven named test files absent (§7). The **"89 permission keys"** figure quoted in `CLAUDE.md` and the teams skill is also stale — the catalogue declares **94** (`TenancyRoleCatalogDefinition.cs:49-178`, count taken 2026-09-02).

---

## 1. Skill file vs code — what the skill gets right and wrong

Read fully: `C:\Nik\.claude\skills\clinqet-ai-assistant\SKILL.md` (651 lines).

| Skill claim | Location | Code reality | Evidence |
|---|---|---|---|
| Tools discovered by reflection over `[MlcTool]` via `McpToolDiscoveryService` / `McpToolExecutionService` | `SKILL.md:29,201-224` | **Classes do not exist.** Directory `clinqetinfrastructure\Services\AI\` has no such files; grep for `McpToolDiscoveryService|McpToolExecutionService|MlcToolAttribute|\[MlcTool` over `clinqetapi`, `clinqetinfrastructure`, `clinqetcore`, `clinqetshared` → NOT FOUND | dir listing; grep |
| Sessions in `SystemData`, pk `/pk` | `SKILL.md:127,170,443` | Container is `CosmosDb:ContainerNames:Communications` (fallback literal `"Communications"`); partition key value is `UserNumber` (= businessId). `AiSession` has no `pk` property | `AiSessionRepository.cs:27-28,41,76,97`; `clinqetcore\Entities\COSMOS\AiSession.cs:7-45` |
| Frontend consumes via `EventSource` | `SKILL.md:475,562` | Web uses `fetch` + `getReader()`; RN uses `XMLHttpRequest`; no `EventSource` anywhere in either `src` tree | `aiServices.js:147-200`; `aiServices.ts:370-461`; grep |
| `AIServiceSettings.DeploymentName = "gpt-5.4-mini"`, `ApiVersion = "2025-01-01-preview"`, `MaxCompletionTokens = 5000` | `SKILL.md:395-408` | appsettings match (`appsettings.json:2020-2022`), but **class defaults are `ApiVersion = "2024-12-01-preview"`, `MaxCompletionTokens = 1000`, `DeploymentName` null** | `clinqetshared\Models\AIServiceSettings.cs:10-12` |
| `AzureDocumentIntelligenceSettings.AiDeploymentName = "gpt-5.4-mini"` | `SKILL.md:427` | `gpt-5.6-luna` (appsettings) and class default `AiModels.Luna` | `appsettings.json:2234`; `clinqetshared\Models\AIAssistantSettings.cs:231` |
| Rate limits "10 requests/min for all three" | `SKILL.md:240` | Correct for the three named endpoints (`appsettings.json:2202-2220`), but speech-to-text is 20/min via the explicit-config overload | `appsettings.json:2117` |
| `Tools: { UseEmbeddingForToolSelection, MaxToolsPerRequest, CacheToolSchemas, SchemaCacheMinutes, CacheToolEmbeddings, EmbeddingCacheMinutes }` | `SKILL.md:372-380` | `ToolSettings` has **one** property: `MaxToolIterations = 5` (`clinqetshared\Models\AIAssistantSettings.cs:180-183`); appsettings likewise (`appsettings.json:2109-2111`). The other six keys do not exist | grep of `AIAssistantSettings.cs` for those names → NOT FOUND |
| `Mcp.MaxTokens = 10000` class default | `SKILL.md:361` | class default is `2000`; appsettings `10000` | `AIAssistantSettings.cs:44`; `appsettings.json:2097` |
| Test names `McpAIServiceTests`, `McpToolDiscoveryServiceTests`, `McpToolExecutionServiceTests`, `AiRateLimitingServiceTests`, `SpeechServiceTests`, `TextEnhancementServiceTests`, `AiEnrichmentFailureTrackerTests` | `SKILL.md:596-610` | **All seven NOT FOUND** — confirmed twice (§7): `find -name "<Name>.cs"` over `clinqetapi`, `clinqetfuncations`, `clinqetmcp`, `clinqetidentity` (bin/obj pruned) returned nothing, and `grep -rEn "class (…)\b"` over the same four repos returned zero hits. Existing equivalents: `McpAIStreamingTests`, `TextEnhancementRoutingTests` | find + grep 2026-09-02 |
| "POST /chat → SSE end-to-end with mocked AI provider" integration test | `SKILL.md:613` | NOT FOUND — the integration class has authorization checks only (§7) | `AIAssistantControllerIntegrationTests.cs:42-110` |
| Chat→MCP gateway, DR-10 allowlist, `chat-` call-id prefix, catalog cache 5 min | `SKILL.md:27-30` | **Correct** | `McpToolGateway.cs:57,98-133`; `clinqetshared\Constants\ChatToolSessions.cs:8`; `appsettings.json:2045-2064` |
| SSE headers + `DisableBuffering` | `SKILL.md:146-152` | **Correct** | `AIAssistantController.cs:1256-1273` |

---

## 2. Streaming (SSE) — server contract and the two clients

### 2.1 Server write path (`clinqetapi\Clinqet.API\Controllers\AI\AIAssistantController.cs`)

- Headers set once, only if `!Response.HasStarted`: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `IHttpResponseBodyFeature.DisableBuffering()` (`:1256-1265`).
- Frame: `await Response.WriteAsync($"data: {json}\n\n"); await Response.Body.FlushAsync();` — **one flush per event, no batching** (`:1267-1273`). JSON via `JsonSerializer.Serialize(response, SseJsonOptions)` with `PropertyNamingPolicy = CamelCase` and nothing else (`:36-39`) ⇒ **null properties are emitted** (no `DefaultIgnoreCondition`), every frame carries all `AiResponseDto` fields.
- **No `event:` line, no `id:` line, no `retry:` line, no comment/heartbeat frames, no timer** — the only writers are `WriteSSEEvent` (`:1267`) and `WriteErrorResponse` (`:1275-1291`, which calls `WriteSSEEvent`). Controller read end to end (1293 lines).
- Chat action returns `new EmptyResult()` after the stream (`:539`).
- Payload type `AiResponseDto` (`clinqetshared\DTOs\AI\AIAssistantDtos.cs:99-111`): `eventType` (string enum, `AiEventType` `:120-132` = `Analyzer, Content, FinalContent, TokenUsage, Context, Error, UserInput, ToolExecution, ToolResult`), `message`, `errorCode` (`ErrorCode?`), `errorDetails`, `context` (`AiConversationContext` `:134-144`), `tokenUsage` (`:113-118`), `toolInfo` (`AiToolInfo { Name }` `:178-181`), `extractedServices`, `metadata` (`Dictionary<string, object>`), `timestamp`.

### 2.2 Chat event sequence (what a client sees)

| # | eventType | Producer | Payload notes |
|---|---|---|---|
| 1 | `UserInput` | `McpService.cs:151-157` | `message` = the user's text, `context` = full session context |
| 2 | `Analyzer` | `McpAIService.cs:146-153` | localized `SSE_AnalyzingRequest` on iteration 1, `SSE_ProcessingToolResults` on later iterations (`en.json:2206-2207`) |
| 3..n | `Content` | `McpAIService.cs:191-203` | `message` = one SDK `ContentUpdate` text part (token granularity is whatever Azure streams) |
| — | `ToolExecution` | `McpAIService.cs:266-272` (sequential) / `:560-569` (parallel batch) | `message = "Executing: {name}"` (hardcoded English), `toolInfo.name` |
| — | `ToolResult` | `McpAIService.cs:278-284` / `:585-596` | `message` = error text or `"Tool executed successfully"` / `"{name}: completed"` (hardcoded English) |
| — | `TokenUsage` | `McpAIService.cs:220-230` | per model turn, when the SDK surfaces `update.Usage` (`:213`) |
| last | `FinalContent` | `McpAIService.cs:298-305` | `message` = full concatenated answer, `context` = session, `tokenUsage.totalTokens` = sum across iterations |
| alt | `Error` | `McpAIService.cs:78-85` (session limit, `AI_RATE_LIMITED`), `:312-318` (`SSE_MaxIterationsReached`, `PROCESSING_ERROR`), `:328-334` (`SSE_ErrorOccurred`, `AI_ERROR`); `McpService.cs:223` (`SPEECH_CONVERSION_FAILED`) | |

Tool calls are surfaced mid-stream **by name only** — arguments and results are never sent to the client (`AiToolInfo` has a single `Name` property, `AIAssistantDtos.cs:178-181`); the tool result text goes back to the model only (`McpAIService.cs:634-649`).

### 2.3 Cancellation, timeouts, errors

- Chat: the MVC `CancellationToken` (request-aborted) flows into `ProcessTextInputAsync` / `ProcessVoiceInputAsync` (`:519,533`) and into the SDK stream (`McpAIService.cs:187`). The producer runs on a linked CTS that is cancelled in `finally` when the consumer stops enumerating, and the producer task is awaited with `SuppressThrowing` so an abandoned request cannot leak the task or the MCP session (`McpAIService.cs:93-108`). Token buffering is a **bounded `Channel<AiResponseDto>(100)` with `FullMode = Wait`** (`:88-91`).
- Provider-setup stream: linked CTS over `cancellationToken` + `HttpContext.RequestAborted` with `CancelAfter(ProcessingTimeoutSeconds)` (`:869-879`; 600 s in `appsettings.json:2125`, 3600 s for catalog manifests `:2190`).
- Before the response starts, failures are normal JSON `ApiResponse` results (400/403/404/408/429/500, `:434-461,541-618`). After `Response.HasStarted`, the same failures are written as SSE `Error` events and the action still returns `EmptyResult` (`:545-556,561-572,576-595,601-617`). `Retry-After` header on 429 (`:455`).
- `OperationCanceledException` → 408 `SSE_ProcessingTimedOut` if not started, else SSE `Error` (`:573-596`).

### 2.4 Web client (`clinqetwebpartnerapp\src\services\aiServices.js`, 200 lines, read fully)

- `StreamProviderSetupDocument(payload, { onEvent })` (`:147-200`): `fetch(url.AIProviderSetupProcess, { method: "POST", headers: getAuthHeaders(), body: JSON })` (`:148-152`); non-2xx → throws an `Error` with `.response = { status, data }` so the modal can show the server's localized refusal (`:154-160`); reads `response.body.getReader()` + `TextDecoder(…, { stream: true })` (`:179-187`); splits frames on `"\n\n"` and parses each with `parseSSEEvents` (`:112-129`, strips `data:` and `JSON.parse`); buffered fallback `await response.text()` when `getReader` is missing (`:188-191`); handles a trailing frame without the blank line (`:192-198`); `onEvent` exceptions are swallowed so a UI handler can never kill the stream (`:174`). **No timeout — "the server owns the processing budget"** (`:142`). Auth: `Authorization: Bearer ${SessionStore.get("token")}` (`:8-11`).
- No chat client: `url.js` defines `EnhanceTextAI` (`clinqetwebpartnerapp\src\api\url.js:252`) and `AIProviderSetupProcess` (`:254`); grep `ai/chat` in `clinqetwebpartnerapp\src` → NOT FOUND.

### 2.5 RN client (`clinqetmobilepartnerapp\src\services\aiServices.ts`, 509 lines, read fully)

- `StreamProviderSetupDocument` (`:469-508`) → `streamSetupOnce` (`:372-461`): `XMLHttpRequest` because "RN's fetch buffers the whole body (no ReadableStream)" (`:370-371`); `xhr.onprogress` re-arms a **330 s stall timer** (`PROVIDER_SETUP_STALL_TIMEOUT_MS`, `:354`) and drains complete `\n\n` frames from `responseText` (`:403-430`); `onloadend` drains the tail frame (`:439-458`); 401 → `refreshTokenAPI` once and re-stream (`:479-491`); non-2xx → `Error` with `.response` (`:493-505`). Headers: `Authorization`, `Accept-Language` from AsyncStorage, `Accept: application/json` (`:10-22`). Regional base URL via `resolveRegionalUrl` (`:473`).
- No chat client: `constant.tsx:131-136` declares `EnhanceTextAI`, `SpeechToTextAI`, `AIProviderSetupProcess`; the comment at `:133-134` records the deleted `ai/chat/attachment`; `aiServices.ts:287-297` documents the removal. grep `ai/chat` → only those comments.

---

## 3. Tool calling today (Chat Completions, SDK, schema, loop, history)

### 3.1 API + packages

| Item | Value | Evidence |
|---|---|---|
| API used for tool calling | **Chat Completions** (SDK `ChatClient.CompleteChatStreamingAsync`) | `McpAIService.cs:187` |
| Responses API | **NOT FOUND** — grep `chat/completions|/responses\?|openai/deployments` and `ResponsesClient|OpenAIResponseClient|/openai/v1/responses` across the four .NET repos returned only chat/completions + embeddings URLs | `AICompletionService.cs:547`, `TextEnhancementService.cs:136`, `AzureAIFoundryEmbeddingService.cs:408`, `QueryUnderstandingService.cs:556` |
| SDK | `Azure.AI.OpenAI` **2.1.0** (`AzureOpenAIClient`, `OpenAI.Chat` namespace) | `clinqetinfrastructure\Clinqet.Infrastructure.csproj:19`; `McpAIService.cs:1,11` |
| Responses API (wide re-grep) | **NOT FOUND** — `ResponsesClient|OpenAIResponseClient|/openai/v1/responses|openai/responses|CreateResponseAsync|GetOpenAIResponseClient|ResponseCreationOptions` over `clinqetinfrastructure\Services`, `clinqetapi\Clinqet.API`, `clinqetfuncations\Clinqet.Communications`, `clinqetmcp\Clinqet.Mcp` (`*.cs`, bin/obj excluded) → zero hits | grep 2026-09-02 |
| Streaming + tools in ONE loop | **Yes, exactly one class**: `McpAIService.ProduceResponsesAsync` streams `Content` deltas from `CompleteChatStreamingAsync` **and** accumulates `ToolCallUpdates` in the same `await foreach`, then executes the tools and re-enters the model | `McpAIService.cs:187-232,244-294` |
| `stream_options` / `IncludeUsage` | NOT set anywhere in `McpAIService.cs` (grep `IncludeUsage|StreamOptions` → only the method/variable names at `:62,187,189`); usage is read opportunistically when the SDK surfaces `update.Usage` | `McpAIService.cs:213-231` |
| Only SDK consumer | `McpAIService` — grep `using Azure.AI.OpenAI|using OpenAI.Chat|AzureOpenAIClient|GetChatClient` → single file | grep |
| MCP client SDK (API host) | `ModelContextProtocol` **1.4.0** | `clinqetapi\Clinqet.API\Clinqet.API.csproj:32` |
| MCP server SDK | `ModelContextProtocol.AspNetCore` **2.1.0** | `clinqetmcp\Clinqet.Mcp\Clinqet.Mcp.csproj:22` |
| `Microsoft.Extensions.AI` | NOT FOUND in any csproj | `Clinqet.Infrastructure.csproj`, `Clinqet.API.csproj:24-33`, `Clinqet.Mcp.csproj:22-23` |
| Other AI HTTP callers (raw `HttpClient`, `api-key` header) | `AICompletionService` (`:416-418`), `TextEnhancementService` (`:156-157`), `QueryUnderstandingService` (spell LLM, `:556`), `AzureAIFoundryEmbeddingService` (`:408`) | |

### 3.2 Client construction and per-call options (`McpAIService.cs`)

- `new AzureOpenAIClient(new Uri(_openAISettings.Endpoint), new ApiKeyCredential(_openAISettings.ApiKey))` then `GetChatClient(_openAISettings.DeploymentName)` (`:55-59`). **`AIService:ApiVersion` is NOT passed** (no `AzureOpenAIClientOptions`) — the SDK's built-in service version applies; the `ApiVersion` setting only drives the raw-HTTP callers (`AICompletionService.cs:547`, `TextEnhancementService.cs:136`).
- `ChatCompletionOptions { Temperature = _settings.Mcp.Temperature, MaxOutputTokenCount = _settings.Mcp.MaxTokens }` (`:173-177`) — 0.7 and 10000 (`appsettings.json:2096-2097`). **No `reasoning_effort`, no `ToolChoice`, no `ParallelToolCallsEnabled`, no `ResponseFormat`** set. **Temperature is sent unconditionally** — unlike `AICompletionService.AcceptsTemperature` (`:397,517-518`), so a `DefaultTemperatureOnlyDeployments` model (luna) would 400 here.
- `Mcp:MaxContextTokens` (8000, `appsettings.json:2098`) — **declared but never read**: grep `MaxContextTokens` over `clinqetinfrastructure\Services`, `clinqetapi\Clinqet.API`, `clinqetshared\Models` → only the property itself (`clinqetshared\Models\AIAssistantSettings.cs:45`). Orphan setting (CLAUDE.md §4 hygiene item).
- Class default `McpSettings.MaxTokens = 2000` vs appsettings `10000` (`AIAssistantSettings.cs:44`; `appsettings.json:2097`) — another class-default drift. `Mcp:Session:MaxConcurrentSessions` (10000, `appsettings.json:2101`) is likewise unread by `McpSessionService` (grep → property only).

### 3.3 Tool declaration

- Catalog: `IMcpToolSession.ListToolsAsync` → `McpToolGateway.ListCatalogAsync` → `McpClient.ListToolsAsync` (`McpToolGateway.cs:112`) filtered by `_settings.IsChatToolAllowed(t.Name)` (`:116`), mapped to `McpGatewayTool { Name, Description, InputSchemaJson = t.ProtocolTool.InputSchema.GetRawText(), ParallelSafe = Annotations?.IdempotentHint == true }` (`:117-123`; record at `clinqetshared\DTOs\AI\McpGatewayModels.cs:3-10`). Cached process-wide for `Mcp:ToolCatalogCacheMinutes` (5, `appsettings.json:2046`) under a `SemaphoreSlim(1,1)` (`McpToolGateway.cs:27,98-133`).
- Declared to the model per iteration: `ChatTool.CreateFunctionTool(tool.Name, tool.Description, BinaryData.FromString(tool.InputSchemaJson))` (`McpAIService.cs:466-479`) then `options.Tools.Add(tool)` (`:180`). **JSON schema is the MCP server's input schema verbatim — no schema generation in the API host.**
- Toolless degradation: `if (_toolGateway.IsConfigured)` else `Array.Empty<McpGatewayTool>()` with a debug log (`:158-168`); `IsConfigured` = `Mcp:PublicUrl` and `Mcp:SecretPath` both set (`McpToolGateway.cs:45`). The India stamp runs toolless by design (`Program.cs:817-818`, enforced by `McpStartupGuard.ValidateProductionConfig` `:819-823`).

### 3.4 Agentic loop (`ProduceResponsesAsync`, `McpAIService.cs:126-351`)

1. `while (iteration < maxIterations && !cancellationToken.IsCancellationRequested)` (`:142`), `maxIterations = _settings.Mcp.Tools.MaxToolIterations` (`:134`; 5 at `appsettings.json:2110`).
2. One MCP session per chat request, created lazily on the first iteration (`toolSession ??= await _toolGateway.CreateSessionAsync(businessId, ct)`, `:161`), disposed in `finally` (`:339-349`).
3. Stream: text parts → `Content` events (`:191-203`); `update.ToolCallUpdates` accumulated by index into `Dictionary<int, ChatToolCall>` with argument deltas concatenated (`ProcessToolCallUpdate`, `:481-501`); `finishReason` captured (`:210-211`); usage captured + `TokenUsage` event + `LogChatUsage` (`:213-231`).
4. After each model turn: `RecordTokenUsageAsync("mcp-chat", businessId, prompt + completion)` (`:234`); if `finishReason == Length` → `ReportCentralCutoffAsync(AiSubFlows.AssistantChat, DeploymentName, Interactive, MaxTokens, completionTokens, 0)` (`:236-242`).
5. If `finishReason == ToolCalls`: partition into parallel-safe vs sequential by `ParallelSafe` (`PartitionToolCalls`, `:535-552`); parallel batch via `Task.WhenAll` with results re-ordered by index (`ExecuteToolsInParallelAsync`, `:554-599`); sequential ones one by one (`:264-285`); arguments parsed as `Dictionary<string, JsonElement>` (`TryParseArguments`, `:503-525`, bad JSON ⇒ error result fed back to the model, `:604-612`); `IMcpToolSession.CallToolAsync(name, args)` (`:614`); executions persisted to the session (`AddToolExecutionsBatchAsync`, `:287-291`); `continue` (`:293`).
6. Otherwise: `context.TotalTokensUsed += totalTokensUsed` and `FinalContent` (`:296-306`).
7. Loop exhaustion ⇒ `Error SSE_MaxIterationsReached` (`:309-319`).

### 3.5 How tool results are fed back (`BuildMessages`, `:367-415`)

- `system` = `Mcp:BaseSystemPrompt` + `InteractionTypePrompts[interactionType]` + `"IMPORTANT: Respond in {language}."` (`:430-450`).
- **`GetLanguageName` (`:452-464`) maps only `en, es, fr, de, zh, in`** — `"in" => "Hindi"`, and **there is no `hi` case and no `gu` case**, so both fall through `_ => "English"`. The platform ships five localization catalogues (`clinqetinfrastructure\Resources\Localization\`: `en, es, fr, gu, hi`), so a Hindi- or Gujarati-locale provider is told to answer in English.
- History: `context.History.TakeLast(MaxConversationRounds)`; turns older than `FullContentTurns` (3) truncated to `TruncatedContentLength` (300) (`:376-395`; settings `appsettings.json:2104-2107`).
- If `pendingToolCalls` non-empty: append ONE assistant message carrying all `ChatToolCall.CreateFunctionToolCall(id, name, args)` (`:400`) then one `ChatMessage.CreateToolMessage(id, result)` per call (`:397-408`). Else append the user message (`:409-412`).
- Observed consequences (facts from the code, not opinions):
  - `pendingToolCalls.Clear()` at the start of each tool round (`:247`) ⇒ on iteration N+1 the model sees only round N's tool calls/results; earlier rounds' results are not replayed (they survive only in `context.ToolExecutions`, which is never sent to the model).
  - `ProcessTextInputAsync` adds the user turn to `context.History` **before** streaming (`McpService.cs:159-164`; the cache returns the same object instance, `McpSessionService.cs:48-55`), and iteration 1 also appends `userMessage` (`McpAIService.cs:411`) ⇒ the current user message appears twice in the first model call.
  - Tool result text is passed back verbatim; errors are wrapped as `{"error": text}` with `UnsafeRelaxedJsonEscaping` so non-ASCII localized errors are readable by the model (`:21-24,634-649`).

### 3.6 Streaming support per service (the coordinator's explicit question)

| Service | Streams tokens? | Tools? | Transport | Evidence |
|---|---|---|---|---|
| `McpAIService` | **Yes** (`CompleteChatStreamingAsync`, per-part `Content` events) | **Yes** (MCP catalog) | SDK `ChatClient` | `McpAIService.cs:187-232` |
| `AICompletionService` | **No** — one POST, `ReadAsStringAsync` of the whole body; body class has no `stream` property | **No** | raw `HttpClient`, `api-key` | `AICompletionService.cs:44-63,416-423,457-459` |
| `TextEnhancementService` | No | No | raw `HttpClient` | `TextEnhancementService.cs:143-164` |
| `QueryUnderstandingService` (A2 spell LLM) | No `[not read in depth]` | No | raw `HttpClient` | `QueryUnderstandingService.cs:556` |

`AICompletionService` does offer what the others lack: strict JSON-schema structured output (`response_format: json_schema, strict: true`, `:368-385`), JSON mode (`:384`), image input (`:255-287,315-348`), `reasoning_effort` (`:387-390`), temperature omission for luna (`:397,517-518`), `AiBudgetGovernor` lease per lane (`:414`), Azure rate-limit header snapshot + typed `AiThrottledException` (`:425-453`), retry with server `Retry-After` clamp (`:433-442,536-544`), attempt budget (`:408-410`), central cutoff alert + truncation log (`:463-474`), cost line (`:551-559`).

### 3.7 Session persistence (Cosmos + cache)

- Entity `AiSession` (`clinqetcore\Entities\COSMOS\AiSession.cs:7-45`): `id`, `type = "AiSession"`, `sessionId`, `userNumber` (= businessId), `interactionType`, `history[]`, `toolExecutions[]`, `totalTokensUsed`, `createdAt`, `lastActivity`, `metadata`, `ttl`.
- Repository `AiSessionRepository` (`clinqetinfrastructure\Data\COSMOS\AiSessionRepository.cs`): container `CosmosDb:ContainerNames:Communications` with fallback literal `"Communications"` (`:27`), wrapped in `CosmosRetryPolicyFactory.Create` (`:30`); point read `ReadItemAsync(sessionId, new PartitionKey(userNumber))` (`:39-42`); create/upsert with the same PK (`:74-77,95-98`); list query `SELECT * FROM c WHERE c.type = 'AiSession' AND c.userNumber = @userNumber ORDER BY c.lastActivity DESC` with `QueryRequestOptions.PartitionKey` (`:154-159`) — single-partition; count query likewise (`:183-188`). Partition-key **path** of the `Communications` container is **`/userNumber`** (`clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs:441-443`, created by `cosmosindexsetup\Program.cs:140`); its indexing policy excludes `/*` and includes `/type`, `/lastActivity`, `/createdAt` among others (`:445-456`) — the `ORDER BY c.lastActivity` list query is index-backed. For contrast: `SystemData` is `/pk` (`:570-572`), `KnowledgeBase` is `/businessId` (`:743-745`).
- `McpSessionService` (`clinqetinfrastructure\Services\AI\McpSessionService.cs`): `IMemoryCache` key `ai_session_{businessId}_{sessionId}` (`GetCacheKey`, `:207`), `SlidingExpiration = _cacheExpiration` (`:199`), `AbsoluteExpirationRelativeToNow = SessionTimeoutMinutes` (`:200`), **`Size = 1`** (`:201`); TTL `SessionTtlDays * 86400` (`:241-242,270`); history trimmed to `MaxConversationRounds` **turns** (`:185-193`); limit check counts `Role == "user"` turns against the same `MaxConversationRounds` and `TotalTokensUsed` against `MaxSessionTokens` (`:323-351`).
- DI (API host `Program.cs`): `IAiSessionRepository` `:838`, `IMcpSessionService` `:839`, `IMcpAIService` `:840`, `IMcpService` `:845` — all **Scoped**; `IMcpToolGateway` `:826`, `IAiRateLimitingService` `:846`, `IAiBudgetCutoffAlerts` `:859` — all **Singleton**.

---

## 4. Model / deployment inventory

### 4.1 Deployments the platform provisions (`azureautomation\deploy.ps1`)

| Deployment name | Model version | Capacity | Notes | Line |
|---|---|---|---|---|
| `gpt-5.4-mini` (`$openAiPrimaryDeploymentName`) | `2026-03-17` | `$OpenAiModelCapacity` (1000 ×1K TPM default, `:527`) | host default chat model | `:2616,2653` |
| `gpt-5.6-luna` (`$openAiLunaDeploymentName`) | `2026-07-09` | `$OpenAiModelCapacity` | "per-sub-flow candidate chat model"; must stay in `$modelDeployments` for the RAI loop | `:2617-2622,2654` |
| `text-embedding-3-large` | `1` | `$OpenAiModelCapacity` | 3072 dims | `:2623,2638,2655` |
| `gpt-realtime-mini` | `2025-12-15` | realtime pool (60 non-prod / 100 prod) | voice default tier; `preserveIfExists` | `:2629,2645-2650,2658` |
| `gpt-realtime-2` | `$OpenAiRealtimePremiumModelVersion` = `2026-05-07` | realtime pool | voice premium tier; SIP-listed | `:533,2630,2659` |
| `gpt-4o-mini-transcribe` | `2025-12-15` | `$OpenAiTranscribeModelCapacity` 50 | realtime input transcription sidecar | `:536,2635,2660` |
| `gpt-realtime-1.5` | — | — | fallback name only, not in `$modelDeployments` | `:2633` |
| `gpt-5.4`, `gpt-4.1` | — | — | **removed from `$modelDeployments`**; pricing rows remain | `:2612-2616`; `appsettings.json:2033-2034` |

Account: one shared East US 2 Foundry per env-tier for chat/embedding (`:839-841,876-882,1327-1332`); a dedicated Sweden Central account holds only realtime voice models for India (`:843-849,1333-1335`). Chat API version `2025-01-01-preview`, embedding `2024-12-01-preview` (`:2636-2637`). SKU ladder `GlobalStandard → DataZoneStandard → Standard` (`:539,2672-2720`).

### 4.2 Setting key → deployment → host → purpose → tools?

Endpoint for all chat rows: `AIService:Endpoint` (API `appsettings.json:2018`, MCP `:154`, FN `:1505`) = the shared Foundry; deploy writes `AIService__Endpoint/ApiKey/DeploymentName/ApiVersion` to API (`deploy.ps1:6857-6860`), FN (`:7066-7069`) and MCP (`:7488-7490`).

| Sub-flow (`AiSubFlows`) | Setting key | Deployment (appsettings) | Host | Purpose | Tools? | Evidence |
|---|---|---|---|---|---|---|
| A3 `AssistantChat` | `AIService:DeploymentName` | **`gpt-5.4-mini`** | API | in-app chat (SDK, streaming) | **YES** | `appsettings.json:2020`; `McpAIService.cs:59,180` |
| A1 `TextEnhance` | `AIAssistant:TextEnhancement:DeploymentName` (null ⇒ global) | `gpt-5.6-luna`, effort Medium | API | proofread/professionalize/summarize | no | `appsettings.json:2083-2084`; `TextEnhancementService.cs:135,138` |
| A2 `SpellCorrect` | `Search:SpellCheck:Llm:DeploymentName` | `gpt-5.6-luna`, effort None, 200 tokens, 3 s | API (+FN) | search spell LLM | no | `appsettings.json:1797-1802`; FN `:2517-2522`; `deploy.ps1:7070` |
| B1 `SearchEnrichment` | `SearchIndexEnrichment:DeploymentName` | `gpt-5.4-mini`, effort None, 8000 tokens | FN (API copy `Enabled:false`) | service doc enrichment | no | API `:3314-3319`; FN `:1571-1576` |
| B2 `ContentValidation` | `ServiceApproval:ContentValidationDeploymentName` | `gpt-5.6-luna` | FN | service approval | no | FN `:1548-1552`; `AICompletionService.cs:149-159` |
| B3 `CategoryValidation` | `ServiceApproval:CategoryValidationDeploymentName` | `gpt-5.6-luna` | FN | category check | no | FN `:1554-1558`; `AICompletionService.cs:188-198` |
| C2/C3 quote classify | `BroadcastClassification:AiDeploymentName` / `VisionDeploymentName` | `gpt-5.6-luna` / `gpt-5.6-luna` | API | customer quote classification (+photo) | no | `appsettings.json:3678-3682` |
| D1 `SetupExtractVision` | `AzureDocumentIntelligence:VisionAiDeploymentName` | `gpt-5.6-luna` | API | provider-setup vision extraction | no | `:2230`; `deploy.ps1:6910,7075` |
| D2/D3 setup text extract/dedupe | `AzureDocumentIntelligence:AiDeploymentName`, 25000 tokens, effort Medium | `gpt-5.6-luna` | API | provider-setup OCR→JSON | no | `:2234-2237`; `deploy.ps1:6907,7072` |
| D4 `SetupTranscribeVision` | `AIAssistant:ProviderAttachmentProcessing:Vision:TranscribeDeploymentName` | `gpt-5.6-luna`, Medium, 6000 tokens | API | page-image OCR via LLM | no | `:2139-2142` |
| E1–E4 setup images | `…:Images:CaptionDeploymentName / ProposerDeploymentName / ServiceVerifyDeploymentName / ProfileVerifyDeploymentName` | all `gpt-5.6-luna`, Medium | API | caption / route / verify photos | no | `:2157-2167` |
| F1/F2/F3 knowledge | `Voice:Knowledge:DocSummaryDeploymentName`, `ImageCaptionDeploymentName`, `Vision:TranscribeDeploymentName` | `gpt-5.6-luna` | FN | knowledge ingest | no | FN `:1201,1205,1282` |
| G1–G5 drafts | `…ServiceDrafts:JudgeDeploymentName / ExtractorDeploymentName / ImageMatchDeploymentName / ImageMatchVerifyDeploymentName / ImageMatchRemoteVerifyDeploymentName` | `gpt-5.6-luna` | FN | knowledge service drafts | no | FN `:1227,1232,1246,1250-1251` |
| H1 `VoiceExpertCheck` | `Voice:ExpertCheck:DeploymentName` | `gpt-5.6-luna`, Low, 500 tokens | MCP (+FN copy) | voice catalog expert check | no | MCP `:120-131`; FN `:1292-1300`; `deploy.ps1:6913` |
| H2 `CallSummary` | `VoiceCall:SummaryDeploymentName` | `gpt-5.4-mini`, Low, 2000 tokens | FN | post-call summary | no | FN `:1383-1388`; `deploy.ps1:6896` |
| H3 `TranscriptTranslate` | `VoiceCall:TranslationDeploymentName` | `gpt-5.6-luna`, Low | FN | transcript translation | no | FN `:1385-1386`; `deploy.ps1:6915` |
| embeddings | `AzureAIFoundry:EmbeddingModel` | `text-embedding-3-large`, 3072, api `2024-12-01-preview` | API, FN | search + knowledge vectors | n/a | API `:1980-2000`; FN `:403-412`; `AzureAIFoundryEmbeddingService.cs:88-93,408` |
| voice realtime | `Azure:Realtime:DeploymentDefault / DeploymentPremium / InputTranscriptionModel` | `gpt-realtime-mini` / `gpt-realtime-2` / `gpt-4o-mini-transcribe` | FN, MCP | phone receptionist (realtime endpoint — excluded by the brief) | MCP tools via realtime session | FN `:1420-1431`; MCP `:226-231`; `deploy.ps1:6861-6865` |

Pricing map `AIService:TokenPricing` (identical in the three hosts): mini 0.75/0.075/4.50, luna 0.20/0.02/1.20, gpt-5.4 2.50/0.25/15.00, gpt-4.1 2.00/0.50/8.00 $/1M (`appsettings.json:2030-2035`; MCP `:166-171`; FN `:1517-1522`; class default `AIServiceSettings.cs:29-33`).

**Which deployments are used WITH tool/function calling today:** only `gpt-5.4-mini` via `McpAIService` (`options.Tools.Add`, `McpAIService.cs:180`). The realtime voice session also receives MCP tool names (`clinqetinfrastructure\Services\Voice\RealtimeSessionPayloadBuilder.cs:55-68,170,262`) but that is the realtime endpoint, not Chat Completions. Grep for `"tools"|tool_choice|ToolChoice` in all four .NET repos → only those two files + `McpToolGateway.cs:112`.

### 4.3 Class-default vs appsettings drift found (rule: class default mirrors appsettings)

- `AIServiceSettings.ApiVersion` class default `"2024-12-01-preview"` vs appsettings `"2025-01-01-preview"` (`AIServiceSettings.cs:11`; `appsettings.json:2021`).
- `AIServiceSettings.MaxCompletionTokens` class default `1000` vs appsettings `5000` (`AIServiceSettings.cs:12`; `appsettings.json:2022`).
- `AIServiceSettings.ReasoningEffort` class default `null` vs appsettings `"Medium"` (`AIServiceSettings.cs:21`; `appsettings.json:2029`).
- `McpSettings.MaxTokens` class default `2000` vs appsettings `10000` (`AIAssistantSettings.cs:44`; `appsettings.json:2097`).

---

## 5. "luna" — every reference, what it is, what the repo says about tool calling

### 5.1 Identity
- `AiModels.Mini = "gpt-5.4-mini"` (`clinqetshared\Constants\AiModels.cs:11`), `AiModels.Luna = "gpt-5.6-luna"` (`:13`). Deployed as model `gpt-5.6-luna` version `2026-07-09` (`deploy.ps1:2622,2654`); version was read off the live `model` field `gpt-5.6-luna-2026-07-09` (memory `ai-cost-quality-phase7-8-2026-08-31.md:17-20`).

### 5.2 Where it is used (all class defaults name `AiModels.Luna`)
`AIAssistantSettings.cs:33,97,99,101,106,231,235`; `AIServiceSettings.cs:24,32,56,66`; `BroadcastClassificationSettings.cs:50-51`; `SearchSpellCheckSettings.cs:198`; `VisionTranscriptionSettings.cs:11`; `VoiceCallSettings.cs:85`; `VoiceExpertCheckSettings.cs:14`; `VoiceKnowledgeSettings.cs:103,114,234,264,298,309-310` (all under `clinqetshared\Models\`). appsettings occurrences: API `appsettings.json:1800,2017,2032,2083,2139,2158,2160,2162,2165,2230,2234,3678,3679`, `appsettings.ca.json:39,47,52,53`, `appsettings.in.json:42,50,55,56`; MCP `appsettings.json:122,153,168`; FN `appsettings.json:1201,1205,1227,1232,1246,1250,1251,1282,1294,1385,1504,1519,1548,1554,2520`.

### 5.3 What the repo asserts about luna and tool calling — **CLOSED: assertion only, no measurement**

`clinqetapi\Clinqet.API.UnitTests\Conventions\AiModelPinConventionTests.cs` read **in full (152 lines)**.

- **The claim appears three times, all as prose, never as a result:**
  1. `clinqetshared\Constants\AiModels.cs:9-10` — *"Locked for A3 (assistant chat): gpt-5.6 cannot do tool calls on Chat Completions, and A3 has no per-flow deployment key, so the host default AIService:DeploymentName is its only defence."*
  2. `AiModelPinConventionTests.cs:15-18` (class XML doc) — *"The single most dangerous edit available is setting `AIService:DeploymentName` to luna: eleven flows inherit it, and so does A3 (assistant chat), which BREAKS — gpt-5.6 cannot do tool calls on Chat Completions, and A3 has no per-flow key to rescue it. Until that seam exists, the host default staying on mini is A3's ONLY defence, which is why it has a test of its own."*
  3. `:53-54` (method comment) — *"‼️ A3's only defence. If this ever needs to change, A3 needs a per-flow seam FIRST (McpAIService reads `_openAISettings.DeploymentName` straight into the SDK ChatClient)."*
- The test itself is one assertion over configuration: `TheHostDefaultModel_StaysOnMini_BecauseA3CannotLeaveIt` → `Assert.Equal(AiModels.Mini, Read(doc, "AIService:DeploymentName"))` (`:55-60`). **It proves the pin is in place; it says nothing about the model's capability.**
- ‼️ **The contrast is now demonstrable — the same author cites measurements where they have them, and cites none here.** Two other pins in the SAME file carry their evidence inline:
  - `SearchEnrichment_StaysOnMini_UntilTheSearchJudgeHasRun` (`:88-93`), comment `:85-87`: *"its luna call rests on a blind judge at n=8 WHERE MINI WAS THE JUDGE. It moves only when the SearchJudge has run over its 112 labelled queries and NO metric has dropped — Recall@10, MRR, Precision@10, NDCG@10."*
  - `EveryLatencyBoundDial_IsPinned_NeverLeftNull` (`:97-104`), comment `:95-96`: *"A dial left null on a latency-bound call is the defect that produced C3's 63 s p95 — measured at an UNSET dial and then blamed on the model."*
  ⇒ Named corpus, named n, named metric, named p95 for those two; **for the tool-calling sentence: nothing.**
- Rest of the file, for completeness: `LunaPins()` is a `TheoryData` of **11** `key → AiModels.Luna` pairs (`:62-75`) consumed by `EveryFlowThisHostOwns_IsPinnedExplicitly` (`:77-83`); `TheTwoFileSizeGatesPerLane_MoveTogether` (`:108-116`); `TheChangedLimits_MatchTheirTargets` (`:118-126`); `EveryRegionOverride_MatchesTheBaseDecision` (`:130-150`) re-asserts, for `appsettings.ca.json` and `appsettings.in.json`, four luna keys plus **`AIService:DeploymentName` = mini and `SearchIndexEnrichment:DeploymentName` = mini**.
- The file is §0.17-clean: `ResolveAppSettings()` (`:26-38`) walks up at most 12 directories for `Clinqet.API/appsettings.json` and **throws** with *"the scan would silently pass having read nothing"* if absent; the region theory `Assert.True(File.Exists(path))` for the same reason (`:136`). It reads only this host's own files (`:13`).
- Chat-tool-relevant facts about luna the repo DOES establish: `AiModels.cs:5-6` — a deployment absent from `$modelDeployments` "serves with NO content filter"; luna IS in `$modelDeployments` (`deploy.ps1:2654`) yet its filter is not enforced on the data plane (§5.4).
- Grep of the memory directory for `tool.?call|function.?call|does not support|no tools` in `ai-cost-quality-*.md` and `ai-assistant-improvement-program-2026-08-10.md` → only `ai-assistant-improvement-program-2026-08-10.md:22` (about the realtime MCP connector, not luna). **No probe log, harness result or A/B record for luna + tools exists in the repo or memory.**
- Per the coordinator's note, public Azure docs state luna DOES support function calling on Chat Completions when `reasoning_effort` is `none`, otherwise via the Responses API. The repo does not contradict this with evidence; its comment is broader than the docs and is unmeasured. Relevant repo facts that WOULD matter for such a call: `McpAIService` never sets `reasoning_effort` (`:173-177`) and always sends temperature (`:175`), which luna rejects (`AICompletionService.cs:396`).

### 5.4 Proven (measured) luna facts in the repo/memory
- Rejects non-default `temperature` with HTTP 400 `unsupported_value` — proven live on B1 2026-09-01 (`AICompletionService.cs:396-397`; test `AICompletionServiceTests.cs:663-671`; `AzureSearchIndexer.cs:155`; memory `ai-cost-quality-session4-2026-09-02.md:12`). Seam omits temperature for `AIService:DefaultTemperatureOnlyDeployments` (`AIServiceSettings.cs:23-24`; `AICompletionService.cs:517-518`).
- 8/8 failures (HTTP 500 ×6, 90 s timeout ×2) on four locally generated images that mini handled 8/8; cause unknown; swallowed into "no caption" ⇒ silent data loss (memory `ai-cost-quality-phase7-8-2026-08-31.md:24-29`).
- `ClinketContentFilter` assigned but not enforced on luna: profanity/jailbreak/indirect-attack all HTTP 200 on luna, HTTP 400 `content_filter` on mini; `prompt_filter_results: {}` (same file `:30-36`; `deploy.ps1:2618-2621`).
- Quality A/Bs: C3 no measurable difference (temperature noise) (`:39-42`); E1/F2 caption faithfulness mini 45/56 vs luna 48/56, cost $0.00187 → $0.00044 (`:43-46`); E3 hero-verify recall 51.7% → 85.0% at 0 false positives, cost $0.00136 → $0.00028 (`:47-52`); luna@Low p95 2.2 s vs luna@unset 4.9 s on C3 (`BroadcastClassificationServiceTests.cs:992-993`).

---

## 6. Cost / quality controls a new AI flow must join

### 6.1 `AiRateLimitingService` internals — **CLOSED** (`clinqetinfrastructure\Services\AI\AiRateLimitingService.cs`, 308 lines, read fully)

| Question | Answer | Evidence |
|---|---|---|
| Bucket store | `ConcurrentDictionary<string, RateLimitBucket>` created in the ctor; `RateLimitBucket` is a private nested class holding `RequestCount`, `TokenCount`, `WindowStart` and its own `readonly object Lock` | `:13,27,275-306` |
| Key shape | `$"{endpoint}:{businessId}"` — endpoint name first, business second | `GetBucketKey`, `:235` |
| Per-instance or distributed? | ‼️ **PER-INSTANCE (in-process) ONLY.** Plain in-memory dictionary, no Redis, no Cosmos, no distributed cache. **With N API instances a business gets N × the configured window.** The only scale-out-safe control in this family is the DAILY cap, whose own comment says so: *"Durable per-business daily cap (atomic counter — survives restarts and scale-out). 0 = off."* | `:13,27`; `clinqetshared\Models\AIAssistantSettings.cs:200-201` |
| `Size = 1` on any cache write? | **N/A — the service performs ZERO `IMemoryCache` writes.** It never touches `IMemoryCache`; its ctor takes only `IOptions<AIAssistantSettings>`, `ILogger`, `IPlatformLimitAlerts`. The §14 `Size = 1` mandate therefore does not apply to it (it DOES apply to `McpSessionService`, which is compliant — `McpSessionService.cs:201`) | `:11-29` (no `IMemoryCache` in scope) |
| Window semantics | Fixed window, lazily reset: `RefreshWindow` compares `now >= WindowStart + windowMinutes` outside the lock, re-checks inside, then zeroes both counters and re-stamps `WindowStart` | `:289-305` |
| Request check | Increments FIRST, then compares: `bucket.RequestCount++` then `if (RequestCount <= RequestsPerWindow)` ⇒ allow | `:60-67` |
| Token check | `if (bucket.TokenCount + tokensToConsume > TokensPerWindow)` ⇒ deny; gated additionally on `RateLimiting.EnableTokenBasedLimiting` | `:93-94,110-131` |
| Recording | `RecordTokenUsageAsync` only ADDS (`TokenCount += tokensUsed`); no-ops when disabled or `tokensUsed <= 0` | `:139-167` |
| Throttle visibility | Both sides fire-and-forget `_limitAlerts.ReportCapacityPressureAsync("AiRateLimitThrottled", "AIAssistant:RateLimiting (endpoint '…': RequestsPerWindow|TokensPerWindow)", …)` | `:76-80,119-123` |
| Endpoint resolution | ‼️ **A HARD-CODED three-case switch on `endpoint.ToLowerInvariant()`**: `"text-enhancement"`, `"mcp-chat"`, `"document-intelligence"`. Any other name returns `null` ⇒ **the 2-arg overload allows UNLIMITED traffic**, silently | `GetEndpointConfig`, `:224-233` |
| Escape hatch | 3-arg overload `CheckRateLimitAsync(endpoint, businessId, AIEndpointRateLimitSettings config)` bypasses the switch — this is how speech-to-text gets 20/min | `:37-40`; `AIAssistantController.cs:253-254`; `appsettings.json:2115-2120` |
| Also exposed | `IsEndpointRateLimitEnabled(endpoint)` (`:215-222`), `GetStatusAsync` (`:169-213`) | |
| Cleanup | `IDisposable` + `Timer` every 5 min; drops buckets older than two windows. ‼️ It derives the endpoint via `kvp.Key.Split(':')[0]` and `continue`s when `GetEndpointConfig` returns null ⇒ **buckets created through the 3-arg overload (e.g. `speech-to-text`) are NEVER evicted** (bounded only by distinct businessIds) | `:28,237-266,268-273` |
| Minor | `RateLimitBucket`'s ctor takes `windowMinutes` and never uses it | `:282-287` |
| Lifetime | **Singleton** (correct — the dictionary is the state) | `clinqetapi\Clinqet.API\Program.cs:846` |
| Class defaults | `AIEndpointRateLimitSettings`: `Enabled true`, `RequestsPerWindow 30`, `WindowMinutes 1`, `TokensPerWindow 50000`, `RequestsPerDay 0`. `AIRateLimitingSettings`: `Enabled true`, `EnableTokenBasedLimiting true`, three endpoint sub-objects | `AIAssistantSettings.cs:185-202` |

⇒ **A new user-triggered flow either adds a `case` to `GetEndpointConfig` + a property on `AIRateLimitingSettings` + an appsettings block, or passes its own `AIEndpointRateLimitSettings` object explicitly. There is no third option, and forgetting both means no limit at all.**

### 6.2 `AiBudgetCutoffAlerts` — **CLOSED: the dial map is COMPLETE and its completeness is build-enforced**

`clinqetinfrastructure\Services\AI\AiBudgetCutoffAlerts.cs` (186 lines, read fully).

- `BudgetDialBySubFlow` is `internal static readonly IReadOnlyDictionary<string,string>`, `StringComparer.Ordinal`, **28 entries** (`:22-53`) — one per `AiSubFlows` constant. `clinqetshared\Constants\AiSubFlows.cs` declares exactly **28** `public const string` (A1–A3, B1–B3, C2–C3, D1–D4, E1–E4, F1–F3, G1–G5, H1–H3 = 27 flows, plus `Unattributed`), naming pattern `"<letter><n>-<slug>"` (`:9-36`); the header comment `:3-6` fixes the rule that a SHARED class takes the id from its **caller**.
- Two entries are prose rather than a key, deliberately: `DraftOfferingJudge` → *"Voice:Knowledge:ServiceDrafts:JudgeBatchSize (budget adapts per batch; smaller batches = more headroom)"* (`:44`) and `Unattributed` → *"(unattributed call — locate it via the 'AI chat usage unattributed' log line, then stamp its subFlowId)"* (`:52`). `DraftExtract` names its fallback (`:45`).
- **How a new sub-flow joins**: add the `AiSubFlows` constant, then add a `[AiSubFlows.<New>] = "<Section>:<MaxCompletionTokens key>"` entry here. `EverySubFlowId_HasARegisteredBudgetDial` (`clinqetfuncations\Clinqet.Communications.UnitTests\Knowledge\AiBudgetCutoffAlertsTests.cs:170-186`) reflects `typeof(AiSubFlows).GetFields(Public|Static).Where(f => f.IsLiteral)`, asserts `NotEmpty(ids)`, then fails in **both directions** — `missing` (an id with no dial) and `orphans` (a dial for an id that no longer exists). It lives in the **Functions** suite per §0.18. Runtime fallback if the pin is ever bypassed: `"(no dial registered for '{flow}' — add it to AiBudgetCutoffAlerts.BudgetDialBySubFlow)"` (`:148-150`).
- Two report paths, different cooldown scopes:
  - `ReportAsync(AiBudgetCutoffReport)` (`:76-127`) — the **call-site** alert, after a double cut-off; scope `$"{CallKind}:{BusinessId}:{ContextId ?? "-"}"` (`:83`); description names the two budgets, the reasoning tokens, the degradation ("picture undescribed / photo unverified / summary missing / proposer skipped") and `context.BudgetSettingName` to raise (`:96-102`); carries `BusinessId` on the alert (`:103`).
  - `ReportCentralCutoffAsync(subFlowId, deployment, lane, budgetTokens, completionTokens, reasoningTokens, ct)` (`:129-184`) — the **seam** alert on `finish_reason == length`; scope `$"central:{flow}:{deployment}"` (`:143`, coarser: no business/document at the seam); blank `subFlowId` ⇒ `AiSubFlows.Unattributed` (`:140`); description states *"A cut-off answer comes back EMPTY, never partial"* and *"do not auto-raise anything"* (`:158-161`).
- Common mechanics: `AdminAlertType.AiCompletionBudgetExhausted` + `AdminAlertSeverity.High` (`:93-94,154-155`); **15-minute cooldown** via `IAdminAlertCooldownService.TryClaim` (`:18,86,144`); `EventId = DeterministicGuid.Create(AlertKind, scope, hourBucket)` where `hourBucket = "yyyyMMddHH"` so a persisting problem **re-surfaces hourly instead of being deduped forever** (`:90,115,151,173`); the EventId is also the Service Bus `messageId` (`:120,178`); gated by `AdminAlertSettings.EnableSystemFailureAlerts` **before** the cooldown claim (`:80,138`); `forceAdminAlert: false`; both wrapped in `catch (Exception ex) when (ex is not OperationCanceledException)` that logs and swallows — *"a lost alert must never fail it twice"* (`:122-126,180-183`).

### 6.3 `AiCompletionBudgetGuard` — **CLOSED** (`clinqetinfrastructure\Services\AI\AiCompletionBudgetGuard.cs`, 40 lines, read fully)

- `public static class`; `public const int RetryGrowthFactor = 3` (`:11`).
- `RunWithCutoffRetryAsync(Func<int, Task<AiCompletionResult>> call, int budget, string callKind, ILogger logger, CancellationToken ct) → Task<(AiCompletionResult Result, int BudgetUsed)>` (`:13-18`).
- Behaviour: call at `budget`; return immediately if `!IsTruncated` (`:21-22`); otherwise `LogWarning` naming budget, reasoning tokens and content length (`:25-27`), `ct.ThrowIfCancellationRequested()` (`:29`), ONE retry at `checked(budget * 3)` (`:24,30`); a second truncation logs *"cut off AGAIN … the item degrades and ops is alerted"* and is **returned to the caller** (`:31-37`).
- ‼️ **The guard does NOT alert.** It logs and hands the truncated result back; the caller is responsible for the degrade and for calling `IAiBudgetCutoffAlerts.ReportAsync`. Header comment `:6-8` states the reason a retry exists at all: reasoning tokens share `max_completion_tokens`, so an undersized budget yields a cut-off (empty or cut JSON prefix), never a refusal.

### 6.4 Full control map

| Control | Setting key(s) | Default (appsettings) | Where read | Evidence |
|---|---|---|---|---|
| Per-endpoint request window | `AIAssistant:RateLimiting:{TextEnhancement,McpChat,DocumentIntelligence}:{Enabled,RequestsPerWindow,WindowMinutes}` | 10 req / 1 min each; `RateLimiting:Enabled true`, `EnableTokenBasedLimiting true` | `AiRateLimitingService.CheckRateLimitAsync` (`:31-35`) called at `AIAssistantController.cs:340,452,647,799`; speech uses the explicit-config overload with `SpeechToText:RateLimiting` 20/min (`:253-254`; `appsettings.json:2115-2120`) | `appsettings.json:2199-2220` |
| Per-endpoint token window | `…:TokensPerWindow`, `EnableTokenBasedLimiting` | 50k text / 100k chat / 100k docs | `CheckTokenRateLimitAsync(…, 0)` zero-consume probe (`AIAssistantController.cs:809`); `RecordTokenUsageAsync` after each model turn (`McpAIService.cs:234`) / after the setup stream (`AIAssistantController.cs:927-928`) | same |
| Daily abuse cap (AI text incl. chat) | entitlement `ai_text_daily_limit`, `Payment:UsageCapsEnabled`, `Payment:AiTextCounterTtlSeconds` | — | `EnforceAiTextAbuseCapAsync` atomic counter, alert `AdminAlertType.AiTextDailyCapReached` on the call that reaches the cap | `AIAssistantController.cs:173-223,348,460` |
| Daily cap (provider setup) | `AIAssistant:RateLimiting:DocumentIntelligence:RequestsPerDay`, `ProviderAttachmentProcessing:DailyCapCounterTtlSeconds` | 50 / 259200 | `EnforceProviderSetupDailyCapAsync`; `AdminAlertType.ProviderSetupDailyCapReached` | `:120-171,657,831`; `appsettings.json:2137,2219` |
| Session limits | `AIAssistant:Mcp:Session:{SessionTimeoutMinutes,SessionTtlDays,MaxConcurrentSessions,TrackTokenUsage,MaxConversationRounds,MaxSessionTokens,FullContentTurns,TruncatedContentLength}` | 60 / 7 / 10000 (unread) / true / 10 / 50000 / 3 / 300 | `McpSessionService.cs:185-205,241-242,323-384`; `McpAIService.cs:70-86,376-395` | `appsettings.json:2099-2107` |
| Chat output budget | `AIAssistant:Mcp:MaxTokens`, `Temperature`, `Tools:MaxToolIterations` | 10000 / 0.7 / 5 | `McpAIService.cs:134,173-177` | `appsettings.json:2096-2097,2110` |
| Central cut-off alert | none (behaviour) | — | `IAiBudgetCutoffAlerts.ReportCentralCutoffAsync` on `finish_reason == length` at the seam (`AICompletionService.cs:463-474`), in A1 (`TextEnhancementService.cs:177-186`), in A3 (`McpAIService.cs:236-242`). Mechanics + dial map: §6.2 | `clinqetcore\Interfaces\AI\IAiBudgetCutoffAlerts.cs:9-25` |
| Dial-map completeness pin | — | — | `EverySubFlowId_HasARegisteredBudgetDial` (`AiBudgetCutoffAlertsTests.cs:170-186`) — missing AND orphan both fail; alert body/cooldown/master-switch covered by `:45-165` | Functions suite (§0.18) |
| Structured-call budget guard | per-call `*MaxCompletionTokens` dials | e.g. `ServiceVerifyMaxCompletionTokens 600` | `AiCompletionBudgetGuard.RunWithCutoffRetryAsync` — §6.3 | `AiCompletionBudgetGuard.cs:11-38` |
| Azure rate-limit headers | — | — | `AiRateLimitHeaders.ReadSnapshot` reads `x-ratelimit-{limit,remaining}-{tokens,requests}`; `ReadRetryAfter` honours `retry-after-ms`, `Retry-After` delta and HTTP-date; `x-ratelimit-reset-*` deliberately ignored (`AiRateLimitHeaders.cs:7-8,12-17,19-50`) | used at `AICompletionService.cs:425,429` |
| Token-pricing pin | `AIService:TokenPricing` | — | `AiTokenPricingConventionTests.TokenPricing_InAppSettings_MirrorsTheClassDefaults_BothWays` — one copy per host | `clinqetapi\Clinqet.API.UnitTests\Conventions\AiTokenPricingConventionTests.cs:13-14`; FN + MCP copies |
| Budget governor (Bulk lane only) | `AiBudget:{Enabled,BulkHeadroomShare,GuardBandTokens,MinRequestHeadroom,MaxBulkConcurrency,MinBulkRequestSpacingMs,BootstrapTokensPerMinute,SnapshotFreshnessSeconds,MaxAcquireWaitSeconds,AcquirePollMs}` | true / 0.4 / 20000 / 5 / 2 / 250 / 200000 / 90 / 120 / 500 | `AiBudgetGovernor` ctor `IConfiguration.GetValue` (`:47-56`); `AcquireAsync` returns immediately for `Interactive` (`:66`); saturation ⇒ `ReportCapacityPressureAsync("AiBudgetGovernorSaturated", …)` (`:89-106`) | `appsettings.json:2004-2015`; `AiBudgetGovernor.cs` |
| Retry/throttle | `AIService:{MaxRetries,RetryInitialDelayMs,RetryMaxDelayMs,RetryAfterMaxDelayMs,RetryBackoffMultiplier,HttpTimeoutSeconds}` | 3 / 1000 / 10000 / 60000 / 2.0 / 90 | `AICompletionService.cs:365-366,406-511,528-544` | `appsettings.json:2023-2028` |
| Reasoning effort | `AIService:ReasoningEffort` global + per-flow `*ReasoningEffort` (`ReasoningEffort` enum `None, Low, Medium, High`) | Medium | `AICompletionService.cs:387-390` (None ⇒ omitted; any effort ⇒ temperature omitted); `TextEnhancementService.cs:138-141` | `clinqetshared\Enums\ReasoningEffort.cs:5-12`; `appsettings.json:2029` |
| Temperature omission | `AIService:DefaultTemperatureOnlyDeployments` | `["gpt-5.6-luna"]` | `AICompletionService.cs:397,517-518` | `appsettings.json:2017`; `AIServiceSettings.cs:23-24` |
| Cost line | `AIService:TokenPricing` | 4 models | `ChatCostCalculator.Estimate` (`clinqetcore\Models\AI\ChatCostCalculator.cs:11-27`) from all three seams | `AICompletionService.cs:551-559`; `McpAIService.cs:355-365`; `TextEnhancementService.cs:206-219` |
| Sub-flow attribution | `AiSubFlows` constant per flow | 27 flow ids + `unattributed` (28 constants) | passed as `subFlowId` into the seam (`IAICompletionService.cs:8-14`) | `clinqetshared\Constants\AiSubFlows.cs:9-36` |
| Lane | `AiWorkloadLane { Interactive, Bulk }` | Interactive | `IAICompletionService` params; `AiBudgetGovernor.AcquireAsync` | `clinqetshared\Enums\AiWorkloadLane.cs:10-14` |
| Failure-rate spike alert | `AIEnrichmentMonitoring:{WindowMinutes,FailureRateThreshold,MinimumSampleSize,AlertCooldownMinutes}` | 10 / 0.5 / 5 / 30 | `AiEnrichmentFailureTracker` hosted singleton (`Program.cs:1134-1138`) | `appsettings.json:3325-3330` |
| Time-budget / content-cap / capacity alerts | dial named per call | — | `IPlatformLimitAlerts.{ReportContentLimitAsync,ReportCapacityPressureAsync,ReportTimeBudgetExceededAsync,ReportAttemptBudgetExhaustedAsync}` (fire-and-forget) | `clinqetcore\Interfaces\AI\IPlatformLimitAlerts.cs:11-70`; `AIAssistantController.cs:1029-1036` |
| Model pin convention test | per-flow `*DeploymentName` keys | — | `AiModelPinConventionTests` — §5.3 | `AiModelPinConventionTests.cs:55-150` |
| Memory cache size | `MemoryCache:SizeLimit` | 50000 | every `Set` carries `Size = 1` (`McpSessionService.cs:201`); scanned by `MemoryCacheSizeConventionTests` | `Program.cs:211-217` |
| Prompt caching | none (Azure behaviour) | — | measured: identical catalogue prefix billed at the cached rate (11,520/11,960 tokens cached) ⇒ never quote cost without cached/uncached; `CachedTokens` is mapped from `prompt_tokens_details.cached_tokens` | memory `ai-cost-quality-phases5-6-2026-08-30.md:17`; `AICompletionService.cs:570`; `McpAIService.cs:357` |

### 6.5 Registration pattern a NEW AI flow must follow

(What every one of the 27 existing sub-flows does; each step has a build-breaking pin.)

1. **Sub-flow id** — add a constant to `AiSubFlows` (`clinqetshared\Constants\AiSubFlows.cs:9-36`). A shared class takes the id from its CALLER (`:3-6`).
2. **Dial registration** — add `[AiSubFlows.<New>] = "<Section>:<MaxCompletionTokens key>"` to `AiBudgetCutoffAlerts.BudgetDialBySubFlow` (`:22-53`). Missing ⇒ `EverySubFlowId_HasARegisteredBudgetDial` fails the **Functions** build.
3. **Per-flow settings** — `DeploymentName` (`string?`, null ⇒ `AIService:DeploymentName`), `ReasoningEffort` (`ReasoningEffort?`, null ⇒ global), `MaxCompletionTokens`, optional `Temperature`; class default = an `AiModels` constant, never a literal (`AiModels.cs:3-4`); mirror in the owning host's `appsettings.json`. Pattern instances: `TextEnhancementSettings.DeploymentName/ReasoningEffort` (`AIAssistantSettings.cs:31-34`), `ServiceApprovalSettings.ContentValidation*` (`AIServiceSettings.cs:55-63`).
4. **Call the seam with attribution** — `IAICompletionService.Get*Async(..., deploymentName, maxCompletionTokens, temperature, reasoningEffort, lane, subFlowId)` (`clinqetcore\Interfaces\AI\IAICompletionService.cs:11-14`); the seam then logs the cost line, reports cut-offs and honours temperature omission automatically (`AICompletionService.cs:387-400,463-475,551-559`). A flow that owns its own transport (A1, A3) must replicate the usage line + `ReportCentralCutoffAsync` itself (`TextEnhancementService.cs:177-186,206-219`; `McpAIService.cs:236-242,355-365`).
5. **Model pin** — add the new `*DeploymentName` key to `AiModelPinConventionTests.LunaPins()` (or a mini pin) in the owning host's suite (`:62-83`) and to `EveryRegionOverride_MatchesTheBaseDecision` if the stamp files override it (`:130-150`); latency-bound `ReasoningEffort` dials get an explicit pin (`:97-104`).
6. **Rate limiting** (user-triggered flows) — see §6.1: new `AIEndpointRateLimitSettings` property on `AIRateLimitingSettings` (`AIAssistantSettings.cs:185-192`) + appsettings block (`appsettings.json:2199-2220`) + a `case` in `GetEndpointConfig` (`:224-233`), **or** pass the config explicitly (`:37-40`); check the request window BEFORE the model call and `RecordTokenUsageAsync` after (`AIAssistantController.cs:452-458`; `McpAIService.cs:234`); zero-consume token probe pattern at `AIAssistantController.cs:807-815`.
7. **Daily abuse cap** (if the flow counts as "AI text") — reuse `EnforceAiTextAbuseCapAsync` (`AIAssistantController.cs:176-198`). This is the only scale-out-durable limiter.
8. **Pricing** — nothing to add unless a NEW model appears; then `AIService:TokenPricing` in all three hosts + class default (`AIServiceSettings.cs:29-35`), pinned both ways by `AiTokenPricingConventionTests` per host.
9. **deploy.ps1** — write an env var ONLY for a "swap-trap" key that must differ per environment (`VoiceCall__SummaryDeploymentName`, `Voice__ExpertCheck__DeploymentName`, `Search__SpellCheck__Llm__DeploymentName`, `AzureDocumentIntelligence__*DeploymentName`: `deploy.ps1:1920,1929,6896,6907-6915,7070-7075`); per-flow keys with a null ⇒ global fallback are deliberately NOT written, because an empty env var would bind `""` and break the URL (memory `ai-cost-quality-phases1-35-2026-08-30.md:18`).
10. **Tests live with the runtime consumer** (CLAUDE.md §0.18): an API-hosted flow's tests go to `Clinqet.API.UnitTests` (e.g. `TextEnhancementRoutingTests` proves the dials reach the wire: deployment in the URL, effort in the body, `None` ⇒ no temperature — `:57-104`).

---

## 7. Existing tests

`McpAIStreamingTests` fixture pattern (`clinqetapi\Clinqet.API.UnitTests\Services\AI\McpAIStreamingTests.cs:1-70`): constructs the real `McpAIService` with `Mock<IMcpToolGateway>`, `Mock<IMcpSessionService>`, `Mock<IAiRateLimitingService>`, `Mock<ILocalizationService>` (returns the key), `Mock.Of<IAiBudgetCutoffAlerts>()`, real `AIAssistantSettings` defaults and an `AIServiceSettings` with a fake endpoint/key/deployment (`:24-55`). Its header states the limit explicitly: *"Covers only paths that never reach the Azure OpenAI chat client (limits, gateway failures, consumer abandonment); the live chat stream itself is exercised by manual/E2E testing."* (`:14-15`). ⇒ **No automated test in the repo exercises token streaming or tool-call accumulation against a fake model** — the sealed SDK `ChatClient` is constructed inside the service (`McpAIService.cs:55-59`), so a new streaming flow that wants unit coverage of the loop needs a seam (an interface over the chat client, or the raw-HTTP style used by `AICompletionService`, whose seam IS testable — `AICompletionServiceTests.cs`, `TextEnhancementRoutingTests.cs`).

Found (paths absolute under `C:\Nik\clinqetapi\` unless stated):

| File | What it covers | Method names (selection) |
|---|---|---|
| `Clinqet.API.UnitTests\Services\AI\McpAIStreamingTests.cs` | the SSE producer/consumer contract of `McpAIService` | `StreamAIResponseAsync_SessionOverConversationLimit_YieldsRateLimitedErrorOnly` (`:72`), `…_GatewaySessionCreationFails_YieldsAnalyzerThenErrorAndCompletes` (`:92`), `…_ToolSessionDisposeThrows_SwallowsAndStillCompletesStream` (`:110`), `…_GatewayNotConfigured_RunsToollessAndNeverCreatesSession` (`:132`), `…_ConsumerAbandonsEarly_CancelsProducerAndDisposesToolSession` (`:148`) |
| `Clinqet.API.UnitTests\Services\AI\McpServiceTests.cs` | text/voice routing + provider setup | `ProcessTextInputAsync_WithValidRequest_ReturnsUserInputEvent` (`:265`), `ProcessVoiceInputAsync_WithEmptyAudioData_ThrowsArgumentException` (`:293`), 30+ setup cases (`:304-1005`) |
| `Clinqet.API.UnitTests\Services\AI\McpSessionServiceTests.cs` | session create/get/remove/add-turn | `:44,62,85,98` |
| `Clinqet.API.UnitTests\Services\AI\TextEnhancementRoutingTests.cs` | dials reach the wire (deployment in URL, effort in body, None ⇒ no temperature) | `:57,71,90,104` |
| `Clinqet.API.UnitTests\Services\McpToolGatewayTests.cs` | gateway config + binding lifecycle | `:68,85,94,103,115` |
| `Clinqet.API.UnitTests\Conventions\ChatToolAllowlistConventionTests.cs` | appsettings allowlist == class default; the MCP repo carries the identical test so the two hosts cannot drift (header `:1-3`) | `ApiAppsettings_ChatToolAllowlist_MatchesClassDefaultExactly` (`:14`) |
| `Clinqet.API.UnitTests\Conventions\AiModelPinConventionTests.cs` | every owned flow pinned; host default stays mini; region overrides match (§5.3) | `:56,79,89,100,109,119,133` |
| `Clinqet.API.UnitTests\Controllers\AIAssistantControllerAbuseCapTests.cs` | daily abuse cap 429/alert | `:124-223` |
| `Clinqet.API.UnitTests\Controllers\AIAssistantControllerProviderSetupAuditTests.cs` | setup endpoint audit | not read |
| `Clinqet.API.UnitTests\Services\AICompletionServiceTests.cs` | seam incl. luna temperature omission | `:663-671` |
| `Clinqet.API.UnitTests\Services\AiBudgetGovernorTests.cs` | governor | not read |
| `Clinqet.API.UnitTests\Services\AI\DocumentIntelligenceServiceTests.cs` | extraction schema strict-subset guard etc. | `:500` |
| `Clinqet.API.UnitTests\Repositories\AiSessionRepositoryTests.cs` | session repo | not read |
| `Clinqet.API.UnitTests\Utilities\McpStartupGuardTests.cs` | prod config guard | not read |
| `Clinqet.API.IntegrationTests\Controllers\AIAssistantControllerIntegrationTests.cs` | **authorization only**: customer token → 403 on chat/sessions/setup; partner token not forbidden | `:43,57,67,78,89,100,110` |
| web `C:\Nik\clinqetwebpartnerapp\src\services\aiServices.providerSetup.test.js` | setup SSE client + onboarding escape guard | file confirmed present 2026-09-02 |
| mobile `C:\Nik\clinqetmobilepartnerapp\__tests__\aiAssistantModalParity.test.ts` | web/mobile setup-dialog parity + onboarding escape guard | **path confirmed present** 2026-09-02 (`ls` of `__tests__`) |
| FN `Clinqet.Communications.UnitTests\Knowledge\AiBudgetCutoffAlertsTests.cs` | cut-off alert body/cooldown/master-switch (`:45-165`) + dial-map completeness (`:170-186`) | 9 facts, 187 lines |
| `Clinqet.API.UnitTests\Conventions\AiTokenPricingConventionTests.cs` (+ FN, MCP copies) | pricing map mirrors class defaults both ways | `:13-14` |
| `Clinqet.API.UnitTests\Services\AI\ProviderSetupDocumentReaderTests.cs`, `ProviderSetupImageServiceTests.cs` | setup reader / image lane | present |

**Skill-named tests that do NOT exist — CLOSED, confirmed two ways** (2026-09-02):
1. `find clinqetapi clinqetfuncations clinqetmcp clinqetidentity -type d \( -name bin -o -name obj \) -prune -o -type f -name "<Name>.cs" -print` → **NOT FOUND** for all seven.
2. `grep -rEn "class (McpAIServiceTests|McpToolDiscoveryServiceTests|McpToolExecutionServiceTests|AiRateLimitingServiceTests|SpeechServiceTests|TextEnhancementServiceTests|AiEnrichmentFailureTrackerTests)\b" --include=*.cs` over the same four repos (bin/obj filtered) → **zero hits**.
⇒ `SKILL.md:597-606` is stale in full. The nearest real equivalents are `McpAIStreamingTests` and `TextEnhancementRoutingTests`.

**No integration test drives `/ai/chat` end to end with a mocked model** — the integration file has only 403/200 authorization checks (`:42-110`); the skill's "POST /chat → SSE end-to-end with mocked AI provider" (`SKILL.md:613`) is NOT FOUND. **No rate-limiter test of any kind**: grep `AiRateLimitingService` in `Clinqet.API.UnitTests` + `Clinqet.API.IntegrationTests` → NOT FOUND — so nothing today pins the in-process-only behaviour or the unlimited-on-unknown-endpoint hole documented in §6.1.

**Other convention guards a new endpoint/page will meet** (all in `clinqetapi\Clinqet.API.UnitTests\Conventions\`, headers read): `ProviderEndpointAuthorizationTests` (*"A mistyped key is not a compile error — it is an endpoint nobody can ever reach"*, `:16-19`); `EndpointIdentityClassificationTests` (derives BUSINESS- vs PERSON-scoped from **which identity helper the action body calls**, and pins both directions: a `[RequiresPermission]` action must genuinely act in a business context, and a person-only action must NOT carry it — `:11-24`); `OrphanPermissionRegistryTests` (a permission key no code consumes is a *"catalogue promise the code does not keep"*; the exemption list fails if it **grows OR shrinks** without being updated, `:7-17`); `PermissionCatalogueLocalizationTests` (every catalogue permission and role needs a `Permission_…_Name`/`_Description` in **all five** files — `Languages = ["en","es","fr","hi","gu"]`, `:24` — diffed against the catalogue in both directions, `:32-119`); `NavigationGatesMatchControllerPermissionsTests` (the route→permission map lives in the clients' shared rendering rules and is compared against the real `[RequiresPermission]`; spans two artefacts by §0.15); `CatalogueScopeCoverageTests` (the catalogue grants only `Business` and `Assigned` of the seven `PermissionScope` values); `RoleAccessSummaryCatalogTests`; `LocalizationSourceConventionTests` (`EveryLiteralLocalizationKeyExistsInEnglishCatalog` `:26`, `UserFacingControllersContainNoLiteralFailuresOrEnglishLocalizationFallbacks` `:56`); `MemoryCacheSizeConventionTests` (scans all backend source this host compiles — its own + the shared libraries, never a peer host — and forbids the `(key, value, TimeSpan/DateTimeOffset)` `Set` overloads outright).

---

## 8. Business scoping of the text assistant

### 8.1 API side — how `BaseController.Tenant` is resolved (**CLOSED**)

- `BaseController.Tenant` is a computed property, not injected state:
  ```csharp
  protected TenantContext? Tenant =>
      HttpContext.Items.TryGetValue(TenantContextItemKeys.TenantContext, out var value)
          ? value as TenantContext
          : null;
  ```
  (`clinqetapi\Clinqet.API\Controllers\Base\BaseController.cs:227-231`.) The comment above it fixes the contract (`:224-226`): *"The validated acting workspace, built once per request by TenantContextMiddleware from the SIGNED token — never a route, header or body value. Null on a customer/admin request and on a provider request whose membership no longer resolves."*
- `GetCurrentBusinessId() => Tenant?.BusinessId` (`:232`); `GetCurrentMembershipId() => Tenant?.MembershipId` (`:234`). `GetCurrentUserNumber()` reads the `UserNumber` claim and is explicitly *"The PERSON, not the business"* (`:236-249`).
- Producer: `TenantContextMiddleware.InvokeAsync(HttpContext, IAuthorizationSnapshotProvider)` (`clinqetapi\Clinqet.API\Middleware\TenantContextMiddleware.cs:32-87`), in order:
  1. Not authenticated ⇒ pass through, no work (`:34-38`).
  2. No `BusinessId` claim ⇒ pass through — *"A customer or admin token carries no BusinessId claim and costs nothing here"* (`:16-17,40-45`). This is why `Tenant` is null for customers/admins.
  3. Read `MembershipId` + `AuthorizationVersion` claims (`:47-48`; claim names `clinqetshared\Constants\BusinessContextClaimTypes.cs:8-12`). Either missing/unparseable ⇒ `LogWarning` + `Fail(…, BusinessContextInvalid)` and continue (`:50-60`).
  4. `await snapshotProvider.GetAsync(membershipId, businessId, authorizationVersion, context.RequestAborted)` — the live membership re-check (`:62`). `!Granted || Snapshot is null` ⇒ `Fail(context, result)` and continue (`:64-69`).
  5. Success ⇒ stamp `context.Items[TenantContextItemKeys.TenantContext] = new TenantContext(snapshot.UserId, UserNumber claim, snapshot.BusinessId, snapshot.MembershipId, snapshot.AuthorizationVersion, result.AccessScope, snapshot.RelationshipType, snapshot.IsPrimaryOwner, snapshot.RoleKeys, snapshot.Permissions, snapshot.TeamIds, snapshot.BranchIds)` — **12 values** (`:71-84`).
- ‼️ **A failed resolution is RECORDED, never thrown.** `Fail` writes the `AuthorizationSnapshotResult` to `context.Items[TenantContextFailureKeys.Failure]` (`:11-14,89-90`) and the pipeline continues, *"because the same person's customer-side requests must keep working while their provider membership is suspended. Only `[RequiresPermission]` turns it into a 403"* (`:19-20`). So a controller that reads `GetCurrentBusinessId()` **without** `[RequiresPermission]` would see `null`, not a 403 — which is exactly what `EndpointIdentityClassificationTests` exists to prevent (§7).
- Pipeline order in the API host: `UseCors("B2CPolicy")` (`Program.cs:1587`) → `UseAuthentication()` (`:1592`) → **`UseTenantContext()`** (`:1596`) → `UseAuthorization()` (`:1598`) → … → `MapControllers()` (`:1676`). Registered via `TenantContextMiddlewareExtensions.UseTenantContext` (`TenantContextMiddleware.cs:93-97`).
- Permission keys: `ai.assistant.use` and `ai.document_intelligence.use` are catalogue rows `new("ai.assistant.use", "Ai", false)` / `new("ai.document_intelligence.use", "Ai", false)` (`clinqetinfrastructure\Data\SQL\TenancyRoleCatalogDefinition.cs:155-156`), where the record is `PermissionDefinition(string Key, string Module, bool IsSensitive)` (`:31`) — **both are `IsSensitive = false`**, i.e. no live-SQL re-check. They are granted to four system roles (`:214,227,241,268`). `CatalogVersion = 4` (`:18`), and the catalogue declares **94** permissions in total (`:49-178`). ‼️ Both AI keys sit in `RoleAccessSummaryCatalog.ExcludedPermissionKeys` (`:16-24`) — *"Supporting capabilities … not areas a person browses, so never a row"* — so they render **no row** in the provider's role-detail dialog.
- Authorization on the controller: `[Authorize]` class-wide (`AIAssistantController.cs:33`); `[RequiresPermission("ai.assistant.use", PermissionScope.Business)]` on speech/enhance/chat/sessions (`:232,322,431,1162,1192,1228`); `[RequiresPermission("ai.document_intelligence.use", PermissionScope.Business)]` on setup (`:626,758`); `ForbidUnlessPartnerAsync()` (403 unless `UserType.Partner`) on chat, setup, sessions (`:441,634,778,1165,1195,1231,1247-1254`).
- Data scoping: sessions partitioned by businessId (§3.7); `GetSessions` lists only the caller's partition (`AiSessionRepository.cs:154-159`).
- Language: `GetPreferredLanguage()` (`BaseController.cs:154-190`, reads a `Locale` claim at `:174`) is passed into the model prompt (`McpAIService.cs:449`) — see the `hi`/`gu` gap in §3.5.

### 8.2 MCP side — how `CallContext.BusinessId` is set (**CLOSED**)

- Accessor: `clinqetmcp\Clinqet.Mcp\Context\CallContextAccessor.cs` — `private static readonly AsyncLocal<CallContext?> Holder` (`:7`), exposing `Current` (`:9`), `Set(context)` with `ArgumentNullException.ThrowIfNull` (`:11-15`), `Clear()` (`:17`) and `Require()` which throws *"No authenticated call context is bound to this request."* (`:19-20`). Header comment (`:3-4`): *"AsyncLocal so the binding stamped by the auth middleware flows to tool handlers without any dependence on MCP session state (the server runs stateless — one binding per request)."*
- Payload: `Context\CallContext.cs` is a `sealed record` with `required string BusinessId` (`:7`), `required string CallId` (`:8`), `VoiceCallScope Scope`, `bool Verified`, `string? CustomerId`, `string? VerifiedBookingNumber`, and `VoiceCatalogSource CatalogSource = VoiceCatalogSource.Index` (`:5-18`).
- Producer: `clinqetmcp\Clinqet.Mcp\Middleware\McpChannelAuthMiddleware.cs`, gate order — secret path + bearer present (`:117`) → `tokenService.ValidateAsync(bearer)` (`:121`), invalid ⇒ 401 (`:125`) → binding lookup `sessionRepository.GetByCallIdAsync(claims.CallId, …)` (`:133`; a lookup exception logs and refuses, `:136-140`) → `session == null` ⇒ `RaiseAuthRejection("UnknownCallBinding")` + 401 (`:142-146`) → `session.Jti != claims.Jti` ⇒ `"TokenJtiMismatch"` + 401 (`:151-155`; *"The binding doc is the distributed source of truth: jti match makes a re-minted token…"*, `:149-150`) → `session.BusinessId != claims.BusinessId || session.Scope != claims.Scope` ⇒ `"BindingClaimMismatch"` + 401 (`:158-163`).
- ‼️ **Only then** `callContextAccessor.Set(new CallContext { BusinessId = session.BusinessId, CallId = session.CallId, Scope = session.Scope, Verified = …, CustomerId = …, VerifiedBookingNumber = …, CatalogSource = session.CatalogSource ?? VoiceCatalogSource.Index })` (`:166-176`) — **the businessId comes from the BINDING DOCUMENT, not from the token**, and the token must agree with it. `callContextAccessor.Clear()` runs in a `finally` around `_next` (`:178-185`).
- Chat leg into that: `McpToolGateway.CreateSessionAsync(businessId, ct)` mints `_tokenService.Mint(businessId, callId, VoiceCallScope.Partner, lifetime)` with `callId = "chat-" + guid` (`clinqetapi\Clinqet.API\Services\McpToolGateway.cs:48-57`; prefix constant `clinqetshared\Constants\ChatToolSessions.cs:8`), upserts the binding `VoiceCallSession { CallId, BusinessId, Scope = Partner, Phase = Active, Jti, Ttl }` **before** the MCP client connects (`:74-85`) and deletes it on dispose (`:94,136-148`); lifetime `Mcp:ChatToolSessionLifetimeMinutes` = 15 (`appsettings.json:2045`).
- Tool-side enforcement: `McpToolGuard` rate-limits and audits by `context.BusinessId` (`clinqetmcp\Clinqet.Mcp\Tools\McpToolGuard.cs:55-58,152`) and refuses non-allowlisted tools on `chat-` call ids (`:67-73`). **No tool exposes a `businessId` parameter to the model** (grep → NOT FOUND).
- The knowledge contract is explicit that tenant scope is server-bound: `KnowledgeSearchQuery` has no business field *"by construction — the search service takes it from the bound call context, so no caller (and therefore no model argument) can influence tenant scope"* (`clinqetshared\Models\Voice\KnowledgeSearchModels.cs:6-8`); `IProviderKnowledgeSearch`'s three-point isolation contract requires the scope clause to LEAD, per-row `businessId` verification, and *"one foreign row discards the WHOLE result set, alarms, and yields the safe non-answer (never a degrade)"* (`clinqetcore\Interfaces\Knowledge\IProviderKnowledgeSearch.cs:7-12`).

---

## 9. Reusable for Provider AI Search (concrete classes / methods)

**SSE + streaming**
- `AIAssistantController.EnsureSSEResponseHeaders()` / `WriteSSEEvent(AiResponseDto)` / `WriteErrorResponse(string, ErrorCode, Exception?)` (`:1256-1291`) — **private** today; the pattern (headers-once, `data:` frame, flush-per-event, `HasStarted`-aware error path) is what a new endpoint copies. Nothing extracts it, so either duplicate ~35 lines or lift it into a shared base/helper.
- `AiResponseDto` + `AiEventType` (`AIAssistantDtos.cs:99-132`) — the SSE payload contract both clients already parse. `metadata` (`Dictionary<string, object>`) is the only free-form slot; **there is no citation-shaped field** (no `AiCitationDto`, grep → NOT FOUND), so citation cards need either a new DTO + enum member or a metadata convention.
- `IMcpAIService.StreamAIResponseAsync(string userMessage, AiConversationContext context, string businessId, string language = "en", CancellationToken ct = default) → IAsyncEnumerable<AiResponseDto>` (`clinqetcore\Interfaces\AI\IMcpAIService.cs:7-12`) — the only streaming + tool loop in the platform; deployment, system prompt and tool source are hardwired to `AIService:DeploymentName`, `Mcp:BaseSystemPrompt` and the MCP catalog, and temperature is unconditional (§3.2). Reusable as a **pattern**; not parameterizable as-is.
- Producer/consumer plumbing worth copying verbatim: bounded `Channel<AiResponseDto>(100)` + linked CTS + `finally`-cancel + `SuppressThrowing` await of the producer (`McpAIService.cs:88-108`).

**Business-bound tool execution**
- `IMcpToolGateway.CreateSessionAsync(string businessId, CancellationToken)` → `IMcpToolSession { ListToolsAsync, CallToolAsync(string toolName, IReadOnlyDictionary<string, object?> args, CancellationToken) }` (`clinqetcore\Interfaces\AI\IMcpToolGateway.cs:7-18`), Singleton at `Program.cs:826`. ‼️ **`search_knowledge` and `send_material_info` are NOT in `Mcp:ChatToolAllowlist`** (16 names, `appsettings.json:2047-2064`) — the MCP server exposes them (`clinqetmcp\Clinqet.Mcp\Tools\KnowledgeTools.cs:79-88` / `:122-130`) but the chat gateway filters them out, and `ChatToolAllowlistConventionTests` pins the list in **both** repos, so widening it is a two-repo change plus an owner decision (DR-10).

**Knowledge retrieval — CLOSED, and the finding is load-bearing**
- Contract: `IProviderKnowledgeSearch` (`clinqetcore\Interfaces\Knowledge\IProviderKnowledgeSearch.cs:17-31`), two methods:
  - `SearchAsync(string businessId, KnowledgeSearchQuery query, CancellationToken)` → `KnowledgeSearchResult` (`:19-22`)
  - `GetByRefsAsync(string businessId, IReadOnlyList<string> refs, CancellationToken)` → `IReadOnlyList<KnowledgeCardRef>` (`:27-30`) — the cards behind send refs (`"{docId first 12 hex}:{chunkNo}"`), same isolation contract.
  Performance contract (`:14-16`): ONE hybrid request (BM25 + vector together), embedding fails soft to keyword-only in the same round trip, **no LLM anywhere on this path, and no minimum-score cutoff on hybrid results, ever** (RRF scores are rank-derived, not comparable across queries).
- ‼️ **`IProviderKnowledgeSearch` is registered ONLY in the MCP host.** `clinqetmcp\Clinqet.Mcp\Program.cs:288-289` registers `KnowledgeSearchDependencies` and `IProviderKnowledgeSearch → ProviderKnowledgeSearchService`, both **Scoped**. `grep -rn "IProviderKnowledgeSearch" --include=*.cs clinqetapi` → **zero hits**. The API host registers only the wrapper `KnowledgeSearchClient` (`clinqetapi\Clinqet.API\Program.cs:987-1000`). ⇒ **A Provider AI Search endpoint in `Clinqet.API` must add both registrations itself**; `ServiceRegistrationSelfContainmentTests` exists in that suite.
- ‼️ **Degradation differs between the hosts.** MCP builds a **null** client when `AISearch:Endpoint`/`ApiKey`/`KnowledgeIndexName` are unset, so an unprovisioned stamp yields the honest non-answer (`Program.cs:281-288`, and `KnowledgeSearchDependencies`' own comment, `IProviderKnowledgeSearch.cs:33-39`). The API host's factory **throws** `InvalidOperationException` on each of the three missing keys (`:990-996`) — a Singleton factory, so it throws on first resolution. Pick one deliberately.
- ‼️ **Citation fields: the model-facing shape has no page number.** `KnowledgePassage` (`clinqetshared\Models\Voice\KnowledgeSearchModels.cs:31-54`) carries `Content`, `DocName`, `SectionTitle?`, `LinkedOfferings[]` (capped, `:41`), `Ref?` (`:47`) and `ImageRef?` (`"{docId}:{imageId}"`, `:53`) — **no page**. `KnowledgeCardRef` (`:63-74`) DOES carry `PageNumber`, `DocTitle`, `DocId`, `ChunkNo` and `ChunkKind`. So the owner's "document + page + section" citation card is served by `GetByRefsAsync` (a second read-back keyed by ref), or by widening the passage projection — not by `SearchAsync` alone.
- `KnowledgeSearchResult` (`:24-29`) is `{ Outcome (VoiceKnowledgeOutcome), Passages[], Note }` — *"Every shape carries a note telling the model what to SAY, so a caller never meets a dead end"*. `ImageRef` presence IS the signal that a sendable picture exists (`:49-51`) — the hook for rendering document images.

**Sessions, limits, cost**
- `IMcpSessionService` (`clinqetcore\Interfaces\AI\IMcpSessionService.cs:6-69`) + `AiSessionRepository` — session/history persistence, Cosmos `Communications` partitioned by businessId, cache `Size = 1`.
- `IAiRateLimitingService.CheckRateLimitAsync(endpoint, businessId[, config])`, `CheckTokenRateLimitAsync`, `RecordTokenUsageAsync`, `GetStatusAsync`, `IsEndpointRateLimitEnabled` (`clinqetcore\Interfaces\AI\IAiRateLimitingService.cs:5-13`) — **read §6.1 first**: in-process only, and unknown endpoint names are unlimited.
- `IAICompletionService.GetCompletionWithUsageAsync(...)` / `GetStructuredCompletionAsync(...)` (`clinqetcore\Interfaces\AI\IAICompletionService.cs:11,13`) — non-streaming helpers, ideal for query rewriting, citation extraction and structured post-processing (strict JSON schema, `reasoning_effort`, temperature omission and cost logging all handled).
- `IAiBudgetCutoffAlerts.ReportCentralCutoffAsync(...)` (`IAiBudgetCutoffAlerts.cs:17-24`); `AiCompletionBudgetGuard.RunWithCutoffRetryAsync` (§6.3); `IPlatformLimitAlerts` (`IPlatformLimitAlerts.cs:11-70`); `ChatCostCalculator.Estimate` (`clinqetcore\Models\AI\ChatCostCalculator.cs:11-27`).

**Clients**
- Web `StreamProviderSetupDocument` frame reader (`aiServices.js:112-129,147-200`) and RN `streamSetupOnce` (`aiServices.ts:372-461`) — copy the reader, change the URL and body. The RN one already solves RN's no-`ReadableStream` problem, the 330 s stall guard and the 401-refresh-once retry; both already tolerate a tail frame without the trailing blank line.

---

## 10. Gaps / risks / open questions

1. `McpAIService` hardwires `Temperature = 0.7` and never sets `reasoning_effort` (`:173-177`) — incompatible with luna's **proven** temperature rule. Any luna experiment needs `AICompletionService.AcceptsTemperature`'s logic (`:397,517-518`) ported plus a `reasoning_effort` option.
2. **The repo's "luna cannot tool-call on Chat Completions" is prose in three places and a measurement in none** (§5.3) — while two neighbouring pins in the same file cite their corpus, n and metric. A dev probe (tools + `reasoning_effort=none` on `gpt-5.6-luna`) is the cheapest settlement; if it succeeds, `AiModels.cs:9-10` and `AiModelPinConventionTests.cs:15-18,53-54` must be re-worded, and A3 still needs a per-flow deployment key before the pin can move.
3. No client consumes `/ai/chat`; no chat UI exists in either provider app (§2.4-2.5). A new page is a MOCKUP-GATE item (CLAUDE.md §0.7.1) and must also land a `NavigationGatesMatchControllerPermissionsTests` map entry on both clients.
4. Multi-round tool history is lossy (`pendingToolCalls.Clear()`, `:247`) and the first model call duplicates the user message (§3.5) — tolerable for a 5-iteration loop; a retrieval-and-cite flow that re-queries across turns would be affected.
5. SSE frames serialize nulls (`SseJsonOptions`, `:36-39`) — ~10 null fields on every token frame. A token-per-frame answer pays that on every token; a new endpoint should set `DefaultIgnoreCondition = WhenWritingNull` in its own options.
6. `ToolExecution`/`ToolResult` messages are hardcoded English (`McpAIService.cs:269,281,591-592`) — a §0.10 violation if ever rendered. And `GetLanguageName` (`:452-464`) maps **neither `hi` nor `gu`**, so providers on two of the five shipped catalogues are instructed to answer in English (§3.5).
7. `AIService:ApiVersion` is ignored on the SDK path (§3.2) — two API versions are effectively in play (SDK default vs `2025-01-01-preview`).
8. luna's content filter is not enforced and it 500s on some images (§5.4) — relevant the moment a search answer embeds provider document images or echoes pasted content.
9. Class-default drift in `AIServiceSettings` (three keys) and `McpSettings.MaxTokens` (§4.3); orphan settings `Mcp:MaxContextTokens` and `Mcp:Session:MaxConcurrentSessions` are declared and never read (§3.2) — CLAUDE.md §4 hygiene.
10. Skill file stale in ten places (§1) — update in all four AI-tool directories when the feature lands (§0.9). The "89 permission keys" figure in `CLAUDE.md` is also stale (94, §8.1).
11. `search_knowledge` / `send_material_info` are excluded from `ChatToolAllowlist` (`appsettings.json:2047-2064`) — a knowledge-answering surface needs either the allowlist widened in **two repos** (owner decision DR-10) **or** a direct in-process `IProviderKnowledgeSearch` path, which is the cleaner option given item 12.
12. ‼️ **`IProviderKnowledgeSearch` is not registered in the API host at all** (§9) — the retrieval seam that the whole feature depends on currently exists only inside `Clinqet.Mcp`. Wiring it into `Clinqet.API` is a prerequisite, and the two hosts disagree on what an unprovisioned AI Search stamp should do (null client vs throw).
13. **The citation shape the owner asked for is not yet expressible**: `KnowledgePassage` has no page number (§9), and `AiResponseDto` has no citation field. Both need a decision — widen the passage projection, or compose cards from `GetByRefsAsync`.
14. **Nothing tests the rate limiter** (§7), and §6.1 shows two real holes it would catch: buckets are per-instance (N instances ⇒ N × the limit) and an endpoint name absent from the three-case switch is silently unlimited on the 2-arg overload. A new endpoint that forgets both the `case` and the explicit config ships with **no limit**.
15. **No test in the repo streams tokens or accumulates tool calls against a fake model** (§7) — the sealed SDK `ChatClient` is `new`ed inside `McpAIService`. A new streaming flow that wants unit coverage of its loop must introduce a seam first; §0.8 makes tests mandatory, so this is a design constraint, not a nice-to-have.

---

## 11. What a NEW streaming tool-calling flow in `Clinqet.API` must wire up

An ordered, self-contained checklist. Every line is a fact established above; the § reference is where the evidence sits.

**A. Transport and DTOs**
1. **Choose the transport deliberately.** Only `McpAIService` streams (SDK `ChatClient.CompleteChatStreamingAsync`, §3.6). `AICompletionService` and `TextEnhancementService` are raw-HTTP and non-streaming with no `stream` field in the request body. There is no Responses-API client anywhere (§3.1). A new streaming flow either reuses the SDK pattern or adds `"stream": true` handling to a raw-HTTP path that does not have it today.
2. **Introduce a seam if the loop needs unit tests.** `McpAIService` constructs the sealed `ChatClient` in its own ctor (`McpAIService.cs:55-59`), which is why `McpAIStreamingTests` covers only the paths that never reach the model (§7). §0.8 requires tests, so plan an interface over the chat client (or the raw-HTTP shape, which `TextEnhancementRoutingTests` proves is testable).
3. **SSE frames**: copy `EnsureSSEResponseHeaders` / `WriteSSEEvent` / `WriteErrorResponse` (`AIAssistantController.cs:1256-1291`) — private, so duplicate or extract. Set `DefaultIgnoreCondition = WhenWritingNull` in your own `JsonSerializerOptions` (the existing one does not, §10 item 5). Keep the `HasStarted`-aware error path: JSON `ApiResponse` before the first byte, SSE `Error` event after.
4. **Payload**: reuse `AiResponseDto` + `AiEventType` (`AIAssistantDtos.cs:99-132`) so both existing readers work unchanged, or add a new DTO. Citation cards need a new field/enum member or a `metadata` convention — there is no citation DTO today (§9).
5. **Cancellation plumbing**: bounded `Channel<T>(100, FullMode.Wait)`, linked CTS cancelled in `finally`, producer awaited with `SuppressThrowing` (`McpAIService.cs:88-108`).

**B. Authorization and tenancy** (§8)
6. `[Authorize]` + `[RequiresPermission("<key>", PermissionScope.Business)]` on the action, and `ForbidUnlessPartnerAsync()` if it must be provider-only. Read the business id **only** from `GetCurrentBusinessId()` (`BaseController.cs:232`) — never a route, header or body value.
7. **A new permission key is a five-part change**: a `PermissionDefinition(key, module, isSensitive)` row in `TenancyRoleCatalogDefinition.Permissions` (`:49-178`, currently 94 rows) → **bump `CatalogVersion`** (`:18`, now 4) → grants on the system roles that should hold it (`:214,227,241,268` are the AI precedents) → `Permission_<key>_Name`/`_Description` in **all five** localization catalogues (`en, es, fr, gu, hi`), pinned both ways by `PermissionCatalogueLocalizationTests` → a decision on `RoleAccessSummaryCatalog.ExcludedPermissionKeys` (`:16-24`; both AI keys are excluded, so they show no row in the role dialog). `OrphanPermissionRegistryTests` fails if the key has no consumer, and `ProviderEndpointAuthorizationTests` fails on a mistyped key. Reusing `ai.assistant.use` avoids all of this — and gives the new surface exactly the audience the chat assistant has.
8. `EndpointIdentityClassificationTests` derives business-vs-person scope from **which identity helper your action body calls**: if it calls `GetCurrentBusinessId()` it must carry `[RequiresPermission]`, and if it resolves only the person it must not.

**C. Retrieval** (§9)
9. Register the retrieval seam in the API host — it is **not** there today: `KnowledgeSearchDependencies` + `IProviderKnowledgeSearch → ProviderKnowledgeSearchService`, both Scoped, mirroring `clinqetmcp\Clinqet.Mcp\Program.cs:288-289`.
10. Decide the unprovisioned-stamp behaviour: the API's existing `KnowledgeSearchClient` factory **throws** on missing `AISearch:*` keys (`Program.cs:990-996`); MCP degrades to a null client. India runs its chat toolless already (§3.3), so the degrade path is the safer default.
11. Pass the server-bound businessId as the first argument to `SearchAsync`/`GetByRefsAsync`. Never accept a business id from the model or the request body — `KnowledgeSearchQuery` has no such field by construction (`KnowledgeSearchModels.cs:6-8`), and the isolation contract fails closed on one foreign row (`IProviderKnowledgeSearch.cs:7-12`).
12. For "document + page + section" citations, plan the `GetByRefsAsync` read-back: `KnowledgePassage` carries no page number; `KnowledgeCardRef` does (`KnowledgeSearchModels.cs:31-54,63-74`). Pictures ride `ImageRef` (`"{docId}:{imageId}"`).
13. If tools rather than direct retrieval: `search_knowledge` and `send_material_info` are **not** in `Mcp:ChatToolAllowlist` (16 names, `appsettings.json:2047-2064`), pinned in two repos by `ChatToolAllowlistConventionTests`. Widening it is an owner decision (DR-10) and a two-repo change.

**D. Cost, budget and metering** (§6)
14. `AiSubFlows` constant — add one, pattern `"<letter><n>-<slug>"` (`AiSubFlows.cs:9-36`, 28 constants today).
15. `AiBudgetCutoffAlerts.BudgetDialBySubFlow` entry naming the `MaxCompletionTokens` dial (`:22-53`). Omitting it **fails the Functions build** via `EverySubFlowId_HasARegisteredBudgetDial` (`AiBudgetCutoffAlertsTests.cs:170-186`), which also fails on an orphan.
16. Per-flow settings: `DeploymentName` (`string?`, null ⇒ global), `ReasoningEffort?`, `MaxCompletionTokens`, optional `Temperature`; class defaults must name an `AiModels` constant and mirror `appsettings.json` exactly.
17. `AiModelPinConventionTests`: add the `*DeploymentName` pin (`:62-83`), the region-override pin if the stamps override it (`:130-150`), and an explicit `ReasoningEffort` pin if the call is latency-bound (`:97-104`).
18. **Owning your own transport means owning the metering**: a flow that does not go through `IAICompletionService` must itself emit the KQL-summable usage line via `ChatCostCalculator.Estimate` and call `ReportCentralCutoffAsync` on `finish_reason == length` — exactly what A1 and A3 do (`TextEnhancementService.cs:177-186,206-219`; `McpAIService.cs:236-242,355-365`).
19. Truncation: use `AiCompletionBudgetGuard.RunWithCutoffRetryAsync` for structured calls (one retry at ×3, second truncation returned to you to degrade **and alert** — the guard does not alert, §6.3).
20. `AiWorkloadLane.Interactive` for a user-facing search (the `AiBudgetGovernor` returns immediately for Interactive, `AiBudgetGovernor.cs:66`).

**E. Rate limiting** (§6.1 — read it before writing this)
21. Either add a `case` to `AiRateLimitingService.GetEndpointConfig` (`:224-233`) plus a property on `AIRateLimitingSettings` (`AIAssistantSettings.cs:185-192`) plus an appsettings block (`:2199-2220`), **or** pass an explicit `AIEndpointRateLimitSettings` through the 3-arg overload (`:37-40`). Doing neither means the endpoint is **unlimited** — the switch returns `null` for any unknown name and the check short-circuits to "allowed".
22. Check the request window before the model call; `RecordTokenUsageAsync` after each turn; use the zero-consume token probe pattern (`AIAssistantController.cs:807-815`) if you want a pre-flight token check.
23. Remember the per-instance ceiling: these buckets are an in-process `ConcurrentDictionary`, so N instances give N × the limit. Anything that must hold across scale-out uses the durable atomic counter — `EnforceAiTextAbuseCapAsync` (`AIAssistantController.cs:176-198`), gated by `Payment:UsageCapsEnabled` and the `ai_text_daily_limit` entitlement.
24. Prefer the explicit-config overload only if you accept the bucket-cleanup gap: buckets keyed to an endpoint the switch does not know are never evicted (`:246-248`).

**F. Sessions and caching** (§3.7)
25. If the flow keeps conversational state, reuse `IMcpSessionService` + `AiSessionRepository` (Cosmos `Communications`, partition value = businessId, single-partition queries only — §0.6). Any new `IMemoryCache` write **must** carry `Size = 1` via `MemoryCacheEntryOptions`/`SetSize(1)`/`entry.Size = 1`; the `(key, value, TimeSpan)` overloads are forbidden and `MemoryCacheSizeConventionTests` scans for them.

**G. Localization and settings hygiene**
26. Every user-visible string is a key in **all five** files under `clinqetinfrastructure\Resources\Localization\` (`en, es, fr, gu, hi`); `LocalizationSourceConventionTests` pins that every literal key exists in `en.json` and that user-facing controllers carry no English fallback. Do **not** copy `McpAIService`'s hardcoded `"Executing: {name}"` / `"Tool executed successfully"` (§10 item 6), and if the flow prompts the model in the caller's language, extend `GetLanguageName` (`:452-464`) to cover `hi` and `gu`.
27. No orphan keys: every new setting needs a runtime reader before merge (CLAUDE.md §4). `Mcp:MaxContextTokens` and `Mcp:Session:MaxConcurrentSessions` are the cautionary examples (§3.2).
28. `deploy.ps1` + ARM: add an env var only for a per-environment "swap-trap" key (`deploy.ps1:6896,6907-6915,7070-7075` are the precedents); a per-flow key with a null ⇒ global fallback is deliberately NOT written, because an empty env var binds `""`.

**H. Clients** (§2.4-2.5, §0.7.1)
29. Mockup first — web **and** mobile, every state (empty, loading, error, permission-denied, limit-reached) — under `C:\Nik\Data\mockups\`, owner-approved before any integrated UI code.
30. Web reader: copy `parseSSEEvents` + `getReader()` loop from `aiServices.js:112-129,147-200`. Mobile reader: copy `streamSetupOnce` from `aiServices.ts:372-461` (XHR because RN's fetch buffers, stall timer, 401-refresh-once, tail-frame drain). Both apps ship in the same session (§0.7.1), and the rail entry needs a `NavigationGatesMatchControllerPermissionsTests` map row matching the controller's `[RequiresPermission]`.

**I. Tests** (§0.8, §0.18, §7)
31. Unit tests in `Clinqet.API.UnitTests` (the API host is the runtime consumer of an API-hosted flow), integration tests in `Clinqet.API.IntegrationTests`. The dial-map test is the one exception that belongs to the Functions suite. Cross-business isolation is the mandatory integration case — a leak here is the company-ending risk in the brief — and the current AI integration file only checks 403/200 authorization (`AIAssistantControllerIntegrationTests.cs:42-110`), so there is no precedent to copy for the retrieval-scope proof.
32. Never read a peer repo from a test (§0.15/§0.17). The path-resolution pattern to copy is `AiModelPinConventionTests.ResolveAppSettings()` (`:26-38`) — it walks up for this host's own `appsettings.json` and **throws** rather than silently passing on zero files.
