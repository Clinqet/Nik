# Clinket Brampton Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T16:15:00-04:00 (ET)  
**City:** Brampton, ON  
**Total providers:** 77  
**Sources note:** public web only (business websites + YellowPages.ca + ESA contractor locator + TrustedPros/directory listings). No Facebook/Kijiji scrapes (login/CAPTCHA). Contact fields never invented — unknowns left null.

## Counts by area

| Area | Providers |
|------|-----------|
| bramalea | 26 |
| general | 22 |
| downtown | 15 |
| springdale | 7 |
| gore | 5 |
| heart-lake | 2 |
| **Total** | **77** |

Area assignment is best-effort from street + postal on public listings (L6T/L6S → bramalea, L6V/L6W downtown core → downtown, L6R → springdale, L6Z → heart-lake, L6P → gore, else `general` for citywide/multi-neighbourhood businesses).

## Counts by category

| Category | Providers |
|----------|-----------|
| plumbing | 13 |
| electrical | 10 |
| hvac | 9 |
| hair-salon | 8 |
| painting | 8 |
| auto-mechanic | 7 |
| roofing | 7 |
| house-cleaning | 6 |
| landscaping | 3 |
| appliance-repair | 3 |
| handyman | 3 |
| **Total** | **77** |

## Contact coverage

| Field | Count | Coverage |
|-------|------:|---------:|
| Phone | 77 | 100% |
| Email | 11 | 14% |
| Website | 18 | 23% |
| Street address | 71 | 92% |
| Phone + email (richest) | 11 | 14% |

Average completeness score: **0.63**

## Richest samples (name + phone + email)

- **Bravora Appliance Repair** — 905-965-2199 / bravoratech@gmail.com / https://bravoraappliance.com/ — `general` / appliance-repair
- **Forever Green Lawn & Landscape Inc** — 905-454-0875 / info@forevergreenoutdoors.com / https://forevergreeninc.ca/ — `bramalea` / landscaping
- **GM Heating & Cooling Inc** — 647-938-5352 / info@gmheating.ca / https://gmheating.ca/ — `bramalea` / hvac
- **Nutri-Lawn Brampton** — 416-620-1800 / sales@nutrilawn.com / https://www.nutrilawn.com/brampton — `general` / landscaping
- **Royal Roofs Ltd** — 416-858-5714 / customerservice@royalroofs.com / https://royalroofs.com/ — `general` / roofing
- **Shield Pro Roofing Inc** — 647-927-8490 / info@shieldproroofing.com / https://shieldproroofing.com/ — `bramalea` / roofing
- **Simon Bros Auto Repair Inc** — 905-794-3033 / info@simonbrosautopro.com / https://simonbrosautopro.com/en/ — `bramalea` / auto-mechanic
- **Special Gas Services** — 905-451-9081 / info@specialgasservices.com / https://www.specialgasservices.com/our-services — `downtown` / hvac
- **Superior Plumbing & Heating** — 289-210-4946 / info@superiorplumbing.ca / https://superiorplumbing.ca/brampton/ — `downtown` / plumbing
- **Superior Power Electric** — 647-872-9954 / info@superiorpowerelectric.ca / https://superiorpowerelectric.ca/ — `gore` / electrical
- **Tactic Roofing** — 647-205-1150 / info@tacticroofing.com / https://tacticroofing.com/ — `downtown` / roofing

## Strong phone + website (no public email found)

- **Clear Cut Group** — 905-824-6597 / https://clearcutgroup.ca/grass-cutting-brampton/ — `general` / landscaping
- **Exhale Hair Studio & Beauty Supplies** — 905-455-8689 / https://exhalehairsalon.com/ — `bramalea` / hair-salon
- **Fix It Brampton** — 289-275-3973 / https://fixitbrampton.ca/ — `general` / handyman
- **HC Roofing** — 647-771-5809 / https://hcroofing.ca/ — `bramalea` / roofing
- **Mr. Rooter Plumbing of Brampton** — 905-452-1531 / https://www.mrrooter.ca/brampton/ — `general` / plumbing
- **Peatson's Heating & Air Conditioning Ltd** — 905-451-6704 / https://www.peatsonsheatair.com/ — `bramalea` / hvac
- **Peel Heating and Air Conditioning** — 289-498-2952 / https://www.peelheating.ca/ — `bramalea` / hvac

