# SKILL: Business Search (provider "Ask about my business")

> The provider-facing question-answering surface: a member of a business asks a question in their own
> words and gets a cited answer built ONLY from that business's own data, through a streaming tool loop.
> **P1 = backend · P1.5 = voice + multi-script · P2 = the UI on BOTH provider apps (§13) · P3 = the twelve Group B work tools (§14) · P4 = the document audience control + C1–C4 (§16).** M7 frames the surface (§15).
>
> Design authority: `C:\Nik\Data\provider-ai-search\` — `PLAN.md` (build authority),
> `AUTHORIZATION-DESIGN.md` (the authorization contract, §6b corrections C1–C6 override everything else),
> `PHASE-1-PROMPT.md`. Per-phase records: `findings/AUDIT-P1…P4`, `MEASUREMENTS-P1.5/P3/P4`, `CARRIED-TO-P5.md`.

---

## 1. What this is, and what it is NOT

| | |
|---|---|
| **Is** | A provider-team surface. The asker is a MEMBER of one business, acting in that business's workspace. |
| **Is NOT** | The phone receptionist. That is the Voice Assistant (`clinqetmcp` / `Clinqet.Mcp`) and it is **untouched** by this feature — no MCP tool was added, no allowlist entry, no realtime config. |
| **Is NOT** | The old in-app chat assistant. `POST /api/v1/ai/chat`, `McpAIService`, `McpToolGateway`, `IMcpAIService`, `IMcpToolGateway`, `ChatToolSessions` and `Mcp:ChatToolAllowlist` were **DELETED** in this phase. |
| **Replaced by** | `POST api/v{version}/business/search/ask`. |

‼️ `IMcpSessionService` / `McpSessionService` / `AiSession` **survived the deletion** and were rewritten as
the Business Search conversation store. `ChatInteractionType` and `AiSession.InteractionType` also survive —
the enum is a persisted Cosmos property and its four `ChatInteractionType_*` localization keys are bound by
`[Display(Name = ...)]`, so none of them is an orphan.

---

## 2. Files

**`clinqetcore/Interfaces/BusinessSearch/`**
`IBusinessSearchAgent` · `IBusinessSearchTool` + `BusinessSearchToolResult` · `IBusinessSearchModelClient`
(+ `BusinessSearchModelMessage/Tool/ToolCall/Event`) · `IBusinessSearchDocumentService` ·
`BusinessSearchAuthorizationContext` · `BusinessSearchCitationRegistry`

**`clinqetcore/Interfaces/Knowledge/KnowledgeSearchVisibility.cs`**
`KnowledgeSearchVisibilityState { AllVisible, Restricted, ReadFailed }` · `KnowledgeSearchVisibility` ·
`KnowledgeSearchAudienceRule.Decide(...)` — ONE rule, two callers, returning `KnowledgeAudienceDecision
{ Visible, Recognised, Audience }`. ‼️ The parsed `Audience` is on the decision BECAUSE the controller used
to re-parse the raw word with a bare `Enum.TryParse` — no `IsDefined` — so a numeric value the rule had
already refused as unrecognised came back as a real audience (D-6).

**`clinqetinfrastructure/Services/BusinessSearch/`**
`BusinessSearchAgent` (the streaming tool loop) · `BusinessSearchModelClient` (raw HTTP + SSE) ·
`BusinessSearchToolBase` (the two-gate pattern) · `BusinessSearchToolCatalog` (model-facing English
descriptions + `StatusKeyFor` + `WithheldTopics`) · `BusinessSearchToolNotes` ·
`BusinessSearchDocumentService` · `BusinessSearchRoles` · `Tools/` — five Group A tools ·
**P1.5:** `BusinessAlphabetService` (the business's alphabet set) · `BusinessSearchQueryRenderings`
(the per-request tool schema + the server-side script check).

**P1.5 — multi-script retrieval**
`clinqetcore/Utilities/TextScriptDetector.cs` — ISO 15924 from a Unicode range count. **No AI, no
probability.** ‼️ Gurmukhi `0A00–0A7F` sits DIRECTLY BELOW Gujarati `0A80–0AFF`; both boundaries are
pinned by tests with real characters.
`clinqetcore/Interfaces/BusinessSearch/BusinessSearchScriptPlan.cs` — the asked script PLUS every alphabet
the business writes in, capped by `Retrieval:MaxQueryLegs`.
`clinqetcore/Utilities/SpeechCandidateLocales.cs` — the per-provider locale list for dictation.
`clinqetcore/Models/Knowledge/KnowledgeExtractRenderer.cs` — the stored extract as readable markdown.

**API** `Clinqet.API/Controllers/BusinessSearch/BusinessSearchController.cs` ·
`Clinqet.API/Services/ApiCatalogIsolationAlarm.cs`

**Settings** `clinqetshared/Models/BusinessSearchSettings.cs`, root `BusinessSearch` section in the Main API
`appsettings.json`.

---

## 3. Endpoints

All four are on `api/v{version:apiVersion}/business/search` and **every one** carries
`[RequiresPermission("business.profile.read", PermissionScope.Business)]`.

| Verb | Route | Notes |
|---|---|---|
| POST | `ask` | SSE. Question ≤ 500 chars. |
| GET | `documents/{docId}/pages/{page:int}` | The cached OCR page, ONLY via `KnowledgeBlobPaths.OcrPageBlob`. |
| GET | `documents/{docId}/text` | **P1.5** — the stored extract, for a source with no real page. |
| POST | `prepare` | **P1.5** — 204. Warms the alphabet set on surface open so the ask path costs 0 ms. |
| GET | `sessions/{sessionId}` | Member-scoped replay. |

‼️ **`documents/{docId}/view-url` WAS DELETED IN P1.5** (owner's ruling, audit O3): *never give any link to
download the document.* The route, its DTO, the service method, the `DocumentViewSasMinutes` dial and
`IAzureStorageService.TransformToViewUrl` are all gone, and a reflection guard fails if a
`ViewUrl`/`DownloadUrl` member reappears on `IBusinessSearchDocumentService`. **Do not re-add it.**
This also dissolved audit O7 — with no link minted, there is nothing to expire.

Plus, on the Knowledge controller:
`PATCH api/v{version}/knowledge/documents/{docId}/audience` — `[RequiresPermission("voice.settings.manage", PermissionScope.Business)]`.

### ‼️ Why `business.profile.read` and not `[Authorize]` (C1)

All ten system roles hold `business.profile.read` at Business scope, so "every member can search" still holds
— **and** the attribute keeps three guards a bare `[Authorize]` throws away: the asserted-foreign-businessId
mismatch check, the `BillingOnly` refusal, and the live-recheck hook. `BusinessSearchToolMatrixTests`
re-verifies the premise from `TenancyRoleCatalogDefinition` itself: if a future role lacks the key, **grant
the key — never drop the attribute**.

### ‼️ SSE wire shape

`data: {json}` frames with an **in-JSON `eventType`**. There is **no `event:` line anywhere on this
platform**. Property names are camelCase but **enum VALUES keep declared PascalCase** (`"Meta"`, not
`"meta"`). `: ping\n\n` comment frames every 15 s.
Event types: `Meta · Status · Delta · Citation · Image · Done · Error`.

---

## 4. The five Group A tools

> ‼️ There are **seventeen** tools. The twelve **Group B work tools** — bookings, quotes, invoices, invoice
> totals, leads, customers, inbox, Insights, team, reviews, call follow-ups and refund requests — are in
> **§14**, and they carry rules this section does not (dates, member narrowing, the capped sample).

| Tool | Permission | Source |
|---|---|---|
| `search_knowledge` | **none** | `IProviderKnowledgeSearch.SearchForProviderAsync` + the audience allow-list |
| `search_services` | `catalog.service.read` | `IProviderCatalogSearch` |
| `list_offers` | `catalog.offer.read` | `IFullProviderContextService` |
| `get_business_profile` | **none** | projection of `IFullProviderContextService` |
| `get_availability` | `availability.read` | `IFullProviderContextService` |

‼️ `catalog.offer.read` is NOT universal (dispatcher, technician, finance and contractor lack it) and
`availability.read` is not held by finance. Those members get the fixed refusal copy, never an error.

**The two-gate pattern** (`BusinessSearchToolBase`):
1. **Gate 1** — a tool the member may not use is dropped from the schema list the model is given, so the
   model cannot even name it.
2. **Gate 2** — `ExecuteAsync` re-checks the permission anyway and returns a fixed refusal note. Gate 1 is a
   cost optimisation; **gate 2 is the security boundary.**

‼️ `get_business_profile` returns a **projection** (C5) — never licence numbers. `weeklyHours` lives here at
no permission because the hours are public on the Open Page; gating them behind `availability.read` locked
finance out of "what time do we open?".

---

## 5. ‼️ The per-document team-search audience (§0.7 approved 2026-09-02)

Knowledge search is **open to every member** (owner decision). What bounds it is the per-document audience.

```
KnowledgeDocument.searchAudience         : string?   the row's OWN word          default "Team"
KnowledgeDocument.searchAudienceRoleKeys : List<string>?  (WhenWritingNull)      file rows only
```

**The rule — ONE implementation, and it owns the INTERPRETATION as well as the comparison:**
```
KnowledgeSearchAudienceRule.Decide(rawAudience, audienceRoleKeys, memberRoleKeys, isOwnerOrAdmin)
    => (Visible, Recognised)

absent / null / blank  ⇒ everyone on the team          (Recognised)
"Team"                 ⇒ everyone on the team          (Recognised)
"Roles"                ⇒ audienceRoleKeys ∩ memberRoleKeys ≠ ∅, owner/admin always
anything else          ⇒ OWNER AND ADMINISTRATORS ONLY, and the role keys are IGNORED   (NOT Recognised)
```

‼️ **P4.5 ROOT FIX (2026-09-04, decision 14).** There used to be TWO parsers: a Newtonsoft converter on the
entity and a hand-written parse in the sweep. They disagreed in the ONE case a parse exists for — the
converter kept the row's `searchAudienceRoleKeys` and would have let people in through the point-read while
the sweep nulled them and did not. Worse, the converter's parse was **lossy on round trip**: an older host
read a newer host's value, resolved it to `"Roles"` and wrote that back, destroying the provider's choice
permanently. Now:

- `KnowledgeDocument.SearchAudience` is a **`string?`** carrying the row's own word. **No new field, same
  JSON property, same stored values, no migration** — §0.7 does not fire.
- ‼️ **`KnowledgeSearchAudienceConverter.cs` IS DELETED.** Do not reintroduce a converter, and do not add a
  sentinel enum member (it would parse *and* re-serialize to the sentinel, making the loss worse).
- The write path stays **strict**: `KnowledgeSearchAudienceDto.Audience` is still the `[Required]` NULLABLE
  enum, so only `Team` or `Roles` can ever be written.
- `KnowledgeDocumentDto.SearchAudience` stays the typed enum and carries the **INTERPRETED** value: an
  unrecognised word returns `Roles` with an **empty** key list, so the screen says "only the owner and
  administrators" — the same fail-closed reading the server enforces. **No app change was needed.**
- ‼️ **MEASURED 2026-09-04: all 54 live knowledge rows in both regions carry NO `searchAudience` at all.**
  The absent branch is what governs the entire live library — get it wrong and every document changes
  visibility.

- **`Roles` with an empty/absent list means owner + administrator ONLY.** Fail-closed, and legal input.
- Role matching is **exact and ordinal**.
- `isOwnerOrAdmin` is resolved ONCE per turn by `BusinessSearchRoles.IsOwnerOrAdmin(tenant)` —
  `IsPrimaryOwner || RoleKeys contains "administrator"` — never from a permission key.
  `IsPrimaryOwner || RoleKeys contains "administrator"` — never from a permission key.

**‼️ Three states, never fail-open.** `IKnowledgeDocumentRepository.ListSearchVisibleDocIdsAsync` returns
`AllVisible | Restricted(ids) | ReadFailed`. **Only `AllVisible` may skip the filter. `ReadFailed` permits
NOTHING and is a distinct state** — "the registry could not be read" and "nothing is restricted" must never
be the same branch. In the retrieval, `ReadFailed` becomes `VoiceKnowledgeOutcome.Unavailable`, i.e. C6's
"temporarily unavailable", never "nothing found".

**Enforced in BOTH places** (they are separate HTTP requests — C2):
1. `ProviderKnowledgeSearchService.SearchForProviderAsync` — the allow-list REPLACES the old
   `ListRetrievableDocIdsAsync` read (today the voice-only `ListReceptionistGatesAsync` sweep; it is a superset: same status predicate + the audience), so it stays
   **one partition query**, projection widened by two fields. Evaluated in **C#, not SQL** — a comparison
   against an undefined field is undefined (⇒ false) in Cosmos SQL, and `searchAudience` is absent on every
   row written before this feature.
2. `BusinessSearchDocumentService.ResolveAsync` — same rule on the point-read row.

**Writer:** `KnowledgeManagementService.SetSearchAudienceAsync` — a row-only CAS merge mirroring
`SetReceptionistAccessAsync` (formerly `SetShareWithCallersAsync`). Switching to `Team` **clears** the role list; a stale one would silently reappear
the moment somebody switched back to `Roles`.

‼️ `searchAudience` is entirely separate from `receptionistAccess` (ONE word, interpreted
only by `KnowledgeReceptionistRule` — see the `clinqet-voice-assistant` SKILL, 2026-09-07). Those decide what a phone CALLER
hears or is sent; this decides what a MEMBER can find. Never collapse them.

The provider-facing control shipped in P4 — **see §16**, and approved sheet **M6**.

‼️ **2026-09-07 — the receptionist's per-item choice never touches Ask Clinket.** The retrieval files are byte-identical;
the one knowledge fact Ask Clinket states, `get_business_profile.hasKnowledgeDocuments`, is the PROVIDER's fact ("any Ready
document, whoever may use it") from `IKnowledgeDocumentRepository.AnyReadyAsync` — an index-only `TOP 1` (~3 RU flat; the
retired `CountReadyAsync` cost 8.59 RU at the caps), fail-soft false — and NEVER the voice context's `HasKnowledge`, which
now means "the receptionist may answer from something" and would read an all-internal library as "no documents". Fixed the
same day: the web empty-library state (`BusinessSearchPage.jsx`) tested `Array.isArray(response.data.data)` on the OBJECT
DTO and could never render — it reads `payload.documents` / `payload.faqs` now (`BusinessSearchPage.emptyLibrary.test.jsx`).

---

## 6. ‼️ Images (C3)

A picture is included when **its DOCUMENT is visible to that member**.
**Do NOT call `ListSendableImageRefsAsync`** — that is the "may this be sent to a phone caller" gate.
Reusing it would let the receptionist's `sendable`/receptionist-access choices decide what the provider's own
team can see. ‼️ **Sent only with a source the answer CITES** (P4-E-26, §30): links are minted then, never for a
picture nobody sees; `MaxImagesPerAnswer` counts pictures SHOWN, each once, and a DTO with neither URL is dropped.

## 7. ‼️ view-url disposition (S1)

Inline disposition **only** for `application/pdf` and images. `html`, `htm`, `svg` and anything unrecognised
get `Content-Disposition: attachment`. `.html` is an allowed knowledge upload and the blob's Content-Type
comes from the client's own PUT — inline would be **stored XSS on the storage origin**. The content type is
derived **server-side from the file name**, never read from the blob.

---

## 8. The agent loop

`BusinessSearchAgent` — a bounded `Channel` (capacity 100) + linked CTS, producer awaited in `finally` with
`ConfigureAwaitOptions.SuppressThrowing`.

- ‼️ **Superseded 2026-09-25 (owner): Ask AI answers on sol at `Medium`** (`gpt-6.1-sol` since 2026-10-02), pinned by `AiModelPinConventionTests`.
  The rest of this bullet is the earlier luna setup.
- Model: **`gpt-5.6-luna` with `reasoning_effort: "none"`**. ‼️ MANDATORY, not tuning — a higher effort
  returns HTTP 400. `BusinessSearchModelClient` is raw HTTP + SSE because the OpenAI SDK 2.1.0 cannot express
  `reasoning_effort`. No `temperature`.
- Budgets: `MaxToolIterations` · `MaxToolCallsPerIteration` · `MaxToolResultCharsPerAnswer` (past it the
  model is offered NO tools and must answer from what it has) · `TotalTimeoutSeconds` for the whole answer.
- ‼️ Tool-call fragments accumulate **unconditionally**; the id and name may arrive in a later fragment than
  the first. Completeness (`id` and `name` present) is checked at HARVEST, not on the first fragment —
  refusing to open a slot until the id shows up silently discarded a whole call's arguments.
- ‼️ Prose the model streams in the SAME round as its tool calls is included as `Content` on the assistant
  tool-call message, or the model re-derives and repeats what it already said.
- `finish_reason: "length"` ⇒ a `Status` frame carrying `BusinessSearch_Status_PartialAnswer` before `Done`.
  A bare `Done` would present a truncated answer as a complete one.
- A turn that streams nothing and calls no tool ⇒ `BusinessSearch_Error_NoAnswer`, never a silent `Done`.

**`BusinessSearchCitationRegistry` is NUMBERING ONLY (C2), not an authorization gate** — it could not be
one, because `pages/{page}` and `view-url` arrive as separate HTTP requests with no access to it. What it
does guarantee inside one answer: a `[n]` the model invents resolves to nothing. Citations are emitted only
for the rows that actually survived the payload cap and reached the model.

---

## 9. Sessions, limits, isolation

- **Sessions are per MEMBER.** The member id is stamped in `AiSession.Metadata["membershipId"]` (‼️ the
  entity has NO membershipId field and `userNumber` actually holds the **businessId** — never reuse it for
  identity). A session id the member does not own starts a NEW conversation rather than 403ing, so it never
  reveals whether somebody else's session exists.
- **CAS, no memory cache** (S11): `GetSessionWithETagAsync` → mutate → `TryReplaceSessionAsync(ifMatchETag)`
  → `Replaced | Conflict | Gone`. ‼️ **No transient retry on the two WRITE paths** — a 408/503 after the
  server committed would be replayed and the caller's CAS loop would append the same turn twice.
- **Limits**: burst `6/min` via `AiRateLimitingService` (`AIAssistant:RateLimiting:BusinessSearch`; note
  `GetEndpointConfig` is a fixed switch — extending it is a CODE change, S5), and both daily caps
  (200/business, 60/member) as durable counters in `BusinessSearchUsageCounterRepository` on the existing
  `AiUsageCounter` family. Counters roll on a **UTC** date key — the copy says "midnight UTC".
- **Isolation layer 4**: one foreign-business row in a search result discards the WHOLE set and raises
  `ApiCatalogIsolationAlarm` (`AdminAlertType.SecurityAlert`, High, `forceAdminAlert: true`).

---

## 10. Gotchas that have already cost time

- **A `--no-build` run, and even an incremental build, can test a STALE binary.** After restoring a
  sabotaged file, `dotnet build --no-incremental` before trusting any result. This bit twice in this feature.
- **A Moq setup that does not match the real call makes the code receive `default`.** Two whole test classes
  passed/failed for that reason: an unstubbed `CheckTokenRateLimitAsync` failed every agent test closed, and
  a fake stubbing `ListAsync` after the code moved to `GetAsync` point reads returned no row and made
  document-shaped assertions pass vacuously.
- **`describe.skip` / a guard that reads zero files must FAIL, never pass** (§0.15/§0.17). The tool-scan
  guard asserts the five tools are present precisely so an empty scan cannot report success.
- **`StatusKeyFor` builds keys by hand**, so the localization guard that scans `GetLocalizedString(...)` call
  sites cannot see them — a dedicated convention test pins them against all five language files.
- **`[Display(Name = ...)]` counts as a reference.** The four `ChatInteractionType_*` keys look like orphans
  and are not.
- **Tests live with the runtime consumer (§0.18).** Business Search runs in `Clinqet.API`, so its tests are
  in `Clinqet.API.UnitTests` / `Clinqet.API.IntegrationTests` — never the MCP or Functions suites, even
  though most of the code sits in `clinqetinfrastructure`.


---

## 11. ‼️ P1.5 — MULTI-SCRIPT RETRIEVAL

### 11.1 The rule

> **A text search covers the ASKED script PLUS every alphabet the business's own content actually uses.**

NOT "add English for non-English questions". A three-alphabet business asking in **English** needs three
renderings; a Latin-only business asking in English needs **one** and issues **exactly one** `SearchAsync`.

‼️ **The failure is cross-SCRIPT, never cross-language.** Measured: an English question reaches a French
chunk at 0.477 and a Spanish one at 0.487, but a Gujarati one at **0.191**. English + French + Spanish is
**ONE alphabet** — the leg count follows alphabets, never language count. **Never add a leg for a
Latin-script language.**

### 11.2 How it works

1. **`scripts`** — `Collection(Edm.String)`, filterable + facetable, on **both** search indexes.
   Derived in TWO places, one per index: `KnowledgeSearchIndexer.UpsertCardsAsync` labels a document CHUNK
   from its content; `AzureSearchIndexer` labels a SERVICE from its name + description. Both read the same
   `BusinessSearch:Scripts` section, pinned across hosts by `ScriptThresholdsAgreeAcrossHostsTests`, but with
   DIFFERENT length floors (11.3). Per CARD, so a document whose page 1 is English and page 5 Gujarati is
   labelled page by page.
2. **The alphabet set** — two faceted queries (`$top=0`), unioned, cached per BUSINESS with `Size = 1`,
   single-flighted, and re-checked against the document registry's newest write at most every
   `RevalidateSeconds` (P4-J-07, §29). Warmed by `POST prepare`.
3. **The tool schema** — built PER REQUEST, one **required, explicitly named** scalar field per alphabet.
4. **Parallel legs** — one `SearchAsync` per rendering via `Task.WhenAll`, met by RELEVANCE
   (`KnowledgeRelevanceRanker`, §30): each passage's cosine comes back with it and must reach the floor; rank fusion
   only for keyword-only legs — never by score. A failed leg never fails the answer; the count reaches the model.

### 11.3 ‼️ THINGS THAT WILL BITE YOU

- ‼️ **The tool-field DESCRIPTION wording is MEASURED, not drafted.** *"render the SAME question in each
  field"* scored **3/25** on gpt-5.6-luna — the model copied one ENGLISH string into every field and
  translated non-English questions INTO English first. *"TRANSLATED INTO {language} and written in the
  {language} script"* scores **25/25 at 1, 2 and 3 fields**. **Re-measure before changing a word of it.**
- ‼️ **Never merge the legs by score** (F7, Phase 3; corrected here 2026-09-25, P4-I-05). A hybrid leg returns
  Azure's RRF numbers (~0.01–0.03), but a leg whose embedding failed returns raw BM25 (~26), so the old
  max-score merge handed the keyword-only leg every seat. Since P4-E-26 the legs meet by CLOSENESS
  (`KnowledgeRelevanceRanker`, this path and the phone alike); rank fusion remains only where closeness is unknown.
- ‼️ **A question is not a chunk — and NEITHER IS A SERVICE NAME.** The asked script uses share only, with
  NO length floor: the chunk floor of 12 characters would read `કિંમત?` as Latin and search the wrong
  alphabet entirely. The catalogue has its OWN floor (`CatalogMinCharacters`, 4) for the same reason —
  `"Facial ફેશિયલ"` is 6 Gujarati characters at 46% share, so under the chunk floor a business with a
  Gujarati catalogue and no documents is invisible to the alphabet set, which is the exact case the services
  `scripts` field was added for.
- ‼️ **A partial fan-out MUST say so.** A rendering the model failed to produce, a leg that failed, or an
  alphabet set that could not be read all mean the search covered less than it set out to. Saying *"your
  documents do not cover that"* after a narrowed search is a false negative stated with confidence.
- ‼️ **Existing cards have no `scripts` value** — no backfill (owner-confirmed, pre-prod). The set
  under-reports until re-ingest. Self-healing, and the asked script is always searched.
- ‼️ **A field REMOVED from a search model blocks the whole index update.** Azure answers
  `OperationNotAllowed: Existing field(s) 'x' cannot be deleted`, and the additive fields in the same update
  fail with it. `KnowledgeSearchIndexInitializer.PreserveLiveOnlyFieldsAsync` now carries live-only fields
  forward, making every update additive. **Never remove that guard.**

### 11.4 NINETEEN scripts are detectable (corrected 2026-09-25 — the "eight" here was stale)

`TextScriptDetector.KnownScripts`, canonical order: `Latn Deva Gujr Guru Beng Taml Telu Orya Knda Mlym Sinh Arab
Hani Jpan Hang Thai Cyrl Grek Hebr`. Odia, Kannada, Malayalam and Sinhala were added 2026-09-25 (P4-E-02); until
then their content labelled `Latn`. Adding a block needs no index change, but it DOES need its own name in
`BusinessSearchScriptPlan.FieldNameFor` (`queryInOdia` … `queryInSinhala`) — without one the script falls to
`queryInEnglish` and the tool schema carries a DUPLICATE property. A question mostly in letters the detector does
not know (`TextScriptDetector.IsMostlyUnrecognisedLetters`) reads as Latin, so `BusinessSearchQueryRenderings.Parse`
adds the member's own words as one more leg, inside the cap (P4-E-20).

---

## 12. ‼️ P1.5 — THE AUDIT ITEMS THAT LANDED HERE

| Item | What changed |
|---|---|
| **O2** | `SearchKnowledgeTool.Excerpt()` runs `MaterialExcerptBuilder.Build(...)` **per card** — the provider's screen and the caller's excerpt share ONE renderer. Per card, not per result set, because `Build` reorders and re-budgets across what it is given, which would break citation alignment |
| **O3/O7** | `view-url` deleted, `documents/{docId}/text` added — see §3 |
| **O5** | ‼️ A permission refusal is no longer indistinguishable from "nothing found". `BusinessSearchToolCatalog.WithheldTopics` names what this member cannot reach in the system prompt, with the exact localized sentence to use. **Live today:** dispatcher/technician/finance/contractor lack `catalog.offer.read`; finance lacks `availability.read` |
| **§7** | `tokensUsed` carries the real figure · a cut-short answer is stored with `[[partial-answer]]` · `: ping` tested · an end-to-end SSE round trip exists (`ScriptedBusinessSearchModelClient` in the factory) · `IsSolo` and its per-ask roster read REMOVED |
| **§10 N1** | The OCR page-cache key pair is stamped from ONE source in `deploy.ps1` onto BOTH hosts, both appear in both required-settings manifests, and the miss log moved Debug → Information |

---

## 13. ‼️ P2 — THE PROVIDER-FACING UI, ON BOTH APPS

> Built 2026-09-03. Audit: `C:\Nik\Data\provider-ai-search\findings\AUDIT-P2-2026-09-03.md`.
> Mockups: M1-M4, registered in `PLAN.md` §0. Approved sheets live ONLY in `C:\Nik\Data\mockups\`.

### 13.1 Where it lives

| | web (`clinqetwebpartnerapp`) | mobile (`clinqetmobilepartnerapp`) |
|---|---|---|
| screen | `src/components/businessSearch/BusinessSearchPage.jsx` | `src/Screen/ProfileFlow/BusinessSearch/index.tsx` |
| hook | `src/hooks/useBusinessSearch.js` | `src/hooks/useBusinessSearch.ts` |
| client | `src/services/businessSearchService.js` | `src/services/businessSearchService.ts` + `src/services/sseStream.ts` |
| shared rules | `src/lib/businessSearch/askRules.js` | `src/lib/businessSearch/askRules.ts` |
| redaction | `src/lib/businessSearch/redactQuestion.js` | `src/lib/businessSearch/redactQuestion.ts` |
| recent | `src/utils/recentQuestions.js` | `src/utils/recentQuestions.ts` |
| entrances | header ask panel + sidebar row | dashboard magnifier + Profile row |

‼️ **THE HEADER MAGNIFIER ON THE ANSWER PAGE ITSELF (fixed 2026-09-04).** `AskHeaderButton` is mounted in
the shared dashboard header, so it renders on **every** page — including `/dashboard/search`, where its
press ran `router.push` to the route already open. **Live-looking, and it did nothing.** It now focuses the
docked ask box, which M7 guarantees is on screen there in every state, and falls back to the push only if
no box is found. The seam is `lib/businessSearch/askFocus.js` (`ASK_INPUT_ID` + `focusAskBox`) —
‼️ **web-only, deliberately NOT in `askRules.js`**, whose contract is that both apps evaluate it identically.
Hiding the button instead was rejected: it would shift the bell and share controls beside it.
**This component had NO test at all**, which is how a dead press survived — `AskHeaderButton.test.jsx` now
covers the focus, the fallback, the no-second-box rule and the in-memory handoff.

‼️ **The two apps' entry POINTS are not going to match, and that is not a parity defect.** Web has ONE
shared header, so one mount reaches every page. `clinqetmobilepartnerapp` has **no shared header** — every
screen builds its own cluster (`MyDashboardScreen`, `ProfileScreen`, `FAQs`, `Locations`, `Offers`, `Team`,
…) above a bottom tab bar. Each app offers **two** entrances placed by its own navigation shell. Putting a
magnifier on every mobile screen is a **design change needing a sheet**, not a bug fix — do not "restore
parity" by editing ten bespoke headers.

### 13.2 ‼️ `askRules` AND `redactQuestion` ARE TWINS — extend both or neither

Dependency-free, side-effect-free, compared by a parity suite. Exports: `ASK_SURFACE`, `FRAME`,
`CITATION_KIND`, `PARTIAL_MARKER`, `parseFrameLine`, `drainFrames`, `isPartialFrame`,
`stripPartialMarker`, `hasRealPage`, `citationAction`, `citationSubtitle`, `sourceCounts`,
`answeredFromKey`, `askChips`, `emptyLibraryState`.

‼️ **A parity suite is a comparison, not coverage — and it SKIPS in CI** (§0.17). Test the twins in **both**
repos. P2 found a real web-only redaction defect that had shipped and survived precisely because the only
tests lived in the mobile repo's parity suite.

### 13.3 The rules the UI must never re-derive

- **The page decision comes from `citationAction`**, never a local `citation.page ? …` branch. A guard on
  each platform fails the build if one appears.
- **No download exists anywhere** — `view-url` was deleted in P1.5.
- **Read `partial: true` live; STRIP `[[partial-answer]]` on replay.**
- **A 404 from the page/text route is normal**, not an error to report.
- **The ask body carries only `question`, `sessionId`, `language`** — never a `businessId`.

### 13.4 Chips are the PROVIDER's own catalogue

`askChips` builds from the member's service names; all ten system roles hold `catalog.service.read`, so
there is no permission branch and no new endpoint. M4 §01b **supersedes** M1's chip row until the Group B
tools exist.

‼️ **THREE RULES ADDED 2026-09-04, owner-directed, in the shared twins — extend both or neither:**

| Rule | Why it exists |
|---|---|
| **A suggestion already in the Recent lane is NOT offered.** `isAsked` is the SCREEN's test — it compares the **rendered label** against the rows the lane **SHOWS** (not the 8 the device kept; an older question is not reopenable from here) | The owner's screenshot had **three of four** suggestions duplicating the three Recent rows. A chip **ASKS** and spends one of the day's questions; a Recent row **REOPENS** for free (M7 §15.1). So the lane was offering to charge for an answer sitting one column away |
| **A stock code is not a service.** `looksLikeStockCode` — one WORD carrying ≥2 letters **and** a ≥3-digit run | A dealer catalogue offered *"How much is a 2022 CATERPILLAR 320 - 07 (MC065420)?"*. Deliberately tight: `60 min`, `2-hour`, a bare `320` and `Facial no. 2` all stay. An all-codes catalogue gets **no service chip**, never the least-bad one |
| **A name that FITS beats one that must be cut.** Two passes: names ≤ `CHIP_NAME_MAX` first, truncated ones only as fallback | M7 already banned a cut suggestion as *"a question the provider cannot read before spending one on it"*. A cut name still beats no chip, so it stays as the fallback rather than a third skip |

‼️ **`Hours` is RESERVED against the CAP, NOT against `isAsked`.** It is appended after the room math so a
plain slice cannot drop it on a phone — but re-offering the question just asked still charges, so a Hours
chip that is already a Recent row is dropped and **its slot goes back** to the next candidate in the fixed
order. **The lane can end up EMPTY, and that is correct**: everything worth suggesting is one free tap away.
M7 §15.1 already rules the single-lane layout, so no undrawn state ships.

‼️ **`BusinessSearch.Chip.LeadsLastWeek` and `canReadLeads` are RETIRED** (owner, 2026-09-04). `lead.read`
no longer earns a suggestion; **both** work chips answer to `booking.read` — `WeekAhead` (the schedule) and
`BookingsLastWeek` (the count). The key is gone from all ten catalogues and from `chipKeyToMobile`. A
survivor would print its own id on the screen, so each repo asserts its absence, and `askChips` proves it
IGNORES a call site still passing the retired flag.

‼️ **`chips` must stay RENDER-ONLY on mobile.** `t` sits in the memo's dependency array because the
compared value is the rendered LABEL and lint enforces it — safe **only** while no effect watches `chips`.
`businessSearchAskLayout.test.ts` pins both halves: `t` present, and no `useEffect`/`useCallback` depending
on `chips`.

### 13.5 Privacy

Order is **AMOUNT → EMAIL → LONG_DIGITS → PHONE → customerNames → memberNames**, Unicode-aware
(`\p{L}\p{M}\p{N}` — Devanagari combining marks are category **M**), capped at 500 chars, with
`containsContactDetails` applied as a backstop that drops the whole question if anything survives.
‼️ **`.test()` on a `/g` regex is stateful** — use a non-global copy for any predicate.
The question never enters a URL (`utils/handedQuestion.js` replaced a `?q=` handoff), and
`clearAllRecentQuestions()` runs on sign-out from `purgeClientState()` / `clearAuthTokens()`.

**Open residual:** member-name redaction only covers roles holding `team.read`. The complete fix is
server-side and belongs with P3's member-id validation.

### 13.6 Tenancy

Every capability read goes through `capabilityReadState` — four outcomes, because **a FAILED access read is
not a denial**. ‼️ `access` and `accessError` load asynchronously: **they belong in the effect's dependency
array**, or a member whose grants resolve after mount gets no chips at all.
`SURFACE_PERMISSIONS.businessSearch` is `{ permission: null, … }` on **both** platforms (self-gated), and
its label is `Access.Surface.businessSearch` / `ACCESS.SURFACE_BUSINESS_SEARCH`.

### 13.7 Analytics event names must be LITERAL inside the tracker call

The parity resolver reads the literal inside `trackResultClick(…)`. A template hole collapses to `*` and the
pair is compared on **neither** platform; a constant or a wrapper hides it too. The four source taps are
written out in full: `source_service`, `source_offer`, `source_profile`, `source_hours`.

### 13.8 The dictation control is TWO mounts

|  | control (inside the pill) | status (below it, full width) |
|---|---|---|
| web | `DictationMic` | `DictationStatus` |
| mobile | `SpeechToTextMic` | `SpeechToTextStatus`, both inside `SpeechToTextProvider` |

Mounted as one stack inside a `rounded-full` / `borderRadius: 999` row, the message and the language chips
were squeezed into the mic's slot. The mobile provider owns the hook **once**; the halves read it through
context. **Offline disables the mic; "microphone blocked" does not** — permission is granted outside the app,
so a disabled button could never re-enable itself.

### 13.9 Localization traps

- **French puts a space before `?`** — `en ligne ?`. The guard catches a letter before a bare `?`; it
  **cannot** catch `{name}?`.
- **ICU doubles an apostrophe** (`jusqu''ici`) on web; **i18next does not** (`jusqu'ici`) on mobile.
- **Plurals:** web ICU `{count, plural, one {#…} other {#…}}`; mobile i18next `KEY_one`/`KEY_other` with
  `{{count}}`.
