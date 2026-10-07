# PHASE 3 PROMPT — Business Search ("Ask Clinket"), Group B team answers

> Paste this whole file as the opening message of the P3 session.
> Authority: `C:\Nik\Data\provider-ai-search\PLAN.md`. Read it before anything else.

---

## 0. WHAT YOU ARE BUILDING

**Phase 3 of 5** of the Business Search programme — internal name `BusinessSearch`, provider-facing name
**Ask Clinket**. P3 is **Group B: the team/work-list tools**, plus the structured-tool mechanism they all
depend on, on the backend **and** on both provider frontends in the same session.

**Read first, in this order:**

1. `C:\Nik\Data\provider-ai-search\PLAN.md` — the whole thing. §0 is the mockup register, §4 the tool
   groups, §15 the decision register, §18.15 the structured-tool measurements.
2. `C:\Nik\Data\provider-ai-search\CARRIED-TO-P3.md` — **REQUIRED SCOPE**, reproduced verbatim in §5 below.
3. `C:\Nik\Data\provider-ai-search\AUTHORIZATION-DESIGN.md` — the C-items. P3 needs new ones ruled.
4. `C:\Nik\Data\provider-ai-search\findings\AUDIT-P2-2026-09-03.md` — what P2 found, fixed and left.
5. `C:\Nik\Data\provider-ai-search\findings\AUDIT-P1.5-2026-09-03.md` — the reused-service-seam dimension.
6. Skills: `clinqet-business-search` (the living contract), `clinqet-provider-teams`,
   `clinqet-voice-assistant` (post-call summaries), `clinqet-payments` (refund requests).

**Do not re-plan and do not rebuild P1, P1.5 or P2.** They are built, green and audited. If something in
them looks wrong, say so and ask — do not quietly change it.

---

## 1. WHAT ALREADY EXISTS (do not rebuild)

| Phase | State | What it gave you |
|---|---|---|
| **P1** | built, green, audited | The SSE agent, the five Group A tools, `searchAudience`, citations, document page/text, member-scoped sessions |
| **P1.5** | built, green, audited | Voice input (`useDictation` web, `useSpeechToText` mobile), multi-script retrieval, the `relativeRange` **guard** (not the mechanism), the reused-service-seam test class |
| **P2** | built, green, audited | The answer UI on **both** provider apps. §4 below is its delta |

---

## 2. THE CONTRACT — memorise this before writing a line

### 2.1 The stream

- Frames are `data: {json}\n\n`. **There is no `event:` line anywhere on this platform.** The type is
  in-JSON as `eventType`.
- `: ping\n\n` comment frames arrive every 15 s while a look-up runs. Skip them; never parse them.
- Property names are **camelCase**; **enum VALUES are PascalCase** — `Meta`, `Status`, `Delta`, `Citation`,
  `Image`, `Done`, `Error`; citation kinds `Document`, `Faq`, `Service`, `Offer`, `Profile`, `Availability`.
- Null fields are **omitted** (`WhenWritingNull`). Absent ≠ false.

### 2.2 The page rule

`citation.page` is present ONLY for genuinely paginated sources (PDF, images, PPTX). **Absent ⇒ offer
"Show text", never invent a page.** The server decides; the client obeys. Both clients take this from the
shared `hasRealPage`/`citationAction` rule — never a local `citation.page ? …` branch. A guard on each
platform fails the build if you write one.

### 2.3 No downloads, anywhere

The `view-url` route was **DELETED** in P1.5. The routes are:

```
POST business/search/ask                       (SSE)
POST business/search/prepare                   (204, fire-and-forget, ignore the result)
GET  business/search/documents/{docId}/pages/{page}
GET  business/search/documents/{docId}/text
GET  business/search/sessions/{sessionId}
```

A 404 from the page or text route is **NORMAL** — a very long document is not stored page by page, and
stored pages are cleared after 180 days. `null` means "cannot be shown", which the panel says plainly.

