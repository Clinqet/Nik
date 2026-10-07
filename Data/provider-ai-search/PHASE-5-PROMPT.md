# PHASE 5 PROMPT — Business Search ("Ask Clinket"), the whole-programme audit

> ‼️ **THIS PHASE STARTS NO NEW FEATURE — AND IT FIXES EVERY DEFECT IT FINDS.** Both halves are binding, and
> the second one is not a footnote.
>
> **Owner ruling, 2026-09-04:** *"nothing fucking move to phase 5 and phase 5 should be only end to end
> audit"* — no BACKLOG is carried into P5. **Owner ruling, 2026-09-05:** *"audit everything and fix all the
> findings as well, not just report"* — so a finding this phase surfaces is **FIXED here**, to the coding
> standards in §7, with a guard where it could recur.
>
> ‼️ **THE DISTINCTION, because getting it wrong in either direction fails the phase:**
>
> | | |
> |---|---|
> | **FORBIDDEN** | Building a feature, a redesign, or a queued backlog item. If a fix that belongs to an earlier phase is still outstanding, **say so plainly and stop** — do not absorb it silently |
> | **REQUIRED** | Fixing every defect THIS audit finds — in any phase's code, P1 through P4.7, and in code no phase ever touched. ‼️ **"Noted", "recommended", "should be addressed" and "carried forward" are FAILURES.** Every finding ends as **FIXED**, **REFUTED WITH EVIDENCE**, or **an ACCEPTED RESIDUAL the owner has agreed to** |
>
> ‼️ **A finding you report but do not fix, without the owner having declined it, is a failed item.** If a fix
> is genuinely too large for this phase, that is a decision only the owner makes — **ASK, with the cost and a
> recommendation** (§0.3). Do not decide it yourself by writing it down and moving on.
>
> **Read first, in this order, completely:**
> 1. `C:\Nik\CLAUDE.md` §0 — the zero-tolerance rules. Every one applies.
> 2. `C:\Nik\Data\provider-ai-search\PLAN.md` — the authority. ‼️ **§0 is the mockup register: NINE sheets,
>    M1–M9 — M8 (multi-currency money) and M9 (source grouping) were approved on 2026-09-05 and NO audit has
>    ever walked them. This phase walks every state of all NINE, on both apps.** §1 is the owner-requirement
>    table you must check line by line.
> 3. `CARRIED-TO-P5.md` — short on purpose. It is what an audit legitimately carries, plus the accepted
>    residuals so you do not re-find them as bugs.
> 4. `findings/AUDIT-P1-2026-09-02.md` · `AUDIT-P1.5-2026-09-03.md` · `AUDIT-P2-2026-09-03.md` ·
>    `AUDIT-P3-2026-09-03.md` · `AUDIT-P4-2026-09-04.md` · `AUDIT-P4.5-2026-09-04.md` ·
>    `AUDIT-P4.6-2026-09-05.md` · `AUDIT-P4.7-2026-09-05.md` — **EIGHT** audits. Read the residuals sections
>    of all eight before planning anything. ‼️ **P4.6 §7 (what is NOT done) and §8 (the plain statement) are
>    the money close-out, and P4.7 is the catalogue one. Both landed AFTER this prompt was first written, so
>    anything else in this file that counts phases or sheets is suspect until you have checked it yourself.**
> 5. `AUTHORIZATION-DESIGN.md` — the T1–T11 threat list and the C1–C7 tool contracts.
> 6. `findings/MEASUREMENTS-P1.5-2026-09-02.md` · `MEASUREMENTS-P3-2026-09-03.md` ·
>    `MEASUREMENTS-P4-2026-09-04.md` · `MEASUREMENTS-P4.5-2026-09-04.md` — every number the programme has.
> 7. `.claude/skills/clinqet-business-search/SKILL.md` — the living contract.
>
> ‼️ **Never build or test while another session is working in `C:\Nik`.** ‼️ **Never run `git checkout` /
> `restore` / `reset` / `stash` / `clean`** in these trees (§0.19). ‼️ **The owner commits and deploys, never
> you** (§21).

---

## 0. ‼️‼️ THE THREE RULES THAT OVERRIDE EVERYTHING ELSE IN THIS FILE

**Owner, 2026-09-04, verbatim:** *"all of them need to be done in the best practise way and not the patch to
get the current thing working that is must and super super important … and then test with the live data and
not to assume so if unsure ask me and simple way explain and ask instead of assuming wrong"*.

### 0.1 ‼️ WHEN THE AUDIT FINDS A DEFECT, FIX THE ROOT — NEVER A PATCH

This phase builds nothing from a backlog, but an audit **does** fix what it finds, and those fixes are held
to the same standard. **Before writing one, answer four things in the change itself, one line each:**

1. **What CLASS is this?** ‼️ **RULE ZERO: fix the CLASS, never the instance.** Ask *"what else is in this
   class?"* and fix that too, or say why it is not.
2. **Where is the single source of truth, and is my fix creating a second one?**
3. **Could it recur?** If yes, the fix is incomplete without a **guard that fails the build** — and the
   guard must be **sabotage-proven red** or you do not know it works.
4. **What did my change make dead?** Delete it in the same change (§22.2, §0.16).

