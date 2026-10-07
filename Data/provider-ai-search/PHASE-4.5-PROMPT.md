# PHASE 4.5 PROMPT — Business Search ("Ask Clinket"), the close-out fix phase

> ‼️ **Why this phase exists.** P4 finished green and audited, but its audit found defects in code no phase
> had touched, plus residuals, and the P4 session parked them in `CARRIED-TO-P5.md`. **The owner rejected
> that on 2026-09-04:** *"nothing fucking move to phase 5 and phase 5 should be only end to end audit"*.
> P5 is an **audit**. This phase is where the fixing happens, so P5 has nothing left to build.
>
> ‼️ **STAY FOCUSED.** The owner asked for exactly that. This prompt is a closed list, and **every decision
> in it is already made** (§0b). Do not add scope, do not redesign, do not touch shipped Ask Clinket
> behaviour beyond the items below. A new finding is **written down and reported**, never fixed in this diff.
>
> **Read first, completely, in this order:**
> 1. `C:\Nik\CLAUDE.md` §0 — the zero-tolerance rules. All of them apply.
> 2. `C:\Nik\Data\provider-ai-search\findings\AUDIT-P4-2026-09-04.md` — **§8 (residuals) and §9 (defects in
>    untouched code) are the source of this list.** ‼️ **§9.8 carries a CORRECTION of a wrong finding — read
>    it before touching any config.**
> 3. `C:\Nik\Data\provider-ai-search\PLAN.md` — the programme authority. §0 is the mockup register; §15 holds
>    the locked decisions.
> 4. `.claude/skills/clinqet-business-search/SKILL.md` — the living contract. **§5 is the audience rule, §16
>    is P4.**
> 5. `CARRIED-TO-P5.md` — what genuinely stays for P5 after this phase.
>
> ‼️ **Never build or test while another session is working in `C:\Nik`** — concurrent sessions share the
> same `obj/bin`. ‼️ **Never run `git checkout` / `restore` / `reset` / `stash` / `clean`** in these trees —
> other sessions hold uncommitted work in the same files (§0.19). Snapshot to the session scratchpad.
> ‼️ **The owner commits and deploys, never you** (§21).

---

## 0. ‼️‼️ THE THREE RULES THAT OVERRIDE EVERYTHING ELSE IN THIS FILE

**Owner, 2026-09-04, verbatim:** *"all of them need to be done in the best practise way and not the patch to
get the current thing working that is must and super super important … and then test with the live data and
not to assume so if unsure ask me and simple way explain and ask instead of assuming wrong"*.

### 0.1 ‼️ ROOT CAUSE ONLY. A PATCH THAT MAKES THE SYMPTOM GO AWAY IS A FAILED ITEM.

Every item in this phase is a **defect with a cause**. Fix the cause. §0.3 of `CLAUDE.md` already forbids
workarounds; this phase is where that is tested, because every item here is tempting to paper over.

**Before you write a fix, answer these four in the change itself (one line each, no essays):**

1. **What CLASS is this defect?** ‼️ **RULE ZERO of the knowledge audit runbook: fix the CLASS, never the
   instance.** Chasing one duplicated price once surfaced two defects that were not in the test data and
   would have shipped. Ask *"what else is in this class?"* and fix that too, or say why it is not.
2. **Where is the single source of truth now, and is my fix creating a second one?** ‼️ Four disagreeing
   currency lists (§2) and two audience parsers (§3) are both **this exact failure**. A fifth list or a third
   parser is not a fix.
3. **Could this defect recur?** If yes, the fix is incomplete without a **guard that fails the build** —
   and the guard must be **sabotage-proven red** or you do not know it works.
4. **What did my change make dead?** Delete it in the same change: the old helper, the unused import, the
   orphan appsettings key, the stale DI registration, the comment that is now a lie (§22.2, §0.16).

**These are patches. Every one of them fails the item:**

- Adding a field to carry a value instead of not destroying it (‼️ this is precisely why the extra
  `searchAudienceRaw` field was **rejected** — see §3.1).
- Special-casing the currency that is broken instead of unifying the definition.
- Catching an exception so the symptom stops appearing.
- Widening a test's expectation to match wrong behaviour.
- Fixing one of two twin files, one of four surfaces, or web without mobile.
- A comment explaining why something is wrong, left in place of the fix.

### 0.2 ‼️ VERIFY AGAINST LIVE DATA. NEVER ASSUME WHAT THE DATA LOOKS LIKE.

Unit tests prove the code does what you wrote. The emulator proves the engine accepts it. **Neither tells
you what is actually in the data**, and three defects in this programme came from assuming.

**Where the live credentials are — read them AT RUNTIME, never copy a value into a file, never print one:**

| What | Where |
|---|---|
| Cosmos connection string · Search endpoint + key · Storage connection string — **all four in one file** | `C:\Nik\cosmosindexsetup\appsettings.ca.json` (Canada) · `appsettings.in.json` (India) |
| Embeddings, to replay the REAL hybrid query | `clinqetfuncations\Clinqet.Communications\appsettings.json` → `AzureAIFoundry.ApiUrl` / `.ApiKey` / `.EmbeddingModel` |
| The live model, for §5's measurements | `clinqetapi\Clinqet.API\appsettings.json` → `AIService.Endpoint` / `.ApiKey` |

**Names that are easy to get wrong:** Cosmos **`KnowledgeBase-dev`**, partition key **`/businessId`** · blob
container **`provider-knowledge`** · Search alias **`clinket-knowledge-dev`** (physical `…-v1`) · ‼️
**api-version `2026-04-01` for the ALIAS** — an alias 404s on `2024-07-01`, while the physical name works on
either. ‼️ Index fields are **`chunkKind`/`sectionTitle`** — `kind`/`sectionPath` **do not exist**, and a bad
`select` returns no `value`, which looks exactly like an outage.

**Existing harness — use it rather than building one:** `C:\Nik\knowledge-table-hunt`. A plain run is **69
cases** PASS/FAIL; `-- --di <file>` replays **one REAL document** through the true parser and chunker and
prints the cards, **with no deploy**.

**The specific live checks this phase owes — one per item, and each answers a question I could otherwise
only assume:**

| Item | ‼️ The live check, and the assumption it kills |
|---|---|
| **§3** the audience root fix | ‼️ **Query the DISTINCT `searchAudience` values across every row in `KnowledgeBase-dev`, both regions.** The whole "unreachable today" analysis rests on *"only `Team` and `Roles` exist"*. **If a live row already holds anything else, that analysis is WRONG and the defect is live** — report it immediately rather than proceeding. Also count rows where the field is **absent**, which must read as *everyone*. |
| **§2** the money fix | ‼️ **Query the DISTINCT currencies actually present on live dispute/payment rows**, and how many carry **no** currency at all (`ParseCurrency` defaults those to **USD**, which is how the wrong-symbol bug became reachable). Do not assume "every live currency has cents" — **look**, then render each real value through the new formatter and compare it to what the page renders. |
| **§1** the duplicate upload | ‼️ **Find a REAL pair of same-byte documents in live data** (or take a real file out of `provider-knowledge` and re-upload it) and watch what actually happens to the caller switch, the type and the offerings. Replay a real document through `--di` to confirm the surviving row's cards are still correct. |
| **§4.2** `list_customers` | ‼️ **Measure it against a real business's customer partition** — actual row count, actual round trips, actual RU before and after. A theoretical "9 round trips" is not a measurement. |
| **§5** both measurements | The **live model**, 800-call-scale, source-verified prompt (§5.3). Already live by construction. |

