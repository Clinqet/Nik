# PHASE 1 PROMPT — copy-paste everything below the line into a fresh Claude Code session in `C:\Nik`

---

Read `C:\Nik\voice-answer-ladder\PLAN.md` **completely, top to bottom, before writing any code** — it is the
single source of truth: the owner's coding standards VERBATIM (§0.1 — they bind every line you write), every
locked decision D1–D32 with rationale, the full designs (§5–§7), the chunker edge-case contract (§7.8b, 35
cases), the validation contract (§7.11b, V1–V20), **the cross-cutting edge-case sweep (§7.16, X1–X16 —
business-closure-mid-ingest, delete-idempotence ordering, SAS expiry, FAQ ETag conflicts, session-slot
contention, and more; every X-case is implemented and tested like the numbered chunker cases)**, verified
prices, the §0.18 test-placement map (§9), the three-phase execution model (§10), and the traps list (§12). Also read `C:\Nik\CLAUDE.md` in full, the
`clinqet-voice-assistant` skill, and the memory entry `voice-out-of-scope-answers-design-2026-08-16.md`.
The approved mockup is `C:\Nik\mockups\voice-knowledge-base\knowledge-base.html` — build the UI exactly
from it.

**Everything is OWNER-APPROVED (2026-08-18)**: the §11 schema table (new Cosmos container `KnowledgeBase`,
partition key `/businessId` — confirmed), the new search index, blob container, queue, settings, the mockup
rev 4 including the AI-setup nudge. No further approval gates for this phase — build.

## YOU ARE PHASE 1 OF 3: everything EXCEPT the `clinqetmcp` repo

Phase 2 (a later session) builds the MCP tools (`answer_catalog_question`, `search_knowledge`) and the
realtime-prompt wiring that names them. Phase 3 audits the whole program. **You must not write anything in
`clinqetmcp`, must not add tools to `ResolveAllowedTools`, and must not add prompt text that names tools
that don't exist yet.**

## Phase-1 scope (each item's full spec is in the PLAN section cited)

1. **Move 1 — the knowledge policy** (PLAN §5): rescope the privacy line + add the expert-translation /
   general-trade-knowledge / judgment-question blocks in `RealtimeSessionPayloadBuilder.BuildInstructions`
   (shared by BOTH carriers — verify both payload builders), and update `find_services`' `[Description]` in
   `clinqetmcp\Clinqet.Mcp\Tools\CatalogTools.cs` — **this one-line description edit is the single permitted
   `clinqetmcp` touch** (it ships with Move 1 per D-design; nothing else in that repo). Tests in
   `Clinqet.Communications.UnitTests\Voice\RealtimeSessionPayloadBuilderTests.cs` (§0.18).

2. **The `KnowledgeBase` Cosmos container** (§7.3c/§7.4): policy in
   `clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs`, wired into `cosmosindexsetup`'s
   `CosmosDbInitializer`; registry entity + `DocumentType.KnowledgeDocument` (append-only enum); repository
   (partition-scoped ONLY — §0.6).

