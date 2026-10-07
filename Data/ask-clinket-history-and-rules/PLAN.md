# Ask Clinket — saved conversations, and standing instructions (PLAN v1, 2026-09-17)

> **Authority order:** the owner's words in conversation > this file > the phase notes beside it.
> This programme extends `C:\Nik\Data\provider-ai-search\PLAN.md`; everything that plan rules still rules.
> Skill: `.claude/skills/clinqet-business-search/SKILL.md` (§9 sessions, §25 the conversation's name,
> §26 replay parity) — read it before touching anything here.

---

## 0. ‼️ THE MOCKUP REGISTER — every sheet this programme owns

> §0.20 of `CLAUDE.md`. A sheet approved and registered nowhere has been LOST, not approved. Add the row the
> day the owner says yes. Never delete a row — supersede it and say so.

| # | Sheet | Approved | Governs | Status |
|---|---|---|---|---|
| H1 | `C:\Nik\Data\mockups\business-search-conversation-history\index.html` | *pending* | Every state of saved conversations: the short lane on the landing · the full list panel (laptop drawer · iPad · phone-width web · phone app bottom sheet) · date grouping · the filter · rename · delete one · delete all · the cap · loading · could-not-load · empty · offline · a conversation that is gone · **an answer withheld after a role change** · the open-now marker · deleting the conversation you are reading · a long name and a non-Latin name | **DRAFT** **Restyled 2026-09-18 after owner review of the live screen** — every app frame redrawn in Lufga (the app renders Arial unless a screen opts in), house weights (no extra-bold), `rounded-xl` buttons, neutral grey hovers (the pale lime read as yellow), lucide icons, and the header history + gear as solid brand-green circles with navy icons (the phone call follow-ups gear). Panels float as a card on laptop/iPad and rise as a bottom sheet on phones. |
| R1 | `C:\Nik\Data\mockups\business-search-answer-rules\index.html` | *pending* | Every state of the standing-instructions surface: the gear and where it lives · editable (owner/administrator) · read-only (everyone else) · nothing set yet · typing · near the cap · at the cap · saving · saved · could not save · offline · unsaved changes on close · loading · could not load · answer-style choices · clearing every rule · a rule written in another script · web and phone | **DRAFT** **Restyled 2026-09-18 after owner review of the live screen** — every app frame redrawn in Lufga (the app renders Arial unless a screen opts in), house weights (no extra-bold), `rounded-xl` buttons, neutral grey hovers (the pale lime read as yellow), lucide icons, and the header history + gear as solid brand-green circles with navy icons (the phone call follow-ups gear). Panels float as a card on laptop/iPad and rise as a bottom sheet on phones. |

**Superseded/extended elsewhere:** M11 (`business-search-modern-surface`) still rules the answer surface's
visual language; H1 adds the list panel *inside* that frame and changes none of M11's rules. M7 still rules
the page frame and the docked ask box.

---

## 1. Owner decisions, locked 2026-09-17 — in conversation

| # | Decision | Ruled |
|---|---|---|
| **D1** | **Saved conversations move SERVER-SIDE**, member-scoped, visible on every device and surviving sign-out. The device list stops being the index | owner, in conversation |
| **D2** | **Retention 30 days** (was 7), *and* the answer-level re-check is built with it | owner, in conversation |
| **D3** | The re-check is **not** a coarse `AuthorizationVersion`. Each stored answer records **the permission keys it actually depended on** (usually none) and those exact keys are re-checked on reopen. An answer that needed nothing gated always replays | mine, owner approved |
| **D4** | **Standing instructions are business-wide**, one set for the whole business | owner |
| **D5** | **No persona box.** One instructions box plus structured answer-style choices (length; figures as a table) | owner |
| **D6** | **A new permission key `ai.answers.manage`**, Business scope, granted to `primary_owner` + `administrator` ONLY. Not `voice.settings.manage` (wrong feature, and Ask Clinket is not behind the AI package); not `business.profile.update` (would hand it to `catalog_manager`) | mine, owner approved |
| **D7** | **Every other member SEES the rules, read-only**, in the same panel with the controls disabled and one line naming who set them | mine, owner approved |
| **D8** | **Rename + delete one + delete all**, all member-scoped. A delete removes the conversation document too — a delete that only hid the row would be a lie | owner |
| **D9** | Ask Clinket's standing instructions are **SEPARATE** from the phone assistant's. Two boxes, two audiences, a one-line pointer on each screen. The live phone behaviour is not touched | owner |
| **D10** | **Nobody but the member** can open a saved conversation — not a colleague, not the owner, not an administrator, not admin support. Unchanged from today, and it is what keeps replay safe | owner |

