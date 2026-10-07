# AI resource-limit and timeout alerts — implementation audit

Date: 2026-09-15. Scope: shared AI transports and alert publication, Main API, Functions, MCP, Identity inventory, admin alert filters, and regression tests. This records local verification, not a claim that an Azure deployment has been exercised or that the whole platform is defect-free.

## Owner decisions and resulting behavior

- Two dedicated types: `AiSearchResourceLimit` and `AiModelResourceLimit`.
- Two independent, enabled-by-default gates under `AdminAlertSettings`: `EnableAiSearchResourceLimitAlerts` and `EnableAiModelResourceLimitAlerts`. Neither depends on `EnableSystemFailureAlerts`.
- A 15-minute cooldown is enforced **in code**, shared across businesses within a host process, per resource hostname/port and Search/Model kind. A different business, deployment path or query does not create another cooldown entry.
- Restart/scale-out duplicates are accepted by the owner. No Service Bus duplicate-detection change, queue recreation, new queue, infrastructure resource or schema change was introduced.
- Resource alerts use the existing admin-alerts queue and processor. Existing workflow-specific capacity/timeout diagnostics remain in place.

## Coverage inventory

| Host/boundary | Covered registrations | Observation point |
|---|---|---|
| Main API Search | Service, provider and knowledge Search clients | Shared `AiSearchClientFactory` / per-retry policy |
| Functions Search | Service, provider and knowledge Search clients | Same factory/policy |
| MCP Search | Catalog and knowledge clients, when configured | Same factory/policy |
| Main API model HTTP | Completion, text enhancement, fast transcription, document intelligence, business search, embedding, query understanding | `AiModelResourceLimitHandler` on all seven registrations |
| Functions model HTTP | Voice transcription, completion, query understanding, realtime call REST, embedding, document intelligence | Handler on all six registrations |
| MCP model HTTP | Embedding, completion, realtime call REST | Handler on all three registrations |
| Speech SDK | Recognition and translation SDK cancellations | `SpeechService.ReportResourceLimit` |
| Realtime WebSocket | Shared socket factory used by voice monitor/relay | Handshake status and received structured error events |
| Identity | No AI model/Search client found in the current host | Own-host guard prevents silently introducing an unreviewed client |
| Admin web | Existing alert list/filter/details | Both enum names added to `AlertsPage.jsx`; metadata uses existing rendering |

The generic Search policy observes querying, paging, suggestions, indexing and other requests performed by these clients. The guard asserts the only direct production `new SearchClient` is in the shared factory. Each host's guard scans its own source and the shared infrastructure library; it does not require a peer host checkout. Guards also classify every current HTTP registration and fail on an unclassified registration. Source guards complement, rather than replace, runtime tests and code review; they cannot prove arbitrary future code uses the correct client.

## Failure classification and response preservation

| Failure | Behavior |
|---|---|
| HTTP 429 or 503 | Report the corresponding resource kind immediately, before inspecting a body |
| HTTP 408 or 504 | Report timeout for Search or Model |
| Search HTTP 402 | Report Search capacity/quota failure |
| Allowlisted structured quota/rate-limit codes | Report from JSON or SSE; Search also inspects structured errors on other HTTP error statuses |
| Search semantic `capacityOverloaded` | Report while preserving returned partial documents |
| Search semantic `maxWaitExceeded` | Report timeout while preserving returned partial documents |
| Search indexing 207 with failed resource statuses | Inspect individual indexing results |
| Search SDK network timeout | Report `Timeout`, rethrow the original exception |
| Explicit caller cancellation | Do not manufacture a resource failure |
| Speech `TooManyRequests`, `ServiceUnavailable`, `ServiceTimeout` | Report HTTP-equivalent 429, 503, 408 respectively |
| WebSocket rejected handshake | Report matching HTTP resource/timeout status; preserve exception |
| WebSocket `error` / `response.done.status_details.error` | Report allowlisted structured errors, preserve the received frame |
| Authentication, content filtering, unrelated validation errors | No resource alert solely because of that error |
| Ordinary generated text mentioning quota/429 | No alert: classification uses structured fields, not message-text matching |

