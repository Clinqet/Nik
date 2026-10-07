# PHASE 4 PROMPT — Business Search ("Ask Clinket"), the document audience UI

> Paste this whole file as the opening message of the P4 session.
> Authority: `C:\Nik\Data\provider-ai-search\PLAN.md`. Read it before anything else.

---

## 0. WHAT YOU ARE BUILDING

**Phase 4 of 5** of the Business Search programme — internal name `BusinessSearch`, provider-facing name
**Ask Clinket**. P4 is the **document audience UI**: the control that lets a provider say who inside their
own business may find a document in a search. The FIELD and its ENFORCEMENT already shipped in P1 (decision
6b) — this phase is the provider-facing control for them, on the backend surface it needs and on **both**
provider apps in the same session.

**Read first, in this order:**

1. `C:\Nik\Data\provider-ai-search\PLAN.md` — the whole thing. §0 is the mockup register, §6.3 the audience
   design, §14 the phase table, §15 the decision register (decision **6b** is the one that moved the field
   into P1 and left the UI here).
2. `C:\Nik\Data\provider-ai-search\CARRIED-TO-P4.md` — **REQUIRED SCOPE**, reproduced verbatim in §5 below.
3. `C:\Nik\Data\provider-ai-search\findings\AUDIT-P3-2026-09-03.md` — what P3 found, fixed and left.
4. `C:\Nik\Data\provider-ai-search\AUTHORIZATION-DESIGN.md` — the C-items and the golden rule.
5. Skills: `clinqet-business-search` (the living contract), `clinqet-provider-teams` (roles, permissions,
   the snapshot cache), `clinqet-knowledge`-adjacent material in `clinqet-business-search` §documents.

**Do not re-plan and do not rebuild P1, P1.5, P2 or P3.** They are built, green and audited. If something in
them looks wrong, say so and ask — do not quietly change it.

---

## 1. WHAT ALREADY EXISTS (do not rebuild)

| Phase | State | What it gave you |
|---|---|---|
| **P1** | built, green, audited | The SSE agent, five Group A tools, **`searchAudience` + `PATCH …/audience` + the three-state allow-list**, citations, document page/text, member-scoped sessions |
| **P1.5** | built, green, audited | Voice input, multi-script retrieval, the `relativeRange` guard, the reused-service-seam test class |
| **P2** | built, green, audited | The answer UI on both provider apps |
| **P3** | built, green, audited | **Twelve Group B work tools**, the date resolver, the roster service, the server-side question redactor, the work source cards on both apps |

‼️ **`searchAudience` ALREADY EXISTS and is ALREADY ENFORCED.** P4 does not add a field, does not change a
schema, and must not "improve" the enforcement. Read `CARRIED-TO-P4.md` §6 and the P1 audit before assuming
otherwise. **If you conclude a schema change is needed, that is a §0.7 STOP-AND-ASK, not a build step.**

---

## 2. THE CONTRACT — memorise this before writing a line

### 2.1 The stream (unchanged since P1)

- Frames are `data: {json}\n\n`. **There is no `event:` line anywhere on this platform.** The type is
  in-JSON as `eventType`.
- `: ping\n\n` comment frames arrive every 15 s while a look-up runs. Skip them; never parse them.
- Property names are **camelCase**; **enum VALUES are PascalCase**.
- Null fields are **omitted** (`WhenWritingNull`). Absent ≠ false.
- **NO DOWNLOADS.** A document opens as its page when the page is real and as its own saved text otherwise.
- A stored answer that ended early carries the ASCII sentinel `\n\n[[partial-answer]]`; live frames carry
  `partial: true`. Strip the sentinel on replay; never match on translated words.

### 2.2 The rules P3 added, which P4 inherits

- **A capped list is never counted by the screen.** Sheet M5 §14: the quiet line under an answer names the
  KIND, never a number. The total is the server's to state or to withhold.
- **A status a provider reads is a TRANSLATED word or nothing.** `StatusWord(key, language)` returns null
  when the catalogue has no entry. Never `enum.ToString()` on anything a provider reads.
