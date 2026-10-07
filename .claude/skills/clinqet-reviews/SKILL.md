---
name: clinqet-reviews
description: |
  **CORE FEATURE SKILL** — Work on the Reviews feature end-to-end. Customers rate
  providers/services (1–5 stars, title, comment, images), providers reply, admins moderate,
  votes (helpful/unhelpful), reports/flags. Images use the media-derivatives pipeline
  (thumb / medium / original). USE FOR: review CRUD, reply CRUD, voting, reporting, admin
  moderation, business + service rating aggregation, image upload SAS flow, derivatives,
  pending-review prompts on completed bookings, public review display, SEO. Applies to
  clinqetcore Entities (Review*, BusinessRating, ServiceRating, ReviewReply, ReviewVote,
  UserReview, ReviewReport), clinqetinfrastructure/Services/Review/, clinqetapi
  Controllers/Review*, clinqetwebuserapp + clinqetwebpartnerapp + clinqetwebadmin review UIs.
---

# CLINQET REVIEWS — COMPREHENSIVE SKILL

## ENTITIES (`clinqetcore\Entities\COSMOS\Cosmos.cs`)

| Entity | Container | Partition key | Document id | Lines |
|--------|-----------|---------------|-------------|-------|
| `Review` | `Reviews` | `/businessId` | `{businessId}_{reviewId}` | ~788-910 |
| `ReviewImage` (nested in Review.Images) | — | — | — | ~912-951 |
| `ReviewReply` (nested in Review.Reply) | — | — | — | ~953-978 |
| `BusinessRating` | `Reviews` | `/businessId` | `br_{businessId}` | ~980-1009 |
| `ServiceRating` (nested in BusinessRating.ServiceRatings dict) | — | — | — | ~1011-1037 |
| `ReviewVote` | `Reviews` | `/businessId` | `{businessId}_{reviewId}_{userId}` | ~1039-1071 |
| `UserReview` (customer-side denormalized) | `UserData` | `/customerId` | `{customerId}_{reviewId}` | ~1073-1113 |
| `ReviewReport` | `Reviews` | `/businessId` | composite (businessId+reviewId+reporterId) | ~1115+ |

### Review fields
`ReviewId`, `BusinessId` (pk), `UserId`, `Rating` (1-5 validated), `Title` (≤150), `Comment` (≤2000), `ServiceDate`, `ServiceId?`, `BookingId?` (verified-purchase link), `Status` (enum string `Pending`/`Approved`/`Rejected`), `HelpfulVotes`, `UnhelpfulVotes`, `Images: List<ReviewImage>`, `Reply: ReviewReply?`, `IsVerifiedPurchase`, `ModerationNotes`, denormalized author display (`UserDisplayName`, `UserFirstName`, `UserLastName`, `UserAvatarUrl`), `ReviewSource`, `IsEdited`, `LastEditedAt?`, `IsPublic`, `IsAnonymous`, `CustomerType`, `ReviewPeriod`, `IsPinned`, `OrderByWeight`, `Tags`, `CategoryId`, `IsRecommended`, `ReviewPhase`, `ReportedCount`, `IsArchived`, `Metadata`.

### ReviewImage fields (media-derivative target)
`ImageId`, `Url` (original), `FileName`, `FileSize`, `ContentType`, `IsVideo`, `ThumbnailUrl?`, `MediumUrl?`, `Width?`, `Height?`, `ProcessingStatus` (`Pending`/`Ready`/`Failed`/`Skipped`), `ProcessedAt?`.

### BusinessRating (cached aggregate, on-change)
`AverageRating`, `TotalReviews`, `RatingDistribution: Dictionary<string,int>` ("1"-"5" → count), **`RatingByMonth: Dictionary<string, Dictionary<string,int>>`** (JSON `ratingByMonth`, §13.2 — below), `ServiceRatings: Dictionary<string, ServiceRating>` (per serviceId; each also carries its own `RatingByMonth`), `RecentReviewIds`.

---

## ENUMS (`clinqetshared\Enums\`)

