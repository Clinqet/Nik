# Phase 6 — Main API admin endpoints (handoff, 2026-10-07)

DONE (compiles; unit tests 187/187 under `FullyQualifiedName~ProviderImport|FullyQualifiedName~AdminProviderControllerTests`):
`clinqetapi/Clinqet.API/Controllers/Admin/AdminProviderImportController.cs` (`api/v1/admin/provider-imports`, Admin role):
upload-url, {runId}/check, list, get, items (status/continuation/pageSize), item detail (5-min read links + ClaimedAt + live
profile status), start/cancel/resume/retry-failed/discard/cost-limit, item approve/retry/remove, bulk approve (≤200),
report.csv (skipped|review|all, formula-guarded). Trust page: `POST api/v1/admin/providers/{businessId}/approve-hidden` on
`AdminProviderController`. Services in `clinqetinfrastructure/Services/ProviderImport/Admin/` (admin service, mapper, CSV,
upload storage with streamed SHA-256 pinned to the blob ETag, SQL account store). `ProviderImportRunSlots` +
`ProviderImportStatuses` shared with the worker. New `IAzureStorageService.GetCreateSasUrlAsync` (Create|Write, one path,
never Delete). DTOs `clinqetshared/DTOs/Admin/AdminProviderImportDtos.cs`. API `Program.cs` + appsettings `AdminProviderImport`.

NOT done:
1. API integration tests (`Clinqet.API.IntegrationTests`, `ClinqetApiFactory`, Cosmos emulator + Azurite): run list paging newest
   first; `CountByStatusAsync` GROUP BY; `provimport_active` CAS race; `UpsertManyAsync` idempotent; start → item messages over
   HTTP with an admin token (`MockServiceBusService.SentToQueues`); upload-url → PUT to Azurite → check (SHA-256 + validate
   message). Put every class touching `provimport_active` in one `[Collection]`.
2. SQL integration test for `ProviderImportAccountStore` (conditional `ExecuteUpdateAsync`, batched lookup) — "Seo SQL"
   collection, own id prefix "PI".
3. Sabotage: drop the ETag condition in `TransitionRunAsync`; MaxConcurrentRuns + 1; remove the retry-lane revert; remove the CSV
   formula guard; remove the `ClaimedAt == null` condition.
4. Full `Clinqet.API.UnitTests` run (incl. the convention tests that scan every controller).
5. Skills ×4 (main-api, admin-app) + memory.
Read-link lifetime, bulk-approve cap and the default runs page size are settings now (prompt §3a).
Edge: an owner who takes over between the closure and the deactivation keeps an active account on a closed business; the admin
is told so.
Fixed at handback (2026-10-07): item point reads/patches now map the item KEY to the document id
(`ProviderImportKeys.ItemId(runId, itemKey)`) in `ProviderImportItemRepository` — `item.ItemId` is the 16-hex key, NOT the
document id. Re-check the admin fakes/tests assume the same.
