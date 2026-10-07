# Document transcription quality — design and implementation resume plan

Updated: implementation green light and simplified alert-metadata approval received in the current conversation. Current implementation checkpoint is section 20; earlier planning-only/pending-approval statements below are historical. General coding and deployment-configuration authorization is recorded; do not request it again. Latest three-flow decisions are authoritative in sections 17–19: knowledge continues with third output or OCR fallback and admin alert; provider setup and service drafts continue but disputed actionable pricing requires provider completion. Service workflows check service names/pricing only; knowledge checks full content. Sol/high remains the evaluation choice. All three product questions are answered in section 17.12. The approved alert-metadata contract explicitly retains verificationId; see section 20.7 and PERSISTENCE-APPROVAL.md. Current handoff: IMPLEMENTATION-PROMPT.md plus section 20.

## 1. Read this first when resuming

This is the plan for the knowledge/OCR/AI validation task in this conversation. The owner initially requested design first, then authorized coding and deploy.ps1 integration. Design, implementation, live verification and the final audit are COMPLETE — read §22 first for the built state, the measured results and the honest limits. Knowledge may publish the selected disputed reading; provider setup/service drafts must not turn a disputed price into actionable service pricing. Do not apply the earlier uniform three-flow publication proposal. Sections 17-18 contain the latest decisions and verified existing behavior. Q1-Q3 are answered; do not ask them again. No unspecified SQL/Cosmos/Search schema changes are authorized.

The existing RESUME-PLAN.md in this directory belongs to another task and also discusses API convention tests and Business Search styling. It was read to avoid overwriting it and has been left untouched. Those tasks are NOT part of this workstream.

This plan supersedes the earlier FIX-PROMPT.md's implementation direction where it conflicts with the later owner requirements: preserve legitimate OCR corrections; compare semantic equivalents without unnecessary verification; cover provider setup; add appsettings-gated verification alerts; prefer a clean pre-production end state over legacy cache adapters. REVIEW.md remains historical evidence, not a claim that the proposed fix has passed tests.

Owner's full attached requirements: `C:/Users/nik.adhaduk/.codex/attachments/1a4cbf02-521e-4e3f-bc1a-ddfb857a5966/pasted-text.txt`.

Latest clarification: `$5.00` versus `$5` was only an example. Equivalent forms across supported values, quantities, units and formats must avoid unnecessary third verification. Explicit examples include `5gram`, `5 gram`, `5 grams`, `5 g`, and `5gm`, when they denote the same mass in the same context.

### Owner requirements to preserve

- Quality first; no factual degradation accepted. Costs may increase if needed for a correct solution; asynchronous speed is not the deciding factor.
- Latest operating policy: knowledge uses third text even if uncertain, or OCR if no usable third response, with gated admin alert and no uncertainty hold. Provider setup/service drafts continue producing service records/drafts while disputed prices use the existing missing-price/provider-completion pattern. Keep full knowledge text separate from service pricing decisions. See sections 17-18: auto-use source-resolved prices; use third names without confirmation; preserve existing saved prices when replacements remain disputed.
- Stronger vision model selection and deployment configuration are authorized for conflict resolution. The owner will manually deploy it under the same Foundry account for testing; prepare matching deploy.ps1 wiring. See section 9 for the selected evaluation candidate and unverified account availability.
- Extra verification should occur for meaningful in-scope conflicts or inability to establish a safe in-scope match, not benign formatting equivalences. Knowledge protects all content. Provider setup and service drafts protect service names and pricing; a description-only or unrelated quantity/unit difference must not independently trigger this third verification or missing-price behavior.
- An appsettings-gated admin alert must show when third verification is required, what differs and why. Include the outcome as well so admins can monitor the decision.
- Trace knowledge ingestion, provider onboarding/Quick Profile Setup and other shared consumers. Do not fix only one caller.
- After implementation: perform a multidimensional audit and fix all confirmed findings within this change. Audit findings must be separated from speculation and unrelated future work.
- No hallucinated symbols, fabricated tests, magic thresholds, silent truncation, swallowed defects, legacy compatibility adapters or shortcuts. Preserve current team patterns, localization and web/mobile parity where affected.
- No new page without an approved isolated mockup under the repository's required mockup directory.
- Coding is authorized. Do not run the full deployment script against Azure: the owner will manually create the test deployment. Schema approval remains a separate explicit gate when a concrete schema change is necessary.

### What can and cannot be guaranteed

Design for deterministic invariants: no untracked content loss, no unverified correction silently promoted, no incompatible cache replay, no cross-document/tenant mix, bounded resource use, explicit uncertainty. Prove these in tests.

Do not promise error-free interpretation of every arbitrary image or language. A blurred/contradictory source can remain undecidable. Agreement between OCR and AI, confidence scores, and a third model's answer are not mathematical proof. Require zero observed regressions on a source-verified corpus, and measure answer availability as well as correctness. Preserving a file while withholding previously correct searchable text is not automatically “no degradation.”

## 2. Confirmed evidence — completed before this design

Read `C:/Nik/Data/knowledge-validator-review-2026-09-08/REVIEW.md` for full scope and limitations.

- Actual current conservation code accepts `Haircut 500; Colour 1200` becoming `Haircut 1200; Colour 500`.
- It accepts `Deposit is not refundable` becoming `Deposit is refundable`.
- Global numeric presence and unordered unique words of length >= 4 cannot protect those relationships or the word `not`. Raising word coverage to 1.0 still accepted the corruptions.
- Real digital and image-only PDF fixtures went through actual Azure Document Intelligence and the configured vision model. Four uncached live vision runs retained the correct facts.
- Deliberately changing those actual transcripts reproduced both corruptions on both PDFs. Real application components accepted, cached, embedded, indexed and retrieved all four wrong versions from the Canada sandbox index.
- This establishes a validator failure, NOT observed spontaneous errors in existing business documents.
- Earlier selected unit run: 232 passed, 0 failed, 0 skipped. Application build succeeded. These are historical baseline results, not validation of a future implementation.
- Earlier controlled probes also accepted `5 mg` -> `5 g` and `-5` -> `5`. Treat these as the same comparison concern, not evidence of natural model errors.
- All 16 cloud test card IDs and 8 page-cache blobs were deleted and zero remaining verified. Azurite and local scratch artifacts were removed. Do not claim those fixtures still exist.

## 3. Verified current architecture and impact map

Paths and symbols below existed and were inspected. Line numbers may move. Before editing, read full affected implementations, tests, current skills and host registrations; discovery of call sites is not a completed audit of every downstream branch.

| Area | Current source and behavior | Required impact handling |
|---|---|---|
| Raw Document Intelligence | `clinqetinfrastructure/Services/AI/DocumentIntelligenceService.cs`: `PollForResultAsync` maps Content and PageCount; optional FillFigures maps figure coordinates/page sizes. Its AnalyzeResult does not map word confidence/polygons, line spans, paragraph relationships or table cells | Retain relevant structured response separately from Markdown. Preserve existing text, page and figure semantics. Test absent/malformed fields and both includeFigures modes |
| Raw result contract | `clinqetcore/Interfaces/AI/IDocumentIntelligenceService.cs`: DocumentRawExtractionResult | Carry evidence to consumers; distinguish in-memory fields from any persisted schema changes |
| Shared page orchestration | `clinqetinfrastructure/Services/AI/VisionDocumentTranscriptionService.cs`: TranscribeWithVisionAsync | One owner for comparison, escalation, outcomes and accepted page-cache policy |
| Existing model prompt | `clinqetinfrastructure/Services/AI/VisionPageTranscriber.cs`: BuildPrompts supplies image + machine reading; retry says prior response was incomplete and re-asks whole page | Do not treat another identical grounded retry as independent adjudication. Correct the assumption that every discrepancy means omitted OCR text |
| Current validator | `clinqetinfrastructure/Services/Knowledge/KnowledgeTranscriptConservation.cs` and KnowledgeFigures.cs | Replace acceptance based only on page-wide bags with structured contextual comparison; retain useful loss signals, not false confidence |
| Page cache | Shared service returns cache hits before conservation checks. Path from `clinqetcore/Models/Knowledge/KnowledgeBlobPaths.cs`; prompt fingerprint from `clinqetshared/Models/VisionTranscriptionSettings.cs` | Cache acceptance must be tied to source evidence and current policy, not merely model/prompt name |
| Knowledge ingestion | `clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs`: ExtractAsync and its TranscribeWithVisionAsync wrapper use Bulk lane, Voice:Knowledge:Vision, provider-knowledge cache | Propagate outcomes through figures, blocks, artifact, chunking, embedding, cards and document status; no unknown reading silently becomes Ready |
| Full document artifact | `clinqetcore/Models/Knowledge/KnowledgeContentArtifact.cs`, `clinqetinfrastructure/Services/Knowledge/KnowledgeContentArtifactStore.cs` | Current fingerprint includes assemblies; page-cache policy is independent. Both layers must honor verification identity; an artifact cannot conceal unresolved pages |
| Provider setup reader | `clinqetinfrastructure/Services/AI/ProviderSetupDocumentReader.cs`: PDFs/photos/converted photos call same IVisionDocumentTranscriptionService | Uses Interactive lane, AIAssistant:ProviderAttachmentProcessing:Vision, provider-setup-docs, sanitized filename + content hash. Wrapper currently returns only Markdown/PageCount, dropping richer result status |
| Setup contract | `clinqetcore/Interfaces/AI/IProviderSetupDocumentReader.cs`: ProviderSetupDocumentContent has Success/ErrorKey/Text/Extraction/PageCount/CharacterCount | Carry quality outcomes so they cannot disappear during flattening or error conversion |
| Setup entry point | `clinqetapi/Clinqet.API/Controllers/AI/AIAssistantController.cs`: ProcessProviderSetupDocument -> McpService.ProcessAttachmentProviderSetupAsync | Owner-facing result stays consistent across web/mobile. Existing endpoint needs no replacement solely for this change |
| Setup downstream | `clinqetinfrastructure/Services/AI/McpService.cs`: ReadAsync -> ExtractContentFromPreparedAsync; failed image reads can instead call ExtractWithVisionAsync | A new unresolved result must NOT accidentally take the generic image fallback and bypass verification. Audit writes before/after reading, including CleanupEmptySubcategoriesAsync, so a failed validation cannot leave destructive preparatory effects |
| Setup second AI extraction | DocumentIntelligenceService.ExtractContentFromPreparedAsync uses prepared text or a vision branch controlled by UseVisionAPI | Verified transcription does not certify downstream generated service/profile JSON. Test that selected facts survive this stage; carry review identity and prevent another extraction branch from silently replacing the chosen third reading |
| Service drafts/analytics | `clinqetfuncations/Clinqet.Communications/Services/KnowledgeServiceDraftAnalyticsJob.cs`: LoadInputsAsync, RederiveBlocksAsync, TranscribeWithVisionAsync | Uses same shared service, but wrapper returns only Markdown. Artifact path uses TryReadForAnalyticsAsync (source hash, not full pipeline identity). Cover direct re-extraction AND artifact reuse |
| Native Office/HTML/text | Existing KnowledgeDocumentParser and setup routing use native parsers, not page vision for normal native content | Do not force all Office files through OCR. Preserve hidden/revised-content rules, formulas, formats, cell hierarchy, images and heading scope. Shared contract changes still need regression coverage |
| Host DI | API Program.cs registers shared page/document transcribers around 868-869 and setup reader around 874; Functions Program.cs around 825-826 | Shared library implementation, with both host registrations/settings. Never introduce peer-host references |

Web and mobile endpoint constants both point to `ai/provider-setup/process`:
`clinqetwebpartnerapp/src/api/url.js` and `clinqetmobilepartnerapp/src/apiManager/constant.tsx`. This confirms shared endpoint configuration, not an exhaustive audit of every UI launcher. Finish that launcher/response-handling trace before any setup UX change.

### Additional current behavior that matters

- Conservation rejection keeps the DI reading. `VisionDocumentTranscription.Degraded` excludes PagesRejected. This cannot be blindly reused for “unresolved disagreement”: OCR may be the wrong reading.
- Empty baseline currently passes trivially. Blank model output keeps OCR. “Could not compare,” “no text exists,” and “model returned nothing” must remain distinct.
- Knowledge's full artifact is saved before chunking/embedding. Accepted evidence must remain coherent across retries after downstream failure.
- The normal page render setting in Functions appsettings is 1024 pixels maximum edge. Re-reading a crop must use the source bytes at appropriate resolution, not enlarge that already-downsampled image.
- Figure text is carried independently by PageMarkdownSplicer; validators cannot demand duplicate transcription and then splice contradictions back in. Verify final composed text as well as individual lanes.

## 4. Recommended architecture and alternatives

**Recommended:** retain structured source evidence; compare aligned content with typed equivalence; investigate only substantive differences/uncertainty with a stronger source-image reader; assemble accepted content from tracked decisions; store accepted evidence with cache results.

| Alternative | Decision and reason |
|---|---|
| Raise coverage to 100% | Reject: measured price/negation cases still pass; can reject benign OCR repair |
| Add a list containing `not` | Insufficient: misses moved negation, other languages, qualifiers, quantities and relationships |
| Require exact whole-page text equality | Reject: HTML/Markdown, wrapping, equivalent units and real OCR corrections fail |
| Always use OCR when there is a mismatch | Reject: freezes the OCR's error |
| Always trust latest/strongest model or majority vote | Reject as sole decision rule: correlated errors and ambiguity remain |
| Verify every page with another large model | Not the requested default; adds cost even for proven equivalent results and is still not infallible |
| Replace everything with MarkItDown | Outside this fix; does not solve factual acceptance and risks native/image regressions |
| Preserve evidence + contextual comparison + selective adjudication | Recommended: addresses both false acceptance and false rejection, with bounded spend and auditable decisions |

### Processing stages

1. Keep original bytes/content hash and authoritative document identity. Reuse native extraction where it already applies.
2. Obtain OCR Markdown PLUS structured evidence. Keep text spans, page geometry, words, table cells, headers and relevant relationships from the same response; do not flatten them away before comparison.
3. Keep the current first vision reading as a candidate. Do not remove grounding or change model quality without an evaluation demonstrating no regression.
4. Align source and candidate units: page/region, table identity, row entity, column header, text clause, parent heading, qualifiers and linked footnotes. Alignment can be uncertain; nearest word or global numeric multiset is not sufficient.
5. Compare with the equivalence rules in section 5. Changes in content/association/polarity and inability to establish a safe match are discrepancies. Cheap normalization of a true equivalence incurs no third model call or verification-required alert.
6. For actual discrepancies, emit the gated required event and perform bounded stronger-model verification using original source regions/context.
7. Produce explicit outcomes: unchanged/equivalent; supported correction; used-third-reading-needs-review; operational failure/no usable third reading. These are proposed outcome concepts, not existing enum names. Processing success and verification certainty are separate facts.
8. Assemble the final reading from accounted source regions and accepted corrections. A corrected cell cannot cause unrelated paragraphs to be regenerated or deleted. Any layout correction must include connected headings/headers/footnotes, not a naked string replacement.
9. Validate the assembled result for coverage, association consistency, duplicate/contradictory insertions, figures and page identity. Persist the chosen output and evidence with its true certainty/review state. Owner-authorized uncertain output may be published and cached, but must not be labelled verified.
10. Apply the consumer-specific publication rules in section 17. Knowledge retains selected disputed text; service setup/drafts retain the service but omit disputed actionable price. All continue at the workflow level. Downstream code must not lose review information, re-infer the suppressed price or overwrite an approved selection through an accidental fallback.

### Scope of “third verification only on conflict”

YES: this is the normal rule. A conflict includes missing/additional factual content, a changed association, incompatible quantities/polarity, uncertain alignment, unavailable evidence needed to compare, or an apparent extraction omission. It does not mean only two strings with visibly different digits.

Agreement by itself cannot detect both readers making the same error. Source coverage checks and offline independent audits are needed as well. Do not claim conflict-only verification catches shared errors universally. Any proposal to routinely add paid independent checks for non-conflicting pages must be identified separately with measured benefit/cost, not silently added.

## 5. General equivalence — mandatory design, not example-specific patches

Normalize for COMPARISON only. Retain original lexemes/source wording and accepted display text. A normalized numeric equality never authorizes silently rewriting the original document or losing significant precision, identifiers, conditions or unit context.

Represent a comparable value with its semantic role, exact magnitude, unit/dimension and scale, currency where applicable, qualifiers, denominator/basis, and source association. Keep unknown components unknown. Match occurrences one-to-one: one occurrence cannot satisfy two source rows.

Use documented unit definitions (UCUM is a reference) and locale rules (Unicode CLDR is a reference), plus explicit tested aliases for real document wording. A unit standard is not a universal natural-language parser. `gm` as grams is an application alias only in an established mass context; unknown/ambiguous tokens must not be guessed into that meaning. Choose any .NET library only after checking its supported syntax, licenses, culture behavior, precision and limits; no dependency has been selected or installed.

| Category | Equivalent examples when context establishes meaning | Must remain different or uncertain |
|---|---|---|
| Currency formatting | `$5.00`, `$5`, `$ 5.0`; `CAD 5` and `CA$5` with established CAD | CAD vs USD; bare `$` cannot be assigned a currency from business region alone when document context differs |
| Unit spacing/word forms | `5gram`, `5 gram`, `5 grams`, `5 g`, `5gm`, `5 gm` in a mass field | Unknown abbreviation or `GM` in a name/code is not a mass unit by blanket lowercasing |
| Other unit families | `5 kilograms` / `5 kg`; `10 millilitres` / `10 mL`; `2 hours` / `2 h` in duration context | `m` may mean metres or something else; `oz` and fluid ounces are not interchangeable |
| Exact scaled quantities | `5000 mg` / `5 g`; `1000 mL` / `1 L`, only same dimension and basis | `5 mg` / `5 g`; mass versus volume without explicit conversion evidence |
| Fractions/numeric syntax | `1/2 kg` / `0.5 kg`; `5.0` / `5` in a plain quantity field | Identifiers, ratios, significant measurement precision/tolerance and rounding must not be erased |
| Decimal/group formatting | Locale-established `1,000.50` / `1000.50`; `5,00` / `5.00` in established decimal-comma context | `1.234` / `1,234` is ambiguous without evidence; do not accept any possible numeric reading just to find a match |
| Digit scripts | Same established numeric quantity expressed with supported Unicode decimal digits | Names/codes using look-alike characters or unsupported numeral syntax require separate treatment |
| Percentages | `5 percent` / `5%` | `5%` / `5`; percentage points versus percentage change; ratios only equivalent if semantic role is known |
| Prices/rates | `5 CAD/hour` / `CAD 5 per hour` | Per hour vs per session; amount excluding tax vs including tax; starting-from vs fixed |
| Quantity basis | `5 g per serving` / `5 grams per serving` | Per serving vs per pack; serving size changed; `2 x 5 g` is not automatically identical to one 10 g pack |
| Time/date formatting | `09:00` / `9:00 AM` when same local time; spelled-out date vs unambiguous numeric date | `03/04/2026`, time zones, daylight-saving ambiguity, months vs fixed numbers of days |
| Signs/ranges/operators | Typographic minus variants when genuinely a minus; equivalent range punctuation | `-5` / `5`; `<5` / `<=5`; open vs closed ranges; dash as list marker vs minus |
| Temperature/derived units | Only conversions that preserve whether value is an absolute quantity or difference, using defined conversion | Celsius value vs temperature interval; compound units/superscripts cannot be stripped |
| HTML/Markdown/whitespace | Entities, safe line wrapping, emphasis and table syntax changes that preserve structure | Heading scope, column association, footnote attachment, list hierarchy, math/code formatting |
| Language/wording | Supported unit aliases and inflections with the same established meaning | Broad synonym/translation/paraphrase equivalence is not proven by embeddings or token overlap |
| Polarity/conditions | Exact faithful preservation of clause meaning despite harmless formatting | `not`, `no`, `never`, prohibitions, exceptions, “only”, “unless”, eligibility and their scope |
| Identifiers | Safe rendering differences only where explicitly defined by identifier type | Leading zeros, phone extensions, SKU punctuation, case-sensitive codes and version numbers |