- **`bg-brand` / `border-brand` do not exist** in the web Tailwind config — the house idiom is
  `bg-[#97EF29]`. A non-existent class fails silently.

### 13.10 ‼️ A SHARED RULE THAT RETURNS A LOCALIZATION KEY NEEDS A MAPPER ON MOBILE

The shared rules answer with **web** key names — one vocabulary, one parity table. Mobile's catalogues are
nested UPPER_SNAKE, so the screen translates through small mappers: `chipKeyToMobile`, `errorKeyToMobile`,
`answeredFromKeyToMobile`.

‼️ **Handed over raw, i18next answers with the id itself.** P2 shipped `t(answeredFrom.key, …)` with no
mapper, so the line under every answer on the phone read `BusinessSearch.Answer.AnsweredFromDocuments` to
the provider while eleven correctly translated keys sat unread in all five languages. Every suite checked
that the screen rendered *a* value and that the catalogue *held* the keys — **nothing checked that the two
vocabularies met.**

`businessSearchScreenRegistration.test.ts` now derives every `BusinessSearch.*` key the shared rules can
return, asserts each is mentioned **only inside a mapper**, and asserts no `t()` argument is a rule-supplied
value. Sabotage-verified: removing the mapper from the call site turns it red.

The other acceptable pattern, already used by the empty-library state: let the rule decide *whether* to show
something and have the screen name its own mobile keys.

‼️ **And run the ORPHAN direction of the localization sweep** — keys present in a catalogue that nothing
reads. That direction is what finds *missing UI*; the completeness direction (every referenced key exists)
passes happily while a screen renders nothing. It is how the defect above was found, after the phase was
otherwise green.

### 13.11 ‼️ EVERY EVENT OF ONE ANSWER'S LIFE CARRIES THE ANSWER ID (added 2026-09-04)

A rating used to send `{ source_count, partial }` and nothing else, so a thumbs-down could not be joined to
the question it judged — and on a conversation with follow-ups nothing said WHICH answer was meant. **The
session id could never have closed that: every follow-up shares one session.**

**The anchor is server-minted.** `BusinessSearchAgent` mints `Guid.NewGuid().ToString("N")` per answer onto
the **Meta frame** (`BusinessSearchFrameDto.AnswerId`) — Meta only, and before the first word, so a rating
tapped seconds later can name its exchange. The controller reads it off the frame and logs it on **both**
failure paths, so a member's report ("the answer about deposits was wrong") is findable in server logs.

| Event | helper | carries |
|---|---|---|
| `SearchAction/ask` | `trackSearchAction` | the id + the question, already in `searchQuery` |
| `AIAssistantAction/answer_helpful` · `answer_not_helpful` | `trackAIAssistant` | the id + `source_count`, `partial`, `replayed`, `follow_up_depth`, `answer_length`, `language` |
| `AIAssistantAction/answer_copy` | `trackAIAssistant` | the id |
| `ResultClick/source_*` (17) · `document_image` | `trackResultClick` | the id — one `at` object feeds all seventeen |

‼️ **It rides `linkedSearchId`, NEVER metadata.** Metadata values pass through `SanitizeMetadata`'s
phone-number scrub `\+?\d[\d\s\-().]{6,18}\d`, and a 32-hex id contains an 8+ digit run — **measured at
23.9% of ids over 200,000 samples**, i.e. one join in four silently broken. `LinkedSearchId` is a
first-class column, passed straight through unscrubbed, capped at 64 chars by the DTO.

‼️ **Read off the FRAME (`localAnswer`), never off state.** The ask event is emitted in an async
continuation, deliberately BEFORE the liveness gate so a member who leaves mid-answer still counts — and on
exactly that path every `setState` from the run is dropped.

‼️ **Cleared in `reset()`**, so a rating tapped while the NEXT answer streams can never be filed against the
previous exchange. Wrong is worse than missing.

‼️ **A replay carries no id**, and is not meant to: the words came from an earlier request and the stored
turn keeps no id of its own. `replayed: "true"` is what makes that absence readable — and it is also why
`source_count: 0` cannot be read alone, since a replay draws no source cards by design.

**Nothing is persisted, so §0.7 was never engaged** — the id lives on the wire, in the analytics column and
in a log line. Reaching the answer TEXT from a rating remains a separate, UNBUILT decision: the stored turn
is kept WHOLE — see §13.1 — gone after `SessionTtlDays`, and member-scoped with no admin path.

**Guards, all sabotage-verified:** web `useBusinessSearch.answerId.test.js` (6, behavioural, including the
unmount path) + `BusinessSearchPage.rating.test.jsx` (9); mobile `__tests__/businessSearchAnswerId.test.ts`
(15, source scan — that repo has no renderHook); server `BusinessSearchAgentTests`
`TheMetaFrame_NamesTHISAnswer_AndADifferentOneEachTime` + `NoFrameOtherThanMeta_CarriesTheAnswerId`.

### 13.12 ‼️ A NOT-HELPFUL ANSWER IS STORED AS AN ADMIN ALERT (added 2026-09-04, owner-approved)

The answer id makes a rating JOINABLE to its question. It does not make the answer READABLE — and nobody,
including admin, could read a bad answer before this: the text lives only in the `AiSession` prompt window,
kept WHOLE (the replay window `FollowUpTurns * 2` is applied by the AGENT, not the store), gone after
`SessionTtlDays`, and member-scoped with no admin path.

**`POST business/search/feedback/not-helpful`** — same `[RequiresPermission("business.profile.read",
Business)]` as `ask`. It writes ONE `AdminAlert`.

| Decision | Why |
|---|---|
| **`AdminAlert`, not a new document family** | It already is the shape: `SystemData`, `pk = alertDate` (a MONTH bucket), free-text `title`/`description`, an `object` metadata dictionary with no cap, `isRead`/`isResolved`, an admin page with filters, and a TTL field. Nothing new to build ⇒ **no new container, no new page, no index change, no §0.7 schema item** |
| **NOT analytics** | Analytics metadata values are capped at **256 chars** and PII-scrubbed, and Parquet cannot delete one row. An answer runs to 4,000. It physically cannot hold the words, and should not |
| **NOT-HELPFUL only** | A positive rating is already counted in analytics; storing its words is a second copy of the business's own data earning nothing. There is no `helpful` flag on the DTO — the route says it |
| **Own type + `Severity.Low`** | A quality signal to read, never an incident. It must filter OUT of the triage view: `AdminAlertType.BusinessSearchAnswerNotHelpful`, and the value is in `AlertsPage.jsx`'s `ALERT_TYPES` or admin cannot filter to it |
| **Text from the SCREEN** | What the member read is the only truth about what they judged, and the stored turn may no longer hold it. Owner-approved trade-off: it also means NO `turnId` field was added, so §0.7 was never engaged |
| **`BusinessSearch:FeedbackAlertTtlDays` = 90** | Far longer than the conversation, because the point is diagnosing after the fact. A dial, mirrored in appsettings — `BusinessSearchConventionTests` fails the build on drift OR on an orphan |
| **`AlertId = bsfb_{answerId}_{membershipId}`** | Deterministic ⇒ a second tap CONFLICTS instead of duplicating, and two colleagues keep separate rows. The endpoint catches that one `InvalidOperationException` and returns 200: already recorded IS the requested outcome |
| **Its own rate bucket** (`business-search-feedback:{membershipId}`, on `Limits.QuestionsPerMinute`) | Reporting must not spend a question the member could have asked, and cannot outpace asking |
| **`IsMintedId` on the answer id** | A client-invented id would let one member mint unbounded alert rows. Renamed from `IsMintedSessionId` — same Guid "N" shape, two callers |

Three localization keys were added in **all five** languages (`Error_BusinessSearchFeedbackAnswerIdRequired`,
`…AnswerRequired`, `…AnswerTooLong`); the alert's own wording is hardcoded English, which §0.10 permits for
admin-only text.

‼️ **THE TEST TRAP THIS COST TWO RED TESTS.** `ClinqetApiFactory` **replaces `IAdminAlertRepository` with
`MockAdminAlertRepository`**, an in-memory store that **UPSERTS by AlertId and never assigns `Id`**. An HTTP
integration test therefore proves what the ENDPOINT hands over and **nothing about the engine** — the
"second create conflicts" claim passed as an overwrite and read back the SECOND answer. The engine claim is
now proved separately by constructing the REAL `AdminAlertRepository` against the fixture's `CosmosClient`
(`ADeterministicAlertId_ConflictsOnASecondCreate_AgainstRealCosmos`). **Check what the factory swapped out
before believing an integration assertion.**

**Guards:** server `BusinessSearchNotHelpfulTests` (10 unit) +
`BusinessSearchNotHelpfulIntegrationTests` (5, one against real Cosmos); web the three storage cases in
`BusinessSearchPage.rating.test.jsx`; mobile three in `businessSearchAnswerId.test.ts`. The id guard is
sabotage-verified.

---

### 13.13 ‼️ THE LANDING SENTENCE NAMES WHAT THE TOOLS CAN ACTUALLY REACH (added 2026-09-04)

`BusinessSearch.Landing.Body` was written for P1's five Group A tools and **still said so after P3 added
twelve** — the page understated itself by twelve tools while eleven new *"From your bookings / quotes /
invoices…"* answer labels shipped beside it. The same staleness sat in
`BusinessSearch.Empty.NoDocumentsBody`. Both rewritten in all five catalogues on **both** apps.

- **Two sentences, ONE key.** The role clause rides inside the same string: no new key in ten files, and no
  new entry in the key-parity suites.
- ‼️ **NEVER name a family the business may not have switched on.** Refund requests need booking pay and
  Insights is feature-gated — each already has its OWN "not set up" sentence (§8), and advertising them on
  the landing promises an answer the server will refuse. The rewritten line names neither.
- **"You see only what your role allows."** — the expectation, nothing more. The actionable half stays in
  `BusinessSearch_NoAccessToTopic` (*"Ask the business owner if you need it"*), which is where it is true;
  showing "ask the owner" to a primary owner is noise.
- **A per-role enumeration on arrival was REJECTED.** The page already holds the grants (it uses them for
  chips), but a wall of negatives before the first question is worse than one honest clause plus a refusal
  that names the topic.
- The line is drawn only while `showLanding` — it is orientation for the first question and correctly gone
  after, which is exactly why the role clause cannot be its ONLY home.

---

## 14. ‼️ P3 — THE TWELVE GROUP B WORK TOOLS (built 2026-09-03; `findings/AUDIT-P3-2026-09-03.md`)

Group A answers from the business's *material* (documents, services, offers, profile, hours). **Group B
answers from its WORK RECORDS**, and every one of them is bounded by what the asking member may see.

| Tool | Permission | Source | Notes |
|---|---|---|---|
| `list_bookings` | `booking.read` | `IBookingRepository` | cites the booking **NUMBER** |
| `list_quotes` | `quote.read` | `IQuoteRepository` | wall-clock day boundaries (`issueDate`) |
| `list_invoices` | `invoice.read` | `IInvoiceRepository` | cites `invoiceNumber ?? invoiceId` |
| `invoice_totals` | `invoice.read` | `IInvoiceService.GetSummaryAsync` + `IInvoiceRepository` | period figure and all-time figures labelled APART |
| `list_leads` | `lead.read` | `IBroadcastProviderRepository.GetInRangeAsync` | |
| `list_customers` | `customer.read` | `IBusinessCustomerRepository` | contact detail only on a **Business-scope** key |
| `inbox_summary` | `conversation.read` | `IProviderInboxService` | the VIEW is the member dimension; per-tab counts ARE the totals |
| `get_insights` | `insights.read` | `ISmartAnalyticsReadService` | feature-gated separately from the permission |
| `list_team_members` | `team.read` | `IMemberLifecycleService` | the roster the model resolves names against |
| `list_reviews` | `review.read` | `IReviewRepository` | |
| `search_call_followups` | `voice.read` | `ICallSummaryRepository.GetInRangeAsync` | the note is the assistant's OWN, said on every card |
| `search_refund_requests` | `payment.read` | `IBookingDisputeService.ListForBusinessInRangeAsync` | **MONEY** — amounts verbatim, real-engine tests |

‼️ **`payment.read` is NARROWER than it looks.** `operations_manager` holds `payment.record_offline` but not
`payment.read`; `read_only_auditor` holds `invoice.read` and no payment key. Neither can ask about refund
requests — and neither can open the Refund requests page. That IS the golden rule.

**Deliberately NOT a tool:** `get_voice_usage` — allowance data belongs to the **ai-billing** family the
owner excluded (with billing, activity and notifications) on 2026-09-02.

### 14.1 The shape every Group B tool follows — `BusinessSearchWorkToolBase`

**One tool per family**, returning the **exact total** plus a **capped sample** — never a list tool and a
count tool. Cheaper (one round trip) and strictly more truthful (the total can never disagree with the list).
This is a deliberate deviation from `PLAN` §4.2.

- `ResolveScopeAsync` → `WorkScope { Narrowing, MineMembershipId, Member, MemberNotFound, IsSolo, ScopeNote }`.
  The narrowing is pushed into **both** the Cosmos WHERE and the COUNT.
- `KeepInScope` runs `IResourceScopeEvaluator` per row, but **only when the narrowing narrows**.
- `Bound(rows, trueTotal)` caps to `WorkLists.MaxRows` and writes the SAMPLE note; `Shown(meta, built)`
  corrects `shown` after id-less rows are dropped.
- `CapPayload` bounds what ONE tool result may put in the prompt; rows drop from the **tail**, never
  truncated — a cut string hands the model a broken document.
- `StatusWord(key, language)` → the translated status word, or **null**. Never `enum.ToString()` on anything
  a provider reads.
- `Filtered(status)`, `EmptyNoteFor(scope)`, `Local(utc, range|zoneId, format)`, `Join(...)`.

### 14.2 ‼️ Dates — the model NAMES a period, the server computes it

`IBusinessSearchDateRangeResolver` (`BusinessSearchDateRangeResolver`).

- The model picks from the `BusinessSearchRelativeRange` enum (`today`, `this_week`, `last_month`, …) OR
  copies two `yyyy-MM-dd` dates. **Exactly one of the two** — both is `Ambiguous`, neither is `NothingGiven`,
  and both refuse rather than let the server rank a contradiction.
- ‼️ **One `Snake()` helper feeds the schema AND the prompt.** They drifted once (schema `thisWeek`, prompt
  `this_week`), nothing parsed, and every dated question answered "which days?".
- Resolved in the **business's** zone via `BookingTimeHelper.ResolveTimeZoneId`, cached (`bsearch:tz:`,
  `Size = 1`); a **failed** profile read is deliberately NOT cached, and `TimeZoneAssumed` rides into the
  payload.
- ‼️ **TWO boundary shapes, and picking the wrong one is an off-by-hours defect that only shows outside UTC.**
  The LOCAL DAYS `LocalFrom`/`LocalTo` for wall-clock fields (`scheduledStartDateTime`, `issueDate`,
  `invoiceDate`); `StartUtc`/`EndUtcExclusive` for genuine instants (`paidAt`, `createdAt`, SQL `CreatedAt`).
  ‼️ The `LocalStartWall`/`LocalEndWallInclusive`/`EndUtcInclusive` members were DELETED (D-18): no caller
  read them, and the tools filter on the DateOnly pair directly.
- DST: local midnight can be **invalid** (São Paulo, Santiago, Havana). The boundary is nudged in bounded
  15-minute steps rather than thrown away.

### 14.3 ‼️ "How many bookings?" … "and Gaurav's?" — the owner's own case

1. `IBusinessSearchRosterService` puts the roster (names + **ids**) in the system prompt **once**, gated on
   the member being able to narrow by person at all, capped by `Members.MaxNamesInPrompt`.
2. The model returns a membership **id**, never a name. No tool schema carries a member NAME parameter.
3. The server re-validates that id against the same roster.
4. An id not on it produces an explicit **`MemberNotFound`** refusal — **not** "nothing is assigned to you",
   which is a different and wrong answer.
5. The answer NAMES the member it resolved, so a wrong person is visible in one glance.

`IsSolo` is resolved **lazily**, before schemas, so a one-person business never sees `assignedToMemberId` —
and a knowledge question issues **no roster read at all**, the property P1.5 bought.

‼️ `TryListAsync` keeps a FAILED roster read distinct from an empty roster. Collapsing the two let the
question redactor read "no names to remove" from "I could not look".

### 14.4 ‼️ The server-side question redactor (§5.5)

`IBusinessSearchQuestionRedactor` mirrors the clients' `replaceNames` and runs in `AnalyticsController` at
the point of **PERSISTENCE**.

- ‼️ **The copy sent to the MODEL keeps the name** — that is how "Gaurav's bookings" resolves to an id. Only
  the copy stored for analytics is redacted. A strip on the way in passes the obvious test and silently
  breaks member narrowing.
- **Fails CLOSED** (`<redacted>`) when the roster cannot be read, and never caches that state.
- Runs whatever the consent switch decided: that switch chooses whether an IDENTIFIER is stored, never
  whether a NAME is removed.

### 14.5 The work source cards — approved sheet **M5**

`C:\Nik\Data\mockups\business-search-team-answers\index.html` (register row M5, `PLAN.md` §0).

- 11 new `BusinessSearchCitationKind` values; `WORK_KINDS` in the shared rules drives every rule that must
  treat them alike.
- Each work card wears a **kind label** (`kindLabelKey`) above its title, tinted work-green / call-blue /
  money-amber.
- ‼️ **The quiet line under the answer NEVER counts** (M5 §14). The cards are a sample; "From 10 of your
  records" reads as the total. `answeredFromKey` names the KIND instead, or the neutral `AnsweredFromOwnWork`
  when two kinds were cited.
- ‼️ **`recordId` is the identifier the APPS ROUTE BY**, not the primary key. Bookings and invoices route by
  NUMBER on both platforms; quotes and leads by id. `businessSearchNavigation.test.ts` pins the mobile params
  against each destination screen's source.
- The call card's "Clinket's note of the call — not the caller's words" belongs to the **SCREEN** (it renders
  in the UI language, which the answer's language need not match). The server sends the call's intent.
- `PAGED_KINDS` — only a stored FILE has a page. A stray `page` on a work card must never print "page 3".

### 14.6 Chips

`capabilityAccessState(...) === "granted"`, **not** `capabilityReadState`. The read helper answers "allowed"
when the access read FAILED — right for not locking a member out of their own screen, wrong for offering a
suggestion that will then be refused. A chip is a promise.

‼️ **The leads chip added here was RETIRED on 2026-09-04** and both work chips are now `booking.read` —
see §13.4, which also carries the Recent-lane drop, the stock-code skip and the fits-first preference.

### 14.7 Tests — where they live

| Suite | Covers |
|---|---|
| `BusinessSearchWorkToolTests` · `BusinessSearchGroupBToolTests` · `BusinessSearchMoneyToolTests` | the tools |
| `BusinessSearchToolMatrixTests` | **98** — every tool × every system role, gate 1 and gate 2 |
| `BusinessSearchRosterServiceTests` · `BusinessSearchDateRangeResolverTests` · `BusinessSearchQuestionRedactorTests` | the three services |
| `BusinessSearchConventionTests` | status keys ×5 languages, **DI registration**, endpoint gating, appsettings mirror |
| `BusinessSearchRefundRequestsIntegrationTests` | MONEY, real SQL Server |
| `BusinessSearchRangeQueryIntegrationTests` | both new Cosmos range queries, real emulator |
| `BusinessSearchQuestionRedactionEndpointTests` | the redaction call site, through the real endpoint |
| web `askKeys.test.js` · mobile `businessSearchMobileKeys.test.ts` | every key the rules can return, in all 5 files |
| mobile `businessSearchNavigation.test.ts` | every card action opens the record it names |

