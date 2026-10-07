# Schema — voice number lifecycle (revision 4, owner-approved 4 October 2026)

> **Revision 4 (owner, 4 October 2026, in conversation: "yes, go ahead and build it").** ONE field added to A1,
> nothing else: `VoiceNumberAsset.purchasedHere : bool` (absent = false). Every environment rents from ONE carrier
> account per carrier, so a number is given back to the carrier ONLY when this environment proved its own order
> rented it. Written true only by `VoiceNumberPurchaseService.ConfirmAsync` on proof (our order call answered
> success, or Telnyx found the order by OUR reference); withdrawn by the hourly carrier read when the listing
> shows a different rental, a returned or missing number comes back, or an unconfirmed order is listed. Read by
> every return path (hourly keep-or-return and retry, admin Return now, Remove/Change "Released", release after
> cancel), by `VoiceNumberCarrierReturn`, and by both carrier services before their DELETE. SystemData excludes
> `/*`: no index growth, no extra RU (it rides on writes that already happen). TTL unchanged (400 days rolling while
> rented, 365 after a return). Records written before revision 4 read as NOT bought here — the safe side.

**Every row below was approved by the owner in conversation on 1 October 2026** (quotes in
`DECISIONS-2026-10-01.md`). Nothing has been built. Per `AGENTS.md` §0.7 the building session must still have the
owner's yes in ITS conversation: the copy-paste start prompt carries that sentence. **Anything not listed here
needs a new approval before it is written.** Field meaning and flows: `FINAL-DESIGN.md` §3.

## A. New document families — existing `SystemData` container, no new container

Partition key for all three: `voiceinv_telnyx` (Canada/US stamp) or `voiceinv_plivo` (India stamp), from the
existing `Voice:Carrier` setting. Permanent.

| # | Family | Id | Fields | Reads / writes | Cost | If omitted |
|---|---|---|---|---|---|---|
| A1 | `VoiceNumberAsset` — one per rented number | `vnasset_{e164}` | `e164`, `carrier`, `carrierNumberId?`, `country`, `region?`, `locality?`, `status`, `reviewReason?`, `assignedBusinessId?`, `lastBusinessId?`, `assignmentGeneration`, `assignedAt?`, `availableSince?`, `quarantineUntil?`, `monthlyRental?`, `currency?`, `carrierPurchased?`, `nextRenewalDate?`, `renewalBoundaryUtc?`, `renewalBasis`, `returnTargetUtc?`, `reconciledAt?`, `keepForReuse`, `keepReason?`, `keptBy?`, `keptAtUtc?`, `returnAttempts`, `returnStartedAt?`, `lastFailureCode?`, `dueAt?`, `ttl` | Number choice, hourly job, admin inventory / coordinator claims, reconciliation | One document per rented number; one index term | No way to list reusable numbers, time a return or stop a double assignment |
| A2 | `VoiceNumberRequest` — one live record per business per kind (`Setup`, `ForwardingChange`, `SpecificNumber`, `ServiceEnd`) | `vnreq_{kind}_{businessId}` | Common: `kind`, `status`, `businessId`, `requestId`, `requestFingerprint`, `actorId`, `completedAt?`, `attemptCount`, `lastFailureCode?`, `dueAt?`, `notices[{kind, acceptedAt?}]`, `ttl`. Setup: `e164?`, `assignmentGeneration?`, `carrierOrderId?`, `carrierAttemptAt?`, `carrierConfirmedAt?`, `quotedMonthlyRental?`, `quotedSetupFee?`, `quoteCurrency?`, `quoteObservedAt?`. Forwarding / specific: `expectedOldTarget?`, `requestedTarget?`, `requestedText?`, `requestNote?`, `numberMode?`, `verificationMethod?`, `verificationReference?`, `decidedBy?`, `decidedAt?`, `providerReason?`, `requestsDate?`, `requestsToday`. Service end: `entitlementEndedAt?`, `detachAt?`, `billingHistoryClass?`, `quarantineDays?` | Provider status, admin queue, worker / request handlers, coordinator | At most four small documents per assistant business | A lost purchase answer is retried blindly; two devices buy twice; a stale request is applied |
| A3 | `VoiceNumberDailyCounter` — one per UTC day | `vncount_{yyyy-MM-dd}` | `day`, `purchases`, `ttl` | Purchase admission / atomic increment | One tiny document a day | Nothing stops a burst of sign-ups from buying without limit |

## B. New fields on existing documents

| # | Document | Field | Reads / writes | If omitted |
|---|---|---|---|---|
| B1 | `VoiceAssistantState` (business profile, ProviderData) | `numberAssignmentGeneration : long?` | Profile write guard / coordinator | A delayed retry can re-attach a removed number |
| B2 | `Voiceline` (SystemData) | `numberAssignmentGeneration : long?` | Line write guard / coordinator | A delayed retry can hand a number back to its previous business |
| B3 | `VoiceAssistantNumberAudit` (ProviderData; existing 365-day, undeletable) | `verificationMethod : enum?`, `verificationReference : string?` | Admin activity view / forwarding approval | An approval cannot show how control was verified |
| B4 | `VoiceOwnNumberPlatformConfig` (`voicecfg_platform`, SystemData; existing admin-edited settings) | `numberPurchaseWarningPerDay : int?`, `numberPurchaseLimitPerDay : int?`, `idleNumberBuffer : int?` (null ⇒ appsettings default) | Purchase worker and hourly job (point read) / admin Voice Settings save | Limits could only change with a deployment |

## C. Index and TTL

| # | What | Detail |
|---|---|---|
| C1 | ONE new `IncludedPath` `/dueAt/?` on `SystemData` (`CosmosContainerPolicies.SystemData`, applied by `cosmosindexsetup`). No new composite | Due-work read inside the inventory partition. One index term per record that has pending work |
| C2 | TTL on every new record | Asset 400 days rolling while owned, 365 days after a confirmed return; request 365 days rolling; counter 90 days |

## D. SQL and Search

**No SQL change. No Search change.** Trial-only versus paid history is read from the existing `BillingTransactions`.

## E. Not schema — new Azure resources (need ARM + `deploy.ps1` in the same change)

Service Bus queue `voice-number-operations` (per stamp, dead-lettering). One scheduled-query alert rule for a
missed lifecycle heartbeat. New enum values are code.
