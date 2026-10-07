# Two plans — Free + Premium (owner-approved 2026-10-04)

Premium = everything the old Premium Max had. Basic and Premium Max are deleted. No "room for a third plan" —
code reads entitlements (features), never plan names.

## Locked decisions

| # | Decision |
|---|---|
| D1 | `SubscriptionTier { Free, Premium }` |
| D2 | Monthly: us 499 · ca 599 · in 29900 (minor). Yearly = existing `AnnualBilling` rule, PlanMode `MonthsFree` × 2 ⇒ $49.90 / C$59.90 / ₹2,990 |
| D3 | Premium entitlements = old Max, EXCEPT `whatsapp_template_cap` 200/day (Free 10) |
| D4 | `leads_priority` Premium 1 / Free 2. Wave 1 = Premium (+ floor fill to `MinProvidersToServe` 15). Free wave at `FreeDelayMinutes` = 30 |
| D5 | `leads_quota` Free 5 (admin-editable). 0 = zero normal leads (was: unlimited — bug). null = unlimited |
| D6 | RESCUE: a lead row in wave 1 under the Tiered strategy is a rescue lead. Counts toward the quota while under it; past the cap it is still allowed and NOT counted |
| D7 | Over-quota Free, non-rescue lead: NO WhatsApp / email. Push + in-app only when `Broadcast:Matching:NotifyOverQuotaLeads` (default false — owner-approved exception). Inbox shows a locked "monthly limit reached" card. One notice when the 5th lead is used |
| D8 | Promo grant (`PromoEnabled/PromoGrantTier/PromoExcludeFeatures`) + the whole PromoSunset/founder feature DELETED. Trials only via admin Promo & Offers (opt-in) |
| D9 | Paid Pro/TopPro badges + `badge` entitlement + `TierBadgesEnabled` DELETED. Premium homepage slides labelled "Sponsored". Customer search gets a "How results are ranked" note |
| D10 | Search boost Premium 1.025 (old Max). Banner Premium. Insights: Free / Premium (Premium = all old Max content) |
| D11 | Limit copy is plan-aware: Premium is never told to upgrade |
| D12 | No daily WhatsApp summary (not built) |
| D13 | No mockup (owner waived). UI follows CLAUDE.md §24.1 |
| D14 | Data converted directly in CA + IN (SQL, Cosmos, search reindex). No schema change |

## Checklist (live — the authority for what is left; updated 2026-10-05)

- [x] Backend core: enum, catalog (v12), entitlements, prices
- [x] Promo grant removal · PromoSunset + founder removal · deploy.ps1 cleanup
- [x] Leads: waves, schedule, gate (0 / rescue), over-quota silence, locked card, monthly notice
- [x] Badges, banner Sponsored, Insights collapse, homepage ladder, ranking note (web + mobile, provider search too)
- [x] Copy 5 languages; plan-aware "upgrade" everywhere (leads, WhatsApp, seats, knowledge, receipts)
- [x] UI: partner web, partner mobile, admin, customer web + mobile; UI audit findings M1–M4, L1–L8 fixed
- [x] Admin offer pages read plans / engines / currency / regions from the catalog (no hard-coded lists)
- [x] Data CA+IN: SQL synced to v12, Cosmos converted; PendingTier column DROPPED (migration applied CA+IN)
- [x] Plan card numbers = what the gates enforce (shared PlanLimits)
- [x] Push: hub template carries noticeType; mobile routes plan-limit pushes to Plan & Billing
- [x] Backend audit fixes: missing plan defers + alerts (no free period); notice uses non-cancellable token;
      TimeProvider month key; timeout fail-open; single-write silent settle; worked leads never charged;
      locked leads get no ended/updated notices; await-using scope; magic number; verbose comments
- [x] ANNUAL (D15): remove AnnualBilling appsettings entirely — yearly = 12 × monthly, term 12 months, always on,
      AI the same; the only yearly saving is an admin promo with "Apply to annual plans" (crossed-out price, existing UI).
      Backend + DTO (drop annualBilling block) + both appsettings + tests + web/mobile UI done 2026-10-05 (payments skill pending)
