# PHASE 4.6 PROMPT — MONEY, EVERYWHERE ELSE

> ‼️ **THIS PHASE FINISHES ONE SENTENCE:** *the same amount of money reads as the same string on every surface
> a person can see.* P4.5 made that true for the backend's notification path, the provider Billing surface and
> twelve provider screens. **An independent sweep then proved it is still false on roughly 250 more call
> sites.** This phase closes them, and only them.
>
> **It runs BEFORE `PHASE-5-PROMPT.md`.** P5 is an audit that builds nothing (owner ruling, 2026-09-04), so
> this debt has nowhere else to go.
>
> **Read first, completely, in this order:**
> 1. `C:\Nik\CLAUDE.md` §0 — the zero-tolerance rules. Every one applies, especially §0.3 (no workaround),
>    §0.10 (no hardcoded user-facing text), §0.14 (no verbose comments), §0.16 (leave the tree clean),
>    §0.19 (never `git checkout`/`restore`/`reset`/`stash`/`clean` in these trees).
> 2. `findings/AUDIT-P4.5-2026-09-04.md` **§3 and §3.1** — the ten money findings already closed and the
>    verified list this phase inherits. §3.1 is the direct parent of this file.
> 3. `CARRIED-TO-P5.md` **§2.4b** — the same debt in the owner's register.
> 4. `.claude/skills/clinqet-business-search/SKILL.md` **§17.2** — the living contract for the money rule.
> 5. `findings/MEASUREMENTS-P4.5-2026-09-04.md` **§CLOSE-OUT** — how the live check was run, so you can
>    repeat it rather than assume.
>
> ‼️ **Never build or test while another session is working in `C:\Nik`.** ‼️ **The owner commits, pushes and
> deploys — you never do.** ‼️ **Leave the tree clean and say what you removed.**

---

## 0. ‼️‼️ THE THREE RULES THAT OVERRIDE EVERYTHING ELSE IN THIS FILE

**These are the owner's, carried verbatim from P4.5 because they are why that phase found what it found.**

### 0.1 ROOT CAUSE ONLY — a patch that makes the symptom go away is a FAILED item