- **A citation's `recordId` is the identifier the APPS ROUTE BY**, not the entity's primary key.
- **`capabilityAccessState` for an OFFER, `capabilityReadState` for a SCREEN.** The read helper answers
  "allowed" on a FAILED access read by design; that is right for not locking a member out of their own
  screen and wrong for offering them something that will then be refused.

### 2.3 The two client twins

`clinqetwebpartnerapp/src/lib/businessSearch/askRules.js` and
`clinqetmobilepartnerapp/src/lib/businessSearch/askRules.ts` are line-for-line twins, compared by
`__tests__/businessSearchRulesParity.test.ts`. ‼️ **That suite SKIPS in CI** (the web tree is not checked
out), so each twin also needs its own test in its own repo — `askRules.test.js` and
`businessSearchRules.test.ts`. Keep both files **import-free**: a single import turns the parity diff into a
silent skip.

---

## 3. WHAT P4 BUILDS

### 3.0 ‼️‼️ CARRIED WORK — THE OWNER CONFIRMED ALL FOUR ON 2026-09-03. BUILD THESE FIRST.

> These are **not** optional, **not** "if there is room", and **not** a summary of something else. The owner
> read them and said yes. They are listed again in §7's Definition of Done, and a P4 that ships without them
> has **failed**, no matter how good the audience UI is.

| # | Deliverable | Done when |
|---|---|---|
| **C1** | ‼️ **DONE 2026-09-03 — findings/MEASUREMENTS-P3-2026-09-03.md, 2,475 live calls.** relativeRange **175/175** · follow-up carry-forward **125/125** · money **183/200 → fixed → 500/500 on the shipped code**. **ONE REMNANT IS YOURS:** the multi-script SEARCH WORDS block sits in the SYSTEM message and varies per question, so a multi-alphabet business misses the prompt cache on those turns. Moving it to the user turn fixes that — but it measured 25/25 where it sits (P1.5 Gate 1), so **re-measure, never merely move** | A NUMBER for the moved block, or a written decision not to move it |
| **C2** | **The refund card shows the customer's reason** — sheet M5's `rec-line`. Needs one optional field on `BusinessSearchCitationDto` (wire only; citations are **not** persisted, so this is **not** a §0.7 schema change) + one line on both `SourceCard`s | The reason renders on web AND phone, and a card without one renders no empty line |
| **C3** | **The four card subtitles match sheet M5's wording** — customer *"4 bookings · last on 2 Sep"*, message *"Unanswered since Mon 1 Sep"*, review *"29 Aug · no reply yet"*, Insights *"Bookings, earnings and reply time"*. Each is a composed sentence ⇒ its own parameterized key in all five BACKEND catalogues. ‼️ **Never fragments glued together** | All four render the approved wording in all five languages |
| **C4** | **The refund amount matches the page's shape** — the page renders `₹12,345.67`; the tool emits `INR 12345.67`. Use the platform's OWN `ICurrencyService.GetCurrencySymbolAsync(businessId, currency)` (cached; already used by the dashboard, invoices and booking payments) + `CurrencyMinorUnit.ToMajor` formatted `N{exponent}` for grouping. ‼️ **Do NOT change `CurrencyMinorUnit.ToMajorString`** — it is shared with every other money path | A refund answer and the Refund requests page show the same shaped figure, and JPY/KRW still render 0 decimals |

### 3.1 The control itself — sheet **M1 §4** already draws it

`C:\Nik\Data\mockups\business-search-page\provider-ai-search.html` (register row **M1**, `PLAN.md` §0)
draws the **"Team search"** box in the document editor. ‼️ **It is already approved — do not redraw it and do
not ask for a new sheet for what it covers.** What the sheet does NOT draw, you must draw and get a yes for
BEFORE writing integrated UI code (§0.7.1 mockup gate, §0.20 location):

- every **state** of the box: loading · saved · save failed · permission denied · offline;
- the **row pill** on the document list showing an audience at a glance;
- the **mobile** frames for both, which M1 draws for the page but not for this box.

### 3.2 ‼️ The role chips must render the REAL catalogue roles (`PLAN` §15c **S8**)

