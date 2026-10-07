# Admin search health — evidence, reasons and actions

Status: owner approved the mockup and health policy in conversation on 2026-09-24; implemented and locally verified. Not deployed.

## Mockup register

| Sheet | Path | Approval date | Governs | Supersedes |
|---|---|---|---|---|
| Search health explanations | `C:/Nik/Data/mockups/admin-search-health/index.html` | 2026-09-24, owner: "Approve the mockup and implement" | Existing System Monitoring search card, desktop and mobile web; health definitions, row explanations, failures and refresh states | Replaces count-only degradation in this card; does not change other search diagnostics |

## Findings verified before implementation

- `clinqetapi/Clinqet.API/Controllers/Admin/SearchAdminController.cs`, `GetSearchHealth`: enumerates both planes, reads document counts and returns an anonymous aggregate status. Its pending correction excludes empty private/Launching indexes, but still declares every empty Live index degraded. Neither a zero nor a positive count proves indexing completeness.
- The same endpoint marks any failed index check Unhealthy; it returns raw exception messages and no stable reason codes, impact or next step. Caller cancellation is propagated.
- `clinqetcore/Interfaces/Search/ISearchTopology.cs` also documents the old Live-empty-means-outage policy. Update that documentation and its existing regression expectations with the approved policy; do not leave contradictory guidance behind.
- `clinqetwebadmin/src/pages/system/SystemMonitoringPage.jsx`: renders the server badge. The pending change labels Live/Launching, but supplies no diagnosis for a degraded aggregate. Failed requests become null and display only Unavailable. Loading hides the prior report. There is no response-generation/unmount guard.
- The dictionary readiness/count/timestamp are displayed but excluded from the aggregate. `CatalogDictionaryService.IsReady` records a published snapshot, not the success of every source in its last refresh. Source scans may fail independently and still publish terms from other sources. Do not represent Ready as proof that every source is current.
- `CatalogDictionaryRefreshHostedService` honors `Search:SpellCheck:Enabled`; disabled must never be called a failure. Current class defaults are a 60-minute refresh interval, 60-second refresh timeout, and 30-minute failure alert threshold. Using 30 minutes alone as a staleness threshold would create another false warning during the normal hourly interval.
- Existing provider visibility and knowledge-health diagnostics are business-scoped. Keep detailed missing-content investigations there, with existing alerts; do not scan Cosmos or trigger a rebuild on page load.
- No endpoint integration test for `/admin/search/health` was found. Current focused verification from the preceding turn: 15 controller tests, 4 admin tests and targeted lint passed. Those tests do not yet cover the proposed behavior below.

## Approved and implemented health policy

The server alone owns aggregation and structured findings. The UI renders these findings, not a competing count-based algorithm.

| Evidence | Overall result | Explanation / next step |
|---|---|---|
| Every configured index responds; enabled dictionary has a usable, timely snapshot | Healthy | Checked at a stated time; this is reachability and dictionary readiness, not a data-completeness or relevance audit |
| Reachable empty private index | No degradation from count | No documents indexed. This can be normal before uploads/publication; if content was expected, inspect that business's ingestion and alerts |
| Reachable empty Launching country | No degradation from count | Country is configured Launching; zero documents can be expected during rollout |
| Reachable empty Live country | No degradation from count; conspicuous content notice | No searchable content in this index. Confirm whether content is expected; inspect provider visibility and indexing alerts if it is. Do not claim the index is broken or that emptiness is expected |
| Enabled dictionary has no usable snapshot | Degraded | Catalog-based spelling checks are unavailable; other search paths may still work. Inspect refresh logs/configuration and recheck; never claim startup versus failure without evidence |
| Enabled dictionary's snapshot is overdue | Degraded | Last successful snapshot publication is overdue; refresh may be delayed or failing. Threshold must allow the configured interval, refresh timeout and existing failure-grace window, not a hardcoded age |
| Spell correction deliberately disabled | Informational | Disabled by configuration; exclude dictionary readiness/age from aggregate health |
| Any configured index check fails | Unhealthy (preserve existing severity) | Name exact country/cell and index, failed observation, potential impact and safe next step; do not imply all search is down |
| No configured index targets | Unhealthy | No indexes can be checked; inspect this stamp's topology configuration |
| Monitoring request fails, is forbidden, times out, is throttled, or has an invalid payload | Unknown | Cannot determine current health; distinguish monitoring access/failure from search failure. Never synthesize Healthy or a zero count |
| Refresh fails after a successful report | Unknown current status + explicitly labelled last successful report | Preserve evidence with its original timestamp, not a stale green current badge |

Precedence: confirmed unhealthy component > degraded component > healthy. A failed monitoring request has Unknown current health. Informational findings do not change health. Surface every distinct finding, not only the first one.

## Wire contract and implementation boundaries