**These are patches and each one fails the item:** catching an exception so the symptom stops · widening a
test to match wrong behaviour · fixing one of two twins, one of four surfaces, or web without mobile ·
adding a field to carry a value instead of not destroying it · a comment left in place of the fix.

‼️ **If a fix is bigger than an audit should carry, STOP and report it** — do not shrink it into a patch to
keep the phase tidy. A large finding is information the owner needs.

### 0.2 ‼️ THE WALK-THROUGH USES LIVE DATA. NEVER ASSUME WHAT THE DATA LOOKS LIKE.

§1's walk-through is worthless against a fixture. A state only exists if **real data can produce it**.

**Credentials — read AT RUNTIME, never copy a value into a file, never print one:**

| What | Where |
|---|---|
| Cosmos connection string · Search endpoint + key · Storage connection string — **all four in one file** | `C:\Nik\cosmosindexsetup\appsettings.ca.json` (Canada) · `appsettings.in.json` (India) |
| Embeddings, to replay the REAL hybrid query | `clinqetfuncations\Clinqet.Communications\appsettings.json` → `AzureAIFoundry.ApiUrl` / `.ApiKey` / `.EmbeddingModel` |
| The live model | `clinqetapi\Clinqet.API\appsettings.json` → `AIService.Endpoint` / `.ApiKey`, deployment **`gpt-5.6-luna`** at `reasoning_effort: "none"` |

**Names that are easy to get wrong:** Cosmos **`KnowledgeBase-dev`**, pk **`/businessId`** · blob container
**`provider-knowledge`** · Search alias **`clinket-knowledge-dev`** (physical `…-v1`) · ‼️ **api-version
`2026-04-01` for the ALIAS** (it 404s on `2024-07-01`) · index fields are **`chunkKind`/`sectionTitle`** —
`kind`/`sectionPath` **do not exist**, and a bad `select` returns no `value`, which looks exactly like an
outage. **Harness:** `C:\Nik\knowledge-table-hunt` — plain run = 69 cases; `-- --di <file>` replays one
**real** document through the true parser and prints the cards, no deploy.

**What the walk-through owes:**

- ‼️ **For every state, say whether real data can reach it.** A state no real row can produce is a finding
  about the sheet. A state real data reaches that no sheet draws is a finding about the design.
- ‼️ **Use a real business with real documents, real bookings and a real team** — not a seeded fixture — for
  at least one full pass on each app.
- ‼️ **A BM25-only curl is NOT the product's path** and understates it; measure the **composed hybrid query**
  (`search` + `vectorQueries` + `preFilter` + businessId). ‼️ **A rising hit COUNT is not a win — open the
  documents.** ‼️ **A card count that does not move is NOT proof a re-parse failed.** ‼️ **Chars ≈ 4× tokens.**
- ‼️ **The deployed MCP host cannot be probed from a dev machine (`403 Ip Forbidden`).** Config-in-HEAD plus
  a replay of the exact logic against the live index is the available proof. **Do not claim to have read the
  running config.**
- ‼️ **Never `--recreate-aliases`** (it DELETES a live index), and never a bare `cosmosindexsetup` run — it
  continues into container init **and sample-data seeding** on shared dev data. Use
  `dotnet run --launch-profile "Dev (Canada)" -- --search-only`, and **always** `--launch-profile`.
- **Probes live in the session scratchpad, NEVER inside a repo** (§0.16).

### 0.3 ‼️ IF YOU ARE UNSURE, ASK. EXPLAIN IT SIMPLY AND ASK — DO NOT ASSUME WRONG.

- **Ask when the answer changes what you do** — a finding whose fix has a real cost, a live-data result that
  contradicts this prompt, a sheet that disagrees with shipped behaviour where either could be right. **Do
  not ask what you can read** (§0.13).
- ‼️ **Explain in PLAIN WORDS first, then ask.** No jargon, no section numbers as the explanation. Say what
  happens, who it affects, the options, what each costs, and what you recommend. The owner said *"I dont
  understand at all what you trying to say"* once in this programme — that was the explanation's failure.
- ‼️ **Give a recommendation with every question**, so a one-word answer is enough.
- ‼️ **If this prompt and the code disagree, THE CODE WINS and the prompt is wrong** — say so.
- **Name every unresolved assumption in the audit.** An assumption nobody wrote down is indistinguishable
  from a fact.

---

## 0b. WHAT EXISTS — the full inventory, so nothing is rebuilt

### Backend (`Clinqet.API`, `clinqetinfrastructure`, `clinqetshared`, `clinqetcore`)

- `BusinessSearchController` — `POST api/v{v}/business/search` (SSE), the session endpoints, the document
  page + view-url endpoints. `PATCH knowledge/documents/{docId}/audience`.
- `BusinessSearchAgent` — luna @ `reasoning_effort: none`, the system prompt, `ScriptRules` (in the **user**
  turn since P4), `AppendWorkRules`, `AppendPeopleAsync`, the SSE frames.
- **Group A, five tools** — knowledge + typed FAQs, services, offers, profile, availability.
- **Group B, twelve tools** — `list_bookings`, `list_quotes`, `list_invoices`, `invoice_totals`,
  `list_leads`, `list_customers`, `inbox_summary`, `get_insights`, `list_team_members`, `list_reviews`,
  `search_call_followups`, `search_refund_requests`. ‼️ `get_voice_usage` is **deliberately excluded**
  (ai-billing family, owner 2026-09-02) — its absence is a decision, not a gap.