### 2.4 The partial-answer signal

A stored answer that ended early carries the literal ASCII marker `[[partial-answer]]`. A **live** stream
sets `partial: true` on a `Status` frame. ‼️ **Read the FLAG live; STRIP the marker on replay.** Both are
in the shared rules (`PARTIAL_MARKER`, `isPartialFrame`, `stripPartialMarker`).

---

## 3. ‼️ THE ZERO-TOLERANCE RULES THAT BITE HARDEST HERE

Everything in `C:\Nik\CLAUDE.md` §0 applies. These are the ones P3 will trip over:

- **§0.7 — ANY schema change, SQL or Cosmos, needs the owner's explicit approval IN THE CURRENT
  CONVERSATION, before you write the code or the migration.** A plan document saying "add X" is **not**
  approval. A phase file instructing you to build X is **not** approval. Present the §0.7 table and WAIT.
  P3 is likely to want a field; ask first.
- **§0.6 — NO cross-partition Cosmos query. Ever.** Re-read `cosmosindexsetup\Program.cs` before writing
  any query so you know that container's partition key.
- **§0.8 — integration tests against REAL engines are MANDATORY for money, schema, unique indexes, atomic
  counters, webhooks and Service Bus processors.** `search_refund_requests` touches money. "Purely new
  functionality" is explicitly **not** an acceptable reason to skip them.
- **§0.14 — NO verbose comments.** Default is no comment. One short line, max, and only for a non-obvious
  WHY / invariant / gotcha. Never narrate what the code does.
- **§0.17 / §0.18 — a test may only read its own repo, and library code is tested from the suite of the
  HOST that invokes it.** ‼️ `describe.skip` **still executes its callback**, so every peer-tree read must
  sit inside an `it()` body. A guard that reads zero files and reports **Passed** does not merely miss bugs,
  it invents them.
- **§0.19 — NEVER `git checkout --` / `restore` / `reset` / `stash` / `clean` in these trees.** Other
  sessions hold uncommitted work in the same files. Snapshot to the scratchpad instead.