### 1.1 Consequences recorded, so they are not "found" later as defects

- **D4 ⇒ the answer-style choices are business-wide too.** A technician cannot shorten only their own
  answers. Deliberate; a personal layer later is purely additive and changes nothing built here.
- **D9 ⇒ two boxes with similar names.** Each screen carries one line pointing at the other, or providers
  will set a rule in the wrong place and report it as a bug.
- **D2 + D3 ⇒ a new visible state**: a reopened answer that is withheld. It must be drawn (H1) and worded,
  or it ships undesigned.

---

## 2. ‼️ THE §0.7 ITEMS — the complete list, approved 2026-09-17

> Everything here is Cosmos. **No SQL table, no SQL column, no EF migration, and no new index path or
> composite index anywhere.** Both new documents are reached by a deterministic id inside a partition the
> caller already holds, so they are POINT READS and cost no index entries.

| # | Store | What | Who writes | Who reads | Cost | What breaks if omitted |
|---|---|---|---|---|---|---|
| **S1** | Cosmos `SystemData` | New document family `BusinessSearchConversationList` — `pk = businessId`, `id = bsconvlist_{membershipId}`. Holds up to `MaxListed` (500) headers: `sessionId`, `title`, `firstQuestion`, `turnCount`, `createdAt`, `lastActivity` | `BusinessSearchController` on the ask path (the same moment the turn is saved) and the rename/delete endpoints | `GET business/search/conversations` | ~1 RU point read (≈115 KB at the 500 cap); one read+CAS write per answer (~6 RU) beside an LLM call. **Zero index entries** — `SystemData` indexes `/type` and thirteen named paths, none of which this document carries beyond `/type` | The reported bug ships unfixed: conversations stay invisible after sign-out and on every other device |
| **S2** | Cosmos `SystemData` | New document family `BusinessSearchSettings` — `pk = businessId`, `id = bsearchrules_{businessId}`. Holds `standingInstructions`, `answerLength`, `figuresAsTable`, `updatedBy`, `updatedAt` | `PUT business/search/settings` (`ai.answers.manage`) | The ask path, cached per business with `Size = 1`, invalidated on write | ~1 RU on a cache miss, 0 on a hit. **Zero index entries.** ‼️ Deliberately NOT on `BusinessProfile`, which is projected onto the PUBLIC Open Page and into the search index — an internal rule must have no path to a public surface | D4/D5 cannot ship at all |
| **S3** | Cosmos `Communications` | `AiConversationTurn.usedPermissions` — `List<string>?`, `NullValueHandling.Ignore`, assistant turns only, **absent** when the answer needed no gated tool | `BusinessSearchAgent`, inside the write that already saves the turn | `GET business/search/sessions/{id}` on reopen | ~0 RU (rides an existing write), 0–80 bytes per turn. `history` is not an indexed path, so **no index entries** | 30-day retention ships with the §3.8 leak live: a member whose role is narrowed can re-read a figure they can no longer obtain |

**Why S1 is one document and not one per conversation.** A per-conversation header row would need
`membershipId` indexed plus a composite to sort — a new index path on a hot shared container, and index
writes on every header. One document per member is a point read, needs nothing indexed, and bounds itself.
The price is the cap, and the cap is **drawn and worded** rather than silently dropping rows.

**Why not query `AiSession` directly.** `metadata.membershipId` is not indexed, so Cosmos would load whole
conversation documents — up to `MaxConversationBytes` (1.6 MB) each — to filter. Measured shape, not a guess:
`CosmosContainerPolicies.Communications` includes fourteen named paths and `metadata` is not among them.

---

## 3. Settings — every dial, mirrored in `appsettings.json` (§0.12)