‼️ **Two traps this phase paid for.** (a) The shared factory ships `AnalyticsSettings:EnableAnalytics = false`
— the track endpoint 202s without doing anything, so a status-code assertion cannot tell working from
disabled. (b) `AddItemAsync` **stamps** `createdAt` with the real clock, so a window built from hard-coded
dates passes only while the wall clock happens to sit inside it. Anchor windows to the timestamps the
repository actually wrote.

---

## 15. ‼️ THE FRAME OF THE ANSWER SURFACE — approved sheet M7 (2026-09-04)

`C:\Nik\Data\mockups\business-search-ask-layout\index.html`.
**Supersedes M1 §1** on the page frame and **M4 §01b** on the *presentation* of the suggestion row — which
chips appear, in what order, and Opening hours being reserved are all unchanged, as is M5 §10.

### 15.1 The rules

- ‼️ **The screen names itself ONCE.** The dashboard bar prints every page's title from its own
  route→title switch in `Header.jsx`, whose comment already calls itself *"the page's ONLY title"*. The page
  must render **no heading of its own** — it did, and "Ask Clinket" appeared twice, one under the other.
- ‼️ **The card fills the content area** — the same white `rounded-2xl border-[#E7E7E7]` as the header bar
  and the inbox, so its border lands under the bar's. It was `mx-auto max-w-[880px]`, which left the page
  floating in grey with dead gutters while every other page ran full width. **A `max-w` belongs to the
  reading COLUMN inside the card (`mx-auto max-w-[820px]`), never to the card.**
- ‼️ **ONE ask box, docked at the bottom, in every state.** There were TWO — one above the answer and one
  below — both bound to the same `question`, so the sentence just asked showed in both and
  `BusinessSearch.Ask.FollowUpPlaceholder` was unreachable copy in all five languages. `placeholderId`,
  `surface` and `followUp` all switch on `asked`.
- ‼️ **`ask()` CLEARS `question`**, in both hooks, right after `setAsked(text)`. **The reopen and
  conversation-gone paths deliberately put it BACK** — `BusinessSearch.Error.ConversationGone` says *"The
  question is in the box — press Ask to run it again."* A clear inside `reset()` would break that silently.
  A replay leaves a half-typed follow-up alone.
- ‼️ **ONE Stop**, in the box. The progress strip keeps the step line, the source count and Jump only; its
  Stop existed solely because the box could be scrolled out of reach, and a docked box never is.
- **The landing block is bottom-anchored**, so the suggestions sit above the box they fill in:
  web `min-h-full justify-end` on the reading column (padding on THAT box, not the scroller, or `min-h-full`
  overflows by exactly the padding); mobile `scrollInnerLanding { flexGrow: 1, justifyContent: 'flex-end' }`.
- ‼️ **The suggestions and the history are TWO LANES because they do OPPOSITE things** — a suggestion
  **ASKS** and spends one of the day's questions; a recent row **REOPENS** an answer already given and
  spends nothing. Stacked and identically styled, nothing told them apart. `md:grid-cols-2` **only when both
  lanes have rows**, or the single lane sits at half width beside an empty column.
- ‼️ **A suggestion WRAPS, never truncates.** `CHIP_NAME_MAX` is 40, so a one-line chip offered
  "What's included in a Deluxe Hydra…" — a question the provider cannot read before spending one on it.
- ‼️ **A recent row is ONE line.** A question may be 500 characters; unclamped, one of them became a
  paragraph that swallowed the lane.
- **`MAX_RECENT_WEB = 4` / `MAX_RECENT_MOBILE = 3`** live in the shared rules beside the chip caps and are
  pinned across apps by the parity suite. The store keeps 8 (`recentQuestions` `MAX_KEPT`), so older ones
  roll back into view on their own. **Shown ≠ kept.**
- **No new localization key, no endpoint, no setting, no schema.** The whole change is the frame, the number
  of boxes, and one field being emptied.

### 15.2 Where the guards live

| Suite | Covers |
|---|---|
| web `BusinessSearchPage.layout.test.jsx` | 13 — one title, one box in every state, one Stop, the follow-up prompt, both lanes, no truncation, the clamp, the cap, first visit |
| web `useBusinessSearch.clearsQuestion.test.js` | 6 — the clear, and that BOTH reopen paths still restore the question |
| web `askRules.test.js` | the two cap VALUES (a screen test reads the constant and so cannot notice one changing) |
| mobile `businessSearchAskLayout.test.ts` | 10 — the same facts as a source scan; this repo has no renderHook/testing-library |
| mobile `businessSearchRulesParity.test.ts` | the caps agree across both apps |

All sabotage-verified: each defect reintroduced turns its own guard red.

### 15.3 ‼️ Two traps this cost time on

- ‼️ **A mock in a page test must be a FROZEN object.** `can` and `access` sit in the page's effect
  dependency lists, so `useBusiness: () => ({ can: () => true, … })` hands back a new identity every render
  and the roster and document reads re-fire forever — the render loop only appears once the test flushes
  effects with `await act(async () => {})`. The real provider memoizes `value` and `can`, so this is a test
  defect, never a production one. Same for `useBusinessServices`.
- ‼️ **This tree is MIXED CRLF/LF, per file.** A multi-line `perl -0pi -e 's/…\n…/…/'` pattern matches
  **nothing** on a CRLF file and exits 0, so a sabotage silently does not happen and the guard "passes" —
  proving the opposite of what was intended. Sabotage by LINE NUMBER (`sed -i '130d'`), and always append
  `or die` to a perl substitution you are relying on.
- **`yet-another-react-lightbox` and `react-markdown` ship untransformed ESM**, so a page-level render test
  must mock `AnswerImages` and `SearchAnswerMarkdown` (render the text, so nothing passes vacuously).

---

## 16. ‼️ P4 — THE PROVIDER-FACING AUDIENCE CONTROL, AND FOUR CARRIED ITEMS (built 2026-09-04; `findings/AUDIT-P4-2026-09-04.md`)

§5's rule and its enforcement shipped in P1. **§16 is the control providers actually touch.** Approved sheet
**M6** (`C:\Nik\Data\mockups\business-search-document-audience\index.html`, `PLAN` §0) governs every state,
web and phone; it **supersedes M1 §4** on the role chips.

### 16.1 Where it lives

| Concern | Web (`clinqetwebpartnerapp`) | Mobile (`clinqetmobilepartnerapp`) |
|---|---|---|
| The box | `src/components/Profile/knowledge/TeamSearchAudienceBox.jsx` | inline in `src/Screen/ProfileFlow/Knowledge/index.tsx` + `style.ts` |
| The document-row mark | `KnowledgePage.jsx` (`AUDIENCE_MARK`) | `Knowledge/index.tsx` |
| Shared rules (twins) | `src/lib/knowledge/searchAudience.js` | `src/lib/knowledge/searchAudience.ts` |
| The write | `src/services/knowledgeServices.js` → `PATCH knowledge/documents/{docId}/audience` | `src/apiManager/…` + `knowledgeService.ts` |
| Copy | `public/lang/{en-US,es-US,fr-CA,gu-IN,hi-IN}.json` (ICU) | `src/Locales/*.json` (i18next `_one`/`_other`) |

**Twin exports** (import-free, compared by an export-surface parity suite that SKIPS loudly — §0.17):
`KNOWLEDGE_AUDIENCE`, `audienceMode`, `audienceRoleKeys`, `audienceMark`, `audienceBoxVisible`,
`audienceControlState`, `audienceRoleChoices`, `toggleAudienceRole`.

### 16.2 ‼️ THE FIVE RULES OF THIS CONTROL — every one paid for by a real defect

1. ‼️ **EVERY TAP IS SENT. Never skip the write because the tap matches the OPEN DOCUMENT.** That document is
   a snapshot, and the list only refreshes while something is processing — so on a settled page it can be as
   old as the last navigation. A provider confirming a stale "Only certain roles" became a **silent no-op**
   and the file stayed team-wide. The **server** compares against the current row and costs no write when it
   matches; that is the only safe place for the comparison. `sameAudience` was **deleted** from both twins —
   do not reintroduce it.
2. ‼️ **RECONCILE FROM THE SERVER AFTER EVERY WRITE — success AND failure.** A write that commits but whose
   response is lost (timeout, backgrounded app) otherwise reverts the screen **permanently**, and an
   in-flight poll landing after the write reverts the row mark. Both apps re-read; both toast on failure.
3. ‼️ **NO CLIENT MAY NAME A ROLE KEY THE SERVER OWNS.** Both twins used to hardcode
   `["primary_owner","administrator"]` to decide which roles to leave out of the picker, and §0.17 forbids the
   client test from reading `TenancyRoleCatalogDefinition` — so a rename could never be caught, and the
   failure direction is the bad one (offer the role, let the provider untick it, state a restriction the
   server does not enforce). The server now derives **`BusinessRoleAssignmentDto.AlwaysHasFullAccess`** from
   the catalogue, exactly as `Access` is derived; `audienceRoleChoices` filters on that flag plus
   `isPrimaryOwnerRole`. A test proves a FUTURE always-finds role is excluded **without being told its key**.
4. ‼️ **NEVER PRINT A ROLE KEY.** `namesOf` **drops** an unknown key rather than falling back to it, no name
   is drawn until the catalogue is ready, and the roles are fetched whenever a name is about to be drawn —
   **including the read-only summary**, which used to fetch nothing and rendered `finance, operations_manager`
   to a Gujarati-speaking provider.
5. ‼️ **"Just you" is read by someone who is not you.** A member who may look but not change read
   *"Found by just you"* about a file **they cannot find at all**. All ten catalogues name **the owner and
   administrators**. And a business that **shrank** to one person still holds its restriction — so
   `audienceBoxVisible` keeps the box (and the row mark) whenever a file is restricted, even solo. Hiding it
   hid the only control that could clear it.

### 16.3 The states, and where each state's words come from

`audienceControlState(...)` returns exactly one of: `hidden` · `loading` (ghost chips — **no words**, so
nothing below jumps when the roles arrive) · `rolesFailed` · `readonly` · `saving` · `offline` ·
`processing` (‼️ **changeable**, like the receptionist choice since 2026-09-07) · `deleting` · `ready`.

- ‼️ **`accessKnown` defaults to `false`.** As a defaulted-true prop it made the `loading` branch dead and the
  box asserted a **refusal** to owners. (`CapabilityGate` unmounts the page while access is unknown, so no
  provider saw it — fixed anyway: a defaulted-true authorization prop is a landmine for the first caller
  outside a gate.)
- The line naming who can find the file is **withheld until the roles are known** — with none loaded, "no
  role picked" is not yet a fact about the file.
- Every state's words are registered in sheet M6 §6. **Server sentence or screen copy key — never a sentence
  the screen re-invents**, or it drifts out of translation.

### 16.4 Accessibility and design — what the audit had to fix

- Web is a real **`radiogroup` / `radio` with `aria-checked`**; the chips are **`checkbox`**. Two unrelated
  `aria-pressed` buttons is not this control.
- A **`role="status" aria-live="polite"`** region (web) / **`accessibilityLiveRegion`** (mobile) announces
  every save outcome — without it a failed write silently reverted the choice for a screen-reader user.
- The row mark's `aria-label` is **the setting, then the action** — an `aria-label` that names only the action
  **overrides the mark's own text** and the count is never heard.
- The mobile picker needs all three of: a **responder guard** (`onStartShouldSetResponder`, or a tap on its
  own title dismisses it mid-selection), a **`ScrollView`** (8 rows fit a 360×640 screen by 2–20 px — a 9th
  role, OS font scaling or a 3-line hint pushes rows off the edge, and RN's `flexShrink: 0` lays them out
  past it rather than clipping), and **in-sheet feedback** (its banners live behind the modal).
- The mobile details editor needs `editorCardBounded` + a `ScrollView`, or the box's height pushes **Save
  off-screen**.
- **`knowledge-*` tokens only.** The first build invented a fourth error red two lines from the token it
  already used in the same file.
- Choosing "Everyone" clears the list, so the dialog remembers `lastPicked` and restores it — two taps used
  to destroy the provider's roles with no undo.

### 16.5 The write's contract

`KnowledgeSearchAudienceDto`:

```
Audience : KnowledgeSearchAudience?   [Required]      ‼️ NULLABLE ON PURPOSE
RoleKeys : List<string>?              [MaxLength(32)]
```

‼️ **As a plain enum it defaulted to `Team` (= 0)**, so a body that simply omitted the field returned **200**
and made the document findable by the **whole team** — the one direction this control must never move by
accident. Nullable + `[Required]` makes it a refusal. The cap matches what the service stores, so a client
sending more is refused rather than told 200 while the server quietly kept less than the provider chose.

`KnowledgeDocumentDto` returns `SearchAudience` + `SearchAudienceRoleKeys` (wire only — the entity fields
shipped in P1).

### 16.6 ‼️ The converter is GONE — the rule owns the parse (P4.5, 2026-09-04)

**Closed.** See §5 for the shipped rule. In short: `KnowledgeSearchAudienceConverter` disagreed with the sweep
in the one case it existed for, and its parse destroyed a future value on round trip. The entity now carries
the row's own **string**, `KnowledgeSearchAudienceRule.Decide` interprets it once for both read paths, and the
converter file is deleted. **No new Cosmos field and no migration** — the alternative `searchAudienceRaw`
field was rejected precisely because it stores the fact twice and leaves both parsers in place.

Proven on the real emulator (`KnowledgeSearchAudienceCosmosIntegrationTests`, 10 green):
- a word this build does not know **survives a read-and-write untouched** — the test that used to yield "Roles";
- the **sweep and the point-read return the same answer** for that word even when the row names a role the
  asking member holds — the divergence, proven closed.
Plus a convention test that every `KnowledgeSearchAudience` member is explicitly handled, so a third member
fails the build instead of silently falling into the fail-closed branch.

### 16.7 The four carried items P4 also shipped (C1–C4)

| # | What | Where |
|---|---|---|
| **C1** | The multi-script SEARCH WORDS block moved from the system message to the **user** turn | `BusinessSearchAgent.ScriptRules(scripts)`. ‼️ **Re-measured — 800 live calls, A 150/150, B 650/650** (`findings/MEASUREMENTS-P4-2026-09-04.md`). ‼️ **Not finished:** `search_knowledge`'s `searchWords` **description** still varies with `scripts.IsSingleLeg`, and the tool array is part of the cached prefix. Re-wording it needs a re-measurement — that field measured **3/25** before P1.5's fix |
| **C2** | The refund card shows the customer's own reason | `BusinessSearchCitationDto.Reason` → `SearchRefundRequestsTool` → **both** SourceCards, kind-gated on `RefundRequest` |
| **C3** | Four card subtitles match sheet M5, each its own parameterized key in all five backend catalogues | message · review · Insights. ‼️ **The customer card deliberately ships `"Added {0}"`** — `BusinessCustomer` carries no booking count and the Customers page shows none, so M5's "4 bookings · last on 2 Sep" would cost one query per card for a figure the provider cannot check. **Owner-confirmed 2026-09-04** |
| **C4** | The refund amount matches the page's shape | ‼️ **SUPERSEDED BY §17.2.** P4 wrote it as `GetCurrencySymbol` + `ToMajor(...).ToString("N" + exponent)` and deliberately left `ToMajorString` alone. P4.5 made `CurrencyMinorUnit.Format(minor, currency, culture)` the platform's ONE renderer: the tool calls that, `ToMajorString` now REQUIRES a culture, and `ICurrencyService.GetCurrencySymbol(string)` is **deleted** |

### 16.8 ‼️ MONEY AND DATES — three traps in the work tools

- ‼️ **CLOSED IN P4.5 — THE ROW'S OWN CURRENCY NOW WINS.** `GetCurrencySymbolAsync(businessId, currencyCode)`
  used to resolve the business's PRIMARY ADDRESS first and treat the code as a mere fallback, so it answered
  **"₹" for a CAD row**. ‼️ **That was LIVE, not theoretical** — business `LXDP8G` sits in India (Gujarat) and
  holds a CAD invoice and a CAD booking, so the invoice e-mail, the booking e-mail and the receipt each put ₹
  in front of a Canadian-dollar total. P4 told the reader to route around it with the pure
  `GetCurrencySymbol(currencyCode)`; that method had exactly ONE production caller (this tool), P4.5 deleted
  it, and the PRECEDENCE is fixed in the service instead — so there is nothing left to route around, and a row
  that states its currency now costs no address lookup at all. Sabotage-proven: reversing the order fails
  `TheRowsOwnCurrencyBeatsTheBusinessCountry` and `WhenTheRowStatesItsCurrency_TheBusinessIsNeverResolved`.
- ‼️ **`InboxSummaryTool` must derive the wait start from `SlaDueAt − SlaTargetHours`**, never from
  `LastMessageAt` — every later message bumps that (a System notice, the customer chasing), so every wait was
  reported as **shorter than it was**, in the flattering direction.
- **A date in a row and the date on the card beside it must use the same zone.** `ListReviewsTool` printed
  UTC in the row and the card was zoned: one review, two dates.
- **`CapPayload(body, "rows")` was dead code** until P4 wired the refund tool. ‼️ **Every other Group B tool
  still serializes uncapped** — ten rows at the row-text limit plus notes can exceed `ToolResultMaxChars` and
  silently eat a third of the answer's budget.

### 16.9 ‼️ REACT 19 — `defaultProps` ON A FUNCTION COMPONENT IS SILENTLY DEAD

The owner had to fix three live instances by hand on 2026-09-04 (it was breaking the partner web). Defaults
belong in the **destructuring parameter list**. A repo-wide convention guard now fails on any `defaultProps`
assignment, on **both** apps, so the class is closed rather than those three instances. ‼️ And assert a
default **at the call site**, through the real `IntlProvider` with the real `en-US.json` — a test in the file
that declares the default cannot see that React ignores it.

### 16.10 Tests — and the sabotage that PASSED

| Suite | Covers |
|---|---|
| `Clinqet.API.UnitTests/Services/BusinessSearch/BusinessSearchCardSubtitleTests.cs` | C3, via a templates-carrying localization fake |
| `…/KnowledgeAudienceDtoValidationTests.cs` | The DTO's refusals, via `Validator.TryValidateObject` |
| `Clinqet.API.IntegrationTests/Tests/KnowledgeSearchAudienceCosmosIntegrationTests.cs` | 8 tests on the real emulator, incl. a raw `PatchOperation.Set("/searchAudience", "SomethingAFutureBuildAdded")` **fail-closed** proof |
| web | `searchAudience.test.js`, `teamSearchAudience.test.jsx`, `sourceCardReason.test.jsx`, `knowledgeGuards.test.js` |
| mobile | `knowledgeSearchAudience.test.ts`, `knowledgeSearchAudienceParity.test.ts`, `knowledgeAudienceScreen.test.ts`, `sourceCardReasonParity.test.ts`, `defaultPropsAreDeadUnderReact19.test.ts` |

‼️ **The most useful result of the phase was a sabotage that PASSED.** An **integration** test asserting that
omitting `audience` returns 400 stayed green **with both validation attributes deleted** — the 400 was coming
from the **tenancy pipeline**. The suite was **deleted**, not patched.

> **A test that asserts a STATUS CODE is asserting the whole pipeline.** If the thing you are pinning is one
> layer of it, drive that layer directly — or your green means "something refused this", which is not what
> you wrote down.

Three more test shapes that could never fail, all replaced:

- **A count is not an identity.** `expect(canManageCount).toBe(4)` survives deleting the call site you care
  about and adding one elsewhere — while every owner sees the box read-only.
- **A `not.toContain` of a spelling that appears nowhere** in the file under test (the web twin's shape, in a
  mobile test) passes for free.
- **A parity suite that lists rules by hand** cannot see a rule added to only one twin — compare the two
  **export surfaces**, read from source.


---

## 17. ‼️ P4.5 — THE CLOSE-OUT FIX PHASE (2026-09-04; `findings/AUDIT-P4.5-2026-09-04.md`)

P4's audit found defects in code no phase had touched. P5 is an audit, so they were fixed here.

### 17.1 ‼️ A DUPLICATE UPLOAD KEPT ONLY THE FILENAME — the provider's other choices were destroyed

When an uploaded file's bytes match an existing `Ready` document, `KnowledgeIngestProcessorFunction`
folds it onto that document (X9) and deletes the incoming row. It used to copy **`DocName` alone**, so the
type, the linked offerings, the audience pair **and the "don't send this to callers" switch the provider had
just set** were discarded in silence — a file they had marked private stayed sendable.

**RULING 3 (owner, 2026-09-04): THE NEWEST EXPLICIT CHOICES WIN.** `ApplyProviderChoices` now carries
`docName`, `docType`, `linkedServiceIds`, `receptionistAccess` (2026-09-07; the NARROWER word wins, `KnowledgeReceptionistRule.Tighter`) **and `searchAudience` +
`searchAudienceRoleKeys` — that pair is AUTHORIZATION, so a tightening made seconds ago must never be lost.
The survivor keeps its own `docId`, partition key and already-indexed bodies (identical bytes).

- ‼️ **The merge is never silent, and it earns NO notification.** The survivor carries
  `Info_KnowledgeDuplicateSettingsApplied` (all five backend catalogues), which **both apps already render on
  a Ready row** — no new `NotificationType`, no `SignalRSettings` entry, no app change.
- ‼️ **A merge that cannot commit DESTROYS NOTHING: it throws.** The incoming row keeps its Processing status,
  its blob and every choice, so a redelivery merges correctly; the outer handler already fails the row and
  raises the admin alert on the final delivery. Purging on a failed merge was the data loss.
- ‼️ **The type and the offerings ride a CARD HEADER**, so a header that no longer fits sends the survivor back
  through the `MetadataOnly` lane, which re-cuts. `linkedServiceIds` **on the card** is what
  `search_knowledge` narrows by, so a link the row claims and the cards do not carry simply would not work.
- New seam `IKnowledgeIngestQueue` owns the ingest lane and message id, so the API's confirm/reprocess paths
  and the worker's own follow-up posts cannot drift apart. Registered in the Functions host only.

### 17.2 ‼️ MONEY — ONE definition, and the reader's own grouping

- ‼️ **THE SYMBOL FOLLOWS THE CURRENCY, THE GROUPING FOLLOWS THE READER.** `CurrencyMinorUnit.Format(minor,
  currency, culture)` = `Symbol(currency)` + `ToMajor(...).ToString("N" + Exponent(currency), culture)`.
  A rupee amount is ₹ to everyone; ₹5,31,000.00 to a Hindi reader and ₹531,000.00 to an English one.
  ‼️ **.NET's own `"C"` format is FORBIDDEN here** — it takes the symbol from the CULTURE, so it renders ₹ in
  front of a dollar figure for a Hindi reader.
- ‼️ **MEASURED byte-identical to the apps' `Intl.NumberFormat` in 30/30 cases**, including fr-CA's U+00A0
  group separator. That equality is what lets a card and its page agree character for character.
- ‼️ **`LanguageCulture.Resolve` maps the five product languages to the locales the apps' own copy files are
  named after** (en-US, es-US, fr-CA, gu-IN, hi-IN). The NEUTRAL cultures are a different place — "es" is
  European Spanish (1.234.567,89) where the Spanish app renders 1,234,567.89.
- ‼️ **`LanguageCulture` FEEDS DATES TOO, and two of the five DID change** — the first note here claimed
  "no date changes" and that was false. Re-measured: a **long date** (`"D"`, every calendar day and billing
  boundary) is byte-identical in all five; a **time** (`"f"`, every appointment in every e-mail) changed for
  **es** (es-US is a 12-hour clock where neutral es is 24-hour) and **fr** (fr-CA writes `15 h 07` where
  neutral fr writes `15:07`). Both are the right convention for a US-Spanish, Canadian-French product, so
  they are a DECISION — pinned by `LanguageCultureTests` so neither half can move unnoticed again.
- ‼️ **MONEY IS FORMATTED PER RECIPIENT, exactly as dates already are.** `BillingNotification` gained
  `MoneyFields`, rendered in `RenderMoney` beside `RenderDates` — a producer runs once, before recipients
  are resolved, so an amount formatted there carries one reader's conventions to everybody. **Admin alerts
  keep `CultureInfo.InvariantCulture`**: §3.6 says operator wording is English.
- **The exponent list is ONE list.** `CurrencyMinorUnit.Exponent` is exhaustive over `CurrencyCode`'s twenty
  members, of which exactly **JPY and KRW** are zero-decimal. The partner web app's own list had **seven**
  entries, two of them wrong (HUF and TWD are not zero-decimal). It now has one client twin per partner app
  (`src/utils/currencyMinorUnit.js`, `src/Util/currencyMinorUnit.ts`), asserted against the backend by a
  cross-repo convention test that **SKIPS LOUDLY** when the peer is absent (proven: 1 skipped, 0 failed).
- ‼️ **TWELVE MORE PROVIDER SCREENS STILL DERIVED THE SYMBOL FROM THE READER**, found after the first five
  surfaces were fixed and the money work was called done. `Intl`'s `style: "currency"` renders `CA$` in
  English, `$CA` in French and `US$` in Gujarati for one CAD amount. **Web (7)**: the inbox row, the leads
  list, the lead detail, the public booking-tracking page, Insights, and `BookingsDetails`' payment + payout
  amounts. **Mobile (5)**: chat bid amounts, booking details, both broadcast screens, Insights. **Two of the
  twelve ALSO divided by 100 unconditionally** (`BookingsDetails.jsx`, mobile `bookingDetails.tsx`) — the
  same zero-decimal defect that made a ¥5,000 refund read ¥50. All twelve now go through the twins, and a new
  `formatMajor(intl, amount, code, { maximumFractionDigits })` sits beside `formatMinor` in both twins for
  amounts already in major units; `maximumFractionDigits` overrides the currency's decimal places where a
  screen deliberately rounds (Insights) but NEVER which symbol is written. ‼️ **NOT ONE of the twelve had a
  test pinning the string it rendered** — 2,886 web tests and 3,801 mobile tests all passed with the defect
  live — so the fix is a CLASS guard, not twelve assertions but one scan of each repo's OWN source (§0.17):
  `clinqetwebpartnerapp/src/utils/moneyFormattingConvention.test.js` and
  `clinqetmobilepartnerapp/__tests__/moneyFormattingConvention.test.ts` fail on any `style: "currency"` in
  code, ignoring comments, and each asserts the scan actually read files so an empty scan cannot pass.
  Sabotage-proven: reintroducing one names the exact file and line. ‼️ **The chat bid's existing rule
  STANDS** — with no currency on the payload, format the number ALONE and never invent whose money it is.
  ‼️ **P4.6 CORRECTED THE MECHANISM THIS SENTENCE USED TO CITE.** It said "`currencySymbol` defaults to `$`,
  so it must not be reached"; that is **no longer true and was itself the defect**. An EMPTY code now yields
  `""` in both twins — no currency stated ⇒ no symbol — because the currency rides a capability-gated read
  that four of the ten roles never make, so `$` was not a fail-safe, it was a claim of US dollars over an
  Indian provider's rupees. A code that is present but UNRECOGNISED still yields `$`. See §18.