## Output paths

All under `/workspace/clinket-scrapes/brampton/<area>/<category>.json`:

- `bramalea/auto-mechanic.json` (3)
- `bramalea/electrical.json` (5)
- `bramalea/hair-salon.json` (3)
- `bramalea/house-cleaning.json` (3)
- `bramalea/hvac.json` (5)
- `bramalea/landscaping.json` (1)
- `bramalea/painting.json` (1)
- `bramalea/plumbing.json` (2)
- `bramalea/roofing.json` (3)
- `downtown/auto-mechanic.json` (3)
- `downtown/electrical.json` (2)
- `downtown/hair-salon.json` (2)
- `downtown/hvac.json` (2)
- `downtown/painting.json` (2)
- `downtown/plumbing.json` (3)
- `downtown/roofing.json` (1)
- `general/appliance-repair.json` (3)
- `general/auto-mechanic.json` (1)
- `general/hair-salon.json` (1)
- `general/handyman.json` (2)
- `general/house-cleaning.json` (2)
- `general/hvac.json` (1)
- `general/landscaping.json` (2)
- `general/painting.json` (2)
- `general/plumbing.json` (6)
- `general/roofing.json` (2)
- `gore/electrical.json` (1)
- `gore/hair-salon.json` (1)
- `gore/house-cleaning.json` (1)
- `gore/painting.json` (1)
- `gore/plumbing.json` (1)
- `heart-lake/painting.json` (1)
- `heart-lake/plumbing.json` (1)
- `springdale/electrical.json` (2)
- `springdale/hair-salon.json` (1)
- `springdale/handyman.json` (1)
- `springdale/hvac.json` (1)
- `springdale/painting.json` (1)
- `springdale/roofing.json` (1)

## Gaps / follow-ups

- **heart-lake** is thin (2 providers) — more Heart Lake / Sandalwood listings needed in a later batch.
- **handyman**, **landscaping**, and **appliance-repair** each have only 3 providers — expand via Homestars + Canada411.
- **Email coverage (14%)** is the weakest contact field; many YellowPages listings show phone only. Follow up by fetching contact pages on known websites.
- Social URLs (Facebook/Instagram) intentionally sparse — only captured when listed on official business sites.
- Prior cities (Hamilton, Burlington, Oakville, Mississauga, Toronto) untouched.

## Source index (primary)

- https://www.yellowpages.ca/search/si/1/Plumbers/Brampton+ON
- https://www.yellowpages.ca/search/si/1/Electricians/Brampton+ON
- https://www.yellowpages.ca/search/si/1/Heating+%26+Air+Conditioning/Brampton+ON
- https://www.yellowpages.ca/search/si/1/Roofing+Contractors/Brampton+ON
- https://www.yellowpages.ca/search/si/1/Painting+Contractors/Brampton+ON
- https://www.yellowpages.ca/search/si/1/Automobile+Repair+%26+Service/Brampton+ON
- https://www.yellowpages.ca/search/si/1/Cleaning+Service/Brampton+ON
- https://www.yellowpages.ca/search/si/1/Hair+Salons/Brampton+ON
- https://findacontractor.esasafe.com/ (Brampton residential LECs)
- Business sites incl. superiorpowerelectric.ca, specialgasservices.com, peelheating.ca, peatsonsheatair.com, gmheating.ca, tacticroofing.com, shieldproroofing.com, hcroofing.ca, royalroofs.com, forevergreeninc.ca, bravoraappliance.com, simonbrosautopro.com, superiorplumbing.ca, mrrooter.ca/brampton/, exhalehairsalon.com
