# Transcription verification alert metadata — exact approval request

Status: OWNER APPROVED in the current conversation, with `verificationId: string` explicitly retained. Not yet implemented. This replaces the larger initial field proposal. The owner requires only fields with a concrete current use, reusing existing alert fields and separate regional resources. This does not reopen settled product decisions.

## Scope of this approval

Add one structured value, `AdminAlert.metadata.transcriptionVerification`, to the existing Cosmos `AdminAlert` document. It travels in `AdminAlertMessage.Metadata["transcriptionVerification"]` through the existing admin-alert queue and processor. The dedicated `AdminAlertType.DocumentTranscriptionVerification` enum member is already authorized separately.

No new SQL table/column, Cosmos container/document family/partition key/index/TTL, or Search field is proposed here. This is not blanket approval for later persistence changes. Blob evidence and durable replay still require their complete implementation design and tests; this metadata proposal alone does not solve queue-outage recovery.

## Required owner table

| Requirement | Exact proposal |
|---|---|
| What | Existing `AdminAlert` entity, serialized path `/metadata/transcriptionVerification`, object with the closed shape below. Existing `SystemData` container, `/pk` unchanged, existing alert month partition retained. |
| Who reads it | Existing `AdminAlertProcessor.ConvertMetadata` converts the message object for Cosmos; `AdminAlertRepository.GetAlertsPagedAsync` and `GetAlertByIdAsync` return the existing entity; `clinqetwebadmin/src/pages/alerts/AlertsPage.jsx` displays its metadata. The new verification producer/replay code will serialize the same closed envelope for all three consuming flows. |
| Who writes it | Shared verification orchestration called by `VisionDocumentTranscriptionService` and final setup/draft field validation creates `AdminAlertMessage`; the existing `AdminAlertProcessor.ProcessAdminAlert` writes the entity through `AdminAlertRepository.CreateAlertAsync`. Final consumer outcomes originate in `McpService`, `KnowledgeIngestProcessorFunction` and `KnowledgeServiceDraftAnalyticsJob`. Those additions are proposed work, not existing behavior. |
| Why not a column | This is one diagnostic object on one existing alert. No separate table, entity or top-level alert property is needed. |
| Why not a constant/enum | Phase, flow, disposition and attempt-state values will be C# enums serialized as strings. Source readings, locations, attempts and actual service IDs vary per event and cannot be constants. |
| Why not already stored | Read `AdminAlert` in `clinqetcore/Entities/COSMOS/Cosmos.cs`, `AdminAlertMessage`, `KnowledgeContentArtifact`, `IVisionDocumentTranscriptionService`, `SystemMarker` and `AccessChangeQueue`. Existing alert identity/business/title fields are reused. Metadata has capacity but no verification contract. Page caches hold Markdown only; the full artifact has no verification evidence. The SQL access-change outbox is authorization-specific; a once-marker has no payload/replay state. Neither will be repurposed for this feature. |
| Cost | At least two existing alert writes per required check (Required and Outcome), plus genuinely distinct consuming-flow outcomes. Bounded metadata increases document bytes and write RU; actual RU remains to be measured in the scoped sandbox. The current `SystemData` policy excludes `/*` and includes named scalar fields; it does not include metadata, so this adds no metadata index entries or new index. Existing alert TTL is unchanged. No SQL migration. |
| What breaks if omitted | J48–J52 cannot persist structured source association, per-discrepancy readings, actual attempts and consumer dispositions in admin-visible alerts. A generic title/error or a log line cannot satisfy section 19. |

## Exact serialized shape

Names below are proposed new keys, not claims about current symbols. `?` means nullable/absent when genuinely unavailable. Arrays are bounded; evidence is split into correlated groups rather than silently dropping discrepancies. Dates use UTC ISO-8601 strings. Digests identify content, never credentials. No arbitrary model-supplied properties are accepted.

Existing message/alert fields remain the authority for event ID, correlation ID, timestamp, type, severity, business ID/name, title and description. `ServiceBusMessageBase` already has `SchemaVersion` and `CorrelationId`; `AdminAlertProcessor` preserves the correlation in existing `Metadata["CorrelationId"]`. The owner explicitly retained `verificationId` for stable check identity across source evidence, alerts and consuming flows. No nested metadata version is added. This contract does not change the shared base-message version.

Explicitly set `verificationId` to the stable logical source verification identity. Required and outcome events, including later consuming-flow outcomes that reuse the evidence, share that identity. Existing `CorrelationId` carries the event chain correlation; it must be explicitly assigned and preserved on replay. Each distinct event has its own deterministic `EventId`; retries of that event retain it. A new check or source version gets a new verification identity. Parent request correlation is not a substitute for per-check identity.

Regional/environment context comes from the owner's separate admin deployments and resources. Do not duplicate it inside this object. Cache/evidence policy identity remains necessary in the cache contract, not as a second versioning system on human-readable alert metadata.

