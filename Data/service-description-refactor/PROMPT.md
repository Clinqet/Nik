# SERVICE DESCRIPTION — BACKEND REFACTOR: THE COMPLETE BRIEF

> **Hand this file's path to a fresh session. It is self-contained: the ask, the analysis, the
> findings, the decision, the coding standards, the edge cases, the audit. Nothing else is required.**
>
> **Status:** UI phase **DONE** (2026-09-03, §3). Backend phase **NOT STARTED** — that is your job.
> **Owner-approved 2026-09-03.** A plan, a phase file or a code comment saying "add X" is NOT
> approval — only the owner, in the current conversation, is.

---

# PART 0 — READ THIS FIRST

## 0.1 Your one-line mission

**Change Cosmos `Service.Description` from `List<string>` to a single `string?`, end to end, across
every producer and every consumer, with zero bugs and zero gaps — then prove it with a
multi-dimensional audit that visualises every edge case.**

## 0.2 ‼️ THE START GATE — do not write a line until this is true

```bash
for r in clinqetcore clinqetshared clinqetinfrastructure clinqetapi clinqetmcp clinqetfuncations \
         clinqetwebpartnerapp clinqetwebuserapp clinqetmobilepartnerapp clinqetmobileuserapp; do
  echo "$r: $(git -C /c/Nik/$r status --porcelain | wc -l)"
done
```

**All ten must read `0`.** On 2026-09-03 another session held 28 uncommitted files in
`clinqetinfrastructure`, 16 in `clinqetapi`, and mid-session began editing `clinqetwebpartnerapp` and
`clinqetmobilepartnerapp` too (Business Search Group B). Two distinct risks, never conflate them:

- **.NET repos — BUILD collision.** Shared `obj/`/`bin/`. This refactor retypes a field used by **38
  test files (§5.8)**, including the shared fixtures `Clinqet.API.UnitTests/Helpers/TestDataBuilder.cs` and
  `Clinqet.API.IntegrationTests/Helpers/CosmosRepositoryTestData.cs`. Starting early breaks the other
  session's build with compile errors in files they never touched, and neither side can trust a build.
- **Client repos — FILE collision.** No shared build output; the danger is only overlapping files.

If the gate is not green: **stop and tell the owner.** Do not start "just the safe parts".

## 0.3 Rules you may never break, even if asked

| | |
|---|---|
| ‼️ | **NEVER `git checkout --` / `restore` / `reset` / `stash` / `clean`** in these trees. Multiple AI sessions work uncommitted here; one restore destroys everyone's work. Copy to the scratchpad instead. If it happens anyway, **say so immediately**. |
| ‼️ | **NEVER `git push`.** The owner pushes and deploys. Prepare commits only, in pipeline order (shared/core/infra first, hosts after). |
| ‼️ | **NEVER build or test while another session is working** in `C:\Nik`. |
| ‼️ | **NEVER a cross-partition Cosmos query.** No override exists. If you cannot phrase it in one partition, the model is wrong — stop and ask. |
| ‼️ | **NEVER add a schema change beyond the one approved here** without presenting the §0.7 table and waiting. |
| ‼️ | **NEVER write a scratch file inside a repo.** Session scratchpad only. Delete everything you created to investigate. |
| ‼️ | **EVERY `IMemoryCache` write sets `Size = 1`.** A size-less `Set()` is a runtime 500. |
| ‼️ | **NEVER retro-edit an applied EF migration.** |
| ‼️ | **A test may only read paths inside its own repo.** No `../<other-repo>`. CI checks out ONE repository. |

---

# PART 1 — THE ASK, IN THE OWNER'S WORDS

Three things, from the 2026-09-03 session:

1. **"When I click on the service on the dashboard it opens a modal… would have been nicer if I can
   just have an edit button, like an icon, at the top."** → ✅ **DONE** (§3).
2. **"This description is very detailed and very good, but when you look at it in the edit mode, I do
   not see those entire description. What is going on? Where are those description being stored?"**
   → root cause found (§2), **UI fixed** (§3), **backend refactor is your job** (§5).
3. **"Booking deposit takes lots of areas and space… how can we shorten it so we utilize the space for
   the real stuff?"** → ✅ **DONE** (§3).

Plus, on the data model: *"removing list of string and moving to single string is best practice or
not? we are not in prod so we can do that."* → **Approved: single string** (§4).

And on limits: *"let's not put any limit on the description length. Maybe be conservative to secure
ourselves… 2,000 would be better. But I'm gonna leave that with you."* → **5,000, reasoned in §4.4.**

---

# PART 2 — THE ANALYSIS AND FINDINGS

## 2.1 How the description is stored today

`clinqetcore/Entities/COSMOS/Cosmos.cs:421-422`

```csharp
[JsonProperty("description")]
public List<string> Description { get; set; }   // ‼️ no initializer ⇒ null is a real stored state
```

Container `ProviderData`, partition key `/businessId`, document id `{businessId}_{serviceId}`.

## 2.2 The defect, proved against live data

`GET https://api-ca.dev.clinket.com/api/v1/business/services`, business `SX3SG2`, HTTP 200:

```
708 services.  description array length:   2 lines ×15    3 lines ×667    8 lines ×26
NOT ONE service has 1 line.
max total 1,239 chars   ·   max single line 1,018 chars
```

Service `9b32789a-68da-5600-83f3-775e8e3dec27` — "2021 CATERPILLAR 303 . 5E2 (MT41233A)":

```
[0]  62 chars  Used 2021 CATERPILLAR 303.5E2 mini excavator with 1,437 hours.
[1] 175 chars  Make: CATERPILLAR · Model: 303.5E2 · Year: 2021 · Stock #: MT41233A · Serial #: …
[2] 513 chars  Features: Air Conditioner · Auxiliary Hydraulics Pressure - Standard Flow · …
```

**The API returned all three correctly.** Both partner editors loaded `description[0]` (62 of 750
chars) and saved `[text]` — so opening any service and pressing Save, changing nothing, permanently
destroyed lines 1 and 2. On all 708 services, in both partner apps.

## 2.3 The root cause: nobody owned the conversion

A collection forces every consumer to answer *"how do I fold this?"* There were **23 client
touchpoints answering it 4 mutually-inconsistent ways**, and `ServiceDetailScreen.tsx` disagreed with
*itself* 40 lines apart (`:177` took `[0]`, `:255` joined all lines).

**That is the real finding.** The `[0]`s were symptoms; the array's fold-decision was the disease.

### ‼️ 2.3.1 THE COMPLETE CLIENT INVENTORY — every place the description is used