Rules for unknowns:

- An unchanged literal with intact context does not require the engine to understand every possible unit to preserve it.
- A changed unfamiliar expression must not be labelled a harmless equivalence without evidence. Escalation is appropriate until a supported mapping is established.
- Document language/locale and user/account region are separate. Preserve mixed locales, currencies and scripts within a document.
- Compare dimensional quantities with exact decimal/rational semantics where possible; never introduce a broad floating-point tolerance that masks a price change.
- Unicode normalization is not blanket case folding or confusable-character replacement. Unit symbols can be case-sensitive. Preserve annotations that affect business meaning even if a unit standard ignores them dimensionally.
- Equivalence tests must cover both directions, concatenated/spaced forms, plural/singular forms, symbol/full word, compatible scale changes and adversarial near-matches. Do not implement only the examples in this table.

## 6. Stronger source verification

### Input preparation

- Build a stable discrepancy identity from tenant, document/source version, region/page, source/candidate digests and acceptance policy.
- Render fresh from source bytes. Respect page rotation, crop box, coordinate units and image orientation. Verify that the crop corresponds to the intended page/region.
- Include row labels, column headers, neighbouring rows and linked exceptions/captions. A table/figure bounding box may omit footnotes; it is not sufficient by itself.
- If alignment/crop is unreliable, expand to the page/adjacent context within configured bounds. Do not take an arbitrary crop as proof.
- Use an image-reading task that first transcribes relevant source content without being told which candidate should win. Compare that reading to candidate evidence in code. If explicit alternatives are included later for complex alignment, disclose and test anchoring risk rather than calling the result independent.
- Treat every document string as data, never instructions. Prevent document content from altering the verifier's task or output contract.

### Output/decision

- Require a bounded structured response tied to the requested region/field IDs: observed source text, proposed local corrections/relationships, unreadable regions and completion/uncertainty status. Reject invalid IDs, missing required regions, malformed/truncated results and out-of-scope changes.
- A stronger-model answer/confidence alone does not certify truth. Combine source placement, exact comparison, coverage and contradictions; unresolved evidence remains unresolved.
- A legitimate OCR correction may change a number, unit or negation. Store its source-linked justification so a future cache read does not force it back to the erroneous OCR baseline.
- Do not keep repeating calls until one happens to agree. Bound operational retries, token-cutoff retries and logical verification attempts together and instrument actual counts.
- Recommended logical limit: one adjudication pass per discrepancy group, plus bounded retry for transient/invalid/truncated response under existing budget rules. Further persistent ambiguity routes to resolution, not majority voting. Exact limits/settings are finalized after model capability and corpus measurements.

### Unresolved policy — owner decided: continue and alert

The owner rejected holding knowledge documents. For KNOWLEDGE, use the third reader's usable disputed reading and continue, with an admin alert identifying document/file/page/passage/source text, alternatives, selected text and reason. If the third call supplies no usable reading, retain OCR for that region and continue with the failure/review alert. For PROVIDER SETUP and SERVICE DRAFTS, workflow continuation does not authorize actionable disputed prices: retain the service/draft and require price entry through existing completion/editing paths. Use usable third-check names without a new confirmation gate, and alert admin in all three flows; see sections 17.12 and 18. Do not reintroduce a whole-document hold.

Preserve original bytes, OCR, first AI reading and third reading for review. Use the third result only within its requested source scope, preserving unrelated text, tables, conditions and images. The third reader's prose commentary or malformed JSON is not a replacement document. Structured response validity and source identity checks still apply. Do not invent a value when the model supplied none.

Knowledge publication is authorized despite unresolved certainty. This trades automatic certainty for availability and offline review; it does not make an unreadable value proven correct. Service pricing has the stricter provider-completion requirement. Quality tests must expose wrong third readings rather than hiding them behind successful-processing counts. Reuse existing admin review, setup missing-price summaries and draft editors where sufficient; do not invent UI or claim a dedicated name-confirmation workflow exists.

DECIDED: third timeout/refusal/malformed/truncated/no usable disputed text -> knowledge keeps OCR for the affected region, continues and fires the gated admin alert. The owner explicitly answered yes. Do not ask again. Service journeys may keep that text as evidence, but disputed actionable prices are omitted as specified in section 17. If both OCR and the third reader contain no usable text, do not invent a value; preserve other content and report the absence, using existing genuine empty-document failure rules when the entire upload contains no readable content.

## 7. Admin alerts — specific owner requirement

### Current verified mechanism

- `clinqetshared/Models/AdminAlertSettings.cs`: existing alert flags default true; EnableSystemFailureAlerts is the existing master used by PlatformLimitAlerts/AiBudgetCutoffAlerts.
- `clinqetinfrastructure/Services/AI/PlatformLimitAlerts.cs` and AiBudgetCutoffAlerts.cs publish AdminAlertMessage through IServiceBusService to ServiceBusSettings:AdminAlertsQueueName. Existing capacity alerts use broad cooldowns.
- `clinqetshared/DTOs/Messages/AdminAlertMessage.cs`: existing Title, Description, BusinessId, Metadata, AlertTimestamp and EventId.
- `clinqetfuncations/Clinqet.Communications/Functions/AdminAlertProcessor.cs`: EventId determines persisted alert ID; duplicate creation is handled. A separate in-memory content-based dedupe includes type/severity/business/title/description, NOT arbitrary metadata.
- Functions Program.cs explicitly binds AdminAlertSettings. No explicit AdminAlertSettings binding or section was found in the inspected API Program.cs/appsettings.json and targeted registration search. Finish tracing API configuration composition and prove the new switch binds in BOTH hosts; do not assume IOptions defaults make an appsettings gate work.

### Proposed end state (new names below do not yet exist)

- Proposed dedicated flag: `AdminAlertSettings:EnableDocumentTranscriptionVerificationAlerts`, default true in class and both hosts, consistent with the current alert-default contract.
- Gate verification monitoring on this dedicated flag and any applicable existing master, with startup/binding tests in both hosts. Alert-off MUST NOT disable validation, loosen decisions or lose internal evidence.
- REQUIRED dedicated alert category: document-transcription verification. Proposed new enum member: AdminAlertType.DocumentTranscriptionVerification. This member does not currently exist; the owner explicitly requires a dedicated type. Implement it through the existing alert pipeline and admin filtering/detail presentation. Do not substitute SystemError, KnowledgeIngestFailed or AiCapacityPressure. See section 19 for the mandatory trigger and details contract.
- Use the existing alert queue/message/processor, not a new messaging pipeline or queue.
- Emit “verification required” BEFORE scheduling/sending the stronger call; emit a correlated completed/unresolved/failed event afterward. Prefer two clearly distinguished immutable lifecycle alerts over a new alert-updating API unless existing infrastructure already supports the latter safely.
- Logical identity includes source version, discrepancy group and phase. Repeated delivery of the same event is deduplicated; genuinely different conflicts are not swallowed by a business-level 15-minute cooldown.
- Make the event/phase/source discriminator visible to the current content-based dedupe as well as EventId; otherwise two distinct events with the same description but different Metadata can disappear.
- Include document identity/name, tenant, workflow, file name, page/region, passage/source block, category of difference, bounded OCR/first-AI/third-reader/chosen-text excerpts, normalized interpretations, why they are non-equivalent/uncertain, selected deployment, logical/actual attempts, outcome, remaining uncertainty and correlation. Include a stable authorized reference to the original document/evidence, not a copied whole document, secret or expiring SAS URL. Third verification happens before final knowledge passage IDs exist: use source-region/block identity initially, then link final passage IDs if produced; never invent a passage number. Setup can have a file/page/region without a knowledge passage ID.
- Explicitly show why an equivalent form was NOT a conflict in internal test evidence; do not send a verification-required alert for a locally resolved equivalent representation.
- Alert dispatch failure must be visible and retryable through supported infrastructure; it must neither block processing solely for review notification nor drop evidence. Define durable replay of required/outcome events with the processing artifact so an outage cannot silently erase the review obligation. A generic swallowed exception cannot satisfy reliable monitoring delivery.
- Await bounded persistence/enqueue where appropriate rather than launching untracked tasks. Admin review and external notification delivery are not conditions for publishing the owner-authorized output. Retain retryable notification state if the queue is unavailable; preserve existing behavior for genuine storage/indexing failures.
- Add integration tests for switch off/on, required->resolved, required->unresolved, verification never starts, duplicate delivery, two distinct conflicts, phase dedupe, service-bus failure/recovery and admin metadata serialization.

New metadata/enum use must be checked against the existing admin UI's filters/detail rendering and schema policy. Do not assume adding a dictionary key is exempt from the owner's data-contract rules. Exact proposed persisted changes must be listed before implementation.

## 8. Cache/artifact end state — clean pre-production design

Owner does not want legacy compatibility adapters. Prefer an explicit new acceptance-policy/cache format version, a scoped rebuild of derived artifacts, and removal of obsolete code. Do not implement automatic conversion of unsupported old Markdown into “verified” results.

- Original uploads and useful source evidence are not obsolete cache. Preserve them unless a specific reset explicitly targets them.
- Separate reusable extraction evidence, publication choice and verification certainty. Per the owner, uncertain third-reader content may be used; review-needed is not the same as verified.
- A cache entry contains selected content, source/candidate identity, decisions explaining legitimate corrections and the true certainty/review state. It may represent either verified content or an owner-authorized uncertain reading. Do not blindly compare it back to obsolete raw OCR on every hit or lose outstanding review on replay.
- Cache identity must account for tenant/document/page, source digest, relevant extraction/renderer revision, model/deployment revision, prompt, normalization/alignment/acceptance policy and relevant settings. Verify actual hosted model revision if deployment names can be reused.
- Do not invalidate for notification switches or unrelated appsettings. Do invalidate when the policy needed to reproduce/justify acceptance changes.
- Store coherent accepted content/evidence together or via a versioned manifest published only after all pieces exist. A crash between writes must not expose an accepted flag for missing/mismatched content.
- Recheck integrity/current identity cheaply on read. Reuse a valid current output without re-paying adjudication, including an uncertain third reading, while preserving its review identity. Offline correction must invalidate/rebuild the affected page, document artifacts, index passages and service-draft inputs through the supported path; do not repeatedly resurrect the pre-review result.
- Unsupported/incomplete/mismatched entry: cache miss/reprocessing, never guessed acceptance. Recovery must be bounded and retain original evidence.
- Full KnowledgeContentArtifact replay and analytics-specific reads must check quality identity; assembly fingerprint alone is insufficient for configuration/model-policy changes.
- Source replacement, ForceFresh, delete/tombstone, parallel jobs and re-delivery must not resurrect stale or deleted output. Verify ForceFresh reaches all relevant caches, not only the full artifact.
- Rebuild affected pre-production derived caches/index cards through the supported reprocessing path with tenant/document scoping. No cross-partition Cosmos sweep. Do not merely enqueue an already-Ready document and assume its idempotent path performs a fresh run.
- Define publication boundaries so callers never see mixed old/new rows or detached conditions during replacement. No claim of an atomic transaction across Blob, Cosmos and Search; use the existing generation/commit mechanisms if adequate, otherwise propose the exact required design/schema.

## 9. Proposed settings, contracts and approval boundary

Existing roots: `Voice:Knowledge:Vision` and `AIAssistant:ProviderAttachmentProcessing:Vision` use shared VisionTranscriptionSettings. Keep semantic comparison rules shared; workflow-specific time/lane budgets may differ.

Proposed settings to specify after capability/budget measurement: verification deployment/revision, reasoning effort, output-token ceiling, request timeout, max logical verification attempts, transient retry ceiling, conflict groups per call, rendered edge/crop/decoded-pixel/total-image-byte limits, per-document time/attempt allowance, maximum retained evidence/alert excerpt sizes. Names/types/defaults must be finalized together with binding, startup validation and tests. They are not existing settings.

Avoid a generic “turn validation off and accept everything” switch. The requested flag gates ADMIN ALERTS. Knowledge processing may succeed with review-needed third/OCR output; service processing may succeed with a service/draft requiring price completion. Never present either as a verified price. The no-usable-third-response fallback for knowledge is decided in section 6.

Before writing any persisted fields/new entity family/index change, present the exact schema approval table required by C:/Nik/AGENTS.md: What, Who reads, Who writes, Why not a column/table alternative, Why not a constant/enum, Why not already stored, Cost, What breaks if omitted. Do not manufacture schema merely to reserve future work.

Likely contract work to evaluate:

- In-memory structured DI evidence and shared request/result outcome.
- Accepted page-cache artifact with correction/evidence/version information; full artifact linkage/quality state.
- Existing admin message Metadata and appropriate enum category; determine if new persisted top-level fields are unnecessary.
- Provider setup/knowledge unresolved propagation and its existing status/error representation; any new persisted status fields/UX require explicit approval.

No schema changes have been approved by this plan. The owner has authorized configuration of one stronger model deployment in the existing Foundry account. No additional account, storage container or Service Bus queue is justified. Any new environment keys must ship with applicable ARM + deploy.ps1 wiring and both host appsettings/defaults in the same change. Verified automation files: `C:/Nik/azureautomation/deploy.ps1`, apps.json, functions.json, ai-foundry.json. Read applicable templates before editing; the precise parameter mapping remains to be traced.

The deployment script currently names `gpt-5.4-mini` and `gpt-5.6-luna` for relevant general AI deployments. This is NOT proof that a more capable verifier is provisioned.

### Model selection and manual deployment handoff — owner-authorized scope

Selected evaluation candidate: **GPT-5.6 Sol**, Azure model ID `gpt-5.6-sol`, documented Azure version `2026-07-09`, reasoning effort **high**. Proposed dedicated deployment name: `document-transcription-verifier`. This alias does not exist in the current code and is a proposed new configuration value. The owner suggested Sol or Terra and explicitly rejected Astra for cost. Sol/high is the chosen starting point for this targeted verification workload; Terra remains a possible evaluated cost optimization, not an automatic fallback. Finalize token/image/time ceilings from measured complete responses, not a claim that a preset budget always suffices.

Microsoft's current model catalog documents image processing, Chat Completions and structured outputs for Sol and Terra. Those facts establish suitable modalities, not superior OCR on this corpus or access/quota in this specific Foundry account. Verify Sol/high on the actual endpoint and source corpus. Do not claim a deployment or a successful capability probe until it exists and responds successfully.

- The owner will manually create the evaluation deployment under the same Foundry account. Supply the exact model/version/alias and the actual required deployment SKU/capacity after checking account availability. Do not invent quota or silently create a separate account/region. Azure CLI and Az.Accounts were not found in the inspected local shells during this checkpoint; that is not evidence of what the remote account contains.
- Pin model version and use `NoAutoUpgrade` for the verifier. A later upgrade requires corpus evaluation and cache-policy invalidation. Do not silently substitute a weaker model if deployment is absent or unavailable.
- Add the model to the existing deploy.ps1 deployment collection so the existing content-filter assignment also covers it. Verify availability handling does not report a usable verifier after failed provisioning. Keep model ID distinct from the dedicated deployment alias.
- Add the exact matching deployment/settings to both existing vision settings roots, class defaults, host configuration, applicable ARM/environment mappings and the local paste-block output. Test Functions and API binding separately. This is an additional conflict-only reader, not replacement of every normal Luna transcription call.
- Reuse the existing Foundry credentials, AI completion transport, workload governor and cost accounting. Do not add raw API clients that bypass them. Send the configured high reasoning effort and check supported sampling/token/schema parameters for Sol. No tool calling is needed for the verifier. A deployment alias must resolve capabilities from its configured model identity, not a `gpt-` prefix guess.
- Verify image plus strict JSON-schema support on the actual deployed endpoint, including rejection/refusal, truncated output, unsupported request parameters and invalid result coverage. A syntactically valid JSON answer is not proof its facts are correct.
- Benchmark the principal injected bugs, legitimate OCR corrections, equivalent forms, difficult native/scanned sources and all downstream paths. If the candidate fails the quality gate, record the evidence and evaluate another suitable deployment; do not lower the acceptance bar.
- Extra cost is paid only for substantive/uncertain discrepancy groups and bounded retries. Measure actual Azure input/image/reasoning/output usage; do not copy public OpenAI prices into an Azure cost estimate.

Model references checked on 2026-09-08:
https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure?pivots=azure-openai
https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning
https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs

## 10. Cost, latency and resource requirements

- Equivalent inputs: local comparison only; no third model call and no verification-required alert.
- Substantive/uncertain group: bounded stronger-model call(s), source rendering and monitoring events. Group related cells on the same source region rather than one call per changed token.
- Reuse currently accepted evidence so replays do not re-pay adjudication. Reuse existing raw extraction where identity permits; retaining metadata from a DI response is not a second DI request.
- An optional DI high-resolution add-on is separately billed. Local re-rendering of a PDF is different. Do not conflate their costs.
- Record observed conflict/equivalence/false-conflict rates, actual calls/tokens, adjudication outcomes, cache reuse, alert count and one-time rebuild cost. No invented percentage savings or “one extra call” guarantee that ignores token-cutoff/transport retries.
- Propagate cancellation/time/attempt budgets into all calls. Use existing AI governor and subflow accounting for both Interactive and Bulk paths; add verified subflow/dial mappings if new subflows are introduced.
- Bounded concurrency and decoded memory across pages/documents; no unbounded Task.WhenAll or simultaneous whole-document rasterization at increased resolution. Dispose streams, images, page handles and response bodies promptly. State whether rendering can stream pages; inspect current rasterizer before designing memory limits.
- Bound alignment complexity and evidence size. Exceeding a bound must record which content could not be verified and follow the explicit non-blocking/fallback policy, never pretend unchecked content was verified or silently truncate it.
- Per-invocation immutable/per-page state; no mutable singleton document state. Any IMemoryCache write uses Size = 1. Cross-process replay safety must not rely solely on an in-memory lock or cache.

