# Clinket Deepen Pass 1 Summary

- Generated: 2026-09-23T16:34:53-04:00 (America/Toronto)
- Scope: Hamilton, Burlington, Oakville, Mississauga, Toronto, Brampton, Vaughan, Markham, Cambridge
- Rule: update existing providers in place by `id` only; never invent emails/phones
- INDEX baseline at pass start: **155 emails / 626 providers** (see `INDEX.json`)
- This pass added **62** emails to existing providers (target 40–80)
- Current email total across city trees: **238** (provider counts may include concurrent scrape growth)

## Email coverage by city (this pass)

| City | Providers now | Emails now | Emails added this pass |
|---|---:|---:|---:|
| hamilton | 91 | 62 | +19 |
| burlington | 63 | 16 | +1 |
| oakville | 70 | 28 | +9 |
| mississauga | 83 | 20 | +0 |
| toronto | 79 | 26 | +5 |
| brampton | 88 | 12 | +1 |
| vaughan | 100 | 29 | +14 |
| markham | 87 | 29 | +9 |
| cambridge | 74 | 16 | +4 |
| **TOTAL** | **735** | **238** | **+62** |

## Emails added (62)

| Business | Email | City | Source |
|---|---|---|---|
| HC Roofing | `bobby@hcroofing.ca` | brampton | website_scrape |
| Alpha Appliance Repair Burlington | `info@alphaappliance.ca` | burlington | official privacy-policy page |
| Cambridge Plumbing & Water Conditioning | `info@cambridgeplumbingandwaterconditioning.ca` | cambridge | website_scrape |
| House & Hammer Roofing | `info@houseandhammerroofing.ca` | cambridge | website_scrape |
| Molly Maid Cambridge | `info@mollymaid.ca` | cambridge | website_scrape |
| Reliance Home Comfort Cambridge | `customersuccessteam@reliancecomfort.com` | cambridge | website_scrape |
| Absolutely Spotless Cleaning | `hello@absolutelyspotlesscleaning.ca` | hamilton | website_scrape |
| Aire One West Heating & Cooling | `info@aireonewest.ca` | hamilton | website_scrape |
| Birnie Plumbing & Drains | `info@birnie.pro` | hamilton | websearch (LinkedIn company page) |
| Birnie Plumbing & Drains of Waterdown | `info@birnie.pro` | hamilton | websearch (LinkedIn company page) |
| Caspian Appliance Repair | `info@caspianappliancerepair.ca` | hamilton | website_scrape |
| Dynamic Heating and Cooling | `info@dynamicheatandcool.ca` | hamilton | website_scrape |
| Eric's Automotive & Tires | `service@ericsautohamilton.ca` | hamilton | website_scrape |
| First Barbershop | `firstbarbershop9@gmail.com` | hamilton | website_scrape |
| Fixer Upper Upper | `info@fixerupperupper.com` | hamilton | website_scrape |
| Gerry's Roofing & Siding Inc. | `info@gerrysroofing.ca` | hamilton | website_scrape |
| Glendale Motors | `info@glendalemotors.ca` | hamilton | website_scrape |
| Guest Plumbing & HVAC | `info@guestplumbing.com` | hamilton | websearch (LinkedIn company + domain match) |
| Hellamaid Hamilton | `weclean@hellamaid.com` | hamilton | website_scrape |
| John The Plumber Hamilton | `john@johntheplumber.ca` | hamilton | official site contact content |
| Ritz Barbershop (Ancaster) | `ritzbarbershop2023@gmail.com` | hamilton | website_scrape |
| Ritz Barbershop (Waterdown) | `ritzbarbershop2023@gmail.com` | hamilton | website_scrape |
| Stack Electric | `info@stackelectric.ca` | hamilton | official privacy-policy page |
| The Mechanix Auto Shop | `info@themechanixautoshop.org` | hamilton | website_scrape |
| Trinity Automotive | `stoneycreek@trinityautomotive.ca` | hamilton | website_scrape |
| 911 Appliance Repair Services | `office@911appliancerepairservices.ca` | markham | website_scrape |
| AirPoint Heating and Cooling | `info@airpoint.ca` | markham | website_scrape |
| Appliances City Wide | `info@appliancescitywide.com` | markham | website_scrape |
| DSHI Handyman Services | `domenic.sidoti@gmail.com` | markham | website_scrape |
| DSHI Painting Markham | `domenic.sidoti@gmail.com` | markham | website_scrape |
| Diamond Dynasty Cleaning | `cleaning@diamonddynasty.ca` | markham | website_scrape |
| Lia Electric Ltd | `info@liaelectric.com` | markham | website_scrape |
| RenoHouse | `info@renohouse.ca` | markham | website_scrape |
| RenoHouse Painting Markham | `info@renohouse.ca` | markham | website_scrape |
| Anta Plumbing and Drain | `info@antaplumbing.com` | oakville | website_scrape |
| Bespoke Handyman | `phil@bespokehandyman.ca` | oakville | website_scrape |
| Dennis' Of Oakville Auto Service | `service@dennisofoakville.ca` | oakville | website_scrape |
| First Choice Heating & Air Conditioning | `info@firstchoicehvac.ca` | oakville | website_scrape |
| Forevergreen Landscaping & Maintenance | `frank@forevergreenlandscaping.ca` | oakville | official contact.php (WebFetch) |
| Northern Oak Landscapes | `info@noak.ca` | oakville | website_scrape |
| Oakview Electric | `info@oakviewelectric.com` | oakville | website_scrape |
| Oakville Appliance | `info@oakvilleappliance.com` | oakville | website_scrape |
| Sharp Exteriors Inc | `info@sharpexteriors.com` | oakville | website_scrape |
| 416 Roofing Inc | `saul@416roofing.com` | toronto | website_scrape |
| Crawford Roofing Corp | `service@crawfordroofing.ca` | toronto | website_scrape |
| Homestar Heating & Air Conditioning Inc | `info@ihomestar.com` | toronto | official contact page (JS entity decode) |
| Priority Plumbing & Drains | `info@priorityplumbing.ca` | toronto | websearch (official contact indexed) |
| Radman Auto Repair | `info@radmanrepair.ca` | toronto | website_scrape |
| Clean Proper | `hello@cleanproper.ca` | vaughan | website_scrape |
| ComoMaintenance | `info@comomaintenance.com` | vaughan | website_scrape |
| GTA Home Fix | `info@gtahomefix.com` | vaughan | website_scrape |
| Green Auto | `hello@greenautogroup.ca` | vaughan | website_scrape |
| JP Landscape Design | `joseph.parente@outlook.com` | vaughan | website_scrape |
| Maple Auto Centre | `mapleautocentre@hotmail.com` | vaughan | website_scrape |
| Master Mechanic Woodbridge | `woodbridge@mastermechanic.ca` | vaughan | website_scrape |
| McPipe Plumbing | `info@mcpipeplumbing.ca` | vaughan | website_scrape |
| Molly Maid Maple Vaughan | `info@mollymaid.ca` | vaughan | website_scrape |
| RenoHeal | `info@renoheal.ca` | vaughan | website_scrape |
| Rosedale Plumbing | `rosedaleplumbingon@gmail.com` | vaughan | website_scrape |
| Solid Arc Construction Inc | `scott@solidarc.ca` | vaughan | website_scrape |
| Thrust Auto Repair | `mike@thrustautorepair.com` | vaughan | website_scrape |
| Universal Roofs | `info@bestroofingtoronto.ca` | vaughan | website_scrape |