This is the map. Sites 1-23 are the client apps as found on 2026-09-03; the ✅/❌ column is the state
**before** the UI phase. Everything marked "fixed §3" is already done — the table is here so you can
verify nothing was missed and so you know what each site is FOR.

| # | File : line | What it does | Was | Now |
|---|---|---|---|---|
| **Partner web — `clinqetwebpartnerapp`** |
| 1 | `…/ManageServicesPrice/utils/formUtils.js:63` | edit load | ❌ `[0]` | `descriptionText` |
| 2 | `…/formUtils.js:100` | duplicate load | ❌ `[0]` | `descriptionText` |
| 3 | `…/formUtils.js:140` | **save** | ❌ `[text]` | `descriptionToPayload` |
| 4 | `src/components/dashboard/home/ServicesList.jsx:69` | modal read | ✅ own filter | `descriptionLines` |
| 5 | `…/ManageServicesPrice/hooks/useServiceCategories.js:213` | catalog search | ✅ `.some()` | unchanged |
| 6 | `src/components/quotes/hooks/useServiceForms.js:57` | quote job-note seed | ⚠️ intent | → `descriptionSummary` (§5.7) |
| 7 | `src/components/booking/AddBookingForm.jsx:1157` | booking job-note seed | ⚠️ intent | → `descriptionSummary` (§5.7) |
| **Partner mobile — `clinqetmobilepartnerapp`** |
| 8 | `…/completeProfileFlow/AddService/index.tsx:268` | edit load | ❌ `[0]` | `descriptionText` |
| 9 | `…/AddService/index.tsx:362` | duplicate load | ❌ `[0]` | `descriptionText` |
| 10 | `…/AddService/index.tsx` save path | **save** | ❌ `[text]` | `descriptionToPayload` |
| 11 | `…/homeTab/MyDashboardScreen/ServicesList.tsx:243` | modal read | ✅ own filter | `descriptionLines` |
| 12 | `…/Quotes/addQuoteScreen/AddQuoteScreen.tsx:460` | quote seed | ⚠️ intent | → `descriptionSummary` (§5.7) |
| 13 | `…/Booking/addBookingScreen/AddBookingScreen.tsx:901` | booking seed | ⚠️ intent | → `descriptionSummary` (§5.7) |
| **Customer web — `clinqetwebuserapp`** |
| 14 | `components/customer/providerService/ProviderServiceContent.jsx:83` | public page render | ✅ own filter | `descriptionLines` |
| 15 | `components/customer/ServiceDetailModal.jsx:258` | modal render | ✅ own filter | `descriptionLines` |
| 16 | `lib/seo/serviceSeo.js:22` | schema.org | ✅ `filter(Boolean)` | `descriptionLines`, joined with a **space** |
| 17 | `components/customer/businessProfile.jsx:519` | search-in-business | ❌ **`[0]` only** | `descriptionMatches` |
| **Customer mobile — `clinqetmobileuserapp`** |
| 18 | `src/screen/provider/ServiceDetailScreen.tsx:177` | **cart row** | ⚠️ intent | `descriptionSummary` |
| 19 | `…/ServiceDetailScreen.tsx:214` | **cart row** | ⚠️ intent | `descriptionSummary` |
| 20 | `…/ServiceDetailScreen.tsx:255` | detail render | ✅ join all | `descriptionLines` |
| 21 | `src/screen/cart/CartScreen.tsx:982` | **cart row** | ⚠️ intent | `descriptionSummary` |
| 22 | `src/screen/business/BusinessProfileScreen.tsx:895` | **cart row** | ⚠️ intent | `descriptionSummary` |
| 23 | `…/BusinessProfileScreen.tsx:1259` | search-in-business | ❌ **`[0]` only** | `descriptionMatches` |

‼️ **Sites 6, 7, 12, 13, 18, 19, 21, 22 were never bugs.** They seed a job note or build a cart row,
where one line is correct. An earlier draft of this analysis wrongly called sites 18/19/21/22
"customer sees truncated" — **they build CART ROWS, not the detail view.** The lesson, and it is the
same lesson as this whole programme: **establish what a call site is FOR before judging it.**

**Admin app (`clinqetwebadmin`): verified to have NO service-description surface.** Its `description`
hits are `alert.description`, `category.description` and billing-plan descriptions — all unrelated
string fields. `ServiceApprovalPage.jsx` never renders it. No admin work is required.

### 2.3.2 Server-side map — who writes, who reads

| Writes a description | Reads a description |
|---|---|
| `ServiceMappingExtensions` (create / update / clone) | `AzureSearchIndexer:957` — flattens with `Join(" ")` for BM25 + embedding |
| `CatalogManifestService` — dealer manifest, 3 parts | `ServiceRepository:152` + `:307` — Cosmos `CONTAINS` search |
| `KnowledgeServiceDraftBuilder` → `KnowledgeDraftApprovalService` | `ProviderCatalogSearchService:321, 530` — voice catalog answer |
| `ProviderSetupServiceWriter` — AI Quick Setup | `FullProviderContextService:454` — voice provider context |
| `ServiceManagementTools:125, 195` — voice AI / MCP | `McpService:889` · `ServiceValidationInputs:23` · `Clinqet.Mcp/Program.cs:470` |
| Both partner editors | `BookingTools:961, 1510` · `PartnerTransactionTools:324, 423` — first line only |

## 2.4 Two destruction paths in the VOICE assistant, found last

- `clinqetmcp/Clinqet.Mcp/Tools/ServiceManagementTools.cs:195`
  `service.Description = new List<string> { description.Trim() };`
  → **the voice AI updating a description REPLACED the whole array with one line.** No test covered it.
- `…/ServiceManagementTools.cs:125` — create, same single-element shape.

**These are still live. You must fix them and pin them with a regression test.**

## 2.5 The codebase already solved this, one folder away

```js
// clinqetwebpartnerapp/src/components/Profile/knowledge/KnowledgeDraftEditModal.jsx:56 + :132
setDescription((draft.descriptionLines || []).join("\n"));
descriptionLines: description.split("\n").map((l) => l.trim()).filter(Boolean)
// clinqetmobilepartnerapp/src/Screen/ProfileFlow/Knowledge/KnowledgeDraftEditSheet.tsx:138 + :207 — identical
```

The knowledge-draft editor round-trips lines→string→lines losslessly, web and mobile, every day. It
also proves the array carries **nothing** the newline-joined string does not.

## 2.6 Supporting facts — each verified, do not re-derive