- `CitationRegistry`, `BusinessSearchWorkToolBase`, `IBusinessSearchDateRangeResolver`,
  `IBusinessSearchRosterService`, `IBusinessSearchQuestionRedactor`.
- `searchAudience` on `KnowledgeDocument` — a plain `string?`, read through **one** decider,
  `KnowledgeSearchAudienceRule.Decide`. ‼️ P4.5 deleted `KnowledgeSearchAudienceConverter`: two parsers with
  different opinions about an unknown value is the defect it removed, so **do not reintroduce a second reader**.
- ‼️ **The dormant `/ai/chat` assistant was DELETED in P1.** Its absence is correct.

### ‼️ What P4.5 added — new surface, and no earlier phase's audit has seen it

- **One money definition for the whole platform.** `Clinqet.Shared.Helpers.CurrencyMinorUnit` owns the
  exponents, the **symbols** and the rendering; `CurrencyMinorUnit.Format(minor, currency, culture)` is the
  only way an amount becomes a string. Two import-free client twins mirror it —
  `clinqetwebpartnerapp/src/utils/currencyMinorUnit.js` and `clinqetmobilepartnerapp/src/Util/currencyMinorUnit.ts`
  — and a backend convention test reads both files. ‼️ **The symbol follows the CURRENCY, never the reader**
  (CAD is `C$` to everyone), and `"C"`-format / `style: "currency"` are forbidden because both take the
  symbol from the culture. `BillingMoney` on `NotificationPayload.MoneyFields` carries minor units to the
  renderer so one notification can be rendered per recipient.
- **`LanguageCulture.ProductLocales`** maps the five product languages to en-US · es-US · fr-CA · gu-IN ·
  hi-IN, and it feeds **dates as well as money**. Long dates are unchanged; **times deliberately changed for
  Spanish and French** (measured, `LanguageCultureTests`). That is a decision, not a regression.
- **The duplicate-upload merge** in `KnowledgeIngestProcessorFunction.RefreshHashTwinAsync` — a second upload
  of the same bytes no longer destroys the first row's settings. ‼️ **A MERGE NEVER WIDENS**: an omitted
  switch reads `true`, so only a tightening is a statement. `IKnowledgeIngestQueue` was extracted so the
  processor can re-enqueue a metadata-only pass with a deterministic message id.
- ‼️ **P4.5 changed money strings on five surfaces at once.** A P5 walk-through that finds the Billing page
  saying `C$39.00` where a screenshot says `CA$39` is seeing the fix, not a defect.

### ‼️ What P4.6 changed — MONEY, EVERYWHERE ELSE (2026-09-05; `findings/AUDIT-P4.6-2026-09-05.md`)

P4.5's money rule was still false on ~250 call sites. P4.6 closed them and found they were one defect.

- ‼️ **THE SERVER USED TO SHIP A GLYPH AND THROW THE CODE AWAY.** `DashboardStatisticsDto` /
  `EarningsGraphResponseDto` now carry `Currency` (an ISO code) and **`CurrencySymbol` is DELETED**.
  `GetCurrencyCodeAsync` is the ONE resolution and `GetCurrencySymbolAsync` derives from it.
- ‼️ **BOTH SECOND RENDERERS ARE DELETED** — `clinqetwebpartnerapp/src/utils/currency.jsx` and
  `clinqetmobilepartnerapp/src/Util/currency.tsx`. If you find either back in the tree, that is a finding.
- ‼️ **MONEY IN TWO CURRENCIES IS NEVER ADDED.** Live `LXDP8G` read **233510.1** for one day — ₹208,511.10
  plus C$24,999.00. Four invoice aggregates now `GROUP BY c.currency`; `CurrencyTotals` is the one splitter.
  **Measured RU cost: +0.15 / +0.10 / +0.02.** ‼️ **There is NO `MEASUREMENTS-P4.6` file — those numbers live
  in `AUDIT-P4.6` §2. Do not conclude they were never taken.**
- ‼️ **A ROW'S CURRENCY IS IMMUTABLE AFTER CREATION.** The update path used to re-resolve it from the
  business, relabelling a 1000 CAD booking as 1000 INR. Now `ResolveStoredCurrency`. **Two green tests had
  contradicted each other for months** — `UpdateBusinessAddresses_..._ReStampsServicesButNotBookings` said a
  country move leaves bookings alone, while three update tests said editing one relabels it.
  ‼️ **When two green tests disagree, one is a bug report nobody filed.**
- ‼️ **`CurrencyMinorUnit` HAS NO SYMBOL-TAKING OVERLOAD AND MUST NEVER GET ONE BACK.** A currency plus a
  separately-resolved symbol is the defect: the booking receipt printed `$` over a C$ figure. The parameter
  is gone from `IPdfGenerationService`, `QuestPdfService`, `InvoiceLineDiscountFormatter`,
  `IDocumentDeliveryService` and every caller.
- ‼️ **`Enum.TryParse<CurrencyCode>` alone is a BUG** — the enum is int-backed, so `"7"` yields CNY and
  `"25"` an undefined member. Use `CurrencyMinorUnit.Parse`, which adds `Enum.IsDefined`.