The sheet invents a role called **"Front desk"**. **There is no such role.** The ten system roles are in
`TenancyRoleCatalogDefinition.Roles`, and their display names come from the localization catalogue
(`BusinessRole_{key}_Name`). Render from the catalogue, in catalogue order.

A chip whose name is invented is worse than no chip: a provider will believe they have restricted a document
to a group that does not exist.

### 3.3 Localization ×15

Five backend files (`clinqetinfrastructure/Resources/Localization/{en,es,fr,gu,hi}.json`), five web
(`clinqetwebpartnerapp/public/lang/{en-US,es-US,fr-CA,gu-IN,hi-IN}.json`), five mobile
(`clinqetmobilepartnerapp/src/Locales/{en,es,fr,gu,hi}.json`).

- Web is **ICU**: apostrophes are DOUBLED (`What''s`), plurals are `{count, plural, one {#…} other {#…}}`.
- Mobile is **i18next**: single apostrophes, plurals are `KEY_one`/`KEY_other` with `{{count}}`.
- The mobile catalogue is nested UPPER_SNAKE, so any shared rule that returns a WEB key name needs a mapper —
  and `__tests__/businessSearchMobileKeys.test.ts` must be extended to walk the new keys, or a missing mapper
  renders the raw id to the provider.

### 3.4 ‼️ HOW TO TEST AGAINST THE LIVE MODEL — you can, locally, with no deploy

P3 ran **2,475 live calls** this way and it is how the money defect was found. Unit tests prove the code does
what you wrote; only this proves **the model obeys it**. Use it whenever you change model-facing wording.

**Credentials — already on this machine. Nothing to deploy, nothing to ask for.**
`clinqetapi/Clinqet.API/appsettings.json` → `AIService.Endpoint` and `AIService.ApiKey`.
‼️ **Read them in code; never print one, never write one into a file, never paste one into a report.**

**‼️ Use the SHIPPED deployment, not the AIService default.** Business Search runs
**`gpt-5.6-luna` at `reasoning_effort: "none"`** — `AIService.DeploymentName` says `gpt-5.4-mini`, which is a
different model and would measure nothing. `POST {endpoint}/openai/deployments/gpt-5.6-luna/chat/completions?api-version={AIService.ApiVersion}`,
header `api-key`.

**‼️ THE RULE THAT MAKES A MEASUREMENT MEAN ANYTHING — rebuild the prompt from SOURCE and assert it.**
Do not retype the wording into the probe. Read the `.cs`/`.json`, and for every literal fragment you use,
**assert it is byte-present in the file it came from** — so a typo throws instead of quietly measuring
wording that does not ship. This caught a mistake of mine during setup and it is not optional.
`shipped.mjs` in the P3 scratchpad is the worked example: it rebuilds the system prompt, the WORK RECORDS
block, the roster block and a tool schema, each fragment source-verified.

**Method:** N = **25** per case minimum, **50** when two variants are close, **100** to confirm a fix.
Classify each run programmatically — never eyeball a transcript. Run 5 concurrent; ~1,000 calls costs cents
and takes minutes.

**‼️ What P3 learned, so you do not spend the runs relearning it:**
- **State an ABSENCE; do not forbid harder.** When the model reaches for something the payload does not
  carry, say *"no such figure exists anywhere to quote"*. Four rounds of strengthening a prohibition reached
  48/50; one absence sentence reached 50/50, then 500/500.
- **Say it about the RECORDS, never the model's ability.** *"You cannot add these"* invites a model that
  plainly can.
- **A prohibition with a carve-out in a sibling note is not a prohibition.** *"Never total THEM together"*
  (about two directions) was read as licence to total within one.
- **Name the compliant action**, not only the forbidden one. Same shape as P1.5's 3/25 → 25/25.
- **Measure the hunch before shipping it.** A "cleanup" that renamed a field made a money path **worse**.

**Housekeeping:** probes live in the **session scratchpad** and are deleted at the end (§0.16) — never inside
a repo. Record the **NUMBER** in `AUDIT-P4` and, if it is a gate, in a `MEASUREMENTS-P4-<date>.md` beside
`findings/MEASUREMENTS-P3-2026-09-03.md`. **A measurement with no number written down did not happen.**

