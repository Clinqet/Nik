# AUDIT — PHASE 4.5, 2026-09-04

The close-out fix phase. Four independent agents audited this phase's diff — correctness & contracts, the
money change, tests & vacuity, and config/copy/hygiene — then every finding was fixed, refuted with evidence,
or named as an accepted residual below.

> ‼️ **THE MOST IMPORTANT RESULT OF THE DAY: the audit caught a SECURITY REGRESSION I had just introduced.**
> My first cut of the duplicate-upload merge copied the incoming row's audience and caller switch onto the
> survivor. But a confirmed upload **cannot tell a provider's choice from a server default** — the confirm DTO
> carries no audience at all, an omitted caller switch reads `true`, an omitted type reads `Other`, and the
> upload modal always sends an empty link list. So the fix for "a merge discards the provider's choices" would
> have **WIDENED a restricted document to the whole team and made a private file sendable to phone callers
> again**, while telling the provider "your latest choices were saved". Section 1 below.

---

## 0. WHAT WAS BUILT

| § | Item | State |
|---|---|---|
| 1 | The duplicate-upload data loss — alone and first | **Shipped**, and then corrected by the audit (§1 below) |
| 2 | ONE money renderer: symbol from the currency, grouping from the reader, per recipient | **Shipped** |
| 3 | Item #10's ROOT fix — the rule owns the parse, the entity holds the raw string, the converter DELETED | **Shipped** |
| 4 | The batch of eight | **Shipped** |
| 5 | Both measurements, each ending in a number | **`findings/MEASUREMENTS-P4.5-2026-09-04.md`** |
| 6 | The four residuals put back in scope | **Shipped** |

**No SQL table, column or index. No Cosmos container, partition key, field, IncludedPath or TTL. No search
index field.** §0.7 did not fire. §3's entity change is a C# TYPE change on the same JSON property with the
same stored values — no migration, no backfill; the alternative `searchAudienceRaw` field was rejected for
exactly that reason.

---

## GREEN RUNS — all taken AFTER the last fix

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | **11,609 passed · 0 failed · 0 skipped** |
| `Clinqet.Communications.UnitTests` | **3,861 passed · 0 failed · 0 skipped** |
| `Clinqet.Communications.IntegrationTests` (real SQL + Cosmos emulator + Azurite) | **547 passed · 0 failed · 0 skipped** |
| `Clinqet.API.IntegrationTests` (real SQL + Cosmos emulator + Azurite) | **2,038 passed · 0 failed · 0 skipped** |
| `clinqetwebpartnerapp` jest | **2,888 passed · 209 suites · 0 failed** |
| `clinqetmobilepartnerapp` jest | **3,803 passed · 227 suites · 0 failed** |
| `clinqetmobilepartnerapp` `tsc --noEmit` | **clean** |
| ESLint on every changed web and mobile file | **0 errors** |

‼️ **What "AFTER the last fix" is worth here, precisely.** The two integration runs and the API unit run
predate two later changes, so say what covers them rather than imply a rerun that did not happen:

- The **app-only money sweep** (twelve screens) touches no .NET file. The one backend test that reads those
  app files is `CurrencyMinorUnitTests` — **re-run afterwards, 32 passed**.
- The **last guard** (`KnowledgeDuplicateReasonKeyCatalogueTests`) is a new test file with no production
  change; the Functions unit suite was re-run in full for it (**3,861**), and it cannot affect either
  integration suite.

A green run you cannot argue postdates every change is not evidence — so this is the argument, not a claim.

---

## 1. ‼️ THE FINDING THAT MATTERED MOST — my own fix widened access

**`KnowledgeIngestProcessorFunction.ApplyProviderChoices`.** RULING 3 says *the newest **explicit** choices
win*, and the word **explicit** turned out to be the whole rule.

A freshly confirmed upload row always carries:

| Field | What `ConfirmOneAsync` writes when the client says nothing |
|---|---|
| `searchAudience` | `"Team"` — the class initializer. **The confirm DTO has no audience field at all.** |
| `shareWithCallers` | `file.ShareWithCallers ?? true` — **true** |
| `docType` | `file.DocType ?? Other` |
| `linkedServiceIds` | `[]` — and the upload modal always sends it |

Copying those onto the survivor would have: widened a role-restricted document to the whole team; re-enabled
caller sending on a file the provider had marked private; stripped a price list's offering links off its
**cards** (`linkedServiceIds` on the card is what `search_knowledge` narrows by, so the link would simply
stop working); and retyped a `PriceList` as `Other`.

**Fixed: A MERGE NEVER WIDENS.** Only a value that cannot be a default crosses over — `Roles` (not `Team`),
`shareWithCallers = false` (not `true`), a non-empty link list, a type other than `Other`. A provider who
genuinely wants to widen the survivor changes it on the surviving document, where the change is deliberate
and visible. Two unit tests pin both directions, and the emulator test pins the tightening end to end.

**Second half of the same finding:** `newRow` was read at the top of `ProcessAsync`, **before** the blob
download and the SHA-256 — minutes earlier for a large file — while `SetSearchAudienceAsync` deliberately
ACCEPTS a Processing row. A provider who restricted the file mid-upload had their choice in Cosmos and not in
that snapshot. **The incoming row is now re-read** immediately before its choices are taken, with a test.

---

## 2. THE OTHER CORRECTNESS FINDINGS, ALL FIXED

1. ‼️ **The merge notice was deleted by the very re-cut the merge asked for.** On `RequiresReingest` the
   survivor goes back on the `MetadataOnly` lane, and `BeginRecutAsync` nulls `FailureReasonKey` — so exactly
   when the provider most needed to be told, they were not. **Root fix: a re-cut clears a FAILURE, never a
   NOTICE.** `ClearedFailureReason` preserves the `Info_` family at all four clearing sites.
