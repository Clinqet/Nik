# Document-transcription implementation handoff

Paste the prompt below into a new local Codex chat at C:\Nik when ready to give the implementation green light. Creating this file did not authorize starting application implementation in the planning chat.

```text
This is my green light to implement the document-transcription quality fix. Quality over speed. Read the complete saved plan before making changes.

Workspace: C:\Nik
Authoritative plan:
C:\Nik\Data\knowledge-validator-review-2026-09-08\TRANSCRIPTION-QUALITY-PLAN.md
Historical reproduction evidence:
C:\Nik\Data\knowledge-validator-review-2026-09-08\REVIEW.md

Read every plan section. Sections 17.12 and 18 record settled owner decisions. Section 19 makes the dedicated admin alert mandatory for every required third verification. Sections 12 and 15 contain audit/coding requirements. The acceptance matrix is now J01-J52, not only J01-J47. Later explicit owner decisions supersede conflicting earlier proposals.

Do not follow RESUME-PLAN.md in that directory: it belongs to another task. FIX-PROMPT.md is older and superseded. At handoff, no application fix had been implemented; verify current code/git state before editing. Actual Functions repo spelling: C:\Nik\clinqetfuncations.

Problem and evidence:
KnowledgeTranscriptConservation accepted swapped service prices and deletion of “not” from a refund policy. Controlled real-component probes established a validator limitation, not spontaneous corruption in business documents. Read REVIEW.md for measured results and limits. Fix contextual associations and factual conservation, not merely token coverage. Do not replace the extraction pipeline with MarkItDown as part of this fix.

Scope:
- Provider/Profile Setup and Service Draft Extraction: third verification protects service identity and pricing only. Pricing includes actual consumed amount/currency/sign/scale/range/rate-basis fields and service-to-price/source-row association. Description-only differences do not independently trigger the extra verification or price suppression.
- Knowledge: all factual content, including names, descriptions, policies, negation, numbers, dates, quantities/units, conditions, tables, omissions and figure text.
- Trigger selectively for substantive in-scope discrepancies or inability to establish the required match. Preserve legitimate OCR corrections and contextual equivalents such as same-currency $5/$5.00 and 5gram/5 g. Neither OCR nor AI is automatically correct; use original source evidence.

Settled decisions — do not ask again:
1. Clearly source-resolved third price: use automatically under the normal create/update/draft approval lifecycle.
2. Still-uncertain KNOWLEDGE price/text: retain usable third reading, continue and alert admin. No usable third response: retain original OCR for that section, continue and alert. Never remove the disputed knowledge price.
3. NEW SETUP SERVICE with still-uncertain price: keep/create service without actionable pricing through existing completion behavior. Include actual ID/name in existing Pricing Missing total/name summary AND existing provider pricing-required SignalR notification. Verify web/mobile parity and both delivery paths.
4. SERVICE DRAFT with still-uncertain price: retain an editable draft without actionable disputed pricing; provider supplies valid pricing before price-changing approval. Existing editors exist. Do not drop the draft or invent a placeholder price.
5. Uncertain SERVICE NAME: use usable third-check name, continue and alert in all flows. No name removal, new confirmation requirement or uncertainty gate. Follow original-OCR fallback when third text is unavailable; never invent text. Name-only uncertainty must not clear independently established pricing.
6. EXISTING SERVICE with usable saved pricing: preserve its current price when replacement remains disputed; request provider review of replacement and alert admin. Do not count retained usable price as missing or overwrite concurrent edits.
7. No whole-workflow uncertainty hold. Preserve ordinary authorization, domain validation and truthful infrastructure failure handling.

MANDATORY ADMIN ALERT CONTRACT:
- Whenever a third check becomes necessary in ANY of the three flows, create a dedicated-type Verification Required alert obligation BEFORE scheduling/sending the call, followed by a correlated outcome. This includes resolved checks, unresolved checks, failure/refusal/timeout and required checks that never start. Failure-only reporting is insufficient.
- Proposed new enum member: AdminAlertType.DocumentTranscriptionVerification. This was absent when reviewed. Verify current code and implement a dedicated type through the EXISTING queue/message/processor and admin type filters/details. Do not substitute a generic error, knowledge failure or capacity alert.
- Include actual flow, business/provider identity, region, file/document/source version, real page/region/block or native sheet/cell/slide location, affected fields/services, why verification was necessary, bounded OCR/first-AI/third/selected readings, actual deployment/attempts, outcome, remaining uncertainty and provider/admin follow-up. Source references must be authorized; final passage/service/draft IDs only when available. Never invent identifiers or expose secrets/SAS tokens.
- Required and outcome events need correlation and durable retry. Dedup repeated delivery, never distinct checks or distinct consuming-flow outcomes. No sampling or broad business cooldown that hides checks. Record actual attempts; do not report cache reuse as a new model call. Every discrepancy in a grouped check must be traceable.
- Keep the planned dedicated appsettings control, default ENABLED and correctly bound in both hosts. Test configuration, dispatch, persistence, dedup and admin visibility end to end. Do not silently opt out through unrelated configuration.
- Queue outage must retain a retryable obligation using the supported durable path. No swallowed errors or untracked fire-and-forget. Admin human review must not block the authorized flows. Provider pricing notifications and internal admin verification alerts are separate; neither replaces the other.
- See section 19 for the complete fields, timing, reliability, UI and J48-J52 acceptance requirements. Exact new persistence changes still need applicable schema approval; the dedicated-type requirement does not authorize unrelated schema.

Implementation obligations:
Apply shared evidence, typed equivalence, source-grounded adjudication, consumer-specific pricing dispositions and compatible caches. Cover page caches, full artifacts, downstream extraction, figure composition and image fallbacks. Validate final service fields, not only transcripts.
Address documented draft detector/anchor row loss, missing-price UI guidance, direct update approval asymmetry, filters/counts and reanalysis/concurrent edits. Reproduce static findings before claiming runtime bugs. Preserve original data/images/layout/native-format behavior and source associations.
Use Sol/high as initial verifier evaluation choice; Astra is rejected. Verify actual Azure deployment/model/API/image/structured-output compatibility. Terra/high is optional only after measured quality comparison. Prepare matching deploy.ps1/settings wiring; owner will manually create the verifier in the same Foundry account. Do not run the full deployment script or invent model availability/cost/accuracy.

Standards and approval boundaries:
Read applicable AGENTS.md, relevant skills completely, affected registrations, implementations and tests before editing. Follow the entire plan's standards. No invented symbols/settings, shortcuts, swallowed defects or skipped failing tests. No cross-partition Cosmos operations. Obtain exact schema approval before new SQL/Cosmos/Search schema work. Follow required UI mockup gates. Affected provider web/mobile changes ship together with all localization. Preserve peer-host separation, ETag concurrency, idempotency, cancellation/disposal, bounded retries/resources and aligned settings/defaults/deployment wiring. Preserve unrelated changes; no automatic commit/push/deployment.

Testing and audits:
Run meaningful unit/integration tests, affected builds and required real-engine checks. Use source-verified digital/scanned PDFs plus applicable Word/Excel/text/HTML/image fixtures. Verify final indexed/retrieved knowledge and actual service/draft writes, including all direct/bulk approval routes.
Canada sandbox testing is authorized. Read required configuration from cosmosindexsetup without exposing credentials; verify targets before writes and track exact created IDs for cleanup. Do not send uncontrolled alerts to unrelated recipients during automated tests; prove real alert delivery through an explicitly scoped sandbox test and capture its evidence.
Perform multidimensional audits during EVERY phase and a final combined audit across all three flows. Cover accuracy, false positives, data/image conservation, caches/fallbacks, security, concurrency/idempotency, direct/bulk writes, web/mobile/localization, admin/provider notification delivery, resource bounds and measured cost. Fix EVERY confirmed in-scope finding; rerun its reproduction/checks. Report unrelated findings separately. Do not claim universal perfect OCR; require zero observed regressions on the source-verified corpus and disclose limits.

Keep the plan updated with actual progress, decisions, findings/tests and resume checkpoints. Update required skills in all locations and project memory after significant implementation. Remove task-created scratch and exact sandbox test data; inspect git status. Keep deliverable plan/prompt and permanent regression tests.

Begin by reading the plan and current source, briefly confirm scope, then implement. Ask only about new concrete ambiguities or required approval gates. Do not reopen settled decisions or substitute assumptions.
```
