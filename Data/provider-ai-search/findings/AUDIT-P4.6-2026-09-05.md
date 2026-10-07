# AUDIT — PHASE 4.6, 2026-09-05 · MONEY, EVERYWHERE ELSE

> ‼️ **THE HEADLINE.** The phase set out to close ~250 call sites. It found instead that all of them were
> symptoms of **one** decision: **the server resolved the business's currency CODE and threw it away, shipping
> only a glyph.** No app screen could reach the one money definition — it could only paste a glyph in front of
> a raw number. That is now fixed at the root, and the ~250 sites were closed on top of it.
>
> ‼️ **AND THE PHASE FOUND A DEFECT NOBODY HAD LOOKED FOR: the money was being ADDED UP ACROSS CURRENCIES.**
> Live business `LXDP8G`'s dashboard read **233510.1** for a single day. That is ₹208,511.10 and C$24,999.00
> added together — a number that is not any amount of money. Measured, approved, and fixed end to end.

---

## 0. WHAT WAS BUILT

| § | Item | State |
|---|---|---|
| **ROOT** | `ICurrencyService.GetCurrencyCodeAsync` is the ONE resolution; `GetCurrencySymbolAsync` now DERIVES from it (`Symbol(await GetCurrencyCodeAsync(...))`), so a second answer is structurally impossible | ✔ |
| **ROOT** | `DashboardStatisticsDto` / `EarningsGraphResponseDto` ship `Currency` (an ISO code). ‼️ `CurrencySymbol` is **DELETED** — keeping both would have been the two-sources-of-truth this phase exists to remove | ✔ |
| **ROOT** | Both apps hold the CODE: web `useBusinessCurrency()` (`src/utils/businessCurrency.js`, Redux `currency.code`), mobile `useCurrencyContext().currencyCode` | ✔ |
| §3.1 | ‼️ **The mobile SECOND RENDERER is DELETED** — `src/Util/currency.tsx`, region-aware and defaulting to India, is gone with **zero importers** | ✔ |
| §3.1 | ‼️ **The web business-symbol renderer is DELETED** — `src/utils/currency.jsx`, gone with **zero importers** and **zero `formatPrice` calls** left in the repo | ✔ |
| §3.2 | Mobile Plan & Billing: the unconditional `/100`, the business symbol and the pinned 2 decimals are gone; it matches the web twin's `formatMoney`/`formatMonthlyEquivalent` including the currency-less branch | ✔ |
| §3.3 | Mobile Payment Settings: `toFixed(2)` gone | ✔ |
| §3.4 | Provider web: all 44 `formatPrice` sites migrated; the symbol now follows the ROW | ✔ |
| §3.5 | Backend: all 12 inventory files; `QuestPdfService`'s 21 sites, both e-mail processors, the cart reminder, broadcast bids | ✔ |
| §3.7 | Both unreferenced `ServiceAccordion.jsx` **deleted** (owner-approved) | ✔ |
| **NEW** | Mixed-currency aggregates fixed end to end — repository, DTOs, services, and both apps' rendering against approved sheet **M8** | ✔ |
| **NEW** | Three mobile mock screens deleted (owner-approved); two kept because they are **reachable** — see §6 | ✔ |
| §4 | Four scanning guards, each with an exemption registry, each sabotage-proven | ✔ |

---

## 1. ‼️ THE ROOT CAUSE — and why ~250 sites were the wrong unit of work

`CurrencyService.GetCurrencySymbolAsync` resolved `ICountryResolutionService.ResolveByBusinessIdAsync(...).CurrencyCode`
and then **returned only `CurrencyMinorUnit.Symbol(resolved)`**, discarding the code. `DashboardStatisticsDto`
carried `CurrencySymbol` and nothing else. Measured: `grep -rn currencyCode src/` over the whole provider
mobile app returned **ZERO hits outside a comment**.

**A symbol cannot be turned back into a currency.** So every form, every create screen and every aggregate
*physically could not* apply the rule — the best it could do was concatenate a glyph onto a number. Roughly
**60 of the ~250 sites were blocked on this one gap**, and no amount of per-site patching would have closed
them.

The fix is one sentence: **ship the code, derive the glyph.** `ProviderInsightsDto.Currency` already did
exactly this ("provider's primary listing currency (client formatting)") — the dashboard DTOs simply had not
followed it. Not a schema change: response DTOs store nothing and migrate nothing.

---

## 2. ‼️ THE DEFECT NOBODY WAS LOOKING FOR — money added across currencies

`InvoiceRepository.GetTodayPaidEarningsAsync` was `SELECT VALUE SUM(c.totalAmount) … status='Paid'` with **no
currency predicate and no GROUP BY**. The invoice summary grouped by status only. The earnings-range query
never selected `c.currency`. `Invoice.Currency` is per-row (taken from the booking first, the business only as
a fallback), so one business genuinely holds several.