2. ‼️ **`ToDto` told the screen the OPPOSITE of what the server enforces for a blank value.** `Decide` reads
   absent/blank as "everyone on the team"; the DTO's own ternary fell through to `Roles` with an empty list,
   i.e. "only the owner and administrators" — about a document every member can find. **Measured: all 54 live
   rows carry no value at all**, so this was the branch governing the entire live library. Fixed.
3. **The visibility task could fault unobserved.** Removing the `OperationCanceledException` swallow made the
   detached read able to complete faulted; awaiting the embeddings first would drop that fault whenever an
   embedding threw. Both are now awaited by one `Task.WhenAll`, which observes every one.
4. **`ApplyProviderChoices` overwrites a survivor's existing `Error_KnowledgeDuplicateOfAnotherDocument`.**
   Accepted: the merge is the newer event and its notice is the accurate one; the older message ("upload a
   different file") is stale the moment the merge succeeds.
5. **A redelivery after a committed merge can queue a second re-cut.** Accepted: the id is state-derived and
   `UpdatedAt` moved, so duplicate detection cannot collapse it. Idempotent, costs one re-cut, named in
   `CARRIED-TO-P5.md`.

**Refuted with evidence:** the new `SearchCustomersByNameAsync` was checked against the in-memory filter it
replaces for absent `firstName`, absent `lastName`, a needle spanning the space, casing and the type filter —
identical, and now proven on the **real emulator** rather than argued. `Decide`'s truth table matches the old
`IsVisible` for every recognised value. No caller of the deleted converter survives anywhere. Every new query
passes a partition key.

---

## 3. ‼️ THE MONEY FINDINGS — SEVENTEEN surfaces still disagreed after my first cut

The stated intent was "one string on every surface a person reads". The audit found it was not yet true —
and then found it again, twice more, after each fix was called done. ‼️ **The heading of this section said FIVE
for most of the session. Counting what you have fixed is not the same as counting what is broken.**

| # | What | Fixed |
|---|---|---|
| 1 | **Two receipt e-mails still divided by 100 unconditionally** (`BillingReceiptEmailProcessor`) — the provider's subscription receipt and the customer's booking receipt. In a file this change had already edited | ✔ |
| 2 | ‼️ **A SECOND BACKEND SYMBOL MAP** in `ProviderBillingController` with `CAD => "$"`, so a Canadian provider's **downloaded** receipt said `$390.00` while every other surface said `C$390.00` | ✔ delegates to the shared table |
| 3 | ‼️ **A THIRD, DATA-DRIVEN SYMBOL SOURCE.** The seeded country row carries its own `currencySymbol` — Canada's says **`CA$`** — and `GetCurrencySymbolAsync` returned it *before* ever reaching the code map. Four different strings for one CAD amount | ✔ the country tells us the CODE; the shared table writes it. `CountryResolution.CurrencySymbol` deleted as orphaned |
| 4 | ‼️ **`formatMoney` — the whole provider Billing surface — still took its symbol from the READER** (`CA$` in English, `$CA` in French, `US$` in Gujarati) and dropped the decimals on a whole amount, so Billing said `CA$390` about the charge whose reminder said `C$390.00` | ✔ |
| 5 | ‼️ **The mobile twin formatted with the REGION-aware locale** (`en` → `en-IN`), so an English-reading Indian provider saw `₹5,31,000.00` on the phone and `₹531,000.00` everywhere else — contradicting the twin's own header comment | ✔ the language's product locale, matching the server |
| 6 | ‼️ **A FOURTH SYMBOL SOURCE, AND IT WAS THE ADDRESS.** After fixing which TABLE `GetCurrencySymbolAsync` reads, it still resolved the **business** before the row and treated the row's own currency as a mere fallback — so a CAD invoice held by an Indian business printed **₹**. ‼️ **LIVE, not latent:** business `LXDP8G` (India/Gujarat) holds invoice `INV2608010301` in CAD and a CAD booking, and 11 call sites read this method | ✔ the ROW's currency wins; the business is resolved only when a row carries none |
| 7 | ‼️ **TWELVE MORE PROVIDER SCREENS still took the symbol from the READER** — `Intl`'s `style: "currency"` writes `CA$` in English, `$CA` in French and `US$` in Gujarati for one CAD amount. **Web (7):** `dashboard/inbox`, `dashboard/leads`, `dashboard/leads/[id]`, `public/track-bookings`, `InsightsView.jsx`, and `BookingsDetails.jsx` **twice** (payment amount + payout amount). **Mobile (5):** `InboxTab/ChatDetails`, `ProfileFlow/Booking/bookingDetails`, `ProfileFlow/Broadcast/BroadcastDetails`, `ProfileFlow/Broadcast/index`, `ProfileFlow/Insights`. ‼️ **Two of them also divided by 100 unconditionally** (`BookingsDetails.jsx` and mobile `bookingDetails.tsx`) — the identical zero-decimal defect that made a ¥5,000 refund read ¥50, the one this phase set out to kill | ✔ all twelve route through the client twins. A new `formatMajor(intl, amount, code, { maximumFractionDigits })` sits beside `formatMinor` in both twins; the override changes the decimal places where a screen deliberately rounds (Insights), never which symbol is written. The chat bid's rule is PRESERVED — with no currency on the payload, format the number alone rather than invent whose money it is |

‼️ **Row 6 was found LAST, in the close-out sweep, and it is the most instructive one here.** Rows 1–5 were all
"a second copy of the symbol table"; the audit fixed each copy and declared the money work done. Row 6 is the
same defect in a different shape — not a second TABLE but a second *authority* deciding which currency an
amount is in — and it survived precisely because the earlier fixes made the code LOOK right: the method now
carried a comment saying "the symbol comes from the currency, never the country row" while still asking the
country first. ‼️ **A comment that states an invariant is a claim no build checks.** The test that should have
caught it was mine and was VACUOUS: it stubbed the resolver to Canada AND passed `"CAD"`, so the two sources
never disagreed. It now makes them disagree (India vs CAD) and is sabotage-proven — reversing the precedence
fails `TheRowsOwnCurrencyBeatsTheBusinessCountry` and `WhenTheRowStatesItsCurrency_TheBusinessIsNeverResolved`.

‼️ **Row 7 is the THIRD shape of the same defect, and the cheapest lesson of the three.** Rows 1–5 were
duplicate TABLES. Row 6 was a duplicate AUTHORITY. Row 7 is neither — it is the same rule, simply never
applied to twelve screens the sweep had not looked at. ‼️ **It survived because NOT ONE of the twelve had a
test pinning the string it rendered:** 2,886 web tests and 3,801 mobile tests were all green with `CA$` live
on the leads screen and the unconditional `/100` live on both booking-detail screens. **A sweep scoped to the
surfaces a phase TOUCHED will always miss the surfaces it did not** — so the close-out ships a **scanning
guard per app** instead of twelve assertions:
`clinqetwebpartnerapp/src/utils/moneyFormattingConvention.test.js` and
`clinqetmobilepartnerapp/__tests__/moneyFormattingConvention.test.ts`. Each scans **its own repo only**
(§0.17), ignores comments, asserts the scan actually read files so an empty scan cannot pass, and is
sabotage-proven — reintroducing one `style: "currency"` names the exact file and line.

**Refuted / clean:** the backend symbol table and both partner twins agree **20/20** entry for entry, checked
mechanically. Every producer that supplies a money key now supplies `MoneyFields`; no variant reads a money
field that `RenderMoney` did not fill. No producer dereferences a now-null `Fields`. `QuestPdfService`'s
receipt renders **byte-identically** to before (it already had the right expression). Rounding is decimal
throughout with no double contamination.

**Accepted residuals, stated:** a negative amount would render `$-24.00` rather than `-$24.00` — latent, no
producer emits one. The customer app, admin app and customer mobile app each keep their own (correct, wider)
zero-decimal list and are not provider surfaces; four `/100` sites in those apps are recorded in
`CARRIED-TO-P5.md` rather than changed here.

---

### 3.1 ‼️ AND AN INDEPENDENT SWEEP FOUND MORE — the rule is NOT yet true platform-wide

An agent that had seen none of this work was asked one question: *is the one-money-definition rule actually
true?* Its answer is **no**, and every claim below was re-verified by hand before being written down.

**Fixed here, because each is one line and each is live:**

| # | What | Fixed |
|---|---|---|
| 8 | ‼️ **The booking-confirmation e-mail took the symbol from the LANGUAGE FILE.** `GetLocalizedString("CurrencySymbol", lang)` — and that key is `"$"` in **all five** catalogues, so it followed neither the currency nor the reader. An Indian provider was e-mailed `$12,000.00` on a rupee booking, and the same wrong glyph was passed into `EmailAdditionalCharges.Build`, stamping every visit/distance/deposit row | ✔ `ICurrencyService.GetCurrencySymbolAsync(businessId, Price.Currency)`, resolved ONCE before the fan-out — the recipient lambda is synchronous and could never have awaited it. Sabotage-proven by `TheCurrencySymbolComesFromTheBooking_NotFromTheLanguageFile`, which also asserts the language file is **never asked** |
| 9 | ‼️ **The quote push notification used `.ToString("C")`.** This host calls `UseRequestLocalization`, so `CurrentCulture` comes from the REQUEST — a Hindi-speaking customer read **₹ on a USD quote**, in a body whose words were already in their language. `QuotePrice.Currency` existed and was ignored | ✔ new `CurrencyMinorUnit.FormatMajor(major, currency, culture)` — the major-unit sibling of `Format`, mirroring the apps' `formatMajor` twins. ‼️ Closed as a CLASS by `MoneyNeverFormattedFromTheReadersCultureTests`, which fails on any `ToString("C")` / `{0:C}` in this repo and proves its scan read files |
| 10 | ‼️ **The MOBILE money twin had no parity guard in ANY repo.** The backend test read only the web twin, so adding a zero-decimal currency to the enum would have drifted the phone silently | ✔ `MobileTwin_ListsTheSameZeroDecimalCurrencies` and `BothTwins_WriteTheSameSymbolForEveryCurrency` — both skip **loudly** when a partner app is absent (§0.17 rule 5). Sabotage-proven: retyping `CAD` in the twin fails exactly those two |

‼️ **NOT fixed, and this is the honest part.** The remainder is a PHASE, not a fix — roughly 200 call sites
across five repositories, changing visible money on screens far outside Ask Clinket. Starting it unannounced
at the end of a close-out session would be the workaround this programme exists to refuse. It is recorded in
`CARRIED-TO-P5.md` **as work the owner must schedule, NOT as an accepted residual** — the distinction matters,
because an accepted residual is a decision and this is a debt:

- **Mobile `Util/currency.tsx` is a SECOND LIVE RENDERER — 115 call sites across 26 screens.** Its locale is
  region-aware and defaults to India, so an English reader gets `5,31,000.00` where the twin gives
  `531,000.00`. ‼️ `bookingDetails.tsx` imports **both**: one screen, one currency, two strings.
- **Mobile Plan & Billing** divides by 100 unconditionally, takes the symbol from the business, and pins two
  decimals — while `ProviderPlanSummary.currency` sits unread on the wire.
- **`QuestPdfService` — 21 sites** writing `symbol + ":N2"` with no culture, one line below a `ToString("N0",
  culture)` that gets it right.
- **~25 e-mail/invoice sites** pin `:N2`, so JPY renders `¥5,000.00` — the display twin of dividing by 100.
- **The cart-reminder e-mail** prints the raw currency CODE, `F2` (never grouped), and hardcoded English.
- **Web, 36 sites** take the symbol from the business rather than the row (grouping is already correct).
- **Broadcast bids** use `F2`, which emits no group separator in any culture.

**Cleared as false positives, so nobody re-finds them:** `ServiceAccordion.jsx` (both copies) hardcodes `# AUDIT — PHASE 4.5, 2026-09-04

The close-out fix phase. Four independent agents audited this phase's diff — correctness & contracts, the
money change, tests & vacuity, and config/copy/hygiene — then every finding was fixed, refuted with evidence,
or named as an accepted residual below.

> ‼️ **THE MOST IMPORTANT RESULT OF THE DAY: the audit caught a SECURITY REGRESSION I had just introduced.**
> My first cut of the duplicate-upload merge copied the incoming row's audience and caller switch onto the
> survivor. But a confirmed upload **cannot tell a provider's choice from a server default** — the confirm DTO
> carries no audience at all, an omitted caller switch reads `true`, an omitted type reads `Other`, and the
> upload modal always sends an empty link list. So the fix for "a merge discards the provider's choices" would
> have **WIDENED a restricted document to the whole team and made a private file sendable to phone callers
> again**, while telling the provider "your latest choices were saved". Section 1 below.

---

## 0. WHAT WAS BUILT

| § | Item | State |
|---|---|---|
| 1 | The duplicate-upload data loss — alone and first | **Shipped**, and then corrected by the audit (§1 below) |
| 2 | ONE money renderer: symbol from the currency, grouping from the reader, per recipient | **Shipped** |
| 3 | Item #10's ROOT fix — the rule owns the parse, the entity holds the raw string, the converter DELETED | **Shipped** |
| 4 | The batch of eight | **Shipped** |
| 5 | Both measurements, each ending in a number | **`findings/MEASUREMENTS-P4.5-2026-09-04.md`** |
| 6 | The four residuals put back in scope | **Shipped** |

**No SQL table, column or index. No Cosmos container, partition key, field, IncludedPath or TTL. No search
index field.** §0.7 did not fire. §3's entity change is a C# TYPE change on the same JSON property with the
same stored values — no migration, no backfill; the alternative `searchAudienceRaw` field was rejected for
exactly that reason.

---

## GREEN RUNS — all taken AFTER the last fix

| Suite | Result |
|---|---|
| `Clinqet.API.UnitTests` | **11,609 passed · 0 failed · 0 skipped** |
| `Clinqet.Communications.UnitTests` | **3,861 passed · 0 failed · 0 skipped** |
| `Clinqet.Communications.IntegrationTests` (real SQL + Cosmos emulator + Azurite) | **547 passed · 0 failed · 0 skipped** |
| `Clinqet.API.IntegrationTests` (real SQL + Cosmos emulator + Azurite) | **2,038 passed · 0 failed · 0 skipped** |
| `clinqetwebpartnerapp` jest | **2,888 passed · 209 suites · 0 failed** |
| `clinqetmobilepartnerapp` jest | **3,803 passed · 227 suites · 0 failed** |
| `clinqetmobilepartnerapp` `tsc --noEmit` | **clean** |
| ESLint on every changed web and mobile file | **0 errors** |

‼️ **What "AFTER the last fix" is worth here, precisely.** The two integration runs and the API unit run
predate two later changes, so say what covers them rather than imply a rerun that did not happen:

- The **app-only money sweep** (twelve screens) touches no .NET file. The one backend test that reads those
  app files is `CurrencyMinorUnitTests` — **re-run afterwards, 32 passed**.
- The **last guard** (`KnowledgeDuplicateReasonKeyCatalogueTests`) is a new test file with no production
  change; the Functions unit suite was re-run in full for it (**3,861**), and it cannot affect either
  integration suite.

A green run you cannot argue postdates every change is not evidence — so this is the argument, not a claim.

---

## 1. ‼️ THE FINDING THAT MATTERED MOST — my own fix widened access

**`KnowledgeIngestProcessorFunction.ApplyProviderChoices`.** RULING 3 says *the newest **explicit** choices
win*, and the word **explicit** turned out to be the whole rule.

A freshly confirmed upload row always carries:

| Field | What `ConfirmOneAsync` writes when the client says nothing |
|---|---|
| `searchAudience` | `"Team"` — the class initializer. **The confirm DTO has no audience field at all.** |
| `shareWithCallers` | `file.ShareWithCallers ?? true` — **true** |
| `docType` | `file.DocType ?? Other` |
| `linkedServiceIds` | `[]` — and the upload modal always sends it |

Copying those onto the survivor would have: widened a role-restricted document to the whole team; re-enabled
caller sending on a file the provider had marked private; stripped a price list's offering links off its
**cards** (`linkedServiceIds` on the card is what `search_knowledge` narrows by, so the link would simply
stop working); and retyped a `PriceList` as `Other`.

**Fixed: A MERGE NEVER WIDENS.** Only a value that cannot be a default crosses over — `Roles` (not `Team`),
`shareWithCallers = false` (not `true`), a non-empty link list, a type other than `Other`. A provider who
genuinely wants to widen the survivor changes it on the surviving document, where the change is deliberate
and visible. Two unit tests pin both directions, and the emulator test pins the tightening end to end.

**Second half of the same finding:** `newRow` was read at the top of `ProcessAsync`, **before** the blob
download and the SHA-256 — minutes earlier for a large file — while `SetSearchAudienceAsync` deliberately
ACCEPTS a Processing row. A provider who restricted the file mid-upload had their choice in Cosmos and not in
that snapshot. **The incoming row is now re-read** immediately before its choices are taken, with a test.

---

## 2. THE OTHER CORRECTNESS FINDINGS, ALL FIXED

1. ‼️ **The merge notice was deleted by the very re-cut the merge asked for.** On `RequiresReingest` the
   survivor goes back on the `MetadataOnly` lane, and `BeginRecutAsync` nulls `FailureReasonKey` — so exactly
   when the provider most needed to be told, they were not. **Root fix: a re-cut clears a FAILURE, never a
   NOTICE.** `ClearedFailureReason` preserves the `Info_` family at all four clearing sites.
2. ‼️ **`ToDto` told the screen the OPPOSITE of what the server enforces for a blank value.** `Decide` reads
   absent/blank as "everyone on the team"; the DTO's own ternary fell through to `Roles` with an empty list,
   i.e. "only the owner and administrators" — about a document every member can find. **Measured: all 54 live
   rows carry no value at all**, so this was the branch governing the entire live library. Fixed.
3. **The visibility task could fault unobserved.** Removing the `OperationCanceledException` swallow made the
   detached read able to complete faulted; awaiting the embeddings first would drop that fault whenever an
   embedding threw. Both are now awaited by one `Task.WhenAll`, which observes every one.
4. **`ApplyProviderChoices` overwrites a survivor's existing `Error_KnowledgeDuplicateOfAnotherDocument`.**
   Accepted: the merge is the newer event and its notice is the accurate one; the older message ("upload a
   different file") is stale the moment the merge succeeds.
5. **A redelivery after a committed merge can queue a second re-cut.** Accepted: the id is state-derived and
   `UpdatedAt` moved, so duplicate detection cannot collapse it. Idempotent, costs one re-cut, named in
   `CARRIED-TO-P5.md`.

**Refuted with evidence:** the new `SearchCustomersByNameAsync` was checked against the in-memory filter it
replaces for absent `firstName`, absent `lastName`, a needle spanning the space, casing and the type filter —
identical, and now proven on the **real emulator** rather than argued. `Decide`'s truth table matches the old
`IsVisible` for every recognised value. No caller of the deleted converter survives anywhere. Every new query
passes a partition key.

---

## 3. ‼️ THE MONEY FINDINGS — SEVENTEEN surfaces still disagreed after my first cut

The stated intent was "one string on every surface a person reads". The audit found it was not yet true —
and then found it again, twice more, after each fix was called done. ‼️ **The heading of this section said FIVE
for most of the session. Counting what you have fixed is not the same as counting what is broken.**

| # | What | Fixed |
|---|---|---|
| 1 | **Two receipt e-mails still divided by 100 unconditionally** (`BillingReceiptEmailProcessor`) — the provider's subscription receipt and the customer's booking receipt. In a file this change had already edited | ✔ |
| 2 | ‼️ **A SECOND BACKEND SYMBOL MAP** in `ProviderBillingController` with `CAD => "$"`, so a Canadian provider's **downloaded** receipt said `$390.00` while every other surface said `C$390.00` | ✔ delegates to the shared table |
| 3 | ‼️ **A THIRD, DATA-DRIVEN SYMBOL SOURCE.** The seeded country row carries its own `currencySymbol` — Canada's says **`CA$`** — and `GetCurrencySymbolAsync` returned it *before* ever reaching the code map. Four different strings for one CAD amount | ✔ the country tells us the CODE; the shared table writes it. `CountryResolution.CurrencySymbol` deleted as orphaned |
| 4 | ‼️ **`formatMoney` — the whole provider Billing surface — still took its symbol from the READER** (`CA$` in English, `$CA` in French, `US$` in Gujarati) and dropped the decimals on a whole amount, so Billing said `CA$390` about the charge whose reminder said `C$390.00` | ✔ |
| 5 | ‼️ **The mobile twin formatted with the REGION-aware locale** (`en` → `en-IN`), so an English-reading Indian provider saw `₹5,31,000.00` on the phone and `₹531,000.00` everywhere else — contradicting the twin's own header comment | ✔ the language's product locale, matching the server |
| 6 | ‼️ **A FOURTH SYMBOL SOURCE, AND IT WAS THE ADDRESS.** After fixing which TABLE `GetCurrencySymbolAsync` reads, it still resolved the **business** before the row and treated the row's own currency as a mere fallback — so a CAD invoice held by an Indian business printed **₹**. ‼️ **LIVE, not latent:** business `LXDP8G` (India/Gujarat) holds invoice `INV2608010301` in CAD and a CAD booking, and 11 call sites read this method | ✔ the ROW's currency wins; the business is resolved only when a row carries none |
| 7 | ‼️ **TWELVE MORE PROVIDER SCREENS still took the symbol from the READER** — `Intl`'s `style: "currency"` writes `CA$` in English, `$CA` in French and `US$` in Gujarati for one CAD amount. **Web (7):** `dashboard/inbox`, `dashboard/leads`, `dashboard/leads/[id]`, `public/track-bookings`, `InsightsView.jsx`, and `BookingsDetails.jsx` **twice** (payment amount + payout amount). **Mobile (5):** `InboxTab/ChatDetails`, `ProfileFlow/Booking/bookingDetails`, `ProfileFlow/Broadcast/BroadcastDetails`, `ProfileFlow/Broadcast/index`, `ProfileFlow/Insights`. ‼️ **Two of them also divided by 100 unconditionally** (`BookingsDetails.jsx` and mobile `bookingDetails.tsx`) — the identical zero-decimal defect that made a ¥5,000 refund read ¥50, the one this phase set out to kill | ✔ all twelve route through the client twins. A new `formatMajor(intl, amount, code, { maximumFractionDigits })` sits beside `formatMinor` in both twins; the override changes the decimal places where a screen deliberately rounds (Insights), never which symbol is written. The chat bid's rule is PRESERVED — with no currency on the payload, format the number alone rather than invent whose money it is |

‼️ **Row 6 was found LAST, in the close-out sweep, and it is the most instructive one here.** Rows 1–5 were all
"a second copy of the symbol table"; the audit fixed each copy and declared the money work done. Row 6 is the
same defect in a different shape — not a second TABLE but a second *authority* deciding which currency an
amount is in — and it survived precisely because the earlier fixes made the code LOOK right: the method now
carried a comment saying "the symbol comes from the currency, never the country row" while still asking the
country first. ‼️ **A comment that states an invariant is a claim no build checks.** The test that should have
caught it was mine and was VACUOUS: it stubbed the resolver to Canada AND passed `"CAD"`, so the two sources
never disagreed. It now makes them disagree (India vs CAD) and is sabotage-proven — reversing the precedence
fails `TheRowsOwnCurrencyBeatsTheBusinessCountry` and `WhenTheRowStatesItsCurrency_TheBusinessIsNeverResolved`.

‼️ **Row 7 is the THIRD shape of the same defect, and the cheapest lesson of the three.** Rows 1–5 were
duplicate TABLES. Row 6 was a duplicate AUTHORITY. Row 7 is neither — it is the same rule, simply never
applied to twelve screens the sweep had not looked at. ‼️ **It survived because NOT ONE of the twelve had a
test pinning the string it rendered:** 2,886 web tests and 3,801 mobile tests were all green with `CA$` live
on the leads screen and the unconditional `/100` live on both booking-detail screens. **A sweep scoped to the
surfaces a phase TOUCHED will always miss the surfaces it did not** — so the close-out ships a **scanning
guard per app** instead of twelve assertions:
`clinqetwebpartnerapp/src/utils/moneyFormattingConvention.test.js` and
`clinqetmobilepartnerapp/__tests__/moneyFormattingConvention.test.ts`. Each scans **its own repo only**
(§0.17), ignores comments, asserts the scan actually read files so an empty scan cannot pass, and is
sabotage-proven — reintroducing one `style: "currency"` names the exact file and line.

**Refuted / clean:** the backend symbol table and both partner twins agree **20/20** entry for entry, checked
mechanically. Every producer that supplies a money key now supplies `MoneyFields`; no variant reads a money
field that `RenderMoney` did not fill. No producer dereferences a now-null `Fields`. `QuestPdfService`'s
receipt renders **byte-identically** to before (it already had the right expression). Rounding is decimal
throughout with no double contamination.

**Accepted residuals, stated:** a negative amount would render `$-24.00` rather than `-$24.00` — latent, no
producer emits one. The customer app, admin app and customer mobile app each keep their own (correct, wider)
zero-decimal list and are not provider surfaces; four `/100` sites in those apps are recorded in
`CARRIED-TO-P5.md` rather than changed here.

---


but is **completely unreferenced dead code** — a §22.2 deletion for the owner, not a live defect;
`VoiceAssistantPromo`'s `isIndia ? "₹" : "$"` is an illustrative price carrying no currency, so the business
is the correct source; `KnowledgePriceMarks` and `CountryResolutionService` are parsers, not renderers; every
other `/100` in both apps is basis points, a percentage, a tax rate, an SVG offset or a file size.

---

## 4. ‼️ A FALSE CLAIM IN MY OWN COMMENT — and what it was hiding

I wrote, in `LanguageCulture.cs`: *"MEASURED: mapping these five changes no date at all — only the money
separators."* **I had measured only the long-date format.** Re-measured under .NET 10:

| | `"D"` — dates | `"f"` — dates **with times** |
|---|---|---|
| en, gu, hi | unchanged | unchanged |
| **es → es-US** | unchanged | ‼️ **`15:07` → `3:07 p. m.`** (24-hour → 12-hour) |
| **fr → fr-CA** | unchanged | ‼️ **`15:07` → `15 h 07`** |

`LocalTimeFormatter.Instant` and `WallTime` render `"f"`, so this changes **every Spanish and French
appointment time** in bookings, quotes, invoices, reminders and receipts. Both new formats are the *right*
convention for a platform whose Spanish is US Spanish and whose French is Canadian French — but it is a
behaviour change that shipped under a comment saying nothing changed. **The comment is corrected, and
`LanguageCultureTests` now pins both halves** (dates unchanged; times deliberately changed). ‼️ **Flagged to
the owner as a visible change, not buried here.**

‼️ **A THIRD, in the SKILL itself — and the skill is the living contract, so a stale one MISLEADS every future
session (§0.9).** Three claims were wrong when the close-out sweep re-read them:

| Where | The claim | The truth |
|---|---|---|
| §17.2 | *"Measured: no date changes."* | **False** — the same claim as the code comment above, left uncorrected in the skill after the comment was fixed |
| §16.7 C4 | The refund tool uses `GetCurrencySymbol` + `ToMajor(...).ToString("N" + exponent)`, and *"`ToMajorString` was NOT changed"* | Both were changed by this phase: the tool calls `CurrencyMinorUnit.Format`, and `ToMajorString` now REQUIRES a culture |
| §16.8 | *"Use the **pure** `GetCurrencySymbol(currencyCode)` for a ROW's currency"* | ‼️ **That method no longer exists** — this phase deleted it. The instruction was not merely stale, it was **impossible to follow** |

And `.cursor/rules/clinqet-business-search.mdc`'s `globs` still listed `KnowledgeSearchAudienceConverter.cs`,
a file this phase **deleted** — the same class as §0.20's "sweep every reference in the same change".

‼️ **The lesson is the ordering.** Each of these was written *before* the fix that invalidated it, in the same
session, by me. The skill was updated for what P4.5 ADDED (§17) and never re-read for what P4.5 CONTRADICTED
(§16). **A phase that changes behaviour must re-read the sections describing the OLD behaviour, not only add a
new one.** All four copies are corrected and verified byte-identical.
A second false claim in the same family: the corrected comment then named `LanguageCultureTests`, which did
not exist. It does now — a comment that names an absent guard is worse than no comment, because a reader
trusts it.

---

## 5. ‼️ THE TESTS — nine could not fail, and two of them were mine

| # | Test | Why it could never fail | Fixed |
|---|---|---|---|
| 1 | `EveryAudienceMember_IsExplicitlyHandled` | `Enum.TryParse` recognises every DECLARED member by construction, so `Recognised` was always true. A third member would parse, fall through to the roles branch, and hide every document carrying it — the exact failure the test named | Replaced by a tripwire on the enum's MEMBER SET |
| 2 | `BillingNotificationMoneyRenderingTests` (whole file) | Every test called `CurrencyMinorUnit.Format` directly; `RenderMoney` was never constructed. **Deleting `RenderMoney` from the pipeline would have kept it green** while every provider's reminder rendered an empty `{price}` | **File deleted**; four tests that drive `BillingNotificationService` end to end added to its own suite, sabotage-proven RED |
| 3 | `AZeroDecimalCurrencyKeepsItsWholeNumber…` | Asserted `Contains("5")` — `"¥50.00"` also contains `"5"` | Deleted with the file above |
| 4 | `TheCustomerNameSearch_KeepsItsDocumentTypeFilter` | Supplied its own type filter and asserted it back | Now pins the SHAPE the repository must fill |
| 5 | `Exponent/Symbol_CoversEveryCurrencyCode` | Both switches end in a `_ =>` default, so "every member returns something" is a tautology; a new zero-decimal code would silently get cents | Pins the enum's member SET |
| 6 | Both mobile 44 px guards | `it.each` over an empty array asserts nothing, and `expect(undefined).toEqual(undefined)` passes | Each asserts the scan found something first |
| 7 | The audience "two read paths agree" test | Called the rule directly and called that the point-read path | Comment corrected to claim only what it proves |
| 8 | `CurrencyServiceTests` ×2 | Green for the wrong reason after the symbol source changed | Renamed to the behaviour they pin, plus a NEW guard that would have caught `CA$` vs `C$` |
| 9 | The pill tap-target constant | `12 + 3 + 3 + 1 + 1 = 20`, not the 23 the comment claimed — so the guard enforced **42 px** while claiming 44 | Constant corrected to 20, slop raised to 12, so both marks reach exactly 44 |

**Coverage that had been lost and is now restored:** the customer name filter (its only behavioural test was
passing on an unstubbed mock) — now stubbed **and** proven on the real emulator, which §0.8 requires for a new
repository method; the rendered-money assertions the producer tests gave up; `KnowledgeIngestQueue`'s lane and
dedup identity (a brand-new file with no test at all); the canonical tool-schema ordering.

**Sabotage-proven RED, each with a clean build:** the client-twin guard · the payload-cap guard · the derived
DI-registration guard · the mobile tap-target guard · the four duplicate-upload tests · the `RenderMoney`
tests · the §4.1 cancellation tests. **Proven Skipped (never Passed, never failed) with the peer absent:** the
client-twin guard and `businessRoleCatalogParity.test.js` (10 skipped, 0 failed).

> ‼️ **THE TRAP THAT COST THE MOST TIME.** `throw new InvalidOperationException(` appears three times in the
> ingest function; a text-replace sabotage hit **line 891** while the code under test is at **2415**, the test
> stayed green, and it read as a vacuous test for twenty minutes. **Sabotage by LINE NUMBER, and check the
> build is clean** — a sabotage that breaks the build proves nothing against a stale DLL. The same first-match
> trap then corrupted a test edit (line 84 instead of 208) and produced a second false failure.

---

### 5.3 ‼️ THE LAST ONE, CLOSED AFTER THE OWNER HAD ALREADY COMMITTED

Two late audit reports landed after the tree was committed. One was **already fixed** and said so from stale
evidence: it claimed the `RequiresReingest` path nulls `FailureReasonKey` twice, so the duplicate-merge notice
never reaches the provider. Both sites now call `ClearedFailureReason`, which preserves an `Info_` key, and the
third null is `MarkDeletingAsync` — a row on its way out, where clearing is correct. ‼️ **An agent that ran for
two hours reports the code as it was when it read it.** Re-read before believing it.

The other was real and unguarded: **both duplicate-merge tests compare the row's reason to
`KnowledgeIngestProcessorFunction.DuplicateMergedReasonKey` — the constant against itself.** Retyping the
constant to a key no catalogue carries left both green while the provider got a raw key or an empty reason. The
localization convention tests cannot see it either: they scan `GetLocalizedString(...)` call sites, and this key
is never a literal there — it is stored on the row and resolved later by `KnowledgeController`.

**Closed by `KnowledgeDuplicateReasonKeyCatalogueTests`** (Functions unit suite, where the runtime consumer lives
— §0.18): the key must carry a non-empty sentence in **all five** catalogues, read from the test's OWN output
directory where the Infrastructure library copies them, so no peer repo is touched; it must keep its `Info_`
prefix, which is what survives the re-cut; and every catalogue must actually be present, so an empty scan cannot
pass. **Sabotage-proven: retyping the constant fails 5 of the 7.**

---

## 6. CONFIG, COPY AND HYGIENE — clean, with the orphans this change created removed

**Verified clean:** all five backend catalogues parse, carry **3,207 keys each**, with byte-identical key
sets; the new `Info_KnowledgeDuplicateSettingsApplied` is genuinely translated in each and carries **no
technical word a provider can read** — it says *file, knowledge base, choices, saved, document, copy,
removed*. All five mobile catalogues parse with **5,772 leaf keys each** and identical key sets; the new
`HELPER_PHONE` is translated per language, uses no apostrophe, and carries no English `defaultValue`.

**The three new appsettings keys are read at runtime** — `KnowledgeDocumentParser`'s constructor reads all
three and the API host resolves that parser through `ProviderSetupDocumentReader` — and every class default
equals its appsettings value. Behaviour is identical today; the exposure was tuning drift.

**Orphans this change created, all deleted:** the two-argument `ToMajorString`; `ICurrencyService.GetCurrencySymbol(string)`
(the refund tool was its last caller); `CountryResolution.CurrencySymbol` (written and never read once the
symbol came from the code); `KNOWLEDGE.AUDIENCE.HELPER` in five mobile files; the `zeroDecimal` local and the
unused import in `money.js`. `KnowledgeSearchAudienceConverter.cs` is deleted with zero remaining references.

**Comments corrected rather than left:** four made claims the code did not implement — "not a second parse"
sitting one line above a second parse; "the symbol and the grouping are applied per recipient" when only the
grouping is; "a convention test proves it [is exhaustive]" when none did; and the date claim in §4. A
live-row count was removed from the tree entirely: a measurement note rots, and belongs in the commit message.

**Refuted:** the web/mobile helper-sentence divergence is **deliberate** — sheet M6 §4 draws a shorter phone
line, and §6 now registers both, which is precisely what §6.2 asked for. The withheld-document log line is
RULING 6's requirement, and fires only when something is actually withheld.

---

## 7. WHAT THE LIVE DATA SAID — three assumptions killed

- ‼️ **All 54 knowledge rows in both regions carry NO `searchAudience` at all**, and none carries role keys.
  The "absent ⇒ everyone on the team" branch governs the **entire live library** — not the `"Team"` branch.
- ‼️ **`BookingPaymentDispute` has ZERO rows in both regions**, and live currencies are only **CAD and INR**.
  So the ¥5,000→¥50 defect was latent by data while live in code — but **11 live INR invoices are ≥ ₹1,00,000
  (max ₹5,31,000)**, so the grouping defect was real and visible to Indian providers today.
- **No same-byte document pair exists live**, so the duplicate-upload loss had not yet bitten — though one
  live row does carry a deliberate "don't send to callers", which is exactly what it would have destroyed.

---

## 8. ‼️ WHERE THE PROMPT WAS WRONG AND THE CODE WON

1. **§2.3 said changing `ToMajorString` ripples into invoice PDFs and pages.** It has **11 product call
   sites**, every one building an email-template value or a notification body. PDFs use a different
   expression; no page calls it at all. Reported before building.
2. **§1 said to tell the provider "in the upload response".** The content hash is only known
   **asynchronously**, long after that response was sent — so the notice rides the surviving row's reason key,
   which **both apps already render on a Ready row**. No new `NotificationType`, no app change, as §1 required.
3. **§4.6 said only `MaxTotalMediaBytes` was owed.** `KnowledgeDocumentParser`'s **constructor** reads
   **three**, and the API resolves it. The host's own settings convention test then proved it from the
   opposite direction by failing on the addition.

---

## 9. CONCURRENT SESSIONS — what was NOT mine

Another session worked in the same trees throughout and its edits appear in `git status`:
`clinqetcore/Models/Knowledge/KnowledgeBlocks.cs`, the three `KnowledgeDocumentParser.*` files, and
`Clinqet.Communications.UnitTests/Knowledge/KnowledgeImagePlacementTests.cs` (an extraction-fidelity ceiling
change). **A new ceiling alert in `KnowledgeIngestProcessorFunction` has no test asserting the processor
raises it** — reported, not adopted, because it is that session's work.

`KnowledgeDocumentDataPurger` gained a required `logger` parameter from that session, breaking **three
pre-existing** Functions integration files; those were repaired here because they blocked the suite.

**One genuine defect fixed outside this phase's scope, at the owner's instruction:**
`AdminAlertControllerTests.GetAlerts_CursorPaging_ReturnsDisjointNewestFirstPages` sent a round-trip `"O"`
timestamp to a filter that another session had migrated to `DateOnly`. `DateOnly` binding **refuses** it, so
the window bound to null and the query returned every alert newest-first — the guarantee was gone and the
failure looked like a flake. ‼️ **Sending a timestamp to a day filter fails OPEN, not closed.** Now sends
whole UTC days, anchored at midday so four rows a second apart cannot straddle midnight.

**No file belonging to another session was reverted, and no git command that writes was run at any point.**
Every sabotage was restored from a scratchpad copy taken seconds earlier (§0.19).

---

## 10. TREE

`git status --porcelain` was read in every touched repository. **No scratch file of mine exists in any repo** —
every probe, patch script, measurement harness and throwaway project lived in the session scratchpad and is
deleted. One test file was **deleted** rather than kept (`BillingNotificationMoneyRenderingTests.cs`, §5.2),
and one production file was deleted by design (`KnowledgeSearchAudienceConverter.cs`, §3). Every test left
behind is a regression guard for a defect fixed above.

Nothing was committed. Nothing was pushed.
