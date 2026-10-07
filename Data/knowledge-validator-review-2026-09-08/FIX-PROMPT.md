Fix the verified knowledge transcription fidelity defect before production. Focus on this bug; do not replace the extraction pipeline or add MarkItDown. Read `C:/Nik/Data/knowledge-validator-review-2026-09-08/REVIEW.md` first for the measured evidence and its limits.

Read the current applicable AGENTS.md and relevant Infrastructure, Voice Assistant and Testing skills, project registration, implementation and tests before editing. Preserve unrelated working-tree changes. The Functions repository is spelled `C:/Nik/clinqetfuncations`.

Confirmed defect:

1. `Haircut 500; Colour 1200` can become `Haircut 1200; Colour 500` and pass `KnowledgeTranscriptConservation.Check`.
2. `Deposit is not refundable` can become `Deposit is refundable` and pass.

The existing gate compares global numbers and an unordered set of words at least four letters long. Both errors still pass with coverage set to 1.0. Real digital and image-only PDFs were sent to actual DI and vision services. The live model retained the correct facts in four uncached runs. Deliberately editing those actual transcripts reproduced both bugs for both PDFs: accepted, cached, embedded, indexed and retrieved with incorrect facts from the existing Canada sandbox index. All test cloud data was removed. These are proven validator defects, not observed spontaneous model errors in business documents.

Inspect at least:

- `C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeTranscriptConservation.cs`
- `C:/Nik/clinqetinfrastructure/Services/Knowledge/KnowledgeFigures.cs`
- `C:/Nik/clinqetinfrastructure/Services/AI/VisionDocumentTranscriptionService.cs`
- `C:/Nik/clinqetinfrastructure/Services/AI/VisionPageTranscriber.cs`
- `C:/Nik/clinqetshared/Models/VisionTranscriptionSettings.cs`
- `C:/Nik/clinqetcore/Models/Knowledge/KnowledgeBlobPaths.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications/Functions/KnowledgeIngestProcessorFunction.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.UnitTests/Knowledge/KnowledgeTranscriptConservationTests.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.UnitTests/Knowledge/VisionDocumentTranscriptionServiceTests.cs`
- `C:/Nik/clinqetfuncations/Clinqet.Communications.IntegrationTests/Tests/Services/KnowledgeOcrPageCacheIntegrationTests.cs`

Implement a robust, bounded correction, with these acceptance requirements:

1. Protect service-to-price associations and local sentence polarity. Global counts/word overlap, a threshold increase, an English-only keyword check or an additional AI review alone are insufficient. Detect relocation of negation as well as deletion: a page containing another `not` must not conceal a changed policy.
2. Preserve correct formatting changes and source-supported OCR corrections. Work with table/row and text-block structure before flattening; preserve meaningful reading order and label/value relationships. Design source-image verification for ambiguous conflicts. Do not blindly freeze OCR text, ban every addition, or reject legitimate row/column reordering. Explain how unresolved disagreements are handled without silently accepting factual changes or losing correctly recovered information.
3. Address the related unit/sign cases (`5 mg` vs `5 g`, `-5` vs `5`) within the same fact-conservation design where appropriate. Cover repeated prices, decimal separators, multilingual scripts, and local exceptions. Avoid an unrelated pipeline rewrite.
4. Handle old cache entries. Cache hits currently bypass validation; the page-cache key includes content/model/prompt identity, not validation-policy identity. Revalidate cached output and/or invalidate incompatible acceptance-policy versions. Cover settings changes, replay, retry and fallback behavior. Trace full extraction artifacts and already indexed content; define targeted re-ingestion for affected existing documents rather than claiming a validator patch repairs stored cards.
5. Add regression unit tests that fail on current code for both principal defects, including long pages where a missing critical word is below the 5% allowance. Add positive tests for legitimate HTML-to-Markdown tables, layout normalization, and OCR recovery. Test price swaps with identical numeric multisets and negation movement between two policies. Preserve figure carry-through and page associations.
6. Add meaningful integration coverage through real service orchestration and actual storage (Azurite is available). Verify rejected candidates do not become accepted cache entries or index content, correct candidates remain intact, retries are bounded, and old cache behavior is safe. Use deterministic injected model responses to establish the failure mechanism. Also repeat source-checked digital/scanned PDF tests against actual configured DI/vision/embedding services and the existing Canada sandbox search index. Clearly separate injected failures from natural AI outputs. Test additional file types only where the changed validation path actually applies.
7. Credentials may be loaded at runtime from the Cosmos setup project's Canada configuration and the application's Canada settings. Never print credentials. Use isolated test IDs, existing resources only, and scoped queries; never run the Cosmos setup initializer to obtain credentials. Do not introduce schema/index fields, resources or configuration keys without following the repository's applicable approval/deployment requirements. Do not send admin/email notifications from tests.
8. Build affected projects and run affected unit/integration suites. The earlier selected unit run was 232 passed, zero failed, zero skipped; establish the current baseline again if the checkout changed. Report unrelated failures honestly, preserve existing behavior, and update relevant skills/memory if the implementation materially changes the contract. Keep all investigative artifacts outside repos and remove them and all test cloud data; inspect git status and verify cloud cleanup.

Quality is the first priority; cost is secondary and asynchronous latency is not a concern. Require no observed factual regressions in a representative, source-verified corpus. Do not promise a universal zero-error rate or treat a few passing live examples as proof of it.

Proceed through implementation and verification, then explain simply what was wrong, what changed, what tests passed, whether existing documents need re-ingestion, and any remaining limitations. Do not deploy automatically.
