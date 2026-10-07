# ‼️ CARRIED TO P3 — owner-mandated work that P1.5 deliberately did NOT build

> Written during P1.5 (2026-09-03), **before** the phase ended, so it survives even if that session does not.
> Referenced from: the P1.5 DELTA in `PHASE-2-PROMPT.md`, and `findings/AUDIT-P1.5-*.md` under
> *"did we miss anything the owner asked for"*.
>
> ‼️ **A carried item that appears in no downstream prompt has been DROPPED, not carried.** If you are the
> session writing `PHASE-3-PROMPT.md`, everything below is REQUIRED scope. Copy it in; do not summarise it.

---

## 1. ‼️ TWO NEW GROUP B TOOLS — the owner called these "must and super important" (audit O4)

**Owner's ruling, 2026-09-02:** *"Add call follow-ups AND refund requests."* The other four surfaces `PLAN`
§4.0 excluded (billing, ai-billing, activity, notifications) **stay out**.

**‼️ Note what this decision actually overturned.** §4.0's exclusion of six dashboard surfaces was the
**planner's** decision and appears nowhere in §15's decision register. The owner never approved it. Treat any
other "out of scope by the plan" claim with the same suspicion.

### 1.1 Why P1.5 did not build them (so P3 does not re-litigate it)

| Reason | Detail |
|---|---|
| **The Group B shape does not exist yet** | `WorkListNarrowing`, the C4 possessive filter, the golden-rule test, the parameter-widening guard and the empty-queue copy are all P3 machinery. Building two tools first means building it twice, or shipping two tools that disobey the rules every later Group B tool follows |
| **Refund requests touch MONEY** | §0.8 makes real-engine integration tests **mandatory** for anything touching money. That is phase-sized work, not an add-on |
| **The permission is unruled** | `AUTHORIZATION-DESIGN` has no C-item for who may read call summaries or refund requests. That is an owner decision, not a build detail |
| **P1.5 was already carrying** | voice, multi-script retrieval and six audit items. Adding two money/telephony tools would have put all of it at risk |

### 1.2 `search_call_followups` — the phone receptionist's own call summaries

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

### 1.3 `search_refund_requests` — ‼️ MONEY, so the strictest rules apply

| | |
|---|---|
| **Where the data lives** | The refund-request surface in the partner app. Start from the `clinqet-payments` SKILL |
| **Permission** | ‼️ An EXISTING money key, and **not** `catalog.*`. Dispatcher, technician and contractor must not read refund requests by default — check the role catalogue before choosing |
| **‼️ §0.8** | Integration tests against REAL engines are **MANDATORY**, not optional. "Purely new functionality" is explicitly NOT an acceptable reason to skip them |
| **‼️ Amounts** | Quoted VERBATIM from the tool result. System-prompt rule 4 already forbids converting, rounding or recalculating — a refund figure the model recomputed is a number the provider may act on |
| **Truthfulness** | A capped or filtered list of refunds MUST say so. A provider told "you have 3 refund requests" when there are 47 will plan their week on it |

---

## 2. ‼️ THE STRUCTURED-TOOL MECHANISM P1.5 GUARDED BUT DID NOT BUILD (PLAN §18.15)

P1.5 built the half that had a consumer — the guard that **structured tools carry NO script-rendering
fields**, pinned by `BusinessSearchQueryRenderingsTests.StructuredTools_CarryNoRenderingFieldsAtAnyAlphabetCount`.
The other half has no consumer until P3's tools exist, and P1.5 does not ship resolvers nothing calls (§22.2).

### 2.1 ‼️ `relativeRange` — the model must NEVER compute a date

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

### 2.2 ‼️ Member names resolve to IDS, and the answer NAMES who it used

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

### 2.3 ‼️ `IsSolo` comes back with the first tool that needs it