**Live, measured, not theoretical:**

```
LXDP8G today's earnings, today's query:  233510.1
LXDP8G today's earnings, grouped:        [{CAD: 24999}, {INR: 208511.1}]
```

**The owner asked whether fixing it costs RU. Measured against the live dev account, partition-scoped, 3 runs each:**

| Query | Today | Grouped by currency | Δ |
|---|---|---|---|
| Today's earnings | 3.70 RU | 3.85 RU | **+0.15 (+4%)** |
| Invoice summary | 5.35 RU | 5.45 RU | **+0.10 (+1.9%)** |
| Earnings range | 3.76 RU | 3.78 RU | **+0.02 (+0.5%)** |

Same documents, same index, same partition — only the result payload grows. **No index change is owed:**
`c.currency` appears only in the SELECT and the GROUP BY; Cosmos computes GROUP BY after the filter, so it
binds no index path, and every WHERE predicate is unchanged. §0.7 was never triggered.

The owner approved the fix on that measurement, and approved sheet **M8**
(`C:\Nik\Data\mockups\provider-money-multi-currency\index.html`), registered in `PLAN.md` §0.

‼️ **The client had the same defect**, found while building the UI: mobile `src/Util/invoiceDue.ts` summed
`totalAmount` across rows with zero currency awareness and printed the result with the business's symbol.
Fixed the same way.

---

## 3. ‼️ THREE DEFECTS THIS PHASE'S OWN FIX PASS INTRODUCED — all caught, all fixed

**This is the most useful section in the file.** A fix pass is not safer than the code it fixes.

| # | What | How it was caught | Fixed |
|---|---|---|---|
| 1 | ‼️ **`OfferValidationService` referenced THIRTEEN localization keys that did not exist.** A provider would have read the literal string `Error_OfferNotStarted` instead of a sentence — **worse than the hardcoded English it replaced** | A mechanical check of every `GetLocalizedString("…")` literal in the changed files against `en.json` | ✔ all 13 added to all five catalogues with real translations; key sets verified identical |
| 2 | ‼️ **`currency` and `language` were added as OPTIONAL parameters with silent defaults** → `Parse(null)` = USD, `Resolve(null)` = en-US. A future caller omitting them gets a dollar sign on a rupee amount and English text, with no error | Reading the diff and asking what happens when a caller does not pass them | ✔ made REQUIRED; all six callers already passed them, and correctly prefer the row's currency |
| 3 | ‼️ **THE SAME TRAP A SECOND TIME, and this one was LIVE**: `InvoiceLineDiscountFormatter` gained `string? currencyCode = null` and **all three production callers omitted it** — so every line-discount caption silently used USD's exponent. A ¥5,000 discount would print `¥5,000.00` | Two agents owned adjacent files; I checked the seam between them rather than trusting either | ✔ the parameter is now a REQUIRED `CurrencyCode`; all three callers pass the real currency; a JPY regression test added |

‼️ **The lesson is a CLASS, not three incidents: an optional parameter that silently defaults a currency is
the same defect as a second symbol table.** A repo-wide scan now confirms none remains:
`grep -rnE "(CurrencyCode|string\?? +currency[A-Za-z]*) +[A-Za-z]+ *= *(null|default)"` returns nothing in
production code.

---

## 4. ‼️ FINDINGS THE INVENTORY DID NOT CONTAIN

The phase file's §3 was one agent's sweep. Re-running the greps from scratch found more.

| # | What | Evidence | Outcome |
|---|---|---|---|
| 1 | **`CatalogManifestService.BuildPriceNote`** wrote `ToString("N0", InvariantCulture)` — `N0` **drops the decimals entirely** (a 24.50 deposit prints `24`) and the reader's `language` sat unused one line above | **Live**: the CA region holds `Deposit: 500 CAD` in `Service.Pricing.Notes` today | ✔ fixed; renders `500.00 CAD`; a JPY/USD/INR theory pins both halves |
| 2 | ‼️ **Both apps posted the GLYPH as the currency** — `currency: currencySymbol` in four payload builders, sending `"₹"` where the DTO is contracted to hold `"INR"` | Harmless today (the server stamps `Currency = stampCurrency` and ignores it) — **confirmed live: all 276 rows in both regions carry proper ISO codes, zero symbols** | ✔ owner approved deletion; all four removed |
| 3 | **~40 more sites in ~15 more files** wrote `{currencySymbol}{rawAmount}` with no formatter at all — the same defect without a `formatPrice` to grep for | Offers, GlobalOfferPicker, OfferSelector, InvoiceCardCompact, Invoices, YourEarnings, onboarding ServiceCard, both ServicesLists; mobile bookingCard, Offers, KnowledgeServiceDrafts | ✔ owner approved; all fixed |
| 4 | **`useDashboardStatistics.js` still dispatched `setCurrency(statsData.currencySymbol)`** — dead after the DTO change, and had the field ever returned it would have pushed a GLYPH into the Redux slot that `businessCurrency.js` promises is never a glyph | Found by the UI agent; verified by reading the hook | ✔ branch and its orphaned `useDispatch` removed |
| 5 | **`InvoiceDueGroupsView.jsx` rendered `formatAmt(invoice?.totalAmount)` with NO currency**, so a CAD invoice in that view printed ₹ | The component is ORPHANED — nothing imports it | ✔ fixed anyway; the orphan is recorded as a residual (§6) |

