# Clinket Markham Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T16:30:00-04:00 (ET)  
**City:** Markham, ON (Unionville, Markham Village, Milliken, Cornell, Buttonville)  
**Total providers:** 77  
**Sources note:** public web only (business websites + YellowPages.ca + directory listings). No Facebook/Kijiji scrapes. Contact fields never invented.

## Counts by area

| Area | Providers |
|------|-----------|
| unionville | 26 |
| general | 20 |
| markham-village | 17 |
| cornell | 7 |
| milliken | 4 |
| buttonville | 3 |
| **Total** | **77** |

Area assignment is best-effort from street + postal on public listings (L3R/Unionville → unionville, L3P/Main St → markham-village, L3S → milliken, L6B/L6E east → cornell, L6C/Cachet → buttonville, else `general` for citywide/multi-neighbourhood businesses).

## Counts by category

| Category | Providers |
|----------|-----------|
| electrical | 12 |
| plumbing | 11 |
| hvac | 10 |
| auto-mechanic | 9 |
| roofing | 8 |
| hair-salon | 7 |
| landscaping | 4 |
| handyman | 4 |
| house-cleaning | 4 |
| appliance-repair | 4 |
| painting | 4 |
| **Total** | **77** |

## Contact coverage

| Field | Count | Coverage |
|-------|------:|---------:|
| Phone | 77 | 100% |
| Email | 17 | 22% |
| Website | 27 | 35% |
| Street address | 60 | 77% |
| Phone + email (richest) | 17 | 22% |

Average completeness score: **0.62**

## Richest samples (name + phone + email)

- **CertaPro Painters of Markham** — 647-792-6127 / markham-office@certapro.com / https://certapro.com/markham/ — `general` / painting
- **Cozy World HVAC** — 416-855-3651 / sales@cozyworld.ca / https://www.cozyworld.ca/locations/markham/ — `general` / hvac
- **Dima Plumbing** — 647-289-9576 / dimaplumbing@gmail.com / https://dimaplumbing.com/ — `cornell` / plumbing
- **Greenblock Landscape** — 905-202-5743 / sal@greenblock.ca / https://www.greenblocklandscape.ca/service-areas/unionville/ — `unionville` / landscaping
- **Humber Valley Landscaping Inc** — 416-473-0000 / chris@hvlandscaping.com / https://www.hvlandscaping.com/unionville/ — `cornell` / landscaping
- **JK Appliances** — 647-560-8966 / info@jkappliances.ca / https://jkappliances.ca/areas/markham — `general` / appliance-repair
- **Landscape Accents** — 905-513-9930 / info@landscapeaccents.com / http://www.landscapeaccents.com/ — `unionville` / landscaping
- **MSD Contracting** — 905-726-3336 / info@msdcon.ca / https://www.msdcon.ca/markham — `general` / landscaping
- **Markham Heating & Air Conditioning** — 905-471-1748 / book@markhamheating.com / https://markhamheating.com/ — `general` / hvac
- **Markham Plumbing Drain Repair & Drain Cleaning Inc** — 647-372-5221 / info@markhamplumbing.ca / https://markhamplumbing.ca/contact/ — `markham-village` / plumbing
- **Moon Tech Electric** — 289-395-1932 / info@moontechelectric.ca / https://moontechelectric.ca/residential-electrician/markham/ — `general` / electrical
- **Pro Wave Hair Salon** — 905-513-7778 / prowavehair@gmail.com / https://prowavehair.com/ — `unionville` / hair-salon

## Output paths

- `/workspace/clinket-scrapes/markham/buttonville/hair-salon.json` (1)
- `/workspace/clinket-scrapes/markham/buttonville/hvac.json` (1)
- `/workspace/clinket-scrapes/markham/buttonville/plumbing.json` (1)
- `/workspace/clinket-scrapes/markham/cornell/electrical.json` (2)
- `/workspace/clinket-scrapes/markham/cornell/hair-salon.json` (2)
- `/workspace/clinket-scrapes/markham/cornell/landscaping.json` (1)
- `/workspace/clinket-scrapes/markham/cornell/plumbing.json` (1)
- `/workspace/clinket-scrapes/markham/cornell/roofing.json` (1)
- `/workspace/clinket-scrapes/markham/general/appliance-repair.json` (4)
- `/workspace/clinket-scrapes/markham/general/electrical.json` (1)
- `/workspace/clinket-scrapes/markham/general/handyman.json` (4)
- `/workspace/clinket-scrapes/markham/general/house-cleaning.json` (2)
- `/workspace/clinket-scrapes/markham/general/hvac.json` (3)
- `/workspace/clinket-scrapes/markham/general/landscaping.json` (1)
- `/workspace/clinket-scrapes/markham/general/painting.json` (4)
- `/workspace/clinket-scrapes/markham/general/plumbing.json` (1)
- `/workspace/clinket-scrapes/markham/markham-village/auto-mechanic.json` (6)
- `/workspace/clinket-scrapes/markham/markham-village/electrical.json` (4)
- `/workspace/clinket-scrapes/markham/markham-village/hair-salon.json` (1)
- `/workspace/clinket-scrapes/markham/markham-village/house-cleaning.json` (2)
- `/workspace/clinket-scrapes/markham/markham-village/hvac.json` (1)
- `/workspace/clinket-scrapes/markham/markham-village/plumbing.json` (2)
- `/workspace/clinket-scrapes/markham/markham-village/roofing.json` (1)
- `/workspace/clinket-scrapes/markham/milliken/electrical.json` (2)
- `/workspace/clinket-scrapes/markham/milliken/hvac.json` (1)
- `/workspace/clinket-scrapes/markham/milliken/roofing.json` (1)
- `/workspace/clinket-scrapes/markham/unionville/auto-mechanic.json` (3)
- `/workspace/clinket-scrapes/markham/unionville/electrical.json` (3)
- `/workspace/clinket-scrapes/markham/unionville/hair-salon.json` (3)
- `/workspace/clinket-scrapes/markham/unionville/hvac.json` (4)
- `/workspace/clinket-scrapes/markham/unionville/landscaping.json` (2)
- `/workspace/clinket-scrapes/markham/unionville/plumbing.json` (6)
- `/workspace/clinket-scrapes/markham/unionville/roofing.json` (5)

## Gaps / notes

- Emails are sparse on YellowPages-only listings; richest contacts come from official business websites.
- Buttonville and Milliken have fewer dedicated storefront listings than Unionville / Markham Village; many trades are citywide (`general`).
- Some painters/handymen appear under both categories when the public site clearly offers both service lines (separate provider records).
- Social URLs only recorded when published on the official site (e.g. Studio 21 Instagram).
- Prior city scrapes were not modified.

