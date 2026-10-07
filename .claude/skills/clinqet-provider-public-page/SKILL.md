---
name: clinqet-provider-public-page
description: |
  **CORE FEATURE SKILL** — The provider's public page ("Open Page") and every
  public surface around it, on the CUSTOMER web app (`clinqetwebuserapp`):
  `/{friendlyName}`, `/{friendlyName}/services/{serviceSlug}`, the category /
  category-x-city / city landing pages, the cities index, `/categories`, the
  sitemap chain, robots, llms.txt, structured data, slug lifecycle and 301s,
  and the public-visibility predicate that gates all of it.
  USE FOR: public routing + SSR data loading, the D1 visibility predicate,
  friendly-name policy + slug history + 301s, per-service pages, landing pages,
  sitemap index + children (including the pre-generated services sitemap),
  schema.org, the honesty rule on public copy, deep links into these URLs.
  Applies to clinqetwebuserapp app/[friendlyName]/**, app/(customer)/services/**,
  app/sitemap*/**, app/robots.js, lib/server/**, lib/seo/**,
  clinqetapi Controllers/BusinessProfileController + CategoryController +
  AvailabilityController + OfferController + PortfolioController +
  ReviewController (public routes) + Controllers/Seo/**,
  clinqetinfrastructure/Services/Seo/**, clinqetcore/Utilities/
  ProviderPublicVisibility + ServiceIndexGates + SeoSlug,
  clinqetidentity UserProfileController (friendly-name + public resolve).
---

# CLINQET PROVIDER PUBLIC PAGE — COMPREHENSIVE SKILL

> **This file was rewritten 2026-07-26 (SEO session 7).** The previous version described the partner
> app's `/public/provider?id=` preview as the Open Page. That surface **has been deleted** — it called
> five API routes that never existed. The canonical public page has been the customer app since
> session 1. Everything below is verified against the working tree.

**Governing plan:** `C:\Nik\SEO-INDEXING-MASTER-PLAN.md`. §13 is the running record; §13.0 is the
rule that no new SQL table/column/index, Cosmos container/field, API endpoint, Azure resource, or
WAF/Front Door change happens without the owner's explicit approval, asked for FIRST.

---

## 1. WHERE THE PUBLIC PAGE LIVES

| URL | Route file | Rendering |
|---|---|---|
| `/{friendlyName}` | `app/[friendlyName]/page.js` | SSR + client islands, `revalidate = 3600` |
| `/{friendlyName}/services/{serviceSlug}` | `app/[friendlyName]/services/[serviceSlug]/page.js` | SSR, `revalidate = 3600` |
| `/services/{categorySlug}` | `app/(customer)/services/[categorySlug]/page.js` | SSR, `revalidate = 21600` |
| `/services/{categorySlug}/{citySlug}` | `.../[categorySlug]/[citySlug]/page.js` | SSR, `revalidate = 21600` |
| `/services/city/{citySlug}` | `.../services/city/[citySlug]/page.js` | SSR |
| `/services/cities` | `.../services/cities/page.js` | `dynamic = "force-dynamic"` |
| `/categories` | `app/(customer)/categories/page.js` | `dynamic = "force-dynamic"` |
| `/` | `app/page.js` | `dynamic = "force-dynamic"` |

**`/details?id=` is GONE** (D25). It rendered the same `BusinessProfile` component as
`/{friendlyName}` — a client-only duplicate of the most important SEO page. It is now a permanent
redirect declared in `next.config.mjs`: `/details?id=X` → `/X`, bare `/details` → `/services`.
Order matters — the id-capturing rule must come first. Locked by `utils/duplicateSurfaceRedirects.test.js`.

**The partner app has NO public provider surface.** `business.clinket.com/public/*` is disallowed in
`clinqetwebpartnerapp/src/app/robots.js`, and the only route left under it is the anonymous
booking-tracking screen.

---

## 2. ‼️ THE THREE TRAPS THAT HAVE BITTEN THIS PAGE

1. **A `loading.js` turns `notFound()` into a soft 404.** Any `loading.js` at or above a page makes
   Next stream and commit **HTTP 200** before the page can call `notFound()`. Every unknown provider,
   service, category and city answered 200 with "not found" content. Only visible against
   `next start` — never `next dev`, and no props-based test can see it. Locked by
   `utils/notFoundStatus.test.js`, a structural guard.
2. **`useSearchParams()` blanks its closest Suspense boundary during prerender.** It once emptied the
   entire app's HTML. Never put a search-params reader in the same boundary as `{children}`. Locked
   by `utils/prerenderSafety.test.js`.
3. **A static route bakes build-time data.** `/`, `/categories` and `/services/cities` prerendered
   with an unreachable API and ISR served that for 6h after every deploy. They are `force-dynamic`
   now; the *data* cache still absorbs crawl traffic.

---

## 3. THE VISIBILITY PREDICATE (D1) — ONE RULE, FOUR CONSUMERS

`Clinqet.Core.Utilities.ProviderPublicVisibility.IsPubliclyListed(BusinessProfile)`:

> **name + an address with a city, and status NOT `Pending` and NOT `Suspended`.**

Three things are **deliberately not checked**, each locked by a named regression test carrying a
"do not fix this back" comment:
- **services** — a name + address is a legitimate directory page; gating on services hides providers
  mid-catalogue.
- **`IsListed`** (the pause toggle) — pausing stops leads, it must not delete them from Google.
- **`Inactive`** status — temporary and self-chosen, same reasoning.

**Consumers, all reading the same rule:**
1. **Sitemap projection** — `ProviderListingProjectionService`, driven by the ProviderData change
   feed, materialises the verdict onto SQL `UserProfile.IsPubliclyListed`.
2. **Customer SSR resolver** — `lib/server/providerPageData.js` `isPubliclyVisible()` mirrors it
   case-for-case in JS.
3. **Public API endpoints** — via `IProviderPublicVisibilityGate` (session 7, Phase 3.1).
4. **Search indexer** — gates on `Active` + `IsListed`.

### 3.1 The public-endpoint gate

`IProviderPublicVisibilityGate` / `ProviderPublicVisibilityGate`
(`clinqetinfrastructure/Services/Seo/`). Scoped; the verdict rides the shared `IMemoryCache`
(`Size = 1`, CLAUDE §14) for `BusinessProfile:PublicVisibilityCacheSeconds` (default 60).

A provider page render fans out to six public endpoints within milliseconds; without the cache that
would be six profile point-reads. `GetMyPublicBusinessProfile` evaluates the predicate on the profile
it **already read** and calls `Remember(...)`, so a whole page render costs **one** point read.

Gated endpoints (all `[AllowAnonymous]`):
`public/business/{id}/profile` · `/availability` · `/categories/services` · `/portfolios` ·
`/offers` · `public/businesses/{id}/reviews` · `/ratings` · `/services/{sid}/ratings` ·
`/services/ratings` · `/services/{sid}/reviews`

‼️ **The review and rating routes exempt the owner and admins.** Partner web
(`services/profileServices.js`) and partner mobile (`ReviewsApi.ts`) read those *same public routes*
for the provider's own Reviews screen — a blanket gate would blank a Pending or Suspended provider's
own dashboard. `ReviewController.IsHiddenFromPublicAsync` orders the checks so an anonymous hit on a
live provider costs one cached lookup and nothing else.

Setting `PublicVisibilityCacheSeconds = 0` disables the cache (read-through); the integration
fixture does exactly that so the lifecycle tests assert the predicate, not a cached verdict.

### 3.2 What the services payload may contain

`GET public/business/{id}/categories/services` filters with
`ServiceIndexGates.IsIndexable(isActive, isDeleted, approvalStatus)` — the **same** gate the search
indexer uses. So every row in that payload is publicly listable, which is what makes D19 ("service
pages = active + approved, nothing else") enforceable in exactly one place.
‼️ The **authenticated** provider route (`categories/selections/services`) is deliberately NOT gated
— a provider must still see their own draft work.

`GET public/business/{id}/offers` returns only **live** offers regardless of the `filter` value.
`Deactivated` / `Past` / `All` are provider-management views; the authenticated route keeps them.

---

## 4. SLUG LIFECYCLE (D3 + D7)

**Policy (D7):** `^[a-z0-9-]+$`, 3–20 characters, stored and compared **lowercase**.
Config: `clinqetidentity appsettings.json` → `FriendlyName:{MinLength,MaxLength,AllowedPattern,ReservedWords}`.
One policy module per client — never re-declare the pattern at a call site:
- partner web: `src/lib/friendlyNamePolicy.js`
- partner mobile: `src/Util/friendlyNameUtils.ts`
Both normalise as the provider types, so the URL previewed is the URL stored.
‼️ Suggestion generators must emit candidates that satisfy the policy — including the 20-char cap.

**History (D3):** SQL table `UserFriendlyNameHistory` (retired name — unique, owning user,
replacedAt). `FriendlyNameHistoryStore` (`clinqetinfrastructure/Services/Auth/`) owns it.
- Written only on rename or removal, **tracked not saved**, so the caller's own `UpdateAsync` commits
  it in the same transaction as the rename.
- Read only after the current-name and userNumber lookups have both missed — **a real provider page
  never touches the table.**
- **No query filter**, deliberately: a slug retired by an account that later deactivated must still
  read as TAKEN. Resolution loads the owner through the **filtered** `Users` set, so a deleted
  owner's old URL 404s instead of 301ing to a dead page.
- Re-claiming your own retired slug deletes the history row, so the two tables never contradict.

**Resolution order** (`UserProfileController.GetPublicProfile`):
current FriendlyName → UserNumber → retired-slug history → 404.

**The 301** is one rule in `lib/server/providerPageData.js`:

```js
canonicalRedirectFor(requestedSlug, canonicalSlug)  // null when already canonical
```

Identity always answers with the provider's **current** name, so one comparison covers a rename, a
chain of renames (**one hop** — history points at the OWNER, never at the previous name), a
businessId URL, and a case variant. `withQueryString` carries deep-link params through so a 301 can
never break `?serviceId=…&book=1`. Applied by both `/{friendlyName}` and the service page via
`permanentRedirect()` (Next emits **308**; Google treats 301 and 308 identically).

---

## 5. THE SITEMAP CHAIN

```
/sitemap.xml (index)
  ├── /sitemap/static.xml          hand-listed routes, deliberately NO lastmod
  ├── /sitemap/discovery.xml       every eligible category / city / combo, from the cached catalog
  ├── /sitemap/providers/{n}.xml   SQL keyset on IX_UserProfile_PublicListing_Sequence, zero Cosmos
  └── /sitemap/services/{n}.xml    PRE-GENERATED gzipped files (Phase 8 / D23)
```

Non-prod returns an empty `<sitemapindex>`. Chunks are append-stable via the never-reissued
`PublicListingSequence`, so settled chunks stay byte-stable and keep their old `lastmod`.

### 5.1 The services sitemap (Phase 8 / D23)

**SQL says WHO changed** (`UserProfile.PublicListingUpdatedAt`, already stamped on every service
write). **Cosmos says WHAT they have** (one single-partition read per changed provider). Source is
Cosmos, **not** the search index: the indexer skips `Inactive` providers but D1 keeps their pages
public, so a search-built sitemap would advertise the provider page and silently drop every one of
their service URLs.

- `ServicesSitemapService` (`clinqetinfrastructure/Services/Seo/`) builds it.
- `ServicesSitemapFunction` — nightly timer, 02:30. Timer triggers are singleton by runtime design;
  **there is no `[Singleton]` attribute in the isolated worker model.**
- Output: `services/services-{group}.xml.gz` in the **`sitemaps`** blob container (`publicAccess: None`).
- **The manifest is written LAST**, so a half-finished run can never publish. The sitemap index lists
  exactly what the manifest names — never a computed count.
- Guards: >20% URL drop ⇒ refuse to publish + admin alert; a group whose Cosmos read fails keeps
  yesterday's file; an unknown chunk name is a 404, not a blob probe.
- Served by `GET /api/v1/public/sitemap/services/{chunk}` (streams the gzip straight through) and
  proxied by `app/sitemap/services/[chunk]/route.js`. **Zero database on the crawl path.**

‼️ **Settings split** (CLAUDE §4): `ServicesSitemap:CronExpression` is a `%…%` **trigger binding**, so
it lives in **`local.settings.json`** and in `deploy.ps1` as `ServicesSitemap__CronExpression` — NOT
in the Function App `appsettings.json`. Everything read through `IOptions` goes in `appsettings.json`.

### 5.2 Slugs

`clinqetwebuserapp/lib/seo/slug.js` is the reference implementation. Two more exist because they must:
`Clinqet.Core.Utilities.SeoSlug` (the sitemap job writes XML server-side) and
`clinqetmobileuserapp/src/utils/serviceSlug.ts` (deep-link resolution).
‼️ **All three are pinned to one shared corpus** — `lib/seo/slugParity.test.js`,
`SeoSlugParityTests.cs`, `__tests__/serviceSlug.test.ts`. Change one, change all three.

---

## 6. STRUCTURED DATA — AND WHAT MUST NEVER BE INVENTED

`lib/seo/dynamic-seo.js` (provider), `lib/seo/serviceSeo.js` (service), `lib/seo/landingSeo.js`.

Emitted only from real fields:
- `priceRange` / `currenciesAccepted` — derived from the provider's own service prices; **omitted**
  when nothing real is known.
- `aggregateRating` — only when rating > 0 AND reviewCount > 0. It once published a fabricated
  1-star rating via `Math.max(1, …)`.
- `openingHoursSpecification` — only from days with `isConfigured === true`. The public availability
  endpoint returns `StartTime = null, EndTime = null` for unset days, so there is no invented range
  to publish.
- `Offer` on a service page — **omitted entirely** for quote-only services, never published as 0.
- `FAQPage` — on `/faqs`, and on landing pages for the **written** answers only. The computed
  questions (derived from live counts and prices) carry no schema.

---

## 7. THE HONESTY RULE (§4b) — BINDING ON EVERY PUBLIC STRING

Every number must be traceable to a field we measured, and scoped to what we measured.

| We CAN prove | We CANNOT prove |
|---|---|
| Services listed, per category/city/combo (facet counts) | Total professionals, platform-wide or per city |
| Towns and kinds of work (cached catalog lengths) | "Busiest" / "most popular" / "fastest responding" |
| Providers on ONE landing page, only when `TotalProvidersExact` | A platform-wide average rating |
| Min/max price (null ⇒ "Get a quote", never "$0") | That a quote request will find someone in an uncovered town |
| A provider's rating + review count, only when > 0 | Any emergency / 24-7 / response-time field — **none exists** |

Retired claims are locked by `utils/claimHonesty.test.js`.
**Vocabulary:** customers see **"Get Quotes"**; providers see **"Leads"**; only the backend says
`Broadcast`. "Clinking" is an invented word and must never appear anywhere — including comments.

---

## 8. LOCALIZATION

Every user-visible string is a `react-intl` key present in **all four** customer-web files
(`en-US`, `gu-IN`, `hi-IN`, `ja-JP`) with a real translation. `utils/localeParity.test.js` enforces
it; `KNOWN_UNTRANSLATED` freezes the 121 pre-existing gaps so no NEW gap can appear.
**Do not add, delete or complete any locale file** (D17).

Editorial FAQ content is **data**, not bundle copy: Cosmos `CodeDesc` (`type=faq`), one document per
language, served by `GET /public/lookup/codedesc/type/faq/code/{code}?language={lang}`.
- `userapp` — the customer help-centre set.
- `landing` — the written answers on category landing pages (true of every category).
There is **no hardcoded fallback**: the deleted `DEFAULT_FAQ` had drifted from the stored copy.
SSR always requests English (matching `lang="en"`); `FaqAccordion` re-fetches for another locale.

---

## 9. i18n STANCE (D8)

`<html lang="en">`, `og:locale` `en_US`, **no hreflang**. Single-locale routing with client-side
locale state is the honest declaration. **Do not half-implement hreflang.**

---

## 10. CHECKLIST BEFORE MERGE

- [ ] No `loading.js` at or above any page that calls `notFound()`.
- [ ] No `useSearchParams()` sharing a Suspense boundary with `{children}`.
- [ ] Status codes verified against `next build` + `next start` — never `next dev`.
- [ ] Any new public business-scoped endpoint goes through `IProviderPublicVisibilityGate`, and every
      consumer swept first (the provider's own dashboard reads public review routes).
- [ ] Every user-visible number traceable to a named field (§4b); no "Clinking", no "Broadcast".
- [ ] Every new string in all four customer-web language files with a real translation.
- [ ] Slug changes replicated across all three implementations + the shared parity corpus.
- [ ] Sitemap can never advertise a URL whose page 404s (validate against the cached catalog).
- [ ] `IMemoryCache` writes set `Size = 1`.
- [ ] Function-app `%…%` trigger values in `local.settings.json` + `deploy.ps1`, not `appsettings.json`.
- [ ] Tap targets clear the WCAG 2.5.8 AA 24px floor; use `tap-44` / `tap-30` hit-area expansion
      rather than enlarging icons.
- [ ] jest + ESLint zero + `next build` clean + affected .NET suites green.

---

## CROSS-LINKS

`clinqet-user-app` · `clinqet-search-discovery` · `clinqet-main-api` · `clinqet-identity-api` ·
`clinqet-cosmos-data` · `clinqet-reviews` · `clinqet-service-listing` · `clinqet-media-derivatives` ·
`clinqet-customer-mobile` · `clinqet-provider-mobile` · `clinqet-deployment`

---

## DEEP LINKS — THE FOUR TRAPS (final audit, 2026-07-26)

The Universal Link / App Link surface carries `/{friendlyName}` and
`/{friendlyName}/services/{serviceSlug}` — the two most-linked URLs on the site. Every one of these
failed **silently**, with every JavaScript-side file correct and every test green.

**1 · An entitlements file Xcode never applies is inert.**
`clinqet.entitlements` declared `associated-domains` perfectly and `CODE_SIGN_ENTITLEMENTS` appeared
nowhere in `project.pbxproj` — the customer app shipped with no associated-domains at all and iOS
Universal Links were dead. **Declaring is not wiring.** Check the build setting, in every
configuration, not just the plist. Guarded by `universalLinkWiring.test.ts` in each app.

**2 · Parity must be checked in BOTH directions.**
Both apps asserted "everything I route is claimed by the association file" and both passed. Nobody
asked the reverse. `/*` claimed 57 customer routes against 20 routable; `/dashboard*` claimed 50+
partner routes against 30. Check the association file against **the web app's real routes on disk** —
the third source neither file mentions. `deepLinking.test.ts` now does.

**3 · A one-segment static page falling through to `:friendlyName` is worse than no match.**
`/reviews` opened a provider page for a business that does not exist — broken-looking, not merely
unhelpful. Two-segment paths (`/settings/*`) at least fail visibly. **A static page must be matched
by a LITERAL pattern**; if the catch-all is its only match, that is a defect.
`exclude` entries must be ordered **before** the wildcard — iOS takes the first match.

**4 · The team id is already in the repo.**
`DEVELOPMENT_TEAM` in `project.pbxproj`. The two apps use **different** teams (`KWXU56R372`
customer, `2225KLHB39` partner), so one hand-filled value is always wrong for one of them. Never
hand-fill a `<<FILL:>>` placeholder that the repo can answer, and cross-check the AASA `appIDs`
against `DEVELOPMENT_TEAM` + `PRODUCT_BUNDLE_IDENTIFIER` rather than asserting a literal.

**Neither native fix is verifiable without a Mac.** The guards prove the wiring structurally; the
on-device check in `SEO/DEEP-LINK-SETUP.md` is what confirms it.

---

## SETTINGS SPLIT — AND THE EDITOR THAT BREAKS IT

A `%Setting:Key%` trigger binding is resolved by the **HOST** from an environment variable. It
belongs in `local.settings.json` + `deploy.ps1`, **never** `appsettings.json`.

An `appsettings.json` copy is not harmless. `SearchIndexAudit:CronSchedule` lived in both and the
function logged the appsettings value as "the schedule it runs on" — which the host does not read.
**A log that confidently states a value it cannot know is worse than no log.**

‼️ **Never `sed -i` the config files in this repo.** `appsettings.json` (Function App) is UTF-8
**BOM + CRLF**; `sed -i` silently rewrote all 2311 line endings to bare LF. Same trap `deploy.ps1`
carries. Use `node`/`PowerShell`, and verify the byte shape afterwards — BOM, CRLF count, bare-LF
count — not just that the JSON parses.

---

## LOCALIZED VALIDATION MESSAGES — RESOLVE FIRST, FORMAT SECOND (fixed 2026-07-26)

MVC hands the localizer the **key plus the attribute's arguments** and expects it to resolve, then
format. `BaseController.ValidationFailed()` did the opposite — it localized `e.ErrorMessage` *after*
ASP.NET had already formatted — so the arguments were gone and **52 DTO annotation sites (25 distinct
keys) showed users a literal `{1}`/`{2}` in every language**: registration, profile, addresses, phone
and email length, verification codes, broadcasts, the AI assistant, policy consent.

**Four separate attempts at this fix already existed and every one was inert.** Same failure mode as
the iOS entitlements: written, plausible, wired to nothing.

| Attempt | Why it did nothing |
|---|---|
| `AddDataAnnotationsLocalization` + `DataAnnotationLocalizerProvider` | pointed at the default `ResourceManagerStringLocalizerFactory`, which wants `.resx` satellite assemblies that do not exist here |
| `StringLocalizerAdapter` | correct in principle, registered by **nothing** |
| `LocalizedValidationMetadataProvider` | registered in DI but never added to `MvcOptions.ModelMetadataDetailsProviders`, which is where MVC actually looks |
| `LocalizedModelValidatorProvider` | added to `MvcOptions` but skips any item whose `Validator` is already set — the built-in provider always sets it first |

Now live: `JsonStringLocalizerFactory` (`clinqetinfrastructure/Services/Language/`) `Replace`d over the
default factory in both API hosts. Culture comes from `CultureInfo.CurrentUICulture`, which
`UserCultureMiddleware` sets per request with the same precedence as `GetPreferredLanguage()`
(Accept-Language by q-value → `Locale` claim → default).

### ‼️ The placeholder index is decided by the ATTRIBUTE, not the sentence

`{0}` is **always the display name**. The numbers start at `{1}`, and the order differs per attribute:

| Attribute | Arguments after `{0}` |
|---|---|
| `StringLength` | `{1}`=max, `{2}`=min |
| `MaxLength` / `MinLength` | `{1}`=length |
| `Range` | `{1}`=min, `{2}`=max |
| `RegularExpression` | `{1}`=pattern |

**7 keys were authored as though `{0}` were the limit.** Enabling the localizer without fixing them
would have printed "Message must not exceed **Label_Message** characters" — a new, worse defect than
the one being fixed. 23 values were corrected across en/fr/gu/hi.
`ValidationMessagePlaceholderTests` (Clinqet.API.UnitTests/Conventions) now scans the real DTO source
and all four language files and fails the build on `{0}`-as-a-value, on an index the attribute cannot
supply, and on a translation whose placeholder set drifts from English.

**Manual `string.Format` call sites are a different convention** — there `{0}` is the first argument
you pass (see `ClinqetPasswordValidator`). The guard only scans DTO annotations, deliberately.

### Two fixture lies had to go first

Both integration factories installed a **no-op** localizer — the Identity one directly beneath a
comment reading *"Use REAL localization service for integration tests"* — and both declared only `en`
in `Localization:SupportedLanguages`. Between them, no test could observe a translation, a
per-request culture, or an unformatted placeholder. Both now install the real factory and mirror the
API's four languages.

‼️ **Verify this against a running host, never by reasoning about MVC provider ordering** — that is
exactly how it was missed four times. `ValidationMessageLocalizationTests` posts an invalid broadcast
and asserts "between 10 and 2000" (substitution *and* order), no `Error_`/`Label_` leak, Devanagari
for `hi`, Gujarati for `gu`, English fallback for an unsupported language.

### fr.json is a stub that is advertised as a language

311 keys against en.json's 2454, while `fr` **is** listed in `Localization:SupportedLanguages` — so a
French request is served ~87% English, silently. Owner decision: finish it or stop advertising it.

### The three dead attempts are DELETED (proved, not assumed)

Tripwire exceptions were planted in `LocalizedValidationMetadataProvider.CreateValidationMetadata` and
in the `LocalizedModelValidatorProvider` branch that assigns `LocalizedAttributeValidator`, then the
full API + Identity integration and unit suites were run with them armed: **2539 tests, zero tripwires
hit.** Both paths are unreachable — the metadata provider was never added to
`MvcOptions.ModelMetadataDetailsProviders`, and the validator provider skips every item because the
built-in DataAnnotations provider always sets `Validator` first.

`clinqetcore/Validation/LocalizedValidationMetadataProvider.cs` (all three classes) is deleted, with its
registrations in both hosts and both fixtures, the orphaned usings, and a now-pointless
`RemoveAll<IValidationMetadataProvider>()`. **One live localization path, no decoys** — a decoy that
looks like the fix is how this bug survived four attempts.

---

## INDEXNOW IS ON, AND IT IS A TWO-FILE HANDSHAKE (2026-07-26)

| Piece | Where |
|---|---|
| Key | `IndexNow:Key` in the Main API `appsettings.json` (committed value = PROD value) |
| Key file | `clinqetwebuserapp/public/{key}.txt` — the key verbatim, **no trailing newline** |
| Per-env gate | `deploy.ps1`: `IndexNow__Enabled` true on prod / false elsewhere, `IndexNow__Host` = `www.$CustomerApexDomain`; both in `$script:RequiredApiAppSettings` |

‼️ **The two files live in different codebases and neither references the other, so drift fails
SILENTLY** — engines fetch `https://{Host}/{Key}.txt` to verify ownership, and a mismatch rejects every
submission with no error anywhere. The only symptom is Bing quietly stopping. `indexNowKey.test.js` pins
them together; do not change one without the other.

‼️ **The committed default is `Enabled=true` with `Host=www.clinket.com`.** Without the deploy.ps1
per-environment override, a dev/uat stamp pings engines about **production** URLs. `Enabled` is prod-only
and `Host` derives from that environment's apex. An inline `if` inside a PowerShell hashtable parses even
when wrong, so both branches were evaluated, not just parsed.

**Deploy order:** the key file must be live before submissions begin. Both ship in the same customer-web
deploy, so this holds automatically — never hand-enable it on a stamp whose key file has not shipped.

**IndexNow does not reach Google** (no ping API since 2023). Bing (and through it Copilot / ChatGPT
search), Yandex, Seznam, Naver. Google discovery depends on the sitemap + Search Console alone.

**Search Console / Bing verification needs NO code.** Google's *Domain* property type is a DNS TXT record
covering `www`, apex and `partner.`; Bing then imports from Search Console. `robots.js` already declares
the sitemap on prod and returns `disallow: /` everywhere else. A verification-file mechanism in the repo
would be dead config, so none exists.

---

## STATIC ASSETS ARE NOT PAGES — THE SECOND HALF OF THE AASA TRAP (2026-07-26)

The first fix excluded static **pages** the app cannot route. It was written from a scan of
`app/**/page.js`, which cannot see `public/` — so **every root-level asset stayed claimed by `/*`**:
`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, `site.webmanifest`, every favicon and svg,
and the new IndexNow key file. A one-segment file name falls through to `:friendlyName`, so tapping a
link to `robots.txt` opens a provider page for a business called "robots.txt".

**The lesson is about the scan, not the file.** A route enumeration answers "what pages exist", never
"what URLs exist". Static assets, route handlers (`robots.js`, `sitemap.xml/route.js`) and `public/`
files are all real URLs the association file claims.

Fixed with extension excludes (`*.txt`, `*.xml`, `*.json`, `*.ico`, `*.png`, `*.jpg`, `*.jpeg`,
`*.webp`, `*.gif`, `*.svg`, `*.webmanifest`) ordered **before** `/*`. Safe because a provider slug never
carries an extension. `deepLinking.test.ts` now reads `public/` off disk so a new asset is covered the
day it lands, and still asserts provider + service pages resolve so the excludes cannot over-reach.

‼️ The **partner** app needs none of this: its AASA claims only `/dashboard*`, which no root file matches.

## MOBILE REACHES THE SERVER'S LOCALIZATION — AND OFFERS ONE LANGUAGE IT LACKS

Both apps send `Accept-Language` on every request (`apiManager.tsx`, `apiHeaders.ts`), and both display
server error messages verbatim — which is why §5's `{1}` placeholder leak was most visible on mobile.
Any server-side localization fix therefore reaches mobile with no app change.

Their own copy is clean of the same bug: i18next `{{name}}` interpolation throughout, zero `{0}`-style
placeholders.

‼️ **But both register a Japanese locale the server does not have.** Customer:
`en-US, fr-CA, gu-IN, hi-IN, ja-JP`. Partner: `en, fr, gu, hi, ja`. Server: `en, fr, gu, hi`. A Japanese
user gets a Japanese UI and English validation errors, notifications and emails. Owner decision: add
`ja` server-side or stop offering it. (`es.json` exists in the partner app and is deliberately not
registered — documented as incomplete.)

---

## BOTH HOSTS SUBMIT TO INDEXNOW — ENABLING ONE IS A SILENT HALF-FIX (2026-07-26)

`IIndexNowSubmitter` is registered in **two** hosts, and the important one is easy to miss:

| Host | Path | Fires when |
|---|---|---|
| Main API | admin reindex endpoint | someone clicks it |
| **Function App** | `SearchIndexSyncFunction` -> `ProviderListingProjectionService` | **the Cosmos change feed**, i.e. every provider profile edit |

Enabling only the API leaves every *organic* submission dead while the manual button appears to work —
which looks like success. Both `appsettings.json` files must carry the **same** `Key`, `Host` and
`Endpoint`, and both must be prod-gated in `deploy.ps1`. `indexNowKey.test.js` iterates both hosts and
requires two `isProdEnvironment` gates, so enabling one and forgetting the other fails the build.

## SERVICESSITEMAP SHIPS ON, AND THAT IS SAFE BECAUSE THE INDEX IS MANIFEST-DRIVEN

`sitemap.xml` lists service chunks from the manifest the nightly job writes **LAST**. A stamp that has
never run therefore advertises **nothing** — it cannot advertise chunk URLs that would 404. That is what
makes `Enabled=true` safe as a committed default on every environment; the job also only touches its own
environment's SQL, Cosmos and blob container, so there is no cross-stamp leakage the way there is with
IndexNow (which pings a third party and so stays prod-only).

‼️ `ForceFullRebuild` stays **false**. It is an operational one-shot that ignores the watermark; left on,
every nightly run would rebuild every group and burn RU for nothing.

‼️ No `CronExpression` property on `ServicesSitemapSettings`. The schedule is a TimerTrigger binding the
**host** resolves from an env var, so an `IOptions` copy is read by nothing and can silently disagree
with the schedule in force — same decorative duplicate removed from `SearchIndexAudit`.

---

## A SHARED-FIXTURE TEST MUST NEVER ASSERT A GLOBAL COUNT (CI dev-958, 2026-07-26)

`ServicesSitemapIntegrationTests.Build_SplitsAGroupThatExceedsThePerFileCap` seeded 5 services and
asserted the sitemap held exactly 5 URLs. CI: **expected 5, actual 9.**

**Why it passed locally and failed in CI — and why a filtered re-run cannot reproduce it.** Four classes
share the `Seo SQL` collection fixture: `ServicesSitemapIntegrationTests`, `SitemapProjectionSqlTests`
(**18 providers**), `FriendlyNameHistorySqlTests`, `FriendlyNameResolutionSqlTests`. Each sitemap test
gets its own **blob container**, so output is isolated — but that also means **no watermark exists, so
every build is a FULL rebuild over the SQL the whole collection shares.** Run the class alone and only
its own data exists; run the full suite and the other classes' providers are already there.

‼️ **`dotnet test --filter` on the failing class will pass and tell you nothing.** The extra rows come
from classes the filter excluded. Reproducing needs the collection, or the full suite.

**The rule:** in a shared-fixture integration test, assert on data you can prove is yours. Every test in
this class already carries a unique `_suffix` in its seeded names — count only URLs containing it:

    var mine = locs.Count(loc => loc.Contains(_suffix, StringComparison.Ordinal));

Then "did it split?" becomes "how many chunks hold MY suffix", which no other class can perturb. Absolute
totals, `Assert.Single`, and "the manifest has N chunks" are all order-dependent in a shared fixture —
they pass until someone adds a test to a sibling class, then fail somewhere unrelated.

Self-relative assertions are also safe: comparing two consecutive builds to each other
(`Assert.Equal(first.TotalUrls, second.TotalUrls)`) needs no isolation at all.

---

## ‼️ CUSTOMER-FACING PER-LOCATION OPENING HOURS (PHASE 8 PART C, 2026-08-04)

**One service can be sold from several locations whose hours differ, so the schedule a customer sees depends
on which location serves them.** Getting this wrong sends a real person to a locked door — that is the failure
the whole design exists to prevent.

### The ONE endpoint the customer surfaces read

```
GET /api/v1/public/business/{businessId}/locations?serviceId=      [AllowAnonymous]
    -> ApiResponse<PublicBusinessLocationsDto>
       { hours: PublicAvailabilityDayDto[7],      // the business week
         hoursDiffer: bool,
         locations: [ { name, isDefault, inheritsBusinessHours, serviceAreaIds[], hours[7] } ] }
```

- `AvailabilityController` → `IPublicBusinessLocationService` (`clinqetinfrastructure\Services\Tenancy\`).
- ‼️ **It accepts NO visitor signal — no coordinate, no area id, no header — ON PURPOSE.** The SSR surfaces it
  feeds are CDN/ISR-cached, so one URL must render one deterministic HTML. A route that *cannot* receive a
  visitor signal cannot vary by one, which makes SEO rule 1 structural rather than a review promise.
- **Omit `serviceId`** for the Open Page (every active location serves). **Pass it** on a service page to
  narrow to the locations that actually sell that service (`Service.ServiceAreaIds` → `ServiceArea.branchId`).
- ‼️ **It REPLACES the `/availability` call on a customer surface — never joins it.** Its `hours` is the same
  business week from the same projection (`Clinqet.Core.Services.Tenancy.PublicAvailabilityWeek`), so the
  request count is unchanged. `/public/business/{id}/availability` still exists and is untouched.
- **Cost:** 0 locations ⇒ 1 Cosmos partition read (the one the availability endpoint already did) + 1 SQL
  index seek that returns nothing, then **short-circuits**. 1 location ⇒ the same two. 2+ ⇒ + `ServiceArea`
  and, with `serviceId`, one `Service` point read. All `/businessId`-partitioned. **No cache — the page's own
  `revalidate = 3600` ISR is the cache**, and a second one would delay picking up edited hours.

### The four states — the ONLY correct rendering, and it lives in ONE module

`clinqetwebuserapp\lib\locations\hoursRenderingRules.js` **and its twin**
`clinqetmobileuserapp\src\lib\locations\hoursRenderingRules.ts`. Call `resolveHoursView(payload, areaId)`;
never re-derive a state.

| Situation | What the customer sees |
|---|---|
| **0 locations** | ‼️ **Bare hours, byte-identical to before this feature.** No name, no expander, no JSON-LD change |
| **1 serving location** | Hours **+ the location name** |
| **2+, same hours** | The hours **once** + "Available at N locations" + the names. **No expander** |
| **2+, different hours** | The **matched** location's hours + name, plus **"Other locations (N)"** with *Hours differ* |

**Matched, in order:** the `serviceAreaId` the customer arrived with → the business's **default** location.
On web that id comes from the clicked search result; on mobile from the device-location-ranked search result
(`isClosest`). **No permission / no search context ⇒ the default leads**, which is what keeps the two apps'
output identical (CB-4).

‼️ **Both modules are dependency-free and side-effect-free ON PURPOSE.**
`clinqetmobileuserapp\__tests__\customerHoursRenderingParity.test.ts` sandboxes the web copy and **fails the
build** on any divergence — including an uncovered export. An `import` in either file breaks the sandbox and
the spec throws rather than silently skipping.

### The rules that bite

1. ‼️‼️ **ABSENT ROWS MEAN INHERIT, NEVER CLOSED.** A location with no override of its own shows the
   *business* hours; only an explicit `isAvailable = false` row is closed. `BranchAvailabilityResolver`
   already encodes this — use it, never re-derive it. Reading absence as "closed" silently shuts every
   location nobody customised.
2. ‼️ **`!![]` is `true`.** An empty `locations` array is the 0-location ANSWER, not missing data. Test length.
3. ‼️ **A failed load is NOT the 0-location state.** `payload === null` ⇒ the "hours unavailable" sentence,
   and the booking CTA stays live. A payload that loaded with nothing configured ⇒ render nothing, exactly as
   before (that is what protects the byte-identity gate).
4. ‼️ **CB-3: the "Same as the business hours" label appears in the EXPANDER ONLY** — provider vocabulary
   must never land on the main block.
5. ‼️ **CB-2: the expander ships CLOSED with "Hours differ" on the header.** Closed without those words is a
   trap; open by default is the "never dump every location" failure.

### SEO — the five rules, and where each is enforced

| # | Rule | Enforced by |
|---|---|---|
| 1 | One URL, one deterministic HTML, never varies by visitor | The endpoint takes no visitor parameter (C1). **No `Vary` exists on either SSR route** |
| 2 | When hours differ, EVERY location's hours are in the server-rendered HTML | The SSR payload carries all of them; the expander only hides them visually |
| 3 | Location awareness is a CLIENT-SIDE highlight of content already in the DOM | `matchedServiceArea` is read in a `useEffect` after mount, so the first client render matches the server |
| 4 | Locations create NO new URLs | Nothing added to the sitemap, the slug set or the canonical |
| 5 | 0 locations ⇒ byte-identical output | `PublicAvailabilityWeek` is shared by both endpoints; the day rows were deliberately NOT changed (decision C2); `LocationHours` renders `null` in that state |

**JSON-LD (CB-1):** 0 locations or all sharing hours ⇒ **one** `openingHoursSpecification`, exactly as before.
Hours differ ⇒ **per-location `department[]`**, each with its own schedule, and the business-level one is
**dropped**. Both surfaces: `lib\seo\dynamic-seo.js` (Open Page) and `lib\seo\serviceSeo.js` (service page).
‼️ **NEVER a single business-level schedule that is only true at one location.**

### `serviceAreaId` — the passthrough (L80)

`IndexedServiceAreaInfo.ServiceAreaId` has been in the search index since Phase 4, but **both wire DTOs
dropped it** until Part C. It now travels `ServiceAreaDistanceInfo` → `ServiceAreaResultDto` → the client →
`serviceAreaId` on `DraftBookingRequestDto` / `BookingRequestDto` → `IBranchResolver`. It **only routes** —
never authorization, never money — so an absent or stale id resolves to the whole business and must never fail
a booking. Carried in `sessionStorage` (web) / memory (mobile), keyed per business, 30-min TTL. ‼️ **NEVER in
the URL** — a query parameter would make the SSR route dynamic and fragment the ISR cache.

### Localization

Location **names are provider-typed and NEVER translated.** Every label around them is a key: web
`locations.*` (7 flat ids × 5 files), mobile `LOCATIONS.*` (9 nested leaves × 5 bundles). ‼️ Mobile keys are
**nested** (i18next `keySeparator`) and use `{{name}}`; web is **flat** and uses `{name}`.

✅ **Weekday names are LOCALIZED on all four customer hours surfaces** (decision **C6** — the owner relaxed
the byte-identity gate in session, 2026-08-04). Web uses `day.{DayOfWeek}`; mobile uses
`FILTER_SCREEN.DAY_{DAYOFWEEK}` — **not** `COMMON.WEEKDAY_*`, which is the three-letter chip set.
‼️ **The defect had been CROSSED:** web was raw on the SERVICE page and localized on the Open Page, while
mobile was localized on service detail and raw on the Open Page — neither app was the correct one to copy.

‼️ **`LocationHours`'s `formatDay` prop is REQUIRED and THROWS when absent.** Its old optional default
returned `day.dayOfWeek`, which is exactly how untranslated names shipped. **Never reintroduce a fallback.**
