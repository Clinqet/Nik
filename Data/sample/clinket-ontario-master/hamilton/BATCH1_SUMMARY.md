# Clinket Hamilton Scrape — Batch 1 Summary

**Scraped at:** 2026-09-23T15:41:00-04:00 (ET)  
**City:** Hamilton, ON  
**Total providers:** 42  
**Sources note:** public web only (business websites + Profile Canada directory snippets)

## Counts by area

| Area | Providers |
|------|-----------|
| Hamilton (general / unclear) | 24 |
| Mountain | 10 |
| Downtown | 7 |
| Ancaster | 1 |
| Dundas | 0 |
| Stoney Creek | 0 |
| Waterdown | 0 |
| **Total** | **42** |

## Counts by category

| Category | Providers |
|----------|-----------|
| electrical | 6 |
| landscaping | 5 |
| hvac | 5 |
| handyman | 5 |
| auto-mechanic | 5 |
| plumbing | 4 |
| house-cleaning | 4 |
| hair-salon | 4 |
| appliance-repair | 4 |
| **Total** | **42** |

## Data quality snapshot

- With phone: **41 / 42**
- With email: **18 / 42**
- With website: **38 / 42**
- With street address: **23 / 42**
- Fabricated contacts: **none** (unknowns left null)

## Sources that worked

- Business websites via WebFetch (strongest): Pitton, Plumbway, John The Plumber, Greg's Plumbing, Source Electric, Stack Electric, HAMCO, Spurr HVAC, Dynamic H&C, Hamilton Heating and Cooling, Aire One West, Three Seasons, Monarch, Seven Stones, Square Leaf, Danasy, Hamilton Mountain Handyman, Cardinal Handyman, MaidsPlus, First Barbershop, CRS Automotive, Hartek Pro, and others.
- WebSearch result snippets for discovery and secondary confirmation.
- Profile Canada electrician directory listing (public) for Ritz, Bosanac, Prestige, Advantage Electric.

## Sources that failed / limited

- **jphandy.ca**: WebFetch returned HTTP 500; phone/email taken only from public search index snippets (noted in `dataQuality.notes`).
- **YellowPages.ca**: Search synthesis indicated weak/no local results for some queries in this run; not used as primary.
- **Kijiji / Facebook Marketplace**: Not used; risk of blocks / login walls. Defer to later batch with public-only pages.
- **Facebook / Instagram**: Not logged into; social profile URLs only kept when clearly published (most left null to avoid inventing).
- **Duplacey's Barbershop**: Website fetched earlier via search; phone not captured — website URL + address only.
- Area-specific folders for **Dundas / Stoney Creek / Waterdown** empty this batch — many businesses serve those areas but list a Hamilton/Mountain HQ; tagged by HQ address when known.

## Output file paths (16)

1. `/workspace/clinket-scrapes/hamilton/ancaster/electrical.json`
2. `/workspace/clinket-scrapes/hamilton/downtown/auto-mechanic.json`
3. `/workspace/clinket-scrapes/hamilton/downtown/hair-salon.json`
4. `/workspace/clinket-scrapes/hamilton/downtown/hvac.json`
5. `/workspace/clinket-scrapes/hamilton/hamilton/appliance-repair.json`
6. `/workspace/clinket-scrapes/hamilton/hamilton/auto-mechanic.json`
7. `/workspace/clinket-scrapes/hamilton/hamilton/electrical.json`
8. `/workspace/clinket-scrapes/hamilton/hamilton/handyman.json`
9. `/workspace/clinket-scrapes/hamilton/hamilton/house-cleaning.json`
10. `/workspace/clinket-scrapes/hamilton/hamilton/landscaping.json`
11. `/workspace/clinket-scrapes/hamilton/hamilton/plumbing.json`
12. `/workspace/clinket-scrapes/hamilton/mountain/auto-mechanic.json`
13. `/workspace/clinket-scrapes/hamilton/mountain/electrical.json`
14. `/workspace/clinket-scrapes/hamilton/mountain/handyman.json`
15. `/workspace/clinket-scrapes/hamilton/mountain/hvac.json`
16. `/workspace/clinket-scrapes/hamilton/mountain/plumbing.json`

Builder script (reproducible): `/workspace/clinket-scrapes/_build_batch1.py`

## Blockers / gaps for next batch

1. **Area coverage:** Prioritize businesses physically located in Dundas, Stoney Creek, Waterdown, Ancaster (beyond Source Electric).
2. **Deepen stubs:** Several cleaners, appliance shops, and some electricians have phone + website but thin about/hours — fetch contact pages.
3. **Directories:** Try YellowPages.ca category pages, Canada411, Homestars, Yelp public listings for volume.
4. **Categories thin on sub-areas:** More plumbers/HVAC on Mountain vs Downtown; more downtown hair already strong.
5. **Social URLs:** Only add when linked from official sites (do not invent).
6. **Avoid login walls:** Skip Facebook/Kijiji if CAPTCHA/paywall; note and move on.
7. **Dedup across batches:** Use `id` slug format `hamilton-<area>-<business-slug>`.

## Sample richest records (names + phones only)

- Three Seasons Landscapes — 905-921-5959
- Hamilton Heating and Cooling — 289-778-3090
- Cardinal Handyman — 647-239-6832
- Pitton Plumbing & Heating Inc. — 905-544-0006
- CRS Automotive — 905-544-8335
- HAMCO Heating & Cooling — 905-527-1049
