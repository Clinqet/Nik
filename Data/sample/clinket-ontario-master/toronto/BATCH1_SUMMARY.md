# Clinket Toronto Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T16:05:00-04:00 (ET)  
**City:** Toronto, ON (city of Toronto boroughs)  
**Total providers:** 67  
**Sources note:** public web only (business websites + YellowPages.ca + Homestars/directory listings). No Facebook/Kijiji scrapes (login/CAPTCHA). Contact fields never invented — unknowns left null.

## Counts by area

| Area | Providers |
|------|-----------|
| north-york | 15 |
| scarborough | 14 |
| general | 9 |
| downtown | 8 |
| etobicoke | 8 |
| york | 7 |
| east-york | 6 |
| **Total** | **67** |

Area assignment is best-effort from street + postal + borough naming on public listings (M6A/M2H/M3J → north-york, M1* → scarborough, M8*/M9W → etobicoke, M4C/M4J/M4G → east-york, M6N/M6E/M6M → york, downtown core M5*/M6K/M6P/M4M/M4E where applicable, else `general` for multi-borough GTA-serving businesses).

## Counts by category

| Category | Providers |
|----------|-----------|
| electrical | 10 |
| plumbing | 9 |
| roofing | 8 |
| auto-mechanic | 7 |
| hvac | 7 |
| painting | 6 |
| hair-salon | 6 |
| house-cleaning | 4 |
| landscaping | 4 |
| appliance-repair | 3 |
| handyman | 3 |
| **Total** | **67** |

## Contact coverage

| Field | Count | Coverage |
|-------|-------|----------|
| Phone (`businessPhone`) | 67 / 67 | **100%** |
| Email (`businessEmail`) | 16 / 67 | **24%** |
| Website (`social.website`) | 23 / 67 | **34%** |
| Phone **or** email **or** website | 67 / 67 | **100%** |

Emails are scarce on YellowPages listings; richest emails came from official business sites (Rosedale Plumbing, A&Y Electrical, Sparky Electrical, Tron Electrical, GTA Grizzly, Dawn Till Dusk, Monster Property, Bloom Landscape, AspenClean, Toronto Shine Cleaning, Enjoy House Cleaning, Studio CPB, Master Mechanic Etobicoke, EZFIX, Pro Appliance, Appliance Service Plus).

## Richest samples (name + phone + email)

| Business | Phone | Email | Area |
|----------|-------|-------|------|
| Rosedale Plumbing | 647-948-5506 | rosedaleplumbingon@gmail.com | york |
| A&Y Electrical | 416-939-3301 | office@ayelectrical.ca | north-york |
| Sparky Electrical Services | 647-372-1937 | info@sparkyelectricalservices.ca | downtown |
| Tron Electrical & Automation | 416-936-5669 | office@tronelectrical.com | general |
| GTA Grizzly | 647-465-6957 | info@gtagrizzly.ca | north-york |
| Dawn Till Dusk Landscaping | 647-893-3876 | dtdlandscapingto@gmail.com | scarborough |
| Monster Property Services | 647-255-6900 | help@monsterpropertyservices.ca | north-york |
| Bloom Landscape | 416-220-5000 | info@bloomlandscape.ca | general |
| AspenClean Toronto | 416-546-4593 | toronto@aspenclean.com | scarborough |
| Toronto Shine Cleaning | 647-424-0355 | support@torontoshinecleaning.ca | downtown |
| Enjoy House Cleaning | 416-909-1590 | enjoyhousecleaning@hotmail.com | general |
| Studio CPB | 416-463-6085 | info@studiocpb.ca | east-york |
| Master Mechanic Etobicoke | 416-252-5550 | etobicoke@mastermechanic.ca | etobicoke |
| EZFIX Appliance Repair | 647-955-3478 | info@ezfixappliance.ca | general |
| Pro Appliance | 416-722-4003 | info@proappliance.ca | general |
| Appliance Service Plus | 647-496-6243 | info@applianceserviceplus.ca | general |

## Gaps / notes

- **handyman**: thinner dedicated public listings with phone+address than trade categories; JP Paintings & Handyman (Scarborough) and Halal Cleaners & Painters (York) included; many “handyman” YP hits are painters/GCs.
- **appliance-repair**: strong multi-borough providers (EZFIX, Pro Appliance, Appliance Service Plus) with verified phone+email; street addresses sometimes HQ outside a single borough → filed under `general`.
- **east-york**: fewer complete public listings than North York / Scarborough; Studio CPB, Polarity Group, Astron Electric, Urban Plumber, AML Auto, Expert GTA HVAC included.
- **emails**: never invented; null when only YP phone/address available.
- Region set to **Toronto** (city of Toronto / former boroughs).
- Prior cities (Hamilton, Burlington, Oakville, Mississauga) were not modified.

## Output paths

Root: `/workspace/clinket-scrapes/toronto/`

- `downtown/` — auto-mechanic, electrical, house-cleaning, hvac, painting, plumbing, roofing  
- `north-york/` — auto-mechanic, electrical, hair-salon, hvac, landscaping, painting, plumbing, roofing  
- `scarborough/` — auto-mechanic, electrical, hair-salon, handyman, house-cleaning, hvac, landscaping, painting, plumbing, roofing  
- `etobicoke/` — auto-mechanic, electrical, hvac, plumbing, roofing  
- `east-york/` — auto-mechanic, electrical, hair-salon, hvac, plumbing  
- `york/` — auto-mechanic, electrical, handyman, painting, plumbing, roofing  
- `general/` — appliance-repair, electrical, handyman, house-cleaning, landscaping, painting, roofing  
- `BATCH1_SUMMARY.md` (this file)

Build script: `/workspace/clinket-scrapes/_build_toronto_batch1.py`