**Live-data evidence gathered for this phase** (probe deleted; §0.2):

- `LXDP8G` (India) still holds invoice `INV2608010301` **and** booking `2608A5AC38` in **CAD**.
- ‼️ **Stronger than the P4.5 case:** business `MEE3IC` (Canada) holds **39 services split across CAD and USD**,
  and `D7OZWY` (India) holds **INR and USD**. There is *no* single business symbol that can be correct for
  those rows — the service list renders two currencies side by side.
- Every `price.currency` / `currency` value in both regions is a valid ISO code. **Zero symbols.**

---

## 5. THE RECONCILIATION — every count adds up

‼️ **A count that does not reconcile is a failed phase.** Every agent reported
`sitesFound = sitesChanged + sitesClassifiedOut`, and every one balanced.

| Section | Files | Sites found | Money → changed | Not money → classified out |
|---|---|---|---|---|
| **Backend** (§3.5 + the two new backend findings) | 12 + 1 | **75** | **66** | **9** |
| **Apps** (§3.1–§3.4 + the ~40 extra sites + the deletions) | 66 | **434** | **307** | **127** |
| **TOTAL** | **79** | **509** | **373** | **136** |

**Classified out** — a currency symbol on any of these would have been a NEW defect: distances in km, per-km
distances beside their rates, quantities, invoice line quantities, top-up minutes, ratings, tax percentages,
discount percentages, basis points, counts, durations, elapsed seconds, and the OData/log/cache-key/geo/hash
sites of §3.6.

Beyond the reconciled sites, done directly: the `ICurrencyService`/DTO/service/controller contract, both
currency providers, 18 test mocks repointed, `VoiceAssistantPromo` ×2 migrated, 3 mobile screens migrated,
`InvoiceLineDiscountFormatter`'s signature, 13 localization keys, 4 guards, 2 rendering tests.

‼️ **And two files the inventory could not have contained, because the phase's own DTO change created the
defect in them** — `InvoiceTotalsTool` and `BillingReceiptEmailProcessor`, found while chasing §7's
residuals. Both are in §6.4. **A sweep can only enumerate what is wrong before it starts.**

---


---

## 6. ‼️ THE MULTI-DIMENSIONAL AUDIT OF THIS PHASE'S OWN DIFF

Nine independent dimensions, then two adversarial skeptic passes over every critical/major claim.
**77 findings: 8 critical, 19 major, 50 minor** — plus **4 found afterwards** in §6.4, while chasing the
residuals for §7, which is why that section exists. Every one is fixed, refuted with evidence, or named in
§7 as an accepted residual. Nothing is "noted".

‼️ **The audit earned its place four times over.** It found a regression this phase INTRODUCED, a critical
defect on a file the phase never opened, a data-write defect nobody had asked it to look for — and then,
after it had reported, four more that only existed BECAUSE of this phase's own DTO change.

### 6.1 ‼️ THE REGRESSION THIS PHASE INTRODUCED — and it was a CLASS, not a site

`currencySymbol("")` returned **`"$"`**. The renderer this phase deleted returned `symbol ?? ""`, so an
unresolved currency used to render **nothing**. After the phase it rendered **US dollars**.

That is not a fail-safe, it is a false claim about whose money an amount is — and it is **permanent for four of
the ten roles**, because the currency rides `dashboard/statistics`, which is `[RequiresPermission("insights.read")]`
and those roles never fetch it. An Indian provider on such a role would have read `$500` on a ₹500 offer.

**Fixed at the root in both twins**: an EMPTY code now yields `""` (no currency stated ⇒ no symbol, which is
the rule); a non-empty UNRECOGNISED code still yields `"$"`. One change closed four separate audit findings
(web Offers ×3, `BookingCostSummary`, mobile `ServiceDetails`/`SendQuotePage`, both `VoiceAssistantPromo`s).