- `ReviewStatus`: Pending, Approved, Rejected
- `ReviewModerationAction`: Approve, Reject
- `ReviewReportReason`: Spam, Inappropriate, FakeReview, Harassment, OffTopic, PrivacyViolation, Other
- `VoteType`: None, Helpful, Unhelpful
- `MediaProcessingStatus`: Pending, Ready, Failed, Skipped (shared with media-derivatives pipeline)
- All have `[JsonConverter(typeof(JsonStringEnumConverter))]`.

---

## DTOs

`clinqetshared\DTOs\COSMOS\Cosmos.cs` and `ReviewMediaDtos.cs`:

- `CreateReviewDto` — rating, title, comment, serviceDate, serviceId?, bookingId?, image set (after SAS confirm)
- `UpdateReviewDto` — rating, title, comment, image add/remove
- `ReviewResponseDto` — full output, includes images with thumb/medium/original
- `ReviewImageDto`
- `ReviewFilterDto`, `ReviewQueryDto` — sort/filter/pagination
- `ReviewVoteRequestDto`/`ReviewVoteResponseDto`
- `UserReviewDto`, `PendingReviewDto`
- `ReviewReportRequestDto`/`ReviewReportResponseDto`
- Media upload: `ReviewMediaFileInfoDto`, `ReviewMediaSasUrlRequestDto`, `ReviewMediaSasUrlDto`, `ReviewMediaSasUrlResponseDto`, `ReviewMediaConfirmDto`, `DeleteReviewImagesDto`.
- Validation errors are localization keys (`Error_ReviewRatingRange`, `Error_ReviewTitleLength`, `Error_ReviewCommentLength`, etc.).

---

## REPOSITORY — `ReviewRepository`

`C:\Nik\clinqetinfrastructure\Data\COSMOS\ReviewRepository.cs` (~1300 lines). Implements `IReviewRepository` (`clinqetcore\Interfaces\COSMOS\IReviewRepository.cs`).

Surface (grouped):

**Review CRUD**
- `GetByBusinessIdAsync(businessId)`, `GetReviewByIdAsync(reviewId, businessId)`
- `GetRecentReviewsAsync(businessId, count)` — uses composite index `(/type ASC, /createdAt DESC)`
- `GetByServiceIdAsync(businessId, serviceId)`
- `CreateReviewAsync(review)` — sets composite id, creates doc, **if status=Approved updates BusinessRating** atomically
- `UpdateReviewAsync(review)` — patches doc
- `DeleteReviewAsync(id, businessId, deletedBy)` — removes from BusinessRating if was Approved
- `AddReplyToReviewAsync(id, businessId, reply)` / reply update / reply delete
- `GetReviewByUserForBusinessAsync(businessId, userId)` — prevent duplicate per business
- `GetReviewByUserForServiceAsync(businessId, userId, serviceId)` — prevent duplicate per service

**Rating aggregation (cached, transactional)**
- `GetBusinessRatingAsync(businessId)`, `UpdateRatingAsync(businessId, newReview)`, `RemoveReviewFromSummaryAsync(...)`
- `GetBusinessRatingDistributionAsync(businessId)`
- `RecalculateAndPatchAverageRating(businessId)` — full scan + patch (use for repair / bulk migration)
- `RecalculateMultipleBusinessRatingsAsync(businessIds)` — batch repair

**Service rating** (embedded in BusinessRating.ServiceRatings)
- `GetServiceRatingAsync(businessId, serviceId)`, `GetAllServiceRatingsAsync(businessId)`, `UpdateServiceRatingAsync`, `RemoveServiceReviewFromSummaryAsync`, `GetAverageServiceRatingAsync`

**Advanced**
- `VoteOnReviewAsync(reviewId, businessId, userId, voteType)` — toggle helpful/unhelpful via `ReviewVoteRepository` and atomically updates Review.HelpfulVotes / UnhelpfulVotes
- `GetReviewsWithAdvancedFilterAsync`, `GetPaginatedReviewsAsync(currentUserId)` (returns vote-state per user)
- `GetReviewRatingDistributionAsync`, `GetReviewsByMonthAsync(monthsBack)`, `GetTopKeywordsAsync(topCount)` — analytics
- `BulkUpdateReviewStatusAsync(businessId, reviewIds[], newStatus)` — admin batch moderation