## 11. Test specification and release acceptance

### A. Deterministic comparison tests

- Principal bugs, plain prose and tables, long pages, repeated prices, same-token negation moved between clauses.
- Whole equivalence matrix in section 5, generated across supported aliases/locales/spacing/plurals plus independently authored boundary cases. Explicitly assert zero verification calls for proven equivalents.
- Deliberate non-equivalences with the same global words/numbers; false-positive controls preserving every original fact.
- One-to-one occurrence matching, duplicate row labels, shared headers, repeated equal numbers, reordered rows/columns and ambiguous matching.
- OCR wrong/AI right; AI wrong/OCR right; both wrong; both incomplete; image neither readable; valid additions/deletions; changes extending beyond one crop.
- HTML entities, Unicode combining characters, escaped Markdown pipes, merged cells, nested tables, multiline cells, heading/list scope, continuation pages, figures/footnotes and safe normalization.

### B. Orchestration/cache tests

- Equivalent -> no adjudication -> accepted -> cold/warm equality.
- Conflict -> required alert -> correct source-supported result -> accepted -> replay without repeated cost/rejection against bad OCR.
- Conflict -> usable but uncertain third reading -> knowledge uses it; setup/drafts omit disputed actionable pricing and retain service/draft; unrelated data preserved, all workflows continue, gated review alert contains exact source/chosen text, cache replay retains uncertainty and deduplicates events.
- Conflict -> no usable third reading/malformed/truncated/timeout/unavailable model -> knowledge keeps OCR, alerts and continues; setup/drafts preserve evidence and use missing-price behavior for disputed price. Never insert empty output or invalid response JSON as document content. Name ambiguity uses usable third-check text and an admin alert, without a new provider confirmation gate.
- Cache source/policy/model/render mismatch; incomplete/corrupt artifact; old format; settings change that should/shouldn't invalidate; ForceFresh; full artifact and analytics bypasses.
- All retry/timeout/cancellation paths; crash after evidence write, after adjudication, after required alert, after completion alert, after cache write, after partial index batch; idempotent resume without silent acceptance or missing monitoring.
- One alert per logical event and phase, distinct events not swallowed; off switch affects only alerts; both API/Functions real binding tested.
- Source/document tenant/page identity; stale generation, concurrent update/delete, prompt-injection text and unexpected verifier region IDs.

### C. Consumer integration tests

- Knowledge ingestion: real orchestration + storage, parser/chunker, embedding/index seam; verify exact chosen text, preservation of unrelated data/images, review state and source-to-passage traceability. Do not label an uncertain published reading verified.
- ProviderSetupDocumentReader + McpService: selected text/review identity survive flattening; disputed actionable prices omitted before writes, newly incomplete services counted once in existing noPriceCount/names/IDs/SSE; actual extraction failures use their defined route, not a quality bypass. Existing-service pricing and name ambiguity follow section 17 decisions.
- KnowledgeServiceDraftAnalyticsJob: both artifact and re-extraction paths retain protected-field review evidence. Candidate detection/anchoring must not discard a priced source row merely because its unsafe actionable price was cleared. Persist an editable pending draft, enforce missing-price completion on every approval path, and avoid duplicate conflicting decisions/alerts across consumers.
- Native DOCX/XLSX/PPTX/HTML/text keep their existing extraction/image contracts; test changes only where shared contracts touch them.
- Real Azurite for persisted cache decisions; appropriate real engines for any new schema, Service Bus processor, or database atomicity changes. Test doubles capture external alerts; do not notify real admins during automated tests.

### D. Live, source-verified evaluation of the authorized implementation

- Recreate digital and scanned PDFs containing the principal facts. Use actual configured DI/vision/verifier/embedding services and isolated Canada sandbox index IDs.
- Include representative real two/three-column documents, multilevel tables, mixed scripts/units, tiny print, photos, rotations, handwriting and image/footnote cases; visually establish expected facts from original sources.
- Separate naturally observed model errors from deliberately injected faults. The latter prove gate behavior but do not measure natural error rates.
- Run the current and proposed paths on the same source corpus. Preserve per-document differences, not just average scores. Examine ALL newly rejected/changed outputs for false rejection and ALL accepted corrections for invented changes.
- Evaluate searchable facts and representative answers/citations/image references after chunking/indexing, not only Markdown or token overlap.
- Release requires no observed factual or answer-completeness regression on the agreed corpus; quantify uncertainty and unresolved rate separately. A few clean PDFs cannot establish universal zero degradation.
- Track test scope; delete exact test blobs/cards and verify no leftovers. Never run cosmosindexsetup to retrieve credentials or print secrets. Load Canada settings at runtime; no cross-partition Cosmos queries.

### Existing test locations to read/extend

- `C:/Nik/clinqetfuncations/Clinqet.Communications.UnitTests/Knowledge/KnowledgeTranscriptConservationTests.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.UnitTests/Knowledge/VisionTranscriptConservationTests.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.UnitTests/Knowledge/VisionDocumentTranscriptionServiceTests.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.UnitTests/Knowledge/KnowledgeIngestProcessorFunctionTests.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.IntegrationTests/Tests/Services/KnowledgeOcrPageCacheIntegrationTests.cs`
- `C:/Nik/clinqetapi/Clinqet.API.UnitTests/Services/AI/ProviderSetupDocumentReaderTests.cs`
- `C:/Nik/clinqetapi/Clinqet.API.UnitTests/Services/AI/McpServiceTests.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.UnitTests/Conventions/AdminAlertSettingsConventionTests.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.UnitTests/Functions/AdminAlertProcessorTests.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.IntegrationTests/Tests/Functions/AdminAlertProcessorIntegrationTests.cs`

Find other affected parser/page/cutoff/analytics tests rather than inventing paths. Test owners remain within their own host repositories; no peer-host checkout workarounds.

## 12. Multidimensional audit during development and at completion

The owner explicitly requires this throughout the work, not only once at the end. At each implemented phase: review all applicable dimensions below, record findings, fix confirmed defects and run the affected checks before calling the phase complete. Then run a final combined audit across every changed component and its consumers. Never check off an audit because it was planned; record the code/reproduction/test evidence and outstanding limitations.

Maintain a finding ledger with evidence, severity, affected path, reproduction, proposed correction, test, outcome and remaining limitation. Fix confirmed in-scope findings and rerun their reproductions. Never call an untested suspicion a proven defect.

Audit dimensions:

1. Functional accuracy: missed conflicts, invalid equivalence, false rejection, associations, qualifiers, full source coverage, final composed text.
2. End-to-end flow: knowledge/setup/drafts, all fallback and artifact paths, pre-validation writes, generated downstream fields.
3. Data preservation: original/candidates, unreadable outcomes, images/figure anchors, no silent drops or partial-success claims.
4. Cache/version integrity: accepted proof, valid OCR repairs, policy changes, settings, ForceFresh, source replacement and stale output.
5. Concurrency/idempotency: retry/crash windows, batch partial failure, tenant/document isolation, deletion and duplicate model/alert work.
6. Security: source text as untrusted data, malicious OCR instructions, cross-region/tenant leakage, image URLs, alert excerpt bounds, no secrets.
7. Resource reliability: bounded CPU/memory/work, cancellation propagation, disposal, model/DI/raster limits and bulk-vs-interactive budget fairness.
8. Observability: setting gates actually bind, every logical adjudication visible when enabled, phase/event dedupe, failure visibility, accurate costs.
9. Deployment/contracts: both hosts/options defaults/ARM/deploy wiring, model capability/version, serialized outcomes, schema approvals, safe cutover.
10. Test integrity: tests fail against the demonstrated defect, positive controls remain accepted, real storage/engines where required, no mocks accidentally bypassing the new layer.
11. Product impact: profile extraction/SSE behavior, localized error/status copy, web/mobile parity and approved mockups if new views are needed.

## 13. Phased work and current checkpoint

- [x] Re-read attached owner requirements and latest unit-equivalence clarification.
- [x] Preserve historical experiment evidence and its limits.
- [x] Verify shared knowledge/setup transcription service and discover service-draft consumer.
- [x] Trace cache-hit bypass, OCR fallback finality, lost outcome propagation and setup fallback hazard.
- [x] Specify equivalence, selective source verification, cache policy and gated alert requirements.
- [x] Create this standalone resumable plan without changing application code or unrelated plan files.
- [x] Owner authorizes resuming coding and adding the stronger verifier deployment configuration to deploy.ps1; manual test deployment is owner-managed.
- [x] Owner decides knowledge third output/OCR fallback: use selected text, continue and alert; no uncertainty hold and no disputed-price removal from knowledge.
- [x] Owner differentiates service journeys: retain service/draft but omit disputed actionable price; show existing missing-price summary/editor. Protect service name/pricing only in those journeys; descriptions/other fields alone do not trigger the third check.
- [x] Trace existing setup no-price creation/count/name UI and draft editing/approval/candidate restrictions; record findings and exact references in section 17.
- [x] Owner answered Q1-Q3: auto-use source-resolved price; use third name plus admin alert without confirmation; preserve existing saved price and request replacement review.
- [x] Complete full affected-file/skill/host reads; finish UI launcher, settings-binding, alert rendering, schema and deployment traces.
- [x] Replace rejected Astra with GPT-5.6 Sol/high for evaluation; current official documentation supports the required modalities. Actual account availability remains unverified.
- [x] Configure the selected verifier in deploy.ps1 and both consumers; verify the owner-created deployment, benchmark capability and finalize exact configuration defaults.
- [x] Present exact necessary schema/contract changes for approval; no speculative data model.
- [x] Add regression tests proving the old defects and equivalence controls before modifying runtime behavior.
- [x] Implement shared evidence/comparison/adjudication, alerts and coherent cache artifacts; update all three consumers and fallback paths.
- [x] Build/run affected unit and real-engine integration suites, then live source-verified comparisons and index/readback tests.
- [x] Perform multidimensional audit and fix confirmed findings; repeat targeted verification after changes.
- [x] Update affected skills in four tool copies and project memory; document final cost/quality measurements, approved rebuild steps and limitations.
- [x] Remove investigative files/cloud test data, inspect git status, record exact remaining deliverables. No automatic deployment.

### Important remaining decisions (do not silently assume)

1. All three service-journey decisions are answered in sections 17.12 and 18. Do not ask again about resolved-price use, name confirmation, saved-price preservation or knowledge fallback. Raise only new concrete ambiguities.
2. Live deployment readiness/capability probe: model selection and configuration are authorized, with Sol/high selected for evaluation. The owner will manually create it; current repo names and official documentation do not establish live account access.
3. Exact persisted evidence/status design and schema approvals after checking existing models. Planning authorization is not schema authorization.

### Resume instructions

Read this file, REVIEW.md and the latest conversation first. Inspect git status of each affected repository and retain unrelated edits. Do not resume the other task's RESUME-PLAN.md work. Coding authorization was given on 2026-09-08; do not ask for it again. Resolve the specifically open product/schema decisions only when necessary for dependent work.

Before editing, read relevant skills: Infrastructure, Testing, AI Assistant/provider setup, Voice Assistant/knowledge, Shared/Core; add Function App, Main API, Deployment, Cosmos/Data and UI skills only for affected files. Verify the current AGENTS.md and any nested instructions. Do not spawn agents unless the owner or applicable instructions explicitly authorize delegation.

After each phase, update this checkpoint with exact changed files, commands, results, owner decisions, unresolved findings, scratch locations and test cloud IDs/cleanup. Logs must not contain secrets. Temporary probes belong outside repos and must be removed; regression tests that protect the final behavior are deliverables.

Suggested next-session message:

> Read C:/Nik/Data/knowledge-validator-review-2026-09-08/TRANSCRIPTION-QUALITY-PLAN.md §22 first. The work is built, green and live-verified; nothing is committed, pushed or deployed. What remains is the owner’s: review the 71 changed files listed by `git status` across the eight affected repositories, create the `gpt-5.6-sol` deployment (or run the prepared `deploy.ps1` wiring), and commit/push/deploy in the pipeline order shared → core → infrastructure → hosts.

## 14. Primary references checked during design

- Microsoft Document Intelligence layout: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/layout?view=doc-intel-4.0.0 — structural word/table evidence; figure/table regions can exclude captions/footnotes.
- Microsoft transparency note: https://learn.microsoft.com/en-us/legal/cognitive-services/document-intelligence/transparency-note — evaluate extraction on representative documents; confidence is not a universal guarantee; human review for uncertain outcomes.
- Microsoft add-on capabilities: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept/add-on-capabilities?view=doc-intel-4.0.0 — optional higher-resolution extraction and pricing distinction.
- Microsoft cache-aside guidance: https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside — cache use requires explicit staleness/consistency handling.
- UCUM specification: https://ucum.org/ucum — defined units, dimensions and case-sensitive representations; does not by itself interpret all business prose or nonstandard aliases.
- Unicode CLDR number/currency patterns: https://cldr.unicode.org/translation/number-currency-formats/number-and-currency-patterns — locale-aware formatting distinctions; do not guess ambiguous separators/currencies.

These sources support the design ingredients. They do not validate this proposed implementation or guarantee its measured quality. Application behavior claims above come from the inspected code and recorded experiments.

## 15. Coding standards — mandatory implementation and audit checklist

The owner explicitly asked for the standards inside this plan. This checklist is operative for every phase and every resumed session, alongside the current C:/Nik/AGENTS.md and applicable skill instructions. Re-read the live instructions before edits; this snapshot does not override later owner rules. Do not mark an item satisfied without applicable evidence.

The boxes below are deliberately left unticked: this list is operative for every future session, not a completion tracker. The 2026-09-10 final audit was run item by item against it; what it found and what was fixed is §22.5, and what this work does NOT claim is §22.9.

### Before changing a component

- [ ] Verify all paths, symbols, option names, serializers, persistence contracts, partition keys and call sites from actual code. No invented names presented as existing code and no assumed model behavior.
- [ ] Read the applicable skills, affected source files, owning host Program.cs, tests and fixtures fully. Trace both upstream and downstream effects. API and Functions are separate hosts; the implementation belongs in shared libraries where both consume it.
- [ ] Inspect each repo's branch/status and preserve concurrent work. Never git restore, checkout --, reset, stash or clean the working trees. Never use a dirty-tree merge/rebase to discard another session's changes. Do not commit or push without the owner's instruction.
- [ ] Ask for a missing material product decision instead of assuming it. General implementation permission is already present; do not ask for it again.
- [ ] Before any new SQL table/column/index/constraint/type change, Cosmos field/document family/container/index/TTL/partition change, or Search field/analyzer/scoring change, present the exact owner-required approval table and wait. Prefer existing fields and contracts when sufficient; no speculative schema or unnecessary resources.

### Implementation requirements

- [ ] Simple, readable code using existing patterns; no unnecessary generic frameworks, single-use abstraction layers, compatibility hacks, TODO bypasses or threshold-only substitutes for the root fix.
- [ ] Thread safety, bounded CPU/memory/concurrency/retries and proper cancellation. Use IDisposable/IAsyncDisposable correctly, using/await using for owned resources, and immutable per-request state. Never capture scoped services in singletons or detached work.
- [ ] Use the existing IHttpClientFactory/AI completion transport, resilience policies and governor. No unbounded retry, retry-until-agreement, swallowed exceptions or silent partial success. Distinguish source ambiguity, model refusal, cutoff, outage, cancellation and valid blank pages.
- [ ] Every Cosmos operation is partition-scoped. Read cosmosindexsetup/Program.cs before writing a new query. Prefer point reads for known IDs. Use atomic PATCH for counters, ETag concurrency for multi-writer replacement and existing transaction/idempotency patterns. No cross-partition queries, even for cleanup/rebuild.
- [ ] Service Bus handlers must be safe on redelivery and partial failure. Preserve current queues and dispatcher patterns; use deterministic logical event identity where appropriate. Do not promise an atomic transaction across Cosmos, Blob and Search.
- [ ] Every IMemoryCache write sets Size = 1. Correct expiry, tenant/source/policy identities and invalidation are required; caching may reuse an owner-authorized uncertain result but cannot lose its review obligation or replay it after an offline correction invalidates it.
- [ ] Environment/tuning values are validated settings, with class defaults matching appsettings. Fixed closed sets are enums serialized as strings. No magic thresholds or broad alias normalization that guesses units, currencies or locales.
- [ ] Do not overwrite original source text during comparison normalization. Preserve document/page/row/column/heading/footnote/image relationships and all candidates needed for resolution. Bound evidence without silently discarding unchecked content.
- [ ] Customer/provider-facing messages use localization keys across en/fr/es/hi/gu and any other supported locales. Internal admin alert wording may use the existing exception. No technical implementation vocabulary in provider-facing copy.
- [ ] If UI behavior changes, provider web and provider mobile ship matching rendering/error rules in the same change; customer web/mobile likewise where touched. New views require approved mockups registered under C:/Nik/Data/mockups, including all web/mobile states. Do not create a review UI merely because the backend needs an unresolved result.
- [ ] Add no queue/container/Azure resource/local.settings key without applicable ARM + deploy.ps1 integration. Add the authorized model through the existing deployment and content-filter paths, and verify both host settings and paste blocks. Never run the full deployment script just to discover keys or test a single model.
- [ ] Structured logging and bounded monitoring payloads; no secrets or full sensitive documents in output. Reuse credentials at runtime. The owner's accepted sandbox configuration is not an unrelated finding to fix or rotate.
- [ ] Default to no comments. Add only a short non-obvious WHY/invariant/gotcha; no verbose XML summaries, implementation narration, commented-out code or change history in source.
- [ ] Remove code/settings/DI/imports/interfaces made obsolete by this change. No dead paths left behind to preserve the defective acceptance policy.

### Verification and completion requirements

- [ ] Put shared validation tests in the primary consuming host's suite (Functions for knowledge orchestration); put setup-specific integration/behavior tests in API. Do not duplicate a shared suite per host or make source scans depend on a peer checkout. Required dependencies copied into a host in CI are distinct from a peer-host reference.
- [ ] Regression tests must fail for the demonstrated corruption and pass for legitimate OCR corrections/equivalences. Test both false acceptance and false rejection, with independent expected facts. Do not mirror the implementation or lower coverage to get green.
- [ ] Build affected projects and run affected unit/integration suites with all required tests passing. Use real storage/engines where persistence, constraints, atomicity or Service Bus processing are involved. No skipped failing tests, fixed-delay async assertions or ignored flakes. Report unavailable test infrastructure as unverified, never as passed.
- [ ] Exercise both shared-host configurations, setup fallbacks, service-draft replay, cold/warm page caches, full artifacts, ForceFresh, source update/delete and downstream generated facts. Test source-preservation and answer availability as well as textual correctness.
- [ ] Complete each phase's applicable multidimensional audit and fix confirmed in-scope findings. Repeat the targeted checks after fixes. Run the final combined audit in section 12 before calling the whole task complete.
- [ ] Update the affected skill in all four AI-tool locations after significant runtime/architecture changes, plus project memory/index entries. Do not update skills to claim behavior that has only been planned.
- [ ] Keep scratch files outside repositories. Remove every investigative script/render/log/test blob/card and verify scoped cloud cleanup. Preserve permanent regression tests and the requested plan/review deliverables. Inspect git status and report exactly what remains; do not delete another task's files.
- [ ] Update this checkpoint with authorization decisions, changed files, actual commands/results, cost measurements, unresolved findings, exact temporary cloud IDs and cleanup verification after each phase. No automatic deployment, merge or commit.