- Replace the anonymous response with a typed API response DTO, retaining existing JSON field names. Add diagnostic fields; these are transient response fields, not database/search-index schema changes.
- Preserve index `status` as its country lifecycle. Use a separate health field so `Live` is never confused with `Healthy`.
- Each finding carries a stable reason code, severity, affected component identity, factual reason, possible impact and next action. Internal admin wording follows the existing admin-only exception. Use enum values for fixed code sets and test the serialized contract.
- Classify search-check failures from structured SDK/HTTP evidence: missing index/alias, authentication/authorization, rate limiting, service failure, timeout/transport, unexpected failure. Keep secrets, raw exception dumps and stack traces out of the response; retain correlated server logs. A 403 to the monitoring endpoint and a 403 returned by Search are different findings.
- Preserve caller cancellation. A failed check must not become a successful empty result. Do not add unbounded retries or widen the health probe into a paid full-content audit.
- Validate response shape client-side. Legacy responses retain their supplied aggregate with an explicit explanation-unavailable notice; they are never recomputed as Healthy. Unknown codes remain visible using a safe fallback.
- Keep one health request per refresh. Guard stale responses and unmounts. Preserve last successful evidence on request failure, clearly labelled; do not use its status as current health. Show loading/refresh state, observation time and the actual monitoring scope.
- Keep Search Operations mounted during health refresh. It currently sits inside the page's loading conditional, so refreshing monitoring unmounts the panel and loses its entered business/service/category and diagnostic results. Add a regression test preserving those inputs through refresh.
- Existing Search Operations and Alerts remain deliberate navigation/action choices. No automatic resync, forced reindex, new storage, new resources or schema changes.
- Scope is the admin monitoring surface. There is no customer/provider UI contract change or native admin project in this task.

## Required verification before implementation is called complete

1. Unit tests: screenshot topology (38/2/0/0/41/0), each empty-index lifecycle, mixed findings and severity precedence, missing topology, enabled/disabled/unready/overdue dictionary, exact boundary times, every failure classification and caller cancellation. Healthy requires successful observations, never absence of findings in a malformed report.
2. HTTP integration tests: authenticated admin endpoint returns the serialized typed response; non-admin/unauthenticated access is denied; controlled Search transport success/failure reaches the real endpoint. Use existing host fixture and deterministic mocked external Search transport; no live Azure dependency.
3. Admin tests: server-owned badge, reason/impact/hint, zero versus unknown count, all findings, legacy payload, malformed payload, 403/429/network failure, failed refresh retaining correctly labelled history, race/unmount behavior, separate lifecycle label.
4. Browser tests and visual inspection: desktop and mobile-width card, long identifiers/reasons, all states in the mockup, keyboard access, no horizontal overflow or hidden controls, successful refresh recovery.
5. Build affected API/admin projects; run relevant suites and zero-error ESLint. Update affected skill copies and project memory with the final contract. Remove investigation scratch, inspect git status and report what was verified versus not deployed.

## Coverage limitation that the UI must disclose

Document counts cannot establish expected membership, AI enrichment quality, embedding quality or successful real customer queries. Dictionary readiness likewise cannot prove all source scans succeeded. Do not label these unmeasured properties healthy. Existing indexing alerts and business-scoped diagnostics remain necessary. A separate completeness dashboard would need an explicit evidence source and cost/design review; this fix must not invent one.

## Verification record

- API unit tests: all 35 SearchAdminControllerTests passed against the final backend build, including severity ordering, deadline and cancellation, SDK failures, dictionary freshness boundaries and zero counts.
- HTTP integration tests: all five AdminSearchHealthIntegrationTests passed against the final backend build. A preceding run failed during fixture initialization before endpoint assertions; the unchanged rerun passed. No tests were skipped or weakened.
- Full admin Jest suite: 358 tests across 32 suites passed. Targeted strict ESLint passed with no errors or warnings.
- API unit/integration builds passed with existing repository warnings. The final admin production build passed.
- The initial browser run passed nine of ten checks. The 320px regression found a real implicit grid minimum-width overflow. Explicit single-column sizing, mobile padding and header wrapping were corrected. All ten browser tests then passed against the final production bundle: six dialog checks and four monitoring checks, without retries or skipped tests.
- Desktop and narrow mobile production renderings were visually inspected. At 320px with the sidebar collapsed, the main content measured 248px client width and 248px scroll width: no horizontal overflow. Long-alias card bounds and refresh recovery passed at 1440px, 390px and 320px.
- Relevant admin/API/search skill sections were updated in all four tool directories, and project memory was added. Concurrent unrelated code and skill edits were preserved.
- Customer/provider confirmation risks remain documented in `C:/Nik/clinqetwebadmin/DIALOG_VIEWPORT_AUDIT.md`; those apps were inspected, not modified or device-tested. No native admin project was found.
- Cleanup: stopped the owned local verification server and removed the isolated production build, browser results and inspection screenshots. Retained only source, regression tests, approved mockup and documentation. Final repository status was reviewed; concurrent changes remain intact.
