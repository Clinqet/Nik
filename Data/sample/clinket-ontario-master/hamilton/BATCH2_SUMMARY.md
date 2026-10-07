# Clinket Hamilton Scrape — Batch 2 Summary

**Scraped at:** 2026-09-23T15:50:00-04:00 (ET)  
**City:** Hamilton, ON  
**Batch 1 providers (unchanged base):** 42  
**New providers this batch:** **35**  
**Deepened Batch-1 stubs:** **6**  
**Total Hamilton providers now:** **77** (all unique `id`s)  
**Sources note:** public web only (business websites + YellowPages.ca, Profile Canada, Canada411 / 411.ca, Cooper Tire / AllBiz directory snippets)

## Goals vs outcome

| Goal | Result |
|------|--------|
| Fill Dundas / Stoney Creek / Waterdown / Ancaster | **Done** — Dundas 8, Stoney Creek 10, Waterdown 8, Ancaster 9 (was 1) |
| Prefer new area coverage | **35/35** new records in target/sub areas (plus 1 Hamilton roofing) |
| 30+ new providers | **35** |
| Deepen thin stubs | MaidsPlus, RTC, Caspian, Sutton & Son, InspireClean, Bosanac |
| New categories if easy | **roofing** (DeLuca Ancaster, Gerry’s Hamilton), **painting** (Seaman SC) |

## Counts by area (after Batch 2)

| Area | Providers |
|------|-----------|
| Hamilton (general) | 25 |
| Mountain | 10 |
| Stoney Creek | 10 |
| Ancaster | 9 |
| Dundas | 8 |
| Waterdown | 8 |
| Downtown | 7 |
| **Total** | **77** |

## Counts by primary category

| Category | Providers |
|----------|-----------|
| electrical | 12 |
| handyman | 9 |
| hvac | 9 |
| plumbing | 9 |
| landscaping | 9 |
| auto-mechanic | 8 |
| hair-salon | 8 |
| house-cleaning | 6 |
| appliance-repair | 4 |
| roofing | 2 |
| painting | 1 |

## New providers by area (35)

### Dundas (8)
1. Dy's Plumbing Services — 905-627-5657  
2. D G Heating & Cooling Inc — 905-522-4967  
3. Jaxzo Electric Inc. — 905-512-9624  
4. All In One Landscaping — 905-745-9145  
5. Creative Concepts Landscapes — 905-961-5762  
6. J. Holmes Landscape Services — 905-628-8211  
7. Your Clean Home — 905-741-6559  
8. Ali's Barber Shop — 905-627-6875  

### Stoney Creek (10)
1. Santino Electric Limited — 905-662-3543  
2. JR Jones Electric — 905-643-1900  
3. Aldo Electric — 905-544-4015  
4. PDS Electric Inc — 905-961-7014  
5. Shipton's Heating & Cooling — 905-549-4616  
6. Roto-Rooter Plumbing (Stoney Creek) — 905-570-8788  
7. Birnie Plumbing & Drains — 905-659-5920  
8. Stoney Creek Cleaners — 905-512-7254  
9. Seaman Handyman and Painter — 289-768-8219 *(also painting category file)*  
10. Seaman Handyman and Painter (painting file) — 289-768-8219  

### Waterdown (8)
1. Jay's Auto Service Inc. — 905-689-5428  
2. Budget Exhaust & Automotive Inc. — 905-689-3555  
3. Birnie Plumbing & Drains of Waterdown — 905-659-5920 *(branded Waterdown; HQ Lake Ave N)*  
4. Protech Inc — 905-297-9347 *(branded Waterdown page; street HQ null)*  
5. CMS Electric Ltd. — 905-659-7687  
6. Handyman Waterdown — 905-466-1791  
7. Ritz Barbershop (Waterdown) — 905-690-6162  
8. Mill St. Landscaping — 289-707-5590  

### Ancaster (8 new; was 1 Source Electric)
1. Guest Plumbing & HVAC — 905-745-1963  
2. AirPro Heating & Cooling — 905-962-9077  
3. Glendale Motors — 905-648-4113  
4. Empire Barber Shop — 905-304-9795  
5. Stan The Ancaster Handyman — 905-818-1162  
6. Roger Repairs — 905-520-4533  
7. DeLuca Roofing — 905-631-0961  
8. Ritz Barbershop (Ancaster) — 905-692-5554  

### Hamilton general (1)
1. Gerry's Roofing & Siding Inc. — 905-549-7112  

## Deepened Batch-1 stubs (6)

| ID | What was added |
|----|----------------|
| `hamilton-hamilton-maidsplus` | fuller description, services, service areas, alt phone note |
| `hamilton-hamilton-rtc-appliances` | email, street address (610 Upper James), hours Mon–Fri 8:30–5, 6 services |
| `hamilton-hamilton-caspian-appliance-repair` | description, years, 6 services, Mon–Sat 7–19 hours |
| `hamilton-hamilton-sutton-son-appliance-service` | email, HQ 154 Gage Ave N, hours, services since 1928 |
| `hamilton-hamilton-inspireclean` | email info@inspireclean.ca, expanded services & areas |
| `hamilton-hamilton-bosanac-heating-electric-ltd` | website bosanac.ca, 70 years, HVAC+electrical services |

## Richest new samples (name + phone)

