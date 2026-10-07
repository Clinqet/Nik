# ‼️ CARRIED TO P4 — everything P3 did NOT close

> Written during P3 (2026-09-03), **before** the phase ended, so it survives even if that session does not.
> Referenced from `PHASE-4-PROMPT.md` and `findings/AUDIT-P3-2026-09-03.md` §8.
>
> ‼️ **A carried item that appears in no downstream prompt has been DROPPED, not carried.** If you are the
> session writing `PHASE-5-PROMPT.md`, everything still open below is REQUIRED scope. Copy it in; do not
> summarise it.

---

## 1. ‼️ MEASURED ON 2026-09-03 — **THIS ITEM IS NOW CLOSED**, and it found a real defect

> **Superseded by `findings/MEASUREMENTS-P3-2026-09-03.md`.** The owner asked for it to be run rather than
> carried, and it was: **1,175 live calls** against `gpt-5.6-luna` at `reasoning_effort: none`.

| Gate | Result |
|---|---|
| `relativeRange` — name the period, never compute a date | **175/175** |
| Rule A2 — the follow-up carries the period (*"and Gaurav's?"*) | **125/125** |
| ‼️ Money — never do arithmetic | **FAILED at 183/200**, cause diagnosed, fixed, re-measured at **196/200** |

**The money defect and its fix, in one line:** the `kinds` note ended *"never total **them** together"* about
the two opposite directions, and the model read it as licence to total **within** one direction — producing
`4500 + 12000 = 16,500` with the no-show claim excluded. The carve-out is gone and the money note now names
the compliant action. Both changes are in the code.

**‼️ THE MONEY GATE IS CLOSED AT 500/500 — and the way it closed is the lesson.** I first escalated the
residual to the owner as a product question, claiming prompting could not fix it. **That was wrong.** I was
still trying to forbid the act harder. The payload had never **stated that no total exists** — it merely
omitted one, so the model was asked for something the result neither carried nor denied and it filled the
gap. One sentence naming the absence took it from 48/50 to 50/50, then **500/500** on the shipped code.

> **Reusable rule:** when the model reaches for something the payload does not carry, **state the absence**
> rather than strengthening the prohibition — and state it about the RECORDS, never about the model's
> ability. *"You cannot add these"* invites a model that plainly can; *"no such figure exists anywhere to
> quote"* does not. A variant that renamed the count field off the word "total" made things **worse**
> (42/50), so measure the hunch before shipping it.

**ONE THING REMAINS, and it is P4's:**

1. **The cache hazard.** The multi-script SEARCH WORDS block is appended to the **system** message only when
   the question needs more than one alphabet — so for a multi-alphabet business the prompt prefix changes
   between questions and misses the cache on that turn. Moving it into the user turn fixes it, **but its
   current wording measured 25/25 where it sits (P1.5 Gate 1), so it may not be moved without re-measuring.**

---

## 1b. The original carried text, kept for the record

`CARRIED-TO-P3.md` §4 says, in its own words:

> ‼️ **A measured instruction is not a drafted one.** P1.5's field-description wording was approved in
> planning and measured **3/25**; naming the act measured **25/25**. Re-measure before changing
> model-facing wording, and record the number.

**P3 changed model-facing wording and did not measure it.** What changed:

| Where | What was added |
|---|---|
| `BusinessSearchAgent.AppendWorkRules` | Rules A, A2 (period carry-forward), B, C, D, E, F — the whole work-tool instruction block |
| `BusinessSearchAgent.AppendPeopleAsync` | The roster block: the colleagues' names and ids, in the system prompt, once per question |
| Every Group B tool's schema | The `relativeRange` enum descriptions, `mineOnly`, `assignedToMemberId` |
| Every Group B payload | The truthfulness notes: `Filtered(...)`, the SAMPLE note, `RefundAmountsAreVerbatim`, `CallSummariesAreOurOwnNote` |

**What P4 owes:** the harness in `findings/MEASUREMENTS-P1.5-2026-09-02.md`, run over the P3 wording, with the
number recorded. Specifically worth measuring, because each is a place a plausible alternative exists:

1. **`relativeRange` snake_case values.** The schema advertises `this_week`; a `Snake()` helper feeds the same
   spelling to the schema and to the prompt. Measure whether the model ever emits `thisWeek` anyway.
   (`OptionalEnum` strips separators, so a miss degrades to correct rather than to a refusal — but the number
   is still worth knowing.)
2. **Rule A2, the period carry-forward.** "How many bookings this week?" → "and Gaurav's?" must keep the week.
   Measure the carry-forward rate.
3. **The roster block's shape.** Names + ids in the system prompt vs a per-tool enum. P3 chose the prompt
   because a per-tool enum multiplies the roster by the number of offered tools. Not measured.
4. **The no-arithmetic instruction on money.** `["money"]` says "never add, convert or re-work any of them".
   Measure whether the model ever recomputes a total anyway.

## 2. SHEET M5 STATES NOT YET RENDERED — named in `AUDIT-P3` §8, unchanged since

`C:\Nik\Data\mockups\business-search-team-answers\index.html` (register row **M5**, `PLAN.md` §0).

| Sheet element | Status |
|---|---|
| The **refund card's** `rec-line` — the customer's own reason | **Not rendered.** It reaches the model (`customerReason`) and appears in the answer's prose. Rendering it on the card needs one new optional field on `BusinessSearchCitationDto` (a wire DTO — citations are **not** persisted, so this is not a §0.7 schema change) |
| The **customer card's** subtitle "4 bookings · last on 2 Sep" | Shows a neutral fact instead |
| The **message card's** "Unanswered since Mon 1 Sep" | Shows the conversation's context title |
| The **review card's** "29 Aug · no reply yet" | Shows the review's own title |
| The **Insights card's** "Bookings, earnings and reply time" | Shows the data-as-of date |

‼️ **None of these shows untranslated text** — that class was fixed in P3 (`AUDIT-P3` §2.3). What is owed is a
**copy pass** to match the approved phrasing, and every phrase is a composed sentence, so each needs its own
parameterized key in all five backend catalogues — never fragments glued together.

## 2b. ‼️ TWO ITEMS P3 FOUND LATE AND DID NOT BUILD — one of them is a §0.7 BLOCKING QUESTION

### 2b.1 T7 — a saved conversation replays the answer TEXT, and it is not re-authorized

`AUTHORIZATION-DESIGN` §2 says of T7: *"Only opaque handles are replayed; each turn re-authorizes."* The
citations are handles; **the answer's prose is not**, and `GetSession` returns `t.Content` unchanged. A
member whose scope narrows after asking can reopen the conversation and read figures they could no longer
obtain today.

The exposure is narrow — the session is member-scoped, so it is only their own past question and the answer
they were legitimately given — but the design document claims something the code does not do.

‼️ **DO NOT BUILD THIS WITHOUT THE OWNER'S YES.** Closing it needs `AuthorizationVersion` stored on the turn,
which is **a new field on a Cosmos entity ⇒ §0.7, blocking**. The completed §0.7 table is in
`findings/AUDIT-P3-2026-09-03.md` §8 item 5 — present it and wait. The honest framing to give the owner:
this is a **design-claim correction**, not a live leak, and amending T7's wording is a legitimate answer.

### 2b.2 The refund amount's shape differs from the Refund requests page

The tool emits `INR 12345.67`; the page renders `₹12,345.67`. Number and currency are both correct (and the
JPY/KRW exponent bug is fixed — the tool uses `CurrencyMinorUnit`), but the payload orders the model to quote
the string character for character, so the difference reaches a provider checking against their own screen.

Not fixed in P3 deliberately: matching the browser's ICU output byte-for-byte from .NET is not achievable,
changing `CurrencyMinorUnit.ToMajorString` alters money formatting **platform-wide**, and adding a second
formatter here is how a card, a PDF and a page start to disagree. **This is a platform-level money-formatting
question, not a Business Search one** — treat it as such, and get a ruling before touching the shared helper.

## 3. STILL OPEN FROM P1.5, UNCHANGED — do not let these quietly disappear

- **O9** — whether `search_services` should read the AI Search index instead of the Cosmos leg. The dial
  `BusinessSearch:ServiceLookupSource` exists and defaults to `Cosmos`. A **measurement**, not a decision.
  ‼️ Neither P1.5 nor P3 ran it. Say so rather than implying it was considered.