3. **The `clinket-knowledge` search index** (§7.2/§7.3): document POCO in `clinqetcore\Entities\AISearch\`
   (all value types nullable), initializer in its **OWN .cs file** in `cosmosindexsetup` (‼️ the convention
   test text-splits `Program.cs`), full schema **including `docTitle`, `chunkKind`, `linkedServiceId` AND
   `linkedServiceName`, `hasEmbedding` guard**, 3072-dim vector (HNSW mirror, no vectorizer — we write
   vectors), `standard.lucene` analyzer on text fields (D27), TextWeights-only `knowledgeRelevance` profile,
   NO scoring functions, NO suggester, NO semantic config. Name in BOTH `Search:` (setup tool) and
   `AISearch:` (read side) sections.

4. **Infra wiring** (§7.14c + §7.15): blob container `provider-knowledge` (storage.json + settings map),
   queue `knowledge-ingest` — **`requiresSession: true`** (D25) — in `events.json` (copy the
   media-derivatives block, `lockDuration PT5M`, dedup on), `deploy.ps1` (queue-name variable + BOTH
   function-app settings blocks + Doc-Intelligence settings duplicated into the function blocks per §7.7
   Gap 3), all three `local.settings*.json`, ‼️ **the `ServiceBusService._senders` dictionary entry** (the
   #1 forgotten step), the `KnowledgeIngestQueueMessage : ServiceBusMessageBase` DTO carrying **only
   `{businessId, docId}`** — ‼️ **the REGISTRY ROW IS THE WORK ORDER** (the function point-reads it for
   blobPath/docType/linkedServiceId/contentHash — redelivery-safe by re-reading CURRENT state).

5. **`KnowledgeController`** (§7.5 + §7.4b): batch `sas-urls` (mirror `LicensesServices` shape, all V1–V8
   validations incl. WEBP-specific message; **XLSX/HTML/JSON are ACCEPTED types** per D14/D28) · `confirm`
   (registry row `Processing` + enqueue with `SendMessageWithSessionAsync(sessionId: businessId)` +
   deterministic messageId `{businessId}:{docId}`) · list · **delete** · **reprocess** · **FAQ create/EDIT/
   delete** (synchronous: registry record + ONE card embedded+upserted in the request — live instantly; edit
   re-embeds that card; delete removes card+record). Permissions REUSE `voice.read`/`voice.settings.manage`
   (D17 — NO new key).

6. **The ingestion function** (`clinqetfuncations`, §7.6–§7.8): queue-triggered (copy
   `MediaDerivativeProcessorFunction`'s skeleton incl. `OperationCanceledException`-first catch and explicit
   dead-letter reasons). Register `IDocumentIntelligenceService` + settings in the Functions host (‼️
   `ValidateOnBuild=true` — a missing registration is a whole-host boot failure). **Extraction per D28
   local-first routing**: DI `prebuilt-layout` + `outputContentFormat=markdown` ONLY for PDFs and images,
   via a NEW public raw-text method taking model+format (knowledge's own `ExtractionModelId` setting — the
   shared onboarding `ModelId` is untouched; DI reads the private blob via a read-SAS); DOCX/XLSX via
   `DocumentFormat.OpenXml` in-process (**embedded DOCX images auto-detected via image parts — NO user
   checkbox — routed individually through the D26 caption path, skipping decorative ones under
   `EmbeddedImageMinBytes` 10 KB / `ImageCaptionMinPixels` 200**); HTML via an HtmlAgilityPack-class parser
   (**structure not tags**: h1–h6 → headings, `<table>` stored AS HTML, anchor text kept / hrefs dropped,
   script/style/nav/footer deleted); TXT/MD/JSON local (full-JSON bodies flattened to `key: value` lines).

7. **The chunker — D24 + ALL 35 §7.8b cases, EACH case = at least one unit test** in the Functions suite:
   350/512/120 tokens, 15% whole-sentence overlap, heading→paragraph→sentence-end→never-mid-word, danda
   terminators, decimal guard, dehyphenation, tables atomic-or-row-groups-with-repeated-headers (HTML stored,
   compact serialization embedded), page-furniture strip, PageBreak join, per-doc dedupe, deterministic
   `chunkNo`, FAQ = one card, `DocSummary` card, prefix = `docTitle — docType — sectionPath (+ linked
   offering name (+ its subcategory/category name — PREFIX-ONLY, no extra index fields))`.

8. **The D11 per-document call**: ONE `gpt-5.4-mini` structured call (first ~6k chars + heading outline →
   `{title, summary, language}`, ~$0.002, temp 0, clamps; degrade = filename title, never blocks) — feeds
   `docTitle`, every prefix, the `DocSummary` card, the registry display.

9. **Lifecycle — the races, in EXTREME detail (owner-mandated; §7.14 + §7.8b#34-35):**
   - **Gapless REPLACE**: old cards keep serving during re-ingestion; the final commit upserts new cards
     over the SAME deterministic ids `{businessId}_{docId}_{chunkNo}` and **prunes stale ids with
     `chunkNo ≥ newCount`** in the same commit. Replace is **disabled while Processing** (Ready/Failed only).
   - **DELETE — how the index knows what to remove**: every card carries `docId` as a FILTERABLE field ⇒
     one query `businessId eq X and docId eq Y` → batch-delete returned ids → registry row → blob, in that
     order. ‼️ **The registry row is NEVER removed before the card purge succeeds** (X5) — a failed purge
     errors out and leaves the row so the user's retry re-runs an idempotent delete; no path can leave
     orphaned cards with no row.
   - **FAQ cards count toward the passage cap** (X8 — a FAQ card is a passage; the 200-FAQ cap binds first
     in practice). **Concurrent FAQ edits resolve by ETag** — 412 ⇒ friendly reload-and-retry toast (X7).
   - **DELETE-DURING-PROCESSING — the tombstone rule**: the delete endpoint purges IMMEDIATELY and never
     waits; the ingestion run, **immediately before its final commit**, re-reads the registry row via **ETag
     CAS** — row gone/tombstoned ⇒ purge everything it already wrote for that `docId` and exit WITHOUT
     committing. No resurrection, no half-delete. Integration-test this race explicitly.
   - **Overflow (D25)**: cap check AFTER chunking BEFORE any embed/index spend; grace ×1.10 finishes the
     current document FULLY or the whole document fails — **a document is ALL-IN or ALL-OUT**; sessions
     (sessionId = businessId) serialize per business so concurrent uploads cannot race the cap.
   - **Embedding hygiene**: `GenerateBatchTextEmbeddingsAsync` returns EMPTY arrays on failure — check
     `Length == 3072` before indexing; index writes mirror `AzureSearchIndexer.UploadDocumentsAsync`
     (‼️ Azure returns 200 with per-document failures — inspect every result; poison-isolate); wrap the new
     `SearchClient` like `ProviderSearchClient`.

10. **UI — web AND mobile in THIS session** (§7.11/§7.12, mockup rev 5 exactly):
    - **The nav label and page title are "AI Knowledge" (D32)** — the route slug stays
      `/dashboard/profile/knowledge`; the section inside stays "Your FAQs" (D29).
    - **Status-chip colors are LOCKED (D33)**: green = Ready · **blue + spinner = Processing** (never
      yellow, never a gradient) · red = Failed · amber = true warnings only (limit/space-full). Use the
      existing design-system tokens; brand green #97EF29 only on pressed/selected/CTA.
    - Web: `/dashboard/profile/knowledge` — Profile-menu entry immediately after the AI entry
      (`profile\layout.jsx:133-144`, same `aiAssistantEnabled` conditional), thin `page.jsx` +
      `CapabilityGate permission="voice.read"` + `layout.js` metadata + feature component; ‼️ register in
      `profileScreensAreCapabilityGated.test.js` or the suite fails; three-way gate like
      `CallFollowUpsGate`; upload via `putFileWithProgress` batch choreography (confirm only what landed);
      document rows with status chips, per-row Try-again/Replace/Delete per V19; **"Your FAQs"** (D29) with
      Add/**Edit**/Delete (V20); usage meter; polling only while a Processing row exists.
      ‼️ **The web page must be flawless at phone and iPad widths** — same page, stacked rows, meter under
      title, actions in a ⋯ menu ≤640px (the mockup's 360px frame is the acceptance bar).
    - **The §7.11c AI-setup nudge (D31)**: bottom of the AI Voice Assistant settings page — the friendly
      no-jargon card ("Help your receptionist know your business inside out… [Add your knowledge]") that
      navigates to the AI Knowledge page; swaps to the quiet counts one-liner when ≥1 Ready document
      (counts read from the SAME list endpoint the page uses — X15, no new endpoint); same gates as the
      page; both platforms.
    - Mobile: the five-file registration (constant, screen folder, `gateOn('voice.read', …)`, stack, deep
      link `dashboard/profile/knowledge` + `types.ts`), menu row after the AI entry
      (`ProfileScreen\index.tsx:1067-1075`), **multi-file** picker (`allowMultiSelection`), upload via XHR
      `putBlobToSasUrl` (‼️ fetch breaks the SAS signature), `knowledgeDocuments` in `MEDIA_LIMITS`,
      `ui.tsx` primitives + theme tokens (`theme.space.md`, never hardcoded numbers).
    - Localization: all 10 catalogue files (web flat-dot ICU ×5 incl. un-wired `es-US`; mobile
      SCREAMING_SNAKE `{{}}` ×5 incl. un-wired `es`; ‼️ NO inline ICU plural/select anywhere on mobile —
      separate keys for counts), plus API-side keys (validation errors + the failure reasons) in
      `clinqetinfrastructure\Resources\Localization\en.json` AND every sibling language file.
    - Analytics: register the new surface on both platforms (registration/parity tests will enforce).

11. **Teardown** (§7.14): add `KnowledgeBase` to `BusinessClosureTeardown`'s container list + knowledge-index
    passage purge + blob-prefix purge.

## Tests (§0.8/§0.18 — placement by runtime consumer)

Functions suite: chunker (35 cases), extraction routing, ingestion function (idempotency, redelivery,
overflow+grace, tombstone race, gapless replace incl. shorter-version pruning — integration against REAL
engines via Testcontainers where the behavior is engine-enforced). API suite: controller validations V1–V16,
SAS shape, FAQ sync path, permission gating. Payload-builder tests in the Functions suite. UI: ESLint zero
errors + the gating/localization/parity suites listed in the plan. Confirm test projects RECOMPILED — never
trust a `--no-build` pass. Sabotage-verify the critical pins (tombstone, pruning, isolation verify).

## Non-negotiables

Every rule in `CLAUDE.md` §0 and PLAN §0.1 verbatim: zero assumptions/hallucinations/workarounds; settings
not magic numbers (class defaults mirror appsettings); every `IMemoryCache` write sets `Size = 1`; no
cross-partition Cosmos queries; terse comments only for non-obvious WHY; never edit repo files with
PowerShell Get/Set-Content; §0.16 leave the tree clean and SAY what you removed; thread-safe, leak-free,
`await using`, honour every CancellationToken; no new permission keys; no hardcoded user-facing text; no
industry vocabulary anywhere (D21).

## When Phase-1 code is complete — two mandatory closing steps (§10)

1. **Multi-dimensional audit of YOUR OWN Phase-1 output**: re-walk §7.8b case by case against the code;
   exercise the tombstone + gapless-replace races; adversarial isolation attempt; cost paths (hash skip, no
   double billing, decorative-image skip); responsiveness at 360/768/1024; localization parity suites; all
   affected suites green with recompilation confirmed. Fix what the audit finds, then re-run.
2. **WRITE `C:\Nik\voice-answer-ladder\PHASE-2-PROMPT.md`** — a complete, self-contained copy-paste prompt
   for Phase 2 (the MCP surface): what Phase 1 shipped and where, what Phase 2 builds (PLAN §6 + §7.9 +
   prompt wiring + tool-contract list + probe calls), the standards pointers, and Phase 2's own closing
   duties (its audit + writing `PHASE-3-PROMPT.md`). Then report to the owner: what shipped, audit findings
   and fixes, test proof, and the Phase-2 prompt path.
