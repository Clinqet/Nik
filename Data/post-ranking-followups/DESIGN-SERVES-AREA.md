# W8 / O2 — "Serves Hamilton · Based in Toronto" — build design (2026-09-30)

Approved: PLAN §5 O2 + §10 rows of 2026-09-29; sheet `Data/mockups/customer-cards-serves-area/index.html` (register §11).
This file records HOW it is built and every decision the sheet did not have to make. FINAL-PLAN W8 is the scope.

## 1. The rule (one place: `clinqetcore/Utilities/ServedAreaRule.cs`)

- **Comes to the customer**: a service that is not at-business-only (`!ServicePlace.IsAtBusinessOnly(isAtStore,
  isAtCustomersLocation)`, D-104); a provider whose `ServesAtCustomersLocation != false` (the provider grain's own rule).
- **No usable customer point** (`CoordinateSentinel.IsUsablePair`) ⇒ no served area (sheet E). At-business-only ⇒ none (D).
- **Candidate areas** = the listing's areas **in the country of the index being read** that have a centre. Why the country:
  the index rows ARE those areas (a service has one row per centred area of that country, `ServiceSearchDocumentProjector`);
  the card of a country's listing already names only that country's areas (R-6); and it makes the Distance sort EXACT with
  one index read (§3). The place FILTER still matches on every area (unchanged).
- **Inside** = within the radius of a candidate (`ServiceAreaCoverage` math: radius read in miles when `Unit == "Miles"`, a
  radius ≤ 0 contains nothing). Several contain ⇒ the one with the nearest centre. Distance not shown; sorts as 0.
- **Outside** = the candidate with the nearest centre, and the distance to that centre.
- **Name** = the area's City, else its Name (required, ≤ 100 chars — `ServiceAreaDto`).
- **Based in** = the business address city, only when there is a served area AND it is not the same city as the area named
  (trimmed, case-insensitive, culture-invariant). None without an address.
- **No candidates** (comes to you but no centred area in this country) ⇒ no served area ⇒ today's card.

## 2. The DTO (clinqetshared) — response fields only, nothing stored (not §0.7)

`servedArea: { name, distanceKm (null when inside, 1 decimal), inside }` and `basedInCity` on `ServiceSearchResultDto`,
`RecommendedProviderSearchResultDto`, `RecentlyViewedItemDto`. `distanceKm` (the address distance) is UNCHANGED — analytics
and the at-premises pill read it.

## 3. The Distance sort — the same number the card shows, exact over every result the list can show

Key: served here ⇒ 0; outside ⇒ distance to the nearest candidate centre; no served area ⇒ today's `DistanceKm`.
Ties at 0 ⇒ trusted rating first (the sheet's table), then the existing tie-breaks.

**Services, browse (`ExecuteDiscoveryQueryAsync`)** — replaces the located/unaddressed pair of reads:
1. **Served here**: one row per service, filter = the request's AND comes-to-you AND the containment superset
   `serviceAreas/any(a: a/country eq '{country}' and ((a/unit ne 'Miles' and (<km buckets>)) or (a/unit eq 'Miles' and
   (<mile buckets>))))`, bucket = `a/radius gt lo and a/radius le hi and geo.distance(a/center, p) le hi_km` (the form
   verified live 2026-09-29); ordered by the rating keys; paged, each row checked EXACTLY in memory; stops at the depth of
   true matches or the end; bounded by `Search:FanOut:MaxRowsPerQuery` (ceiling alert, as every fan-out read).
2. **Nearest** (`location ne null`): every area row ordered by `geo.distance(location, p)`, first row per service
   (FanOutWindow). For a service that comes to you its rows are exactly its candidates (centred areas of this country with an
   id — the candidate rule requires the same), so its first row IS its key when outside; any other service's one row is its
   address, which is its key. Descending (API-only; no client sends it): read farthest-first until the services whose key ≥
   the current row distance fill the depth — a key is never above any of its rows, so every such service has been seen.
3. **No point on the row** (`location eq null`: no address and no centred area here — the card's distance, if any, is its
   nearest area anywhere, which no row can order): read whole, one row per service, bounded like every read.
Merged, de-duplicated, keyed, `ApplySorting`, cut to depth. Total = the counts of reads 2 and 3 (they partition the matches).

**Services, typed search and every in-memory re-sort** (text path, widened merge, fan-out merge): `ApplySorting` reads the key.

**Providers** (`ProviderSearchService`): the same key in `ExplicitSortComparer` (today it sorts by the ADDRESS only, and a
provider with no address sorts farthest while its card shows its nearest area — fixed by the same key). Provider documents
carry EVERY business area (also areas no service uses), so a key can sit below every row. Reads: served here (1); nearest
rows `geoPoint ne null` (2); a gap read `serviceAreas/any(a: a/country eq '{country}' and geo.distance(a/center, p) le
d_max)` for providers that come to you, d_max = the nearest window's last row distance, only when (2) did not reach the end
(ascending; descending needs none, a key is still never above a row); rows with no point (3). Total = the base count.

**Recommended providers from typed text** (`RecommendationSearchService.BuildProviderDto`): the card is the top service's,
so its served area and based-in are the top service's; `ApplyProviderSort` reads the same key.

## 4. Surfaces
Search services (text + browse), search providers (index + text), discovery recommended services/providers, recently
viewed (`RecentlyViewedHydrationService` — the lookups must select `isAtStore`/`isAtCustomersLocation` and
`servesAtCustomersLocation`, or every card reads as "comes to you"; with no search there is no index country, so it names
from every area). NOT the SEO landing cards or the banner (no customer point, no distance today). The web "View all" page
re-sorts on the client: it uses the same number (`utils/servedArea.js distanceSortKm`), served here rated first.

## 5. Screens
Web user app (`ServicePageContent` SearchResultCard, `WorkerViewedCard` + every mapper that feeds it) and the customer phone
app (`searchScreenDetails` ResultCard, `homeScreen` RichCard, `DiscoveryScreen` ItemCard + mappers). With a served area:
line 1 "Serves {area}" / "Serves {area} · {distance}" (km/mi by the existing country rule), line 2 "Based in {city}" when
sent; the distance pill is NOT shown (its distance, when there is one, is in line 1). Without: today's card exactly.
Provider cards: the service count stays with the location, now on line 2 ("Based in Toronto · 3 services", or
"3 services" alone). Keys: web `search.card.servesArea|servesAreaAt|basedIn`, phone `SERVICE_PRICE.SERVES_AREA|
SERVES_AREA_AT|BASED_IN`, five languages (glossary register; fr "Dessert … / Établi à …").

## 6. Known and accepted
- Result caches key the point at 3 decimals (≈ 100 m), the recommendation cache at 2 (≈ 1 km): "inside" is decided for the
  first point in that cell, exactly as `distanceKm` already is.
- **Audit C-5 (2026-10-01), accepted:** on the services Distance browse, the "served here" read picks at most
  `Search:MaxResultDepth` (500) listings by `serviceRatingSortScore desc, listingReviewCount desc, search.score() desc, id asc`,
  while the list orders them by trusted rating, then the BOOSTED score. Within a tie on rating (every unreviewed listing is 0),
  the index chooses by raw score and the list by raw score × area lift × provider boost. So when MORE than 500 listings serve
  one point AND tie on rating, a listing with a strong boost but a raw score below the 500th is not read. The index cannot
  sort by the composed boost, and ordering the list by raw score to match would drop the provider boost from every tie on
  every Distance browse — worse for every search to cover a rare overflow. The provider list has no such gap (one key on both
  sides). Revisit if a city ever holds more than 500 unreviewed listings serving one point.