- ‼️ **AND THE SYMBOL NEVER COMES FROM THE READER'S ADDRESS EITHER.** `ICurrencyService` used to resolve the
  BUSINESS first and treat the row's currency as a fallback, which is the same defect wearing the country's
  clothes: a CAD invoice held by an Indian business printed **₹**. Live-confirmed on `LXDP8G` and fixed at the
  precedence — a row that states its currency is answered from the shared table with no address lookup at all.
  See §16.8. ‼️ **P4.6 MOVED THE COUNT AND THE EXCEPTION.** It is now **10 call sites, and EVERY ONE passes a
  row currency** — the two aggregates this note called out as passing none moved to `GetCurrencyCodeAsync`,
  which is the one resolution `GetCurrencySymbolAsync` now derives from. See §18.1.
- ‼️ **PDFs stay ENGLISH** (`QuestPdfService.DocumentLanguage = "en"`, a deliberate decision) — they use the
  same formatter with the English culture.

### 17.3 The rest of P4.5, in one line each

| # | What | Where |
|---|---|---|
| §4.1 | A timed-out audience read was reported as FAILED and the retrieval's timeout alarm never fired — the sweep is the slowest read on the path | `ProviderKnowledgeSearchService.Provider.cs`: the inner catch now exempts `OperationCanceledException` and lets the outer handler tell a timeout from a caller hanging up |
| §4.2 | `list_customers` read the WHOLE customer partition and filtered `nameContains` in memory | `IBusinessCustomerRepository.SearchCustomersByNameAsync` — partition-scoped, three `CONTAINS` clauses (either field, or spanning the space). ‼️ **No index change is owed: Cosmos cannot serve `CONTAINS` from an index whatever paths are included** — the win is 900 documents not crossing the wire |
| §4.3 | `CapPayload` was wired to ONE Group B tool of seventeen | Nine more capped; a convention test now requires every `ModelPayload` to come from a bounded writer, with two fixed-shape summaries named as exemptions |
| §4.4 | The dead `_ = excluded;` withheld counter | **RULING 6: surfaced** as an operator log line naming the business and the count |
| §4.5 | `businessRoleCatalogParity.test.js` read a peer repo at describe scope — `describe.skip` still runs its callback, so CI got ENOENT | Every peer read moved inside an `it()`. **Proven: 10 skipped, 0 failed with the peer absent** |
| §4.6 | The API declared 2 of the `Voice:Knowledge:Images` keys while the shared parser reads 4 | Three added (`MaxSectionsPerImage`, `MaxSourceImageBytes`, `MaxTotalMediaBytes`). ‼️ **Behaviour is identical today — this is tuning drift, not a bug.** A cross-repo config guard skips loudly. ‼️ **`MaxImagesPerDocument` 15 vs 40 is NOT drift**: two settings, two sections, two features |
| §4.7 | The tool-registration test's service registry was hand-kept and already short | Enumerated from the tool CONSTRUCTORS. ‼️ It must also scan `clinqetinfrastructure/Configuration/*Registration.cs` — a host registers through shared extension methods, and `Program.cs` alone reports real registrations missing |
| §4.8 | `ICurrencyService.GetCurrencySymbolAsync` took no `CancellationToken` | Added and threaded; its catch stopped logging a cancellation as a resolution error |
| §5.1 | **O9 MEASURED at last** — see `findings/MEASUREMENTS-P4.5-2026-09-04.md`. The index missed nothing Cosmos found (0/160) while Cosmos missed 34; latency is a wash; RU moves to flat-rate. ‼️ **The dial was NOT flipped** (ruling 7) | |
| §5.2 | The `searchWords` schema varied with the question's alphabet, so the cached prefix missed | Ordered by `TextScriptDetector.KnownScripts`, not plan order. **Re-measured 75/75 against a 25/25 bar** |
| §6.2 | Mobile shipped the WEB-length helper sentence | `KNOWLEDGE.AUDIENCE.HELPER_PHONE` in all five mobile catalogues, and **registered in sheet M6 §6** |
| §6.3 | Both document-row marks were ~35 px against a 44 px guideline | `hitSlop` 11 top/bottom on **both**, guarded — fixing one alone breaks the row's parity |
| §6.4 | `get_business_profile` returned more than `AUTHORIZATION-DESIGN` C5 listed; T7 claimed every turn re-authorizes | **RULING 4: the DOC was amended**, not the tool. T7's wording now states that the member's own prose is replayed and not re-authorized, and that `AuthorizationVersion` was costed and NOT built |

### 17.4 ‼️ Two traps this phase paid for twice

- ‼️ **A SABOTAGE THAT EDITS THE FIRST MATCH IS NOT A SABOTAGE.** `throw new InvalidOperationException(`
  appears three times in the ingest function; a text replace hit line 891 while the code under test is at
  2415, the test stayed green, and it read as a vacuous test. **Sabotage by LINE NUMBER**, and confirm the
  build is clean — a sabotage that breaks the build tests a stale DLL.
- ‼️ **The Search ALIAS 404s on api-version `2024-07-01`; the PHYSICAL name works on either.**
  `clinket-dev` is not queryable there, `clinket-dev-v1` is. An all-zero result set looks exactly like an
  empty index unless the response body is read.

## 18. ‼️ P4.6 — MONEY, EVERYWHERE ELSE (2026-09-05; `findings/AUDIT-P4.6-2026-09-05.md`)

P4.5 made the money rule true on the notification path, Billing and twelve screens. An independent sweep then
proved it was still false on ~250 more sites. This phase closed them — and found they were all symptoms of one
decision.

### 18.1 ‼️ THE ROOT: THE SERVER SHIPPED A GLYPH AND THREW THE CODE AWAY

`CurrencyService` resolved `ResolveByBusinessIdAsync(...).CurrencyCode` and returned **only**
`CurrencyMinorUnit.Symbol(resolved)`. `DashboardStatisticsDto`/`EarningsGraphResponseDto` carried
`CurrencySymbol` and no code. **`grep -rn currencyCode src/` over the whole provider mobile app returned ZERO
hits outside a comment.**

‼️ **A symbol cannot be turned back into a currency**, so every form, create screen and aggregate *could not*
apply the rule — only concatenate a glyph onto a number. ~60 of the ~250 sites were blocked on this alone.

- **`ICurrencyService.GetCurrencyCodeAsync(businessId, currencyCode?, ct)` is the ONE resolution**, and
  `GetCurrencySymbolAsync` **derives** from it (`Symbol(await GetCurrencyCodeAsync(...))`). A second answer is
  now structurally impossible. The row's-currency-wins precedence of §16.8 is unchanged and still lives here.
- **Both dashboard DTOs ship `Currency` (an ISO code); `CurrencySymbol` is DELETED.** Keeping both would have
  been the two-sources-of-truth this whole programme removes. `ProviderInsightsDto.Currency` was already the
  precedent ("provider's primary listing currency (client formatting)").
- **Both apps hold the CODE**: web `useBusinessCurrency()` (`src/utils/businessCurrency.js`, Redux
  `currency.code`); mobile `useCurrencyContext().currencyCode`. The glyph is derived by the twin.

### 18.2 ‼️ BOTH SECOND RENDERERS ARE DELETED

- **`clinqetmobilepartnerapp/src/Util/currency.tsx` — GONE.** It formatted through `getActiveLocale()`, which
  is REGION-aware and defaults to India, so an English reader saw `5,31,000.00` where the backend, the web app
  and an Ask Clinket answer all said `531,000.00`. `bookingDetails.tsx` imported BOTH renderers — one screen,
  one currency, two strings. Non-money numbers moved to the new `src/Util/formatNumber.ts`, which shares the
  twin's product locale and **never** writes a symbol.
- **`clinqetwebpartnerapp/src/utils/currency.jsx` — GONE.** Its `formatPrice` pinned two decimals and took the
  symbol from the BUSINESS.
- ‼️ **Deleting them is what makes a missed call site a BUILD ERROR** rather than a silent `undefined`. That is
  the reason to delete rather than deprecate.

### 18.3 ‼️ THE PRECEDENCE, WRITTEN ONCE

```
row.currency || businessCurrency        // web  : formatMajor(intl, amount, code)
row?.price?.currency || currencyCode    // phone: formatMajor(amount, code)
```

**A row that states its own currency WINS.** The business currency is the correct answer in exactly two cases,
and both are deliberate, not fallbacks: **a FORM creating a new row** (the server stamps that row with exactly
`ResolvePrimaryCurrency`, so it is a prediction), and **a row whose entity carries no currency at all** (an
`Offer` has none — it inherits the booking's or quote's).

‼️ **Live proof the distinction matters:** `MEE3IC` (Canada) holds **39 services split across CAD and USD**;
`D7OZWY` (India) holds **INR and USD**; `LXDP8G` (India) holds a **CAD** invoice and a **CAD** booking. No
single business symbol can be right for two rows on one list.

‼️ **AND A ROW'S CURRENCY IS IMMUTABLE AFTER CREATION — the UPDATE path no longer re-resolves it.**
`BookingController` (draft + full update) and `QuoteController` used to call `ResolvePrimaryCurrency` on every
save, relabelling a **1000 CAD** booking as **1000 INR** at an India business with the amounts untouched.
Use `profile.ResolveStoredCurrency(settings, existing.Price?.Currency)` — the business answers only for a row
carrying no currency at all. **CREATION still stamps from the primary address; that part was always right.**

- ‼️ **The platform had already ruled this way and the two contracts contradicted each other.**
  `UpdateBusinessAddresses_PrimaryCountryCurrencyChanges_ReStampsServicesButNotBookings` moves a business
  US→Canada and asserts the services become CAD **while the booking stays USD**. Editing that same booking did
  the opposite. Both were green. The catalogue re-labels (`ServiceController` + `RestampServicesCurrencyAsync`,
  deliberate, unchanged); **transaction rows do not.**
- ‼️ **There is NO reliable "the customer has seen this" marker, which is the whole argument.** For bookings the
  closest is `Status != Draft`; **for quotes there is nothing at all** — no status, no flag, no timestamp, and
  `SendQuote` writes nothing back to the row. `UpdateBooking` blocks only Cancelled and Completed, so it fired
  on Confirmed and InProgress; `UpdateQuote` has no status guard and rebuilds `Price` unconditionally.
  **If you cannot tell whether the customer agreed to it, you must never relabel it.**
- ‼️ **THE UI IS A CO-REQUISITE, NOT A FOLLOW-UP.** `AddBookingForm.jsx` and `AddQuotesForm.jsx` are the EDIT
  drawers as well as the create forms and denominated everything in the business's currency. Backend alone
  would have shown a provider ₹ while saving CAD — turning a ~98% undercharge into a ~60x overcharge. Both now
  hold `savedPriceCurrency || businessCurrency`, seeded from `information?.price?.currency` on load, and pass
  it to `BookingCostSummary`, `ServiceFormItem` and `ExtraChargesSection`. **Mobile already did this**
  (`AddBookingScreen.tsx`, `useQuoteLoader.ts`) — web was catching up to mobile, not the reverse.

### 18.4 ‼️ MONEY IN MORE THAN ONE CURRENCY IS NEVER ADDED UP — sheet M8

Four surfaces summed across currencies. **Live: `LXDP8G`'s dashboard read `233510.1`, which is ₹208,511.10 and
C$24,999.00 added together.** `InvoiceRepository`'s four money queries now group by `c.currency`; the services
split that into the business's own money (the headline) plus `CurrencyAmountDto[]` for the rest, and both apps
render approved sheet **M8**.

- ‼️ **Measured cost: +0.15 / +0.10 / +0.02 RU.** Same documents, same index, same partition — only the result
  payload grows. **No index change is owed**: `c.currency` appears only in the SELECT and the GROUP BY, and
  Cosmos computes GROUP BY *after* the filter, so it binds no index path. §0.7 was never triggered.
- ‼️ **A business with ONE currency sees exactly what it saw before** — every added element is behind
  `otherCurrencies.length > 0`, and four tests per app pin that.
- `Count` still means every invoice in a status whatever its currency; `PrimaryCurrencyCount` is how many are
  in the headline currency.
- The client had the same defect: mobile `src/Util/invoiceDue.ts` summed `totalAmount` across rows with zero
  currency awareness. Fixed the same way.

### 18.5 ‼️ AN OPTIONAL PARAMETER THAT DEFAULTS A CURRENCY IS THE SAME DEFECT AS A SECOND SYMBOL TABLE

This phase's own fix pass introduced it **twice**, and the second one was live: `InvoiceLineDiscountFormatter`
gained `string? currencyCode = null` and **all three production callers omitted it**, so every line-discount
caption silently used USD's exponent — a ¥5,000 discount would have printed `¥5,000.00`.

‼️ **A currency parameter is REQUIRED, never optional**, and prefer the `CurrencyCode` enum over a string so
the caller must have parsed it. The same pass also referenced **thirteen localization keys that did not
exist** — a provider would have read `Error_OfferNotStarted` as a sentence. **Check the seam between two
agents' files; neither one owns it.**

### 18.6 The helpers, complete

```csharp
CurrencyMinorUnit.Parse(string?)                      // ONE parse; unknown/absent => USD. ‼️ Enum.TryParse
                                                       // ALONE IS NOT ENOUGH — CurrencyCode is int-backed, so
                                                       // "7" parses to CNY and "25" to an undefined member.
                                                       // Parse adds Enum.IsDefined. CartController took a
                                                       // client query string and had neither.
                 .TryParse(string?, out code)          // ‼️ THE SAME parse, WITHOUT the USD fallback — for a
                                                       // caller that can print the number ALONE and must tell
                                                       // "unknown" from "USD". Parse delegates to it, so there
                                                       // is still ONE definition. A caller that inlines
                                                       // Enum.TryParse instead is re-creating the "7" => CNY bug.
                 .Exponent(code) / .Symbol(code)
                 .Format(long minor, code, culture)     // ‼️ NO SYMBOL-TAKING OVERLOAD, AND NEVER AGAIN — see 18.9
                 .FormatMajor(decimal major, code, culture)   // most Cosmos money
                 .ToMajorString(long minor, code, culture)              // grouped amount ALONE
                 .FormatMajorNoSymbol(decimal major, code, culture)     // NOT an overload of the above:
                                                                        // an int arg would bind to the minor
                                                                        // one and render 100x too small
CurrencyTotals.Split(rows, businessCurrency)          // headline + the other currencies
```

Reader culture is `LanguageCulture.Resolve(language)` — **never `CultureInfo.CurrentCulture`**, which on a
Service Bus worker thread is whatever the host happens to be. Admin alerts keep `InvariantCulture`.
**PDFs stay ENGLISH** (`QuestPdfService.DocumentLanguage = "en"`); passing the English culture restores the
grouping and the exponent and is **not** a localization change.

### 18.7 The guards — four scans, each with an exemption registry, each sabotage-proven

| Guard | Repo | Catches |
|---|---|---|
| `Conventions/MoneyNeverFormattedFromTheReadersCultureTests` | API | `ToString("C")`/`{0:C}` **and** any money-shaped `:N2`/`F2` — across the API repo **and** the shared LIBRARIES it compiles in (never a peer host, §0.15) |
| `Conventions/MoneyFormatConventionTests` | Functions | the same two rules over its own source |
| `src/utils/moneyFormattingConvention.test.js` | web | `style:"currency"` · an import of the deleted renderer · `{currencySymbol}{amount}` · money via `toFixed` |
| `__tests__/moneyFormattingConvention.test.ts` | mobile | the same four, **plus** that `Util/currency.tsx` does not exist, plus the region-aware locale |

The scan is deliberately tight: a numeric format is money-shaped only when the line also carries a currency
symbol token **or** the formatted identifier reads as money. Over 1,794 files it returns **only** the
registered exemptions — the OData filter builders (a grouped number is not valid OData), the AI prompt, the
signature hash, and two percentages.

‼️ **Every registry row must MATCH something.** The API guard asserts no exemption is stale — and caught a
redundant row **in its own registry on its first run**. A row that suppresses nothing has stopped describing
the code and is exactly how the next defect in that file hides.
‼️ **Sabotage by editing the RIGHT line, and confirm the build is clean first** — a sabotage that does not
compile tests a stale DLL and "passes".

### 18.8 ‼️ NARROWING A DTO FIELD BREAKS EVERY CONSUMER THAT READS ITS NEIGHBOUR — found AFTER the audit

§18.4 narrowed `InvoiceSummaryDto.TotalAmount` to the headline currency and added `PrimaryCurrencyCount` and
`OtherCurrencies` beside it. **`Count` did not change meaning, and that is the trap**: any consumer still
pairing `Count` with `TotalAmount` now reports a full count against a partial total. `InvoiceTotalsTool` did
exactly that — *"twelve invoices, C$5,000"* when the twelfth was ₹5,000 — and no test caught it, because the
tool was never opened by the phase that changed the DTO underneath it.

- ‼️ **When you narrow a field, grep every reader of the WHOLE record, not just that field.** A sibling field
  whose meaning is now relative to the one you changed is a silent break with a green build.
- The same tool **summed the period's paid invoices across currencies** even though this phase had already
  widened that repository row to carry each invoice's own currency, and **named the currency from a SECOND
  resolver** (`IFullProviderContextService` maps the primary address through the discovery settings;
  `ICurrencyService` maps it through the country lookup). Its own fixture had the two disagreeing — summary
  `USD`, payload `CAD` — and passed. **The summary states the currency ITS figures are in; quote that one.**
- ‼️ **And a symbol resolved from one row while the amount is formatted from another is the same defect
  wearing a different hat.** The booking receipt took the glyph from `booking.Price.Currency` and the number
  from `booking.Payment.Currency`. The **paid** currency answers both.
- The two `CurrencyMinorUnit` overloads that accept a currency AND a separately derived symbol are what make
  that representable at all. ~30 call sites use them; deleting the overloads would end the class, and is
  named in `CARRIED-TO-P5` §2.4b rather than taken inside this phase.

### 18.9 ‼️ THE SYMBOL-TAKING OVERLOADS ARE DELETED — a currency and a separately-resolved symbol is the defect

`CurrencyMinorUnit` used to offer `Format(minor, code, symbol, culture)` and `FormatMajor(major, code, symbol,
culture)` "for a caller that already holds a symbol from `ICurrencyService`". That pair is what let the two
disagree, and it did: the booking receipt resolved its glyph from `Price.Currency` while formatting the amount
in `Payment.Currency`, so a booking **quoted in USD and charged in CAD printed `$` over a C$ figure**.

- ‼️ **The e-mail was fixed and the CONTROLLER was not** (`BookingPaymentController`, the downloadable receipt).
  Fixing one call site of two is the §0.1 failure this programme keeps re-learning. **Delete the overload
  instead of auditing the callers** — the compiler then enumerates every site, and about twenty were.
- **The parameter is gone from the whole chain**: `IPdfGenerationService` + `QuestPdfService` (all four
  documents, plus `ComposeAdditionalChargeRows` / `ComposeDepositRow`), `InvoiceLineDiscountFormatter`,
  `IDocumentDeliveryService` + `DocumentDeliveryService` (WhatsApp/SMS), and every e-mail, voice and
  controller caller. The `?? "$"` defaults went with it — a blank symbol silently CLAIMED US dollars.
- **The symbol is derived where the amount is formatted, from the currency being formatted.** There is
  nothing to pass, so it cannot be the wrong thing.

### 18.10 ‼️ THE WORDS AROUND THE MONEY ARE THE READER'S TOO — `BusinessSearchMoney` (closed 2026-09-05)

A price on the answer surface is rendered by `BusinessSearchMoney.Format(price, language, localization)`, not
by `CatalogLookupItem.PriceText` — that one is **spoken-ready and deliberately bare**, because a receptionist
reading "C$62,799.00" aloud would say the symbol. On a screen the same amount printed as `62799` tells the
member neither whose money it is nor where the thousands fall.

- ‼️ **The amount obeyed the rule while the words did not.** `"from"`, `"to"`, `"per hour"` and
  `"minimum N hours"` were concatenated in English for every reader, so a Gujarati member read
  *"from ₹500 per hour"* inside a Gujarati answer. **A §0.10 breach is not only a whole sentence — it is any
  word a provider reads.**
- Now five keys in **all five** catalogues: `BusinessSearch_Price_Range` · `_From` · `_PerHour` ·
  `_MinimumHour` · `_MinimumHours`, resolved through `ILocalizationService` and formatted with the reader's
  culture. **The hour pair follows the existing `BusinessSearch_Citation_ReviewStar(s)` convention** — the
  backend catalogue has no plural machinery, so a count that can be 1 needs two keys.
- ‼️ **An unknown or absent currency renders the NUMBER ALONE** — this is the one place `Parse`'s USD fallback
  would be wrong, which is why `TryParse` exists (§18.6). Reaching for a default here would print one
  business's money in another's symbol.
- Guarded by `BusinessSearchMoneyWordingTests` in the **API** unit suite (§0.18 — the API host runs the agent),
  sabotage-proven: restoring `$"{…} per hour"` fails `EveryConnectorWordComesFromTheCatalogue(hourly)` and
  `TheRealCatalogueTemplateIsUsedVerbatim`.

## 19. ‼️ P4.7 — THE CATALOGUE COULD NOT FIND THE PROVIDER'S OWN SERVICES (2026-09-05)

Owner-reported, reproduced live on `SX3SG2`. Three separate defects on one screen, plus two the probes found.
Findings: `Data/provider-ai-search/findings/CATALOGUE-RETRIEVAL-BRAINSTORM-2026-09-05.md`.

### 19.1 ‼️ THE TOOL'S CONTRACT AND ITS MATCHER CONTRADICTED EACH OTHER

`search_services`'s description said **"Put the member's own question in every query field"**. The model
complied — **measured 15/15 verbatim, question mark included** — and `BuildCatalogPredicate` then required
**every whitespace token of that sentence** to be a substring of an offering's name or a description line.

**Measured, 25 real services, natural questions, through the real model and both real legs:**

| contract | leg | found | rank 1 | zero results | tripped TooBroad |
|---|---|---|---|---|---|
| **the question** (shipped) | **Cosmos** (the shipped dial) | **0 / 25** | – | **25 / 25** | 0 |
| the question | Index | 25 / 25 | 23 | 0 | **25 / 25** ⚠ |
| **the words** | Cosmos | **25 / 25** | – | 0 | 0 |
| **the words** | Index | **25 / 25** | **25** | 0 | 0 |

As shipped it found the asked-for service **0 times in 25**. ‼️ **Flipping only the leg does not fix it** —
a sentence in `SearchMode.Any` matches 85–482 documents, past `LookupTooBroadThreshold: 25`, so the model is
told to narrow instead of answering. **The contract is the root cause; the leg is a quality choice on top.**

`SearchServicesTool.CatalogQuerySubject` + `CatalogQueryRule` carry the replacement, appended AFTER the
measured translation clause by `BuildSchema(scripts, what, rule)` — **never woven into it**, or §11.3's 3/25
result re-opens. Composed-schema compliance **24/24**, and the multi-script legs still translate (verified
Gujarati + Devanagari renderings on a three-alphabet plan).
‼️ **The worked example is load-bearing** — the abstract rule alone left the model echoing the question.

### 19.2 ‼️ AN EMPTY QUERY FIELD IS A CHOICE, NOT A FAILED RENDERING

The field is `required`, so a model filtering by price alone sends `{"queryInEnglish":"","maxPrice":50000}` —
**measured 4/4** for *"list everything under 50000"*. `Parse` replaced that empty string with
`scripts.Question`, turning a clean price filter into an every-word AND that matches nothing.

`Parse(scripts, arguments, allowQuestionFallback)` — the CALLER decides, because only it knows whether the
call carried another way to narrow. ‼️ **The existing fallback still stands** when there is nothing else to
search by: an empty field is then the model forgetting, and the member's own words stand in rather than
spending one of their questions on a re-ask.

### 19.3 The catalogue query itself

- ‼️ **`Normalize` trims punctuation from term EDGES only.** A stored name never ends in the punctuation of
  the sentence that asked for it, so `(L122870)?` matched nothing while `L122870` is a substring of the real
  name. Interior punctuation is part of the name and is kept: `FMC/LINK-BELT`, `303.5E2`, `ST2.8`.
- ‼️ **`SelectFields` never requested `currency`**, so every index-served price rendered as a bare
  `62,799.00` while the identical Cosmos-served row rendered `C$62,799.00` — the two legs disagreeing about
  the same offering. Found by the end-to-end run, not by any test.

### 19.4 ‼️ BOTH LEGS RUN, AND APPROVAL IS THE ONLY THING THEY DIFFER ON

One logical catalogue, two stores that deliberately hold different things:

- The **index** holds approved+active rows only, and that absence is a **safety property**: the customer
  marketplace is protected by unapproved offerings not being there at all, which is stronger than a filter
  every query must remember. ‼️ **Owner ruling 2026-09-05: it is NOT widened.**
- **Cosmos** holds everything but matches raw substrings over `name` + `description` alone. Measured on live
  data: `skid steers` → **0** where the index found 43; `bulldozer` → **0** where the index found 32;
  `excavators` → **2** where the index found 161. It cannot stem, cannot know a synonym, and cannot see a
  category name.

So `SearchServicesTool` issues **both, per rendering, concurrently**, and merges:
`Index` (approved catalogue) + `Cosmos` with **`UnapprovedOnly`**. Both legs already require active and
not-deleted, so **approval is the entire delta** — a second full scan of the catalogue bought nothing but RU.

- ‼️ **The Cosmos leg runs ALWAYS, never "only when the index finds nothing".** Conditional, a pending row
  would stay invisible whenever an approved row also matched — ask about a pending `METSO ST2.8` while other
  Metso rows are approved and the index answers, so the provider's own draft is hidden.
- ‼️ **`IProviderCatalogSearch.IndexAvailable`** gates the index leg. On a stamp with AI Search unprovisioned
  the index leg degrades to the partition query *internally*, so a second Cosmos leg would issue the SAME
  query twice. Without an index the Cosmos leg IS the catalogue and runs unrestricted.
- **No coverage probe is needed.** `ConfirmEmptyAgainstCosmos` already runs the full Cosmos query when the
  index returns nothing, so an unindexed or brand-new business is answered exactly as before — and a newly
  created service is *pending* by definition, so it is in the unapproved leg anyway.

### 19.5 ‼️ A DRAFT MUST NOT READ AS A LIVE OFFERING

Unapproved rows reach the provider's own team on purpose — it is their catalogue-management surface — but
unmarked they look identical to a published one, and **a draft's price repeated to a customer is a number
the business has not agreed to**. `CatalogLookupItem.Published` is read off the ROW (never inferred from
which leg fetched it); the payload writes `published: false` **only when false**, so a published row costs no
prompt tokens and an absent flag can never be misread. `BusinessSearchToolNotes.SomeNotPublished` tells the
model to say so, in the member's own language.

‼️ **NOT a separate tool.** One tool per family (§14.1); splitting the catalogue would push an internal
storage detail into the model's decision-making and be forgotten half the time.
‼️ **No quote characters in that note** — it is serialized INTO the JSON payload, where they are escaped, and
a guard comparing against the constant would never match its own note.

### 19.6 ‼️ COST — the scan IS the cost, and the second scan was free to delete

Measured on the live 708-offering partition:

| | RU |
|---|---|
| the page (`SELECT *` + `CONTAINS`) | 48.22 |
| **the COUNT — a SECOND full scan** | **48.18** |
| a projection instead of `SELECT *` | 48.20 — **no saving; `CONTAINS` cannot use an index, so the scan is the cost** |
| narrowed first by an **indexed** path (129 rows survive) | **11.13** |
| narrowed first by the **unindexed** `approvalStatus` (5 rows survive) | **36.07** — Cosmos loads every document to test it |

