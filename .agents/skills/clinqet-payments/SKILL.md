---
name: clinqet-payments
description: |
  **CORE FEATURE SKILL** — Work on the Clinqet payments / subscriptions / tiers layer
  (region-agnostic, behind feature flags). Two money flows: FLOW A provider→Clinqet
  (subscription tiers + AI add-on + minute top-ups, self-managed recurring) and FLOW B
  customer→provider booking payments (Connect/Route, optional, post-confirmation). One
  `IPaymentGateway` seam resolved per provider's primary-address country: US/CA → Stripe
  (live), India → Razorpay/Cashfree (NotSupported stubs until Phase 6). Billing state is
  SQL (the shared `AppDbContext` in clinqetinfrastructure — NOT clinqetidentity); counters
  + webhook idempotency are atomic-PATCH docs in the existing Cosmos `SystemData`
  container (no new container). Two plans since 2026-10-04: Free + Premium (catalog v12);
  there is no promo grant.
  USE FOR: gateway seam + resolver, SQL billing schema + the `AddBillingAndPayments`
  migration, EntitlementService, AI usage counter, Stripe webhooks +
  idempotency, feature flags + AppConfig delivery, promo CODES (checkout discounts),
  CurrencyCode enum, subscription/charging engine (P2), Connect booking pay (P3), mobile
  compliance (P4/P5), India go-live (P6), smart analytics (P7). Applies to
  clinqetshared/Enums/Payment*+Subscription*+Billing*+CurrencyCode+PromoCode*+UsageMeter,
  clinqetcore/Entities/SQL/* (billing + promo), clinqetcore/Interfaces/Payments/,
  clinqetcore/Models/Payments/, clinqetinfrastructure/Services/Payments|Entitlements|Usage|Currency/,
  clinqetinfrastructure/Data/SQL/AppDbContext.cs + BillingModelConfiguration.cs,
  clinqetinfrastructure/Data/COSMOS/AiUsageCounterRepository+PaymentWebhookIdempotencyStore,
  clinqetinfrastructure/Configuration/PaymentServiceRegistration.cs,
  clinqetfuncations Functions/StripeWebhookFunction+PaymentWebhookProcessor,
  clinqetapi Controllers/AppConfigController.cs, azureautomation/events.json+deploy.ps1.
  Master plan: C:\Nik\payments-plan\IMPLEMENTATION-INDEX.md.
---

# Clinqet Payments — skill

> **Master memory / source of truth:** `C:\Nik\payments-plan\IMPLEMENTATION-INDEX.md` (+ companion docs 00–07, cost-model, mockups). Read it before any payments work. This skill summarizes what Phase 0 shipped and the locked patterns.
>
> **⛔ PROCESS — every phase, no exceptions:** read **IMPLEMENTATION-INDEX §0 (NEVER-MISS)** FIRST and enforce it; flag any deferral in SUPER BOLD (never bury it); and **every phase MUST end by printing the next phase's COMPLETE, self-contained handoff prompt in the canonical structure** (re-embedding the §0 NEVER-MISS block verbatim) so the chain self-perpetuates P0→P7. A phase is NOT done without it (HANDOFF-PROMPT Part D).

> **▶ PHASE 9 — COMPLETE & ALL 127 FINDINGS FIXED (2026-06-29).** The extreme P0→P8 audit is closed; every finding fixed (Batches 4→10). Final green: API unit 5025/0, Functions unit 1353/0, integration 16/16. **New billing schema (migration `20260629000801_AddBillingRegionAndCatalogConcurrency`):** `[Timestamp] RowVersion` on the 5 catalog entities (SubscriptionPlan/Entitlement/AddOnProduct/TopUpPack/PlatformFeeRule) + `DbUpdateConcurrencyException`→412 (BaseController); 3 filtered-unique indexes — `UX_PaymentMethod_Business_Default` (one active default/business), `UX_MinuteLedger_Txn_EntryType` (double-credit guard — MinuteLedgerService treats the violation as a benign no-op), `UX_TaxRule_Region_Default` (one NULL-subdivision default per region+applies-to). **‼️ Migration caveat:** `BillingTransaction.Region` is added by `20260628214521_AddBillingTransactionRegion` (Region-only); the catalog migration is catalog-only — **NEVER re-fold Region into it** (it double-adds the column on any DB that already applied the original). **Other P9 fixes:** reconciliation reads the STORED account via `IPaymentGatewayResolver.ResolveForRegion(region,currency,purpose)` (not the live country); Stripe off-session `processing`→`FailureCode="pending"` (no false dun); gateway-customer create is idempotency-keyed per (business/booking,gateway); `AppConfigController` projects payment sub-flags AND-ed with master `Enabled`; provider-billing READ endpoints `BillingUiEnabled`-gated; `SubscriptionStatus.Grace` reserved (grace = PastDue+GraceUntil); WhatsApp/lead/AI-recharge gates honor `UsageCapsEnabled`/`AiAssistantPaidEnabled`/`BillingChargesEnabled`; dead `CreatePaymentLinkAsync` seam removed. **‼️ Pre-go-live:** `dotnet ef database update` + the P1 search reindex + the SystemData (`occurredAtUtc`) reindex. Detail: memory `payments-phase9-audit.md`.

> **▶ 2026-07-09 — GLOBAL NoTracking OUTAGE FIXED; EF tracking is now a PER-HOST invariant, uniform across environments.** Root cause of "turn off auto-renewal returns 200 but nothing changes": hosts registered AppDbContext with global `QueryTrackingBehavior.NoTracking` in deployed environments (API/Identity: non-Development + `Database:UseNoTracking`; Functions: unconditional) ⇒ every query→mutate→SaveChanges silently persisted NOTHING while local dev and every test (tracked) stayed green. Audited blast radius (4 parallel file-by-file agents): all 13 payment services — AI/plan cancel+resume, tier switches, auto-recharge settings, PastDue reactivation after a successful charge, the ENTIRE dunning/renewal state machine (period advance, FailedChargeCount/grace, downgrades ⇒ SQL/Cosmos divergence), reconciliation repairs, promo per-period decrement (recurring promo codes discounted FOREVER), BillingCatalogSeeder release application (CatalogVersion releases never landed on existing rows), reminder dedup markers (trial/pre-debit/price-notice re-sent every sweep), default-card switching/removal — plus 8 AdminBillingConfig UPDATE operations (fake 200s + fake audit rows). `Add()`-based flows (purchases, trials, BillingTransaction idempotency inserts, minute-ledger writes) were never affected — which is why purchase testing looked healthy. **FIX (per-host, environment-uniform): API + Functions hosts are TRACKED-BY-DEFAULT** (reads opt out per-query with `.AsNoTracking()`; NEVER reintroduce NoTracking there — a missed read opt-out costs microseconds, a missed write opt-in silently loses money state). The **IDENTITY host stays NoTracking-by-default but now UNCONDITIONALLY** (no Development divergence): it is built on ASP.NET Identity's attach-based UserStore writes — flipping it tracked makes `UserManager.UpdateAsync` throw identity-map conflicts on mixed-instance user graphs (proven: 12 identity integration failures, all green again after scoping) — so identity-host writers opt IN with `.AsTracking()` (DeviceTokenRepository, PolicyConsentService, CommunicationPreferenceService, AuthService passkey writes). `Database:UseNoTracking` is deleted; NO host varies tracking by environment anymore — tests exercise exactly what production runs. Post-flip hardening: failed-row DETACH in PaymentReconciliationService + the SubscriptionBillingService annual-grant catch (poisoned-tracker guard); shared scoped-context `ChangeTracker.Clear()` converted to targeted detach (UserMetadataService/CustomerIdentityService/DeviceTokenRepository); AuthService validate-before-mutate in UpdateUserProfileAsync + guarded entity reload on failed UpdateAsync + explicit passkey `SignatureCounter` save on an `AsTracking` load (WebAuthn replay protection persists for the FIRST time in deployed envs) + ~19 read paths AsNoTracking; redundant `.AsTracking()` removed in the tracked Functions host (PaymentWebhookProcessor ×7). **New bug the new tests caught:** the default-card swap wrote clear+set in ONE SaveChanges, but SQL checks `UX_PaymentMethod_Business_Default` per STATEMENT ⇒ the swap could throw. `PaymentMethodService.SetDefaultAsync` is now a single set-based `ExecuteUpdateAsync` CASE swap; `ClearDefaultsAsync` is set-based + immediate; `RemoveAsync` flushes the soft-delete before promoting; `ConfirmSetupIntentAsync` clears BEFORE loading the row it mutates (RowVersion freshness); the webhook `ClearDefaultsAsync` flushes before its insert (stays InMemory-testable). Regression guard: `BillingMutationPersistenceIntegrationTests` (real SQL — fresh-context read-your-write for AI/plan cancel+resume, auto-recharge, default swap). Response contract: `ToResponse(result, successKey)` with per-action localized `Success_Billing*` keys (en/hi/gu) — cancel no longer says "Purchase completed."; plan cancel + `Error_NoActiveSubscription` localized. Detail: memory `notracking-tracked-by-default.md`.

## ‼️ CURRENT PLAN MODEL — two plans, Free + Premium (2026-10-04) — READ FIRST

Authority `C:\Nik\Data\two-plan-pricing\PLAN.md` (D1–D15) + `UI-CONTRACT.md`. **Every dated section below that
names Basic, PremiumMax/Max, the promo grant, PromoSunset/founder codes, paid-to-paid plan switching, the paid
Pro/TopPro badge, `PendingTier`, a built-in yearly discount (MonthsFree / PercentOff / ExtraMonths, "Save 20%") or
catalog versions before 12 is HISTORY** — kept for the reasoning, not the facts.

- **`SubscriptionTier { Free, Premium }`** (`clinqetshared/Enums/SubscriptionTier.cs`). Basic and PremiumMax are gone
  everywhere. Code reads entitlements (features), never plan names.
- **Catalog v12** (`BillingCatalogDefinition.CatalogVersion = 12`). Premium monthly: **us 499 · ca 599 · in 29900**
  (US$4.99 · C$5.99 · ₹299). Yearly = 12 × monthly (see **Yearly billing** below). Never hardcode a price in a client;
  read `annualPriceMinor`.
- **Entitlements (`EntitlementsForTier`, Premium / Free):** `search_boost` 1.025 / 1.00 · `leads_priority` 1 / 2 ·
  `leads_quota` null (unlimited) / 5 · `whatsapp_template_cap` 200 / 10 · `ai_voice_bonus_minutes` 150 / 0 ·
  `analytics_advanced` and `banner` Premium only · `team.seats` 50 / 3 · `ai_text_daily_limit` 200 both. Plan
  knowledge parts (`PlanKnowledgePassages`) 2000 / 500. Premium = the old Max book except the WhatsApp cap (200, not
  unlimited). The `badge` key is retired (`BillingCatalogSeeder.RetiredFeatureKeys` purges it).
- **No promo grant.** `PromoEnabled` / `PromoGrantTier` / `PromoExcludeFeatures` are deleted; `EntitlementService`
  resolves the real tier. The whole PromoSunset / founder feature is deleted too (service, `Sunset*` +
  `SubscriptionUpgraded` notification types and templates, `founderOffer`, the `-PaymentsPromoEnabled` /
  `-PromoSunset*` deploy.ps1 parameters). Trials run only through the admin **Promo & Offers** screens (opt-in). The
  customer `PromoEnabled` on booking-pay / cart offers is a different thing and stays.
- **No paid-to-paid switching.** `ChangePlanTierAsync` and the plan switch flow are gone: Free→Premium = subscribe,
  Premium→Free = cancel. Same-tier Month↔Year interval switches remain. `ProviderSubscription.PendingTier` was dropped
  by migration `DropProviderSubscriptionPendingTier` (applied CA + IN 2026-10-05).
- **Overview contract (`GET provider/billing/overview`):** `isPromo`, `founderOffer`, `annualBilling`, `subscription.pendingTier`,
  `subscription.pendingSwitchEffectiveAt` and `entitlements.badge` removed; `entitlements.analyticsAdvanced` is a
  boolean; `plans` has 2 rows, each with `leadsPerMonth`, `whatsAppPerDay`, `teamSeats` (number or `null` = unlimited)
  for the plan cards.
- **"Is there a higher plan?" = tier is `Free`.** `UpgradeAvailable` is true only for Free. It rides `LeadAccessDecision`,
  `LeadUsageStatus` / `BroadcastLeadUsageDto`, the `ILeadAccessGate.FindQuotaBlockedAsync` result (businessId → upgrade
  available), `WhatsAppSendDecision` / `WhatsAppSendRecord` / `WhatsAppSendUsage` / `ProviderWhatsAppUsageDto`, and
  `BusinessSeatState` / `BusinessSeatStateDto`. Each limit message has a `*TopPlan` variant used when it is false, so
  Premium is never told to upgrade (D11): `Error_LeadMonthlyLimitReachedTopPlan`, `Error_BusinessSeatLimitReachedTopPlan`,
  `Notification_LeadQuotaReached_TitleTopPlan` / `_BodyTopPlan`, `Notification_BroadcastReceivedLocked_BodyTopPlan`,
  `Notification_WhatsAppPlanBlocked_BodyTopPlan`.
- **Yearly billing (D15, 2026-10-05).** Yearly = 12 × monthly and the term is always 12 months:
  `Clinqet.Shared.Helpers.AnnualPricing.PriceFor(monthly) => monthly * 12`, `TermMonths = 12`. Yearly is always offered for
  the plan and the AI Assistant add-on — no setting, no region switch. DELETED: `PaymentSettings.AnnualBilling`,
  `AnnualBillingSettings`, `AnnualBillingRegionOverride`, `ResolveAnnual` / `ResolvedAnnual*`, the `AnnualDiscountMode`
  enum, `ProviderAnnualBillingDto` / `overview.annualBilling`, every `annual_unavailable` gate, and the
  `Payments.AnnualBilling` appsettings (API + Functions). The ONLY yearly saving is an admin promo code with `AllowAnnual`
  ("Apply to annual plans"); `discountedAnnualPriceMinor` is set only then. UI: the Monthly|Annual toggle defaults to
  Monthly, a promo chip sits beside it, and the yearly total is shown crossed out beside the promo price. A **Repeating**
  promo applied to a yearly charge covers the FIRST yearly charge only (owner, 2026-10-05; `ProviderPromoService`).
- **`PlanLimits`** (`clinqetcore/Models/Payments/PlanLimits.cs`) is the one reading of `leads_quota` (`LeadsPerMonth`, null =
  unlimited), `whatsapp_template_cap` (`WhatsAppPerDay`: off/missing ⇒ platform default, null/negative ⇒ unlimited) and
  `team.seats` (`TeamSeats`: never unlimited, missing ⇒ configured default). `LeadAccessGate`, `WhatsAppSendGate`,
  `BusinessSeatService` and the overview plan cards (`ProviderBillingController`) all use it, so a gate and its card agree.
- **Missing plan catalog row.** At renewal or trial conversion `SubscriptionBillingService.DeferForMissingPlanAsync` raises
  `RaisePlanMissingAsync`, retries after `NoPaymentMethodRetryDays`, and never charges or grants a free period. A trial's
  end moves with it, bounded by `TrialEndMaxExtensions`; a spent budget ends the trial uncharged.
- **Quote = charge (2026-10-05).** The monthly→yearly switch quote and charge share `ResolveAnnualSwitchDiscountAsync`
  (binding first, else the armed code checked against the yearly price; same in `AiAddOnService`). The switch credit is
  what was actually PAID for the unused time (net of discount, before tax), so a month paid at 100% off credits nothing.
  An expired-but-unswept trial quotes a purchase now, as `SubscribeAsync` charges. A replay of the charge that completed a
  binding never creates a second binding.
- **Retired catalog rows.** `BillingCatalogSeeder` converts any v11 DB inside its transaction: Basic/PremiumMax holders →
  the region's Premium plan, those plans + entitlements deleted (a no-op once converted); crossing to v12 lifts Premium/Free
  values and the Premium price ONLY where still at the exact v11 seed (admin edits kept).
- **Promos naming only retired plans** never look applicable (`NeverFitsTier`): pay-time refuses every tier, so arming and
  "Offers for you" refuse/dim them too. The admin forms save only tiers the catalog still sells.
- **Admin region currency.** `GET admin/billing-config/regions` returns `{ regions, currencies }` — each served region's
  canonical `CurrencyCode` from `BillingCatalogDefinition.CurrencyFor`; the admin pages use it, never a hard-coded list.
- **Leads:** two waves (Premium first, Free after `Broadcast:Matching:FreeDelayMinutes` 30), the rescue rule, the
  `LimitReached` locked card, `NotifyOverQuotaLeads` and the one `LeadQuotaReached` notice — see
  `clinqet-quote-lead-broadcast` ("TWO PLANS").
- **Deep links:** plan-limit notices → `BillingPagePaths.Plan` (`/dashboard/billing`); the AI-minute cap notice →
  `BillingPagePaths.AiAssistant` (`/dashboard/ai-billing`).
- **Insights:** `InsightsTier { Free, Premium }` — Premium gets every metric (see `clinqet-smart-analytics`).
- **Admin offers read the catalogue, never a list in the app:** `useOfferCatalog(region)` (`clinqetwebadmin/src/components/offers/`)
  reads `GET admin/billing-config/plans` + `addons`; `offerCatalog()` derives the paid active plans (trial/promo "Eligible plans", shown
  only when there are 2+), every catalogue tier + which are priced at 0 (audience filters, "no paid plan"), the active engines, the
  region currency (from the rows, so a promo never guesses one) and the monthly prices for the trial budget helper. An empty or
  unreadable catalogue is an error state with Retry. Region names come from the country lookup (`useOffersRegion().regionLabel`).

## What this is
A region-agnostic payments + subscription layer. **Everything is behind feature flags** (`PaymentSettings`); at launch all flags are at launch defaults so the apps look exactly like today. Two flows:
- **FLOW A (provider → Clinqet):** subscription tiers (Free/Premium since 2026-10-04) + AI Voice add-on + minute top-ups. Recurring is **self-managed** (our own Function scheduler, P2) — no Stripe Billing surcharge.
- **FLOW B (customer → provider):** optional, post-confirmation booking payments via marketplace payouts (Stripe Connect / Razorpay Route / Cashfree Easy Split), P3.

## LOCKED decisions (do not change without asking)
- **Gateway split:** US/CA → **Stripe** (live); India → **Razorpay (primary)/Cashfree (alt)** (NotSupported stubs → Phase 6). One `IPaymentGateway` per gateway, resolved by the provider's primary-address country.
- **Billing in SQL** via the shared `AppDbContext` (`clinqetinfrastructure/Data/SQL/`), registered (pooled) in all 3 hosts; entities in `clinqetcore/Entities/SQL/`; one migration `AddBillingAndPayments` in `clinqetinfrastructure/Migrations/` (assembly pinned to `Clinqet.Infrastructure`). **No new Cosmos container.**
- **Counters + webhook idempotency → Cosmos `SystemData`** (atomic PATCH / point create-if-absent + TTL, mirror of `WhatsAppSendCounterRepository`). RU/write is the same as ProviderData, but SystemData is the right fit (generic `/pk`, isolated from business OLTP, self-purging TTL, precedent). **Money truth stays in SQL** (`BillingTransaction` unique `IdempotencyKey`).
- **Seam in API + Functions ONLY** (mirror of the VoiceCarrier seam; Identity never registers it — keeps Stripe secrets out of the auth host). `AddPaymentServices(IConfiguration)` in `clinqetinfrastructure/Configuration/PaymentServiceRegistration.cs`.
- ~~**Promo grant**~~ — DELETED 2026-10-04 (`PromoEnabled` / `PromoGrantTier` / `PromoExcludeFeatures` no longer exist; every provider resolves to their real tier).
- **PRICING (revised 2026-06-27 — AI DECOUPLED from tiers)** — ‼️ the tier ladder below is superseded by the two-plan model at the top of this skill; the AI add-on rules still hold: 4 **reach-only** tiers (Free $0 / Basic $12 / Premium $29 / Premium Max $55; **Max = "FIRST leads + top banner + biggest boost + Top-Pro + unlimited WhatsApp + SLA + analytics+"**). The **AI Receptionist is a separate $24/mo add-on on ANY plan incl. Free** — **no tier grants `ai_voice`** (add-on-only). Included minutes scale with the plan via the `ai_voice_bonus_minutes` entitlement: effective = `AddOnProduct.BaseMinutes (100) + bonus (0/50/100/150)` → **100/150/200/250**. Top-ups FLAT for all: 50/$9 · 100/$16 · 200/$29 · 250/$35. **Everything is per-region admin config** (`SubscriptionPlan`/`Entitlement`/`AddOnProduct`/`TopUpPack`/`PlatformFeeRule`, seeded as defaults) — the **admin config UI (Phase 1) MUST expose every knob**. **TWO AI engines** (`VoiceModelTier` Standard/Advanced) — each is its own per-region `AddOnProduct`+`TopUpPack` (new `ModelTier` column): **Standard ~$24/mo**, **Advanced ~$39/mo** (the "mega" model for complex calls, ~2.5× COGS, top-ups ~2.4×). Chosen at AI signup; admin sets it on provisioning → `Voiceline.ModelTier` (P1 = choice UI on the AI add-on card; P2 = purchase + provisioning). **LEADS: ALL tiers get them (catalog v3, 2026-07-02)** — `leads` enabled for every tier incl. Free; priority **Max→Premium→Basic→Free** (`leads_priority` 1/2/3/4; Free = last wave, ~75 min, never starved but always after every paid tier); lead = "a customer on Clinket reaches out, routed straight to you, Uber-style".
- **Money = `long *Minor` + `CurrencyCode` enum** (string-serialized, nvarchar(3)). `[Timestamp] RowVersion` on mutable rows. **Never store PAN/CVV** (token refs + last4 + brand only).
- **No payment-vendor name in user-facing UI** ("Secure payment"); every user-facing string is a localization key (promo failure reasons are keys like `promo_expired`).

## Phase 0 — SHIPPED (foundation, inert)
- **Enums** (`clinqetshared/Enums/`, string-serialized): `PaymentGateway`, `PaymentAccount`, `PaymentPurpose`, `PaymentCaptureMethod`, `SubscriptionTier`, `SubscriptionStatus`, `BillingInterval`, `BillingTransactionStatus/Type`, `PaymentMethodType`, `ConnectedAccountStatus`, `PlatformFeeScope/Type`, `AddOnType`, `MinuteLedgerEntryType`, `UsageMeter`, `CurrencyCode`, `PromoCodeDiscountType`, `PromoCodeAppliesTo`.
- **Gateway seam:** `IPaymentGateway` + gateway-agnostic contracts (`clinqetcore/Models/Payments/PaymentGatewayContracts.cs`); `StripePaymentGateway` (per-call `RequestOptions.ApiKey` + `IdempotencyKey`; Stripe service classes are **fully-qualified `global::Stripe.*`** because the solution has its own `CustomerService`/`ProductService`); `Razorpay/CashfreePaymentGateway : NotSupportedPaymentGatewayBase` (fail-closed); `IPaymentGatewayResolver` → fail-CLOSED region→gateway mapping.
- **Region resolver:** `ICountryResolutionService` extracted from `CurrencyService` (which now delegates to it). Returns `{CountryName, Iso2, CurrencyCode, CurrencySymbol}`; ISO2 from the country-lookup metadata `country` code, CurrencyCode from a static ISO2→ISO-4217 map.
- **SQL schema (13 tables):** `SubscriptionPlan`, `Entitlement` (FK→plan, cascade), `ProviderSubscription`, `ProviderAddOn`, `MinuteLedger` (append-only), `TopUpPack`, `AddOnProduct`, `PaymentMethod`, `BillingTransaction`, `ProviderConnectedAccount`, `PlatformFeeRule`, **`PromoCode`**, **`PromoCodeRedemption`**. Config + deterministic `HasData` seed (per-region plan/entitlement/topup/addon catalog + Global fee `Enabled=false`) in `BillingModelConfiguration.cs`. Filtered-unique indexes: one live subscription/add-on per provider; one Global fee per region.
- **EntitlementService** (`IEntitlementService`, scoped, SQL via `IDbContextFactory`): resolves `EntitlementSet` (tier + feature dict); no row ⇒ Free; unresolved region ⇒ `DefaultRegion`. ‼️ **The provider's OWN rows (live subscription tier, live `AiVoice` `ProviderAddOn`) are read on EVERY resolve — never cached across requests** (rewritten 2026-09-18). They change in the FUNCTIONS host (Stripe webhook, renewal, trial conversion, dunning, boundary cancellation), whose in-process cache the API can never reach, and the old 24h per-business snapshot is what let `/provider/billing/overview` return `entitlements.aiVoice=false` in the same payload as a live `aiAddOn`. Only the per-(tier, region) PLAN CATALOG is cached — shared by every provider, `Size = 1`, TTL `EntitlementCatalogCacheMinutes` (5, the cross-host backstop, mirroring `PromoCatalogCacheMinutes`), evicted instantly by `InvalidateAll()`. `Invalidate(businessId)` now means "drop what THIS scope resolved" — required after a write the same scope re-reads (the tier projection after a plan change, the reindex in `SearchIndexSyncFunction.ProcessReindexForBusinessAsync`), never a cross-process claim.
- **Usage metering:** `IUsageCounter` seam → `AiUsageCounterRepository` (SystemData `aiusage_{businessId}_{period}`, atomic Increment) wrapped by `CachedUsageCounter` (short-TTL read cache, never the source of truth).
- **Webhooks:** `StripeWebhookFunction` (Anonymous, `payments/stripe/webhook/{account}`, per-account secret, raw-body verify, enqueue with `MessageId=event.id` → 200) + `PaymentWebhookProcessor` (idempotent SQL mirror: IsProcessed → apply → MarkProcessed) + `IPaymentWebhookIdempotencyStore` (SystemData `pwhevt_{gateway}_{eventId}`, pk=eventId). New SB queues: `payment-webhooks`, `subscription-charges`, `booking-payment-charges` (each with DLQ via `MaxDeliveryCount`).
- **Promo CODES** (distinct from the promo grant): `IPromoCodeService.ValidateAsync` (cheap indexed lookup + every eligibility branch + discount math) / `RedeemAsync` (atomic global-cap `ExecuteUpdateAsync` + idempotent redemption row keyed by `IdempotencyKey`, concurrency-compensated). Flexible: percentage(bps)/fixed(minor+currency)/free-period, per-region/per-tier/per-purpose, global + per-user caps, validity window, first-time-only, min-amount, stackable. Gated by `PaymentSettings.PromoCodesEnabled`.
- **Flags + delivery:** `PaymentSettings` (server source of truth) → `AppConfigController` projects a **client-safe boolean subset** into `AppConfigDto.Payments` (secrets NEVER exposed — `[AllowAnonymous]`).
  ‼️ **AppConfig is the single point of failure for every paid surface in all four apps — treat it as such (2026-08-11).** The response is `Cache-Control: private, max-age=300` and **must never be `public`**: its `Access-Control-Allow-Origin` is per-origin, Front Door ignores `Vary`, and a shared cache that replays one origin’s CORS header to the next makes the browser block the read. `AddResponseCaching`/`UseResponseCaching` are **deleted from the API and Identity hosts** — the API host registered them BEFORE `UseCors`, so one entry was replayed across origins (proven: two requests with different `Origin` returned the SAME `X-Correlation-Id` + `Age`, and the replay lost `Vary: Origin` and `Access-Control-Expose-Headers`). AppConfig was the only cacheable route in either host, so nothing else loses anything.
  ‼️ **Client contract: a failed read is NOT “every feature is off”.** `loadAppConfigFlags`/`fetchAppConfig` return `{flags|config, ok}` in all four apps (partner web, customer web, admin web, both RN apps). On failure they return the **last known-good** read (sessionStorage on web, AsyncStorage on mobile, 24h max-stale) and `ok:false`; the provider exposes `degraded` and retries on a bounded backoff (2/6/15/45s) plus a `visibilitychange`/`online` revalidate. An unrecognised 200 body **throws** rather than normalizing to all-false. **A page must never redirect on `degraded`** — `VoiceAssistantPage` and the customer Payments page check it before evicting the user. Launch defaults: `Enabled=true`, `BillingUiEnabled=false`, `BillingChargesEnabled=false`, `AiAssistantEnabled=true`, `AiAssistantPaidEnabled=true`, `OnlineBookingPayEnabled=false`, `BookingDepositEnabled=false`, `PromoEnabled=true`, `PromoCodesEnabled=true`.
- **Health checks** (API host): `sql_billing`, `payment_gateway`, `payment_queues` (all Degraded — flag-off, non-critical).
- **Infra:** 3 SB queue resources in `events.json`; queue vars + function-app queue env-vars in `deploy.ps1`; `Payments`+`Stripe` sections in API + Functions `appsettings.json` (empty Stripe secret placeholders).

## Phase 1 — SHIPPED (provider-web gates + provider/admin billing UI + Cosmos audit; flag-hidden)
Builds clean (API/Infrastructure/Functions/Core/Shared, 0 errors); full API unit suite GREEN (4859 pass — new payments tests + 3 pre-existing P0 contract-test gaps fixed). At launch everything is flag-hidden (`BillingUiEnabled=false`) so the apps behave exactly as today; the promo grant makes everyone PremiumMax.

- **Enforcement gates** (all promo-aware via `EntitlementService`):
  - **Search boost** — `AzureSearchQuery.FuseResultsAsync` does `FusedScore *= doc.SearchBoostFactor` (1.0 = none); the search path uses ONLY this nudge (no 2nd re-order).
  - **Leads filter + priority** — `BroadcastMatchingService` appends `leadsEligible eq true` + orders the wave by `leadsPriority` (1 Max → 2 Premium → 3 Basic) before `AssignBatches`.
  - **WhatsApp tier cap** — `WhatsAppSendGate.ResolveProviderCapAsync` resolves `whatsapp_template_cap` via an `IServiceScopeFactory`-scoped `EntitlementService` (null/≤0 ⇒ unlimited Max; finite ⇒ that cap; Free/undefined ⇒ platform default); honors `UsageCapsEnabled` (off ⇒ allow).
  - **AI-text daily abuse cap** — `AIAssistantController.EnforceAiTextAbuseCapAsync` (durable `IUsageCounter`, `ai_text_daily_limit`, localized 429 `Error_AiTextDailyLimitReached`); honors `UsageCapsEnabled`.
  - **Banner re-order + badge/online-pay** — `Tier`/`IsVerified`/`IsFeatured`/`AcceptsOnlinePayments` flow `ServiceSearchDocument` → `ServiceSearchResultMapper` → `ServiceSearchResultDto` + `RecommendedProviderSearchResultDto`; `RecommendationSearchService.ApplyTierPriority` is a STABLE §6.1 pass (featured first, Max→Premium, recommendation order preserved within bucket) applied ONLY on the banner/recommendation path (`GetRecommendedProvidersCoreAsync`) — **no-op under promo**.
- **Tier projection** — `ITierProjectionService.ProjectAsync(businessId)` ETag-CAS-patches `BusinessProfile.{subscriptionTier,verificationStatus,isFeatured}` (new `IBusinessProfileRepository.TrySetSubscriptionProjectionAsync`; idempotent skip + bounded 412 retry); change feed reindexes. **P2 `ai_voice` add-on merge seam** marked in `EntitlementService.BuildAsync`. `EntitlementService.InvalidateAll()` busts the whole cache via a shared static change-token (admin config edits affect every provider in the region).
- **Audit (Cosmos-only, NO Parquet)** — `AdminConfigAudit` append doc in `SystemData` (pk `auditcfg_{region}`, TTL=`AuditLogRetentionDays`, 0⇒none) + `IAdminConfigAuditRepository` + `AdminConfigAuditService` (builds doc + serializes before/after + structured-logs with correlation id). Single audit lane; money truth stays in SQL.
- **Admin per-region config** — `AdminBillingConfigController` (`/api/v1/admin/billing-config`, `[Authorize(Roles=Admin)]`): CRUD `SubscriptionPlan` (PUT) + `Entitlement` (PUT per featureKey) + `AddOnProduct` (PUT) + `TopUpPack`/`PlatformFeeRule`/`PromoCode` (full CRUD; promos gated by `PromoCodesEnabled`) + audit list. **Region server-resolved from `PaymentSettings.AdminConfigRegion`** (us base; ca/in via the per-region appsettings layer) — never a client param; cross-region writes rejected; every mutation audited + `EntitlementService.InvalidateAll()`. DTOs: `clinqetshared/DTOs/Payments/AdminBillingConfigDtos.cs`.
- **Provider billing** — `ProviderBillingController` (`/api/v1/provider/billing`): GET `overview` (resolved tier + per-region plans/prices + AI add-on products + top-ups + entitlement summary + effective included AI minutes = `AddOnProduct.BaseMinutes` + tier `ai_voice_bonus_minutes`) + GET/PUT `payment-settings` (`OnlinePaymentsEnabled` + read-only Global fee + Connect placeholder + deposit "coming soon"). AI request/usage **reuse** the existing VoiceAssistant endpoints. `Service.AcceptsOnlinePayments` wired through `ServiceDto` + `ServiceMappingExtensions` (cascade `service ?? business`). DTOs: `clinqetshared/DTOs/Payments/ProviderBillingDtos.cs`.
- **Config** — `PaymentSettings.AdminConfigRegion` + the 3 P1 keys (`UsageCapsEnabled`/`AiTextCounterTtlSeconds`/`AuditLogRetentionDays`) mirrored in API + Functions appsettings (class defaults == appsettings).
- **Web UI (built + ESLint-zero, flag-hidden)** — AppConfig web client (`appConfigService.normalize` exposes the 6 `payments.*` flags via `useAppConfig()`); partner app billing page + dashboard plan card + payment-settings + per-service toggle + AI add-on card + themed upgrade modal (behind `BillingUiEnabled`; AI card behind `AiAssistantEnabled`; deposit "coming soon" while `BookingDepositEnabled` off) to `mockups/web-partner.html`; admin app tabbed per-region config editor + audit to `mockups/admin-config.html`.
- **Localization** — `Error_AiTextDailyLimitReached` + `Label_AcceptsOnlinePayments` in en/hi/gu (+ partner react-intl keys in all 4 locales). `fr/es/pa` are pre-existing platform-wide stubs → en-fallback.
- **Fixed pre-existing P0 gaps (§0.8)** — `ServiceBusService` now registers senders for the 3 payment queues (`payment-webhooks`/`subscription-charges`/`booking-payment-charges`) — was missing, would have failed `StripeWebhookFunction` sends; `AiUsageCounterRepository` + `AdminConfigAuditRepository` registered in the Cosmos composite-index contract map.

**‼️ DEPLOY/REINDEX:** the 7 new `ServiceSearchDocument` fields are auto-discovered by `FieldBuilder` + added non-breaking by `CreateOrUpdateIndexAsync` (cosmosindexsetup), BUT the index MUST be reindexed so docs get the promo-aware stamps — else `leadsEligible` filters out everyone + `searchBoostFactor` stays 1.0 (pre-prod: drop & rebuild).

**‼️ NULLABLE PROJECTION FIELDS (deserialization safety — do NOT revert to non-nullable):** the `ServiceSearchDocument` tier/payments value-type fields are nullable on purpose — `searchBoostFactor` (`double?`), `leadsEligible`/`isVerified`/`isFeatured`/`acceptsOnlinePayments`/`isListed`/`allowOnlineBookings` (`bool?`), `leadsPriority` (`int?`). Azure Search returns any field a document lacks as JSON `null`, so a doc indexed before a field existed deserializes that value type as null; a non-nullable `double`/`bool`/`int` makes the SDK converter throw (`Cannot get the value of a token type 'Null' as a number`) and fails the ENTIRE query — this took down `/discovery/recommended-providers`. The indexer always stamps a concrete value on write; read sites coalesce (`SearchBoostFactor ?? 1.0`, badges `?? false`, `TierLevel ?? "Free"`), so the fix is reindex-independent.

## Phase 2 — SHIPPED (charging engine + AI add-on/top-ups + tax Flow A + provider/admin UI)
Builds clean across Core/Shared/Infrastructure/API/Functions; full API unit suite GREEN (4885; +26 new payment tests); Functions VoicePostCallProcessor suite GREEN (101). **`BillingChargesEnabled` flipped TRUE** — safe because the scheduler skips $0/promo subscriptions (the promo grant makes tiers free; only AI add-ons/top-ups bill, which providers explicitly purchase).

- **Gateway seam extended:** `IPaymentGateway` += `RetrieveVaultedPaymentMethodAsync` (re-reads the confirmed SetupIntent, expand=payment_method), `DetachPaymentMethodAsync`, `GetPaymentIntentStatusAsync` (reconciliation). New contracts `VaultedPaymentMethodResult`, `PaymentIntentStatusResult`. Razorpay/Cashfree stubs still throw NotSupported.
- **Vaulting (Inc 2):** `IPaymentMethodService`/`PaymentMethodService` — resolve-or-create gateway customer per (business, account), SetupIntent, confirm→persist `PaymentMethod` (gateway token + last4 + brand only; NEVER PAN/CVV), default management, detach. `ProviderBillingController` endpoints: POST `setup-intent`, POST `payment-methods/confirm`, GET `payment-methods`, PUT `payment-methods/{id}/default`, DELETE `payment-methods/{id}` (per-controller in-memory sliding-window rate limit, mirror of CartController).
- **Money primitive (Inc 3):** `IBillingChargeService`/`BillingChargeService` — idempotency-FIRST (insert Pending `BillingTransaction` keyed by IdempotencyKey BEFORE the gateway call), tax computed + FROZEN on the row, off-session charge, finalize Succeeded/Failed. Returns typed `BillingChargeOutcome` (`BillingChargeStatus` Succeeded/Declined/InFlight/NoPaymentMethod/Error). Reads the default vaulted method as the single source of truth.
- **Recurring engine (Inc 3, OUR Function App):** `ISubscriptionBillingService`/`SubscriptionBillingService` — `GetDueItemsAsync` skips $0/promo subscriptions (add-ons bill regardless of promo); `ProcessChargeAsync` charges idempotently (deterministic per-period/per-attempt keys) + runs the dunning state machine (decline → PastDue + grace + bounded `RetryOffsetsDays` retries → after `MaxDunningAttempts`/grace → downgrade to Free), RowVersion-guarded; add-on renewal re-grants + re-projects minutes. Functions `SubscriptionBillingSchedulerFunction` (TimerTrigger `%SubscriptionBilling:TimerSchedule%`) + `SubscriptionChargeProcessor` (`%ServiceBusSettings:SubscriptionChargesQueueName%`, manual settlement, dead-letter on final retry). `SubscriptionChargeMessage` DTO. `IRecurringBillable` shared by ProviderSubscription + ProviderAddOn. **Functions health checks added:** `sql_billing` + `payment_queues`.
- **Minutes (Inc 4/5):** `IMinuteLedgerService`/`MinuteLedgerService` — Grant/TopUp idempotent on BillingTransactionId; cap = SUM(IncludedGrant+TopUpPurchase+Adjustment) for the period; `ProjectCapToVoicelineAsync` resolves e164 from `BusinessProfile.VoiceAssistant.AssignedNumber` → atomic PATCH `VoicelineRepository.TrySetMonthlyMinuteCapAsync`; config-gated rollover (included don't roll, top-ups do). `IAiAddOnService`/`AiAddOnService` — PurchaseAddOn (charge → activate `ProviderAddOn` → grant minutes → project cap → `EntitlementService.Invalidate` → reuse VoiceAssistant provisioning request + best-effort SetModelTier), PurchaseTopUp, SetAutoRecharge, ProcessAutoRechargeIfNeeded (loop-guarded by `AutoRechargeMonthlyCapMinor`), ProcessPostCallBilling (80% MinutesLow + auto-recharge + MinutesExhausted). Metering site `VoicePostCallProcessorFunction.AccumulateUsageAsync` wired: `VoiceCall:RoundUpUsageToWholeMinute` rounding + the post-call billing hook. New Voiceline fields `LowBalanceNotifiedMonth`/`ExhaustedNotifiedMonth` + claim methods.
- **Tier lifecycle:** `ISubscriptionService`/`SubscriptionService` — Subscribe/change (charge-first)/Cancel(atPeriodEnd) + `ProviderBillingController` subscribe/cancel; re-projects entitlements + Cosmos tier.
- **Webhooks live + reconciliation (Inc 6):** `PaymentWebhookProcessor.ApplyAsync` mirrors payment_intent.*/charge.refunded/charge.dispute.created/account.updated + acknowledges setup_intent.*/invoice.* (self-managed billing ⇒ no Stripe invoices). `IPaymentReconciliationService`/`PaymentReconciliationService` + `PaymentReconciliationFunction` (TimerTrigger; re-reads stuck Pending/Processing via `GetPaymentIntentStatusAsync`, repairs SQL, admin-alerts unresolved). **Stripe KV secret wiring in `deploy.ps1` SUPERSEDED 2026-07-06** (gateway credentials are now strictly OPT-IN deploy parameters — see the 2026-07-06 section) + the 3 payment queues in `events.json`.
- **Notifications + receipts (Inc 7):** new `NotificationType` SubscriptionCharged/SubscriptionPaymentFailed/SubscriptionDowngraded/AiAddOnActivated/MinutesLow/MinutesExhausted/MinuteTopUpPurchased/RefundProcessed → added to `SignalRSettings:EnabledNotificationTypes` (Main API) + a `BillingPayments` `PreferenceCategory` (mandatory-email). `IBillingNotificationService`/`BillingNotificationService` resolves provider-business recipients through `IBusinessCommunicationDispatcher`; localized title/body and template data are rendered for each resolved recipient. Mandatory email is enforced centrally from `CommunicationPreferenceConfig` and cannot be disabled by a producer's `SkipEmail`. `QuestPdfService.GenerateBillingReceiptPdfAsync` (tax line) downloaded on demand via GET `provider/billing/transactions/{id}/receipt` (QuestPDF Community license + `IPdfGenerationService` registered in the API host). 8 EN email templates under `Resources/EmailTemplates/en/` (per platform en-fallback convention). Localization `Notification_*`/`TaxLabel.*`/`Error_*`/PDF receipt keys in en/hi/gu.
- **Tax Flow A applied (Inc 8):** every subscription/AI/top-up charge taxed via `ITaxCalculationService` (TaxAppliesTo per type) with `TaxAmountMinor`/`TaxRateBps`/`TaxLabel`/`TaxInclusive`/`TaxJurisdiction` frozen on `BillingTransaction`. Admin Tax tab CRUD on `AdminBillingConfigController` (`tax-rules`, region server-resolved + audited). Provider Flow-B tax controls GET/PUT `provider/billing/tax-settings` (PaymentConfig). **Flow-B booking-time application is P3 behind the §7 approval gate.**
- **UI (Inc 9):** partner web — `@stripe/stripe-js` + `@stripe/react-stripe-js`, live embedded Elements checkout in UpgradeModal (SetupIntent → confirm → subscribe / AI purchase; 3DS/SCA, Apple/Google Pay, ACH, "Secure payment", tax line), AI add-on + top-up + auto-recharge, billing history + receipt download, payment-methods management, provider tax settings; admin web — Tax tab CRUD. `billingService.js` + `url.js` + react-intl across all 4 locales. ESLint zero.
- **Config (Inc 10):** `Voice:RoundUpUsageToWholeMinute` (false), `SubscriptionBilling`/`PaymentReconciliation` timer sections (Functions), `RollOverIncludedMinutes`/`RollOverTopUpMinutes`/`MinutesLowAlertThresholdPercent`/`ReconcileStaleMinutes`/`ReconcileBatchSize`/`StripeTaxRegions` in Payments (API + Functions), **`BillingChargesEnabled=true`** (class default + both appsettings).

