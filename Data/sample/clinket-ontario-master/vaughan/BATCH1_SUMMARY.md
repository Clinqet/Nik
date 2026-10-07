# Clinket Vaughan Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T16:20:00-04:00 (ET)  
**City:** Vaughan, ON (Woodbridge, Maple, Concord, Thornhill-Vaughan, Kleinburg)  
**Total providers:** 88  
**Sources note:** public web only (business websites + YellowPages.ca + TrustedPros). No Facebook/Kijiji scrapes (login/CAPTCHA). Contact fields never invented — unknowns left null.

## Counts by area

| Area | Providers |
|------|-----------|
| general | 24 |
| concord | 21 |
| woodbridge | 21 |
| maple | 14 |
| thornhill | 6 |
| kleinburg | 2 |
| **Total** | **88** |

Area assignment is best-effort from street + postal on public listings (L4L/L4H → woodbridge, L6A → maple, L4K → concord, L4J/L3T → thornhill, L4H north/Kleinburg corridor → kleinburg, else `general` for citywide/multi-neighbourhood businesses).

## Counts by category

| Category | Providers |
|----------|-----------|
| plumbing | 13 |
| electrical | 12 |
| hvac | 11 |
| auto-mechanic | 11 |
| hair-salon | 9 |
| roofing | 9 |
| landscaping | 5 |
| house-cleaning | 5 |
| painting | 5 |
| appliance-repair | 4 |
| handyman | 4 |
| **Total** | **88** |

## Contact coverage

| Field | Count | Coverage |
|-------|------:|---------:|
| Phone | 88 | 100% |
| Email | 15 | 17% |
| Website | 44 | 50% |
| Street address | 61 | 69% |
| Phone + email (richest) | 15 | 17% |

Average completeness score: **0.62**

## Richest samples (name + phone + email)

- **Antech Electric** — 905-660-1384 / service@antechelectric.com / https://www.antechelectric.com/licensed-electrician-vaughan — `woodbridge` / electrical
- **Appliance Forever** — 647-834-4646 / info@applianceforever.ca / https://applianceforever.ca/service-areas/vaughan/ — `general` / appliance-repair
- **Bramwood Electrical Services** — 905-761-9417 / service@bramwoodelectric.ca / https://www.bramwoodservices.com/electrical-contracting.html — `concord` / electrical
- **EcoFrost Heating** — 416-835-4775 / ecofrostsales@gmail.com / https://www.ecofrostheating.ca/locations/vaughan — `general` / hvac
- **Hive 5 Plumbing & Drains** — 647-535-5560 / info@hive5plumbing.ca / https://www.hive5plumbing.ca/service-area/plumber-vaughan — `woodbridge` / plumbing
- **Integrity Roofers** — 647-504-2121 / info@integrityroofers.ca / https://integrityroofers.com/service-areas/roof-repair-vaughan/ — `general` / roofing
- **M&M Home Comfort** — 289-637-3541 / customerservice@mmhomecomfort.com / https://mmhomecomfort.com/hvac-woodbridge/ — `maple` / hvac
- **Monster Property Services** — 647-255-6900 / help@monsterpropertyservices.ca / https://www.monsterpropertyservices.ca/locations/vaughan — `general` / landscaping
- **Navraj Air Systems** — 647-669-5009 / info@navrajairsystems.ca / https://navrajairsystems.ca/vaughan — `general` / hvac
- **Plumbers Vaughan** — 647-560-1185 / plumbersvaughan@gmail.com / https://plumbersvaughan.com/ — `maple` / plumbing
- **Seam Roofing** — 647-371-0932 / hello@SeamRoofing.ca / https://seamroofing.ca/service-area/vaughan — `general` / roofing
- **The Gardener Vaughan** — 905-417-2339 / vaughan@hirethegardener.com / https://www.hirethegardener.com/vaughan/ — `woodbridge` / landscaping
- **Tron Electrical & Automation** — 416-936-5669 / office@tronelectrical.com / https://tronelectrical.com/gta/vaughan — `woodbridge` / electrical
- **Vibo Electric** — 647-330-0532 / info@viboelectric.com / https://www.viboelectric.ca/vaughan — `concord` / electrical
- **York Trails Landscaping** — 647-409-7868 / yorktrailslandscaping@gmail.com / https://www.yorktrailslandscaping.ca/ — `general` / landscaping

