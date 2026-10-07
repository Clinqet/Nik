# Clinket Pickering Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T16:45:00-04:00 (ET)  
**City:** Pickering, ON (Bay Ridges, Rosebank, Amberlea)  
**Total providers:** 35  
**Sources note:** public web only (business websites + YellowPages.ca + directory listings). No Facebook/Kijiji scrapes. Contact fields never invented.

## Counts by area

| Area | Providers |
|------|-----------|
| bay-ridges | 18 |
| general | 10 |
| rosebank | 6 |
| amberlea | 1 |
| **Total** | **35** |

Area assignment is best-effort from street + postal on public listings (L3R/Unionville → unionville, L3P/Main St → markham-village, L3S → milliken, L6B/L6E east → cornell, L6C/Cachet → buttonville, else `general` for citywide/multi-neighbourhood businesses).

## Counts by category

| Category | Providers |
|----------|-----------|
| plumbing | 6 |
| electrical | 6 |
| hvac | 5 |
| auto-mechanic | 4 |
| roofing | 3 |
| hair-salon | 3 |
| landscaping | 1 |
| handyman | 1 |
| painting | 1 |
| appliance-repair | 1 |
| locksmith | 1 |
| pest-control | 1 |
| house-cleaning | 1 |
| movers | 1 |
| **Total** | **35** |

## Contact coverage

| Field | Count | Coverage |
|-------|------:|---------:|
| Phone | 35 | 100% |
| Email | 10 | 28% |
| Website | 8 | 22% |
| Street address | 24 | 68% |
| Phone + email (richest) | 10 | 28% |

Average completeness score: **0.59**

## Richest samples (name + phone + email)

- **Heavenly Landscape** — 905-903-5659 / info@heavenlylandscape.ca / https://www.heavenlylandscape.ca/ — `general` / landscaping
- **Painting Pickering** — 289-624-6870 / info@paintingpickering.ca / https://paintingpickering.ca/ — `general` / painting
- **ProFix House Cleaning Pickering** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/service-area/pickering — `general` / house-cleaning
- **ProFix Locksmith Pickering** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/service-area/pickering — `general` / locksmith
- **ProFix Moving Support Pickering** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/service-area/pickering — `general` / movers
- **ProFix Pest Control Pickering** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/service-area/pickering — `general` / pest-control
- **Caldwell Plumbing** — 289-275-1376 / caldwell.plumbing@gmail.com — `bay-ridges` / plumbing
- **City Core Mechanical Ltd** — 905-839-7220 / service@citycoremechanical.com — `bay-ridges` / plumbing
- **Mic Mechanical** — 289-203-2603 / Erica@micmechanical.com — `general` / plumbing
- **Professional Plumbing Group** — 647-204-2958 / andrew@ppg.works — `general` / plumbing

## Output paths

- `/workspace/clinket-scrapes/pickering/amberlea/hvac.json` (1)
- `/workspace/clinket-scrapes/pickering/bay-ridges/auto-mechanic.json` (3)
- `/workspace/clinket-scrapes/pickering/bay-ridges/electrical.json` (5)
- `/workspace/clinket-scrapes/pickering/bay-ridges/hair-salon.json` (1)
- `/workspace/clinket-scrapes/pickering/bay-ridges/hvac.json` (4)
- `/workspace/clinket-scrapes/pickering/bay-ridges/plumbing.json` (3)
- `/workspace/clinket-scrapes/pickering/bay-ridges/roofing.json` (2)
- `/workspace/clinket-scrapes/pickering/general/appliance-repair.json` (1)
- `/workspace/clinket-scrapes/pickering/general/house-cleaning.json` (1)
- `/workspace/clinket-scrapes/pickering/general/landscaping.json` (1)
- `/workspace/clinket-scrapes/pickering/general/locksmith.json` (1)
- `/workspace/clinket-scrapes/pickering/general/movers.json` (1)
- `/workspace/clinket-scrapes/pickering/general/painting.json` (1)
- `/workspace/clinket-scrapes/pickering/general/pest-control.json` (1)
- `/workspace/clinket-scrapes/pickering/general/plumbing.json` (2)
- `/workspace/clinket-scrapes/pickering/general/roofing.json` (1)
- `/workspace/clinket-scrapes/pickering/rosebank/auto-mechanic.json` (1)
- `/workspace/clinket-scrapes/pickering/rosebank/electrical.json` (1)
- `/workspace/clinket-scrapes/pickering/rosebank/hair-salon.json` (2)
- `/workspace/clinket-scrapes/pickering/rosebank/handyman.json` (1)
- `/workspace/clinket-scrapes/pickering/rosebank/plumbing.json` (1)

## Gaps / notes

- Emails are sparse on YellowPages-only listings; richest contacts come from official business websites.
- Buttonville and Milliken have fewer dedicated storefront listings than Unionville / Markham Village; many trades are citywide (`general`).
- Some painters/handymen appear under both categories when the public site clearly offers both service lines (separate provider records).
- Social URLs only recorded when published on the official site (e.g. Studio 21 Instagram).
- Prior city scrapes were not modified.

