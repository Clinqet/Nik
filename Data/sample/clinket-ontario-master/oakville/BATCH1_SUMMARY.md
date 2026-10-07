# Clinket Oakville Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T15:55:00-04:00 (ET)  
**City:** Oakville, ON  
**Total providers:** 57  
**Sources note:** public web only (business websites + YellowPages.ca + Homestars/directory listings). No Facebook/Kijiji scrapes (login/CAPTCHA). Contact fields never invented — unknowns left null.

## Counts by area

| Area | Providers |
|------|-----------|
| brontee | 18 |
| general | 11 |
| clearview | 9 |
| downtown | 7 |
| river-oaks | 6 |
| glen-abbey | 6 |
| **Total** | **57** |

Area assignment is best-effort from street + postal code (L6J → downtown, L6L → brontee/Bronte, L6M → glen-abbey, L6H → river-oaks, L6K → clearview, else `general`).

## Counts by category

| Category | Providers |
|----------|-----------|
| hvac | 8 |
| landscaping | 8 |
| plumbing | 8 |
| electrical | 7 |
| roofing | 6 |
| auto-mechanic | 6 |
| hair-salon | 3 |
| painting | 3 |
| handyman | 3 |
| house-cleaning | 3 |
| appliance-repair | 2 |
| **Total** | **57** |

## Contact coverage

| Field | Count | Coverage |
|-------|-------|----------|
| Phone (`businessPhone`) | 56 / 57 | **98%** |
| Email (`businessEmail`) | 17 / 57 | **30%** |
| Website (`social.website`) | 32 / 57 | **56%** |
| Phone **or** email **or** website | 57 / 57 | **100%** |

Emails are scarce on YellowPages listings; richest emails came from official business sites (A1 Air, Crown Electric, ProResults, Oakville Maids, Shear Concepts, LaVie, CertaPro, Halton Appliance Fix, Hy-Pro, Superior Plumbing, Master Mechanic, TOVA, Absolute, Oakville HVAC Pros, TiDii, Neon Cleaners, EMG Painting).

## Richest samples (name + phone + email)

| Business | Phone | Email | Area |
|----------|-------|-------|------|
| EMG Painting | 289-788-3957 | eddiemcginn9@gmail.com | river-oaks |
| Oakville Maids | 289-295-3777 | info@oakvillemaids.ca | clearview |
| Shear Concepts Salon | 905-338-0440 | support@shearconcepts.ca | river-oaks |
| Halton Appliance Fix | 647-594-1830 | contact@haltonappliancefix.ca | brontee |
| CertaPro Painters of Oakville/Burlington | 905-582-5633 | haltonoffice@certapro.com | clearview |
| LaVie Hair Salon & Barbershop | 905-338-6465 | Laviesalonandspa@gmail.com | river-oaks |
| Crown Electric Ltd | 905-847-2804 | crown@crownelectricltd.ca | brontee |
| Hy-Pro Plumbing & Drain Cleaning of Oakville | 905-845-7142 | oakville@hyprodrains.com | glen-abbey |
| Neon Cleaners Inc | 855-636-6001 | info@neoncleaners.ca | general |
| Absolute Home Services | 888-304-6327 | info@absolutehomeservices.ca | general |
| Master Mechanic Oakville | 905-337-5889 | oakville@mastermechanic.ca | clearview |
| A1 Air Conditioning & Heating | 905-844-2949 | contactus@a1air.ca | downtown |
| Superior Plumbing | 289-210-4946 | info@superiorplumbing.ca | downtown |
| ProResults Plumbing | 905-336-8706 | info@proresultsplumbing.com | general |

## Gaps / notes

- **handyman**: Ricardo Handyman has website but no public phone on homepage at scrape time (left null). Absolute is Burlington-based serving Oakville.
- **house-cleaning**: Oakville Maids (Speers), TiDii, Neon Cleaners — more cleaners exist behind booking portals without clear public phone.
- **painting**: CertaPro (Wyecroft), EMG Painting (Litchfield / River Oaks), KW Regional — YP painters search skewed out-of-town.
- **appliance-repair**: Halton Appliance Fix + Oakville Appliance (Kerr St); many others are multi-city lead-gen without Oakville street addresses.
- Area slug **brontee** matches requested spelling (Bronte neighbourhood).

## File paths (35 JSON files)

```
/workspace/clinket-scrapes/oakville/brontee/appliance-repair.json
/workspace/clinket-scrapes/oakville/brontee/auto-mechanic.json
/workspace/clinket-scrapes/oakville/brontee/electrical.json
/workspace/clinket-scrapes/oakville/brontee/hvac.json
/workspace/clinket-scrapes/oakville/brontee/landscaping.json
/workspace/clinket-scrapes/oakville/brontee/plumbing.json
/workspace/clinket-scrapes/oakville/brontee/roofing.json
/workspace/clinket-scrapes/oakville/clearview/appliance-repair.json
/workspace/clinket-scrapes/oakville/clearview/auto-mechanic.json
/workspace/clinket-scrapes/oakville/clearview/house-cleaning.json
/workspace/clinket-scrapes/oakville/clearview/hvac.json
/workspace/clinket-scrapes/oakville/clearview/landscaping.json
/workspace/clinket-scrapes/oakville/clearview/painting.json
/workspace/clinket-scrapes/oakville/clearview/roofing.json
/workspace/clinket-scrapes/oakville/downtown/auto-mechanic.json
/workspace/clinket-scrapes/oakville/downtown/hvac.json
/workspace/clinket-scrapes/oakville/downtown/landscaping.json
/workspace/clinket-scrapes/oakville/downtown/plumbing.json
/workspace/clinket-scrapes/oakville/general/electrical.json
/workspace/clinket-scrapes/oakville/general/handyman.json
/workspace/clinket-scrapes/oakville/general/house-cleaning.json
/workspace/clinket-scrapes/oakville/general/hvac.json
/workspace/clinket-scrapes/oakville/general/landscaping.json
/workspace/clinket-scrapes/oakville/general/painting.json
/workspace/clinket-scrapes/oakville/general/plumbing.json
/workspace/clinket-scrapes/oakville/glen-abbey/electrical.json
/workspace/clinket-scrapes/oakville/glen-abbey/hair-salon.json
/workspace/clinket-scrapes/oakville/glen-abbey/handyman.json
/workspace/clinket-scrapes/oakville/glen-abbey/landscaping.json
/workspace/clinket-scrapes/oakville/glen-abbey/plumbing.json
/workspace/clinket-scrapes/oakville/river-oaks/hair-salon.json
/workspace/clinket-scrapes/oakville/river-oaks/hvac.json
/workspace/clinket-scrapes/oakville/river-oaks/landscaping.json
/workspace/clinket-scrapes/oakville/river-oaks/painting.json
/workspace/clinket-scrapes/oakville/river-oaks/roofing.json
```
