# Clinket Burlington Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T15:50:00-04:00 (ET)  
**City:** Burlington, ON  
**Total providers:** 53  
**Sources note:** public web only (business websites + YellowPages.ca + Homestars/directory listings). No Facebook/Kijiji scrapes (login/CAPTCHA). Contact fields never invented — unknowns left null.

## Counts by area

| Area | Providers |
|------|-----------|
| general (unclear / multi-neighbourhood) | 23 |
| downtown | 10 |
| tyandaga | 9 |
| aldershot | 5 |
| millcroft | 4 |
| headon | 2 |
| **Total** | **53** |

Area assignment is best-effort from street + postal code (L7R/L7S → downtown, L7T → aldershot, L7P → tyandaga, L7M Millcroft/Headon by street context, else `general`).

## Counts by category

| Category | Providers |
|----------|-----------|
| plumbing | 8 |
| electrical | 6 |
| hvac | 6 |
| painting | 6 |
| landscaping | 5 |
| hair-salon | 5 |
| auto-mechanic | 5 |
| roofing | 5 |
| handyman | 3 |
| house-cleaning | 2 |
| appliance-repair | 2 |
| **Total** | **53** |

## Contact coverage

| Field | Count | Coverage |
|-------|-------|----------|
| Phone (`businessPhone`) | 53 / 53 | **100%** |
| Email (`businessEmail`) | 11 / 53 | **21%** |
| Website (`social.website`) | 14 / 53 | **26%** |
| Phone **or** email **or** website | 53 / 53 | **100%** |

Emails are scarce on YellowPages listings; richest emails came from official business sites (Hepburn, Greer, Smitty’s, Brooms, Burlington Heating, MaidPro, Clean Life, A1 Auto, Alpha/Expert appliance, Absolute, Fixer Pros).

## Richest samples (name + phone + email)

| Business | Phone | Email | Area |
|----------|-------|-------|------|
| Smitty's Landscaping | 905-334-3844 | nick@smittyslandscaping.ca | downtown |
| Hepburn Plumbing & Mechanical Services | 905-681-0620 | hepburnplumbing@gmail.com | general |
| Greer Landscaping | 905-467-8314 | info@greerlandscaping.ca | downtown |
| Burlington Heating & Air Conditioning Inc. | 905-407-1406 | info@burlingtonheating.ca | aldershot |
| Broom's Heating, Air-Conditioning & Fireplaces | 905-634-7701 | info@broomshvac.ca | general |
| A1 Complete Auto Repair & Transmission | 905-637-8544 | corybrighta1@gmail.com | general |
| MaidPro Burlington-Oakville | 905-332-4080 | burloak.on@maidpro.com | general |
| The Clean Life Company | 647-667-7205 | Support@thecleanlifecompany.ca | aldershot |

## File paths (36 JSON files)

```
/workspace/clinket-scrapes/burlington/aldershot/auto-mechanic.json
/workspace/clinket-scrapes/burlington/aldershot/house-cleaning.json
/workspace/clinket-scrapes/burlington/aldershot/hvac.json
/workspace/clinket-scrapes/burlington/aldershot/plumbing.json
/workspace/clinket-scrapes/burlington/aldershot/roofing.json
/workspace/clinket-scrapes/burlington/downtown/appliance-repair.json
/workspace/clinket-scrapes/burlington/downtown/auto-mechanic.json
/workspace/clinket-scrapes/burlington/downtown/electrical.json
/workspace/clinket-scrapes/burlington/downtown/hair-salon.json
/workspace/clinket-scrapes/burlington/downtown/hvac.json
/workspace/clinket-scrapes/burlington/downtown/landscaping.json
/workspace/clinket-scrapes/burlington/downtown/plumbing.json
/workspace/clinket-scrapes/burlington/downtown/roofing.json
/workspace/clinket-scrapes/burlington/general/appliance-repair.json
/workspace/clinket-scrapes/burlington/general/auto-mechanic.json
/workspace/clinket-scrapes/burlington/general/electrical.json
/workspace/clinket-scrapes/burlington/general/hair-salon.json
/workspace/clinket-scrapes/burlington/general/handyman.json
/workspace/clinket-scrapes/burlington/general/house-cleaning.json
/workspace/clinket-scrapes/burlington/general/hvac.json
/workspace/clinket-scrapes/burlington/general/landscaping.json
/workspace/clinket-scrapes/burlington/general/painting.json
/workspace/clinket-scrapes/burlington/general/plumbing.json
/workspace/clinket-scrapes/burlington/general/roofing.json
/workspace/clinket-scrapes/burlington/headon/hair-salon.json
/workspace/clinket-scrapes/burlington/headon/painting.json
/workspace/clinket-scrapes/burlington/millcroft/electrical.json
/workspace/clinket-scrapes/burlington/millcroft/hair-salon.json
/workspace/clinket-scrapes/burlington/millcroft/painting.json
/workspace/clinket-scrapes/burlington/millcroft/roofing.json
/workspace/clinket-scrapes/burlington/tyandaga/electrical.json
/workspace/clinket-scrapes/burlington/tyandaga/handyman.json
/workspace/clinket-scrapes/burlington/tyandaga/landscaping.json
/workspace/clinket-scrapes/burlington/tyandaga/painting.json
/workspace/clinket-scrapes/burlington/tyandaga/plumbing.json
/workspace/clinket-scrapes/burlington/tyandaga/roofing.json
```

Builder script: `/workspace/clinket-scrapes/_build_burlington_batch1.py`  
Schema: `/workspace/clinket-scrapes/_schema/provider.schema.json`  
Hamilton files were **not** modified.

## Blockers / gaps

1. **Email sparse** — most YellowPages listings omit email; only official sites yielded emails (11/53).
2. **Area granularity** — ~43% landed in `general` when street/FSA didn’t clearly map to downtown / aldershot / millcroft / tyandaga / headon.
3. **Headon & Millcroft thin** — only 2 and 4 providers respectively; more Headon Forest / Millcroft Park businesses need a deeper pass (especially plumbing, HVAC, handyman).
4. **House-cleaning & appliance-repair low count** (2 each) — good contact quality but thin inventory; next batch should expand these.
5. **Homestars** — category pages returned mostly narrative without structured phones; used YellowPages + official sites instead.
6. **Skipped** — Facebook / Kijiji (login or CAPTCHA). Social URLs only when present on official sites (none captured this batch beyond website).
7. **Chain salons** — included a few Great Clips / First Choice for coverage; prefer independent salons in Batch 2.
8. **No hours** for most directory-only records — schedules filled when published on official sites.

## Suggested Batch 2 priorities

- Enrich emails/websites by fetching more official sites for YP-only records.
- Add more Headon / Millcroft / Aldershot locals across plumbing, HVAC, handyman, house-cleaning.
- Independent hair salons (vs chains).
- More appliance-repair and house-cleaning with verified phones.
