# Clinket Mississauga Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T16:00:00-04:00 (ET)  
**City:** Mississauga, ON  
**Total providers:** 70  
**Sources note:** public web only (business websites + YellowPages.ca + Homestars/directory listings). No Facebook/Kijiji scrapes (login/CAPTCHA). Contact fields never invented — unknowns left null.

## Counts by area

| Area | Providers |
|------|-----------|
| general | 26 |
| port-credit | 15 |
| streetsville | 10 |
| erin-mills | 8 |
| downtown | 4 |
| meadowvale | 4 |
| malton | 3 |
| **Total** | **70** |

Area assignment is best-effort from street + postal code (L5B/L5A → downtown, L5G/L5H/L5E/L5J → port-credit, L5M → streetsville, L5L/L5K → erin-mills, L4T/L4V/L5S → malton, L5N/L5W → meadowvale, else `general`).

## Counts by category

| Category | Providers |
|----------|-----------|
| hvac | 9 |
| plumbing | 8 |
| landscaping | 8 |
| auto-mechanic | 8 |
| electrical | 7 |
| painting | 7 |
| roofing | 7 |
| house-cleaning | 6 |
| hair-salon | 5 |
| handyman | 3 |
| appliance-repair | 2 |
| **Total** | **70** |

## Contact coverage

| Field | Count | Coverage |
|-------|-------|----------|
| Phone (`businessPhone`) | 70 / 70 | **100%** |
| Email (`businessEmail`) | 17 / 70 | **24%** |
| Website (`social.website`) | 20 / 70 | **29%** |
| Phone **or** email **or** website | 70 / 70 | **100%** |

Emails are scarce on YellowPages listings; richest emails came from official business sites (Oakly Landscaping, Sauga Electric, M Landscaping Ltd., HVAC Group, D&E Landscaping, Ivolve Hair Studio, Salon Dolce Vita, Hair by Reema Salon & Shop, AMM Electric Inc., EZFIX Appliance Repair, Handyman Mississauga, Aire One Peel Heating & Cooling, AVIS HVAC, Meadowvale Hair Salon Inc., JAC Electric Inc., Spark Service PRO, Clean Proper).

## Richest samples (name + phone + email)

| Business | Phone | Email | Area |
|----------|-------|-------|------|
| Oakly Landscaping | 647-446-1346 | contact@oaklylandscaping.com | erin-mills |
| Sauga Electric | 416-857-4848 | service@saugaelectric.ca | streetsville |
| M Landscaping Ltd. | 289-903-1264 | info@m-landscaping.com | streetsville |
| HVAC Group | 416-807-2752 | info@hvac-group.com | general |
| D&E Landscaping | 905-272-5287 | info@landscapeyourway.ca | general |
| Ivolve Hair Studio | 905-271-9400 | ivolvehairstudio@hotmail.com | port-credit |
| Salon Dolce Vita | 905-278-5550 | salondolcevita@hotmail.com | port-credit |
| Hair by Reema Salon & Shop | 905-858-1111 | info@hairbyreema.com | streetsville |
| AMM Electric Inc. | 416-669-8268 | info@ammelectric.ca | downtown |
| EZFIX Appliance Repair | 647-955-3478 | info@ezfixappliance.ca | general |
| Handyman Mississauga | 416-301-4867 | service@handymanmississauga.ca | general |
| Aire One Peel Heating & Cooling | 905-564-8545 | peel@aireone.com | general |
| AVIS HVAC | 416-655-2220 | info@avishvac.com | general |
| Meadowvale Hair Salon Inc. | 905-858-7575 | meadowvalehairsalon@gmail.com | meadowvale |
| JAC Electric Inc. | 647-880-1537 | jacelect@yahoo.ca | meadowvale |
| Spark Service PRO | 647-503-6655 | info@sparkservice.pro | general |
| Clean Proper | 647-695-6878 | hello@cleanproper.ca | general |

## Gaps / notes

- **appliance-repair**: strong multi-city providers (EZFIX, Spark Service PRO) with verified phone+email; few street-address-only Mississauga appliance shops on public directories without lead-gen walls.
- **handyman**: Handyman Mississauga has full contact; many YP “handyman” hits are painters/GCs with thin contact pages.
- **malton**: fewer public listings with complete contact than Port Credit / Streetsville; Advanced Roofing + Iervasi + Mississauga Handyman included.
- **emails**: never invented; null when only YP phone/address available.
- Region set to **Peel** (vs Halton for Oakville/Burlington).

## File paths (38 JSON files)

```
/workspace/clinket-scrapes/mississauga/downtown/electrical.json
/workspace/clinket-scrapes/mississauga/downtown/painting.json
/workspace/clinket-scrapes/mississauga/downtown/plumbing.json
/workspace/clinket-scrapes/mississauga/erin-mills/electrical.json
/workspace/clinket-scrapes/mississauga/erin-mills/house-cleaning.json
/workspace/clinket-scrapes/mississauga/erin-mills/hvac.json
/workspace/clinket-scrapes/mississauga/erin-mills/landscaping.json
/workspace/clinket-scrapes/mississauga/erin-mills/painting.json
/workspace/clinket-scrapes/mississauga/general/appliance-repair.json
/workspace/clinket-scrapes/mississauga/general/auto-mechanic.json
/workspace/clinket-scrapes/mississauga/general/electrical.json
/workspace/clinket-scrapes/mississauga/general/handyman.json
/workspace/clinket-scrapes/mississauga/general/house-cleaning.json
/workspace/clinket-scrapes/mississauga/general/hvac.json
/workspace/clinket-scrapes/mississauga/general/landscaping.json
/workspace/clinket-scrapes/mississauga/general/painting.json
/workspace/clinket-scrapes/mississauga/general/plumbing.json
/workspace/clinket-scrapes/mississauga/general/roofing.json
/workspace/clinket-scrapes/mississauga/malton/handyman.json
/workspace/clinket-scrapes/mississauga/malton/roofing.json
/workspace/clinket-scrapes/mississauga/meadowvale/electrical.json
/workspace/clinket-scrapes/mississauga/meadowvale/hair-salon.json
/workspace/clinket-scrapes/mississauga/meadowvale/hvac.json
/workspace/clinket-scrapes/mississauga/port-credit/auto-mechanic.json
/workspace/clinket-scrapes/mississauga/port-credit/hair-salon.json
/workspace/clinket-scrapes/mississauga/port-credit/house-cleaning.json
/workspace/clinket-scrapes/mississauga/port-credit/hvac.json
/workspace/clinket-scrapes/mississauga/port-credit/landscaping.json
/workspace/clinket-scrapes/mississauga/port-credit/painting.json
/workspace/clinket-scrapes/mississauga/port-credit/plumbing.json
/workspace/clinket-scrapes/mississauga/port-credit/roofing.json
/workspace/clinket-scrapes/mississauga/streetsville/auto-mechanic.json
/workspace/clinket-scrapes/mississauga/streetsville/electrical.json
/workspace/clinket-scrapes/mississauga/streetsville/hair-salon.json
/workspace/clinket-scrapes/mississauga/streetsville/hvac.json
/workspace/clinket-scrapes/mississauga/streetsville/landscaping.json
/workspace/clinket-scrapes/mississauga/streetsville/painting.json
/workspace/clinket-scrapes/mississauga/streetsville/plumbing.json
```