- **Four guards** enforce this: `MoneyNeverFormattedFromTheReadersCultureTests` (API),
  `MoneyFormatConventionTests` (Functions), and a `moneyFormattingConvention` twin in each app.

### ‼️ What P4.7 changed — the catalogue could not find the provider's own services (2026-09-05)

Ran in a PARALLEL session. Read `findings/AUDIT-P4.7-2026-09-05.md` and
`CATALOGUE-RETRIEVAL-BRAINSTORM-2026-09-05.md`. Sheet **M9** is its UI. ‼️ **No audit has seen this work at
all**, and it touched the same Business Search tool files P4.6 did — so the P1→P4.7 agreement question in §2
applies to it most sharply.

### Provider web (`clinqetwebpartnerapp`) and provider mobile (`clinqetmobilepartnerapp`)

- The ask surface, the streaming client, the markdown renderer, citation + image markers, the source panel
  and page viewer, the voice mic, analytics + client-side redaction, the suggestion and history lanes.
- `SourceCard` on both, including the refund card's reason line.
- The **"Team search"** audience box in both document editors, plus the document-row mark.
- **Import-free twins:** `askRules.js` ↔ `askRules.ts`, `searchAudience.js` ↔ `searchAudience.ts`, compared
  by parity suites that must **SKIP loudly**, never pass on zero files (§0.17).

### The seven approved sheets — `PLAN` §0

| # | Sheet | What it governs |
|---|---|---|
| M1 | `business-search-page` | The page and its core states, header entry, the mobile screen |
| M2 | `business-search-sources` | A cited source card per file type, the two panels, **no download anywhere** |
| M3 | `business-search-voice` | The mic's eleven states; **the mic never sends** |
| M4 | `business-search-states` | The eleven states the first three left out; where every state's words come from |
| M5 | `business-search-team-answers` | Every state a WORK answer adds; the eleven work cards; money verbatim |
| M6 | `business-search-document-audience` | Every state of the audience box, both platforms, plus the row mark |
| M7 | `business-search-ask-layout` | The frame: one docked ask box, one Stop, two lanes, full-width card |
| **M8** | `provider-money-multi-currency` | ‼️ **NEVER AUDITED.** Money that is not all in one currency, on the four surfaces that ADD amounts up: today's earnings tile · invoice total cards · invoice list group headings · the earnings chart. Every state: one currency (must be byte-identical to before) · two · three or more · nothing yet · loading · could-not-load · role-not-permitted |
| **M9** | `business-search-source-grouping` | ‼️ **NEVER AUDITED.** One card per DOCUMENT with the parts the answer used inside it; cited parts marked and never rolled up; "Show the whole document" drawn ONLY when saved text exists; a part with no readable words; truncated; offline; a reopened conversation |

**Where two sheets disagree, the LATER one wins** and §0's row records it. M2 supersedes M1 on two points;
M5 supersedes M4 §01b's chip row; M6 supersedes M1 §4's role chips; M7 supersedes M1 §1 and M4 §01b's
presentation.

---

## 1. ‼️ DUTY ONE — the sheet walk-through, every state of M1–M9, on BOTH apps

This is the biggest single duty of the phase and the one most likely to be skimped. `PLAN` §0 exists so this
is possible at all.

- **Enumerate the states from the SHEETS, not from the code.** Read each sheet's frames, build the list, then
  go and find each state in the app. **A state you cannot reach is a finding. A state the app has that no
  sheet draws is also a finding.**
- **Web and phone are separate walk-throughs.** Parity means matching **rendering rules**, not a same-named
  component (`feedback-mobile-must-mirror-web`).
- **Check each state's words against §0's "where every state's words come from" tables** — the server's
  already-translated sentence, or the screen's own copy key. A screen that re-invents a sentence the server
  already sends will drift out of translation.
- ‼️ **Check every state's copy for a technical word a provider can read** (§0.20 and the owner's standing
  rule): passage, chunk, index, embedding, retrieval, token, payload, endpoint, stream, cache, blob, SAS,
  schema, frame, flag, marker, partition. In **all four wired languages** (en, fr, gu, hi — es is authored
  but hidden), not only English.
- ‼️ **Record it as a TABLE**: sheet · state · web · phone · verdict. A paragraph saying "walked them all" is
  not evidence, and a walk-through with no table did not happen.

---

## 2. ‼️ DUTY TWO — the cross-phase audit

Run **independent agents per dimension**, then a **skeptic pass** that tries to REFUTE the
highest-consequence claims. Dimensions, at least:

correctness & contracts · **authorization and tenant isolation across the whole surface** · localization ×15
· **the sheet walk-through** (§1) · cost, performance, leaks and thread safety · tests (placement §0.18,
fail-first evidence, **vacuity**) · config hygiene (§0.12/§4) · deployment and infrastructure · data safety,
idempotency and concurrency · ‼️ **did we miss anything the owner asked for, across all EIGHT phases** · ‼️
**defects in code no phase touched**.

**Two dimensions only P5 can run — do not omit them:**