HTTP observers do not change retries, fallback, response status, payload bytes or model output. The Search policy restores buffered stream position. SSE inspection handles fragmented reads, CRLF/LF, multiple data lines, comments and an error event at EOF. JSON parsing failures are diagnostic-only; the original body continues to the consumer.

**Timeout distinction:** a transport cannot tell whether a canceled caller token represents a user disconnect, shutdown or an application's own budget. Search SDK network timeouts and server-reported timeouts are covered centrally. Application-owned linked-token deadlines remain with the owning workflow: the existing semantic-ranker deadline reports its capacity diagnostic, and the completion service retains its existing final-timeout reporting. This change does not claim every local budget cancellation becomes the new dedicated resource alert. That would require explicit deadline context at each owner, not guessing from `OperationCanceledException`.

## Configuration and metadata

| Setting under `AiResourceLimitAlerts` | Default | Validated range |
|---|---:|---:|
| `CooldownMinutes` | 15 | 1–1440 |
| `PublishTimeoutSeconds` | 30 | 1–300 |
| `FailedPublishCooldownSeconds` | 30 | 1–300 |
| `MaxInspectionBytes` | 65536 | 1024–4194304 |

Defaults match the shared options class and all three AI-host appsettings. Identity has no unused AI settings. No `local.settings.json` keys or deployment resources were added.

The existing metadata dictionary carries resource hostname/port, Search/Model kind, HTTP status (0 when unknown), structured code, Timeout/ResourceLimit classification, cooldown, source application, environment and an existing trace ID when available. Existing request tenancy supplies BusinessId when available; no additional database read is made. A person UserNumber is not substituted for a BusinessId. Background work may have no business context. Because cooldown is per resource, metadata reflects the first accepted report, not every affected business.

URL paths, query strings, userinfo, prompts and credentials are not copied into alert metadata. Cosmos serialization camel-cases dictionary keys; persistence tests assert the stored representation.

## Memory, CPU, concurrency and cost

The publisher holds one small dictionary state per observed resource/type, not per request, business or failure. A lock serializes the admission decision. In-flight sends and active cooldowns cannot be removed by cleanup. An infrequent host-owned timer removes expired completed entries. Dictionary capacity can retain its historical peak; it is not a fixed-cap cache. Registered endpoints are configuration-controlled, so normal cardinality follows the small resource inventory.

The suppressed-report path returns before allocating an alert, metadata, task or request context. The regression test warms that path, invokes it **100,000 times**, checks **less than 1 KB total allocation on the calling thread**, and confirms one send. This is an allocation regression test, not a production latency or throughput benchmark. The short lock and hostname lookup still cost CPU.

Model response inspection adds linear byte scanning and a response/event buffer whose retained payload length is capped by `MaxInspectionBytes` (64 KiB by default). `MemoryStream` capacity growth and temporary JSON parsing add allocation overhead; the configured payload cap is not a total process-memory cap. Healthy JSON/SSE without an error marker avoids JSON parsing. Search reuses the SDK's already-buffered response and skips parsing healthy bodies without a semantic-partial marker. Realtime inspection reuses the existing complete-message buffer. All inspection streams/JSON documents are disposed.

**Bounded inspection tradeoff:** an oversized model JSON envelope or SSE event is not parsed for an embedded error. HTTP status-based alerts still fire regardless of body size. Unconsumed bodies and malformed/nonstandard error envelopes cannot be guaranteed to produce a structured-body alert. This bound protects request memory and is explicitly configurable; it is not an unlimited-body guarantee.