## 16. Current continuation evidence and owner decisions

On 2026-09-08, after the owner authorized coding and deployment configuration, re-read the shared service, its request/result/settings and the setup reader/wrapper/fallback sections. Reconfirmed:

1. ProviderSetupDocumentReader.TranscribeWithVisionAsync calls the same IVisionDocumentTranscriptionService used by knowledge. Its tuple return drops PagesRejected and other detailed outcomes.
2. McpService's generic unsuccessful image-read branch calls ExtractWithVisionAsync except for the two explicit size/page limit cases. A new unresolved result must have an explicit non-bypass route before that fallback.
3. KnowledgeServiceDraftAnalyticsJob remains an additional consumer and artifact reader; it is required scope, not optional follow-up.
4. Current shared Degraded excludes PagesRejected. Treating a third-reader disagreement as ordinary rejection would incorrectly make the OCR fallback final.
5. The existing AICompletionService already has image-plus-schema request support; reuse and test it rather than creating a parallel transport. Inspect its model capability and token/cost paths when introducing the dedicated alias.

Plain-language explanations for the owner:

- Provider setup reads an uploaded document to fill business/service details. Today its wrapper takes the extracted words and page count but leaves behind the reader's quality information. Also, some failed image reads go through a separate direct-image extraction route. The change must preserve the chosen third reading and review information through both routes, while continuing setup under the owner's policy. These are confirmed code-path facts and integration hazards; no natural corruption in a real provider setup upload has been demonstrated by this review.
- Service-draft extraction is the background job that reads uploaded knowledge documents to generate suggested service records. It may use saved extracted text or read the source again. Both routes must use the same selected reading and retain review information, so a price corrected in knowledge does not reappear incorrectly in a suggested service. Inspect RunCoreAsync and its consumers before claiming exact provider-visible behavior or automatic final publication.

The final audit must cover these routes together, the model/configuration/prompt behavior, equivalence and association checks, page/full-artifact caches, images, alert/offline-review traceability, failure handling, concurrency/idempotency, security, cost/resource bounds and regression coverage. Fix every confirmed defect introduced or exposed within this work; rerun its tests and reproduction. Do not declare completion with unfixed in-scope audit findings. Report unrelated findings separately rather than silently modifying another feature.

The owner answered the earlier document-hold and fallback questions for KNOWLEDGE: **use third text, or OCR when no usable third text; continue and alert.** The latest instruction adds stricter service-pricing behavior for provider setup/drafts and a narrower service-name/pricing validation scope. Section 17 supersedes the earlier uniform treatment. Astra is rejected; Sol/high is the current evaluation choice.

Do not ask again for coding permission, knowledge non-blocking operation, knowledge OCR fallback or routine selection between the allowed model candidates. The latest planning request records all three answers in sections 17.12 and 18; no Q1-Q3 product answer remains pending. New schema or UI decisions still follow the exact owner gates when concrete changes are proposed.

No runtime, test, schema, deployment-script or cloud changes have been made in this continuation checkpoint. The model is a documented evaluation selection, not a created or tested deployment. Only this plan was updated; no scratch artifacts were created.

## 17. Three-journey design — latest owner instructions, source review and implementation specification

This section is the authority for consumer differences. Earlier shared-mechanism sections still apply to source retention, equivalence, bounded verification, cache identity and monitoring. They must not be interpreted as requiring identical third-check scope or identical publication behavior in all consumers. The latest owner request is to finish planning before coding and ask about material uncertainty. No runtime fix has been implemented in this review.

### 17.1 Decision register

| Decision | Status | Exact requirement |
|---|---|---|
| Knowledge uncertain third reading | Owner decided | Use the third reader's usable disputed text and continue ingestion/indexing; retain alternatives; admin reviews offline |
| Knowledge third call fails/no usable reading | Owner explicitly confirmed | Use original OCR for the affected source region, continue, and fire the admin alert; do not delete the disputed price from knowledge |
| No whole-flow uncertainty block | Owner decided | A quality discrepancy must not stop the whole knowledge, setup or draft-generation workflow. Individual service completion/approval can require the provider's missing price as it already does |
| Setup new service with disputed price | Owner decided | Create the service without usable pricing rather than discarding the service; route through existing provider-completion behavior, summary count and affected service names |
| Draft with disputed price | Owner decided, preferred branch supported by inspected code | Keep/create the draft without usable pricing and let provider enter it before approval. Do not silently omit the draft. The owner's alternative of retaining a price plus a confirmation marker was conditional on there being no editor; editors exist, so that alternative is not needed for a missing numeric price |
| Setup/draft third-check scope | Owner decided | Service name and cost/pricing differences only. Do not trigger this extra verification or blank pricing solely because an unrelated description, specification or quantity differs |
| Knowledge third-check scope | Owner decided | Full factual content: names, prices, descriptions, policies, quantities, units, negation, conditions, associations and omissions |
| Equivalent forms | Owner decided | No third call for proven equivalences in the applicable scope. Knowledge distinguishes 5 mg from 5 g; all supported true equivalents such as 5gram/5 g and 5000 mg/5 g remain equivalent in context |
| Model | Delegated choice | Use Sol/high for initial evaluation; Terra/high can be compared if quality is equal on the difficult cases. No Astra and no automatic downgrade based only on cost |
| Actual deployment | Owner-managed test deployment | Prepare matching model/version/alias/settings/deploy.ps1 changes; owner creates under the same Foundry account, then test the actual endpoint |
| Model-resolved initial price conflict | Owner answered YES; Q1 closed | Automatically use source-resolved price; provider entry only for still-uncertain service pricing in setup/drafts. Knowledge retains selected price. Admin alert includes resolved third-check cases |
| Unresolved service name | Owner rejected confirmation; Q2 closed | Use usable third-check name, retain content/service/draft, continue and alert admin in all flows. No new name-confirmation gate or removal |
| Existing service's current price | Owner accepted recommendation; Q3 closed | Preserve saved price and request provider review of disputed replacement; alert admin. Usable retained pricing is not missing pricing |
| Schema/UI | Exact design gate, not blanket authorization | Reuse existing nullable price and completion UI where adequate. If durable evidence or retained-price review requires new persisted fields/UI, present concrete changes and required mockup before implementing them |

### 17.2 Journey matrix and the meaning of continue

| Situation | Knowledge answers/index | Provider setup | Service-draft extraction/review |
|---|---|---|---|
| Equivalent protected content | Use normal extraction; no third call | Same; no extra missing-price count | Same; no new review requirement |
| Description-only changed meaning, no effect on service identity or monetary fields | Compare/verify and apply chosen full-content text; alert as required | Does not independently trigger this new third check or missing-price behavior; retain current normal extraction/validation | Same narrow rule; no extra service verification call |
| Amount or price-to-service association differs | Third source check | Third source check; auto-use resolved price, otherwise missing-price rule for new services | Third source check/reuse suitable evidence; auto-use resolved price, otherwise preserve editable incomplete draft |
| Third yields usable uncertain price | Keep chosen price in knowledge, alert | Clear actionable disputed pricing for the new service, retain service and completion summary | Price remains absent in actionable draft fields; original/third values remain source evidence, provider supplies price |
| Third unavailable/no usable price | Keep OCR reading, alert | Do not use disputed OCR price as trusted service pricing; continue with missing-price service | Keep source evidence and draft; missing-price edit required |
| Name differs | Verify name and its surrounding associations | Use usable third name and alert; no new name-confirmation gate | Same; no new name-confirmation or approval gate |
| Both name and price differ | Full-context verification and selected output | One related verification group when possible; use third name, omit only still-disputed actionable price on new services; alert and continue | Same, with editable pending item and no blind match to an existing service |
| A sibling service is unaffected | Preserve and publish normally | Create/update normally | Generate/approve through its current normal rules |
| Provider enters valid price | No automatic change to source knowledge solely because service price was edited | Existing service edit/completion flow handles it | Existing Edit + approve flow writes the provider's value with ETag checks |
| Admin reviews/corrects source reading | Reprocess affected source-derived content through supported scoped path | Do not overwrite a later provider-entered price/name with old extraction | Do not resurrect stale pending drafts or overwrite provider edits/decisions |

Continue means the job/request progresses and retains each valid service/draft. It does not mean a new service with no usable price becomes bookable. Current ProviderSetupServiceWriter uses PendingProviderCompletion for incomplete pricing; the owner specifically asked to reuse that behavior. Draft generation succeeds by saving a pending editable draft; individual approval requires price entry. Genuine corrupt upload/storage outage/authorization failure retains existing error handling; non-blocking quality policy is not permission to report a failed write as successful.

### 17.3 Verified current implementation and tests read

All paths below were located before reference. Line numbers identify reviewed code and may move. This is a source review; the cited existing tests were inspected, not executed in this planning continuation. Do not report these observations as fresh live model incidents or a completed multidimensional implementation audit.