- [x] Sweep PaymentSettings: no other price/discount/trial/plan knob remains (rest are operational: caches, alerts, retries, reminder timing)
- [x] Admin Billing Configuration page: regions + currency from catalog/lookup (shared hooks)
- [x] Admin Billing Configuration page: engines from catalog aiEngines; no hard-coded lists left (156/156, ESLint 0)
- [x] Tests: new behaviours written + green (Functions unit 9652, targeted API 138)
- [x] Full runs: API unit + integration, Functions unit + integration, Identity, MCP, cosmosindexsetup; all UI suites + ESLint + tsc
- [x] Re-audit (4th) DONE 2026-10-05: 4 audits (backend D15, leads/wording, provider UI, admin page) — fixes IN PROGRESS:
  - [x] Backend leads DONE 2026-10-05 (worker fixes 1,2,4-8; rescue flag built by main session, flag tests green): status-update redelivery leak (HIGH); failed broadcast read unlocks lead; RESCUE = persisted
        `pulledUpByFloor` on BroadcastProvider — OWNER APPROVED 2026-10-05 ("go with the flag, do it right"): only on rescued Free
        providers' copies, stored only when true; after Premium→Free downgrade leftover Premium-wave leads follow Free rules;
        processor ITs for locked leads; marker/counter compensation; SDK timeout fail-open; noticeType default; cost; comments
  - [x] Backend billing (worker): repeating promo on YEARLY = first yearly charge only (owner 2026-10-05); trial missing-plan
        bounded; alert text; Error_AnnualUnavailable removed; unused deps; stale comments; Founder exemption; quote=charge x3;
        seeder v11→v12 reconcile; API IT expectations; canonical region currency on served-regions DTO; Cosmos removed-type count
  - [x] Provider UI web+mobile DONE (+ per-month figure full price, PromoPrice.jsx shared, comments trimmed): mobile yearly headline; web AI "coming soon"; mobile meter permission + 0 allowance;
        one promo display rule; strike only on real saving; trial+yearly note; sr was/now; toggle 44px + selected colour; copy
        "first year" for yearly promo; mobile seat Plans button; comments
  - [x] Admin DONE (reads `regionCurrencies` from served-regions — confirm billing worker name): stale tiers on trials/promos; canonical currency; offers error+Retry; catalog reload; fees; stale-region
        guards; banners/hints; caching; ProviderLedger/VoiceConfig lists; dedupe; 320px chip; act warnings; Pro/TopPro copy; promo help line
  - [x] Sandbox IN yearly AI row (HG3QFI) re-baselined to 1798800 (owner chose fix-the-row; tx history untouched)
  - Accepted as designed: a lead settled silently is announced Lost/Updated after the counter resets (no longer locked)
  - Owner OK: dev billing errors until deploy (PendingTier already dropped) — deploy Functions then API soon
- [x] Browser check 320/375/768/1024/1440 — AFTER the dev deploy (localhost sign-in refused: session_transport_required)
- [x] Skills ×4 + memory updated for: annual, PendingTier drop, noticeType push, PlanLimits, admin catalog lists
- [x] Old App Service settings: checked 2026-10-05 via az on api/functions/mcp/identity CA+IN — none present, nothing to remove
- [x] Clean tree (no scratch in repos), commit per repo, fetch + rebase (never merge), prove no merges, push (clinqetapi last)
- [x] After dev deploy: re-queue BusinessReindex per business (CA+IN) and facet tierLevel/leadsPriority to prove Premium/Free

## Closed 2026-10-05
All items done and pushed (12 repos, one commit each on origin/master, no merges). Added after the 4th audit:
rescue flag `pulledUpByFloor`, `silencedAt` (owner-approved), `NotifyOverQuotaLeads` ON by default, AI-trial missing-product
bound, retired-tier promos never applicable. Owner dropped the search reindex. Left: deploy (Functions then API) and the
browser check after it. Known red test NOT ours: partner mobile `knowledgeReadingNotice` (another session's knowledge work).
