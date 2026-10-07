# L — PRE-BUILD SWEEP (synthesis of four lenses, verified 2026-09-02)

> Four lenses (contradiction · authorization loophole · buildability · owner-requirement) swept the locked set.
> I re-verified every high/critical claim against the documents and the code before writing it down. Findings
> are deduplicated across lenses and ranked. Every claim below carries the document line or the `path:line`
> I read myself. **13 lens claims were dropped or narrowed — §4 says which and why.**
>
> This file changes no code and no document. It is a work order for the next editing pass.

---

## 1. VERDICT

**No — do not hand this set to a builder yet.** The plan's architecture is sound and P1 is broadly buildable,
but `PHASE-1-PROMPT.md` — the only file the next session actually codes from — still states three superseded
instructions verbatim (`[Authorize]` alone, inline-disposition SAS for every file type, images gated on the
caller-sendability allow-list): the exact three holes C1, S1 and C3 were written to close. Two further items
stop a competent engineer on day one: P1 is ordered to enforce an audience rule whose field is Phase 4, and to
stamp `MembershipId` + CAS on `AiSession`, which has neither and cannot gain them without a §0.7 answer.
One authorization decision is missing entirely, not merely mis-stated: Business Search silently drops the
`voice.read` gate that today keeps knowledge documents away from six of the ten roles. Fix M1–M8 (about two
hours of document editing plus two owner answers) and the set is safe to build from.

---

## 2. MUST FIX BEFORE CODING

### M1 — ‼️ The kickoff prompt tells the builder to build the three defects the audit corrected
**What is wrong** — `PHASE-1-PROMPT.md` §3.2 and §3.5 are the paragraphs a coder copies signatures from. They
restate the pre-correction wording; §3.4 restates the corrections two paragraphs later, with no precedence
marker on the earlier text. That is the same pattern that produced C1 in the first place.

| Line | Says now | Overridden by | Consequence if followed |
|---|---|---|---|
| `PHASE-1-PROMPT.md:96` | "`BusinessSearchController` …, `[Authorize]` + tenant context required" | AUTHORIZATION-DESIGN §6b **C1** (`:191-203`) | loses the asserted-businessId mismatch check, the `BillingOnly` refusal and the live-recheck hook |
| `PHASE-1-PROMPT.md:99` | "`GET documents/{docId}/view-url` → short read-SAS, **inline disposition**" | PLAN §15c **S1** (`PLAN.md:496`) | stored XSS on the storage origin — `.html`/`.htm` are allowed knowledge uploads and the blob Content-Type comes from the client's PUT |
| `PHASE-1-PROMPT.md:140` | "Images: only refs on **the live allow-list**, bounded SAS mints" | AUTHORIZATION-DESIGN §6b **C3** (`:213-220`), PLAN §5.3 (`:201-203`) | "the live allow-list" is this codebase's own name for `ListSendableImageRefsAsync` (`findings/A:227-228`) — the phone-caller send gate. The receptionist's `sendable`/`shareWithCallers` switches would decide what the provider's own team can see |

**Exact edits**
- `:96` → ``[RequiresPermission("business.profile.read", PermissionScope.Business)]`` on **every** Business
  Search endpoint — plain `[Authorize]` is the defect C1 corrects.
- `:99` → "short read-SAS; inline disposition **only** for `application/pdf` and images; every other type
  (html, htm, svg, unrecognised) `Content-Disposition: attachment` (S1)."
- `:140` → "Images: a picture is included when **its document is visible to that member** (§6.2). Do **NOT**
  call `ListSendableImageRefsAsync` — that is the caller-send gate (C3). Bounded SAS mints, `MaxImagesPerAnswer` 4."
- Add one line under `PHASE-1-PROMPT.md` §0: "`AUTHORIZATION-DESIGN` §6b and `PLAN` §15c override every other
  sentence in every document, **including this one**."
- `PHASE-1-PROMPT.md` §3.7 names **no** C-test. Add tests 13 (C1), 14 (C2), 15 (C3 — with its sabotage:
  re-introduce the sendability gate and the test must fail), 17 (C5), 18 (C6) and the S1 per-extension test.

---