**Traps that have each cost real time — do not re-learn them:**

- ‼️ **A BM25-only curl is NOT the product's path** and understates it; its artefacts were once reported as
  live defects. Measure the **composed hybrid query** (`search` + `vectorQueries` + `preFilter` + businessId).
- ‼️ **A rising hit COUNT is not a win — open the documents.**
- ‼️ **A card count that does not move is NOT proof a re-parse failed** — same count, different content.
- ‼️ **`tee <file> | head -n` SIGPIPEs and truncates the capture.** Redirect instead.
- ‼️ **Chars ≈ 4× tokens.** Do not report a unit change as a 4× regression.
- ‼️ **The deployed MCP host cannot be probed from a dev machine (`403 Ip Forbidden`).** Config-in-HEAD plus a
  replay of the exact logic against the live index is the available proof. **Do not claim to have read the
  running config.**
- ‼️ **Never `--recreate-aliases`** (it DELETES a live index) and never a bare `cosmosindexsetup` run — it
  continues past the indexes into container init **and sample-data seeding** on shared dev data. Use
  `dotnet run --launch-profile "Dev (Canada)" -- --search-only`, and **always** `--launch-profile` (the tool
  ignores a shell `CLINKET_REGION`).
- **Probe scripts go in the session scratchpad, NEVER inside a repo** (§0.16).

### 0.3 ‼️ IF YOU ARE UNSURE, ASK. EXPLAIN IT SIMPLY AND ASK — DO NOT ASSUME WRONG.

The owner asked for this in these words, and it outranks finishing fast.

- **Ask when the answer changes what you build** — a behaviour choice, a copy decision, a trade-off with a
  real cost, a live-data finding that contradicts this prompt. **Do not ask about things you can read**: file
  contents, existing patterns, what a test asserts. Read those (§0.13).
- ‼️ **Explain it in PLAIN WORDS first, then ask.** No jargon, no section numbers as the explanation, no
  three-page preamble. Say what happens, who it affects, what the options are, what each costs, and what you
  recommend. The owner said *"I dont understand at all what you trying to say"* once in this programme —
  that was a failure of the explanation, not of the reader.
- ‼️ **Give a recommendation with every question**, so a one-word answer is enough.
- ‼️ **A wrong assumption stated confidently is the worst outcome available.** If this prompt and the code
  disagree, **the code wins and the prompt is wrong** — say so, do not quietly follow the prompt.
- **State every assumption you could not resolve**, in the audit, by name. An assumption nobody wrote down
  is indistinguishable from a fact.

---

## 0b. ‼️ THE OWNER'S RULINGS — ALL LOCKED 2026-09-04. DO NOT RE-OPEN ANY OF THESE.

| # | Question put to the owner | ‼️ RULING |
|---|---|---|
| **1** | Item #10 — the audience-value root fix | ‼️ **APPROVED as specified in §3.** The rule owns the parse, the entity holds the raw string, the converter is **deleted**. No new field, no migration |
| **2** | Where the one money helper lives — change the shared formatter, or patch only the refund surfaces? | ‼️ **CHANGE THE SHARED FORMATTER.** One formatter is the whole point. **See §2.3 for the consequence the owner accepted** |
| **3** | Duplicate upload — whose settings win? | ‼️ **THE NEWEST EXPLICIT CHOICES WIN.** The existing document keeps its id/identity; the provider is told either way |
| **4** | `get_business_profile` — amend the design doc, or trim the tool? | ‼️ **AMEND THE DOC** to enumerate what ships. Do not remove fields from the tool |
| **5** | `MaxImagesPerDocument` 15 vs 40, and `MaxTotalMediaBytes` | ‼️ **THE FINDING WAS WRONG — 15 and 40 are TWO DIFFERENT SETTINGS and both are correct. Leave them alone.** Only the narrow `MaxTotalMediaBytes` declaration is owed. **§4.6** |
| **6** | The dead withheld-document counter — surface or delete? | ‼️ **SURFACE IT** as a log line. It is the only operator signal for how much of a library is hidden |
| **7** | O9 — if it says "switch to the search index", switch it here? | ‼️ **MEASURE AND REPORT ONLY.** Flipping a data source is not a fix-phase change. The dial stays on `Cosmos` |
| **8** | C1's leftover — attempt the re-wording, or leave it? | ‼️ **ATTEMPT IT, with a full re-measure, and REVERT on any drop.** A cache miss per alphabet change is a real running cost |
| **—** | The committed Azure keys | ‼️ **DROPPED. NOT AN ISSUE — the owner states that is a sandbox.** Do not raise it, do not untrack the file, do not rotate anything |
| **—** | The card date format (`2026-09-04` vs "4 Sep") | ‼️ **RAISED AND DELIBERATELY NOT PUT IN SCOPE.** It stays an accepted residual |

**Order of work:** §1 alone and first → §2 → §3 → §4 → §5 → §6. §1 and §2 are the two that can hurt a
provider; do them while you are freshest, not last.

---

## 1. ‼️ FIRST, AND ALONE — the duplicate-upload data loss

**`AUDIT-P4` §9.1. The only reachable-today defect on the list. Its own change, its own tests, finished
before anything else in this phase begins.**

When an uploaded file's bytes match an existing `Ready` knowledge document, `RefreshHashTwinAsync` copies
**only `DocName`** onto the existing row and deletes the incoming one. Everything else the provider just
chose is silently discarded:

- the document **type** they picked,
- the **linked offerings**,
- ‼️ the **"share with callers" switch** — so a provider who explicitly said *"do not send this to callers"*
  keeps a file that is still sendable,

and it renames an unrelated document into the bargain. No failure reason is set and no notice is dispatched,
so the whole thing reads to the provider as a clean success.

### 1.1 What to build

**‼️ RULING 3: THE NEWEST EXPLICIT CHOICES WIN.** The provider made them seconds ago, so they are the
truest statement of intent. Concretely:

1. **Read the whole upload/confirm path end to end before changing a line** — `KnowledgeManagementService`,
   the hash-twin logic, the parsers. ‼️ **A concurrent session was editing these files during P4** (it added
   `KnowledgeAnswerableRule`, narrowing answerability to `Ready`-only). **Re-read them; do not trust P4's
   description.**
2. **The surviving row keeps its identity** — its `docId`, its partition key, its already-indexed cards
   (the bytes are identical, so the content and therefore the cards are still correct).
3. **Every provider-set field on the incoming row is applied to the survivor**: `docName`, the type, the
   linked offerings, `shareWithCallers`, **and `searchAudience` + `searchAudienceRoleKeys`** — ‼️ that last
   pair is an **authorization** field, so if the newest choice is *more restrictive* it must not be lost, and
   if it is *less* restrictive it is still the provider's explicit choice. Apply it and say so (step 4).