- **`description` is completely unindexed.** `clinqetcore/Cosmos/Setup/CosmosContainerPolicies.cs`
  excludes `/*` and never includes `/description/?`, and it appears in no composite index.
  ⇒ **zero index cost, no re-key, no `ORDER BY` exposure.**
- **No length cap exists anywhere** — `ServiceDto.Description` carries only `[Display]`; no client cap
  either. An unbounded paste reaches the Cosmos 2 MB document limit and bills AI enrichment for it.
- **Nothing needs the elements separate at rest:**
  - `ServiceRepository.cs:152` and `:307` use
    `EXISTS(SELECT VALUE d FROM d IN c.description WHERE CONTAINS(d, @term, true))`.
    A flat `CONTAINS` is **equal or better** — a multi-word term straddling a line break ("cat 320")
    can never match per-line but does match flat.
  - `AzureSearchIndexer.cs:957-958` already flattens: `string.Join(" ", service.Description)`.
  - Every display surface would `split("\n")` — equivalent.
  - Every producer builds parts then joins.
- **26 services publish raw machine text.** `KnowledgeServiceDraftBuilder.cs:134-140` appends raw
  source-table cells: `id: eq-mdm-2058925`, `url: https://www.toromontequip.com/…`,
  `category: construction/compact-track-loaders`. Live on providers' public pages. See §6.2 — **this is
  the one OPEN DECISION still needing the owner.**
- **Deposit-card parity is already correct** — web `PaymentSettings.jsx:825` and mobile
  `PaymentSettings/index.tsx:756` both render the full card. (An earlier draft wrongly claimed a mobile
  gap; that came from a `head -30`-truncated grep. **Never conclude "absent" from a truncated search.**)

---

# PART 3 — WHAT IS ALREADY DONE (UI phase, 2026-09-03)

**Do not redo. Do not revert. Build on it.** All of it works against the CURRENT `List<string>` and is
forward-compatible by construction.

## 3.1 Shared helper — one per repo (they are separate git repos; never `../`)

| Repo | Path |
|---|---|
| `clinqetwebpartnerapp` | `src/utils/serviceDescription.js` |
| `clinqetmobilepartnerapp` | `src/Util/serviceDescription.ts` |
| `clinqetwebuserapp` | `utils/serviceDescription.js` |
| `clinqetmobileuserapp` | `src/utils/serviceDescription.ts` |

```
descriptionLines(value)     -> string[]   canonical parse; every READ site
descriptionText(value)      -> string     editor LOAD
descriptionToPayload(text)  -> string[]   editor SAVE   ‼️ partner repos only — see §5.7
descriptionSummary(value)   -> string     FIRST non-blank line; cart rows + job-note seeds
descriptionMatches(v, q)    -> boolean    search across ALL lines (customer repos)
SERVICE_DESCRIPTION_MAX_CHARS = 5000
```

Each accepts **`string` OR `string[]` OR `null`**, splits on `/\r?\n/`, trims, drops blanks.

## 3.2 Sites converted (partner)

- `ManageServicesPrice/utils/formUtils.js` — edit load, duplicate load, **save** → data loss STOPPED.
- `clinqetmobilepartnerapp/src/Screen/completeProfileFlow/AddService/index.tsx:268, 362, save path` — same.
- `dashboard/home/ServicesList.jsx` and `homeTab/MyDashboardScreen/ServicesList.tsx` — read via helper.

## 3.3 Sites converted (customer)

- **Two genuine bugs fixed:** `businessProfile.jsx:519` and `BusinessProfileScreen.tsx:1259` searched
  only line `[0]`, so searching within a business never matched a spec sheet's make/model/features.
  Both now use `descriptionMatches`.
- **Four cart-line sites made explicit** (`ServiceDetailScreen.tsx` ×2, `CartScreen.tsx`,
  `BusinessProfileScreen.tsx:895`) → `descriptionSummary()`. ‼️ **Behaviour unchanged and deliberately
  so** — a cart row wants one line, not a spec sheet. An earlier draft wrongly called these
  truncation bugs; they are not. Naming them makes intent unmistakable.
- Display + SEO sites use the helper (`ProviderServiceContent`, `ServiceDetailModal`, `serviceSeo.js`
  — the last joins with a **space**, since a schema.org description is one flat sentence stream).

## 3.4 Edit button — dashboard service modal, web + mobile

- **Web** `ServicesList.jsx` — brand-green pill (`bg-[#97EF29]`, ink `#032858`), pencil icon +
  `button.Edit`, `absolute bottom-3 right-3` inside the image header, `min-h-11`.
  Links to `${ProfileRoute.ManageServicesPrice}?serviceId=…` — ‼️ **reuses the deep link that already
  existed** (`ManageServicesPrice/index.jsx:202-244`: workspace switch, permission gate,
  `router.replace` URL cleanup, in-flight guard). No new plumbing was built.
- **Mobile** `MyDashboardScreen/ServicesList.tsx` — same corner, `editBtn` style, Ionicons
  `create-outline`, `minHeight: 44`. Closes the sheet **first**, then
  `navigation.navigate('AddService', { serviceId, entryContext: 'profile' })` — the exact shape
  `Util/notificationNavigation.ts:36-46` already uses.
- **Both gated** by `serviceCatalogEditable(can, access !== null)` and **ABSENT, never disabled** —
  the read-only contract in `servicesReadOnly.test.jsx` is explicit.
- Why bottom-right: close owns top-left, the status pill owns top-right, and this corner reads over a
  photo *and* over the letter-gradient fallback.

## 3.5 Description editor

- `FloatingTextarea` (web + mobile) gained `autoGrow`, `maxLength`, and a counter — **all default off,
  so the other ~12 callers are untouched.**
- Web: `useLayoutEffect` sets `height = min(scrollHeight, 360)`, `resize-none` → `resize-y`.
- Mobile: `onContentSizeChange` clamped to `[100, 320]`. ‼️ **+40 floor** because Android reports
  content size without the style's `paddingBottom`, which would put the AI buttons on the last line.
- Counter is **bottom-LEFT** (the AI + microphone buttons own bottom-right), numerals only via
  `intl.formatNumber` — nothing to translate — shown from 80% of the cap.
- Hint below the field once there is text: `serviceForm.descriptionLineHint` /
  `SERVICE_FORM.DESCRIPTION_LINE_HINT`, added to **all 5 languages in both partner apps**.
  New key `MY_DASHBOARD.EDIT` added to all 5 mobile locales (it did not exist — it would have
  rendered the raw key).

## 3.6 Booking deposit → one row