**Reports** — `CreateReportAsync`, `GetReportByUserAsync`

**Media derivatives** (called by `MediaDerivativeProcessorFunction`)
- `UpdateReviewImageDerivativesByIdAsync(businessId, reviewCompositeId, imageId, ReviewImageDerivativeUpdate update)` — patches `/images[idx]/thumbnailUrl`, `/mediumUrl`, `/width`, `/height`, `/processingStatus=Ready`, `/processedAt=now`. Conditional on `imageId` match to prevent race on concurrent uploads (memory: `project_media_derivatives_phase_2`).

Related repositories: `UserReviewRepository.cs` (customer-side denormalized view), `ReviewVoteRepository.cs` (vote toggle). Mapping: `Extension\ReviewMappingExtensions.cs`.

---

## SERVICE — `ReviewService`

`C:\Nik\clinqetinfrastructure\Services\Review\ReviewService.cs` (~33 KB). Implements `IReviewService` (`clinqetcore\Interfaces\Services\IReviewService.cs`).

Surface:
- `CreateReviewAsync(businessId, userId, customerId, userAvatarUrl, dto, preferredLanguage)`
  - prevents duplicate per service-or-business
  - validates booking completion + ownership → `IsVerifiedPurchase = true`
  - fetches author name/avatar
  - creates `UserReview` denormalized doc
  - dispatches pending-approval admin alert
- `UpdateReviewAsync` — enforces edit window (`Reviews:EditWindowDays`), author-only
- `DeleteReviewAsync` — author-only (or admin via `AdminReviewController`); cascades rating recalc
- `ReplyToReviewAsync` / `UpdateReplyAsync` / `DeleteReplyAsync` — business-owner only; fires `ReviewReplied` / `ReviewReplyEdited` / `ReviewReplyDeleted` to author
- `VoteOnReviewAsync` — toggle; can't vote on own review
- `ReportReviewAsync` — creates `ReviewReport`, increments `ReportedCount`, fires admin alert if threshold crossed
- `GetPaginatedReviewsAsync(businessId, queryDto, currentUserId)` — returns each entry with the caller's own vote state
- `GetMyReviewsAsync(customerId, skip, take)` — paged customer history
- `GetPendingReviewsAsync(customerId)` — completed bookings without a review (prompts the user app PendingReviewsBanner)
- `ApproveReviewAsync(businessId, reviewId, adminUserId, preferredLanguage)` — sets status=Approved, atomic rating update, fires `ReviewApproved`
- `RejectReviewAsync(businessId, reviewId, adminUserId, rejectionReason, preferredLanguage)` — sets Rejected, stores rejectionReason, fires `ReviewRejected` to author

All notifications dispatch via `ICommunicationDispatcher` — see `clinqet-notifications` skill.

---

## CONTROLLERS

### `ReviewController.cs` — customer + provider endpoints

Base: `/api/v{version:apiVersion}/businesses/{businessId}/reviews`. CORS `B2CPolicy`.