| Key | Default | Why |
|---|---|---|
| `BusinessSearch:SessionTtlDays` | **30** (was 7) | D2 |
| `BusinessSearch:Conversations:MaxListed` | 500 | The header document's cap. 500 × ~230 B ≈ 115 KB raw, ~18 KB gzipped, ONE point read ≈ 12 RU. Cosmos permits 2 MB an item, so this is a COST choice, not a technical bound |
| `BusinessSearch:Conversations:PageSize` | 20 | ‼️ Rows DRAWN at a time, never rows FETCHED. Every row lives in ONE document, so server-side paging would re-read it per page and pay the full cost repeatedly — strictly worse, not a trade-off. It would also break the instant, offline-capable find box |
| `BusinessSearch:Conversations:TitleMaxChars` | 60 | A renamed conversation. Above the namer's 40 so a person can be more specific than the model |
| `BusinessSearch:Rules:StandingInstructionsMaxChars` | 1000 | Matches the voice box the provider already knows. ‼️ Re-sent on every question by every member — it is the one dial with a per-answer token cost |
| `BusinessSearch:Rules:CacheMinutes` | 10 | Rules must take effect quickly; the read is 1 RU so the window is short |

`BusinessSearchConventionTests` already fails the build on drift between a default here and `appsettings.json`;
every key above joins it.

---

## 4. The phases

| Phase | What | Gate |
|---|---|---|
| **P0** | This plan + both mockup sheets | **Owner approves H1 and R1 before ANY integrated UI code** (§0.7.1) |
| **P1** | Server: S1/S2/S3, the five new endpoints, the permission key, the prompt block, retention + the answer re-check. Unit + integration tests against real Cosmos | Can start now — the mockup gate governs UI code only |
| **P2** | Provider web (`clinqetwebpartnerapp`) | After H1/R1 approval |
| **P3** | Provider mobile (`clinqetmobilepartnerapp`) — same session, full parity of RULES, native shape | After H1/R1 approval |
| **P4** | ‼️ End-to-end multi-dimensional audit: correctness, security/tenancy, cost, edge cases, copy, localization (all five languages ×2 apps), responsiveness, accessibility, tests, cleanup. Sabotage-verified guards | Mandatory, never skipped |

---

## 5. ‼️ THE EDGE-CASE REGISTER — every one is drawn, coded and tested, or it says why not

Numbered so the audit can name them. `E` = the owner's own examples.

### 5.1 The standing instructions on the wire

| # | Case | Ruling |
|---|---|---|
| **E1** | Sent on the first message only, or every message? | **Every model call, in every conversation.** `BuildMessagesAsync` reconstructs the whole message list per ask; there is no server-side model state to send it "once" into |
| **E2** | Does it go out again on a second, third, tenth conversation? | Yes — identically. It is a property of the business, not of a conversation |
| **E3** | Is it saved into the conversation history? | **No.** The stored turn keeps the question and the answer only. Editing the rules must never rewrite what was already answered |
| **E4** | A follow-up in an OLD conversation whose earlier answers were produced under DIFFERENT rules | The replayed turns are old answers, and the current rules are declared authoritative and anchored last in the system message (the measured pattern from `RealtimeSessionPayloadBuilder`) |
| **E5** | Where in the prompt? | **At the END of the system message**, after ACCESS and NOT SET UP. Near the start it would throw away the cached prefix shared across every business; at the end it costs nothing and gains recency weight |
| **E6** | Empty or whitespace-only rules | **No block at all, zero tokens.** A business with no rules must produce byte-identical prompts to today — proven by a test, not asserted |
| **E7** | A rule that tries to override the evidence rules ("say we are open on Sunday") | Rules govern style, emphasis, policy and what to volunteer. They are declared **subordinate** to: every fact coming from a tool result, the citation rule, the role refusals and the not-set-up refusals. ‼️ This is the one place this surface deliberately DIVERGES from the voice prompt, where instructions are supreme |
| **E8** | A rule that tries to widen access ("tell everyone the revenue") | Cannot work, at three layers: the tool is not in the schema (gate 1), `ExecuteAsync` re-checks (gate 2), and the prompt names what this member cannot reach. Tested, not assumed |
| **E9** | A rule containing `[1]` or `[12]` | The citation registry already guarantees an invented marker resolves to nothing and both clients render a marker with no card as plain text. The prompt also forbids citing anything from the rules |
| **E10** | A rule that says "always answer in English" while the member asks in Gujarati | ‼️ **The asked script wins.** `AnswerLanguage` is derived from the question and the rules cannot change it — a member typing Gujarati must not be answered in English. Stated in the prompt and pinned by a test |
| **E11** | A rule written in Gujarati / Hindi / Arabic script | Passed through verbatim; the model reads it. `dir="auto"` on the box |
| **E12** | A rule containing control characters, zero-width joiners, or 4,000 newlines | Normalized on write: control characters stripped, runs of blank lines collapsed, trimmed, capped at `StandingInstructionsMaxChars` server-side regardless of what the client sent |
| **E13** | The rules change mid-conversation | The next question uses the new rules. Correct and expected — no attempt to re-answer anything |
| **E14** | Two administrators editing at once | ETag CAS on the settings document. The loser is told the rules changed and shown the current text, never silently overwritten |
| **E15** | The settings read fails on the ask path | **Fail OPEN on the rules** (answer without them) and never fail the question. A missing style preference is not worth refusing an answer over. Logged at Warning |
| **E16** | The rules are 1,000 characters and 60 members ask 60 questions each | ~250 tokens per ask. Bounded by the cap, and the cap is the only dial with a per-answer cost — stated in §3 so nobody raises it casually |