- ‼️ **Do the phases AGREE with each other?** Each of P1–P4.7 audited its own diff. Nobody has yet asked
  whether a rule fixed in P2 survived P4 touching the same file, whether two phases spell one copy key two
  ways, whether a citation `recordId` shape P3 fixed was ignored by a later tool, or whether two tools format
  the same fact two ways in one answer. **This is the whole reason P5 exists.**
- ‼️ **`PLAN` §1's owner-requirement table, line by line.** Every row: shipped? on both apps? in every
  language? After six sessions the requirement most likely to have been lost is the one nobody has re-read
  since day one.

**Also verify at programme level, because it hides in the seam between phases:** no SQL table, column, index
or type changed · no Cosmos container, partition key, **field**, IncludedPath, TTL or document family changed
· no search-index field or analyzer changed — across **P1 → P4.7 together**, not per phase. If one did
without the owner's yes, that is a §0.7 breach and it is reported as one.

**The rules that make an audit real** — every one earned by a defect in P1–P4.5:

- ‼️ **A test that asserts a STATUS CODE asserts the whole pipeline.** P4's audience-DTO test passed with the
  validation attributes deleted — the 400 was the tenancy middleware's. Drive the layer you are pinning.
- ‼️ **Sabotage every guard you rely on**, and sabotage with **valid** code that is *wrong* — an invalid-C#
  sabotage fails to compile and the test "passes" against a stale DLL. Snapshot to the scratchpad; **never**
  restore through git (§0.19).
- ‼️ **A count is not an identity.** `toBe(4)` survives deleting the call site you care about and adding one
  elsewhere.
- ‼️ **A guard that scans a peer repo must SKIP LOUDLY**, and `describe.skip` **still executes its callback**
  (§0.17) — every peer read belongs inside an `it()`. **Green must mean "I checked", never "I could not
  look".**
- ‼️ **A comment that asserts an invariant is a claim no build checks.** Re-read the code before trusting it.
- ‼️ **Do not report complete while an audit agent is still running.**

---

## 3. ‼️ DUTY THREE — SKILL ×4 and MEMORY, final

`clinqet-business-search/SKILL.md` in **all four** AI-tool directories (`.claude/skills/`, `.github/skills/`,
`.agents/skills/`, `.cursor/rules/clinqet-business-search.mdc`), **identical content** — verify byte-equality
rather than assuming it.

It is the **living contract** for everything that ships here, so after P5 it must stand alone: the wire
shape, the seventeen tools and their permissions, the authorization pipeline, the audience rules, the twins,
the seven sheets, the measured wording traps **with their numbers**, and every accepted residual with its
reason.

Then a memory entry + a one-line `MEMORY.md` pointer for the programme's close.

---

## 4. ‼️ DUTY FOUR — the owner's deploy / commit order checklist

The owner pushes and deploys; **you never do** (`feedback-owner-pushes-and-deploys-2026-08-20`). What P5 owes
is the checklist they will follow:

- **Pipeline ORDER: `clinqetshared` / `clinqetcore` / `clinqetinfrastructure` FIRST, hosts after.** A host
  deployed against an older library is the failure this ordering prevents.
- Which repos have changes, and what each contains in one line.
- ‼️ **Every appsettings key, ARM parameter and `deploy.ps1` entry the programme introduced**, with its
  per-environment value, and a statement of whether each is already in ARM + `deploy.ps1` (§25).
- The **search index** changes: additive fields only, and ‼️ **removing a field from a search model BLOCKS
  the whole index update** (P1.5 learned this the hard way). Both regions.
- Anything applied by hand per region — SQL migrations are **never** applied at startup
  (`feedback-never-migrate-on-startup`).
- ‼️ **Neither provider app may ship ahead of the API that carries
  `BusinessRoleAssignmentDto.AlwaysHasFullAccess`.** Both `searchAudience` twins read
  `role.alwaysHasFullAccess !== true`, fail-**open** on an absent field — against an older API the roles
  picker would offer `administrator`, the provider would untick it, and they would believe an administrator
  had been shut out when they had not. `!== false` was considered and **rejected** (`AUDIT-P4` §6.4).
  **API first, apps after.**
- ‼️ **P4.5 changed money strings on SEVENTEEN provider surfaces** — five in the first cut, then the twelve the
  closing sweep found (seven web, five phone) — plus the currency SYMBOL a business resolves to. The apps carry
  their own money twins and need no API ordering, but a provider comparing an old screenshot to a new screen
  will see `C$39.00` where they remember `CA$39`. **That is the fix. Say so before they ask.**
- ‼️ **Do NOT include the Functions repo's `local.settings.json` credentials.** The owner ruled that a
  **sandbox and not an issue** on 2026-09-04. Not a deploy step, not a security action, not mentioned again.

---

## 4b. ‼️ WHAT P4.6 LEFT OPEN — recognise these, do NOT re-find them as new

`AUDIT-P4.6-2026-09-05.md` §7 is the full statement. In short:

> ‼️ **UPDATED 2026-09-05 by the P4.6 verification pass. FIVE of the six are now CLOSED, and three of them were
> closed by discovering the audit itself was STALE.** `AUDIT-P4.6` §6b, §7.1, §7.2, §7.3, §7.5 and §7.6 carry
> the corrections. **Only the PDF item below is still open, and it is a deliberate decision, not a defect.**