- **§0.16 — leave the tree clean.** No scratch file inside any repo, ever. Use the session scratchpad.
- **§0.20 — every mockup lives in `C:\Nik\Data\mockups\<sheet-name>\index.html`, is registered in
  `PLAN.md` §0, and contains NO technical word a provider could read.** `C:\Nik\mockups\` is gone and must
  never be recreated.
- **Mockup gate** — any new screen or state needs an isolated sheet showing **web AND mobile** and **every
  state** (empty, loading, error, permission-denied, limit-reached), **approved by the owner BEFORE any
  integrated UI code is written**.
- **Mobile mirrors web, in the SAME session.** Parity means matching the *rendering rules*, not shipping a
  same-named component.
- **No hardcoded user-facing text.** Every string is a key in all five files per platform.
- **Every `IMemoryCache` write sets `Size = 1`.** The convenience overloads are forbidden.
- **No feature flags, no old paths** — pre-prod, everything live directly. A failed gate means a design fix
  and a re-measure, never a switch. Dials stay; switches do not.
- **The owner pushes and deploys.** Prepare commits if asked; never `git push`.

---

## 4. ‼️ P2 DELTA — what changed under you, and what it obliges you to do

### 4.1 The shared client rules are TWINS and must be extended together

`clinqetwebpartnerapp/src/lib/businessSearch/askRules.js` and
`clinqetmobilepartnerapp/src/lib/businessSearch/askRules.ts` are dependency-free and side-effect-free by
design, and a parity suite compares them. Exports: `ASK_SURFACE`, `FRAME`, `CITATION_KIND`,
`PARTIAL_MARKER`, `parseFrameLine`, `drainFrames`, `isPartialFrame`, `stripPartialMarker`, `hasRealPage`,
`citationAction`, `citationSubtitle`, `sourceCounts`, `answeredFromKey`, `askChips`, `emptyLibraryState`.

**Add a Group B citation kind or action to one and you add it to both, in the same session.**

### 4.1.1 ‼️ A SHARED RULE THAT RETURNS A LOCALIZATION KEY NEEDS A MAPPER ON MOBILE — P3 WILL ADD MORE

The shared rules answer with **web** key names, deliberately: one vocabulary, one parity table. Mobile's
catalogues are nested UPPER_SNAKE, so the screen translates through small mappers — `chipKeyToMobile`,
`errorKeyToMobile`, `answeredFromKeyToMobile`.

‼️ **Handed over raw, i18next answers with the id itself.** P2 shipped `t(answeredFrom.key, …)` with no
mapper, so the line under every answer on the phone read **`BusinessSearch.Answer.AnsweredFromDocuments`**
to the provider, while eleven correctly translated keys sat unread in all five languages. No test caught it:
every suite checked that the screen rendered *a* value and that the catalogue *held* the keys — nothing
checked that the two vocabularies met.

There is now a guard for exactly this, in `businessSearchScreenRegistration.test.ts`: it derives every
`BusinessSearch.*` key the shared rules can return, asserts each is mentioned **only inside a mapper**, and
asserts no `t()` argument is a rule-supplied value. It is sabotage-verified. **Any key you add to the shared
rules must be mapped, or that guard turns red** — which is the point.

The alternative pattern is also fine and already used: let the rule decide *whether* to show something and
have the screen name its own mobile keys, as the empty-library state does.

### 4.2 The chips are built from the provider's own catalogue — and P3 makes M1's chip row live

`askChips` builds from the member's own service names. All ten system roles hold `catalog.service.read`, so
there is no permission branch. ‼️ **`Hours` is RESERVED and is never truncated away** — the room calculation
is `Math.max(0, Math.max(1, limit) - 1)`.

M4 §01b currently **supersedes** M1's chip row, because M1 offered bookings and leads chips that nothing
could answer. **P3 is the phase that makes them answerable.** When you add them: extend `askChips` on both
platforms, keep `Hours` reserved, and update M4 §01b and the register in `PLAN.md` §0 to say M1's row is
live again.

### 4.3 Analytics event names must be LITERAL inside the tracker call

`analyticsWebParity.test.ts` resolves the tracked value by reading the literal inside the
`trackResultClick(…)` / `trackNav(…)` call. A template hole (`` `source_${action}` ``) collapses to `*` and
the pair is compared on **neither** platform; a constant (`RESULT_TYPE[action]`) and a wrapper hide it too.

P2 replaced one template with four literals — `source_service`, `source_offer`, `source_profile`,
`source_hours`. **Write every new event name out in full, inside the call.** If a pair is genuinely web-only
or mobile-only, add it to `EXCLUDED_WEB_ONLY` **with the reason in the file**.

### 4.4 Tenancy reads go through `capabilityReadState`, never a bare `can()`

Four outcomes — failed / loading / granted / denied — because **a FAILED access read is not a denial**.
‼️ And `access` / `accessError` load asynchronously: **put them in the effect's dependency array.** P2
shipped two effects without them, and the consequence was that a member whose grants resolved after mount
got no chips at all.

`SURFACE_PERMISSIONS.businessSearch` now exists on **both** platforms as
`{ permission: null, controller: null, method: null, route: null }` — self-gated, because all ten roles hold
`business.profile.read`. `tenancyRenderingParity.test.ts` fails if the two files disagree.

### 4.5 Privacy

- The question is redacted **client-side** before it is stored for analytics: `redactQuestion`, order
  **AMOUNT → EMAIL → LONG_DIGITS → PHONE → customerNames → memberNames**, Unicode-aware (`\p{L}\p{M}\p{N}`
  — Devanagari combining marks are category **M**, not L), capped at `MAX_STORED_QUESTION_CHARS = 500`, with
  `containsContactDetails` applied as a backstop that drops the whole question if anything survives.
- ‼️ **`.test()` on a `/g` regex is stateful.** Use a non-global copy for any predicate.
- The question is **never** put in a URL. `src/utils/handedQuestion.js` is a one-shot in-memory slot that
  replaced a `?q=` handoff.
- `clearAllRecentQuestions()` is wired into `purgeClientState()` (web) and `clearAuthTokens()` (mobile), and
  guarded **at the call site** — never by asserting its name in the file that declares it.

### 4.6 ‼️ THE OPEN RESIDUAL P3 IS THE RIGHT PLACE TO CLOSE

**Member-name redaction can only cover roles that hold `team.read`.** The client redacts colleagues' names
by matching the roster it can read; a member without `team.read` cannot read the roster, so a colleague's
name they type is stored un-redacted.

‼️ **P3 is where this closes**, because CARRIED §2.2 already requires the server to validate a
model-supplied member id against the caller's real member list. The server that can do that can also redact
the stored question against the roster it can always see. Build it there.

### 4.7 The dictation control is now TWO mounts on each platform

Mounted as one stack inside the ask pill, the state message and the language chips were squeezed into the
mic's slot. Both platforms now split them:

| | control (inside the pill) | status (below it, full width) |
|---|---|---|
| web | `DictationMic` | `DictationStatus` |
| mobile | `SpeechToTextMic` | `SpeechToTextStatus`, both inside `SpeechToTextProvider` |

The mobile provider owns the hook **once**; the halves read it through context. `SpeechToTextButton` remains
as the composed control. **Mount both halves** if you put an ask box on a new surface.

Also: **offline disables the mic, "microphone blocked" does not.** Permission is granted outside the app, so
a disabled button could never re-enable itself — blocked is dimmed but tappable.

### 4.8 Tests you inherit, and the standard they set

Web now has **106** tests over the feature (it had zero when P2 started, and a web-only redaction defect had
already shipped and survived because the twins were tested only by a parity suite that **skips in CI**).

| Repo | Suites |
|---|---|
| web | `askRules.test.js`, `redactQuestion.test.js`, `businessSearchService.test.js`, `recentQuestions.test.js` |
| mobile | `businessSearchRules`, `businessSearchRedaction`, `businessSearchStream`, `businessSearchScreenRegistration`, `businessSearchRulesParity` |

**Test the twins in BOTH repos.** A parity suite is not coverage — it is a comparison, and it does not run
in CI.

### 4.9 Small things that will cost you an hour each

- **French typography puts a space before `?`** — `en ligne ?`, not `en ligne?`.
  `sourceLocalizationIntegrity.test.js` catches a letter before a bare `?`; it **cannot** catch `{name}?`,
  so check placeholders by hand.
- **ICU escapes an apostrophe by doubling it** (`jusqu''ici`) on web; **i18next does not** (`jusqu'ici`) on
  mobile. Copying one catalog's string into the other silently breaks it.