- `BookingDepositCard` gained `variant: "card" | "row"`, replacing the padding-only `compact`.
- `row`: one flex row, `min-h-11`, 16px wallet icon (the 40px navy tile is gone), title, Coming-soon
  chip, right-aligned action. **~170px → ~44px.** `flex-wrap` so it stacks below ~300px.
- The description + hint sentences moved to `title=` on the row and **remain in full on Payment
  Settings**, so no copy and no localization key is orphaned.
- Callers: `PriceDetailsSection.jsx:100` and mobile `AddService/index.tsx:1398` → `variant="row"`.
  Both Payment Settings screens keep the full card via the `"card"` default.

## 3.7 Verification actually run (not claimed)

| Check | Result |
|---|---|
| ESLint — 7 changed partner-web files | **0 errors** |
| ESLint — 5 changed customer-web files | **0 errors** (1 pre-existing unrelated warning) |
| `tsc --noEmit` — clinqetmobilepartnerapp | **clean** for changed files |
| `tsc --noEmit` — clinqetmobileuserapp | **clean** for changed files |
| Jest — deposit card + ManageServicesPrice suites | **32/32 pass** |
| Jest — new `serviceDescription.test.js` | **23/23 pass** |
| Jest — mobile locale parity + integrity | **30/30 pass** |
| Localization files | valid JSON; other session's edits verified intact (`+17/-0` web) |

---

# PART 4 — THE DECISION, AND WHAT WAS REJECTED

## 4.1 Approved: `Service.Description` becomes a single `string?`

**Industry standard** — Stripe `product.description`, Shopify `body_html`, Square
`CatalogItem.description`, WooCommerce, Google Merchant, schema.org `Product/Service.description`: all
single strings. Repeated fields exist only for genuinely enumerable capped lists (Amazon
`bullet_point` max 5, Google `product_highlight` max 10) and always sit *beside* a description string.

**The decisive reason is structural, not precedent:** against a string, **11 of the 12 defects are
unrepresentable.** `description[0]` on a string is the character `"U"` — it fails loudly instead of
silently shipping one line of a three-line spec to a customer.

## 4.2 Rejected — keep `List<string>` and add only a codec

Fixes everything today but leaves the fold-decision structurally possible at every future call site.

## 4.3 Rejected — key/value list `[{label, value}]` (owner-raised, good question)

Sound in principle: the data *does* contain key-values, and `CatalogAttributeLabel` already types those
labels upstream. Rejected on four grounds:

1. **§0.7 forbids it.** *"Never build schema for a phase that has not happened. The phase that READS
   the data creates it."* Nothing here reads structured attributes — no spec table, no facet, no
   filter. The "Who reads it" row would be **empty**, which the rule calls a rejection.
2. **Generic cuts against it.** A salon's "Balayage", a plumber's "Drain unblocking", a cleaner's "Deep
   clean" have no key-values. Equipment dealers are a narrow slice arriving via one specialised import.
   It means an authoring repeater UI in both partner apps that ~99% of providers leave empty.
3. **Today's array already proves it gives nothing.** It "supports" key-values by flattening them to
   `"Make: X · Model: Y"` — a string. Zero structural benefit, full fold-decision cost.
4. **The string does not block it.** `description: string` and a future
   `attributes: List<{label,value}>` are orthogonal and additive.

> **Untyped plurality is not flexibility, it is ambiguity.** One honest prose field every industry can
> use, plus a typed structure later for the industries that need it, beats one field pretending to be both.

**If specs are ever wanted:** a new `attributes` field plus a spec-table/facet surface, its own §0.7
approval, additive. **Do NOT smuggle it into this change.**

## 4.4 The cap: 5,000 characters (owner delegated the number)

The owner suggested ~2,000. **5,000 is the correct number, for two evidence-based reasons:**

1. **`FloatingTextarea` already rejects >5,000 chars** on the AI-enhance button for this exact field
   (web `:216`). At exactly 5,000 the two always agree; any other number lets a provider write text the
   AI button then refuses.
2. **2,000 is only 1.6× the observed maximum** (1,239 total, with a single line already at 1,018). A
   dealer import with a longer feature list would be **rejected**, losing legitimate data.

5,000 chars ≈ 5 KB — trivial against the Cosmos 2 MB limit, and bounded for AI enrichment.

## 4.5 ‼️ TWO DESIGN RULES THAT KEEP IT GENERIC — never violate

**1. Single `\n` = one paragraph. NEVER blank-line separated.** A string cannot represent a soft break
*inside* a paragraph that any renderer honours (HTML collapses it), so a blank-line convention would
silently swallow single newlines. One line in, one point out.

**2. NEVER parse the provider's text to invent presentation.** Splitting `Features: A · B · C` on `·`
to draw chips is tempting and **wrong** — it re-introduces meaning-by-convention on free text, the
exact fault being removed, and breaks the day a salon types a `·`. Render paragraphs, nothing more.

## 4.6 How one field serves heavy equipment AND every other industry

| | Hair salon | Heavy-equipment dealer |
|---|---|---|
| Content | one line, ~60 chars | 3 lines, 750 chars |
| Written by | typing | the catalog import, joining parts with `\n` |
| Stored as | a string, no `\n` | a string, two `\n` |
| Rendered | one paragraph | three paragraphs — **identical to today** |
| In the editor | box at its 3-row minimum | box auto-grows to fit all 750 chars |
| Special handling | **none** | **none** |

No mode, no toggle, no per-industry branch. Same code path, correct for both — and for the 8-line ones.

---

# PART 5 — YOUR WORK: THE BACKEND REFACTOR

**19 production `.cs` files + 38 test files.** Read each one **end to end** before editing (§8.2).

## 5.1 `clinqetcore`

| File | Change |
|---|---|
| `Entities/COSMOS/Cosmos.cs:421-422` | `List<string> Description` → `string? Description`. ‼️ Keep the JSON name `description` |
| `Entities/COSMOS/KnowledgeServiceDraft.cs` | `DescriptionLines: List<string>` → `Description: string?` |
| `Utilities/ServiceValidationInputs.cs:23` | `description = service.Description` — now a string; check the consumer |

## 5.2 `clinqetshared`