Only an admitted alert schedules publication. Suppressed failures cause no Service Bus message and no Cosmos write. A continuously failing resource normally produces at most about four admitted sends per hour per running process after successful sends, rather than one message per failed API request. Distinct Search/Model kinds have independent cooldown entries.

## Publication lifecycle and delivery limits

The singleton is host-owned. Background publication suppresses execution-context flow so it does not retain an HTTP request/DI scope. Sends have a configured timeout and use the existing Service Bus service. Successful completion begins the full cooldown. A failed send is logged, and a subsequent failure after the shorter backoff can attempt publication again; failures do not consume 15 minutes of silence.

Graceful shutdown stops accepting work and awaits pending sends within the host deadline; if that deadline expires, outstanding sends are canceled. Abrupt process termination can lose an in-memory pending alert. There is no durable outbox or independent retry scheduler. If the bus is unavailable and no further resource failures occur, a failed publication is not later replayed automatically. These are explicit limits of the selected in-process design.

Event IDs are deterministic per alert type/resource/UTC bucket and flow through the existing processor. This can help replay idempotency, but does not turn the in-memory sliding cooldown into a cross-host guarantee. Timeout and quota on the same resource/type share the approved cooldown. Existing processor deduplication/persistence rules remain unchanged.

## Verification record

| Verification | Observed result |
|---|---|
| Expanded API resource alerts + completion + Search query regression selection | **177 passed, 0 failed, 0 skipped**, rebuilt after the final structured-error/status changes |
| Functions unit selection: resource coverage, alert settings convention, processor | **34 passed, 0 failed, 0 skipped** earlier in this session |
| MCP unit selection: resource coverage, typed-client lifetime, voice monitor | **64 passed, 0 failed, 0 skipped** earlier in this session |
| Identity resource coverage guard | **1 passed, 0 failed, 0 skipped** earlier in this session |
| Functions admin-alert processor integration selection | **10 passed, 0 failed, 0 skipped**, using the real Cosmos emulator earlier in this session |
| MCP realtime transport + host health integration selection | **11 passed, 0 failed, 0 skipped**, rebuilt on the final shared code |
| Admin alert page tests | **13 passed** earlier in this session |
| ESLint for affected admin files | **0 errors** |
| API convention guard in isolated CI-shaped junction layout | **2 passed**; removing the infrastructure junction made the source guard **fail as expected**, rather than pass an empty scan |

Runtime tests cover independent gates, 1,000 concurrent reports, 15-minute boundary, separate resource/kind keys, failed-send backoff, shutdown, expiry cleanup, allocation, business/trace metadata, Search SDK status/timeout/cancellation/synchronous calls, semantic partials, indexing partials, model JSON/SSE byte preservation and fragmented realtime messages. The Cosmos integration path joins the real publisher, captured queue payload, real processor and repository; Service Bus delivery is modeled, not a live broker test. WebSocket integration uses a real local Kestrel server.

Findings corrected during implementation: persisted metadata casing assertions, an ambiguous regex `Match` test type, multi-line SSE inspection, Speech service timeout mapping, and Search structured quota errors on other error statuses. One overlapping build attempt hit a shared SourceLink file lock; the final MCP verification was serialized and passed. Existing nullable/analyzer/package warnings remain, including an MCP SSH.NET advisory; this work does not claim a warning-free platform build.

No live resource was deliberately throttled, no live queue was recreated, and no deployment was performed. The complete platform test suite and production load benchmarks were not run. Prior passing selections are recorded as such, rather than represented as one final full-platform run.

## Documentation and cleanup

Relevant infrastructure, Search, shared/core, API, Functions, Identity, admin and voice skill notes were updated in all four tool directories. Project memory records the owner's in-process cooldown decision and the verification limits. The temporary CI-layout junctions were removed after the positive and negative controls; their empty parent directories were also removed before handoff. No scratch files were created inside a repository. Final git status was inspected across all eight affected repositories. Source/tests and this audit are intentional deliverables. Concurrent changes in the shared workspace are preserved.