| Verb | Route | Auth | Notes |
|------|-------|------|-------|
| GET | `/api/v1/public/businesses/{businessId}/reviews` | Anonymous | paged; Approved reviews only |
| GET | `/api/v1/public/businesses/{businessId}/reviews/{reviewId}` | Anonymous (author may read own Pending) | includes caller's vote state |
| POST | `/api/v1/businesses/{businessId}/reviews` | JWT (customer) | `CreateReviewDto` |
| PUT | `/api/v1/businesses/{businessId}/reviews/{reviewId}` | JWT (author only) | `UpdateReviewDto`; enforces edit window |
| DELETE | `/api/v1/businesses/{businessId}/reviews/{reviewId}` | JWT (author or admin) | |
| POST | `/api/v1/businesses/{businessId}/reviews/{reviewId}/reply` | JWT (business owner) | `UpsertReviewReplyDto` |
| PUT | same | | update reply |
| DELETE | same | | delete reply |
| POST | `/api/v1/businesses/{businessId}/reviews/{reviewId}/vote` | JWT | `ReviewVoteRequestDto` |
| POST | `/api/v1/businesses/{businessId}/reviews/{reviewId}/report` | JWT | `ReviewReportRequestDto` |
| POST | `/api/v1/businesses/{businessId}/reviews/{reviewId}/request-sas-urls` | JWT (author) | media upload session |
| POST | `/api/v1/businesses/{businessId}/reviews/{reviewId}/confirm-uploads` | JWT (author) | confirms blob existence + enqueues `MediaDerivativeQueueMessage` (parentEntity=Review) |
| DELETE | `/api/v1/businesses/{businessId}/reviews/{reviewId}/images` | JWT (author) | `DeleteReviewImagesDto`; removes blobs + derivatives |
| GET | `/api/v1/customers/me/reviews` | JWT | paged customer history |
| GET | `/api/v1/customers/me/reviews/pending` | JWT | unreviewed completed bookings |

### `AdminReviewController.cs`

Base: `/api/v{version:apiVersion}/admin/reviews`. `[Authorize(Roles = "Admin")]`.

- `GET /{businessId}/{reviewId}` — full inspection (any status)
- `POST /{businessId}/{reviewId}/moderate` — `ModerateReviewRequest { action: Approve|Reject, rejectionReason }`

---

## IMAGE UPLOAD FLOW (media derivatives)

1. Client → `POST /reviews/{id}/request-sas-urls` with file metadata. Server returns SAS URLs.
2. Client → uploads blobs directly to `reviewimages` container via the SAS URLs.
3. Client → `POST /reviews/{id}/confirm-uploads` with the completed file list.
4. Controller persists `ReviewImage` entries with `ProcessingStatus=Pending`, then publishes `MediaDerivativeQueueMessage` to Service Bus (`media-derivatives` queue):
   - `ParentEntity = MediaParentEntity.Review`
   - `ParentContainer = "Reviews"`
   - `ParentDocId = {businessId}_{reviewId}`
   - `ParentPartitionKey = businessId`
   - `ParentArrayField = "images"`
   - `ParentArrayIdField = "imageId"`
   - `BlobContainer = "reviewimages"`
5. `MediaDerivativeProcessorFunction` consumes — generates WebP thumb + medium, uploads them, patches the review image via `UpdateReviewImageDerivativesByIdAsync`. PDFs (license documents use the same pipeline) skip derivatives — `ProcessingStatus` stays null.
6. Frontend renders thumb first, medium on demand, original on click. See `clinqet-media-derivatives` skill for the full pipeline.

Allowed types: images only (jpg/jpeg/png/webp/gif/heic/heif). Max size per file per `ReviewSettings`. Multiple images per review.

---

## COSMOS INDEXES (Reviews container)

`C:\Nik\clinqetcore\Cosmos\Setup\CosmosContainerPolicies.cs` ~lines 98-130. Partition `/businessId`.

Included paths: `/type/?`, `/status/?`, `/createdAt/?`, `/rating/?`, `/userId/?`, `/serviceId/?`, `/helpfulVotes/?`, `/unhelpfulVotes/?`, `/isArchived/?`, `/reporterId/?`, `/reviewId/?`, `/title/?`, `/comment/?`, `/reply/?`, `/images/[]/imageId/?`, `/images/[]/url/?`, `/updatedAt/?`.

Composite indexes:
- `(/type ASC, /createdAt DESC)` — recent-reviews ORDER BY

When adding a query that filters or sorts on a field not yet indexed, update `cosmosindexsetup\Program.cs` AND the policies file. Verify under `cosmos emulator ≠ prod` rule: emulator is more permissive; add a string-shape unit test on the SQL produced.

---

## NOTIFICATIONS

NotificationTypes fired by Review flows: `ReviewApproved`, `ReviewRejected`, `ReviewDeleted`, `ReviewReplied`, `ReviewReplyEdited`, `ReviewReplyDeleted`. Dispatch via `ICommunicationDispatcher`. Confirm each new type is in `SignalRSettings:EnabledNotificationTypes`.