| Item | Ruling for P5 |
|---|---|
| ~~`BusinessSearchMoney.Format` joins money with English words~~ | ‼️ **CLOSED 2026-09-05.** Five `BusinessSearch_Price_*` keys in all five catalogues (3,221 → 3,226, key sets verified identical), resolved through `ILocalizationService` with the reader's culture, singular/plural pair for hours. Guarded by `BusinessSearchMoneyWordingTests` (13 assertions), sabotage-proven. **If you find English connector words back, that is a NEW finding** |
| Booking + quote PDFs are pinned to English (`QuestPdfService.DocumentLanguage = "en"`) | **Deliberate, and the ONLY item still open.** Was on P4.6's MUST-NOT list. The money inside is correct. ‼️ **Do not "fix" it** — confirm the decision still stands, or ask |
| ~~Two tracked backup files — `InvoiceControllerTests.cs.bak`, `ManageServicesPrice.jsx.backup`~~ | ‼️ **DELETED 2026-09-05**, owner-approved. **If either is back, a commit resurrected it** |
| ~~`InvoiceDueGroupsView.jsx` — nothing imports it~~ | ‼️ **DELETED 2026-09-05**, owner-approved, with its test `invoiceGroupCurrencies.test.jsx`. Re-confirmed unreachable first (no dynamic/lazy import, no replacement view) |
| ~~**§7.1 the re-stamp** — "an owner decision"~~ | ‼️ **NEVER OPEN. The audit was STALE and contradicted its own §6.2.** `ResolveStoredCurrency` already keeps an issued row's currency; all three update paths call it. The three tests §7.1 named as the contract **do not exist** — their replacements assert the opposite (`BookingControllerTests.cs:4074, 4106, 4148`). **Nothing is owed by the owner** |
| ~~**§7.2 the symbol-taking overloads** — "named, costed, not taken"~~ | ‼️ **TAKEN. The audit was STALE.** `CurrencyMinorUnit` has no symbol overload and zero callers pass one |

‼️ **THE MOST TRANSFERABLE LESSON P4.6 PRODUCED, and P5 must apply it to ITSELF.** Three of that phase's six
"not done" items were **already done when they were written**. All three were sections describing a decision
*not* taken, written before the decision was reversed, and never re-read — the identical trap P4.5 recorded
for the SKILL, repeated inside the audit that recorded it. ‼️ **Before you publish `AUDIT-P5`, re-read every
"open"/"not done"/"deferred" claim in it against the code as it stands at that moment.** A residual you named
early and fixed later is a false claim, and it is the one kind of error these audits reliably produce.

‼️ **AND: NOBODY HAD RUN ANYTHING.** `AUDIT-P4.6` was published with no test numbers, no ESLint, no `tsc` —
a ~500-site refactor across five repositories, audited across nine dimensions, never compiled. The runs are now
in `AUDIT-P4.6` §6b. **P5 must paste real numbers, and must not accept "the audit says it is green".**

‼️ **AND A LARGE FINDING SET P4.6 DELIBERATELY DID NOT ACT ON.** Its close-out audit hunted six angles and
surfaced ~50 further cross-currency defects **outside the provider money surfaces P4.6 was scoped to**. They
are real, they are pre-existing, and they are **exactly what a whole-programme audit is for**. Do not treat
them as P4.6 failures; treat them as your inbox. The clusters, so you can find them again:

- **Sorting and filtering money across currencies** — bookings "Amount highest/lowest", quote min/max amount
  filters, invoice amount sort. A ₹ row and a C$ row ordered by raw number.
- **Cart** — the total adds across currencies and stores the sum under one code; a live e-mail reads it.
- **Promo** — `DiscountSpentMinor` accumulates across currencies; `BudgetMinor`, `MinAmountMinor` and
  `MaxDiscountMinor` compare against charges in unrelated currencies.
- **Broadcast / bids** — the awarded amount is stored with no currency, so the conversion booking invents one
  from the customer's location; bid resolution puts the LOCATION COUNTRY ahead of the row's stated currency.
- **Search index** — a provider card's price range is min/max **across** currencies, labelled with the first
  service's currency; "top offer" picks by raw `DiscountValue` across percentage and fixed offers.
- **AI catalogue extraction** — an extracted currency can override the business's on a service, and a country
  read off a PDF can relabel a whole catalogue.
- **`Discovery:CountryCurrencyMap` maps `AE` → `AED`, which is not a `CurrencyCode` member**, so a UAE
  business's stamp degrades to USD. ‼️ **Verify this one yourself before reporting it — it was flagged by an
  agent that had not opened both files.**

---

## 5. WHAT THIS PHASE MUST NOT DO

- ‼️ **Build anything from `PHASE-4.5-PROMPT.md`, `PHASE-4.6-PROMPT.md` or the P4.7 work.** If one left
  something open, **report it** — the owner needs to know it failed, not to discover it later.
- ‼️ **Re-find the accepted residuals as bugs.** `CARRIED-TO-P5.md` §2.4 lists them with their reasons: C3's
  customer subtitle ("Added {date}", owner-confirmed), the ISO card dates (raised and deliberately NOT put in
  scope), the Insights subtitle test, the box's raw hex greys (house idiom — its four siblings do the same),
  and the deliberate absence of `sameAudience` / `ALWAYS_FINDS`.