## Provider ids updated (any field): 88

- `brampton-bramalea-exhale-hair-studio-beauty-supplies` — fields: instagram
- `brampton-bramalea-hc-roofing` — fields: businessEmail, facebook, instagram
- `brampton-bramalea-peel-heating-and-air-conditioning` — fields: facebook, instagram
- `brampton-general-mr-rooter-plumbing-of-brampton` — fields: facebook, instagram
- `burlington-general-alpha-appliance-repair-burlington` — fields: businessEmail, facebook
- `burlington-general-burlington-auto-works` — fields: facebook, instagram
- `burlington-general-plumbwize-plumbing-drain-services` — fields: facebook, instagram
- `cambridge-downtown-salon-g` — fields: instagram
- `cambridge-galt-cambridge-plumbing-water-conditioning` — fields: businessEmail, facebook
- `cambridge-general-gerry-s-home-repair` — fields: facebook
- `cambridge-general-house-hammer-roofing` — fields: businessEmail, facebook, instagram
- `cambridge-general-molly-maid-cambridge` — fields: businessEmail, facebook
- `cambridge-general-reliance-home-comfort-cambridge` — fields: businessEmail, facebook, instagram
- `hamilton-ancaster-glendale-motors` — fields: businessEmail
- `hamilton-ancaster-guest-plumbing-hvac` — fields: businessEmail, facebook, instagram
- `hamilton-ancaster-ritz-barbershop` — fields: businessEmail, facebook, instagram
- `hamilton-downtown-first-barbershop` — fields: businessEmail
- `hamilton-downtown-prime-choice-barbershop` — fields: facebook, instagram
- `hamilton-downtown-the-barber-on-locke` — fields: facebook, instagram
- `hamilton-downtown-the-mechanix-auto-shop` — fields: businessEmail, facebook, instagram
- `hamilton-hamilton-absolutely-spotless-cleaning` — fields: businessEmail, facebook, instagram
- `hamilton-hamilton-caspian-appliance-repair` — fields: businessEmail, facebook, instagram
- `hamilton-hamilton-danasy-landscape-maintenance` — fields: facebook, instagram
- `hamilton-hamilton-fixer-upper-upper` — fields: businessEmail
- `hamilton-hamilton-gerrys-roofing-siding` — fields: businessEmail, facebook, instagram
- `hamilton-hamilton-hellamaid-hamilton` — fields: businessEmail, facebook, instagram
- `hamilton-hamilton-square-leaf-landscaping` — fields: facebook, instagram
- `hamilton-hamilton-trinity-automotive` — fields: businessEmail, facebook, instagram
- `hamilton-mountain-aire-one-west-heating-cooling` — fields: businessEmail, facebook, instagram
- `hamilton-mountain-dynamic-heating-and-cooling` — fields: businessEmail, facebook, instagram
- `hamilton-mountain-eric-s-automotive-tires` — fields: businessEmail, facebook, instagram
- `hamilton-mountain-hamilton-mountain-handyman` — fields: facebook, instagram
- `hamilton-mountain-john-the-plumber-hamilton` — fields: businessEmail
- `hamilton-mountain-stack-electric` — fields: businessEmail
- `hamilton-stoney-creek-birnie-plumbing-drains` — fields: businessEmail
- `hamilton-stoney-creek-roto-rooter` — fields: facebook, instagram
- `hamilton-waterdown-birnie-plumbing-drains-of-waterdown` — fields: businessEmail
- `hamilton-waterdown-jays-auto-service-inc` — fields: facebook
- `hamilton-waterdown-ritz-barbershop` — fields: businessEmail, facebook, instagram
- `markham-general-911-appliance-repair-services` — fields: businessEmail, facebook, instagram
- `markham-general-airpoint-heating-and-cooling` — fields: businessEmail, facebook, instagram
- `markham-general-appliances-city-wide` — fields: businessEmail
- `markham-general-diamond-dynasty-cleaning` — fields: businessEmail, facebook, instagram
- `markham-general-dshi-handyman-services` — fields: businessEmail
- `markham-general-dshi-painting-markham` — fields: businessEmail
- `markham-general-renohouse` — fields: businessEmail, facebook, instagram
- `markham-general-renohouse-painting-markham` — fields: businessEmail, facebook, instagram
- `markham-milliken-lia-electric-ltd` — fields: businessEmail
- `markham-unionville-imperial-energy` — fields: facebook, instagram
- `mississauga-general-the-maids-mississauga` — fields: facebook, instagram
- `mississauga-streetsville-mr-rooter-plumbing-of-mississauga-on` — fields: facebook, instagram
- `oakville-brontee-oakview-electric` — fields: businessEmail, facebook, instagram
- `oakville-brontee-plumbwize-plumbing-and-drain-services-oakville` — fields: facebook, instagram
- `oakville-clearview-dennis-of-oakville-auto-service` — fields: businessEmail, facebook
- `oakville-clearview-oakville-appliance` — fields: businessEmail
- `oakville-clearview-sharp-exteriors-inc` — fields: businessEmail
- `oakville-general-anta-plumbing-and-drain` — fields: businessEmail, facebook, instagram
- `oakville-general-first-choice-heating-air-conditioning` — fields: businessEmail
- `oakville-general-northern-oak-landscapes` — fields: businessEmail, facebook, instagram
- `oakville-glen-abbey-bespoke-handyman` — fields: businessEmail, facebook, instagram
- `oakville-glen-abbey-forevergreen-landscaping-maintenance` — fields: businessEmail
- `toronto-downtown-priority-plumbing-drains` — fields: businessEmail, facebook, instagram
- `toronto-etobicoke-radman-auto-repair` — fields: businessEmail, facebook
- `toronto-general-416-roofing-inc` — fields: businessEmail, facebook, instagram
- `toronto-north-york-crawford-roofing-corp` — fields: businessEmail, facebook
- `toronto-north-york-homestar-heating-air-conditioning-inc` — fields: businessEmail, facebook
- `toronto-north-york-levstein-stern-plumbing-ltd` — fields: facebook, instagram
- `vaughan-concord-green-auto` — fields: businessEmail
- `vaughan-concord-maple-air-inc` — fields: facebook, instagram
- `vaughan-concord-mr-rooter-plumbing-of-concord` — fields: facebook, instagram
- `vaughan-concord-rosedale-plumbing` — fields: businessEmail, facebook, instagram
- `vaughan-general-clean-proper` — fields: businessEmail
- `vaughan-general-comomaintenance` — fields: businessEmail, facebook, instagram
- `vaughan-general-gta-home-fix` — fields: businessEmail
- `vaughan-general-handyman-connection-of-vaughan` — fields: facebook, instagram
- `vaughan-general-intact-roofing` — fields: instagram
- `vaughan-general-mcpipe-plumbing` — fields: businessEmail, facebook, instagram
- `vaughan-general-renoheal` — fields: businessEmail, facebook, instagram
- `vaughan-general-solid-arc-construction-inc` — fields: businessEmail, facebook, instagram, schedule
- `vaughan-general-universal-roofs` — fields: businessEmail
- `vaughan-kleinburg-jp-landscape-design` — fields: businessEmail, facebook, instagram
- `vaughan-maple-maple-auto-centre` — fields: businessEmail
- `vaughan-maple-molly-maid-maple-vaughan` — fields: businessEmail, facebook
- `vaughan-woodbridge-master-mechanic-woodbridge` — fields: businessEmail, facebook, instagram, schedule
- `vaughan-woodbridge-midas-auto-service-experts-woodbridge` — fields: instagram
- `vaughan-woodbridge-north-star-appliance-repair` — fields: facebook, instagram
- `vaughan-woodbridge-thrust-auto-repair` — fields: businessEmail
- `vaughan-woodbridge-woodbridge-gta-climatecare` — fields: facebook, instagram