4. ‼️ **The merge must never be silent — but it does NOT earn a notification.** Tell the provider **in the
   upload response and on screen** that their file matched an existing one and what was applied to it.
   ‼️ **Do NOT add a new `NotificationType`** — a routine "we merged your duplicate" is exactly the noise the
   owner's notification-restraint rule forbids (`feedback-notification-restraint-honest-recs`), and a new
   type would cost five language files plus a `SignalRSettings:EnabledNotificationTypes` entry for something
   the provider is already looking at. **If the merge FAILS**, that is different: set a failure reason and
   use `FailureNotificationHelper` → admin alert, exactly as the rest of the ingest path does.
   ‼️ **Copy is a localization key in every language file** (§0.10) with **no technical word a provider can
   read** (§0.20) — say *"this file is already in your library; we've applied your new settings to it"*,
   never *"hash collision"*, *"twin"* or *"merged row"*.
5. **The write is a CAS merge**, like `SetShareWithCallersAsync` and `SetSearchAudienceAsync`. A 412 fails
   gracefully with a clear error (§8) — never a silent overwrite.

### 1.2 Tests — integration tests are MANDATORY here (§0.8)

This is a data-safety path with a deterministic-id replay, so **EF-InMemory-style proof is not acceptable**.
On the **real Cosmos emulator**:

- a duplicate upload **keeps the provider's newest caller choice** (the headline defect);
- a duplicate upload **keeps their newest type and linked offerings**;
- a duplicate upload **keeps their newest audience + role keys**;
- ‼️ a **replay** of the same Service Bus message **converges** rather than duplicating (deterministic ids ⇒
  a redelivered write conflicts, it does not duplicate);
- the provider **is notified**, asserted with a bounded poll, never a fixed sleep
  (`Eventually.FindAsync`, own DI scope per probe).

‼️ **Sabotage every one of them** and confirm red. Sabotage with **valid** code that is *wrong* — an
invalid-C# sabotage fails to compile and the test "passes" against a stale DLL.

---

## 2. ‼️ THE MONEY FIX — ONE formatter, all four surfaces, and Indian grouping

**`AUDIT-P4` §9.2 + §8.3. ‼️ RULING 2: CHANGE THE SHARED FORMATTER.**

### 2.1 What is wrong

- **Four provider surfaces divide minor units by 100 unconditionally**, so a **¥5,000** refund renders
  **¥50**: the web refund-requests page, its detail drawer, the mobile refund screen, and any surface
  reading a dispute's minor units directly. Ask Clinket now renders it **correctly** (P4's C4), so the
  platform contradicts itself and the card is the one that looks wrong.
- ‼️ **The platform has FOUR disagreeing definitions of which currencies have no decimal places**, plus one
  app with no exponent helper at all. **Find all four before writing anything.** A fix that adds a fifth is
  worse than the bug.
- ‼️ **Grouping is Western.** A seven-figure INR amount renders `₹1,234,567.89` where the page's own ICU
  renders `₹12,34,567.89`.

### 2.2 What to build

1. **ONE definition of the exponent per currency.** `CurrencyMinorUnit` in the backend is the natural home;
   the apps get it from the wire or from **one** shared client twin — **never a fourth copy**. ‼️ **Delete
   the other three in the same change** (§22.2, §0.16). An orphaned copy is how this happened.
2. **ONE formatter, locale-aware, including Indian grouping.** ‼️ **RULING 2 authorises changing
   `CurrencyMinorUnit.ToMajorString`**, which P4 deliberately did not touch.
3. **Fix all four provider surfaces** to use it. Web **and** mobile in the same session
   (`feedback-mobile-must-mirror-web`).

### 2.3 ‼️ THE CONSEQUENCE THE OWNER ACCEPTED — state it in the change, do not discover it later

`CurrencyMinorUnit.ToMajorString` formats money **platform-wide**. Making it locale-aware therefore changes
**invoice PDFs, emails and every page that formats money** — an Indian business's invoice will start
rendering `₹12,34,567.89`. **That is correct for India and it is the intended outcome**, and the owner
accepted it on the grounds that the platform is pre-production. But:

- ‼️ **Enumerate every caller of `ToMajorString` and prove each one still renders correctly** — QuestPDF
  invoices, email templates, the pages. A test per surface family, not a spot check.
- ‼️ **QuestPDF `.Image` takes a FILE PATH** and the invoice/email logo path has broken twice before
  (memory: `email-logo-two-token-fix`) — if you touch invoice rendering at all, re-run those tests.

### 2.4 Tests — integration tests are MANDATORY (§0.8, money)

On the real engines: **JPY** and **KRW** (zero-decimal), **INR at seven figures** (Indian grouping), and
**USD**. ‼️ **The headline assertion is that the CARD string EQUALS the PAGE string for the same input** —
that equality is the entire point of the change, and it is the assertion P4 could not make.

---

## 3. ‼️ ITEM #10 — THE ROOT FIX. APPROVED. BUILD EXACTLY THIS.

### 3.1 The root cause — read this before you touch anything

**It is NOT "we do not store the raw word".** It is that **there are TWO parsers, and the rule that claims to
be the single source of truth owns only the comparison, not the interpretation:**

| Where | What it does with an unrecognised word |
|---|---|
| `KnowledgeSearchAudienceConverter` (entity attribute) | ⇒ `Roles`, and **leaves `searchAudienceRoleKeys` intact** |
| `KnowledgeDocumentRepository.ListSearchVisibleDocIdsAsync` (~lines 342–363) | ⇒ `Roles`, **and nulls the role list** |

`KnowledgeSearchAudienceRule.IsVisible` takes an **already-parsed enum**. Its own comment says *"ONE rule,
two callers… a second copy could drift and widen one of them"* — and that is exactly what happened, in the
one case the converter exists for. So the two read paths disagree: the sweep excludes the row, the point-read
behind the document page would honour the surviving role keys and **let people in**.

Second defect, same cause: the converter's parse is **lossy**. An old host reads a future word, parses it to
`Roles`, writes the row back, and writes the literal `"Roles"` — **the provider's choice is destroyed
permanently.**

‼️ **Adding a raw-value field would leave both parsers in place and add a third thing to keep in sync. That
is why it was rejected.** ‼️ **A sentinel enum member is worse still** — it would parse *and* re-serialize to
the sentinel.

### 3.2 The fix — three parts. It deletes more than it adds and needs no new field.

**PART 1 — the rule owns the interpretation.**

In `clinqetcore/Interfaces/Knowledge/KnowledgeSearchVisibility.cs`, `KnowledgeSearchAudienceRule` takes the
**raw string off the row** and returns both facts from **one** call, so nothing parses twice:

```csharp
public readonly record struct KnowledgeAudienceDecision(bool Visible, bool Recognised);

public static KnowledgeAudienceDecision Decide(
    string? rawAudience,                        // exactly what is on the row
    IReadOnlyList<string>? audienceRoleKeys,
    IReadOnlyList<string> memberRoleKeys,
    bool isOwnerOrAdmin)
```

Interpretation, in one place, for both callers:

- **absent, null or blank ⇒ everyone on the team.** The approved default for every row written before the
  field existed, and now an **explicit stated rule** rather than an accident of the enum's zero value.
- **a recognised word ⇒ that value**, with the existing role-intersection comparison unchanged.
- ‼️ **an unrecognised word ⇒ owner and administrators only, and `audienceRoleKeys` is IGNORED**, with
  `Recognised = false`. Fail closed, identically, on both paths — **by construction, not by discipline**.
- `isOwnerOrAdmin` short-circuits to visible, as today.

Keep the old `IsVisible(KnowledgeSearchAudience, …)` **only** if a caller genuinely still holds an enum
(none should) — otherwise **delete it** so a second entry point cannot reappear (§22.2).

**PART 2 — the entity stops parsing. It carries what is on the row.**

`clinqetcore/Entities/COSMOS/KnowledgeDocument.cs`:

```csharp
[JsonProperty("searchAudience")]
public string? SearchAudience { get; set; } = nameof(KnowledgeSearchAudience.Team);
```

- **Both converter attributes are removed** (the Newtonsoft one and the STJ `JsonStringEnumConverter`).
- ‼️ **`clinqetcore/Entities/COSMOS/KnowledgeSearchAudienceConverter.cs` IS DELETED**, with its file removed
  from the repo — not emptied, not left unreferenced.
- The initializer keeps writing `"Team"` on every new row, exactly as today, so rows stay self-describing.
- ‼️ **The round trip is now lossless because the original word never left.** Nothing is stored twice, so
  nothing can drift.
- ‼️ **This is NOT a new Cosmos field.** Same JSON property name, same stored values, **no migration, no
  backfill**. §0.7's "new field on any entity" does not fire. Say so in the change so a reviewer does not
  have to work it out.

**PART 3 — strict in, faithful out.**

- **The write path stays exactly as strict as it is.** `KnowledgeSearchAudienceDto.Audience` remains the
  `[Required]` **nullable** enum with `RoleKeys` at `[MaxLength(32)]`, so only `Team` or `Roles` can ever be
  written. ‼️ **Do not relax this** — the nullable-`[Required]` shape is what closed a silent widening in P4
  (a plain enum defaulted to `Team`, so an omitted field returned 200 and made the file team-wide).
- **`KnowledgeDocumentDto.SearchAudience` stays the typed enum** and carries the **interpreted** value: an
  unrecognised word is returned as `Roles` with an **empty** key list — the same fail-closed reading the
  server enforces, so the screen truthfully says *"only the owner and administrators"*.
  ‼️ **No web or mobile change is required by this item.** If you find yourself editing an app, stop and
  re-read this line.

### 3.3 Every site to change — counted, so nothing is missed

| File | Change |
|---|---|
| `clinqetcore/Interfaces/Knowledge/KnowledgeSearchVisibility.cs` | Part 1 — `Decide(...)` + the record struct |
| `clinqetcore/Entities/COSMOS/KnowledgeDocument.cs` | Part 2 — `string?`, attributes removed |
| `clinqetcore/Entities/COSMOS/KnowledgeSearchAudienceConverter.cs` | ‼️ **DELETE THE FILE** |
| `clinqetinfrastructure/Data/COSMOS/KnowledgeDocumentRepository.cs` (~342–368) | Delete the hand-written parse; call `Decide(row.SearchAudience, …)`; keep the unrecognised warning, now driven by `Recognised == false`; and fix §4.4's dead counter **in the same block** |
| `clinqetinfrastructure/Services/BusinessSearch/BusinessSearchDocumentService.cs:139` | Pass the raw string; log the same warning when `Recognised == false` |
| `clinqetinfrastructure/Services/Knowledge/KnowledgeManagementService.cs:654,658` | The CAS no-op compare becomes `string.Equals(row.SearchAudience, audience.ToString(), StringComparison.Ordinal)`; the write stores `audience.ToString()`. **Switching to `Team` still clears the role list** — a stale one would reappear the moment somebody switched back |
| `clinqetapi/Clinqet.API/Controllers/Knowledge/KnowledgeController.cs:1003` | `SearchAudience:` carries the **interpreted** value, not the raw string |
| `clinqetshared/DTOs/Knowledge/KnowledgeDtos.cs:184` | **Unchanged** — stays the enum |
| ~14 assertions across 5 test files | Assert the **raw string** where the row is the subject, the **interpreted** value where behaviour is |

**Exactly two callers of the rule exist** (`KnowledgeDocumentRepository.cs:365`,
`BusinessSearchDocumentService.cs:139`) — verified 2026-09-04. If you find a third, that is a finding.

### 3.4 The two tests that prove the root fix — both impossible today

On the **real Cosmos emulator**, extending
`clinqetapi/Clinqet.API.IntegrationTests/Tests/KnowledgeSearchAudienceCosmosIntegrationTests.cs`:

1. ‼️ **THE ROUND TRIP IS LOSSLESS.** `PatchOperation.Set("/searchAudience", "SomethingAFutureBuildAdded")`
   → read the entity → save it back unchanged → re-read the **raw JSON** → assert `searchAudience` is
   **still** `"SomethingAFutureBuildAdded"`. **Today this test yields `"Roles"`** — that is the data loss,
   proven.
2. ‼️ **THE TWO READ PATHS AGREE.** Same unknown word, **with** `searchAudienceRoleKeys` set to a role the
   asking member actually holds. Assert the **sweep** and the **point-read** return the **same** answer, and
   that the answer is **not visible**. **Today the sweep hides it and the point-read shows it** — that is the
   divergence, proven.

Plus a **convention test** as belt: assert `KnowledgeSearchAudienceRule` explicitly handles **every member**
of `KnowledgeSearchAudience`, so adding a third member without teaching the rule what it means fails the
build. ‼️ **Sabotage all three** and confirm red.

---

## 4. THE SMALL BATCH — narrow, one file each