### 6.2 The critical and major findings, fixed

| What | What a provider would have seen | Fix |
|---|---|---|
| ‼️ **`BookingAgendaView` / `QuoteAgendaView` never opened.** The phase widened `formatAmt(amount, currency)` and fixed the sibling TABLE view in the same page — the AGENDA view still called the one-argument shape | The SAME booking changes currency when the view toggle is flipped: `C$24,999.00` in Table, `₹24,999.00` in Agenda, one click apart | ✔ both pass the row's currency |
| ‼️ **`InvoiceForm` is the EDIT form too** — bound to the business currency with a comment saying "a form composing a NEW invoice", while `EditInvoicePage` plumbed no currency at all | Editing a CAD invoice at an Indian business showed ₹ on every row and in the preview, while that invoice's own detail page showed C$ | ✔ the invoice's currency is threaded into the form, its preview and its line items |
| ‼️ **An UPDATE re-stamped the row's currency.** The offer message used the ROW's currency; eleven lines later `UpdateFromDto` re-stamped the row to the BUSINESS's | A CAD booking edited at an Indian business silently became INR with the amounts untouched — every later screen then rendered Canadian dollars with a rupee sign | ✔ an issued booking or quote KEEPS its currency; the business stamps only a NEW row |
| ‼️ **"Also paid" was rendered on EVERY status card**, not just Paid | The Overdue card read *"OVERDUE … Also paid … C$500.00"* — money that is unpaid and overdue, labelled paid. Same on Draft | ✔ a status-neutral caption in both apps, five languages each |
| ‼️ **A raw GUID in a provider-facing sentence** (§0.20) | *"Offer 'Summer 20% Off' cannot be combined with offer '3f2a91cd-6b17-4a0e-…'"*, in five languages | ✔ names the offer; the not-found message reworded to carry no id at all |
| ‼️ **`BroadcastDetails` wrote `"USD"` into the bid SUBMISSION PAYLOAD** — found by an agent sweeping beyond its brief. Not a rendering defect: it put a wrong currency into the record | A bid whose currency was unknown was SAVED as US dollars | ✔ the field is omitted when unknown, matching the web |
| **Mobile Leads rounded money and invented USD** | `C$1,235` on the phone's Leads list vs `C$1,234.56` on web — and vs `C$1,234.56` in the phone's own Inbox for the same bid | ✔ both mobile Broadcast files match the web rule exactly |
| **The web Explore budget filter hardcoded `$`** while the phase gave the mobile twin a caption saying the filter has no single currency | Web: *"Customer Budget $50-$100"*. Phone: *"50 – 100 (in each request's own currency)"*. Same control, two contradictory answers | ✔ web matches the phone, with the mobile translations verbatim |
| **Mobile's "also paid" rows never named the currency** (web does) | A provider holding Swedish and Norwegian invoices saw two rows both reading `kr` with no word to tell them apart | ✔ names the currency, matching web |
| ‼️ **`CurrencyTotals.Split` dropped a currency group whose amounts netted to zero — including its COUNT** | "12 invoices" beside "11 invoices" with no sign of the twelfth | ✔ a group with rows is listed even at zero |
| **Two assertions that could not fail**: `Assert.NotNull` on a non-nullable string with a default, at the two places the phase's central claim is provable over real HTTP; and a theory whose `language` argument was inert because 5,000 groups identically in en-US, hi-IN and Invariant | A regression shipping a glyph from either endpoint would have left both integration tests green | ✔ now parses as a `CurrencyCode` and rejects a glyph; the theory uses 500,000, where `hi-IN` gives 5,00,000 and `en` gives 500,000 |
| ‼️ **A guard that reported green on the very defect its title described** — `SYMBOL_CONCAT` matched only the literal identifier `currencySymbol`, so a holder named `symbol` (or the aliased import `currencySymbol as symbolFor`) was invisible | Nothing — and that is the problem: a reviewer trusting the suite believed no screen glued a business glyph onto a raw amount while two did | ✔ both twins now scan the SHAPE: they resolve each file's symbol HOLDERS (the helper, its alias, and anything assigned from them) and flag adjacency. It newly reported 5 sites, all legitimate, now in an explicit registry with a stale-row check |

### 6.3 Findings REFUTED, with evidence

