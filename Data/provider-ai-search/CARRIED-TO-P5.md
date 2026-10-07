# ‼️ CARRIED TO P5 — and P5 is an AUDIT, so nothing here is a fix

> ‼️ **SUPERSEDED 2026-09-06.** P5 ran as an audit only and produced `findings/AUDIT-P5-2026-09-06.md`, which is now
> the ONE work list for P5B (its §17 is the P5B prompt). This file is kept for history. Known stale rows, verified
> against the code on 2026-09-05/06 (AUDIT §11, AG9-F7): §2.4b items 1, 2, 3 and 5 were already CLOSED by the
> 13:19 / 14:35 commits of 2026-09-05 (only item 4, PDFs pinned English, still holds — by owner decision); §2.4 item 7
> ("the dial is still Cosmos") is SUPERSEDED by P4.7 (the dial was deleted; both legs run). P5B rewrites this file
> from the code after the fixes land.

> ‼️ **REWRITTEN 2026-09-04 at the end of P4.5.** The owner's ruling that created P4.5 was
> *"nothing fucking move to phase 5 and phase 5 should be only end to end audit"*. This file now holds
> **only** what an audit phase should carry: the sheet walk-through duty, the two dimensions only P5 can
> run, the deploy/commit inputs, and the genuinely accepted residuals.
>
> ‼️ **If you find a FIX in this file, P4.5 failed.** Every defect P4's audit found in untouched code is
> shipped and green — see `findings/AUDIT-P4.5-2026-09-04.md` and the SKILL's §17.

## 1. WHERE THE WORK WENT

| Was carried here | Now lives in |
|---|---|
| The duplicate-upload data loss (reachable today) | `PHASE-4.5-PROMPT.md` §1 — **first and alone** |
| The /100 refund bug on four surfaces + four disagreeing zero-decimal tables + **Indian grouping** | §2 — ‼️ owner ruled **UNIFY into ONE helper** |
| The audience-value divergence + its lossy round trip | §3 — ‼️ **NO LONGER a §0.7 candidate. The owner approved the ROOT fix on 2026-09-04** (`PLAN` §15 decision 14): the **rule owns the parse**, the **entity holds the raw string**, and `KnowledgeSearchAudienceConverter.cs` is **deleted**. **No new field, no migration.** The extra-field option and the sentinel enum member were both **rejected** |
| The timeout-as-failure alarm gap · `list_customers` full-partition read · `CapPayload` on the other 11 tools · the dead `excluded` counter · the describe-scope peer read · `MaxTotalMediaBytes` declared in one host only (‼️ the `MaxImagesPerDocument` 15-vs-40 half of that finding was WRONG — two different settings, both correct; corrected in `AUDIT-P4` §9.8) · the DI registry · the missing `CancellationToken` | §4, the small batch |
| **O9** (never run in P1.5, P3 or P4) and **C1's remaining tool-schema variance** | §5 — both must end in a **number** |
| The phone helper copy + its sheet register · the 44 px phone row marks · `get_business_profile` vs C5 · T7's wording | §6 — ‼️ **the owner put these back in scope on 2026-09-04** |
| The committed Azure keys | ‼️ **DROPPED.** The owner ruled it a **sandbox and not an issue**. Do not raise it again, do not untrack the file, do not rotate anything |

---

## 2. WHAT P5 ACTUALLY CARRIES

### 2.1 The sheet walk-through — P5's largest duty, and the one most likely to be skimped

`PLAN` §0 registers **seven** approved sheets, M1–M7. §14's P5 duty is *"a walk-through of every approved
mockup state on both apps"* — the register exists so that list is possible.

- **Enumerate the states from the sheets, not from the code.** A state you cannot reach in the app is a
  finding; a state the app has that no sheet draws is **also** a finding.
- **Web and phone are separate walk-throughs.** Parity means matching **rendering rules**, not a same-named
  component.
- **Check each state's words against §0's "where every state's words come from" tables** — server sentence
  or screen copy key. A screen that re-invents a sentence the server already sends drifts out of translation.
- ‼️ **Check every state's copy for a technical word a provider can read** (§0.20), in **all four wired
  languages** (en, fr, gu, hi — es is authored but hidden), not just English.
- **Record it as a table**: sheet · state · web · phone · verdict. Prose saying "walked them all" is not
  evidence.

### 2.2 The two dimensions only P5 can run