| Evidence | Verified behavior | Design consequence |
|---|---|---|
| `clinqetinfrastructure/Services/AI/McpService.cs`, around 748-826 | Unusable extracted amount is evaluated per service. When an existing service has usable pricing, current logic copies the saved primary pricing into the extracted DTO; otherwise unusable Price/MaxPrice are nulled | Add explicit dispute mapping before the write; Preserve current usable saved pricing under approved Q3. Clearing fields alone can be defeated by the existing copy-back branch |
| Same file, around 870-905 | Shared writer persists service; PricingIncomplete adds actual written service to pricingRequiredServices and its name to noPriceServiceNames | Let the final stored result drive missing-price count; do not just increment a counter on every OCR discrepancy |
| Same file, around 975 and 1085-1092 | noPriceCount = pricingRequiredServices.Count; summary contains NoPriceCount, an ordered bounded name sample, and NoPriceServiceIds. Current source collections are ConcurrentBag, not inherently distinct | Include disputed-price newly incomplete services exactly once; keep true total and bounded names distinct; preserve retry/chunk semantics and verify identity dedup rather than assuming the collection provides it |
| Same file, BuildSummaryMetadata around 1470 | Serializes noPriceCount, noPriceServiceNames, noPriceServiceIds | Reuse current SSE metadata and existing localization instead of inventing a second price-warning payload |
| `clinqetinfrastructure/Services/AI/ProviderSetupServiceWriter.cs`, WriteAsync/Derive around 93 | Missing/unusable pricing or missing category -> PendingProviderCompletion; otherwise normal approval status | A service without price is retained but incomplete. Do not invent a new service status for the price-only case |
| Same file, BuildPricingFromExtracted around 251 | Builds fixed/range/hourly pricing, resets numeric primary price slots, preserves/applies separate currency/tax/notes logic | Suppression must cover the actual price shape and harmful alternate fields, not only one DTO number; do not inadvertently clear provider tax/notes on updates |
| Same file, IsPricingUsable around 310 | Fixed/hourly require >0; range requires start and max >0 and start<=max | Existing contracts treat zero as incomplete, not free. Do not change free-service or open-ended-range semantics incidentally |
| Same file, DispatchPricingRequiredNotificationsAsync around 497 | Existing per-service/summary pricing-required notifications | Reuse existing notification behavior, affected service IDs and dedup patterns; admin verification alerts are separate from provider price-completion notifications |
| `clinqetwebpartnerapp/src/components/common/AIAssistantModal.jsx`, around 779-824 | Displays missing-price total, bounded service-name chips and remaining-count indicator | New disputed-price incomplete services can appear through the current summary shape |
| `clinqetmobilepartnerapp/src/components/AIAssistantModal.tsx`, around 929-959 | Corresponding count/name summary | Verify exact rendering/count parity, not just existence of similar components |
| `clinqetapi/Clinqet.API.UnitTests/Services/AI/McpServiceTests.cs`, NewServiceWithUnusablePrice_IsSalvagedAsNoPrice around 1137 | Existing test expects no numeric pricing, PendingProviderCompletion and count/name summary | Extend with real dispute evidence and positive resolved/equivalent controls, not a fake out-of-range price standing in for all disputes |
| Same test file, UpdateWithIncompleteOrUnusablePrice_KeepsExistingPrice around 1193 | Existing test preserves stored 30 price and Approved status, with noPriceCount=0 | Owner approved retaining this behavior for disputed replacements, with provider review and admin alert; do not count retained usable pricing as missing |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeServiceCandidateDetector.cs`, Detect around 77, row hashing around 116 | Only priced source units become candidates; identity hashes normalized name plus PriceText | Do not erase source money before detection or affected drafts disappear; source identity cannot be rebuilt from a cleared actionable price |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeServiceDraftBuilder.cs`, Anchor around 85 | `if (item.Price is not > 0) continue`; requires extracted amounts to match candidate numbers and name overlap | Existing builder does not produce a draft with entirely absent extracted price. A source-linked disputed-price branch is needed; retain the association guard and do not accept arbitrary unanchored items |
| Same builder, Materialize | Price/MaxPrice nullable fields are populated; NeedsReview computed from judge/score; PriceText and Provenance retain source details | New draft can reuse nullable monetary fields and existing source evidence. Do not mislabel source PriceText as a confirmed actionable amount |
| `clinqetfuncations/Clinqet.Communications/Services/KnowledgeServiceDraftAnalyticsJob.cs`, LoadInputs/Rederive, 250 onward | Reads full artifact or source re-extraction; detector -> judge -> extractor -> taxonomy -> builder | Carry evidence through both input routes, all filtering and mapping stages, not just builder's final assignment |
| Same job around 484-501 | Drops update suggestions without a price change and counts them already-in-catalog | Disputed-price items must not disappear because suppression accidentally removes the action/change metadata. Name-only uncertainty adds no new confirmation gate under approved Q2; do not silently remove the existing category-only filter |
| `clinqetcore/Entities/COSMOS/KnowledgeServiceDraft.cs` | Existing Price and MaxPrice nullable; NeedsReview; SourceName/DisplayName/PriceText; Provenance page/section/source line; ETag inherited | Missing-price draft need not invent a new price field. General NeedsReview is not a dedicated proof of name confirmation |
| `clinqetshared/DTOs/Knowledge/KnowledgeServiceDraftDtos.cs` | Edit DTO has DisplayName, nullable Price/MaxPrice, PriceType and required ETag. List DTO has PriceIncomplete and NeedsPriceTypeReview | Both editability and warning ingredients exist, but naming/price-completeness semantics need careful reuse |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeDraftApprovalService.cs`, EditAsync around 183 | Saves name/price/description with ETag; clears NeedsReview/CurrencyMismatch/approve errors on any accepted save | Cannot reuse NeedsReview alone as a secure field-specific confirmation gate; description-only save currently clears it |
| Same service, ApproveCoreAsync around 319 | Missing price is rejected before creating a service | Keep this per-item gate; it does not prevent draft generation or unrelated services |
| Same service, ResolveAmberSkip around 778 | Bulk skips NeedsReview/currency/missing-price/category conditions | Maintain server enforcement and align bulk counts/selection; a UI warning alone does not protect bulk/API callers |
| Same service, ApproveUpdateCoreAsync around 417-503 | Single update claims draft then applies requested pricing; reviewed entry path has no matching IsDraftPriceIncomplete gate before the write | A null-priced UPDATE draft exposes a dangerous path: add/test the appropriate price-completeness gate before any claim or catalog mutation; do not add a name-uncertainty gate, rather than relying on bulk guards or the UI |
| Same service, ToDtoAsync around 1455 | Maps generic NeedsReview to NeedsPriceTypeReview and computes PriceIncomplete | Name-dispute review cannot be silently represented as 'check price type' |
| `clinqetinfrastructure/Data/COSMOS/KnowledgeServiceDraftRepository.cs` | NeedsReview filter/count uses stored needsReview only; auto-approve excludes needsReview/currency then service applies completeness | A null price can be blocked from approval yet absent from the 'please check' filter if stored flags are not coherent. Test counts/filter/mass-action parity |
| `clinqetwebpartnerapp/src/components/Profile/knowledge/KnowledgeDraftEditModal.jsx` | Price initialized blank when null; Save requires positive base price; name editable; Save-and-approve supported | Provider can fill a missing price. No need for the owner's conditional retain-disputed-price workaround |
| `clinqetmobilepartnerapp/src/Screen/ProfileFlow/Knowledge/KnowledgeDraftEditSheet.tsx` | Corresponding editable name/price and save validation | Same conclusion, with independent parity checks |
| Both `knowledgeDraftMeta` files | PriceIncomplete intercept currently focuses maxPrice regardless of actual missing slot; generic review focuses priceType | For missing base price, focus the real price field. Do not add a name-review intercept or masquerade name uncertainty as priceType; owner rejected name confirmation |
| Both KnowledgeServiceDraftsSection components | Existing incomplete-price chip reads 'needs upper amount'; editor submission/reload and approve paths exist | Completely missing fixed/hourly/base prices need accurate labels on web/mobile. Do not leave 'upper amount' on a service with no base amount |
| `clinqetapi/Clinqet.API.IntegrationTests/Controllers/KnowledgeServiceDraftsIntegrationTests.cs`, around 237 and 500 | Tests incomplete-price create approval refusal and ETag-protected editing of name/price | Add missing-base-price draft generation/edit/approve and direct-update enforcement cases, preserving existing tests |

### 17.4 Protected-field scope and equivalence

Use an explicit typed workflow policy passed through the shared service; proposed policy concepts are KnowledgeFullContent and ServiceIdentityAndPricing. Names are design concepts, not existing enums. Do not infer policy from file extension, storage container, prompt text or caller stack. Bulk versus Interactive is scheduling, not validation scope.

For knowledge, retain the entire section 5 equivalence matrix and full factual checks. A description's 5 mg -> 5 g is significant; 5gram -> 5 g is equivalent. A dropped 'not', swapped price, condition moved to another row, omitted table footer or duplicated exception still matters.

For service journeys, determine the role of a changed span before deciding whether it is protected:

- Protected: extracted service display/source identity and its association with the monetary field that would be written. Pricing comparison must include the amount's currency, sign, scale, fixed/hourly/range role and relevant qualifiers/basis when those change the meaning of the service price.
- Not an independent trigger: description wording, product specifications, generic quantities, marketing text, general document title, background company text, unrelated policy prose, or a 5 mg/5 g difference confined to an unprotected description.
- A quantity can be part of the service name ('5 g pack' versus '5 mg pack') or the pricing basis ('per hour' versus 'per visit'). In those positions it affects one of the protected fields; it cannot be exempted by blindly removing all unit tokens. This follows the owner's service-name/pricing exception, rather than expanding validation to every description.
- Preserve true monetary equivalence: $5.00/$5 with established same currency, locale-proven representations and exact scaling with same role. Do not interpret an ID, phone number, quantity, year, deposit or rate as the service's base amount merely because the number is nearby.
- Currency-only, interval-bound-only, price-type or basis differences can change price meaning even with equal digits. Treat related source cells together and document the reason as a pricing dispute. Verify actual DTO/writer use before defining which tax/discount/deposit fields this change owns; do not silently widen unrelated offer/payment features.
- Name normalization must preserve meaningful distinctions: 'Haircut'/'Hair colour', 'Gel manicure'/'Manicure', branch/variant labels and units inside identity. Cosmetic casing/spacing/Unicode normalization is not permission to merge distinct services. Reordering rows or equivalent markup is not by itself a name change.
- Missing name/price, wrong row association, duplicate row labels, same price on several services, and one source item mapped to two extracted services are protected-field discrepancies. Matching global tokens or using nearest price is insufficient.
- In service mode, low confidence or missing geometry in an unrelated description must not cause paid verification. Missing evidence needed to bind the service name to its price may justify it. Tests must show both behaviors.
- Do not remove existing document limits, ordinary taxonomy validation, image handling or unrelated current business validations under the label 'name/price only'. The narrowing applies to this new discrepancy verification and disputed-price disposition.

### 17.5 Shared evidence, downstream extraction and cache separation

1. Keep original bytes, content identity, DI Markdown and structural evidence. The initial vision transcript is a separate candidate; candidates are never overwritten during normalization.
2. Build source-region identities with page/span/table-row/column/header scope. For native formats use the equivalent sheet/cell/slide/paragraph references rather than inventing PDF page numbers. Retain figure anchors and image provenance.
3. Align OCR and first vision text. In service mode also carry the service-candidate/extractor association that identifies which source name and money belong to which proposed service. An arbitrary model-generated candidate ID is not trusted without bounds/coverage validation.
4. Compare under the explicit workflow policy. Group related price/name discrepancies; request original-image/context verification only for substantive/uncertain protected content. Equivalence does not generate a third call or provider completion warning.
5. Preserve the third reader's observed text separately from the chosen publication text and actionable service fields. A best-effort price that is allowed in knowledge is not automatically allowed in a service DTO.
6. Validate the final extracted service name/price against its mapped source decision after downstream extraction too. Provider setup calls ExtractContentFromPreparedAsync after transcription; service drafts have their own extractor after detector/judge. Either stage can change a previously correct price/name. A transcript-only fix cannot claim protection of final service writes.
7. This final mapping should reuse known evidence locally, not blindly re-run Sol for every service. If downstream extraction introduces a new protected conflict, resolve it through the same bounded mechanism while retaining the caller's scope.
8. Suppress unsafe actionable prices at a typed field boundary before writer/materializer/approval; do not regex-delete all matching numbers from Markdown. The same number may occur in ten unrelated facts. Preserve selected knowledge text and raw price evidence separately.
9. Record source reading, selected text, certainty/review reason, workflow policy, suppression disposition and correlation. Exact persistence fields are not yet approved. Check existing artifact/metadata structures first; propose only fields read and written in this change.
10. Shared evidence may be cached/reused across workflows when source, region, model and policy coverage justify reuse. Service-only validation must NEVER masquerade as full knowledge validation. Cache identity must distinguish validation scope and disposition version; alert preference alone must not change text/cache identity.
11. Full knowledge artifact replay may already contain a chosen disputed price. Draft extraction must read its evidence, not just its polished Blocks. If the evidence is unavailable/currently incompatible, obtain the needed protected-field evidence; do not infer correctness from artifact existence.
12. A description-only knowledge dispute should not turn a service draft into 'needs price', nor make a fresh service-mode request pay for full-page knowledge validation. A suitable existing name/price adjudication can be reused without an extra call.
13. Owner/provider correction is a new authority for the edited service field. A retry, recomputed row hash or source re-extraction must not overwrite it with an old candidate. Scope invalidation/rebuild carefully; editing a service price is not authorization to rewrite the uploaded knowledge document.
14. Keep expensive model calls outside service/Cosmos retry callbacks. On ETag retry, recheck persisted identity/edits and apply only authorized field mutations. A retry is not permission to replay a stale snapshot over provider input.

### 17.6 Knowledge journey, step by step

Upload -> source extraction -> current vision reading -> full-content comparison -> selective third source check -> selected full text -> figures/blocks/artifact -> chunking/embedding/index. Source artifacts must preserve page/region identities to the final passages.

- Usable third answer: use it for the disputed region, even when still review-needed, and alert. Preserve unrelated page text and image anchors; do not regenerate the entire document just to replace one amount.
- No usable third answer after bounded existing retry policy: retain the original OCR reading for that region and alert with failure category. Other successfully transcribed/corrected regions retain their decisions.
- Never clear a knowledge price just because a derived service will need provider pricing. Same source can intentionally yield a knowledge sentence with a disputed number and a service draft with null actionable Price.
- Alert must identify actual file/document/source version, page/region, source passage text, OCR/AI/third readings where present, chosen text and failure/review reason. Before final passage IDs exist, use source references; after indexing, correlate to actual created passage IDs where available. No guessed page/passage IDs or links to inaccessible source.
- If storage/indexing fails, normal retry/recovery applies; do not claim Ready before successful publication. Quality ambiguity alone is not a new processing failure.
- Admin-alert queue failure must retain a durable retryable review obligation using the agreed existing persistence path. Do not await offline human review and do not use untracked fire-and-forget work as a promise of reliable alerts.
- All original source data stays available. Caches distinguish selected-with-review from verified; no paid re-adjudication on each read, and no lost alert obligation on replay.

### 17.7 Provider-setup journey, step by step

1. Keep current upload validation, source routing, DI/native extraction, image handling, context and permissions. Shared service receives service-name/pricing validation scope.
2. Carry protected-field evidence out of ProviderSetupDocumentReader; returning only Markdown/PageCount is insufficient for disputed-price decisions. Normal Success can remain true for a usable document with per-service price completion required.
3. Do not send such quality results into McpService's generic unsuccessful-image fallback. Actual extraction failures may need fallback; any fallback that produces service name/price must participate in the same protected-field check. Preserve image-only service discovery rather than deleting that capability.
4. Extract proposed services using the existing pipeline. Match each to its source evidence and final protected fields. Do not assume list index or normalized name alone is identity, particularly across chunked extraction/dedup/duplicate names.
5. Automatically use source-resolved third-check pricing; require provider input only for still-uncertain service pricing. For each price requiring input on a NEW service, omit actionable values before ProviderSetupServiceWriter. Keep service name/description/category/images and source evidence; do not mark the whole document unsuccessful.
6. Clear all unsafe fields of the affected price shape coherently. For a disputed range endpoint/association, do not inadvertently leave an apparently complete wrong range. Do not turn unknown into zero, use a sentinel amount, or let an extractor re-infer cleared money from PriceText, PriceNote or description.
7. Reuse PendingProviderCompletion and existing price-required notifications. Count only successfully persisted services whose actual pricing is incomplete; use distinct service IDs, not duplicate model mentions. Failed service writes must not inflate success or completion counts.
8. Existing summary fields noPriceCount/noPriceServiceNames/noPriceServiceIds must include these newly incomplete services. Total is exact; names are a bounded sample and UI's '+N more' stays accurate. A service lacking category and price can legitimately appear in both distinct categories of required work without double-counting created services.
9. Web and mobile already show the no-price summary; verify both against the same SSE fixture. Do not invent an extra count merely for 'verification was called'. A resolved equivalent price adds zero to missing-price count.
10. Existing services: preserve current usable saved pricing, request review of disputed replacement and alert admin; do not count usable retained pricing as missing. The current code copies saved pricing into the extracted DTO; account for that deliberately and protect against provider edits that happen while extraction is running. Do not erase current saved prices as an accidental side effect of using null.
11. Unresolved service name: use usable third-check name and alert, without a new name-confirmation or uncertainty publication gate. Apply the chosen name through the normal source-linked create/update contract. Do not transfer another service's price, mutate an unrelated existing service, merge distinct services or duplicate the same source offering because its chosen name changed. Preserve evidence while the rest of the setup continues.
12. Follow current completion/save APIs for provider-entered price. Confirm actual provider edit navigation/permissions and service visibility rules during implementation before claiming a one-click completion feature exists; the source review established the summary and writer status, not an exhaustive live UI journey.
13. Test chunked extraction, interleaved SSE events, partial service failures, duplicate/existing service matches, retry/reconnect, name-sample bounds and current price/category completion combinations.

### 17.8 Service-draft extraction and provider approval, step by step

1. Load source blocks and relevant verification evidence from the full artifact when compatible; otherwise re-extract under service scope. A text-only cached artifact cannot certify an unresolved price.
2. Keep original priced source rows through detector/judge so they remain detectable. Do not blank raw source money before KnowledgeServiceCandidateDetector's IsPriced gate. Preserve original name/price provenance and identity across repeated runs.
3. Extract services and attach protected-field source mapping before clearing actionable pricing. Current Anchor discards null Price and matches source numeric values; introduce an explicit evidence-backed disputed-price path that retains the candidate without claiming a confirmed numeric match.
4. That path must still prove a real source offering and one-to-one candidate association. Do not bypass the offering judge or accept every paragraph without a price. Scope expansion to genuinely unpriced documents is not requested by this bug fix; disputed formerly-priced rows are the required addition.
5. Keep name/price source association checks for ordinary rows. Swapped prices cannot pass solely because both numbers appear on the page. One source row cannot validate two different extracted services.
6. For a price requiring provider entry, materialize a Pending draft with null actionable Price and appropriate MaxPrice disposition; keep source PriceText/Provenance for review. Existing nullable fields already support this storage shape. Do not insert a dummy price to satisfy the old anchor.
7. Ensure NeedsReview/PriceIncomplete, queue ranking, filters, totals, page counts and bulk eligibility are coherent. Current NeedsReview means price-type uncertainty in the DTO; do not pretend it is already a typed source-price or name-confirmation reason. Specify the minimal needed change and obtain schema approval if a persisted field becomes necessary.
8. Correct web/mobile missing-price rendering: fixed/hourly/missing starting amount -> base-price label and focus; missing range ceiling -> upper-amount label/focus where the domain requires it. A no-base-price card must not focus a hidden maxPrice input. Reuse current modal/sheet rather than create a second editor.
9. Existing Edit accepts provider name and price with ETag. After valid price entry, the displayed warning and server state must agree; Save-and-approve must read the persisted edited price, not the previous card snapshot. On 412, reload and show the current localized conflict behavior.
10. Enforce per-item pricing completeness in ALL server routes: single create approve, single update approve, approve-as-change, batch creates, batch updates, approve-all and any retry helper. UI interception is insufficient. Particularly audit ApproveUpdateCoreAsync before it claims the draft or writes pricing; reviewed code lacks the create path's early completeness check.
11. Bulk processing skips incomplete/review-needed drafts and continues other eligible items with accurate counts. Draft-generation success must not be confused with final service approval; a pending draft is the expected retained output.
12. Existing Update drafts must retain their intended target and 'price' change obligation even if actionable Price is suppressed. The analytics job's category-only filter and extractor 'skip' action must not count a disputed price as already satisfied. The existing service retains saved pricing while the proposed replacement awaits provider review under approved Q3.
13. A name dispute may change matching, RowHash and dedup. Use usable third-check name without provider confirmation, name removal, name-only price suppression or a new name-uncertainty approval gate. Do not set generic NeedsReview solely for this name uncertainty; preserve other legitimate review reasons. Retain ordinary name editing and bind the chosen name to its actual source row. Audit matching/dedup for wrong-service mutations.
14. Preserve provider edits across reanalysis: detect edits/ETag/source generation with existing mechanisms or propose a concrete required design. Pending rows are currently regenerated and RowHash includes source price/name; do not create duplicate drafts or overwrite a manually supplied price on retry. Keep approved/dismissed decisions and source-update semantics explicit.
15. Retain source image/URL association, optional images, category proposals, placement, duration and other existing draft data. A disputed amount should not drop the draft's image or change which service area it will use.
16. Deletion/replacement and offline source correction must clean only obsolete derived items through existing scoped cleaner paths. Never use a cross-partition sweep; never delete the original as 'cache cleanup'.

### 17.9 Findings and questions discovered during this review

| ID | Finding/status | Required treatment |
|---|---|---|
| T01 | Confirmed existing capability: setup creates new unpriced services and reports count/names | Reuse and test with actual dispute metadata |
| T02 | Confirmed existing capability: draft name/price editing on web/mobile, server ETag save | Use null actionable price plus current editor; no retained-unsafe-price workaround |
| T03 | Confirmed current limitation: draft candidate/anchor pipeline requires price, so early suppression drops the row | Add source-backed disputed-price handling at correct stage; no arbitrary bypass |
| T04 | Confirmed static UI mismatch for newly supported missing-base-price drafts: PriceIncomplete always renders/focuses upper amount | Fix accurate per-shape label/focus in both apps and cover all field combinations |
| T05 | Confirmed route asymmetry by source: single Update approval lacks early price completeness gate present in create/bulk | Reproduce with null-priced update via actual controller/service test, then fix all corresponding paths before enabling such drafts |
| T06 | Confirmed current semantics: generic NeedsReview clears on any Edit save and maps to price-type review | Do not repurpose it for name confirmation: owner explicitly rejected that gate. Preserve existing legitimate review behavior |
| T07 | Static contract disagreement: web editor permits omitted range upper bound and equal endpoints; mobile permits omitted upper bound but requires entered max>start; backend completeness requires both endpoints and allows equality | Audit against actual service pricing domain/approved UI before changing range policy. Report as source-confirmed inconsistency, not a measured production failure. Resolve consistently under owner intent; do not lower backend constraints solely to make a UI test pass |
| T08 | Confirmed current behavior: setup preserves existing saved price when extracted price missing, count=0 | Owner approved preserving saved prices and requesting replacement review; trace the concrete existing review presentation before proposing new UI; do not mislabel preserved price as absent |
| T09 | Architectural requirement: service-only cache replay cannot certify full knowledge | Include scope/coverage in validation identity and consumer evidence transfer tests |
| T10 | Traceability requirement: final passage IDs do not exist at third-check time and setup may never have one | Use real source references then correlate actual generated passages; no fabricated identifiers |
| T11 | Regression risk to verify: reanalysis may replace Pending edited drafts or produce a different RowHash after price/name correction | Inspect reconciliation/ETag contracts end-to-end and add replay/provider-edit race tests before declaring preserved data |

This ledger is not proof of model failure in real setup/draft documents. T03-T07 are concrete implementation constraints or static inconsistencies to reproduce/test. Fix every confirmed in-scope audit finding; keep evidence, final changes and test outcomes in the ledger instead of silently skipping difficult cases.

### 17.10 Detailed acceptance-test matrix

| ID | Scenario | Required observation |
|---|---|---|
| J01 | Haircut500/Colour1200 swapped to Haircut1200/Colour500 | Both service scopes and knowledge detect changed association; positive rows preserved; third evidence bound to correct rows |
| J02 | Deposit is not refundable -> refundable | Knowledge discrepancy; service journey does not independently trigger this check when only unprotected description changed |
| J03 | 5gram/5 grams/5 g/5000 mg | Equivalent mass in knowledge context, no third call; no price warning; preserve display wording |
| J04 | 5 mg -> 5 g only in description | Knowledge detects; service mode no extra paid verification/missing-price consequence |
| J05 | Same unit difference inside service name or pricing basis | Protected service identity/pricing comparison, with context; no blanket unit exemption |
| J06 | $5.00/$5 same currency; currency unknown; CAD/USD | Equivalent known currency no call; ambiguous/different currency handled as pricing discrepancy |
| J07 | Third resolves initial amount conflict | Automatically use source-resolved price; admin alert in all three flows; no extra price entry or missing-price count solely for the resolved discrepancy |
| J08 | Third gives usable uncertain amount | Knowledge indexes selected amount; setup new service retained without usable price; draft retained with null actionable price; alerts contain alternatives and disposition |
| J09 | Third timeout/refusal/malformed/empty | Knowledge retains OCR; service prices needing review stay absent; all other rows continue; original/source evidence and review obligation retained |
| J10 | Third output valid JSON but wrong IDs/page/tenant/missing requested region | Do not apply to unrelated content; classify unavailable/invalid evidence and follow defined fallback; no invented text |
| J11 | Valid price wrong name; valid name wrong price; both wrong | Correct field mapping; Use third name without a new confirmation gate or unsafe existing-service match; unaffected service amounts unchanged |
| J12 | Service source row omitted, duplicated or merged by AI | Detect protected missing identity/amount; retain the real offering for review rather than silently count skipped/already-in-catalog |
| J13 | Fixed/hourly/range; min missing; max missing; reversed/equal endpoints; zero/negative/free text | Appropriate field suppression and current domain constraints; accurate UI focus/labels; no zero-as-unknown workaround; range policy resolved consistently |
| J14 | Discount/deposit/tax/price-from/hourly context and two money columns | Correct monetary role and source association; no substitution of deposit for total or inference from unrelated numbers |
| J15 | New service disputed price | Writer output is retained, pricing incomplete, PendingProviderCompletion; exact setup noPriceCount and names/IDs |
| J16 | Existing service disputed new price, concurrent manual price edit | Preserve current usable saved price and request replacement review; never stale overwrite or silent erasure; accurate provider/admin indication |
| J17 | Name disputed on existing service | Use third name without name confirmation; admin alert; no unintended rename/merge/update of a different catalog item; batch continues |
| J18 | New no-price draft | Survives detector/anchor/materializer through source evidence; Pending and editable; source PriceText not treated as confirmed amount |
| J19 | Single create/update/as-change approval with missing price | Server denies that individual write before catalog mutation; other drafts unaffected; no reliance on UI |
| J20 | Batch/approve-all includes complete and incomplete drafts | Eligible complete drafts processed; incomplete items retained/skipped with accurate result/count; no blind price write |
| J21 | Provider enters valid price, saves, approves | Fresh ETag/persisted price used; warning resolves only as appropriate; no stale-card amount; race gives localized 412 path |
| J22 | Name-only uncertainty with independently established price, followed by description edit | No new name-confirmation state, price clearing or approval intercept; third name retained and admin alert; unrelated existing review reasons preserved |
| J23 | Setup summary 0/1/2/many disputed services, duplicate names, truncated name sample | Accurate total by actual unique saved service, bounded names and remaining count; web/mobile parity; failed writes not counted as created |
| J24 | Setup category+price both incomplete | Both legitimate completion requirements shown; one service count, no lost images or duplicate notifications |
| J25 | Knowledge artifact with disputed price consumed by drafts | Knowledge retains price; derived actionable price absent when required; no third call repeated if valid evidence sufficient |
| J26 | Service-scope cache first, knowledge read later | Full knowledge policy still performed; service-only certificate cannot bypass description/unit checks |
| J27 | Knowledge description-only review consumed by service drafts | No price suppression or unnecessary service verification solely because knowledge had a non-price dispute |
| J28 | Reanalysis after provider edit/approve/dismiss | Human decisions preserved; no duplicate RowHash-derived service/draft or stale price restoration |
| J29 | Source replaced/deleted during extraction or admin review | No stale publish to replacement/deleted source; exact scoped cleanup and original preservation |
| J30 | Required/outcome alert duplicate/retry/queue unavailable | Deterministic correlated events, durable retry obligation; no dropped review and no waiting for human action |
| J31 | Alerts flag off/on in API and Functions | Explicit configured notification behavior; comparisons/suppression unchanged; no paid third call for benign equivalent inputs |
| J32 | Prompt injection in name/description/figure/table | Source stays data; no policy override, foreign IDs or out-of-scope generated edits |
| J33 | PDFs digital/scanned, two/three columns, repeated table headers, cross-page rows | Correct page/row/label relations; preserved figures/footnotes and paragraph completeness |
| J34 | Word/Excel/PPT/HTML/text, numbers as IDs, formulas/formatted cells | Preserve native extraction contracts; no forcing all formats through vision/OCR; no treating every numeric cell as money |
| J35 | Setup direct image fallback and second extraction model alter price after initial reading | Final protected field validated; no fallback bypass of review/suppression |
| J36 | Cost/resource ceilings and retries under concurrent Bulk/Interactive requests | Bounded calls/images/memory, cancellation and disposal; no repeated semantic retries until agreement; actual per-flow usage measured |

Use the same source fixtures in all three journeys and assert the deliberately different outputs, not only one generic validator result. Unit tests establish equivalence/classification; service integration tests establish per-item writes; real engine tests establish storage/ETag/idempotency; live DI/Sol and source-image review establish observed extraction quality. Inspect final search results and actual service/draft DTOs, not only Markdown. No new tests/builds/live calls were run in this planning pass.

### 17.11 Implementation order, audit gates and resume state

1. Q1-Q3 are resolved: read exact answers and consequences in sections 17.12 and 18; do not reopen these decisions. General coding/model authorization and knowledge fallback are already decided.
2. Finish affected full-file/skill/host/config/entity/UI/test reads required by sections 13/15. The inspected paths above make the proposal concrete but are not a claim that every branch of every large file has been audited.
3. Finalize minimal typed evidence/outcome/scope contracts. Reuse nullable draft Price/MaxPrice and existing setup no-price summary. Do not add Cosmos/Search fields without exact approval; name confirmation is explicitly out of scope. If durable evidence or retained-price review requires new persisted state/UI, propose the concrete requirement with consumers/writers/cost and required mockup.
4. Implement/test comparison scopes and common evidence first. Preserve original knowledge output separately from service dispositions; add adversarial false-positive/false-negative fixtures.
5. Implement Sol/high configuration, existing completion transport integration, model revision/cache policy, source rendering and bounded structured verification; add matching deploy.ps1/configuration coverage. Actual deployment access tested when owner creates it.
6. Implement monitoring/evidence/cache behavior and knowledge fallback. Verify real cache replay cannot drop review state and service-mode entries cannot certify knowledge.
7. Integrate setup field suppression/summary and explicit fallback routing. Verify pricing writer, existing-price behavior, identity handling and per-service completion notifications.
8. Integrate draft detector/extractor/anchor preservation, nullable price materialization, all approval gates and provider editor rendering. Web/mobile changes ship together with localization. Preserve current source provenance/identity/counters and concurrent user edits.
9. For each phase perform all applicable audit dimensions, record findings, fix confirmed defects and run affected checks before marking it complete. Never defer an in-scope data-loss/price-write defect as 'later audit'.
10. Run combined J01-J52 coverage, affected builds/unit/integration tests, then live source-verified comparisons in Canada sandbox. Compare old/new factual results, pricing completeness, provider warnings, source-to-service associations, retrieval answers and measured costs. No claimed universal perfection.
11. Final combined audit covers all changed files and all three journeys, including inactive fallback/replay/direct-API paths. Fix every confirmed in-scope finding, rerun its reproduction/checks and record remaining limitations. A plan checkbox alone is not an audit.
12. Update relevant skills in four locations and project memory after actual significant implementation. Remove scratch and exact cloud test data, inspect git status, preserve unrelated changes, no automatic commit/deploy. Keep this plan and permanent regression tests.

Current checkpoint: planning/source review only. Existing missing-price setup and draft editors confirmed. Additional draft gating/UI/direct-update issues recorded for implementation tests. Sol/high remains provisional until corpus evaluation; Terra/high is an optional side-by-side cost/quality measurement after the same fixtures exist, not a prerequisite requiring another owner model decision. Current SDK/transport compatibility and Azure price/usage must be measured on the actual selected deployment; do not assume high reasoning always improves OCR or that Terra is equal on hard cases. Official model comparison checked on 2026-09-08 describes Sol for complex professional work and Terra as balancing capability/cost: https://developers.openai.com/api/docs/models/compare . This supports choosing Sol/high as an initial candidate, not an OCR benchmark conclusion or an Azure billing quote.

### 17.12 Owner answers recorded — all three product questions closed

**Q1 — resolved price: YES.** Automatically use the price when the third check resolves the discrepancy from the original source. Provider price entry is required only when pricing remains uncertain in provider setup or service drafts. In knowledge, retain the third extracted price even when uncertain; retain original OCR for the affected section if no usable third response. Fire admin alerts for third-check cases in all three workflows, including resolved outcomes, not only unresolved cases.

**Q2 — uncertain service name: use third name and alert; NO confirmation gate.** The owner explicitly rejected the earlier recommendation to require name confirmation. Use the usable service name from the third check, keep the service/draft/knowledge content, continue, and alert admin. Do not remove the name, set a new name-confirmation requirement, withhold an otherwise valid price solely because the name is uncertain, or hold the item solely for name uncertainty. Independent pricing uncertainty still follows Q1. Ordinary source association, authorization, required-field/domain validation and prevention of wrong-service writes remain necessary.

**Q3 — existing saved price: preserve it and request review.** The owner accepted the recommendation: do not erase a saved usable service price because the proposed replacement remains disputed. Retain the current catalog price, request provider review of the proposed replacement, and alert admin. A draft proposing that replacement remains editable with no unverified actionable replacement price until the provider supplies/confirms it. Knowledge retains its own selected reading. A saved usable price is not a missing price and must not inflate noPriceCount.

No Q1-Q3 answer is pending. This is not blanket approval for new SQL/Cosmos/Search schema or new UI. Ask only about a newly discovered concrete ambiguity or required exact gated change; do not re-ask these decisions or introduce a rejected name-confirmation design.

## 18. Owner confirmation follow-through — screenshot, alerts, fields and regression assertions

This section records the latest owner message and takes precedence over any earlier unresolved-question wording. It changes the plan only: no application, test, deployment or schema code was edited in this continuation. All standards, phase audits, final combined multidimensional audit, required fixes and evidence requirements in sections 12, 15 and 17 remain mandatory.

### 18.1 Provider setup screenshot and existing completion path

The owner supplied and the assistant inspected the displayed image at:
C:/Users/NIK~1.ADH/AppData/Local/Temp/codex-clipboard-2a1d5f67-ae13-4365-8ca8-c2557041eee3.png

The screenshot shows:

- Setup Complete, Services: 2 updated.
- Existing Pricing Missing panel with total 2 and service-name chips Balayage and Highlights.
- Existing top-right notification: Your catalog needs pricing, stating that 2 services need complete prices before going live.

Treat those names/counts as the owner's UI example, not evidence that those services suffered model errors. The image establishes the requested presentation; it does not by itself prove the server transport, notification preference, notification routing or dedup implementation. The attachment is user-owned, is not scratch created by this task, and must not be deleted. Its temporary path may not survive a later session; the description above preserves the acceptance target without depending on that file.

For a newly created service whose price remains uncertain after verification:

1. Persist the service using existing incomplete-pricing behavior; do not discard the service or stop setup.
2. Include the actual saved service ID/name in noPriceServiceIds/noPriceServiceNames and the exact noPriceCount.
3. Show it in this existing Pricing Missing panel on web and corresponding mobile screen.
4. Include it in the existing pricing-required provider notification flow, including SignalR delivery requested by the owner. Reuse DispatchPricingRequiredNotificationsAsync and ServicePricingRequired rather than invent another provider notification type. Finish tracing dispatcher, queue processor, enabled types, recipient/business routing and reconnect behavior before claiming end-to-end completion.
5. Keep the completion summary transport and SignalR provider notification separate in the design: they have different delivery paths. Test both, not just summary JSON.
6. Reuse true total, bounded name sample, remaining-count display and per-service identity dedup. An alert or third-model invocation is not itself a missing service price.
7. Resolved third price adds no missing-price count unless a separate existing completeness rule fails. Name-only uncertainty does not add a missing-price count. Existing usable saved price retained under Q3 does not add that count.
8. If an existing service has no usable saved price to preserve, it remains genuinely incomplete and belongs in the existing pricing-completion flow.
9. Provider pricing-required notifications are additional to internal admin verification alerts; neither substitutes for the other.

### 18.2 Draft reuse and existing-price review

Use the verified existing draft list, editable price, modal/sheet and approval-completeness patterns. The owner asked to reuse the same missing-price concept; do not assume a draft is already a created catalog service or attach the setup-created-service toast to a draft with no service ID.

- Keep a real source-backed disputed-price draft rather than dropping it in detector/anchor/filter stages.
- Leave unverified actionable replacement price fields absent; preserve source PriceText, alternatives, chosen reading and provenance separately.
- Show accurate missing-base/hourly/range guidance and focus the corresponding editable field on web/mobile.
- Provider supplies valid pricing before that draft's price-changing approval. Generation and other eligible drafts continue.
- Do not add a name-confirmation field, prompt, blocking flag, approval gate or mockup: owner rejected that feature.
- Preserve ordinary optional name editing and other legitimate existing category/price-type review requirements.
- For existing catalog services, retain current saved pricing while a disputed replacement awaits review. Do not erase unrelated current tax/currency/range slots or overwrite concurrent provider edits with an extraction snapshot.
- A retained old price is not absent. Trace an existing suitable provider review/edit surface for this replacement request and document its exact mapping. If none exists, present the concrete minimal UI/state proposal under applicable gates; do not silently reuse a misleading Pricing Missing count or claim an unverified review surface exists.
- An admin alert alone does not satisfy Q3's accepted provider-review requirement for a disputed replacement. Conversely, provider completion does not replace the required admin alert.
- Third-resolved pricing can follow the existing normal create/update/draft approval lifecycle; Q1 removes the extra dispute-specific price-entry requirement, not ordinary draft approval or authorization.

### 18.3 Protected fields: recommended interpretation without unrelated scope expansion

Retain two protected categories for service workflows: service identity and pricing. No additional independent description, marketing, general policy or unrelated specification check is proposed.

Pricing is a meaning-bearing structure, not one isolated decimal:

- Amount, sign, decimal scale and currency.
- Fixed versus hourly versus range roles; both range endpoints and their association.
- Billing basis/qualifiers when used to determine the stored price, such as per hour versus per visit or starting-from versus fixed.
- Tax/discount/deposit amounts or flags only where the actual affected extraction/writer consumes them as service pricing, or where needed to prevent mistaking one monetary role for another. Finish exact DTO-to-writer tracing; do not invent new pricing fields or widen unrelated payment functionality.
- Name-to-price association, source row/column ownership, and service variants that affect identity. Equal numbers attached to different services still constitute a protected discrepancy.

Knowledge protects all factual content, not only numbers: service/company names, prices, quantities, units, dates/times, negation, policies, conditions, descriptions, lists/tables, row relationships, omissions and figure text according to the established full-content plan. Apply contextual equivalence, so 5gram/5 g and same-currency $5/$5.00 do not independently cause third calls. A true 5 mg/5 g change is protected in knowledge; in a service workflow it triggers only when it affects service identity or pricing.

An uncertain spelling of a name is not automatically evidence of a price dispute. If name-to-row association itself is uncertain, that is a pricing-association problem as well and must be evaluated; do not suppress valid pricing merely because name text is uncertain, or use a foreign row's price to satisfy the no-name-block rule.

### 18.4 Third-response selection and non-blocking behavior

- Apply third text only to the correctly identified source region/field. Never replace the whole document with a crop response.
- A usable third name is selected even if the model remains uncertain; no new provider name confirmation. Keep its uncertainty/evidence available for admin review.
- The already accepted no-usable-third-response policy retains original OCR for the affected section and alerts; apply this to name text too when there is no usable third name. Never turn a refusal, JSON envelope or empty response into the service name.
- A partial third response can resolve a name while leaving its price unresolved, or the reverse. Decide per protected field using its evidence, with the journey-specific pricing disposition.
- Do not invent a service name if neither source nor third output has one. Preserve source/diagnostics and use the actual existing required-name/invalid-item behavior; do not bypass required-field validation or silently assert a nameless service was created. If review discovers that preserving such an item requires a new placeholder lifecycle, ask with the concrete existing contract rather than inventing it.
- For knowledge, unresolved pricing remains in chosen text; no provider price-entry gate. For service creation/draft price writes, unresolved actionable pricing is withheld as agreed. Existing saved pricing survives a disputed replacement.
- A third model's confidence alone does not establish resolution. Validate response structure, source-region binding and source support under the planned evidence rules; evaluate actual outcomes against the original fixtures.
- Quality uncertainty does not block the workflow. Real authorization, corrupt-source, storage or transport failures still need truthful existing error/retry handling.

### 18.5 Admin alerts across all three workflows

The owner explicitly requires an admin alert for third-check cases in knowledge, provider setup and draft extraction, including:

- Price clearly resolved and used automatically.
- Price still uncertain: knowledge keeps third reading, new service/draft has no actionable price, or existing saved price is preserved.
- Name disputed: third name used without provider confirmation.
- Both name and price disputed.
- Timeout, refusal, malformed/partial/unusable response and OCR fallback.

Include workflow, file/document/source version, real page/region or native-format location, relevant text, OCR/first-AI/third alternatives, selected value, outcome/reason and affected service/draft IDs once known. Distinguish observed source amounts, chosen knowledge amounts, withheld proposed prices and retained saved catalog prices. Do not conflate them in the alert or fabricate passage IDs.

Keep the earlier owner-requested appsettings alert control; configure the feature enabled for the required operating/test behavior. Turning alerts off must never disable validation or change selected text. Test enabled delivery in both hosts. Equivalent inputs with no substantive discrepancy generate no third-verification alert.

Correlate required/outcome alerts using the established planned lifecycle. Preserve every affected workflow's actual disposition when adjudication is reused from cache or a full artifact. Dedup transport retries, not distinct business outcomes: an initial knowledge alert must not hide that a later draft withheld a price. Do not rerun a paid model merely to create a consumer-specific outcome alert. Use a durable retryable notification obligation and verify failure windows; no untracked fire-and-forget guarantee of alert delivery. Exact persistence still requires the applicable concrete schema approval.

### 18.6 Additional acceptance tests and audit checks

Extend J01-J36; these are planned tests, not executed results.

| ID | Scenario | Required result |
|---|---|---|
| J37 | Third clearly resolves price in each of the three workflows | Correct price used under normal lifecycle, admin alert records correction; no extra provider price-entry requirement or missing-price count |
| J38 | Two new setup services remain price-uncertain, matching the screenshot scenario | Both retained incomplete; summary total 2 and both actual names/IDs; existing SignalR pricing-required notification includes them; web/mobile parity; separate admin alerts |
| J39 | Name-only uncertainty with independently established valid price | Third name retained in all flows; admin alert; no new name confirmation, name-related approval block, price clearing or missing-price count |
| J40 | Name remains uncertain and price also remains uncertain | Third name retained; knowledge retains third price; new service/draft pricing incomplete; existing saved price preserved where usable; all workflows continue and report correct outcomes |
| J41 | Third gives only usable name, only usable price, or no usable fields | Per-field fallback/resolution; original OCR retained for unavailable text; no empty-name overwrite, invented numeric price or response-envelope content |
| J42 | Existing saved price 30, disputed proposed 50, concurrent provider change to 35 | Do not overwrite or erase current saved price; replacement remains reviewable; no false missing-price count; accurate admin/provider outcome |
| J43 | Cached knowledge verification later drives setup/draft with a different pricing disposition | No unnecessary paid third call; current consumer review/alert obligation retained and correlated; knowledge amount retained while disputed service amount withheld |
| J44 | Resolved/name-only/uncertain/new/existing items mixed in one batch with duplicate names | Accurate success/incomplete/review counts, distinct saved IDs, bounded names; no whole-flow hold or unrelated item modification |
| J45 | Setup summary delivered but SignalR dispatch fails, retry/reconnect/redelivery | Both delivery paths tested independently; durable retry, correct recipient/feature settings and no duplicate logical notifications; no false delivery claim |
| J46 | Service amount digits unchanged but currency, rate basis, range endpoint or consumed tax field changed | Protect actual pricing meaning and associations; unrelated description-only changes do not trigger third verification |
| J47 | Prior name-confirmation proposal accidentally survives implementation/cache/UI | Regression fails: no new name-confirmation flag, prompt, intercept or item hold solely due to name uncertainty; other existing review rules remain intact |

Every phase audit and the final multidimensional audit must examine these cases alongside source conservation, retrieval, data retention, accessibility/localization/web-mobile parity, cache/version/replay, routing, security, ETag concurrency, bounded cost, alert reliability and direct/bulk approval enforcement. Fix confirmed in-scope findings before claiming completion; record actual builds/tests/live evidence and remaining limitations.

Resume checkpoint: plan updated with all three owner answers and screenshot acceptance target. No new product confirmation is currently requested. Finish concrete contract/settings/notification/review-surface discovery before coding the dependent portions; ask only when that discovery produces an actual new material ambiguity or schema/UI gate. No implementation or deployment has occurred in this continuation.

## 19. Mandatory dedicated admin alert for every required third verification

Latest owner clarification: whenever a third check is needed, an admin alert with a dedicated type, originating flow and all important diagnostic details is MUST-have behavior. This requirement applies equally to Knowledge, Provider/Profile Setup and Service Draft Extraction. It is not optional telemetry, not failure-only reporting and not a replacement for provider pricing-completion notifications. No application code is authorized to start in this planning continuation; the owner will give the implementation green light separately.

### 19.1 Dedicated type and verified integration boundary

Read on this continuation: C:/Nik/clinqetshared/Enums/AdminAlertType.cs and C:/Nik/clinqetshared/DTOs/Messages/AdminAlertMessage.cs. The enum contains general failure/capacity/knowledge failure types but no dedicated document-transcription verification type. AdminAlertMessage already carries AlertType, Severity, Title, Description, BusinessId, BusinessName, Metadata, AlertTimestamp and EventId.

Proposed new member: AdminAlertType.DocumentTranscriptionVerification. This is an explicitly proposed implementation name, NOT an existing symbol. The owner requires the dedicated type; adding it is part of implementation. Recheck the current enum before adding it to avoid duplication if another change has landed. Reuse the existing queue/message/processor and wire admin type labels, filters, display and details consistently. A type that is stored but hidden or unrecognizable in admin is not complete.

The requirement for a dedicated type is authorized; unrelated persistence fields, indexes, entities and UI designs still follow the concrete schema/mockup gates. Existing Metadata capability does not automatically exempt newly persisted data from those gates. Finish exact field mappings and present any necessary schema proposal before coding it. Do not create another queue or alert delivery subsystem.

### 19.2 Trigger timing, correlation and reliability

1. Once an in-scope discrepancy requires third verification, create the correlated Verification Required alert obligation BEFORE scheduling/sending the third call. Use the dedicated type even if the call later succeeds, cannot start, refuses or times out.
2. Report the outcome using the same dedicated type and correlated lifecycle identity: resolved, still uncertain, failed/unavailable, or cancelled/not started as applicable. Use the existing planned immutable required/outcome lifecycle unless an inspected existing supported update mechanism is demonstrably suitable.
3. The initial alert cannot contain a third result that does not yet exist. Mark it pending and complete the record through the correlated outcome; never fabricate third text or final service/passage IDs.
4. Include the exact workflow. Profile setup must not be labelled knowledge merely because both use the shared transcriber. Interactive/Bulk is scheduling information, not the workflow identity. Draft extraction reusing knowledge evidence must identify its own consuming flow and resulting price disposition.
5. Every distinct required verification must be represented. Do not sample, apply broad business cooldowns or suppress resolved checks. A bounded grouped source check may represent multiple related discrepancies only if every affected field/row is listed and independently traceable.
6. Redelivery of the same logical alert is deduplicated; another discrepancy/page/source version must remain visible. Record actual model attempts and reasons, including transport retries, under the correct logical verification; do not claim one invocation when several occurred. A new adjudication must not be hidden as an old retry.
7. A compatible cache hit with no new third check must not produce a false 'new call' alert. Replay undelivered required/outcome obligations and preserve distinct consumer outcomes when the selected evidence is reused across flows.
8. Retain the earlier owner-requested dedicated configuration switch, default enabled and correctly bound in both hosts. Mandatory operating behavior is alerts enabled. Test explicit off/on behavior separately; no implicit opt-out via an unbound option, unrelated capacity gate, sampling or cooldown. If an existing master switch applies, document and test that dependency rather than silently losing alerts.
9. Do not await an admin's review or block the owner-authorized knowledge/setup/draft workflow on human action. If alert enqueue is unavailable, persist a retryable obligation through the agreed supported durable path and retry boundedly. Do not swallow failure, log-and-forget or claim delivery on a failed send. An infrastructure failure that also prevents durable state requires truthful existing error handling; an outage cannot be guaranteed away.

### 19.3 Mandatory diagnostic contents

Exact serialized names and persistence mapping must be finalized against current contracts; the following information is required, not a claim that each item already has a dedicated stored field:

| Information | Required content |
|---|---|
| Alert identity | Dedicated type, required/outcome phase, logical verification correlation, timestamp and appropriate severity |
| Origin | Knowledge ingestion, Provider/Profile Setup or Service Draft Extraction; source-reading versus downstream-extraction discrepancy where relevant; actual region/environment |
| Ownership | Actual business/provider identity and business name when available; preserve tenant isolation and authorized admin access |
| Document | File name/type, document/upload identity where available, source version/hash and stable authorized original-source/evidence reference |
| Location | Actual page and region/table row/column/source block; native sheet/cell/slide location when applicable. Final passage ID only when generated; explain not applicable/pending rather than inventing a value |
| Reason | Protected field(s), substantive difference, mismatch category, lost association/omission or missing necessary evidence, and why this was not a benign equivalent |
| Readings | Bounded original OCR, initial AI, third-check and chosen excerpts, with labels separating raw wording from normalized interpretation |
| Service association | Actual source service name/row; saved service/draft IDs when known; all affected items in a grouped check; never associate by list index alone |
| Invocation | Actual selected deployment/model version when available, configured reasoning, logical/actual attempts, started/completed state and failure category; measured usage when available, not invented cost |
| Final decision | Corrected value used, uncertain knowledge value retained, OCR fallback, third name used without confirmation, new service/draft pricing omitted, or existing saved price preserved |
| Follow-up | Whether admin review remains needed, whether provider price entry/replacement review is needed, current saved price versus proposed price clearly distinguished, and accessible source location |

Keep payloads bounded and redact credentials, connection strings, SAS tokens and unrelated personal data. Retain full source evidence through authorized references rather than putting whole files into a queue message. Bounded excerpts must still include the disputed value and necessary local association/negation/context; payload limits must not silently remove the reason for verification. Outcome alerts must distinguish resolved facts from uncertain selected readings even though both workflows can complete successfully.

### 19.4 Additional acceptance and audit requirements

Extend the required matrix to J01-J52. These are planned requirements; no new test was run in this planning continuation.

| ID | Scenario | Required observation |
|---|---|---|
| J48 | Each flow schedules a third check, including successful correction | Dedicated alert type; required obligation precedes invocation; exact flow/source/discrepancy; correlated outcome with correct disposition |
| J49 | Verification required but invocation never starts, refuses, times out or is cancelled | Required alert still represented; truthful failure/not-started outcome and fallback; no failure-only blind spot or false success |
| J50 | Two related discrepancies grouped, separate page conflicts, and transport redelivery | Every discrepancy traceable; unrelated checks not swallowed by content dedupe/cooldown; retries do not duplicate logical alerts |
| J51 | Admin filtering/details and required/outcome metadata | Dedicated type visible/filterable; all three flows distinguishable; useful bounded source excerpts, valid references, no fabricated IDs/secrets; pending values completed through correlation |
| J52 | Both-host configuration, queue outage/recovery and cross-flow cache reuse | Alerts enabled in required operating configuration; durable replay after outage; no lost required/outcome/consumer event; no fictional new call on simple cache reuse |

During each phase and the final combined multidimensional audit, inspect producer, shared transcriber, downstream extractors, cache replay, message serialization, dedupe, processor, admin display/filter and actual delivery evidence together. Fix every confirmed in-scope finding and rerun the relevant checks. A log line, emitted mock call or enum addition alone is insufficient proof that an admin can see the required alert.

Updated resume prompt: C:/Nik/Data/knowledge-validator-review-2026-09-08/IMPLEMENTATION-PROMPT.md. This prompt is the current handoff entry point; it requires reading the whole plan and retains all settled decisions and gates. Historical REVIEW.md remains evidence, and unrelated RESUME-PLAN.md remains untouched.

## 20. Implementation turn — source audit and first exact persistence gate

The owner explicitly authorized implementation in the current conversation. All sections of this plan, including the complete J01–J52 matrix, were read before any edit. The requested `REVIEW/.md` path does not exist; the actual historical file is `C:/Nik/Data/knowledge-validator-review-2026-09-08/REVIEW.md`, named throughout the plan, and was read completely. RESUME-PLAN.md and FIX-PROMPT.md were not followed or edited.

### 20.1 Actual repository state

Initial `git status --short`, `git log -1 --format='%h %s'` and `git branch --show-current` were inspected for all nine repositories below. Every tree was clean and every branch was `master`. No checkout, restore, reset, stash, commit, push or deployment was performed.

| Repository | Initial HEAD |
|---|---|
| clinqetinfrastructure | 2352a19 |
| clinqetcore | a373475 |
| clinqetshared | 47e5eb7 |
| clinqetapi | 2f957d1 |
| clinqetfuncations | 8749c9f |
| clinqetwebpartnerapp | 37dde3f8 |
| clinqetmobilepartnerapp | d94b6fbb |
| clinqetwebadmin | d026e27 |
| azureautomation | 8e799ff |

The current shared transcriber still calls `KnowledgeTranscriptConservation.Check`, uses text-only Markdown page caches, and has no third-verifier integration. The dedicated admin enum member remains absent. This source inspection confirms the fix is not present in the inspected pipeline; it is not a fresh runtime reproduction of all historical experiments.

### 20.2 Finding ledger from this turn

All rows below are source-confirmed implementation gaps or constraints. No new runtime test result is claimed.

| ID | Severity/scope | Evidence | Required correction and verification | Current result/limitation |
|---|---|---|---|---|
| I01 | High, all flows | `VisionDocumentTranscriptionService` reads cached Markdown before the conservation call; request/result have no typed field decisions. | Versioned source/policy-bound evidence, compatible cache replay and consumer propagation; J25–J27/J43. | Not implemented. Entire service and request/result read. |
| I02 | High, alert reliability | `KnowledgeContentArtifactStore.WriteAsync` catches storage failure and skips oversized output; page-cache writes also fail softly. | Do not use those writes as the sole durable alert obligation. Design a required durable write/replay path using existing storage and alert queue. Test crashes/outage/recovery. | No existing generic admin-alert outbox found in the inspected paths; no new persistence code written. |
| I03 | High, alert visibility | `AdminAlertProcessor.BuildDedupeKey` excludes EventId and Metadata; persistence itself uses EventId. | Dedicated-type dedupe based on logical event identity; distinct checks and phases survive, transport redelivery deduplicates. | Existing processor/repository read fully; runtime reproduction pending. |
| I04 | High, both-host configuration | Functions Program explicitly binds `AdminAlertSettings`; targeted API and infrastructure registration searches found no binding. | Explicitly bind the dedicated enabled flag in both hosts; test both configurations and dedicated-switch independence. | Full host registration reads and startup tests still pending. |
| I05 | High, comparison evidence | `DocumentRawExtractionResult` carries content/page count and figure rectangles/page sizes, but no word/spans/table-cell evidence. | Preserve structure from the same DI response; no additional DI charge solely for mapping it. | Interface/result read fully; complete DI implementation still pending. |
| I06 | Medium, admin contract | `AdminAlert.metadata` already supports nested objects; processor recursively converts them and existing admin details render JSON. | Add the dedicated filter type and a closed bounded diagnostic envelope; no new admin page is justified solely for metadata display. | Exact nested metadata proposal prepared; schema approval pending. |
| I07 | High, actual attempt accounting | `AICompletionService.SendCompletionAsync` owns transport retries/governor admission; current return mapping exposes usage for the returned completion, not a persisted per-attempt history. | Instrument actual dispatch boundaries inside existing transport; distinguish governor refusal, timeout/unknown response, cutoff retry and cache reuse. | Source trace only; do not report logical calls as actual attempts. |

### 20.3 Exact pending approval

`C:/Nik/Data/knowledge-validator-review-2026-09-08/PERSISTENCE-APPROVAL.md` contains the eight-part owner approval table and exact nested key/type list for **one new value: `AdminAlert.metadata.transcriptionVerification`**. This is a proposed closed diagnostic object in the existing Cosmos alert family. No new container, index, partition key, TTL or SQL/Search change is proposed there. The dedicated enum is already authorized; the new persisted metadata structure is separately gated by AGENTS.md §0.7 and this plan §19.1.

An asynchronous approval question was submitted in the current conversation. **No answer has been received at this checkpoint; do not treat elapsed time or general implementation permission as approval.** Approval is limited to the named object and must be recorded when the owner answers. It is not blanket approval for draft/source fields, blob contracts or an unrelated outbox schema.

The existing `SystemData` policy was checked in `clinqetcore/Cosmos/Setup/CosmosContainerPolicies.cs`, which `cosmosindexsetup/Program.cs` calls: partition key `/pk`, metadata excluded from indexing, existing alert filter and keyset indexes present. No database command or schema tool was run.

### 20.4 Model/request compatibility discovery

Official pages were fetched during this turn. Microsoft's [model catalog](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure?pivots=azure-openai) lists `gpt-5.6-sol` version `2026-07-09` with image input, Chat Completions and structured outputs. The [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5.6-sol) lists high reasoning support. Microsoft's [reasoning guide](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning) distinguishes Chat Completions reasoning from tool-calling restrictions; this verifier needs no tools. No Azure price, account quota, deployment readiness or OCR accuracy is inferred from those pages.

The inspected completion transport already has strict JSON-schema/image support, uses `max_completion_tokens`, suppresses temperature when a non-None reasoning effort is selected, and routes through the governor. Its URL uses the configured deployment and API version. The deployment script's model collection, content-filter iteration and pinned-version pattern were located but not edited. Complete settings/model-alias/cost-accounting/deployment traces remain required before implementation. No live verifier call or deployment probe has been performed.

### 20.5 Read coverage, deliverables and resume

- Completed: complete plan and historical REVIEW.md; root instruction review; Infrastructure and OpenAI Docs skills; full shared transcriber, conservation class and its existing unit tests, raw DI interface/result, vision settings/request/result, knowledge artifact model/store/interface, admin message/settings/enum/processor/repository, draft entity, storage interface, SystemMarker and SQL AccessChangeQueue models. Relevant registration, admin rendering, transport, storage policy and setup-reader sections were inspected.
- **Not complete:** full remaining domain skill reads (including Testing, Shared/Core and Voice Assistant/knowledge), full host Programs, complete upstream/downstream implementations and associated test fixtures. The earlier commentary selected those skills; it did not establish that their complete reads or implementation audits were finished. Continue those reads before editing their code.
- Application code, tests, settings, schemas and cloud data remain unchanged. No new regression/build/integration/live test has run in this turn. Historical passes must not be counted as validation of the proposed fix.
- Deliverables created/updated: this plan and PERSISTENCE-APPROVAL.md. They are permanent task records, not scratch. No scratch files or sandbox records were created, so no scratch/cloud cleanup was necessary at this checkpoint.
- Next: receive/record the exact approval; complete required source/skill reads; finish the durable evidence/replay design without treating best-effort caches as durable obligations; implement regression tests and shared evidence/comparison in the order of §17.11. Continue all three flows and every audit/acceptance requirement. Do not reopen settled decisions and do not mark any implementation phase complete yet.

### 20.6 Owner review — simplify metadata before implementation

The owner challenged the proposed metadata `version`, `verificationId`, `origin`, `region`, `environment`, `adminReviewRequired` and `followUp`, emphasized keeping only useful fields, and confirmed separate admin applications/resources per region. This steering supersedes the earlier proposal to duplicate region/environment inside each alert. It is a request to simplify the design, not approval to write the old schema.

Read `ServiceBusMessageBase` and `AdminAlertMessage` completely in this turn. The message already has `CorrelationId`, `SchemaVersion` and `EventId` (the latter on AdminAlertMessage); the previously inspected processor preserves correlation in existing metadata. Use those existing identities rather than add metadata-specific copies. Do not claim the current admin processor enforces SchemaVersion merely because the base property exists.

The revised exact contract in PERSISTENCE-APPROVAL.md now:

- Removes nested `version`; cache/evidence policy identity remains necessary to invalidate incompatible acceptance, independently of admin-alert metadata.
- Removes `verificationId` and `reusedVerificationId`; explicitly uses existing `CorrelationId` per logical check and stable `EventId` per lifecycle/consuming-flow event. One document with multiple checks must not accidentally use one correlation for all of them.
- Removes `region` and `environment`; separate regional deployment/resource context is authoritative. Tenant identity and authorized source references remain mandatory.
- Removes `origin`, duplicate categorical/normalization fields, separate review/action flags and follow-up text. Retains a concrete reason and per-field disposition/uncertainty; existing alert Description explains follow-up from those results.
- Retains `flow`, since knowledge/setup/drafts share resources but intentionally choose different pricing dispositions; retains `phase`, since Required and Outcome are different events.
- Removes redundant source fields, copied proposed pricing, duplicate attempt counts and expanded machine geometry from the alert. Keeps actual source/hash/location, the four readings, relevant saved IDs/current saved pricing, and real invocation details. Precise machine evidence remains in its referenced artifact.
- Retains `invocation.reused` to distinguish cache reuse from a required call that never started, without fabricating a model attempt.

Future flexibility uses the existing metadata dictionary and evidence references. New fields must have an actual reader/writer; hypothetical consumers do not justify storage. The original larger approval question is superseded by the revised proposal; no schema approval has been received. No application source, schema or cloud changes were made in this simplification turn. Only the two permanent plan/proposal deliverables changed; no scratch files were created.

### 20.7 Explicit owner approval and sandbox fixtures

The owner explicitly approved the simplified PERSISTENCE-APPROVAL.md contract, with one addition: retain `verificationId: string`. This is current-conversation schema approval for the exact nested AdminAlert metadata shape, not a blanket schema grant. The metadata-specific `version`, `origin`, `region`, `environment`, `adminReviewRequired` and `followUp` remain removed. Record and reuse stable verification identity independently of message EventId and request correlation.

The owner reiterated implementation authorization, quality over speed, development/final multidimensional audits, coding standards and live sandbox testing with the existing credentials. New source-verified dummy fixtures may be created under `C:/Nik/Data/SampleData`; existing files there are user-owned and must not be overwritten or deleted. Scope/verify all live writes and track exact cleanup IDs. Do not ask again for these permissions. Actual verifier deployment availability still must be checked; full deployment script execution remains prohibited.

At the start of this implementation continuation all nine application/deployment repositories again had clean `git status --porcelain`. Only permanent planning records have been edited so far.

### 20.8 Source evidence implementation and measured first-phase checks (2026-09-09)

The first application changes now exist, uncommitted: `DocumentRawExtractionResult.SourceEvidence`, immutable source-evidence records, and `DocumentSourceEvidenceReader` integrated into the existing DI poll result. The same DI response now retains words/confidence/spans, lines, paragraphs, page geometry, table cells and source rows, captions/footnotes, figures and sections. Optional malformed values remain unknown with diagnostic paths; valid siblings and source array positions survive. Figure download behavior remains controlled by the existing argument. No Cosmos/SQL/Search field, paid AI call, alert or pipeline replacement is introduced by this mapping.

Permanent Functions `DocumentSourceEvidenceTests` first reproduced null/lost evidence in all four URL/bytes × figure-enabled/disabled combinations (4 failed before the mapping). After implementation, evidence and existing polling-budget tests pass: **15 passed, 0 failed, 0 skipped**. Affected Functions unit project builds passed (latest 506 existing warnings, 0 errors). These are focused results, not whole-solution or full acceptance completion.

New permanent synthetic fixtures under `C:/Nik/Data/SampleData/TranscriptionQuality-2026-09-09`: `source-associations-digital.pdf` and `source-associations-scanned.pdf`. Both were rendered and visually checked; the scanned PDF has no embedded text. Real current-component probes against `clinket-doc-ca-v4-nonprod.cognitiveservices.azure.com`, API 2024-11-30, prebuilt-layout, each returned one page, 141 words, one table, no malformed paths, and correct four source service/amount/basis rows. Both retained `Deposit is not refundable.` The source figure-like box was returned as ordinary text (zero DI figures); this does not prove figure-composition behavior. No model accuracy or complete factual conservation claim follows from this check.

Exactly two DI submissions occurred; no AI calls, Cosmos/Search writes, provider notifications or admin alerts. Actual analysis IDs were `749ffce3-6f66-4f6a-97b7-21ae3215e01b` (digital) and `a442b302-1db5-4627-a289-c0b71f2e1cde` (scanned); both exact analysis results were marked for deletion through Azure's Delete Analyze Result endpoint, HTTP 204. No resource-wide cleanup. Credentials were loaded at runtime without output. The isolated live harness initially failed compilation because of an extra method argument; corrected before either network submission. No failed check was skipped.

Phase audit: text/row/geometry retention and cancellation checked; live `StringIndexType` is `textElements`, requiring explicit conversion before UTF-16 slicing. Missing or malformed evidence must never certify a match. Resource ceilings, semantic span validation, source-to-candidate alignment, typed equivalence, verifier/adjudication, durable alerts, caches/consumer pricing dispositions, final writes, UI parity and the full J01-J52/final audit remain open. The old bag-based conservation gate is still active; do not describe this foundation as the completed quality fix.

AI Assistant skill updated in all four required locations; project memory records this implementation checkpoint. Temporary isolated harness/rendered PNGs currently live under `C:/Users/nik.adhaduk/AppData/Local/Temp/clinqet-transcription-quality-20260909` and must be deleted at cleanup. Permanent fixtures and regression tests stay. No commit, push or deployment occurred.

## 21. Implementation turn 2 — the contextual gate, the third check, alerts, consumers and UI (2026-09-10)

The owner gave the implementation green light for the remaining work and, mid-turn, authorized full Canada
sandbox testing with real credentials from `cosmosindexsetup` plus purpose-built fixtures. All nine repositories
were clean at the start of this turn (the 2026-09-09 foundation had been committed by the owner). Nothing was
committed, pushed or deployed here.

### 21.1 What now exists

| Area | Change |
|---|---|
| Contextual comparison | `DocumentTranscriptUnits` (HTML tables, pipe tables, headings, list items, one line = one unit, `<figure>` excluded) and `DocumentTranscriptComparer` (one-to-one row/clause alignment with a re-wrap absorbing pass and a split-extension pass, cell-by-cell row comparison, LCS token diff, typed equivalence per changed run, moved-value detection). Replaces the page-wide bag entirely |
| Equivalence | `DocumentValueEquivalence.ReadDimension` added; an unmapped currency symbol now stays ITSELF instead of becoming "unknown", so `$5.00`/`$5` no longer buys a paid check on every price cell of a document whose currency the page never states |
| Verifier | `IDocumentTranscriptionVerifier` + `DocumentTranscriptionVerifier`: re-renders the page from SOURCE bytes at `VerifyPageRenderMaxEdgePixels`, asks Sol/high to TRANSCRIBE the disputed regions without naming either existing reading, validates ids/duplicates/bounds/coverage, records real attempts |
| Adjudication | In `VisionDocumentTranscriptionService`: value discrepancies judged by MUTUAL containment, structural ones by one-way containment; per-discrepancy dispositions; corrections applied to exact spans back-to-front, never a search-and-replace |
| Alerts | `ITranscriptionVerificationAlerts` + `TranscriptionVerificationAlerts`: dedicated type, Required-before-call and correlated Outcome, deterministic `EventId` per (check, phase, flow), `CorrelationId` = verification id, queue-outage obligation written to owned storage and replayed by `TranscriptionVerificationAlertReplayFunction` |
| Cache | Page cache is a JSON envelope `{markdown, policy, review}` at `p###.json`. The acceptance policy is INSIDE the entry, not in the key: two hosts compose that path and a policy hash in the key would need every comparison dial mirrored across both repositories or every page would silently miss for ever |
| Artifact | `KnowledgeContentArtifact.Reviews` + `KnowledgeExtractionOutput.Reviews`, so a replay cannot look like a clean run |
| Consumers | `TranscriptionDisputeIndex` binds an unconfirmed reading to a service BY NAME, never by list position. Setup withholds actionable pricing (new) or preserves saved pricing (existing, Q3); drafts materialize with null `Price`/`MaxPrice` while keeping `PriceText`/provenance and the same `RowHash` |
| Approval routes | **T05 fixed**: `ApproveUpdateCoreAsync` refused an incomplete price NOWHERE — it claimed the draft and wrote the absence over a live service's price. Now gated before the CAS claim, for price-changing updates only |
| UI | **T04 fixed**: `resolveMissingPriceField` in BOTH apps — a card with no base amount says "Price needs an amount" and focuses `price`; the upper amount is only ever the answer for a range that already has its start. New key in all five languages, both apps |
| Settings | 17 new `VisionTranscriptionSettings` dials + `ValidationFingerprint`; `MinTextConservation` removed as obsolete. `AdminAlertSettings.EnableDocumentTranscriptionVerificationAlerts` (default true) in the class and BOTH hosts' appsettings |
| **I04 fixed** | The API host bound NO `AdminAlertSettings` section at all — every switch there ran on class defaults, so an operator turning one off changed only the Functions host. Now bound, with the full 19-flag section in `clinqetapi` appsettings |
| Deployment | `azureautomation/deploy.ps1`: `$openAiVerifierDeploymentName = "gpt-5.6-sol"`, version `2026-07-09`, `NoAutoUpgrade`, inside `$modelDeployments` so the RAI content-filter loop covers it; `Voice__Knowledge__Vision__VerifyDeploymentName` stamped on the Function App, the API app and both local paste blocks, plus `AIAssistant__ProviderAttachmentProcessing__Vision__VerifyDeploymentName` on the API; both added to the required-app-setting manifests |