- ‼️ **The exact total was a second full scan buying nothing.** `NeedsExactTotal` waives it whenever more than
  one leg runs: the page is already read one row past the too-broad ceiling — all that decision needs — and a
  page that does NOT fill **is** the exact total. `TotalIsExact` carries the distinction so a lower bound is
  never printed as a figure. Voice keeps its exact count (single leg).
- **Measured end state: 95.30 → 34.82 RU per rendering (−63%)**; 286 → 104 RU per question at three alphabets.
- ‼️ **`/approvalStatus/?` added to the ProviderData indexing policy (§0.7, owner-approved 2026-09-05).** No
  new field — the value is already on every Service document, just excluded by the `/*`-excluded policy. It
  is what lets the unapproved leg narrow before the `CONTAINS` scan. **Not applied to any stamp by this
  session** — it needs `cosmosindexsetup`, which the owner runs; the ~3 RU figure is an ESTIMATE extrapolated
  from the 11.13 RU measurement above and must be re-measured once applied.
- **`BusinessSearch:ServiceLookupSource` is DELETED** — nothing read it once both legs run. `SearchEnabled`
  is already the kill switch at the right level.

### 19.7 ‼️ M9 — A SOURCE CARD IS A DOCUMENT, NOT A PART OF ONE

`C:\Nik\Data\mockups\business-search-source-grouping\index.html`. **Supersedes M2** on grouping, on the
excerpt being carried and drawn, and on never offering a control that cannot work.

One question returned **FOUR cards, all the same document** (`bd76d101…`), same title, same subtitle
"records", no page numbers, and only `[1]` quoted — because a card is minted per matched part and drawn as if
it were a whole document. That file is a scraped inventory holding **664 stored parts**, one per machine, so
"the document" was never what the member wanted to look at.

- **Grouping is PRESENTATION ONLY.** The server still mints one number per part, so a `[n]` in the answer
  still resolves to exactly one part.
- ‼️ **ONLY WHAT THE ANSWER QUOTES IS DRAWN (O-1, 2026-09-25 — supersedes the roll-up).** A part that was READ
  and not quoted is not drawn at all, so there is no "Show N more"; numeric order is kept (§30).
- **Only DOCUMENTS group.** A FAQ is its own whole answer and every work record is one record.
- ‼️ **One card is one document AND one kind of words (P4-F-01, 2026-09-25).** `groupSources` splits a document's
  parts by AI-written channel: key `doc:{docId}` for the file's own words, `doc:{docId}:{channel}` for
  `PictureDescription` / `GeneratedOverview`, and `group.channel` carries it. The X-01 mark is drawn once per card,
  so a merged card left AI-written parts unmarked.
- `citedSources` / `groupSources` / `sourceCounts` / `citedNumbers` are in the **twins** — extend both or neither,
  and test them in BOTH repos (§13.2).

### 19.8 ‼️ "SHOW TEXT" HAD NEVER WORKED FOR ALMOST ANY DOCUMENT

`GetTextAsync` reads a whole-document artefact that `KnowledgeIngestProcessorFunction` has written only
**since 2026-08-29**. `SX3SG2`'s three documents were ingested **2026-08-21**, so all three 404'd — and
across the entire CA dev store exactly **ONE blob of 23** has one, belonging to another business.

**A cache used as a contract.** The fix is not to fake the text: the words the answer was built from now
travel WITH the answer (`BusinessSearchCitationDto.Excerpt`), so a source card is readable with no request at
all, and **`HasFullText` decides whether the whole-document control is drawn** — one blob existence check per
DISTINCT document per answer, never one per part.

- ‼️ **A control that reliably fails is worse than no control.** `IKnowledgeContentArtifactStore.HasTextAsync`
  answers **false** on a store failure: withholding a control is the safe direction; drawing one that then
  fails is not.
- `BusinessSearch.Source.ShowText` is **retired** (replaced by `ShowWholeDocument`);
  `TextUnavailableTitle` **stays** — the control can still fail transiently after being offered.
- ‼️ **Backfilling the older documents is the OWNER's action** (reprocess), deliberately not done here.
- ‼️ **The saved text is per set of bytes (P4-C-13).** `HasTextAsync(businessId, docId, contentHash)` checks
  `{biz}/_artifacts/{docId}/{hash}.json.gz` for the hash on the document row (memo key `{docId}:{hash}`). A document
  read before that build answers false until it is read again — no read falls back to the old single-file path.

### 19.9 The web mic had never worked either

`TranscribeSpeech` unwrapped ONE level of a TWO-level response: `handleRequest` resolves the **axios
response**, so the envelope is `response.data` and the transcript is `response.data.data.text`. Every field
came back undefined, `text` fell to `""`, and `useDictation` reported a perfect transcript as
`DictationState.Empty` — *"Didn't catch that."* — on every dictation since the control shipped.

‼️ **`useDictation.test.js` could never catch it: it MOCKS `TranscribeSpeech`** and asserts the shape the mock
returns, so the mapping between the wire and that shape was covered by nothing. Mobile was always correct
(`parsed?.data ?? parsed`). Guarded now by `aiServices.transcribe.test.js`, sabotage-verified.

### 19.10 The header ask panel was drawn off the side of the screen — TWICE

`AskHeaderButton`'s panel was `absolute right-0 w-[min(92vw,380px)]` inside the BUTTON's own box — and on a
phone that button is the **first of four** header icons, nowhere near the right edge, so a 359 px card hung
off it began ~150 px off the LEFT of a 390 px screen.

‼️ **No breakpoint can fix that**, because where the button sits depends on what else the header renders.

‼️ **AND THE FIRST FIX DID NOT HOLD — the owner sent the same screenshot again on 2026-09-05.** Going `fixed`
with a measured gap clamped only the RIGHT gutter (`Math.max(GUTTER, innerWidth - rect.right)`); nothing
bounded the LEFT edge, because `max-w-[calc(100vw-24px)]` caps the card's **size** and says nothing about
where it starts. A 366 px card pinned 184 px from the right of a 390 px screen begins at **−160 px** — and
`AskHeaderButton.test.jsx` **asserted that 184 and called it correct**, under a title claiming the opposite.
A guarded number is only a guard if the number is the one that matters: the invariant is the LEFT EDGE
(`viewport − right − width ≥ gutter`), never the right offset on its own.

The panel now takes **every** edge from the measurement — `right` clamped on BOTH sides, `width` and
`maxHeight` inline, no viewport-unit class left to disagree — through the shared `useAnchoredPanel` rule
that six other provider-web surfaces now share. See `clinqet-ui-common` → **ANCHORED PANELS** for the rule,
its traps and its call-site guard. Mobile has no twin of this panel — that is §13.1's documented asymmetry,
not a parity defect.

### 19.11 The stock-code chip rule was too narrow

`looksLikeStockCode` required **two consecutive letters** plus a 3-digit run in one word, so `L122870` and
`M1163480` — single letter — slipped through. Measured against the live 708-name catalogue: **596 (84.2%)**
caught, leaving **93 names still offering a bracketed code**, which is exactly what the owner was shown.
One letter catches **697 (98.4%)** and every deliberate keep still passes (`60 min`, `2-hour`, a bare `320`,
`Facial no. 2`, `Room 101 cleaning`, `MP3 conversion`, `iPhone 14 repair`, `Windows 2000 support`).

### 19.12 Guards added

| Suite | Covers |
|---|---|
| `BusinessSearchCatalogRetrievalTests` (API, 11) | the schema wording, both legs, `UnapprovedOnly`, the waived count, the draft marking, the screen price, the filter-only search |
| web `sourceGrouping.test.js` · mobile `businessSearchSourceGrouping.test.ts` | M9's grouping, only what the answer cites (O-1), counts of what is drawn, what must NOT group, `hasFullText` |
| web `SourceCard.grouping.test.jsx` (11) | the card itself, through the REAL catalogue |
| web `aiServices.transcribe.test.js` (6) | the envelope, sabotage-verified |
| web `AskHeaderButton.test.jsx` (17, placement block 12) | ‼️ REWRITTEN 2026-09-05 — asserts the LEFT EDGE across six viewports, not the right offset; the old suite pinned the defect |
| web `askRules.test.js` · mobile `businessSearchRules.test.ts` | the single-letter stock code, and twelve deliberate keeps |

---

## 20. PHASE 5B — what the whole-programme audit changed (2026-09-06)

Everything below is BUILT and green. `Data/provider-ai-search/findings/AUDIT-P5B-LEDGER.md` carries the
per-ID detail; this section is the contract a future change must not break.

### 20.1 The conversation store keeps the whole answer

- **The STORE marks a cut-short answer, not the caller.** `McpSessionService.PartialAnswerMarker` is appended
  inside `AppendTo`. Glued on by the caller, the mark sat in front of the cap — so the one answer that needed
  it was the one that lost it.
- **Nothing is trimmed or truncated on the way in.** The member can scroll their own conversation back, so
  trimming the store would delete what is on their screen. `FollowUpTurns * 2` is the AGENT's replay window —
  the only place the prompt cost is actually paid. `MaxConversationTurns` and `MaxConversationBytes` (§26)
  bound the store instead, and the write is refused rather than silently shortened.
- **Turns are placed by TIME, not appended.** A stopped question persists on the request's own lifetime, so it
  can land after the exchange that replaced it and invert the conversation.
- **A conditional write is never retried.** `AppendTurnsAsync` takes `expectedTurns` and makes ONE attempt: a
  competing exchange changes the prompt context, and re-applying onto history the member never saw is the
  corruption a retry was meant to prevent.

### 20.2 Money, and the one place it is rendered

- `CurrencyMinorUnit` is the ONLY money renderer. `FormatUnknownCurrency` is the ONE rendering for a code the
  platform cannot name — no symbol, the reader's grouping, and two decimals as a **stated convention** (there
  is no currency to ask; eighteen of the twenty codes are two-decimal).
- **One country to currency table**: `DiscoverySettings.CountryCurrencyMap`. `TryResolveCurrency` exists so
  the two callers can differ where it matters — a search may fall back to `DefaultCurrency`, a BUSINESS's
  currency stays **empty** rather than silently becoming USD.
- **Every map value must parse.** `"AE": "AED"` shipped in three hosts and `AED` is not a `CurrencyCode`, so
  `Parse` fell back to USD and a UAE business's prices would have printed with a dollar sign. Guarded by
  `CountryCurrencyMapParsesTests`.
- **One parse, everywhere**: `CurrencyMinorUnit.TryParse`. Five copies existed and **three omitted
  `Enum.IsDefined`**, so a numeric string became whatever enum member sat at that index (`"7"` becomes CNY) —
  one of them reading a gateway payload and deriving an invoice's tax and total from the wrong minor units.

### 20.3 The OCR page cache is keyed on the prompt itself

`VisionTranscriptionSettings.PromptFingerprint` = the version **plus a SHA-256 of the prompt template**.
`deploy.ps1` once stamped the literal `"v1"` over both hosts while the code shipped `"2"`, so every deployed
stamp composed the key as `vv1` and would have served pages from the OLD prompt forever — silently, because a
miss is a debug line and a fallback. **SHA-256, never `GetHashCode`**: that is randomised per process, so the
reader and the writer would disagree about the same prompt after every restart. The deploy stamp is gone.

### 20.4 Model-facing payloads

- `ModelFacingJson` omits nulls — via `DefaultIgnoreCondition` for object properties AND a `SkipNullValues`
  converter, because `DefaultIgnoreCondition` does **not** skip null dictionary values and most Group B
  payloads are dictionaries.
- Every model-facing serialize site uses the relaxed encoder. The default HTML-safe one shipped Gujarati and
  Hindi tool-schema descriptions as `\uXXXX` escapes.
- **A narrowing the member asked for is echoed back.** An unrecognised category was dropped in silence and
  the whole catalogue searched, so "what haircuts do you do?" answered from the entire price list with every
  row reading as a haircut. `CatalogLookupResult.GroupIgnored` feeds
  `filter { group, minPrice, maxPrice, groupIgnored }` plus `BusinessSearchToolNotes.GroupNotRecognised`.

### 20.5 Two gates that could never fire

- **Reviews.** `CanSeeUnmoderatedReviewsAsync` compared a five-character `UserNumber` with a six-character
  `BusinessId`. Different namespaces, so never true — **nobody, not even the primary owner, could see a
  Pending or Rejected review on their own screen**. It now asks `Tenant.Has("review.read")`, and the Business
  Search tool (which runs unfiltered) matches the page exactly.
- **Self-bid.** The same shape in three `BroadcastProviderService` guards. `actingUserNumber` is threaded in
  and compared with the broadcast's poster. IMPORTANT: `NoCodeResolvesAPersonFromABusinessIdTests` had a
  lookbehind that **certified this defect as correct code**, on the written claim that `broadcastUserNumber`
  holds a businessId — it holds the posting customer's number. The lookbehind is gone and the scan now
  catches every prefixed field name.

### 20.6 Cost and correctness on the read paths

| Change | Why |
|---|---|
| `list_customers` counts, then reads the newest N | It read the whole partition — around 900 documents over nine round trips — to keep ten and a number |
| The catalogue's confirm-empty fallback runs approved-only | The two scans overlapped; now they partition |
| `GetPartnerContextAsync` is single-flighted | N concurrent cold callers each built the whole context (a COUNT plus up to ten reads) for the identical object |
| `HasTextAsync` memoised; the two knowledge loads overlap | It asked the same question per leg and per round, and the two independent loads were awaited in series |
| An unresolved alphabet set is cached for `UnresolvedCacheSeconds` | Cached for nothing, a failing facet re-issued two index queries on **every** call |
| One `PeriodicTimer` for the SSE keep-alive | A linked CTS plus `Task.Delay` plus `WhenAny` per awaited frame — hundreds per answer |
| `prepare` takes the ask path's burst bucket | Unlimited, a client could loop the surface open and drive index queries without ever asking anything |

### 20.7 Limits

- `BusinessSearch:Limits:FeedbackPerMemberPerDay` (30). Each not-helpful report writes a durable 90-day admin
  row carrying the question and answer verbatim. Same `AiUsageCounter` family, id segment `bsearchfbm_` — no
  new document family, no schema. IMPORTANT: the client reports **once per exchange**; every tap used to
  re-POST, and with this ceiling in place each tap would spend a unit of the member's own allowance.
- The business's busy-minute is checked BEFORE anything is charged, with its own sentence in five languages
  and a retry time.
- A question the platform fails to answer is REFUNDED — atomic, floored by a conditional patch so a refund
  can never create allowance.

### 20.8 The screen

- **The words a source gave the answer are on EVERY card.** They were drawn only for a document with two or
  more parts, so one-part documents and every typed FAQ answer shipped a card with no evidence on it at all.
- **The document line carries only what the parts SHARE**; a page they all share printed twice, and one only
  some share headlined the whole document.
- The sources count is **cards DRAWN, not parts** — one document quoted four times is one card; the
  `SOURCE_PARTS_VISIBLE` roll-up is gone (O-1, §30).
- **Amber for a boundary, red for a breakage** (M7 section 04): a daily ceiling and an offline failure are
  amber on both apps. A refusal the member can act on carries a Try again; a ceiling counting down does not.
- **A draft service is marked.** `BusinessSearchCitationDto.Published` is sent only when false.
- `dictation.enabled` and `dictation.maxAudioBytes` were both delivered by AppConfig and **read by nobody**.
  The mic is not drawn when dictation is off; the recorder stops at whichever cap binds first, so an oversize
  clip is never recorded — and `canRetry` is Failed-only, because re-sending refused bytes cannot succeed.
- `IntlProvider` gets the PRODUCT TAG (`fr-CA`), so money groups the way the phone and the backend group it.
  IMPORTANT: the API is not a formatter — `LookupRepository` never splits on the dash, so anything crossing
  the wire takes `toApiLanguage`. Guarded by `apiLanguageIsBare.test.js`. Spanish was also missing from the
  messages map while the language list comes from the server and can offer it: selecting it rendered every
  string on the app as its raw key.
- **A failed read is not a zero.** `useInvoiceEarnings` reports `error` and nobody consumed it, so a blip
  printed a confident zero — a provider could reasonably conclude they had earned nothing that week.
- The lanes stack until 1024, not 768: the dashboard rail hides below 1024, so every iPad in portrait had no
  rail AND two columns.

### 20.9 The trap that cost the most to find

**The .NET configuration binder APPENDS array elements onto a non-empty class default instead of replacing
them.** `MediaConstraints.AllowedExtensions` shipped a media default, so every container's effective
allow-list was `class default union configured` — and **`LicenseDocuments` silently accepted `.mp4 .mov .avi
.wmv .flv .m4v`**. A licence-document container took video.

Three changes had to land together, and the middle one is why the obvious fix alone would have been worse:

1. The class defaults are EMPTY — appsettings is the single source.
2. **An empty list REFUSES.** `StorageManagerService` guarded its extension and MIME checks with `.Any()` —
   the one fail-OPEN reader of the four — unreachable while the defaults were non-empty, and live the instant
   they were emptied.
3. The API's `PostConfigure` FAILS THE BOOT if any container has no allow-list, so a lost appsettings block is
   caught at deploy rather than by a provider whose upload quietly stopped working.

Guarded by `MediaAllowListsAreNotAppendedTests`, which BINDS the real appsettings through a real
`ConfigurationBuilder` — asserting the JSON alone can never see an append.

### 20.10 Measured live, 2026-09-06 (CA and IN sandbox)

| Measurement | Result |
|---|---|
| `scripts` facet on the knowledge index | **0 buckets** over **744** CA documents and **99** IN documents — the facet answers, and no document carries a label |
| Retrieval, one leg (CA, 30 samples) | P50 **66 ms**, P95 **83 ms** |
| Retrieval, three concurrent legs | P50 **115 ms**, P95 **144 ms** — the screen's 8 s budget is 56 times the P95 |
| `minimumHours` on a throwaway index | a document with a value round-tripped as 2; one omitting the field round-tripped as null; index deleted |

That first row is the whole of N-1: the alphabet lookup SUCCEEDS and returns an empty set for every business
alive, so before this phase the plan searched the asked script alone — and a Gujarati question never touched
any of those 744 English documents. A *failed* lookup behaved better than a successful one.

The four AI-dependent probes (prompt-cache hit rate, the ten-follow-up stale-citation run, the Gujarati and
Hindi answer probes, and the 24-question two-alphabet run) are still owed: the sandbox credentials carry
Cosmos and AI Search only, no Azure OpenAI. The two-alphabet run is unrunnable by construction anyway — the
table above shows no business has a second alphabet labelled.

---

## 21. PHASE 5B, SECOND PASS — the screen's refusals, and what a control is allowed to cost (2026-09-07)

Built after the whole-programme audit's §6. `findings/AUDIT-P5B-LEDGER.md` §15 carries the per-row detail; this
section is the contract.

### 21.1 A control is offered only when pressing it can work — and only when it is the CHEAPEST way

Every refusal sentence on this surface says "try again", and for a while there was nothing to press: the box is
emptied when the question is asked, so on a phone the instruction meant retyping the whole question. The Try
again now exists on BOTH apps, gated identically:

```
canRetry = asked && !retryAfterSeconds && !offline && !running && !needsReload
```

Each clause is a defect that was live:

- `retryAfterSeconds` / `offline` — pressing cannot succeed while a ceiling counts down or the signal is gone.
- `running` — mid-answer.
- `asked` — with nothing asked there is no question to re-run. This is also how a **no-longer-saved
  conversation** avoids offering to re-run the question it has just put back in the box: the hook calls
  `newConversation()` BEFORE raising `ConversationGone`, so `exchanges` is empty and the gate cannot open.
  ‼️ Set the key first and both apps offer to spend a question on a sentence already sitting in the field.
- ‼️ `needsReload` — **an unacknowledged write already offers a FREE reopen, and the box is disabled on
  purpose.** A Try again beside it charges a second question to reach an answer the member can have back for
  nothing, and it calls `ask` directly, bypassing the lock the screen just applied.

The same principle governs the Recent lane: a row **reopens** (free) and never re-asks (a unit of the day's
allowance for an answer already paid for), and a chip already in Recent is dropped from the chip set.

### 21.2 An ended session ends; a flaky one does not

`ask` is the one call on this surface that does NOT go through the shared client, so nothing signed anybody out:
a refresh the server rejected left the member pressing a Try again forever.

| App | What happens now |
|---|---|
| Web | Exactly the shared client's two arms — `staleSession` reloads and **never clears** (another account signed in; clearing destroys the tokens it just obtained), otherwise `SessionStore.clear()` + `redirectToLogin()` |
| Phone | Reuses the platform's own single-flight `forceLogout`, now exported from `apiManager` — never a second logout of its own |

‼️ **Only a NON-TRANSIENT failure.** `isTransientRefreshFailure` exists precisely so offline / timeout / 5xx /
mangled-body does not end a session: losing signal mid-answer must never sign a provider out.

### 21.3 A refusal always says something, even when the dialog is not its

`accessDeniedBus` lives at the API layer so a refusal cannot be missed — but this stream is hand-rolled through
`XMLHttpRequest` and never passes `apiManager`, so nothing spoke for it, and the hook suppressed its own message
believing the bus had. A technician pressing Ask watched the spinner stop and got a **blank screen**.

- The stream service raises the bus itself for the refusals that dialog owns (uncoded 403, `permission_denied`).
- The hook renders the server's own sentence for EVERY failure, so the session-shaped codes that dialog does not
  own — `billing_only_access`, `business_context_required`, `business_context_invalid` — still say something.
  Two dialogs at once is the failure to avoid; silence is worse than either.
- A warm-up nobody asked for refuses **quietly**: `prepare` is fired on mount and its result ignored, yet a
  refusal popped the shared dialog over a page the member had not used. The caller's `.catch()` is far too late
  — the interceptor speaks first — so the REQUEST carries `quietRefusal`. Every real read stays loud.

### 21.4 States that had no words, and words that had no state

- **A clean end that produced NO WORDS.** With the turn acknowledged, both existing arms were skipped and the
  member met a blank space under their own question. It reports the existing generic sentence.
- **The wait is printed only when the number helps.** `retryTailMinutes` (shared, with a parity case) returns
  null at or past an hour, so a daily ceiling no longer reads "Try again in about 1440 min." beside the
  server's own sentence saying the allowance resets at midnight.
- **`BUSINESS_SEARCH.ERROR.OFFLINE` was translated in five files and reachable by nobody.** Web picks that
  sentence in its HOOK from `navigator.onLine`; the phone learns it from NetInfo in the SCREEN, so the
  substitution happens there — and only in place of the GENERIC sentence, never over a specific one.