## Strong phone + website (no public email found)

- **Clean Proper** — 647-695-6878 / https://cleanproper.ca/locations/vaughan/ — `general` / house-cleaning
- **ComoMaintenance** — 905-392-0480 / https://www.comomaintenance.com/property-maintenance-vaughan — `general` / house-cleaning
- **First Choice Haircutters Maple Major Mac** — 905-832-6151 / https://www.firstchoice.com/ — `maple` / hair-salon
- **First Choice Haircutters Thornhill Bathurst** — 905-882-9100 / https://www.firstchoice.com/ — `thornhill` / hair-salon
- **First Choice Haircutters Woodbridge Weston** — 905-417-5952 / https://www.firstchoice.com/ — `woodbridge` / hair-salon
- **First Choice Haircutters Yonge Thornhill** — 905-886-1673 / https://www.firstchoice.com/ — `thornhill` / hair-salon
- **GTA Home Fix** — 437-525-2080 / https://gtahomefix.com/service-area/vaughan — `general` / appliance-repair
- **Green Auto** — 416-916-0532 / https://greenautogroup.ca/ — `concord` / auto-mechanic
- **Handyman Connection of Vaughan** — 905-884-7678 / https://handymanconnection.com/vaughan/services/aging-in-place/ — `general` / handyman
- **InspireClean** — 905-991-4312 / https://inspireclean.ca/house-cleaning-service-vaughan/ — `general` / house-cleaning
- **Intact Roofing** — 416-616-6761 / https://intactroofing.com/ — `general` / roofing
- **JP Landscape Design** — 416-837-2009 / https://jplandscapedesign.ca/ — `kleinburg` / landscaping

## Output paths

All under `/workspace/clinket-scrapes/vaughan/<area>/<category>.json`:

- `concord/auto-mechanic.json` (3)
- `concord/electrical.json` (5)
- `concord/hvac.json` (4)
- `concord/plumbing.json` (6)
- `concord/roofing.json` (3)
- `general/appliance-repair.json` (3)
- `general/handyman.json` (4)
- `general/house-cleaning.json` (4)
- `general/hvac.json` (2)
- `general/landscaping.json` (2)
- `general/painting.json` (4)
- `general/plumbing.json` (1)
- `general/roofing.json` (4)
- `kleinburg/hvac.json` (1)
- `kleinburg/landscaping.json` (1)
- `maple/auto-mechanic.json` (1)
- `maple/electrical.json` (2)
- `maple/hair-salon.json` (4)
- `maple/house-cleaning.json` (1)
- `maple/hvac.json` (1)
- `maple/painting.json` (1)
- `maple/plumbing.json` (3)
- `maple/roofing.json` (1)
- `thornhill/auto-mechanic.json` (1)
- `thornhill/electrical.json` (1)
- `thornhill/hair-salon.json` (2)
- `thornhill/hvac.json` (1)
- `thornhill/plumbing.json` (1)
- `woodbridge/appliance-repair.json` (1)
- `woodbridge/auto-mechanic.json` (6)
- `woodbridge/electrical.json` (4)
- `woodbridge/hair-salon.json` (3)
- `woodbridge/hvac.json` (2)
- `woodbridge/landscaping.json` (2)
- `woodbridge/plumbing.json` (2)
- `woodbridge/roofing.json` (1)

## Gaps / notes

- **Kleinburg** is thin on brick-and-mortar listings (postal L0J / estate corridor); most Kleinburg coverage is via citywide Vaughan operators listed under `general` or Woodbridge with Kleinburg in `serviceAreas`.
- **Appliance repair** improved with dedicated locals (Appliance Forever, North Star Woodbridge, Vaughan Appliance Repair); still fewer than trades like plumbing/electrical.
- **Painting** YellowPages density for Vaughan proper is low; several GTA painters that publicly advertise Vaughan service are included under `general` — verify coverage before outreach.
- **House cleaning / handyman** lean on service-area landing pages more than storefronts; emails rarely published.
- Social URLs only recorded when found on official business sites; Facebook/Instagram not harvested from login walls.
- Prior cities (Hamilton, Burlington, Oakville, Mississauga, Toronto, Brampton) were not modified.