- **Plurals:** web is ICU `{count, plural, one {# source} other {# sources}}`; mobile is i18next
  `KEY_one` / `KEY_other` with `{{count}}`.
- **`bg-brand` / `border-brand` do not exist** in the web Tailwind config. The house idiom is
  `bg-[#97EF29]`, used by 177 files. A non-existent class fails silently — the control just has no fill.
- **A long page needs the whole `min-h-0` flex chain**, or the answer overflows instead of scrolling.
- **Bash heredocs with apostrophes fail in this environment**, and backslashes are eaten through
  heredoc→template-literal layers. Author patch scripts with the Write tool.
- **Files in these repos are mixed CRLF/LF.** Normalize both sides of an anchor and write back the file's
  own dominant ending.
- ‼️ **`includes("")` is always true** — guard a deletion edit with `if (to.length > 0 && body.includes(to))`
  or every deletion silently reports "already applied" and leaves the code in place.

### 4.10 ‼️ BOTH TREES ARE FULLY GREEN — keep them that way

**web 195/195 suites · 2707/2707 tests · ESLint 0 errors 0 warnings.
mobile 216/216 suites · 3608/3608 tests · ESLint 0 errors · `tsc --noEmit` clean.**

P2 ended with three defects fixed in code it never touched, because the owner ruled *"even if it is not
yours fix this"* (audit §14). Two were latent for anyone who ran the full suite; the third had shipped:

1. `PaymentSettings.jsx:511` read `settings.onboardingBlockedCode` on a `useState(null)` value, so the
   Payment Settings page **threw on the first render of every visit**. Now `settings?.`.
2. `liveCallEndedRedirect.test.tsx`'s `signalRService` mock omitted `onVoiceLiveJoinStage`, which
   `LiveCall/index.tsx:359` subscribes to. Every case in that suite threw before rendering.
3. The mobile dashboard greeting was **built and rendered nowhere** — the name was fetched, both keys
   shipped in all five languages, and the header showed the static "My Dashboard" instead of web's
   "Welcome back, {name}". Now mirrors `Header.jsx:136-143`; the orphaned key was removed.

‼️ **Run the FULL suite, not just your own files.** All three were invisible to a targeted run.

### 4.11 ‼️ A regex is not scoped to the object you are thinking about

While removing that orphaned key, `/^[ \t]*"HEADER": "[^"]*",[ \t]*\r?\n/m` matched the **first** `HEADER`
in each catalog — `ADD_BULKUPLOAD_SERVICES.HEADER` in all five languages, not `MY_DASHBOARD`'s. The
verification print said "MY_DASHBOARD still has 118 keys" and was **true and useless**: it confirmed what
had not been touched.

`git diff` caught it. The repair could not be `git checkout --` (§0.19), so each value was read from
`git show HEAD:`, re-inserted at its original position, the intended removal redone **scoped to the
`MY_DASHBOARD` object**, and every key asserted against HEAD to prove nothing else was lost.

**Diff before believing yourself, and never write a check that asserts what you did not change.**

---

## 5. ‼️ CARRIED-TO-P3 — REQUIRED SCOPE, VERBATIM

> Reproduced in full from `C:\Nik\Data\provider-ai-search\CARRIED-TO-P3.md`, per that file's own
> instruction: *"A carried item that appears in no downstream prompt has been DROPPED, not carried.
> Copy it in; do not summarise it."*

### 5.1 ‼️ TWO NEW GROUP B TOOLS — the owner called these "must and super important" (audit O4)

**Owner's ruling, 2026-09-02:** *"Add call follow-ups AND refund requests."* The other four surfaces `PLAN`
§4.0 excluded (billing, ai-billing, activity, notifications) **stay out**.

**‼️ Note what this decision actually overturned.** §4.0's exclusion of six dashboard surfaces was the
**planner's** decision and appears nowhere in §15's decision register. The owner never approved it. Treat any
other "out of scope by the plan" claim with the same suspicion.

#### Why P1.5 did not build them (so P3 does not re-litigate it)

| Reason | Detail |
|---|---|
| **The Group B shape does not exist yet** | `WorkListNarrowing`, the C4 possessive filter, the golden-rule test, the parameter-widening guard and the empty-queue copy are all P3 machinery. Building two tools first means building it twice, or shipping two tools that disobey the rules every later Group B tool follows |
| **Refund requests touch MONEY** | §0.8 makes real-engine integration tests **mandatory** for anything touching money. That is phase-sized work, not an add-on |
| **The permission is unruled** | `AUTHORIZATION-DESIGN` has no C-item for who may read call summaries or refund requests. That is an owner decision, not a build detail |
| **P1.5 was already carrying** | voice, multi-script retrieval and six audit items. Adding two money/telephony tools would have put all of it at risk |

#### `search_call_followups` — the phone receptionist's own call summaries

**Why it is the most natural provider question there is:** the AI receptionist answers calls the provider
missed, writes a summary and a follow-up suggestion for each, and the provider's most common question the
next morning is *"what did I miss?"*. Today Business Search cannot answer it at all.

