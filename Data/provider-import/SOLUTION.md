# Provider Import — bulk-build provider profiles from bot-scraped JSON

> **THE AUTHORITY for this programme. Written 2026-10-06. NOTHING IS BUILT YET.**
> Every owner decision is quoted in §2. Every code fact in §3 was read from the code on 2026-10-06 by four
> independent research passes plus my own reading — **re-read each cited file before you change it** (line numbers
> drift; other sessions work uncommitted in the same trees).
> If anything here is unclear or looks wrong once you read the code: **STOP AND ASK THE OWNER. Never assume, never
> guess, never "find a way around it".**
>
> Files in this folder:
> | File | What it is |
> |---|---|
> | `SOLUTION.md` | this document — design, decisions, every rule, every edge case, the build plan |
> | `provider-import.schema.json` | **the upload contract (schema 2.0)** — the owner pastes it into the scraping bots. JSON Schema 2020-12, compiles under a strict validator (ajv 8 `strict:true`) |
> | `provider-import.example.json` | two worked providers that validate against the schema |
> | `NEXT-SESSION-PROMPT.md` | the prompt that starts the implementation session |
>
> Builds on the **prepared-provider programme** (built 2026-10-06): `C:\Nik\Data\admin-provider-setup\PLAN.md` and skill
> `clinqet-prepared-providers`. Read both first: prepared accounts, take-over, the setup session, `ClaimedAt`, email-only
> messaging for unclaimed businesses and "Price on request" are ALREADY BUILT and this programme reuses them unchanged
> except where §13 and §14 say otherwise.

---

> **‼️‼️ THIS TASK IS NOT COMPLETE UNTIL THE MULTIDIMENSIONAL AUDIT IN §27 IS DONE: after ALL the code is finished —
> (1) audit everything, (2) fix EVERY finding, (3) re-check EVERY fix closes its finding. Never skip it, never shorten
> it, never report "done" before it. ‼️‼️**

## 0. Standing orders (owner, 2026-10-06 — read this before anything else)

- **Quality, accuracy and correctness of the output are non-negotiable.** Owner: *"no compromise at all on our quality
  results and output … needs to be 100% accurate, 1000% accurate … it cannot have any error."* Every design choice below
  prefers "hold it for a person to check" over "publish something that may be wrong".
- **AI cost matters a lot; time does not.** Owner: *"performance doesn't matter … if it take one hour, two hour, three hour,
  we don't care … but the cost does … cost is extremely important … but not in the expense of our quality."*
- **Never impact live traffic.** Owner: the import must not slow or starve production; **its AI settings are separate**
  (endpoint, key, model names — everything), so a dedicated model/quota can serve it.
- **Only JSON, only the strict schema, validated up front.** Owner: *"It will be always going to be a JSON file … we will
  not accept any other files."*
- **Visualise and handle EVERY edge case** (owner said it four times). §21 is the catalogue — it is a contract, each row
  needs a test.
- **Reuse what exists**, build on top of it: the AI provider-setup pipeline, the prepared-account machinery, the
  custom-category creation + admin alert, the price rules. *"So everything remain the same. We're not going to change
  anything on that, same approach."*
- **Admin-only feature.** Mockup gate WAIVED for the admin screens by the owner (*"no need to get my UI approval … no need
  to create a mockup … everything need to be responsive … aligned with our theme, design, color, and modern looking"*).
  ‼️ The waiver covers ADMIN screens only. The provider-facing name prompt in §14 N3 and the customer apps' "profile ready" step (§14.4) still need a mockup the owner approves.
- Every rule in `C:\Nik\CLAUDE.md` applies — especially §0.1–0.6 (no hallucination, read the code, **no cross-partition
  Cosmos query**), §0.7 (schema — §15 lists exactly what the owner approved), §0.7.1 (no hardcoded text, ARM + deploy.ps1
  for every queue/container/setting, `IMemoryCache` Size = 1), §0.8 (unit **and real-engine integration** tests —
  mandatory here: schema, Service Bus, atomic counters), §0.9 (new skill ×4 + memory), §0.11–0.14, §0.15–0.18 (tests live
  with the host that runs the code), §0.16 (clean tree), §0.19 (**never** `git checkout --`/`restore`/`reset`/`stash`/
  `clean`), §0.21 (linear history), §0.23 (banked AI results carry a rules version), §24.1/§24.2 (UI standard).
- The owner commits, pushes and deploys unless he says otherwise. SQL migrations ARE applied by you to CA + IN via
  `cosmosindexsetup` (`dotnet run -- --all-regions --sql-only`) and proven with `dotnet ef migrations list`.
- **Golden rule: never make anything worse.** The provider AI Quick Setup (flyer/PDF/manifest) used by providers and the
  admin wizard must show **zero regression** after the refactor in §19 — prove it before/after.
- Explain anything you ask the owner in the simplest words: problem → what breaks → fix → recommendation (first).

---

## 1. The goal, in one picture

The Clinket team is about to go live. Bots (Meta, Grok, OpenAI…) scrape public information about local service
businesses into ONE JSON file per batch. An admin uploads that file in the admin web app. Clinket then, with no manual
work, for every business in the file:

1. checks the file against the schema and cleans every value (names, email, phone, web addresses, hours, prices);
2. removes or merges duplicates and reports exactly what it did and why;
3. creates the **prepared account** in Identity (the same account the admin "Provider setup" creates by hand — no
   password, waiting for its owner);
4. builds the **whole business profile** — details, address, social links, service areas, categories (creating a custom
   category + admin alert when nothing fits, exactly like AI Quick Setup today), services with honest prices
   ("Price on request" when none is published), hours, offers, FAQs, licences, a friendly web address, and (when the admin
   allows it) photos;
5. uses AI only where judgement is needed — fixing typos, mapping to our categories, cleaning descriptions, deciding if a
   record is trustworthy — and **verifies every AI answer against the source data in code** so nothing is invented;
6. publishes the confident ones straight to the marketplace, and **holds the doubtful ones hidden ("Pending")** for an
   admin to review, fix (with the existing setup wizard) and approve;
7. keeps a permanent history: every upload, its summary (created / live / held / skipped / failed / merged, each with its
   reason), and every provider's source data next to what was built.

Later (another project) the team contacts each business; the owner claims the profile through the take-over flow that
already exists.

```
 Admin web                 Main API                     Service Bus            Functions (Clinqet.Communications)
 ─────────                 ────────                     ───────────            ─────────────────────────────────
 Upload JSON ──SAS──► blob provider-imports/{runId}/source.json   (run doc: AwaitingUpload)
 "Check file" ───────► POST check ──► run (Uploaded) ──► provider-import-validate ──► ValidateRun
                                                                                       ├ validate-then-prune + clean + dedupe/merge
                                                                                       ├ SQL contact/name look-ups (preview)
                                                                                       └ item docs (upsert) + item blobs + lanes
 Review the plan ◄──── GET run/items  (run = Validated: counts, reasons, fields ignored, values dropped, cost estimate)
 "Start import" ─────► POST start ──► one message PER LANE ──► provider-import-items
                                                                       └► ProcessItem (one provider; then sends the next of its lane)
                                                                           P1 geocode   P2 AI curate (dedicated AI, banked)
                                                                           P3 verify in code   P4 AI second opinion (only when needed)
                                                                           P5 pre-verdict: every SKIP decided here — no account yet
                                                                           S1 account + business ──► Identity internal endpoint (§11A)
                                                                           S2 profile shell (Cosmos, Pending)
                                                                           S3 apply (shared setup applier, import options)
                                                                           S4 friendly name (Identity)   S5 photos (opt-in)
                                                                           S6 verdict: Live → Active (silent) | Review → Pending
 Live progress  ◄──── GET run (counters cache; truth recomputed at finish)
 Review queue: open item → compare → [Open setup wizard] [Approve] [Remove]
 One summary alert per run (+ custom categories summary) — the provider web/app setup alerts are unchanged
```

**Not in scope** (owner): contacting providers (future project); a provider-facing "we set this up for you" popup
(future phase, PLAN §4.2.9); branches/multi-location management; tax, payment and bank settings (§6.4 explains why).

---

## 2. Owner decisions (2026-10-06, in conversation) — the decision log

| # | Decision | Owner's answer |
|---|---|---|
| D1 | Same business appears several times (chains, multi-city, multi-category) | **"Merge, else skip"** — merge records that clearly are one business into ONE provider; when records share an email/phone but are not clearly one business, skip ALL of them and list them for manual handling (§7.5) |
| D2 | How to hide "needs review" providers | **Existing `BusinessProfileStatus.Pending`** ("awaiting admin approval", written by nothing today) — hidden from customer search, public page, sitemap, Google; approve → Active. Owner: *"so is this no longer getting used then I am good"* (verified unused, §3.6) |
| D3 | Where import history lives | **Cosmos SystemData**, cheapest correct option; owner: *"where it is less expensive and cost friendly … it should not impact the other data or record or production … since this will be used a lot … it is important we do this correctly"* → design + cost math in §15 |
| D4 | Owner name missing (94% of records) | **Placeholder ("Guest"/"User")**, never the business name and never an invented person; owner asked to check the take-over flows → findings §3.8, fixes §14 |
| D5 | Fix the name gaps after take-over | **ALL FOUR fixes, "extremely detailed … so we can fix this fully"**: N1 Google/Apple fills a placeholder name; N2 no "Hello Guest User" anywhere; N3 ask once for the name (provider web + phone, mockup approval needed); N4 keep the name typed before the "your profile is ready — sign in with a code" stop (§14) |
| D6 | Business email/phone already has an account | **"Fill gaps if unclaimed"** — a prepared account nobody took over: only FILL what is empty, never overwrite; a taken-over or self-registered account: never touched, reported "Already on Clinket" (§12) |
| D7 | Toll-free / landline numbers | **"Toll-free = public only"** — shown on the profile, never the sign-in phone; India landlines likewise (free to detect there, §8.3); NANP landlines cannot be detected for free → imported normally; **no paid lookup** |
| D8 | Photos | **Admin chooses per upload** — checkbox "Copy photos from the source", off by default; links always kept in history; turned on once the owner's legal check allows (§11.6, §22) |
| D9 | Account flags | **Remove `IsAdminProvisioned`** (duplicates `ProvisionedAt`); "prepared" = `ProvisionedAt != null && ClaimedAt == null`; **no new "created by AI import" column** — the import history links every account (§13) |
| D10 | No street address (200 of 860) | **City-level address** — street left empty, placed on the map at the city; a street is imported ONLY when the business itself publishes it (`publiclyListed`) — never a home address (§8.5) |
| D11 | Held provider taken over by its owner before review | **The take-over makes it live** (Active); the review row shows "Owner took over — no review needed" (§10.5) |
| D12 | Recognising a returning business | Owner: *"provider id is not useful and we might not have it at all"* → **no reliance on any bot id, no extra record type**: match by email → phone → same name AND same city/website (§12.1). Owner, later the same day: *"we should remove the id from schema too"* → **the schema has NO id field at all**; inside one file a record is identified by its position (index) |
| D13 | Separate AI settings | A dedicated settings node — *"everything should be separate … Foundry URL, API key, model name"* — values copied from today's for now (§17) |
| D14 | The service AI check on provider saves | Owner asked if it is redundant → **it is NOT redundant; keep it** (§3.10). The import writes services `Approved` like AI Quick Setup; its own AI curation applies the same content rules (§9.3 rule 9) |
| D15 | Admin mockups | **Waived** for admin screens (quoted in §0); the provider name prompt (N3) and the customer apps' "profile ready" step (N4, §14.4) still need approval |
| D16 | Fields the schema does not know | Owner: *"even if bot json have more than schema we should only accept schema only and ignore rest"* → **validate-then-prune** (§7.2): unknown fields are ignored at every level (never an error, never imported, counted in the summary); an OPTIONAL value that breaks its rule is dropped as if null; only a broken REQUIRED part skips the provider |
| D17 | Where accounts are created | **One private Identity endpoint** (service key) running the same provisioning core as the admin form; Identity stays the only place an account is ever created. Owner: *"internal endpoint in identity but this need to be extremely solid … every edge case … if this failed how to handle … this is first before start the provider setup and it need to be correct"* (§11A) |
| D18 | Admin alerts on an import | **One summary per run** (incl. custom categories), via an explicit `AlertMode` on the shared code whose DEFAULT keeps today's per-event alerts for the provider web/app and admin wizard. Owner: *"it is fine one summary per run but … it shouldn't impact or remove anything when provider setup happen from the provider web and app … this admin alert is super important"* and *"we don't want the admin alert bombardment … super super best practice … no regression rule is super critical"* (§16.4) |
| D19 | Speed caps of the two import AI deployments | **250K tokens/minute for the curation model (`gpt-6-luna-import`), 100K for the second-opinion model (`gpt-6.1-sol-import`)** — production chat models run at 1,000K each (`deploy.ps1` `$OpenAiModelCapacity`) (owner, 2026-10-06) |
| D20 | Take-over alert when typed names differ from the team's | **Medium** (owner, 2026-10-06) — the code's current High is changed to Medium so code, PLAN.md and the skill agree (§14.5) |
| D21 | Schema checking | **Strict contract, tolerant reader**: the schema is exact for the bots; the importer ignores unknown fields, drops an optional value that breaks its rule, and skips only on a broken required part (D16). Library: **JsonSchema.Net** (MIT, maintained, JSON Schema 2020-12, per-location results — what lets us drop exactly the failing value). Owner: "I can go with your recommendation" (2026-10-06) |

Earlier owner decisions this programme inherits and must not re-open: prepared accounts have no password; "Price on
request" = `PriceTypes.OnRequest` with every amount null and **0 refused**; prepared accounts get email only (no SMS /
WhatsApp / marketing); online booking forced OFF until take-over; the claim / stop-emails links (PLAN §3–§7, §13).

---

## 3. Verified facts about today's code (2026-10-06) — the ground this is built on

### 3.1 The AI provider setup ("AI Quick Setup") — what it is and is not
- **Synchronous, inside one API request, streamed back as SSE.** `POST api/v1/ai/provider-setup/process`
  (`clinqetapi/Clinqet.API/Controllers/AI/AIAssistantController.cs` ~L465-808) → `IMcpService.ProcessAttachmentProviderSetupAsync`
  (`clinqetinfrastructure/Services/AI/McpService.cs` ~L155-1421). **No queue, no Function, no job document** for it.
- **`.json` is accepted ONLY as a strict `CatalogManifest` v1** (`clinqetshared/DTOs/AI/CatalogManifestDtos.cs`); any other
  JSON is refused with `Error_CatalogManifestNotRecognized` (`McpService.cs` ~L308-329). The manifest path writes
  **services, custom categories and service areas only** — no profile fields, hours, offers, social links, address or
  photos (except allow-listed image hosts). So PLAN.md §1's assumption that "AI Quick Setup reads the bot JSON" is false
  for this schema — this programme is what makes it true.
- The stages after extraction are what we reuse (McpService ~L506-1207): fact checks → **profile apply**
  (`ProviderSetupProfileService.ApplyAsync`, fill-blank) → price ceiling → price gate → **taxonomy resolve with custom
  creation** (`ProviderSetupTaxonomyResolver`) → **service areas** (`ProviderSetupServiceAreaService`) → **availability**
  (`SaveExtractedAvailabilityAsync`, missing days only) → pre-pass dedupe → offering judge → **service writes**
  (`ProviderSetupServiceWriter`) → selected categories + counts → **offers** (`SaveExtractedOffersAsync`, Transactions
  container) → images (`ProviderSetupImageService`) → onboarding progress.
- The contract between stages is `AttachmentExtractionResultDto` / `ExtractedServiceDto` (`clinqetshared/DTOs/AI/AIAssistantDtos.cs`
  ~L111-229).
- Custom categories: `ProviderSetupTaxonomyResolver.GetOrCreateCustomAsync` (~L202-248) writes `IsCustom = true,
  Approved = true`, deterministic id `AiOwnedCategoryTaxonomy.ComputeId(businessId, parentId, NAME)`, and raises
  `CustomCategoryAwaitingReview` / `CustomSubcategoryAwaitingReview` (Medium) through
  `CustomCategoryAlertService.RaiseAwaitingReviewRequiredAsync`, deterministic EventId. ‼️ If
  `CategoryAlert:EnableCustomCategoryAlerts` is false the "Required" variant THROWS and aborts the run.
  ‼️ Custom categories are **business-scoped**: the id is `ComputeId(businessId, …)` and the row carries that business's
  id, so 50 imported dentists create 50 separate custom "Dental" parents (+ subcategories) and, per event, 2 Medium alerts
  each. The categories stay exactly as today (owner: "same approach"); the import collects the alerts into ONE summary per
  run (§16.4). The admin folds duplicates with the existing merge tool (`AdminCategoryCorrectionController`,
  `AiCategoryCorrectionsTab.jsx`).
- The writer (`ProviderSetupServiceWriter.cs`): `Approved` unless the category pair is missing or the price is
  "unconfirmed" (→ `PendingProviderCompletion`); a price-less service becomes `PriceTypes.OnRequest`
  (`OnRequestWhenNoPrice`); deterministic service id from `ExternalId` (`DeterministicGuid(businessId,"service",externalId)`);
  remote images through `IRemoteImageIngestionService`.
- Models in use (`clinqetshared/Constants/AiModels.cs`): `gpt-6-luna` (extraction, judge), `gpt-5.6-luna` (reading,
  vision), `gpt-6.1-sol` (verifier), `gpt-5.4-mini` (search enrichment only). Structured output uses `strict: true`, whose
  subset **excludes `minimum`/`maximum`/`pattern`/`minItems`** — use `enum` and field `description` only (memory
  `ai-profile-setup-phase4-audit-complete-2026-08-14`).
- `AICompletionService` (`clinqetinfrastructure/Services/AI/AICompletionService.cs` L28-32, L372, L444, L734) takes its
  endpoint, key and API version from the singleton `IOptions<AIServiceSettings>`; the deployment is a per-call argument.
  ⇒ a separate endpoint/key needs a **second, keyed instance** built from a different section (§17.2).

### 3.2 Admin provider creation (Identity) — reused for every imported account
- `POST api/v1/admin/provider-accounts` (Identity, `[Authorize(Roles="Admin")]`) →
  `AdminProviderProvisioningService.CreateProviderAsync` (`clinqetinfrastructure/Services/Auth/AdminProviderProvisioningService.cs`).
  Email OR phone required; names optional → blank becomes `SystemConstants.PlaceholderFirstName/LastName` = "Guest"/"User"
  **each half independently**; `IsAdminProvisioned = true`, `ProvisionedByAdminId`, `ProvisionedAt`; email/phone marked
  confirmed with NO code; no password; `ReceiveMarketingEmails = false`; roles from `Identity:Registration:DefaultRoles`;
  `UserUserType = Business`; consent rows `PolicyConsent:EnforcedPolicies` with platform `"AdminProvisioned"`; one
  execution-strategy transaction; collision check `CollidingAccountAsync` (email on ANY row incl. closed; phone on any
  ACTIVE row, typed or proven) → 409 with that account's `UserNumber`.
- Email: `Trim()` only, case kept; `NormalizedEmail = ToUpperInvariant()`. **No lower-casing.**
- Phone: `ToE164Safe` → `PhoneNumberNormalizer.ToE164OrNull(phone, dialDigits)`. ‼️ **With no `+` and no country it parses
  as US** (`clinqetshared/Utilities/PhoneNumberNormalizer.cs` ~L112-115) — on the India stamp a bare 10-digit number becomes
  `+1…`. The only per-stamp country setting is `LocaleSettings:FallbackCountryCode` (CA / IN), and provisioning uses it
  only for the consent jurisdiction. **The importer must always pass the country** (§8.3).
- Throttle `AdminProviderProvisioningThrottle`: in-memory, 40 per admin per hour, shared by create / onboarding-token /
  correct-contact — applied in the CONTROLLER (`AdminProviderAccountController.cs` ~L71-73), which also writes the
  activity rows (~L85-140); the service method itself has neither. Built for a human at a form — the import uses the
  internal endpoint (§11A) with its own rate limit (§11A.1, §17.4) and the import limits (§16.6). The service's constructor needs `IAuthService`,
  `IAuthSessionService`, `IPolicyConsentService`, `IBusinessActivityRecorder` (~L50-66) — Identity-only services, which is
  why accounts are created in Identity, not in Functions. Today the user id is `Guid.NewGuid()` (~L143); the import needs a
  deterministic one (§19.3).
- The `Business` + owner membership are created **later, at onboarding-token mint** (`IssueOnboardingTokenAsync`
  ~L460-648 → `EnsureSelfServeBusinessAsync` / `EnsureWorkspaceWithoutEmailAsync`), with `Business.DisplayName` = the
  PERSON's name ("Guest User") until the change feed projects `BusinessProfile.Name` over it.
- The Cosmos `BusinessProfile` is created by `POST business/profile` (`BusinessProfileController.cs` ~L274-397) which also
  seeds **default Mon–SUN 09:00–17:00 availability** (all 7 days, ~L1090-1104) and the **global portfolio**
  `Global_{businessId}` (~L1120-1158), forces `AllowOnlineBookings = false` for a business waiting for its owner (~L356),
  derives `ParticipatesInMarketplace` from SQL `SignupOrigin` (~L357), assigns the search cell (~L358-363) and raises an
  `OnlineBookingsDisabled` admin alert per profile (~L375-376, `BusinessProfile:AlertOnOnlineBookingsDisabled` = true).
  It takes the business email/phone from the token claims (~L349-352). ⚠ `GET business/profile` auto-creates a STUB
  (~L163-209) that skips the lock and the seeding.
- One person may own **one live business** (TD-1, `BusinessProvisioningService.OwnsALiveBusinessAsync`); creation is rate
  limited 3/24 h per user. So one email/phone ⇒ one account ⇒ one business — the reason for D1.
- UserActivity: `ProviderAccountProvisioned` rows in the admin's and the subject's partitions. ‼️ The admin "Provider
  setup" list (`clinqetwebadmin/src/pages/providers/ProviderAccountsPage.jsx`) is BUILT FROM THE ADMIN'S OWN ACTIVITY FEED
  with one tenancy lookup per row, 4 at a time (`providerProvisioningService.js` ~L562-666). 2,000 imported accounts written
  as that type would make that page unusable ⇒ a separate activity type (§13.3).
- **No server-side bulk import exists anywhere**; the only file import (`RazorpayTaxonomyPage.jsx`) runs in the browser.

### 3.3 The provider data model (what a profile can hold) — see §6 for the field-by-field mapping
Containers (`clinqetcore/Cosmos/Setup/CosmosContainerPolicies.cs`, applied by `cosmosindexsetup/Program.cs` L176-184):
ProviderData `/businessId`, Transactions `/businessId`, SystemData `/pk`, KnowledgeBase `/businessId`, … BusinessProfile,
Service, Category (global partition `"global"`), SelectedCategory, Availability, ServiceArea, Portfolio, License live in
ProviderData; **Offer lives in Transactions** (`OfferRepository.cs` L10).
Key constraints (all re-verify):
- `BusinessProfileDto`: Name ≤150 required, Description ≤1000, YearsOfExperience 0–100, NumberOfEmployees string ≤20
  (UI: digits only). Business email/phone are NOT in the DTO — taken from the token claims at create.
- Address: Street required ≤200 in the DTO (entity `string`, no validation), City/State/ZipCode/Country required in the
  DTO; Country strict (`CountryCodeHelper.TryParseStrict`, stored as the English name); no postal-code format check.
- Social: `SocialPlatform` = Facebook, Instagram, YouTube, LinkedIn, Twitter, Website — nothing else (no TikTok/WhatsApp).
- ServiceArea: centre + radius only (no polygon/zip list), radius 0.1–1000; the manual screens default to 70 (`Defaults:DefaultRadius`, API only) while the AI setup applier uses `Discovery:CountryDefaults` (50 km CA/US, 25 km IN) — the import uses the applier's source (§8.7).
- Service: Name ≤150 **unique per business**, Description ≤5000, ≥1 of `IsAtStore`/`IsAtCustomersLocation`,
  **1 image** (`Storage:ServiceImages:MaxFileCount`), Duration {Minutes|Hours|Days}. Pricing: Fixed / Starting from /
  Hourly / On request; minimum charge, visit fee, travel fee per distance, tax included/rate. No tiers, add-ons, packages.
- Availability: **one slot per day**, end strictly after start, `HH:mm` 00:00–23:59, no breaks, no overnight, no 24 h, no
  holidays.
- Offer: Percentage | Flatrate only; dates; weekly/monthly recurrence (`MO`..`SU`) + time window; min spend; max
  redemptions; scope by category/subcategory/service. No BOGO, bundle, first-visit, promo code.
- License: Type ≤100, Number ≤100, Issuer ≤150 (all required), dates.
- FAQ (KnowledgeBase): Question 5–200, Answer 10–1000, max 200 per business.
- Portfolio: Title ≤150, Description ≤2000, CompletionDate, Images (40 × 10 MB); global portfolio `Global_{businessId}`.
- Friendly name: SQL `Business.FriendlyName` (≤20, lower-case, unique filtered index) + `BusinessFriendlyNameHistory`
  (retired slugs stay reserved); rules in the top-level `FriendlyName` section (Identity appsettings): MinLength 3, MaxLength 20, `^[a-z0-9-]+$`, ReservedWords
  list; check `AuthService.IsFriendlyNameAvailableAsync` (SQL only — no Cosmos query).