| File | Change |
|---|---|
| `DTOs/COSMOS/Cosmos.cs` `ServiceDto.Description` | `List<string>?` → `string?` **+ `[ValidServiceDescription]`** |
| **NEW** `Attributes/ValidServiceDescriptionAttribute.cs` | Follow `ValidFriendlyNameAttribute.cs` **exactly**: `ValidationAttribute`, returns a localization KEY, optional `IConfiguration` overrides via `validationContext.GetService`. Cap **5,000 chars total** (§4.4). Null/empty are valid |
| `DTOs/AI/AIAssistantDtos.cs` `ExtractedServiceDto.DescriptionParagraphs` | → a single `Description` string |
| `DTOs/Knowledge/KnowledgeServiceDraftDtos.cs` | `descriptionLines` → `description` (string), incl. the edit DTO |

## 5.3 `clinqetinfrastructure`

| File | Change |
|---|---|
| `Data/COSMOS/Extension/ServiceMappingExtensions.cs:31` | clone: drop `.ToList()` |
| `…:78` | update: keep full-replace. ‼️ **Decide AND TEST whether `""` clears** — it must, symmetric with `[]` today |
| `…:124` | create: assign directly |
| `Data/COSMOS/ServiceRepository.cs:152` | `EXISTS(… d IN c.description …)` → `CONTAINS(c.description, @term, true)` |
| `…:307` | same, inside the per-term loop (multi-word provider search) |
| `Services/Search/AzureSearchIndexer.cs:957-958` | `Join(" ", …)` → the string. ‼️ **Verify the enrichment hash still changes when the description changes** |
| `Services/AI/CatalogManifestService.cs` | keep building `paragraphs` locally; **join with `\n` once**. `MaxDescriptionParagraphLength` (4,000) stays a per-part cap; add a total cap |
| `Services/AI/ProviderSetupServiceWriter.cs:108-114, 175-177` | the two-branch fork collapses to one assignment. ‼️ **Preserve: an empty extraction must NEVER overwrite a provider-written description** |
| `Services/AI/McpService.cs:889-890` | `Join(" ", …Where(not blank))` → the string |
| `Services/AI/ServiceMatchingHelper.cs` · `ProviderSetupImageService.cs` | read; adjust shape |
| `Services/Knowledge/KnowledgeServiceDraftBuilder.cs:130-140` | build lines locally, join once. `MaxDescriptionLines=8` / `MaxDescriptionLineChars=300` stay build caps. **§6.2 decision lands HERE** |
| `Services/Knowledge/KnowledgeDraftApprovalService.cs:214, 1171, 1282` | `DescriptionLines` → `Description` |
| `Services/Knowledge/KnowledgeDraftImageMatcher.cs` | read; adjust shape |
| `Services/Voice/ProviderCatalogSearchService.cs:321, 530` | `Join(" ", …)` → the string; keep `Sanitize` + char caps |
| `Services/Voice/FullProviderContextService.cs:454` | `Description = service.Description ?? []` → string; **`ProviderContextModels` changes with it** |

## 5.4 `clinqetmcp`

| File | Change |
|---|---|
| `Tools/ServiceManagementTools.cs:125` | create: `new List<string>{…}` → the string |
| `…:195` | ‼️ **STOP replacing the description with one line** (§2.4) — assign the string |
| `Tools/BookingTools.cs:961, 1510` | `.FirstOrDefault()` → **first line** via a shared summary helper |
| `Tools/PartnerTransactionTools.cs:324, 423` | same |
| `Program.cs:470` | `description = e.Value.Description` — verify the target shape |

## 5.5 `clinqetfuncations`

No production file references `Service.Description` directly (the change-feed path goes via
`AzureSearchIndexer`). **Verify by grep after §5.3 — do not assume.**

## 5.6 Out of repo

`C:\Nik\ai-cost-quality\test-harness\Corpus.cs:88` — `string.Join(" ", s.Description)`. Not a repo;
update so the harness still compiles.

## 5.7 ‼️ CLIENT FOLLOW-UP — small, but do not miss it

The helpers in §3.1 already accept a string, so **no read site moves**. Exactly one thing changes:

- `descriptionToPayload` in **both partner repos** must return `toLines(text).join("\n")` instead of
  the array — and `null` (not `""`) when empty, so the tri-state clearing semantics stay honest.
- Update `clinqetwebpartnerapp/src/utils/serviceDescription.test.js` (the round-trip suite) to expect a
  string, and add the mobile twin if not yet present.
- `clinqetmobilepartnerapp/src/services/knowledgeService.ts:137, 218` (`descriptionLines: string[]`)
  and `__tests__/knowledgeDraftUpToOptional.test.tsx:26` follow the §5.2 DTO rename.
- The knowledge-draft editors (`KnowledgeDraftEditModal.jsx:56/132`,
  `KnowledgeDraftEditSheet.tsx:138/207`) become `draft.description || ""` and `description: text`, and
  should then **call the shared helper** so there is one convention, not two.

## 5.8 The 38 test files that must be converted

Verified by sweep on 2026-09-03. ‼️ **Re-derive it yourself first** — the tree moves:

```bash
grep -rl "Description = new List<string>\|DescriptionParagraphs\|DescriptionLines\|service\.Description\|svc\.Description" \
  --include=*Tests.cs --include=*TestData*.cs --include=*Builder.cs \
  clinqetapi clinqetfuncations clinqetmcp | grep -v "/obj/" | grep -v "/bin/" | sort
```

‼️ **Not every `Description` hit is this field.** `AdminAlertMessage.Description`,
`Category.Description`, `BusinessProfile.Description` and billing-plan descriptions are unrelated
strings. **Judge each hit individually** — assuming otherwise is exactly the error this programme
exists to fix.

‼️ **Two are SHARED FIXTURES — change them first, then let the compiler find the rest:**
`clinqetapi/Clinqet.API.UnitTests/Helpers/TestDataBuilder.cs` ·
`clinqetapi/Clinqet.API.IntegrationTests/Helpers/CosmosRepositoryTestData.cs`

- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/BookingControllerTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/CategoryControllerTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/DashboardControllerTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/InvoiceControllerTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/KnowledgeServiceDraftsIntegrationTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/OfferControllerTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/QuoteControllerTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/ServiceApprovalControllerTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/ServiceControllerTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Controllers/ServiceNameResolutionIntegrationTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Helpers/CosmosRepositoryTestData.cs` ‼️ shared
- `clinqetapi/Clinqet.API.IntegrationTests/Repositories/BusinessPartitionPurgeCosmosTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Repositories/CategoryRepositoryIntegrationTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Repositories/CosmosRepositoryQueryIntegrationTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Services/CatalogManifestImportIntegrationTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Tests/ProviderIndexCosmosIntegrationTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Tests/ServiceValidationDirtyCheckIntegrationTests.cs`
- `clinqetapi/Clinqet.API.IntegrationTests/Tests/UnlistedServiceLineIntegrationTests.cs`
- `clinqetapi/Clinqet.API.UnitTests/Controllers/CategoryControllerTests.cs`
- `clinqetapi/Clinqet.API.UnitTests/Controllers/ServiceControllerTests.cs`
- `clinqetapi/Clinqet.API.UnitTests/Helpers/TestDataBuilder.cs` ‼️ shared
- `clinqetapi/Clinqet.API.UnitTests/Services/AI/CatalogManifestServiceTests.cs`
- `clinqetapi/Clinqet.API.UnitTests/Services/AI/McpServiceTests.cs`
- `clinqetapi/Clinqet.API.UnitTests/Services/AI/ProviderSetupServiceWriterDescriptionTests.cs`
- `clinqetapi/Clinqet.API.UnitTests/Services/AzureSearchIndexerHashReuseTests.cs`
- `clinqetapi/Clinqet.API.UnitTests/Services/AzureSearchIndexerPrefetchTests.cs`
- `clinqetapi/Clinqet.API.UnitTests/Services/KnowledgeDraftApprovalServiceTests.cs`
- `clinqetfuncations/…/IntegrationTests/Tests/Functions/ChangeFeedFailureReplayFunctionIntegrationTests.cs`
- `clinqetfuncations/…/IntegrationTests/Tests/Functions/SearchIndexSyncFunctionIntegrationTests.cs`
- `clinqetfuncations/…/IntegrationTests/Tests/Services/KnowledgeServiceDraftAnalyticsJobIntegrationTests.cs`
- `clinqetfuncations/…/UnitTests/Functions/BroadcastUpdateNotificationFunctionTests.cs`
- `clinqetfuncations/…/UnitTests/Functions/SearchIndexSyncFunctionTests.cs`
- `clinqetfuncations/…/UnitTests/Knowledge/KnowledgeServiceDraftBuilderTests.cs`
- `clinqetfuncations/…/UnitTests/Voice/RealtimeSessionPayloadBuilderTests.cs`
- `clinqetmcp/Clinqet.Mcp.IntegrationTests/Fixtures/McpTestData.cs`
- `clinqetmcp/Clinqet.Mcp.IntegrationTests/Tests/PartnerToolIntegrationTests.cs`
- `clinqetmcp/Clinqet.Mcp.UnitTests/Services/ProviderCatalogCandidateRetrievalTests.cs`
- `clinqetmcp/Clinqet.Mcp.UnitTests/Tools/ServiceManagementToolsTests.cs`

Known assertions that will need rewriting, not just retyping:
`CatalogManifestImportIntegrationTests.cs:316-319` asserts `Description.Count == 3` and indexes
`[1]`/`[2]` · `ServiceManagementToolsTests.cs:367` asserts `new List<string> { "New Desc" }` ·
`ProviderSetupServiceWriterDescriptionTests.cs:83, 93, 106` assert single-element lists.

---

# PART 6 — DATA

## 6.1 Existing documents — DROP AND RE-IMPORT (owner's choice)

`string?` cannot deserialise a stored JSON array, so every existing Service document must go.

- Services are dropped, then the **dealer catalog manifest is re-imported**. Ids are
  `DeterministicGuid.Create(businessId, "service", externalId)` so a re-import **converges on the same
  ids** — no duplicates. **No migration script. No backfill.**
- After re-import, verify via `GET /business/services` that descriptions are strings with the expected
  `\n` count, and that the search index repopulated through the ProviderData change feed.

## 6.2 ‼️ THE ONE OPEN DECISION — ask the owner before you start

`KnowledgeServiceDraftBuilder.cs:134-140` appends raw source-table cells, producing `id:`, `url:`,
`category:`, `manufacturer:` lines on 26 live services' **public pages**.

**Proposal:** filter machine cells at the source — drop a cell that is a bare URL, or whose `key:`
prefix matches a machine key set (`id`, `url`, `slug`, `sku`, `ref`, `guid`, and `category` when it is
a path).

‼️ **SEQUENCING TRAP:** because §6.1 is drop-and-re-import, this filter **must land BEFORE any
re-import or re-extraction**, or the junk comes straight back.

**Present the §0.7-style table and WAIT for an answer. Do not decide this yourself.**

---

# PART 7 — TESTS

‼️ **§0.18 — a library class is tested from the suite of the HOST that invokes it.** Voice/call-control
and functions-consumed classes ⇒ `Clinqet.Communications.*`. Relay/MCP ⇒ `Clinqet.Mcp.*`. API-consumed
⇒ `Clinqet.API.*`. Never park a test where it is convenient.

## 7.1 Unit — new

- `ValidServiceDescriptionAttribute`: at cap, one over, null, empty, whitespace-only, exactly 5,000.
- `ServiceMappingExtensions`: create / update / clone; ‼️ **`""` clears, `null` leaves untouched**.
- `CatalogManifestService`: still the 3-part shape, now `\n`-joined; per-part and total caps.
- `KnowledgeServiceDraftBuilder`: 8-line cap honoured after the join; §6.2 filter if approved.
- `ProviderSetupServiceWriter`: **an empty extraction never overwrites a provider-written description**
  (extend `ProviderSetupServiceWriterDescriptionTests`).
- ‼️ `ServiceManagementTools`: **update no longer collapses a multi-line description** — regression
  guard for §2.4, which had no test and must never return.
- `AzureSearchIndexer`: the enrichment hash changes when the description changes.
- Repository **SQL string-shape** tests for both rewritten queries (the emulator is more permissive
  than production — assert the SQL text).

## 7.2 Integration — MANDATORY (schema change), Testcontainers + Cosmos emulator

- Create → point-read → update → re-read: a 3-line description survives byte-for-byte.
- `SearchServicesByNameOrDescriptionAsync` **now matches a term spanning a line break** — the new win.
- The multi-term provider search (`:307`) still matches per term.
- Change feed → search index carries the full description.
- Cap rejection returns the localized key, not a 500.

"Skip because slow" is **not acceptable** for a schema change.

## 7.3 Client

- Extend the existing round-trip suite (§5.7). It is the test that was impossible to write against four
  scattered `[0]`s — keep it that way.

## 7.4 Then

Build every affected project. Run every affected suite to **100%**. ESLint **zero errors** on all four
client repos. ‼️ Never re-run a slow suite you already have evidence for — filter to the class.

---

# PART 8 — CODING STANDARDS (BINDING — the owner's own words)

## 8.1 The "Zero" rules

- **Zero assumptions.** Read and analyse the entire codebase involved, however large, before writing a
  line. Never assume "this is probably how X works" — read the code that implements X.
- **Zero hallucinations.** Every file path, symbol, setting key, container, queue and enum you cite
  must exist. Verify with Glob/Grep/Read first. Never describe behaviour you have not read.
- **Zero workarounds.** If the correct fix is hard, write the correct fix. Never `--no-verify`, never
  bypass validation, never swallow an exception, never `// TODO: fix later`, never skip a failing test.