| | |
|---|---|
| **Where the data lives** | The post-call summary written by the Functions host after every AI-handled call. Start from the `clinqet-voice-assistant` SKILL's post-call section and the surface at `clinqetwebpartnerapp` → `src/components/callFollowUps` |
| **Permission** | ‼️ An EXISTING key — do not mint a new one. Find the key the call-follow-ups page itself is gated on and reuse it exactly. A new permission key forces a `CatalogVersion` bump, a pin update, a sweep and a logout for every mobile member (memory: GRANT-CHANGE PLAYBOOK) |
| **Narrowing** | `WorkListNarrowing` like every Group B tool. C4 applies: *"my"* is a filter on top of scope, never a widening |
| **Dates** | Uses the `relativeRange` enum below. **Never** lets the model compute a date |
| **Golden rule** | The rows this tool returns MUST equal the rows the call-follow-ups page returns for the same member, same filters, same count |
| **Truthfulness** | The summary is AI-written and may be wrong. The tool result must say the summary is the assistant's own record of the call, not a transcript, so the model never presents it as verbatim |

#### `search_refund_requests` — ‼️ MONEY, so the strictest rules apply

| | |
|---|---|
| **Where the data lives** | The refund-request surface in the partner app. Start from the `clinqet-payments` SKILL |
| **Permission** | ‼️ An EXISTING money key, and **not** `catalog.*`. Dispatcher, technician and contractor must not read refund requests by default — check the role catalogue before choosing |
| **‼️ §0.8** | Integration tests against REAL engines are **MANDATORY**, not optional. "Purely new functionality" is explicitly NOT an acceptable reason to skip them |
| **‼️ Amounts** | Quoted VERBATIM from the tool result. System-prompt rule 4 already forbids converting, rounding or recalculating — a refund figure the model recomputed is a number the provider may act on |
| **Truthfulness** | A capped or filtered list of refunds MUST say so. A provider told "you have 3 refund requests" when there are 47 will plan their week on it |

### 5.2 ‼️ THE STRUCTURED-TOOL MECHANISM P1.5 GUARDED BUT DID NOT BUILD (PLAN §18.15)

P1.5 built the half that had a consumer — the guard that **structured tools carry NO script-rendering
fields**, pinned by `BusinessSearchQueryRenderingsTests.StructuredTools_CarryNoRenderingFieldsAtAnyAlphabetCount`.
The other half has no consumer until P3's tools exist, and P1.5 does not ship resolvers nothing calls (§22.2).

#### ‼️ `relativeRange` — the model must NEVER compute a date

**The measurement that decided this (PLAN §18.15):** asked *"कल"* (yesterday) with today = 2026-09-02, one run
of five returned **2026-09-03 — tomorrow**. A booking list for the wrong day, presented with confidence.

**Build:**
- A `relativeRange` **enum** on every date-taking tool: `today`, `yesterday`, `this_week`, `last_week`,
  `this_month`, `last_month`, and any others P3 needs.
- ‼️ **The SERVER computes the range, in the BUSINESS's time zone** — `BusinessProfile.TimeZoneId`, never the
  server's local zone and never the member's browser.
- Optional explicit `fromDate` / `toDate` for absolute asks ("between 3 and 9 March").
- ‼️ **EXACTLY ONE of the two.** Both ⇒ refuse. Neither ⇒ refuse. **Both refusal paths tested.**
- Plus a firm instruction in the tool description (owner: enum **and** instruction, not either).

#### ‼️ Member names resolve to IDS, and the answer NAMES who it used

**Measured, both models, 5/5 each:** `कल गौरव की बुकिंग` → `m-101`; `ગઈકાલે ગૌરવની બુકિંગ` → `m-101`;
`कल गौरी की बुकिंग` (near-collision) → `m-104`; `Kal Gaurav ni booking` → `m-101`.