- **A reopened answer shows no dead citation controls** (the sheet's own words). A replayed conversation stores
  text only, so a pill finds nothing: the marker renders as plain text, deliberately not brand green, because
  green means chosen. Web already did this; the phone kept a `TouchableOpacity` that announced itself as a
  button to a screen reader and did nothing.
- **A picture whose signed address has expired is dropped**, not drawn as a broken glyph — the same rule as a
  restricted document: what cannot be shown is not rendered. The strip disappears when it empties.

### 21.5 Two-tap losses, and copy that says a thing twice

- **The audience picker remembers.** Choosing Everyone CLEARS the role list on the server, so re-choosing "Only
  certain roles" sent the now-empty list and landed on "just you" — two taps, no undo, nothing said. Both apps
  keep a `lastPicked` ref, seeded from the document and updated on a real pick. ‼️ An EMPTY list must never
  overwrite it: an empty list IS the Everyone case.
- **A review citation opens THAT review.** The Reviews screen already read `reviewId`, scrolled to the row and
  highlighted it — built for the review notification. This surface simply never passed it.
- **The instruction is said once.** `knowledge.audience.rolesFailed` ended with "Try again." in all five
  languages AND was followed by a Try again button. The trailing sentence is trimmed using each language's own
  approved words; the phone, which uses the whole sentence as its tap target, is deliberately unchanged.
- **The handed slot is emptied on sign-out.** It lives in MEMORY — deliberately, so history and referrers
  cannot retain the question — which is exactly why `SessionStore.clear()` could never reach it.

### 21.6 Testing this surface

- **Never a filtered run.** Two defects in this programme were hidden by one: a class the filter never matched.
- Web has testing-library; the phone has `react-test-renderer` and **no** renderHook, so its screen contracts
  are source scans — and every scan proves it READ something first, or a scan that matches nothing reports
  success while checking nothing.
- **The markdown parsers are pure ESM.** The phone transpiles `react-native-markdown-display` (allowlisted in
  `jest.config.js`) and renders a REAL GFM table; `next/jest` transforms no `node_modules`, so web drives the
  real components map through a stub instead. Parsing is the library's job; the map is ours.
- A cross-app parity test may read the peer repo ONLY with `existsSync` at module scope and every peer read
  deferred INSIDE an `it()` — ‼️ `describe.skip` still EXECUTES its callback (§0.17).

### 21.7 An orphan-key sweep includes the TEST folders

Deleting a key verified at "zero references in `src`" turned **5 pre-existing tests red**: a suite pinned every
audience state string in all five languages and that key was on its list. A test can pin a key exactly as a
screen can, so the sweep must cover `__tests__` / `*.test.*` too.

When a pinned key really is dead — `NONE_PICKED` was the only one of 25 the screen never rendered, the zero-role
state comes from `MARK_JUST_YOU`/`JUST_YOU`, and web has no twin — the list entry goes with the key, and the list
says why. Pinning dead copy makes a guard argue for keeping it.

## 2026-09-07 — M10 transcript and dashboard repair

This section supersedes older single-answer / six-stored-pair UI guidance. Owner approved M10 in this conversation; register: `Data/provider-ai-search/PLAN.md`, mockup: `Data/mockups/business-search-conversations/index.html`.

- The readable conversation and paid model context are separate: `MaxConversationTurns=50`, `MaxConversationBytes=1600000` (‑ §26 supersedes the former `MaxConversationHistoryBytes=1048576`), `Answer.MaxOutputChars=32768`; the agent still projects the last `FollowUpTurns=6` exchanges. Seven-day inactivity TTL and existing daily/burst allowances are unchanged. Fifty is an initial product cap, not a universal standard. No persisted field or index was added.
- `BusinessSearchConversationPolicy` reserves worst-case JSON space for the next bounded pair. Both controller admission and `McpSessionService` enforce it. `expectedTurns` binds an answer to its prompt history; one ETag CAS attempt, no stale-history retries. Concurrent callers must reload after losing the write.
- The terminal SSE `Done` carries `saved` and authoritative `{turnCount,maxTurns,canContinue}` after persistence. Persistence has its own configured 15-second lifetime after disconnect. A missing acknowledgment locks follow-ups until a free GET reload; never repair it by silently asking again. Error followed by Done is valid: the latter acknowledges persistence, not answer quality. Saved partial answers retain their warning.
- Both hooks own an ordered `exchanges` transcript. Streaming updates are animation-frame batched; older exchange objects remain stable. Each live answer owns its sources and feedback ID. ‼️ SUPERSEDED BY §26: reopen now renders every saved pair COMPLETE — its sources, pictures, answer id and row count — not as bare text. Back and New return to the landing list and clear the active session intentionally; leaving aborts active work. Native Android Back follows that flow.
- Recent history is eight device-local conversations keyed by business AND membership; the first question remains the title. Header history hands off a session ID for GET, not a new paid ask. Native storage mutations are serialized and scoped; delayed results cannot repopulate another workspace.
- New/reopened conversations reset the dictation composer. IME Enter is not submit; multiline text and 44-point controls are retained. Permission loss, offline state, server capacity, reload-required and running state also gate retry buttons.
- Web readers release their lock and abort listeners; native XHR releases handlers/timers/listeners on all exits. Callback failures reject the request rather than report false success. The agent completes the channel even if preparation throws. Controller keep-alive reuses one pending PeriodicTimer wait across delayed answer chunks.
- Behavioral hook tests now exist on BOTH platforms (`useBusinessSearch.conversation.test.js` / `businessSearchConversation.test.js`); native react-test-renderer harnesses exercise the hook directly. Browser regression `e2e/tests/dashboard/conversation-interactions.spec.js` uses the real local app with isolated API responses. Physical iOS/Android smoothness must still be measured on devices; browser emulation is not that evidence.

## 22. PHASE 5B CLOSE — three states nothing could describe, and a sentence the wire threw away (2026-09-07)

Sheet `Data\mockups\business-search-refusal-states` §01 / §05 / §06, approved 2026-09-07 and registered in
`Data\mockups\REGISTER.md`. `findings/AUDIT-P5B-LEDGER.md` §18 carries the per-row detail; this section is
the contract.

### 22.1 Switching away is NOT a failure

The browser closes the connection when the tab is hidden; the phone aborts the request itself when the app
backgrounds. Either way an answer part-way through stops. That state is **amber**, says what happened, and
puts the **free** action in brand green — `reopen(sessionId)`, which costs nothing, never `ask`.

Both apps gate it on the same four facts, and every clause earns its place:

| Clause | Why it must be there |
|---|---|
| `produced` | words must have ARRIVED for "saved up to that point" to be true |
| `!frameError` | an explicit `Error` frame is terminal and carries the server's own sentence |
| not the member's own Stop | web `!aborted`; the phone has no such clause **because the abort is ours** |
| `sessionRef.current` | without a session there is nothing to open — the existing "no longer saved" notice stands |

Web additionally requires the transport to have **failed**: a stream that finished unacknowledged is
complete, and "open it again to see the rest" would be false.

‼️ **The flag is cleared at the start of BOTH `ask` and `reopen`.** Backgrounding during a reopen would
otherwise leave it raised, and the NEXT question would settle into a notice it never earned.

While the notice is up, the red failure box and the plain "Reload conversation" control both **stand down**.
Two controls doing the same thing, one of them in worse words, is the state this replaced.

Copy: `BusinessSearch.Resume.Title/.Body/.Open/.NewQuestion` (web) ·
`BUSINESS_SEARCH.ERROR.SWITCHED_AWAY_TITLE/_BODY/_OPEN/_NEW` (phone), ×5 languages each.

### 22.2 ‼️ An error frame's sentence must survive a transport break

An explicit `Error` frame sets the server's message and its `retryAfterSeconds`. The failure arm that ran
afterwards then did `setServerError(message || null)` — with no message on a transport error, that
**overwrote the server's sentence AND its countdown with a bare "something went wrong"**, so a member at the
daily ceiling was told nothing about the ceiling. The failure arm now carries `!frameError` on both apps.

**Found by a guard asserting the UNHAPPY path.** It was pre-existing, in no audit row, and a happy-path guard
would never have seen it.

### 22.3 A shortened list must SAY it is shortened

Ten unpaid invoices under a question about unpaid invoices reads as "there are ten". The model is *told* to
state the total in prose and sometimes does not, so the numbers ride the wire and the screen says it too.

- `BusinessSearchRowsDto {shown, total, tool}` — **terminal frame only**, and only when a list really was
  shortened. Equal counts have nothing to tell the reader.
- Set in **ONE place**: `BusinessSearchWorkToolBase.Finish()`, the funnel all ten shortenable tools already
  use (`list_bookings` · `list_customers` · `list_invoices` · `list_leads` · `list_quotes` · `list_reviews` ·
  `list_team_members` · `search_call_followups` · `search_refund_requests` · `inbox_summary`). Read AFTER the
  payload cap, which corrects `shown` when it drops rows from the tail. `list_offers` and `search_services`
  do not use `Bound`, so they never carry it.
- ‼️ **Exactly one list, or nothing.** A caption saying "showing 10 of 47" cannot describe two lists, so a
  turn that shortened two sends none and leaves the prose to carry it (`AnswerBudget.OneSampledList`).
- ‼️ **The controller SWALLOWS the agent's `Done` frame** and writes its own, so anything only the agent knows
  must be carried across like `tokensUsed` and `answerId`.
- ‼️ **Deliberately NOT persisted with the turn.** A re-opened conversation would show a count taken when the
  answer was written, and a stale count is worse than none. A replayed exchange carries `rows: null`.

**The link names the PAGE, not the answer's narrowing** (PLAN ruling **R8**). Only the invoices page reads a
filter from its URL and none reads a date range, so a narrowed promise would land the member on a page showing
a different number from the one printed above the link — the exact trap §05 exists to close. A tool name the
app does not recognise draws **the count alone**: a link to a page that would not hold what the answer was
about is worse than no link. `src/lib/businessSearch/rowListRoutes.js` / `.ts`, ten entries each, pinned by a
test in each repo — and the phone's inbox goes through its **tab** route, because the profile stack cannot
reach `ChatList` directly.

Copy: `BusinessSearch.Rows.ShowingSome/.OpenAll` · `BUSINESS_SEARCH.ROWS.SHOWING_SOME/.OPEN_ALL`, ×5 each.

### 22.4 Money in three or more currencies

| Rule | Why |
|---|---|
| every amount is paired with its currency's **NAME**, one pair per line | "kr 4,500.00 · R 4,500.00" told the provider nothing about which was which — several currencies share a symbol |
| the joining word lives **INSIDE the key**, both blanks named | Gujarati and Hindi put the postposition **after** the currency name; a hard-coded "in" is wrong in two of five languages |
| bars are **dimmed** (and `aria-busy` on web) while a new range loads | the hook keeps the previous range's points, so bright bars read as a fresh chart |
| a chart failure is **amber**, never red | the earnings are fine; only the picture is missing |
| the phone tile opens when **either** the headline or the also-paid list is non-empty | the headline is ₹0.00 on a day paid only in another currency, so the tile was dead while the list under it named real money |

Copy: `Insights.Chart.AmountInCurrency` · `MY_DASHBOARD.AMOUNT_IN_CURRENCY`, ×5 each — the ONE sentence the
sheet's words panel names.

‼️ **§06's amber "counted apart, never added" note was NOT built** (PLAN ruling **R9**). Its words exist in
no catalogue and on no server path, and §0.20 forbids a screen inventing a sentence.

‼️ **react-intl splices rich-text values into a child ARRAY** — an element passed as a message value needs its
own `key`, or React prints a missing-key warning and may mis-reconcile the pairs. A warning in a passing test
is still a defect.

### 22.5 What is now guarded

API `BusinessSearchSampledRowsTests` (one list · two lists · a full list · a cut-short answer · no list) ·
web `BusinessSearchPage.states.test.jsx`, `useBusinessSearch.resume.test.js`, `rowListRoutes.test.js`,
`earningsChartCurrencies.test.jsx` · phone `businessSearchResume.test.js`,
`businessSearchStatesParity.test.ts`, `businessSearchRowListRoutes.test.ts`,
`dashboardEarningsTileGate.test.ts`, `earningsChartOtherCurrencies.test.tsx`. Web locale-key and
placeholder parity is already covered for all five languages by `src/utils/localeParity.test.js`; the phone's
equivalent is in `businessSearchStatesParity.test.ts`, which also pins that BOTH blanks survive translation.

### 22.6 Sabotage evidence for 22.1 / 22.3

Three of the mechanisms above were broken on purpose and every break was caught. Per §0.19 each file was
snapshot-**copied** to the session scratchpad and restored from that copy — **no git restore** — and every
restoration was re-grepped.

| Broken | Guard | Result |
|---|---|---|
| `!resumable` removed from the web error-box gate | `BusinessSearchPage.states.test.jsx` | **1 failed**, 8 passed |
| `SampledLists == 1` removed, so any list's counts ride the frame | `BusinessSearchSampledRowsTests` | **1 failed**, 4 passed |
| `produced` + `!frameError` removed from the phone's resume arm | `businessSearchResume` + `businessSearchStatesParity` | **3 failed**, 27 passed |

‼️ **"Paints nothing red" was VACUOUS as first written.** The notice sets no error of its own, so asserting
"nothing red" with both error fields null passes whether the red box is gated or not. It now carries a
leftover `localErrorKey` — the reachable case, an error frame arriving before the tab went away.

‼️ **A source-scanning guard that pins an exact literal WILL fail when that literal legitimately moves.** Four
did in this batch. The fix is to update the literal **and add the new gate to the assertion** — never to
loosen the guard into something that would pass either way.

‼️ **Lint errors hide inside the warning count.** These repos carry ~17,000 warnings; three real errors were
only visible under `eslint --quiet`.

### 22.7 ‼️ A SILENT `Done` IS A SAVED ANSWER — the same rule on both apps

A terminal `Done` frame **is** the write the host made. Only an explicit `saved: false` says otherwise:

```
saved = frame.saved !== false;   // both apps — NEVER `=== true`
```

`=== true` locked the ask box after every answer whose `Done` stated no save outcome, and met the member with
*"we could not confirm that this answer was saved"* beside an answer that was on screen. The phone fixed this
first; web carried the old rule for one commit, which is how the gap was found during a rebase. **Two apps
reading the same wire fact by opposite rules is a defect even when the current server makes it unobservable.**

Guard BOTH halves, on both apps: a `Done` with no `saved` leaves the conversation usable, and an explicit
`saved: false` still blocks the follow-up.

Interaction with §22.1 worth stating: with a silent `Done` counting as saved, `!saved` is false, so such an
answer correctly produces **no** resume notice — the write was acknowledged and the answer is complete.

### 22.8 ‼️ Pin the WIRE, not just the two ends

Every server guard on this frame builds the DTO; every client guard hand-builds the JSON. Between them,
**nothing pins the wire.** Change the SSE serializer's naming policy and the frame is still sent, `frame.rows`
is `undefined` on both apps, and the caption silently never appears again — with both suites green.

`BusinessSearchSampledRowsTests` now serializes a real frame with the controller's **actual** `SseJsonOptions`,
read by reflection so the assertion is about the wire and not about a copy of the policy. Both halves: the
three keys when a list was shortened, and the key **absent entirely** when it was not (absent, not null, so
`if (frame.rows)` cannot be tripped by an empty object).

Applies to every field added to this frame from here on.

## 23. SHEET §04 — asking out loud, the three moments and the way back (2026-09-07)

The last third of audit row **U-26** (§02 and §03 were the other two, which is how it was missed on the first
pass). Sheet `business-search-refusal-states` §04. `findings/AUDIT-P5B-LEDGER.md` §21 carries the detail.

Speaking a question had three states the strip could not describe, and no way to say *"that is not what I
said"* without starting over.

| Moment | Rule |
|---|---|
| About to stop listening | `Voice.WrappingUp` / `dictation.wrappingUp` — the seconds LEFT, **never zero**: at zero the recorder has already stopped and a frozen "0" looks stuck. Plural-aware, so it never says "1 seconds" |
| Listening again | `Voice.ListeningAgain` / `dictation.listeningAgain` — names the language **in its own script**, because the person about to speak it reads it that way |
| Would rather type | `Voice.TypeInstead` / `dictation.typeInstead` — offered while listening AND while the words are being written down. There was no exit at all: the only way out was to wait |
| That is not what I said | `Voice.NotRight` / `dictation.notRight` — offered once words have arrived |

‼️ **"Not right?" NEVER RE-SENDS.** It re-opens listening and the words stay in the box; the member presses
Ask. A mis-heard question can never spend one of the day's questions. Distinct from the language chips, which
re-transcribe the SAME clip in another language, and from Try again, which re-sends the same clip unchanged.

‼️ **`start()` / `startRecording()` CLEARS the detected language**, so the language to name while listening
again must be captured at the moment "Not right?" is pressed. It is display state and lives in the panel, not
in the hook. Cleared the moment words arrive, so the next plain listen is not labelled "again".

‼️ **BLUE, not amber.** Running out of recording time was drawn in the same amber as a refusal, so "you have
nearly finished speaking" read as a limit being enforced. Amber stays for a real boundary (too long, offline),
red for a real failure, and blue is the app saying what it is doing. The phone's `stripNearCap` style is gone
rather than left orphaned.

‼️ **The phone had no way to abandon a recording.** `stopRecording()` always transcribes, so leaving needed a
new `cancelRecording()` — it drops the file, so a retry has nothing to re-send either. Web already had `cancel`.

The language name comes from the map that already labels the correction chips (`labelFor`, now exported on the
phone) — never a second copy of the same table.

Guarded: `dictationVoiceMoments.test.jsx` (14, rendered through the real catalogue) and
`dictationVoiceMoments.test.ts` (18, rules scanned + copy in all five languages). Both sabotaged — the blue
tone on web, the language capture on the phone — and each failed exactly one test.

### 23.1 ‼️ An i18next PLURAL SIBLING is not an orphan key

`dictationNeverSends.test.ts` asserts every `dictation.*` key is referenced as a literal in the source. It
failed on `wrappingUp_one` / `wrappingUp_other` — correctly by its own rule, wrongly by its purpose: the code
names the **base** key and passes `count`, so `dictation.wrappingUp_one` never appears anywhere and never
should.

Any orphan-key guard over an i18next catalogue must:

1. strip `_(zero|one|two|few|many|other)` before looking for the reference, **and**
2. require a plural key to really have an `_other` sibling — a lone `_one` would otherwise pass on the base
   name alone, and i18next falls through to printing the key.

The web catalogue has no equivalent hazard: ICU plurals live **inside** one message, so the key is whole.

## 24. THE ANSWER'S ACTION ROW — M7 wins, and the 44px belongs on the HIT AREA (2026-09-07)

‼️ **TWO APPROVED SHEETS DISAGREE about Copy / Helpful / Not helpful.** Read both before touching this row:

| Sheet | Draws | Verdict |
|---|---|---|
| **M7** `business-search-ask-layout` (2026-09-04, **LIVE**, subject = *"the frame of the answer surface"*) | `.mini` chips: 1px border, surface fill, radius 999, **padding 2px 8px** ⇒ ~20px tall · `.foot`: hairline rule, margin-top 9, padding-top 8, gap 5 · `.mini.on`: brand fill | ‼️ **THIS ONE WINS** — its subject IS this surface, it is LIVE, and it gives exact values |
| M10 `business-search-conversations` (2026-09-06) | borderless, transparent, no rule, `min-height: 44px` | A *layout proposal* about the transcript, history and limits. Later ≠ authoritative on a row another sheet specifies |

### 24.1 ‼️ NEVER PUT THE 44px TOUCH MINIMUM ON THE VISIBLE CHIP

Both apps drew M7's ~20px chip and then added the 44px accessibility minimum **to the chip itself**
(`min-h-11` / `minHeight: 44`). A 20px row became 44px **on every answer** — more than double, on the most
repeated element of the page. It is the single biggest waste of space this surface has had, and no test saw it
because every guard asserted behaviour.

**The target moves off the paint and onto the hit area:**

- **Web** — a transparent pseudo-element: `relative before:absolute before:inset-x-0 before:-inset-y-[11px] before:content-['']` ⇒ ≈46px. ‼️ **`inset-x-0`, never `-inset-x-*`**: a horizontal slop lets neighbouring chips steal each other's taps.
- **Phone** — `hitSlop={{top:12,bottom:12,left:0,right:0}}`. This is what React Native provides for exactly this case and it costs no layout.

‼️ **ONE definition for the three chips** — a `CHIP` constant on web, one `footBtn` style on the phone — and a
test asserting all three resolve to the same shape. Three hand-written copies is how one of them ends up 44px
again.

Brand green still FILLS the chosen chip (`.mini.on`, and the owner's standing rule), and the fill changes no
dimension — asserted, so a future "make the selected one bigger" cannot pass.

### 24.2 The money note, and why withholding it was wrong

§06's amber *"Counted apart, never added"* note is BUILT on both apps. ‼️ **It was skipped once on the grounds
that its words "exist nowhere" — they are written verbatim in the approved sheet.** What was missing was only
a row in that sheet's own words panel. §0.20 asks where a state's words come from; **"the approved sheet" is a
complete answer.** Do not withhold a state an approved sheet draws because the sheet's own bookkeeping is
incomplete — say so and build it.

### 24.3 A link's label names its destination from the destination's OWN label

`BusinessSearch.Rows.OpenAll` = `Open {page}`, filled from `sidebar.*` on web and each screen's own title key
on the phone. A page name is never written, or translated, twice. Guarded: every `nameId`/`nameKey` must
resolve to a non-empty string in all five catalogues, or a provider is shown the key.

---

## 25. ‼️ M11 — THE MODERN ANSWER SURFACE, AND THE CONVERSATION'S OWN NAME (2026-09-07)

Approved sheet **`C:\Nik\Data\mockups\business-search-modern-surface\index.html`** (M11). It completes M10
(transcript, name, folded sources, composer footer) and M3 (the listening level meter), and supersedes M10 on
**one point only**: *New conversation* is **outlined, never filled with brand green** — green fills a pressed
or chosen control everywhere else in the app.

### 25.1 The conversation's name — where it comes from

‼️ **THE LADDER, and every surface uses the same one.** The server's name when there is one; the member's own
**FIRST** question when there is not; `BusinessSearch.Conversation.Untitled` when nothing has been asked.
**Never the newest question** — a heading that moves while you read it is worse than a plain one.

| Step | Where |
|---|---|
| Generated | `BusinessSearchTopicService.NameAsync(question, language)` — luna, `reasoning_effort: none`, sub-flow `I2-business-search-topic` |
| **When** | ‼️ Started **beside** the answer stream, not after it (`existing == null` ⇒ first turn only), and awaited just before `PersistTurnAsync`. **No added latency and no extra Cosmos request** — it rides the create that already happens |
| Stored | a `topic` key inside `AiSession`'s **existing** `metadata` dictionary, beside `membershipId`. Not a new entity field; `metadata` is **not** an indexed path on the `Communications` container, so it costs zero index entries |
| Delivered | `BusinessSearchFrameDto.Title` on the **Done** frame (only when `saved`), and `BusinessSearchSessionDto.Title` on the reopen read |
| Kept on the device | `recentQuestions` gains an optional `title` beside `question`, written once and never rewritten |
| Dials | `BusinessSearch:Answer:Topic*` — `Enabled`, `MaxChars` (40), `MinChars` (12), `TimeoutMs` (2500), `MaxCompletionTokens` (64), `Prompt` |

‼️ **THE ONE THAT WILL BITE YOU: the naming call must NOT share the request's cancellation token.** A member
who switches tab or presses Stop still has their turn saved; a naming task bound to that token is already dead,
and that conversation stays nameless for the whole seven days it is kept. `NameAsync` opens its own
timeout-only `CancellationTokenSource` and the controller passes `CancellationToken.None`.

‼️ **CHARACTERS, NOT WORDS.** A word budget is not something a model counts reliably, and five Gujarati words
are far wider on screen than five English ones. 40 is measured: the phone's topic bar gives the name 330px and
a Recent row 300px, ≈40 characters in the widest script the platform serves. The model is told the cap **and**
the server enforces it.

‼️ **`Clean()` is where every reply shape is handled**, and every branch may return null — a null name is the
ordinary path, not a failure. Quotes, markdown emphasis, list markers, a `Topic:`-style label (a **closed list**
of label words, so a real name like `Caterpillar 352: spares` survives), a paragraph, `NONE`, a question echoed
back, and the question repeated verbatim all resolve to null or to a clean name. A cut that cannot land on a
**word boundary** returns null: a mid-word fragment is never worth showing over the member's own question.

‼️ **A naming failure logs at Information and NEVER raises an admin alert.** Nobody is paged for a heading.

### 25.2 What changed on the surface itself

| Change | Note |
|---|---|
| Question is a **bubble** on the member's side; the answer wears the **mark** and the name "Ask Clinket" | M10, superseding M7's "You" tag. `BusinessSearch.Answer.You` / `ANSWER.YOU` are **deleted** in all ten catalogues |
| The answer has **no card of its own** | Three borders around one paragraph. The hairline above the controls is the only rule it needs |
| Sources **fold to one row** on web | The phone has done this since P4.7. `BusinessSearch.Sources.Title` is **deleted**; the row states `Sources.Collapsed` (a plural of **cards**, never citations) and `Sources.TapToOpen`. State is **per exchange** — one shared flag folds every answer together. "Jump to sources" opens the fold before scrolling |
| Copy and the ratings **answer back** | The pair collapses into one `Answer.FeedbackThanks` chip carrying a tick, at the **same chip shape** so the row height cannot change |
| A composer **footer** | `Ask.VerifyNote`, giving way to `Ask.DraftKept` while the box cannot send, plus a counter past 400 of 500 |
| ‼️ **Over the cap, Ask stands down** | Dictation sets the field programmatically and bypasses `maxLength`; the hook then refuses the ask **silently**. `canSend` now includes the cap and the counter turns red |
| The **level meter** while listening | M3's "Listening". The field gives up the row; a halo ring sits behind the stop control. It is a **liveness cue, not a signal reading** — the upload carries no live level |
| House palette in the voice strip | It was the **only** file in the provider web app using stock Tailwind colours and the **only** one with `dark:` classes, which Tailwind applies from the operating system — one dark box in an all-white page |
| The phone's clock is **green ink** | It was hardcoded `#dc2626`, directly beneath a comment saying recording must never look like a fault |
| **Back is not New** | Back returns to the list and **keeps** a half-typed follow-up; New clears it. Both called the same "start again". On the phone the header's back control and the hardware back agree |
| The laptop's width | The column opens 820 → **1100** at `xl`, → **1360** at `2xl`; the answer's **paragraph** stays at `72ch`, because that bound is for reading, not framing. Source cards spread with `xl:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]` and a **max-width on the card**, never on the track |
| `dir="auto"` | On the name, the question bubble and the answer, so an Urdu or Arabic-script answer lays its punctuation out on the right. `writingDirection: 'auto'` on the phone |

### 25.3 ‼️ Traps this phase paid for

1. **An arbitrary Tailwind PROPERTY compiles to nothing.** `[grid-template-columns:repeat(auto-fit,…)]`
   produced no CSS at all — the laptop silently kept two columns. Use the **utility** form
   `grid-cols-[…]`. The only place this failure is visible is the built stylesheet: compile it and grep,
   **decoding** Tailwind's escapes (`\2c` for a comma, `\33` for a leading digit) rather than guessing them.
2. **A `minmax(300px,520px)` track is measured from its MAX**, so a 989px grid fits exactly one column and
   stacks the cards. Put the ceiling on the **card**, not the track.
3. ‼️ **`{/* … */}` is only valid where a JSX CHILD is valid.** Placed straight after `cond ? (` it is an
   expression, and `@typescript-eslint/parser` — which `sourceLocalizationIntegrity.test.js` runs over every
   source file — reports `')' expected.` at the **next** line, so the message points somewhere else entirely.
4. **The phone's back handler listed a per-keystroke callback as a dependency**, tearing down and
   re-registering a native listener for every character typed. Read the draft from a **ref**.
5. **A mock object rebuilt per render loops the page until the heap dies** — the roster and document effects
   are keyed on `can` / `access`. Freeze the mock, as the other suites in this folder do.
---

## 26. ‼️ REPLAY PARITY — A REOPENED ANSWER RENDERS WHAT THE LIVE ONE DID (2026-09-08)

Reopening a conversation returned `{role, content, timestamp}` and nothing else, so everything the answer was
*built from* vanished: every source card with its page and its quoted words, every picture, the id a rating is
filed against, and the "Showing 10 of 47" line — **while the answer's own sentence still named the count**. A
reopened answer disagreed with itself, and its `[n]` markers were deliberately rendered as dead text because
there was nothing left for them to open.

‼️ **THE RULE: what a live answer shows, a reopened one shows. There is no cheaper tier of the same
conversation.** Owner, 2026-09-07: *"there is no degradation whatsoever ... we should not save the money and
storage there to compromise on the functionality."*

### 26.1 What is stored, and what is deliberately not

Everything is stored **with the turn**, inside the existing `AiSession.history[]` — one document, one write,
**no new container, no side documents, no second read**.

| New field on `AiConversationTurn` | Why it is stored rather than re-derived |
|---|---|
| `answerId` | Names the exchange a rating is filed against. Without it a reopened answer could be rated and the rating landed nowhere, so "not helpful" kept no words at all |
| `citations[]` | Built from tool results that exist **only during that stream**. Re-running the tools to rebuild them would be a second answer at a second cost — with different results |
| `citations[].excerpt[]` | ‼️ The evidence the answer was built **FROM**. If the document changed afterwards, the answer still quoted *these* words — so the excerpt is stored, never re-read |
| `rows` | "Showing 10 of 47" — the count the answer's own sentence already states, so replaying one without the other left the answer contradicting itself |
| `images[]` | ‼️ **`docId` + `imageId` ONLY** — see below |

‼️ **A PICTURE'S ADDRESS IS NEVER STORED.** A read SAS dies in `ReadSasExpiryMinutes` (30), so a stored link
guarantees a broken tile on every reopen after half an hour. Neither is the caption: it is the provider's own
live text and they may have corrected it since. Both are minted on reopen by
`BusinessSearchDocumentService.MintStoredImagesAsync`, which re-runs the **same `ResolveAsync`** the page and
text endpoints use — canonical id, partition-scoped point read under the SERVER's `businessId`,
`KnowledgeAnswerableRule`, and the per-document team-search audience — and then additionally checks
`KnowledgeImageStatus.Deleted`, `KnowledgeBlobPaths.IsOwnedImageBlob` and `IsDirectImageBlob`. **A picture the
provider has since deleted, un-shared or restricted is simply absent, which is the correct rendering** — the
strip has one tile fewer and the reopen does not fail. Ids-only is therefore not a storage saving; it is the
only design in which authorization is **re-applied at reopen** instead of being frozen at answer time.

Reads **one document however many pictures or turns name it** (`Dictionary<string, KnowledgeDocument?>`), so a
conversation quoting the same price list in eight turns costs one point read, not eight.

Every field carries `NullValueHandling.Ignore` and is written only when non-empty, so a conversation of plain
answers stores **byte-for-byte what it stored before any of this existed**. `hasFullText` is stored as `true`
or absent, never `false` — the control is drawn only when true, so a `false` costs bytes to say exactly what
its absence already says.

### 26.2 ‼️ ONE MAPPER, ONE MEASUREMENT

`McpSessionService.ToStored(ConversationTurn)` / `ReadBack(AiSession)` are an **exact inverse pair** and the
only conversion between the wire shape and the stored shape. `BusinessSearchConversationPolicy` measures
**what `ToStored` produces**, so the size a question is admitted against is by construction the size it is
stored at. Two definitions of "how big is this" drift, and the drift lands on the member as an answer that
passed the up-front check, ran, spent one of their daily allowance, and then failed to save.

| Dial | Value | Meaning |
|---|---|---|
| `MaxConversationBytes` | 1,600,000 | ‼️ **THE WHOLE STORED DOCUMENT**, envelope included — not just its turns. It replaced `MaxConversationHistoryBytes` (1 MB, turns only), which wasted headroom at one end and left the real ceiling unguarded at the other. Cosmos's hard item limit is **2 MB**; 1.6 MB keeps a 20% margin |
| `MaxTurnExtrasBytes` | 65,536 | What ONE turn may add beyond its words. This is the number `ReserveBytes` sets aside for the **next** answer |
| `BusinessSearchConversationPolicy.EnvelopeBytes` | 2,048 | The document's own fields beside its turns — id, sessionId, userNumber, metadata, timestamps, ttl |

`Program.cs` validates on start that `MaxConversationBytes` exceeds `ReserveBytes(settings)` — **calling the
same function the runtime calls**, so the boot guarantee and the runtime behaviour cannot drift — and caps it
at 1,800,000.

64 KB is deliberately unreachable: `MaxToolResultCharsPerAnswer` already bounds every tool result in one
answer to 18,000 characters and the excerpts are drawn from that same material, so the true worst case is
roughly a quarter of it. `McpSessionService.FitExtras` is the backstop, and it **sheds excerpt text, never a
citation** — a dropped source leaves a `[n]` marker in the answer pointing at nothing. Reaching it logs a
warning rather than passing in silence.

### 26.3 The wire

`BusinessSearchTurnDto` gains `answerId`, `citations`, `images`, `rows`; those four and
`BusinessSearchSessionDto.Title` all carry
`[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`.

‼️ **Absent, not null — and the attribute is required.** MVC's `AddJsonOptions` in this host does **not** set
`DefaultIgnoreCondition`, so without it a plain fifty-turn conversation ships two hundred `null` members. The
reopen response is the one place a whole conversation crosses the wire at once.

`GET /session/{id}` mints in **one pass over the whole conversation's pictures**, then maps them back per turn
by `$"{DocId}:{ImageId}"`. `POST /ask` collects citations and image ids **during** the stream, deduplicated on
the same keys the clients use (`Number`, and `docId:imageId`), so what is stored is exactly the set that
reached the screen. All **three** `PersistTurnAsync` call sites carry them — the normal path, the cancellation
path and the exception path — because a member who closes the tab mid-answer has already paid for that answer.

### 26.4 Both clients

Each hook's restore loop assigns `citations`, `images`, `answerId` and `rows` onto the restored exchange, each
one **guarded** (`if (Array.isArray(...))`, `if (item.rows)`), so a turn carrying none of them leaves the empty
defaults alone rather than overwriting them with `undefined`.

‼️ **The citation-marker rule was never "replayed", it was "no cards".** Both apps now pass
`onCitation={citations.length > 0 ? onCitation : undefined}`. A marker that finds nothing and silently does
nothing is the defect; a conversation saved before sources were kept still renders its markers as plain text,
by the same expression.

### 26.5 Also settled in this phase

- ‼️ **Both controls in the conversation bar answer in ONE colour family.** Back hovered to a neutral grey
  while New hovered green, so two controls in the same bar read as two different systems. Back is now
  `hover:bg-[#F4FFE4] hover:text-[#3A6410] active:bg-[#DFFABD]`; New keeps its border and gains the same
  pressed tint. The hierarchy still holds — New is the bordered, deliberate one.
- On the phone, **New** is a `Pressable` tinting `theme.brandGreenSoft` on press: the phone's answer to the
  computer's hover. **The phone's back arrow is deliberately unchanged** — it is `CommonHeader`'s shared
  control across ~30 screens with no per-screen style hook, and making one screen's back flash green would be
  the inconsistency, not the fix.

### 26.6 Traps this phase paid for

1. ‼️ **Measure BEFORE designing.** A per-turn side-document design was drafted and was wrong twice over: the
   conversation document is **fully rewritten every turn anyway**, so a side document buys no write saving —
   and one written per turn expires **7 days after its own write** while the conversation lives on, so an old
   turn's sources would vanish out from under a conversation that was still alive. Inside the conversation is
   the only design with no TTL skew.
2. **`KnowledgeSearchAudience` has no `Everyone` member** (`Team=0`, `Roles=1`), and `SearchAudience` on the
   document is a `string?`. Compare with `.ToString()`.
3. **A method inserted between a comment block and the method it documents silently re-points the comment.**
   Read the surrounding lines, not only the insertion point.
4. **A size test tuned to a magic number pins the old ceiling.** Derive the fixture size from the settings by
   binary search, so raising a dial cannot silently turn the assertion into a tautology.

### 26.7 Tests

| Suite | What it holds |
|---|---|
| API unit `BusinessSearchReplayParityTests` | `ToStored`/`ReadBack` round-trip; absent-not-false `hasFullText`; `FitExtras` sheds excerpts and never a citation |
| API unit `BusinessSearchConversationPolicyTests` | the reserve covers a whole next exchange **including** its extras; every size derived from settings, never a magic number |
| API integration `BusinessSearchReplayParityIntegrationTests` (8) | ‼️ real Cosmos: a reopened turn carries all four; a **deleted** picture disappears; a picture outside this member's audience disappears; no stored address is ever returned |
| web `replayParity.test.jsx` (11) | draws the SAME exchange live and replayed, and fails if the two ever diverge |
| mobile `businessSearchReplayParity.test.ts` (5) | the wire type, the guarded restore, and the marker rule |

---

## 27. ‼️ KNOWLEDGE EXTRACTION FIX — PHASE 2 (2026-09-13/14; authority `Data\knowledge-extraction-fix-plan\phase-2\`)

The reading lane's own phase. Everything here is in `KnowledgeIngestProcessorFunction` (Functions host) or the
services it drives, and every item was proven on the deployed CA stamp — the register is
`phase-2\LIVE-ACCEPTANCE-2026-09-14.md`, and a row that could not be proven says why instead of claiming ✅.

### 27.1 ‼️ D-1 / A6 — ONE RULE: a document whose cards still answer stays READY, whatever failed

A replacement that could not be read used to stamp the live document **Failed**, while its cards went on
answering callers. The row said the file was broken; the receptionist said otherwise; both were reading the
same document. The rule is now singular and lives in `FailAsync`:

> **Any terminal failure on a document that still has passages leaves it READY and adds a notice — no
> exception for a deliberate refusal or a replacement read as nothing** (F-6, owner 2026-09-14): a space or
> character cap and an unreadable replacement take the same rule with their own sentence. A first upload has
> no cards, so it is stamped Failed. ‼️ **The one case that fails is a failure MID card-rewrite**
> (`cardsRewriting == true`, P4-C-01): the index holds two versions stitched together, so there is no whole
> version to keep — the cards are removed, the row is stamped Failed, and the admin alert
> `KnowledgeFailedMidRewrite` is raised. (Corrected 2026-09-25, P4-I-07.)

- `KeepTheAnsweringVersionAsync` chooses the sentence: `Info_KnowledgeReplacementKeptPrevious` when an
  incoming file failed, `Info_KnowledgeReReadKeptPrevious` when a re-read of the same file did.
- The pending blob is dropped, the original `blobPath`/`docName`/`passageCount` are untouched, and
  `failureReasonKey` is **absent** — the row is not "failed with a note", it is Ready.
- ‼️ Proven live 2026-09-14: replacing a Ready document with a password-protected `.docx` left
  `status=Ready`, `passageCount=4`, the original name, and exactly that one notice.

### 27.2 ‼️ G-L1 — the index is asked whether it took them, before Ready is committed

Four CA documents sat `Ready` with an empty index and nothing told anybody: `GetIndexHealthAsync` was an
**admin pull** that nothing ran. `EnsureTheIndexTookThemAsync(businessId, docId, searchDocs, ct)` now runs
right after the upsert/prune: count → re-upsert once → count again → alert → **throw**. It never commits
Ready on a drifted index, so "Ready" means the cards are answerable, not that a write was attempted.
‼️ Proven live 2026-09-14: `kaudit drift ca` = **58 documents, 58 ok, zero drift**.

### 27.3 ‼️ E12-E — the whole-document Document Intelligence read is BANKED

The most expensive call in the lane was bought again on every pass — a 100-page document that needed three
passes paid three times for the identical bytes, and "Read again" paid it too. `IKnowledgeExtractionCache`
banks it at `{businessId}/_di/{docId}.json.gz`, keyed on **the bytes AND everything that changes what the
service returns** (`ContentHash`, `ModelId`, `OutputFormat`, `IncludeFigures`) — a model or format tune must
MISS, or a settings change would replay the old read forever. Fail-soft both ways: an unreadable bank is a
miss, a failed write costs one re-analyze. A forced-fresh reading re-analyzes unless its OWN reading already banked
this read — an earlier pass of itself (P4-B-27 / J-21: `KnowledgeExtractionCacheKey.Reading` + `ThisReadingOnly`,
the reading stamped in the entry). A picture's read is banked the same way at `_ocr/{biz}/{docId}/di-{pictureHash}.json.gz`
(P4-B-26), inside the prefix the purger already sweeps. The purger sweeps it, so the document purge is **8 steps, not 7**.

### 27.4 ‼️ E-24 — every country gets its own currency, and an alert when none can be found

`DiscoverySettings.TryResolveCurrency` knew **six** countries; every other country silently became USD — on
invoices, bookings, quotes, the cart, services and price marks. It now round-trips the name and falls back to
`new RegionInfo(normalized).ISOCurrencySymbol`, and **a country that still cannot be resolved raises an admin
alert with its own type** (owner-mandated 2026-09-14: "we cant miss that it is must and important"). The
business ADDRESS decides, never the service area.

### 27.5 ‼️ D9 — a floor in the document outranks the reader's price type

`Balayage from $150` was saved as a flat fixed $150 — the provider's own file contradicted, on money.
`TheDocumentSaysStartingFrom(candidate)` reads the document's own words (`from `, `starting at`, `starts at`,
`starting from`, ` and up`, ` onwards`, ` upwards`, and a price token ending `+`) and, for a SINGLE amount
only, writes `priceType = "range"` with **no** `maxPrice`. ‼️ `$20-30` is a real range with a real maximum and
is never flattened. Proven live 2026-09-14 on five lines at once, including the negative control.

### 27.6 ‼️ E-12 — a row's identity includes the heading it sits under

Two `Regular $50` lines under *Facials* and *Massages* are two offerings. The detector made two candidates and
the BUILDER collapsed them again, because its dedupe keyed on the name the READER produced. It keys on
`RowHash` now — `(name, priceText, sectionPath)` — and the card shows its heading and the document's own line
when two cards share a name and a price. Proven live: 7 candidates → 6 drafts, both `Regular` rows present
with distinct row hashes.

### 27.7 ‼️ E-19 — a file that lists prices before names SAYS SO

A photographed menu whose OCR emits the price column first cannot be paired in either direction, so the
pairing refuses — correctly. Saying nothing about it was the defect: the section produced no suggestions and
the row read "no services found" about a file that is nothing but prices. `UnpairedPriceLines` rides the
reading into `Info_KnowledgePricesWithoutNames`, and the artefact banks it so a REPLAY says the same thing.

‼️ **THE SHAPE RULE THIS TAUGHT, and it is the reusable lesson:** `KnowledgeExtractionOutput` is a **record**,
and every copy is `original with { … }`. Hand-listing its fields lost, silently and invisibly, every field the
list did not name — it had already cost `CeilingCollapsedPlacements` (the picture-ceiling alert could never
fire) and `RenderedPages` (a wrong sentence to every provider) before anyone noticed. Two sabotage-proven
guards now hold it: the ingest may hand-build exactly ONE reading (the replay, which has no parser output to
start from), and every reading field the artefact banks must be read back by that replay.
‼️ Proven live 2026-09-14 on five shapes. An eight-minute window where it fired on some documents and not
others turned out to be a ROLLING DEPLOY, not a defect — see `LIVE-ACCEPTANCE-2026-09-14.md` §5.1 and
`PROGRESS-SESSION2.md` §15.10, because that trap will be laid again.

### 27.8 E9 — what a refusal costs, and what it must not cost

- **E9.1** a file whose declared size is zero is refused **before** Document Intelligence is called: proven
  live with `status=Failed`, `Error_KnowledgeUnreadable`, no `pageCount`, no analytics — nothing billed.
- **E9.6** the blob is read in ONE allocation of the declared size, and a blob that GREW during the read is
  refused: a file that changes under the reader is not the file that was granted.
- **E9.4** `TryMarkFailedAsync` returns `Failed` / `NothingToFail` / `CouldNotWrite`, and the caller alerts
  only on `CouldNotWrite` — a Ready document raised a "stuck" alert for a failure that had nothing to write.

### 27.9 E-21 — the drafts queue's cost

Five partition COUNTs per render on a POLLED screen became one aggregate, and approve-all, dismiss-by-document
and dismiss-by-kind hand their already-read rows to the core instead of point-reading each one again. See the
drafts section of the voice-assistant skill for the SQL shape and the CAS rule; `PROGRESS-SESSION2.md` §15.9
for why the first shape was refused by the engine.

### 27.10 ‼️ The three method lessons of this phase

1. **A source-shape test certifies WORDING, never that the engine will run it.** E-21's aggregate compiled,
   read correctly, passed its text test, and 400'd on a real account. Every new query shape needs the
   emulator test too.
2. **A guard can agree with its own registry while neither agrees with the code.** The API's settings
   convention test was green about a key the host read and nothing configured. The second guard reads source.
3. **Run the thing.** Both of this phase's worst defects — the collapsed dedupe and the hand-written copies —
   were invisible to thousands of unit tests and were found by pushing a file at the deployed stamp.

## ‼️ X-01 — AN AI-WRITTEN SOURCE NOW SAYS SO (Phase 3, 2026-09-15)

The phone has labelled every result with its truth channel since EX-05. **Business Search did not** — so our
vision model's reading of a PHOTO ("Atlas Copco GA 22 rotary screw compressor") and a summary WE wrote about
a document arrived in one undifferentiated list beside the provider's own price rows, and the model stated a
brand, a model number or a count as something the DOCUMENT said, citing that document beside it.

- `KnowledgeSourceChannel.Of(kind)` is **the one implementation**, shared by phone and screen. The default is
  the AI's own words, never the document's: a card kind nobody has classified must not inherit a price list's
  authority.
- The tool payload row carries `channel`; the citation DTO carries `Channel`, **absent** for the document's
  own words — so an ordinary card costs nothing on the wire and an absent value can only mean "the provider's
  own words".
- **Prompt rule 9** (appsettings AND the class default, now pinned byte-identical by
  `BusinessSearchPromptConventionTests`, which also proves the rule numbering has no gaps).
- Web and mobile draw a **"Described by AI from a photo" / "Summary written by AI"** chip beside the existing
  not-published chip.

‼️ **STILL OPEN:** a REOPENED answer replays from `AiTurnCitation`, which maps field by field — so the mark
disappears on reopen. Carrying it needs one nullable Cosmos field; the §0.7 ask is written out in
`Data\knowledge-extraction-fix-plan\phase-3\PROGRESS.md` §7 and is NOT built.

## The query contract is now shared with the phone
`KnowledgeSearchQuery.Text` is gone; both surfaces pass `Renderings` (N per-script legs) and there is ONE
`SearchForProviderAsync`. Two overloads meant a fixture could stub the one the tool does not call, Moq
returned a null Task, and every knowledge test silently passed through the degraded path.
`BusinessAlphabetService` takes `BusinessSearchScriptSettings` — the section it actually reads — so the voice
hosts can resolve an alphabet set without binding a forty-key block they never touch.
---

## 28. ‼️ SAVED CONVERSATIONS AND STANDING INSTRUCTIONS (2026-09-17; authority `Data\ask-clinket-history-and-rules\PLAN.md`)

> Owner-reported: *"I'm seeing it in my search page but when I restart or review it later all those conversations
> was gone."* They were never lost — the **way back to them** was.

### 28.1 The defect, and why the fix is not "stop purging"

The Recent lane was `localStorage` only (`clinket.askRecent.{businessId}:{membershipId}`, 8 rows, one device),
and `purgeClientState()` swept it — **on every successful sign-IN as well as sign-out**, on both apps. So every
login wiped a member's own history while the conversations sat in Cosmos for the whole TTL, unreachable because
their session ids were gone. Mobile was identical (`tokenManager.clearAuthTokens`).

‼️ **The sweep was not a bug to delete.** It existed so a shared browser did not leave the previous member's
questions on screen. Moving the index SERVER-SIDE and member-scoped fixes the report *and* strengthens that
property: the next person fetches with their own token and sees their own list, not an emptied one.
**`recentQuestions.js` / `.ts` and `handConversationOver` are DELETED. Do not reintroduce a device cache** —
`clientStatePurge.test.js` and `businessSearchScreenRegistration.test.ts` both fail if one appears.

### 28.2 ‼️ THE SHAPE, and the two designs that were rejected

**One small header document per CONVERSATION** — `BusinessSearchConversation`, in **`Communications`**, the same
container and the same partition (`/userNumber` = businessId) as the `AiSession` it names.
`id = bsconv_{membershipId}_{sessionId}`; fields are `membershipId`, `sessionId`, `title`, `renamed`,
`firstQuestion`, `turnCount`, `createdAt`, `lastActivity`, `ttl`. ~300 bytes.

| Rejected | Why |
|---|---|
| Query `AiSession` directly | `metadata.membershipId` is **not** an indexed path, so Cosmos loads whole conversation documents — up to `MaxConversationBytes` (1.6 MB) each — to filter. Unbounded, and it grows with use |
| One array per member | An unbounded array rewritten on the hottest path: RU proportional to the whole history **per answer**, CAS contention between tabs, and Cosmos's 2 MB item limit forcing a ceiling. Every wart (the ceiling, the paging question, an `expiresAt` field, a pruning sweep) was a symptom of this shape |

**Chosen shape's properties:** ~5 RU per answer **constant forever**, no ceiling at any number, no contention,
delete is one small delete, and ‼️ **no expiry field, no read filter, no pruning, no sweep** — each header
carries its own TTL, re-stamped on the same turns as its conversation with the same seconds, so the two expire
together. ‼️ **This is NOT the per-turn side document §26.6 forbids**: that one was written per TURN and expired
on its own clock while the conversation lived on. This is per CONVERSATION and is rewritten with it.

**Index:** ONE new path `/membershipId/?` + ONE composite `(type, membershipId, lastActivity DESC)`. Measured
before adding: **no existing entity on the platform carries a top-level `membershipId`**, so the path costs zero
entries on every notification, message and session already in that container. `Communications` was chosen over
`SystemData` because it already indexes `/type` **and** `/lastActivity`, leaving one path instead of two.
‼️ Filter columns LEAD the sort column or the composite does not bind in production, even though the emulator
permits it.

### 28.3 No paging, and why that is not a trade-off

One query returns **every** header (`MaxQueryRows` 2,000 bounds only the read, and 60 questions a day for
`SessionTtlDays` caps a member at 1,800). `Conversations:PageSize` is **rows DRAWN, never rows fetched**.
Server-side paging would buy nothing and would break the find box, which is instant and works offline precisely
because every name is already on the device. The lane shows a few and links *See all N*; the panel filters what
it already holds.

### 28.4 ‼️ RETENTION IS 30 DAYS, AND THE PROTECTION IS PART OF THE PRICE

`SessionTtlDays` 7 → **30** (owner, 2026-09-17). `AUTHORIZATION-DESIGN` §3.8 names retention beyond seven days
as a **trigger**, and this is what answers it — not the costed `AuthorizationVersion`, which was rejected as too
coarse (any role change would withhold every past answer, including ones that needed no permission and ones
where the member was GIVEN more).

**`AiConversationTurn.usedPermissions`** — `List<string>?`, assistant turns only, **absent** when the answer
needed no gated tool, which is the common case and costs nothing. Written by `BusinessSearchAgent` from the
tools that actually RAN (after gate 2), inside the write that already saves the turn.

‼️ **THE ENTRY IS `key:Scope`, AND THE SCOPE IS LOAD-BEARING.** A key-only check was written first and
`BusinessSearchConversationEndpointsIntegrationTests` caught it: **`technician` holds `invoice.read` at ASSIGNED
scope** — their own work only — so an answer an OWNER produced across the whole business read as "still held"
and four unpaid invoices stayed on screen. `PermissionScope` is ordered narrow→broad, so requiring the scope held
at answer time withholds on a NARROWING and never on a widening. `Required(entry)` **fails closed** on anything
unparseable (no scope, unknown word, blank key ⇒ Business).

A withheld answer returns `Withheld: true`, **empty `Content`** and the server's `WithheldReason` — the words
never reach the wire. The question is still there and the conversation still opens. The reason names the
permission by its **existing member-facing name** (`Permission_invoice_read_Name`, "View invoices"), already
translated in five languages and already what the role dialog shows — one vocabulary, no new topic keys.
`askRules.answerControls` then draws no rating, no Copy, no source cards and no `[n]` markers.

### 28.5 ‼️ ONE HOME FOR A CONVERSATION'S NAME

`AiSession.metadata.topic` is **GONE**, and so is `AiConversationContext.Topic` and the `topic` parameter on
`AppendTurnsAsync`. A generated name and a member's RENAME would otherwise be two copies of one name, and a
renamed conversation reopened under the old one. The header owns it; `GET sessions/{id}` point-reads the header
(+1 RU) for the title.

### 28.6 The standing instructions

`BusinessSearchRules` in `SystemData`, `pk = businessId`, `id = bsearchrules_{businessId}` — a point read,
cached per business with `Size = 1` and **never cached on failure**. ‼️ **Deliberately NOT on `BusinessProfile`**,
which is projected onto the PUBLIC Open Page and into the search index: an internal rule must have no path to a
public surface.

**Permission `ai.answers.manage`** — new, Business scope, granted to `primary_owner` + `administrator` only
(through the catalogue's `everything` list, named by no other role). ‼️ Grants are **never written to SQL**, so a
new key is a pure code change with **no migration**. Not `voice.settings.manage` (Ask Clinket is not behind the
AI package) and not `business.profile.update` (would hand it to `catalog_manager`). `WRITE` is the ONE endpoint
on this controller not gated on `business.profile.read`, and `BusinessSearchConventionTests` names that single
exception explicitly.

**In the prompt** — `BusinessSearchRulesPrompt`, appended **LAST in the system message**, after ACCESS and NOT
SET UP: near the start a per-business block would break the prefix cached across every business.

‼️ **THIS SURFACE DIVERGES FROM THE PHONE ASSISTANT ON PURPOSE.** There the owner's instructions are declared
SUPREME over the whole prompt. Here they are explicitly **SUBORDINATE** to four things — every fact still comes
from a tool result, nothing from the rules is ever cited or repeated, the role and not-set-up refusals are
unchanged, and the answer language is still the asked one. The worst outcome on a call is an unhelpful caller;
the worst outcome here is a member acting on a figure about their own business that nothing in that business
says. The four limits are stated **BEFORE the owner's words and again after them**, because the owner's text is
otherwise the most recent thing the model reads and recency is what a rule trying to talk past a limit relies on.
`BusinessSearchRulesPromptTests` fails if the voice wording ("HIGHEST AUTHORITY", "OVERRIDE every other
instruction") ever appears here. Sabotage-verified: removing the closing restatement turns it red.

‼️ **A BUSINESS ON THE DEFAULTS ADDS NOT ONE CHARACTER.** `Balanced` and figures-as-table ARE today's behaviour
(rule 5 already mandates both), so both emit nothing; only Brief, Detailed, switching the table off, or writing
a rule changes anything. That is what makes "this costs existing businesses nothing" provable rather than
asserted.

### 28.7 The endpoints

| Verb | Route | Gate |
|---|---|---|
| GET | `conversations` | `business.profile.read` — 503 when unreadable, **never an empty list** |
| PATCH | `conversations/{sessionId}` | `business.profile.read` |
| DELETE | `conversations/{sessionId}` | `business.profile.read` |
| DELETE | `conversations` | `business.profile.read` — returns `{requested, deleted, failed}` |
| GET | `settings` | `business.profile.read` — **every member reads the rules** |
| PUT | `settings` | ‼️ `ai.answers.manage` |

‼️ **DELETE MEANS DELETED, AND THE ORDER IS LOAD-BEARING**: ownership is proven by a member-scoped read, then
the **conversation dies first and its row second**. A half-failure then leaves a row that opens to "no longer
here" — visible, retryable, idempotent. The reverse order would leave live data the member believes is gone.
A partial delete-all is **reported**, never rounded up to success.

### 28.8 Traps this phase paid for

1. ‼️ **A LOCAL `const conversationName` SHADOWED THE IMPORTED RULE** — on BOTH apps, independently. The lane
   would have called a string at runtime. Web's ESLint caught it as "import never used"; mobile's `tsc` caught
   it as "not callable". Both bars now run the SAME ladder as the rows, which is what the sheet asked for.
2. **`writingDirection` is a STYLE in React Native, never a prop.**
3. **The parity suite is a fixed case list, not an enumeration** — new shared rules are NOT compared until
   cases are added. Six were, and the comparison is sabotage-verified (one changed constant turns it red).
4. **CRLF.** `askRules.js`, the web page and several suites are CRLF; a plain LF anchor silently matches
   nothing and the edit reports success having done nothing.
5. **Check what the fixture swapped out** before believing an integration assertion — and conversely, the
   scope defect above was found ONLY because the test ran against real Cosmos with a real role.

### 28.9 Where it lives

| | web (`clinqetwebpartnerapp`) | mobile (`clinqetmobilepartnerapp`) |
|---|---|---|
| list | `components/businessSearch/ConversationListPanel.jsx` | `components/businessSearch/ConversationListSheet.tsx` |
| rules | `components/businessSearch/AnswerRulesPanel.jsx` | `components/businessSearch/AnswerRulesSheet.tsx` |
| hook | `hooks/useAskPanels.js` | `hooks/useAskPanels.ts` |
| shared rules | `lib/businessSearch/askRules.js` §saved conversations | `lib/businessSearch/askRules.ts` (twin) |
| entrances | clock + gear on the page's own bar | clock + gear in `CommonHeader`'s right cluster |

Sheets **H1** (`business-search-conversation-history`) and **R1** (`business-search-answer-rules`), registered in
`Data\ask-clinket-history-and-rules\PLAN.md` §0.

### 28.x ‼️ The panels’ look (restyled 2026-09-18 after the owner used the live screen)

- **Both panels sit in ONE shell, `AskSheet.jsx`** — a floating card from the right on laptop/iPad, a bottom sheet below `sm` (the breakpoint is READ via `matchMedia`, not only styled, because the motion differs). Spring `stiffness 320 / damping 30` — the call follow-ups filter drawer’s. `AnimatePresence` in `BusinessSearchPage` is what makes them animate OUT. `useReducedMotion` turns the spring off. `AskSheetDialog` + `SHEET_BUTTON` are the only confirm card and button shapes.
- ‼️ **The app body font is ARIAL.** A screen is in Lufga only if it says `font-[Lufga]`; the Ask page root now does. A panel without it rendered Arial, and `font-extrabold` turned that into the heavy look the owner rejected. House weights: headings `font-semibold`, controls `font-medium`, never extrabold.
- ‼️ **No pale-lime (`#F4FFE4`) hover on this surface** — it reads as yellow. Hovers are neutral `#F5F5F5`; brand green fills only the chosen/open item and the primary button. Buttons are `rounded-xl`, not pills.
- The header history + gear are **solid brand-green circles with a navy icon** — the phone call follow-ups header gear. Icons are `lucide-react` (web) / Ionicons (phone), never hand-drawn SVG.
- Rules panel is built from the house parts: `FloatingTextarea` (its own near-cap counter — no second counter), `CustomToggleSwitch`, a sliding segmented track for answer length (`layoutId`).
- ‼️ Conversation rows have NO exit animation: on a filter it faded 20 rows per keystroke beside the new ones. Rows use `layout="position"` so the survivors glide instead.
- Phone parity: same weights (`700` titles, `600` controls — no `800`), 12-radius buttons, row cards without separators, `mutedSurface` for the open row, `successSurface` for “saved”.

---

## 28. ‼️ THE PAGE A SOURCE NAMES, AND THE PAGE IT CAN SHOW (2026-09-18)

Owner-reported: every citation's "show page" answered **"This page can't be shown right now"**, on every
document, and one source's page number looked a page out. Three separate defects, one root idea.

### 28.1 ‼️ A LOCATOR IS NOT A CONTROL

`citation.page` answers *where in the file the words are*. Whether that page can be put on screen is a
**different fact**, and the card was drawing its control from the first one.

A cached page transcript is absent for **six ordinary reasons**: the file was never rasterized (a deck, a
spreadsheet, a web page), the reading ran out of time, a page could not be read, the 180-day sweep took it,
the model or prompt in the cache key moved on, or the document is over the page ceiling. Every one of them
produced a red box under a perfectly good answer.

| Wire field | Means |
|---|---|
| `Page` | the LOCATOR — unchanged meaning, now correct for every format |
| `PageKind` | `Slide` for a deck; **absent means Page** |
| `PageViewable` | the saved page EXISTS — proven, never assumed |

- ‼️ **PROVEN by an existence check**, one per distinct `(docId, page)` per answer, concurrently —
  `IBusinessSearchDocumentService.ViewablePagesAsync`, which composes the key through
  `KnowledgeBlobPaths.OcrPageBlob`, the SAME helper `GetPageAsync` reads with. A card that offers page 6 is
  offering the page the endpoint will serve.
- ‼️ **NOT PERSISTED with the turn** — a saved page can be swept afterwards, so the reopen path re-asks
  (`PageAvailabilityAsync`, keyed `"{docId}:{page}"`, never positional: citation numbers restart per turn).
  Same design as the image ids (§26.1): availability re-applied at reopen, never frozen at answer time.
- ‼️ **A storage failure WITHHOLDS the control.** Drawing a button that then fails is the defect.
- Client: `canOpenPage` gates the action; `citationAction` falls back to `text` (itself gated on
  `hasFullText`), then to no control at all. The card still shows its excerpt (M9), so nothing is lost.
- ‼️ `BusinessSearchCitationDto` is now a **record** — a copy is `original with { … }` and cannot drop a
  field, the same reason `KnowledgeExtractionOutput` is one (§27.7). `AiTurnCitation`, the Cosmos entity, is
  **untouched**: the two new fields are wire-only, so **§0.7 never fired**.

### 28.2 ‼️ A DECK HAS SLIDES, AND A DECK IS NEVER RASTERIZED

`.pptx` sat in `PaginatedExtensions`, so a slide number shipped as a `page` and every PowerPoint citation
offered a control that **could not ever work** — `ParsePptx` reads the package, nothing renders pages.
`KnowledgePageLocator` now answers both questions from the file name: `KindOf` (Page/Slide/None) and
`Rendered` (only the DI + vision lane banks page transcripts). A deck keeps its **Slide 3** locator, is never
probed, and opens as the whole document instead.

### 28.3 ‼️ HTML / TXT / MD / JSON HAD NO PAGES AND CLAIMED PAGE 1

B2 fixed this for Word and Excel (`PageCount = null`); `ParseHtml`, `ParseText` and `ParseJson` kept
returning a placeholder **1**, so every card of those formats carried `pageNumber: 1` into the index. It was
masked at the citation by `ShowablePage`'s extension list, and wrong everywhere else. All three return
`null` now, and `ParseText(isMarkdown: true)` does `ParseLayoutMarkdown(text) with { PageCount = null }` —
that reader counts page breaks for the RENDERED lane, so a typed `.md` always came back claiming one.

‼️ **The page CEILING no longer fires for these formats, and that is correct**: `MaxPagesPerDocument` bounds
per-PAGE billing, and at 100 it could never have fired for a file reporting 1. `MaxExtractedCharacters` is
what bounds them, and it maps to the same "too long" notice.

### 28.4 The page numbers themselves were already right — measured, not assumed

**216 live cards across two real PDFs, 0 wrong pages**, checked against the per-page transcripts the parser
itself consumed (`_ocr/**/pNNN.json`). The one genuine mislabel found in the live index — a card opening
with page 21's *footer* and page 22's *header*, labelled 21 — was already closed by the 2026-09-11 furniture
strip; the live rows simply predated it. Re-reading both documents fixed them.

- ‼️ **A card labelled by its FIRST sentence is only right because a page change closes a card past
  `MinTokens` (X-06) and because a running header/footer reaches the cards only ONCE.** Since 2026-10-02 the reading
  keeps every page's copy (marked `IsPageFurniture`, never deleted — deleting one swallowed three pages of prices);
  `KnowledgeChunker` carries each distinct furniture text in one card (`furnitureSeen`). Break either and the label drifts.
  Since 2026-10-03 (`KnowledgeSectionScope.SortBanners`): a banner on every content page is its own card once; a banner on
  SOME pages rides the section path of those pages' blocks whole, after the headings, unless it cannot fit whole in 120 chars
  (then its own card once); a one-page line stays with its words. A page that opens on new words starts a fresh section path
  (`KnowledgeBlock.ContinuesPreviousPage`), so a card is no longer filed under the previous page's last heading.
- ‼️ **Pages with no card are not always a defect**: `DeduplicateWithinDocument` keeps ONE copy of content a
  document repeats verbatim (a checklist printed once per product), cited at its first occurrence.
- ‼️ **An ImageCaption is a vision DESCRIPTION, not page text** — token overlap against neighbouring pages
  is not an oracle for it, and treating it as one produces false mismatches.

### 28.5 The live repair

The cache key's extension changed `.md` to `.json` in `f6b2d00` (2026-09-10). Documents ingested **before**
that kept `.md` pages the reader could never find — **53 of 240 blobs in CA, all one business** — and every
page of both its documents 404'd. A re-read (`POST knowledge/documents/{docId}/reprocess`) rewrote them;
every real page now answers 200 and page N+1 correctly 404s.

‼️ **The lesson is the design, not the data.** A cache key change silently 404s every page for ever, and the
only signal was one Information log. With `PageViewable` proven per answer, that drift now shows up as *no
page controls anywhere* — visible, rather than a red box per click.

### 28.6 The rest of the surface, same session

| Change | Note |
|---|---|
| **A marker REVEALS its source** | `[4]` opens the sources fold, brings that card into view and marks it — it no longer fires a page request, and no longer NAVIGATES THE WHOLE PAGE AWAY for a work kind. The card's own control is one deliberate tap further on, and it is the only place that knows whether the control can work |
| **The answer's speaker is Clinket AI** | `BusinessSearch.Answer.By`, its own key. It printed `BusinessSearch.Title` — "Ask Clinket" — so the page title appeared twice and read as an instruction |
| **The conversation count is worded, in the footer** | "3 conversations · Kept for 30 days". A bare pill beside the title said a number and not what it counted |
| **The row menu FLIPS UP** | Pinned below its button it opened past the bottom of a phone sheet. Deliberately NOT `useAnchoredPanel`: that rule positions `fixed` against the viewport and this sheet is transform-animated, so a transformed ancestor becomes the containing block. Staying `absolute` and choosing only a SIDE keeps one coordinate space |
| **Recent conversations in navy ink** | Near-black at 13.5px made four reopen rows the heaviest thing on a quiet landing. House hover idiom (§26.5) |
| **The drawer's close control stops looking chosen** | `showModal()` with no target focuses the FIRST focusable descendant; `ModalDialog` now focuses the dialog (`tabIndex={-1}`, outline suppressed). AND `hoverOnlyWhenSupported` app-wide — a touch screen keeps the last-tapped element in `:hover`, so every `hover:` class in the app read as stuck |

### 28.7 ‼️ DICTATION — speaking twice adds up, and a held-open mic closes itself

- `joinSpoken(base, spoken)` lives in the **twins**, so both apps join identically. `send`/`transcribe`
  append against the text the listen STARTED from, captured from the **FIELD** (`getBaseText`), never from
  the hook's own last transcript — the member may have edited it.
- ‼️ **A retry and a language correction re-send the same clip, so joining against the same base REPLACES
  that clip's words** rather than adding a second copy. One rule, neither caller needs to know which it is.
- ‼️ **"That is not what I said" passes `replaceLast: true`** — it keeps the PREVIOUS base, so the mis-hearing
  goes rather than being appended to.
- ‼️ **An empty clip KEEPS the base.** Clearing it threw away everything already said.
- **Silence stop**: `AIAssistant:SpeechToText:SilenceStopSeconds` (5), delivered through AppConfig beside the
  other two caps. ‼️ Counted in **CAPTURED seconds** from the recorder's own buffers, not wall-clock — a
  backgrounded tab throttles timers while the audio graph keeps delivering. ‼️ `0` turns it off, so the config
  mappers must NOT run it through `toPositiveNumber`.
- ‼️ **THE MOBILE DEFECT THIS FOUND: the one-minute cap transcribed and THREW THE WORDS AWAY.** Both
  automatic stops call `stopRecording` inside the hook and dropped the promise, and only `handlePress`
  delivered. The hook now holds `transcript` and ONE effect delivers it, guarded on the value.
- `endedBy` (silence / cap / null) so the strip says which happened, in blue — the app describing itself,
  never a limit being enforced.
- The level maths lives in `src/services/pcmLevel.ts` on the phone, AWAY from `wavRecorder`, which binds the
  native `react-native-audio-record` that Jest cannot load — a rule about audio thresholds that nothing runs
  is a rule nobody has checked.

### 28.8 Where the guards live

| Suite | Covers |
|---|---|
| API `BusinessSearchPageAvailabilityTests` (29) | the locator, the kind, the probe, the deck, a storage failure, one-read-per-document, the reader/probe size agreement |
| API `DictationSettingsConventionTests` | the silence dial is configured, mirrors its class default, and can actually fire inside the cap |
| Functions `KnowledgeParserPageCountTests` (9, one driving the real chunker) | every format's page count, and that a rendered document still counts its real pages |
| web `askRules.test.js` · mobile `businessSearchRules.test.ts` | `canOpenPage`, `pageUnit`, `joinSpoken` |
| web `SourceCard.grouping.test.jsx` (26) · mobile `businessSearchSourceCardParity.test.ts` (29) | the page prints and the control does not, the deck says Slide, no control at all when neither works, and the button names the page it will OPEN when the parts span pages |
| web `ConversationListPanel.test.jsx` (27) | the menu flip on four viewports, the outside-press close, the worded count, and that Delete all still confirms |
| web `ModalDialog.focus.test.jsx` (7) | the dialog is focused, not the first control; `hoverOnlyWhenSupported`; `focus-visible` only |
| web `useDictation.append.test.js` (13) · web `AskBox.test.jsx` · mobile `dictationSilenceAndAppend.test.ts` (20) | append, replace-last, the empty clip, the silence window, captured-seconds, the off switch, a REPEAT of the same words counting as a new delivery, and the stop flag claimed before the await |

All sabotage-verified. Per §0.19 every file was snapshot-**copied** to the scratchpad and restored from that
copy — no git restore.

### 28.9 ‼️ EVERY FORMAT, MEASURED LIVE — one document per lane, end to end

One file per supported format was uploaded to the CA sandbox through the real SAS → blob → confirm path and
every surface read back. **This is the matrix the design has to hold, and it does:**

| Uploaded | Row `pageCount` | Index `pageNumber` | `GET pages/1` | `GET text` | Card shows |
|---|---|---|---|---|---|
| `.pdf` | real | real | **200** | 200 | page control, `Page N` |
| `.png` (photo of a price list) | 1 | 1 | **200** | 200 | page control, `Page 1` |
| `.pptx` (5 slides) | 5 | 1, 2 | **404** | 200 | `Slide N` locator + **whole document** |
| `.docx` · `.xlsx` · `.csv` · `.html` · `.md` · `.txt` · `.json` | **null** | **null** | 404 | 200 | no position at all, whole document |

- ‼️ **A 404 on a page is only reachable by a hand-typed URL now** — no card ever offers one. The deck is the
  proof: it has a real *position* (slide 2) and no *page* to show, and those are the two facts §28.1 split.
- ‼️ **The text fallback answered 200 for every one of the nine**, which is what makes withholding the page
  control safe rather than a dead end.
- **The three states, proven by removing the thing each depends on** (and restoring it byte-exactly):
  delete the cached page blob → the citation keeps `page: 1` and loses `pageViewable`, and the card offers
  the whole document; delete the text artefact → `hasFullText` goes too and the card draws **no control at
  all**, still showing its excerpt; restore either → it comes back on the next answer **and on reopen**,
  because `PageAvailabilityAsync` re-asks rather than replaying what was stored.

### 28.10 ‼️ WHAT THE CLOSING AUDIT FOUND — nine defects, all in the change itself

Read line by line after the live run. Every one of these shipped green tests before it was caught.

| # | Defect | Why it mattered |
|---|---|---|
| 1 | **"Show page" with a hole where the number belongs** | The button read `group.page`, which M9 §1 deliberately leaves **null when the parts sit on different pages** — and then opened the lead's page anyway. `opensPage = citation.page` names the page that will actually open. Found LIVE, not by a test |
| 2 | **The slide/page word came from the group too** | Same null, so a deck quoted on two slides would say "Show page 1". Taken from the lead, like the number |
| 3 | ‼️ **The same words spoken twice were DROPPED** | Both apps keyed delivery on the transcript STRING. Clear the box, say the same thing again, and the string is identical — read as "already applied". `transcriptVersion` counts DELIVERIES; the words are not a key |
| 4 | ‼️ **A double stop on the phone** | Three callers can stop one recording (the member, the cap, the silence watcher) and `isRecordingRef` was cleared **after** the first `await` — two teardowns, and the clip transcribed and paid for twice. Claimed before the await now, as web already did |
| 5 | **A hand-written projection with no guard** | `ToStored`/`FromStored` list citation fields by hand, and so did the test — a NEW field is lost on reopen with every suite green. A reflection guard now fails the build unless each field is stored **or named** in `RecomputedOnReopenNeverStored` with its reason |
| 6 | **An unbounded fan-out on reopen** | One answer probes a handful of pages; a whole conversation of `MaxConversationTurns` can name hundreds, all at once. Bounded by `BusinessSearch:PageProbeConcurrency` (8) |
| 7 | **Storage work for turns nobody will see** | The reopen minted read-SAS and probed pages for **withheld** turns. The withheld decision is made once now and feeds both passes |
| 8 | ‼️ **`hoverOnlyWhenSupported` has a second half** | With hover correctly withheld from touch, anything drawn ONLY on hover is invisible on a phone **and still tappable**. A `coarse:` variant (`@media (pointer: coarse)`) now reveals the inbox's report control. Proven by compiling the utility, not by reading the docs |
| 9 | **A row menu that only Escape could close** | A press anywhere outside closes it now (`pointerdown`, so the choice is made before the press lands on whatever is beneath) |

**And two outside the change, in the same feature:**

- ‼️ **`AIAssistant:SupportedAudioFormats` shipped TWELVE formats, each twice** — the six in the options class
  and the six in `appsettings.json`. **A bound collection is APPENDED to its class default, never replaced.**
  The appsettings copy is gone; the class default stands alone, because the Functions host binds `AIAssistant`
  and configures no formats. Guarded by `AudioFormatConfigurationTests` against the real file, all three stamps.
- **A tautological guard of my own**: `Assert.Equal(paginated, pageCount is > 0)` restated the ingest's
  expression instead of running it. Replaced by driving the REAL `KnowledgeChunker` with the same blocks and
  only `Paginated` differing — same input, two answers.

**The one place the two apps still differ, deliberately:** the web marker *scrolls* its card into view; the
phone opens the fold and marks the card without scrolling. The fold sits directly under the answer there, and
scrolling a nested card inside a `FlatList` item needs `measureLayout` plumbing through the exchange boundary.
Stated here so it is a decision, not an omission.

---

## 29. ‼️ KNOWLEDGE — PHASE 4 CLOSING AUDIT (2026-09-25; `Data\knowledge-extraction-fix-plan\phase-4\FINAL-AUDIT.md`)

The ingest, vision, parser and drafts changes are in `clinqet-voice-assistant` ("RECENT CHANGES — 2026-09-25");
this section is what changed on the Business Search side of the shared retrieval.

- ‼️ **The leg cap is never silent (P4-E-01).** `BusinessSearchScriptPlan` gains `UnsearchedAlphabets` (business
  alphabets the cap left without a leg, canonical order) and `LegCap` (`Retrieval:MaxQueryLegs`, at least 1). When
  the RESOLVED business alphabets already fill the cap and the asked script is not among them, the asked script
  gives way; an unresolved lookup never makes it give way. `SearchKnowledgeTool` and `SearchServicesTool` name the
  unsearched alphabets in their coverage note, and the provider path counts a cap-cut rendering in `LegsRequested`
  so `IsPartialSearch` fires (P4-E-22, API `ProviderKnowledgeLegCapTests`).
- A failed cell lookup (`SearchCellLookupStatus.Unavailable` / `UnknownCell`) makes `BusinessAlphabetService` answer
  `BusinessAlphabetSet.Unresolved` (cached `UnresolvedCacheSeconds`) — never "writes only Latin" for `CacheMinutes`. No cell, or no
  private plane, stays resolved-empty (P4-E-05).
- ‼️ **The alphabet set re-checks the registry (P4-J-07).** It was invalidated only in the API process that took the
  upload — before the cards existed — so the new alphabet stayed unsearched there, and everywhere else, for up to
  `CacheMinutes`. Now every host (API, MCP, Functions) reads the registry's newest write at most every
  `BusinessSearch:Scripts:RevalidateSeconds` (60): `IKnowledgeDocumentRepository.GetLatestChangeAsync` =
  `SELECT VALUE MAX(c.updatedAt)` over the business's document rows (one partition, the existing `/updatedAt/?` path, no
  schema change), taken through `IServiceScopeFactory` because the repository is scoped, inside the single-flight
  lookup and BEFORE the facets. Same stamp, or a failed read with a set in hand ⇒ the set stands and only its check time
  moves (its expiry does not, so a catalogue change still ages out); a new stamp ⇒ the facets are asked again. The
  API's in-process `Invalidate` calls stay. Tests: API `BusinessAlphabetServiceTests` (4 J-07 cases) and the
  emulator's `KnowledgeDocumentCasIntegrationTests.TheLatestChange_MovesWithEveryWrite_AndSeesOnlyThisPartition`.
- ‼️ **`ProviderKnowledgeSearchService.IsScopedTo` (P4-H-14):** `businessId eq '…'` must be the whole filter or be
  followed by ` and `, with NO top-level `or` after it (quote- and paren-aware); anything else throws
  `CatalogIsolationException` before the query is sent.
- Business Search never widens a narrowed search: `KnowledgeSearchQuery.WidenWhenNarrowedFindsNothing` defaults
  false and only the phone's `search_knowledge` sets it (P4-E-08).
- `MaxDocIdsInFilter` 500 → 5,000 (P4-E-06); each passage is costed at its own script's rate (P4-E-07);
  `KnowledgeTokenEstimate` weights mixed-script text per script (P4-A-26); every Unicode decimal digit folds to
  ASCII and an Arabic-script leg searches both zeros (P4-A-25); a rendering cut at the length limit never ends in
  half a character (P4-E-10).
- Source cards split by AI-written channel (P4-F-01) — §19.7. Tests: web `src/lib/businessSearch/sourceGrouping.test.js`
  + `src/components/businessSearch/SourceCard.grouping.test.jsx`; mobile `__tests__/businessSearchSourceWhoseWords.test.tsx`.

## 2026-09-25 — answer image viewer freeze and selection integrity

- Web `AnswerImages.jsx` imports `yet-another-react-lightbox/styles.css` itself. The viewer makes the surrounding page inert; without its stylesheet the portal stays in normal document flow and the dashboard appears frozen, with no JavaScript exception. A fresh direct visit to `/dashboard/search` must work without visiting another gallery first.
- Web keeps the gallery and selected index together for the lifetime of an open viewer. A thumbnail failing in the background must not change the selected picture, empty the open gallery, or remove its Close control. A later opening uses the current usable thumbnails. Full-size images carry the caption or localized fallback as alt text.
- Native `BusinessSearchResponse` retains the actual tapped `BusinessSearchImage`. An index from the filtered thumbnail strip must never index the original `images` array. Close and native `onRequestClose` clear that selection without changing the conversation or draft.
- Regression coverage: web `AnswerImages.test.jsx` plus the real viewer in `e2e/tests/dashboard/conversation-interactions.spec.js`; native `__tests__/businessSearchImages.test.tsx` runs the screen with iOS and Android platform settings. Component tests do not replace native device validation.
- The web conversation bar gives Back and New conversation explicit localized accessible names even when responsive CSS hides their text. Native already labels its header back control and New action.

## 30. ‼️ ANSWER RELEVANCE — P4-E-26 (2026-09-25/26; authority `Data\answer-relevance\PLAN.md`)

The live defect: "What is the week rate for rentals?" showed 14 sources under a one-source answer and an unrelated
Gujarati price-list photo. Three code defects, no data defect: every frame was streamed at tool time; the three
alphabet searches got equal seats by rank; the services meaning-match returned the nearest services with no floor.

- ‼️ **A source reaches the member only when the answer's words cite it** (owner O-1; supersedes M9's roll-up).
  `CitedAnswerStream` holds every tool's citations and picture candidates; on each `[n]` it sends that source's
  Citation just before the words, renumbered 1, 2, 3 in reading order, then that source's picture (links minted
  THEN — never for a picture nobody sees). A number the model was never handed is removed with its space; a
  trailing "[" / "[1" is held and always flushed before the terminal frame. The controller stores what was sent,
  so a reopen matches. Both clients also filter with `citedSources(citations, answer)`, so a conversation saved
  before this draws only what its answer cites; cards, grouping and every count come from that one list.