| # | Item | Evidence | What "done" looks like |
|---|---|---|---|
| **4.1** | A **timed-out** audience read is reported as **FAILED** and the lookup-timeout alarm never fires — the catch has no `OperationCanceledException` exemption | §9.4 | A cancellation is distinguished from a failure; the alarm fires for the slowest read on the path. A test that a cancelled read alarms and is not reported as a failure |
| **4.2** | **`list_customers` reads the ENTIRE customer partition on every call** and filters `nameContains` in memory — 900 customers = 9 sequential Cosmos round trips to hand back 10 rows, and the file's own comment claims the opposite | §9.3 | A `CONTAINS` predicate inside the **partition-scoped** SQL (‼️ §0.6 — never cross-partition). ‼️ **Review `cosmosindexsetup\Program.cs` and decide in the same change whether an index must change** (§3.11). Fix the lying comment. A string-shape unit test on the SQL — the emulator is more permissive than production (memory: `feedback_cosmos_emulator_vs_prod_matcher`) |
| **4.3** | **`CapPayload` is wired on ONE tool.** The other eleven Group B tools serialize uncapped — ten rows at the row-text limit plus the notes can exceed `ToolResultMaxChars` and silently eat a third of the answer's budget | §4 "Cost" | Every Group B tool caps, or a test proves it cannot overflow. ‼️ **Do not change any tool's model-facing WORDING here** — that needs a live measurement (§5) |
| **4.4** | The **dead `excluded` counter** in the visibility sweep (`_ = excluded;`) | §9.5 | ‼️ **RULING 6: SURFACE IT** as a log line an operator can read — how many documents were withheld, for which business. **Not left as `_ =`, not deleted.** Do it in the same block as §3.3's repository change |
| **4.5** | **`businessRoleCatalogParity.test.js` reads a peer repo at describe-callback scope**, which §0.17 documents as still executing when skipped — so in CI it throws ENOENT and **fails** instead of reporting **Skipped** | §9.6 | Every peer read moved **inside an `it()`**. Copy the shape P4's own cross-repo test uses. ‼️ **Prove it**: run with the peer absent and confirm **Skipped** — never Passed, never failed |
| **4.6** | ‼️ **READ THE CORRECTION FIRST — `AUDIT-P4` §9.8.** `MaxImagesPerDocument` **15 (API) vs 40 (Functions) is NOT a divergence**: they are two different settings, in two different options classes, under two different config sections (`AIAssistant:ProviderAttachmentProcessing:Images` for AI Quick Setup; `Voice:Knowledge:Images` for knowledge ingest), read by two different features, and **both class defaults match their own appsettings**. ‼️ **RULING 5: LEAVE THEM ALONE.** The real item is narrow: **`MaxTotalMediaBytes` is declared only in the Functions appsettings**, while **both** hosts register `KnowledgeDocumentParser` (`Clinqet.API/Program.cs:861`, `Clinqet.Communications/Program.cs:803`) and both bind `Voice:Knowledge` — so the API silently uses the class default `268_435_456`, which happens to equal the Functions value today | §9.8 | Declare `MaxTotalMediaBytes: 268435456` in the API's `Voice:Knowledge:Images` block, so a future tune lands in both hosts instead of one (§4). ‼️ **Behaviour is identical today — this is a tuning-drift fix, so say that plainly rather than describing it as a bug.** Optional but recommended: a convention test asserting both hosts' `Voice:Knowledge:Images` blocks declare the same key set — ‼️ reading another host's appsettings to assert a config contract is the **one legitimate cross-repo test** (§0.15), so `Assert.SkipWhen` the peer is absent and report **Skipped**, never Passed |
| **4.7** | **The tool-registration convention test's service registry** pins three cross-cutting services and was already missing `IBookingDisputeService`; P4 added `ICurrencyService` and did not extend it | §8.10 | Enumerate from DI rather than a hand-maintained list, so the next addition cannot be invisible |
| **4.8** | **`ICurrencyService.GetCurrencySymbolAsync` takes no `CancellationToken`** | §8.4 | Added, threaded through its callers. One-liner |

---

## 5. ‼️ THE TWO MEASUREMENTS — a number, or it did not happen

### 5.1 O9 — never run, three phases in a row

**Should `search_services` read the AI Search index instead of the Cosmos leg?** The dial
`BusinessSearch:ServiceLookupSource` is alive and defaults to `Cosmos`. ‼️ **P1.5, P3 and P4 all skipped
this.** It is a **measurement**, not a decision.

‼️ **RULING 7: MEASURE AND REPORT ONLY.** Even if the number favours the search index, **do not flip the
dial in this phase** — changing a data source is not a fix-phase change. Record latency, result quality and
cost, recommend, and leave the switch to the owner.

### 5.2 C1's leftover — the tool schema still varies with the question's alphabet

P4 moved the multi-script SEARCH WORDS block from the system message to the **user** turn and measured it:
**800 live calls, A 150/150, B 650/650** (`findings/MEASUREMENTS-P4-2026-09-04.md`). But
`BusinessSearchToolRegistry` still builds `search_knowledge`'s `searchWords` **description** from
`scripts.IsSingleLeg`, and **the tool array is part of the cached prefix** — so for a multi-alphabet business
the prefix still changes between a Latin-only question and a mixed-script one, and the cache still misses.

‼️ **RULING 8: ATTEMPT THE RE-WORDING, WITH A FULL RE-MEASURE, AND REVERT ON ANY DROP.**

‼️ **That exact field measured 3/25 before P1.5's fix and 25/25 after.** Make the description invariant,
re-run the harness, and compare against 25/25. **If the number drops at all, revert and record the residual
with its cost.** No wording ships without a number.

### 5.3 How to measure — the credentials are already on this machine

`clinqetapi/Clinqet.API/appsettings.json` → `AIService.Endpoint`, `AIService.ApiKey`. ‼️ **Read them in code;
never print one, never write one into a file, never paste one into a report.**

‼️ **Use the SHIPPED deployment: `gpt-5.6-luna` at `reasoning_effort: "none"`.** `AIService.DeploymentName`
says `gpt-5.4-mini`, which is a different model and would measure nothing.
`POST {endpoint}/openai/deployments/gpt-5.6-luna/chat/completions?api-version={AIService.ApiVersion}`,
header `api-key`.

‼️ **REBUILD THE PROMPT FROM SOURCE AND ASSERT IT.** Do not retype wording into the probe. Read the
`.cs`/`.json`, and for every literal fragment **assert it is byte-present in the file it came from**, so a
typo throws instead of quietly measuring wording that does not ship. This caught two real mistakes in P4.