P1.5 **removed** `BusinessSearchAuthorizationContext.IsSolo` and the live roster read behind it: it cost a
roster read on **every single question** and no tool consumed it. It was removed rather than pinned to a
constant, because a P3 team tool reading a hardcoded `false` would be told "not solo" about every business.

**P3 re-adds it** — `IBusinessMemberDirectory.CountRosterAsync`, solo = one member and no invitation in
flight, read LIVE (a roster change bumps nobody's `AuthorizationVersion`) — at the moment the first
member-narrowing tool needs it, and not before.

---

## 3. STILL OPEN, NOT BLOCKING (audit §13.2)

- **O9** — whether `search_services` should read the AI Search index instead of the Cosmos leg. The dial
  `BusinessSearch:ServiceLookupSource` exists and defaults to `Cosmos` (today's behaviour, unchanged). This is
  a **measurement**, not a decision. ‼️ P1.5 did not run it — say so rather than implying it was considered.
- **`get_business_profile` returns more than `AUTHORIZATION-DESIGN` C5 enumerates** (email, phone,
  description, listed, onlineBookings, defaultLocation, hasKnowledgeDocuments). No licence numbers, and it is
  the business's own data shown to its own team. **Kept unless the owner objects** — do not "fix" it silently.

---

## 4. ‼️ THE RULES P3 INHERITS, NOT JUST THE FEATURES

- **The truthfulness class (audit §12.6).** *Anything partial, bounded, filtered, merged or failed must SAY
  SO in the payload.* Group B tools are list-shaped and therefore the highest-risk surface yet built for it.
- **The reused-service seam (audit §12.2, P1.5's `ReusedServiceOutcomeTests`).** Before calling any
  pre-existing service: enumerate its outcome enum and handle or explicitly reject EVERY value, then
  **build a fixture for each value, not only the happy one**. A suite built from the same mental model as the
  implementation inherits its blind spots.
- ‼️ **A measured instruction is not a drafted one.** P1.5's field-description wording was approved in
  planning and measured **3/25**; naming the act measured **25/25**. Re-measure before changing model-facing
  wording, and record the number.

---

## 5. ‼️ ADDED BY P2 (2026-09-03) — THE ONE RESIDUAL P2 COULD NOT CLOSE

> Audit: `findings/AUDIT-P2-2026-09-03.md` §12.

**Member-name redaction only covers roles that hold `team.read`.**

The question a provider types is redacted **client-side** before it is stored for analytics, and colleagues'
names are removed by matching against the roster the client can read. A member **without** `team.read`
cannot read the roster — so a colleague's name they type is stored **un-redacted**. The amount, e-mail,
phone and long-digit rules still apply; only the name list is short.

‼️ **P3 is the right place to close it, and closing it is nearly free here**, because §2.2 above already
requires the server to validate a model-supplied member id against the caller's real member list. The
server that can do that can also redact the stored question against the roster it can always see —
server-side, where every role's questions get the same protection regardless of what that member may read.

**Do not treat this as optional cleanup.** It is a privacy gap in stored data, and P2 left it open only
because the fix belongs on the server and P2 shipped no server code.

### ‼️ THE SUBTLETY THAT MAKES THIS EASY TO GET WRONG — there are TWO copies of the question

| Copy | Must the colleague's name survive? |
|---|---|
| the text **sent to the model** | ‼️ **YES.** §2.2 requires the model to resolve *"Gaurav's bookings"* to a member id. Strip the name here and member narrowing stops working entirely |
| the text **persisted for analytics** | ‼️ **NO.** This is the copy the gap is about |

A blunt strip applied before the model call fixes the privacy gap and silently breaks §2.2. Redact **at the
point of persistence**, not on the way in.

### Tests owed (§0.18: they live in the suite of the host that PERSISTS the question)

1. A member **without** `team.read` asks a question naming a colleague ⇒ the **stored** question carries the
   member placeholder, not the name.
2. ‼️ **The same ask still resolves that member and the answer still names them** (§2.2). This is the test
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
