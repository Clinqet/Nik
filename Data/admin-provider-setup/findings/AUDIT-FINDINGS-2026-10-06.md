# §14 multidimensional audit — findings and fixes (2026-10-06)

Six independent reviewers. Every finding is fixed in this session (owner rule
`feedback-audit-findings-fixed-this-session`). Status: `FIXED` · `FIXED+TEST` · `NOT A DEFECT` (with the
reason) · `OWNER` (needs a decision).

## Found by this session before the reviewers reported

| # | Where | What | Status |
|---|---|---|---|
| S-1 | `clinqetwebpartnerapp/.../ManageServicesPrice/constants/index.js` | `PRICE_TYPES.ON_REQUEST` was referenced in 4 files and **never defined** → the pill posted no price type, and the server's normalizer falls back to **fixed**, storing a price-less service as a priced one with no amounts | FIXED+TEST (5 new tests fail without it) |
| S-2 | `.../hooks/useServiceValidation.js` | "No price yet" hides the visit fee, travel fee and floor but still **validated** them → a provider switching an already-priced service over was refused over a field no longer on screen, with no way out | FIXED+TEST |
| S-3 | `clinqetmobilepartnerapp/.../AddService/index.tsx` | `normalizePriceType` left "on request" unmapped → no pill highlighted and the stored type round-tripped unchosen | FIXED |

## Security and loopholes

| # | Sev | What | Status |
|---|---|---|---|
| SEC-1 | HIGH | `SetupSessionFilter` is an MVC filter; **SignalR is not MVC**, so a setup session can open `/hubs/notifications`, replay the provider's notifications (incl. customer message titles) and `WatchVoiceLive` the provider's **live customer call transcripts** | |
| SEC-2 | HIGH | The claim/stop link is emailed to `BusinessProfile.Email` but signs only the **account id**, and `CorrectContactAsync` never syncs `BusinessProfile.Email` → whoever holds the old address can repeatedly destroy the corrected sign-in email and every external login. Also "This isn't my business" never stops the emails | |
| SEC-3 | HIGH | `TakeOverAsync` checks only `IsAdminProvisioned` + `ClaimedAt` → a **suspended** prepared account gets irreversibly claimed and stripped, then 401s, and `CorrectContactAsync` then refuses to repair it | |
| SEC-4 | MED-HIGH | The signed link has no revocation and no binding to the address; a 60-day bearer credential nothing can invalidate | |
| SEC-5 | MED | `NameDiffers` returns false when the team names are null, and only the Registration path passes them → the "wrong person took over" alert is always **Low** | |
| SEC-6 | MED | `PUT /userprofile` is `[AllowedInSetupSession]` and `UpdateProfileDto.ReceiveMarketingEmails` defaults **true** → a setup session can subscribe a business that consented to nothing | |
| SEC-7 | MED | `prepared-profile/emails/stop` and `/resume` are anonymous with **no limit** → unbounded SQL writes + admin-alert sends from one link | |
| SEC-8 | MED | The 60-day token travels in a **GET query string** → it lands in request telemetry | |
| SEC-9 | LOW-MED | The claim/stop footer is appended to **one-time-code and security emails** → forwarding an OTP mail hands over the destructive action | |
| SEC-10 | LOW | Both S1 convention tests enumerate **methods only**; the attribute also permits `AttributeTargets.Class` | |
| SEC-11 | LOW | `SessionSnapshot.GrantsRecentSignIn` defaults to `true` (fail-open) | |
| SEC-12 | LOW | The prepared-phone register branch runs **before** the proven-duplicate refusal | |
| SEC-13 | LOW | `detachOnFailure` holds only `user`; four other mutated entity sets stay tracked across a retry | |
| SEC-14 | LOW | `CorrectContactAsync` does not bump `SecurityStamp` | |
| SEC-15 | CHECK | Prepared accounts carry `EmailConfirmed`/`PhoneNumberConfirmed = true` with **no proof**, occupying the unique proven-phone slot | |

## Runtime safety, cost, idempotency, data integrity, observability

| # | Sev | What | Status |
|---|---|---|---|
| RUN-1 | HIGH | `ForceOnlineBookingsOffAsync` is gated on `ClaimedAt is null` **alone** → opening a setup session on a normal, live provider silently turns their online booking **off** | |
| RUN-2 | HIGH | `EnsureBookingInvoiceSentAsync` has **no** no-price guard → a $0 **Sent** invoice, a $0 gateway link and a $0 PDF email the day booking-pay is switched on | |
| RUN-3 | HIGH | `TurnOnlineBookingsOnAsync` runs **after** the commit but honours the request `CancellationToken` → a closed tab leaves the account claimed with bookings off | |
| RUN-4 | HIGH | Every post-commit effect is unrecoverable: the claim **is** the idempotency key, so a crash loses the alert, the activity row and the booking flip | |
| RUN-5 | HIGH | = SEC-7 | |
| RUN-6 | MED | `_preparedAccounts.GetAsync` runs on **every** dispatch, including every customer notification, though `RecipientType` is on the request | |
| RUN-7 | MED | `TakeOverAsync` is called on **every** sign-in, reset and external login — one extra SQL round-trip for 100% of sign-ins when the caller already holds the row | |
| RUN-8 | MED | `PreparedProfileController` uses `GetClientIpAddress()`, not `GetRateLimitClientIp()` → one IPv6 client has 2^64 buckets | |
| RUN-9 | MED | The same `Users` row is read **twice** per claim-page load | |
| RUN-10 | MED | (a) every service document is materialised to `.Take(3)`; (b) the unread count filters on an **unindexed** field in a partition that only grows while nobody is signed in | |
| RUN-11 | MED | `RefusedPrice` reads `dto.PriceType` while the mapper falls back to the **stored** one → a `Pricing` block with no `priceType` is refused although the merge is valid | |
| RUN-12 | MED | The waiting-customer alert is behind `isFirstAttempt` → any first-attempt abandon loses it forever | |
| RUN-13 | MED | `contextId ?? …` does not handle `""`, which is the field's **default** → all four waiting kinds collapse to one EventId with no date | |
| RUN-14 | MED | No `ClaimedAt` backfill → a pre-existing admin-provisioned account in use is classified unclaimed, and its next code sign-in **nulls the contact it did not prove** | |
| RUN-15 | MED | = SEC-13, plus `SaveChangesAsync` on the request-scoped context commits whatever else that scope holds | |
| RUN-16 | MED | `Forget` is per-instance → for 5 minutes after a take-over other instances still suppress **SMS and WhatsApp** | |
| RUN-17 | MED | `SessionKey()` falls back to `TraceIdentifier` → the double-tap guard it promises does not exist | |
| RUN-18 | MED | C10 costs two Azure Search queries per pair; `size: depth - hits.Count` mixes a business count with a row budget | |
| RUN-19 | LOW | `ServicesShown`/`ReadsPerWindow`/`ReadWindow` hardcoded (§0.12); `GetOrCreate` counter is not atomic | |
| RUN-20 | LOW | `DateTimeOffset.UtcNow` read directly while every sibling takes `TimeProvider` | |
| RUN-21 | LOW | `EmailShell` replaces the footer placeholder globally while the prefs block is first-index only | |
| RUN-23 | LOW | The MCP host registers `IEmailService` but not the footer → a voice-host email to a prepared business carries no claim footer | |
| RUN-24 | LOW | `LinkLifetimeDays > 0 ? … : 60` is dead behind `ValidateOnStart` | |