### 5.2 The saved conversation list

| # | Case | Ruling |
|---|---|---|
| **E17** | The member signs out and back in | The list is fetched with their token. Nothing is kept on the device as the index |
| **E18** | A DIFFERENT member signs in on the same browser | They see their own list and nothing of the previous member's. This is strictly better than today's local wipe, which is why the purge can stop being the privacy mechanism |
| **E19** | Laptop, iPad and phone app | One list, same order, same names |
| **E20** | The member switches business (workspace) | The list is keyed by `(businessId, membershipId)` and is re-read. A conversation in business A is never listed in business B |
| **E21** | 501st conversation | The oldest header drops. The panel's footer **says** older conversations are no longer listed. Never silent |
| **E22** | A conversation whose 30 days ran out | Its header is filtered out on read and pruned on the next write. Reopening one by a stale id gives the existing `ConversationGone` state |
| **E23** | Reopening a deleted conversation from a second tab | Same `ConversationGone` state. No 403, no "does it exist?" leak |
| **E24** | Deleting the conversation currently on screen | The surface returns to the landing. A ghost transcript above an empty list is not acceptable |
| **E25** | Delete all while one is open | Same — landing, list empty, one confirmation naming the count |
| **E26** | Rename to empty / whitespace | Refused with words; the name reverts to the ladder (server name → first question → Untitled) |
| **E27** | Rename to 500 characters | Capped at `TitleMaxChars` server-side; the counter shows it client-side |
| **E28** | Rename a conversation that no longer exists | Told plainly, and the row is removed from the list |
| **E29** | The list read fails | Amber, with a retry that works. **Not** red — a list that did not load is not a breakage |
| **E30** | Offline | The panel says so; rename and delete are disabled with the reason, never offered and then failed |
| **E31** | Two devices ask at once | Both headers land; the CAS merge is keyed on `sessionId`, so the operation is idempotent and a retry is safe — unlike the turn append, where a retry would duplicate a turn |
| **E32** | The conversation write succeeds and the header write fails | **Order is load-bearing: conversation first, header second.** The only possible failure is a MISSING row (recovered on the next turn), never a row pointing at nothing |
| **E33** | A conversation with no name yet | The ladder. `dir="auto"` and one-line truncation so a 500-character first question cannot become a paragraph |
| **E34** | A very long or RTL name | Truncated on one line with `dir="auto"`; the full name is the row's title attribute on web and readable after opening on phone |
| **E35** | 500 rows on a phone | Windowed list, paged 20 at a time, and the panel is the only scroller — `overscroll-contain` so a flick at the end never scrolls the page behind it |
| **E36** | The filter box | Appears only past 10 conversations. A "nothing matched" state, with the filter clearable in one tap. ‼️ Filters **on the device**, issues no request, and therefore still works with no connection — which is only possible because the whole list arrives in one fetch |
| **E36a** | ‼️ **The ORDER of a delete** | **The conversation document dies FIRST, the row second.** A half-failure then leaves a row that opens to "no longer here" — visible, retryable, and the retry is idempotent. The reverse order would leave live data the member believes is gone, which is the worse of the two failures |
| **E36b** | A delete-all where SOME conversations could not be deleted | Reported honestly — *"3 could not be deleted"* with a retry — never a success. Bounded parallelism, and a failed one keeps its row so it can be tried again |
| **E36c** | A row that outlives its conversation | Self-healing: reopening it 404s, the client drops the row, and the server prunes it on the next write. Rows are also filtered by age on read |
| **E36d** | Server-side paging | ‼️ **Deliberately none.** Every row lives in ONE document, so a "page 2" request re-reads it and pays the full cost again — strictly worse, not a trade-off. `PageSize` governs rows **drawn**, never rows fetched |

