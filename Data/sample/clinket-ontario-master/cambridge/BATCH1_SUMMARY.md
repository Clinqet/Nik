# Clinket Cambridge Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T16:45:00-04:00 (ET)  
**City:** Cambridge, ON (Galt, Preston, Hespeler, Downtown)  
**Total providers:** 60  
**Sources note:** public web only (business websites + YellowPages.ca + directory listings). No Facebook/Kijiji scrapes. Contact fields never invented.

## Counts by area

| Area | Providers |
|------|-----------|
| general | 22 |
| galt | 19 |
| hespeler | 8 |
| preston | 6 |
| downtown | 5 |
| **Total** | **60** |

Area assignment is best-effort from street + postal on public listings (N3C / Queen St E → hespeler, N3H / Chestnut / King St E → preston, Water St / Main St / Augusta / Oxford → downtown, N1R/N1S/N1P → galt, else `general` for citywide / N1T industrial corridor businesses).

## Counts by category

| Category | Providers |
|----------|-----------|
| plumbing | 7 |
| electrical | 7 |
| hvac | 7 |
| hair-salon | 6 |
| auto-mechanic | 6 |
| roofing | 6 |
| landscaping | 5 |
| appliance-repair | 5 |
| painting | 5 |
| handyman | 3 |
| house-cleaning | 3 |
| **Total** | **60** |

## Contact coverage

| Field | Count | Coverage |
|-------|------:|---------:|
| Phone | 60 | 100% |
| Email | 12 | 20% |
| Website | 20 | 33% |
| Street address | 51 | 85% |
| Phone + email (richest) | 12 | 20% |

Average completeness score: **0.65**

## Richest samples (name + phone + email)

- **Aire One Auto Repair** — 416-906-3665 / aireoneauto@gmail.com / https://aireoneauto.ca/ — `general` / auto-mechanic
- **Castio Cleaning Services** — 226-400-7376 / hello@castiocleaning.com / https://castiocleaning.com/cambridge/ — `general` / house-cleaning
- **Custom Contracting Cambridge** — 226-210-5823 / info@customcontracting.ca / https://www.custom-contracting.ca/locations/cambridge — `general` / roofing
- **Daisy Fresh Cleaning Service** — 519-624-9050 / info@daisyfreshcleaningservice.ca / https://www.daisyfreshcleaningservice.ca/ — `general` / house-cleaning
- **Hair Studio 31** — 519-260-1650 / hairstudio31ca@gmail.com / https://hairstudio31.ca/ — `hespeler` / hair-salon
- **Hometown Fix** — 833-466-3349 / info@hometownfix.ca / https://hometownfix.ca/locations/handyman-cambridge/ — `general` / handyman
- **John L Plumbing and Drain Cleaning** — 519-572-5261 / john.lenarczyk@gmail.com / https://www.johnlplumbing.com/ — `galt` / plumbing
- **Journeyman Renovator** — 519-841-5204 / journeymanreno@gmail.com / https://www.journeymanrenovator.com/ — `general` / handyman
- **Professional Electrical Services** — 647-258-4223 / info@professional-electrical.ca / https://professional-electrical.ca/ — `hespeler` / electrical
- **Reliant Plumbing** — 519-778-3828 / hello@reliantplumbing.ca / https://www.reliantplumbing.ca/ — `general` / plumbing
- **Vaniti Hair Co** — 519-740-7458 / Beauty@vanitihairco.ca / https://www.vanitihairco.ca/ — `downtown` / hair-salon
- **iCare Appliance Repair Cambridge** — 647-370-2828 / info@icarerepair.ca / https://www.icarerepair.ca/cambridge-appliance-repairs/ — `general` / appliance-repair

## Output paths

- `/workspace/clinket-scrapes/cambridge/downtown/hair-salon.json` (3)
- `/workspace/clinket-scrapes/cambridge/downtown/hvac.json` (2)
- `/workspace/clinket-scrapes/cambridge/galt/appliance-repair.json` (2)
- `/workspace/clinket-scrapes/cambridge/galt/auto-mechanic.json` (2)
- `/workspace/clinket-scrapes/cambridge/galt/electrical.json` (4)
- `/workspace/clinket-scrapes/cambridge/galt/hvac.json` (1)
- `/workspace/clinket-scrapes/cambridge/galt/landscaping.json` (1)
- `/workspace/clinket-scrapes/cambridge/galt/painting.json` (4)
- `/workspace/clinket-scrapes/cambridge/galt/plumbing.json` (4)
- `/workspace/clinket-scrapes/cambridge/galt/roofing.json` (1)
- `/workspace/clinket-scrapes/cambridge/general/appliance-repair.json` (2)
- `/workspace/clinket-scrapes/cambridge/general/auto-mechanic.json` (2)
- `/workspace/clinket-scrapes/cambridge/general/electrical.json` (1)
- `/workspace/clinket-scrapes/cambridge/general/handyman.json` (3)
- `/workspace/clinket-scrapes/cambridge/general/house-cleaning.json` (3)
- `/workspace/clinket-scrapes/cambridge/general/hvac.json` (3)
- `/workspace/clinket-scrapes/cambridge/general/landscaping.json` (2)
- `/workspace/clinket-scrapes/cambridge/general/plumbing.json` (2)
- `/workspace/clinket-scrapes/cambridge/general/roofing.json` (4)
- `/workspace/clinket-scrapes/cambridge/hespeler/auto-mechanic.json` (1)
- `/workspace/clinket-scrapes/cambridge/hespeler/electrical.json` (2)
- `/workspace/clinket-scrapes/cambridge/hespeler/hair-salon.json` (2)
- `/workspace/clinket-scrapes/cambridge/hespeler/landscaping.json` (2)
- `/workspace/clinket-scrapes/cambridge/hespeler/roofing.json` (1)
- `/workspace/clinket-scrapes/cambridge/preston/appliance-repair.json` (1)
- `/workspace/clinket-scrapes/cambridge/preston/auto-mechanic.json` (1)
- `/workspace/clinket-scrapes/cambridge/preston/hair-salon.json` (1)
- `/workspace/clinket-scrapes/cambridge/preston/hvac.json` (1)
- `/workspace/clinket-scrapes/cambridge/preston/painting.json` (1)
- `/workspace/clinket-scrapes/cambridge/preston/plumbing.json` (1)

## Gaps / notes

- Emails are sparse on YellowPages-only listings; richest contacts come from official business websites.
- Preston and downtown have fewer dedicated trade storefronts than Galt; many multi-neighbourhood trades land in `general`.
- Spelling note: area slug is correctly `hespeler`.
- Social URLs only recorded when published on the official site.
- Prior city scrapes were not modified.