- ‼️ **Report a P4.5 DECISION as a defect.** Three are easy to mistake for regressions: **(a)** Spanish and
  French appointment TIMES changed — es-US is a 12-hour clock and fr-CA writes `15 h 07` — a consequence of
  `ProductLocales` that was measured and accepted; **(b)** every money string now carries the currency's own
  symbol and its own decimals (`C$39.00`, not `CA$39`) on **all five** surfaces at once; **(c)** ‼️ **PDFs
  stay English** — owner-confirmed 2026-09-04, so a PDF in one language while its e-mail is in another is
  the decision, not a localization gap.
- ‼️ **Re-build the MONEY DEBT, or re-find it as new.** ‼️ **P4.6 HAS RUN AND IS CLOSED** (2026-09-05 —
  `findings/AUDIT-P4.6-2026-09-05.md`, verified green in its §6b). The ~200 call sites `CARRIED-TO-P5.md`
  §2.4b once listed are **done**: both second renderers deleted, the server ships the CODE not a glyph, and
  five of the six "not done" items are closed. **Recognise it, cite the row, confirm it has not regressed, and
  move on.** ‼️ **If you find `clinqetwebpartnerapp/src/utils/currency.jsx` or
  `clinqetmobilepartnerapp/src/Util/currency.tsx` back in the tree, that is a REGRESSION and a finding** —
  not the old debt.
- ‼️ **Add scope.** No new feature, no redesign, no "while we're here". ‼️ **This is about FEATURES, not
  FIXES** — a defect this audit finds is FIXED here (see the header). What is forbidden is inventing work the
  audit did not surface.
- ‼️ **Leave a finding unfixed and call it "reported".** ‼️ **This is the failure mode this phase is most
  likely to end in**, because an audit that finds a lot is tempted to become a list. Every finding ends as
  FIXED, REFUTED WITH EVIDENCE, or an ACCEPTED RESIDUAL **the owner has agreed to**. If a fix is too large,
  **ASK — with the cost and a recommendation.** You do not get to decide that by writing it down.
- ‼️ **Change model-facing wording.** Any change there needs a live measurement, and measuring is P4.5's job,
  not this phase's. `PLAN` §15c: a drafted instruction measured **3/25**; the same instruction, naming the
  act, measured **25/25**.

---

## 6. DEFINITION OF DONE — five things

0. ‼️ **The three rules of §0 were followed** — every fix this phase made is a **root fix** with its class
   named, at least one full pass per app ran against **real live data** (not a fixture), and every question
   that needed the owner was **asked in plain words with a recommendation** rather than assumed.
   ‼️ **Coding standards for any fix: `PHASE-4.5-PROMPT.md` §10** — it is the single copy on purpose; do not
   duplicate it here, because two copies of a standard is the exact defect class this programme keeps hitting.
1. **The sheet walk-through is DONE and recorded as a table** — every state of M1–M9, web and phone, with a
   verdict per cell, ‼️ **a column saying whether real data can reach that state**, plus the states the apps
   have that no sheet draws.
2. **The cross-phase audit is RUN** — independent agents per dimension, then skeptics, including both
   P5-only dimensions (do the phases agree; `PLAN` §1 line by line) and the programme-level §0.7 check.
   **Every finding fixed, refuted with evidence, or named as an accepted residual.** Nothing is "noted".
   ‼️ **Do not report complete while an audit agent is still running.**
3. **Real green runs, taken AFTER the last change**: ‼️ **all four backend suites** —
   `Clinqet.API.UnitTests` · `Clinqet.API.IntegrationTests` · `Clinqet.Communications.UnitTests` ·
   `Clinqet.Communications.IntegrationTests` — the integration pair against **real** SQL + the Cosmos
   emulator, never a fake · **both** provider app suites in full · ESLint 0 ·
   `tsc --noEmit` clean. **Paste the numbers**, and check whether another session moved the tree since your
   run — a green run you cannot prove postdates every change is not evidence.
4. **`findings/AUDIT-FINAL-<date>.md`** — the whole-programme record: the walk-through table, both P5-only
   dimensions, the sabotage evidence, and **every accepted residual in one place** so the owner can see the
   programme's total remaining debt on one screen.
5. **The close-out artefacts**: SKILL ×4 (byte-identical, verified) · a memory entry + `MEMORY.md` pointer ·
   the **owner's deploy/commit order checklist** (§4) · `PLAN.md` §14's P5 row marked done and §0's register
   current · the tree clean with what you removed stated · **nothing committed, nothing pushed.**

> ‼️ **There is no P6.** Anything still open after this phase is the owner's open debt, and it must be
> written down in ONE place with its cost. An item that exists only in a code comment or a chat message has
> been dropped.

---

## 7. ‼️ CODING STANDARDS — the shape every fix this phase makes must have

> ‼️ **`C:\Nik\CLAUDE.md` is the full contract and WINS over anything below.** `PHASE-4.5-PROMPT.md` §10 is the
> long-form version and wins over this summary. **These are the owner's standards, restated here on 2026-09-05
> at the owner's instruction so a session that reads only this file still has them.** If any line here
> disagrees with `CLAUDE.md`, `CLAUDE.md` is right and this file is the bug — say so and fix it.

### 7.1 The owner's directives, verbatim in substance