- **Plan first.** Analyse, form the architecture, then execute.
- **Ask if unsure.** A clarifying question always costs less than an unintended change.

## 8.2 Pre-production freedom

- **No legacy constraints.** Never write backward-compatible shims or backfill logic for older
  structures. If a large refactor is the correct solution, **do the refactor**.
- **State resets are fine** — data can be dropped and recreated. Optimise for the best end state.

## 8.3 Backend and infrastructure

- Hyper-optimised, production-ready. Async where optimal and **100% thread-safe**.
- **Zero memory leaks, zero CPU leaks, zero resource exhaustion.** Proper `IDisposable`/
  `IAsyncDisposable`, `using`/`await using`.
- Atomic Cosmos PATCH for counters; ETag concurrency for multi-writer entities; idempotent Service Bus
  handlers (every redelivery produces the same result); no infinite retries or unbounded loops.
- Structured logging only — `_logger.LogInformation("… {Id}", id)`, never interpolation.
- Performance and cost are first-class: Cosmos RU, Service Bus message count, index size, AI calls.
  Prefer point reads over queries when the id is known.

## 8.4 Frontend

- **Strict alignment** with the existing design system — colours, typography, spacing, components.
  Brand green `#97EF29` fills the chosen/primary action; navy `#032858` is ink and headings.
- **Mobile-first and flawless on phone and iPad** — the primary audience. Tap targets ≥44px.
- Crisp, fast routing. **No redundant or duplicate API calls.**
- **New page or interface ⇒ isolated HTML mockup FIRST**, under `C:\Nik\Data\mockups\<sheet-name>\`,
  showing web AND mobile and **every state**, approved by the owner **before** integrated UI code.
  (A restyle of an existing control is not a new interface.)

## 8.5 Localization — zero hardcoded user-facing text

- Every string is a key: `react-intl` (partner/user web), i18n (admin), `ILocalizationService` (API).
- New keys go in **`en.json` AND every other language file**. Email templates: one JSON per language.
- Admin-internal alert wording is the only exception.
- ‼️ **NO TECHNICAL WORD a provider can read.** "passage", "chunk", "index", "embedding", "token",
  "payload", "endpoint", "array", "field", "newline" mean nothing to a salon owner. Say *line*,
  *point*, *page*, *text*, *saved*.
- ‼️ **Insert keys surgically. Never rewrite or reparse a localization file** — another session may
  hold edits in it. Verify afterwards that their lines survive.

## 8.6 Edge cases and resilience — a standing rule, not just a task

- **Exhaustive exploration.** Never limit scope to the happy path. Anticipate, explore and handle
  **every** possible edge case. Part 9 is the floor for this change; the standard is permanent.
- **Fail-safes.** Account for network errors, latency, null states, missing data and broken
  connections on **both** frontend and backend. The solution must survive all of them gracefully.
- **Watertight logic.** Zero gaps, zero bugs. Cover every logical pathway — every branch reachable,
  every branch correct.

## 8.7 Comments — terse, only when earned

- **Default is NO comment.** Add one only for a non-obvious **WHY**, an invariant, a gotcha, or a spec
  reference. **One short line, max.**
- **NEVER narrate what the code does.** No method-summary paragraphs, no step-by-step narration, no
  commented-out code, no `// TODO` without an issue link, no change-log notes.
- If a comment needs multiple lines to say *what* happens, the code is wrong — refactor it.

## 8.8 Config and cleanliness

- Use appsettings and enums; no magic numbers. Options-class defaults must mirror `appsettings.json`.
- Any new setting needs a runtime reader before merge; any removed setting is deleted along with its
  options class and DI binding.
- Any new Azure resource or `local.settings.json` key ⇒ ARM + `deploy.ps1` **in the same change**.
- Delete what your change orphans: dead code, unused imports, unreferenced helpers, stale DI.
- ‼️ **`git status --porcelain` must be clean of scratch files at the end — and you must LOOK at it.**
  State in your summary what you removed.

## 8.9 Explicit recommendations

Whenever you present options, **name your recommended one and say why** in one or two lines, so the
owner can decide fast.

---

# PART 9 — ‼️ EDGE CASES: VISUALISE, BRAINSTORM, THEN PROVE

> **The owner's strongest requirement: "edge case scenario is extremely critical, and that's something
> you have to visualize… expect the unexpected, and it needs to work for all."**

The list below is a **floor, not a ceiling**. **Brainstorm beyond it.** For every scenario, state what
the correct behaviour is and prove it — by test where testable, by reasoned trace otherwise.

## 9.1 Where a service can come from — every producer must round-trip

| # | Origin | What to visualise |
|---|---|---|
| 1 | **Manual** — provider types in the web form | 1 line · 40 lines · pasted Word text with `\r\n` · pasted with trailing blank lines · emoji · RTL · a lone `·` |
| 2 | **Manual** — provider types on mobile | same, plus iOS smart punctuation and Android autocorrect |
| 3 | **AI Quick Profile Setup** (`ProviderSetupServiceWriter`) | AI returns 0 parts · 1 part · 20 parts · empty strings · ‼️ **an empty extraction must NEVER overwrite a provider-written description** |
| 4 | **Knowledge extraction** (`KnowledgeServiceDraftBuilder`) | 8-line cap · 300-char cap · duplicate cells · machine cells (§6.2) · a table row with one cell |
| 5 | **Knowledge draft approve / approve-update / approve-as-change** | the provider edited the draft text first · batch approve · replay |
| 6 | **Dealer catalog manifest** (`CatalogManifestService`) | 3-part shape · 4,000-char part · re-import of the SAME `externalId` (deterministic id ⇒ update, not duplicate) · missing features · missing price note |
| 7 | **Voice AI / MCP** (`ServiceManagementTools`) | create with no description · update description only · ‼️ **update must not wipe the rest** · concurrent with a web edit |
| 8 | **Duplicate/clone a service** | full text carried; ids not carried |
| 9 | **Admin approve/reject** | description untouched |

## 9.2 Data-shape edge cases