- **`get_business_profile` returns more than `AUTHORIZATION-DESIGN` C5 enumerates** (email, phone,
  description, listed, onlineBookings, defaultLocation, hasKnowledgeDocuments). No licence numbers, and it is
  the business's own data shown to its own team. **Kept unless the owner objects** — do not "fix" it silently.

## 4. ‼️ THE RULES P4 INHERITS

Everything in `CARRIED-TO-P3.md` §4 still binds. P3 adds four:

- **A capped list must never be counted by the screen.** Approved sheet M5 §14: the quiet line under an
  answer is *"Answered from bookings · your own work"* — **never a count**. The cards are a sample; the total
  is the server's to state or to withhold. P3 shipped a footer that counted, and it read as the total.
- **The card's status word is a TRANSLATED word or nothing.** `StatusWord(key, language)` returns null when
  the catalogue has no entry, because a card with no status is honest and one reading `CounterpartyDeclined`
  is not. Never `enum.ToString()` on anything a provider reads.
- **A citation's `recordId` must be the identifier the APPS ROUTE BY**, not the entity's primary key. Bookings
  and invoices route by NUMBER on both platforms; quotes and leads route by id. Check the destination screen,
  not the entity.
- **`capabilityAccessState` for an OFFER, `capabilityReadState` for a SCREEN.** The read helper answers
  "allowed" on a failed access read *by design* — right for not locking a member out of their own screen,
  wrong for offering them a suggestion that will then be refused.

## 5. WHAT P3 BUILT, SO P4 DOES NOT RE-LITIGATE IT

Twelve Group B tools, all registered, all in the role matrix:

| Tool | Permission | Notes |
|---|---|---|
| `list_bookings` | `booking.read` | cites the booking NUMBER |
| `list_quotes` | `quote.read` | wall-clock date boundaries (`issueDate`) |
| `list_invoices` | `invoice.read` | cites `invoiceNumber ?? invoiceId` |
| `invoice_totals` | `invoice.read` | period figure + the page's OWN summary service, labelled apart |
| `list_leads` | `lead.read` | |
| `list_customers` | `customer.read` | contact detail only on a covering Business-scope key |
| `inbox_summary` | `conversation.read` | the view IS the member dimension; per-tab counts are the totals |
| `get_insights` | `insights.read` | feature-gated separately from the permission |
| `list_team_members` | `team.read` | the roster the model resolves names against |
| `list_reviews` | `review.read` | |
| `search_call_followups` | `voice.read` | the note is the assistant's own, said on every card |
| `search_refund_requests` | `payment.read` | MONEY — amounts verbatim, real-engine integration tests |

**Deliberately NOT built:** `get_voice_usage` — allowance data belongs to the **ai-billing** family the owner
excluded on 2026-09-02, together with billing, activity and notifications.

**Design decision worth keeping:** one tool per family returning the **exact total** plus a **capped sample**,
rather than a list tool and a count tool per family. Cheaper (one round trip) and strictly more truthful (the
total can never disagree with the list). This is a deliberate deviation from `PLAN` §4.2's list+count shape.

## 6. THE MACHINERY P4 CAN RELY ON

- `IBusinessSearchDateRangeResolver` — a period the model NAMED, or two dates it copied, resolved to instants
  in the **business's** zone. Refuses both-or-neither. Exposes wall-clock **and** UTC boundaries, because
  `scheduledStartDateTime` / `issueDate` / `invoiceDate` are wall-clock and `paidAt` / `createdAt` are not.
- `IBusinessSearchRosterService` — lazy, cached, and `TryListAsync` keeps a FAILED read distinct from an
  empty roster. Nothing here runs for a knowledge question.
- `IBusinessSearchQuestionRedactor` — the server-side backstop for a colleague's name in a **stored**
  question. Runs at the point of persistence, never on the way in, and **fails closed** when the roster
  cannot be read.
- `BusinessSearchWorkToolBase` — schema building, scope resolution, date resolution, the cap, `Shown`,
  `Filtered`, `Local`, `StatusWord`, `Join`, `EmptyNoteFor`.
- Shared client rules (`askRules.js` ↔ `askRules.ts`): `WORK_KINDS`, `PAGED_KINDS`, `kindLabelKey`,
  `answeredFromKey`, `citationAction`, `sourceCounts`.