**‼️ The measured weak spot: a person NOT on the team.** The model sometimes picks the nearest real member
instead of returning empty. **Two mitigations, BOTH required:**

1. **The server validates the returned id** against the caller's real member list AND the asker's
   permissions. A model-supplied id is never trusted — this is already required for authorization.
2. ‼️ **The answer states WHO it used** — *"3 bookings assigned to **Gaurav Shah** on 1 Sep 2026…"* — so a
   wrong resolution is visible instead of being a confidently wrong number. Same principle as decision 11.

**Tests owed:** unknown person ⇒ the server rejects the id · the answer names the resolved member ·
a technician passing `memberName` gets their own scope, never someone else's (parameter widening) ·
a solo business has NO `memberName` in any schema.

#### ‼️ `IsSolo` comes back with the first tool that needs it

P1.5 **removed** `BusinessSearchAuthorizationContext.IsSolo` and the live roster read behind it: it cost a
roster read on **every single question** and no tool consumed it. It was removed rather than pinned to a
constant, because a P3 team tool reading a hardcoded `false` would be told "not solo" about every business.

**P3 re-adds it** — `IBusinessMemberDirectory.CountRosterAsync`, solo = one member and no invitation in
flight, read LIVE (a roster change bumps nobody's `AuthorizationVersion`) — at the moment the first
member-narrowing tool needs it, and not before.

### 5.3 STILL OPEN, NOT BLOCKING (audit §13.2)

- **O9** — whether `search_services` should read the AI Search index instead of the Cosmos leg. The dial
  `BusinessSearch:ServiceLookupSource` exists and defaults to `Cosmos` (today's behaviour, unchanged). This is
  a **measurement**, not a decision. ‼️ P1.5 did not run it — say so rather than implying it was considered.
- **`get_business_profile` returns more than `AUTHORIZATION-DESIGN` C5 enumerates** (email, phone,
  description, listed, onlineBookings, defaultLocation, hasKnowledgeDocuments). No licence numbers, and it is
  the business's own data shown to its own team. **Kept unless the owner objects** — do not "fix" it silently.

### 5.4 ‼️ THE RULES P3 INHERITS, NOT JUST THE FEATURES

- **The truthfulness class (audit §12.6).** *Anything partial, bounded, filtered, merged or failed must SAY
  SO in the payload.* Group B tools are list-shaped and therefore the highest-risk surface yet built for it.
- **The reused-service seam (audit §12.2, P1.5's `ReusedServiceOutcomeTests`).** Before calling any
  pre-existing service: enumerate its outcome enum and handle or explicitly reject EVERY value, then
  **build a fixture for each value, not only the happy one**. A suite built from the same mental model as the
  implementation inherits its blind spots.
- ‼️ **A measured instruction is not a drafted one.** P1.5's field-description wording was approved in
  planning and measured **3/25**; naming the act measured **25/25**. Re-measure before changing model-facing
  wording, and record the number.

### 5.5 ‼️ ADDED BY P2 — SERVER-SIDE MEMBER-NAME REDACTION (`CARRIED-TO-P3.md` §5)

> This is **required scope**, not context. It is the one thing P2 could not close.

**Member-name redaction only covers roles that hold `team.read`.**

The question a provider types is redacted **client-side** before it is stored for analytics, and colleagues'
names are removed by matching against the roster the client can read. A member **without** `team.read`
cannot read the roster — so a colleague's name they type is stored **un-redacted**. The amount, e-mail,
phone and long-digit rules still apply; only the name list is short.

‼️ **P3 is the right place, and it is nearly free here**, because §5.2 already requires the server to
validate a model-supplied member id against the caller's real member list. The server that can do that can
also redact the stored question against the roster it can always see — server-side, where every role gets
the same protection regardless of what that member may read.

#### ‼️ THE SUBTLETY THAT MAKES THIS EASY TO GET WRONG — there are TWO copies of the question

| Copy | Must the colleague's name survive? |
|---|---|
| the text **sent to the model** | ‼️ **YES.** §5.2 requires the model to resolve *"Gaurav's bookings"* to a member id. Strip the name here and member narrowing stops working entirely |
| the text **persisted for analytics** | ‼️ **NO.** This is the copy the gap is about |

A blunt strip applied before the model call fixes the privacy gap and silently breaks §5.2. Redact **at the
point of persistence**, not on the way in.

#### Tests owed (§0.18: they live in the suite of the host that PERSISTS the question)

1. A member **without** `team.read` asks a question naming a colleague ⇒ the **stored** question carries the
   member placeholder, not the name.
2. ‼️ **The same ask still resolves that member and the answer still names them** (§5.2). This is the test
   that proves the fix did not break member narrowing — without it, 1 can be passed by a blunt strip.
3. A member **with** `team.read` reaches the same stored result: the client already redacted it, so client
   and server together must be **idempotent**, never double-substituted into nonsense.
4. A name that is **not on the roster** is not redacted as a member — the server can only redact people it
   can see. The amount, e-mail, phone and long-digit rules still apply to it. Assert the honest limit
   rather than implying total coverage.
5. ‼️ **The client-side redaction STAYS.** It is what stops the raw name leaving the device at all for the
   roles that *can* read the roster; the server is the backstop for the roles that cannot, not a
   replacement. A guard that the client call site still exists — deleting it would be a regression that
   this item's own fix could otherwise disguise as progress.

---

## 6. DEFINITION OF DONE — all four, no exceptions

1. **Everything in §5 built**, on the backend and on **both** provider apps. All affected projects build,
   **ESLint zero errors**, and every affected test suite green on a **real run** you show the output of.
   Integration tests against real engines for the money path (§0.8) — not optional.
   ‼️ **§5 means §5.1 THROUGH §5.5.** §5.5 (server-side member-name redaction) is the one item P2 could not
   close and is the easiest to skim past, because it reads like a note rather than a feature. It is a
   **privacy gap in stored data**, it ships with **five named tests** (§5.5), and one of those tests exists
   specifically to prove the fix did not break §5.2's member narrowing. **A P3 that ships without it has
   not met this Definition of Done** — say so explicitly in your summary rather than letting it lapse.
2. **A multi-dimensional audit has RUN**, across every dimension: correctness & contracts · tenant isolation
   and authorization · data safety & idempotency · cost & performance · memory/resource leaks & thread
   safety · config hygiene · localization ×10 client files · **web/mobile parity** · tests (placement
   §0.17/§0.18, fail-first evidence, sabotage) · deployment · **UI/UX against the approved mockup** ·
   **reused-service seams** · "did we miss anything the owner asked for". Use independent agents per
   dimension, then skeptics who try to **REFUTE** each finding. Every finding **fixed, or refuted with
   evidence**, written to `C:\Nik\Data\provider-ai-search\findings\AUDIT-P3-<date>.md`. Nothing "noted".
3. **`C:\Nik\Data\provider-ai-search\PHASE-4-PROMPT.md` written**, carrying everything P3 defers — and the
   **same text pasted into the chat reply**, because a file path alone is not delivery.
4. **Tree clean** of scratch files, `git status` reviewed, **nothing committed and nothing pushed**, and the
   summary says plainly what was built, audited, fixed, and what remains.

Also per §0.9: update `clinqet-business-search` SKILL.md in **all four** AI-tool directories, and add or
update the memory entry.

---

## 7. HOW TO WORK

- **Ask before acting when ambiguous** (§0.5). One clarifying question is always cheaper than an unintended
  change. Schema (§0.7) and the mockup gate are **blocking** questions — stop and wait.
- **Read the code end to end** before changing it. Never skim a large file.
- **Own your mistakes plainly.** If a test you wrote was wrong, say the test was wrong. If a sabotage came
  back green, say so and find out why — a guard that cannot fail is worse than no guard.
- **Report faithfully.** If a suite fails, show the output. If you skipped something, say so.