### 5.3 Retention and the answer re-check

| # | Case | Ruling |
|---|---|---|
| **E37** | An answer that used no gated tool (hours, a document, the profile) | `usedPermissions` is absent. **Always replays.** This is the common case and it must cost nothing |
| **E38** | An answer that used `booking.read`, and the member still holds it | Replays unchanged |
| **E39** | An answer that used `invoice.read`, and it has since been removed | The conversation opens, the question is still there, the answer is replaced by one honest sentence. Nothing is deleted |
| **E40** | A member GAINS a permission | Nothing is withheld. ‼️ This is exactly the false alarm the coarse version number would have produced |
| **E41** | A removed, suspended or merely invited member | Refused before any controller runs (`BusinessAccessPolicy.Classify`) — unchanged, and still the strongest of the three protections |
| **E42** | A withheld answer is rated, copied or has its sources opened | None of those controls is drawn on a withheld answer. A control that cannot work is never offered (M12's rule) |
| **E43** | The permission snapshot cannot be read on reopen | **Fail closed**: the answer is withheld with the same sentence. "I could not check" is never "it is fine" |
| **E44** | A tool whose permission key is later renamed or retired in the catalogue | A stored key that names no live permission is treated as NOT held ⇒ withheld. Fail closed, and a convention test names the keys the tools declare |

### 5.4 The settings surface

| # | Case | Ruling |
|---|---|---|
| **E45** | A member without `ai.answers.manage` opens it | The same panel, controls disabled, one line naming who set the rules. Never a refusal dialog |
| **E46** | The permission snapshot has not resolved yet | The panel shows loading, never an editable box that becomes read-only a moment later |
| **E47** | The access read FAILED | ‼️ A failed access read is **not** a denial and **not** a grant. The panel opens read-only and says the rules could not be confirmed as editable |
| **E48** | Unsaved changes when the panel is closed | Asked before losing them, on both apps, including the phone's hardware back |
| **E49** | Saving while offline | The control is disabled with the reason, never offered and then failed |
| **E50** | Clearing every rule | Saves empty, the panel returns to the "nothing set yet" state with its examples |
| **E51** | The rules are edited while a member elsewhere is mid-answer | That answer finishes under the rules it started with. The next question uses the new ones |

---

## 6. Where the code goes

| Layer | Files |
|---|---|
| Entities | `clinqetcore/Entities/COSMOS/` — the two new documents; `AiSession.cs` gains `usedPermissions` |
| Interfaces | `clinqetcore/Interfaces/BusinessSearch/` |
| Services | `clinqetinfrastructure/Services/BusinessSearch/` — the list store, the settings store + cache, the prompt block |
| Permission | `clinqetinfrastructure/Data/SQL/TenancyRoleCatalogDefinition.cs` — ‼️ grants are **never written to SQL**, so a new key is a pure code change with no migration |
| API | `Clinqet.API/Controllers/BusinessSearch/BusinessSearchController.cs` |
| Tests | ‼️ §0.18 — Business Search runs in `Clinqet.API`, so `Clinqet.API.UnitTests` / `.IntegrationTests`, never the MCP or Functions suites |
| Web | `clinqetwebpartnerapp/src/components/businessSearch/`, `src/hooks/`, `src/lib/businessSearch/` (the twins) |
| Mobile | `clinqetmobilepartnerapp/src/Screen/ProfileFlow/BusinessSearch/`, `src/hooks/`, `src/lib/businessSearch/` |

‼️ `askRules` and `redactQuestion` are **twins** — every shared rule is extended in BOTH repos or neither,
and the twins return **web** key names that mobile translates through a mapper (§13.10). A rule-supplied key
handed straight to i18next prints its own id on the provider's screen; that has already shipped once.

---

## 7. ‼️ THE CLOSING AUDIT — 2026-09-17, after the code was green

Ran against the finished change, not against its own tests. **Rule zero: read the code against the
DECISIONS in §1, never against what the tests assert** — a test that pins a defect reports success.
Every finding below was FIXED in the same session; none is deferred.

### 7.1 The authorization finding — the one that mattered

| | |
|---|---|
| **What** | Reopening a saved conversation re-checked only the permission **KEY**, never the **scope** |
| **How it was found** | An integration test written from D6, not from the code |
| **Who it hurt** | `technician` holds `invoice.read` at **Assigned** scope. An answer an OWNER produced across the whole business re-read as "still allowed", and four unpaid invoices belonging to other members stayed on screen |
| **Why the guard missed it** | `AiConversationTurn.UsedPermissions` stored `"invoice.read"`. The key was still held, so the check was **true and wrong** |
| **Fix** | Store `key:Scope` (`"invoice.read:Business"`) and re-check with `tenant.Has(key, scope)`. `Required(entry)` parses on the LAST `:` and falls back to `Business` — the **strictest** reading — for anything malformed, so a corrupt record withholds rather than reveals |
| **Proved by** | `ANarrowedScope_WithholdsEvenThoughTheKeyIsStillHeld`, plus three `AMalformedRecord_Withholds` theory cases |

‼️ **The lesson, and it generalises past this feature:** a permission key is not a permission. Everywhere
this platform records "what was allowed" for a later re-check, it must record the **scope with it**, or the
re-check silently widens as roles narrow.

### 7.2 Findings in the screens

| # | What the audit found | Why it was wrong | Fixed |
|---|---|---|---|
| A-1 | `titleMaxChars` (60) and `keptDays` (30) were hardcoded in BOTH panels | `SessionTtlDays` is a setting (§3). Raising it to 60 would leave the screen printing "Kept for 30 days." — **a false sentence**, not a stale one | Both travel in `BusinessSearchConversationsDto`; the screens have no number of their own |
| A-2 | Escape read state through **nested `setState` updaters** | An updater must be pure, and React invokes it twice under StrictMode ⇒ one key press could close the panel twice, and Escape mid-rename threw the member's typing away | Read through `openState` ref; peels confirm → rename → menu → panel |
| A-3 | The "show more" window reset on `conversations` | Every answer rebuilds that array, so a member who pressed Show more while an answer streamed beside the open panel was thrown back to row 20 mid-scroll | Resets on `filter` only |
| A-4 | Three new French titles carried a space before `?` | Ruling **R7**: fr-CA takes no space before `?` `!` `;` (it keeps one before `:`) | Caught by the localization integrity guard; all three corrected |
| A-5 | Six hook mocks lacked `conversationLimits` | ‼️ **A mock that omits a field changes what the test is testing** — the same trap as the rail's `accessKnown` | Field added to every mock |

All five are now **regression guards**, not prose: `ConversationListPanel.test.jsx` (16 cases) covers A-1,
A-2 and A-3, and each was **sabotage-verified** — the fix reverted, the suite run, exactly the intended
cases failed, then restored from a scratchpad **copy** (‼️ §0.19 — never `git checkout --` in these trees).

### 7.3 Defects found OUTSIDE this change, while auditing

‼️ Reported rather than absorbed — none belongs to this programme.

| Where | What | Action |
|---|---|---|
| `clinqetwebpartnerapp/src/components/home/LandingPage.jsx` (commit `98f8c603`) | `const PRODUCT = "Clinket Business"` shadowed the imported `PRODUCT` map ⇒ the landing page's Business register/sign-in links carried **`?experience=undefined`**. ‼️ Worse: the file **failed to parse, so ESLint checked none of it** | **FIXED** (`PRODUCT_NAME`) — a live customer-facing link |
| Mobile: `businessSearchAskGrowth`, `analyticsWebParity`, `businessSearchScreenRegistration` | Three suites red on a clean tree from commit `95add94b` (a dashboard ask field added without its mocks) | **FIXED** — test-only |

#### 7.3.1 ‼️ `ServiceBusQueueConfigurationTests` — the guard was INVENTING the bug

My first reading of this was **wrong**, and the correction matters more than the fix. I reported it as
"`deploy.ps1` carries zero `QueueName` entries for the API ⇒ every non-dev stamp inherits `-dev`". It does
not. Reading `deploy.ps1` properly:

- `$script:ServiceBusEntitySettings` (line ~1591) holds **every** Service Bus entity name, and it is merged
  onto **all four hosts** — API (7349), Identity (7476), Functions (7161), MCP (8401).
- Lines ~1636–1646 already **throw** at deploy time if `ServiceBusSettings.cs` declares a name that table
  never sets. That is the §0.17-rule-4 home for a cross-repo check, and it works.

So the configuration was **correct**, and the test was **stale**: its locator read only the inline
`Merge-AppSettings … @{ … }` literal, and the names had moved out of that literal into the shared table.
It then accused **43 healthy keys** of being missing.

‼️ **This is the §0.15 failure mode exactly — a guard whose scan silently stopped matching does not merely
fail to catch bugs, it INVENTS them.** It is also why the fix is not "make it pass":

| Fixed | How |
|---|---|
| The locator | Builds the API's whole settings surface — every inline hashtable merged onto `$ApiAppName`, **plus** the shared entity table *when that table is merged onto the API* |
| The proof it still bites | New `TheApiSettingsSurface_IsBoundedToTheApiApp_NotTheWholeScript`: the surface must contain the API's own `FullyQualifiedNamespace` **and** a shared-table key, and must **not** contain `AzureWebJobsStorage` — a setting only the Function App receives. A locator that widened to the whole file would pass the other assertions while checking nothing; this one fails |
| Two misleading messages | Both failure texts said "add it to the API block"; they now name `$script:ServiceBusEntitySettings`, which is where it actually goes |

**Nothing in `azureautomation` was changed** — it was right.

#### 7.3.2 The web flake — a class, not a test

`RouteKycModal.railError.test.jsx` failed once in a full run and passed 9/9 in isolation. The stack was
jest's **test-timeout** signature, not an assertion. Measured rather than assumed: the **eleven**
`RouteKycModal.*` suites each render a large form, and run together their slowest tests cost **2.9s, 2.85s,
2.8s** against jest's **5s default** — so several sit within 2× of the ceiling, and under a 303-suite
parallel run whichever one loses the CPU race times out. The one I saw was not special.

Fixed at the class level in `jest.config.mjs` — `testTimeout: 15000`, ~5× the slowest observed test. The
project had **no** global `testTimeout` and **no** per-suite `jest.setTimeout` anywhere, so this is one
decision in one place rather than eleven copies waiting for a twelfth suite to be written without it. No
assertion was touched, nothing is retried and nothing is skipped — only the budget is stated.

### 7.4 What the audit deliberately did NOT change

- **Cross-partition**: every new query passes `businessId`. Re-read `cosmosindexsetup/Program.cs` first (§0.6).
- **No second write path**: the per-answer index write is **one** Cosmos request (PATCH-first, create on
  miss), not two. The title is absent from the PATCH payload, so it **cannot race a rename**.
- **No new container, no TTL change beyond the approved `SessionTtlDays` 7 → 30** (§2).

### 7.5 Verification, as run

‼️ Owner ruling, 2026-09-17: **every** failure is fixed, including the ones that were not mine. Nothing is
left pending, nothing is skipped, and no suite is green because it stopped looking.

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | **12,780 pass · 0 failed · 0 skipped** |
| `Clinqet.API.IntegrationTests` — Business Search | **129 pass** against a real Cosmos emulator |
| Provider web — jest | **303 suites / 4,229 tests pass** · ESLint **0 errors** · run **twice**, clean both times |
| Provider mobile — jest | **338 suites / 5,195 tests pass** · tsc **0 errors** · ESLint **0 errors** |

‼️ **Still open, and owned by the owner, not by me:** sheets **H1** and **R1** are DRAFT in both registers
and need approval (§0.7.1 MOCKUP GATE); and the owner pushes and deploys — nothing here has been pushed.
