# Clinket Ajax Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T16:45:00-04:00 (ET)  
**City:** Ajax, ON (Downtown, Meadow Ridge, Pickering Village)  
**Total providers:** 41  
**Sources note:** public web only (business websites + YellowPages.ca + directory listings). No Facebook/Kijiji scrapes. Contact fields never invented.

## Counts by area

| Area | Providers |
|------|-----------|
| downtown | 18 |
| general | 10 |
| meadow-ridge | 7 |
| pickering-village | 6 |
| **Total** | **41** |

Area assignment is best-effort from street + postal on public listings (L3R/Unionville → unionville, L3P/Main St → markham-village, L3S → milliken, L6B/L6E east → cornell, L6C/Cachet → buttonville, else `general` for citywide/multi-neighbourhood businesses).

## Counts by category

| Category | Providers |
|----------|-----------|
| plumbing | 7 |
| hvac | 7 |
| electrical | 6 |
| hair-salon | 5 |
| roofing | 4 |
| auto-mechanic | 4 |
| landscaping | 1 |
| painting | 1 |
| handyman | 1 |
| locksmith | 1 |
| pest-control | 1 |
| house-cleaning | 1 |
| appliance-repair | 1 |
| movers | 1 |
| **Total** | **41** |

## Contact coverage

| Field | Count | Coverage |
|-------|------:|---------:|
| Phone | 41 | 100% |
| Email | 8 | 19% |
| Website | 8 | 19% |
| Street address | 31 | 75% |
| Phone + email (richest) | 8 | 19% |

Average completeness score: **0.59**

## Richest samples (name + phone + email)

- **Heavenly Landscape Ajax** — 905-903-5659 / info@heavenlylandscape.ca / https://www.heavenlylandscape.ca/ — `general` / landscaping
- **Painting Pickering Ajax Crew** — 289-624-6870 / info@paintingpickering.ca / https://paintingpickering.ca/ — `general` / painting
- **ProFix Appliance Repair Ajax** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/ — `general` / appliance-repair
- **ProFix House Cleaning Ajax** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/ — `general` / house-cleaning
- **ProFix Moving Support Ajax** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/ — `general` / movers
- **ProFix Pest Control Ajax** — 437-800-1917 / info@gtaprofix.ca / https://gtaprofix.ca/ — `general` / pest-control
- **Pro-Tek Mechanical** — 905-683-8315 / zarb@pro-tekmechanicalinc.com — `downtown` / plumbing
- **Wet Bandits Plumbing** — 647-330-1181 / info@wetbandits.plumbing — `meadow-ridge` / plumbing

## Output paths

- `/workspace/clinket-scrapes/ajax/downtown/auto-mechanic.json` (4)
- `/workspace/clinket-scrapes/ajax/downtown/electrical.json` (2)
- `/workspace/clinket-scrapes/ajax/downtown/hair-salon.json` (2)
- `/workspace/clinket-scrapes/ajax/downtown/hvac.json` (5)
- `/workspace/clinket-scrapes/ajax/downtown/plumbing.json` (3)
- `/workspace/clinket-scrapes/ajax/downtown/roofing.json` (2)
- `/workspace/clinket-scrapes/ajax/general/appliance-repair.json` (1)
- `/workspace/clinket-scrapes/ajax/general/handyman.json` (1)
- `/workspace/clinket-scrapes/ajax/general/house-cleaning.json` (1)
- `/workspace/clinket-scrapes/ajax/general/landscaping.json` (1)
- `/workspace/clinket-scrapes/ajax/general/locksmith.json` (1)
- `/workspace/clinket-scrapes/ajax/general/movers.json` (1)
- `/workspace/clinket-scrapes/ajax/general/painting.json` (1)
- `/workspace/clinket-scrapes/ajax/general/pest-control.json` (1)
- `/workspace/clinket-scrapes/ajax/general/plumbing.json` (2)
- `/workspace/clinket-scrapes/ajax/meadow-ridge/electrical.json` (2)
- `/workspace/clinket-scrapes/ajax/meadow-ridge/hair-salon.json` (1)
- `/workspace/clinket-scrapes/ajax/meadow-ridge/hvac.json` (1)
- `/workspace/clinket-scrapes/ajax/meadow-ridge/plumbing.json` (2)
- `/workspace/clinket-scrapes/ajax/meadow-ridge/roofing.json` (1)
- `/workspace/clinket-scrapes/ajax/pickering-village/electrical.json` (2)
- `/workspace/clinket-scrapes/ajax/pickering-village/hair-salon.json` (2)
- `/workspace/clinket-scrapes/ajax/pickering-village/hvac.json` (1)
- `/workspace/clinket-scrapes/ajax/pickering-village/roofing.json` (1)

## Gaps / notes

- Emails are sparse on YellowPages-only listings; richest contacts come from official business websites.
- Buttonville and Milliken have fewer dedicated storefront listings than Unionville / Markham Village; many trades are citywide (`general`).
- Some painters/handymen appear under both categories when the public site clearly offers both service lines (separate provider records).
- Social URLs only recorded when published on the official site (e.g. Studio 21 Instagram).
- Prior city scrapes were not modified.