### 3.5 Tests

- Both apps, in their own repos (§0.17 — a test may only read its own repository).
- The audience control is an **authorization** surface: cover the four capability outcomes, not two.
- ‼️ **Sabotage every guard you write.** A guard that has never been red is a guard that may be reading
  nothing. Snapshot the file to the session scratchpad, mutate it there or restore from the copy —
  **NEVER `git checkout` / `restore` / `reset` / `stash` / `clean`** (§0.19: other sessions hold uncommitted
  work in these same trees).

---

## 4. THE P3 DELTA — what changed under you

| Area | Change |
|---|---|
| Tools | 5 → **17**. The 12 new ones are listed in `CARRIED-TO-P4.md` §5 |
| `BusinessSearchCitationKind` | +11 work kinds. The clients' `WORK_KINDS` list drives every rule that must treat them alike |
| Citations | `RecordId` added (wire only — citations are **not** persisted) |
| Cards | Work cards now carry a **kind label** and a localized status word |
| The footer | `answeredFromKey` returns a count-free key for work; `AnsweredFromWork` was **deleted** from all ten client catalogues |
| Chips | Bookings and leads chips are back (sheet M5 §10), gated on `capabilityAccessState` |
| Backend catalogues | +24 keys × 5 languages (lead/member/refund status words, reply-by, review stars) |
| New services | `IBusinessSearchDateRangeResolver`, `IBusinessSearchRosterService`, `IBusinessSearchQuestionRedactor` — all `AddScoped`, all pinned by a DI convention test |
| New guards | `businessSearchNavigation.test.ts`, `businessSearchMobileKeys.test.ts`, `askKeys.test.js`, the Group B role matrix, the DI registration test |

---

## 5. ‼️ REQUIRED SCOPE — `CARRIED-TO-P4.md`, in full

Read `C:\Nik\Data\provider-ai-search\CARRIED-TO-P4.md` and treat every open item in it as P4 scope. In
summary, and **not** as a substitute for reading it:

1. **§1 — the measurement is DONE** (`findings/MEASUREMENTS-P3-2026-09-03.md`, 1,175 live calls):
   `relativeRange` **175/175**, follow-up carry-forward **125/125**, money **183/200 → 196/200 after a fix**.
   ‼️ **Two remnants are yours, and they are C1(a) and C1(b) in §3.0** — the blocking product question about
   whether the Refund requests page should show a total, and the prompt-cache hazard in the multi-script
   block. Neither is optional and neither may be closed by assumption.
2. **§2 — five sheet-M5 card elements are not rendered.** None shows untranslated text; what is owed is a
   copy pass, and each phrase is a composed sentence needing its own parameterized key in all five backend
   catalogues. Never fragments glued together.
3. **§3 — two items still open from P1.5.** O9 (the `ServiceLookupSource` measurement, never run) and
   `get_business_profile` returning more than C5 enumerates (kept unless the owner objects). Say plainly that
   O9 was not run rather than implying it was considered.
4. **§4 — the four rules P3 added**, reproduced in §2.2 above.

---

## 6. THE ZERO-TOLERANCE RULES THAT WILL BITE THIS PHASE

Every rule in `C:\Nik\CLAUDE.md` §0 binds. These are the ones this phase touches:

- **§0.7 — ANY schema change, SQL or Cosmos, needs the owner's yes in the CURRENT conversation.** A plan
  saying "add X" is not approval. `searchAudience` already exists; if you think you need another field,
  **STOP and present the §0.7 table.**
- **§0.7.1 / §0.20 — the MOCKUP GATE.** Every new screen or state gets an isolated sheet in
  `C:\Nik\Data\mockups\<sheet-name>\index.html`, web AND mobile, **every state**, approved before integrated
  UI code — and **registered in `PLAN.md` §0 the day the owner says yes.** ‼️ **No technical word a provider
  can read**: not "passage", "chunk", "index", "embedding", "retrieval", "token", "payload", "endpoint",
  "stream", "cache", "blob", "SAS", "schema", "partition". Say *page*, *text*, *document*, *source*,
  *answer*, *saved*, *offline*.