Fix the **class**, never the instance. **Never create a second source of truth.** This phase exists *because*
five separate fixes each removed one copy of a symbol table and none of them removed the ability to make a
sixth. ‼️ **Every guard you rely on must be sabotage-proven RED** — break the fix with **valid code that is
wrong** (an invalid-C# sabotage fails to compile and the test "passes" against a stale DLL), watch the test
fail, then restore **from a scratchpad copy taken seconds earlier**, never through git.

### 0.2 VERIFY AGAINST LIVE DATA — never assume

One specific live check per claim that depends on data. The P4.5 close-out turned a code reading into a fixed
defect by asking Cosmos one question and getting back business `LXDP8G` — an Indian business holding a CAD
invoice. **Reading the code proves the precedence; only the data proves anyone is hurt.**

### 0.3 IF YOU ARE UNSURE, ASK — in plain words, with a recommendation

Explain it simply first, then recommend, so a one-word answer is enough. ‼️ **IF THIS PROMPT AND THE CODE
DISAGREE, THE CODE WINS — say so.** This file was written from a verified sweep on 2026-09-05; line numbers
move, and another session may already have changed a file named here.

---

## 1. THE RULE, PRECISELY

| Part of the string | Follows | Never follows |
|---|---|---|
| **The symbol** (`$`, `₹`, `C$`, `¥`) | the **CURRENCY of the amount** | the reader's locale, the reader's country, the business's address, or a language file |
| **The grouping** (`531,000` vs `5,31,000`) | the **READER's** product locale | the server, `InvariantCulture`, or a region |
| **The decimal places** | the **CURRENCY's own exponent** | a hardcoded `2` |

**Consequences that are not obvious and that this phase must honour:**

- ‼️ **Only two currencies in the platform's twenty-member `CurrencyCode` enum are zero-decimal: JPY and KRW.**
  So `minor / 100` is a **bug**, not a shortcut — a ¥5,000 refund renders ¥50. Use the helpers.
- ‼️ **.NET's `"C"` format and JavaScript's `Intl` `style: "currency"` are BOTH FORBIDDEN for money.** Both take
  the symbol from the culture. The API host calls `UseRequestLocalization`, so `"C"` there follows the HTTP
  request's `Accept-Language`.
- ‼️ **`F2` emits no group separator in ANY culture.** `₹1,25,000` renders `125000.00`.
- ‼️ **`:N2` with no culture uses `CurrentCulture`**, which on a Service Bus worker thread is whatever the host
  happens to be — usually invariant. And it pins two decimals, which is the display twin of `/100`.
- ‼️ **An amount with NO currency on the wire gets NO symbol.** Do not invent one. Both twins' `currencySymbol`
  falls back to `"$"`, so a currency-less amount must not reach it — format the bare number instead. This rule
  already exists in the chat-bid renderer and its comment; **preserve it**.
- ‼️ **PDFs stay ENGLISH** (`QuestPdfService.DocumentLanguage = "en"`) — owner decision, 2026-09-04. A PDF uses
  the same formatter with the English culture. **That is not a localization gap and must not be "fixed".**

---

## 2. THE HELPERS THAT ALREADY EXIST — use them; do not write a sixth table

### Backend — `Clinqet.Shared.Helpers.CurrencyMinorUnit`

```csharp
int    Exponent(CurrencyCode currency)                                   // 0 for JPY/KRW, else 2
string Symbol(CurrencyCode currency)                                     // the currency's own glyph, 20 entries
string Format(long minor,  CurrencyCode c, CultureInfo culture)          // symbol + grouped major
string Format(long minor,  CurrencyCode c, string symbol, CultureInfo)   // when the caller already holds a symbol
string FormatMajor(decimal major, CurrencyCode c, CultureInfo culture)   // ‼️ ADDED IN P4.5 — most Cosmos money
string FormatMajor(decimal major, CurrencyCode c, string symbol, CultureInfo)
string ToMajorString(long minor, CurrencyCode c, CultureInfo culture)    // grouped amount ALONE (code beside it)
long   ToMinor(decimal major, CurrencyCode c)
decimal ToMajor(long minor,  CurrencyCode c)
```

- **The reader's culture comes from `Clinqet.Core.Utilities.LanguageCulture.Resolve(language)`** — en→en-US,
  es→es-US, fr→fr-CA, gu→gu-IN, hi→hi-IN, unknown→en-US. ‼️ **Never `CultureInfo.CurrentCulture`.**
- **Admin-facing alerts keep `CultureInfo.InvariantCulture`** — §3.6 says operator wording is English.
- **`ICurrencyService.GetCurrencySymbolAsync(businessId, currencyCode, ct)`** answers a *different* question:
  "what does this business bill in". ‼️ **The row's own `currencyCode` WINS**; the business is resolved only
  when a row carries none. Fixed in P4.5 — do not reverse it.

### Provider web — `clinqetwebpartnerapp/src/utils/currencyMinorUnit.js`

```js
currencyExponent(code)                    currencySymbol(code)          minorToMajor(minor, code)
formatMinor(intl, minor, code)            formatMajor(intl, amount, code, { maximumFractionDigits })
```

### Provider mobile — `clinqetmobilepartnerapp/src/Util/currencyMinorUnit.ts`

Same five, without the `intl` argument — it reads the product locale from i18next internally:

```ts
currencyExponent(code)                    currencySymbol(code)          minorToMajor(minor, code)
formatMinor(minor, code)                  formatMajor(amount, code, { maximumFractionDigits })
```

‼️ **The twins are asserted against the backend** by `Clinqet.API.UnitTests/Services/CurrencyMinorUnitTests`:
`ClientTwin_ListsTheSameZeroDecimalCurrencies`, `MobileTwin_ListsTheSameZeroDecimalCurrencies` and
`BothTwins_WriteTheSameSymbolForEveryCurrency`. They **skip loudly** when a partner app is not checked out
beside the API repo (§0.17 rule 5) — **Skipped in CI, never Passed.** If you add a currency, all three move
together or the build tells you.

---

## 3. ‼️ THE INVENTORY — verified by hand on 2026-09-05

> Counts are `grep` counts of call sites, taken on 2026-09-05. **Re-run the greps before you start** — another
> session may have moved something, and §0.3 says the code wins.

### 3.1 PROVIDER MOBILE — the second live renderer. **THE BIGGEST ITEM. DO THIS FIRST.**

**`clinqetmobilepartnerapp/src/Util/currency.tsx` is a complete second money renderer**, exporting
`formatPrice`, `formatLocalizedNumber` and `formatCurrencyAmount`. **162 call sites across 27 files.**

‼️ **Why it is wrong:** all three format through `getActiveLocale()`, which is **region-aware** —
`src/services/regionService.ts:22` sets `const DEFAULT_REGION: Region = 'in'`, so an **English** reader
resolves to `en-IN` and sees `5,31,000.00` where the backend, the web app and an Ask Clinket answer all say
`531,000.00`. The money twin deliberately uses a `MONEY_LOCALE` map instead, and **its header comment names
this exact helper as the bug it was created to replace.**

‼️ **The proof that it is live, in one file:** `src/Screen/ProfileFlow/Booking/bookingDetails.tsx` imports
**both** renderers (lines 5 and 6). The payout rows use `formatMinor` → `₹531,000.00`; the price breakdown
uses `{currencySymbol}{formatPrice(…)}` → `₹5,31,000.00`. **One screen, one currency, two strings.**

**The 27 files:**

```
Screen/completeProfileFlow/ManageService/index.tsx
Screen/exploreTab/ExploreScreen/index.tsx
Screen/exploreTab/SendQuotePage/index.tsx
Screen/exploreTab/ServiceDetails/index.tsx
Screen/homeTab/MyDashboardScreen/index.tsx
Screen/homeTab/MyDashboardScreen/ServicesList.tsx
Screen/homeTab/MyDashboardScreen/YourEarnings.tsx
Screen/ProfileFlow/ApprovedDetails/index.tsx
Screen/ProfileFlow/Booking/addBookingScreen/components/BookingSummarySection.tsx
Screen/ProfileFlow/Booking/addBookingScreen/components/ServiceFormCard.tsx
Screen/ProfileFlow/Booking/bookingCard.tsx
Screen/ProfileFlow/Booking/bookingDetails.tsx          ← imports BOTH renderers
Screen/ProfileFlow/Invoices/components/InvoiceFormContent.tsx
Screen/ProfileFlow/Invoices/components/InvoicePreview.tsx
Screen/ProfileFlow/Invoices/components/InvoiceSummaryCards.tsx
Screen/ProfileFlow/Invoices/InvoiceDetailScreen/index.tsx
Screen/ProfileFlow/Invoices/InvoicesScreen/index.tsx
Screen/ProfileFlow/Knowledge/KnowledgeServiceDraftsSection.tsx
Screen/ProfileFlow/Offers/index.tsx
Screen/ProfileFlow/PastDetails/index.tsx
Screen/ProfileFlow/PendingDetails/index.tsx
Screen/ProfileFlow/PlanAndBilling/index.tsx            ← also /100 (see 3.2)
Screen/ProfileFlow/Quotes/addQuoteScreen/components/ChargesSection.tsx
Screen/ProfileFlow/Quotes/addQuoteScreen/components/ServiceFormCard.tsx
Screen/ProfileFlow/Quotes/index.tsx
Screen/ProfileFlow/Quotes/QuotesDetails.tsx
Screen/ProfileFlow/Quotes/ServicesList.tsx
```

**How to fix it, and the trap in doing so:**

1. ‼️ **`formatPrice` is NOT always money.** Read every call site. Where it formats a **quantity, a rating, a
   distance or a percentage**, it is correct as it is — converting those to `formatMajor` would stamp a
   currency symbol on a number that has none. **Classify every one of the 162 before changing any.**
2. For each site that IS money, find the amount's **currency** — it is almost always already on the DTO
   (`Price.Currency`, `invoice.currency`, `quote.Price.Currency`). ‼️ **If the currency genuinely is not on
   the wire, STOP and ask** — do not fall back to the business symbol to make the edit possible. That is the
   defect this phase is removing.
3. Replace `{currencySymbol}{formatPrice(x)}` with `formatMajor(x, currency)` and `{currencySymbol}{formatPrice(minor/100)}`
   with `formatMinor(minor, currency)`.
4. **When a file has no money left, delete its `useCurrency`/`formatPrice` import.** §22.2.
5. ‼️ **When `currency.tsx` has no money callers left, decide deliberately what remains.** If
   `formatLocalizedNumber` still has honest non-money callers, keep it and **rewrite its doc comment to say it
   is NOT for money**. If nothing is left, delete the file. **Do not leave a money-shaped helper alive with a
   comment nobody reads.**

### 3.2 PROVIDER MOBILE — Plan & Billing, three defects in two lines

`clinqetmobilepartnerapp/src/Screen/ProfileFlow/PlanAndBilling/index.tsx:160-170`:

```ts
const money = (minor) => `${currencySymbol}${formatPrice((minor || 0) / 100)}`;
const moneyMonthlyEq = (annualMinor) => { const major = Math.round(annualMinor / 12) / 100; … };
```

Rendered at lines ~507, 522, 526, 533, 541, 545. **Three defects at once:** unconditional `/100`; symbol from
the *business* rather than the plan; two decimals pinned. ‼️ **`ProviderPlanSummary.currency` is on the wire
and the file contains ZERO references to it.** The web twin (`src/components/billing/Billing.jsx`) already
does this correctly via `formatMoney(intl, minor, quote.currency)` at 11 sites — **match it, including
`formatMonthlyEquivalent`'s rounding.**

### 3.3 PROVIDER MOBILE — Payment Settings

`clinqetmobilepartnerapp/src/Screen/ProfileFlow/PaymentSettings/index.tsx:89,91` uses
`` `${currencySymbol}${(…).toFixed(2)}` ``. `toFixed` never groups and never follows the reader — measured, web
renders `$100,00` for a French provider where mobile renders `$100.00`. The web counterpart
(`src/components/Profile/PaymentSettings.jsx:108`) is the exemplar.

### 3.4 PROVIDER WEB — the symbol comes from the business, not the row

**`clinqetwebpartnerapp/src/utils/currency.jsx`'s `formatPrice`: 44 call sites across 19 files.** Grouping is
already correct here (it goes through the shared `intl`), so this is a **symbol-source + exponent** problem,
not a grouping split — a smaller job than mobile, with the same method.

```
app/dashboard/explore/exploreDetails/page.jsx      components/invoice/InvoiceDetail.jsx
app/public/track-bookings/page.js                  components/invoice/InvoiceForm.jsx
components/booking/Booking.jsx                     components/invoice/InvoiceLineItems.jsx
components/booking/BookingCard.jsx                 components/invoice/InvoicePreview.jsx
components/booking/BookingsDetails.jsx             components/invoice/InvoiceSummaryCards.jsx
components/booking/sections/BookingCostSummary.jsx components/Profile/knowledge/KnowledgeServiceDraftsSection.jsx
components/dashboard/home/ServicesList.jsx         components/Profile/PaymentSettings.jsx
components/quotes/components/ExtraChargesSection.jsx
components/quotes/QuoteCard.jsx    components/quotes/Quotes.jsx    components/quotes/QuotesDetails.jsx
lib/chart/WeeklyChart.jsx
```

‼️ **`WeeklyChart.jsx` is an axis, not a row** — a chart tick may legitimately want a short form. Decide it
deliberately and say which you chose and why; do not silently make an axis verbose.

### 3.5 BACKEND — 51 money sites in 12 files

| Repo | File | Sites | What is wrong |
|---|---|---|---|
| `clinqetinfrastructure` | `Services/Documents/QuestPdfService.cs` | **21** | `$"{currencySymbol}{amount:N2}"` with **no culture**. ‼️ `:1033` in the SAME file is the correct exemplar (`CurrencyMinorUnit.Format(minor, tx.Currency, currencySymbol, culture)`), and `:1271` renders a quantity as `ToString("N0", culture)` one line above `:1272` which drops it. **PDFs stay English — pass the English culture, do not localize the document.** |
| `clinqetinfrastructure` | `Services/Communication/DocumentDeliveryService.cs` | 2 | `:N2` — culture and symbol are right, the **exponent is pinned at 2** |
| `clinqetinfrastructure` | `Services/Documents/InvoiceLineDiscountFormatter.cs` | 1 | `:N2` — exponent pinned |
| `clinqetinfrastructure` | `Services/OfferValidationService.cs` | **2** | `$"…minimum value of {offer.MinValue.Value:F2}…"` — **no symbol, no grouping, and HARDCODED ENGLISH** that reaches the provider UI through `BookingController.cs:616` / `QuoteController.cs:406` → `ModelState.AddModelError`. ‼️ **This is also a §0.10 breach** and needs a localization key in all five catalogues |
| `clinqetinfrastructure` | `Services/Broadcast/BroadcastProviderService.cs` | 1 | `ToString("F2")` — **no group separator in any culture** |
| `clinqetfuncations` | `Functions/InvoiceEmailProcessor.cs` | **12** | `:N2` — exponent pinned |
| `clinqetfuncations` | `Functions/BookingEmailProcessor.cs` | 6 | `:N2` — exponent pinned |
| `clinqetfuncations` | `Functions/CartReminderProcessorFunction.cs` | **2** | `$"{providerCurrency} {item.SubTotal:F2}"` — prints the raw currency **CODE**, `F2` (never grouped), and a **hardcoded English `"Total:"`**. ‼️ `BuildCartItemsHtml` is `static` with **no language parameter, so it cannot honour the reader** — the signature has to change |
| `clinqetfuncations` | `Functions/QuoteEmailProcessor.cs` | 1 | `:N2` at `:262` while `culture` is resolved two lines above and used for the dates |
| `clinqetfuncations` | `Functions/ProviderConfirmationProcessor.cs` | 1 | `:N2` — P4.5 fixed this file's SYMBOL; the exponent is still pinned |
| `clinqetfuncations` | `Services/EmailAdditionalCharges.cs` | 1 | `:N2` — exponent pinned |
| `clinqetfuncations` | `Functions/BroadcastStatusUpdateFunction.cs` | 1 | `ToString("F2")` — a bid reads `125000.00 INR` in `BroadcastBidReceived/Awarded/BidUpdated.html` |

### 3.6 ‼️‼️ NOT MONEY — DO NOT TOUCH ANY OF THESE

**These match the same greps and are CORRECT as they are.** Changing one is a regression, and two of them
would break a live query. This list exists so "fix every `:N2`" cannot be executed blindly.

| File | What it actually formats | Why it must not change |
|---|---|---|
| `SearchFilterExpressionBuilder.cs` (6) · `ProviderSearchFilterBuilder.cs` (6) · `ProviderCatalogSearchService.cs` (4) · `BroadcastFilterBuilder.cs` (2) | **OData filter expressions** with `InvariantCulture` | A grouped or localized number is **not valid OData** — this would break search |
| `AzureSearchQuery.cs` (6) · `QueryUnderstandingService.cs` (3) · `BroadcastMatchingService.cs` (2) · `BroadcastClassificationService.cs` (4) | **log messages** — scores, ratios, coherence | Not money, and operator-facing |
| `RecommendationCacheService.cs` (2) · `SmartAnalyticsAggregationService.cs` (1) | **cache keys and geo coordinates** (`F2`/`F6` lat-lng) | Changing the format changes the cache key and the geo query |
| `McpService.cs:1729` | a **signature/hash** string | Must stay byte-stable or dedup breaks |
| `DocumentIntelligenceService.cs:1036,1039` | a **model-facing AI prompt** listing service prices | ‼️ Money-shaped, but changing an AI prompt needs a **live measurement** (`PLAN` §15c: a drafted instruction measured 3/25). **Out of scope. Do not touch.** |
| `VoiceAssistantPromo` (both apps) — `isIndia ? "₹" : "$"` | **illustrative example prices with no currency** | With no currency, the business is the correct source |
| `KnowledgePriceMarks.cs` · `CountryResolutionService.cs` | **parsers**, not renderers | They read money, they do not write it |
| `money.js:13` (web) | the documented **currency-less** branch | It emits no symbol — that is the rule, not a violation |
| Every other `/100` in both apps | basis points, percentages, tax rates, SVG stroke offsets, file sizes | Verified individually |

### 3.7 One deletion the owner owes a yes or no — **ASK, do not act**

`clinqetwebpartnerapp/src/components/booking/ServiceAccordion.jsx` **and**
`clinqetwebpartnerapp/src/components/quotes/ServiceAccordion.jsx` both hardcode `` `$${srv.price}` ``. Both are
**completely unreferenced** — git-tracked with **zero importers anywhere in the repo**. §22.2 says delete dead
code; they are tracked files, so **the owner decides**. Present both paths and wait.

---

## 4. ‼️ THE GUARDS — because 2,886 web and 3,801 mobile tests were green with the defect live

**That is the single most important fact in this file.** Not one of the twelve screens P4.5 fixed had a test
pinning the string it rendered. **Assertions per site are not the answer; scans are.**

**Guards that already exist — extend them, do not duplicate them:**

| Guard | Repo | Covers |
|---|---|---|
| `src/utils/moneyFormattingConvention.test.js` | web | any `style: "currency"` in code, comments ignored |
| `__tests__/moneyFormattingConvention.test.ts` | mobile | the same |
| `Conventions/MoneyNeverFormattedFromTheReadersCultureTests.cs` | API | `ToString("C")` / `{0:C}` anywhere in the API repo, plus `FormatMajor`'s behaviour |
| `Services/CurrencyMinorUnitTests.cs` | API | both twins' zero-decimal list **and** every symbol; skips loudly when an app is absent |

**Guards this phase MUST ADD:**

1. ‼️ **A `:N2` / `F2` money-format scan for `clinqetfuncations` and, separately, one that covers
   `clinqetinfrastructure`.** It must carry an **explicit exemption registry naming every entry in §3.6 with
   its reason** — a scan with no exemptions will be silenced by whoever hits it next, and then it protects
   nothing. ‼️ **Put each host's copy in its own repo with its own registry** (§0.15): a source-scanning
   convention test belongs to the repo whose source it scans, and `clinqetinfrastructure` is a **library every
   host compiles in**, so scanning it from a host suite is correct and needs no checkout.
2. ‼️ **A guard that `currency.tsx`'s money helpers have no money callers left** — or, if the file is deleted,
   that nothing imports it. Without this the next screen will reach for it again.
3. **A rendering test per app** that mounts one real screen with a **non-USD, non-local** currency and asserts
   the exact string. One is enough per app; the scans do the breadth.

**Every guard must:**

- ‼️ **Assert that its scan actually read files** (`expect(files.length).toBeGreaterThan(N)`). *Green must mean
  "I checked", never "I could not look."* A guard that matches nothing does not merely fail to catch bugs —
  **it invents confidence.**
- ‼️ **Skip LOUDLY, never silently pass**, if it reads a peer repo — and remember `describe.skip` **still
  executes its callback body**, so every peer read belongs **inside an `it()`** (§0.17).
- ‼️ **Be sabotage-proven.** Reintroduce the defect, watch the named test fail, restore from a **scratchpad
  copy**. Record which test failed, by name, in the audit.

---

## 5. ORDER OF WORK — most dangerous first, so the hard thing is not done tired

1. **§3.1 mobile second renderer** — the biggest and the only one that makes one screen self-contradict.
2. **§3.2 + §3.3 mobile Plan & Billing and Payment Settings** — small, and both are pure defects.
3. **§3.5 backend** — start with `OfferValidationService` and `CartReminderProcessorFunction`, because those
   two are **also §0.10 localization breaches** and need catalogue keys in all five languages.
4. **`QuestPdfService`'s 21 sites** — mechanical once `:1033`'s exemplar is understood.
5. **§3.4 provider web** — smallest real risk, because grouping is already right.
6. **§4 guards** — ‼️ **write each guard BEFORE its fix where you can**, so you watch it go red for the right
   reason rather than trusting it after the fact.

---

## 5b. ‼️‼️ THE MULTI-DIMENSIONAL AUDIT OF THIS PHASE'S OWN DIFF — NOT OPTIONAL

‼️ **A phase that fixes ~250 money sites and does not audit itself has not finished; it has stopped.**
P4.5 shipped five money fixes, called the work done, and its own audit then found a sixth defect — and a
closing sweep found twelve more screens after that. **The fix pass and the audit pass find different things,
and this phase touches money on more surfaces than any phase before it.**

**Run independent agents per dimension, then a SKEPTIC pass that tries to REFUTE the highest-consequence
claims.** At minimum these dimensions, each answered with evidence rather than assertion:

| # | Dimension | The question it must actually answer |
|---|---|---|
| 1 | **Correctness and contracts** | Does every changed site still render the right amount — not just the right symbol? ‼️ **A minor/major mix-up is silent:** `formatMinor` on a major-unit value renders ₹5.31 for ₹531,000, and no test that only checks the symbol will see it |
| 2 | **Classification** | ‼️ **Was any NON-money number given a currency symbol?** This is the defect this phase is most likely to introduce. Re-derive the money/not-money split independently of the pass that made it |
| 3 | **§3.6 untouched** | Prove by `git status --porcelain` that no OData filter, log line, cache key, geo coordinate or AI prompt changed |
| 4 | **Localization ×5** | Every new string is a key in all five catalogues with identical key sets; no hardcoded English reached a provider (§0.10). `OfferValidationService` and the cart e-mail are the two that need new keys |
| 5 | **Tests and VACUITY** | ‼️ Does each new guard FAIL when the defect returns? Does each assert its scan read files? Is any assertion comparing a constant to itself? P4.5 found nine tests that could not fail, and two were written in that same session |
| 6 | **Dead code and orphans** | Imports left behind, helpers with no callers, a `currency.tsx` still alive with money-shaped exports (§22.2) |
| 7 | **Cost, performance, thread safety** | A per-row `GetCurrencySymbolAsync` in a loop is an address lookup per row. The row's own currency needs no I/O — check none was added |
| 8 | **Did we miss anything** | Re-run every grep in §3 from scratch and reconcile against the counts recorded. ‼️ **A count that does not reconcile is a finding** |
| 9 | **Defects in code no phase touched** | The sweep that produced §3 was one agent asking one question. Ask it again, differently |

‼️ **AND VERIFY AGAINST LIVE DATA, not fixtures.** Repeat the P4.5 close-out check
(`findings/MEASUREMENTS-P4.5-2026-09-04.md` §CLOSE-OUT): query both regions for the currencies live rows
actually carry, and confirm the fixed surfaces render correctly for **a business whose row currency differs
from its country** — `LXDP8G` (India, holding a CAD invoice and a CAD booking) is the known live case.
‼️ **A fixture proves your code does what you wrote; only live data proves it does what the provider sees.**

**Every finding is FIXED, REFUTED WITH EVIDENCE, or NAMED AS AN ACCEPTED RESIDUAL. Nothing is "noted".**
‼️ **Do not report complete while an audit agent is still running** — and when one returns after a long run,
**re-read the file before believing it**: in P4.5 a two-hour agent reported a defect that had already been
fixed, citing line numbers that had moved.

---

## 6. WHAT THIS PHASE MUST NOT DO

- ‼️ **Touch anything in §3.6.** Two of those would break a live search query and one would change an AI prompt
  that needs a measurement.
- ‼️ **Localize a PDF.** English is the owner's decision (2026-09-04).
- ‼️ **Invent a currency.** If an amount has no currency on the wire, format the bare number and **ask**.
- ‼️ **Add a feature flag or keep an old path.** Pre-prod: everything goes live directly, and a failed gate is a
  design fix, never a switch.
- ‼️ **Change a Cosmos or SQL schema.** If you believe a currency must be added to an entity, that is §0.7 —
  **STOP and ask with the full table.** Every currency this phase needs is already on the wire; if you find one
  that is not, that finding is the deliverable, not a migration.
- ‼️ **Touch the customer app, the admin app or the customer mobile app.** They keep their own (correct, wider
  ISO) zero-decimal lists and are out of scope — `CARRIED-TO-P5.md` §2.4 residual 9 records them. **If you want
  them in scope, ask.**
- **Change `sameAudience` / `ALWAYS_FINDS`, `role.alwaysHasFullAccess`, `MaxImagesPerDocument` (15 and 40 are
  two different settings, both correct), the card date format, or C3's customer subtitle.**
- ‼️ **Raise the Functions repo's `local.settings.json` credentials.** The owner ruled it a **sandbox and not an
  issue** on 2026-09-04. Not a finding, not a deploy step, not mentioned again.

---

## 7. DEFINITION OF DONE — seven things, and "mostly" is a failed phase

0. ‼️ **§0's three rules were followed** — every fix is a ROOT fix with its class named; at least one check ran
   against **live data**; every question that needed the owner was asked in plain words with a recommendation.
1. **Every site in §3.1–§3.5 is either fixed or explicitly classified as not-money, with the classification
   recorded.** ‼️ **A count that does not reconcile is a failed phase:** state, per section, how many sites
   were found, how many were money, how many were changed, and how many were classified out — and make the
   arithmetic add up in the audit.
2. **Nothing in §3.6 changed.** Prove it: `git status --porcelain` shows none of those files.
3. **The guards of §4 exist, each asserts its scan read files, each skips loudly if it reads a peer repo, and
   each is sabotage-proven with the failing test named.**
4. **Real green runs, taken AFTER the last change, with the numbers pasted:** `Clinqet.API.UnitTests` ·
   `Clinqet.API.IntegrationTests` · `Clinqet.Communications.UnitTests` · `Clinqet.Communications.IntegrationTests`
   (the integration pair against **real** SQL + the Cosmos emulator, never a fake) · **both** provider app
   suites in full · ESLint **0 errors** · `tsc --noEmit` clean. ‼️ **Check whether another session moved the
   tree since your run** — a green run you cannot argue postdates every change is not evidence.
   *P4.5's closing baseline, for comparison:* API unit **11,618** · API integration **2,038** · Functions unit
   **3,862** · Functions integration **547** · web **2,888** in 209 suites · mobile **3,803** in 227 suites.
4b. ‼️ **THE MULTI-DIMENSIONAL AUDIT OF §5b WAS RUN IN FULL** — independent agents per dimension, then
   skeptics, **and at least one pass against REAL LIVE DATA, not a fixture.** Every finding fixed, refuted
   with evidence, or named as an accepted residual. ‼️ **Nothing is "noted", and nothing is reported complete
   while an agent is still running.**
5. **`findings/AUDIT-P4.6-<date>.md`** — the reconciliation table from item 1, the sabotage evidence by test
   name, every accepted residual, and ‼️ **a plain statement of whether the one-money-definition rule is NOW
   true across the provider surfaces.** If it is not, say which surfaces and why, in the same file.
6. **SKILL ×4 byte-identical** (`.claude/`, `.github/`, `.agents/` + the `.cursor/*.mdc` whose body must equal
   `SKILL.md`) — update **§17.2**, and ‼️ **re-read §16 for anything this phase CONTRADICTS.** P4.5's own audit
   found four skill claims that were false the moment the fix landed, including one telling the reader to call
   a method that had been deleted. **A phase that changes behaviour must re-read the sections describing the
   OLD behaviour, not only add a new one.** Then a memory entry + a one-line `MEMORY.md` pointer.
7. **The tree is clean and you say what you removed** (§0.16), `CARRIED-TO-P5.md` §2.4b is struck through or
   rewritten to whatever genuinely remains, and **nothing is committed and nothing is pushed.**

> ‼️ **If you finish and the rule is still not true, that is a legitimate outcome — but it must be STATED, with
> the exact remaining surfaces, in `AUDIT-P4.6`. What is not legitimate is a phase that reports done because it
> ran out of appetite.** This whole debt exists because a sweep scoped to the surfaces a phase touched was
> called "one string on every surface a person reads" three separate times.