Email templates (per language) under `Resources/EmailTemplates/{lang}/`: review-approved, review-rejected, review-replied, etc.

---

## PROVIDER RATING AGGREGATION RULE

- **Transactional**, not batch. When a review's effective contribution changes (created Approved, deleted Approved, status flipped via moderation), `UpdateRatingAsync` / `RemoveReviewFromSummaryAsync` is called inline and patches `BusinessRating` (cached doc) plus the nested `ServiceRating` for the service-scoped review.
- Pending reviews **do not** contribute to ratings — only Approved does.
- For repair / migration, use `RecalculateAndPatchAverageRating` (or batch variant).
- Distribution stored as `Dictionary<string,int>` ("1"→count, ..., "5"→count) — patched alongside average.

### ‼️ Review-month buckets (`ratingByMonth`) — §13.2 recency, 2026-09-29

The same star counts, keyed by the month each review was **WRITTEN** (`"yyyy-MM"` → `"1"-"5"` → count); months older
than `Search:RatingSort:RatingBucketMonths` (24) fold into their year (`"yyyy"`). One definition:
`clinqetcore/Utilities/RatingBuckets.cs` (`Add` / `Remove` / `Build` / `Fold` / `AccountFor` / `Decayed`). Never
indexed, filtered or sorted on.

- **Writers** — all in `ReviewRepository`, beside the distribution they mirror: `CreateInitialBusinessRatingAsync`,
  `UpdateExistingBusinessRatingAsync` and `UpdateServiceRating` add; `RemoveReviewFromExistingBusinessRatingAsync`
  removes from the business and service buckets. Keyed by `review.CreatedAt` (a review without one THROWS), so an edit
  re-approved today never re-dates a three-year-old review — `ReviewService`'s edit path carries `CreatedAt` onto the
  contribution it removes. `Remove` looks in the month bucket, then the year bucket; never below zero; empties are deleted.
- **Repair** — `RecalculateAndPatchAverageRating` rebuilds business + per-service buckets from the approved reviews
  (`GetApprovedReviewDatesAsync`, single partition, `status = 'Approved'`) and patches `/ratingByMonth` when they
  drifted (stored copy folded at the same instant first, so a month that merely aged into its year is not drift).
  This is how an aggregate written before the buckets existed gets dated.
- **Reader** — `RatingValue.BusinessSortKey` / `ServiceSortKey` / `*BoostKey` (now take `nowUtc`), called by
  `ProviderSearchIndexer` and `AzureSearchIndexer` at index time. Each review is weighted `0.5^(age months /
  Search:RatingSort:ReviewHalfLifeMonths)` (18; 0 retires recency), age from the bucket's middle. ‼️ Decay applies ONLY
  when `RatingBuckets.AccountFor` shows the buckets hold exactly the distribution's stars — otherwise the plain counts
  stand, never a mix of two scales. Service and business tallies decay together or not at all.
- `Search:RatingSort` lives in BOTH the Main API and Functions `appsettings.json` (bound by `AddRatingSort` in both;
  `ReviewRepository` reads `RatingBucketMonths` from the same key, clamped 1–120) — they must agree, or the writer
  folds at a different window than the reader assumes.

---

## FRONTEND

### User app (`clinqetwebuserapp`)
- Pages: `app/(customer)/reviews/` (provider's public reviews on profile), `app/(customer)/my-reviews/` (customer's review history).
- Components: `components/customer/review/ReviewForm.jsx`, `ReviewList.jsx`, `RatingSummary.jsx`, `PendingReviewsBanner.jsx`, `model/editReview.jsx`.
- Image upload: SAS → blob direct upload → confirm; show `Pending` placeholder until derivatives ready.
- Image rendering: `<picture>` with srcset thumb/medium/original; `loading="lazy"`.
- Pending banner: fetch `/api/v1/customers/me/reviews/pending` on app load; surface CTA.

### Partner app (`clinqetwebpartnerapp`)
- `src/app/dashboard/profile/reviews/page.jsx` — list received, reply, view distribution.
- Public Open Page surfaces Approved reviews + replies for SEO.