| Object | Fields and types |
|---|---|
| `transcriptionVerification` | `verificationId: string`; `phase: string enum`; `flow: string enum`; `source: Source`; `discrepancies: Discrepancy[]`; `invocation: Invocation`; `evidenceReference: StorageReference?` |
| `Source` | `documentId: string?`; `fileName: string`; `contentHash: string`; `originalReference: StorageReference?` |
| `StorageReference` | `container: string`; `blobName: string`. Server-established owned storage coordinates only; not a SAS URL, not a user-supplied remote URL, and not an authorization grant. |
| `Discrepancy` | `fields: string[]`; `reason: string`; `location: string`; `sourceServiceName: string?`; `serviceId: string?`; `draftId: string?`; `passageIds: string[]`; `ocrReading: string`; `firstAiReading: string`; `thirdReading: string?`; `selectedReading: string?`; `disposition: string enum`; `remainingUncertainty: string?`; `savedPricing: string?` |
| `Invocation` | `deployment: string`; `model: string?`; `modelVersion: string?`; `reasoningEffort: string`; `reused: bool`; `attempts: Attempt[]` |
| `Attempt` | `number: int`; `state: string enum`; `startedAt: string?`; `completedAt: string?`; `failureCategory: string?`; `requestId: string?`; `inputTokens: long?`; `outputTokens: long?`; `reasoningTokens: long?`; `cachedInputTokens: long?` |

`phase` distinguishes Required from Outcome. `flow` distinguishes Knowledge, Provider Setup and Service Draft Extraction. “String enum” means a fixed C# enum serialized by name, not a free-form database lookup or a second stored value. Exact runtime enum members are finalized against actual control paths before coding; no future-only members are authorized by this proposal.

`location` is a readable reference generated from real source evidence, such as a page/table/row or native sheet/cell address. Include enough context to distinguish repeated labels and duplicate occurrences. Precise spans, polygons, model region IDs and normalization details belong in the referenced evidence used by the comparison engine; the alert must not duplicate that entire internal structure. The `(verificationId, source contentHash, location, fields)` context makes every listed discrepancy traceable without an extra alert-only discrepancy ID.

`reason` states why verification was necessary, including whether a downstream extractor introduced the discrepancy and why this was not a harmless equivalent. `disposition` records the actual choice for this field and consuming flow. `remainingUncertainty` explains any unresolved fact. Generate required admin/provider follow-up wording in the existing alert `Description` from these actual results; do not persist separate `adminReviewRequired`, `providerAction`, `followUp`, or a duplicate document-wide `outcome` that can disagree with per-field decisions.

`savedPricing` is present only when retaining an existing service's current usable pricing is relevant. The OCR/first-AI/third/selected readings already show the proposed values, so a second `proposedPricing` copy is unnecessary. These excerpts preserve relevant currency/basis/shape and are never parsed back into an actionable service write. Full evidence lives outside the queue payload.

`invocation.reused` distinguishes valid evidence reuse from a check that could not start. On reuse, `attempts` contains no new model call; `verificationId` links the original invocation. On a real invocation, record its actual attempts, failure categories and available usage. Do not maintain a duplicate attempt count alongside the array.

Required-phase values have no third reading or final saved IDs until these exist. A crash with an uncertain transport result is recorded as unknown/interrupted; it must not be reported as a known zero-call result. Cache reuse reports the originating verification and no fabricated new attempt. Every discrepancy in a grouped check remains represented.

## Fields removed after owner review

- `version`: no demonstrated reader needs a second metadata version. The message already has a transport-version property; current consumer enforcement is not asserted here. Cache policy identity has a separate concrete purpose and remains in the cache/evidence design.
- `reusedVerificationId`: reuse the retained `verificationId`; keep existing `EventId` for per-event deduplication. The owner explicitly restored `verificationId` when approving this contract.
- `region`, `environment`: separate regional admin/resource deployments establish this context, as confirmed by the owner.
- `origin`, `category`, `normalizedInterpretations`: put the useful explanation in `reason`; machine comparison details remain in evidence.
- `providerId`: existing business identity is the mandatory owner link. Do not add a second identity without a concrete consumer; authorized source resolution must use existing ownership data.
- `adminReviewRequired`, `followUp`, `providerAction`, document-wide `outcome`: derive the explanation/action from actual per-field disposition and uncertainty in the existing description.
- `documentKey`, `contentType`, `sourceVersion`, alert `policyFingerprint`, reference `contentHash`: avoid duplicate source identity/version details in admin metadata; retain actual file/hash/document/storage reference and keep cache identities in the evidence/cache contract.
- `discrepancyId` and expanded geometry object: retain the actual source location/fields in each discrepancy and precise machine identifiers/geometry in evidence.
- `proposedPricing`, `logicalAttempts`: avoid copies of readings and counters that can drift.

Future flexibility comes from the existing metadata dictionary, stable correlation and evidence references. Add a field when a real reader/writer needs it; do not store hypothetical states now. The old larger proposal is superseded and must not be implemented from conversation history.

## Source checks completed for this request

- `AdminAlertType.DocumentTranscriptionVerification` is absent in the current enum.
- `AdminAlertProcessor` deduplicates persistence by `EventId`, but its in-memory content key ignores EventId and Metadata. The dedicated type must use logical event identity so different checks/phases cannot be swallowed. This is source-confirmed, not a new runtime reproduction.
- The processor recursively converts nested JSON objects/arrays before Cosmos serialization; the admin detail view uses `JSON.stringify(metadata, null, 2)`.
- Functions explicitly binds `AdminAlertSettings`; targeted API/registration searches found no corresponding binding. Binding tests remain required before asserting the final behavior.
- `KnowledgeContentArtifactStore.WriteAsync` is explicitly best-effort and may omit an oversized artifact. It cannot be the sole durable alert obligation path without changing that design.
- `ServiceBusService` retries boundedly, then throws; its generic failure alert does not retain the original message for replay. Existing send-failure logging is not a verification outbox.
- The existing private storage containers and shared `BlobServiceClient` registrations can support separately designed durable evidence/replay without a new Azure resource. No claim is made that such a replay worker exists today.

No application source, schema, cloud data or deployment has been changed. No implementation tests have run for this proposed contract.