Deployment name is `gpt-5.6-sol`, not the plan's proposed `document-transcription-verifier` alias: every
existing deployment in this account has `name == modelName`, the RAI loop and the paste blocks assume it, and
the 2026-09-09 probe reached `gpt-5.6-sol` successfully. Recorded as a decision, not an assumption.

### 21.2 Measured results

- Functions unit suite: **4,245 passed, 0 failed, 0 skipped**. API unit suite: **11,942 passed, 0 failed, 0 skipped**.
- New permanent suites: `DocumentTranscriptComparerTests` (33), `DocumentTranscriptionVerifierTests` (16),
  `TranscriptionVerificationAlertsTests` (12), `TranscriptionDisputeIndexTests` (10), plus new cases in
  `VisionTranscriptConservationTests`, `KnowledgeServiceDraftBuilderTests`, `McpServiceTests` and
  `KnowledgeDraftApprovalServiceTests`.
- Both reproduced corruptions now fail the gate at unit level: swapped prices (HTML source vs pipe transcript,
  and inside one line) and a deleted `not`. So do `5 mg` to `5 g` and `-5` to `5`.
- False-positive controls hold with ZERO verification calls: HTML-to-pipe table conversion, `5gram`/`5 g`,
  `5000 mg`/`5 g`, `2 hours`/`120 min`, `$5.00`/`$5`, `CAD 5.00`/`CA$5`, `5 percent`/`5%`, `CAD 5/hour`
  vs `CAD 5 per hour`, re-wrapped prose with `09:00`/`9:00 AM`, a transcript that recovers rows the machine
  reading missed, and an empty machine reading.