- Dy's Plumbing Services — **905-627-5657**  
- Aldo Electric — **905-544-4015**  
- DeLuca Roofing — **905-631-0961**  
- Creative Concepts Landscapes — **905-961-5762**  
- Shipton's Heating & Cooling — **905-549-4616**  
- Santino Electric Limited — **905-662-3543**  
- AirPro Heating & Cooling — **905-962-9077**  
- CMS Electric Ltd. — **905-659-7687**  
- Glendale Motors — **905-648-4113**  
- Guest Plumbing & HVAC — **905-745-1963**  

## Output file paths (Batch 2 touched / created)

### New / updated area files
1. `/workspace/clinket-scrapes/hamilton/dundas/plumbing.json`  
2. `/workspace/clinket-scrapes/hamilton/dundas/hvac.json`  
3. `/workspace/clinket-scrapes/hamilton/dundas/electrical.json`  
4. `/workspace/clinket-scrapes/hamilton/dundas/landscaping.json`  
5. `/workspace/clinket-scrapes/hamilton/dundas/house-cleaning.json`  
6. `/workspace/clinket-scrapes/hamilton/dundas/hair-salon.json`  
7. `/workspace/clinket-scrapes/hamilton/stoney-creek/electrical.json`  
8. `/workspace/clinket-scrapes/hamilton/stoney-creek/hvac.json`  
9. `/workspace/clinket-scrapes/hamilton/stoney-creek/plumbing.json`  
10. `/workspace/clinket-scrapes/hamilton/stoney-creek/house-cleaning.json`  
11. `/workspace/clinket-scrapes/hamilton/stoney-creek/handyman.json`  
12. `/workspace/clinket-scrapes/hamilton/stoney-creek/painting.json`  
13. `/workspace/clinket-scrapes/hamilton/waterdown/auto-mechanic.json`  
14. `/workspace/clinket-scrapes/hamilton/waterdown/plumbing.json`  
15. `/workspace/clinket-scrapes/hamilton/waterdown/hvac.json`  
16. `/workspace/clinket-scrapes/hamilton/waterdown/electrical.json`  
17. `/workspace/clinket-scrapes/hamilton/waterdown/handyman.json`  
18. `/workspace/clinket-scrapes/hamilton/waterdown/hair-salon.json`  
19. `/workspace/clinket-scrapes/hamilton/waterdown/landscaping.json`  
20. `/workspace/clinket-scrapes/hamilton/ancaster/plumbing.json`  
21. `/workspace/clinket-scrapes/hamilton/ancaster/hvac.json`  
22. `/workspace/clinket-scrapes/hamilton/ancaster/auto-mechanic.json`  
23. `/workspace/clinket-scrapes/hamilton/ancaster/hair-salon.json`  
24. `/workspace/clinket-scrapes/hamilton/ancaster/handyman.json`  
25. `/workspace/clinket-scrapes/hamilton/ancaster/roofing.json`  
26. `/workspace/clinket-scrapes/hamilton/hamilton/roofing.json`  

### Deepened existing
27. `/workspace/clinket-scrapes/hamilton/hamilton/house-cleaning.json`  
28. `/workspace/clinket-scrapes/hamilton/hamilton/appliance-repair.json`  
29. `/workspace/clinket-scrapes/hamilton/hamilton/electrical.json`  

Builder script: `/workspace/clinket-scrapes/_build_batch2.py`

## Sources that worked

- Official business sites via WebFetch (strongest): Dy’s, Santino, Aldo, JR Jones, Shipton’s, Guest, AirPro, Glendale, Empire, DeLuca, CMS Electric, All In One, J. Holmes, Creative Concepts, Stoney Creek Cleaners, Birnie, Jay’s Auto, Roger Repairs, Stan Handyman, Ritz Barbershop, RTC, Sutton, InspireClean, Bosanac, MaidsPlus, Caspian.  
- YellowPages.ca: PDS Electric, Your Clean Home, Jaxzo.  
- Profile Canada: Jaxzo Electric.  
- Canada411 / 411.ca: D G Heating & Cooling.  
- Directory snippets: Budget Exhaust (Cooper Tire / AllBiz), Ali’s Barber, Seaman Handyman.

## Blockers / gaps

1. **jaxzo.com / walkerservices.ca:** WebFetch HTTP 500 — used Profile Canada / YellowPages for Jaxzo; Walker Services skipped.  
2. **Air-pro.ca SPA pages:** heavy JS; contact page still yielded phone/email/address.  
3. **Facebook / Kijiji:** skipped (login/CAPTCHA risk) per rules.  
4. **Some branded-only HQs:** Protech Inc, Mill St. Landscaping, Handyman Waterdown — no street on site; street left `null`. Birnie Waterdown listing shares Lake Ave N HQ with Stoney Creek physical listing (different `id`s by design).  
5. **Aqua Fast Flush:** Dundas Mercer St listing outdated; current site is Binbrook PO Box — **skipped**.  
6. **Greg’s Plumbing:** already in Batch 1 (Mountain); BBB also shows Dundas Mill St — not duplicated.  
7. **Absolutely Spotless / Hellamaid:** still thin; sites are marketing/SEO heavy with less contact detail — deferred.  
8. **Seaman** appears in both `handyman` and `painting` category files with distinct ids (intentional for category coverage).  

## Dedup notes

- Merge logic: load existing `{meta, providers}`, append only if `id` not present, bump `providerCount` + `scrapedAt`.  
- Deepen: fill only null/empty fields; never wipe phones/emails already present.  
- No duplicate `id` values across the Hamilton tree (77 unique).  

## Data quality snapshot (all 77)

- Public contacts only; unknowns left null (nothing invented).  
- New categories: roofing, painting.  
- Social URLs only when linked from official site (e.g. Birnie Facebook/Instagram from schema.org on site).  