| Claim | Why it does not hold |
|---|---|
| *Adding `c.currency` to four Transactions queries removes index-only aggregation and raises RU materially* | The skeptic pass reproduced the facts but rejected the mechanism, and the **measurement settles it**: +0.15 / +0.10 / +0.02 RU against the live account, partition-scoped, three runs each. `c.currency` appears only in the SELECT and the GROUP BY; Cosmos computes GROUP BY *after* the filter, so it binds no index path. Every WHERE predicate is unchanged |
| *A repository assertion was LOOSENED — `Assert.Equal(123.45m, earnings)` became `Assert.Empty(earnings)`* | The value coverage **moved, it was not dropped**. That test pins the QUERY SHAPE; `DashboardServiceTests` now asserts the live figures (208,511.10 INR + 24,999.00 CAD) **and `NotEqual(233510.10)`** — the actual defect number, a stronger assertion than the arbitrary 123.45 it replaced. A comment now says so where the next reader will look |
| *`symbolFor(currencyCode)` unguarded is a regression from HEAD on mobile* | `git show HEAD:src/context/CurrencyProvider.tsx` proves the HEAD default was `''`, not `'₹'`. The claim was checked against the file's own out-of-date comment rather than its code |
| Four "vacuous test" claims about `CatalogManifestServiceTests`, `DashboardControllerTests`, `currencyProviderGate` | All four were **real** and are fixed above; the skeptics correctly marked them "no provider impact" (false green, not a live defect) |

### 6.4 Four more found AFTER the audit sections above were written — across two files, all from this phase's own DTO change

| What | What a provider would have heard or read | Fix |
|---|---|---|
| ‼️ **`invoice_totals` paired a FULL count with a PRIMARY-CURRENCY total.** This phase narrowed `InvoiceSummaryDto.TotalAmount` to the business's own currency and added `PrimaryCurrencyCount` + `OtherCurrencies` beside it. The Ask Clinket tool was never opened, so it kept reading `Count` next to `TotalAmount` | *"Twelve invoices, C$5,000 in total"* — when eleven were CAD and the twelfth was a ₹5,000 invoice that appears in the count and in neither total. The second currency was invisible to the model | ✔ the tool emits `count`, `countInCurrency`, `total` and `otherCurrencies` per status and all-time, with a note the model gets ONLY when two currencies exist |
| ‼️ **The same tool summed the period's PAID invoices across currencies** — `paid.Sum(p => p.TotalAmount)` — although this phase had already widened that repository row to carry each invoice's own currency | *"You took C$5,200 last week"* for C$200 and ₹5,000 | ✔ split through `CurrencyTotals`, the same helper the page's header uses |
| ‼️ **The tool named the currency from a SECOND resolver.** `IFullProviderContextService` maps the primary address through the discovery settings; `ICurrencyService` maps the same address through the country lookup. Two maps, one question — and the tool's own test fixture already had them disagreeing (summary said USD, payload said CAD) and passed | An INR total quoted to the provider as Canadian dollars, with every test green | ✔ the summary states the currency ITS figures are in and that is the only one quoted; the second dependency is gone from the tool |
| ‼️ **The booking receipt took the glyph from the QUOTED currency and the number from the PAID one** — `GetCurrencySymbolAsync(…, booking.Price?.Currency)` beside `Format(paidMinor, Parse(booking.Payment?.Currency), …)`, in the e-mail and its PDF | A booking quoted in USD and charged in CAD read `$150.00` for a C$150.00 charge | ✔ one paid currency answers both; the file's private `ParseBookingCurrency` (a second parse, without `Enum.IsDefined`) is deleted in favour of `CurrencyMinorUnit.Parse` |

---

## 6b. ‼️ THE GREEN RUNS — §7.4 of the phase file, and they had never been taken

> ‼️ **ADDED 2026-09-05 by the independent verification pass.** Every section above this one was written with
> **no suite having been run.** A ~500-site money refactor across five repositories was implemented, audited
> across nine dimensions and two skeptic passes, and reported complete — and nothing had been compiled or
> executed. **The audit pass and the RUN find different things, exactly as the fix pass and the audit pass do.**

The first set was taken on a tree confirmed clean in every repo. The `Clinqet.API.UnitTests` figure was then
re-taken after this pass's own §7.3 change, and `Clinqet.Communications` and `Clinqet.Mcp` were rebuilt because
`clinqetshared` moved.

| Check | Result | P4.5 baseline |
|---|---|---|
| `Clinqet.API.UnitTests` | **11,681 passed · 0 failed · 0 skipped** (2m30s) — 11,668 before this pass's 13 new tests | 11,618 |
| `Clinqet.Communications.UnitTests` | **3,948 passed · 0 failed · 0 skipped** (2m56s) | 3,862 |
| `clinqetwebpartnerapp` jest | **2,997 passed · 0 failed · 220/220 suites** — 3,003/221 before §7.6 deleted the orphan's suite; the 6-test drop reconciles exactly | 2,888 / 209 suites |
| `clinqetmobilepartnerapp` jest | **3,902 passed · 0 failed · 236/236 suites** (run ALONE — see the flake note) | 3,803 / 227 suites |
| `clinqetwebpartnerapp` ESLint | **0 errors, 0 warnings** | — |
| `clinqetmobilepartnerapp` `tsc --noEmit` | **clean** (no diagnostics) | — |
| `Clinqet.Communications` + `Clinqet.Mcp` builds | **succeeded** after the `clinqetshared` change | — |