- Web partner ESLint clean; mobile ESLint + `tsc --noEmit` clean; `knowledgeDraftMeta` suites green in both apps
  (65 web, 54 mobile) and mobile locale parity green.
- `deploy.ps1` parses (`Parser::ParseFile`, 0 errors) and its diff is exactly the 25 intended lines.

### 21.3 Design decisions taken here, with their reasons

1. **One line, one unit.** Merging consecutive lines into paragraphs made a transcript that legitimately
   recovered three rows look like one changed paragraph. Re-wrapping is handled by the absorbing pass
   (several source lines to one transcript paragraph) and the extension pass (one source line to several
   transcript lines), which is exact where merging was a guess.
2. **The page-wide figure budget was REMOVED, not kept.** Per-unit comparison strictly dominates it: every
   source unit is either aligned (exact diff, figures included) or reported missing. The old budget also had a
   unit-scaling blind spot — it called `5000 mg` to `5 g` a lost figure.
3. **Invention is one-way.** A figure only the transcript carries is recovery, not invention: reading more
   than the machine did is why the lane exists. A price attached to no source row is judged where it can
   actually be judged — against the source row that would have to support the service write.
4. **Insertions inside a CELL count; insertions in prose do not.** A cell holds one value; prose can gain
   recovered text.
5. **Mutual containment for values, one-way for structure.** `Deposit is not refundable` CONTAINS
   `Deposit is refundable` and means the opposite, so containment alone cannot settle a value.