- ‼️ **Do the phases AGREE with each other?** Each of P1–P4.5 audited its own diff. Nobody has yet asked
  whether a rule fixed in P2 survived P4 touching the same file, whether two phases spell one copy key two
  ways, or whether two tools format the same fact differently in one answer. **This is the whole point of P5.**
- ‼️ **`PLAN` §1's owner-requirement table, line by line.** Every row: shipped? on both apps? in every
  language? After five sessions the requirement most likely to have been lost is the one nobody has re-read
  since day one.

### 2.3 The deploy / commit order checklist — the owner's, to follow

The owner pushes and deploys; **P5 never does** (`feedback-owner-pushes-and-deploys-2026-08-20`).

- **Pipeline ORDER: `clinqetshared` / `clinqetcore` / `clinqetinfrastructure` FIRST, hosts after.**
- Which repos changed, and what each contains in one line.
- **Every appsettings key, ARM parameter and `deploy.ps1` entry the programme introduced**, with its
  per-environment value, and whether each is already in ARM + `deploy.ps1` (§25).
- The **search index** changes: additive fields only, and ‼️ **removing a field from a search model BLOCKS
  the whole index update** (P1.5 learned this the hard way). Both regions.
- Anything applied by hand per region — SQL migrations are **never** applied at startup
  (`feedback-never-migrate-on-startup`).
- ‼️ **Neither provider app may ship ahead of the API that carries
  `BusinessRoleAssignmentDto.AlwaysHasFullAccess`.** Both `searchAudience` twins read
  `role.alwaysHasFullAccess !== true`, which is fail-**open** on an absent field — against an older API the
  picker would offer `administrator`, the provider would untick it, and they would believe an administrator
  had been shut out when they had not. `!== false` was considered and **rejected** (`AUDIT-P4` §6.4):
  "unknown" is the same value for an ordinary role, so it would empty the picker for everyone. **This is a
  deploy-order constraint, not a code defect — API first, apps after.**


- ‼️ **P4.5 added no Azure resource, no Service Bus queue, no storage container and no `local.settings.json`
  key**, so it owes nothing to ARM or `deploy.ps1`. It DID add three keys to
  `clinqetapi/Clinqet.API/appsettings.json` under `Voice:Knowledge:Images` — a plain appsettings key needs
  no ARM entry (§25), and all three already carry the same values the Functions host declares, so behaviour
  is identical on the day of deploy.
- ‼️ **P4.5's changes span the LIBRARIES (`clinqetshared`, `clinqetcore`, `clinqetinfrastructure`) and
  BOTH hosts plus BOTH partner apps.** The pipeline order above therefore matters more than usual: the money
  renderer, the audience rule and `IKnowledgeIngestQueue` all live in the libraries and every host compiles
  them in.
- ‼️ **`IKnowledgeIngestQueue` is registered in the FUNCTIONS host only** — the API's
  `KnowledgeManagementService` uses the shared composition statics and keeps its own `IServiceBusService`.
  A future API-side consumer must add the registration or the host fails at resolution, which is the loud
  failure this deliberately keeps.

### 2.4 The genuinely accepted residuals — recorded so P5 does not re-find them as bugs

1. ‼️ **C3's customer-card subtitle ships "Added {date}", NOT sheet M5's "4 bookings · last on 2 Sep".**
   `BusinessCustomer` carries neither figure and the Customers page shows neither, so deriving them is one
   query per card for a number the provider cannot check against their own screen. **Owner-confirmed
   2026-09-04.** A booking count would need a projected counter on the customer row ⇒ §0.7. **Do not
   "complete" this against M5 without a new ruling.** Recorded in `PLAN` §0's M5 row.
2. **The three date-bearing subtitles render `yyyy-MM-dd`, not M5's friendly dates.** `Local(...)` is
   InvariantCulture across all 17 tools. ‼️ **Raised to the owner on 2026-09-04 and NOT put in scope** — it
   stays. (P4.5 changed how MONEY is rendered, not how dates are; the two are deliberately not symmetrical.)
3. **`GetInsightsTool`'s subtitle test asserts the fake's own copy** — the tool uses a plain
   `GetLocalizedString` with no `string.Format`. It still catches a key rename, which is all it can catch.
4. **The audience box carries 37 raw hex values** for greys, navy ink and brand green — as do all four of
   its siblings, because the `knowledge` Tailwind palette holds only the **semantic state** colours. That is
   the house idiom here, not a defect. ‼️ `AUDIT-P4` §4's claim that "every colour is now a token" was
   **wrong and is corrected in that file**.