### Admin app (`clinqetwebadmin`)
- `src/pages/reviews/ReviewsManagementPage.jsx` — moderation dashboard: pending queue, flagged/reported queue, bulk approve/reject, moderation notes, filter/search.

All copy via localization (`react-intl` on user/partner, i18n on admin).

---

## TESTS

- Unit: `Clinqet.API.UnitTests/Controllers/ReviewControllerTests.cs`, `Services/ReviewServiceTests.cs`, `Repositories/ReviewRepositoryTests.cs`, `Repositories/UserReviewRepositoryTests.cs`, `Extensions/ReviewMappingDerivativeTests.cs`.
- Integration: `Clinqet.API.IntegrationTests/Controllers/ReviewControllerTests.cs`, `Controllers/AdminReviewControllerTests.cs`, `Repositories/CosmosReviewRepositoryIntegrationTests.cs`.
- Function: `Clinqet.Communications.UnitTests/Functions/MediaDerivativeProcessorFunctionTests.cs` (covers the review-image processing branch).
- Scenarios MUST cover: dup prevention per business/service, edit window enforcement, vote toggle, report increment + admin alert, image derivative race / concurrent uploads, rating distribution patch on create/delete/moderate.

---

## CHECKLIST BEFORE MERGE

- [ ] Every query specifies `/businessId` partition key.
- [ ] Author-only mutations enforce userId match; admin paths require Admin role.
- [ ] Edit window respected.
- [ ] Verified-purchase logic correctly checks booking completion + ownership.
- [ ] Status-change paths atomically update `BusinessRating` (and nested `ServiceRating`).
- [ ] Image confirm enqueues `MediaDerivativeQueueMessage` with correct parent target.
- [ ] New Cosmos query paths have matching indexes in `cosmosindexsetup\Program.cs`.
- [ ] Notification types fired are whitelisted in `SignalRSettings:EnabledNotificationTypes`.
- [ ] Email templates exist for all supported languages.
- [ ] All DTO labels/errors are localization keys.
- [ ] Unit + integration tests added; build clean; ESLint clean for changed UI surfaces.

### ‼️ ADDENDUM 2026-08-05 — four nested-media index paths REMOVED, and one that LOOKED identical was KEPT

Owner-approved (**DA13**). Deleted from `CosmosContainerPolicies`: `ProviderData` `/serviceImages/[]/imageId/?`,
`/images/[]/imageId/?`, `/documents/[]/documentId/?`; `Reviews` `/images/[]/imageId/?`; `Messages`
`/attachments/[]/attachmentId/?`. An **array** path costs one index entry **per element** on every parent write,
forever — and every one of these served a lookup `PatchStableArrayItemByIdAsync` performs **in memory**.

‼️ **`/pricing/priceType/?` was in the same finding and is KEPT.** `ServiceRepository.GetServicesByPricingTypeAsync`
queries it through a **LINQ predicate**, which the Cosmos provider turns into `WHERE c.pricing.priceType` at
runtime — **an expression tree names no path in any string**, so the literal-SQL sweep that produced the finding
could not see it. Removing it would have demoted a live query to a partition scan.

> ‼️ **THE RULE: before deleting an index because "nothing queries it", enumerate every way a query can be
> EXPRESSED here — literal `QueryDefinition`, `GetItemsByLinqAsync` (expression tree),
> `GetFilteredItemsAsync(whereClause:)`, and server-side scripts (none exist). Treat an expression tree as a
> query.** And note which failure you are risking: an unindexed **filter** degrades to a scan, but an unindexed
> **sort** is a hard **400** — so the `ORDER BY` check must be exhaustive.

Guard: `Clinqet.API.UnitTests.Repositories.NestedMediaIdPathsAreNotIndexedTests` — it asserts the four are
absent from `IncludedPaths` **and** every composite, and carries the `priceType` counter-example beside them.
Deployment: `cosmosindexsetup` applies the policy via `ReplaceContainerAsync`, so a re-run updates the live
index online — ‼️ pass `--launch-profile`; the tool ignores the shell `CLINKET_REGION`.