- Tax/payment: `BusinessProfile.paymentConfig` (tax enabled, rate, label, registration number) and invoice payment
  methods (bank details, need the provider's password) — **not imported** (§6.4).

### 3.4 Search visibility
- Public index (customer marketplace, per country) and private index (Ask Clinket, business search, AI receptionist, per
  cell). Gates `clinqetcore/Utilities/ServiceIndexGates.cs`: public service = business `Status == Active` AND
  `ParticipatesInMarketplace` AND service `IsIndexable` (active, not deleted, Approved).
- **`Status != Active` deletes every service document of that business from BOTH planes** (`AzureSearchIndexer.cs`
  ~L1146-1151) and the provider document (`ProviderSearchIndexer.cs` ~L120-128).
- Open Page / sitemap / IndexNow: `ProviderPublicVisibility.IsPubliclyListed` = Status Active **or Inactive** + Name + a
  primary-address **City** (`clinqetcore/Utilities/ProviderPublicVisibility.cs` L9-25). ⇒ **Pending hides the public page.**
- Each service written by the change feed costs one AI enrichment (`SearchIndexEnrichment`, gpt-5.4-mini, batched) and one
  embedding (text-embedding-3-large) — but only when the business is Active (Pending deletes instead). ⇒ building a profile
  while it is Pending and switching it Active ONCE at the end means every service is enriched exactly once (§11.3).

### 3.5 Storage, queues, settings, regions
- SystemData `/pk`, indexed paths include `/type/?`, `/status/?`, `/createdAt/?` and composite `(type, createdAt DESC)`
  (CosmosContainerPolicies ~L625-744). No generic job/run document family exists; the closest pattern is
  `KnowledgeDocument` ("the row IS the work order").
- Queues: one list for every host — `clinqetshared/Models/ServiceBusSettings.cs`, the `_senders` dictionary in
  `ServiceBusService.cs`, `azureautomation/events.json` (ARM), `deploy.ps1` `$q*` + `$script:ServiceBusEntitySettings`
  (merged into every host) + a drift guard; `maxDeliveryCount` 5 = `RetrySettings:MaxDeliveryCount`; trigger bindings
  `%ServiceBusSettings:…QueueName%` must exist in `local.settings.json`, `.ca.json`, `.in.json`.
- Functions `host.json`: `functionTimeout` 00:45:00; Service Bus maxConcurrentCalls 16, maxConcurrentSessions 8,
  maxAutoLockRenewalDuration 01:00:00.
- AI keys in Functions come from `appsettings.json` + `local.settings.ca/in.json` (`AIService__*`) and are applied in Azure
  by `deploy.ps1` `Merge-AppSettings` (Functions ~L7739-7811, API ~L8170+). Deployment names are variables ~L3311-3340.
- Region is per stamp (separate deployments + databases for CA and IN); no single "Region" setting — use
  `LocaleSettings:FallbackCountryCode` and `Search:Topology:Public:Countries`.
- Geocoding is Google (`GoogleGeocodingService`), in-memory cache only, single-flight + circuit; failures raise
  `GeocodingResourceLimit`.
- Remote image fetch exists with full SSRF protection: `RemoteImageIngestionService` (policies `AllowList` and
  `PublicHost`), streaming size cap, magic bytes, no redirects (memory `catalog-manifest-dealer-import-2026-07-29`).
- The Functions host already registers `AppDbContext` (pooled), `IRemoteImageIngestionService`, `IGeocodingService`,
  `ProviderSetupTaxonomyResolver`, `CustomCategoryAlertService`, `CategoryPromptService`. It does NOT register the
  provisioning, business-provisioning, setup-writer, profile-apply, service-area, friendly-name, `IKnowledgeManagementService`
  (FAQs), `IPolicyConsentService`, `IAuthSessionService`, `IBusinessActivityRecorder` or `IAuthService` services, and it has
  no `PolicyConsent`, `Identity:Registration`, `Tenancy:BusinessCreation`, `FriendlyName`, `AdminProviderProvisioning`,
  `Discovery:CountryDefaults` or `AIAssistant:ProviderAttachmentProcessing` sections (§16.2 DI audit, §17.1).
- `RemoteImageIngestionService.IngestServiceImagesAsync` uses the ALLOW-LIST policy only; the PublicHost policy serves the
  knowledge lane only, writes to a PRIVATE container and requires an image file extension (~L155-169, ~L304-325) ⇒ photos
  need one new method (§11.6).
- `PhoneNumberNormalizer.ToE164` returns any input that starts with `+` UNCHANGED (~L36-41) — "+1 (905) 648-4113" is
  neither formatted nor validated by it (§8.3).
- `UserActivityTypes` is a static class of string constants (`clinqetshared/Enums/UserActivityTypes.cs`), not an enum.
- A Cosmos `TransactionalBatch` fails as a whole when one operation conflicts (`Data/COSMOS/Base/PartitionBatch.cs` ~L41).

### 3.6 `BusinessProfileStatus.Pending` (D2) — verified unused, and what it does
- **Nothing writes Pending today** (only tests). Readers: search (removed from both planes), provider index (removed),
  Open Page 404, sitemap off, booking refused (`BookingIntake`), leads ineligible (`LeadEligibility.cs:47`), listing
  switches refused, score refresh skipped. **Login, setup session and team are unaffected** (they read SQL
  `Business.Status`). WhatsApp menu and voice-number operations are not blocked by Pending (irrelevant: a prepared
  account has neither).
- Admin web `ProviderTrustPage.jsx` shows an amber "Pending" pill but **no approve button** (it offers Suspend).
- Pending → Active today only via `ProviderLifecycleService.ReactivateAsync` (admin `POST admin/providers/{id}/reactivate`
  and the PROVIDER's own `POST business/profile/reactivate` — which accepts Pending too: a loophole once Pending is used,
  closed in §10.6). The patch fires the change feed → full reindex of the business (both planes, sitemap verdict,
  provider projection).

### 3.7 Prepared accounts after this morning's build
`ProviderTakeoverService` is the only place an account is taken over (claim-as-lock in one SQL transaction); "prepared" =
`IsAdminProvisioned && ClaimedAt == null` in ~15 places (`AuthService.cs:773`, `PreparedAccountDirectory.cs:56,96`,
`PreparedProviderService.cs:65,73`, `ProviderTakeoverService.cs:76-80,226`, …).
There is **no `IsClaimed` column and no `IsProviderCreated` column** (the owner asked). `IsAdminProvisioned` is set in
exactly one place, together with `ProvisionedAt` — a duplicate fact (D9).

### 3.8 Names through take-over (D4/D5) — the facts behind §14
- `ProviderTakeoverService.ApplyAsync` NEVER writes names; the caller in `AuthService` decides. Seven call sites:
  Registration (L1241), phone-only reset (L2043), reset completion (L2154), PhoneCode/WhatsApp (L2628), EmailCode (L2768),
  two-step (L2845), ExternalLogin (L3209).
- Only **registration with the team's email** replaces the name (`ApplyPendingRegistration` L924-925, always, with what
  was typed). Every other path keeps the stored name: phone/email/WhatsApp code, both resets, **Google/Apple** (claims
  applied only when the stored field is EMPTY, L3119-3129 — a prepared account is never empty), and **registration with
  the team's phone** (409 `PreparedProfileSignIn`; the typed names are thrown away by the client,
  `clinqetwebpartnerapp/src/components/auth/registerForm.jsx` ~L180-181, `PreparedProfileReady.jsx` ~L39-50).
- **No screen in any app asks a placeholder-named owner for a real name.** The owner sees "Welcome back, Guest"
  (`clinqetwebpartnerapp/src/components/dashboard/layout/Header.jsx` ~L109-138, mobile `MyDashboardScreen` ~L1101).
- Emails that greet the PERSON: email sign-in code (`SendEmailMfaLoginVerificationCodeAsync` L2673-2675 →
  `MfaCodeNotification` "Hello {{UserName}}"), password-reset code (L1912-1914), **registration code to a prepared email
  greets the registrant with the TEAM's name** (`SendRegistrationCodesAsync` L1012 — `changes.Email` is null in that
  branch), reset-completed (L2170, off by default), password-set (`AuthController.cs` L3125, flag), external-login (L3274,
  flag). Team rosters/inbox/activity use `MemberDisplayName.Of(First, Last, Email)`; Razorpay billing contact uses
  `user.FullName`; the take-over alert says "Guest User took over…".
- Customers never see the person's name: messages, Open Page, documents, lead/booking emails use the BUSINESS name.
- `NameDiffers` (ProviderTakeoverService ~L449-467) treats "Guest" OR "User" as placeholder (an OR — a real "John User"
  is silenced too); it sets the alert to **High** while PLAN.md and the skill say **Medium** — fix the docs or the code
  deliberately (§14 N5).

### 3.9 Data reality — the 860-provider Ontario sample (`C:\Nik\Data\sample\clinket-ontario-master`)
Profiled record by record on 2026-10-06 (old schema 1.0):
| Fact | Count | Consequence |
|---|---|---|
| providers / files | 860 / 495 | one upload file per batch in schema 2.0 |
| owner name present | 50 (some "Jeff", "Jill & Dani", "Dr. Winston Law") | D4 placeholder; §8.1 name rules |
| email / phone / website | 264 / 843 / 388 | email is the scarce contact |
| neither email nor phone | 16 | skipped: no contact |
| toll-free main number | 13 (6 written `1-8xx-…`) | D7 |
| email not lower-case (`Info@…`, `hello@SeamRoofing.ca`) | 9 | lower-case all |
| emails shared across records | 19 groups; phones 27 groups | D1: 64 records merge into 27 businesses; 8 records (Molly Maid, The Lock Hut, Ritz Barbershop, Rosedale — different local phones) skipped |
| free-mail addresses (gmail, icloud…) | 41 | fine; never used to infer a person |
| price type `quote` | 3,065 of 3,080 services | "Price on request"; 1 record hid real prices in `notes` ("Men's Haircut $34…") — schema 2.0 `priceText` fixes this |
| real prices | 15 (fixed 8, hourly 4, from 3) | evidence rule §9.4 |
| zero prices | 0 (but the rule is enforced) | 0 ⇒ null |
| hours given | 114 of 860 (746 empty) | **never invent hours** (§8.6) |
| hours "07:00–00:00" (midnight close) | 1 | 23:59 |
| "Open 24 hours" in notes | 17 + notes | 00:00–23:59 all days |
| day "not closed" but no times | 4 | hours incomplete ⇒ held |
| no street | 200; no postal code 226 | D10 city-level address |
| address city ≠ search city (Ancaster vs Hamilton) | 72 | the address city is the truth |
| names with Inc/Ltd/Corp | 148; ALL CAPS 3 | keep legal suffix out of the display name only if the business itself does; fix ALL CAPS |
| categories | 22 trade slugs; 2 records with 2 categories; `dental`, `photographers` have no clear home in our 40/334 tree | custom categories + alerts will really fire |
| social | Facebook 65, Instagram 60, one `facebook.com/profile.php` with no id | reject non-page URLs |
| services per provider | 1–9 (median 4); 1,265 distinct names; 25 with a description | AI cleans names, never invents descriptions |
| images | 0 | photos are opt-in anyway (D8) |
| offers | 2 ("Free first lesson" — not a %/amount; "10% off Mon–Fri 11–3") | §8.8 |

### 3.10 The AI check on provider saves (owner's side question, D14)
- `ServiceController.ProcessServiceApprovalAsync` puts a created/edited service in `PendingAIValidation` when
  `ServiceApproval:EnableAIValidation` is true (it is, API + Functions); edits re-trigger it only when an AI-judged field
  changed (`ServiceValidationInputs` fingerprint: name, description, price fields, category). `ServiceAiValidator`
  (Functions) runs two gpt-6-luna calls: **B2 content** (profanity, hate, gibberish, placeholder text, negative/near-zero
  price) and **B3 category** (auto-corrects a wrong category). ≈ $0.0003–$0.0015 per validation.
- **The business profile has NO AI check** (no moderation on name/description/photo).
- **Verdict: keep it.** It is the only gate on hand-typed service text before public search; nothing else makes the same
  decision. Real weaknesses (spam/contact details/pills pass B2; an empty AI reply rejects instead of routing to a person;
  a Low alert on every approval; the admin queue misses AIRejected; MCP-created services wait with no alert; images never
  checked) are a SEPARATE improvement — not part of this build.

---

## 4. Architecture decisions (and why)

| # | Decision | Why (alternatives rejected) |
|---|---|---|
| A1 | **Asynchronous, Service Bus + Functions**, one provider per message, sent one at a time per lane (A11, §11.1) | The setup pipeline today is synchronous inside an API request (10 min cap). A 2,000-provider file takes hours — it must survive restarts, redeliveries and deploys. One provider per message gives per-provider retry, idempotency and progress without a mass fan-out. Rejected: an API loop (request timeouts), one giant message (one failure redoes everything) |
| A2 | **Two-step: Check the file → admin reviews the plan → Start** | The admin sees duplicates, merges, skips and the AI cost estimate BEFORE a single account exists. Owner: *"we'll first scan through the whole file. We'll do the validation"* |
| A3 | **In-process services for everything Cosmos-side; ONE private Identity endpoint for the account** (owner decision) | The Functions worker calls the same service classes the endpoints call for profiles, services, categories, areas, hours, offers (extracted where needed, §19). Accounts + businesses are created ONLY by Identity, through one service-to-service endpoint (§11A) that runs the same provisioning core as the admin form — Identity's sign-in machinery stays in Identity. Rejected: minting setup-session tokens and calling the public Main/Identity APIs (60-min tokens, the 40/hour throttle, the per-business 50/day setup cap, SSE parsing, no transactions); copying Identity's provisioning code and its dependencies into Functions |
| A4 | **Deterministic first, AI second, code verifies AI third** | Names, emails, phones, URLs, addresses, hours and price numbers are cleaned by code (cheap, exact, testable). AI does only judgement (typos, category mapping, cleaning descriptions, trust). Code then checks every AI output against the source and refuses anything not traceable to it. This is how "100% accurate" and "cheap" are both true |
| A5 | **ONE curation call per provider** (whole record in, whole verdict out), prompt-cached prefix | One call with full context is more accurate than many small calls and cheaper (the system prompt + category tree are an identical cached prefix for every provider) |
| A6 | **A second-opinion call only when needed** (§9.5) | Quality where it matters, no cost where it doesn't |
| A7 | **Build hidden, publish once** — every new profile is created `Pending`, flipped `Active` at the very end if the verdict is Live | No half-built profile is ever visible; every service is search-enriched exactly once (§3.4); a failure mid-way leaves nothing public |
| A8 | **Reuse the setup pipeline's apply half** (§19.1) — taxonomy + custom category + alert, service writer, price rules, availability, offers, service areas, profile apply | Owner: "same approach". One behaviour for flyer, manifest and import; one place to fix bugs |
| A9 | **History in Cosmos SystemData (state) + blob (bulky JSON)** | §15: ~130 RU per provider for history (~$0.07 per 2,000 on serverless pricing) vs ~10–15 KB of JSON per provider kept in blob (fractions of a cent). Rejected: SQL (shares the Identity database with live sign-ins — owner: must not impact production; JSON payloads are awkward in SQL) |
| A10 | **Dedicated AI settings + dedicated model deployments** (§17) | Azure OpenAI rate limits are per DEPLOYMENT: separate deployments (`…-import`) cap the import's tokens-per-minute so it can never starve live traffic, and can later move to a separate Foundry resource by changing settings only |
| A11 | **Chained lanes per run** (`ParallelismPerRun`, default 2): each finished provider sends the next one of its lane (§11.1) | Predictable AI/SQL/Cosmos load; no 5,000-message fan-out that a crash can half-send; cancel/pause simply stop the chain; a stall is "a lane made no progress", never "an item waited its turn"; time does not matter (owner) |
| A12 | **Admin web only** | A multi-MB JSON upload and a 2,000-row review table are desk work. The admin phone app is not changed (state this in the skill). |
| A13 | **Decide before you create** — geocoding, AI curation, code verification and every possible skip happen BEFORE the account exists (§11.3 P1–P5) | A skip after creation would leave an orphan prepared account whose email stays blocked for ever |
| A14 | **Every id deterministic** (account, address, service, FAQ, licence, image, item) | A crash at any point, a redelivery, a retry or a re-upload converges on the same rows — never a duplicate |

---

## 5. The upload file — schema 2.0