- ‼️ **The legs meet by RELEVANCE** (`KnowledgeRelevanceRanker`, O-2 reversed D27b): `debug=vector` returns each
  passage's cosine; a passage needs ≥ `RetrievalMinSimilarity` (0.25) AND ≥ `RetrievalRelativeSimilarity` (0.60) ×
  the closest. One language keeps the index order; several fuse closeness with best position. Keyword-only or
  unreported legs fall back to rank fusion (never "nothing close" because embedding failed).
  `RetrievalVectorCandidates` (50) widens k. Measured on 38 live NKN607 questions before shipping (PLAN §4.1).
- **Services:** the meaning-only fallback keeps rows only at ≥ max(0.28, 0.75 × closest) and labels them
  `ClosestNotExact` (never a match, never a "too many" count); the multi-language merge drops meaning-only legs
  when any leg found the offering by name.
- **Rule 11 (O-3):** several results that answer differently are all given, as a table when more than two, with
  what tells them apart — never quietly one.
- **Pictures ↔ words** (ingest; see the voice-assistant skill for the full rules): a picture's words are only what
  the source ties to it; its card and anchor are filed under them; words read FROM a picture carry its handle
  (`imageRef` on Text/Table cards), so an answer citing them shows the photo and deleting the photo removes them.
- **Storage:** a read-only link never creates a container (AR-I1).
- ‼️ **The keyword half drops grammar words (AR-S5).** Every field uses `en.microsoft`, which keeps Hindi and Gujarati
  grammar words, so "है", "के", "છે" matched every passage. `QueryFillerWords` (clinqetcore) removes them from each
  rendering's KEYWORD text (`BuildSearchText`, phone and Ask Clinket alike, and the catalogue terms); the meaning half
  keeps the whole question; a question made only of such words keeps them. Query-side, so no index rebuild.