5. **`sameAudience` and `ALWAYS_FINDS` are deliberately absent** from both client twins (`AUDIT-P4` §2.2,
   §2.4). Their absence is asserted by guards. **They are not missing — they were removed.**

#### New in P4.5 — stated, measured, and deliberately not fixed

6. ‼️ **The `searchWords` tool schema is now invariant in its ORDER but not in its SET.**
   `BusinessSearch:Retrieval:MaxQueryLegs` is **3**, so a business writing in FOUR or more alphabets still
   gets a different set of legs depending on which alphabet was asked, and its tool array still varies
   between questions. **No such business exists in either region today** (measured: every live knowledge row
   is single-alphabet). Closing it means raising the cap or dropping the asked-first guarantee — a retrieval
   trade-off, not a caching one. Numbers in `findings/MEASUREMENTS-P4.5-2026-09-04.md`.
7. ‼️ **O9 IS MEASURED AND THE DIAL IS STILL `Cosmos`** (ruling 7 — measure and report only). The number
   favours the index on recall: across 160 live lookups the index **missed nothing Cosmos found (0)** while
   Cosmos missed **34**; latency is a wash and regional; RU moves from metered to flat-rate. ‼️ **P5 owes the
   ONE input the decision still lacks:** the load measurement on the shared Azure AI Search service
   (`PLAN` §15c S6) — flipping the dial adds up to three provider queries per question to a service the
   customer marketplace already uses. **Do not flip it in P5 either; hand the owner the number.**
8. **The mobile app resolves its locale by LANGUAGE AND REGION** (`en` → `en-CA` or `en-IN`) through
   `getActiveLocale()`, while web and the backend resolve by language alone (`en` → `en-US`). ‼️ **This no
   longer covers MONEY.** P4.5 moved the mobile money twin onto the language's product locale
   (`AUDIT-P4.5` §3 row 5) and the close-out routed the last twelve screens through the twins, so an
   English-speaking provider in India now reads `₹531,000.00` on the phone, on the web and in an Ask Clinket
   answer alike. **The divergence remains for DATES and every other number** still formatted through
   `getActiveLocale()`. Mobile is arguably the more correct of the two. Making them agree means giving the
   backend and the web app a region-aware locale, which changes every date on those surfaces — **out of a fix
   phase's scope, and recorded here rather than silently left.**
9. **The customer app, the admin app and the customer mobile app each keep their own zero-decimal currency
   list** (the ISO 16-entry set, plus a 3-decimal set). They are **correct**, merely wider than the
   platform's own 20-code `CurrencyCode` enum, and they are not provider surfaces — so P4.5's "one
   definition" work stopped at the backend and the two PARTNER apps, which is where the defect was.
   ‼️ **The partner side is now swept COMPLETELY**: the close-out found **twelve more provider screens**
   still taking the symbol from the reader (`AUDIT-P4.5` §3 row 7), routed every one through the twins, and
   gave each partner app a **scanning guard** (`moneyFormattingConvention`) that fails on the next
   `style: "currency"`. These three CUSTOMER/ADMIN apps are therefore the **only unswept money surfaces
   left**, and none of them carries a guard. P5 should decide whether they are worth unifying; they are not
   currently wrong.
10. ‼️ **A duplicate-upload merge whose card metadata no longer fits re-posts the survivor on the
    `MetadataOnly` lane.** That lane re-cuts the document — correct, but it means one provider action can
    cost a re-ingest. Bounded by the same budget every re-cut has; named here so an unexpected re-ingest is
    not read as a bug.

**One deletion the owner owed a yes or no — ANSWERED AND DONE.** `ServiceAccordion.jsx` existed twice
(`booking/` and `quotes/`), hardcoded its currency symbol, and was git-tracked with zero importers. The owner
said delete; **both copies are gone** (P4.6).

---

### 2.4b ‼️ THE MONEY DEBT — CLOSED BY P4.6, except two named items

> ‼️ **REWRITTEN 2026-09-05 at the close of P4.6.** This row previously read *"NOT A RESIDUAL — AN OPEN DEBT
> THE OWNER MUST SCHEDULE"* and listed roughly 200 call sites across five repositories. **P4.6 was that
> phase.** What follows is what genuinely remains, so P5 neither re-finds the closed work as new nor assumes
> the whole debt is settled.

**Closed by P4.6 — do NOT re-open these as findings:**