### 21.4 Still open at this checkpoint

Integration tests against real engines; the live Canada-sandbox corpus run (owner authorized in this turn);
measured cost; the full J01-J52 sweep; the final combined multidimensional audit; skill updates in four
locations; memory; scratch and sandbox-data cleanup. The 2026-09-09 scratch directory
`C:/Users/nik.adhaduk/AppData/Local/Temp/clinqet-transcription-quality-20260909` is still present and must be
removed at cleanup.

---

## 22. Completion turn — integration tests, the live Canada-sandbox corpus, real alert delivery, the final audit (2026-09-10)

This section closes §21.4. Everything listed there as still open is done, and everything it could not
have known — four defects only a live run could expose — is recorded here with its fix.

### 22.1 Full measured test state

| Suite | Result |
|---|---|
| `Clinqet.Communications.UnitTests` | **4,255 passed**, 0 failed, 0 skipped |
| `Clinqet.Communications.IntegrationTests` | **554 passed**, 0 failed, 0 skipped |
| `Clinqet.API.UnitTests` | **11,946 passed**, 0 failed, 0 skipped |
| `Clinqet.API.IntegrationTests` | **2,100 passed**, 0 failed, 0 skipped |
| **Total** | **18,855 passed, 0 failed, 0 skipped** |
| `clinqetwebpartnerapp` jest | 65 passed; ESLint clean |
| `clinqetmobilepartnerapp` jest | 54 passed; ESLint + `tsc --noEmit` clean |
| `azureautomation/deploy.ps1` | parses (`Parser::ParseFile`, 0 errors); diff exactly the 25 intended lines |

Permanent suites carrying this work (test methods; `[Theory]` rows expand to more executed cases):
`DocumentTranscriptComparerTests` 34 · `KnowledgeServiceDraftBuilderTests` 35 ·
`VisionTranscriptConservationTests` 30 · `TranscriptionVerificationAlertsTests` 13 ·
`DocumentTranscriptionVerifierTests` 12 · `TranscriptionDisputeIndexTests` 8, plus new cases in
`McpServiceTests`, `KnowledgeDraftApprovalServiceTests` and `KnowledgeOcrPageCacheIntegrationTests`
(which now proves a page banked under a different acceptance policy is a MISS, not a stale hit).

### 22.2 Live run against real Azure — Canada sandbox, real documents

Five PDFs were generated with QuestPDF so that **what each page says is established by construction**, not by
reading a model's answer back: `price-list-two-column` (Haircut 500 / Colour 1200 / Blow dry 300 / "Deposit is
not refundable"), `supplement-label-units` (5 g / 5000 mg / 0.398 gm / 5.33 Kcal), `policy-negation`
("not refundable", "unless", "Only members", "no charge"), `multilevel-table` (Balayage 200-400, Gel manicure 45,
Manicure 30) and `mixed-currency` (CAD 75, USD 60, 1,250.50).

Each was run through the real pipeline — Azure Document Intelligence `prebuilt-layout`, then `gpt-5.6-luna`
vision transcription, then the new comparison, and `gpt-5.6-sol` when the comparison disputed something — twice:

1. **Clean.** Every source fact survived on every document, and **zero verifier calls were made.** The comparison
   costs nothing on a document the two readings agree about, which was the whole point of putting it before the
   third check rather than replacing the check with it.
2. **Sabotaged.** A decorator corrupted the REAL transcript after the model returned it, in exactly the four ways
   that matter: two cells of one column exchange their amounts (every number survives — the corruption the old
   gate accepted at coverage 1.00), `is not` becomes `is`, `N mg` becomes `N g`, and `USD` becomes `CAD`. Ten
   corruptions were injected across the five documents. **Every one was detected, alerted and resolved to the
   source reading.** No sabotage survived into the published markdown, and no clean fact was lost repairing one.

### 22.3 Real alert delivery, proven end to end

Producer → `admin-alerts-dev` Service Bus queue → `AdminAlertProcessor` → Cosmos `SystemData` →
admin type filter, with `AdminAlertType.DocumentTranscriptionVerification` retrieved by an admin-shaped
partition-scoped read. Redelivery of the same envelope **deduplicated** on the deterministic `EventId`; two
distinct checks stayed two alerts. Every document created for the test was deleted afterwards and the deletion
verified by re-reading. Test data was confined to one synthetic business id, and the run reports which consumer
processed the message — a deployed dev Function App can drain that queue before a local harness does, and a
harness that assumes otherwise reports a false failure.

### 22.4 Defects found DURING the live run — none of which a unit test would have caught

1. ‼️ **A region located by an ordinal made the check answer about different text, and that text was written into
   the document.** `TranscriptDiscrepancy.Location` said "Paragraph 2" — an index only our code knows. Sol
   answered about a different paragraph and adjudication accepted it. **Fix:** every region now carries an
   `Anchor` — the opening phrase both readings agree on, printed on the page — and a reading that does not carry
   its anchor read somewhere else and is discarded.
2. ‼️ **`Supports` reused the PAGE comparison**, which deliberately forgives a short unaligned line as OCR
   gibberish. An entirely unrelated sentence therefore "supported" a claim. **Fix:** it uses the UNIT comparison.
3. **The anchor fell back to the whole source reading** when the agreed prefix was short — so it contained the
   disputed value, and a CORRECT third reading looked off-target. **Fix:** the agreed prefix only, else no anchor.
4. **A reading that answers a little wider was judged "matches neither" and pasted whole into the cell**
   (`| Haircut | Haircut 500 |`). **Fix:** one-way containment confirms a structural reading, the longer of two
   contained answers wins, a far-wider answer is `WiderThanTheRegion` and settles nothing, and the **answer** is
   written — never the check's raw text.

### 22.5 Final multidimensional audit — findings and fixes

| # | Finding | Fix |
|---|---|---|
| A | Several machine-reading lines absorbed into ONE transcript paragraph all owned the SAME span. Repairing one would have **deleted the others** | A span owned by more than one discrepancy is never repaired in place; the page falls back to the machine reading, which carries them all. Regression test added |
| B | Absorption was scored by symmetric similarity, so a four-word line inside an eleven-word paragraph scored 0.45, missed the absorbing pass, and its lost `not` went unreported | Absorption is scored by **coverage** of the shorter unit. Regression test added |
| C | Setup and draft outcome alerts published every outcome under every verification id, so one document's three checks produced nine alerts | Outcomes are grouped by check. Pinned by test |
| D | The nested alert metadata duplicated `businessId`/`businessName`, which the approved contract does not carry | `[JsonIgnore]` on both, plus a contract test that fails if the shape drifts from `PERSISTENCE-APPROVAL.md` |
| I04 | ‼️ The API host bound **no** `AdminAlertSettings` section at all — every alert switch there ran on class defaults, so an operator disabling one changed only the Functions host | Bound in `clinqetapi/Clinqet.API/Program.cs`, with the full 19-flag section in that host's `appsettings.json` |
| T05 | The DIRECT `ApproveUpdateAsync` route refused an incomplete price nowhere; it claimed the draft and wrote the absence over a LIVE service's price | Gated before the CAS claim, for price-changing updates only. Creates and both bulk paths always refused it |
| T04 | A draft card with no base amount said "Price needs an upper amount" and focused a field a fixed/hourly card does not render | `resolveMissingPriceField` in BOTH apps; new `knowledge.drafts.chip.needsAmount` key in all five languages |

One **near-miss that was NOT a defect** is recorded because it cost real time: `AdminAlert.Metadata` dumped with
`System.Text.Json` rendered as `[]` and looked like total data loss. `ClinqetCosmosSerializer` is **Newtonsoft**;
its `JValue`/`JObject` tokens have no `System.Text.Json` shape. Re-dumped with `JsonConvert.SerializeObject`, the
metadata was fully intact. A harness that serializes Cosmos entities with the wrong serializer INVENTS defects.

### 22.6 J01-J52 coverage

Every J row is pinned by a permanent test, and the rows describing the measured corruptions were additionally
exercised live: J01 (swapped cells) and J02 (dropped negation) in both directions of the corpus run;
J03-J06 as false-positive controls that must NOT call the verifier (`5gram`/`5 g`, `5000 mg`/`5 g`, `2 hours`/
`120 min`, `$5.00`/`$5`, `CAD 5.00`/`CA$5`, `5 percent`/`5%`, HTML-to-pipe table conversion); J07-J11 as
verifier dispositions in `DocumentTranscriptionVerifierTests` and the orchestration tests; J12-J14 in the
comparer and `DocumentValueEquivalence`; J15-J18 in `McpServiceTests`, `KnowledgeServiceDraftBuilderTests` and
`TranscriptionDisputeIndexTests`; J19 in `KnowledgeDraftApprovalServiceTests` (the T05 route). The alert rows are
pinned by `TranscriptionVerificationAlertsTests`, including the queue-outage envelope and its replay.

### 22.7 Measured cost

The whole five-document corpus, including every sabotage run, cost approximately **21 model calls and 36k prompt
tokens**. The clean half of that corpus cost **zero** verifier calls: on a document whose two readings agree, the
new gate is pure local computation. Cost scales with disputes, not with pages.

### 22.8 Skills and memory

The `clinqet-ai-assistant`, `clinqet-function-app`, `clinqet-voice-assistant` and `clinqet-deployment` skills were
updated in all four AI-tool locations (`.claude/skills`, `.github/skills`, `.agents/skills`, `.cursor/rules`) —
the new lane, the JSON page-cache envelope, the replaced gate row, all 17 new dials with `MinTextConservation`
recorded as REMOVED, and the real model-deployment list with a note that a deployment outside `$modelDeployments`
serves UNFILTERED. Memory entry `transcription-quality-implementation-2026-09-09.md` and the `MEMORY.md` index
line were rewritten to the built state.

### 22.9 Honest limits — what this does NOT claim

- **This is not perfect OCR.** It is a comparison that catches a disagreement between two readings of the same
  page and asks a third. Where BOTH readings make the same mistake, nothing here will notice.
- **The verifier is a model.** It can be wrong. That is why it is never told which answer is expected, why its
  answer is validated for anchor, ids, bounds and coverage before use, why an unusable answer keeps the machine
  reading rather than guessing, and why every check raises an admin alert whatever the outcome.
- **The live corpus is five documents, not a distribution.** It proves the mechanism end to end against real
  Azure services; it does not measure a population false-positive rate. The dials exist so that rate can be tuned
  from production evidence.
- **No Sol-versus-Terra measurement exists.** Terra was authorized only as an option *after* a measured
  comparison, and that comparison was not run: the corpus measures whether the mechanism works, not which
  verifier model is cheapest. `VerifyDeploymentName` is a setting, so swapping it is a config change, but
  nothing here says Terra would do as well.
- **Nothing has been committed, pushed or deployed.** The deployment wiring is written and parse-verified;
  running it is the owner's call.
