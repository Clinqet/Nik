# PHASE 3 PROMPT — copy-paste everything below the line into a fresh Claude Code session in `C:\Nik`

---

Read `C:\Nik\voice-answer-ladder\PLAN.md` **completely, top to bottom, before doing anything** — it is the
single source of truth: the owner's coding standards VERBATIM (§0.1), every locked decision D1–D33 with
rationale, the full designs (§5–§7), the chunker edge-case contract (§7.8b, 35+9 cases), the validation
contract (§7.11b, V1–V20), the cross-cutting sweep (§7.16, X1–X16), the retrieval contract (§7.9), the
Move-2 design (§6), the §0.18 test-placement map (§9), and the traps list (§12). Also read `C:\Nik\CLAUDE.md`
in full, the `clinqet-voice-assistant` skill, and the memory entry
`voice-out-of-scope-answers-design-2026-08-16.md`.

## YOU ARE PHASE 3 OF 3: the full-program end-to-end audit

Phases 1 and 2 are code-complete and green. **You build nothing new. You audit EVERYTHING both phases
shipped as if reviewing a stranger's work, fix what the audit finds, and close the program out** (skill +
memory updates, final owner report). A finding you fix is re-proven with a test; a finding you cannot fix
is reported honestly — never papered over.

---

# WHAT PHASE 1 SHIPPED (2026-08-18, verified green then)