- ‼️ **One-item-per-line text is cut small (AR-S4).** A self-contained-lines paragraph (rate card, `key: value` list)
  packs to `Voice:Knowledge:ChunkRecordMaxTokens` (120, Functions only), not 512: in a 16-line card the "$50 deposit"
  line scored 0.24 against "is a deposit required?", under the floor. A line is still cut only at `ChunkMaxTokens`, and
  such a passage is never space-joined by the small-tail merge (`PendingCard.LineUnits` — a one-line piece has no newline).
  Measured offline on the 38 questions: the deposit answered, no fact lost; tables were measured worse and are unchanged.
- **Misplaced captions (AR-X12) and running titles (AR-X13)** — see the voice-assistant skill; both fix what a passage
  is filed under, for the phone and Ask Clinket alike.
- Guards: `BusinessSearchAgentTests` (stream), `BusinessSearchControllerIntegrationTests
  .OnlyTheSourceTheAnswerCites_ReachesTheWireAndTheStore` (real endpoint + Cosmos), `ProviderKnowledgeRelevanceTests`
  (API, live numbers), web `citedSourcesOnly.test.jsx` + `sourceGrouping.test.js`, mobile
  `businessSearchSourceGrouping.test.ts` + `businessSearchRulesParity.test.ts`.

## Closest seat and code questions — Ask Clinket (post-ranking follow-ups, audit 2026-10-01)

Evidence `C:\Nik\Data\post-ranking-followups\findings\closest-seat\`; audit `findings/AUDIT.md` §7 (A-M1, A-L6).

- `Voice:Knowledge:RetrievalClosestSeats` (2; API and MCP appsettings): the closest cards in meaning keep a seat the
  fused order withheld (a card first by meaning never reached the shortlist when every picture repeated the product's
  name). 0 disables. Same `KnowledgeRelevanceRanker` as the phone (clinqetinfrastructure `Services/Knowledge`).
- `SearchForProviderAsync`: after `DiversifyProviderCards`, unless the question names a code, `ClosestWithheld` picks up
  to `RetrievalClosestSeats` cards at or above the relevance floor — the closest always when not seated, the next only
  when outside its leg's shortlist (topK × 2) — filtered by `visibility.Permits(DocId)` (the team-search audience), then
  `Seat` places them after the first card. No widening on this path.
- `Seat` (A-M1): the cut back to topK never removes the closest card, and removes a document's last card (its fairness
  seat) only when nothing else is left.
- **Overview seats (2026-10-03, P1-6):** `DocSummary` / `DocAggregate` cards never take a record's seat. `DiversifyProviderCards`
  fills the top-K with records and keeps overviews in rank order up to `Voice:Knowledge:RetrievalLookupOverviewSeats` (1, API);
  `WithOverviewAllowance` holds that after a closest seat; `Seat(..., countsAsSeat)` cuts only records. Test
  `ProviderKnowledgeOverviewSeatTests`.
- `NamesACode` (A-L6): Latin runs only (CJK/Thai never match); a letter+digit token is a code unless a quantity (`2BHK`,
  `1.2L`, `9am`) or a size (`4x4`); 2–4 capitals then a 2+ digit token is one (`NX 195`); `i20` / `XUV700` stay codes.
- Tests: API `Services/BusinessSearch/ProviderKnowledgeRelevanceTests`; integration
  `BusinessSearchKnowledgeIsolationIntegrationTests.OnTheWire_TheClosestCardPastTheShortlist_KeepsASeat`. The phone path's
  extra rule (never widen when a closest card would be seated) is in clinqet-voice-assistant.

<!-- search-topology-phase5 -->
## Sol 6.1 + first-words time (search-topology Phase 5, 2026-10-02)

- Answers run on `gpt-6.1-sol` (D-120; `AiModels.Sol`, model version 2026-09-29, $2 / cached $0.10 / $10 per M tokens),
  reasoning unchanged (Medium). ‼️ 6.1 Sol refuses reasoning "none"/"minimal", so conversation naming moved to its own
  `BusinessSearch:Answer:TopicDeploymentName` = `gpt-6-luna` (`BusinessSearchTopicService`; pinned by
  `AiModelPinConventionTests`). Luna is unchanged.
- The request carries `clinket.first_word_ms` when the first words stream (alert A5, > 15 s p95 with ≥ 20 answers).
  Dev baseline 2026-10-02: p50 5.9 s, p95 12.6 s.
- The knowledge index can now be rebuilt WITHOUT re-reading documents: `cosmosindexsetup --swap … --kind PrivateKnowledge`
  copies every card with its cached vector proven by card id + text hash (see `clinqet-search-discovery`).