**N = 25 minimum per case, 50 when two variants are close, 100+ to confirm a fix.** Classify
programmatically — never eyeball a transcript. Add a timeout, a retry and a **"gave-up" bucket** so N can
never be silently smaller than claimed (P4's first run died on `UND_ERR_HEADERS_TIMEOUT`).

**What P3 and P4 learned, so you do not spend runs relearning it:**
- **State an ABSENCE; do not forbid harder.** Four rounds of strengthening a prohibition reached 48/50; one
  sentence naming the absence reached 50/50, then 500/500.
- **Say it about the RECORDS, never the model's ability.** *"You cannot add these"* invites a model that
  plainly can.
- **A prohibition with a carve-out in a sibling note is not a prohibition.**
- **Name the compliant action**, not only the forbidden one.
- **Measure the hunch before shipping it.** A "cleanup" rename made a money path *worse* (42/50).

Record every number in `findings/MEASUREMENTS-P4.5-<date>.md`. **A measurement with no number written down
did not happen.**

---

## 6. ‼️ THE FOUR RESIDUALS THE OWNER PUT BACK IN SCOPE

| # | Item | Evidence | What "done" looks like |
|---|---|---|---|
| **6.1** | **Indian grouping** on money | §8.3 | Folded into **§2** — do it there, once, not twice |
| **6.2** | **Mobile ships the web-length helper sentence.** Sheet M6 §4's phone frame draws a shorter line, but §6 registers only the long form — so the registered copy shipped | §8.6 | ‼️ **Fix BOTH sides**: add the phone line as its own key in **all five** mobile locale files (i18next, single apostrophes, **no English fallback** — `sourceLocalizationIntegrity` forbids them), **and register it in sheet M6 §6**. A sheet that draws copy it does not register is how this drifted. ‼️ **No technical word a provider can read**, in every language (§0.20) |
| **6.3** | **The phone row mark's tap target is ~34 px against a 44 px guideline** | §8.7 | ‼️ **Fix BOTH marks** — the audience mark **and** the caller mark beside it. P4 left it precisely because fixing one alone breaks the row's internal parity. Guard the size so it cannot regress |
| **6.4** | **`get_business_profile` returns more than `AUTHORIZATION-DESIGN` C5 enumerates** — description, email, phone, listed, onlineBookings, defaultLocation, hasKnowledgeDocuments (no licence numbers) | §8.8 | ‼️ **RULING 4: AMEND C5 to enumerate what ships.** Every one of those fields is the business's own data and already appears on its public Open Page; removing them would stop Ask Clinket answering basic questions about the provider's own business. **Do not trim the tool** |

**Also close the last design-claim drift while you are in `AUTHORIZATION-DESIGN`:** **T7** says *"only opaque
handles are replayed; each turn re-authorizes"*, but a saved conversation replays the answer's **prose**,
which is not re-authorized. ‼️ **P4 re-checked the trigger list and no trigger has become true**, and a
concurrent session's recent-questions lane stores only `{question, sessionId, at}` locally, never the prose.
**Amend T7's wording. Do not build `AuthorizationVersion`** — a new Cosmos field ⇒ §0.7, and nothing needs it.

---

## 7. WHAT THIS PHASE MUST NOT TOUCH

- ‼️ **The committed Azure keys.** The owner ruled it a sandbox and **not an issue**. Do not raise it, do not
  untrack the file, do not rotate anything.
- ‼️ **`MaxImagesPerDocument` 15 and 40.** Two different settings, both correct (§4.6).
- ‼️ **The card date format.** `2026-09-04` stays. Raised and deliberately not in scope.
- ‼️ **C3's customer-card subtitle.** It ships **"Added {date}"** by the owner's 2026-09-04 ruling —
  `BusinessCustomer` carries no booking count and the Customers page shows none. **Do not "complete" it
  against sheet M5.**
- ‼️ **`sameAudience` and `ALWAYS_FINDS`.** Deleted from the client twins **on purpose** (`AUDIT-P4` §2.2,
  §2.4). **Do not reintroduce either**, and never hardcode a role key the server owns.
- ‼️ **`role.alwaysHasFullAccess !== true` stays as it is.** `!== false` was considered and **rejected**
  (`AUDIT-P4` §6.4): "unknown" is the same value for an ordinary role, so it would empty the roles picker for
  everyone. The real constraint is deploy order — **API first, apps after** — already in P5's checklist.
- ‼️ **The web and mobile apps, for item §3.** The interpreted DTO means no app change is required. If you
  find yourself editing an app for #10, stop and re-read §3.2 Part 3.
- **Anything else you happen to find.** Write it down, report it, move on.

---

## 8. THE ZERO-TOLERANCE RULES THAT WILL BITE THIS PHASE

- ‼️ **§0.7 — ANY schema change needs the owner's yes IN THIS CONVERSATION.** §3 was approved on 2026-09-04
  **and adds no field**. If you find yourself wanting a new SQL column or Cosmos field for anything here,
  **stop and present the table.** A prompt saying "add X" is not approval — including this file.
- ‼️ **§0.6 — no cross-partition Cosmos query, ever.** §4.2 is exactly where that temptation lives. Re-read
  `cosmosindexsetup\Program.cs` before writing the predicate.
- ‼️ **§0.8 — integration tests are MANDATORY** for money (§2) and the data-safety path (§1). "Slow" and
  "purely new functionality" are not acceptable reasons there.
- ‼️ **A test that asserts a STATUS CODE asserts the whole pipeline.** P4's audience-DTO test passed with
  both validation attributes deleted — the 400 was the tenancy middleware's. Drive the layer you are pinning.
- ‼️ **Sabotage every guard you write**, with **valid** code that is *wrong*. An invalid-C# sabotage fails to
  compile and the test "passes" against a stale DLL.
- ‼️ **A count is not an identity.** `toBe(4)` survives deleting the call site you care about.
- **§0.10 / §0.20 — no hardcoded user-facing text, and no technical word a provider can read**, in every
  language file. §6.2 adds copy: five files, and the sheet.
- **§14 — every `IMemoryCache` write sets `Size = 1`.** A size-less `Set` is a runtime 500.
- **§0.14 — comments only when earned, one line, never narrating WHAT.** ‼️ P4 found **three** comments in
  this exact area asserting invariants the code did not implement, and §3 **deletes the file that carried the
  worst of them.** §4.2 has one more to fix. A comment is a claim no build checks.
- **§0.16 — leave the tree clean.** Probes and patch scripts live in the session scratchpad and are deleted.
  Look at `git status --porcelain` and say what you removed.
- **§0.17 / §0.18 — a test may only read its own repo; a library class is tested from the suite of the HOST
  that invokes it.** §4.5 is a §0.17 fix; §4.6's optional guard is §0.15's one legitimate exception.

---

## 9. DEFINITION OF DONE

1. **§1 shipped alone and first**, with integration tests on the real emulator, each sabotage-proven.
2. **§2 shipped as ONE formatter** — the four exponent definitions reduced to one, all four provider surfaces
   fixed, Indian grouping correct, **every existing `ToMajorString` caller proven to still render
   correctly**, and a test asserting **the card string equals the page string**.
3. **§3 built exactly as specified**, with the converter file **deleted** and **both** proof tests green:
   the lossless round trip, and the two read paths agreeing. **No new Cosmos field. No migration.**
4. **§4 (all eight), §5 (both numbers recorded in `MEASUREMENTS-P4.5-<date>.md`), §6 (all four + T7)** done.
5. **Real green runs, taken AFTER the last fix**: `Clinqet.API.UnitTests` in full · the integration tests
   against real SQL + the Cosmos emulator · **both** provider app suites in full · ESLint 0 ·
   `tsc --noEmit` clean. **Paste the numbers**, and check whether another session moved the tree since your
   run — a green run you cannot prove postdates every change is not evidence.
6. **A multi-dimensional audit of THIS phase's diff** — independent agents per dimension, then a skeptic.
   Every finding fixed, refuted with evidence, or named as an accepted residual. Written to
   `findings/AUDIT-P4.5-<date>.md`. ‼️ **Do not report complete while an audit agent is still running.**
7. **`CARRIED-TO-P5.md` rewritten** so it holds **only** what an audit phase should carry: the sheet
   walk-through duty, the deploy-checklist inputs, and the genuinely-accepted residuals. ‼️ **If something is
   still open, say so plainly — do not move a fix into P5.**
8. **SKILL ×4 updated** (`.claude/skills/`, `.github/skills/`, `.agents/skills/`, `.cursor/rules/*.mdc`,
   byte-identical — ‼️ **§5's audience section and §16 both describe the converter that §3 deletes, so both
   must change**) · a memory entry + a one-line `MEMORY.md` pointer · `PLAN.md` §14's P4.5 row marked done
   and §0's register current if §6.2 changed a sheet · the tree clean with what you removed stated ·
   **nothing committed, nothing pushed.**

9. ‼️ **HAND THE OWNER THE PHASE 5 PROMPT AS A COPY-PASTE BLOCK IN THE CHAT.** `PHASE-5-PROMPT.md` already
   exists and is audit-only — **re-read it, update it for anything this phase changed** (the audits and
   measurements list, the residuals, the deploy checklist), and then **paste a SHORT opening prompt in one
   fenced block** that the owner can copy straight into the next session: the file path as the authority, the
   three rules of §0, the four duties, what P5 must not do, and the closing duties.
   ‼️ **SHORT. Not the whole file.** A 700-line paste is unusable in a terminal — the owner said so. The file
   on disk carries the detail; the pasted block points at it and carries what must not be missed.
   ‼️ **A file path alone is not delivery** (`feedback-deliver-prompt-in-chat-not-only-a-file`): deliver
   **both** — the updated file AND the short block.

> ‼️ **The point of this phase is that P5 has nothing left to build.** If you finish and P5 still has a fix
> in it, this phase failed.

---

## 10. ‼️ CODING STANDARDS — the shape every line of this phase must have

**`C:\Nik\CLAUDE.md` is the full contract and it wins over this summary.** This is the subset that will
actually bite the items above.

### 10.1 The repositories, and the fact that they are separate

`clinqetapi` · `clinqetidentity` · `clinqetmcp` · `clinqetfuncations` · `clinqetinfrastructure` ·
`clinqetcore` · `clinqetshared` · `clinqetwebpartnerapp` · `clinqetwebuserapp` · `clinqetwebadmin` ·
`clinqetmobilepartnerapp` · `clinqetmobileuserapp` · `azureautomation` · `cosmosindexsetup`.

‼️ **Every one is its own git repository.** They share a folder on this machine and **nothing else** — CI
checks out ONE, so `..` is empty there. ‼️ **A test may only read paths inside its own repository** (§0.17),
and `Clinqet.API` / `Clinqet.Communications` / `Clinqet.Mcp` / `Clinqet.Identity.API` are **peer hosts that
never reference each other** (§0.15). `clinqetcore` / `clinqetshared` / `clinqetinfrastructure` are
**libraries** every host compiles in — scanning those from a host is correct.

‼️ **A library class is tested from the suite of the HOST whose runtime path invokes it** (§0.18). Grep the
call sites before choosing a test project. Voice/telephony/Functions-consumed ⇒
`Clinqet.Communications.UnitTests`. Relay/MCP ⇒ `Clinqet.Mcp.UnitTests`. API-consumed ⇒
`Clinqet.API.UnitTests`.

### 10.2 The files this phase touches — the complete list

| Item | Files |
|---|---|
| **§1** duplicate upload | `clinqetinfrastructure\Services\Knowledge\KnowledgeManagementService.cs` · the hash-twin path · `clinqetinfrastructure\Data\COSMOS\KnowledgeDocumentRepository.cs` · `clinqetinfrastructure\Resources\Localization\{en,es,fr,gu,hi}.json` · `clinqetapi\Clinqet.API.IntegrationTests\Tests\` |
| **§2** money | `clinqetshared\` (`CurrencyMinorUnit`) · `clinqetinfrastructure\Services\BusinessSearch\Tools\SearchRefundRequestsTool.cs` · `clinqetwebpartnerapp\src\components\Payments\RefundRequests.jsx` · the mobile refund screen in `clinqetmobilepartnerapp\src\Screen\` · **and every existing `ToMajorString` caller** (QuestPDF invoices, email templates, pages) |
| **§3** audience | `clinqetcore\Interfaces\Knowledge\KnowledgeSearchVisibility.cs` · `clinqetcore\Entities\COSMOS\KnowledgeDocument.cs` · ‼️ **DELETE** `clinqetcore\Entities\COSMOS\KnowledgeSearchAudienceConverter.cs` · `clinqetinfrastructure\Data\COSMOS\KnowledgeDocumentRepository.cs` · `clinqetinfrastructure\Services\BusinessSearch\BusinessSearchDocumentService.cs` · `clinqetinfrastructure\Services\Knowledge\KnowledgeManagementService.cs` · `clinqetapi\Clinqet.API\Controllers\Knowledge\KnowledgeController.cs` · `clinqetapi\Clinqet.API.IntegrationTests\Tests\KnowledgeSearchAudienceCosmosIntegrationTests.cs` |
| **§4** small batch | `KnowledgeDocumentRepository.cs` · `clinqetinfrastructure\Services\BusinessSearch\Tools\ListCustomersTool.cs` + the other Group B tools · `clinqetwebpartnerapp\src\...\businessRoleCatalogParity.test.js` · `clinqetapi\Clinqet.API\appsettings.json` · `clinqetcore\Interfaces\Services\ICurrencyService.cs` |
| **§6** residuals | `clinqetmobilepartnerapp\src\Locales\{en,es,fr,gu,hi}.json` · `clinqetmobilepartnerapp\src\Screen\ProfileFlow\Knowledge\{index.tsx,style.ts}` · `C:\Nik\Data\mockups\business-search-document-audience\index.html` (sheet M6 §6) · `C:\Nik\Data\provider-ai-search\AUTHORIZATION-DESIGN.md` (C5 + T7) |
| **Closing** | `findings\AUDIT-P4.5-<date>.md` · `findings\MEASUREMENTS-P4.5-<date>.md` · `CARRIED-TO-P5.md` · `PLAN.md` §14 · SKILL ×4 · the memory entry + `MEMORY.md` |

### 10.3 Backend — .NET 10

- **Read `Program.cs` of the affected host before adding DI.** Follow the existing extension-method pattern.
  **Singleton** for expensive thread-safe things, **Scoped** per-request, **Transient** for lightweight
  stateless. ‼️ **Never inject Scoped into Singleton.** New HTTP always via `IHttpClientFactory`, never
  `new HttpClient()`.
- ‼️ **No cross-partition Cosmos query, ever** (§0.6). Every query, point-read, patch and batch passes a
  partition key. **Prefer a point read** `ReadItemAsync(id, pk)` when you know the id. **Atomic PATCH for
  counters** — never read-modify-write. **ETag/CAS** where there are concurrent writers; a **412** fails
  gracefully with a clear error, never a silent overwrite.
- ‼️ **Any new repository method ⇒ review `cosmosindexsetup\Program.cs`** and decide whether an index
  changes, in the same change (§3.11).
- **Enums serialize as STRINGS**, always — type-level `[JsonConverter(typeof(JsonStringEnumConverter))]` on
  every enum in `clinqetshared\Enums\` (the MVC-level converter is not enough for Service Bus, Cosmos or
  manual `JsonSerializer`).
- **Structured logging only** — `_logger.LogInformation("... {Id}", id)`. **Never** interpolation.
  `Information` for key events, `Warning` for recoverable, `Error` for needs-attention.
- **Global exception middleware exists** — do not add try/catch in a controller unless you handle it
  differently. ‼️ **Never swallow an exception to make a symptom stop** (§0.3). Use the existing
  `NotFoundException` / `ForbiddenException` family; do not invent exception types.
- **Service Bus handlers are IDEMPOTENT** — every redelivery produces the same result. Deterministic ids
  mean a redelivered write **conflicts**, it does not duplicate.
- **Every `IMemoryCache` write sets `Size = 1`** — `MemoryCacheEntryOptions { Size = 1 }`, `.SetSize(1)`, or
  `entry.Size = 1`. ‼️ The `Set(key, value, TimeSpan)` overloads **cannot** carry a Size and are
  **FORBIDDEN**; a size-less write is a runtime 500. `MemoryCacheSizeConventionTests` will fail the build.
- ‼️ **NEVER edit an applied EF migration**, and **never migrate at startup** — applied by hand per region.
- **Notifications have ONE entry point**: `ICommunicationDispatcher.DispatchAsync`. No controller writes to
  a notification queue. A new `NotificationType` must also be added to
  `SignalRSettings:EnabledNotificationTypes` in the Main API `appsettings.json` — ‼️ **and §1 deliberately
  adds none.**

### 10.4 Config

- A value that could vary by environment, tenant or future tuning is a **setting**, not a constant. A fixed
  value set is an **enum**. ‼️ **A magic number inside a service is a bug** — flag and refactor it.
- ‼️ **An options-class default MUST equal the `appsettings.json` default.** §4.6 exists because of exactly
  this rule.
- Settings live only in the host that reads them. ‼️ **Remove the key, the options property and the DI
  binding together** when something stops being read. A new `local.settings.json` key needs the matching ARM
  + `deploy.ps1` entry **in the same change** (§25) — a plain `appsettings.json` key does not.
- **Never commit a secret.** Key Vault reference in `appsettings.json`, real value as an env var in ARM +
  `deploy.ps1`.

### 10.5 Localization — every user-facing string, every language

- Backend: a key in `clinqetinfrastructure\Resources\Localization\{en,es,fr,gu,hi}.json`, resolved through
  `ILocalizationService`, `string.Format`-resolved **before** dispatch — never a raw key with placeholders.
- Web: `react-intl` / ICU — ‼️ **apostrophes are DOUBLED** in ICU, and plurals are
  `{count, plural, one {#…} other {#…}}`.
- Mobile: i18next — **single** apostrophes, `KEY_one` / `KEY_other`, `{{count}}`. ‼️ **No English
  `defaultValue` fallback** — `sourceLocalizationIntegrity` fails on it.
- ‼️ **A composed sentence is ONE parameterized key**, never fragments glued together.
- ‼️ **No technical word a provider can read** (§0.20): passage, chunk, index, embedding, retrieval, token,
  payload, endpoint, stream, cache, blob, SAS, schema, frame, flag, marker, partition. Say *page*, *text*,
  *document*, *source*, *answer*, *saved*, *offline*. **Admin-internal alert wording is the only exception.**

### 10.6 UI — web and mobile

- ‼️ **Mobile ships in the SAME session as web**, unprompted. Parity means matching **rendering rules**, not
  a same-named component.
- ‼️ **React 19 SILENTLY drops `defaultProps` on function components.** Defaults go in the **destructuring
  parameter list**. A convention guard now fails the build on any `defaultProps` assignment — do not
  reintroduce one. Assert a default **at the call site**, through the real `IntlProvider` with the real
  `en-US.json`.
- Match the existing design system exactly — house tokens, not invented colours. ‼️ **Brand green
  `#97EF29` fills every pressed/selected control; navy is for headings.**
- Mobile-first responsive (phone, tablet, laptop). `sm` is **480px** in the partner app, not Tailwind's
  default. Wide content scrolls inside its own container; the page body never scrolls sideways.
- Accessibility is part of done: real roles (`radiogroup`/`radio`, `checkbox` + `aria-checked`), a live
  region for any outcome a user cannot see happen, and an `aria-label` that says the **state then the
  action** — a label naming only the action **overrides the element's own text**.
- **ESLint 0 errors** and `tsc --noEmit` clean, or the item is not done.

### 10.7 Comments — §0.14, zero-tolerance

**DEFAULT IS NO COMMENT.** One short line, only when it carries what the code cannot: a non-obvious **WHY**,
an invariant, a gotcha, a spec reference. ‼️ **Never narrate WHAT the code does.** No method-summary
paragraphs, no step-by-step narration, no commented-out code, no `// TODO` without an issue link, no
change-log notes. If a comment needs several lines to say what happens, **the code is wrong — refactor it.**

‼️ **A comment that asserts an invariant is a CLAIM NO BUILD CHECKS.** P4 found **three** in this exact area
that were false, and §3 **deletes the file carrying the worst of them**. Re-read the code a comment describes
before trusting it, and correct it in the same change.

### 10.8 Tests

- **Unit AND integration for every new endpoint, repository method, service path, function handler and
  significant frontend flow.** 100% pass. A flaky test is a broken test.
- ‼️ **Integration tests are MANDATORY** for money, SQL/Cosmos schema, unique indexes, atomic counters,
  webhooks and Service Bus processors — EF InMemory cannot enforce a unique index, a relational constraint,
  EF→SQL translation, or Cosmos atomic-PATCH semantics. "Slow" is not a reason.
- Patterns: xUnit + Moq + AutoFixture for unit; `ClinqetApiFactory` + Testcontainers + `TestTokenHelper` for
  integration. ‼️ **A fixture's `DisposeAsync` must OVERRIDE `ValueTask`** — `new async Task DisposeAsync()`
  compiles and is **never called**.
- ‼️ **Assert fire-and-forget state with a bounded poll, never a fixed sleep** (`Eventually.FindAsync`, own
  DI scope per probe). ‼️ **A capture across a parallel fan-out must be a CONCURRENT collection** — a plain
  `List` loses an item, only in CI.
- ‼️ **Sabotage every guard, with VALID code that is WRONG.** Invalid C# fails to compile and the test
  "passes" against a stale DLL. ‼️ **If the sabotage PASSES, the test is vacuous — delete or rewrite it.**
- ‼️ **A count is not an identity.** ‼️ **A status-code assertion asserts the whole pipeline** — drive the
  layer you are pinning.
- ‼️ **A guard that reads a peer repo must SKIP LOUDLY**, and `describe.skip` **still executes its callback**
  — every peer read belongs inside an `it()`. **Green must mean "I checked", never "I could not look."**
- ‼️ **`--no-build` can pass on a STALE DLL.** ‼️ **This tree is MIXED CRLF/LF per file** — a multi-line
  `perl -0pi -e` pattern matches nothing on a CRLF file and exits 0, so a sabotage silently does not happen.
  Sabotage by line number, and append `or die` to any substitution you rely on.

### 10.9 Working in a shared tree

- ‼️ **Never build or test while another session is working** — concurrent builds clobber the same
  `obj/bin`, and the symptom is a phantom compile error in a file you never touched.
- ‼️ **Never `git checkout` / `restore` / `reset` / `stash` / `clean`** — it wipes **every** session's
  uncommitted work in that file, not just yours (§0.19). Snapshot to the scratchpad and copy back.
- ‼️ **The owner commits, pushes and deploys. You never do** (§21). Prepare the change; leave the tree clean.
- ‼️ **Leave the tree clean** (§0.16): every probe, patch script, sample payload and log deleted; nothing
  scratch written inside a repo; look at `git status --porcelain` and **say what you removed**.