## Rejected / not applied (quality)

- `john@company.com` (YYZ Plumbing) — placeholder
- `/,` (Peatson's Heating) — malformed scrape artifact
- `today@www.climatecare.com` (Woodbridge GTA ClimateCare) — malformed
- `intactroofingandreno@hotmail.com.com` (Intact Roofing) — malformed; no verified public email found
- `info@homeshowoff.com` (Vaughan Appliance Repair) — wrong domain; site phone-only

## Blockers

- Many SMBs hide email behind forms / JS obfuscation / Cloudflare (Priority Plumbing blocked WebFetch; PlumbWize/Birnie/Guest HTML form-only).
- Franchise pages (First Choice, Supercuts, Mr Rooter, Roto-Rooter, The Maids) often phone-only or corporate catch-alls.
- Facebook/Kijiji login walls skipped per rules.
- Some sites empty/parked/bot-challenged via curl (jaxzo.com, fixitbrampton, sheehan, etc.).
- Concurrent scrapes on the shared box increased total provider counts during this pass; updates still matched existing `id`s only.

## Sample new emails (business + email)

- Dynamic Heating and Cooling: `info@dynamicheatandcool.ca`
- Glendale Motors: `info@glendalemotors.ca`
- Eric's Automotive & Tires: `service@ericsautohamilton.ca`
- Ritz Barbershop (Ancaster): `ritzbarbershop2023@gmail.com`
- Aire One West Heating & Cooling: `info@aireonewest.ca`
- Guest Plumbing & HVAC: `info@guestplumbing.com`
- Ritz Barbershop (Waterdown): `ritzbarbershop2023@gmail.com`
- Birnie Plumbing & Drains: `info@birnie.pro`
- Birnie Plumbing & Drains of Waterdown: `info@birnie.pro`
- John The Plumber Hamilton: `john@johntheplumber.ca`
- First Barbershop: `firstbarbershop9@gmail.com`
- Absolutely Spotless Cleaning: `hello@absolutelyspotlesscleaning.ca`
- … plus 50 more (full list above)