### M2 — ‼️ Business Search removes the only permission gate knowledge documents have (owner decision owed)
**What is wrong** — today `voice.read` is the sole barrier on provider document access. Business Search
declares `search_knowledge` permission "none (audience-filtered)" (`PLAN.md:137`) and C1 gates every endpoint
on `business.profile.read`, which **all ten roles hold**. Six roles therefore gain, on day one, full-text
retrieval over every document, the whole-page text endpoint and a download SAS — none of which they have any
page for today. That breaks the golden rule in the widening direction, and it is not in §15's decision list.

**Verified**
- `clinqetapi\Clinqet.API\Controllers\Knowledge\KnowledgeController.cs:79` (document list) and `:531`
  (document images) → `[RequiresPermission("voice.read", PermissionScope.Business)]`; the file's own header
  comment `:28` says the gates deliberately reuse `voice.read`.
- `clinqetinfrastructure\Data\SQL\TenancyRoleCatalogDefinition.cs` — `voice.read` appears only at `:213`
  (operations_manager) and `:240` (dispatcher), plus primary_owner/administrator via the all-permissions
  helpers. **Without it: sales_representative, technician, catalog_manager, finance, contractor,
  read_only_auditor.**
- `business.profile.read` really is universal (`:200,218,231,248,259,274,290,298` + owner/admin) — C1's claim
  at `AUTHORIZATION-DESIGN.md:196-201` is **confirmed**; that is what makes the widening total.
- Documents are the one Group A source with **no narrowing**. A technician whose `invoice.read` is `Assigned`
  reads the business's whole revenue out of an uploaded spreadsheet, straight around `WorkListNarrowing` —
  the design's own threat **T5** ("salary/commission data") arriving through the front door, on the
  "Everyone on my team" default.

