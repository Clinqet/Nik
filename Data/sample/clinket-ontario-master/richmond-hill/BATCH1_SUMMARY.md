# Clinket Richmond Hill Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T16:45:00-04:00 (ET)  
**City:** Richmond Hill, ON (Oak Ridges, Bayview, Downtown, Mill Pond)  
**Total providers:** 49  
**Sources note:** public web only (business websites + YellowPages.ca + directory listings). No Facebook/Kijiji scrapes. Contact fields never invented.

## Counts by area

| Area | Providers |
|------|-----------|
| downtown | 21 |
| general | 11 |
| bayview | 9 |
| oak-ridges | 5 |
| mill-pond | 3 |
| **Total** | **49** |

Area assignment is best-effort from street + postal on public listings (L3R/Unionville → unionville, L3P/Main St → markham-village, L3S → milliken, L6B/L6E east → cornell, L6C/Cachet → buttonville, else `general` for citywide/multi-neighbourhood businesses).

## Counts by category

| Category | Providers |
|----------|-----------|
| plumbing | 8 |
| hvac | 6 |
| landscaping | 6 |
| electrical | 5 |
| roofing | 5 |
| auto-mechanic | 5 |
| hair-salon | 5 |
| locksmith | 2 |
| house-cleaning | 2 |
| painting | 1 |
| pest-control | 1 |
| appliance-repair | 1 |
| handyman | 1 |
| movers | 1 |
| **Total** | **49** |

## Contact coverage

| Field | Count | Coverage |
|-------|------:|---------:|
| Phone | 49 | 100% |
| Email | 8 | 16% |
| Website | 13 | 26% |
| Street address | 36 | 73% |
| Phone + email (richest) | 8 | 16% |

Average completeness score: **0.61**

## Richest samples (name + phone + email)

- **CertaPro Painters of Richmond Hill & Vaughan** — 647-792-6272 / sshaikh@certapro.com / https://certapro.com/richmond-hill-and-vaughan/ — `downtown` / painting
- **GTA ProFix Home Services** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/ — `general` / house-cleaning
- **GTA ProFix Moving Support** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/ — `general` / movers
- **Richmond Hill Plumbing Group** — 416-835-3535 / info@rhplumbing.ca / https://rhplumbing.ca/ — `general` / plumbing
- **Stan Mechanical Contractors Ltd** — 905-883-4175 / info@plumberrichmondhill.ca / https://www.plumberrichmondhill.ca/ — `oak-ridges` / plumbing
- **Summit Contractors** — 647-533-2940 / info@summitcontractors.ca / https://summitcontractors.ca/ — `general` / handyman
- **The Cleaning Expert** — 647-699-7165 / info@thecleaningexpert.ca / https://thecleaningexpert.ca/locations/richmond-hill/post-construction-cleaning-services/ — `general` / house-cleaning
- **iFix Plumbing & Drains** — 647-691-2141 / ifixplumbingdrains@gmail.com / https://ifixplumbingdrains.ca/ — `oak-ridges` / plumbing

## Output paths

- `/workspace/clinket-scrapes/richmond-hill/bayview/electrical.json` (2)
- `/workspace/clinket-scrapes/richmond-hill/bayview/hvac.json` (3)
- `/workspace/clinket-scrapes/richmond-hill/bayview/pest-control.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/bayview/plumbing.json` (2)
- `/workspace/clinket-scrapes/richmond-hill/bayview/roofing.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/downtown/appliance-repair.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/downtown/auto-mechanic.json` (5)
- `/workspace/clinket-scrapes/richmond-hill/downtown/electrical.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/downtown/hair-salon.json` (4)
- `/workspace/clinket-scrapes/richmond-hill/downtown/hvac.json` (2)
- `/workspace/clinket-scrapes/richmond-hill/downtown/landscaping.json` (5)
- `/workspace/clinket-scrapes/richmond-hill/downtown/painting.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/downtown/roofing.json` (2)
- `/workspace/clinket-scrapes/richmond-hill/general/handyman.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/general/house-cleaning.json` (2)
- `/workspace/clinket-scrapes/richmond-hill/general/landscaping.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/general/locksmith.json` (2)
- `/workspace/clinket-scrapes/richmond-hill/general/movers.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/general/plumbing.json` (4)
- `/workspace/clinket-scrapes/richmond-hill/mill-pond/electrical.json` (2)
- `/workspace/clinket-scrapes/richmond-hill/mill-pond/hvac.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/oak-ridges/hair-salon.json` (1)
- `/workspace/clinket-scrapes/richmond-hill/oak-ridges/plumbing.json` (2)
- `/workspace/clinket-scrapes/richmond-hill/oak-ridges/roofing.json` (2)

## Gaps / notes

- Emails are sparse on YellowPages-only listings; richest contacts come from official business websites.
- Buttonville and Milliken have fewer dedicated storefront listings than Unionville / Markham Village; many trades are citywide (`general`).
- Some painters/handymen appear under both categories when the public site clearly offers both service lines (separate provider records).
- Social URLs only recorded when published on the official site (e.g. Studio 21 Instagram).
- Prior city scrapes were not modified.