**P3 carry-forwards:** Flow-B booking-time tax application (⛔ §7 MANDATORY APPROVAL GATE) · Stripe Connect Express onboarding (US/CA) + booking pay (vault → capture T-24h → transfer 2d-after-completion) + customer checkout UI + Customer Payments page · refunds/disputes · mobile (P4/P5) · India (P6) · smart analytics (P7).

## Phase 3 — SHIPPED (customer→provider booking pay via Stripe Connect, US/CA; flag-OFF)
Builds clean (Core/Shared/Infrastructure/API/Functions); full API unit suite GREEN (**4903**; +18 Flow-B unit tests) + **3 real-SQL integration tests** (booking double-charge guard, transfer idempotency, Flow-A double-charge carry-forward) via Testcontainers. `OnlineBookingPayEnabled=false` at launch ⇒ the whole flow is inert (apps behave exactly as today). **Flow-B tax §7 gate was pre-approved 2026-06-27 — built per the approved provider-control model.** Booking pay is ALWAYS **separate charges & transfers** (manual-capture hold/vault on the platform → explicit transfer later; the PaymentIntent NEVER sets a destination).

- **Gateway seam (Inc 1+4, superseded by the 2026-07-14 payout model):** `CapturePaymentIntentAsync` · `CancelPaymentIntentAsync` (void a hold) · `PayProviderAsync` · `RefundAsync` · `RetrieveConnectedAccountAsync` · `CreatePaymentIntentRequest.SetupFutureUsage` · `PaymentIntentStatusResult.{CustomerId,PaymentMethodId,AmountReceivedMinor}` · `ChargeOffSessionRequest.TransferGroup`. The old Stripe-shaped `ReverseTransferAsync` seam is deleted; provider recovery after payout uses the provider ledger.
- **Connect onboarding (Inc 2):** `IProviderConnectedAccountService` (Express create + hosted onboarding link [URLs: `QRCode.PartnerBaseUrl` + `PaymentSettings.Booking.Connect{Refresh,Return}Path`] + live status sync on return, RowVersion-guarded; `IsBookingPayReadyAsync`=Connect leg of the gate). `account.updated` webhook mirrors charges/payouts/details→Status. Endpoints `provider/billing/connect/{account,onboarding-link,status}` replace the P1 "NotConnected" placeholder; partner PaymentSettings UI ships the "Set up payouts" redirect (ESLint-clean).
- **Cosmos model (Inc 3):** `Booking.{Payment(BookingPaymentInfo),AllowOnlinePayment,CustomerConfirmedCompletedAt,ProviderConfirmedCompletedAt}` + `CustomerBooking.Payment(BookingPaymentMirror)` (lean display mirror per storage-map §2) + `BookingPaymentStatus` enum + `PaymentConfig.TaxLocked`. The single **3-level gate** = `IBookingPaymentGate` (flag AND business `OnlinePaymentsEnabled` AND per-booking `AllowOnlinePayment` AND Connect ChargesEnabled). NO new SQL migration (BillingTransaction already carries BookingId/ConnectedAccountId/ApplicationFeeMinor/transfer+refund ids/tax cols).
- **Orchestrator (Inc 4, current contract):** `IBookingPaymentService` — Initiate (gate → gateway+Connect → Flow-B tax → idempotency-first Pending `BookingCharge` → hold/vault); Confirm; Capture; Transfer through the single `IProviderPayoutService`; Refund only while the platform still holds the money. `UnwindOnCancelAsync` may void only an `Authorized` hold. A captured cancellation opens the dispute path and never auto-refunds; a transferred booking can never be system-refunded. Provider recovery after payout is an explicit `ProviderLedger` debt, never a gateway clawback. Booking-pay mutations are ETag-CAS on the Cosmos booking; SQL remains money truth.
- **Processor + hooks (Inc 5):** `BookingPaymentChargeProcessor` on `booking-payment-charges` (capture|transfer|complete|unwind|invoice-transfer; DLQ + FailureNotificationHelper admin-alert on dead-letter). `BookingService` emits a guarded signal (Payment!=null) at Completed/Cancelled/NoShow/Rejected; `BookingAutoCompletionProcessor` signals complete (providerInitiated=false ⇒ payout holds until provider confirms). `PaymentWebhookProcessor` += amount_capturable_updated / charge.captured / transfer.* / payout.* / dispute.* (back-stops Confirm via PI metadata `purpose`; admin-alerts disputes/payout-failures; marks invoices Paid). Reconciliation skips long-Pending booking holds (not stuck — awaiting capture by design).
- **Invoice pay-link (Inc 6):** `IInvoicePaymentService` (metadata-PaymentIntent → public `/invoices/{n}/pay`; immediate charge → webhook mark Paid + PaymentInfo → scheduled `invoice-transfer`). `InvoiceService` sets `Invoice.PaymentLink` on create/send when the business gate allows; QuestPDF Pay-now block + email Pay-now button (both unpaid-only).
- **Notifications/admin (Inc 7):** 7 new `NotificationType` → `SignalRSettings:EnabledNotificationTypes`. Customer-personal payment outcomes remain on `ICommunicationDispatcher`; provider-facing financial outcomes and `ProviderTaxOverridden` resolve business recipients through `IBusinessCommunicationDispatcher`. Admin per-provider tax view/override/**lock** on `AdminBillingConfigController` (`providers/{businessId}/tax`) — audited (AdminConfigAudit) + fires ProviderTaxOverridden (in-app+SignalR+push, deep-links the provider tax page); provider tax edit returns 403 when locked. en/hi/gu keys for all.

**‼️ DEPLOY:** P1 search index reindex (tier/online-pay fields) STILL PENDING (pre-prod: drop & rebuild). Flip `OnlineBookingPayEnabled=true` (+ providers complete Connect + set Stripe keys/webhooks) to go live.

## Carry-forwards (do in the named phase)
- **Stripe KV-secret deploy wiring** in `deploy.ps1` → **✅ DONE in Phase 2** (SUPERSEDED 2026-07-06: strictly opt-in parameters, nothing auto-seeded).
- **Charging engine** → **✅ DONE in Phase 2** (`SubscriptionBillingSchedulerFunction` + `SubscriptionChargeProcessor` + dunning; `EntitlementService` merges active `ProviderAddOn`→`ai_voice`; `BillingChargesEnabled` flipped true with the $0/promo skip guard).
- **AI add-on purchase** → **✅ DONE in Phase 2** (`AiAddOnService` PurchaseAddOn grants `ai_voice` + best-effort `Voiceline.ModelTier` + `MinuteLedger`→`Voiceline` cap projection; top-ups + auto-recharge).
- **Pending SQL migration** (`ProviderAddOn.ModelTier` + auto-recharge fields; `ProviderSubscription.CancelAtPeriodEnd` + `GrandfatheredUntil`) → **✅ DONE in Phase 2**.
- **Mobile** AppConfig payments consumption → **P4** (provider info-only) / **P5** (customer in-app pay).
- **Promo-code checkout apply UI** → P2 (subscription) / P3 (booking). The atomic redeem path needs real SQL ⇒ integration-test it then (InMemory can't run `ExecuteUpdate`).
- **Integration tests** for the new admin-config + provider-billing HTTP paths (`ClinqetApiFactory`/Testcontainers) — recommended CI gate; unit coverage (against the real seeded catalog) is comprehensive.

## Gotchas
- Fully-qualify Stripe service classes (`global::Stripe.CustomerService` etc.) — the solution has clashing `CustomerService`/`ProductService`.
- The Functions SB-trigger binding `%ServiceBusSettings:PaymentWebhooksQueueName%` reads raw config → the queue name MUST be an env var (deploy.ps1), not just the options-class default.
- `EnumToStringConverter`/`HasConversion<string>()` for all enum columns; `CurrencyCode` is nvarchar(3).
- `DbContextFactory` (not the scoped bridge) for services that may run concurrently (EntitlementService, PromoCodeService, processors).
- Migration regeneration: `dotnet-ef migrations remove` then re-add WITHOUT `--no-build` (a stale compiled assembly still contains the removed migration).

## Phase 3-UI — SHIPPED (2026-06-27): customer + admin WEB booking-pay UI (flag-gated off)

Wired onto the shipped P3 backend; `Payments.OnlineBookingPayEnabled=false` ⇒ every surface renders nothing + no hot-path call.

- **User app (`clinqetwebuserapp`):** new AppConfig consumer (`services/appConfigService.js`, `context/AppConfigContext.jsx` → `useOnlineBookingPayEnabled`/`useAppConfigLoaded`, wired in `components/common/Providers.jsx`); `lib/stripeClient.js` (per-key memoized `loadStripe`; key from initiate response); `services/bookingPaymentService.js` (auth via shared client; anonymous guest/invoice via bare axios); reusable `components/customer/payments/TrustSeal.jsx` (themed shield-check badge — never the 🛡️ emoji, the §8 standard) + `BookingPaymentSheet.jsx` (initiate→`@stripe/react-stripe-js` Elements with `clientSecret`+`publishableKey`→`confirmPayment`/`confirmSetup`→confirm→refetch status; all states; wallets; tax line; no vendor name).
- **Surfaces:** Booking-detail Pay-now + Mark-complete (`app/(customer)/bookings/[id]/page.js`); guest `app/booking-pay/[bookingId]/page.js?b={businessId}`; invoice `app/invoices/[number]/pay/page.js?b={businessId}`; Customer Payments `app/(customer)/settings/payments/page.js` (reuses `Booking.payment` mirror from the existing list — no new list endpoint) with flag-gated nav (`useVisibleNavGroups`). **No cart pay step** (locked model = post-confirmation only).
- **Admin (`clinqetwebadmin`):** `pages/dashboard/ProviderPaymentsPage.jsx` — per-provider tax view/override/lock + read-only refunds/disputes; route `/provider-payments` + nav.
- **Backend additions (tested):** authed `GET booking-payments/{id}/receipt` (booking PDF, PAID stamp); admin `GET admin/billing-config/refunds-disputes` (+`AdminRefundDisputeDto`); `InvoicePaymentService` pay link now carries `?b={businessId}`. Unit `InvoicePaymentLinkTests` GREEN; real-SQL integration `RefundsAndDisputes_Query…` added (Docker to run).
- **Localization:** 38 `payments.*` keys en/hi/gu + ja-fallback. ESLint-zero both apps; .NET API builds clean.
- ‼️ **Carry-forward:** P1 search index reindex STILL pending. Mobile customer pay = P5 (native sheet); provider mobile info-only = P4.

## Phase 4 — SHIPPED (provider MOBILE RN info-only Plan/AI + compliant web hand-off; flag-gated invisible)
Provider mobile app `clinqetmobilepartnerapp` ONLY (React Native, React Navigation v7, i18next en/gu/hi, `useTheme`/`AppTheme` tokens, fetch-based `apiClient`). **Info-only + flag-gated**: with `BillingUiEnabled=false` the app looks exactly like today. Jest **102/102 GREEN**; all P4 files ESLint-zero (RN shared config). **Backend untouched** (mobile is read/inform only).

- **Compliance (App-Store/Play digital-goods) — the central rule:** NO payment SDK (`@stripe/*`/IAP), NO price/buy/checkout/booking-pay/top-up, NO payment-vendor name, NO `/billing` link. The ONLY outbound action is "Open the Clinket web app" → `PARTNER_HOSTING_URL/dashboard` (a neutral website link, never a checkout). AI enrollment (pay / start the AI trial) is **web-only** — the provider-mobile AI card's not-enrolled action opens `.../dashboard` to enroll (there is NO in-app `request-access`; enroll runs `AiAddOnService.EnsureProvisioningAsync → VoiceAssistant.EnrollAsync`, `NotInvited → Invited`). The customer booking-pay/checkout surface NEVER appears in the provider app (that is P5). 05/06-compliance docs are authoritative.
- **AppConfig consumer (new):** `src/services/appConfigService.ts` (`GET /api/v1/app-config` → typed `PaymentClientFlags`, **all-OFF on any non-2xx/parse/network error**) + `src/context/AppConfigProvider.tsx` (`useAppConfig()` → `{ payments, loaded, refresh }`; fetch-once in memory, mirror of CurrencyProvider), mounted in `App.tsx`.
- **Billing overview (price-free):** `src/services/billingOverviewService.ts` `getProviderPlanSummary(force?)` projects `GET /provider/billing/overview` to tier NAME + benefit booleans and **DROPS all price fields** (`priceMinor`/`monthlyPriceMinor`/`topUps`) at the mapping boundary. 5-min in-memory cache + in-flight dedupe shared by the Profile badge + Plan screen.
- **UI:** `src/components/ProBadge.tsx` (tier-NAME chip, never a price) + `src/Util/tierDisplay.ts`; `src/Screen/ProfileFlow/PlanAndBilling/{index,style}.tsx` (plan card = tier name + benefit checklist or generic fallback; AI card = reuse `getVoiceAssistant`/`requestVoiceAccess`, coarse states none→"Request" / requested→"Open AI setup" / active→"Manage" routing to the existing VoiceAssistant screen; web hand-off card). Wired into `ProfileScreen` (gated "Plan & Billing" row + gated PRO chip, BOTH behind `billingUiEnabled`) + `MyDashboard-Route` + `navigations.PLANANDBILLING`.
- **Config:** new client env `PARTNER_HOSTING_URL` (env.ts/.env/.env.example/react-native-config.d.ts + apiManager/constant) — host already exists in infra (`partner[-region][.env].clinket.com`), **NO ARM/deploy.ps1 change** (mobile `.env` is build-time). Endpoints `AppConfigAPI`, `ProviderBillingOverviewAPI`.
- **Localization:** `PLAN_AND_BILLING.*` (25 keys) + `PROFILE_SCREEN.PLAN_AND_BILLING` in en/hi/gu (real).
- **Edges:** offline/fetch-fail → flags OFF (hidden); flag flip mid-session → hides; AI none/requested/active/rejected; overview fail → generic fallback (no chip, no price); foreground-return (`AppState 'active'`) → re-sync flags + forced fresh read; no duplicate AppConfig/overview calls.
- **Tests:** 2 new unit suites (`__tests__/appConfigService.test.ts`, `__tests__/tierDisplay.test.ts`) + **fixed a pre-existing broken suite** `refreshToken.test.ts` (stale `tokenManager` mock missing `getKeepMeSignedIn`; proven failing on the clean baseline, unrelated to P4).
- **‼️ Carry-forwards:** P1 search index reindex STILL pending; the RN app has **NO ESLint config file** (`npm run lint` broken repo-wide, pre-existing) + large pre-existing lint debt; set per-region `PARTNER_HOSTING_URL` in CI. **Customer MOBILE in-app pay = P5** (native sheet). See the new `clinqet-provider-mobile` skill.

## Phase 5 — SHIPPED (customer MOBILE RN in-app booking pay via native sheet; flag-gated invisible)
Customer mobile app `clinqetmobileuserapp` ONLY (React Native 0.78, scheme `clinket://`, React Navigation v7, i18next en-US/gu-IN/hi-IN/ja-JP, `useTheme`/`AppTheme` `brandGreen #97EF29`, fetch-based `apiClient` that returns the PARSED envelope). Built on the shipped P3 backend — **backend untouched**. `OnlineBookingPayEnabled=false` at launch ⇒ no Pay surface renders and **no `initiate`/status call fires** (app identical to today). New jest suites **26/26 GREEN**; all new files ESLint-zero + tsc-clean.

- **Compliance (INVERTED vs P4 — real-world service ⇒ in-app native pay is REQUIRED, 0% store fee):** the device **native payment sheet** via `@stripe/stripe-react-native` PaymentSheet (Apple Pay / Google Pay / card) — NEVER web Elements, NEVER a browser hand-off. Optional + post-confirmation only. Trust seal = a **native `react-native-svg` shield-check vector in a green badge** (NEVER the 🛡️ emoji; the localized copy carries no emoji and no payment-vendor name — "Secure payment"). Publishable key + client secret come from the `initiate` response (never embedded). No PAN/CVV stored/logged (tokenized in the sheet).
- **AppConfig consumer (new):** `src/services/appConfigService.ts` (`apiClient.getWithoutHeaderUrl(app_config_url)` → typed `PaymentClientFlags`, all-OFF on any error, strict `=== true` coercion; consumes the parsed `{data:{payments}}`/`{payments}` envelope) + `src/context/AppConfigProvider.tsx` (`useAppConfig()` → `{ payments, loaded, refresh }`, fetch-once + in-flight dedupe), mounted in `App.tsx`.
- **Service:** `src/services/bookingPaymentService.ts` — `initiateBookingPayment`/`confirmBookingPayment`/`getBookingPaymentStatus` against the shipped `booking-payments/{id}/initiate|confirm` + GET `{id}` (authed only). Endpoint builders in `apiManager/constant.tsx` (`app_config_url`, `booking_payment_initiate_url`/`_confirm_url`/`_status_url`).
- **Pure logic (unit-tested):** `src/utils/bookingPayState.ts` (`resolvePayPhase` flag→status→canPayOnline ⇒ hidden|payable|paid|refunded; `shouldQueryPayment` gates the status fetch to post-confirmation states) + `src/utils/paymentFormat.ts` (`currencyExponent`/`minorToMajor`/`formatMinor` — minor-unit math + the shared `formatCurrency`). Tests `__tests__/{bookingPayState,paymentFormat,appConfigService}.test.ts`.
- **UI:** `src/components/payments/TrustSeal.tsx` (full + compact, native shield-check) + `src/components/payments/BookingPaymentSection.tsx` — fetches status on focus + return-from-background (`AppState 'active'`, single-flight), `resolvePayPhase` decides: **payable** (total + trust seal + Pay now → `initiate` → lazy `import('@stripe/stripe-react-native')` → `initStripe`(per-intent key) → `initPaymentSheet`(payment|setup intent, Apple/Google Pay) → `presentPaymentSheet` → `confirm` → refetch) / **paid** (receipt summary: amount, method, held note) / **refunded** / **hidden**. States: loading, payable, processing, paid, already-paid, declined, 3DS-SCA (in-sheet), sheet-cancelled (silent), not-payable (hidden), offline/error (fail-safe hidden). Wired into `src/screen/bookings/BookingDetailScreen.tsx` after Payment Details.
- **Config/dep:** `STRIPE_APPLE_MERCHANT_ID` in `src/config/env.ts` (Apple Pay row only; entitlement set at native build); `@stripe/stripe-react-native@^0.45.0` added (loaded lazily so it is inert while the flag is off).
- **Localization:** `PAYMENTS.*` (17 keys) in en-US + hi-IN + gu-IN (real) + ja-JP (en-fallback per the file convention). No hardcoded copy, no vendor name.
- **Scope decisions:** anonymous/guest + public-invoice pay are NOT in the mobile app (it has no anonymous-booking surface; off-platform customers pay via the shipped WEB invoice PDF link `/invoices/{n}/pay?b=`). No client deposit selector (server sends a single `amountMinor`; `BookingDepositEnabled=false`).
- **‼️ DEFERRED — native build verification:** `@stripe/stripe-react-native` is a native module needing `pod install` (iOS) / Gradle (Android) + an on-device PaymentSheet run + the Apple Pay merchant entitlement in Xcode — NOT done in this Windows session (no Mac/device). Code is written + JS-verified (lint/tsc/jest green); the on-device pay run must happen on a build machine.
- **‼️ Carry-forward:** P1 search index reindex STILL pending. India go-live = P6; smart analytics = P7. See the new `clinqet-customer-mobile` skill.

## Phase 6 — SHIPPED (2026-06-28): India go-live on Cashfree via the seam (backend GA + web UPI UI; flag-OFF)
- **Gateway = Cashfree** (user "Cashfree only"; cheapest transparent MDR + Easy Split + native idempotency/HMAC). Razorpay stays a `NotSupportedPaymentGatewayBase` stub (documented future alt). Resolver `MapRegion`: **IN → (Cashfree, India)**. Built ENTIRELY behind the seam — **ZERO region branching** in BillingChargeService/SubscriptionBillingService/BookingPaymentService/tax/entitlements.
- **‼️ Backend = REST, NOT the `cashfree_pg` SDK** (it's sync-only, news a RestClient per call/socket churn, bundles Sentry/RestSharp, pins api-version → violates CLAUDE §10/§11). `CashfreePaymentGateway` (`Services/Payments/Cashfree/`) calls Cashfree REST via the named **`"cashfree"` HttpClient** registered in BOTH hosts' `Program.cs` with a Polly retry pipeline (5xx/408/429/network, exp backoff + jitter, pooled handler; base `https://{sandbox|api}.cashfree.com/pg/`, config timeout). Frontend DOES use the official SDK (`@cashfreepayments/cashfree-js`).
- **Money:** `long` minor (paise) ⇄ Cashfree **decimal rupees** (÷100) at the adapter boundary ONLY; every mutating POST sends `x-idempotency-key` (deterministic GUID from our key). Headers `x-client-id`/`x-client-secret`/`x-api-version`.
- **Method map (REST):** order create `POST /orders` (hold = manual capture; card pre-auth is account-level) → `clientSecret`=`payment_session_id`, `PaymentIntentId`=`order_id`; capture/void `POST /orders/{id}/authorization` {CAPTURE|VOID}; status = GET order + GET `/orders/{id}/payments` → seam vocab; refund `POST /orders/{id}/refunds` (rupees, explicit amount); transfer = Easy Split `POST /easy-split/orders/{orderId}/split` (orderId via transfer metadata); vendor `POST|GET /easy-split/vendors`; e-mandate = ON_DEMAND subscription `POST /subscriptions` (→ `subscription_session_id`) + off-session `POST /subscriptions/pay` {CHARGE}.
- **Webhook seam normalized (ALL impls):** `IPaymentGateway.ConstructWebhookEvent(payload, headers, secret)` + `InterpretWebhook(ev) → PaymentWebhookInterpretation{Kind,…}`. **`PaymentWebhookProcessor` is now gateway-AGNOSTIC** (switches on `PaymentWebhookKind`, ZERO `if gateway==`; Stripe parsing moved into `StripePaymentGateway.InterpretWebhook`, behavior-preserved). New `CashfreeWebhookFunction` (`payments/cashfree/webhook/{account}`, HMAC-SHA256(`timestamp+rawBody`, key=clientSecret) base64 vs `x-webhook-signature`) → same `payment-webhooks` queue.
- **RBI e-mandate:** `MandateStatus` enum + `PaymentMethod.{MandateId,MandateStatus,MandateMaxAmountMinor}` (migration `AddPaymentMandateFields`). **Data-driven** off-session guard in `BillingChargeService` (non-Active mandate ⇒ fail closed as NoPaymentMethod, gateway-agnostic — Stripe cards have null MandateStatus). Async UPI charge ⇒ adapter returns `ChargeResult.FailureCode="pending"` ⇒ row stays **Pending** (webhook resolves; no false decline/dunning). India vaulting passes provider email/phone/returnUrl via SetupIntent metadata (`PaymentMethodService` enriched, gateway-agnostic).
- **DTO discriminator:** `BookingPayInitiateResponseDto.{gateway,region}` + `BookingPayInitiation.Gateway`; Cashfree session id reuses `clientSecret`; publishableKey null for Cashfree. **Fixed:** the 3 hardcoded `Gateway = PaymentGateway.Stripe` rows in `BookingPaymentService` now use `resolution.Context.Gateway`.
- **Config/secrets:** `Cashfree` appsettings (API+Functions); `deploy.ps1` Cashfree secret wiring (SUPERSEDED 2026-07-06: strictly opt-in parameter); reuses `payment-webhooks` (no new Azure resource). `PaymentGatewayHealthCheck` reports `cashfree_in_configured`. India config (INR plans/add-ons/top-ups + 18% GST inclusive) already seeded; AI minutes = same tier structure (India covers COGS via higher INR price).
- **WEB UI:** `clinqetwebuserapp/lib/cashfreeClient.js` + UPI-first `CashfreeForm` branch in `BookingPaymentSheet.jsx` (Cashfree `_modal` checkout; **no Apple Pay**; green theme + TrustSeal; no vendor name); `payments.upi.*` en/hi/gu/ja; `CASHFREE_MODE` runtimeConfig; `@cashfreepayments/cashfree-js@^1.0.7`. ESLint-zero.
- **Tests:** `CashfreePaymentGatewayTests` (16: money/HMAC/interpret/pending/fail-closed) + resolver IN→Cashfree + `BillingChargeService` mandate-guard/async-pending — **28 unit GREEN + 9 real-SQL integration GREEN**.
- **‼️ Carry-forwards / post-P6 fixes:** Mobile India UPI (Cashfree RN) is now **BUILT + JS-verified** (tsc/eslint/jest; `orderId` added to the initiate DTO + `BookingPayInitiation`, `react-native-cashfree-pg-sdk`+`cashfree-pg-api-contract` deps, `CASHFREE_ENVIRONMENT` env, ambient `src/types/cashfree-pg.d.ts`, `BookingPaymentSection` gateway branch `payWithCashfree` [CFDropCheckoutPayment, callback-driven], PAYMENTS.UPI_* locales) — only the native `pod install`/Gradle on-device run remains (developer's Mac, with the P5 native build). Flow-B-India edges fail-CLOSED+flagged (post-transfer split clawback = refund `refund_splits`; Easy Split vendor KYC onboarding UI; invoice link — all OFF); P1 search reindex STILL pending; external = Cashfree onboarding + e-mandate legal + live-traffic flip.
- **Config fixes (post-P6, user-caught):** (1) the P2 timer triggers `%SubscriptionBilling:TimerSchedule%` / `%PaymentReconciliation:TimerSchedule%` are **host-resolved** ⇒ were unbound (sat only in the worker `appsettings.json`, which the Functions host doesn't read) → moved to `local.settings.json` Values + `deploy.ps1` app-settings (BOTH blocks, matching Recommendation/Search/DeviceToken); removed the orphan `TimerSchedule` from `appsettings.json` + both options classes (functions read only `Enabled`). (2) Removed dead `Stripe.India` config (India = Cashfree) from `StripeSettings` + 4 consumers (`StripePaymentGateway.AccountFor`, `StripeWebhookFunction` route, `BookingPaymentController.PublishableKeyFor`) + `appsettings.json` (API+Functions) + the `deploy.ps1` Stripe loop.
- P7 = Smart Analytics (closes the chain).

> **Payments Phase 7 (Smart Analytics / "Insights") is SHIPPED** — see the `clinqet-smart-analytics` skill. It CONSUMES the analytics pipeline read-only (a dedicated `ProviderInsightsParquetReader`, the existing producers/reader unchanged) and the search index (price/rating benchmark), and is the final phase of the payments chain (P0→P7 complete).


---

## PHASE 8 (SHIPPED) — Lead expansion + lead-volume caps (see clinqet-quote-lead-broadcast skill)
- **`leads_quota` entitlement** added (monthly act-on cap; per-region seed at the time Free 5 / Basic 25 / Premium 100 / Max `null`=unlimited — since v12 Free 5 / Premium `null`; migration `AddLeadsQuotaEntitlements`). Resolved via `EntitlementService` like every other entitlement; honors `PromoEnabled` (Max ⇒ unlimited) + `PaymentSettings.UsageCapsEnabled` (off ⇒ inert).
- **Counter** = atomic Cosmos SystemData `LeadUsageCounter` (`leadusage_{businessId}_{yyyyMM}`, pk=businessId, `PatchOperation.Increment`, TTL `PaymentSettings.LeadUsageCounterTtlSeconds`) behind the dedicated `ILeadUsageCounter` (NOT the AiText `IUsageCounter`, to avoid DI ambiguity) — mirrors `AiUsageCounter`. New `UsageMeter.Leads`.
- **Enforcement** = `ILeadAccessGate` (in clinqetinfrastructure/Services/Broadcast) at the leads act-on step; consumed once per (provider,broadcast) via `BroadcastProvider.leadUsageConsumedAt`. Fail-OPEN on blip; fail-CLOSED (403 `Error_LeadMonthlyLimitReached`) at/over quota. DI in `PaymentServiceRegistration`.
- **Delivery** (Approach F tier-step + never-starve floor) is broadcast-side — see the quote-lead skill. No new container, no new SB queue, no deploy.ps1/ARM change.

---

## PHASE 9 (AUDIT + FIXES, 2026-06-28) — see memory `payments-phase9-audit.md`
Exhaustive 7-lens audit of P0→P8 (multi-agent, adversarially verified) found **3 blocker / 39 major / 85 minor**; suites all green at audit time (API unit 4978, integration 15, ESLint 0, mobile jest 102+26). Invariants PASS (no cross-partition, analytics-SACRED, P2-trap fixed ×3 timers, promo "==today", separate-charges&transfers, webhook idempotency, Cashfree money).

**Fixed + tested this round:** B1 auto-recharge dead in Function host (`IVoiceAssistantService` unregistered → `ProcessAutoRechargeIfNeededAsync` now takes `knownUsed/knownCapMinutes`); B2 add-on-renewal redelivery double-grant (already-charged branch now passes the existing succeeded txn id so the ledger dedups); B3 invoice payout dead-lettered (operation-aware guard in `BookingPaymentChargeProcessor`); #10 payment-method GET/default/remove flag-gated; #9 `ConfirmSetupIntent` row lookup `BusinessId`-scoped; #6 non-Active e-mandate defers ~1d (no dunning burn) (‼️ superseded 2026-09-26 — overdue from day one, see *Overdue payments — settle first*); #24 `GetBroadcastAsync` no lead-quota burn on a dead broadcast.

**‼️ Cashfree booking-pay seam RE-ARCHITECTED (gateway-agnostic):** routing no longer sniffs Stripe id prefixes (`pi_`/`seti_`). `BookingPaymentInfo.IntentKind` ("hold"|"vault") is set at initiate and Confirm/Capture/Refund key on it via `IsHoldIntent`/`IsVaultIntent` (prefix fallback only for pre-IntentKind rows). Initiate metadata now carries customer email/name/phone for the Cashfree e-mandate vault path. ⇒ India (Cashfree `ord_`) booking-pay capture/vault/refund now work. **Remaining India-vault edge:** e-mandate async-"pending" mandate activation via webhook (Confirm currently leaves it unconfirmed until a later retry).

**REMAINING (batched, in progress):** admin region scoping (#5 guard + #4 `BillingTransaction.Region` migration), #7 period-drift, #13 rollover over-credit (needs `Voiceline` prior-month usage), #12 $0/promo grant idempotency, zero-decimal money fmt, #15 tax admin alert, #14 en-only billing notices, #16/#27 recon alerts, #23 tier-step partial-schedule recovery, #28 stranded-funds = **auto-release-to-provider-after-N-days (user-approved)**, smart-analytics (#29/#22/#30/#35), full UI batch, config/dead-code, SQL unique-index migrations (#8 + B2 minute-ledger), missing money/SB tests (§0.8). **VERDICT: CONCERNS** — prod safe today; fix remaining + run the still-pending P1 reindex before flipping OnlineBookingPay/India/BillingUi.

---

## Native free trial + billing-history pagination + billing UI redesign (UI-improvements Part 2)

Three shipped, compiling FLOW-A items. The trial engine is **dormant until billing go-live** (gated off; `Trial.Enabled=false`); UI/pagination ship live behind the existing `BillingUiEnabled` flag.

### 1) Native free trial engine (Flow A — no gateway $0 charge)
- **Schema:** new nullable columns on **both** `ProviderSubscription` AND `ProviderAddOn` (`clinqetcore/Entities/SQL/`): `TrialEndsAt` (`DateTimeOffset?`), `TrialDaysGranted` (`int`), `TrialReminderSentAt` (`DateTimeOffset?`). Migration `20260629155559_AddSubscriptionTrialFields` is **purely additive** — no catalog/`Region`/`HasData` touched (preserves the §P9 caveat). Status reuses the pre-existing `SubscriptionStatus.Trialing` (already in every `LiveStatuses` set incl. `EntitlementService` ⇒ a Trialing row already grants the paid tier's entitlements).
- **Config:** `PaymentSettings.Trial` (`TrialSettings`: `Enabled=false`, `PlanTrialDays=30`, `AiTrialDays=30`, `PlanRequiresPaymentMethod=false`, `AiRequiresPaymentMethod=false`, `FirstTimeOnly=true`, `ReminderLeadDays=3`, `RegionOverrides` map) + `PaymentSettings.ResolveTrial(region)` → `ResolvedTrial` record (`TrialRegionOverride` overrides fall back to the global field-by-field). Mirrored in BOTH `appsettings.json` "Payments" blocks (`clinqetapi/Clinqet.API` + `clinqetfuncations/Clinqet.Communications`).
- **START** (`SubscriptionService.SubscribeAsync` + `AiAddOnService.PurchaseAddOnAsync`, both now inject `IPaymentMethodService`): a trial is the **alternative to charging the first period** — starts only when it WOULD otherwise charge AND is trial-eligible. Plan trials are dormant under `PromoEnabled` (`wouldCharge` requires `!Promo`); AI trials apply even under promo (AI bills under promo). On start: `Status=Trialing`, `TrialEndsAt=now+days`, `NextChargeAt=TrialEndsAt`, NO gateway charge. AI trial also grants included minutes via the ledger on a synthetic `trial_{biz}_{tier}_{period}` key (idempotent). A tier change mid-trial keeps the trial (no charge). `FirstTimeOnly` ⇒ one trial per product ever (any row with `TrialDaysGranted>0` blocks a new one).
- **END** (reuses the existing scheduler — NO per-provider job): `SubscriptionBillingService.GetDueItemsAsync` also enqueues `Trialing` rows past `TrialEndsAt` (add-ons always; subs only when `!Promo`) under the same charge Kind; `ProcessChargeAsync` branches on `Status==Trialing` → `EndSubscriptionTrialAsync`/`EndAddOnTrialAsync`: card on file ⇒ charge → Active (conversion, reuses `ChargeVaultedAsync` + `FinalizeAddOnRenewal`); no card ⇒ graceful downgrade (`DowngradeSubscriptionAsync`/`DowngradeAddOnAsync`, entitlements drop); decline ⇒ standard dunning. Idempotent + RowVersion-guarded (a redelivered conversion finds the succeeded `sub_{id}_{period}_` charge and just finishes the transition — no double-charge).
- ‼️ **SUPERSEDED 2026-10-02 — see "Trial reminders and trial messages" at the end.** **REMINDER:** `SubscriptionBillingService.ProcessTrialRemindersAsync` (called from `SubscriptionBillingSchedulerFunction` in the same daily timer). Stamps `TrialReminderSentAt` under a RowVersion CAS BEFORE dispatch (once-only), within `(now, now+ReminderLeadDays]`. New `NotificationType.SubscriptionTrialEndingSoon` (added to `SignalRSettings:EnabledNotificationTypes` in Main API appsettings; localized Title/Body in en/gu/hi — fr falls back to en, matching existing billing-notif coverage; en email template `SubscriptionTrialEndingSoon.json`). Conversion reuses `SubscriptionCharged`; no-card end reuses `SubscriptionDowngraded`.
- **Overview DTO:** `ProviderBillingOverviewDto.Trial` (`ProviderTrialInfoDto`: enabled / planTrialDays / aiTrialDays / requires-card flags, planEligible/aiEligible, planStatus/planTrialEndsAt/planTrialDaysLeft, aiStatus/aiTrialEndsAt/aiTrialDaysLeft, aiTrialPriceMinor) populated in `ProviderBillingController.GetOverview`.

### 2) Billing-history keyset pagination
`ProviderBillingController.GetTransactions` is now keyset-paginated (cursor = base64(createdAt|id) via new `Clinqet.Shared.Helpers.BillingTransactionCursor`), BusinessId-scoped, ordered `CreatedAt DESC, Id DESC` (binds the existing `(BusinessId,CreatedAt)` index — NO new index/migration). Returns `BillingTransactionPageDto` { items, nextCursor, total, hasMore }. Default page size 20, max 100.

### 3) Web billing UI redesign (`clinqetwebpartnerapp`)
- `src/components/billing/Billing.jsx` is now full-width responsive (no narrow max-width; plans 4-across; a 2-column zone below — LEFT AI+TopUp / RIGHT Payment+History — that stacks AI→TopUp→Payment→Billing on mobile). The AI-text benefit moved into the FREE plan card (`billing.tier.free.b5`).
- Top-up = an **inline minute picker** (no modal) in `src/components/billing/TopUpAutoRechargeSection.jsx` — selectable chips (2-up phone / 4-up sm+) + a "Pay {price} · add {minutes} min" button; the auto-recharge toggle now surfaces what it will buy via `billing.ai.autoRechargeActive` (see the 2026-06-29 white-space batch below). `src/components/billing/BillingHistorySection.jsx` is now Load-more paginated with loading/empty/error/all-loaded states + "Showing X of Y".
- New shared `src/utils/money.js` (`formatMoney` + `trialDurationLabel`; `Billing.jsx` + `src/components/billing/AiAssistantUpsellCard.jsx` refactored onto it). New `src/components/Profile/voiceAssistant/AiSetupPricing.jsx` adds AI pricing + plan cross-sell to the AI setup page (gated `billingUiEnabled`+`aiAssistantPaidEnabled`, self-fetch, hides when AI active).
- Trial strikethrough UI (was→CA$0, "Free for {duration}, then {price}/mo", "No charge today · no card required", "Start free trial", active-trial countdown banner). New localized keys (`billing.trial.*`, `billing.topup.*`, `billing.history.showing`/`loadMore`/etc., `voiceAssistant.pricing.*`) in all 4 lang files (en-US/hi-IN/gu-IN/ja-JP) with full parity; removed orphans `billing.aiText.*` + `billing.ai.topUp`/`autoRecharge`/`optional`.

**Mobile partner app (`clinqetmobilepartnerapp`) stays Phase-4 info-only** — AI Assistant naming + richer non-price bullets only; NO trial/price on mobile.


## Billing notification overhaul + card-removed→Free fix (Part 3, 2026-06-29)

- `BillingNotificationService` rewritten: resolves provider contact (email + WhatsApp), wires all channels, product/card-aware copy, raises at-risk admin alerts. `BillingNotification` record gained `Product`, `HasPaymentMethodOnFile`, `AdminAlertOverride`, `Fields`.
- `SubscriptionBillingService`: downgrade/dunning are reason+product aware — cancel-at-period-end ⇒ `SubscriptionCanceled`; trial-end-no-card ⇒ `SubscriptionTrialEnded`; payment-fail ⇒ `SubscriptionDowngraded`. Now injects `IPaymentMethodService` for the card-aware trial reminder (card→renewal reminder, no card→add-card CTA).
- **Card-removed→Free fix (§3E):** renewal `NoPaymentMethod` is data-driven on `outcome.FailureCode` — `mandate_not_active` (India e-mandate pending) DEFERS (‼️ superseded 2026-09-26 by `AwaitMandateAsync` — overdue from day one, no attempt burned, Free after the grace; see *Overdue payments — settle first*); any other (`no_payment_method` = card removed/expired) routes to dunning → Free + `BillingPaymentMethodMissing` admin alert. Trial-end mirrors this (pending mandate extends the trial; else graceful downgrade). `SubscriptionService.CancelAsync` (immediate) now fires `SubscriptionCanceled`.
- New flag `Payments:AdminAlertOnBillingRisk` (default true) in `PaymentSettings` + both appsettings (class default mirrors).


## Partner-web white-space + responsive UI refinements (2026-06-29)

User ask: remove the wasted side-gutters on several partner pages, fill the width with VALUE (not stretch), stay fully responsive (iPad/phone block-mode, important-first), keep it simple/modern/on-theme. **All frontend-only** — NO backend change. (Auto-recharge is already fully built: an inline post-call check in `AiAddOnService.ProcessAutoRechargeIfNeededAsync` that off-session-charges the saved card for the provider's chosen pack when minutes hit 0, monthly-cap + idempotency guarded — there is NO separate timer/Function for it.) Verified: `next build` exit 0 (all routes), ESLint zero on the 5 components, all 4 locales valid (39 keys added, 7 orphans removed, placeholders intact).
- **AI included-minutes (`Billing.jsx`):** the flat "Free 100 / Basic 150 / …" slash line → a 4-chip **tier ladder** (`grid-cols-2 sm:grid-cols-4`) with the provider's own tier highlighted green + "✓ Your plan", plus a `{max}`-driven upgrade nudge. New keys `billing.ai.includedMinutesLabel` / `yourPlanChip` / `moreMinutesNudge`; removed `billing.ai.includedMinutes`.
- **Top-up (`TopUpAutoRechargeSection.jsx`):** modal removed → inline chip picker; auto-recharge clarity line. New `billing.topup.minLabel` + `billing.ai.autoRechargeActive`; removed `billing.topup.modalTitle` / `summaryTitle` / `summaryOption` / `chargedTo` + `billing.ai.topUpButton`.
- **Payments settings (`Profile/PaymentSettings.jsx`):** dropped the `max-w-[560px]` cap → full-width `xl:grid-cols-[1.5fr_1fr]` — LEFT = Payments + Tax; RIGHT = a "Get paid" progress checklist (derived from `onlineOn`/`isConnected`, reuses `handleSetupPayouts`) + a "What your customer sees" Trust-Seal (lucide `ShieldCheck`, no emoji) preview. New `paymentSettings.rail.*` (14 keys). Mobile stacks settings-first (payout CTA is in the Payments card at the top).
- **Insights empty state (`insights/InsightsView.jsx`):** the lone grey sentence → a tier-aware "getting ready" preview — KPI + section placeholders + 3 activation actions (→ `ManageServicesPrice` / `SetAvailability` / `AiAssistant`) + the existing free-tier upgrade card. New `Analytics.Empty.*` (20 keys); removed `Analytics.Empty`. The *populated* state was already full-width — unchanged.
- **Voice promo (`Profile/voiceAssistant/VoiceAssistantPromo.jsx`):** `max-w-[920px]` → `w-full max-w-[1280px]` (a readable cap, deliberately NOT full-bleed — long lines hurt readability on 4K) + the hero demo card capped `max-w-[460px] mx-auto`. No copy/logic change; applies to both Call Follow-ups and the Profile AI tab.

## AI auto-recharge: pre-emptive + failure alerts (2026-06-29)
`AiAddOnService` auto-recharge upgraded: (1) **pre-emptive** -- fires when projected remaining <= `PaymentSettings.AutoRechargeAtRemainingMinutes` (config, default 15; appsettings API+Functions; 0 = legacy at-zero), surfaced to the billing UI via `ProviderAutoRechargeDto.AtRemainingMinutes` on the EXISTING GetOverview payload (no new endpoint). (2) **daily self-heal idempotency key** `autorecharge_{biz}_{period}_{spent}_{yyyyMMdd}` -- same-day redelivery dedups at the unique index (no double charge); a new UTC day re-keys so a fixed card retries once/day instead of staying stuck on the cached decline. (3) `ProcessAutoRechargeIfNeededAsync` returns typed `AutoRechargeOutcome` {NotConfigured, NotNeeded, Recharged, ChargeFailed, MonthlyCapReached, ChargePending} (was bool); only ChargeFailed notifies. (4) new `NotificationType.MinuteAutoRechargeFailed` (email/in-app/push/WhatsApp via `BillingNotificationService`; once/month `Voiceline.AutoRechargeFailedNotifiedMonth` CAS claim) + `AdminAlertType.BillingAutoRechargeFailed`; the "minutes low" nag is suppressed when auto-recharge is engaged. Which-pack is deterministic (`ProviderAddOn.AutoRechargeTopUpPackId`, provider pre-selected). WhatsApp template `clinket_ai_autorecharge_failed` -- see the clinqet-whatsapp skill + memory `ai-autorecharge-preemptive-and-failure-alerts`.

## Payments Part 2 — Phase B multi-product PROMO engine (armed-code model) — SHIPPED (2026-07-01)
The recurring, multi-product "internet-plan-style" discount engine. A code covers a SET (`PromoCode.AppliesToCsv` of `Subscription,AddOn,TopUp` [+`Booking` forward-compat]) with `PromoCodeDurationType {Once, Repeating[+DurationInPeriods], Forever}` (string enum). Behind the existing flags; apps behave as today when off.
- **State (SQL, no new container):** `ProviderAppliedPromo` = the provider's ARMED preview (charges nothing); `ProviderPromoBinding` = the COMMITTED recurring discount (FROZEN discount snapshot, `RemainingPeriods` counting down via a `LastAppliedPeriod`-gated reconcile [exactly-once per period, redelivery/crash-safe], `Status` Active→Completed at 0, one ACTIVE per (BusinessId,AppliesTo) via `UX_ProviderPromoBinding_Business_Product_Active`); `PromoCodeTarget` = the targeted-audience child table. `BillingTransaction` gained `PromoCodeId/PromoCode/DiscountAmountMinor/GrossBeforeDiscountMinor`. Migration `AddPromoBindingLastAppliedPeriod` (additive, §P9-safe).
- **`IProviderPromoService`/`ProviderPromoService`** owns ALL promo-at-billing logic: `ArmAsync`/`RemoveArmedAsync`/`PreviewAsync`/`GetStateAsync` (controller) + `ResolveChargeDiscountAsync` (Active binding first, else armed code re-validated at pay) + `CommitRecurringChargeAsync` (after success AND on the already-charged replay branch) + `ResolveArmedAtPurchaseAsync` + `ReconcileBindingForPeriodAsync` + `DeactivateBindingAsync`. `PromoDiscountMath` = the SINGLE shared discount-math source (% + fixed; currency-mismatch → null), used by PromoCodeService AND the binding application.
- **Charge integration:** the discount rides `BillingChargeRequest.Promo` (`BillingPromoApplication`); `BillingChargeService` subtracts it PRE-tax, taxes the discounted net, freezes the promo fields, PERSISTS a real tx even at $0-after-discount ⇒ it emails a receipt (#12); a no-promo $0 (trial/grant) stays synthetic + un-receipted (A4). Wired into `SubscriptionBillingService` (plan+add-on renewal AND trial conversion, both fresh + replay; downgrade deactivates the binding), `SubscriptionService.SubscribeAsync`, `AiAddOnService.PurchaseAddOnAsync` + the prorated `ChangeAddOnTierAsync` (binding discount on the delta, NO period reconcile — item 20) + `PurchaseTopUpAsync` + `ProcessAutoRechargeIfNeededAsync` (top-ups = one-time per-purchase redeem, window-based, NO binding).
- **PAY-COLLECTS-ONLY-THAT:** each purchase resolves the armed code for THAT product only, re-validates at charge (invalid ⇒ full price), redeems (stable recurring key `promobind_{biz}_{product}_{codeId}`), and for recurring creates the binding — exactly one discounted payment + one receipt; a multi-product code NEVER combines charges; the armed row stays for not-yet-bought products. **Once a product's binding exists (Active OR Completed), the armed row no longer re-fires for it** (the binding owns the lifecycle; Completed term ⇒ full price — the F1 audit fix).
- **Endpoints:** POST `promo/validate` (live preview), POST `promo/apply` (arm; 409 overlap), DELETE `promo/applied/{id}` (remove — reverts preview, NEVER revokes a committed binding). `/overview` carries `promo{armedCodes,bindings,availableOfferCode}` + per-product `discountedPriceMinor`/`promoCode` — the whole page refreshes from ONE call; the preview mirrors the pay-time eligibility (min-amount + first-time + consumed-products) so a strikethrough never over-promises.
- **Receipt (`QuestPdfService`):** "Discount ({CODE})" line + a `promoNote` from the live binding; `PDF_Discount` key.
- **Admin (`AdminBillingConfigController` + `BillingConfigPage.jsx`):** promo CRUD with product checkboxes + duration + the **Audience selector** (Everyone/Specific partners → `targetBusinessIds` replace-on-save + `targetCount` + GET `promos/{id}/targets` + reject targeted-with-zero). `DISCOUNT_TYPES` matches the enum exactly. New `AdminAlertType.PromoCapExhausted` (both sides; raised once/code via cooldown). Activity log REUSES `AdminConfigAudit` (Cosmos, `AuditLogRetentionDays=2555` ≥1yr, container `DefaultTimeToLive=-1`).
- **UI:** provider `BillingPromoSection.jsx` (banner per armed code + Remove + the single code box + auto-surfaced offer + strikethrough on plans/AI/top-ups), 4 partner locales (39 `billing.promo.*` keys). Mobile stays Phase-4 info-only. NO WhatsApp for any provider-initiated promo event (restraint ruling).
- **Audit:** `payments-plan/PART-2-FINAL-AUDIT.md` (multi-agent, adversarially verified) — 8 findings, every confirmed one FIXED: F1 armed re-discount after binding completes (BLOCKER), F5 first-time-code losing its binding at commit, F2 preview↔pay mismatch, F7 admin discount-type enum mismatch, F3 offer eligibility, F8 dup `PDF_Discount`; F4 `Booking` scoped out of admin (no Flow-B charge path yet); F6 crash-window binding loss documented. **Green: API unit 5173/0, Functions 1364/0, real-SQL promo integration pass, partner+admin builds exit 0, ESLint clean.**


---

## BILLING OVERHAUL — PART 2 (annual billing + new prices + lifecycle fixes) — SHIPPED (2026-07-01)

The partner-billing overhaul (spec: `payments-plan/BILLING-OVERHAUL-PART2-PROMPT.md`; mockup: `payments-plan/mockups/billing-overhaul/index.html`).

### New LOCKED prices (`BillingCatalogDefinition.cs` — explicit tables, NO ×-derivations)
- **Plans (monthly minor):** ‼️ superseded by catalog v12 — Free 0 / Premium us 499 · ca 599 · in 29900. (Was us 0/900/2900/4900 · ca 0/1200/3900/6900 · in 0/19900/59900/119900 for Free/Basic/Premium/Max.)
- **AI add-on monthly:** Standard us 2400 / ca 3200 / in 149900 (unchanged); **Advanced EXPLICIT** us 3900 / ca 5200 / in 299900 (the ×1.6 derivation is deleted — also killed the "$38.4" UI bug at the source).
- **Top-up packs: sizes 100/200/350/500 ONLY** (50/250 are not new-install defaults; existing packs are managed by the admin, never retired by startup). Standard us 1400/2400/3700/4700 · ca 1900/3400/5200/6500 · in 89900/159900/259900/359900; Advanced us 2900/5200/8400/10900 · ca 4100/7400/11900/15500 · in 249900/449900/699900/899900. Per-minute price strictly decreases up the ladder (intentional: entry ~40% margin → 500-pack ~15–20%; India big Standard ≈ break-even — user-accepted).
- **`ai_voice_bonus_minutes` UNTOUCHED** (0/50/100/150 — the deliberate adoption hook). Locked-value unit tests: `BillingCatalogPricingTests`.

### Historical reconciler (superseded by insert-only initialization, 2026-09-23)
The current seeder only inserts missing rows. Neither restarts nor C# version increases replace existing admin values. Definition changes affect new rows/installations; change existing catalog values explicitly through the admin app. Disabling preserves a product; deleting a required default permits startup to recreate it. Redeploy API instances with the new shared library to apply this behavior.

### Annual billing (DERIVED — no annual catalog rows; the interval lives on the HOLDER)
> ‼️ Prices + settings rewritten 2026-10-05 (D15): yearly = 12 × monthly, always offered — see **Yearly billing** at the top.
- **Math:** `Clinqet.Shared.Helpers.AnnualPricing` is THE single source (`PriceFor`, `TermMonths`). Used by the controller display, first charge, and renewals.
- **Schema:** `ProviderSubscription.Interval` + `ProviderAddOn.Interval` (BillingInterval, string, SQL default 'Month') — migration `20260701231618_BillingPricingOverhaulAnnualInterval` (columns only; catalog prices propagate via the seeder reconcile).
- **Engine:** every charge derives from the HOLDER's interval (`sub.Interval`/`addon.Interval`); a Year term is `AnnualPricing.TermMonths`; `RefreshAddOnPriceCache` + `ProviderAddOn.PriceMinor` cache the ACTUAL billed amount (annual total for Year holders) so the due-filter/UI/resume-copy stay honest. A8 raises, dunning, trial conversions, prorated AI upgrades (both bases per-period: annual-derived for Year holders) and the Repeating-N promo reconcile (period keys ≥12 months apart) all flow through unchanged.
- **Purchase/switch:** `SubscribeAsync(..., interval)` / `PurchaseAddOnAsync(..., interval)`; idempotency keys now carry the interval (`subscribe_{biz}_{tier}_{interval}_{period}`, `addonpurchase_{biz}_{model}_{interval}_{period}`). **Same product + different interval on an active holder = SCHEDULED switch**: stamp the holder Interval effective next renewal, charge NOTHING, notify `SubscriptionPriceChangeScheduled` with the new interval-correct amount (its `/mo` hardcode was removed from all backend language bodies — required for annual honesty).
- **§2.5 grant tick (GAP FIX):** `SubscriptionBillingService.ProcessAnnualAddOnMonthlyGrantsAsync(now)` in the daily `SubscriptionBillingSchedulerFunction` sweep — every ACTIVE Year add-on whose current period covers now and whose month has NO IncludedGrant gets `RollOverIfConfiguredAsync(prev,period)` + `GrantIncludedAsync(..., "annualgrant_{addonId}_{period}")` + cap projection (#M3 re-resolution included; Trialing skipped — granted at start; DB-guarded by UX_MinuteLedger_Txn_EntryType).
- **API/DTO (additive):** per-plan/per-add-on `annualPriceMinor` (12 × monthly; null for a free plan) + `discountedAnnualPriceMinor` (only with an `AllowAnnual` promo) + `interval` on both holder-state DTOs; `interval` on Subscribe/PurchaseAddOn requests; key `Error_PeriodEnded`.

### Auto-renew lifecycle fixes (§3) + plan resume
- **Bug 1 FIXED:** plan `CancelAsync(atPeriodEnd:true)` kept `NextChargeAt=null` ⇒ `GetDueItemsAsync` NEVER picked it up (stranded paid-forever row). Now mirrors the AI path (boundary preserved); `AdvancePeriod`'s CancelAtPeriodEnd-null ternary removed.
- **Bug 2 FIXED:** `EndSubscriptionTrialAsync` ignored `CancelAtPeriodEnd` ⇒ a soft-canceled plan trial still CHARGED at trial end. Now downgrades without charging (mirror of `EndAddOnTrialAsync`).
- **New `SubscriptionService.ResumeAsync`** (mirror of `ResumeAddOnAsync`): idempotent, `period_ended` past boundary, notifies `SubscriptionAutoRenewalResumed` with the interval-correct amount. Endpoint `POST /provider/billing/resume`; web `ResumeSubscription()`.
- **Cancel now notifies at cancel time:** `SubscriptionAutoRenewalOff` (tier+date); immediate cancel keeps `SubscriptionCanceled`.
- **3 new NotificationTypes** (in-app+push+email, NO WhatsApp, all in `SignalRSettings:EnabledNotificationTypes`): `SubscriptionAutoRenewalOff`, `SubscriptionAutoRenewalResumed`, `AutoRechargePackUnavailable` — localized en/hi/gu (fr = documented en-fallback) + 3 EN email templates.
- **Trial per-product flags (§3.7):** `TrialSettings.PlanTrialEnabled`/`AiTrialEnabled` (default true) + nullable override twins + `ResolvedTrial` fields; gate ONLY new-trial starts (master `Enabled` stays the kill-switch; reminders keep running for existing trials).
- **§4 auto-recharge guard:** `ProcessAutoRechargeIfNeededAsync` pack lookup now requires `IsActive`; missing/retired pack ⇒ auto-recharge OFF + pack cleared + `AutoRechargePackUnavailable` notify + `NotConfigured` (never silently charges a retired pack).

### Web UI (partner `Billing.jsx` et al) — §5
Manage-plan strip replaces the "Current plan" banner (full §3.5 six-state matrix with plan copy, Update-card + secondary turn-off on PastDue, promo "Free now" chip preserved; simple info strip under promo/Free); AI state card now handles Trialing+renew-OFF explicitly ("Free until {date}. After that — it stops, no charge." + Turn back on + Finish setup), notes "Auto-recharge was turned off too", pill precedence Ending>Switching, PastDue gains a secondary Turn-off, interval-correct "/yr billed annually" copy, Top-up link REMOVED (the card sits below); included-minutes ladder is a flat NON-interactive muted strip ("Free 100 · … ▲ Your plan" — nothing lime/bordered); Monthly|Annual segmented toggle on the plans grid AND the AI enroll card (superseded 2026-10-05: always shown, defaults to Monthly, no mode chip — see **Yearly billing** at the top); trial banner has per-product SOFT cancel links ("Cancel plan trial" = `CancelSubscription(true)` ALWAYS, trial keeps running; "Cancel AI trial" = existing soft AI cancel); `money()` fixed (whole OR exactly 2 decimals — kills "$38.4") + `formatMonthlyEquivalent`; top-up copy is engine-aware; **promo box: ZERO network on typing** (debounced `ValidatePromo` + preview deleted from the client; the single Apply renders the server-localized reason inline; `/promo/validate` endpoint STAYS server-side); the enrolled holder's engine now drives the top-up/selector tier. Locale parity ×4 (en-US/hi-IN/gu-IN/ja-JP: 37 new keys, 22 orphans removed incl. `billing.promo.err.*` except `.invalid`).

### Tests
Unit: `BillingCatalogPricingTests` (locked book), `AnnualPricingTests` (12 × monthly), `BillingAnnualLifecycleTests` (derived charge, interval keys, scheduled switch, cancel-boundary, resume, per-product trial gates, AI annual, recharge guard ×2 in `AiAddOnServiceTests`), `SubscriptionBillingAnnualEngineTests` (holder-interval renewals, trial-end cancel branch, no-stranding due sweep, grant tick ×3), + 3 new `BillingNotificationServiceTests`. Integration (real SQL): `BillingAnnualIntegrationTests` — derived first charge + exactly-+1-year renewal with an A8 raise inside the derivation, grant-tick exactly-once on the real ledger, soft-canceled trial = no charge, resume→conversion single charge, Repeating-N decrements once per ANNUAL charge, seeder reconcile (old prices/50-pack retire/A8 survive/no-op re-run), Interval column default. Seeder/admin/AiAddOn suites updated to the new prices + reconcile contract.

### §9 extreme-audit fixes (3 adversarial agents; every confirmed finding fixed, 2026-07-01)
- **BLOCKER — interval switch vs in-flight charge**: the scheduled switch now REFUSES while the renewal is due or a current-boundary charge is Pending/Processing (`switch_pending`, `Error_SwitchPending`) — else the already-charged replay would advance a MONTHLY payment by a full YEAR (or vice versa). Also refuses on winding-down holders (`renewal_off`, `Error_RenewalOff` — mirrors `ChangeAddOnTierAsync`), and a same-tier+same-interval re-subscribe is now an idempotent no-op (never a second full charge).
- **Cached-decline lock**: `BillingChargeService` re-arms a FAILED row on key reuse (RowVersion-CAS'd, fresh gateway idempotency key `key:r{guid}` — the gateway replays cached declines for a reused key) so a fixed card retries the SAME purchase key instead of being locked out until the next period.
- **Stale-due guard**: `ProcessChargeAsync` completes without charging when the row is no longer due (`NextChargeAt > now`) — a queued message superseded by a fresh subscribe/defer/dunning re-schedule can't double-charge.
- **Cancel-boundary × async settlement**: the boundary deactivation defers on a Pending boundary charge and SERVES the period on a Succeeded one (advance via the already-charged guard; the next boundary deactivates) — never "money captured, service dropped".
- **Prorated upgrade promo double-count**: `ResolveCurrentPeriodAddOnBasisAsync` uses `GrossBeforeDiscountMinor` (pre-discount basis) so the binding discounts the delta exactly once.
- **Auto-recharge region check**: `SetAutoRechargeAsync` + the recharge lookup require `pack.Region == addon.Region` (deterministic ids made cross-region pack ids guessable).
- **Grant tick hardening**: per-holder try/catch (one bad row can't starve grants or the charge fan-out — the scheduler call is isolated too) + the renewal/purchase month is skipped (that month's grant is owned by the renewal path; redelivery heals a crashed one).
- **$0 renewal grants**: `FinalizeAddOnRenewalAsync` mints `zerorenewal_{addonId}_{period}` when there's no charge row so redeliveries dedup at the ledger unique index.
- **Overview trial eligibility** now honors `PlanTrialEnabled`/`AiTrialEnabled` + `BillingChargesEnabled` (the UI can no longer advertise a trial the backend would charge for). Plan lookup gained `IsActive`.
- **Promo-mode + $0 wind-downs sweep**: cancelling subs are enqueued even under `PromoEnabled`, and $0-cached cancelling add-ons are swept, so the promised boundary transition always fires.
- **A8-aware notices**: resume + interval-switch amounts use the pending price when it's effective by the boundary.
- **Web**: top-up section syncs its auto-recharge toggle to the refetched truth, refetches `/overview` after buy/toggle, and mints its idempotency key ONCE per checkout attempt (retries reuse it — the double-charge guard depends on that); trial-banner rows are renew-off-aware ("then it stops, no charge"); the stale-refresh banner copy is action-neutral (`billing.refreshStale`); Ending state outranks the PastDue pill (with Update-card kept as a secondary); plans-header toggle row wraps on narrow phones.
- **Consciously accepted at Part-2 close — three of these were SUPERSEDED by Part 3 (see the PART 3 section)**: ~~the seeder reverting admin LIVE catalog edits~~ (→ §3 versioned releases: DB is the runtime truth, definition raises A8-staged); ~~Repeating-N promo periods interval-agnostic at annual value~~ (→ §4 `AllowAnnual` gate, default false); ~~mid-period tier change forfeits the paid term~~ (→ §2 prorated upgrades + deferred downgrades). STILL accepted: calendar-month period anchoring on a FIRST subscribe (P9 #7 period-drift, pre-existing — a mid-month first subscribe pays the calendar month); the subscribe-vs-inflight-sweep race is narrowed by the stale-due guard but a sub-second window remains (pre-existing key-family split).


---

## BILLING OVERHAUL — PART 3 (plan tier proration + versioned catalog releases + promo annual gate) — SHIPPED (2026-07-02)

Spec: `payments-plan/BILLING-OVERHAUL-PART3-PROMPT.md` (user-locked options 1-A/2-A/3-A); mockup §7–8 in `payments-plan/mockups/billing-overhaul/index.html`. One additive migration `20260702030557_AddPlanPendingTierCatalogVersionPromoAllowAnnual` (ProviderSubscription.PendingTier nvarchar(20) NULL — dropped 2026-10-05 · CatalogVersionState table · PromoCode.AllowAnnual + ProviderPromoBinding.AllowAnnual bit NOT NULL default 0).

### §2 Plan tier proration — DELETED 2026-10-04/05

With two plans there is no paid-to-paid switch. `ChangePlanTierAsync`, the plan upgrade/downgrade dialogs, the
`SubscriptionUpgraded` notice and `ProviderSubscription.PendingTier` (migration `DropProviderSubscriptionPendingTier`, applied
CA + IN 2026-10-05) are gone. Still true from this section: the AI engine change (`ChangeAddOnTierAsync`) sizes its delta by
the RUNNING period's term (`IsAnnualPeriod`: end − start > 45 days), never the stamped next-renewal `Interval`.

### §3 Versioned catalog releases (DB = runtime source of truth)
- `BillingCatalogDefinition.CatalogVersion` (**const, currently 12** — v12 = two plans, 2026-10-04; at the time of this section it was 3; v1 = pre-Part-2 book; v2 = the Part-2/3 billing book; **v3 (2026-07-02) = Free tier gets leads**: `leads` enabled for ALL tiers, `leads_priority` Free=4 — applies once on next API start via `ApplyEntitlementRelease`). Future book change = edit tables + bump the const in the same PR. New single-row `CatalogVersionState` ("catalog", AppliedVersion, AppliedAt, RowVersion).
- `BillingCatalogSeeder` every start: inserts missing deterministic rows only. Existing rows are never updated or retired, even when the marker is missing or older. The catalog marker records the successfully inspected definition version; admin edits do not bump it. A newer database marker refuses older seeding code before writes. One SQL transaction and a transaction-owned application lock serialize seeders; lock wait is bounded by the database timeout. The execution strategy retries with a fresh context. Conflicts/errors roll back the whole seed and surface; no concurrency exception is silently swallowed. API startup still runs this seeder and invalidates entitlements when rows change.

### §4 Promo × annual gate (`AllowAnnual`, default FALSE)
- `PromoCode.AllowAnnual` + frozen `ProviderPromoBinding.AllowAnnual` (snapshot at bind; `ArmedAtPurchase.AllowAnnual` carries it). The gate = "this charge bills a Year interval for Subscription/AddOn": `ResolveBindingDiscountAsync` / `ResolveArmedAtPurchaseAsync` / `ResolveChargeDiscountAsync` / `ReconcileBindingForPeriodAsync` / `CommitRecurringChargeAsync` / `CommitAfterChargeAsync` all take `BillingInterval interval = Month`; when Year + disallowed ⇒ no discount AND **nothing consumed** (`Reconcile` returns true — the binding still owns the product, no armed fall-through; the armed row survives for a later monthly purchase). Interval flip = pause on Year / resume on Month, no cancellation. Every charge call site passes the holder interval (renewals, trial conversions fresh+replay, purchases, prorated upgrades); top-ups/Booking stay Month. Arming is ungated (the pay-time gate is the truth; overview previews stay monthly-basis). Admin promo CRUD + `BillingConfigPage.jsx` "Allow on annual billing" toggle (default off) persist + audit it.

### §7 extreme-audit fixes (3 adversarial agents; every confirmed finding FIXED — report `payments-plan/PART-3-FINAL-AUDIT.md`)
- **Unconsumed-boundary guards**: the interval-switch guard (plan + AI) now also treats a **Succeeded** boundary charge as unsettled while `CurrentPeriodEnd <= now` (the async-settled/crash window — a switch there let the replay advance a PAID period at the NEW interval).
- **First-period basis**: the fresh-subscribe charge has no `ProviderSubscriptionId` ⇒ the basis lookup falls back to the latest `subscribe_{biz}_`-keyed Succeeded charge this period (credits what was actually paid, not the drifted catalog).
- **Gate scale**: the §4 AllowAnnual gate on prorated upgrades rides the RUNNING period's scale (`periodIsAnnual`), matching the delta — never the stamped next-renewal interval.
- **A8 on upgrade bases**: the AI upgrade target + both catalog fallbacks use `EffectivePriceMinor`.
- **`ApiResponse.ErrorCode`** (additive envelope field): `ToResponse` carries the machine code there — `Errors` stays null so `showError` keeps showing the LOCALIZED message (an `Errors[0]` code was hijacking every billing toast); the web branches on `err?.errorCode` (add-card handoff closes the confirm first — no stacked modals/scroll-lock), and the AI `AI_CHANGE_ERROR_IDS` mapping reads `errorCode` (live for the first time).
- **Live paid holders never see trial CTAs**: server `PlanEligible` requires NO live row; `showTrial` excludes managed holders; paid holders' current card says "Current plan" (`billing.plans.current`).
- **Seeder:** SQL failures surface without pretending initialization succeeded.

### Top-up / auto-recharge UX follow-up (same session, user-requested)
The pack picker's default anchor is the SECOND pack in the sorted list (saved auto-recharge pack still wins; pay button follows the selection). Enabling auto-recharge now opens a ConfirmDialog stating the exact pack + price + trigger threshold (turning OFF stays instant); the picker never silently re-points an active automation — when the selection differs from the locked pack, an explicit one-tap "Switch it to {minutes} min ({price})" line re-points it. Keys `billing.ai.autoRechargeConfirm*` + `autoRechargeSwitchPack*` ×4 locales; mockup §5b.

### Verification (final, post-audit)
API unit **5304/5304** · API/payments integration **1070/1070** (real SQL — incl. planupgrade-redelivery single-charge, disallowed-annual full-price/no-decrement, upgrade-in-place seeder repair of the old-seeder dev-DB fingerprint, release-staged-raise→A8-promotion, AllowAnnual column default) · Functions unit **1374/1374** · Functions integration **347/347** · partner ESLint 0 + `next build` exit 0 · admin ESLint 0 + build exit 0 · 4-locale parity verified programmatically. Suites extended: `SubscriptionTierChangeTests` (new, incl. audit regressions), `SubscriptionBillingAnnualEngineTests` (+pending-flip), `ProviderPromoServiceTests` (+gate), `BillingCatalogSeederTests` (rewritten to the versioned contract), `BillingNotificationServiceTests` (+SubscriptionUpgraded), `BillingAnnualLifecycleTests` (+Succeeded-unadvanced switch guard), `BillingAnnualIntegrationTests` + `BillingCatalogSeederIntegrationTests` (rewritten).
---

## Flow-A publishable key paired with the SetupIntent + configurable Monthly/Annual default (2026-07-06)

Two provider-billing refinements; NO new endpoint, NO extra UI call.

- **Root-cause fix for "Payment is temporarily unavailable" on Add card (CA report):** the partner app keyed Stripe Elements off a SINGLE build-time `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — absent from the RUNNING bundle (webpack inlines NEXT_PUBLIC_* at `next build`; a later .env edit changes nothing until rebuild) and structurally wrong for a multi-region single build (US/CA = different Stripe accounts/keys). `AddCardModal` early-returned before ever calling the API and swallowed errors. **Final architecture (mirror of Flow-B booking-pay + the customer app):** the response that MINTS the client secret carries its account-matched key — `SetupIntentResponseDto` += `publishableKey`/`gateway`/`region`; `IPaymentMethodService.CreateSetupIntentAsync` now returns `SetupIntentCreation{SetupIntentId, ClientSecret, Gateway, Region}` (region from `resolution.Context.Account`, the SAME resolution that minted the intent — the overview entitlement region can diverge on the DefaultRegion fallback, so the key deliberately does NOT ride the overview); controller pairs `PublishableKeyFor(region)` (mirror of BookingPaymentController). `overview.payments {gateway, region}` (`ProviderPaymentsClientDto`) = server-authoritative LANE only (Stripe card sheet vs Cashfree UPI copy, pre-checkout). Client: `AddCardModal`/`UpgradeModal` are response-driven — always call setup-intent, branch on `response.gateway`, key = `resolveStripePublishableKey(response.publishableKey)` = serverKey || NEXT_PUBLIC_* fallback || "" ⇒ disabled (kept IDENTICAL to `clinqetwebuserapp/lib/stripeClient.js`); `AddCardModal` surfaces the server real error + `billing.pm.gatewayUnavailable` (en/hi/gu/ja) when no key resolves. **‼️ Ops:** `Stripe:UnitedStates` + `Cashfree:India` credentials are EMPTY placeholders in appsettings — only `Stripe:Canada` has (test) keys. **Deploy contract (user-locked 2026-07-06): gateway credentials are strictly OPT-IN** — `deploy.ps1` params `StripeUs|StripeCa{SecretKey,WebhookSecret,PublishableKey}` + `CashfreeIndia{SecretKey,AppId}`; a setting (API + Functions) and its vault secret are created ONLY when that param is passed non-empty (secrets → KV refs `stripe-{unitedstates|canada}-{secret-key|webhook-secret}` / `cashfree-india-secret-key`; `Cashfree__Environment` rides only with AppId); empty/omitted ⇒ NOTHING created and manually-set app config is never stomped. deploy.ps1 also gained a UTF-8 BOM (parses on PS 5.1 AND pwsh).
- ~~**`overview.annualBilling`**~~ — deleted 2026-10-05 (D15) with `PaymentSettings.AnnualBilling`. The Monthly|Annual toggle always defaults to Monthly.

## Trial tier-eligibility + top-up payment chooser + two-rule card save + receipt cache fix (2026-07-10)

Four shipped Flow-A changes (user-locked decisions 2026-07-10).

- **AI trial is tier-scoped:** `TrialSettings.AiTrialEligibleTiers` (`List<VoiceModelTier>`, default `["Standard"]`, nullable per-region override twin, rides `ResolvedTrial`; appsettings API + Functions). A NEW AI trial starts ONLY when the purchased engine tier is in the list (`PurchaseAddOnAsync`); an ineligible tier (Advanced by default) charges immediately — no one can trial Advanced directly. `overview.trial.aiTrialEligibleTiers` (string[]) drives UI gating — trial framing renders only for eligible tiers (`Billing.jsx` `aiTrialOffer`, `AiSetupPricing.jsx`, `VoiceAssistantPromo.jsx`).
- **Mid-trial engine switch (`AiAddOnService.ChangeAddOnTierAsync`, Trialing branch rewritten):** target ELIGIBLE ⇒ `ApplyTrialTierChangeAsync` — the trial and `TrialEndsAt` carry over UNCHANGED (never a fresh 30 days); `PriceMinor`/`Currency`/`IncludedMinutes` re-derived from the target catalog row NOW (fixes the stale "Then CA$32/mo while titled Advanced" display bug — the old branch flipped only `ModelTier`); minutes delta-adjusted; entitlements invalidated. Target INELIGIBLE ⇒ `EndTrialWithPaidTierAsync` — requires a default PM (`needs_payment_method`), charges the target's FULL interval price now (`AddOnCharge`, idemKey `aitrialupgrade_{businessId}_{tier}_{period}`, promo-aware + `CommitRecurringChargeAsync`), then Status=Active, TrialEndsAt=null, **TrialDaysGranted kept** (first-time gate ⇒ never a second trial, incl. cancel-and-repurchase), calendar-month period bounds (mirrors `PurchaseAddOnAsync`), minutes delta-only (no double grant in the trial's month), one `AiAssistantUpgraded` notify (the charge emails its own receipt). Declined/InFlight ⇒ the row stays Trialing untouched; a retry re-finds the succeeded charge (idempotency-first) and completes activation. Web: distinct end-trial confirm (`billing.ai.switch.endTrial*`, en/hi/gu) with discounted/annual-aware price.
- **Two-rule card save (user-locked):** subscriptions/plan/AI checkout keep vault→promote-default (the renewal instrument; disclosed by the TrustSeal). One-time top-ups: `IPaymentMethodService.ConfirmSetupIntentAsync(..., makeDefault:false)` (`ConfirmSetupIntentRequestDto.MakeDefault`, default true) — the card is SAVED but an existing chargeable default is NOT demoted (the first chargeable card still promotes so renewals work); `PurchaseTopUpRequestDto.PaymentMethodId` → `BillingChargeRequest.PaymentMethodId` charges THAT method via new `IPaymentMethodService.GetByIdAsync` (tenant-scoped; a foreign/inactive id fails closed as NoPaymentMethod). Auto-recharge + renewals still charge the default only.
- **Top-up checkout = ONE combined dialog** (`TopUpCheckoutModal.jsx`, Stripe lane): pack summary + the saved-card/new-card chooser. `SavedMethodCheckout` + `StripeCheckoutForm` + `isChargeableMethod` extracted to `src/components/billing/checkout/` — `UpgradeModal` consumes the same pieces (no duplication). New-card path: SetupIntent → confirmSetup → Confirm(makeDefault:false) → PurchaseTopUp(paymentMethodId) + a "card will be saved" note; no chargeable method ⇒ opens directly in new-card mode; saved-path `no_payment_method`/`needs_payment_method` flips to new-card. Cashfree top-up keeps the plain saved-mandate confirm (no one-time card on the mandate rail).
- **Receipt-download 500 root cause (2026-07-10):** `SellerTaxRegistrationService.GetActiveAsync` wrote a size-less cache entry under the SizeLimit'd shared `IMemoryCache` (API + Functions ⇒ broke receipt download AND the receipt email). Fixed with `MemoryCacheEntryOptions { Size = 1 }`; see the infrastructure skill's ABSOLUTE RULE — every `IMemoryCache` write MUST set `Size = 1`; enforced by `MemoryCacheSizeConventionTests` (Clinqet.API.UnitTests source scan).

### Audit hardening (same day)
- **Binder append trap:** `AiTrialEligibleTiers` class default is EMPTY (the .NET config binder APPENDS to a seeded list — a seeded Standard could never be removed via config and `["Standard"]` bound into `[Standard, Standard]`); `ResolveTrial` supplies the Standard-only fallback for unset/empty + `Distinct()`. Pinned by `TrialEligibleTiersResolutionTests`.
- **Cross-month minutes:** the trial's grant lives in its START month (the monthly tick skips Trialing) — `EndTrialWithPaidTierAsync` in a later month does rollover + a FULL tx-dedup'd grant (mirrors `FinalizeAddOnRenewalAsync`), same-month does the delta (tx-dedup'd via the new `AddAdjustmentAsync(dedupToken)`); `ApplyTrialTierChangeAsync` deltas only inside the grant month (tokenless — eligible switches repeat).
- **Double-charge guards:** the paid switch refuses when the trial is DUE (`TrialEndsAt <= now` ⇒ the scheduler's conversion owns it) or a conversion tx (`addon_{id}_{period}_`) is pending/succeeded → `switch_pending`; `DbUpdateConcurrencyException` after the charge re-applies onto the fresh row (never a re-charge). Scheduler side: `EndAddOnTrialAsync` CONSUMES a Succeeded `aitrialupgrade_{biz}_{tier}_{period}` tx (tier parsed from the key, price refreshed, `FinalizeAddOnRenewalAsync` with that tx id — covers India async settlement + crash-before-activation) and DEFERS while one is Pending/Processing.
- **`PaymentMethod.DefaultOnActivation`** (migration `AddPaymentMethodDefaultOnActivation`, existing rows default TRUE): stamped from `makeDefault` at confirm; the mandate-activation webhook promotes only when true (or nothing chargeable exists) — a one-time-purchase India mandate can no longer steal default on bank approval.
- Current-tier reselect during a trial is ALWAYS a free pending-clear (config narrowing can't route it to the paid path); empty-string `PaymentMethodId` = default-PM lookup with the right message.
- ‼️ Ops: run `dotnet ef database update` (AppDbContext) for the new column before deploy.

## Billing trust overhaul — checkout quote + immediate annual switch + tax book v4 + Replace-card removal (2026-07-11)

User-locked decisions: annual discount = 20% (superseded 2026-10-05 by D15: yearly = 12 × monthly, no built-in discount); checkout shows the **exact taxed total** pre-pay; monthly→annual = **IMMEDIATE credit-based upgrade**; annual→monthly = boundary; **Replace card button REMOVED** (Stripe-portal wallet pattern).

### ~~20% alignment~~ — superseded 2026-10-05 (D15)
The lesson stands: the Functions host renews, so every price input it reads must match the API host's. With
`AnnualPricing.PriceFor` = monthly × 12 there is no setting left to drift.

### Checkout quote (server-authoritative pre-pay preview)
- `POST /provider/billing/checkout-quote` (`CheckoutQuoteRequestDto{product: Plan|Ai|TopUp, tier?, modelTier?, interval, topUpPackId?}` → `CheckoutQuoteDto{kind, baseMinor, creditMinor, discountMinor, promoCode, netMinor, taxMinor, taxRateBps, taxLabel(LOCALIZED server-side), taxInclusive, totalMinor, currency, renewsAt, renewalAmountMinor}`). `BillingQuoteKind {Purchase, TrialStart, ProratedUpgrade, AnnualSwitchNow, Scheduled, NoChargeToday}`.
- Implemented as `ISubscriptionService.QuotePlanCheckoutAsync` + `IAiAddOnService.QuoteAiCheckoutAsync/QuoteTopUpAsync` — each MIRRORS its mutation's routing (fresh purchase / trial / tier-change delta / interval switch / scheduled) and reuses the SAME private basis/promo/tax helpers, so **quote == charge always** (`BillingCheckoutQuoteTests` parity suite). Side-effect-free (Resolve* promo calls are read-only). Null ⇒ UI falls back to catalog price + generic tax note (never blocks checkout).
- Web: `QuoteSummary.jsx` (base/−credit/−discount/tax/Total-today/renewal line; inclusive ⇒ "Includes GST (18%)") rendered in UpgradeModal + TopUpCheckoutModal + the switch/Cashfree ConfirmDialogs; ONE quote per modal open (rate-limited endpoint — never quote on keystroke/pack-tap). **Pay button = quote total; no-quote annual fallback = `annualTotalLabel`, NEVER the monthly-equivalent** (the "Pay CA$31.20 while charging CA$374.40" bug).

### Immediate monthly→annual switch (plan + AI; annual→monthly stays boundary-scheduled)
- Same-tier `SubscribeAsync(tier, Year)` / `PurchaseAddOnAsync(model, Year)` on a billed ACTIVE monthly holder now charges **`AnnualPricing.PriceFor(effective monthly) − round(currentPeriodBasis × remainingDays/periodDays)`** NOW and resets the period to now→now+TermMonths (`SwitchPlanToAnnualNowAsync` / `SwitchAiToAnnualNowAsync`). Money only flows IN — the unused-time credit offsets a bigger charge, never a refund.
- Idempotency keys `planannual_{biz}_{periodStart:yyyyMMdd}` / `aiannual_…`; tx types SubscriptionUpgrade / AddOnUpgrade (receipt-emailed); a replay after the stamps land hits the same-interval no-op; `DbUpdateConcurrencyException` re-applies onto the fresh row (never re-charges). Integration-proven (real SQL): single tx + replay no-op + AI **no IncludedGrant** (this month's grant already exists; the §2.5 annual tick owns months 2–12).
- Guards: `pending_change` (AI: `PendingModelTier` set — undo first), `past_due` (since 2026-09-26: any PastDue holder, refused at the top of `SubscribeAsync` — settle first), existing `renewal_off`/`switch_pending`/currency/no-PM; **a still-running ANNUAL period with Interval=Month ⇒ Year is a free stamp-back (undo)**, never a second annual charge; promo binding discount rides `BillingInterval.Year` (AllowAnnual gate); sub-floor/credit≥annual ⇒ falls back to the boundary-scheduled stamp. New `NotificationType.SubscriptionSwitchedToAnnual` (product-aware, in-app+push ONLY, in `SignalRSettings:EnabledNotificationTypes`). New DTO field `subscription/aiAddOn.periodIsAnnual` (running-period truth for the "Switching to monthly on {date}" pill + Undo).
- Web (`Billing.jsx`): "Switch to annual billing — {deal}" on ManagePlanStrip + AiAssistantStateCard (Active/Month); Year holders get "Switch to monthly billing" (Scheduled quote, "Nothing changes today"); amber switching-to-monthly line + inline Undo; errorCodes `past_due`/`pending_change` surface the server-localized message.

### Tax book v4 + the TaxRule index re-model
- `BillingCatalogDefinition.CatalogVersion = 4`: **NS HST 1500→1400** (real rate since 2025-04-01) + the combined provincial rows ENABLED by default (registered-everywhere posture, user-locked 2026-07-11): QC 1497 GSTQST (14.975% floored to int bps — never over-collect) · BC 1200 GSTPST7 · SK 1100 GSTPST6 · MB 1200 GSTRST; each keeps a DISABLED GST-only variant so de-registering is a two-toggle admin change. Labels carry the COMPONENT rates ('GST 5% + PST 7%') via `TaxLabel.GSTQST/GSTPST7/GSTPST6/GSTRST` — a provincial rate change means the admin edits RateBps AND the TaxLabel value together.
- **‼️ Index re-model (migration `20260711033235_RelaxTaxRuleUniqueIndexToEnabledRules`):** the old full-unique `(Region, SubdivisionCode, AppliesTo)` made the placeholder rows UNSEEDABLE on real SQL (caught ONLY by Testcontainers — InMemory can't enforce unique indexes; the §0.8 lesson again). Now `UX_TaxRule_Jurisdiction_Enabled` = filtered unique `WHERE [Enabled] = 1` — at most one ENABLED rule per jurisdiction, disabled variants coexist. Admin tax-rule create/update pre-checks 409 only on an enabled conflict ("Disable it first"). `ConfigTaxCalculationService.PickBestRule` is deterministic (equal specificity ⇒ HIGHER rate wins — a misconfig can under-disclose, never under-collect).
- **Tax registration, rates and enabled state are admin-owned.** Seeding inserts missing defaults only. A conflicting custom enabled jurisdiction rule causes an atomic failure instead of changing tax registration. Resolve the conflict explicitly before retrying.
- Tax display model CONFIRMED per-region: US/CA exclusive (US 0%+disabled until state registration), India 18% inclusive. NO global inclusive/exclusive appsetting — `TaxRule.TaxInclusive` is the (admin-editable) truth.

### Replace card REMOVED (user-locked; Stripe-portal wallet pattern)
Replace was a pure relabel of Add (vault + promote default; old card KEPT). Now: wallet only (Add card / Default badge / per-card Remove); one quiet server-localized line under the default card (`Label_BillingPmProtectedTitle/Hint` reworded); blocked-remove dialog CTA = "Add card"; `ProviderPaymentMethodProtectionDto.ReplaceLabel` + `Label_BillingPmReplaceCard` + `replace` prop DELETED. The last-chargeable-under-auto-pay delete guard is unchanged.

### Misc
- Billing-history rows now use `billing.history.type.{BillingTransactionType}` labels (raw enum names were leaking: "AddOnCharge"/"TopUpPurchase"). Auto-recharge consent dialog says "Plus any applicable tax."
- New failure codes on `ToResponse`: `past_due`→`Error_PastDue`, `pending_change`→`Error_PendingChange`; success `Success_BillingSwitchedToAnnual`; notification copy `Notification_SubscriptionSwitchedToAnnual_{Plan,Ai}_{Title,Body}` — all en/hi/gu.
- Partner app locales are en-US/hi-IN/gu-IN ONLY (no ja-JP in this app).
- ‼️ Ops: run `dotnet ef database update` (the TaxRule index migration) before deploy; the v4 tax release applies once on next API start (existing DBs get NS 1400 + the 4 disabled placeholders).


## Tier-limits UX + PROMO SUNSET cutover (Tracks A–F, 2026-07-11 sessions 1+2 — SHIPPED)

Plan `C:\Nik\TIER-LIMITS-UPGRADE-AND-CUTOVER-PLAN.md` (+ completion report inside); operator runbook `C:\Nik\PROMO-SUNSET-RUNBOOK.md`; locked owner decisions D1–D11 in `C:\Nik\TIER-UX-CUTOVER-HANDOFF.md` §2.

### Catalog v5 + WhatsApp usage surface (session 1 backend, session 2 UI)
- **CatalogVersion 5**: `whatsapp_template_cap` enabled for EVERY tier — Free **0 (blocked)** / Basic **50** / Premium **200** / Max **null (unlimited)**. Gate semantics: null=unlimited, 0=blocked (`WhatsAppSendDecision.PlanBlocked`), >0 finite; missing row/resolve blip ⇒ platform default 250.
- **`GET api/v{v}/provider/billing/whatsapp-usage`** (`ProviderBillingController`, `IWhatsAppSendGate.GetUsageAsync`) → `ProviderWhatsAppUsageDto {capsEnabled, unlimited, blocked, used, cap, remaining, periodKey}`. Promo/caps-off ⇒ `unlimited:true` ⇒ every meter renders nothing (launch invariant).
- **Meter UI**: web billing page (`UsageMeterCard idPrefix="billing.whatsapp.usage"`, blocked ⇒ `UpgradeNudge` "included from Basic", CTA = in-page `#billing-plans` anchor); web inbox at-limit strip above the composer (WhatsApp-channel threads only, lazy once-per-mount fetch, copy = provider's own alerts fall back to SMS/in-app, chat never limited); mobile Plan & Billing `UsageMeter keyPrefix="PLAN_AND_BILLING.WA_USAGE"` (info-only, no CTA — the plan cards are the upgrade path per D7) + blocked nudge row.

### PROMO SUNSET (Track E) — the one-time cutover off the launch promo grant

> ‼️ DELETED 2026-10-04 together with the promo grant: `PromoSunsetService`, `PromoSunsetSettings`, the founder codes,
> the `Sunset*` notices and templates, the AppConfig sunset fields, both banners and the deploy.ps1 parameters are gone.
- **Kept from it:** `ISystemMarkerRepository` (SystemData `SystemMarker`, point create-if-absent, no TTL) — it still dedupes the
  tier-limit admin alerts.
- **Gotcha:** `UserProfile.UserNumber` is `nvarchar(5)` UNIQUE — any test seeding partners must use ≤5-char business ids.

## Promo × billing deep review — armed-on-upgrade + annual strikethrough + promo-usage alerts (2026-07-12)

Full promo/billing interaction review (owner-locked decisions); backend + partner-web UI shipped together. Migration `20260712051525_WidenPromoBindingLastAppliedPeriod` (LastAppliedPeriod nvarchar(7)→(20)) — ‼️ `dotnet ef database update` before deploy.

- **ARMED codes now apply to charge-now paths** (the Maria scenario): `ChangeAddOnTierAsync` prorated upgrades and `SwitchPlanToAnnualNowAsync` + `SwitchAiToAnnualNowAsync` resolve binding-first THEN the armed code (`ResolveArmedAtPurchaseAsync` gained `eligibilityAmountMinor` — min-amount validates the FULL new-tier/annual price while the discount computes on the delta/charge). After success the armed code commits its binding: **upgrade delta = `consumePeriod:false`** (a sliver of month never spends a discount period — countdown starts at the next renewal; new param on `CommitAfterChargeAsync`); **annual switch = consumes ONE period keyed `"{period}:switch"`** (distinct from a same-month monthly reconcile; `LastAppliedPeriod` is last-value-gated and the stale-due guards in SubscriptionBillingService prevent late-renewal re-reconciles). An armed code discounting the WHOLE delta still routes through `ChargeVaultedAsync` ⇒ $0 tx persisted + receipted + binding committed; a binding-covered $0 delta stays a free switch (no tx). Below-floor keeps the free switch and leaves the code armed (binds at renewal). Quotes mirror every branch (parity preserved).
- **Per-code Completed blocking (F1 semantics corrected)**: a Completed binding blocks only ITS OWN code's armed re-fire; a NEW code freely discounts the product (the old product-level block silently killed every later campaign). `ProviderPromoState.ConsumedProducts` REMOVED — armed views now carry LIVE covered sets (covered − same-code-completed products); dead armed rows are hidden from `/overview`, cleaned up during the next arm, and re-arming a fully-consumed code fails `promo_already_used`. An ACTIVE binding (any code) still owns the product outright.
- **No-double-dip hardened**: `ArmAsync` now serializes per provider via SQL app-lock `promoarm:{businessId}` (relational-only; mirrors the redeem lock) — two CONCURRENT applies of different codes covering the same product can never both arm; different providers never contend (per-biz key). Integration-proven (5-round race test + cross-provider independence test). Charge-time already single-source (binding else one armed code — never summed); DB enforces one Active binding/product.
- **FreeMonths = 100% off × N** through the standard engine: `PromoCodeService.ComputeDiscount` returns the full amount; `ProviderPromoService.NormalizeDiscount` maps FreeMonths → (Percentage 10000 bps, Repeating × FreeUnits) at the edge (armed views, ArmedAtPurchase, binding snapshot all normalized). **FreeTrialDays is DEAD**: rejected in `EvaluateEligibilityAsync` (`promo_not_supported`, localized en/hi/gu), blocked at admin create/update (`InvalidPromoDiscount`), removed from admin `DISCOUNT_TYPES`; FreeMonths requires FreeUnits ≥ 1.
- **`AdminAlertType.PromoCodeRedeemed`** (new): one alert per SUCCESSFUL discounted payment (purchase/renewal/upgrade/top-up/auto-recharge incl. $0-after-discount), fired from the single receipt site in `BillingChargeService.ChargeVaultedAsync` via new `IPromoUsageAlertService`/`PromoUsageAlertService` (Scoped both hosts; TierLimitAlertService pattern: BusinessProfile+tier enrichment, SystemMarker `promoalert_{txId}` dedup, deterministic EventId `promoused:{txId}`, forceAdminAlert, never throws). Gate `Payments:PromoUsageAdminAlertsEnabled` (default TRUE, both appsettings, deploy.ps1 `-PaymentsPromoUsageAdminAlertsEnabled`); admin AlertsPage filter updated. BillingChargeService ctor gained the service (test fixtures updated).
- **Duration-aware renewal outlook**: `BillingCheckoutQuote`/`CheckoutQuoteDto` += `RenewalDiscountedAmountMinor` + `RenewalDiscountedPeriods` (null periods + amount = Forever) via new read-only `IProviderPromoService.ResolveRenewalOutlookAsync(…, periodsConsumedNow)` — purchase/annual-switch pass 1, upgrades 0; trial quotes deliberately untouched. `QuoteSummary` + the UpgradeModal $0-note render "Renews {date} · {disc}/mo for {n} more months, then {full}/mo" (+years/forever/plus-tax variants).
- **Annual-view promo display (G3)**: overview plans/AI DTOs += `discountedAnnualPriceMinor` (computed ONLY when the code/binding `AllowAnnual` — the §4 gate stays the truth); `ArmedPromoDto`/`PromoBindingDto` += `allowAnnual`. `Billing.jsx` annual branches render struck annual + discounted + `billing.annual.billedAnnuallyDiscounted`; the promo banner shows a "monthly billing" chip + flip-the-toggle hint for non-annual codes when annual is offered; FreeMonths banners read "{n} months free"; top-up-only codes read "on your next top-up purchase". History rows (`BillingTransactionDto` += promoCode/discountAmountMinor/grossBeforeDiscountMinor) show "{code} · you saved {amount}" + struck gross; `AiSetupPricing.jsx` shows the discounted AI price. 16 new keys ×3 locales (en-US/hi-IN/gu-IN).
- **Verified**: promo unit 40/40 + all affected API suites green; real-SQL integration 17/17 (armed-upgrade single-redemption lifecycle, switch-key consume, FreeMonths $0+normalized binding, concurrency no-double-dip ×5 rounds, cross-provider lock independence); admin 12/12; partner ESLint 0; next build green. Known accepted edge: a $0-after-discount FIRST purchase still requires a card on file (the pm lookup precedes the $0 short-circuit — industry-standard for recurring; renewal needs an instrument).

## Promo discovery — provider "Offers for you" list (2026-07-12, provider phase SHIPPED)

Providers now see EVERY promo they can arm on the billing page (not just one auto-surfaced code) and apply in one tap. Plan `payments-plan/PROMO-DISCOVERY-PLAN.md`; mockup `payments-plan/mockups/promo-discovery/index.html`. Migration `AddPromoCodeIsListed` (additive; ‼️ `dotnet ef database update` before deploy). Customer-checkout platform-funded promos are now SHIPPED (2026-07-13) — see the CUSTOMER section at the end of this skill.

- **`PromoCode.IsListed`** (bit, default TRUE): discoverable in "Offers for you"; OFF = secret code-entry-only campaign. Orthogonal to `IsTargeted` (who MAY use it). `BillingModelConfiguration` `HasDefaultValue(true)` + index `(IsTargeted, IsListed, IsActive, Region)`. Admin promo modal "Visible in apps" toggle (default on) + `PromoCodeConfigDto/UpsertDto.IsListed`.
- **`ProviderPromoService.GetStateAsync` now returns `AvailableOffers`** (list) — REPLACED the single `AvailableOfferCode` (pre-prod, no compat). `BuildAvailableOffersAsync` = targeted-to-me listed codes ∪ public listed codes, batched (≤3 queries, NO per-code loops): candidates minus already-armed, then in-memory filter (FreeTrialDays/window/global+per-user cap[one grouped query]/first-time/live-set-empty). Blocked offers ride the list DIMMED with `BlockedReasonKey` (+ `BlockedProducts`): `promo_overlaps_existing` (product already covered by armed/active-binding) or `promo_wrong_tier` (tier-restricted NON-plan code outside current tier; a code covering Subscription stays applicable — the upgrade qualifies). Sort: applicable→exclusive→%family→magnitude→sooner-expiry→code.
- **Region catalog cache** (`GetPublicListedCandidatesAsync`): per-region `IMemoryCache` (`Size=1`), key `promocatalog_{region}`, TTL `Payments:PromoCatalogCacheMinutes` (default 5, API+Functions). Static cancel-only reset token (EntitlementService pattern); `InvalidateOfferCatalog()` called by admin promo create/update/delete for instant refresh, TTL = cross-host backstop. Targeted rows + redemption counts stay per-request (never cached) ⇒ config-reconciled founder codes always current. Window re-checked in memory on every read (cache may hold not-yet-started/just-expired rows).
- **Arm tier-gate fix (pre-existing latent bug):** `CheckArmEligibilityAsync` gated on the provider's CURRENT tier while pay validates the PURCHASED tier — a Free provider could never ARM a code restricted to a paid tier (`promo_wrong_tier`). Arm now passes `checkTier:false` (joins purpose/min-amount/first-time as arm-skipped gates, all re-checked at pay); `EvaluateEligibilityAsync` gained the `checkTier` param (ValidateAsync keeps `checkTier:true`). Never-over-promise preserved by a per-plan-card tier gate in the strikethrough resolution via new `ArmedPromoView.ApplicableTiers`/`ArmedPromoDto.applicableTiers`.
- **Partner web (`BillingPromoSection.jsx`):** "🎟️ Offers for you · N available" section (first 4 offer cards in `grid-cols-1 sm:grid-cols-2`, dashed-lime cards mirroring the old exclusive-offer card, Best-offer chip on the first exclusive, dimmed cards show the reason, per-card Apply → existing `ApplyPromo` → silent `onChanged()` refetch), "See all N" inline toggle (local state, zero network), and the code box COLLAPSED behind a "Have a promo code?" link (Baymard) — always shown when there are no offers. Old single-offer banner + `billing.promo.exclusiveOffer` key REMOVED. ~15 new `billing.promo.offers.*` + `haveCodeLink` keys ×3 locales (en-US/hi-IN/gu-IN). No new client call — the list rides `/overview` (already session-cached; `BillingOverviewContext`).
- **Verified:** API unit 5881/0 (12 new offer-composition/sort/cache/dim tests in `ProviderPromoServiceTests`); real-SQL promo integration 20/20 (+3 new: batched targeted∪public∪unlisted list, per-user-cap exclusion, IsListed default on a fresh row); touched payments integration suites 30/30; partner+admin ESLint 0 + next build 0 + CRA build 0. Constructor churn: `ProviderPromoService` gained `IMemoryCache`+`IOptions<PaymentSettings>`; `AdminBillingConfigController` gained `IProviderPromoService` — all test call-sites updated.

- **Extreme audit (2 adversarial agents, all findings FIXED):** F1 (HIGH) tier-restricted armed code struck a discount on plan cards it didn't cover ⇒ pay charged full price — FIXED by extracting `PromoStrikethroughResolver` (clinqetcore, unit-tested) that mirrors the pay-time tier gate (card tier for plans, current tier for AI/top-up) + per-basis min-amount; F2 arm now rejects `promo_wrong_tier` for a code whose live set is only current-tier products outside the tier (no dead banner); F4 min-amount is per-basis so a monthly-excluded code still strikes the qualifying annual. UI audit: no critical/high; fixed error-placement (offer vs code-box source), "N available" counts only APPLICABLE offers, code-chip `break-all`, emoji `aria-hidden`. Region-cache/DI/founder-dedup/arm-overlap all audited clean. Re-verified: API unit 5891/0, promo integration 20/20, partner next build 0.

## Tier-limit admin "reach out" alerts + sunset reminder switches (2026-07-12)

> The sunset reminder switches from this session were deleted with PromoSunset on 2026-10-04; the tier-limit alerts stand.

- **`TierLimitAlertService`** (`clinqetinfrastructure/Services/Payments/`, `ITierLimitAlertService`, Scoped both hosts): admin conversion alerts when a provider hits a plan wall. Types + fire points: `LeadQuotaReached` (LeadAccessGate act-on deny), `WhatsAppPlanBlocked` (Free cap-0 — WhatsAppOutboundProcessor once-per-day blocked branch AND the CRM outreach `gate.PlanBlocked` pre-check; paid at-cap outreach returns PlanBlocked status WITHOUT this alert), `AiMinutesExhausted` (AiAddOnService exhausted claim when auto-recharge outcome is NotConfigured or MonthlyCapReached — ChargeFailed already raises BillingAutoRechargeFailed; ChargePending stays silent), plus the **enriched** `WhatsAppSendCapReached` (daily crossing; the old bare publish inside `FailureNotificationHelper.HandleWhatsAppSendCapReachedAsync` was REMOVED — the helper now only nudges the provider, signature slimmed to `(businessId, cap)`, and the processor raises the alert via the service).
- **Payload**: businessName, providerNumber(=businessId), phone, email (BusinessProfile point-read), tier+region (EntitlementService, fail-soft "Unknown"), limit key, used/cap, period, `/businesses/{id}` adminLink; hardcoded admin-English "reach out" wording (§3.6).
- **Dedup**: durable once per provider per limit per PERIOD — monthly (yyyyMM) for the 3 conversion types, daily (yyyyMMdd) for the WA cap — via `SystemMarker` id `tierlimitalert_{type}_{businessId}_{period}` (pk businessId) + IMemoryCache(Size=1) short-circuit. Alert-first-THEN-marker = at-least-once (failed enqueue retries on the next hit; the processor's 15-min window + deterministic EventId `tierlimit:{type}:{biz}:{period}` collapse cross-host races). `forceAdminAlert: true` (own flag, not EnableAdminAlertOnFailure).
- **Flag**: `Payments:TierLimitAdminAlertsEnabled` (default true, both hosts; deploy.ps1 `-PaymentsTierLimitAdminAlertsEnabled`). Service never throws into callers (hot request paths).
- Admin app `AlertsPage.jsx` filter list gained the 3 new types (+ drift fix: ContentReported, FriendlyNameProjectionFailure were missing).

## Promo discovery — CUSTOMER platform-funded promos (2026-07-13, customer phase SHIPPED)

The second promo system: platform-funded booking-level PROMOS that STACK on top of the provider-funded per-service OFFERS. Flow-B booking pay only (Stripe US/CA, Cashfree India). Plan `payments-plan/PROMO-DISCOVERY-PART2-HANDOFF.md`; mockups `payments-plan/mockups/promo-discovery/{cart-offers,index}.html`. Migration `AddCustomerPromoAudienceAndTargets` (additive; ‼️ `dotnet ef database update` before deploy).

- **TWO SYSTEMS, never conflated.** Provider OFFERS (`Booking.AppliedOffers`, provider-funded, baked into `providerGross`, apply on ANY payment method) vs platform PROMOS (`PromoCode.Audience=Customer`, platform-funded, booking-level, ONLINE-PAY ONLY). They stack. The platform NEVER funds a provider offer. Separate by SCOPE in the UI; never name provider/platform to the customer, never blend the two savings figures, never gate a provider deal on online pay.
- **`PromoCodeAudience` {Provider, Customer}** (new enum, `[JsonConverter(JsonStringEnumConverter)]`). `PromoCode.Audience` (default Provider). **The audience gate is the first loophole closed:** `PromoCodeService.EvaluateEligibilityAsync(..., PromoCodeAudience audience, string? customerKey)` → `promo.Audience != audience ⇒ "promo_wrong_audience"`. `ProviderPromoService` candidate queries filter `Audience==Provider` (a listed Customer code can never leak into "Offers for you"). Customer codes: reject FreeMonths, skip the tier gate, cap on **CustomerKey** (not BusinessId).
- **`CustomerPromoKey.Resolve(userId, email)`** (clinqetcore `CustomerPromoModels`): signed-in ⇒ trimmed auth userId; guest ⇒ trim+lowercase verified email. `BillingTransaction.CustomerKey` + `PromoCodeRedemption.CustomerKey` (nvarchar 320) stamp every booking charge/redemption. `PromoCodeCustomerTarget {PromoCodeId, CustomerKey}` (mirror of `PromoCodeTarget`) = per-customer targeting; unique `(PromoCodeId, CustomerKey)`.
- **THE MONEY FORMULA (`BookingPaymentService.ResolvePromoAndInsertChargeRowAsync`), six quantities:** `providerGross = servicesSubtotal − providerOfferDiscount`; `platformPromoDiscount` PRE-tax on providerGross, clamped ≤ it AND ≤ `providerNet − MinProrationChargeMinor` (a gateway can't charge $0; there is no free-booking flow); `customerNet = providerGross − discount`; tax PROPORTIONAL on customerNet (⇒ a no-promo/no-tax booking stays byte-identical); customer charged `customerNet + discountedTax`; **transfer basis = the UNDISCOUNTED gross (`tax.GrossMinor`) — the provider is paid exactly as with no promo, the platform funds the gap.** Frozen on the tx: `GrossBeforeDiscountMinor=providerGross`, `DiscountAmountMinor=discount`. Refund ≤ customerNet; reversal on the undiscounted basis (platform recoups its gap on a full refund).
- **‼️ C1 — Stripe `source_transaction` caps a transfer at the source charge.** The payout (undiscounted basis − fee) exceeds the DISCOUNTED charge by the funded gap ⇒ binding the transfer to the charge would make Stripe reject it (provider unpaid) or cap it (provider underpaid). `TransferAsync` now binds to the source charge ONLY when the payout fits inside it: `sourceCharge = (p.PromoDiscountMinor > 0 || transferAmount > collectedMinor) ? null : p.ChargeId`. A discounted payout is funded from the platform BALANCE — safe because booking payouts are DEFERRED to post-completion, so the charge has long settled to available balance. No-promo rows keep `source_transaction` (byte-identical). **Real-Stripe smoke test still owed before go-live — the integration suite stubs the gateway; it asserts the intent (`SourceTransactionId==null` when discounted, `=="ch_test"` otherwise) but not Stripe's actual acceptance.**
- **CAP RESERVATIONS (money-loss guards, all at initiate on the LOCKED db).** The discount is committed into the charge at initiate but `RedeemedCount` only bumps at capture (days later) ⇒ counts alone are not enough. `EvaluateCustomerPromoAsync` reserves: **per-user** — `perUserCap = MaxRedemptionsPerUser ?? (FirstTimeCustomersOnly ? 1 : null)`; `Math.Max(redemptions, in-flight+committed charge rows {Pending,Processing,Succeeded} on OTHER bookings) >= cap ⇒ refuse` (MAX not SUM so a completed booking — which has BOTH a redemption and a Succeeded charge — counts once; a `cap=2` code still allows the legit 2nd use). **global budget** — `RedeemedCount + in-flight holds {Pending,Processing} >= MaxRedemptions ⇒ "promo_exhausted"`. The initiate app-lock is **code-scoped** (`custpromoinit:{CODE}`, not customer-scoped) so both the per-user AND the global count+insert are atomic across all customers of that code.
- **`CustomerPromoService`** (`custpromocatalog_{region}` cache, `Size=1`, static cancel-only reset token; `InvalidateCatalog()` from `AdminBillingConfigController` on every promo save): `GetOffersAsync` (eligible + dimmed-with-reason; `onlinePayAllowed=false ⇒ ALL dimmed promo_requires_online_payment`, backend NEVER redeems in that state) + `IsFirstBookingAsync` (no prior Succeeded BookingCharge for the CustomerKey).
- **`CustomerPromoAlertService`** (mirror of `PromoUsageAlertService`): `AdminAlertType.CustomerPromoRedeemed`, gated by `Payments:CustomerPromoUsageAdminAlertsEnabled` (default TRUE, deploy.ps1 `-PaymentsCustomerPromoUsageAdminAlertsEnabled`, both hosts), marker `custpromoalert_{txId}`, deterministic EventId `custpromoused:{txId}`, `forceAdminAlert`, never throws into the money path, strictly `BookingCharge`.
- **Reconciliation = Option A**: the frozen `BillingTransaction` fields ARE the ledger (money truth in SQL ⇒ no cross-partition concern). Admin report `GET admin/billing/promo-spend` = indexed GROUP BY over `Type=BookingCharge AND Status=Succeeded AND DiscountAmountMinor>0`; filtered index `IX_BillingTransaction_PromoSpend`.
- **Carried intent**: cart pick → `Cart.SelectedPromoCode` / `Booking.SelectedPromoCode` (INTENT, no cap consumed), auto-applied at pay via the EXISTING initiate call (tri-state `promoCode`: omitted=carried intent, ""=removed, "CODE"=apply/switch). Re-validated server-side at pay; stale/expired falls off gracefully (full price). Dedicated `PUT cart/promo` endpoint so a cart save never clobbers the pick; `CartService.SaveCartAsync` explicitly leaves `SelectedPromoCode` untouched. `GET cart/offers` returns `{promoEnabled, selectedPromoCode, offers[]}` so the Redux cart slice carries NO promo plumbing (zero-regression on the most-used surface).
- **ZERO-REGRESSION gate**: `AppConfigDto.Payments.CustomerPromosEnabled = Enabled && OnlineBookingPayEnabled && PromoCodesEnabled` (mirrors the cart-offers server gate). Both clients read it via the existing app-config context (`useCustomerPromosEnabled` web / `useAppConfig().payments.customerPromosEnabled` mobile) ⇒ promo OFF (today's state) fires ZERO offer calls, renders NO promo surface, and the cart + payment breakdown are byte-identical to the pre-promo app. Cart offers call is also skipped for guests (personalised ⇒ empty for them).
- **Client surfaces**: WEB `PromoOffers.jsx` (payment row+sheet, inline SVG glyphs, applied/see-offers/have-a-code states, `AmountBreakdown` collapses to the old markup with no discount), `PlatformPromoSection.jsx` (cart card, debounced offers, online-pay-off nudge, truthful "stacks on top of your service deals" copy). MOBILE `PromoOffers.tsx` + `PlatformPromoRow.tsx` (native BottomSheet, `react-native-svg` glyphs, theme tokens, i18next `_one/_other` plurals) + `BookingPaymentSection.tsx` loads the server quote on payable focus. Every reason key mapped on both clients; NO emoji. Invoice pay left untouched (a Booking-product promo can't apply to a non-booking invoice).
- **Verified**: CustomerPromo integration 27/27 real SQL (two-systems six-quantity money proof + the full adversarial battery: audience/expired/inactive/not-started/forged/min-amount/currency/global-cap/targeting/per-customer-cap+in-flight-reservation/replace-never-stack/replay-redeem-once/carried-intent/first-booking/refund/no-tax/fee + C1 balance-funded-transfer both directions + H1 global-reservation + H2 first-time-reservation + M3 cap-2-2nd-use); Payments integration 38/38 (transfer change no-regression); API unit incl. AppConfig `CustomerPromosEnabled` AND-gate; web ESLint 0 + next build 0; mobile tsc 0 + ESLint 0 + jest 38/38.
- **Residual status (superseded 2026-07-14):** M1 is fixed by mandatory per-use and campaign caps; the guest promo bypass is removed because platform promos require sign-in; Cashfree uses the gateway-neutral two-leg funded payout contract. See the shipped section below.

## Promo caps, funded payouts, refund disputes, chargebacks, and provider ledger (2026-07-14 — SHIPPED)

Master plan: `C:\Nik\payments-plan\PROMO-CAPS-AND-PAYOUT-FUNDING-MASTER-PLAN.md`. Single EF migration: `20260714052343_AddPromoCapsPayoutFundingAndDisputes`; run `dotnet ef database update` before deploy.

- **Promo exposure controls:** `PromoCode` has `MaxDiscountMinor`, `MaxDiscountPercentOfOrderBps`, `BudgetMinor`, and atomic `DiscountSpentMinor`; `ProviderPromoBinding` freezes both per-use clamps. Both clamps live only in `PromoDiscountMath.Compute`. The campaign budget is an all-or-nothing checkout gate including in-flight reservations; capture atomically increments redemption count + spend. A redeem-time budget race honours the frozen customer price, records overspend, and raises `PromoBudgetBreached`. Customer percentage codes require `MaxDiscountMinor`; every Customer code requires `BudgetMinor`; non-positive/invalid caps and money caps on free-period codes are rejected. `PromoCode.Stackable` is deleted. Customer promos require authenticated identity; public booking-pay DTOs cannot carry a promo code.
- **Fail-closed locks:** SQL `sp_getapplock` failures on customer-promo initiation, redemption, and refund money paths return unavailable and alert; they never fall through to an unlocked money mutation. Provider promo arm serialization remains product-ownership protection.
- **One payout engine:** `IProviderPayoutService.PayAsync` is the only booking/invoice payout path. It calls gateway-neutral `PayProviderAsync`, supports the collected-order leg plus platform top-up leg, minimum-shift rules, deterministic idempotency, and resumability. Same-currency provider debt/credit netting and the payout transaction row commit in one SQL transaction under the configured execution strategy; no cross-currency netting. `InvoicePaymentService` uses the same engine.
- **Refund-request state machine:** `BookingPaymentDispute` has one DB-enforced open row per booking. Open statuses are `Pending`, `CounterpartyDeclined`, `TimedOut`, `AdminReview`, `CounterpartyApproved`, and `AdminApproved`; the enum set and filtered index must remain identical. Opening a request freezes both normal and auto-release payout paths. Provider approval queues refund execution; decline or silence escalates to admin and never moves money. Admin may approve full/partial or deny. Approved rows stay open until the gateway operation succeeds. `UnwindOnCancelAsync` only voids an Authorized hold; captured cancellation never auto-refunds; transferred bookings are never system-refunded.
- **No-show claims:** provider claims use the same dispute infrastructure, response reminder + timeout scheduled messages on the existing booking-payment queue, and server-authoritative fee calculations. The policy is disclosed pre-booking on customer web/mobile; keep `NoShowFeeEnabled=false` if that disclosure is removed.
- **Chargebacks + ledger:** gateway `charge.dispute.created/closed` delegates to `IChargebackService`. Pre-payout disputes mark the charge disputed and cancel both payout schedules with no debt. Post-payout disputes create one idempotent Active debt for provider payout + platform top-up + gateway dispute fee + admin handling fee. A win reverses debt and creates credit for already-recovered money; admin waiver uses the same make-whole rule. A fully refunded chargeback creates no second debt and raises the duplicate-claim alert. Open customer disputes are closed when the bank chargeback supersedes them.
- **Ledger sweeps:** the existing daily `SubscriptionBillingSchedulerFunction` pages stale Active debts and credits and calls `RaiseDebtEscalatedAsync` / `RaiseCreditStrandedAsync`; no new timer or queue. Admin ledger view supports waive, adjust, and manual entry with mandatory note, audit row, and alert.
- **Surfaces:** customer/provider/admin dispute controllers enforce the existing booking-pay gate and tenant ownership. Admin ledger/dispute mutations write `IAdminConfigAuditService` rows. Admin web includes every promo cap/spend field, Provider Ledger, Booking Disputes, and all 14 payment alert filters. Customer web/mobile show server-authoritative refund states, no-show response, promo sign-in nudge, and policy disclosure. Provider web/mobile ship the refund/no-show inbox.
- **Notifications/config:** customer-personal dispute outcomes stay on `ICommunicationDispatcher`; provider-facing dispute, payout, chargeback, debt, and ledger outcomes resolve business recipients through `IBusinessCommunicationDispatcher`. The 11 dispute/ledger types are in Main API `SignalRSettings:EnabledNotificationTypes`, localized in all repository locales, and have per-language email templates. Payment defaults match API/Functions appsettings; Functions runtime values flow through ARM + `deploy.ps1`. No new Azure resource was added.
- **Proof:** API unit and Functions unit suites pass with zero skips; API real-engine integration 1210/1210 and Functions integration 366/366. The real-SQL payments matrix covers both clamps, budget gate/reservation/breach, sign-in, payout funding/netting, R-table, and D-table cases. Customer mobile Jest 39/39; partner mobile Jest passes; touched mobile TypeScript/ESLint are clean; customer/partner web production builds and admin build are clean.
- **External go-live gates:** enable Stripe `charge.dispute.created` + `charge.dispute.closed`; enable Cashfree dispute webhooks; maintain platform float per gateway/currency for promo top-ups; apply the EF migration.

## SQL retry-strategy invariant for promo redemption (2026-07-16)

`PromoCodeService.RedeemAsync` runs its complete explicitly-opened connection, session `sp_getapplock`, idempotency recheck, conditional cap/spend update, redemption insert, and manual SQL transaction inside `db.Database.CreateExecutionStrategy().ExecuteAsync(...)`. This is mandatory because both production hosts configure SQL Server with `EnableRetryOnFailure`; a bare `BeginTransactionAsync` is invalid under `SqlServerRetryingExecutionStrategy`. Every retry clears the change tracker before rebuilding the unit of work, and all admin-alert side effects run only after commit and after the session lock is released. `PaymentsSqlFixture` must continue mirroring production retry settings so any future bare manual transaction fails in real-SQL integration tests.

## Tier-limits/cutover FINAL ADVERSARIAL AUDIT — all confirmed findings fixed (2026-07-16)

Nine independent audit agents swept the whole tier-limits + promo-sunset program (S1+S2 + follow-ons) against the code as of 2026-07-16; every confirmed finding was fixed and test-pinned. The cutover-machinery deltas:

- ~~PromoSunset findings~~ (late-flip heal, phase gating, founder refusal and founder row ids) — deleted with PromoSunset 2026-10-04.
- **§0.12 mirrors:** `PaymentSettings.BillingUiEnabled`, `SmartAnalyticsEnabled` and `TrialSettings.Enabled` class defaults are now `true`, matching both hosts' committed appsettings.
- **Config hygiene:** the Functions host no longer carries the unread `Payments:Regions` + `Payments:BillingUiEnabled` keys, and deploy.ps1 wires `Payments__Regions__N` to the API app only (the seeder hosted service + admin editor are API-only; the old "both hosts run the seeder" comment was wrong).
- **Lead quota:** `ILeadAccessGate.PeekActOnLeadAsync` (returns the decision, incl. `UpgradeAvailable`, from one read) is a read-only peek (no consume/count/alert, fail-open); `WithdrawAndRebidAsync` peeks it BEFORE withdrawing so an at-cap re-bid can never strand a provider bid-less with the customer already notified. `LeadQuotaExceededException` no longer carries dead `Used`/`Cap` (owner-locked: clients refetch lead-usage). The 429 + `errorCode:"lead_quota_exceeded"` contract is pinned by 5 controller unit tests (one per act-on endpoint) + a real-host-serializer camelCase wire test.
- **Preference map:** every provider billing-family notification type is mapped to `BillingPayments` — see clinqet-notifications.
- New tests: 6 lead-gate peek unit, 5 controller 429 contract, 1 wire-shape integration.

## Booking-pay refund/cancel/anti-fraud program (2026-07-17 — Flow B audit + fix; plan `i-have-a-really-parsed-meadow`)

- **Provider dispute inbox auth FIXED (was DEAD):** `ProviderDisputesController` had `[Authorize(Roles="Provider")]` but no "Provider" role exists (roles are Admin/User/Support; providers are the `UserType` claim value `Partner`) ⇒ every provider refund/no-show endpoint 403'd. Now `[Authorize]` + a per-action `GetCurrentUserTypeAsync() != UserType.Partner ⇒ 403` guard. The dead "Provider"/"Customer" role fallbacks in `BaseController.GetCurrentUserTypeAsync/GetCurrentSenderType` are deleted. Pinned by `ProviderDisputesControllerTests`.
- **D2 mutual-confirmation capture (anti-fraud):** `Payments:Booking:RequireMutualCompletionForCapture` (default **true**) + `CompletionConfirmationGraceHours` (**24**), both appsettings (API + Functions) with matching class defaults. Money is collected the instant BOTH `ProviderConfirmedCompletedAt` AND `CustomerConfirmedCompletedAt` exist. Provider-first completion: the customer is prompted (`NotificationType.BookingConfirmCompletionRequested` — SignalR-whitelisted + preference-mapped) and a grace **backstop re-schedules the `Complete` operation** (messageId `bookpay_complete_{bookingId}`, `ProviderInitiated=true`, seq stored in `CaptureScheduleSequenceNumber` so every existing cancel path clears it); at/after the grace deadline the re-fire captures without the customer. Auto-completion (`providerInitiated=false`) still captures outright (ultimate backstop). `MarkCustomerCompletedAsync` alone never charges under mutual mode; when both stamps exist it runs `OnBookingCompletedAsync(providerInitiated:false)` (capture + transfer scheduling + backstop cleanup). The #28 auto-release fallback is now confirmation-aware (skipped when a provider confirmation exists).
- **Capture results surface to the PROVIDER immediately:** `FinalizeCapturedAsync` notifies `BookingPaymentSucceeded` with the amount (`Notification_BookingPaymentSucceeded_Provider_{Title,Body}`, `CurrencyMinorUnit.ToMajorString`); BOTH decline exits in `CaptureAsync` notify `BookingPaymentFailed` to provider AND customer (that type previously had ZERO dispatch sites). Provider/customer preference-map entries added (`BookingPaymentSucceeded/Failed/PayoutReleased` provider; `…/RefundIssued/BookingConfirmCompletionRequested` customer).
- **D3 self-cancel policy — ONE rule, every lane:** `BookingCancellationPolicy` (`clinqetcore/Utilities`) — a CUSTOMER self-cancels free before the booking's LOCAL calendar day; ON the day ⇒ blocked with machine reason `booking_day_contact_support` (clients render "Contact support"); Draft/Awaiting* always cancellable; terminal ⇒ (false, null). Setting `Booking:SelfCancelCutoff` (`SelfCancelCutoff` enum: `BeforeBookingLocalDate` default | `BeforeStart`); the old `Booking:CancellationWindowHours` is DELETED everywhere (API, MCP voice tool, tests). Providers exempt. The MCP `cancel_my_booking` + `find_booking` hint use the same policy (blocked codes `bookingDay`/`notCancellable`).
- **ONE cancel path:** `BookingService.CancelBookingAsync` (validates via `ValidateStatusTransitionAsync` — incl. the `Transferred`/provider-paid guard — applies, mirrors `CustomerBooking`, runs `HandleStatusChangeAsync`) is called by BOTH `POST /bookings/{id}/cancel` AND `PATCH /{n}/status→Cancelled`. The controller's old direct status-set + 24h window are gone. Blocked ⇒ 400 with `ApiResponse.ErrorCode = "booking_day_contact_support"` + localized `Error_BookingSelfCancelBookingDay` (en/fr/hi/gu).
- **Eligibility as data:** `Booking.CanSelfCancel`/`SelfCancelBlockedReason` are **response-only** stamps (`[Newtonsoft.Json.JsonIgnore]` ⇒ never persisted to Cosmos; STJ serializes them to clients, omitted when null) on booking detail + the customer list; `BookingPaymentStatusDto` carries `canSelfCancel`/`selfCancelBlockedReason` and its `canCancelFree` now ANDs `canSelfCancel`. Flag-independent — the cancel button works with `OnlineBookingPayEnabled=false`.
- **Admin day-one visibility:** `AdminAlertType.RefundRequestOpened` fires on every CUSTOMER refund-request create (`IPaymentOpsAlertService.RaiseRefundRequestOpenedAsync`, gated by `RefundRequestAdminAlertsEnabled`, deterministic EventId `disputeopened:{id}`); admin `AlertsPage` filter updated.
- **UI (all flag-gated):** provider web+mobile booking detail gained a payment panel (Hold placed / Awaiting customer confirmation / Collected {amount} / Paid out / Collection failed / Refunded) + the mutual-capture disclaimer + mark-complete hint + cancel-modal "customer isn't charged" note (`providerPay.*` / `PROVIDER_PAY.*`). Customer web+mobile drive cancel off `canSelfCancel`, show day-of Contact support, the charge disclaimer, a confirm-completion prompt (Completed + still Authorized/Vaulted), and Withdraw + Contact support on the refund-waiting state. Mockups: `payments-plan/mockups/booking-pay-refund-cancel/`.
- **Cleanup:** dead `ReadApplicationFeeAsync`/`ReadChargeRegionAsync` removed from `BookingPaymentService`; dead `replaceExisting` param on `ScheduleAndStoreAsync` removed (it now carries `providerInitiated`).
- **India Flow B (D4 — still DEFERRED, verified 2026-07-17):** the resolver maps **IN → Razorpay** for ALL purposes (the P6 Cashfree note above is historical); Razorpay implements Flow-A (customer/vault/e-mandate/off-session/refund/order-status) but THROWS NotSupported for `CapturePaymentIntent`, `CancelPaymentIntent` (void), `PayProvider` (Route), and connected-account create/retrieve/onboarding ⇒ India booking-pay cannot run. Doubly gated: `OnlineBookingPayEnabled=false` AND the Connect leg of `IBookingPaymentGate` can never pass for IN.
- **Tests:** `BookingCancellationPolicyTests` (day gate incl. IST/Toronto UTC-vs-local edges, BeforeStart mode), `BookingServiceCancelTests` (gate/guards/mirror/side-effects), `ProviderDisputesControllerTests` (auth), dispute-create alert tests, and REAL-SQL `BookingMutualCaptureIntegrationTests` (defer+prompt+backstop schedule, both-confirm instant capture + provider surfacing, customer-first no-charge, past-grace capture, decline surfacing both sides, auto-complete outright, legacy mode off).

### Final adversarial audit hardening (same program, post-audit fixes)
- **Backstop is now retry-safe:** `OnBookingCompletedAsync` returns `BookingPaymentOutcome`; the processor's `Complete` op retries (Abandon→redelivery→DLQ+admin alert) on `NotReady` (capture still settling) — a transient gateway wobble can no longer silently consume the one-and-only backstop message. Declined/async-"pending" are terminal for the message (surfaced / webhook-owned). A backstop re-fire landing back inside a RAISED grace window re-arms itself; the mutual deferral applies ONLY under `CaptureTrigger=OnCustomerCompletion` (BeforeAppointment never defers); a freshness re-read suppresses the customer prompt when they confirmed mid-race.
- **Cancel is ETag-CAS:** `CancelBookingAsync` re-reads + re-validates on a fresh copy per attempt and saves via `TryReplaceBookingAsync` (bounded retries; exhaustion ⇒ `Error_DbConcurrencyConflict`) — a racing payment/status write is never clobbered by a stale full-document save. Terminal-state customer cancels fall through to the state machine (accurate error, never a bogus booking-day block). The WhatsApp customer DECLINE (`BookingReplyActionService`) now routes through `CancelBookingAsync` too (stamps + mirror + side-effects).
- Also fixed: multi-role Admin claim check in `BaseController`; fr.json backfill for BookingPaymentSucceeded/Failed/RefundIssued/PayoutReleased; `Booking:SelfCancelCutoff` added to the Functions appsettings; admin AlertsPage filter = exact `AdminAlertType` enum-order parity (phantom `VoiceAssistantAccessRequested` removed); provider "Paid out" shows no amount (the payout ≠ the customer charge on promo-funded/partially-refunded bookings); "within 24 hours" copy replaced with windowless wording everywhere (grace is configurable); provider cancel note gated on an actual hold (Authorized/Vaulted); customer confirm-completion hint carries the {amount}; mark-complete now refreshes the web payment panel; day-of/pending-refund contact-support copy corrected on mobile; list-card cancels tracked as surface `booking_list`.


## Booking-pay regional fee policy and refund email breakdown (2026-07-18)

- `PaymentSettings.ResolveRefundFee(region)` is the only runtime source for refund-fee enablement, bps, fixed/max amounts, and provider-cover eligibility. `Payments:Dispute:RegionOverrides` applies nullable field-level overrides; the frozen gateway charge `BillingTransaction.Region` wins, with the booking/dispute currency mapping only as a legacy fallback.
- `PaymentSettings.ResolveBookingFeePolicy(region)` is the only runtime source for Connect transfer/account fee pass-through. `Payments:Booking:FeeRegionOverrides` defaults US/CA to pass-through ON and India to both OFF. Payout calculations and customer/provider payout DTOs use the same resolved policy.
- Refund approval/resolution emails carry `RefundGrossAmount`, `RefundFeeAmount`, `RefundFeeCoveredByProviderAmount`, and `RefundNetAmount`; all are currency-aware strings derived from the persisted dispute decision. Both templates contain the full breakdown in en/fr/hi/gu.
- `PaymentSettingsValidator` validates every regional refund override and refuses API boot when `Booking:AutoCompletionHours` differs from `Payments:Booking:AutoCompletionHours`. The Functions host has no lifecycle `Booking:AutoCompletionHours` key, so only the positive nested-value invariant applies there.
- Processor coverage pins `PlaceHold` success/retry plus `AuthenticationExpire` and replay-safe `AuthenticationReminder` routing. Real-SQL payout coverage proves India never deducts Connect transfer/account fees from the provider.

## Booking-pay edge-case master audit closure (2026-07-18)

- Migration `20260718154152_AddBookingPayEdgeCases` adds the account-scoped customer wallet, payout-notification replay marker, and related indexes. It was regenerated from the final model, inspected, and applied successfully; no Cosmos container or partition-key change was introduced.
- Customer saved cards are scoped by `(UserId, Gateway, PaymentAccount)`, with one active default and one customer anchor per account. Pending SetupIntents are durable and reconcile from both wallet reads and `setup_intent.succeeded` webhooks. Public DTOs expose only internal wallet ids and display metadata, never gateway payment-method tokens.
- Booking initiation rejects a saved-card id not owned by the signed-in user and resolved payment account. Switching card or changing the charge amount cancels the stale unconfirmed hold; a same-card/same-amount retry retains the deterministic idempotency key.
- Stripe capabilities and Connect fee settings resolve from the actual payment account. Expanded charge balance-transaction fees are recorded; the monthly account fee remains exactly-once across failed payout, later payout, and retry sequences. Razorpay gateway-fee reads include both fee and tax and fail closed when the payment is unknown.
- Bank-authentication recovery re-reads the PaymentIntent before reminder/expiry actions. A completed challenge advances to authorization without a stale reminder; required authentication keeps localized customer navigation available until the configured expiry window.
- Payout-withholding communication uses the public booking number, localized responsive email templates in en/fr/hi/gu, preference mapping, SignalR allowlisting, and a durable replay marker. Admin dispute context accepts dispute or booking identifiers with admin-only authorization, and web/mobile deep links use that server context.
- Final proof: API unit 6291/6291; API real-engine integration 1262/1262; Functions unit 1627/1627; Functions integration 390/390; customer mobile Jest 74/74; provider mobile Jest 130/130. Customer/provider/admin web production builds pass, both mobile apps type-check, and all modified mobile TypeScript files have zero ESLint errors.

## Provider payment/tax simplification + booking eligibility (2026-07-22)

- Provider payment settings identify the regional verification partner from the server-returned gateway/region: Stripe for supported US/Canada regions; Razorpay wording for India. Trust copy states that account credentials/balance are not provided to Clinket and setup is used only to receive customer payments. India onboarding remains explicitly unavailable while the Razorpay connected-account path is stubbed.
- The customer pay action is driven only by `BookingPaymentStatusDto.CanPayOnline`. `BookingPaymentGate` requires the feature flags, the booking snapshot, the current business payment switch, and a ready connected payout account. No payout account means no customer pay button; initiation repeats the same server gate.
- New and materially updated bookings compute `Booking.AllowOnlinePayment` from the current business switch plus every referenced service override. A single service with `AcceptsOnlinePayments=false` blocks the multi-service booking. Missing quoted services fail closed. Quote service point reads are deduplicated and parallelized within the same business partition.
- Provider settings show a localized readiness warning when setup is missing/restricted and preview no pay button until charges are enabled. Business payment/tax notes explain that services saved as Follow business setting react to the business default without rewriting service documents.
- Tax-inclusive choice uses two plain-language radio cards with an explicit example: before-tax prices add tax at booking; tax-included prices already contain tax. The choice affects price presentation/calculation mode, not whether tax is enabled.
- Booking deposit is one shared themed component on provider web and native. It is Coming soon, records `FeatureInterestType.BookingDeposit`, shows a real icon, and converges to an idempotent acknowledgement state.

Audit requirement: verify provider web + native parity, customer web + native pay-label parity, onboarding context isolation, localization in every locale, booking creation/update/quote/voice/broadcast paths, and payout-not-ready fail-closed behavior.

## `ShowInBanner` + the banner promo read (Phase 4B, 2026-07-28)

`PromoCode.ShowInBanner` shipped in Phase 2 but was **absent from `PromoCodeConfigDto`,
`PromoCodeUpsertDto`, `ApplyPromo` and `MapPromo`** — the column existed and no admin could set it for
a whole phase. All four are wired now, and `ApplyPromo` **forces it false for a Provider-audience code**
(a provider code discounts the provider's own bill and can never reach a customer banner).

‼️ **`ShowInBanner` and `IsListed` are INDEPENDENT** (owner, 2026-07-28). `IsListed` is the "secret
code" switch — off means the code still works but is advertised nowhere, so it must be typed. A hidden
campaign code can still be the homepage hero, and a code listed in the cart is not automatically worth
the hero slot.

‼️ **The cached candidate query is now `IsListed OR ShowInBanner`** — a deliberate superset so ONE
cached query serves both surfaces at zero extra cost. **Every caller must narrow it**: `GetOffersAsync`
carries an explicit `IsListed` check, `GetBannerPromosAsync` filters `ShowInBanner`. Dropping either
check leaks a code onto the wrong surface, and nothing would fail.

`GetBannerPromosAsync(region)` is **anonymous and amount-free**, which is exactly why `GetOffersAsync`
could not serve it (it returns empty for guests and for `amountMinor <= 0`). It returns the code's own
terms and no computed saving — the homepage has no order to price against. Active-only, in-window,
budget and redemption caps respected, ordered by code so only the banner's own rotation varies the order.
Admin promo saves invalidate the promo catalog **and** the banner payload.

## Provider-billing review takeover — BIL findings closed + adversarial money-fix round (2026-07-30)

The approved mockup/audit (`C:\Nik\Data\mockups\provider-billing-review\`) is IMPLEMENTED end to end. Naming
correction to the 2026-07-10 section: the shipped conversion method is **`ConvertTrialToPaidAsync`** (not
`EndTrialWithPaidTierAsync`) and the key carries the interval: **`aitrialupgrade_{biz}_{tier}_{interval}_{period}`**.
New since then: **`EndTrialNowAsync`** (BIL-AI-01 "Pay now & end trial") + `POST provider/billing/ai-addon/end-trial`
(`EndAiTrialRequestDto{interval}`) + the `endTrialNow:true` quote branch in `QuoteAiCheckoutAsync` (quote==charge
parity pinned). Overview: AI state DTO carries gross+discounted current AND renewal prices (`renewalPriceMinor` is
**nullable — null when `BillingChargesEnabled=false`**, mirroring the quote); promo state is package-filtered
server-side (`VisiblePromoProducts`/`MapPromoState`) AND client-side; `GetOverview` skips disabled-product reads.

‼️ **Conversion replay identity is the TRIAL, not (tier, interval, click-month)** — the adversarial round found
three ways the narrow identity double-charged, all fixed + test-pinned:
- The scheduler's `aitrialupgrade_` consumption probe is **period-AGNOSTIC** (a manual conversion keys on its
  CLICK month; the sweep runs in the TRIAL-END month — a cross-month settlement was invisible and re-billed).
  Key remainder parses `{tier}_{interval}_{period}` / legacy `{tier}_{period}` by stripping the LAST segment.
- The manual path scans the whole `aitrialupgrade_{biz}_` family: a Pending sibling (different interval/tier)
  BLOCKS (`charge_pending`); a Succeeded sibling is **ADOPTED — the paid configuration wins over the new click**;
  `addon_{id}_` busy-probe is period-free.
- ‼️ **The boundary tier flip runs on a TRACKED row — every non-finalizing save must `RevertBoundaryTierFlip()`
  first** (missing-catalog defer, async-pending defer, mandate-reauth defer, both dunning exits). A declined
  boundary once persisted the flip with `PendingModelTier` cleared ⇒ the retry never re-provisioned the voiceline
  (premium model at the lower price, forever).
- `FinalizeAddOnRenewalAsync(..., skipIncludedGrant:)`: a trial conversion in the trial's START month
  delta-adjusts instead of stacking a second full included grant (sweep now matches the manual path).
Accepted/documented: sub-second manual-vs-sweep insert race (pre-existing key-family split, consistent with the
Part-2 ruling); ApplyPromo may arm a both-product code with one package hidden (provider-favorable discount);
strikethrough validity horizon re-validated at charge time (platform-wide quote-then-pay pattern).


## Annual-billing presentation: explicit offer copy + monthly-price strikethrough (2026-07-30)

> ‼️ SUPERSEDED 2026-10-05 (D15). Yearly is exactly 12 × monthly, so there is no deal badge, no "Save {pct}%" /
> months-free / extra-months copy, no monthly-price strikethrough and no `annualStrikeMinor`. What replaced it:
- A promo chip beside the Monthly|Annual toggle names the best yearly promo saving (web `PromoAnnualChip` +
  `billing.annual.promoSaving` / `promoSavingPlain`; mobile `bestPromoAnnualSaving` in `src/Util/annualPricing.ts` +
  `PLAN_AND_BILLING.PROMO_ANNUAL_SAVING` / `_PLAIN`). It shows only when a plan carries `discountedAnnualPriceMinor`.
- The yearly total is crossed out beside the promo price (web `AnnualBilledNote` → `billing.annual.billedAnnuallyStrike`;
  otherwise `billing.annual.billedAnnually`). A struck price always carries the screen-reader was/now words.
- Tests: `Billing.annualPricing.test.jsx` and `Billing.promoDisplay.test.jsx` (web).

## Multi-user-provider Phase 5 — provider financial routing (2026-08-02)

- Provider-facing financial and booking-payment producers use `IBusinessCommunicationDispatcher`. This includes `BillingNotificationService`, `BookingPaymentService`, `BookingDisputeService`, `ChargebackService`, `PayoutNotificationService`, and the `AdminBillingConfigController` tax-override notification. Customer-personal counterparts continue to use `ICommunicationDispatcher`.
- Every business request uses `Scope = Business`, the persisted `BusinessId`, and a routing subject. Use `booking.ToScopedResource()` when the booking is available; business-wide events use `new ScopedResource(businessId)`.
- `NotificationRoutingCatalog` owns routing class, required permission, and preference classification. A producer must not set routing, permission, or preference overrides for a non-`SystemNotification` event.
- `EventId` is a durable transition identity, not a random dispatch-attempt ID: anchor it to persisted payment/charge/transfer/dispute/ledger identifiers and persisted status, ETag, or update version. Replaying the same transition must reproduce the same `EventId`.
- The dispatch factory runs once per `ResolvedRecipient`. Render localized title/body and any language-sensitive template data with `recipient.PreferredLanguage`; the dispatcher supplies that member's identity, email, phone, business context, and channel policy.
- Booking routes target `/dashboard/bookings/{bookingNumber}`, business-wide financial routes target `/dashboard/billing`, and tax overrides target `/dashboard/profile/payment-settings`. External email/digest template links must be absolute HTTP(S); the dispatcher validates `QRCodeSettings:PartnerBaseUrl` and expands a valid workspace path when needed.
- `BusinessCommunicationDispatcher` centrally enforces mandatory email from `CommunicationPreferenceConfig`, immediate-versus-digest membership channel policy, SMS/WhatsApp eligibility, and a stable per-recipient idempotency key derived from `EventId + userNumber + businessId`. Producer `SkipEmail` cannot suppress a mandatory category.
- This section describes **multi-user-provider Phase 5**, not the payments phase numbers above. Phase 5 activates API/infrastructure producers only. Invitations, team/branch CRUD, and assignment writes remain Phase 6; the Functions/MCP/voice producer sweep remains Phase 7.

---

## ‼️ MULTI-USER TENANCY — PHASE 9 (2026-08-04). Payout and KYC now re-verify against LIVE SQL.

> **The whole model is now one skill: read `clinqet-provider-teams` before any tenancy change.**
> ‼️ **"Phase 9" here means the MULTI-USER PROVIDER programme's Phase 9, not the payments phase numbers
> above.** The two numbering schemes are unrelated.

### ‼️ The money layer needed NO restructuring — only the identifier changed meaning

Every billing entity was **already** keyed on `BusinessId`, declared `[StringLength(100)]`:
`ProviderSubscription` · `ProviderConnectedAccount` · `ProviderLedgerEntry` · `BillingTransaction` ·
`MinuteLedger`. They deliberately carry **no foreign key** to `UserProfile`, so financial state survives a
user delete. `EntitlementService.ResolveAsync(businessId)` was already business-scoped.

**So a 6-character `BusinessId` needed no width change, no migration and no re-keying on the money side.**
The only change is what the value *means*: employees may process transactions; **the payout belongs to the
business.**

Likewise every usage counter was already business-keyed — `AiUsageCounter.pk`, `LeadUsageCounter.pk`, the
WhatsApp send-cap `pk`, `MinuteLedger.BusinessId` — so **five members share one pool automatically** and a
**contractor in two organisations bills each separately**, with zero code change.
‼️ **Prove it with a test; never assume it.**

### ‼️‼️ SENSITIVE OPERATIONS NOW RE-VERIFY AGAINST LIVE SQL (H2, ✅ owner-approved)

`00-SOLUTION` §7.4 always said sensitive operations must *"always re-verify against SQL, never the
cache"*. ‼️ **Until Phase 9, NOTHING did.**

`IAuthorizationSnapshotProvider.GetLiveAsync` **already existed**, was **already proved against a real SQL
Server**, and its own doc comment named the §7.4 operations it was written for — and it was called from
**ZERO production code**. Separately, `grep` for `VerifyStepUpAsync` returns **one** call site on the whole
platform (ownership transfer). ‼️ **So six of §7.4's seven sensitive operations were deciding from the
≤60 s CACHED snapshot** (L61's window) — **including `POST connect/kyc`, which carries
`SettlementAccountNumber` / `SettlementIfscCode`, i.e. the actual bank destination.**

**Four of the seven `SensitiveOperations` keys are money keys:**
`payment.refund_approve` · `payout.export` · `payout.manage_account` · `business.lifecycle.manage`
(plus `business.transfer_ownership`, `team.assign_role`, `voice.number.manage`).

**Annotated in this area:** `ProviderBillingController` ×3 and `ProviderBookingPaymentController` ×1 carry
`[RequiresPermission(..., RequiresLiveAuthorization = true)]`.

‼️ **The ORDER is load-bearing.** The cached checks run FIRST, so an **ordinary billing endpoint pays ZERO
extra reads** and **a caller the cache already refuses pays ZERO** — the live read happens only for someone
who would otherwise be **allowed**. Pinned three ways by test.

‼️ **`payout.export` has ZERO endpoints today** — a catalogue key granted to Finance but carried by no
controller. Not a hole, but it is on the list so **the day an export endpoint appears, the convention test
forces it onto the live path.**

‼️ **STATED PLAINLY: there is still NO password step-up on payout KYC.** The owner chose the live-SQL
re-check **instead of** adding a step-up field, which would have needed a new control on the India KYC
screen in **both** provider apps (i.e. UI work and arguably the mockup gate). **Ownership transfer remains
the only step-up on the platform.**

### `payout.manage_account` is OWNER-ONLY (L40) — enforced, not documented

It is **not** granted to the Administrator template, so a compromised admin **cannot redirect the
business's money**. `business.transfer_ownership` is likewise **never grantable** (L19). ‼️ **Both are
enforced by build-failing convention tests**, and the cross-tenant matrix proves them:
`Finance_CannotChangeThePayoutAccount` and `AnAdministrator_CannotInitiateAnOwnershipTransfer`.

‼️ **A provider member reading another business's payout is structurally impossible** — the payout routes
carry **no `businessId`** and derive it from the token.

### `payment.record_offline` was ADDED to the catalogue (L66, ✅ approved)

`POST /provider/bookings/{id}/cash-paid` **moves money state with no gateway behind it**, and the Payment
module had only `read` / `refund_approve` / `dispute_respond`. ‼️ **Gating a money WRITE on a `*.read` key
is precisely the workaround §0.3 forbids.** Granted to Primary Owner, Administrator, Finance and
Operations Manager. Permissions are CODE (L55), so reversing it is an edit, not a migration.

### ‼️ Self-dealing is guarded on the money paths (L25)

`BaseController.IsSelfDealing(subjectCustomerUserNumber)` compares `booking.Customer.CustomerUserNumber`
(JSON `customerId`) against `TenantContext.UserNumber`, and is wired to
`ProviderBookingPaymentController.MarkRefundedInCash` and `ProviderDisputesController.Respond`.
**A member may legitimately be a customer of their own employer — the money guard is mandatory
regardless.** ‼️ `quote.approve_discount` has **no endpoint** (`Quote` carries no discount field); the
helper is shared and ready for whoever ships one.

### D9 — a suspended business is a SECURITY surface, and it is ENUMERATED

The Primary Owner reaches **billing ONLY**; every other member is blocked entirely; every operational
endpoint 403s **even for the owner**. `[AllowedWhenBillingOnly]` is class-level on
`ProviderBillingController` and **nowhere else**, enforced by a convention test.

‼️ **`ABillingOnlyToken_Is403OnEveryOperationalSurface` is a `[Theory]` over 13 operational paths** — the
owner's "no loopholes" instruction is met by **enumeration**, never by a UI that hides links. ‼️ **Phase 9
strengthened it: the billing-only gate is now re-applied on the LIVE snapshot too**, so a token minted
before suspension cannot reach a sensitive endpoint. And **a member of suspended Business A keeps full
access to healthy Business B** — suspension is per business, never per person.

### Seats are a billing concern (D3 / D7) — see `clinqet-provider-teams` §7

`team.seats` resolves through the existing `EntitlementService` / `SubscriptionPlan` machinery
(`BillingCatalogDefinition.EntitlementsForTier`, introduced in `CatalogVersion` 8; two plans since **v12**).
**Free 3 · Premium 50 — never unlimited.**

‼️ **A tier downgrade NEVER suspends anyone (D7).** `EffectiveLimit = max(tier, grant)` protects existing
members **permanently**; only **new invites** are blocked. Recorded as three columns on `Business`
(`ExtraSeatsAllowed` / `ExtraSeatsGrantedAt` / `ExtraSeatsReason`), written by a **guarded
`ExecuteUpdateAsync`**, never read-modify-write.

‼️ **`CanGrantSeat` is governed by the TIER limit, never the grant** (**L50**) — a build-failing convention
test blocks the tempting "simplification" to `Used < EffectiveLimit`. And ‼️ **accepting an invitation is
seat-NEUTRAL**, so the accept gate is `IsOverTierLimit`, not `CanGrantSeat` (**L102**) — the latter would
refuse the **last legitimate joiner on every tier**.

‼️ **`IBusinessSeatService` is registered ONLY in the Main API** (L51) — it needs `IEntitlementService`,
and the Identity host deliberately does not take the payments graph. That is also why the admin support
lookup's **business** half lives on the Main API (AD2).

### Financial notification routing (Phase 5) is unchanged and final

Provider-facing financial producers use `IBusinessCommunicationDispatcher`:
`BillingNotificationService` · `BookingPaymentService` · `BookingDisputeService` · `ChargebackService` ·
`PayoutNotificationService` · `AdminBillingConfigController`'s tax-override notification. Customer-personal
counterparts keep `ICommunicationDispatcher`.

The `Financial` routing class costs a **measured 5 SQL queries** per resolved event and is pinned by a real
`DbCommandInterceptor`. `EventId` is a **durable transition identity**, never a random dispatch-attempt id.

‼️ **The L94 swallow guard is CONDITIONAL (L119): name the row that is already committed, or do not
guard.** On the money paths the committed row is always nameable (the charge, the refund, the payout), so
these producers **do** guard — but do not copy the pattern to a producer whose notification **is** the work
product.

### ‼️ The invoice cross-tenant hole was a MONEY path (H3)

`CreateInvoiceRequestDto` carried a `[Required] BusinessId` on the **body** that `InvoiceService` used as
the **Cosmos partition key** — so a member of Business A could write an invoice into **Business B's
`Transactions` partition.** `[RequiresPermission]` **cannot** guard a body. The field is **deleted**; the
workspace is threaded from the signed token; and
`ProviderEndpointAuthorizationTests.NoProviderEndpointAcceptsABodyThatAssertsABusinessId` **fails the
build** on any recurrence. ‼️ **Check every money DTO against that rule before adding a field.**

---

## PHASE 10 PART 2 — the data/schema/persistence audit closed (2026-08-05)

> Phase 10 is **DONE**. Tree green at **13,842 / 0 / 0**. Schema added: **one** owner-approved Cosmos composite
> and nothing else. Full record: `member-provider/PROGRESS.md` → *PHASE 10 PART 2*; decisions **DA7–DA12**.

### ‼️‼️ A `BusinessId` CAN NEVER EQUAL A `UserNumber` — and a build-failing guard now enforces it

**D1** makes them disjoint by construction: six characters versus five, allocated from one shared namespace. So
`u.UserNumber == businessId` is **never** true — and it fails in the quiet direction, "not found".

**Four production sites asked it anyway**, all in the payments surface. The worst was
`AdminProviderPayoutsController.BusinessExistsAsync`, where it was **not a fallback but the only check**, so
Clinket support looking up any tenancy-path provider without a payout account was told **"No business found for
that ID"** — false, on a money question. Its own comment asserted the dead invariant as fact.

- ✅ The tenant is the SQL **`Business`** row. Resolve existence from `db.Businesses`, never from `Users`.
  `Business` has **no** global query filter (**L43**), so a suspended or closed business still resolves — which
  is what an admin lookup needs.
- ‼️ **The guard:** `Clinqet.API.UnitTests.Conventions.NoCodeResolvesAPersonFromABusinessIdTests` fails the build
  on the comparison in either direction, across all seven production projects. **Fix the call site, never the
  test.** One named exemption exists (`BroadcastMatchingService`, deferred to Phase 11) and it is pinned to its
  own defect, so it cannot outlive it.
- ‼️ **How it hid:** both fixtures seeded a `UserProfile` whose `UserNumber` WAS the businessId, so the two
  identifiers could not diverge. **Casebook CASE 1 / CASE 23.**

### ‼️ The provider inbox is KEYSET-paged — never add an offset page here

`GET /business/inbox` takes **`continuationToken`**, not `page`. `InboxPageDto` carries `NextCursor` and the six
tab counts, and **no** `TotalCount` / `Page` / `PageSize`.

- `IConversationRepository.GetInboxPageAsync(businessId, InboxPageQuery)` → `ConversationKeysetPage(Items, NextCursor)`.
- SQL: `SELECT TOP n * FROM c WHERE … ORDER BY c.type, c.lastMessageAt DESC, c.id DESC`, cursor
  `(c.lastMessageAt < @cursorAt OR (c.lastMessageAt = @cursorAt AND c.id < @cursorId))`.
- ‼️ **Why the `/id` tiebreaker exists:** `(type, lastMessageAt DESC)` alone cannot separate two conversations
  written in the same tick, so a cursor repeats or skips them — **and the sort would not bind in production**
  even though the emulator permits it (L12). The composite `(type ASC, lastMessageAt DESC, id DESC)` on
  `Communications` is owner-approved (**DA5**) and is the ONLY schema Part 2 added.
- ‼️ **Why not `OFFSET`:** Cosmos charges RU for the documents an offset skips, so offset paging is
  O(page depth). `SELECT TOP (page × pageSize)` was proposed, rejected and must not return.
- ‼️ **The query NARROWS; `IResourceScopeEvaluator` DECIDES** (DA8). Only `Assigned` and `Team` become SQL
  predicates because only those paths are indexed. `Branch` / `CreatedByMe` / `Participating` get **no** query
  narrowing and are decided entirely by the evaluator, with a bounded top-up loop refilling the page.
  **Never move an access decision into the query.**
- **Overdue is unchanged** (B8): a bounded read, sorted in memory, sliced by its own `(slaDueAt, id)` cursor.
  `GetInboxTabProjectionAsync` is still a full-partition read, by the owner's explicit choice.
- Cursor encoding lives once, in `Clinqet.Infrastructure.Data.COSMOS.Base.KeysetCursor` —
  `BusinessActivityRepository` delegates to it. **Do not write a second encoder.**
- A stale or mangled cursor is **400 + `invalid_continuation_token`**, never a silent ignore (AD8).

### ‼️ The composite-index guard is now self-verifying — trust it, but know what it checks

`CosmosCompositeIndexContractTests` had drifted: **five of 53 repositories were validated against the wrong
container's index policy** (`AiSession`, `BroadcastDispatch`, `Broadcast` are **`Communications`**; `Cart` and
`RecentlyViewed` are **`SystemData`**). Three changes:

1. `TheContainerMap_MatchesTheContainerEachRepositoryActuallyResolves` derives each container from the repository
   source and fails on divergence — the hand map can no longer drift silently.
2. `EverySingleColumnOrderByQuery_HasMatchingCompositeIndex` — ‼️ **`TypeFilterSql` puts `c.type = 'X'` on every
   repository query, so a ONE-column sort still needs a `(type, sortColumn)` composite.** 27 queries validated.
3. Line comments are blanked before scanning: writing the words of a sort clause in a comment between two string
   literals was being parsed as SQL.

> ‼️ **The lesson that cost the most: a wrong guard does not merely fail to catch bugs — it PROPOSES them.**
> Acting on the mis-mapped result, the audit first deleted a correctly-indexed sort from `AiSessionRepository`.
> **Verify the guard before you change the code it accuses.**

### ‼️ OPEN — owner decisions, NOT unfinished work. Do not "fix" either unilaterally

- **`BusinessStatus.Suspended` and `.Closed` are UNREACHABLE.** `Business.Status` is written in exactly one
  place (`BusinessProvisioningService:130`, `Active`, at creation). **D9's entire billing-only regime reads a
  state nothing produces.** The admin "suspend provider" action sets `BusinessProfileStatus.Suspended` on the
  **Cosmos** profile (marketplace visibility) and never touches SQL `Business.Status` (tenancy access) — and its
  own guard leaves outstanding bookings live, which argues they are deliberately separate axes.
- **Five indexed paths serve no query** (four of them array paths, costing one index entry per element on every
  write, forever): `ProviderData` `/serviceImages/[]/imageId`, `/images/[]/imageId`, `/documents/[]/documentId`,
  `/pricing/priceType`; `Reviews` `/images/[]/imageId`; `Messages` `/attachments/[]/attachmentId`. The nested-id
  lookups are done **in memory** by `PatchStableArrayItemByIdAsync`. Removing an `IncludedPath` is RULE ZERO.

### Two sweep techniques worth reusing

- ‼️ **A C#-property orphan scan LIES about Cosmos.** Any field written by `PatchOperation.Set("/jsonPath", …)`
  looks orphaned. Scan for the **JSON name too** — it moved this sweep's result from 18 false hits to 14 real ones.
- ‼️ **Widening a race is not fixing it.** A banner test gave an offer 2 seconds of life and slept it out; a
  loaded full-suite build outlasts 2 seconds, so it failed intermittently — and its own comment recorded that the
  window had already been widened once, from 120 ms. **Remove the elapsed time, do not lengthen it.**

---

## PHASE 11 PART 2 — the money/authorization audit (2026-08-05)

### ‼️ `BillingNotification` CARRIES NO `Language`. Do not put it back.

Every business notification is rendered **once per recipient** in `recipient.PreferredLanguage`, and
`BillingNotificationService.BuildRecipientRequest` has **no fallback left**. The old
`recipient.PreferredLanguage ?? n.Language ?? "en"` chain was unreachable, so **eleven database reads existed
purely to feed a value nobody consulted** — four of them inside per-item billing sweep loops.

**Deleted:** `BillingNotification.Language` (31 production + 5 test construction sites moved) ·
`SubscriptionBillingService.ResolveLanguageAsync` and its **10** call sites (10 Cosmos point reads per billing
run) · `AiAddOnService.LoadUserProfileAsync` and its 1 call site (1 SQL read on the top-up settle path) ·
`BuildChargedNotification`'s dead `lang` parameter.

‼️ **`SubscriptionBillingService`'s constructor is now 12 arguments, not 13** — `IBusinessProfileRepository`
was its only consumer via `ResolveLanguageAsync`, so the whole dependency fell out. Four unit-test `Build(...)`
helpers were updated.

‼️ **`LoadUserProfileAsync` legitimately SURVIVES in two places and must NOT be swept up:**
`BookingPaymentService` loads a **CUSTOMER's** own language on the Flow-B path (not a `ResolvedRecipient` at
all), and `PaymentMethodService` loads name/email/phone for **Razorpay checkout prefill**. An early version of
the guard flagged both, and **the guard was wrong, not the code** (casebook CASE 22).

**Guard:** `Conventions/ResolvedRecipientAlwaysCarriesALanguageTests.cs` — a source scan plus a reflection test
that `BillingNotification` has no `Language` property, making the deleted fallback *inexpressible*.

### ‼️ A FOURTH encoded-defect test lived here

`SubscriptionBillingServiceTests:247` asserted `Assert.Equal("gu", sent!.Language)` with the comment
*"provider language, not hardcoded en"* — **asserting a field nothing ever read**, and giving false confidence
that a payment-failure notice was delivered in Gujarati. The real per-recipient behaviour is pinned by AZ3's
product-label tests. **When a fix turns a test red, ask FIRST whether the test was asserting the bug.**

### ‼️ The payments `language` PARAMETERS are an OPEN OWNER DECISION

The database reads are gone, but `language` remains a parameter on roughly ten `IAiAddOnService` /
`ISubscriptionService` **public** methods where it may now be unused. Removing it is a public contract change
across controllers, functions and tests. **Scope it deliberately or ask — do not half-do it.**

### ‼️ `analytics.read` vs `insights.read` — also an owner decision

`AnalyticsController` and `DashboardController` gate on **`insights.read`**. `analytics.read` exists in the
catalogue with **different** grants (`sales_representative` holds `insights.read` but not `analytics.read`),
so re-pointing either endpoint **removes access a role has today**.

## ‼️ `Payments:Regions` — EMPTY default, NO base value, boot check (2026-09-17)

Proven through the real binder: the old class default `us,ca,in` plus the same base appsettings list bound the India
stamp's `Payments__Regions__0=in` as `us,ca,in,in,ca,in` (NA: `us,ca,in,us,ca,in`) — **every stamp seeded and let its
admins edit every region's billing**. Now: `PaymentSettings.Regions = new()`, no `Regions` in the API's base
`appsettings.json`, local runs get `[us, ca]` / `[in]` from `appsettings.{ca,in}.json`, the integration factory pins all
three, and `PaymentServedRegions.Validator` (registered in the API host ONLY — Functions binds PaymentSettings but never
reads Regions) refuses to boot on an empty, repeated or unknown list. `PaymentServedRegions.Of` is the one normalised
reading; it also scopes the voice own-number settings. Guard: `PaymentServedRegionsConventionTests`.

## 2026-09-23 — explicit SQL/catalog setup for new environments

`cosmosindexsetup` now references the shared Infrastructure library and runs pending EF migrations,
then the existing `BillingCatalogSeeder`, then verifies the catalog version and all six catalog families
before normal Cosmos/Search setup. `--all-regions` visits ca then in; `--sql-only` limits the run to SQL.
Search/synonym-only and service-description migration modes do not run SQL schema migrations or billing seeding.
The setup tool uses `ConnectionStrings:IdentityDb`; the APIs keep `ConnectionStrings:DefaultConnection`.
Regional `Payments:Regions` is ca=[us,ca], in=[in], with no base list. `SeedData:Enabled=false` does not disable
required billing seeding. The automation's setup paste block is nested JSON, includes Environment and
Payments.Regions, and uses the same stamp region list as the API's existing environment variables.

API startup behavior is unchanged: one seed attempt per process start, errors logged, next start retries.
A migration applied while the API is already running does not trigger the startup task again. Prefer setup
before application traffic; otherwise restart the API after migrations or run setup with `--sql-only`.
Existing migrations are never regenerated or edited. Billing seeding is insert-only at every catalog version;
existing admin prices, pending prices, entitlements, taxes, fees and inactive products are preserved. Environment/database mismatch and two
stamps resolving to one SQL target are refused before writes. See the setup project's
SQL Server Testcontainers tests, including failed startup -> migrate -> restarted seed task -> success.

## ‼️ Minute packs follow the AI engine (2026-09-25) — plan `Data/topup-engine-rules/PLAN.md`

Three owner-approved rules: only the live engine's pack can be bought; auto-recharge never buys the wrong pack or at a price
the provider did not agree to; leftover pack minutes keep their money value when the engine changes (today's prices,
rounded down, included plan minutes never move). Sheet: `Data/mockups/ai-engine-switch-minutes/index.html`.

- **One rule set — `TopUpPackRules` (clinqetcore/Models/Payments).** `Refusal` (`pack_unavailable` / `pack_engine_mismatch`),
  `EffectivePriceMinor` (A8 staged price — every top-up charge, quote and overview price now uses it), `BestValuePack`
  (today's price of a minute = the engine's cheapest-per-minute sellable pack), `TryConvertMinutes` (Int128, floor, same
  currency or refuse), `ResolveAutoRecharge` / `SwitchOutlook` / `AlignAfterEngineChange`. Never re-derive these inline.
- **Every buy path refuses the other engine's pack:** `PurchaseTopUpAsync`, `InitiateTopUpOrderAsync` (the Pending tx stores
  `TopUpModelTier`), `QuoteTopUpAsync` (null; it now also needs a live holder, like the purchase), `SetAutoRechargeAsync`.
  Controller maps `pack_engine_mismatch` → 400 `Error_TopUpPackEngineMismatch`.
- **Schema (approved):** `MinuteLedger.ModelTier` (the engine a pack minute serves; null on included) and
  `BillingTransaction.TopUpModelTier` — migration `20260925214559_AddMinuteEngineLabels`. New entry type
  `MinuteLedgerEntryType.PackConversion` counts in the cap SUM.
- **Conversion lives in the LEDGER.** `ProjectCapToVoicelineAsync` first runs `ConvertLeftoverPackMinutesAsync` (also public, for
  the trial path whose cap must not be projected outside its grant month). Replay: included minutes (IncludedGrant +
  Adjustment) are used first, pack minutes oldest first; a conversion writes an `out` row (old engine, minus everything it
  held) and an `in` row (live engine, converted), keyed `packconv_{biz}_{period}_{seq}:{engine}:out|in`; the `out` row is a
  CHECKPOINT in `RemainingPackMinutes`. The ledger announces every conversion (`NotificationType.AiMinutesConverted`,
  EventId = the key) and raises `RaiseTopUpPackPricingMissingAsync(biz, region, from, to)` when an engine has no priced pack
  (nothing moves until the catalog is fixed; the next projection retries). Unlabeled minutes never move.
- ‼️ **Every pack-row write (top-up, carry-over, conversion) runs under ONE per-business SQL app-lock** (`minuteledger:{biz}`,
  transaction-owned, inside the execution strategy) with commit-ordered `CreatedAt` (max(now, latest + 1 tick)). The replay
  depends on rows being ordered as they were really written, whatever a host's clock says. Never add a pack-row write outside
  `WriteLockedAsync`. InMemory tests run the same body unlocked.
- **Carry-over is per engine**, keyed `carryover_{biz}_{toPeriod}_{Standard|Advanced|unlabeled|included}` (the old note-based
  dedup is gone).
- **Engine switches.** Immediate switches (upgrade, eligible trial switch, trial → paid on a new tier, a fresh purchase with
  leftover minutes) REFUSE with `minute_conversion_unavailable` when the leftover cannot be valued — except an upgrade already
  paid for (`aiupgrade_…` succeeded), which always completes. `ChangeAddOnTierAsync(…, keepAutoRecharge)` /
  `ChangeAiAddOnTierRequestDto.KeepAutoRecharge` carries the switch dialog's yes to a pricier same-size pack. A boundary
  downgrade (and a crash-recovered trial conversion) aligns auto-recharge in `FinalizeAddOnRenewalAsync` with no consent
  possible, so a pricier pack means off. A switched-off auto-recharge KEEPS its pack id; the overview reports
  `autoRecharge.pausedReason = EngineChanged` (and `enabled` = saved && the pack will buy).
- **Quotes** carry `MinuteConversion` (+ `Available`) and `AutoRecharge` (`Continues` / `NeedsConsent` / `TurnsOff`); a
  Scheduled quote maps NeedsConsent → TurnsOff.
- **UI.** Web: `EngineSwitchDetails` in every AI switch dialog and the AI purchase modal (confirm disabled while a move is
  unavailable); `TopUpAutoRechargeSection` shows the paused note and, on `pack_engine_mismatch`, closes the checkout and
  reloads the live engine's packs. Mobile (info-only): `mapTopUpMinutes(topUps, engine)`; both notices deep-link to Plan & Billing.
- **Tests.** API unit: `TopUpPackRulesTests`, `MinuteLedgerServiceTests`, `AiAddOnServiceTests`, `BillingCheckoutQuoteTests`,
  `SubscriptionBillingServiceTests`, `ProviderBillingRefreshTransactionTests`. Functions unit: `AutoRechargeEngineRuleTests`.
  Real SQL: `TopUpEngineIntegrationTests` (API — engine columns, conversion keys, concurrent projections convert once,
  carry-over keys) and the webhook late-settle test in `PaymentWebhookProcessorIntegrationTests` (Functions).

## ‼️ Overdue payments — settle first (2026-09-26) — plan `Data/topup-engine-rules/FOLLOWUPS-PLAN.md` §G

Owner decisions 2+3 (2026-09-26) **reverse the 2026-07 §2.5 ruling** that let an overdue holder change tier. An overdue bill
is settled by paying THAT bill; nothing else is bought for that product until it is. Overdue = a live holder in `PastDue`
(a declined renewal or trial conversion under dunning, or an India AutoPay that cannot be debited).

- **G1 · Refusals (server-side; the UI hides them too) → `past_due` / `Error_PastDue`:** AI purchase and re-purchase, AI
  engine change, AI immediate annual switch, plan subscribe / tier change / annual switch (`SubscribeAsync` refuses a
  PastDue holder BEFORE routing), packs (`TopUpAvailability.SettlePaymentFirst`), auto-recharge buys (Active only). Quotes
  for a PastDue holder return null (quote == charge). Turning auto-renewal off stays allowed — nothing is bought.
- **G2 · Pay now — `POST provider/billing/pay-overdue` `{ product }`** → `ISubscriptionBillingService.RetryOverduePaymentAsync`
  → `OverduePaymentResult(Outcome, FailureCode)`. It runs INLINE in the API (the bank's reason must reach the screen) through
  the same renewal code and the SAME charge key as the scheduled retry (`addon_{id}_{period}_a{FailedChargeCount}` /
  `sub_…`), so Pay now racing the sweep is one charge (`BillingChargeService` re-arms a declined key under a RowVersion CAS).
  Mapping: Paid → 200 `Success_OverduePaid` · Processing → 200 `Success_OverduePaymentProcessing` · NotOverdue → 200
  `Success_NothingOverdue` · Declined → 402 `Error_PaymentDeclined` · NeedsPaymentMethod → 400 `Error_OverdueNeedsPaymentMethod`
  · NeedsMandate → 409 `Error_OverdueNeedsAutoPay` (400 `Error_MandateCapExceeded` when the code is `mandate_cap_exceeded`) ·
  TryLater → 409 `Error_OverduePaymentTryLater`. ‼️ **A card decline is never a dunning step** — grace and schedule stay.
  India: the bank answers later, and a Pay now it then rejects counts as the next dunning step (it cannot be told apart
  from the scheduled one). The grace end never moves.
- **Automatic retry** when a new default can pay: card confirm / set default / a remove that promotes another method (API)
  and mandate activation (webhook, including the create-on-activate race) call
  `IOverduePaymentRetryScheduler.ScheduleAsync(businessId, paymentMethodId)` → one `SubscriptionChargeMessage` with
  `RetryWithPaymentMethodId` per overdue holder (message id `overdue_{holderId}_{pmId}`). The engine charges only while that
  method is STILL the default; a decline sends the payment-failed notice with event id
  `billing:{addon|subscription}:{id}:payment-failed:{FailedChargeCount}:{pmId}`. The API answers
  `Success_BillingDefaultPaymentMethodUpdatedRetrying` / `Success_BillingPaymentMethodRemovedRetrying` when a retry was queued.
- ‼️ **An India AutoPay that cannot be debited** (`mandate_not_active`, above the mandate cap) → `AwaitMandateAsync`: PastDue
  from day one, **no attempt burned**, `GraceUntil ??= now + GraceDays`, `NextChargeAt = now + RetryOffsetsDays[0]`, the
  payment-failed notice on each pass (deduplicated by event id), packs carried and the line re-projected; once the grace
  has passed, the normal dunning downgrade. This replaced a deferral that never ended (free minutes and a free tier
  forever). The heal paths key on `Status == PastDue` alone.
- **G3 · Minutes follow payment.** While overdue the cap is pack minutes + a PAID month's rollover — never the unpaid month's
  included minutes, never a failed conversion's trial leftovers. Packs are carried at the failure (keyed); on success the
  month lands in the same save as the period advance (A1).
- **G4 · A bank payment still settling counts as paid — through the CAP, never a grant.** `LineCapAsync` = paid-for +
  `IncludedMinutes` while the renewal charge is Pending/Processing. Nothing is granted before the money is final, so a
  rejection needs no reversal row. The answer is handed back by the webhook and the reconciliation poll through
  `IRecurringSettlementPublisher.PublishAsync(tx)` → `SubscriptionChargeMessage.SettledTransactionId` (message id
  `settled_{txId}`, period read from the charge key) and the engine finalizes at once. Reconciliation polls pending renewals
  after `Payments:AsyncSettlementPollAfterHours` (6); `AdminAlertType.RenewalPendingLongLived` fires after
  `RenewalPendingAlertAfterHours` (72) when `RenewalPendingAdminAlertsEnabled`. The async marker `FailureCode = "pending"` is
  retired on every final status (webhook by intent and by charge id, reconciliation).
- **Overview DTO:** `aiAddOn.paymentProcessing` / `finalRetry`; `subscription.nextChargeAt` / `finalRetry` / `paymentProcessing`.
  `finalRetry` = PastDue && !CancelAtPeriodEnd && (FailedChargeCount + 1 ≥ `MaxDunningAttempts` || NextChargeAt > GraceUntil).
- **The notice is two.** `NotificationType.SubscriptionPaymentFailed` renders `SubscriptionPaymentFailed_Ai` ("your AI
  Assistant is paused · calls still reach you · Pay now") or `SubscriptionPaymentFailed_Plan` ("your plan stays on"); both
  name the next try (`DateFields["date"]`, email `{{Date}}`). Email templates ×5 languages; the shared one is deleted.
- **Surfaces.** Web `Billing.jsx`: `OverdueActions` (Pay now in brand green + Update card), `OverdueNextTry`, "Trying your
  payment…", the bank-processing state (blue), the last-try warning, the plans grid's "pay first"; `PaymentMethodsSection`
  reports changes (`onMethodsChanged`) and a card saved while overdue shows the retrying note plus one follow-up refresh.
  Provider app (information only, no Pay now): `billingLines.ts` (`aiBillingLine`, `planRenewLine`) and the server's
  sentence on card changes. Sheet: `Data/mockups/topup-availability/index.html` frames 10–18.
- **Tests.** Functions unit: `SubscriptionBillingOverdueTests`, `RecurringSettlementPublisherTests`,
  `SubscriptionBillingServiceTests` (the AutoPay theory + grace), `PaymentWebhookProcessorTests` (hand-back, mandate → retry).
  API unit: `ProviderBillingPayOverdueTests`, `OverduePaymentRetrySchedulerTests`, `PaymentOpsAlertServiceRenewalPendingTests`,
  reconciliation, ledger caps, refusals, notices. Real SQL (Functions): `OverdueSettleFirstIntegrationTests`,
  `PaymentWebhookMandateRaceIntegrationTests`. Web: `OverdueSettleFirst.test.jsx`, `Billing.payOverdue.test.jsx`. App:
  `overduePlanLines.test.ts`.

## Notices state the billed period and the exact debit (2026-09-26)
- **India pre-debit notice (RBI, `ProcessDebitRemindersAsync`) = what the renewal at `NextChargeAt` will take**: the engine a scheduled downgrade lands on (`PendingModelTier`; plan `PendingTier` was dropped 2026-10-05), the catalog price in force AT the charge date (`EffectivePriceMinor(…, chargeAt)`), the holder's interval (annual derived from the MONTHLY catalog price — never from `PriceMinor`, which already IS the year's price), the discount `ResolveChargeDiscountAsync` resolves, then tax (`ITaxCalculationService`; discount first, the charge's own order). Nothing to debit (missing catalog row ⇒ the renewal defers; a discount covering it all) ⇒ no notice and the date stays unstamped. Plans grandfathered past the debit are excluded. Guards: `SubscriptionBillingDebitReminderTests`, real-SQL `SubscriptionBillingDebitReminderIntegrationTests`.
- **"per month / per year"**: every price notice (trial started, trial ending with a card, price change) carries `Fields["interval"]`; `BillingNotificationService` renders it per reader (`Billing_PricePeriod_{Month|Year}`) into `{{PricePeriod}}`. A new producer of these types MUST pass the interval (tests pin all six producers).
- Billing names are pinned to `Data/localization/GLOSSARY.md` on all three surfaces: `BillingGlossaryPinTests` (backend), `billingNamesGlossary.test.js` (web), `billingNamesGlossary.test.ts` (app).

## ‼️ A REFUND IS ITS OWN ROW — and the webhook is the only place it can be recorded (2026-09-27)

Plan `Data/topup-engine-rules/FOLLOWUPS-PLAN.md` §K (owner-approved). **Clinket has no refund button**, so every
provider refund is issued by a human in the gateway's dashboard and arrives only as a webhook.

- `IProviderRefundRecorder` writes a **separate `BillingTransaction` of `Type = Refund`**, keyed
  `IdempotencyKey = refund_{gatewayRefundId}` — the unique index is what makes a redelivered webhook a no-op
  instead of a second refund. The charge's status is **derived** from the sum of its refunds
  (`Succeeded` → `PartiallyRefunded` → `Refunded`), never set directly, and tax is reversed **proportionally**.
- ‼️ **Money that went back stays back.** `BillingTransactionStatusTransitions` refuses
  `Refunded|PartiallyRefunded → Succeeded`: a late or duplicated success webhook must never erase the only record
  that the provider was repaid.
- **The two rails disagree about what "amount" means**, and both are read: Stripe's `charge.refunded` carries the
  **cumulative** `amount_refunded`, Razorpay's `refund.processed` carries **this refund's own** `amount`.
  `ResolveAmount` reconciles them and falls back to "the rest of the charge" when neither figure arrives.
- **India minute packs store the ORDER id and no charge id**, so the charge is matched by charge id *then* by order id.
- A refund that matches no Clinket charge is **never swallowed** — it raises `PaymentWebhook.RefundUnmatched`.
- Tests: `ProviderRefundRecorderTests` (12) + real-SQL `ProviderRefundRecorderIntegrationTests` (§0.8 — the
  idempotency key and the status floor cannot be proved on EF InMemory).

### ‼️ TWO paths enqueue a receipt, and eligibility has exactly ONE definition

`Core.Models.Payments.ReceiptEligibility.HasReceipt(type, amountMinor, discountAmountMinor)`. A copy of that rule
in the second place is precisely how the second path went quiet for months:

1. **`BillingChargeService`**, when the rail settles synchronously (cards). This was the only sender.
2. **`PaymentWebhookProcessor`**, when the bank answers later — ‼️ **India netbanking/UPI renewals and minute packs
   got no receipt at all** before 2026-09-27. It enqueues **only when `settledTx` is non-null**, which is true only
   when *that* webhook made the transition, so a card charge already receipted synchronously gets no second one.
   Same deterministic `receipt_{txId}` message id ⇒ a redelivery is deduplicated.

A refund adds a third: `BillingReceiptKinds.FlowARefund` → the credit note, keyed `refundreceipt_{refundTxId}`.

### ‼️ The receipt IS the email for a successful charge — do not let the fan-out add a second

`SubscriptionCharged` / `AiAddOnActivated` / `MinuteTopUpPurchased` carry **no** email template on purpose, and
set `CommunicationRequest.EmailDeliveredElsewhere`. Without that flag the mandatory-email fallback substitutes a
generic `BusinessNotification` email beside every receipt. See `clinqet-notifications` for the rule and the
alternative that was rejected.

### Canada receipts are bilingual (2026-09-27)

`ReceiptLanguages.ForRegion(region, buyerCountryCode)` ⇒ French page **then** English page in one PDF for region
`ca`; English only for `us`/`in`. One receipt number across the PDF, the file name and the email
(`ReceiptNumbers.For`). The "PAID" stamp is replaced by the refund state on a refunded charge.


### ‼️ CLINKET HOLDS MANY TAX REGISTRATIONS PER COUNTRY — one row per (region, subdivision) (2026-09-27)

`SellerTaxRegistration` is **Clinket's OWN** account — the receipt ISSUER. It is NOT the provider's number; that is
`BusinessProfile.PaymentConfig.TaxRegistrationNumber`, per-provider, printed on the provider's own invoices.

- ‼️ The old schema said "one active row per region". **That was wrong**: Canada is a federal GST/HST account **plus a
  separate Quebec QST account** (plus a PST account in any province Clinket registers in), and India is one GSTIN per
  state. The table now carries a nullable `SubdivisionCode` — **NULL = the region-wide row, which is the issuer** —
  keyed by a filtered unique index on `(Region, SubdivisionCode) WHERE IsActive = 1`. Mirrors `TaxRule` exactly.
- ‼️ **Two `Secondary*` columns were REJECTED** as the shortcut they are: they hard-code "at most two" and cannot say
  WHICH province a number belongs to, so an **Ontario** receipt would print the **Quebec** QST number.
- `GetApplicableAsync(region, taxJurisdiction)` is the ONLY lookup — region-wide first, then the province row when
  the buyer was taxed there. The jurisdiction is the value **FROZEN on the transaction** (`"CA-QC"`), never the
  provider's live address. One cached read per region serves both halves, so they cannot expire out of step.
- **Retiring is soft** (`DELETE /admin/billing-config/seller-tax/{id}` sets `IsActive = false`): past receipts stay
  explainable and the filtered index frees the slot for a successor. Without it an obsolete number printed forever.
- ‼️ SQL Server treats NULLs as EQUAL in a unique index, which is what still makes the region-wide row unique —
  **proved on real SQL** in `SellerTaxRegistrationIndexIntegrationTests` (§0.8: EF InMemory enforces no index, so
  every assertion there would pass whether or not the index exists).

### ‼️ A COMBINED CANADIAN TAX PRINTS AS SEPARATE AMOUNTS — derived, never stored

Quebec is stored as ONE rule (`GSTQST`, **1497 bps, deliberately floored** from 14.975% so the platform never
over-collects). Revenu Québec wants GST and QST shown separately, so `Core.Models.Payments.TaxComponents.Split`
derives the two lines from the frozen `TaxLabel` + `TaxRateBps` + `TaxAmountMinor`.

- **Derived, not stored**: the component rates are legislated, so they live in C# (§0.7), never in a row an admin
  could desynchronise from the rule that was actually charged. Four labels split: GSTQST, GSTPST7, GSTPST6, GSTRST.
- ‼️ **The split REFUSES itself** when the charged rate no longer matches the sum of its parts (tolerance 0.01% — the
  Quebec floor). So a receipt reprinted after a legislated rate change prints the single combined line it always did,
  rather than a split that never happened.
- ‼️ **The parts always add up to the money actually taken**, to the minor unit: the last component absorbs the
  rounding. A receipt whose lines do not sum to its total is worse than one that never split.
- A province registration names its jurisdiction on the receipt (`PDF_SellerTaxNoInSubdivision`), because two numbers
  both labelled "Tax reg. no." say nothing. The admin's free-text label still leads on a MONOLINGUAL receipt only.
## Subscription and assistant state refresh (2026-09-27)

- Provider web and native both use `services/providerStateEvents`: subscription, AI add-on, minute-balance and voice lifecycle notifications invalidate the corresponding demanded caches. SignalR single, batch and replay handlers dispatch once per payload; unrelated notifications do not trigger these reads.
- Web `VoiceAssistantContext` and `BillingOverviewContext` serialize forced refreshes behind an existing request and reject responses from an older mutation or workspace/session. Native `hooks/useVoiceAssistantState` and `services/billingOverviewService` mirror that rule; native plan-summary listeners update mounted Profile, Plan & Billing, dashboard and Call Follow-ups readers.
- AI gates revalidate when entered again, including when a cached promo prevents the screen content mounting. Web visibility/online and native foreground refresh recover missed notifications. An unused cache stays lazy; a previously failed requested cache can recover on the next event. Package/access gates remain in effect.
- A cached `NotInvited` is cleared during enrollment revalidation, so a failed refresh becomes unknown/retry instead of retaining the purchase promo. A known assigned/active state and known allowance survive transient read failures. `hooks/useVoiceUsage` updates mounted usage readers without remounting; an unavailable read is not evidence of no plan.
- Successful web subscription client mutations refresh assistant lifecycle; their existing callers still refresh the billing overview. No gateway, price, ledger, endpoint, schema or charge behavior changed.
- Dashboard lifecycle/setup widgets read the shared assistant state, not the stale business-profile projection. Native activity uses the server status `Active`.
- Setup layout uses available content width: number mode on the left, language plus reach-you phone on the right when space allows; one column on narrow screens. Manage mode preserves its separate layout. Assigned web number/actions move to the right at 800px container width and lead on narrow layouts. Native form columns use measured width and font scale, retaining native phone keyboard/pickers. Revalidation preserves unsaved form edits.
- Regression coverage: web `src/context/providerStateRefresh.test.jsx`, `src/hooks/useVoiceUsage.test.jsx`, SignalR teardown tests and voice-form validation; native `__tests__/providerStateRefresh.test.ts`, `aiSurfaceFocusRefresh.test.tsx`, `voiceUsageRefresh.test.tsx` and `voiceApplicationValidation.test.tsx`. These exercise real caches/gates with mocked transports, stale in-flight responses, notification batches, offline recovery, workspace purge, feature/access gating and unsaved edits.

## Trial reminders and trial messages — ONE platform rule (2026-10-02)

Owner-approved decisions 1–9 (2026-10-02). Checklist + closing audit: `C:\Nik\Data\trial-reminders\PLAN.md` and `AUDIT.md`.
‼️ This REPLACES the per-offer "Remind the partner" lead. `TrialOffer.ReminderLeadDays` is DROPPED (migration
`RemoveTrialOfferReminderLeadDays`; DTOs, the admin form and `ResolvedTrialOffer` lost it). The `Payments:Trial` /
`ReminderLeadDays` text in the 2026-06 trial section above is history: trials come from admin `TrialOffer` rows.

**The rule** (`TrialReminderSchedule`; settings `Payments:TrialReminders`, Functions appsettings only; class defaults mirror):

| Card on file at the run | Trial length D | Notice |
|---|---|---|
| yes | D > `CardLongTrialMinDays` (7) | `CardLongLeadDays` (7) — the card networks' rule, never delayed by quiet hours |
| yes | D ≤ 7 | `CardShortLeadDays` (3) |
| no | any | `NoCardLeadDays` (3) |
| any | D ≤ the notice above | `ShortTrialLeadDays` (1) |
| any | D < `MinTrialDaysForReminder` (2) | none — the trial-started message says everything |

- D = `TrialEndsAt − CurrentPeriodStart` (a trial row's period starts with the trial; fallback `TrialDaysGranted`).
- Due at the LAST daily run that still leaves the full notice: `TrialEndsAt ≤ now + lead + 1 day` and `TrialEndsAt > now`;
  never within `QuietHoursAfterStart` (12) of the start, except the 7-day card notice. A missed run sends late, never twice.
- "Card on file" = any ACTIVE saved method (`TrialReminderRearm.HasCardAsync`; a pending India mandate counts).
- `PaymentSettingsValidator` refuses to boot on a rule that cannot work.

**Where it runs:** `TrialReminderFunction`, its own timer `%TrialReminders:TimerSchedule%` (local.settings ×3, deploy.ps1 in both
blocks and the required list): CA/US `0 0 14 * * *` (10:00 Toronto, 09:00 in winter), IN `0 0 4 * * *` (09:30 IST). It is off
with `SubscriptionBilling:Enabled`, and `ProcessTrialRemindersAsync` returns at once when `BillingChargesEnabled` is off (no
trial can end, so a reminder would promise a charge that never comes). The billing sweep no longer calls it.

**The sweep** (`SubscriptionBillingService.ProcessTrialRemindersAsync`): Trialing, `!CancelAtPeriodEnd` (the auto-renewal-off
notice is the notice), unstamped, ending within the widest lead + 1. Plan and AI trials alike (the `!PromoEnabled` condition went with the promo grant, 2026-10-04). Per row:
card state → `IsDue` → `ITrialChargeQuoteService.QuoteAsync` (null ⇒ the trial ends without a charge ⇒ no reminder, row left
unstamped) → stamp `TrialReminderSentAt` under the RowVersion CAS → `SubscriptionTrialEndingSoon` with `TrialCharge`. The EventId
carries card/no-card, amount and interval, so a re-armed reminder that says something new is never de-duplicated away. Each row
has its own error boundary (logged; retried next run).
- India: `ProcessTrialPreDebitRemindersAsync` in the same run — Razorpay trial, active mandate, ending within
  `DebitReminderLeadDays`: the card notice again (`:trial-predebit:`), stamped on `RenewalReminderSentForChargeAt`; skipped when the
  main reminder went within `DebitReminderLeadDays + 1` days.
- Price changes: `ProcessPriceChangeNoticesAsync` now includes Trialing holders (`DuringTrial` ⇒ trial copy) and skips
  `CancelAtPeriodEnd` holders (resuming leaves the marker unset, so they are told then).

**The amount** — `TrialChargeQuoteService` mirrors `EndAddOnTrialAsync` / `EndSubscriptionTrialAsync` step for step: the catalog
price effective ON the trial end (a pending raise if effective by then), yearly via `AnnualPricing`, plan by `PlanId`, AI by entitlement region + `ModelTier`, a promo off the pre-tax amount, then tax. `TrialChargeQuote(FirstMinor, ThenMinor?,
FirstPeriods, Currency, Interval)`; `ResolveRenewalOutlookAsync(periodsConsumedNow: 1)` says how long a promo lasts (no end ⇒ no
"then"). Rendered per recipient as ONE phrase — `Billing_PriceEvery_{Month|Year}`, `Billing_PriceFirstThen_*`,
`Billing_PriceFirstNThen_*` — so each language orders its own amount and period. Used by the reminder, the trial-started notice and
the resumed-during-trial notice. ‼️ Trial start and resume take the quote BEFORE their save: a failed quote must not leave a
started trial (or a resumed renewal) whose message never goes, because the retry finds the work already done.
`Quote_IsExactlyWhatTheConversionCharges` runs the real conversion on the same row and pins the quote to the charge.

**Re-arming** (`TrialReminderRearm`): a sent reminder stops fitting when what happens at the end changes.
`AfterCardChangeAsync(dbFactory, …)` runs after every way a saved method appears or disappears — `PaymentMethodService`
`ConfirmSetupIntentAsync` / `RemoveAsync`, webhook `FailMandateAsync` / `RevokeMandateAsync` / `CreateMandateOnActivateAsync` — and
clears the stamp ONLY on card ↔ no card. ‼️ It opens its OWN context: in the caller's, `SwapDefaultAsync`'s ExecuteUpdate leaves the
tracked method stale, the save threw a concurrency error and the re-arm was silently lost — found by the real-SQL test, invisible
on InMemory. `Rearm(row)` runs inline on a mid-trial plan switch, engine switch and interval switch (the quoted price changed).

**Messages** (five languages, plain words): trial started `_Card` / `_AiNoCard` / `_PlanNoCard` (by `HasPaymentMethodOnFile`); trial
ending `_Card` (date, amount, how to cancel) / `_PlanNoCard` / `_AiNoCard` / `_AiNoCardNumber` (names the number and its release day
in-app and by email); auto-renewal off `_Trial` / `_TrialNumber` / `_Number`; `TrialAutoRenewalResumed` (`_NoCharge` when the trial ends
without a charge, so no price is named);
`SubscriptionPriceChangeScheduled_Trial`. New emails compose from the shell (`Content`); `SubscriptionTrialEndingSoon_PlanNoCard`
keeps its own layout (its founder block was removed 2026-10-04). ‼️ `DowngradeAddOnAsync` skips its own notice (`SkipEmail` + `SkipInApp`, admin alert
kept) when `NumberNoticeTellsSwitchOffAsync`: the number's hold notice already says the assistant is off AND names the deadline.

**WhatsApp** (created 2026-10-02, UTILITY, both WABAs): `clinket_trial_ending_paid` and `clinket_subscription_renews_soon`
(`[firstName, product, date, price]`, button `…/dashboard/{{1}}` = `billingPage`), `clinket_payment_retry_billing`
(`[firstName, product]` + `billingPage`), `clinket_ai_number_trial_ending` and `clinket_ai_number_on_hold` (the old texts byte for
byte; buttons open `/dashboard/ai-billing`). They replace — and the old ones were deleted from Meta and code —
`clinket_plan_renewal_notice`, `clinket_ai_number_at_risk`, `clinket_ai_number_held`, `clinket_payment_retry_notice`.
`ApprovedLanguages` = all five languages, like every template: pre-launch, the owner gets each approved as UTILITY at Meta
and the code is never trimmed to Meta's progress (`Data/whatsapp/README.md` JOB 7).

~~**Sunset heal**~~ — deleted with PromoSunset (2026-10-04).

Tests: Functions unit `TrialReminderScheduleTests`, `TrialReminderSweepTests`, `TrialChargeQuoteServiceTests`,
`TrialReminderFunctionTests`, `VoiceNumberNotifierTests`, the webhook re-arm theory; API unit renderer,
trial start/cancel/resume and mid-trial switch tests; real SQL `TrialReminderIntegrationTests` (real quote over the catalog, two
racing runs, re-arm, India, the dropped column) and `PaymentsIntegrationTests.CardStateChange_RearmsTheTrialReminder_OnlyOnARealChange_OnRealSql`.