`provider-import.schema.json` is the contract. **The importer accepts only `schemaVersion: "2.0"`.** Design rules baked
into it (they are also written into the schema's own `description` so the bots read them):
1. **Never invent** — null/empty when not published; a wrong value is worse than a missing one.
2. **Verbatim evidence fields** (`priceText`, `hoursText`, `offerText`) — the importer only accepts a price amount that
   literally appears in the price fields or that text (§9.4).
3. **0 is not a price** (`exclusiveMinimum: 0` on every amount) — "no price" is `type: on_request` + nulls.
4. **No home addresses** — `street` only when `publiclyListed: true` (D10).
5. **One record per business** — merge landing pages; when unsure, two records + `dataQuality.possibleDuplicateOf`.
6. One file = one country (`batch.countryCode`); the region it is uploaded to must serve it (CA stamp: CA + US; IN: IN).
7. Contacts are separate objects with `lineType` and `purpose` so a toll-free main line and a "text us" mobile can coexist
   (the sample's "Text Us: 289-778-0694" was buried in availability notes).
8. Hours: either empty or exactly 7 days, each with up to 4 slots — the importer folds slots into our one-slot-per-day
   model (§8.6) and keeps the verbatim `hoursText`.
9. Fields Clinket cannot show (TikTok, Yelp, external ratings) are allowed but kept in history only — so the bots never have
   to drop information, and future features can use it.
10. **No `id` field** (D12). **Unknown fields are allowed and ignored** (D16) — the schema has no
    `additionalProperties: false`; the importer reads only the fields it defines. Because a misspelt field name is
    therefore silently ignored, the run summary shows **"Fields ignored"** (each unknown JSON path + how many records had
    it, e.g. `providers[].bussinessName ×860`) so a drifting bot is noticed on the very first upload.
11. **Tolerant on optional values, strict on required ones** (D16, §7.2): an optional value that fails its rule is dropped
    as if it were null (and listed per record); a required part that fails skips that one provider (`SchemaInvalid`);
    an envelope that fails stops the file.

Limits enforced by the importer beyond the schema (settings, §17): file ≤ `MaxFileSizeBytes` (default 50 MB), ≤
`MaxProvidersPerFile` (default 5,000 — also the schema `maxItems`).

The schema stays usable by the bots as a normal JSON Schema: a bot that validates its own output against it gets errors
only for real problems (missing required parts, wrong types, a 0 price, a 6-day week) — those are exactly the values the
importer would drop or refuse.

---

## 6. Field-by-field mapping: schema 2.0 → Clinket

### 6.1 Account (SQL `UserProfile`, created by the Identity internal endpoint §11A, which runs the provisioning core §19.3)
| Schema | Clinket | Rule |
|---|---|---|
| `contacts.owner.firstName/lastName/fullName` | `FirstName`, `LastName` | §8.1; placeholder when unknown (D4) |
| sign-in email | `Email`, `NormalizedEmail`, `UserName` | §8.2: the chosen sign-in email, lower-case |
| sign-in phone | `PhoneNumber` (E.164), `CountryCode`, `PhoneSearchKey` | §8.3: never toll-free / India landline / extension (D7) |
| `batch.countryCode` | `Country`, consent jurisdiction | strict |
| — | `ProvisionedByAdminId` = the admin who STARTED the run, `ProvisionedAt` = now, `ReceiveMarketingEmails = false`, no password, `SignupExperience = Business` | same as the admin form |
| AI `sourceLanguage` (§9.3) | `PreferredLanguage` | the language the business writes in, when it is one of the platform's five (en, fr, es, hi, gu) — so the claim emails reach a Québec business in French; otherwise the stamp default (`en`). Code checks the AI's value is one of the five |

### 6.2 Business (SQL `Business` + Cosmos `BusinessProfile`)
| Schema | Clinket | Rule |
|---|---|---|
| `business.name` (AI-cleaned) | `BusinessProfile.Name`, `Business.DisplayName` (set to the business name at creation, not "Guest User") | ≤150; §9.4 rule 2 |
| `business.legalName` | `Business.LegalName` | ≤200, as published |
| `business.description` (AI-cleaned) | `BusinessProfile.Description` | ≤1000, §9.3 rule 4 |
| `foundedYear` / `yearsInBusiness` | `YearsOfExperience` | years = current year − foundedYear (if ≥ 1), else yearsInBusiness; clamp 0–100; null ⇒ 0 (the field is not nullable — the UI shows nothing for 0, verify) |
| `employeeCount` | `NumberOfEmployees` | integer as string (UI accepts digits only) |
| main public phone | `BusinessProfile.PhoneNumber` / `CountryCode` | the business's own main number (may be toll-free) — this is the PUBLIC phone |
| main public email | `BusinessProfile.Email` | the business's main email |
| `social.*` | `SocialLinks` (`SocialPlatform` keys) | §8.4 |
| `addresses[]` | `Addresses[]` | §8.5; geocoded; timezone stamped from the primary address |
| `availability.timezone` | `TimeZoneId` | only when it equals the zone the address implies; otherwise the address wins and the mismatch is flagged |
| — | `Status = Pending` during the build, `Active` when Live (A7, D2) | §10 |
| — | `AllowOnlineBookings = false` (prepared rule), `ParticipatesInMarketplace` from `SignupOrigin` exactly as the bootstrap does today (Business ⇒ true), `IsListed = true`, search cell as today | §19.2 |
| public email / phone | `BusinessProfile.Email/PhoneNumber` | ‼️ set EXPLICITLY from the business's public contacts (§8.2.4, §8.3.4) — never copied from the sign-in contact (today's bootstrap copies the token claims). An owner's direct email/mobile that the business does not publish as its own stays private (sign-in only) |
| `business.friendlyNameSuggestions` | `Business.FriendlyName` (+ Cosmos mirror) | §11.5 |

### 6.3 Catalogue
| Schema | Clinket | Rule |
|---|---|---|
| `serviceAreas[]` | `ServiceArea` (centre = geocoded place, radius = `radiusKm` or the `Discovery:CountryDefaults` default) | §8.7; the primary address city is always one of them |
| `categories[]` + per-service `category` | `SelectedCategory` + service `CategoryId/SubcategoryId` | AI mapping §9.3; resolver + custom creation + alert (existing) |
| `services[]` | `Service` | §8.9 prices; ≥1 delivery flag; ≤1 image (photos opt-in); deterministic id `DeterministicGuid(businessId, "import-service", normalizedSourceName)` (the pre-AI normalised source name, §11.3 S3) |
| `availability` | `Availability` (business-level, 7 docs) | §8.6; **nothing when unknown** |
| `offers[]` (percentage / fixed_amount only) | `Offer` (Transactions) | §8.8 |
| `licenses[]` (only with a number) | `License` docs | as published |
| `faqs[]` | KnowledgeBase FAQ (`ReceptionistAccess` = the existing default for a new FAQ) | 5–200 / 10–1000; ≤ `MaxFaqsPerProvider` (default 50, platform max 200) |
| `portfolio[]` + `media.galleryImageUrls` | `Portfolio` projects + the global portfolio | only when the run's "Copy photos" is ticked (D8) |
| `media.logoUrl` | `ProfilePictureUrl` (+ derivatives) | only when "Copy photos" is ticked |

### 6.4 Deliberately NOT imported (and why)
| Thing | Why |
|---|---|
| Tax settings, tax registration numbers | A legal/financial choice the owner of the business must make; a scraped GST/HST number on a business we built could misstate their tax status |
| Online payment, deposits, invoice payment methods (bank details) | Bank details need the provider's password (server rule) and must never come from a scrape |
| Reviews / ratings | Never copy another site's reviews (`externalRating` is history-only) |
| Team members, branches | People cannot be imported; branches need a separate design (not in the setup allow-list) |
| `social.other` (TikTok, WhatsApp, Yelp…) | No `SocialPlatform` value; kept in history |
| `availability.notes`, `price.notes` | History only; never published (they carried phone numbers in the sample) — the AI may use them as EVIDENCE (24/7, tax) but never copies them |

---

## 7. Stage A — upload and "Check file" (deterministic, no AI, no account created)

### 7.1 Upload
1. Admin web → `POST api/v1/admin/provider-imports/upload-url` {fileName, sizeBytes} → validates `.json`,
   `application/json`, size ≤ `MaxFileSizeBytes` → returns a **Create|Write SAS** for blob
   `provider-imports/{runId}/source.json` (15-minute expiry, `runId` = new GUID "N"), and the `runId`. It also writes the run
   document in status `AwaitingUpload` (so an upload that never happens is found and cleaned by the sweeper, §11.7).
2. Browser PUTs the file to the blob.
3. `POST api/v1/admin/provider-imports/{runId}/check` {name (≤100, defaults to file name), copyPhotos (bool)} → server
   checks the run is `AwaitingUpload`, the blob exists, its size and the SHA-256 of the content; refuses if another ACTIVE
   run (read from the small runs partition and compared in code — the hash is not indexed) has the same SHA-256
   (`This file is already being imported in run X`); patches the run to `Uploaded` and sends `provider-import-validate`
   {runId} with `messageId = "validate:{runId}:0"`. Returns 202 + the run. A send failure leaves the run `Uploaded` — the
   sweeper re-sends it (§11.7).
   - A file identical (same SHA-256) to a COMPLETED run is allowed — the result is a fill-gaps / already-on-Clinket run
     (re-uploads are safe by design) — but the response carries `previousRunId` so the UI warns "This exact file was
     imported on <date>".

### 7.2 `ValidateRun` (Functions, queue `provider-import-validate`)
Idempotent: starts only from `Uploaded`/`Validating` (conditional patch with ETag → `Validating`, `validationStartedAt`).
A redelivery after completion is a no-op. Steps:
1. **Read** the blob (streamed; refuse above `MaxFileSizeBytes`).
2. **Schema check = validate-then-prune (D16).** The schema ships as an embedded resource in `Clinqet.Communications`
   (a test may only read its own repo, §0.17 — so the embedded copy IS the source of truth in code; the skill says the
   `Data/provider-import/` copy and the admin-web download copy must be updated in the same change). Library: **JsonSchema.Net** (D21 — the solution has no JSON-Schema validator today; MIT, maintained, 2020-12 compliant,
   per-location results), referenced from `clinqetinfrastructure` where the validator lives.
   The algorithm, in this order — and it is the ONLY way input enters the importer:
   1. **Parse** with `System.Text.Json` (`JsonDocument`, max depth 32, comments/trailing commas refused, duplicate property
      names ⇒ the LAST one wins is NOT acceptable — a duplicate key in one object is treated as a broken value at that
      path, pruned like any other invalid optional value, or `SchemaInvalid` if the key is required). Not JSON ⇒ run
      `ValidationFailed` "not valid JSON at line L, column C".
   2. **Project onto the schema** (allow-list, never a deny-list): walk the document with the schema and copy into the
      typed `ImportFile` model ONLY the properties the schema defines. Every property the schema does not define is
      **ignored** and its JSON path (array indices collapsed to `[]`) is counted in `run.ignoredFields` (top
      `MaxReportedErrors` paths with counts). Ignored values are not stored anywhere except the original `source.json`.
   3. **Validate each kept value** against its schema rule:
      - **Envelope** (`schemaVersion`, `batch.*` required parts, `providers` array): any failure ⇒ run `ValidationFailed`
        with up to `MaxReportedErrors` errors {path, message} (admin English). Nothing is imported from a file whose
        envelope fails — the country and version decide how every record is read.
      - **Optional value** that fails (wrong type, out of range, bad pattern/URL/email shape, `0` or negative money, a
        `schedule` that is not 0 or 7 days, an invalid array item, an enum value we do not know): **drop it** — the value
        becomes null / the array item is removed — and add {path, rule, droppedValue (truncated to 200 chars)} to the
        record's `prunedValues` (shown in the item drawer, counted per path in the run summary). A dropped item inside an
        array never drops its siblings. An array longer than its `maxItems` keeps the first `maxItems` items in file order;
        the rest are pruned and listed (the bot puts the most important first, as the schema says).
      - **Required part** of a provider that fails or is missing (`scrapedAt`, `sources` ≥1 valid, `business.name`,
        `contacts`, `addresses` array, `serviceAreas` array, `categories` ≥1 valid, `services` ≥1 valid, `availability` with a `schedule` key — `timezone` is optional and only compared, §8.5.8): that provider is **skipped `SchemaInvalid`** with the failing paths; the rest of the file
        continues. ("Required" is exactly the schema's `required` lists — one source of truth. One deliberate exception: an `availability.schedule` with a wrong number of days or an invalid day item is pruned to EMPTY — no hours + `HoursIncomplete` — never a skip; only a missing `availability` object or a missing `schedule` key is `SchemaInvalid`.)
      - A required ARRAY whose items were all dropped as invalid (e.g. every service had a broken `price`) counts as
        missing ⇒ `SchemaInvalid` with the reason of each dropped item.
   4. Only the projected, validated `ImportFile` model reaches §8. **No code after this step ever reads the raw JSON.**
   (Rationale: the owner wants "schema only, ignore the rest"; one bad record must not block 1,999 good ones; one bad
   optional value must not throw away a good business; and every drop is visible to the admin.)
3. **Normalise every record deterministically** (§8) into a `NormalizedProvider` (C# record, never AI).
4. **Record-level skip rules** (§7.4).
5. **In-file duplicates → merge or skip** (§7.5).
6. **Against Clinket** — batched SQL look-ups (§12.1): `NormalizedEmail IN (…)` and `PhoneSearchKey IN (…)` in chunks of
   `SqlLookupChunkSize` (default 500), plus the name look-up for the remaining items. Classify each planned item:
   `New`, `FillGaps` (unclaimed prepared account), `AlreadyOnClinket` (skipped: claimed / self-registered / closed /
   removed), `PendingInvitation` (the email has a pending team invitation — `IX_BusinessInvitation_Email_Pending`),
   `ContactIsCustomerRecord` (an `IsSystemGenerated` customer shell a provider's CRM created), `PossibleExisting` (name
   matched, city/website did not ⇒ planned `New` but flagged `PossibleExistingBusiness`). This is a PREVIEW for the admin;
   the authoritative check is repeated at P5 and inside the Identity endpoint (§11A), because accounts can change between
   Check and Start.
7. **Write the plan** (only after steps 1–6 finished in memory): one item document per planned provider (merged group =
   one item) + one blob per item (`{runId}/items/{itemId}/input.json` = the NormalizedProvider and its source records), plus
   each item's `lane` and `nextItemId` (§11.1). Item docs are written with **`UpsertItem`** in `TransactionalBatch`es of
   ≤100 (single partition `provimport_{runId}`) — an upsert never conflicts, so a redelivered validation simply rewrites
   the same deterministic ids with the latest classification (a `CreateItem` batch would fail as a whole on one existing
   id). Only a run still in `Validating` is written; the final step is the conditional patch to `Validated`.
8. **Estimate cost**: items × `CostEstimatePerProviderUsd` (setting, seeded from the pilot measurement §20) — shown as an
   estimate, never as a promise.
9. Run → `Validated` with counters (records, planned New/FillGaps, merged groups + records, skipped by reason, review
   flags by reason, estimated cost). Admin alert? **No** (the admin is looking at it); a `ValidationFailed` run raises
   nothing either — it is shown on screen — except `ValidationFailed: Stalled`, which raises `ProviderImportStalled` (§11.7).
10. Time budget: validation is ONE pass (dedupe/merge needs the whole file at once, so it cannot be split into
    continuations). Parsing, pruning, normalising and union-find over 5,000 records are in-memory work (seconds); the SQL
    look-ups are ≤ 20 batched queries. The pilot (§20) measures a 5,000-record file and records the time; it must stay
    well under `functionTimeout` (45 min). If a stamp ever needs bigger files, raise `MaxProvidersPerFile` only after a
    measured run — never by adding continuations. A validation that dies is re-sent by the sweeper (§11.7) and, being
    upsert-only, converges.

### 7.3 What the admin sees after "Check file" (the plan)
Counts with drill-down: "1,912 records → 1,843 providers to create (24 of them merged from 61 records) · 11 to update (gaps only) ·
21 skipped (11 no contact, 4 duplicate contact, 4 permanently closed, 2 invalid) · 57 will be held for your
review (reasons…) · estimated AI cost ≈ $X", plus two plain panels: **"Fields we ignored"** (unknown field paths and how
many records had them — e.g. "`providers[].bussinessName` in 860 records — not a field we know; did the bot misspell
`business.name`?") and **"Values we dropped"** (per path + rule: "`services[].price.amount` was 0 in 41 services → shown
as Price on request"). Buttons: **Start import** (primary), **Download skipped list (CSV)**,
**Discard** (deletes the run's blobs and marks the run `Discarded`; no account was ever created).

### 7.4 Record-level skip rules (deterministic) — reason codes `ProviderImportSkipReason`
| Code | When |
|---|---|
| `SchemaInvalid` | the record fails the schema (errors listed) |
| `NoBusinessName` | name empty after cleaning (e.g. only punctuation) |
| `PermanentlyClosed` | `business.operatingStatus = permanently_closed` |
| `NoCity` | no address with a city and no service area to stand in (§8.5) |
| `CountryNotServed` | not used per record: a file whose `batch.countryCode` this stamp does not serve fails the envelope (F3); an address in another country is dropped (§8.5.1) and an only place becomes `NoCity` |
| `NoContact` | no valid email and no valid phone at all |
| `NoSignInContact` | contacts exist but none can receive a sign-in code (only toll-free / India landline / extension numbers, no email) — D7 |
| `DuplicateContactConflict` | shares an email/phone with another record but is not clearly the same business (§7.5) |
| `BrandLocationsShareContact` | records marked as one brand's locations (`brandName`) share a contact (franchises: separate owners) |
| `AlreadyOnClinket` | the contact belongs to an account that is taken over, self-registered, closed or removed (D6) |
| `ContactOnTwoAccounts` | its email belongs to one existing account and its phone to ANOTHER — cannot pick |
| `PendingInvitation` | its email has a pending invitation to join another business — the person is expected there |
| `ContactIsCustomerRecord` | its contact is a customer shell (`IsSystemGenerated`) a provider's CRM created — never turned into a provider |
| `AiRefusedContent` | the AI service refused the text (content filter) — listed for manual handling |
| `NotAServiceBusiness` | P5: the curation says, with high confidence AND the second opinion agrees, that it is not a service business (a shop selling products, a directory page) — otherwise it is a review flag |
| `MergeVetoed` | P5: the AI says the merged records are not one business ⇒ every member skipped (detail lists them) |
| `ExactDuplicateInFile` | two records identical after projection (same name, contacts, addresses, services) — the first is kept, the copies are skipped with this reason (no conflict, nothing lost) |
| `ExceedsLimits` | not used: over-long arrays are pruned (SV7); a file over `MaxProvidersPerFile` fails the envelope (`ValidationFailed`) |

Each skipped record keeps its source JSON in history; the CSV export lists business name, city, contacts, reason, detail.

### 7.5 In-file duplicates — merge or skip (D1), proven on the sample
1. Build contact keys per record from contacts that could identify ONE business: valid emails (compare key = lower-case;
   for gmail.com/googlemail.com also dots removed and `+tag` dropped; for other domains `+tag` dropped — compare keys only,
   the stored address is the real one) and valid phones (E.164) that are **not toll-free**, and not in
   `Normalization:SharedContactBlocklist` (call-tracking numbers, booking-platform addresses, web-agency emails, franchise
   head-office lines — filled from the pilot and grown by the admin team). Toll-free and blocklisted contacts never link
   records (a brand's 1-800 line would otherwise chain every franchisee into one group).
2. Union-find records that share ANY contact key ⇒ contact groups.
3. A group of 2+ is **one business** (merge) only if ALL hold:
   - no conflicting contacts: compare the SETS of sign-in-capable phones (and emails) of the members — the group conflicts
     when two members each have a phone (or email) the other does not list at all (each location with its own local
     number). The ORDER or the `purpose` label of the numbers never matters (two listings of one business that list the
     same two numbers in a different order are NOT a conflict);
   - same identity: the same non-generic website domain (not facebook/instagram/google/wixsite/yelp/linktr/square/business.site
     — list in settings `GenericWebsiteHosts`) **or** the same brand key (name lower-cased, `&`→and, punctuation removed,
     legal suffixes, city/area names of the file and generic trade words removed — word list in settings);
   - no member has `brandName` set while names differ by location (franchise) ⇒ `BrandLocationsShareContact` instead;
   - the AI curation of the merged item does not veto it (§9.3 output `mergeVerdict = not_same_business` ⇒ at P5 every
     member is skipped `MergeVetoed`, detail "AI: not the same business" — no account is created).
4. Otherwise every record of the group is skipped `DuplicateContactConflict` (owner's strict rule) with the other records
   named in the detail.
5. Records with the same brand key and city but NO shared contact are separate items, flagged `PossibleDuplicateInFile`
   (review), never merged (could be two businesses with similar names).
6. Records naming each other in `dataQuality.possibleDuplicateOf` (exact `business.name` values — the schema has no id)
   but not merged ⇒ every record carrying that name flagged `PossibleDuplicateInFile`; a name that matches no record is
   ignored.
- **Proof on the sample** (old schema): 31 contact groups → **27 merges covering 64 records** (ProFix 10 → 1, Pesticon 3 →
  1, Birnie 2 → 1, DSHI 2 → 1, …) and **4 groups / 8 records skipped** (Molly Maid Cambridge vs Vaughan, The Lock Hut
  Burlington vs Hamilton, Ritz Barbershop Ancaster vs Waterdown, Rosedale Plumbing ×2 — each location has its own phone).
  ‼️ Mr. Rooter Richmond Hill + Concord merged on the sample because they share contacts and domain — in schema 2.0 a bot
  that marks `brandName: "Mr. Rooter"` turns this into `BrandLocationsShareContact`. Add this exact case as a test (§21 MG3).
- **Merging** a group (deterministic, before AI): union of categories, services (dedupe by normalised name; keep the
  richest — a real price beats on_request, a description beats none), service areas (dedupe by name+province),
  addresses (publicly-listed street addresses become additional addresses; city-only duplicates collapse into service
  areas), offers, FAQs, licences, social links (conflicting URLs for the same platform ⇒ none of them + review flag),
  hours (all members identical ⇒ use; any difference ⇒ no hours + `HoursConflict` review flag). The PRIMARY record is the
  one with a publicly-listed street address, then the most complete (completenessScore, then most services). The display
  name comes from the AI (the common brand without the location word, e.g. "ProFix" / "GTA ProFix Home Services" — AI picks,
  code verifies it is a substring-level match of one member name).

---

## 8. Deterministic cleaning rules (code, unit-tested one by one)

### 8.1 Person name (account `FirstName`/`LastName`)
1. Source: `owner.firstName/lastName`; else split `owner.fullName`.
2. Trim, collapse inner whitespace, strip honorifics (`Dr.`, `Mr.`, `Mrs.`, `Ms.`, `Miss`, `Prof.` — list in settings) and
   trailing roles ("- Owner").
3. Reject (⇒ placeholder) when it contains digits, `@` or a URL, when the WHOLE name equals the business name (ignoring
   case/punctuation), or when it contains a legal suffix (Inc, Ltd, Corp…). Trade words are NOT a reason on their own — real
   surnames include "Law", "Baker", "Painter", "Mason" ("Dr. Winston Law" → "Winston" / "Law").
4. Two people ("Jill & Dani", "Fabian and Jessica") ⇒ the first person only: FirstName "Jill", LastName = the
   placeholder (displayed as "Jill", rule 6).
5. Casing: if the source is ALL lower or ALL UPPER ⇒ capitalise the first letter of each part split by space, hyphen and
   apostrophe, the rest lower ("o'brien" → "O'Brien", "MARY-JANE" → "Mary-Jane"); if the source is already mixed case,
   keep it ("McIntyre", "van Herk", "DeSouza" stay as written). Never title-case a mixed-case name — that breaks real names.
6. **One-word name** ("Jeff") ⇒ FirstName "Jeff", **LastName = placeholder "User"**; the greeting/display rules in §14 make
   this show as "Jeff" everywhere, never "Jeff User" (N2). Two-word+ ⇒ first token FirstName, the rest LastName
   ("James Robert Jones" → "James" / "Robert Jones").
7. Max 100 each (truncate at a word boundary, flag).

### 8.2 Email
1. Trim; strip `mailto:`, surrounding `<>`, trailing `.,;:`; decode `[at]`/`(at)`/` at `/`[dot]` obfuscations only when
   the result is a valid address.
2. **Lower-case the whole address** (owner: "email all going to be small letter").
3. Valid = `System.Net.Mail.MailAddress` parses AND exactly the input, one `@`, a dot in the domain, no spaces, length 6–256,
   TLD ≥ 2 letters; domain has no consecutive dots.
4. Choose the **sign-in email**: the first valid email with purpose `owner_direct` (owner.emails first), else `main`, else
   any. Other valid emails stay in history; the business's PUBLIC email = the first business `main` email (may equal the
   sign-in email).
5. An email that is ALSO another record's sign-in email in the file ⇒ handled by §7.5.

### 8.3 Phone
1. Parse with libphonenumber (`PhoneNumberNormalizer` — extend it, never a second normaliser) using the region from
   `batch.countryCode` (never the US default — the importer always passes it; covers §3.2's India bug for this path).
   ‼️ **Always parse and validate — also when the input starts with `+`** (`ToE164` returns such input unchanged today,
   §3.5): "+1 (905) 648-4113", "+91-98765 43210", "0091…", an Indian trunk "0" prefix ("0265 2345678") all go through the
   parser. Strip extensions ("ext 22", "x22", "#22") into `extension`.
2. Valid = `IsValidNumber` for that region. Invalid ⇒ dropped (history keeps it) and flagged.
3. Line type: libphonenumber `GetNumberType`: `TOLL_FREE` / `PREMIUM_RATE` / `SHARED_COST` ⇒ toll-free; in India `FIXED_LINE`
   ⇒ landline (India separates mobile and fixed ranges); NANP returns `FIXED_LINE_OR_MOBILE` ⇒ unknown. The bot's
   `lineType` can only make a number LESS eligible (a bot saying "landline" is respected; a bot saying "mobile" for a
   toll-free number is ignored).
4. **Sign-in phone** (D7): first number that is not toll-free, not a known landline, has no extension; preference
   `owner_direct` > `text` > `whatsapp` > `main` > others. **Public phone**: the first `main` number (toll-free allowed).
5. Store E.164; `CountryCode` = dialing digits; `PhoneSearchKey` by the existing save hook.

### 8.4 Web addresses
1. Must be http(s); `http://` is upgraded to `https://` only for the stored link text (no fetch).
2. Lower-case scheme and host; strip tracking query parameters (`utm_*`, `fbclid`, `gclid`), fragments, trailing slash
   duplicates.
3. Platform checks (reuse `ProviderSetupProfileService`'s per-platform host allow-lists, ~L428-498, and `FlexibleUrl`):
   Facebook must be a page (`facebook.com/<name>` or `facebook.com/people/<name>/<id>`), never `profile.php` without `id=`,
   `sharer`, `login`, `groups`; Instagram `instagram.com/<handle>` (no `/p/` posts); YouTube channel/handle URLs; LinkedIn
   `/company/…`; X/Twitter `x.com|twitter.com/<handle>`; website must not be one of the social hosts or a directory
   (yelp/yellowpages/…) — those go to history.
4. Invalid ⇒ dropped + noted in history (not a review reason).

### 8.5 Addresses (D10)
1. **One file = one country**: an address whose `countryCode` differs from `batch.countryCode` is dropped (pruned value)
   even if the stamp serves that country (a US address in a CA file is a bot error, not a cross-border branch); if it was
   the only place, the record is skipped `NoCity`.
2. `street` is used ONLY if `publiclyListed = true` AND `kind` ∈ {storefront, office, workshop, unknown}; `home_based`,
   `service_area_only`, `mailing` ⇒ street dropped (city-level). ‼️ A `home_based` street the bot flagged public is still
   dropped — a home address is never published by the importer.
3. Province: CA/US two-letter codes validated against a fixed list (enum in code); IN state names validated against the
   list the platform already uses (find it — `CountryCode`/geo helpers). If there is none, the province is taken from the
   geocoder's result for that city (Google returns the state) and the bot's value is only compared — never ASK-blocking.
4. Postal code: CA `A9A 9A9` (uppercase, one space), US `99999` / `99999-9999`, IN `999999`; an invalid one is dropped
   (flag), never "fixed" into a different code.
5. Geocode: street address ⇒ `GeocodeAddressAsync`; city-level ⇒ `GeocodeCityAsync` (the same call service-area creation
   uses). A coarse/ambiguous/region-wide result for a STREET address ⇒ keep the address, flag `AddressNotConfirmed`
   (review). A city that cannot be geocoded ⇒ `NoCity` if it was the only place.
   Coordinates from the bot are used only when the geocoder agrees within `GeocodeAgreementStreetKm` (2) for a street and
   `GeocodeAgreementCityKm` (25) for a city; disagreement ⇒ the geocoder wins + flag.
6. **City-level address** = `Street = ""` (empty string — the entity field is non-nullable), AptSuite null, City, State,
   ZipCode (or "" when unknown), Country (English name per `CountryCodeHelper`), Coordinates = city centre, `IsPrimary`.
   ‼️ **Verification task (blocking for Phase 3):** before writing a single city-level address, read EVERY reader of
   `Address.Street` / address formatting across API, Functions, MCP, the 3 web apps and 3 phone apps (Open Page, provider
   profile, invoices/quotes PDFs, booking emails, receptionist prompt, search documents, sitemap, maps links) and confirm a
   blank street renders cleanly (no ", ," / "undefined" / empty line / a map pin at a street that does not exist). Fix
   each one that does not — in the same build — and list them in the build log. If a reader cannot be fixed simply, ASK.
   The provider's own address form keeps "street required" — when the owner edits, they type it (D10).
7. Exactly one primary: the record's `isPrimary` (first wins); if none, the first publicly-listed street address, else the
   first address. **Several city-only addresses** (no public street on any): only the primary becomes an address; the other
   cities become service areas (a city-level "address" says nothing more than a service area and would only clutter the
   profile).
7a. **Never invite customers to a place we cannot show**: a service with `deliveredAt.businessLocation = true` on a business
   whose primary address is city-level ⇒ keep the flag (the source said so) but add review flag `AtStoreWithoutStreet`;
   when the flag was only INFERRED (`basis = category_default`) and there is no public street, infer `customerLocation`
   only, never `businessLocation`.
8. Timezone: stamped from the primary address by the existing `BookingTimeHelper.StampProfileTimeZone`; the bot's
   `timezone` is only compared (mismatch ⇒ flag `TimezoneMismatch`, no review).

### 8.6 Hours (never invented)
| Source | Stored |
|---|---|
| `schedule` empty and `openTwentyFourSeven` false | **nothing** — no availability documents at all. ‼️ The profile bootstrap must NOT seed the default Mon–Sun 09:00–17:00 (§19.2). Verification task (blocking): every reader of availability (Open Page "hours", "open now" filters, receptionist "are you open", booking slot generation, onboarding progress, search documents) must handle "no hours"; fix or ASK |
| `openTwentyFourSeven` true | all 7 days 00:00–23:59 |
| 7 days, one slot each | as given |
| close `24:00` or `00:00` (closes at midnight) and the next day does NOT start with a `00:00` slot | close = 23:59 (one minute off — accepted; note in history) |
| a period that runs PAST midnight (18:00–02:00) — encoded by the schema as a slot closing `24:00` followed by the next day's first slot opening `00:00`; that pair IS the overnight signal | the platform cannot show it truthfully ⇒ **no hours stored** + review flag `HoursNotRepresentable` (never a false "closes 11:59 pm") |
| several slots in a day (a lunch break) | the platform has one slot per day; "open 9–5" would be false during the break ⇒ **no hours stored** + `HoursNotRepresentable` (verbatim kept; the admin sets the closest truthful hours in the wizard) |
| `closed: false` but no slots, on ANY day | the whole week is unknown ⇒ nothing stored + review flag `HoursIncomplete` |
| slots invalid (open = close, bad format) | nothing stored + `HoursIncomplete` |
| only `hoursText` ("Mon–Fri 8–5") | AI interprets (§9.3) with the verbatim evidence; code re-checks every hour number appears in the text |
| `byAppointmentOnly` with no schedule | nothing stored (history note) |
| `byAppointmentOnly` WITH a schedule | the schedule is stored (the hours they take appointments) |
| `openTwentyFourSeven` true but a schedule that disagrees | the schedule wins + flag `HoursConflict` |

### 8.7 Service areas
1. Every `serviceAreas[]` entry + the primary address city (if missing from the list) ⇒ one area each, deduped by
   (name, province) case-insensitive; max `MaxServiceAreasPerProvider` (default 25, extras ⇒ history + flag).
2. Geocode with `GeocodeCityAsync` (the in-memory cache makes repeated GTA cities nearly free; single-flight dedupes
   concurrent calls). Not found / region-wide ⇒ that area dropped + noted (not a skip).
3. Radius: `radiusKm` when given (0.1–500 per the schema), else the SAME default the setup applier uses:
   `Discovery:CountryDefaults:{CC}:DefaultSearchRadius` / `DefaultRadiusUnit` (50 km CA/US, 25 km IN —
   `ProviderSetupServiceAreaService.cs` ~L140-155). One source of truth (§19.1); add that section to Functions.
4. `IsDefault`: the primary address's area. Name = the place name as written (no "Default Service Area" English literal).
5. Areas named in a service's `serviceAreaNames` link to that service; else the service gets all areas.

### 8.8 Offers
Imported only when `discountType ∈ {percentage, fixed_amount}` AND `discountValue > 0` AND (percentage ≤ 100) AND the
`offerText` contains the number (evidence rule) AND `endDate` (if any) is today or later AND — when there is no `endDate`
— the record's `scrapedAt` is within `OfferMaxAgeDays` (30; an open-ended promotion seen months ago is probably over) —
otherwise history only (`OfferPossiblyExpired`). Mapping: Percentage / Flatrate; `startDate` default today; recurrence
daily / weekly / monthly / yearly (the frequencies the platform's offer model supports — verify each against
`OfferRepeat` + `OfferValidationService`; an unsupported shape ⇒ that offer not imported) with `byWeekDays` ISO codes,
`byMonthDays`, time window `HH:mm:ss`; `minimumSpend`
→ `MinValue`; scope: `appliesToServiceNames` resolved to the created services (an unresolved name ⇒ the offer is dropped,
not widened to everything); max redemptions none; `IsStackable` = platform default. Everything else ("Free first lesson",
BOGO, "seniors discount" without a number) ⇒ not imported, kept in history with reason `OfferTypeNotSupported`. Reuse the
existing offer validation (`DiscountRules`, `DiscountValidator`, the recurrence rules fixed in Phase 4: malformed
recurrence ⇒ offer skipped; overnight windows are legitimate). Dedupe via the existing offer signature.

### 8.9 Services and prices
1. Name: trim, collapse spaces, fix ALL CAPS while keeping acronyms (words of ≤ 4 letters written in capitals and every
   entry of `Normalization:KnownAcronyms` — HVAC, AC, AAA, ABC, GTA, LLC, ESA… — stay upper-case; reuse
   `StringFormattingExtensions.ToTitleCase`, which already keeps short all-caps words), ≤150; AI may correct typos (§9.4
   rule 3). Duplicate names in one provider — before OR after the AI's corrections — are merged (richest wins), because the
   platform requires unique names per business.
2. Description: the source's own words (AI-cleaned), ≤ `MaxServiceDescriptionChars` (default 1000; platform max 5000);
   none ⇒ none. **The AI never writes a service description the source does not support.**
3. **Price** (the existing `ServicePricingRules` decide what may be stored — never a second definition):
   | Source | Stored |
   |---|---|
   | `on_request`, or every amount null, or any amount 0 / negative | `PriceTypes.OnRequest`, every amount null ("Price on request") |
   | `fixed` + amount | `Fixed`, FixedPrice |
   | `hourly` + hourlyRate (or amount) | `Hourly`, HourlyRate, MinimumHours |
   | `starting_from` + amount | `Starting from`, StartPrice |
   | `range` + min (+ max ≥ min) | `Starting from`, StartPrice + MaxPrice (how the platform stores a range) |
   | `range` with only max | `Starting from` with MaxPrice only — allowed ("a ceiling with no start books AT the ceiling", UW-29) — verify the current rule before relying on it |
   | `minimumCharge` alone | minimum charge (counts as a price — existing rule) |
   | `visitFee` / `travelFee` | ChargePerVisit / ChargePerDistance (+ min distance, unit); ignored when the price is On request (the rule nulls them) |
   | `currency` null | the business currency (from the address country, `Discovery:CountryCurrencyMap`) |
   | `currency` ≠ the business currency | price dropped ⇒ On request + review flag `CurrencyMismatch` |
   | amount > the currency-scaled review ceiling (`PriceReviewCeiling`, the same rule the setup pipeline uses) | kept + review flag `PriceAboveCeiling` (collected into the run summary, §16.4 — no per-provider alert) |
   | `taxIncluded` true/false | `TaxIncluded`; tax RATE never imported |
   | amount not traceable to `priceText`/amount fields (§9.4) | dropped ⇒ On request + flag |
4. Delivery flags: from `deliveredAt`; when both null the AI chooses from the category's nature with `basis =
   category_default` (salon/garage/clinic ⇒ business location; plumber/cleaner/mover ⇒ customer location); code requires ≥1
   true. Recorded in history as inferred.
5. Duration from `duration` (minutes/hours/days); invalid ⇒ none.
6. Image: only with "Copy photos", the first fetchable image through the new public-media method (§11.6).
7. Status: written `Approved` by the writer (like AI setup — the curation applies the content rules, D14); a service with
   no category pair after resolution ⇒ `PendingProviderCompletion` (existing rule) + review flag `ServiceWithoutCategory`.

---

## 9. AI — where it is used, how it is checked, what it costs

### 9.1 Where AI is used (and nowhere else)
| Step | AI? | Model (setting) |
|---|---|---|
| Schema, cleaning, dedupe/merge, look-ups, prices, hours, contacts, URLs, addresses | **No** | — |
| **Curation** (one call per provider item) | Yes | `AdminProviderImport:Ai:CurationDeploymentName` (default `gpt-6-luna-import` @ Medium; may point at `gpt-6-luna` until the deployment exists, §17.1) |
| **Second opinion** (only when §9.5 triggers) | Yes | `…:ReviewDeploymentName` (default `gpt-6.1-sol-import` @ High; may point at `gpt-6.1-sol` until the deployment exists, §17.1) |
| Custom category creation + alert | No (deterministic resolver) | — |
| The setup applier's own AI steps (the offering judge — McpService sub-flow "D5-setup-offering-judge" — image captions/verifies E1–E4, taxonomy confidence alerts) | **Switched off for the import** (§19.1 options) — the curation already covers them | — |
| Search enrichment + embeddings after publish | Yes, **existing shared pipeline** (§9.7) | `SearchIndexEnrichment` / `AzureAIFoundry` |
| Photo relevance check | Only if "Copy photos" AND `Photos:VerifyWithAi` (default **false**, §11.6) | existing `SetupImageVerifier` |

### 9.2 The curation call — input (built in code)
Messages ordered for **prompt caching** (identical prefix for every provider in the run):
1. System prompt (`AdminProviderImport:Ai:CurationSystemPrompt`, class default identical — memory: appsettings OVERRIDES the
   class default, update both).
2. The category tree from `CategoryPromptService.GetCategoryPromptDataAsync` — **global categories only** (custom
   categories of OTHER businesses must never leak into a prompt; the new business has none yet) — in the existing
   `Category: "X" (id: …)` format. Fetched once per run lane and reused (memory-cached 24 h already).
3. The provider's NormalizedProvider as compact JSON (cleaned values + the verbatim evidence texts + for a merged item every
   member record's name/city/category), with indices (`serviceIndex`, `offerIndex`) the output must refer to. The
   scraped text is wrapped as DATA (a delimited block the system prompt says may contain instructions that must be ignored).
4. **Large catalogues are chunked**: a provider with more than `CurationServicesPerCall` (40) services gets one call for
   the business + the first 40 services, then services-only calls for the rest (same prefix, same rules); each chunk is
   banked on its own. A truncated answer (finish reason "length") is never parsed — it counts as a failed call and the
   chunk is retried ONCE with half the services (within the per-item AI budget).

### 9.3 The curation call — output (strict JSON schema; `enum` + `description` only)
```
{
  "businessName":        { "value": str, "change": "none|casing|typo|removed_location_suffix|removed_seo_words|common_brand_for_merge" },
  "description":         { "value": str|null, "basis": "source|none" },            // ≤1000, source facts only
  "primaryCategory":     { taxonomy },
  "additionalCategories":[ { taxonomy } ],                                          // ≤ MaxCategoriesPerProvider
  "services": [ {
      "serviceIndex": int(enum 0..N-1),
      "keep": bool, "dropReason": "not_an_offering|duplicate|out_of_scope|is_a_product_not_service|other|null",
      "name": str, "nameChange": "none|casing|typo|shortened",
      "description": str|null,
      "taxonomy": { "categoryId": str|null, "subcategoryId": str|null, "disposition": "GlobalMatch|CustomProposal",
                    "proposedCategoryName": str|null, "proposedSubcategoryName": str|null, "confidence": "high|medium|low" },
      "deliveredAt": { "businessLocation": bool, "customerLocation": bool, "basis": "source|category_default" },
      "price": { "type": "fixed|hourly|starting_from|range|on_request", "amount": num|null, "min": num|null,
                 "max": num|null, "hourlyRate": num|null, "taxIncluded": bool|null, "evidence": str|null }
  } ],
  "hoursFromText": null | { "days": [ { "day": "Monday…", "closed": bool, "open": "HH:mm"|null, "close": "HH:mm"|null } ], "evidence": str },
  "offers": [ { "offerIndex": int(enum), "keep": bool, "reason": str } ],
  "friendlyNameCandidates": [ str, str, str ],                                     // ≤20 chars, a-z 0-9 -
  "personName": { "firstName": str|null, "lastName": str|null, "isSinglePerson": bool },
  "sourceLanguage": "en|fr|es|hi|gu|other",                                        // the language the business writes in
  "mergeVerdict": "not_a_merge|same_business|not_same_business|unsure",
  "flags": [ "possibly_closed|not_a_service_business|category_uncertain|conflicting_information|offensive_or_spam|
              contact_details_in_text|name_is_not_a_business_name|description_promotional_only|duplicate_suspected" ],
  "confidence": "high|medium|low",
  "reasons": [ str ]                                                                // short, admin English
}
```
Prompt rules (write them as numbered rules; test each with a golden case):
1. **Never invent.** Every value must come from the input. If unsure: null + flag.
2. Business name: fix only casing, obvious typos (1–2 characters), SEO words ("Best", "| Call Now", "near me"), a trailing
   location word for a merged brand. Never translate, never "improve" a name.
3. Service names: fix casing/typos/shorten noise ("Plumbing services in Oakville" → "Plumbing Services"); never rename into
   a different service; never merge two different services.
4. Description: 1–4 plain factual sentences from the source only; no superlatives the source does not make, no phone,
   email, URL, prices, or "we are the best"; same language as the source (never translate).
5. Categories: choose from the provided tree (ids verbatim); a `CustomProposal` keeps the closest global parent and proposes
   a subcategory; propose a new top-level category ONLY when no parent fits (e.g. "Dental"). Never hardcode trade names
   in the prompt (CLAUDE §3.7).
6. Prices: copy ONLY numbers that appear in the evidence text; `evidence` = the exact substring. 0 means no price.
7. Hours from text: only when explicit; `evidence` = the exact substring.
8. Drop a "service" that is a product, a brand name, a page section ("Contact us", "Testimonials"), or a duplicate.
9. **Content rules (the B2 equivalent, D14):** profanity, hate, gibberish, placeholder text, spam, pharmaceutical or
   prohibited offerings, contact details inside names/descriptions ⇒ `flags` + drop the text.
10. `confidence`: high only when every kept fact is directly supported and categories are clear.

### 9.4 Code verifies every AI answer (P3) — "the AI proposes, code disposes"
Each check failing ⇒ the value falls back to the deterministic one (or null) AND a review flag is added:
1. Every `serviceIndex`/`offerIndex` exists; every input service is answered exactly once.
2. **Business name**: the AI value must equal the cleaned source name ignoring case/space/punctuation, OR be within
   Damerau-Levenshtein distance ≤ `NameTypoMaxEdits` (default 2) of it, OR be the source with SEO/location words removed
   (word-subset check), OR (merge) a common substring of the member names. Else ⇒ source name kept + `NameChangedByAi`.
3. **Service name**: each word of the AI name must appear in the source name/description (case-insensitive, stemmed by a
   simple plural rule) OR be within 2 edits of a source word. Else ⇒ source name.
4. **Prices**: every AI number must appear in its `evidence`, and `evidence` must be a substring of the record's
   price/notes/priceText/service description. Else ⇒ the deterministic §8.9 price. The AI can never turn On request into a
   price without evidence, and never change a structured amount the bot gave.
5. **Hours from text**: each hour must appear in `evidence` (12/24 h forms normalised), evidence ⊂ `hoursText`. Else ⇒ none.
6. **Taxonomy**: ids must exist in the tree and be parent/child consistent (the existing resolver re-checks this anyway).
7. **Description**: strip phone/email/URL patterns; ≤1000; rejected (⇒ the trimmed source description instead) when it
   introduces a number (years, %, $) not in the source, OR contains a claim phrase from
   `Normalization:UnsupportedClaimPhrases` ("licensed", "insured", "certified", "award-winning", "family-owned", "best",
   "#1", "guaranteed", "24/7", "emergency"…) that the source text does not contain, OR fewer than
   `DescriptionMinSourceOverlap` (80%) of its content words appear in the source text. An invented claim can never pass.
8. **Friendly names**: validated by the friendly-name rules (§11.5) — the AI only proposes.
9. **Person name**: tokens must be substrings of the source `fullName`/first/last; else placeholder.
10. **Merge veto**: `not_same_business` ⇒ the merged item becomes skips (§7.5).

### 9.5 Second opinion (P4) — only when needed
Triggered when ANY: `confidence = low`; any `category_uncertain`/`conflicting_information`/`duplicate_suspected` flag;
`mergeVerdict = unsure`; ≥ `ReviewTriggerFailedChecks` (default 2) code-verification failures; a `CustomProposal` for a
new TOP-LEVEL category. The review model gets the same input + the first answer + the list of code findings and returns the
same schema plus `agrees: bool`. Its answer goes through the same §9.4 checks. Outcome:
- both agree and pass the checks ⇒ accepted (may still be Live);
- they disagree on a category, the name, a merge or any kept price ⇒ the conservative choice (source value / On request /
  no merge) is applied **and** the item is held for review (`AiDisagreement`).
Expected share: 15–25% of providers on scraped data (measure in the pilot, §20).

### 9.6 Banking (CLAUDE §0.23) — never pay twice for the same answer
- Key = SHA-256 of: the CONTENT of the NormalizedProvider (canonical JSON of the business, contacts, addresses, areas,
  categories, services, hours, offers, FAQs, licences — **excluding volatile fields that do not change the answer**:
  `scrapedAt`, `sources`, `dataQuality.completenessScore`, `batch.*`), the system prompt fingerprint, the category tree
  fingerprint (ids+names), the deployment name, reasoning effort, and `ProviderImportCurator.CurationRulesVersion`
  (starts at 1) — so a re-scrape of an unchanged business is a free bank hit. A failed or truncated call is never banked.
  The second opinion has its own `ReviewRulesVersion`.
- Stored as gzip JSON in blob `provider-imports/_bank/curation/{key}.json.gz` (and `/review/`), no TTL (tiny). A retry, a
  redelivery, a re-run of a failed item, or a re-upload of an unchanged record costs **zero** AI.
- Add both versions to `Clinqet.Communications.UnitTests/Conventions/BankRulesVersionConventionTests.cs` with the
  "bump when…" comment (§0.23): bump when the prompt rules, the output schema, the input shape or the verification
  semantics change; never for refactors.

### 9.7 What the import does NOT separate (honest)
After a provider goes Active, the existing change-feed pipeline enriches each service (gpt-5.4-mini, batched) and embeds it
(text-embedding-3-large) on the SHARED platform deployments — exactly as for a provider who types their profile by hand.
It is already paced by the `AiBudget` Bulk lane (`BulkHeadroomShare` 0.4, `MaxBulkConcurrency`), so interactive search
keeps its headroom. Making the indexer import-aware to use separate deployments would fork the search pipeline (and the
ranking/embedding consistency rules) — **not done**; the throttled lanes (§16.6) plus the Pending→Active switch (one
enrichment per service) bound it. Geocoding (Google) is also shared (cached, single-flight).

---

## 10. Verdict and the review gate (D2, D11)

### 10.1 Verdict per item (S6)
- **Live** ⇒ `BusinessProfile.Status` Pending → **Active** through the SILENT activation (`ActivateImportedAsync`, §19.5 —
  no `ProviderReactivated` alert); the change feed reindexes the whole business once. Item `Live`.
- **Review** ⇒ stays **Pending** (hidden everywhere). Item `NeedsReview` with `reviewReasons[]`.
- Live requires: no review reason, curation `confidence = high` (or medium with every check passing and no flags — setting
  `LiveOnMediumConfidence`, default **false** — quality first), at least one Approved service, a geocoded primary city,
  and a fresh source (`scrapedAt` within `MaxSourceAgeDays`, 180 — else `StaleSource`).

### 10.2 Review reasons (`ProviderImportReviewReason`) — each shown to the admin in plain words
`LowAiConfidence`, `AiDisagreement`, `NameChangedByAi`, `CategoryUncertain`, `ServiceWithoutCategory`,
`NoApprovedServices`, `ConflictsInSource` (bot `dataQuality.conflicts` on name/phone/email/address),
`PossibleDuplicateInFile`, `PossibleExistingBusiness`, `AddressNotConfirmed`, `AtStoreWithoutStreet`, `HoursIncomplete`,
`HoursConflict`, `HoursNotRepresentable` (overnight or split hours, §8.6), `SocialConflict`, `CurrencyMismatch`,
`PriceAboveCeiling`, `PossiblyClosed` (temporarily_closed, or AI `possibly_closed`), `SourceSaysClosed` (a re-upload of an
existing provider says permanently closed, R5), `NotAServiceBusiness` (AI flag without the two-model agreement that would
skip it), `OffensiveOrSpam`, `StaleSource`, `NoFriendlyName`, `PhotosNeedCheck`, `MergedRecords` (only when the merge had >
`MergeReviewSize` members, default 5).

### 10.3 What the admin does with a held provider
On the item drawer (§18): **Open setup wizard** (the existing `POST admin/provider-accounts/{userId}/onboarding-token` +
wizard — unchanged, works on a Pending business because access reads SQL `Business.Status`), **Approve**, **Remove**
(§10.4). Bulk: select many → Approve.
**Approve** = re-check "≥1 Approved (or PendingApproval-from-this-item) service and a geocoded primary city" ⇒ approve this
item's `PendingApproval` services (FillGaps on a held item, §11.3 S6) ⇒ `ActivateImportedAsync` (silent) ⇒ item
`ApprovedByAdmin` (who, when). If the account was removed or the business closed meanwhile ⇒ 409 with a plain message.

### 10.4 Remove
Only for an item whose account is still unclaimed. One admin action, with a confirm dialog in which the admin types the
business name (the existing closure rule — `BusinessClosureService.CloseAsync` requires the confirmation name to equal
`DisplayName`): closes the business through the existing closure path (teardown queue, TTL purge) and deactivates the
account (`IsActive = false`).
- **Closure Blocked** (bookings, invoices or members exist — `BusinessClosureService.cs` ~L104-124): Remove is refused with
  the blocking reason shown ("This business has 2 booking requests — handle them first"); nothing is half-removed.
- **Live with real customer activity** (leads, messages): allowed only through the same closure rules — the closure path
  decides, never the importer.
- After removal: the EMAIL stays blocked for re-import (the collision check matches closed rows) — a later upload reports
  `AlreadyOnClinket (removed by admin on <date>)`. ‼️ The PHONE check covers ACTIVE accounts only, so a phone-only removed
  business would be re-created by a later upload — the importer therefore ALSO blocks it: the Identity endpoint returns `ExistingClosed` when an INACTIVE account with
  `ProvisionedAt` set holds that phone (SQL only, no Cosmos read). ‼️ No hard delete.

### 10.5 Taken over while held (D11) — and taken over while still being built
`ProviderTakeoverService.TakeOverAsync` (Identity; the online-booking flip is `TurnOnlineBookingsOnAsync` ~L288-323) gains
one step: **if the business's `Status` is `Pending`, set it `Active`** (Pending is written only by the importer, §3.6).
‼️ Today `TurnOnlineBookingsOnAsync` only LOGS a failure. The Pending → Active flip must not fail silently: on failure it
raises `ProviderImportActivationFailed` (High, deterministic EventId per business) so the admin activates it, and the
import item drawer shows "Owner took over — profile still hidden — Approve". The take-over itself still succeeds (the
owner is never blocked).
- **Held** item: the review list shows "Owner took over — no review needed" (the drawer reads `ClaimedAt` by point read;
  the list reads `ClaimedAt` for the page's accounts in one batched SQL query) and excludes it from the review count.
- **Still being built** (the owner signs in during S1–S5 — a short window, because all AI work happens before the
  account exists): the take-over activates the profile as it stands; the worker's claim check before each later stage
  stops writing (§11.3) and marks the item `OwnerTookOver` with "profile may be incomplete — open it". The owner now
  manages their own profile; the import never writes into a claimed account.

### 10.6 Close the self-activate loophole, and approve from anywhere
- `POST business/profile/reactivate` (PROVIDER endpoint) is narrowed to `Inactive → Active` only (§19.5) — today it also
  turns `Suspended` (and would turn `Pending`) Active. The admin path keeps its behaviour. Unit + integration tests.
- `ProviderTrustPage.jsx` (admin) gets an **Approve** action for a Pending business that calls a small admin endpoint
  doing the same checks + `ActivateImportedAsync` for that businessId — it does NOT need the import item (finding the item
  from a businessId would mean searching every run's partition). The run page reconciles: the item drawer point-reads the
  profile's status and shows "Approved outside the import on <date>".

---

## 11. Stage B — processing one provider (Functions, queue `provider-import-items`)

> Revised after the independent review (2026-10-06): **every decision that can still SKIP a provider is taken BEFORE an
> account exists** (no orphan accounts), **every created id is deterministic** (a crash at any point converges), lanes are
> **chained** (no 5,000-message fan-out, no false "stalled"), and counters are **recomputed** from the items (never trusted
> as the only truth).

### 11.1 Lanes — chained, not fanned out
- At validation each planned item gets `lane = ordinal % ParallelismPerRun` and `nextItemId` (the next planned item of the
  same lane, by ordinal) — a linked list per lane, written on the items (no query needed later, only point reads).
- The run document holds `lanes[] {lane, headItemId, currentItemId, lastProgressAt, done}`.
- **Start** (`POST …/start`, run `Validated`): conditional patch → `Processing`, then sends **one message per lane**
  (`messageId = "item:{runId}:{itemId}:{attempt}"`) for each lane's head. Nothing else is sent.
- When an item reaches a terminal status, the processor sends the message for `nextItemId` **before completing its own
  message** (send-then-complete; a duplicate send is harmless because the next item's own state check makes it a no-op).
- **Cancel / pause** simply stop the chain: the processor checks the run status before sending the next message.
- The queue needs no sessions and no duplicate-detection reliance: idempotency is the item state machine + deterministic
  ids; `messageId` carries an attempt suffix so Resume/Retry re-sends are never swallowed by duplicate detection.

### 11.2 The item state machine
`Planned → Queued → Preparing → Creating → Building → (Live | NeedsReview | Skipped | Failed | OwnerTookOver)`
plus admin states `ApprovedByAdmin`, `Removed`, and `Cancelled`. Every transition is a conditional patch on the item's
ETag; a message for an item in a terminal state is completed as a no-op. Each item records `stage`, `attempts`,
`aiCalls`, `aiCostUsd` (cumulative across ALL attempts — never reset), `lastError`.

### 11.3 Steps — in this order (each idempotent)
| Step | What | Why here / idempotency |
|---|---|---|
| **P1 Prepare** (no account yet) | geocode the primary city / street and every service area (§8.5, §8.7); decide `NoCity` now | geocoder cache + single-flight; results stored in the item's `prepared.json` blob so a redelivery never re-geocodes |
| **P2 Curate** | the AI call(s) (§9.2–9.3), banked (§9.6) | banked ⇒ a redelivery is free; per-item AI budget (§16.6) checked BEFORE each call |
| **P3 Verify** | §9.4 in code | pure |
| **P4 Second opinion** | §9.5 when triggered | banked |
| **P5 Pre-verdict** | anything that turns the item into a SKIP happens here: merge veto, `not_a_service_business` with high confidence, `NoCity`, `NoSignInContact` after verification, re-check of the contact against SQL (claimed meanwhile ⇒ `AlreadyOnClinket`; created meanwhile by another run/admin as an unclaimed prepared account ⇒ switch to **FillGaps**, R8) | **no account has been created yet**, so a skip leaves nothing behind |
| **S1 Account + business (Identity internal endpoint, §11A)** | one call creates (or returns) the prepared account AND its business/workspace with **deterministic ids**: `userId = DeterministicGuid("provider-import-user", runId, itemKey)`; DisplayName = the business name; names from P3 (`personName`) | the endpoint is idempotent by userId: same request ⇒ same answer; a crash between commit and recording `userId` ⇒ the redelivery gets the SAME account back |
| **S2 Profile shell** | `IBusinessProfileBootstrapService` (§19.2): BusinessProfile `Status = Pending`, `AllowOnlineBookings = false`, PUBLIC email/phone = the business's public contacts chosen in §8.2/§8.3 (**never** the owner's direct contact unless it is also the business's public one), `ParticipatesInMarketplace` per the existing SignupOrigin rule, search cell assigned as today, global portfolio, **no default hours**, **no `OnlineBookingsDisabled` alert** (the bootstrap runs with `AlertMode = CollectForSummary`, which drops it — a prepared account is always disabled by design, §19.2) | create-if-absent (id = businessId) |
| **(claim check)** | before S2, S3, S4, S5 and S6: SQL point read of `ClaimedAt`. Claimed before S2 ⇒ S2 still creates the shell, but `Active` (the take-over found no profile to activate), then stops. Claimed later ⇒ stop writing, item `OwnerTookOver`, detail "owner took over during the import — profile may be incomplete; open it" (the take-over already made it Active, §10.5) | the window is short (AI ran before S1), but it is handled |
| **S3 Apply** | the shared applier (§19.1) with the import options (§19.1 table): profile fields, addresses (deterministic `AddressId`), social, service areas (deterministic ids — existing), category selections, taxonomy + custom categories (alerts COLLECTED, §16.4), services (create-only, deterministic id seeded from the **pre-AI normalised source name**: `DeterministicGuid(businessId, "import-service", normalizedSourceName)`), hours (only when known), offers (existing signature dedupe), FAQs (deterministic id `DeterministicGuid(businessId, "import-faq", normalizedQuestion)` — requires a create-with-id path in `KnowledgeManagementService`), licences (deterministic id from type+number) | every write is create-if-absent or fill-blank; **the import never routes an existing service through the writer's update path** |
| **S4 Friendly name** | via the Identity internal endpoint (§11A.4) | unique index + history; same slug requested again ⇒ same answer |
| **S5 Photos** | only with "Copy photos" (§11.6) | deterministic image ids |
| **S6 Verdict** | §10.1 — New+Live ⇒ a **silent** status patch Pending → Active (`ProviderLifecycleService.ActivateImportedAsync`: no `ProviderReactivated` alert); Review ⇒ stays Pending; FillGaps never changes the status of an EXISTING profile (a FillGaps item whose shell S2 had to create gets the New-item verdict: Live ⇒ Active, else held); new services on a held-for-review FillGaps item are written `PendingApproval` with NO per-service alert, and are approved together with the item, §10.3) | conditional patch |
| **Finish** | item terminal status + `result.json` (what was written, before/after for FillGaps, "Not applied" list R3/R6); send the lane's next message; complete | the run's display counters are patched with `Increment` as a cache only (§11.4) |

### 11.4 Counters and finalize — recomputed, never trusted alone
- `Increment` patches on the run document are a **display cache** for live progress.
- The **truth** is one single-partition query over the run's items: `SELECT c.status, COUNT(1) FROM c WHERE c.type =
  "ProviderImportItem" GROUP BY c.status` (partition `provimport_{runId}`, `type` and `status` are indexed).
- A lane whose `nextItemId` is null marks `lanes[i].done`. When the last lane finishes, that processor recomputes the
  counts, writes them (replacing the cache) and performs the conditional `Processing → Completed | CompletedWithErrors`
  patch; a racing processor fails the ETag and does nothing.
- One completion alert per run COMPLETION (`EventId = provimport-completed:{runId}:{completionNumber}`), so a later
  "Retry failed" (run `Completed → Processing → Completed`, `completionNumber + 1`) reports its own result instead of being
  swallowed.

### 11.5 Friendly name (S4)
Rules = the existing ones in Identity (top-level `FriendlyName:*` section — MinLength 3, MaxLength 20, AllowedPattern,
ReservedWords as a `;`-joined string, read in `AuthService` ~L4062-4069) and uniqueness in SQL `Business` +
`BusinessFriendlyNameHistory`. Candidates in order, first available wins: (1) the bot's `friendlyNameSuggestions`; (2) the
AI's 3 candidates; (3) deterministic slug of the cleaned name (lower-case ASCII, accents transliterated, `&`→"and", legal
suffixes and "the" dropped, non-alphanumerics → "-", collapsed, cut at the last whole word ≤ 20, else initials of the extra
words); (4) slug + "-" + city slug (cut to fit); (5) slug + "-2" … "-{FriendlyNameMaxNumberSuffix}"; (6) none ⇒ unset +
review flag `NoFriendlyName`. Non-Latin names (Indic scripts) skip to (4)/(5) with the city. The Identity endpoint tries the
candidate list in one call and returns the slug it set. **No `FriendlyNameUpdated` email/notification** is sent for an
import (the endpoint never calls the controller's notification branch).

### 11.6 Photos (S5, only when the run's "Copy photos" is ticked — D8)
- Sources: `media.logoUrl` → profile picture (only when unset); `services[].imageUrls[0]` → that service's one image;
  `portfolio[].imageUrls` → portfolio projects; `media.galleryImageUrls` → the global portfolio (caps §16.6).
- ‼️ **New code is needed** (review finding): the existing `IngestServiceImagesAsync` uses the ALLOW-LIST policy only, and
  the PublicHost policy is used only for the knowledge lane, writes to a PRIVATE container and requires an image file
  extension (`RemoteImageIngestionService.cs` ~L155-169, ~L304-325). Add `IngestPublicMediaAsync(url, target)` to the
  SAME service, reusing every existing guard (https, public DNS re-checked at connect, no redirects, MIME + magic bytes,
  streaming size cap, max pixels) with: the PublicHost host policy, **no extension requirement** (type decided by magic
  bytes — CDN URLs often have none), and the PUBLIC media containers the platform already uses for service images, portfolio
  and profile pictures. Never a second downloader. Derivatives through the existing media-derivative queue. Deterministic
  image ids `DeterministicGuid(businessId, "import-image", sha256(url))`.
- **No AI captioning/classification** of imported photos (the applier's image lane is switched off for the import — its
  captions and verifies are E1–E4 AI calls on shared deployments). Placement is decided by which schema field the URL
  came from. `Photos:VerifyWithAi` (default false) may later enable the existing `SetupImageVerifier` relevance check.
- A failed image never fails the provider; > half failed ⇒ flag `PhotosNeedCheck`.

### 11.7 Stall detection (timer `ProviderImportSweeperFunction`)
Schedule: cron setting `AdminProviderImport:Processing:SweeperSchedule` (default every 15 minutes), carried in
`local.settings*.json` + `$script:RequiredFunctionAppSettings` exactly like the existing timer cron keys. It reads the runs
partition (`status IN (AwaitingUpload, Uploaded, Validating, Processing)`, single partition) and per run:
- `AwaitingUpload` older than `AbandonedUploadHours` (24) ⇒ blob deleted, run `Discarded`;
- `Uploaded` / `Validating` with no progress for `StaleValidationMinutes` (30) ⇒ re-send the validate message
  (`validate:{runId}:{n}`), max `MaxStallRequeues` (3), then `ValidationFailed: Stalled` + one High alert per run per day;
- `Processing`: for each lane not `done` whose `lastProgressAt` is older than `StaleLaneMinutes` (default 60 — longer than
  the slowest provider incl. AI retries; measure in the pilot): point-read the lane's `currentItemId`; if it is not in a
  terminal state, re-send its message (attempt + 1); if it IS terminal (the chain broke between "finish" and "send next"),
  send the next item. After `MaxStallRequeues` on the same item ⇒ item `Failed: Stalled`, chain continues, one High alert
  `ProviderImportStalled` per run per day.
Normal queuing is never "stalled": only a lane that made no progress is.

### 11.8 Failures
- **Transient** (Cosmos 429/503 after SDK retries, SQL transient, the Identity endpoint 5xx/timeout, geocoder circuit open,
  blob timeout) ⇒ rethrow ⇒ Service Bus redelivers (max 5); the checkpointed `stage` resumes at the failed step.
- **AI unavailable for the whole run** (deployment 404, auth 401/403, sustained 429 beyond `MaxRetries`, or N consecutive
  items failing on AI — `AiOutageItemThreshold`, default 3) ⇒ the run → `PausedAiUnavailable` + one High alert
  `ProviderImportAiUnavailable`; the current item returns to `Queued`; Resume continues. Never fail 2,000 items one by one.
- **AI refused the content** (content filter / prompt shield 400 on legitimate scraped text) ⇒ nothing has been
  created yet (P2 runs before S1) ⇒ the item is `Skipped: AiRefusedContent` (listed for manual handling, the source shown
  in the drawer). No retry spend.
- **Permanent** (a business rule refusal, an AI answer that fails the schema twice) ⇒ item `Failed` with `lastError {code,
  detail}`; if S1 already ran, the account/business stay Pending (invisible) and "Retry" resumes from the stage.
- **Per-item AI budget exhausted** (planned curation chunks + `MaxAiCallsPerProvider` (4), counted across all attempts) ⇒ `Failed:
  AiBudgetExhausted` — never an unbounded retry loop.
- **Run cost hard limit** ⇒ run `PausedCostLimit` (§16.6); the item in hand returns to `Queued`; the chain stops; Resume
  after raising the limit.
- **Dead-lettered** item ⇒ caught by the sweeper (non-terminal + no progress) ⇒ requeued or `Failed: Stalled`.
- Never swallow an exception: every catch logs (structured) and rethrows or records the failure.

### 11.9 Cancel / pause / resume / retry
- **Cancel** (Processing, Paused*) ⇒ `Cancelling`; the processor of the in-flight item finishes that provider, sees
  `Cancelling`, marks every not-yet-started item (`Planned` or `Queued`) of its lane `Cancelled` (point reads along the chain) and marks the lane
  done; when all lanes are done the run → `Cancelled` (same recompute + conditional patch as finalize). A message that
  arrives for a `Cancelled` item is completed as a no-op. Already-created providers stay as they are (Live or Pending) — the
  admin can Remove them.
- **Resume** (`PausedCostLimit`, `PausedAiUnavailable`, `PausedIdentityUnavailable`) ⇒ `Processing` + one message per non-done lane for its
  `currentItemId`.
- **Retry failed** (Completed*/Cancelled) ⇒ items `Failed` → `Queued` (attempt + 1; the per-item AI budget is NOT reset),
  a dedicated retry lane chain built from them, run → `Processing`; completion raises a new completion alert (§11.4).
- **MaxConcurrentRuns** is enforced with a compare-and-set on one small document in the runs partition
  (`id = provimport_active`, `activeRunIds[]`, ETag) — never check-then-act.

---

## 11A. The Identity internal endpoint — account + business creation (owner: "extremely solid … every edge case … if this failed how to handle … this is first … it need to be correct")

### 11A.1 Why an endpoint, and its shape
Identity is the ONLY place that ever creates an account (owner decision 2026-10-06). The Functions worker calls one
private, service-to-service endpoint on the Identity API; the code behind it is the SAME provisioning core the admin form
uses (§19.3), so there is one set of rules for both.
- Route: `POST api/v1/internal/provider-import/accounts` and `POST api/v1/internal/provider-import/friendly-name`.
- Auth: **service key only** — header `X-Internal-Api-Key`, compared in constant time
  (`CryptographicOperations.FixedTimeEquals`) against `ProviderImportInternal:ApiKey` (≥ 32 chars; the host refuses to boot
  without it, like the Main API's `SignalRSettings:InternalApiKey`, `clinqetapi/Clinqet.API/Program.cs` ~L1624-1630 —
  mirror that filter's pattern in Identity; Identity has none today). `[AllowAnonymous]` for JWT, the key filter is the
  only gate; NOT `[AllowedInSetupSession]`; excluded from CORS (server-to-server); rate limit: a dedicated policy sized
  for the lanes (e.g. 60/minute), never the admin 40/hour throttle. The key: Key Vault secret, referenced by Identity and
  Functions app settings via `deploy.ps1` (created once per environment; rotation = set the new value in both, Functions
  first — document in the deployment skill). The Functions side uses a typed `HttpClient` from `IHttpClientFactory` with a
  timeout (`AdminProviderImport:Identity:TimeoutSeconds`, 30) and Polly retry ONLY for 5xx/timeouts (never for 4xx).
- Base URL setting in Functions: `AdminProviderImport:Identity:BaseUrl` (per stamp — CA Functions call CA Identity) +
  ARM/deploy.ps1.

### 11A.2 Request / response (accounts)
Request: `{ userId (deterministic GUID), runId, itemId, startedByAdminUserId, signInEmail?, signInPhoneE164?,
phoneCountryIso, firstName?, lastName?, businessName, country, preferredLanguage, mode: New|FillGaps,
existingUserId? (FillGaps), addSignInEmail? (FillGaps gap-fill, §12.2), publicEmail?, publicPhoneE164? (matched exactly like the
sign-in contacts; never stored on the account) }` — every field validated server-side again
(never trust the caller, even a trusted one).
Response: `{ outcome, userId, userNumber, businessId, claimedAt?, conflict? }` where `outcome` is one of:
| Outcome | Meaning | Worker action |
|---|---|---|
| `Created` | new account + business in ONE transaction | continue |
| `AlreadyCreated` | an account with THIS `userId` exists (a retry) — returns it and ensures its business | continue (idempotent) |
| `ExistingPrepared` | the contact belongs to ANOTHER account that is prepared and unclaimed | switch the item to FillGaps on it (R8) |
| `ExistingTakenOver` / `ExistingSelfRegistered` / `ExistingClosed` | contact used by an account that is not ours to fill | `Skipped: AlreadyOnClinket` with the detail |
| `ContactOnTwoAccounts` | email on one account, phone on another | skip |
| `PendingInvitation` | the email has a pending team invitation (`EnsureSelfServeBusinessAsync` would return `ExpectedByInvitation`) | `Skipped: PendingInvitation` — the person is expected to join someone else's business |
| `CustomerRecord` | the contact belongs to an `IsSystemGenerated` customer shell created by a provider's CRM | `Skipped: ContactIsCustomerRecord` (never merge a provider into a customer shell) |
| `InvalidRequest` (400) | a field failed server validation | item `Failed` (permanent) with the field |
| `OwnershipLimit` | the matched account already owns a live business | skip `AlreadyOnClinket` |
HTTP: 200 for every outcome above (they are business answers), 400 for `InvalidRequest`, 401 bad key, 429 rate limit,
5xx unexpected.

### 11A.3 Inside the transaction (Identity)
One execution-strategy transaction, exactly like `CreateProviderAsync` today, plus the business:
1. Look up by `userId` ⇒ found ⇒ `AlreadyCreated` (ensure the business exists — step 5 — then return).
2. Collision checks (the existing `CollidingAccountAsync`: email on ANY row, phone on any ACTIVE row) for the sign-in AND
   the public contacts ⇒ classify per the table; never create.
3. Pending-invitation check (`IX_BusinessInvitation_Email_Pending`) ⇒ `PendingInvitation`.
4. Create the `UserProfile` with the supplied deterministic `Id`, `ProvisionedByAdminId = startedByAdminUserId`,
   `ProvisionedAt`, no password, `ReceiveMarketingEmails = false`, confirmed contacts (as the admin form does), names (or
   placeholders), country, `PreferredLanguage`; roles, `UserUserType = Business`, consent rows (`AdminProvisioned`
   platform) — all as today.
5. Ensure the workspace/business (`EnsureSelfServeBusinessAsync` / `EnsureWorkspaceWithoutEmailAsync` → `CreateBusinessAsync`)
   with **DisplayName = businessName**; owner membership + role + outbox row; search cell. ‼️ The import path must NOT
   enqueue the offer-match / trial announcement (`BusinessProvisioningService.cs` ~L267 → `OfferMatchService`) — a prepared
   account receives no promotional message (PLAN §6: no marketing before take-over); verify whether the dispatcher already
   blocks that category for prepared accounts and close it at the source either way.
6. UserActivity `ProviderAccountImported` in the subject's partition with metadata `{runId, itemId}` (point-readable by
   userId — this is how any screen finds "which run created this account" without a cross-partition query).
7. Commit. A unique-index violation on commit (a racing creation of the same email/phone) ⇒ re-run the collision check
   inside a fresh scope and return its outcome (the existing "lost race still answers 409" pattern) — never a 500.
8. Structured log (ids only, never contact values at Information level).

### 11A.4 Friendly name
Request `{ userId, businessId, candidates[] (≤ 20: bot ≤ 5, AI 3, slug, slug-city, `-2…-{FriendlyNameMaxNumberSuffix}`; already validated by the worker) }` → Identity validates each candidate
with the existing rules, tries them in order against `Business.FriendlyName` + history (unique index catches races), sets
the first free one (history row + Cosmos mirror, as `PUT UserProfile` does) and returns `{ slug | null, tried[] }`. Same
request again ⇒ the business already holds one of the candidates ⇒ returns it (idempotent). Never sends the
`FriendlyNameUpdated` notification.

### 11A.5 Failure handling (worker side)
| Failure | Handling |
|---|---|
| timeout / 5xx / connection refused | Polly retry (3, exponential) then rethrow ⇒ Service Bus redelivery; the deterministic `userId` makes every retry safe (it may have committed — the next call returns `AlreadyCreated`) |
| 401 (bad key) / 404 (endpoint missing — deploy order) | the run → `PausedIdentityUnavailable` + one High alert (`ProviderImportIdentityUnavailable`) — a configuration error must never be retried 2,000 times |
| 429 | honour `Retry-After`, then redelivery |
| 400 `InvalidRequest` | item `Failed` (permanent) — this is a bug in the worker's validation; it shows the field |
| business outcomes | per §11A.2 table |
‼️ Deploy order: **Identity before Functions** for this endpoint (Functions calls it), and Functions before the Main API for
the new alert types — write both into the deployment skill and the final report.

### 11A.6 Tests (Identity suites — §0.18)
Unit + real-SQL integration for every outcome row; the same request twice (AlreadyCreated); crash simulation (commit then
lost response ⇒ retry returns the same ids); two concurrent requests for the same email (one Created, one ExistingPrepared);
bad key / missing key / short key at boot; no notification, no marketing, no offer-match enqueue on the import path; the
admin form path unchanged (its existing tests pass untouched).

---

## 12. Returning businesses and existing accounts (D6, D12)

### 12.1 Recognising a business Clinket already has (validation step 6)
In order, first hit wins:
1. **Sign-in OR public email** = an account's `NormalizedEmail` (any account, including closed/removed).
2. **Sign-in OR public phone** = an active account's `PhoneSearchKey`.
3. **Same name and place**: SQL `Business.DisplayName` equal to the cleaned business name (case/accent-insensitive collation;
   one batched `IN` query per chunk) ⇒ for each candidate business, one Cosmos **point read** of its BusinessProfile
   (`id = pk = businessId`) ⇒ a match only if the primary-address city equals the record's primary city OR the website
   domains are equal. A name match with a different city and website ⇒ `New` + review flag `PossibleExistingBusiness`
   (never auto-merge, never skip — the admin decides).
- Email and phone pointing to TWO different accounts ⇒ `ContactOnTwoAccounts` skip.
- ‼️ `Business.DisplayName` has no index: the `IN` query scans the Business table once per 500 names. Acceptable at
  today's size; if the pilot shows a slow plan, **ASK** before adding an index (schema change).

### 12.2 What happens to a match
| The account is… | Result |
|---|---|
| prepared and unclaimed (`ProvisionedAt` set, `ClaimedAt` null), active | **`FillGaps`**. If the account was created by the admin form and never onboarded (no Business / no BusinessProfile yet), the Identity endpoint ensures the business and S2 creates the profile shell exactly as for a New item (Pending, then the normal verdict) — a missing shell is the biggest gap of all. Then fill only what is empty — profile fields that are blank, a sign-in email when the account has none (the email must be free), a public email/phone when blank, social links per missing platform, service areas not yet present, categories, services whose normalised name does not exist yet (existing services are NEVER changed — not their name, description, category or an existing price; the ONE exception is R4: an evidenced price added to a service stored as "Price on request"), hours only for days not yet set (never overwrite), offers by signature, FAQs by question, licences by number. The status of an existing profile is never changed (an Active profile stays Active; a held one stays held). Friendly name only if none |
| taken over (`ClaimedAt` set) | `Skipped: AlreadyOnClinket` — never touched |
| self-registered account | `Skipped: AlreadyOnClinket` |
| a CRM customer shell (`IsSystemGenerated`) | `Skipped: ContactIsCustomerRecord` |
| an email with a pending team invitation | `Skipped: PendingInvitation` |
| closed / deactivated / removed by admin | `Skipped: AlreadyOnClinket` with "(removed/closed)" detail |
- Adding a sign-in email to an unclaimed prepared account in FillGaps goes through the same rules as the admin "Correct
  email / phone" (`CorrectContactAsync`): free on every account, confirmed with no code, audit row. Never replaces an
  existing sign-in contact.

### 12.3 Re-uploads — MORE information fills gaps, LESS information NEVER deletes (owner, 2026-10-06)
Owner: *"I do the multiple upload and like the same provider showed up multiple times but second time it will have more
info or second time it will have less info so less info shouldn't delete what we already have set it up for that
provider."* The rule is absolute: **an import only ever ADDS to an existing provider; it never deletes, empties,
downgrades or overwrites anything.** Every row is a test and is re-checked in the §27 audit.
| ID | Second upload of the same provider… | Result |
|---|---|---|
| R1 | has MORE: an email the account lacked, hours, new services, new areas, an offer, FAQs | each missing thing filled (§12.2); everything already there untouched |
| R2 | has LESS: no hours, fewer services, no description, no social links, no areas | **nothing removed or emptied** — a service, hour, area, link or description absent from the new file stays exactly as it is |
| R3 | has a DIFFERENT value for something already set (new description, other price, other hours, renamed service, other business name) | existing value kept; the difference is listed in the item drawer as "Not applied — Clinket already has: …" so the admin can change it in the setup wizard if the new value is right |
| R4 | gives a real, evidenced price for a service stored as "Price on request" | price added (a missing price is a gap); a service that already HAS a price is never changed |
| R5 | says `permanently_closed` | **no automatic closing** — item held `SourceSaysClosed` for the admin (Remove is the admin's decision) |
| R6 | brings a new phone/email while the account already has one | the account's sign-in contact is never replaced; the new value fills the PUBLIC email/phone only if blank, otherwise it is listed as "Not applied" |
| R7 | arrives after the owner took the account over | `AlreadyOnClinket` — never touched |
| R8 | arrives in a second run running at the same time as the first | S1 finds the account the other run just created ⇒ the item switches to **FillGaps** (never a second account, never a skip); concurrent fill-blank writes are ETag-guarded / deterministic-id, so both runs converge |
| R9 | was removed by an admin earlier | `AlreadyOnClinket (removed by admin on …)` |
| R10 | is currently held for review (Pending) | gaps filled; stays held; the earlier review stays open |
| R11 | is identical to the first upload | nothing written at all (every fill finds nothing empty); AI cost ≈ 0 (bank hit) |
| R12 | appears twice in the SAME new file | merged or skipped per §7.5 before any of the above applies |
Implementation rule: FillGaps writes go through fill-blank operations only (conditional on the field being empty / the
document not existing); there is **no code path in the import that issues a delete, a patch-to-null or an overwrite on an
existing provider document**. A convention-style unit test asserts the FillGaps applier calls no delete/replace method on
any repository (mock strict), and an integration test uploads a rich file, then a poorer one, then compares every stored
document byte-for-byte with the first result.

---

## 13. Account flags (D9) and activity rows

### 13.1 Remove `IsAdminProvisioned`
- Every reader switches to `ProvisionedAt != null` (one helper `UserProfile.IsPrepared` / an expression for EF queries —
  `u.ProvisionedAt != null && u.ClaimedAt == null` — **one definition**, used everywhere): `AuthService` ~L773 and every
  `knownAdminProvisioned` argument (~L1250/2005/2100/2570/2710/2789/3160, parameter on `IProviderTakeoverService` ~L57),
  `PreparedAccountDirectory` L56/96, `PreparedProviderService` L65/73, `ProviderTakeoverService` L76-80/226,
  `AdminProviderProvisioningService` L168 (writer)/L299/625, `AppDbContext` ~L219 (`HasDefaultValue`), and ‼️ the RAW SQL
  string in `cosmosindexsetup/DataMigration/PreparedProviderDataMigration.cs` ~L194/197 (`WHERE IsAdminProvisioned = 1` —
  the compiler cannot see it and it would fail at runtime in the very tool that applies the migration). Grep for the
  column name in EVERY repo, every file type (.cs, .sql, .json, .md, tests), and list each site in the build log.
- EF migration `RemoveUserProfileIsAdminProvisioned` dropping the column (data needs no backfill: every row with the flag has
  `ProvisionedAt`). **Verify that statement with a SQL query in CA and IN before applying** (`SELECT COUNT(*) WHERE
  IsAdminProvisioned = 1 AND ProvisionedAt IS NULL` must be 0; if not, ASK).
- Apply to CA + IN via `cosmosindexsetup --all-regions --sql-only`, prove with `dotnet ef migrations list`.
- Tests that seed through the EF model use `MigrationSchemaSeed` (memory: migration tests break on every future column).
- Update the skill `clinqet-prepared-providers` and PLAN.md wording ("IsAdminProvisioned" → "ProvisionedAt").

### 13.2 No new "imported" column
Origin is recorded in the import history: every item holds `userId`, `userNumber`, `businessId`; the run holds who started
it and the file. The admin can find "which run created this account" from the run screens.

### 13.3 Activity rows
New `UserActivityTypes.ProviderAccountImported` (a string constant in the existing static class, not schema) written once
per created account in the SUBJECT's partition, with metadata `{runId, itemId}` (how any screen finds the run of an
account by a point-readable partition — never a cross-partition search), and NOT in the admin's (one row in the admin's partition per RUN instead:
`ProviderImportRunStarted` with the run id and counts) — so the admin's "Provider setup" list (built from the admin's own
feed, §3.2) is not flooded. Both types never expire (add to the never-expire list next to `ProviderAccountProvisioned`).
The admin Provider setup page gets a small link "Imported providers → Provider import" so imported accounts are one click
away.

---

## 14. Names after take-over — the full fix (D4, D5) — "extremely detailed … so we can fix this fully"

### 14.0 One definition first
New `clinqetshared` helper `PersonName` (pure, unit-tested exhaustively):
- `IsPlaceholderFirst(string? f)` ⇔ trimmed equals `SystemConstants.PlaceholderFirstName` (ordinal-ignore-case);
  `IsPlaceholderLast(string? l)` likewise; `IsPlaceholder(f, l)` ⇔ both halves are placeholders.
- `RealFirst(f)` = f unless placeholder/blank ⇒ null; `RealLast(l)` likewise.
- `Display(f, l)` = join of the real halves ("Jeff", "Joe Smith"), null when neither is real.
- `Greeting(f, l, culture)` ⇒ "Hello Joe," / "Hello," — via localized keys (5 languages), never string concatenation of
  English.
Replace `NameDiffers`' private OR check with these (fixes "John User" being treated as a placeholder).

### 14.1 N1 — Google / Apple fill a placeholder name
- `AuthService` external-login take-over (~L3119-3129, L3206-3221): when the take-over happens and the stored half is a
  placeholder (or blank), set it from the verified identity's `firstName`/`lastName` claims (trimmed, ≤100, the §8.1 casing
  rule). A REAL stored half is never overwritten (the claims are less deliberate than typed names).
- Apple sends the name only on the FIRST authorisation — when absent, nothing changes (N3 then asks).
- Tests: placeholder → claims applied; real name kept; claims missing; one half placeholder; Apple without name.

### 14.2 N2 — never "Hello Guest User" anywhere
Every place a person's name is shown to that person or written into a greeting goes through `PersonName`:
| Site (verify each) | Change |
|---|---|
| `SendEmailMfaLoginVerificationCodeAsync` (~L2673-2675) → `MfaCodeNotification` | greeting via `PersonName.Greeting` |
| password-reset code (~L1912-1914) | same |
| **registration code to a prepared email** (`SendRegistrationCodesAsync` ~L1012) | greet with the name the person JUST TYPED (`changes.FirstName/LastName`) — fixes greeting the registrant with the team's name |
| reset-completed (~L2170), password-set (`AuthController` ~L3125), external-login (~L3274) | same helper |
| email templates using `{{UserName}}`/`{{FullName}}`/`{{FirstName}}` in a greeting (`Resources/EmailTemplates/{lang}/*.json`, the shared shell) | a `{{Greeting}}` token resolved per language ("Hello Joe," / "Hello,") in **all 5 languages**; the guards that scan templates (memory `guards-must-read-what-ships`) must be updated to assert on the rendered output |
| provider web header "Welcome back, Guest" (`Header.jsx` ~L109-138, `utils/displayName.js`) | when no real first name ⇒ the existing welcome line without a name (new localized key ×5 if needed) |
| provider mobile dashboard (`MyDashboardScreen` ~L1101) | same |
| team roster / inbox / activity (`MemberDisplayName.Of`) | real halves, else the email, else a localized "Account owner" |
| take-over admin alert text (~L384, L405) | "The owner of <business> took over the account" when no real name |
| Razorpay billing contact (`PaymentMethodService.cs:64`) | business name when the person name is a placeholder |
| JWT `GivenName`/`Surname` claims (~L3567-3568) | leave the claims as stored (they are data); every DISPLAY uses the helper — grep all apps for `given_name`/`firstName` greetings and fix each |
Test: one parameterised test per site + a render test per language of each changed email.

### 14.3 N3 — ask once for the real name (provider web + provider phone) — MOCKUP GATE
- **When**: right after any sign-in on an account whose `PersonName.IsPlaceholder` is true on EITHER half and which is
  `ClaimedAt != null` (a real owner, not a setup session). Never during an admin setup session (actor claim present).
- **What**: a small, friendly sheet (web: centred dialog on desktop, bottom sheet on phone widths; app: native bottom
  sheet): title "What should we call you?", First name + Last name (prefilled with any real half), primary button "Save",
  secondary "Not now". Plain words, 5 languages, house theme (§24.2).
- **Server**: the existing `PUT api/v1/UserProfile` (names required ≤100) — no new endpoint. ‼️ **Bug to fix first
  (review finding):** that endpoint sets `ReceiveMarketingEmails = dto.ReceiveMarketingEmails ?? true` and the DTO defaults
  to `true` (`UpdateProfileDto.cs` ~L41-42; `AuthService` ~L4108) — a names-only save would OPT THE OWNER INTO MARKETING.
  Make the DTO field nullable with no default and "null = keep the current value" on the server; every existing client
  that sends the field explicitly keeps working (verify each of the four apps sends it; a client that relied on the
  implicit `true` is a bug to fix in the same change). Tests both ways. The client decides "show" from
  the existing profile read; to avoid asking again after "Not now", store a per-user flag in the EXISTING `UserMetadata`
  (spotlight-style dismissal table — `UserSpotlightDismissal` / `UserMetadataService`, skill `clinqet-spotlight`) as a new
  `SpotlightType` value (an enum value, not a schema change — **verify** the table needs no new column; if it does, ASK).
  "Not now" re-asks after `NamePromptSnoozeDays` (default 7 — delivered to the provider web and app through the existing `GET app-config` response so both apps share one value; a Main API setting `NamePrompt:SnoozeDays`, listed in §17.3) — never a nag loop.
- **States**: saving, error (with the server's localized message), offline, validation (required/too long).
- ‼️ **Mockup gate**: draw `C:\Nik\Data\mockups\provider-name-prompt\index.html` (web 375/820/1280 + both phone apps, every
  state), register it in `Data/mockups/REGISTER.md`, and get the owner's approval BEFORE writing this UI (§0.7.1, §0.20).
  The provider phone app ships in the same session as provider web (§0.7.1 mobile mirrors web).

### 14.4 N4 — keep the name typed before "your profile is ready — sign in with a code"
- Clients (provider web `registerForm.jsx` ~L180-181 + `PreparedProfileReady.jsx` ~L39-50; provider mobile `RegisterScreen`
  ~L333; and the two customer apps, which per `REMAINING-WORK-2026-10-06.md` P1-2 do not handle the 409 yet — fix that in
  the same change) keep the typed first/last name in memory (never storage) and send them with the code VERIFY request
  of the phone/WhatsApp sign-in as optional `proposedFirstName`/`proposedLastName`.
- Server (`VerifyPhoneLoginMfaAndGenerateTokenAsync` → take-over at ~L2628): when THIS verification performs the take-over
  of a prepared account, apply the proposed names — the person typed them deliberately, so they win over a real admin-typed
  name exactly like registration with the team email does (PLAN §4.1: "His names win"). Ignored on any sign-in that is not a
  take-over. Validation: trim, ≤100, no digits/`@`/URL, §8.1 casing; invalid ⇒ ignored (never blocks sign-in).
- The names are passed into `NameDiffers` as the person's names (alert severity per §14.5).
- Tests: phone-stop → code → names applied; not a take-over ⇒ ignored; invalid names ⇒ ignored, sign-in succeeds;
  WhatsApp channel; mobile + web clients (jest).
- ‼️ The two CUSTOMER apps do not handle the 409 `PreparedProfileSignIn` at all today (`REMAINING-WORK-2026-10-06.md` P1-2).
  Adding that handling is new customer-facing UI ⇒ it goes on the SAME mockup sheet as N3
  (`Data/mockups/provider-name-prompt` — frames for the provider name prompt AND the customer apps' "your business profile is
  ready — sign in with a code" step) and needs the owner's approval before it is built; customer web + customer phone ship
  together.

### 14.5 N5 — alert severity truth (decided, D20)
`NameDiffers` (ProviderTakeoverService ~L381) sends **High** today while PLAN.md §4.2.8 and the skill say **Medium**. The
owner chose **Medium** (2026-10-06): change the code to Medium (a High alert pushes to admin phones for what is usually a
normal take-over); PLAN.md and the skill already say Medium. Update the take-over tests that pin the severity.

### 14.6 Every take-over path after the fix
| Path | Name after take-over |
|---|---|
| Register with team email (any phone) | typed name (unchanged behaviour) |
| Register with team phone → code sign-in | **typed name (N4)** |
| Code sign-in by phone / WhatsApp / email, either reset | stored name; placeholder ⇒ **asked once (N3)**; greetings neutral meanwhile (N2) |
| Google / Apple | **claims fill placeholder halves (N1)**; still placeholder ⇒ N3 |
| Different email AND phone | a new separate account (unchanged) |

---

## 15. Storage — what is stored where, and what it costs (D3)

### 15.1 Schema-change table (§0.7) — status of each item
| Store | Item | Status |
|---|---|---|
| Cosmos SystemData | new document family `ProviderImportRun` (pk `provimport_runs`) | **Approved** (D3: "cosmos … it is fine") |
| Cosmos SystemData | new document family `ProviderImportItem` (pk `provimport_{runId}`) | **Approved** (D3) |
| Cosmos SystemData | `AiUsageCounter` family with a new `UsageMeter.ProviderImport` value (daily import cost, §16.6) | existing family, enum value — no new family |
| Cosmos SystemData | the `provimport_active` compare-and-set document (§11.9) | part of the approved run family (same partition `provimport_runs`) |
| Cosmos SystemData | indexing policy | **No change.** Every query filters ONLY on `/type` and `/status` (indexed) inside ONE partition; nothing filters on `mode`, `reviewReasons`, `skipReason`, `lastProgressAt`, `lane` or `contentSha256` (not indexed) — those are read by point reads or filtered in code after a type/status query (§11, §16.3). A query on a non-indexed path is a defect the §27 audit must catch |
| SQL | drop `UserProfile.IsAdminProvisioned` | **Approved** (D9) |
| SQL | anything else (an index on `Business.DisplayName`, …) | **NOT approved — ask with the §0.7 table** |
| Cosmos | `BusinessProfile.Status = Pending` | existing enum value, no schema change (D2) |
| Blob | new private container `provider-imports` | infrastructure (ARM + deploy.ps1), not a data schema |
| Enums | `AdminAlertType` ×9 (§16.4), `UserActivityTypes` ×2, `ProviderImport*` enums, `SpotlightType` ×1 | code (enum values) |
| Search | none | — |

### 15.2 Documents
**Run** — pk `provimport_runs`, id `provimportrun_{runId}`, `type = "ProviderImportRun"`, no TTL:
`runId`, `name`, `fileName`, `blobPath`, `contentSha256`, `sizeBytes`, `countryCode`, `options {copyPhotos}`,
`createdBy {adminUserId, displayName}`, `createdAt`, `status` (`AwaitingUpload|Uploaded|Validating|Validated|
ValidationFailed|Discarded|Processing|PausedCostLimit|PausedAiUnavailable|PausedIdentityUnavailable|Cancelling|Cancelled|
Completed|CompletedWithErrors`), `validation {startedAt, completedAt, attempts, errors[≤200] {path, message}, errorCount,
ignoredFields[≤200] {path, count}, prunedValues[≤200] {path, rule, count}}`, `lanes[] {lane, headItemId, currentItemId,
lastProgressAt, done, requeues}`, `counters {…}` (display cache, §11.4: records, planned, newPlanned, fillGapsPlanned,
mergedGroups, mergedRecords, skippedByReason{}, reviewFlagsByReason{}, queued, inProgress, live, needsReview,
approvedByAdmin, ownerTookOver, failed, cancelled, removed), `cost {estimatedUsd, spentUsd, promptTokens, cachedTokens,
completionTokens, curationCalls, reviewCalls, bankHits, hardLimitUsd, warned}`, `collectedAlertSummary {}` (§16.4),
`completionNumber`, `startedAt/startedBy`, `completedAt`, `previousRunId?`, `_etag`.
‼️ Hot document: display counters change by **Patch `Increment` only** (atomic); status/lane changes are conditional
patches with ETag; never read-modify-write; the truth is recomputed from the items (§11.4).
**Active runs** — same partition, id `provimport_active`: `activeRunIds[]`, ETag compare-and-set (§11.9).

**Item** — pk `provimport_{runId}`, id `provimportitem_{runId}_{itemKey}` where `itemKey` = first 16 hex of SHA-256 of
the sorted source record indices (deterministic ⇒ a validation redelivery upserts the same id),
`type = "ProviderImportItem"`, no TTL:
`itemId`, `runId`, `ordinal`, `lane`, `nextItemId`, `mode (New|FillGaps)`, `status` (§11.2), `stage`, `skipReason?`,
`skipDetail?`, `reviewReasons[]`, `flags[]`, `sourceIndices[]` (positions in `providers[]` — the only in-file identity,
D12), `prunedValueCount`, `display {name, city, province, category, email, phone}` (for the list), `links {userId,
userNumber, businessId, friendlyName}`, `created {services, onRequestServices, serviceAreas, categories, customCategories,
offers, faqs, licenses, photos, hoursStored}`, `notApplied {count}` (R3/R6), `collectedAlerts[]` (§16.4), `ai
{confidence, reviewed, calls, curationTokens, reviewTokens, costUsd, bankHits}` (cumulative across attempts),
`attempts`, `lastProgressAt`, `lastError {code, detail}`, `approvedBy/approvedAt`, `removedBy/removedAt`, `createdAt`,
`updatedAt`, `_etag`. Size ≈ 1.5–3 KB.

**Blobs** (container `provider-imports`, private, no public access): `{runId}/source.json`,
`{runId}/items/{itemId}/input.json` (normalised record + its source records + pruned values), `.../prepared.json`
(geocoding results, P1), `.../ai-curation.json`, `.../ai-review.json`, `.../result.json` (what was written: ids and
values; before/after and the "Not applied" list for FillGaps), `{runId}/report-*.csv` (generated on demand),
`_bank/curation|review/{key}.json.gz`. Lifecycle: history is permanent (owner); the sweeper deletes the blobs of an
abandoned `AwaitingUpload` run (§11.7). If storage ever matters, an ARM lifecycle rule for `*/items/*/ai-*.json` after N
days — ask first.

### 15.3 Cost of the history (why 2,000 providers ⇒ 2,000 item documents is correct and cheap)
One document per provider is required: it is the work order (redelivery-safe), the progress counter, the admin's row, and
the link to the account. Packing many providers into one document would make every concurrent update an ETag conflict
(wrong) and save almost nothing. The bulky JSON lives in blob, so the documents stay small:
| Operation per provider | RU (approx., small docs, few indexed paths) |
|---|---|
| item create (in a batch) | ~6–8 |
| ~8–10 status/stage patches (Queued → Preparing → Creating → Building → terminal + a checkpoint per step) | ~80–100 |
| 1 run lane-progress patch | ~10 |
| 2 run-counter increments | ~20 |
| list/review reads (amortised) | ~2 |
| **Total** | **≈ 120–140 RU** |
2,000 providers ≈ 280,000 RU ≈ **$0.07** at serverless list price ($0.25 per million RU), or a few seconds of shared
autoscale headroom. Storage: 2,000 × ~3 KB docs ≈ 6 MB in Cosmos (+ ~25 MB of blob JSON) — **cents per month**. The
profile/service/hours/area writes themselves (≈ 1,000–2,000 RU per provider incl. change feed reads) are the same cost as a
provider typing their profile, and are spread out by the throttled lanes (§16.6).

---

## 16. Service Bus, Functions, alerts and limits

### 16.1 Queues (new — ARM `events.json`, `deploy.ps1` `$q*` + `$script:ServiceBusEntitySettings`, `ServiceBusSettings`, `_senders`, `local.settings.json` + `.ca.json` + `.in.json`)
| Queue | Sessions | Dup detection | Lock | Producer → consumer |
|---|---|---|---|---|
| `provider-import-validate` | no | yes, PT10M | PT5M | API + sweeper → `ProviderImportValidateFunction` |
| `provider-import-items` | no (lanes are chained, §11.1) | yes, PT10M (messageIds carry an attempt suffix, so re-sends are never swallowed) | PT5M | API (start/resume/retry), the processor itself (next in lane), sweeper → `ProviderImportItemProcessorFunction` |
`maxDeliveryCount` 5 (= `RetrySettings:MaxDeliveryCount`). Both added to `$script:RequiredFunctionAppSettings` (the
Functions host produces and consumes both). Run the deploy drift guard. `maxAutoLockRenewalDuration` (01:00:00) already
covers the longest provider; `functionTimeout` 00:45:00 caps one invocation — a provider whose AI calls approach it is
the per-item AI budget's job, not a timeout's.

### 16.2 Functions and services
Functions (`clinqetfuncations/Clinqet.Communications/Functions/`): `ProviderImportValidateFunction`,
`ProviderImportItemProcessorFunction`, `ProviderImportSweeperFunction` (§11.7).
Services (`clinqetinfrastructure/Services/ProviderImport/`): `ProviderImportFileValidator` (validate-then-prune),
`ProviderRecordNormalizer`, `ProviderImportDeduplicator`, `ProviderImportExistingMatcher`, `ProviderImportGeocodePreparer`,
`ProviderImportCurator` (keyed AI client + bank), `ProviderImportVerifier`, `ProviderImportApplyRequestBuilder`,
`FriendlyNameCandidateGenerator`, `ProviderImportIdentityClient` (typed HttpClient → §11A),
`ProviderImportRunRepository` / `ProviderImportItemRepository` (SystemData, single-partition only),
`ProviderImportBlobStore`, `ProviderImportAlertCollector` (§16.4).
‼️ **DI audit (review finding):** before registering anything in Functions, list every service the applier, the bootstrap,
the curator and the photo ingestion need, with its lifetime, and compare with what `Clinqet.Communications/Program.cs`
registers today (e.g. `IPreparedAccountDirectory` is a Singleton there, ~L386). No Scoped service may be captured by a
Singleton (`ValidateScopes` is on). Identity's sign-in machinery (`IAuthService`, `IAuthSessionService`, `UserManager`, JWT)
is **not** registered in Functions — that is why account creation is the Identity endpoint (§11A).

### 16.3 Main API (admin) — `Controllers/Admin/AdminProviderImportController.cs`, `[Authorize(Roles="Admin")]`, route `api/v1/admin/provider-imports`
Follow the existing admin controller + `ApiResponse` envelope exactly; admin text English (admin rule).
| Verb | Route | Body / query | Result |
|---|---|---|---|
| POST | `upload-url` | {fileName, sizeBytes} | creates the run doc `AwaitingUpload` (so an abandoned upload is cleaned by the sweeper) → {runId, uploadUrl, expiresAt} |
| POST | `{runId}/check` | {name, copyPhotos} | blob present + size + SHA-256 → `Uploaded`, validate message → 202 run (+ `previousRunId` when the same SHA-256 completed before; 409 when one is still running — compared in code over the active runs, no index on the hash) |
| GET | `` | `?continuation=&pageSize=` (newest first, runs partition) | runs page |
| GET | `{runId}` | — | run (live counters; the UI polls every `PollSeconds` while Validating/Processing) |
| GET | `{runId}/items` | `?status=&continuation=&pageSize=` (≤ `MaxItemsPageSize` 500; `type` + `status` filter only — indexed; mode/reason/search are filtered in the client over the loaded rows, §15.1) | compact rows |
| GET | `{runId}/items/{itemId}` | — | item (point read) + 5-minute read URLs for its blobs + the account's `ClaimedAt` + the profile's current `Status` (point read — reconciles items approved from elsewhere, §10.6) |
| POST | `{runId}/start` · `/cancel` · `/resume` · `/retry-failed` · `/discard` | — | run |
| POST | `{runId}/cost-limit` | {hardLimitUsd} | run |
| POST | `{runId}/items/{itemId}/approve` · `/retry` · `/remove` | — · — · {confirmName} | item |
| POST | `{runId}/items/approve` | {itemIds[] ≤ 200} | per-item results |
| GET | `{runId}/report.csv?kind=skipped|review|all` | — | CSV (admin English headers) |
Every state change: conditional on status + ETag; 409 with a clear admin message on a wrong state.

### 16.4 Admin alerts — no bombardment, and ZERO change to the provider path (owner, 2026-10-06)
Owner: *"one summary per run but … it shouldn't impact or remove anything when provider setup happen from the provider web
and app … at that time this admin alert is super important"* and *"we don't want the admin alert bombardment … super super
best practice … no regression rule is super critical."*

**The design — alerting becomes an explicit MODE of the shared code, never a hack in the importer:**
1. The shared applier (§19.1) and the profile bootstrap (§19.2) take an `AlertMode` on their request (the lifecycle
   uses the separate, silent `ActivateImportedAsync`, §19.5; `ReactivateAsync` is unchanged): **`PerEvent` (the DEFAULT)** — raise each alert exactly as today; or
   **`CollectForSummary`** — raise nothing, return every would-be alert as a structured `SetupAlertEvent {type, severity,
   businessId, subjectId, details}` in the result.
2. **Every existing caller passes nothing and therefore gets `PerEvent`**: the provider web and provider app AI Quick
   Setup, the admin wizard's Quick Setup, the catalog manifest, the knowledge-draft approval, `POST business/profile`.
   Their alerts — `CustomCategoryAwaitingReview`, `CustomSubcategoryAwaitingReview`, `SetupPriceBeyondReviewCeiling`,
   `AiTaxonomyLowConfidence`, `OnlineBookingsDisabled`, `ProviderReactivated` … — are byte-for-byte unchanged.
3. **Only the importer passes `CollectForSummary`.** It stores each item's events on the item (`collectedAlerts[]`) and,
   at run completion, raises **ONE grouped summary per alert family**, e.g. `ProviderImportCustomCategoriesSummary`:
   "Import <name>: 7 new custom categories — Dental (50 businesses), Photography (11)… Review with the category merge tool"
   with the full list (business ids) in Metadata, deterministic EventId `provimport-summary:{runId}:{completionNumber}:{family}`.
4. **No-regression proof (mandatory, part of the §27 audit):**
   - the existing alert tests of every caller pass UNCHANGED (record the before/after runs);
   - NEW tests pin the default: a flyer/manifest setup through McpService with a new custom category raises BOTH custom
     alerts exactly once, like before; an applier request without `AlertMode` behaves as `PerEvent`;
   - a sabotage check: flip the default to `CollectForSummary` ⇒ those tests FAIL;
   - a guard test that `AlertMode.CollectForSummary` is referenced ONLY from the `ProviderImport` namespace (a source scan in
     the owning repo's suite — §0.15/§0.17 rules apply: it must read real files and fail loudly when it reads none).
5. Alerts the import raises itself — each **once per run** (deterministic EventIds), never per provider:
| Type (new `AdminAlertType`) | Severity | When |
|---|---|---|
| `ProviderImportRunCompleted` | Low | each completion (§11.4) — includes counts, AI cost, and the review queue size |
| `ProviderImportCustomCategoriesSummary` | Medium | at completion when the run created custom categories |
| `ProviderImportPricesAboveCeilingSummary` | Medium | at completion when any service is above the review ceiling (the items are held) |
| `ProviderImportAiCostWarning` | Medium | spent ≥ `AiCostWarnShare` of the run limit, or of the DAILY import limit |
| `ProviderImportAiCostLimitReached` | High | run paused at the run or daily hard limit |
| `ProviderImportAiUnavailable` | High | §11.8 |
| `ProviderImportIdentityUnavailable` | High | §11A.5 |
| `ProviderImportStalled` | High | §11.7 — once per run per day |
| `ProviderImportActivationFailed` | High | a take-over could not lift the hold (§10.5) — once per business |
Each new type: the Alerts page labels, the admin phone `alertTypes.ts`, the three `AdminPushSettings:PushableTypes` lists
for the High ones; deploy Functions before the API.
6. After go-live, a prepared business's own alerts (e.g. `PreparedProviderCustomerWaiting`, one per waiting customer
   request — PLAN §6) are the prepared-provider programme's decision and stay as they are; the run summary is not their
   place (they happen days later, per real customer).

### 16.5 Messages to providers — none from the import
Prepared accounts get **no message caused by the import**: no welcome, no "profile created", no `FriendlyNameUpdated`
(§11A.4), no offer/trial announcement (§11A.3 step 5), and no `ServicePricingRequired` (the setup writer's price-less
notification — the applier request carries `NotifyProvider = false` for the import; every existing caller keeps the
default `true`, pinned by the same no-regression tests as §16.4). Once a business is Live, real customer leads, booking
requests and messages reach it exactly as PLAN §6 decided for prepared accounts (email only, with the claim footer).

### 16.6 Limits (all settings, all enforced) — every cost limit = a warning AND a hard limit, each its own alert (owner rule)
| Setting (`AdminProviderImport:Limits:*`) | Default | Purpose |
|---|---|---|
| `MaxFileSizeBytes` | 52,428,800 | upload |
| `MaxProvidersPerFile` | 5,000 | upload |
| `MaxConcurrentRuns` | 2 | compare-and-set on `provimport_active` (§11.9) |
| `MaxItemsPageSize` | 500 | admin items page (API) |
| `MaxAiCostUsdPerRun` | 50 | run hard limit ⇒ `PausedCostLimit` + High alert |
| `MaxAiCostUsdPerDay` | 100 | ALL imports of the stamp per UTC day — hard limit; counter = the existing `AiUsageCounter` document family in SystemData with a new `UsageMeter.ProviderImport` value (id segment `import_`, pk `provimport_usage`, atomic Patch Increment, TTL like the setup counter) — no new document family |
| `AiCostWarnShare` | 0.8 | warning for both limits |
| `MaxAiCallsPerProvider` | 4 | calls BEYOND the item's planned curation chunks (⌈services ÷ `CurationServicesPerCall`⌉): the second opinion + schema/truncation retries, counted across ALL attempts ⇒ `Failed: AiBudgetExhausted` |
| `MaxServiceAreasPerProvider` | 25 | |
| `MaxCategoriesPerProvider` | 5 | |
| `MaxFaqsPerProvider` | 50 | |
| `MaxPortfolioImagesPerProvider` | 20 | |
| `MaxImageBytes` | from `RemoteImageIngestion` | |
Cost of each call = its token usage × `AdminProviderImport:Ai:TokenPricing[deploymentName]`. ‼️ **Fail fast**: the Functions
host refuses to boot when a configured import deployment has no `TokenPricing` entry (otherwise spend would be 0 and the
limits could never trip). Spend is added to the item, the run and the daily counter BEFORE the next call's limit check.
Out of these limits (shared platform pipelines, stated honestly in §9.7/§20): search enrichment + embeddings after a
business goes Active, FAQ embeddings, Google geocoding.

---

## 17. Settings — every key, every host, every file (CLAUDE §4: a host gets only the keys it reads; class defaults == appsettings; list defaults are APPENDED — memory `appsettings-class-defaults-are-appended-not-replaced`)

### 17.1 Functions `appsettings.json` — new node `AdminProviderImport` (class `AdminProviderImportSettings`, `clinqetshared/Models`)
```json
"AdminProviderImport": {
  "Ai": {
    "Endpoint": "<copy of AIService:Endpoint>",
    "ApiKey": "<copy of AIService:ApiKey>",
    "ApiVersion": "2025-01-01-preview",
    "CurationDeploymentName": "gpt-6-luna-import",
    "CurationReasoningEffort": "Medium",
    "CurationMaxCompletionTokens": 16000,
    "CurationServicesPerCall": 40,
    "ReviewDeploymentName": "gpt-6.1-sol-import",
    "ReviewReasoningEffort": "High",
    "ReviewMaxCompletionTokens": 12000,
    "TimeoutSeconds": 300,
    "MaxRetries": 3,
    "TokenPricing": {
      "gpt-6-luna-import": { "InputPer1M": 0.1, "CachedInputPer1M": 0.01, "OutputPer1M": 0.5 },
      "gpt-6.1-sol-import": { "InputPer1M": 2, "CachedInputPer1M": 0.1, "OutputPer1M": 10 },
      "gpt-6-luna": { "InputPer1M": 0.1, "CachedInputPer1M": 0.01, "OutputPer1M": 0.5 },
      "gpt-6.1-sol": { "InputPer1M": 2, "CachedInputPer1M": 0.1, "OutputPer1M": 10 }
    },
    "CurationSystemPrompt": "<§9.3 rules>",
    "ReviewSystemPrompt": "<§9.5 rules>"
  },
  "Identity": { "BaseUrl": "<this stamp's Identity API>", "ApiKey": "<Key Vault reference>", "TimeoutSeconds": 30 },
  "Limits": { "...": "§16.6" },
  "Processing": {
    "ParallelismPerRun": 2, "SweeperSchedule": "0 */15 * * * *", "StaleLaneMinutes": 60, "StaleValidationMinutes": 30,
    "AbandonedUploadHours": 24, "MaxStallRequeues": 3, "AiOutageItemThreshold": 3, "SqlLookupChunkSize": 500,
    "MaxReportedErrors": 200, "CostEstimatePerProviderUsd": 0.02, "LiveOnMediumConfidence": false,
    "ReviewTriggerFailedChecks": 2, "NameTypoMaxEdits": 2, "GeocodeAgreementStreetKm": 2, "GeocodeAgreementCityKm": 25,
    "MergeReviewSize": 5, "FriendlyNameMaxNumberSuffix": 9, "MaxServiceDescriptionChars": 1000,
    "MaxSourceAgeDays": 180, "OfferMaxAgeDays": 30, "DescriptionMinSourceOverlap": 0.8
  },
  "Normalization": { "Honorifics": [], "LegalSuffixes": [], "GenericWebsiteHosts": [], "GenericTradeWords": [],
                     "KnownAcronyms": [], "SharedContactBlocklist": [], "UnsupportedClaimPhrases": [] },
  "Photos": { "VerifyWithAi": false },
  "Storage": { "ContainerName": "provider-imports" }
}
```
(The JSON lists are filled with the real values in the build; each list's class default equals the appsettings list.)
**Sections the import needs in Functions that Functions does not have today** (review finding — add exactly the keys read,
nothing more): `Discovery:CountryDefaults` (service-area radius/unit, §19.1), the price review ceiling key the applier reads
(`AIAssistant:ProviderAttachmentProcessing:MaxAllowedPrice`, or move it to a shared section both hosts read — decide in the
DI audit, ASK if it means renaming an API key), `CategoryAlert:EnableCustomCategoryAlerts` (the resolver throws when it is
false, §3.1), plus whatever else the DI audit (§16.2) proves the moved code reads. Each addition: same value as the API's.
‼️ The `…-import` deployments must EXIST before the first run (§17.6). Until then the CA/IN `local.settings` may point the
two names at the existing `gpt-6-luna`/`gpt-6.1-sol` deployments (owner: "copy the same values as we have right now") —
which is why `TokenPricing` also lists those names (fail-fast §16.6). `AiModelPinConventionTests` (API, MCP, Functions)
must accept the new keys — update the test's registry, never weaken it.

### 17.2 Wiring the separate AI
- Register a **keyed** `IAICompletionService` (`"ProviderImport"`) built from `AdminProviderImport:Ai` mapped onto an
  `AIServiceSettings` instance (endpoint, key, API version, timeout), with its own typed `HttpClient` from
  `IHttpClientFactory`. Only the import services resolve the keyed instance; nothing else changes for the shared client.
- ‼️ The shared `AiBudgetGovernor` keys tokens-per-minute per deployment name but its Bulk-lane slots are ONE process-wide
  semaphore (default 2, `AiBudgetGovernor.cs` ~L56-83). The import must **not** take those slots (it would slow live
  enrichment and the knowledge jobs): its concurrency is its lanes (`ParallelismPerRun` × `MaxConcurrentRuns`), its
  tokens-per-minute is capped by its OWN deployment's TPM (§17.6), and 429s are handled by §11.8. Read
  `IAiBudgetGovernor` first; if the keyed client cannot bypass the shared semaphore cleanly, ASK — never fork the governor.
- The per-call usage log line stays the existing one, with new sub-flow ids `import-curate`, `import-review` in
  `AiSubFlows.cs`.

### 17.3 Main API `appsettings.json` (only what the API reads)
`AdminProviderImport:Storage:ContainerName`, `AdminProviderImport:Storage:UploadSasExpiryMinutes` (15),
`AdminProviderImport:Limits:{MaxFileSizeBytes, MaxProvidersPerFile, MaxConcurrentRuns, MaxItemsPageSize}`,
`AdminProviderImport:PollSeconds` (delivered to the admin web), `NamePrompt:SnoozeDays` (7, delivered to the provider apps via app-config, §14.3). No AI keys (the API never calls the import AI).

### 17.4 Identity `appsettings.json`
`ProviderImportInternal:ApiKey` (Key Vault reference; boot refuses < 32 chars), `ProviderImportInternal:RateLimitPerMinute`
(60). Nothing else.

### 17.5 `local.settings.json`, `.ca.json`, `.in.json` (Functions)
All three: `ServiceBusSettings:ProviderImportValidateQueueName`, `ServiceBusSettings:ProviderImportItemsQueueName`,
`AdminProviderImport:Processing:SweeperSchedule` (if the timer binds `%…%` like the existing timers — follow their exact
convention). `.ca/.in`: `AdminProviderImport__Ai__Endpoint`, `__ApiKey`, `__CurationDeploymentName`,
`__ReviewDeploymentName` (values copied from today's `AIService__*`), `AdminProviderImport__Identity__BaseUrl` and
`__ApiKey` (local Identity URL + a local key equal to Identity's local `ProviderImportInternal:ApiKey`).

### 17.6 Azure (ARM + `deploy.ps1`) — in the same change
- `events.json`: the two queues (§16.1). `storage.json`: private container `provider-imports` (no public access).
- **Two dedicated model deployments** in the existing Foundry/OpenAI resource: `gpt-6-luna-import`, `gpt-6.1-sol-import`,
  each with its own TPM capacity (variables next to `$openAiLunaDeploymentName` ~L3311-3340: `$importLunaTpm` = **250**
  and `$importSolTpm` = **100** (×1K tokens/minute, the same unit as `$OpenAiModelCapacity`; owner D19), deployed through
  the existing capacity step that steps DOWN when the quota grant is short — and reports it) and the content filter assigned like the others (an unassigned filter FAILS
  the deploy).
- Key Vault secret `ProviderImportInternalApiKey` created once per environment; Identity
  (`ProviderImportInternal__ApiKey`) and Functions (`AdminProviderImport__Identity__ApiKey`) reference it.
- `Merge-AppSettings`: Functions `AdminProviderImport__Ai__Endpoint` = `$openAiEndpoint`, `…__ApiKey`,
  `…__CurationDeploymentName` / `…__ReviewDeploymentName` = the new deployments, `AdminProviderImport__Identity__BaseUrl` =
  the stamp's Identity URL; Identity `ProviderImportInternal__ApiKey`. A future dedicated AI resource = change only these
  variables.
- Queues through `$script:ServiceBusEntitySettings` (drift guard); the sweeper cron key in
  `$script:RequiredFunctionAppSettings`.
- **Deploy order**: Identity (internal endpoint) → Functions (worker, alert types) → Main API (admin endpoints) → admin web.

---

## 18. Admin web (`clinqetwebadmin`) — "Provider import"

Design: the admin app's own system — `tailwind.config.js` `primary #032858`, `accent #97EF29`, Lufga, primitives in
`src/components/ui/AdminPrimitives.jsx` (`SectionCard`, `TableShell`, `StatCard`, `Modal`, `Field`, `Toggle`, buttons,
`LoadingRow`/`LoadingBlock`/`EmptyRow`), `AdminSelect.jsx`, status pills (amber `#FBF1DE`/`#8A5A00`, green
`#EAF7E1`/`#2F7D00`), `react-icons`, `react-hot-toast`. Admin text is English-only (admin rule). Responsive and dense
(§24.1): verify at 320/375/768/1024/1440. Mockup waived (D15) — build directly, modern, using the existing components.

### 18.1 Navigation
Sidebar (`AdminLayout.jsx` `navItems`): under "Provider Setup" add **"Provider import"** → `/provider-imports`; routes in
`routeConfig.jsx` + `routes.jsx` (`PrivateRoute`): `/provider-imports`, `/provider-imports/new`, `/provider-imports/:runId`.

### 18.2 Runs list (`/provider-imports`)
Header + primary "Import a file". Table (cards on phones): name, file, uploaded by, date, status pill, counts (created ·
live · waiting review · skipped · failed), AI cost. Empty state: what the tool does in two lines + the button. Loading
skeleton; error with retry; load-more (keyset).

### 18.3 New import (`/provider-imports/new`)
Drop zone / file picker (`.json` only, size shown, refused client-side above the limit), name field, "Copy photos from the
source" toggle (off) with a one-line note ("Only turn this on once Clinket may use the business's photos"), a link to
download the schema and the example (served from the admin app's public folder — copy of `Data/provider-import/*.json`;
the skill states the three copies must match). Button "Upload and check". States: uploading (progress), checking
(spinner + "Checking N providers…"), check failed (the error list with JSON paths, download), checked → the run page.

### 18.4 Run page (`/provider-imports/:runId`)
- **Summary band** (`StatCard`s): providers in file · will be created · merged · updates to existing · skipped · held for
  review · live · failed · AI cost (spent / limit / estimate). Live progress bar while Processing (polling).
- **Primary action by state**: Validated → "Start import" (confirm dialog with the counts + estimated cost); Processing →
  "Cancel"; PausedCostLimit → "Raise limit & resume" (the dialog says whether the RUN or the DAILY limit tripped); PausedAiUnavailable / PausedIdentityUnavailable → "Resume" (after the cause is fixed); Completed with failures → "Retry failed".
- **Tabs**: Waiting for review · Live · Skipped · Merged · Failed · All. Each a `TableShell` with status filter (server-side,
  indexed `status`); the page loads the WHOLE run's compact rows progressively (≤ 5,000 rows, 500 per request, with a
  "Loading 1,500 of 1,843" indicator) so the search box (name / city / email / phone / reason) and the mode/reason filters
  cover every provider of the run, not just a page (no index change, §15.1); bulk select → "Approve" on the review tab; "Download skipped (CSV)".
- **Item drawer** (right panel on desktop, full screen on phone): header (name, city, status, reasons as plain-English
  chips), links (public page — only when Live; account number; "Open setup wizard" → the existing
  `/provider-accounts/:userId/onboarding`), **side-by-side "From the file" vs "On Clinket"** (business, contacts, address,
  categories incl. "new custom category" badges, services with price lines exactly as customers see them — "Price on
  request" etc., hours, offers, FAQs, photos), the AI's reasons and flags, what was dropped and why (the record's pruned
  values from validation, AI-dropped services/offers, cleaning decisions), history (created at,
  approved by…). Actions: Approve, Retry (failed), Remove (confirm, irreversible wording).
- "Owner took over — no review needed" state for held items whose account was claimed (§10.5).
- Every state designed: loading, empty, error, permission denied (non-admin → the app's existing guard), offline, limit
  reached (cost pause), long lists.

### 18.5 Elsewhere in the admin app
- Provider setup page: link "Imported providers → Provider import" (§13.3); its stale comments (`ProviderAccountsPage.jsx`
  ~L328-330 "Phone has no unique index"; `providerProvisioningService.js` ~L22-23 "NEVER CONTACTS THE PROVIDER") corrected.
- `ProviderTrustPage.jsx`: "Approve" for a Pending business (§10.6).
- Alerts page: labels for the 9 new alert types (§16.4); admin phone app `alertTypes.ts` labels.

---

## 19. Shared-code refactors (do these first, prove zero regression)

> Rule for every refactor here: **the existing callers keep their exact behaviour** (every new option has a default equal
> to today's behaviour), the existing tests pass UNCHANGED before and after (record both runs in the build log), and each
> new option has a test that pins its default plus a sabotage check.

### 19.1 Extract the apply half of AI setup → `IProviderSetupApplier`
Move McpService's post-extraction stages (profile apply, taxonomy resolve + custom creation + alerts, service areas,
availability, pre-pass dedupe, per-service price decisions, selected categories, writes, counts, offers, image lane,
onboarding progress) into `IProviderSetupApplier` (`clinqetinfrastructure/Services/AI/`) taking a
`ProviderSetupApplyRequest`. McpService calls it with options equal to today's behaviour. **Every branch McpService keys
on `manifest != null` today becomes an explicit option**, so no caller depends on "is this a manifest" any more:
| Option | Today (flyer / PDF) | Today (catalog manifest) | Import |
|---|---|---|---|
| `AlertMode` (§16.4) | PerEvent | PerEvent | **CollectForSummary** |
| `NotifyProvider` (`ServicePricingRequired`) | true | true | **false** |
| `RunFactChecks` (withhold disputed facts between readings) | true | false | false (no readings — the verifier §9.4 replaces it) |
| `RunPriceGate` (price must be printed on a page both readings read) | true | false | false (evidence rule §9.4.4 replaces it) |
| `RunOfferingJudge` (the offering-judge AI call) | true | false | **false** (the curation already judged offerings — no extra AI call) |
| `NameIsAuthoritative` | false | true | true (verified name) |
| `DescriptionIsAuthoritative` | false | true | true (verified description) |
| `PreserveExistingApproval` | as today | as today | n/a — the import never updates an existing service |
| `ExistingServiceMode` | match + update (today) | match + update | **CreateOnly** — an existing service (by deterministic id or name) is left untouched; the only allowed change is R4 (add a price to an On-request service) |
| `ProfileFillMode` | FillBlank (today) | FillBlank | WriteAll for New, FillBlank for FillGaps |
| `AllowCustomCategoryCreation` | `AutoCreateServices` | true | true |
| `ApprovalStatusWhenComplete` | Approved | Approved | Approved (Live) / PendingApproval for new services on a held FillGaps item (§11.3 S6) |
| `RaiseTaxonomyConfidenceAlerts` | true | true | collected (AlertMode) — the low confidence is a review reason instead |
| `RunImageLane` (captions/verifies E1–E4) | true | false | **false** (photos via §11.6, no AI) |
| `AiWorkloadLane` | Interactive | Interactive | n/a — the applier makes no AI call on the import path |
| `ServiceIdSeed` | random / ExternalId | ExternalId | `import-service` + normalised source name |
| Addresses | appended, geocoded | — | list with "street optional", deterministic `AddressId = DeterministicGuid(businessId, "import-address", normalisedCity+street)` |
| Hours | missing days only | — | explicit week or "no hours" (never the default seed) |
| FAQs / licences | — | — | new: create-only with deterministic ids |
| Default service-area radius | `Discovery:CountryDefaults:{CC}:DefaultSearchRadius/DefaultRadiusUnit` (`ProviderSetupServiceAreaService.cs` ~L140-155; 50 km CA/US, 25 km IN) | same | same — **one source**; add the `Discovery:CountryDefaults` section to Functions appsettings (it is missing there today, so IN would silently get the class default) |
| Price review ceiling | `PriceReviewCeiling` (currency-scaled, `clinqetshared/Models/PriceReviewCeiling.cs` ~L28-42) from `AIAssistant:ProviderAttachmentProcessing:MaxAllowedPrice` | `CatalogManifest:MaxAllowedPrice` | the currency-scaled ceiling; add the key to Functions (API-only today) |
**Proof of zero regression**: every existing McpService / setup / catalog-manifest / knowledge-draft unit + integration test
passes UNCHANGED before and after; a sabotage check per moved stage; and the new default-pinning tests of §16.4.4.
Register the applier and its dependencies in Functions after the DI audit (§16.2).

### 19.2 Extract the profile bootstrap → `IBusinessProfileBootstrapService`
`BusinessProfileController.POST` logic, ALL of it (re-read ~L274-397, ~L1073-1158): create the profile; the
waiting-for-owner `AllowOnlineBookings = false` rule; `ParticipatesInMarketplace` from SQL `SignupOrigin` (~L357); the
search-cell assignment (~L358-363); the `OnlineBookingsDisabled` admin alert (~L375-376, gated by
`BusinessProfile:AlertOnOnlineBookingsDisabled`); the default availability (**Mon–Sun** 09:00–17:00, ~L1090-1104); the
global portfolio. Options with today's defaults: `SeedDefaultAvailability = true`, `AlertMode = PerEvent`,
`PublicEmail/PublicPhone = from the token claims`. The import passes `SeedDefaultAvailability = false`,
`AlertMode = CollectForSummary` (the OnlineBookingsDisabled alert is meaningless for a prepared account and is dropped,
not summarised), and explicit public contacts (§11.3 S2). Controller tests unchanged + new service tests.

### 19.3 Identity: the provisioning core + the internal endpoint (§11A)
`CreateProviderAsync` (`AdminProviderProvisioningService.cs` ~L87-274 — note: it has no throttle and writes no activity
rows; both live in `AdminProviderAccountController.cs` ~L71-73 and ~L85-140) gets an overload / core that accepts a
caller-supplied deterministic `UserId` (today `Guid.NewGuid()` ~L143), `ProvisionedByAdminId`, and the business display
name, and ALSO ensures the business in the same unit of work (the code `IssueOnboardingTokenAsync` uses today, with a
DisplayName parameter). The admin form endpoint keeps its throttle, its activity rows and a random id — unchanged. The
internal endpoint (§11A) calls the same core. Its constructor dependencies (`IAuthService`, `IAuthSessionService`,
`IPolicyConsentService`, `IBusinessActivityRecorder`, ~L50-66) stay in Identity, which is exactly why the endpoint lives
there.

### 19.4 Identity: the friendly-name setter
The validation + SQL write + history + Cosmos mirror behind `PUT UserProfile`'s friendly-name branch (AuthService
~L4062-4180, UserProfileController ~L214-263, ~L665-669) moves into `IFriendlyNameService.TrySetAsync(businessId,
candidates)`; `PUT UserProfile` calls it and keeps sending its `FriendlyNameUpdated` notification itself (the notification
is NOT inside the service), so the import endpoint (§11A.4) never sends it.

### 19.5 Lifecycle: a silent activation
`ProviderLifecycleService.ActivateImportedAsync(businessId)` — a conditional patch Pending → Active with NO
`ProviderReactivated` alert, used by S6, the review Approve (single + bulk) and the trust-page Approve. `ReactivateAsync`
is unchanged for the admin path; the PROVIDER endpoint (`POST business/profile/reactivate`) is narrowed to `Inactive →
Active` only (today it also turns `Suspended` and would turn `Pending` Active — a loophole, review finding).

### 19.6 Test placement (CLAUDE §0.18)
- The applier is consumed by the API (McpService) AND Functions (import): its existing tests stay in the API suites;
  import-specific behaviour is tested in `Clinqet.Communications.UnitTests`/`.IntegrationTests`.
- Identity changes (§11A, §13, §14, §10.5, §19.3, §19.4) → `Clinqet.Identity.UnitTests`/`.IntegrationTests`.
- Admin controller, bootstrap, lifecycle → `Clinqet.API.UnitTests`/`.IntegrationTests` (+ Functions tests for the import's
  use of them).

---

## 20. Cost model (estimate — measure in the pilot and write the real numbers here)

Prices from `AIService:TokenPricing` (USD per 1M tokens): gpt-6-luna in 0.10 / cached 0.01 / out 0.50; gpt-6.1-sol in 2.00
/ cached 0.10 / out 10.00; gpt-5.4-mini in 0.75 / cached 0.075 / out 4.50.
| Item (per provider) | Assumption | Cost |
|---|---|---|
| Curation (luna, Medium) | ~14k input of which ~12k cached prefix (prompt + category tree), ~1.5k record; ~5k output incl. reasoning | ≈ $0.003 |
| Second opinion (sol, High), ~20% of providers | ~16k input (12k cached), ~4k output | ≈ $0.045 × 0.2 ≈ $0.009 |
| Schema retry (rare) | — | ≈ $0.0005 |
| **Import AI total** | | **≈ $0.012** |
| Search enrichment (shared, after Active) | ~4 services × batched mini | ≈ $0.004–0.008 |
| Embeddings (shared) | ~4 × ~300 tokens × $0.13/M | ≈ $0.0002 |
| Geocoding (Google, shared) | 1 street + up to 25 areas; the in-memory cache is per instance, so repeats are cheap only on a warm worker | typical ≈ $0.01–0.03; worst case (25 uncached areas) ≈ $0.13 — the pilot measures the real hit rate |
| Cosmos + blob | §15.3 | < $0.001 |
| FAQ embeddings (shared) | ≤ 50 short FAQs | < $0.001 |
| **All-in** | | **typical ≈ $0.03–0.05 per provider ⇒ ≈ $30–50 per 1,000 providers; worst case ≈ $0.15** |
‼️ Only the import's OWN AI calls count against the run and daily limits (§16.6); enrichment, embeddings and geocoding are
shared platform pipelines (paid exactly as when a provider types their profile) and are reported in the run summary as an
estimate, not limited.
Cost levers already in the design: deterministic work first; skipped records never reach AI; one call per provider with a
cached prefix; the second opinion only when needed; banking (re-runs free); Pending→Active ⇒ one enrichment per service;
photos AI-verify off. Levers NOT used (quality first): smaller models for curation, skipping the second opinion, sending a
pre-filtered category list (risks a wrong category).
**Pilot (mandatory before the first real run)**: 20 providers chosen to cover the edge cases (merge, toll-free only, no
street, 24/7, real prices, dental, an offer, a held case), then 200; record per-provider tokens, cost, share sent to review,
time, and a manual accuracy audit of every field of the 20 (and a sample of 30 of the 200). Update `CostEstimatePerProviderUsd`
and this table.

---

## 21. Edge-case catalogue (each row = at least one test; IDs used in test names)

### File & run
| ID | Case | Result |
|---|---|---|
| F1 | not JSON / truncated (a UTF-8 BOM is accepted) | `ValidationFailed` "not valid JSON at line L, column C" |
| F2 | `schemaVersion` ≠ "2.0" | `ValidationFailed` |
| F3 | `batch.countryCode` not served by this stamp | `ValidationFailed` with the served countries |
| F4 | > MaxFileSizeBytes / > MaxProvidersPerFile | size refused at upload (client + server); provider count ⇒ `ValidationFailed` (envelope `maxItems`) |
| F5 | empty `providers` | `ValidationFailed` |
| F6 | unknown field anywhere (top level, batch, provider, service, price…) | **ignored** — not an error, not imported, counted in "Fields ignored" (D16) |
| F6a | misspelt OPTIONAL field (`descriptoin`) | ignored (data lost) — visible in "Fields ignored"; the admin fixes the bot |
| F6b | misspelt REQUIRED field (`bussinessName`) | the required one is missing ⇒ that provider `SchemaInvalid`; "Fields ignored" shows the misspelling ×N so the cause is obvious |
| F6c | known optional field with the wrong type (`employeeCount: "11-50"`, `yearsInBusiness: "20+"`) | that value dropped (null), listed in the record's pruned values; the provider continues |
| F6d | invalid array item (one service with a broken price, one bad URL in `imageUrls`) | that item dropped; siblings kept; if a REQUIRED array ends empty ⇒ `SchemaInvalid` |
| F6e | `price.amount: 0` / negative | value dropped ⇒ the price falls back to "on request" (§8.9) — the owner's "0 means null" |
| F6f | `schedule` with 6 days / 8 days / a day twice | `schedule` dropped ⇒ no hours stored (+ `HoursIncomplete` flag); never a guessed day |
| F6g | unknown enum value | `lineType: "cell"` ⇒ dropped ⇒ default `unknown`; `kind: "shop"` (required in an address) ⇒ that address item invalid and pruned (F6d); no address left ⇒ `NoCity` unless a service area stands in |
| F6h | duplicate JSON key inside one object | treated as an invalid value at that path (pruned, or `SchemaInvalid` if required) — never "last one wins" |
| F6i | `schemaVersion` "2.0" but a 1.0-shaped file (old `providers[].owner`, `businessEmail` at the top) | the 1.0 fields are unknown ⇒ ignored ⇒ required parts missing ⇒ every provider `SchemaInvalid`; the run summary says "this looks like schema 1.0" when ≥90% of providers miss `contacts` |
| F6j | extremely deep / huge JSON values (a 5 MB description) | `MaxDepth` 32 refuses the file; an over-long string is an optional value failing `maxLength` ⇒ dropped |
| F6k | numbers as strings (`"amount": "34"`) | wrong type ⇒ dropped (never coerced — a bot must emit numbers) |
| F7 | same file uploaded twice while the first is running | 409 |
| F8 | same file after the first completed | allowed, warning, all items FillGaps / AlreadyOnClinket |
| F9 | upload SAS expired before PUT | client gets a fresh URL (re-request) |
| F10 | `POST {runId}/check` without the blob | 400 "upload the file first" |
| F11 | validation redelivered mid-way | items are upserted with the same deterministic ids (latest classification wins); counts computed from the items at the end |
| F12 | Start twice / Start while Validating | 409 |
| F13 | a Start beyond `MaxConcurrentRuns` | refused by the compare-and-set on `provimport_active` ("N imports are already running") |
| F14 | Cancel during processing | in-flight provider finishes; not-yet-started items → Cancelled; run Cancelled |
| F15 | function host restarts mid-provider | redelivery resumes at the checkpointed stage |
| F16 | deploy during a run | same as F15 |
| F17 | cost hard limit hit | PausedCostLimit + High alert; Resume after raising |
| F18 | item dead-lettered | the sweeper sees no lane progress ⇒ re-sends ≤ `MaxStallRequeues`, then `Failed: Stalled` + `ProviderImportStalled` |
| F19 | a lane makes no progress for `StaleLaneMinutes` (item in Preparing/Creating/Building) | sweeper re-sends ≤ `MaxStallRequeues` (3), then item `Failed: Stalled`, chain continues, one `ProviderImportStalled` per run per day |
| F20 | two lanes finish the last two items at once | exactly one finalize + one alert |
| F21 | admin discards a Validated run | blobs deleted, run Discarded, no account exists |
| F22 | non-admin calls any endpoint | 403 |
| F23 | uploads from CA admin for an IN file | F3 |
### Identity & contacts
| ID | Case | Result |
|---|---|---|
| C1 | no email, no phone | skip NoContact |
| C2 | only toll-free number, no email | skip NoSignInContact |
| C3 | toll-free main + mobile "text us" | sign-in = mobile; public = toll-free |
| C4 | number with extension only | NoSignInContact unless email |
| C5 | India fixed-line only | NoSignInContact unless email |
| C6 | invalid phone | dropped, flag; email-only account |
| C7 | `1-833-…` / `+1 (905) …` / `905.648.4113` | E.164 |
| C8 | IN number without +91 on the IN stamp | +91 (never +1) |
| C9 | `Info@Domain.CA` | `info@domain.ca` |
| C10 | `info [at] domain.ca` | decoded + validated |
| C11 | invalid email | dropped; phone-only account |
| C12 | email belongs to a claimed account | AlreadyOnClinket |
| C13 | email → account A, phone → account B | ContactOnTwoAccounts |
| C14 | email free, phone used by an active account | not an unclaimed prepared account ⇒ AlreadyOnClinket; an unclaimed prepared one ⇒ FillGaps (C15) |
| C15 | unclaimed prepared account match | FillGaps |
| C16 | prepared account claimed between Check and Start | P5 re-check (and the Identity endpoint) ⇒ AlreadyOnClinket |
| C17 | manual admin creation races the import on the same email | collision with an unclaimed prepared account ⇒ FillGaps on it (R8); with any other account ⇒ AlreadyOnClinket |
| C18 | owner name "Jeff" | First "Jeff", Last placeholder, displays "Jeff" |
| C19 | "Jill & Dani" | "Jill" + placeholder |
| C20 | "Dr. Winston Law" | "Winston" "Law" |
| C21 | "MARY-JANE O'BRIEN" | "Mary-Jane" "O'Brien" |
| C22 | "McIntyre" mixed case | unchanged |
| C23 | owner name equals the business name | placeholder |
| C24 | no owner name | placeholder (D4) |
| C25 | free-mail email | allowed; never used to guess a name |
| C26 | role email (info@) as sign-in | allowed (it is the business's) |
| C27 | phone of a removed or closed account | a provisioned (prepared/imported) account ⇒ `ExistingClosed` ⇒ AlreadyOnClinket (removed); a self-registered closed account's phone is free (phone checks cover ACTIVE accounts only) ⇒ New |
### Dedupe & merge
| ID | Case | Result |
|---|---|---|
| MG1 | ProFix ×10 same email+phone+domain | 1 provider, all categories/services/areas |
| MG2 | Molly Maid ×2 shared email, different phones | both skipped DuplicateContactConflict |
| MG3 | Mr. Rooter franchise locations (`brandName`) sharing contacts | BrandLocationsShareContact |
| MG4 | same name, two cities, no shared contact | two providers, both PossibleDuplicateInFile |
| MG5 | the same record copied twice in the file | first kept, copy skipped `ExactDuplicateInFile` |
| MG6 | merged members with conflicting hours | no hours + HoursConflict |
| MG7 | merged members with conflicting Facebook | none + SocialConflict |
| MG8 | AI vetoes a merge | members skipped `MergeVetoed` (decided at P5, no account created) |
| MG9 | merge of > `MergeReviewSize` (5) records | held `MergedRecords` |
| MG10 | two members both with public street addresses | primary + additional address |
| MG11 | the same service in two members (one priced) | one service, priced |
### Business data
| ID | Case | Result |
|---|---|---|
| B1 | name "BEST PLUMBER IN AJAX \| CALL NOW" | AI cleans; code checks word-subset; else held |
| B2 | ALL CAPS name | proper case |
| B3 | legal suffix "Inc." in trading name | kept as the business writes it (never stripped from the display name unless the AI change passes the check) |
| B4 | description with phone/URL | stripped |
| B5 | description promotional only | cleaned to facts or null |
| B6 | description in French/Hindi | kept in that language |
| B7 | foundedYear 1955 | years = now − 1955, clamped 100 |
| B8 | employeeCount range | null |
| B9 | permanently closed | skip |
| B10 | temporarily closed | held PossiblyClosed |
| B11 | AI "not a service business" (a shop selling products) | held |
| B12 | offensive / spam text | held OffensiveOrSpam, text dropped |
### Address & areas
| ID | Case | Result |
|---|---|---|
| AD1 | storefront street public | full address geocoded |
| AD2 | home-based (street given) | street dropped — city-level |
| AD3 | no street | city-level (D10) |
| AD4 | address city ≠ search city (Ancaster/Hamilton) | address city wins |
| AD5 | bad postal code | dropped + flag |
| AD6 | geocoder coarse for a street | kept + AddressNotConfirmed (held) |
| AD7 | city not geocodable and no other place | NoCity |
| AD8 | bot lat/lng 300 km off | geocoder wins + flag |
| AD9 | 40 service areas | 25 kept, rest history + flag |
| AD10 | service area not found | dropped, noted |
| AD11 | service references an unknown area name | service gets all areas + note |
| AD12 | timezone in file ≠ address zone | address zone + flag |
| AD13 | US address in a CA file (on the CA stamp) | that address dropped — one file = one country (§8.5.1); if it was the only place ⇒ `NoCity` |
### Categories & services
| ID | Case | Result |
|---|---|---|
| SV1 | "dental" (no fitting global parent) | a business-scoped custom top-level + subcategory, exactly as today; the alerts are collected into the run summary (§16.4); the second opinion runs |
| SV2 | "barber" under hair salon | global match |
| SV3 | AI returns an id not in the tree | resolver rejects → PendingProviderCompletion + held |
| SV4 | an item that is a product, not a service ("Tires") | kept as written unless the AI drops it as a product with the evidence; a rename only if it passes §9.4 rule 3 |
| SV5 | duplicate service names | merged |
| SV6 | 0 services after cleaning | held NoApprovedServices |
| SV7 | > 200 services (or any array above its maxItems) | the first maxItems kept in file order, the rest pruned and listed (never a skip) |
| SV8 | delivery flags unknown | category default + note |
| SV9 | service name > 150 | truncated at a word + flag |
| SV10 | custom category alerts disabled in settings | the resolver THROWS today (§3.1) — the import must surface this as item Failed with a clear "custom-category alerts are switched off" error, never a silent skip |
### Prices
| ID | Case | Result |
|---|---|---|
| PR1 | `quote`/on_request | Price on request |
| PR2 | amount 0 | pruned at validation (F6e) ⇒ "Price on request"; the normaliser ALSO treats 0 as null (defence in depth) |
| PR3 | "From $20.00" | Starting from 20 |
| PR4 | "$39/hr" | Hourly 39 |
| PR5 | range 100–300 | Starting from 100, Max 300 |
| PR6 | max < min | dropped → On request + flag |
| PR7 | amount not in priceText | dropped → On request + flag |
| PR8 | USD price on a CA business | On request + CurrencyMismatch |
| PR9 | $250,000 | kept + PriceAboveCeiling (held) |
| PR10 | "before HST" | TaxIncluded false |
| PR11 | minimum charge only | minimum charge price |
| PR12 | visit fee with On request | fee dropped (rule) |
| PR13 | prices only in notes (sample's barber) | AI extracts with evidence ⊂ notes ⇒ accepted |
| PR14 | negative | null |
### Hours
| ID | Case | Result |
|---|---|---|
| H1 | none | none stored (never 9–5) |
| H2 | 24/7 | 00:00–23:59 ×7 |
| H3 | close 00:00 / 24:00 | 23:59 |
| H4 | split shift (lunch break) | no hours stored + `HoursNotRepresentable` |
| H5 | a day not closed, no times | nothing + HoursIncomplete |
| H6 | only hoursText | AI with evidence |
| H7 | 6 days in schedule | schedule pruned ⇒ no hours + HoursIncomplete (F6f) |
### Offers, FAQs, licences, photos
| ID | Case | Result |
|---|---|---|
| O1 | 10% weekdays 11–3 | weekly MO–FR + window |
| O2 | "Free first lesson" | not imported (history) |
| O3 | expired endDate | not imported |
| O4 | applies to an unknown service name | not imported |
| O5 | percentage 150 | that offer not imported (discount rule) — the provider continues |
| Q1 | FAQ answer too short/long | that FAQ dropped |
| L1 | licence without a number / issuer | that licence item is invalid ⇒ pruned (F6d); the provider continues |
| M1 | photos off | nothing fetched, links in history |
| M2 | photo URL redirects / private IP / not an image / too big | that photo skipped (fetcher rules) |
| M3 | > half the photos fail | PhotosNeedCheck |
### Verdict, review, take-over
| ID | Case | Result |
|---|---|---|
| V1 | all checks pass, high confidence | Live (Active) |
| V2 | medium confidence | held (LiveOnMediumConfidence false) |
| V3 | AI disagreement | conservative values + held |
| V4 | admin approves | Active, item ApprovedByAdmin |
| V5 | admin removes | business closed, account inactive, item Removed |
| V6 | owner takes over a held business | Active at take-over; item shows "Owner took over" |
| V7 | provider calls self-reactivate on Pending | refused |
| V8 | admin opens the wizard on a held business | works (setup session unaffected by Pending) |
| V9 | admin approves an item whose account was removed meanwhile | 409 clear message |
| V10 | FillGaps on an Active business | stays Active; only empty fields filled |
| V11 | FillGaps on a held business | stays held |
### Processing, lanes, identity endpoint (added after the independent review)
| ID | Case | Result |
|---|---|---|
| X1 | a skip (merge veto, not a service business, or `NoCity` from P1) | applied at P5 — NO account was created |
| X2 | crash after the Identity endpoint committed, before the item recorded the userId | redelivery calls again with the same deterministic userId ⇒ `AlreadyCreated` ⇒ same account |
| X3 | two runs import the same business at the same time | the second gets `ExistingPrepared` ⇒ FillGaps (R8) |
| X4 | admin creates the same account by hand during the run | `ExistingPrepared` ⇒ FillGaps |
| X5 | Identity endpoint down / 5xx | retries ⇒ redelivery ⇒ converges |
| X6 | Identity endpoint 401/404 (bad key, not deployed) | run `PausedIdentityUnavailable` + one High alert — never 2,000 failures |
| X7 | email has a pending team invitation | `Skipped: PendingInvitation` |
| X8 | contact is a CRM customer shell | `Skipped: ContactIsCustomerRecord` |
| X9 | lane chain breaks (crash between finish and "send next") | sweeper sees no lane progress ⇒ sends the next item |
| X10 | a provider legitimately takes long (big catalogue, AI retries) | not "stalled" unless the LANE made no progress for `StaleLaneMinutes` |
| X11 | Resume / Retry re-sends inside the duplicate-detection window | attempt-suffixed messageIds ⇒ never swallowed |
| X12 | counter cache drifts (crash between item and run patch) | finalize recomputes from the items (GROUP BY status) |
| X13 | "Retry failed" after Completed | Completed → Processing → Completed, `completionNumber` + 1, a new completion alert |
| X14 | AI deployment missing / auth error / sustained 429 | run `PausedAiUnavailable` + one alert; Resume continues |
| X15 | AI content filter refuses a record | `Skipped: AiRefusedContent` (nothing created) |
| X16 | 200-service catalogue | chunked curation (40 per call), banked per chunk |
| X17 | AI answer truncated | never parsed; one retry with half the chunk; budget-bounded |
| X18 | one bad record keeps failing | per-item AI budget (planned chunks + 4, across attempts) ⇒ `Failed: AiBudgetExhausted` |
| X19 | daily import AI budget reached across runs | every running import → `PausedCostLimit` + one High alert; an admin Resume after the UTC day rolls over or the limit is raised |
| X21 | upload abandoned after the SAS was issued | run `AwaitingUpload` ⇒ the sweeper discards it and deletes the blob after 24 h |
| X22 | owner takes over while S2–S5 still run | take-over activates the profile; the worker's claim check stops further writes; item `OwnerTookOver` |
| X23 | take-over cannot lift the hold (Cosmos error) | take-over still succeeds; `ProviderImportActivationFailed` High alert; drawer offers Approve |
| X24 | a toll-free brand line shared by 30 franchisees | not a link key ⇒ no mass merge/skip |
| X25 | two listings of one business with the same two numbers in a different order | not a conflict ⇒ merged |
| X26 | `j.smith+biz@gmail.com` and `jsmith@gmail.com` in one file | the same compare key ⇒ treated as one contact for dedupe (stored as written) |
| X27 | a Québec business written in French | descriptions kept in French; `PreferredLanguage = fr` (claim emails in French) |
| X28 | Indian number "0265 2345678" (trunk 0, landline) / "+91-98765 43210" | parsed with region IN; landline ⇒ public only; mobile ⇒ sign-in |
| X29 | an owner's private mobile is the only sign-in phone | used for sign-in only; NOT published as the business phone |
| X30 | business name "AAA HVAC SERVICES" | "AAA HVAC Services" (acronyms kept) |
| X31 | owner "Dr. Winston Law" | "Winston" / "Law" (trade words are not a reason to reject a surname) |
| X32 | AI description adds "licensed and insured" not in the source | rejected ⇒ trimmed source description |
| X33 | a re-scrape changes only `scrapedAt`/`sources` | bank hit — zero AI cost |
| X34 | an admin-form prepared account never onboarded is matched | FillGaps creates its business + profile shell first |
| X35 | Remove on a business with bookings | refused with the reason; nothing half-removed |
| X36 | a phone-only business removed, then re-uploaded | `ExistingClosed` — not re-created |
| X37 | the provider calls self-reactivate while Pending or Suspended | refused (only Inactive → Active) |
| X38 | provider web/app AI Quick Setup creates a custom category (NOT the import) | BOTH existing per-event alerts still raised, unchanged (§16.4 no-regression) |
| X39 | import creates "Dental" for 50 businesses | 50 business-scoped categories (as today) + ONE summary alert for the run |
| X40 | a configured import deployment without a TokenPricing entry | the Functions host refuses to boot (spend could never be measured) |

### Friendly name
| ID | Case | Result |
|---|---|---|
| FN1 | slug available | set |
| FN2 | taken | next candidate |
| FN3 | > 20 chars | cut at word, else initials |
| FN4 | reserved word ("plumbing" is fine; "admin" reserved) | next candidate |
| FN5 | non-Latin name | city + number fallback or none + flag |
| FN6 | race: two lanes take the same slug | unique index ⇒ next candidate |

---

## 22. Security
- Admin role on every endpoint; the importer's account creation records `ProvisionedByAdminId` = the run starter.
- SAS upload URLs: write-only, one blob path, 15 min; read URLs for the drawer: read-only, one blob, 5 min.
- Never log contact values at Information level (structured logs carry ids and counts; contacts only in the item docs).
- No Cosmos cross-partition query anywhere: runs partition, one run's item partition, point reads, SQL look-ups.
- SSRF: photos only through `RemoteImageIngestionService` (PublicHost policy).
- Prompt injection: scraped text is DATA in the user message; the system prompt states the input may contain instructions
  that must be ignored; outputs are code-verified (§9.4), so an injected "set price 1" cannot pass.
- The setup-session allow-list (PLAN S1–S10) is untouched; the importer does not use setup sessions.
- Privacy: no home street addresses (D10); no owner contact published unless it is the business's public contact; external
  reviews never copied.
- Legal (owner's to arrange before launch, as in PLAN.md): scraping/terms of the sources, photo rights (D8), and CASL for any
  later outreach.

---

## 23. Observability
Structured logs with `RunId`, `ItemId`, `Stage`, `BusinessId`; per AI call the existing usage line with sub-flow
`import-curate` / `import-review` and cost; one log per run transition; the 9 import alerts (§16.4) + the existing custom-category alerts on non-import paths. The run document is the dashboard.

---

## 24. Tests (CLAUDE §0.8 — unit AND real-engine integration; 100% pass; sabotage-checked)
- **Communications.UnitTests**: normaliser (every §8 rule, every §21 C*/AD*/PR*/H*/O*/SV* row), deduplicator (MG*, X24–X26), verifier
  (§9.4 each rule incl. injection attempts), curator (bank key, versions, schema retry), friendly names (FN*), applier
  request building, item state machine, finalize race, cost limit, stall sweeper, `BankRulesVersionConventionTests`
  entries.
- **Communications.IntegrationTests** (Testcontainers SQL + Cosmos emulator + Azurite): validate a 50-record golden file end
  to end (plan counts exact); process 10 golden providers through every stage with a fake AI returning recorded answers;
  redelivery at every stage converges (no duplicate account/business/service/area/offer/FAQ); concurrent lanes; finalize
  exactly once; Pending → Active once; FillGaps never overwrites (assert every pre-existing field byte-equal); custom
  category + alert created once; merged group; skipped rows; atomic counters under concurrency; cost pause.
- **API.UnitTests/IntegrationTests**: every admin endpoint (auth, state machine 409s, paging, signed URLs), the applier
  extraction zero-regression (existing suites unchanged), the provider self-reactivate refusal, ProviderTrustPage approve
  endpoint.
- **Identity.UnitTests/IntegrationTests**: provisioning core (throttle only on the HTTP path), `IsAdminProvisioned` removal
  (every prepared-account rule still holds — the existing `ProviderTakeoverIntegrationTests` + all of PLAN §4.3's 25 cases
  pass unchanged), N1/N2/N4, take-over lifts Pending, migration test with `MigrationSchemaSeed`.
- **Admin web (jest via `CI=true npx react-scripts test --watchAll=false`)**: every page state, upload flow, drawer, bulk
  approve, CSV; ESLint 0 errors; browser at 320/375/768/1024/1440.
- **Provider web + phone (N2/N3/N4)**: jest for the prompt/greeting/registration carry-through; ESLint; browser + simulators.
- **Sabotage**: break each guard once (verifier rules, idempotency guards, cost limit, finalize, toll-free rule, home-address
  rule, 0-price rule) and confirm a test fails; never via git restore (§0.19).
- **Build every project and every test project and every app** before reporting (memory: CI caught what local unit runs
  did not).

---

## 25. Build order (each phase ends green before the next starts)
1. **Owner gates — none open.** Every design decision is made (D1–D21). The only owner step left inside the build is the
   approval of the one provider/customer mockup sheet (step 9, the mockup gate). The plan also says "verify, and ASK if…"
   in a few places — each is asked only if the code proves the condition, never assumed: §8.5.6 (a reader cannot render a
   blank street simply), §8.6 (a reader cannot handle "no hours"), §12.1 (the name look-up is too slow without an index),
   §14.3 (the name-prompt dismissal needs a new column), §17.1 (a moved key would need renaming an API key), §17.2 (the
   keyed AI client cannot bypass the shared bulk semaphore cleanly).
2. **Shared + SQL**: enums/constants, settings classes (+appsettings, class defaults equal), `PersonName`,
   `IsAdminProvisioned` removal + migration applied CA+IN + proven (incl. the raw-SQL site, §13.1), the `PUT UserProfile`
   marketing-consent bug (§14.3).
3. **Refactors §19** with zero-regression proof (before/after test runs recorded): the applier with its options (§19.1),
   the bootstrap (§19.2), the alert mode + `NotifyProvider` defaults pinned (§16.4), the silent activation + reactivate
   narrowing (§19.5).
4. **Identity**: the provisioning core with a deterministic id + business ensure (§19.3), the internal endpoint (§11A),
   friendly-name service (§19.4), N1/N2/N4 server, take-over lifts Pending with a loud failure (§10.5), activity types.
5. **Functions**: DI audit (§16.2), queues, repositories, validate-then-prune, normaliser, deduplicator, matcher, geocode
   preparer, curator + bank + chunking, verifier, apply-request builder, Identity client, photos (new public-media
   method), lanes, finalize, sweeper, limits, alerts collector.
6. **Main API**: admin controller, trust-page approve endpoint.
7. **Infra**: ARM (queues, container, model deployments, Key Vault secret), deploy.ps1 (Merge-AppSettings, entity settings,
   required settings, drift guard), local.settings ×3; deploy order Identity → Functions → API → admin web.
8. **Admin web** (§18).
9. **Mockup** `Data/mockups/provider-name-prompt` (N3 + the customer apps' "profile ready" step, §14.4) → owner approval →
   provider web + provider phone (N3), customer web + customer phone (409 handling), N2 UI greetings, N4 clients.
10. **Pilot** (§20) on sandbox CA: 20 then 200 providers; accuracy audit; record numbers; fix every finding.
11. **Skills + memory** (§26).
12. **‼️ MULTIDIMENSIONAL AUDIT (§27): audit everything → fix EVERY finding → re-check EVERY fix → report. The task is not
    complete without it. ‼️**

---

## 26. Skills and memory (CLAUDE §0.9)
- **New skill `clinqet-provider-import`** in all four tool directories (`.claude/skills`, `.github/skills`,
  `.agents/skills`, `.cursor/rules/*.mdc`) + registered in the four instruction files' skill tables (count 42 → 43): the
  pipeline, the stage table, idempotency keys, the review gate, settings, the schema and its three copies, the edge-case
  catalogue pointer, "never" list.
- Update: `clinqet-prepared-providers` (ProvisionedAt, take-over lifts Pending, name fixes), `clinqet-ai-assistant` (the
  applier extraction; the stale facts §3.1 found: deleted chat architecture, `AiEventType` count, model names/timeouts,
  `MaxRecordsPerChunk`, `AllowCustomCategoryCreation`), `clinqet-function-app` (folder name `clinqetfuncations`, new
  functions/queues), `clinqet-deployment` (queue steps via `$script:ServiceBusEntitySettings`, new container/deployments),
  `clinqet-admin-app`, `clinqet-identity-api`, `clinqet-provider-onboarding` (ServiceArea has no polygon/zip mode; licences
  are separate docs), `clinqet-service-listing` (description is a string; stored priceType), `clinqet-partner-app`,
  `clinqet-provider-mobile`, `clinqet-notifications` (greeting helper).
- Memory: a project entry for this programme (built state, deploy order, pilot numbers) + any trap found.

---

## 27. ‼️‼️ MULTIDIMENSIONAL AUDIT — MANDATORY, CRITICAL, MUST NOT BE MISSED ‼️‼️

> **THE TASK IS NOT COMPLETE UNTIL THIS SECTION IS DONE. NOT WHEN THE CODE COMPILES. NOT WHEN THE TESTS PASS. NOT WHEN
> THE PILOT RUNS. ONLY AFTER ALL THREE STEPS BELOW ARE FINISHED AND REPORTED WITH EVIDENCE.**
>
> **Owner, 2026-10-06:** *"before marking this task complete … making sure that our entire code that we have done is
> correct, our entire code is extremely solid, our entire code is fully best practice, our entire code is as per plan,
> there is no bug, there is no gap, we haven't missed anything, there is no loophole … our code is handling all the edge
> case scenario very well … there is no missing functionality … what we have decided to implement."*
> This repeats CLAUDE.md's standing rule and PLAN.md §14 — **and it is written here, in bold, so that it cannot be
> skipped, shortened, or "done later".**

### 27.1 WHEN
**After the ENTIRE implementation is finished** — every phase of §25 including the pilot (§20), the skills and memory
(§26) — and **BEFORE the task is reported complete.** Never audit a half-built feature and call it done; never report
done without it.

### 27.2 STEP 1 — AUDIT EVERYTHING (independent reviewers, one per dimension, fresh eyes — not the author re-reading their own code)
| # | Dimension | What the reviewer must prove (not assume) |
|---|---|---|
| 1 | **No bugs — correctness** | every row of §21 behaves exactly as written, traced through the real code; every stage P1–P5 and S1–S6; every state transition of runs and items |
| 2 | **As per plan — completeness / no missing functionality** | **every line of this document** is implemented: walk §2 (D1–D21), §5–§19 and §11A line by line and tick each; anything decided and not built is a finding. Nothing was silently dropped, shortened or "left for later" |
| 3 | **Every edge case — no flow gaps** | §21 in full, **plus re-uploads (§12.3 — R1–R12)**: the same provider uploaded again with MORE information fills only the gaps; uploaded again with LESS information **NEVER deletes, empties or downgrades** anything already set up; the same provider several times in one file; uploads overlapping while one runs; a provider who took over in between; plus every case the reviewer can think of that §21 does not list (each new case found = a finding + a test) |
| 4 | **No loopholes — security** | §22; admin-only endpoints; SAS scope/expiry; prompt injection through scraped text cannot change a price, name, category or verdict; no home address or personal contact published; no message to a prepared account; setup-session allow-list untouched; cross-tenant isolation |
| 5 | **Data integrity & idempotency** | every redelivery at every stage converges (no second account, business, service, area, offer, FAQ, licence, custom category, friendly name, alert or counter increment); ETags; atomic counter patches; the finalize race; cancel/resume/retry; FillGaps never overwrites |
| 6 | **Best practice — code quality** | CLAUDE.md in full: no cross-partition Cosmos query, structured logging, no swallowed exception, no magic numbers (settings/enums), class defaults = appsettings, terse comments only, no dead code, DI lifetimes (no captive dependency), `IHttpClientFactory`, `IMemoryCache` Size = 1, disposal, cancellation honoured, thread safety, no memory/CPU leak |
| 7 | **Accuracy of what customers see** | the pilot audit (§20): every field of the 20 and a 30-record sample of the 200, compared with the source — nothing invented, nothing wrong, prices honest, hours never guessed, categories right |
| 8 | **Cost** | AI calls per provider, bank hit rate on a re-upload (must be ~100%), RU per provider, geocoding calls, one enrichment per service; the cost limit and warning really stop/alert |
| 9 | **Resilience** | host restart, deploy mid-run, DLQ, stall sweeper, AI/geocoder/Cosmos/SQL outages — no stuck run, no half-published provider |
| 10 | **No regression** | AI Quick Setup (flyer, PDF, catalog manifest), the admin setup wizard, prepared-account take-over (all 25 cases of PLAN §4.3), price-on-request — before/after test runs recorded |
| 11 | **UX** | every admin state at 320/375/768/1024/1440; the provider name prompt (N3) on web + both phone sizes; plain words; the summary panels explain every skip/drop |
| 12 | **Localization** | N2/N3 strings in all 5 languages, emails rendered per language; admin English |
| 13 | **Config & infra hygiene** | ARM + deploy.ps1 + local.settings ×3 for every queue/container/setting/deployment; no orphan keys; drift guard passes |
| 14 | **Tests** | unit + real-engine integration for every stage and every §21 row; 100% pass; each guard sabotage-checked (the test FAILS when the guard is broken); every project, test project and app builds |
| 15 | **Hygiene** | skills ×4 + memory updated; clean tree (§0.16); linear history (§0.21) |

### 27.3 STEP 2 — FIX EVERY FINDING
**Every finding is fixed in this same task** — no "minor", no "later", no "out of scope" without the owner's explicit
yes. Each fix gets a test that fails without it.

### 27.4 STEP 3 — RE-VERIFY EVERY FIX (owner: *"just check again only for those fix to making sure it is really closing that finding"*)
For **each** finding, a reviewer who did not write the fix checks **that fix only** and answers: does it really close the
finding? did it break anything next to it? is its test real (sabotage: remove the fix → the test fails)? Any "no" ⇒ back
to Step 2 for that finding. Repeat until every finding is verified closed.

### 27.5 REPORT
Only then report complete, with: the findings list (each: dimension, problem, fix, the test that proves it, the re-verify
verdict), test-run totals for every suite, the before/after regression runs, the pilot numbers and accuracy audit, the
migration proof (`dotnet ef migrations list` CA + IN), `git status` clean of scratch files.

**‼️ REPEAT: DO NOT MARK THIS TASK COMPLETE WITHOUT §27 STEPS 1, 2 AND 3. ‼️**

---

## 28. Appendix — what the owner asked and where it is answered
| Owner's words (2026-10-06) | Section |
|---|---|
| "review the provider schema … expand it … give me that schema" | §5, `provider-import.schema.json` |
| "go through our provider app and every single options, A to Z" | §3.3, §6 |
| "upload … validation … no duplicate … summary … duplicates … couldn't add" | §7 |
| "first and last name properly capitalize … email all small … phone formatted per region" | §8.1–8.3 |
| "create that identity record … same as the provider setup … no password" | §11.3 S1, §11A, §19.3 |
| "give it to our AI profile setup … custom category … admin alert … same approach" | §9, §19.1 |
| "AI to formalize … remove typos … correct categorization" | §9.3, §9.4 |
| "price zero … consider it as null" | §8.9 |
| "friendly name … creative" | §11.5 |
| "cost … critical … not at the expense of quality" | §9, §20 |
| "brand new app setting … dedicated AI foundry model … local settings … don't forget" | §17 |
| "every single edge case" | §21 |
| "list of previous runs … summary … click each provider" | §18 |
| "AI not confident … admin review … approve … public index" | §10 |
| "is admin generated … claimed date … redundant boolean … AI created flag?" | §3.7, §13, D9 |
| "duplicate email different phone … ignore both" | §7.5, D1 |
| "AI check when provider sets service … redundant?" | §3.10, D14 |
| "check that flow … claiming with same email but different phone …" | §3.8, §14 |
| "remove the id from schema … if bot json have more than schema … accept schema only and ignore rest" | D12, D16, §5 rules 10–11, §7.2 step 2, §21 F6–F6k |
| "multi-dimensional audit … fix all the finding … check again only for those fix" | top banner, §25 step 12, **§27** |
| "same provider … second time more info or less info … less info shouldn't delete" | **§12.3 (R1–R12)**, §27.2 row 3 |
| "internal endpoint in identity … extremely solid … if this failed how to handle … this is first" | D17, **§11A** |
| "one summary per run … shouldn't impact … provider web and app … admin alert is super important … no bombardment … no regression" | D18, **§16.4** |