‼️ **The mobile flake, and why it is NOT a defect — recorded so the next session does not re-find it.**
A first mobile run reported 5 failed suites and a second reported 2, **different ones each time**. Every
failure was `thrown: "Exceeded timeout of 20000 ms for a test."` — **not one assertion failure** — and suites
that PASSED in the same window took 49–61 s where they normally take 12–14 s. The cause was load: mobile jest,
web jest, ESLint and the Cosmos-emulator integration suite running concurrently on one machine.

‼️ **SETTLED, not argued: run alone with nothing else on the machine, the suite is 236/236 and 3,902/3,902,
zero failures.** (The two named suites also pass 44/44 in 12.9 s and 13.8 s in isolation.) A real defect does
not move between runs. ‼️ **Do not "fix" these tests, and do not raise the 20 s timeout** — the lesson is to
run the mobile suite unloaded, not to weaken it. A suite whose per-test budget is ~14 s against a 20 s timeout
has only ~30% headroom, which is worth knowing before adding slow tests to it.

**Not run, by owner ruling (2026-09-05):** `Clinqet.API.IntegrationTests` and
`Clinqet.Communications.IntegrationTests`. The owner deploys this code and states both pass; the run was
stopped mid-flight at their instruction. ‼️ **Stated rather than claimed** — this file must not imply a green
it does not hold.

---

## 7. WHAT IS *NOT* DONE — stated, not buried

**Six items were listed. FIVE are now closed** — §7.1 and §7.2 were stale (already done), and §7.3, §7.5 and §7.6 were fixed or deleted on 2026-09-05. **Only §7.4 remains, and it is a deliberate owner decision.** **None was a money figure that rendered
wrongly today; two are owner decisions.**

### 7.1 ~~‼️ THE RE-STAMP — an owner decision, not mine~~ ‼️ ALREADY FIXED. This row was STALE and contradicted §6.2.

> ‼️ **CORRECTED 2026-09-05 by the independent verification pass.** This section asked the owner to decide
> whether an issued row keeps its currency. **It already does, and §6.2 four pages above says so.** Two
> sections of one audit gave opposite answers about the same behaviour.
>
> **The code, which wins (§0.3):** `CurrencyResolutionExtensions.ResolveStoredCurrency(profile, settings,
> storedCurrency)` returns the **stored** currency and falls back to the business only when the row carries
> none. All three update paths call it — `BookingController.cs:865` (draft), `:1521` (full update) and
> `QuoteController.cs:642`. Only the three CREATE paths still call `ResolvePrimaryCurrency`, which is correct.
>
> **The three tests this row named do not exist.** `UpdateBooking_ReStampsCurrencyFromProviderPrimaryAddress_IgnoringDtoAndExisting`,
> `UpdateDraftBooking_ReStampsCurrencyFromProviderPrimaryAddress` and
> `UpdateQuote_ReStampsCurrencyFromPrimaryAddressCountry_IgnoresDtoCurrency` return **zero** grep hits in either
> repo. What exists is their replacement, asserting the opposite and correct contract:
> `UpdateBooking_KeepsTheRowsOwnCurrency_IgnoringDtoAndPrimaryAddress`,
> `UpdateDraftBooking_KeepsTheRowsOwnCurrency_IgnoringDtoAndPrimaryAddress` and
> `UpdateBooking_RowWithNoCurrency_FallsBackToPrimaryAddress` (`BookingControllerTests.cs:4074, 4106, 4148`).
>
> **So: it was a BUG, the CODE is fixed, and the TESTS were rewritten to the corrected contract. Nothing is
> owed by the owner.** ‼️ **This is the third stale claim in this file** (with §7.2 and §7.4) and they share one
> cause: *sections describing a decision NOT taken were written before the decision was reversed, and never
> re-read.* The same trap P4.5 recorded for the SKILL, repeated inside the audit that recorded it.

**The original text is kept below for the record, and every claim in it is superseded by the note above.**

#### Superseded original

Updating a **Confirmed** booking or an issued quote at a business in another country re-stamps the row's
`price.currency` to the **business's** currency and leaves the amounts exactly as they were. A CAD booking
edited at an India business becomes an INR booking holding Canadian-dollar numbers.

The audit called that a defect. **Three tests name it as the contract:**