- **§0.6 — NO cross-partition Cosmos query. Ever.** Read `cosmosindexsetup\Program.cs` before any new query.
- **§0.10 — no hardcoded user-facing text.** Localization keys only, every language file.
- **§0.14 — no verbose comments.** Default is NO comment; one short line max, and only for a non-obvious WHY,
  an invariant, a gotcha or a spec reference. Never narrate what the code does.
- **§0.16 — leave the tree clean.** Every scratch file goes in the session scratchpad, **never** inside a
  repo. Read `git status --porcelain` before reporting done, and say what you removed.
- **§0.17 / §0.18 — a test may only read its OWN repo, and a library class is tested from the suite of the
  HOST that invokes it.** `describe.skip` still EXECUTES its callback — every peer read goes inside an
  `it()` body.
- **§0.19 — NEVER `git checkout --` / `restore` / `reset` / `stash` / `clean` in these trees.** Multiple AI
  sessions hold uncommitted work in the same files. Snapshot to the scratchpad instead. P3 found another
  session's edits live in both provider apps.
- **Mobile mirrors web in the SAME session.** Parity means matching the rendering RULES, not shipping a
  same-named component.
- **Every `IMemoryCache` write sets `Size = 1`** — inline `MemoryCacheEntryOptions` at the call site; the
  convention scanner cannot see a helper.
- **No feature flags, no old paths.** Pre-prod: everything ships live.
- ‼️ **The owner pushes and deploys. NEVER `git push`. Do not commit unless asked.**

---

## 7. DEFINITION OF DONE — all four, or the phase is not done

1. **Everything in §3 and §5 is built** on the backend and on **both** provider apps, with real green runs
   shown: the affected API test projects, both app suites in full, ESLint at zero errors, `tsc --noEmit`
   clean.

   ‼️ **INCLUDING all four of §3.0 — C1, C2, C3 and C4 — which the owner confirmed on 2026-09-03.** Tick
   them off by NAME in the audit. A P4 that ships the audience UI without them has failed.

   ‼️ **C1's measurement is DONE and the money gate CLOSED at 500/500** — there is no product question left
   and no owner decision pending on it. C1's remnant is the prompt-cache item only.

   ‼️ **The technique that closed it is reusable, and P4 will need it.** When the model reaches for something
   the payload does not carry, the fix is usually to **state the absence**, not to forbid the act harder.
   Four rounds of re-wording a prohibition got to 48/50; one sentence saying *"no such figure exists anywhere
   to quote"* got to 50/50, then 500/500. Say it about the RECORDS, never about the model's ability —
   *"you cannot add these"* invites a model that plainly can.
2. **A multi-dimensional audit is RUN** — independent agents per dimension, then skeptics who try to REFUTE
   each finding. Every finding is **fixed** or **refuted with evidence** or **named as an accepted
   residual**; nothing is "noted". Written to
   `C:\Nik\Data\provider-ai-search\findings\AUDIT-P4-<date>.md`. ‼️ Include a dimension for **"did we miss
   anything the owner asked for"** and one for **"defects in code this phase never touched"**.
3. **`PHASE-5-PROMPT.md` is written AND pasted into the chat reply**, with everything still open carried
   into `CARRIED-TO-P5.md` as well. A carried item that appears in no downstream prompt has been dropped.
4. **`clinqet-business-search/SKILL.md` is updated in all four AI-tool directories** (`.claude/skills/`,
   `.github/skills/`, `.agents/skills/`, `.cursor/rules/`), a memory entry is added with a `MEMORY.md`
   pointer, the tree is clean, nothing is committed and nothing is pushed.

**Ask before acting when ambiguous.** A §0.7 schema question and the mockup gate are **BLOCKING** — stop and
wait for the owner's answer; do not proceed on an assumption.

**Own mistakes plainly.** If a sabotage came back green, say so and find out why. **Report faithfully** — if
a suite fails, show the output; if you skipped something, say so.