**Exact edit** — put this to the owner as its own decision and record the answer in PLAN §15:
- **Option 1 (matches today's app):** declare `voice.read @ Business` on `search_knowledge`,
  `documents/{docId}/pages/{page}`, `view-url` and the image SAS. The golden rule then holds by construction.
- **Option 2 (deliberate expansion — the owner may want it):** every member may search documents. Then
  existing rows default to **owner/admin only**, "Everyone on my team" becomes a per-document opt-in, and a
  permission key still gates the raw page/file endpoints.
- Test either way: for each of the six roles without `voice.read`, `search_knowledge` / `pages` / `view-url`
  return exactly what a foreign business returns.

---

### M3 — ‼️ P1 is ordered to enforce a rule whose only data field is Phase 4
**What is wrong** — `PLAN.md:432` puts "page-view + view-url endpoints · all §10 isolation guardrails" in P1;
`PLAN.md:367-369` (§10.5) says both endpoints "apply the §6.2 audience rule"; `PLAN.md:137` sources
`search_knowledge` from "`IProviderKnowledgeSearch` + the audience allow-list (§6)". But the field and the
three-state method are P4 (`PLAN.md:435`) and `PHASE-1-PROMPT.md:24-26` forbids any other schema change in P1.
P1 cannot meet its own definition of done without breaking the §0.7 gate.

**Exact edit** — state in §10 and `PHASE-1-PROMPT` §3.4 what P1 actually enforces: the **existing** fail-closed
`ListRetrievableDocIdsAsync` allow-list + business-scope point-read + `KnowledgeBlobPaths` prefix pinning; P1
**defines** the three-state contract and implements only `AllVisible`; the audience predicate lands in P4.
Correct the phase count in the same pass (see M8).

---

### M4 — ‼️ `AiSession` cannot carry `MembershipId` or an ETag, and P1 mandates both
**What is wrong** — `PHASE-1-PROMPT.md:133` ("sessions stamped with `MembershipId` and required on read",
= AUTHORIZATION-DESIGN §7 test 8, PLAN §10.6) and S11 ("the session write is ETag/CAS-guarded") require two
persisted things the entity does not have, while `PHASE-1-PROMPT.md:24-26` forbids adding any Cosmos field.
The whole member-isolation guarantee of P1 hangs on this.

**Verified** — `clinqetcore\Entities\COSMOS\AiSession.cs:7-45` declares `id, type, sessionId, userNumber,
interactionType, history, toolExecutions, totalTokensUsed, createdAt, lastActivity, metadata, ttl` — no member
discriminator, no `_etag`. The one field whose name suggests a person is not one:
`clinqetinfrastructure\Services\AI\McpSessionService.cs:248` writes `UserNumber = context.BusinessId` and
`:214` reads `BusinessId = session.UserNumber`. No ETag/CAS token anywhere in that file.

**Exact edit** — before P1 starts, either (a) put the §0.7 table in the prompt for
`AiSession.membershipId` (string, `WhenWritingNull`) + an `_etag` mapping and get the owner's yes in the
conversation, or (b) state explicitly that the member id and concurrency token ride the existing `metadata`
bag (`AiSession.cs:40-41`) so no new field is created. Either way add the note that `userNumber` holds the
**businessId** — so nobody reuses it for identity.

---

### M5 — ‼️ "The MCP is not touched, not one file" is contradicted by P1's own delete list
**What is wrong** — the owner's hardest absolute is stated three times and then reversed.

| Says untouched | Says edit it |
|---|---|
| `PLAN.md:66` "phone receptionist ──▶ Clinqet.Mcp ← **NOT TOUCHED, NOT ONE FILE**" | `PLAN.md:90` delete "`Mcp:ChatToolAllowlist` + `ChatToolSessions` + **the chat branch in the MCP's `McpToolGuard`** + **both repos'** `ChatToolAllowlistConventionTests`" |
| `PLAN.md:80` "this project adds no MCP tool, no allowlist entry and no MCP config" | `PHASE-1-PROMPT.md:87` repeats the same deletion verbatim |
| `PHASE-1-PROMPT.md:39` "**Do not touch `clinqetmcp`** … must be provably unaffected" | |

`AUTHORIZATION-DESIGN.md:126` rejected alternative E precisely because it "means editing the shared voice gate".

**Exact edit** — reword `PLAN.md:66`/§2.2 and `PHASE-1-PROMPT.md:39` to the true, narrower claim: *no MCP tool,
no allowlist entry, no realtime config change, and the voice path's runtime behaviour is unchanged; the only
`clinqetmcp` edit is removal of the dead CHAT branch.* Name the exact `clinqetmcp` files P1 may edit, and make
the P1 audit prove a before/after byte-identical Customer-scope voice tool surface. §0.15 also applies: the
MCP's own convention test is deleted **from the MCP repo**. If the owner meant literally zero MCP files, §2.3
must instead leave the dead branch in place — decide before P1 starts; both readings are written down as
absolutes today.

---

### M6 — ‼️ The per-member daily limit has no seam, and three sections name three different mechanisms
**What is wrong** — locked decision 5 (200/business/day · 60/member/day · 6/min) has its own UI copy, yet:
`PLAN.md:322-324` defines a new `BusinessSearch:Limits:*` family; `PLAN.md:391` says to reuse "**the existing**
`RequestsPerDay` dial … before any new entitlement is invented"; `PLAN.md:397` lists a third key
`AIAssistant:RateLimiting:BusinessSearch`. The §11 route **cannot** express a per-member cap.

**Verified**
- `clinqetinfrastructure\Services\AI\AiRateLimitingService.cs:31` `CheckRateLimitAsync(string endpoint, string
  businessId)`; `:235` `GetBucketKey(endpoint, businessId) => $"{endpoint}:{businessId}"`; buckets are an
  in-process `ConcurrentDictionary` with a 5-minute cleanup timer (`:27-28`) — no cross-instance or
  cross-restart survival, so a per-DAY window cannot live there. `GetEndpointConfig` (`:224-234`) is a fixed
  switch over `text-enhancement` / `mcp-chat` / `document-intelligence` (this is S5).
- The durable meter: `clinqetcore\Interfaces\Services\IUsageCounter.cs` — `GetCountAsync(businessId,
  periodKey)` / `IncrementAsync(businessId, periodKey, ttl, region)`; `clinqetshared\Enums\UsageMeter.cs` has
  only `AiText`, `Leads`, `ProviderSetup`.

**Exact edit** — pick one and state it in **all three** sections: burst (6/min) via `AiRateLimitingService`
under `AIAssistant:RateLimiting:BusinessSearch` (with the `GetEndpointConfig` case S5 already demands), and
**both** daily caps as a durable Business Search counter under `BusinessSearch:Limits:*` — a new
`UsageMeter.BusinessSearch` plus either a member-scoped counter interface (mirroring
`IProviderSetupUsageCounter`) or `IUsageCounter` with `periodKey = $"{yyyyMMdd}:{membershipId}"` (the interface
comment says periodKey is caller-chosen, so this is legal). Delete the "reuse the existing `RequestsPerDay`
dial" sentence from §11, and list every resulting key once in §12 with its `deploy.ps1` entry.

---

### M7 — ‼️ `DECISIONS-FOR-OWNER.md` recommends the opposite of two locked decisions
**What is wrong** — the page the owner reads first is stale (mtime 11:08 vs PLAN 15:37) and now contradicts the
locked plan. An owner re-reading it will conclude the plan does something it does not.

| `DECISIONS-FOR-OWNER.md` | PLAN v3 |
|---|---|
| `:86`, `:107` bolded recommendation **gpt-5.4-mini** | `PLAN.md:453` decision 8: **gpt-5.6-luna @ `reasoning_effort: none`** |
| `:112` decision 13 recommends "**Send only metadata** … never the question text" | `PLAN.md:454` decision 12b: **store the question text, anonymised client-side** |
| `:106` decision 7 two-phase split | `PLAN.md:3-6`, §15 decision 7: everything is ONE project |
| `:78` "the table is in `PLAN.md` §5.1" | §5.1 is "The agent"; the §0.7 table is **§6.1** |
| `:62` role chip "**Front desk**" | `PLAN.md:503` S8 — not a catalogue role |
| numbering: 12 = internal name, 13 = analytics | PLAN: 12 = delete the chat assistant, 12b = analytics |

**Exact edit** — either stamp it "SUPERSEDED — the locked answers are PLAN §15", or rewrite it as two parts
("Decisions you already made (locked)" mirroring §15 exactly; "Still open" — currently only the optional
`createdByMembershipId` index and S6's search-SKU question), fix the §6.1 pointer, replace the invented chips
with real catalogue role names, and put one line at the top saying PLAN §15 wins on any disagreement.

---

### M8 — Coverage, correctness and pointer defects a builder will act on
Grouped because each is a one-line edit, but each one misleads.

| # | What is wrong | Where | Exact edit |
|---|---|---|---|
| a | `get_business_profile`'s row still lists **licences** — the raw payload C5 forbids handing to a model. `FullProviderContextService` really does take `ILicenseRepository` (`clinqetinfrastructure\Services\Voice\FullProviderContextService.cs:52`) | `PLAN.md:140` vs `AUTHORIZATION-DESIGN.md:229-233` | rewrite the row to C5's projection verbatim, strike "licences", and settle "portfolio counts" (PLAN) vs "offer count" (C5) — the two lists disagree, so neither states the approved payload. Name the projection DTO in `PHASE-1-PROMPT` §3.3 so test 17 has a shape to assert |
| b | Deleting "the `AIAssistant:Mcp:*` chat settings" breaks the session store the same phase keeps: `McpSessionService` reads eight keys from `AIAssistant:Mcp:Session` (`:187, 200, 241, 280, 331-332, 364-373`). Deleting `AIAssistant:Mcp:MaxTokens` orphans a dial: `AiBudgetCutoffAlerts.cs:27` maps `AiSubFlows.AssistantChat` → that key, and `clinqetfuncations\Clinqet.Communications.UnitTests\Knowledge\AiBudgetCutoffAlertsTests.cs:170-186` fails **both ways** (sub-flow with no dial; dial with no sub-flow) | `PHASE-1-PROMPT.md:88`, `PLAN.md:91` | name the keys that STAY (`AIAssistant:Mcp:Session:*`, or rename to `BusinessSearch:Session:*` and rewire `McpSessionService` in the same change); add to the DoD that the **Functions** suite is rebuilt and rerun for the `AiSubFlows`/dial pair |
| c | "`ChatInteractionType` where it is chat-only" cannot be deleted — it is a **persisted Cosmos property** on the entity P1 keeps (`AiSession.cs:21-23`) and a parameter on the interface P1 keeps (`IMcpSessionService.cs:11`). Removing the field is itself a §0.7 change. `PHASE-1-PROMPT` §3.1 silently drops this deletion without saying so | `PLAN.md:91` vs `PHASE-1-PROMPT.md:85-88` | state in both: `ChatInteractionType` **stays**; only the `InteractionTypePrompts` config and DTO members no surviving endpoint binds are removed |
| d | `search_services` and `get_business_profile` cannot be registered as described: both ctors require `IOptions<VoiceCatalogSettings>` (`ProviderCatalogSearchService.cs:73`, `FullProviderContextService.cs:59`) which `clinqetapi\Clinqet.API\Program.cs` never binds (it has `McpServerSettings` `:816` and `DiscoverySettings`, and only a `KnowledgeSearchClient` `:987-999` — no service-index `SearchClient` for `CatalogSearchDependencies`). §12's "complete" config list omits all of it | `PHASE-1-PROMPT.md:52-56`, `PLAN.md:397-403` | extend the DI-gap list and §12 with a `Voice:Catalog` block + `Configure<VoiceCatalogSettings>` and an explicit service-index `SearchClient` registration |
| e | Group A is described as "every member with a business context", but `catalog.offer.read` is **not** held by dispatcher, technician, finance or contractor, and `availability.read` is **not** held by finance (verified against `TenancyRoleCatalogDefinition.cs:201, 219, 230-241, 245-253, 262, 273-285, 289-295, 299`). A finance user asking "what are our hours?" hits a refusal the plan frames as a Group B behaviour | `PLAN.md:133-141`, §9b copy table | either grant the two keys (a grant change ⇒ the CatalogVersion/pin/sweep playbook) or amend §4.1 + the §9b copy table to name which roles get the fixed refusal for offers and availability, so P1 ships the right strings first time |
| f | "all three also carry `ai.assistant.use`" is **false**: provider-setup carries `ai.document_intelligence.use` (`AIAssistantController.cs:626, 758`), held by catalog_manager only (`:268`) plus owner/admin. The conclusion survives on speech-to-text (`:232`) + enhance-text (`:322`), but the margin is thinner than stated | `PLAN.md:101`, `PHASE-1-PROMPT.md:90` | correct the sentence; keep the `OrphanPermissionRegistryTests` verification step |
| g | §4 is titled "**THE COMPLETE COVERAGE MAP**" but omits six live provider dashboard surfaces and never declares them out of scope, against the owner's "everything about my business … I could be asking anything" (`00-ORIGINAL-PROMPT.md:7`). Verified present and unmentioned: `call-follow-ups` (the receptionist's own call summaries — the most natural provider question there is), `billing`, `ai-billing`, `activity`, `notifications`, `refund-requests` under `clinqetwebpartnerapp\src\app\dashboard\`; grep of PLAN.md finds none of them | `PLAN.md:127-175` | add an explicit "Out of scope for this project, and why" block naming all six, **or** add tools for the ones with an existing permission-gated read path. Drop the word "COMPLETE" unless every surface is either a tool or listed as excluded |
| h | `PLAN.md:452` decision 7 says "**P1–P3** then the final audit" while §14 defines **five** phases and `PHASE-1-PROMPT.md:3` says "Phase 1 **of 5**". `PLAN.md:36` maps "Reuse existing code" to "§3.3 and throughout" and `:31` maps "Without impacting the phone assistant" to "§3.2" — **§3 has no subsections at all** (§3 at `:107`, §4 at `:127`) | `PLAN.md:31, 36, 452` | decision 7 → "P1–P5 per §14"; repoint the two traceability rows at §2.1/§2.2/§2.3 (reuse + the MCP claim) and §5.3/§5.5 |

---

## 3. FIX DURING P1 (real, not blocking the start)

1. **A minted read-SAS is not revocable, and §3.7 authorizes only the mint.** For its whole life it works after
   the audience changes, after a role is downgraded, after the member is removed, and in anyone's browser.
   `PLAN.md:511` lists SAS expiry as a UX risk, never an authorization one; test 9 covers the search path only.
   Say it plainly in §3.7, then minimise: make the primary "open the file" path stream bytes through the API so
   every read re-authorizes, cut `DocumentViewSasMinutes` (currently 10) to the smallest workable value if a
   SAS is kept for large files, mint strictly per click, and record the residual window as accepted. **Note S1
   already forces `attachment` for everything but PDF and images, so this mostly bites PDFs.**
2. **Widen `IProviderKnowledgeSearch` with a typed value, never a filter fragment.** Its isolation contract
   (`clinqetcore\Interfaces\Knowledge\IProviderKnowledgeSearch.cs:5-16`) states there is *"no overload that
   accepts a caller-built filter"*, and it has **two** legs — `SearchAsync` (`:19-22`) and `GetByRefsAsync`
   (`:27-30`, the citation/refs path). P1 should define the seam even though P4 fills it:
   `IReadOnlyCollection<string> visibleDocIds` (or the three-state result itself), composed inside the service,
   AND-ed after the leading scope clause, applied to **both** legs, INTERSECTed with the existing
   retrievable/suppressed lists, with `null` illegal so "no list supplied" can never mean "no restriction"
   (`AllVisible` must be a distinct value all the way into the signature).
3. **Follow-up turns replay prior answer TEXT, which §3.8 never re-authorizes.** "Only opaque handles are
   carried between turns" does not cover the assistant's own prose, which must be replayed for a follow-up to
   be coherent. Turn 2 "summarise that again" answers from context with **no tool call and no authorization**.
   Test 9 passes because it checks retrieval. Persist per turn the question + handles + the permission keys and
   docIds that produced the answer, re-resolve at the start of every turn, and silently DROP any turn whose
   sources no longer authorize. Tests: restrict the document / downgrade the role / remove the member between
   turns — turn 2 contains none of that content.
4. **Tools that resolve no narrowing must declare a minimum scope.** §3.3 and §7 test 12 require only that a
   tool "declares a permission"; `Has(key)` with no minimum scope means "held at ANY scope above None", so
   `count_leads`, `get_insights`, `get_availability`, `list_team_members`, `list_reviews`, `list_offers`,
   `search_services`, `get_business_profile` would hand an `Assigned`-scope member the whole business if any
   key were ever granted below Business. The platform's existing build guard
   (`Clinqet.API.UnitTests\Conventions\WorkListNarrowingContractTests.cs:31
   NoRoleGrantsAWorkListPermissionAtAnUnpushableScope`, cited at `BaseController.cs:347`) covers work-list keys
   only. Declare `(permissionKey, minimumScope)` on every tool, assert both in the base, and extend the
   convention test: no narrowing ⇒ must declare `Business`.
5. **The promised refusal copy has no producer.** §3.2 drops the tool from the model's list; §9b and §4.2
   promise fixed copy ("You don't have access to payment and invoice information."). If the tool is absent,
   nothing downstream knows a money question was asked. Either keep a declared-but-refusing schema entry that
   fetches nothing and returns the fixed string, or classify the question against the permission catalogue
   server-side before the model runs. (I did **not** verify the further claim that the model would substitute
   `search_knowledge` and answer from a revenue spreadsheet — see §4 — but a cross-source rule is cheap
   insurance: a Group B topic may only be answered from that topic's tool.)
6. **Member identity has no PII projection rule.** Test 19 constrains customer contact only. `MembershipId`
   and the 5-char `UserNumber` are `[System.Text.Json.JsonIgnore]`d on the entity precisely so they never reach
   a client (`clinqetcore\Entities\COSMOS\ProviderOwnedEntity.cs:14-25`, its header comment says "Every field
   here is INTERNAL"), and a tool result bypasses that because it is not a serialized HTTP DTO. Project to
   `DisplayName` + a per-answer opaque handle; pin with a DTO-shape convention test plus an answer-level
   assertion that no GUID or UserNumber pattern is rendered.
7. **The solo → first-hire transition silently opens the archive** (owner decision owed before P4).
   `AUTHORIZATION-DESIGN.md:139`: the audience box is hidden while solo, "If the business later adds a member,
   the box appears and **every document is already 'Everyone on my team'**." Decision 6's recorded rationale
   ("pre-production, no backfill concern") answers a one-time migration question, not this transition, which
   recurs for every provider forever. Proposal: when `soloBusiness` flips false, existing file rows fall back
   to owner/admin-only for search until the owner completes a one-time "choose who can find these documents"
   step; new documents keep the approved default.
8. **The owner's "link, not a download" rule is only satisfied for PDFs and images.** §5.5 level 2 needs the
   OCR page cache, and `PLAN.md:208-209` excludes Word/Excel/HTML/text (stored page is a placeholder `1`);
   S1 then forces those to `attachment` while saying "the primary action stays 'Show page N'" — which is
   exactly what those types cannot do. Net for a .docx: passage only, plus the download the owner refused
   (`00-ORIGINAL-PROMPT.md:7`). State the per-file-class matrix in §5.5 and offer the cheap fix: a "Show
   section" level built from stored chunk text (no new storage, no egress). Fix S1's self-defeating wording.
9. **Page-cache key drift across hosts.** The key includes a deployment-name and prompt-version segment, and
   the **Functions** host writes the cache: `clinqetfuncations\Clinqet.Communications\appsettings.json:1282,
   1288` pin `gpt-5.6-luna` / `1`, identical to the class defaults
   (`clinqetshared\Models\VisionTranscriptionSettings.cs:11, 27`) — which is the only reason the two agree.
   The API's guard (`Clinqet.API.UnitTests\Conventions\VoiceKnowledgeSettingsConventionTests.cs:77-83`) only
   asserts the API's configured set equals what the API reads; it never compares hosts, and §0.17 forbids a
   cross-repo test. Read the vision deployment/prompt version from the same class defaults the writer uses,
   and add a cache-miss-rate alarm. Also define the behaviour when `ContentHash` is null (the field is
   nullable) or the page blob is absent — build and test the §5.5 fallback chain in P1, do not assume it.
10. **Analytics team-name redaction assumes a roster the member may not have.** `PLAN.md:278` redacts member
    names "against the business's own roster, **which the client already holds**" — but the roster is gated on
    `team.read` (§4.2), which a technician does not hold, so their question ships the staff name to the
    analytics lake. The server assertion covers only e-mail/phone patterns. Choose: a names-only roster
    delivered to every member, or server-side name redaction at ingest, or fail closed (drop the text, send
    metadata). Add the missing-roster case to the redaction fixtures on both platforms.
11. **Stale figures and counts** (edit now, they are quoted downstream):
    `AUTHORIZATION-DESIGN.md:182` still prices a whole answer at "$0.00025" (that is one **turn** — S4 says
    ~$0.0005–0.0008 per answer; `PLAN.md:387` and `:490` are already correct) · `PHASE-1-PROMPT.md:48`
    "$0.00025/**answer**" → "per model turn; ~$0.0005–0.0008 per answer (S4)" · `01-SESSION-STATE.md:17`
    "12 owed tests" → **20** (`AUTHORIZATION-DESIGN` §7 is numbered 1–20, `:244-276`) · `01-SESSION-STATE.md:18`
    calls the mockup "v3" while its own `<title>` says **v2**.
12. **Refresh the mockup before the owner approves screens** (it is what P2 builds from): line 602 "New
    **provider-search** endpoint" (a forbidden name), 605 "opens **inline** in the browser" (contradicts S1),
    612 "Team search box … phase 1" and 614 "Business questions (phase 2)" (P4 and P3 per §14), 610/616
    "Decision **8**" for helpful/not-helpful (it is decision **9**), 530/547 role chips "Front desk" (S8). Do
    this in the same session that draws the S9 missing states, so the owner approves one consistent artefact.

---

## 4. DROPPED — claims I could not confirm (do not resurrect these)

Thirteen lens claims were dropped or narrowed. Each is listed so nobody re-files it.

1. **"The model will substitute `search_knowledge` and answer a dispatcher's invoice question from an uploaded
   revenue spreadsheet."** Plausible and worth guarding against, but it is a behavioural prediction against an
   agent nobody has built. Kept only the *documented* half (§3.2 leaves §9b's refusal copy with no producer).
2. **"A widened `IProviderKnowledgeSearch` overload taking an OData fragment would still pass `AssertScoped`."**
   I did not read `AssertScoped`'s implementation. The recommendation (widen with a typed value, never a
   fragment) stands on the interface contract alone.
3. **"`list_call_followups` has its own service + permission."** I verified only that
   `dashboard/call-follow-ups` exists as a page and that PLAN never mentions it. No permission key asserted.
4. **"`get_plan_and_usage` sits behind the same Payments master switch as `get_insights` (S7)."** Not verified;
   the coverage-map gap (M8g) does not depend on it.
5. **The lens's line numbers for `IAzureStorageService` (":35") and `AiRateLimitingService` (":13, 283, 289,
   291")** did not all match the files I read. The substance held everywhere I checked
   (`clinqetcore\Interfaces\Storage\IAzureStorageService.cs:40-50` — `GenerateSasUrlAsync` /
   `UploadDocumentAndGetReadSasUrlAsync`, and `SasUrlRequest`
   (`clinqetcore\Models\Storage\SasUrlModels.cs:10-40`) carries no disposition), so S2 is confirmed and only
   the citations were corrected.
6. **"`PLAN.md` §11 understates cost."** Already corrected in place at `:386-388` and `:490`. Only
   `AUTHORIZATION-DESIGN.md:182` and `PHASE-1-PROMPT.md:48` are still stale (§3.11).
7. **"`DECISIONS` decision 2 is open while PLAN locks Option A."** The two are compatible in substance (a
   header entry); folded into M7 as ordinary staleness rather than a contradiction.
8. **"The mockup's `1.png` shows an unapproved state."** Not examined.
9. **"`WorkListNarrowingContractTests` covers work-list keys only."** Confirmed by name and by the
   `BaseController.cs:347` comment; I did not read the test body, so §3.4's fix is written to be correct either
   way.
10. **"Six roles gaining document search also gain the AI Knowledge page."** They do not — `KnowledgeController`
    still gates on `voice.read`. M2 is strictly about the new Business Search surfaces.
11. **"`AiSession.metadata` cannot carry the membership id."** No evidence either way; M4 explicitly leaves it
    as the cheaper of two options.
12. **"S6's shared search-SKU risk is a P1 blocker."** It is measured in P5 by the plan's own design; no
    evidence it blocks P1.
13. **Any claim that `PHASE-1-PROMPT` §3.1's delete list would break the voice call path at runtime.** The dead
    chat branch's unreachability from a Functions-minted Customer token is asserted in `findings/B`, which I did
    not re-derive; M5 asks for the proof rather than assuming the risk.

---

## 5. WHAT I DID NOT CHECK (coverage gap for the P5 audit)

- **`findings/A–K` were not re-verified.** I re-derived only the specific facts I cite above from source. The
  rest of the evidence base is trusted as previously audited.
- **No UI artefact was reviewed** beyond the mockup's control table and role chips: not the web/mobile registry
  claims in §8/§9, not `SURFACE_PERMISSIONS`/`PAGE_FOR_SURFACE`/`SELF_GATED`, not the rail tail-order or
  analytics-parity guards, not `linking.ts`/AASA parity. S10's four traps are unverified.
- **No test project was read end to end.** I confirmed the existence and, where quoted, the assertion of
  `WorkListNarrowingContractTests`, `VoiceKnowledgeSettingsConventionTests`, `AiBudgetCutoffAlertsTests`; I did
  not survey `Clinqet.API.UnitTests`/`.IntegrationTests` for guards P1 would break.
- **Localization was not checked at all** — not the five API files, not the §9b copy keys, not whether any
  proposed string already exists.
- **Deployment was not checked** — `deploy.ps1`, the ARM templates and the env-var mapping for
  `BusinessSearch__Answer__DeploymentName` are unverified.
- **The model claims (`findings/J`/`K`) were not re-measured**: luna's 400 on higher reasoning effort, 15/15
  tool planning, the token prices. The cost arithmetic in M8/§3.11 assumes findings/K's per-turn figure.
- **Cosmos index policy was not read.** §15b's "no new IncludedPath needed" claim
  (`assignedMembershipIds`/`assignedTeamIds`/`branchId` already indexed on Transactions and Communications) is
  taken from the plan, not re-verified against `cosmosindexsetup\Program.cs`.
- **The repository narrowing overloads named in §4.2 were not opened** (`GetPaginatedBookingsAsync`,
  `GetPaidInvoicesInRangeAsync`, `GetAssignedCustomerIdsAsync`, `GetInboxStatusCountsAsync`,
  `IInsightsReadService`). Whether each accepts a narrowing argument, and whether it reaches the COUNT as well
  as the WHERE, is a P3 verification.
- **Prompt injection through provider-uploaded documents** (PLAN §16 calls it unmitigated platform-wide) was
  not analysed. It intersects M2: widening who can retrieve documents also widens who can be attacked through
  one.