- `UpdateBooking_ReStampsCurrencyFromProviderPrimaryAddress_IgnoringDtoAndExisting`
- `UpdateDraftBooking_ReStampsCurrencyFromProviderPrimaryAddress`
- `UpdateQuote_ReStampsCurrencyFromPrimaryAddressCountry_IgnoresDtoCurrency`

"IgnoringDtoAndExisting" is not an accident of naming — it says, in the test's own title, that both the
request's currency and the stored one are to be discarded. I changed the behaviour, those three failed, and
I **reverted my change rather than edit a tested contract** (§0.3). What I did fix is the half that was
incoherent either way: the full-update offer message now quotes the currency the row will be **saved** in, so
the sentence a provider reads and the record that is written cannot disagree inside one request.

**The question for the owner:** should an issued booking or quote keep the currency it was issued in, and the
business stamp only a NEW row? If yes, the three tests change with it. I have not touched them.

### 7.2 ~~The symbol-taking `CurrencyMinorUnit` overloads — named, costed, not taken~~ ‼️ TAKEN. This row was STALE.

> ‼️ **CORRECTED 2026-09-05 by the independent verification pass.** This section said the two overloads were
> *"named, costed, not taken"*. **They are gone.** `CurrencyMinorUnit`'s entire public surface is
> `Exponent · Symbol · Parse · Format(long, CurrencyCode, CultureInfo) · FormatMajor(decimal, CurrencyCode,
> CultureInfo) · ToMajorString · FormatMajorNoSymbol · ToMinor · ToMajor` — **no overload takes a symbol**, and
> the file carries a comment saying there must never be one again. A repo-wide grep finds **zero** callers
> passing one, and `Clinqet.API.UnitTests` compiles and passes 11,668 tests, which it could not do if a
> 4-argument call survived.
>
> **The lesson is P4.5's, repeated:** this row was written *before* the change that invalidated it, in the same
> session, and never re-read. ‼️ **An audit section describing what you decided NOT to do is exactly the kind
> of claim that rots when you later do it.** The `clinqet-business-search` SKILL got this right (§16, "used to
> offer") — only this file was left behind. §7.4 below carried the same stale 4-argument call and is corrected
> with it.

The pair — a currency and a *separately derived* symbol — is now **unrepresentable**, which is the stronger
form of the fix this row proposed and declined. The one site where the two came from **different** rows was a
live defect and is fixed (§6.4, the booking receipt).

### 7.3 ~~`BusinessSearchMoney.Format` joins its money with English words~~ ‼️ FIXED 2026-09-05

`"from"`, `"to"`, `"per hour"` and `"minimum N hours"` were composed in English whatever the reader's
language — so a Gujarati member read *"from ₹500 per hour"* inside a Gujarati answer. The **money** was
already right; the words were a §0.10 gap on a provider-readable string. The file was left alone at the time
because it was untracked and believed to belong to a parallel session; it is committed now and this is closed.

- Five keys — `BusinessSearch_Price_Range` · `_From` · `_PerHour` · `_MinimumHour` · `_MinimumHours` — added to
  **all five** catalogues (3,221 → 3,226, key sets verified identical), following the existing
  `BusinessSearch_*` family and the singular/plural pair convention of `BusinessSearch_Citation_ReviewStar(s)`.
- `Format` now takes `ILocalizationService`; a private `Words` struct resolves each key and applies
  `string.Format` with the **reader's culture**, the same shape `OfferValidationService.Localize` uses. The one
  caller (`SearchServicesTool`) already held `Localization` from `BusinessSearchToolBase`.
- ‼️ **`Enum.IsDefined` added** — an out-of-range numeric currency string used to parse and print a symbol. An
  *in-range* numeric still resolves, deliberately: a stricter local copy would be the second source of truth
  this programme exists to remove.
- **Guarded and sabotage-proven.** `BusinessSearchMoneyWordingTests` (13 assertions, API unit suite per §0.18 —
  the API host runs the Business Search agent). Restoring the literal `$"{…} per hour"` fails
  `EveryConnectorWordComesFromTheCatalogue(hourly)` and `TheRealCatalogueTemplateIsUsedVerbatim`; restored from
  a scratchpad copy, never git (§0.19).

### 7.4 Booking and quote PDFs are pinned to English

`QuestPdfService` sets `language = DocumentLanguage` (`"en"`) at the top of `GenerateBookingPdfAsync` and
`GenerateQuotePdfAsync`. Deliberate, pre-existing, and **on this phase's MUST-NOT list** ("Localize a PDF").
The money inside those PDFs is correct: every amount goes through
`CurrencyMinorUnit.FormatMajor(amount, <the row's currency>, culture)`, so the symbol and the exponent both
follow that currency and no caller can supply a symbol of its own (§7.2).

### 7.5 ~~Two tracked backup files, neither this phase's~~ ‼️ DELETED 2026-09-05 (owner-approved)

`clinqetapi/Clinqet.API.UnitTests/Controllers/Invoice/InvoiceControllerTests.cs.bak` (committed in `ed204aa`)
and `clinqetwebpartnerapp/src/components/onboarding/add-business-information/ManageServicesPrice.jsx.backup`
(committed in `9f2bb97b`). Both pre-dated this phase; the owner ruled delete and both are `git rm`'d.
‼️ **The `.backup` one had begun importing a module that no longer exists** (`import { useCurrency } from
"@/utils/currency"` — deleted by this phase), which is exactly what a stale copy beside live source does:
it reads as code and is not.

### 7.6 ~~`InvoiceDueGroupsView.jsx` is dead code~~ ‼️ DELETED 2026-09-05 (owner-approved)

Nothing imported it except the test written for it — re-confirmed at HEAD, including a search for dynamic and
lazy references and for any replacement view. Both files are gone: `src/components/invoice/InvoiceDueGroupsView.jsx`
and `src/components/invoice/invoiceGroupCurrencies.test.jsx` (§22.2). The web jest count drops by that suite.


---

## 8. ‼️ THE PLAIN STATEMENT §7.5 ASKS FOR

**Is the one-money-definition rule now true across the provider surfaces? — YES, with the two stated
exceptions below, neither of which is a wrong figure on a screen.**

Concretely, and each of these was false when the phase started:

1. **The server no longer ships a glyph.** `DashboardStatisticsDto` and `EarningsGraphResponseDto` carry
   `Currency` (an ISO code); `CurrencySymbol` is deleted from both. A screen can now reach the rule, because
   it holds the currency rather than one rendering of it.
2. **There is one symbol definition per side.** `CurrencyMinorUnit.Symbol` on the server;
   `currencySymbol` in the two app twins. `GetCurrencySymbolAsync` is now *derived from*
   `GetCurrencyCodeAsync` — a second resolution path was a second answer, and it was.
3. **The symbol follows the currency, the grouping follows the reader, the decimals follow the currency's
   exponent.** `LanguageCulture.Resolve` for the grouping, `Exponent(currency)` for the decimals. No `/100`
   and no `:N2` survive on a money path; `.NET`'s `"C"` format, which takes the symbol from the reader's
   culture, is gone and a convention test fails the build if it returns.
4. **The second renderers are deleted, not deprecated** — `clinqetwebpartnerapp/src/utils/currency.jsx` and
   `clinqetmobilepartnerapp/src/Util/currency.tsx`. A missed call site is now a build error rather than a
   screen that renders differently.
5. **No provider surface adds two currencies into one number.** `CurrencyTotals` is the single splitter, the
   four invoice aggregates `GROUP BY c.currency`, and the dashboard, the invoice header, the earnings graph
   and the Ask Clinket totals all lead with the business's own currency and list the rest.
6. **Four guards hold it**, each sabotage-proven RED with valid-but-wrong code and restored from a scratchpad
   copy (never from git, §0.19): the two backend convention tests and the two `moneyFormattingConvention`
   app twins, the latter now scanning by SHAPE after the audit found the old one green on a defect its own
   title described.

**Where it is NOT yet true: ‼️ NOWHERE. Both exceptions this section listed were closed on 2026-09-05.**

- ~~**§7.1, the re-stamp.**~~ ‼️ **Already fixed when this was written** — `ResolveStoredCurrency` keeps an
  issued row's own currency and all three update paths call it; the three tests named as the old contract do
  not exist, and their replacements assert the opposite. See the correction at §7.1.
- ~~**§7.3, `BusinessSearchMoney`.**~~ ‼️ **Fixed 2026-09-05.** The four connector words (`to`, `from`,
  `per hour`, `minimum N hours`) are now `BusinessSearch_Price_*` keys in **all five** catalogues, resolved
  through `ILocalizationService` with the reader's culture, with a singular/plural pair for hours matching the
  existing `BusinessSearch_Citation_ReviewStar(s)` convention. `Enum.IsDefined` now also rejects an
  out-of-range numeric currency string that used to parse and print a symbol. Guarded by
  `BusinessSearchMoneyWordingTests` (13 assertions), **sabotage-proven**: restoring the English literal
  `$"{…} per hour"` fails `EveryConnectorWordComesFromTheCatalogue(hourly)` and
  `TheRealCatalogueTemplateIsUsedVerbatim`, restored from a scratchpad copy (§0.19).

Everything else on the provider surfaces — web and mobile, screen, e-mail, PDF, notification, WhatsApp and
the Ask Clinket answer — renders one amount as one string, and the string is decided by the amount's own
currency and the reader's own grouping.