- `null` description (‼️ real — the entity has **no initializer**) · empty string · whitespace only.
- A **stored array** arriving after deploy from a cached response, a service worker, or a persisted
  cart — the client helpers already tolerate it; **keep that tolerance**.
- Exactly 5,000 chars · 5,001 · a 5,000-char single line with no `\n`.
- `\r\n` vs `\n` vs `\r` · a trailing newline · leading blank lines · 50 consecutive blank lines.
- Unicode: emoji, combining marks, RTL (Arabic/Hebrew), CJK, Gujarati/Hindi (both are shipped locales),
  a zero-width space, a `\u2028` line separator.
- Text that looks like markup (`<b>`, `&amp;`) — **must render as literal text, never as markup.**
- A description containing `·` (the salon case that breaks any chip-parsing heuristic).

## 9.3 Concurrency and failure

- Two sessions editing the same service — **ETag 412** must fail gracefully with a clear error, never
  silently overwrite.
- Web edit vs voice-AI edit at the same moment.
- Change feed fires mid-edit; the search index must converge, not thrash.
- Service Bus **redelivery** of a media/enrichment message — idempotent.
- The AI enrichment call fails / times out / returns empty — description must survive untouched.
- Cosmos 429 (the SDK retries — do not layer your own).
- Network drop between SAS upload and confirm.
- Save while offline; save with an expired token (401 → refresh → retry).

## 9.4 Permission, tenancy, lifecycle

- Read-only role: Edit affordance **absent**, not disabled, on **both** dashboard modals.
- Deep link `?serviceId=` carrying a **foreign `businessId`** → workspace switch or clean refusal;
  never a cross-tenant read.
- Deep link to a **deleted** service · an **inactive** one · one in another business.
- Permission revoked between opening the modal and pressing Edit.
- Onboarding context (`entryContext="onboarding"`) — ‼️ **no tap target may navigate away.**
- Service soft-deleted (TTL set) while the editor is open.

## 9.5 UI and rendering

- A 40-line description in the auto-grow box → grows to the max, then scrolls; never traps the page.
- 320px width · iPad · 1440px. Long service name + Edit pill must not collide.
- Dark mode on both mobile apps.
- A service with **no image** — the Edit pill must read over the letter-gradient fallback.
- Screen reader: the pill has a label; the counter is not announced as content.
- The counter must never overlap the AI/microphone buttons (that is why it is bottom-left).

## 9.6 Search, AI and analytics

- A term spanning a line break — **must now match** (the new win; assert it).
- A term in line 8 of an 8-line description.
- Empty query · a query of only spaces · a 500-char query · regex metacharacters.
- Embedding + `CommonSearchPhrases` still generated; the enrichment hash still changes on edit.
- ‼️ **Analytics collection must not change in any way** — every field and metric stays intact.

---

# PART 10 — THE MULTI-DIMENSIONAL AUDIT (run at the END, skip nothing)

> Owner: *"make sure there is no bug, we haven't missed any part, all the changes have been done
> correctly, and most importantly there is no flow gap, no information gap, no logical gap."*

**RULE ZERO: fix the CLASS, not the instance.** If you find one bad call site, find every site of that
shape and fix them all — that is the entire lesson of this programme.

| # | Dimension | Must prove |
|---|---|---|
| 1 | **Flow gap** | Trace all 9 origins in §9.1 end to end: producer → store → every reader → editor → store. Draw the trace. Any path you cannot walk is a gap |
| 2 | **Information gap** | No text is lost or invented at any hop. Byte-for-byte round-trip on the 2-, 3- and 8-line shapes |
| 3 | **Logical gap** | Every branch reachable and correct: null vs empty vs whitespace; `""` clears vs `null` preserves; summary vs full text at every site |
| 4 | **Completeness** | `grep -rn "description\[0\]\|description?\.\[0\]"` = **0** in all four client repos. No `List<string>` description anywhere. All 19 `.cs` + 38 test files converted (§5.8) |
| 5 | **Edge cases (§9)** | Every scenario has a stated correct behaviour and a proof. **Brainstorm beyond the list and say what you added** |
| 6 | **Permission / tenancy** | §9.4 in full; no cross-tenant read; Edit absent not disabled |
| 7 | **Localization** | Every string a key in **all 5** languages, both partner apps; parity + integrity tests green; §8.5 wording ban honoured; **no orphaned keys** |
| 8 | **Responsive & mobile** | 320/375/768/1024/1440. Tap targets ≥44px. RN verified on **iOS and Android**. No horizontal scroll |
| 9 | **States** | Every touched surface: empty, loading, error, offline, permission-denied, cap-reached, image-processing, read-only |
| 10 | **Search / AI / analytics** | Both Cosmos queries; Azure Search doc + embedding + enrichment hash; voice provider context; MCP tools; **analytics unchanged** |
| 11 | **Concurrency & resources** | §9.3; thread safety; no leaked disposables; no unbounded loop |
| 12 | **Cleanliness** | No scratch file anywhere; `git status --porcelain` inspected; no dead code, unused imports, orphan settings or stale DI |

Also: **re-verify every SKILL claim.** A skill that still says `description: List<string>` after this
lands is worse than no skill.

---

# PART 11 — DEFINITION OF DONE

- [ ] Start gate green — all **ten** repos at 0 modified files (§0.2)
- [ ] **§6.2 machine-text filter: owner asked and answered**, and landed BEFORE any re-import
- [ ] 19 production `.cs` files converted; 38 test files updated (§5.8); out-of-repo harness compiles
- [ ] §5.7 client follow-up done; grep guard returns 0
- [ ] `ValidServiceDescriptionAttribute` at 5,000 chars, localized in all 5 server languages
- [ ] Every affected suite builds and passes **100%**; ESLint **zero** on all four client repos
- [ ] Integration tests against real SQL + the Cosmos emulator (schema change ⇒ mandatory)
- [ ] Data dropped and re-imported; verified via the API and the search index
- [ ] §9 edge cases visualised, extended, and proven
- [ ] §10 audit run, all 12 dimensions, every finding fixed or explicitly accepted by the owner
- [ ] SKILL updated in **all four** AI-tool directories — `clinqet-service-listing`,
      `clinqet-cosmos-data`, `clinqet-search-discovery`, `clinqet-ai-assistant`,
      `clinqet-voice-assistant`, the four app skills, `clinqet-provider-public-page`
- [ ] Memory entry + `MEMORY.md` index line updated
- [ ] `git status --porcelain` inspected and clean of scratch files; **stated in the summary**
- [ ] Commits prepared in pipeline order. ‼️ **Owner pushes and deploys — never `git push`**