| Row as it stood | Status |
|---|---|
| `clinqetmobilepartnerapp/src/Util/currency.tsx` — a second live money renderer, 115 sites / 26 screens, India-defaulting locale | ‼️ **DELETED.** Not deprecated — deleted, so a missed call site is a build error. All sites migrated |
| Mobile Plan & Billing — unconditional `/100`, business symbol, two decimals pinned | ‼️ **FIXED.** The row's own currency is read; the exponent follows it |
| `QuestPdfService` — 21 sites writing `symbol + ":N2"` with no culture | ‼️ **FIXED.** Every amount goes through `CurrencyMinorUnit.FormatMajor(amount, <row currency>, symbol, culture)` |
| ~25 e-mail / invoice sites — `:N2` pinning two decimals ⇒ `¥5,000.00` | ‼️ **FIXED.** `Exponent(currency)` decides the decimals |
| The cart-reminder e-mail — raw code, `F2`, hardcoded English `"Total:"` | ‼️ **FIXED**, including the localisation key |
| Provider web, 36 sites — symbol from the business rather than the row | ‼️ **FIXED**, and `formatPrice` no longer exists to make it possible |
| Broadcast bids — `F2`, no group separator | ‼️ **FIXED** |

**And a defect the row never knew about**, found by P4.6's audit and fixed: **money was being ADDED across
currencies** on the dashboard, the earnings graph and the invoice header — a live business read `233,510.10`
for `208,511.10 INR + 24,999.00 CAD`. See `findings/AUDIT-P4.6-2026-09-05.md` §2.

**What genuinely remains — the full statement is `AUDIT-P4.6-2026-09-05.md` §7:**

1. ‼️ **The re-stamp — an owner decision, not a fix P5 may make.** Updating an issued booking or quote at a
   business in another country re-stamps the row's `price.currency` to the business's and leaves the amounts
   alone. **Three named tests encode it as the intended contract** (§7.1 lists them). It was changed, the
   tests failed, and the change was reverted rather than the tests edited. **P5 will re-find this; cite this
   row and §7.1, and put the question to the owner rather than fixing it.**
2. **The symbol-taking `CurrencyMinorUnit` overloads** (§7.2) — ~30 call sites pass a currency AND a
   separately derived symbol. Every one agrees today; the pair is what lets them disagree. A signature change
   across two repos, named and costed, deliberately not taken inside P4.6.
3. **`BusinessSearchMoney.Format` joins its money with English words** (§7.3) — the amount obeys the rule,
   the connector words do not. Belongs to the P4.7 catalogue work.
4. **Booking and quote PDFs are pinned to English** (§7.4) — deliberate, and on P4.6's MUST-NOT list.
5. **Two tracked `.bak`/`.backup` files** (§7.5) and **`InvoiceDueGroupsView.jsx`, which nothing imports**
   (§7.6) — all three pre-date P4.6 and all three are the owner's to delete.

‼️ **P5 MUST NOT BUILD any of this** (owner ruling: P5 is an audit and only an audit). Item 1 is a question to
ask; items 2–5 are rows to recognise and move past.
---

### 2.5 One thing to verify rather than assume

**P4's own §0.7 check must be re-run at programme level.** P4 confirmed no SQL table/column/index, no Cosmos
container/partition-key/field/IncludedPath/TTL, and no search-index field changed in *its* diff. P5 should
confirm the same across **P1 → P4.5 together**, because the one place a schema change hides is the seam
between two phases that each thought the other owned it.

---

## 3. ‼️ THE RULES P5 INHERITS

Everything in `CARRIED-TO-P3.md` §4 and `CARRIED-TO-P4.md` §4 still binds. P4 added five, each paid for by a
defect it actually found:

1. ‼️ **A test that asserts a STATUS CODE asserts the whole pipeline.** P4's audience-DTO test passed **with
   the validation attributes deleted** — the 400 was the tenancy middleware's. Drive the layer you are
   pinning. **The suite was deleted, not patched.**
2. ‼️ **Never skip a write because the tap matches the OPEN DOCUMENT** — that document is a snapshot, and a
   list that only refreshes while something is processing can be as old as the last navigation. And
   **reconcile from the server after every write, success AND failure.**
3. ‼️ **A client must never hardcode a key the server owns.** §0.17 forbids the client test from reading the
   catalogue, so a rename could never be caught — and the failure direction was the bad one. Derive it on the
   server and let the client be told.
4. ‼️ **Copy that says "just you" is read by someone who is not you.** And a business that **shrank** to one
   person still holds its restriction, so hiding the control hides the only way to clear it.
5. ‼️ **A comment that asserts an invariant is a claim no build checks.** Three in this area were wrong.
   Re-read the code a comment describes before trusting it, and correct it in the same change.