Move 1 (the knowledge-policy prompt rescope + `find_services` description) + the ENTIRE knowledge stack
outside `clinqetmcp`. The full inventory is in the Phase-2 prompt (`PHASE-2-PROMPT.md`, "WHAT PHASE 1
ALREADY SHIPPED") and the `clinqet-voice-assistant` SKILL section "ANSWER LADDER PHASE 1 of 3". Headlines:

- Cosmos container `KnowledgeBase` (`/businessId`) + `KnowledgeDocument` registry (the ingestion work
  order) + `IKnowledgeDocumentRepository` (partition-scoped by construction).
- Search index `clinket-knowledge` (own initializer file `cosmosindexsetup\KnowledgeSearchIndexInitializer.cs`,
  `standard.lucene`, TextWeights-only `knowledgeRelevance` profile, HNSW mirror, no suggester/semantic/vectorizer).
- `KnowledgeSearchDocument` POCO + `KnowledgeSearchIndexer` (D22 row verification on every purge path,
  poison isolation, gapless-replace prune, deterministic ids `{businessId}_{docId}_{chunkNo}`).
- Queue `knowledge-ingest` (session-enabled, `sessionId = businessId`, D25) + blob `provider-knowledge` +
  ARM/`deploy.ps1` + three `local.settings*.json` + the `ServiceBusService._senders` entry.
- `KnowledgeController` (batch sas-urls/confirm/list/delete/reprocess/PATCH/FAQ CRUD, gates reuse
  `voice.read`/`voice.settings.manage`), `KnowledgeManagementService` (X5 delete order, tombstone CAS,
  synchronous FAQs with X7 ETag 412).
- `KnowledgeChunker` (D24, §7.8b's 35 cases as tests) + `KnowledgeDocumentParser` (D28 local-first) +
  `KnowledgeIngestProcessorFunction` (D11/D25/D26, tombstone CAS before the final commit, gapless replace).
- `BusinessClosureTeardown` purges knowledge cards + `KnowledgeBase` + the blob prefix.
- Web `/dashboard/profile/knowledge` + mobile Knowledge screen (five-file registration) + the D31 nudge on
  both platforms; D32 "AI Knowledge" label; D33 chips; 68 web keys × 5, mobile `KNOWLEDGE` block × 5,
  14 `Error_Knowledge*` API keys × 5.
- `VoiceKnowledgeSettings` bound in API + Functions hosts.

Phase-1 proof then: Functions 2271 · API 9384 · MCP 574 · cosmosindexsetup 70/70 · web jest 76+26 +
ESLint 0 · mobile tsc + 123. Sabotage-verified: tombstone CAS, gapless-replace prune, three D22 pins.

# WHAT PHASE 2 SHIPPED (2026-08-17/18 session — verified green, sabotage-verified)

## The two MCP tools (both consume the ONE 8-unit `VoiceCallSession.CatalogLookupCount` allowance, D6)

- **`search_knowledge`** — `clinqetmcp\Clinqet.Mcp\Tools\KnowledgeTools.cs` (new tool class, registered
  `WithTools<KnowledgeTools>` in `Program.cs`). Consumes **1 unit** (concurrent with the search, the
  find_services pattern). Service: `clinqetinfrastructure\Services\Knowledge\ProviderKnowledgeSearchService.cs`
  + `clinqetcore\Interfaces\Knowledge\IProviderKnowledgeSearch.cs` (interface + `KnowledgeSearchDependencies`
  record with nullable `KnowledgeSearchClient?`/`IEmbeddingService?` — graceful degrade on unprovisioned
  stamps). ONE hybrid request (BM25 over content/sectionTitle/docName/docTitle/linkedServiceName + vector
  over contentVector in a single call); query embedding capped at an `EmbeddingBudgetShare = 0.4` slice of
  the budget, **fails soft to keyword-only in the same round trip** (the embedding service returns EMPTY on
  failure — handled); `hasEmbedding eq true` guard ONLY on hybrid requests (keyword-only requests skip it);
  D22 four layers (filter LEADS with `businessId eq`, `AssertScoped` pre-send, per-row re-verification —
  one foreign row discards ALL + `ICatalogAlarm.RaiseCrossTenantLeak` + fails closed via
  `CatalogIsolationException` → the safe non-answer); **token budget binds FIRST** (`RetrievalMaxTokens`×4
  chars, top passage always kept); NO minimum-score cutoff (D27b); NO LLM (pinned STRUCTURALLY — a ctor
  reflection test refuses any `*Completion*` dependency); timeout ⇒ honest degrade + `RaiseLookupTimeout`;
  zero results ⇒ the honest None ("NOT proof either way… leave_message"); optional `linkedServiceId`
  narrowing (escaped scalar AFTER the scope clause; multiple ids via `search.in(...,'|')` for the Move-2
  synergy; `|` stripped from ids). Result models: `clinqetshared\Models\Voice\KnowledgeSearchModels.cs` +
  `VoiceKnowledgeOutcome` enum (string-serialized).
- **`answer_catalog_question`** — added to `CatalogTools.cs`. Consumes **`AllowanceUnits` (2) BEFORE any
  retrieval or LLM spend** (an exhausted call must not pay for a judgment it cannot use) ⇒ max 4/call.
  Service: `clinqetinfrastructure\Services\Voice\ProviderCatalogAnswerService.cs` +
  `clinqetcore\Interfaces\Voice\IProviderCatalogAnswer.cs`. The ladder: plain `LookupAsync` FIRST →
  **D8 short-circuit** (Matches ≤ `LookupTooBroadThreshold` AND no digit in the requirement — the digit is
  the requirement-shape tell from the trigger class; digit-bearing small matches still get judged) →
  `RetrieveCandidatesAsync` (NEW member on `IProviderCatalogSearch`, implemented inside
  `ProviderCatalogSearchService`'s isolation fortress: scope-led filter, SearchMode.Any wide index read
  with FULL descriptions clamped at `CandidateDescriptionMaxChars`, per-row verification THROWING on
  foreign rows, fallback = capped partition read with EMPTY terms via `SearchPublicCatalogAsync`) →
  knowledge-passage synergy (`IProviderKnowledgeSearch` filtered to candidate ids, fail-soft empty) →
  ONE `IAICompletionService.GetStructuredCompletionAsync` (strict schema `{priceOrAvailability, matches[
  {id, confidence(stated|likely|unknown), reason}]}`, deployment/effort/tokens from settings, temp 0,
  timeout = remaining budget) → LLM ids mapped back (invented ids DROPPED), ordered Stated→Likely→Unknown,
  capped `MaxResults`, D20 hedging note. Degrades: kill switch/LLM error/timeout/malformed-after-one-
  `JsonRepairHelper`-repair/zero-matches/zero-candidates ⇒ **the plain result** (never "we don't have
  that"); `priceOrAvailability` flagged by the LLM ⇒ refusal note steering to listed priceText;
  `CatalogIsolationException` from candidates ⇒ **rethrows** (never degrades); caller cancellation
  propagates. Result models: `CatalogAnswerModels.cs` + `CatalogAnswerConfidence` enum, `ExpertChecked`
  flag distinguishing judged results from degrades.
- Shared weighted-allowance helper `clinqetmcp\Clinqet.Mcp\Tools\CatalogLookupAllowance.cs` (fail-open on
  a lost write, cap-vs-lost-write distinction preserved from the original).

## Prompt wiring (`RealtimeSessionPayloadBuilder`, both carriers)

- Ctor grew `IOptions<VoiceKnowledgeSettings>` + `IOptions<VoiceExpertCheckSettings>` (both test factories
  updated: `RealtimeSessionPayloadBuilderTests` + `...NoiseSuppressionTests`).
- `ResolveAllowedTools(context, sharingEnabled, includeProviderContext, expertCheckEnabled, knowledgeEnabled)`:
  `answer_catalog_question` in **Map mode only** AND `Voice:ExpertCheck:Enabled`; `search_knowledge` when
  `context.HasKnowledge` AND `Voice:Knowledge:Enabled` (any catalog mode — knowledge is orthogonal to size).
- The §6.3 ladder-order rule rides INSIDE the map-mode branch, gated on the expert-check switch (never name
  a tool the model cannot see). The §7.10 knowledge block (+ X13 table-reading rule: speak VALUES, never
  markup/separators/the word "table"; never say "document"/"passage"/"index"/"link") is emitted ONLY when
  `hasKnowledge && enabled` — **zero added tokens otherwise, pinned byte-for-byte**
  (`Build_NoKnowledge_NoToolAndZeroAddedTokens`). Owner standing instructions still end the prompt (pinned).
- `hasKnowledge` signal: `ProviderContext`/`PublicProviderContext` gained `HasKnowledge`;
  `FullProviderContextService` ctor grew `IKnowledgeDocumentRepository` and reads a NEW partition-scoped
  `CountReadyAsync(businessId)` (status = Ready, type-filtered; both fields indexed in the Phase-1 policy)
  inside the existing cached fan-out — fail-soft to false, never a per-call round trip, never a failed handoff.

## Host wiring + config

- MCP `Program.cs`: binds `Voice:Knowledge`, `Voice:ExpertCheck`, `AIService`; registers
  `IKnowledgeDocumentRepository` (WithDatabaseName), the knowledge search client (null when
  `AISearch:KnowledgeIndexName`/endpoint/key absent → honest degrade), `KnowledgeSearchDependencies`,
  `IProviderKnowledgeSearch`, `IProviderCatalogAnswer`, and `IAICompletionService` via a **NAMED**
  HttpClient `"ai-completion"` + per-scope factory create — ‼️ the typed `AddHttpClient<,>` form is BANNED
  in this host (`TypedHttpClientLifetimeConventionTests`, it caught the first attempt);
  `ServiceApprovalSettings` deliberately stays unbound (inert defaults; this host never validates services).
  `WithTools<KnowledgeTools>` added.
- Functions `Program.cs`: binds `Voice:ExpertCheck` (tool exposure on the Telnyx path).
- `clinqetmcp\appsettings.json`: full `Voice:Knowledge` + `Voice:ExpertCheck` blocks,
  `AISearch:KnowledgeIndexName: clinket-knowledge-dev`, `AIService` block (mirrors the API's committed one).
- `clinqetfuncations\...\appsettings.json`: full `Voice:ExpertCheck` block.
- `clinqetshared\Models\VoiceExpertCheckSettings.cs` (class defaults mirror appsettings; §6.4 values).
- `deploy.ps1` MCP applied block (~L8031): `AISearch__KnowledgeIndexName` + the `AIService__` quartet
  (Endpoint/ApiKey/DeploymentName/ApiVersion). No new ARM resources (Phase 2 adds none).

## The chat decision (pinned)

Both tools stay **OFF `Mcp:ChatToolAllowlist`** (a chat session has no catalog binding and no live caller).
Pinned in `ChatToolAllowlistConventionTests.AnswerLadderTools_StayOffTheChatAllowlist` + two refused rows in
`ChatToolAllowlistIntegrationTests`.

## Tests added in Phase 2 (all green)

- `Clinqet.Mcp.UnitTests`: `Services\ProviderKnowledgeSearchServiceTests` (22 — isolation incl. quote
  injection + search.in, hybrid/keyword fail-soft, budgets, cutoff-never, degrades, timeout+alarm,
  cancellation, the no-LLM structural pin), `Services\ProviderCatalogAnswerServiceTests` (22 —
  short-circuit economy, digit override, confidence mapping/ordering, invented-id drop, settings
  pass-through, all §6.5 degrades, JSON repair, isolation rethrow, synergy + fail-soft, cancellation),
  `Services\ProviderCatalogCandidateRetrievalTests` (8 — fortress extension, full-description contract,
  empty-terms fallback), `Tools\CatalogToolsTests` (8 — 1-unit vs weighted-2 consumption on a REAL mutate
  emulation, exhausted-before-spend, lost-write fail-open), `Tools\KnowledgeToolsTests` (6),
  `Conventions\VoiceAnswerLadderSettingsConventionTests` (§0.12 mirrors), the chat pin, 3 hasKnowledge
  tests in `FullProviderContextServiceTests`.
- `Clinqet.Mcp.IntegrationTests`: curated tool list +2 (alphabetical), `AnswerLadderToolIntegrationTests`
  (short-circuit serves real rows with the LLM unreachable; degrade-to-plain never errors; **the weighted
  allowance proven on the REAL session document** (2 then +1); search_knowledge honest degrade), 2 chat
  refusal rows.
- `Clinqet.Communications.UnitTests`: 10 new payload-builder pins (tool exposure by mode/hasKnowledge/kill
  switches on BOTH carriers, knowledge block + X13 wording, ladder rule, zero-token pin, owner-rules-last).

## Phase-2 proof (2026-08-17 session)

MCP unit **646/646** · MCP integration **81/81** (real Cosmos emulator) · Functions unit **2282/2282** ·
API unit **9384/9384** · Functions integration run started at close (check the report for its result).
**Sabotage-verified**: (1) disabling the D22 row verification failed
`ForeignCardInTheResponse_DiscardsTheWholeResultSet_AlarmsAndFailsClosed`; (2) disabling the D8
short-circuit failed `SmallClearMatch_ShortCircuits_AndNeverCallsTheLlm`; both restored and re-greened
with real rebuilds. **NOT exercised: live probe calls** — no dev voiceline is reachable from the build
environment; the excavator scenario end-to-end over a real phone line remains for a dev-line session.

## Known leftovers Phase 2 found but did not own

- Foreign uncommitted working-tree changes from an earlier session (NOT Phase-2 work, left in place):
  `clinqetfuncations` `FunctionAppFactory.cs` + `AdminAlertProcessorIntegrationTests.cs` +
  `SerialQuarantineConventionTests.cs` (an admin-alert serial-quarantine flake fix) and `clinqetapi`
  `Clinqet.API.IntegrationTests\Tests\BusinessClosureSqlTests.cs`. Verify they are deliberate, still
  green, and get committed or removed by their owner.
- Owner deploy steps still outstanding from Phase 1: run `cosmosindexsetup` per region
  (`--launch-profile "Dev (Canada)"` AND `"Dev (India)"` — never bare `dotnet run`), then `deploy.ps1` per
  stamp (queue, blob container, app settings — now including the Phase-2 MCP keys).
- PLAN §12's unrelated security finding (git-tracked live keys in `cosmosindexsetup\appsettings.{ca,in}.json`)
  is still open with the owner — not this program's change.

---

# WHAT PHASE 3 MUST DO

**Audit the WHOLE program end to end, as a stranger.** Read the plan's contracts, then read the shipped
code line by line and verify each claim. Fix what you find; re-prove fixes with tests; sabotage-verify any
new critical pin. Dimensions (PLAN §10 Phase-3 row):

1. **§7.8b line by line** — all 35 chunker cases + 9 doc-level cases: is each one genuinely covered by a
   test that would fail if the behavior regressed? Spot-check the trickiest by mutation (danda boundaries,
   oversize-sentence word-boundary cut, table header repetition, rowspan serialization, dedupe, tiny-doc).
2. **§7.11b V1–V20 line by line** — client AND server enforcement per row; the server re-validates
   everything; every message a localization key in all 5 files on each platform.
3. **The races EXERCISED, not assumed** — tombstone CAS (§7.8b#34), gapless replace (#35 + X12), the X5
   delete order (row never removed before the card purge succeeds), X7 FAQ ETag 412, D25 overflow + the
   session serialization, X9 hash-twin refresh, X16 stale-client cap re-check. Prove against real engines
   where the suite doesn't already.
4. **Adversarial isolation (D22)** — attempt cross-business retrieval through every read path Phase 2
   added: `search_knowledge` (filter build, row verify), `RetrieveCandidatesAsync`, the synergy pull, plus
   Phase 1's indexer purge paths. Try model-shaped injections (quotes, OData in text, foreign
   linkedServiceId). Confirm every path fails CLOSED and alarms.
5. **Cost paths** — no double-billing: contentHash short-circuit, decorative-image skip, empty-extraction
   before the D11 call, overflow before embed spend, the D8 short-circuit's economy, allowance weighting
   (2 units before any LLM), the `hasKnowledge` count riding the cached fan-out (no per-call round trip).
6. **Performance** — the retrieval budget shape (embedding share, single round trip, token-budget trim),
   the no-LLM-in-`search_knowledge` structural pin, prompt token cost zero when `hasKnowledge` false,
   `LookupSummaryMaxChars` never leaking into candidates.
7. **Localization parity suites** — web `localeParity`/`icuMessageIntegrity`/`sourceLocalizationIntegrity`,
   mobile `localeParity`/`sourceLocalizationIntegrity` (no inline ICU), API 5-file key parity.
8. **Web responsiveness at 360/768/1024** — the Knowledge page + the D31 nudge (stacked rows, meter, ⋯
   menu at 360; the mockup's proof frame is the reference).
9. **Mobile parity** — rendering rules (`renderingRules.js` ↔ `.ts` twins + the sandbox parity test),
   the five-file registration, `MEDIA_LIMITS`, analytics screenMap.
10. **ALL suites green with recompilation confirmed** — API unit+integration, Functions unit+integration,
    MCP unit+integration, cosmosindexsetup, web jest gates + ESLint 0, mobile tsc + jest gates. Never
    trust a `--no-build` pass that did not follow a real build.
11. **Sabotage-verify the critical pins again from the audit's fresh eyes** — at minimum one D22 pin, the
    D8 economy pin, the tombstone CAS pin, and the gapless-replace prune pin: break, watch fail, restore,
    re-green.

# PHASE 3 CLOSE-OUT (mandatory, §0.9 + §0.16)

1. **Update the `clinqet-voice-assistant` SKILL in ALL FOUR AI-tool directories**
   (`.claude/skills/clinqet-voice-assistant/SKILL.md`, `.github/skills/...`, `.agents/skills/...`,
   `.cursor/rules/clinqet-voice-assistant.mdc`) with a Phase-2/Phase-3 section: the two tools, the
   allowance weighting, the prompt gates, the hasKnowledge signal, the chat decision, the D22/D23/D8
   mechanics, and where every piece lives. Mark the answer-ladder program CLOSED (or list what stays open).
2. **Update the memory entry** `voice-out-of-scope-answers-design-2026-08-16.md` (+ its `MEMORY.md` index
   line): Phase 2 + Phase 3 shipped, what the audit found/fixed, the traps that recur (the typed-client
   ban in the MCP host; Cosmos CONTAINS is AND-per-term; `\u` escapes in perl/sed replacements corrupt
   source — use the Edit tool), and the owner's outstanding deploy steps.
3. **§0.16 tree clean** — delete every scratch artefact you created; `git status --porcelain` in every
   repo must be clean of them, and SAY in the final report what you removed (and what you deliberately
   left, e.g. the foreign changes above if their owner has not resolved them).
4. **Final report to the owner**: what the program shipped end to end, what the audit found and fixed
   (each with its proof), full suite numbers with recompilation confirmed, what was NOT exercised (live
   probe calls) and exactly how to exercise it, and the outstanding owner steps.

# NON-NEGOTIABLES

Every rule in `CLAUDE.md` §0 and PLAN §0.1 verbatim: zero assumptions/hallucinations/workarounds; settings
not magic numbers (class defaults mirror appsettings in EVERY host that binds them); every `IMemoryCache`
write sets `Size = 1`; no cross-partition Cosmos queries; terse comments only for a non-obvious WHY; never
edit repo files with PowerShell `Get-Content`/`Set-Content` (and never patch source via perl/sed `\u`
escapes — the Edit tool only); §0.15/§0.17 a test reads only its OWN repo; §0.18 tests live with the
runtime consumer; no new permission keys; no hardcoded user-facing text; no industry vocabulary anywhere
(D21); never lower a coverage floor silently; a phase never starts work belonging outside its scope.