**CORE — the "zero" rules.** ‼️ **Zero assumptions**: do not assume context; read and analyse the whole
relevant codebase, however large, before writing a line. ‼️ **Zero hallucinations**: only factual, verified
code — every file path, symbol, setting key, container, queue and enum value must exist and be checked.
‼️ **Zero workarounds**: no shortcuts, no hacky or temporary fixes; industry best practice only.
‼️ **Plan first**: analyse, form the architectural plan, then execute.

**PRE-PRODUCTION FREEDOM.** No legacy constraints — **never** write backward-compatible shims, feature flags,
old paths or backfill logic to support an older shape. ‼️ **If a massive refactor is the architecturally
correct answer, do the refactor.** Assume data can be dropped and recreated; aim at the best end state, not a
migration path to it.

**BACKEND & INFRASTRUCTURE.** Hyper-optimised and production-ready. Multi-threading and async where optimal
and **100% thread-safe**. ‼️ **Explicit resource deallocation the moment an object is no longer needed —
ZERO memory leaks, ZERO CPU leaks, ZERO resource exhaustion** (`using` / `await using`, proper
`IDisposable`/`IAsyncDisposable`). Watertight logic: every pathway covered, no gaps.

**FRONTEND & UI.** Stay strictly inside the existing theme, design system and component structure — build on
it, never deviate. ‼️ **Mobile-first: flawless on phone and iPad**, the primary surface. Routing smooth, fast
and lightweight. ‼️ **Strictly prevent redundant or duplicate API calls.** ‼️ **A brand-new page or interface
gets an isolated HTML mockup FIRST**, in `C:\Nik\Data\mockups\<sheet-name>\index.html` and registered in
`PLAN.md` §0, approved before any integrated UI code (§0.7.1, §0.20).

**EDGE CASES & RESILIENCE.** ‼️ **Never limit scope to the happy path.** Anticipate and handle every edge
case; survive network errors, latency, null states, missing data and broken connections gracefully on both
sides.

**COMMENTS.** ‼️ High signal only: a comment earns its place solely by carrying critical architectural context
or the non-obvious WHY. **No redundant, obvious or verbose comments** — §0.14 is zero-tolerance, the default
is NO comment, one short line maximum, and narrating what the code does is forbidden.

**OPTIONS & DECISIONS.** ‼️ **Whenever you present options, name your STRONGLY RECOMMENDED one and say WHY**,
concisely, so the owner can decide fast.

### 7.2 The platform specifics that will actually bite a P5 fix

- **Repos are separate git repositories.** ‼️ A test may only read paths inside its **own** repo (§0.17); the
  four hosts never reference each other (§0.15); `clinqetcore`/`clinqetshared`/`clinqetinfrastructure` are
  libraries every host compiles in, so scanning those from a host is correct. ‼️ **A library class is tested
  from the suite of the HOST whose runtime path invokes it** (§0.18) — grep the call sites first.
- ‼️ **NO cross-partition Cosmos query, ever** (§0.6) — no override. Point-read when you know the id; atomic
  PATCH for counters; ETag/CAS where there are concurrent writers, and a 412 fails gracefully.
- ‼️ **Any new repository method ⇒ review `cosmosindexsetup\Program.cs`** for an index change, same change.
- ‼️ **ANY schema change — SQL or Cosmos, including a new FIELD on an entity — is §0.7: STOP and ASK with the
  full table.** A plan or a phase file saying "add X" is NOT approval.
- **Enums serialize as STRINGS** (type-level `[JsonConverter(typeof(JsonStringEnumConverter))]`).
- **Structured logging only** — never interpolation. Service Bus handlers are **idempotent**.
- ‼️ **Every `IMemoryCache` write sets `Size = 1`** — the `(key, value, TimeSpan)` overloads are FORBIDDEN and
  a size-less write is a runtime 500.
- ‼️ **NEVER edit an applied EF migration; never migrate at startup.**
- **Notifications have ONE entry point**, `ICommunicationDispatcher.DispatchAsync`; a new `NotificationType`
  also needs `SignalRSettings:EnabledNotificationTypes`.
- ‼️ **No hardcoded user-facing text** (§0.10): a key in **all five** backend catalogues / all language files,
  resolved through `ILocalizationService` and `string.Format`-resolved before dispatch. Admin-internal alert
  wording is the only exception.
- ‼️ **MOBILE MIRRORS WEB in the SAME session** — every provider-web change ships in `clinqetmobilepartnerapp`
  too. Parity means matching **rendering rules**, not a same-named component.
- **Config hygiene**: a value that can vary is a setting, a fixed set is an enum, an options-class default
  must equal the `appsettings.json` default, and a removed key loses its options property and DI binding in
  the same change. A new `local.settings.json` key needs ARM + `deploy.ps1` in the same change.
- ‼️ **Tests are mandatory for every fix** (§0.8) — unit AND integration where the change touches money,
  schema, a unique index, an atomic counter, a webhook or a Service Bus processor. **100% pass, nothing
  skipped.** ‼️ **A guard must be sabotage-proven RED** with valid-but-wrong code, restored from a scratchpad
  copy — never through git (§0.19).
- ‼️ **Delete what your change orphaned** — dead code, unused imports, now-unreferenced components, orphan
  settings, stale DI registrations (§22.2, §0.16).
