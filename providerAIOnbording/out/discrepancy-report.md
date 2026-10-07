# Toromont catalog import — pre-flight report

Review this before running any import. Nothing here blocks the import; every item is a
judgement call for a human.

## Totals

| Records ready | 682 |
| --- | --- |
| Service areas | 38 |
| Taxonomy pairs | 23 |
| Chunks | 1 |
| With an image | 569 (83.4%) |
| Without a price | 5 |

## Normalization applied

| Kind | Count |
| --- | --- |
| category-slug | 14 |
| duplicate-serial | 3 |
| missing-price | 5 |
| no-service-area | 14 |
| subcategory-slug | 14 |
| taxonomy-pair-override | 4 |
| year-implausible | 1 |

### category-slug

- `1326477`: material-handling → Material Handling
- `1667918`: construction → Construction and Mining
- `444188`: material-handling → Material Handling
- `1329255`: material-handling → Material Handling
- `1184256`: construction → Construction and Mining
- `1477977`: construction → Construction and Mining
- `1177621`: construction → Construction and Mining
- `520683`: construction → Construction and Mining
- `100487`: construction → Construction and Mining
- `1660642`: construction → Construction and Mining
- `321354`: construction → Construction and Mining
- `1433431`: construction → Construction and Mining
- `1433432`: construction → Construction and Mining
- `1473844`: construction → Construction and Mining

### duplicate-serial

- `1682112`: AN401205 → kept 1943356
- `1781872`: AN401205 → kept 1943356
- `1653731`: AN401205 → kept 1943356

### missing-price

- `1910132`: (none) → imported without a price
- `1725958`: (none) → imported without a price
- `1428347`: (none) → imported without a price
- `1672539`: (none) → imported without a price
- `1296992`: (none) → imported without a price

### no-service-area

- `1508963`: customer (lift) → business default area
- `1325980`: customer (lift) → business default area
- `1192025`: customer (lift) → business default area
- `1189438`: customer (lift) → business default area
- `1707701`: customer (lift) → business default area
- `1708981`: customer (lift) → business default area
- `790844`: customer (lift) → business default area
- `1345514`: customer (lift) → business default area
- `1326477`: fournisseur (lift) → business default area
- `578267`: customer (lift) → business default area
- `1317748`: customer (lift) → business default area
- `1333515`: customer (lift) → business default area
- `432230`: customer (lift) → business default area
- `321015`: customer (lift) → business default area

### subcategory-slug

- `1326477`: forklifts → Forklifts
- `1667918`: motor-graders → Motor Graders
- `444188`: forklifts → Forklifts
- `1329255`: forklifts → Forklifts
- `1184256`: wheel-loaders → Wheel Loaders
- `1477977`: wheel-loaders → Wheel Loaders
- `1177621`: excavators → Excavators
- `520683`: dozers → Dozers
- `100487`: motor-graders → Motor Graders
- `1660642`: motor-graders → Motor Graders
- `321354`: underground-mining-equipment → Underground Mining Equipment
- `1433431`: wheel-loaders → Wheel Loaders
- `1433432`: wheel-loaders → Wheel Loaders
- `1473844`: dozers → Dozers

### taxonomy-pair-override

- `1358118`: power-systems >> engines-marine-propulsion-auxiliary → Power Systems >> Engines - Marine Propulsion & Auxiliary
- `1659916`: crushers >> material-handling-arm → Attachments and Accessories >> Material Handling Arm
- `1659915`: crushers >> material-handling-arm → Attachments and Accessories >> Material Handling Arm
- `1659914`: crushers >> material-handling-arm → Attachments and Accessories >> Material Handling Arm

### year-implausible

- `1910132`: 9999 → (dropped)

## Taxonomy to be created

- Attachments and Accessories >> Material Handling Arm
- Construction and Mining >> Articulated Trucks
- Construction and Mining >> Asphalt Pavers
- Construction and Mining >> Backhoe Loaders
- Construction and Mining >> Compact Track Loaders
- Construction and Mining >> Compact Wheel Loaders
- Construction and Mining >> Compactors
- Construction and Mining >> Crushers
- Construction and Mining >> Dozers
- Construction and Mining >> Excavators
- Construction and Mining >> Forestry Machines
- Construction and Mining >> Mini Excavators
- Construction and Mining >> Motor Graders
- Construction and Mining >> Off Highway Trucks
- Construction and Mining >> Pneumatic Compactors
- Construction and Mining >> Screeners
- Construction and Mining >> Skid Steer Loaders
- Construction and Mining >> Skidders
- Construction and Mining >> Telehandlers
- Construction and Mining >> Underground Mining Equipment
- Construction and Mining >> Wheel Loaders
- Material Handling >> Forklifts
- Power Systems >> Engines - Marine Propulsion & Auxiliary

## Service areas to be created

- Brandon, MB — city `Brandon`, state `MB`, country `Canada`
- Cambridge, ON — city `Cambridge`, state `ON`, country `Canada`
- Candiac, QC — city `Candiac`, state `QC`, country `Canada`
- Charlottetown, PE — city `Charlottetown`, state `PE`, country `Canada`
- Chicoutimi, QC — city `Chicoutimi`, state `QC`, country `Canada`
- Concord (Lift), ON — city `Concord`, state `ON`, country `Canada`
- Concord, ON — city `Concord`, state `ON`, country `Canada`
- Dartmouth, NS — city `Dartmouth`, state `NS`, country `Canada`
- Fredericton, NB — city `Fredericton`, state `NB`, country `Canada`
- Guelph Rental, ON — city `Guelph`, state `ON`, country `Canada`
- Hamilton (Lift), ON — city `Hamilton`, state `ON`, country `Canada`
- Hamilton, ON — city `Hamilton`, state `ON`, country `Canada`
- Head Office, ON — city `Head Office`, state `ON`, country `Canada`
- Kingston, ON — city `Kingston`, state `ON`, country `Canada`
- Lévis (Manutention), QC — city `Lévis`, state `QC`, country `Canada`
- London, ON — city `London`, state `ON`, country `Canada`
- Moncton, NB — city `Moncton`, state `NB`, country `Canada`
- Orillia, ON — city `Orillia`, state `ON`, country `Canada`
- OTTAWA, ON — city `OTTAWA`, state `ON`, country `Canada`
- Pasadena, NL — city `Pasadena`, state `NL`, country `Canada`
- Peterborough, ON — city `Peterborough`, state `ON`, country `Canada`
- Pointe-Claire (Manutention), QC — city `Pointe-Claire`, state `QC`, country `Canada`
- Pointe-Claire, QC — city `Pointe-Claire`, state `QC`, country `Canada`
- Quebec City, QC — city `Quebec City`, state `QC`, country `Canada`
- Sault Ste. Marie, ON — city `Sault Ste. Marie`, state `ON`, country `Canada`
- Sept-Îles, QC — city `Sept-Îles`, state `QC`, country `Canada`
- Sherbrooke CCE, QC — city `Sherbrooke`, state `QC`, country `Canada`
- ST. JOHN'S, NL — city `ST. JOHN'S`, state `NL`, country `Canada`
- Sudbury, ON — city `Sudbury`, state `ON`, country `Canada`
- Sydney, NS — city `Sydney`, state `NS`, country `Canada`
- Thunder Bay, ON — city `Thunder Bay`, state `ON`, country `Canada`
- Timmins, ON — city `Timmins`, state `ON`, country `Canada`
- Trois-Rivières, QC — city `Trois-Rivières`, state `QC`, country `Canada`
- Val-d'Or, QC — city `Val-d'Or`, state `QC`, country `Canada`
- Windsor, ON — city `Windsor`, state `ON`, country `Canada`
- Winnipeg (Lift), MB — city `Winnipeg`, state `MB`, country `Canada`
- Winnipeg, MB — city `Winnipeg`, state `MB`, country `Canada`
- Woodstock (Lift), ON — city `Woodstock`, state `ON`, country `Canada`

## Chunk plan

| # | Label | Records |
| --- | --- | --- |
| 1 | Sherbrooke CCE, QC + 38 more branches | 682 |

## Prices taken from the live listing page

`preferPagePrice` is **true**. The export was captured once; the page is
live. Every override below is the page disagreeing with the export — review them, and set
`preferPagePrice: false` in `tools/prepare.mjs` if the export should win instead.

| Id | Name | Export | Published (page) | Delta |
| --- | --- | --- | --- | --- |
| 1743991 | 2019 MCFA GP25N5 (L124500) | 38399 | 36699 | -1,700 |
| 1330352 | 2019 MCFA GP30N5 (LM016178) | 37299 | 35599 | -1,700 |
| 2061100 | 2023 CATERPILLAR 239D3 (MT39978A) | 58900 | 55600 | -3,300 |
| 2060845 | 2023 CATERPILLAR 239D3 (MT40473B) | 58000 | 56900 | -1,100 |
| 2059665 | 2022 CATERPILLAR 299D3 (MT41624A) | 86000 | 84400 | -1,600 |
| 2060013 | 2019 CATERPILLAR 299D2 (MT39942A) | 53300 | 50000 | -3,300 |
| 2059541 | 2022 CATERPILLAR 299D3 (MT41620A) | 66000 | 61700 | -4,300 |
| 1913223 | 2019 JOHN DEERE 135G (MT41997A) | 225600 | 221100 | -4,500 |
| 1915224 | 2010 CATERPILLAR 303 . 5 (MT39521A) | 43900 | 41700 | -2,200 |
| 1718497 | 2025 CATERPILLAR 914 - 14 (MT396690) | 264400 | 233300 | -31,100 |
| 1708684 | 2025 CATERPILLAR 914 - 14 (MT389180) | 264400 | 233300 | -31,100 |
| 1718495 | 2025 CATERPILLAR 914 - 14 (MT396670) | 264400 | 233300 | -31,100 |
| 1701020 | 2025 CATERPILLAR 914 - 14 (MT384140) | 264400 | 233300 | -31,100 |
| 1718873 | 2025 CATERPILLAR 930 - 14 (MT396140) | 377800 | 316700 | -61,100 |
| 92499 | 2016 CATERPILLAR 980M (MT40720A) | 210000 | 198900 | -11,100 |
| 1913069 | 2024 J C B (J.C.BAMFORD) 409 (MT41907A) | 123300 | 120000 | -3,300 |
| 1460145 | 2023 CATERPILLAR 323 - 07 (MT42011A) | 261100 | 254400 | -6,700 |
| 109819 | 2007 CATERPILLAR D5GXL (M106324A) | 81100 | 77800 | -3,300 |
| 83461 | 2014 CATERPILLAR 336EL (MT39735A) | 112200 | 110000 | -2,200 |
| 1907212 | 2023 JOHN DEERE 325G (MT41177A) | 83300 | 77800 | -5,500 |
| 1903822 | 2023 KUBOTA KX080 - 4 (MT36909A) | 177800 | 166700 | -11,100 |
| 1504421 | 2023 CATERPILLAR 323 - 07 (MT42601A) | 285600 | 280000 | -5,600 |
| 1758730 | 2017 BOBCAT S770 (MT40630A) | 46100 | 42800 | -3,300 |
| 1157580 | 2021 CATERPILLAR 315 - 07 (MT40179A) | 233300 | 227800 | -5,500 |
| 109700 | 2008 CATERPILLAR D6TXLVP (M1062650) | 161100 | 150000 | -11,100 |
| 1617738 | 2024 CATERPILLAR 308 - 07 (MF062660) | 177800 | 172200 | -5,600 |
| 178862 | 2008 CATERPILLAR D6TXWVP (MC06078C) | 60000 | 56700 | -3,300 |
| 1178068 | 2021 WEILER P65 (MT40379A) | 114400 | 110000 | -4,400 |
| 535681 | 2013 CATERPILLAR 328DLCR (M1059740) | 66700 | 55600 | -11,100 |
| 1733378 | 2018 MCFA 2C5000 3V (LM015982) | 19499 | 17299 | -2,200 |
| 1727909 | 2008 CASE CX210B (MT37275A) | 42200 | 27800 | -14,400 |
| 775402 | 2019 CATERPILLAR 440 - 07 (MT33198A) | 66700 | 63300 | -3,400 |
| 790844 | 2019 MCFA 2C5000 (L124770) | 26699 | 26199 | -500 |
| 509426 | 2018 MCFA 2C5000 (LQ202807) | 19499 | 17299 | -2,200 |
| 1317387 | 2019 MCFA 2C6000 - INT (LM016137) | 29999 | 26199 | -3,800 |
| 443540 | 2016 MCFA 2C6000 (LQ192306) | 24499 | 16199 | -8,300 |
| 1317644 | 2020 MCFA 2EP5000 3V (LM017026) | 39000 | 38999 | -1 |
| 444188 | 2016 CATERPILLAR LIFT GC60 (LQ198725) | 110250 | 101850 | -8,400 |
| 1352131 | 2018 MCFA GP30N5 3V (LM015453) | 38999 | 37299 | -1,700 |
| 1455801 | 2021 CATERPILLAR M318 - 07 (M106305A) | 310000 | 298900 | -11,100 |

## Page cross-check discrepancies

Everything the page and the export disagreed on, including the overrides above.

| Id | Name | Issue |
| --- | --- | --- |
| 1967237 | 2017 CATERPILLAR 420F2IT (MB067450) | page carries no price |
| 1967237 | 2017 CATERPILLAR 420F2IT (MB067450) | no images found on page |
| 1967227 | 2016 CATERPILLAR 420F2IT (MB067460) | page carries no price |
| 1967227 | 2016 CATERPILLAR 420F2IT (MB067460) | no images found on page |
| 1965101 | 2019 CATERPILLAR 246D (MB067390) | page carries no price |
| 1965101 | 2019 CATERPILLAR 246D (MB067390) | no images found on page |
| 91615 | 2018 CATERPILLAR D3K2XL (MT39820A) | page carries no price |
| 91615 | 2018 CATERPILLAR D3K2XL (MT39820A) | no images found on page |
| 183895 | 1998-CATERPILLAR-MT23527B (MT23527B) | page carries no price |
| 183895 | 1998-CATERPILLAR-MT23527B (MT23527B) | no images found on page |
| 1914363 | 2000 TEREX 683 (MC066200) | model mismatch: export "683" vs page "693" |
| 2064172 | 2015 JOHN DEERE 700KXLT (MT41146A) | page carries no price |
| 2064172 | 2015 JOHN DEERE 700KXLT (MT41146A) | no images found on page |
| 2016944 | 2016 CATERPILLAR 262D (MT40237B) | page carries no price |
| 2016944 | 2016 CATERPILLAR 262D (MT40237B) | no images found on page |
| 1992260 | 2017 CATERPILLAR 301 . 7DCR (MB067190) | model mismatch: export "301.7DCR" vs page "301.7-05" |
| 1967692 | 2015 CATERPILLAR 226B3 (MB067380) | page carries no price |
| 1967692 | 2015 CATERPILLAR 226B3 (MB067380) | no images found on page |
| 177930 | 2005 CATERPILLAR 420D (MT42426A) | page carries no price |
| 177930 | 2005 CATERPILLAR 420D (MT42426A) | no images found on page |
| 5607 | CATERPILLAR D6D (MC068130) | page carries no price |
| 5607 | CATERPILLAR D6D (MC068130) | no images found on page |
| 1296990 | 2023 METSO MINERALS S4 . 9 (MC066440) | page fetch failed: HTTP 404 |
| 1993091 | 2015 CATERPILLAR TL943C (MB067630) | page carries no price |
| 1993091 | 2015 CATERPILLAR TL943C (MB067630) | no images found on page |
| 1345516 | 2017 MCFA 2ET4000 (LM015396) | page carries no price |
| 1345516 | 2017 MCFA 2ET4000 (LM015396) | no images found on page |
| 1325720 | 2021 MITSUBISHI ESR18N (LM017197) | no images found on page |
| 1325719 | 2021 MITSUBISHI ESR18N (LM017194) | no images found on page |
| 561065 | 2018 MCFA 2C5000 (LQ201993) | no images found on page |
| 324364 | 2019 JUNGHEINRICH ETG318 (LQ208946) | no images found on page |
| 1353117 | 2019 MCFA GP30N5 (LM016452) | no images found on page |
| 1324661 | 2021 JUNGHEINRICH EKS314 (LM017698) | no images found on page |
| 1291324 | 2021 MCFA EC30 (LM017693) | no images found on page |
| 1175674 | 2021 CATERPILLAR 730 - 04 (MT40335A) | page carries no price |
| 1175674 | 2021 CATERPILLAR 730 - 04 (MT40335A) | no images found on page |
| 1156225 | 2021 CATERPILLAR 320 - 07 (MF067990) | page carries no price |
| 1156225 | 2021 CATERPILLAR 320 - 07 (MF067990) | no images found on page |
| 2062520 | 2021 KOMATSU HD325 (M106311A) | page carries no price |
| 2062520 | 2021 KOMATSU HD325 (M106311A) | no images found on page |
| 2061949 | 2021 KOMATSU HD325 (M106310A) | page carries no price |
| 2061949 | 2021 KOMATSU HD325 (M106310A) | no images found on page |
| 1915931 | 2023 CATERPILLAR CS56B (M1066630) | page carries no price |
| 1915931 | 2023 CATERPILLAR CS56B (M1066630) | no images found on page |
| 1743991 | 2019 MCFA GP25N5 (L124500) | price mismatch: export 38399 vs page 36699 |
| 1743991 | 2019 MCFA GP25N5 (L124500) | no images found on page |
| 1352840 | 2018 MCFA 2C5000 HO (LM015421) | page carries no price |
| 1352840 | 2018 MCFA 2C5000 HO (LM015421) | no images found on page |
| 1343743 | 2018 MCFA GP30N5 (LM015464) | no images found on page |
| 1330352 | 2019 MCFA GP30N5 (LM016178) | price mismatch: export 37299 vs page 35599 |
| 1330352 | 2019 MCFA GP30N5 (LM016178) | no images found on page |
| 1317962 | 2018 MCFA 2ET4000 - 4V (LM016115) | no images found on page |
| 1944515 | 2014 CATERPILLAR 259D (M104409B) | page fetch failed: HTTP 404 |
| 1299747 | 2022 CATERPILLAR D4 - 16VP (MF067820) | page carries no price |
| 1299747 | 2022 CATERPILLAR D4 - 16VP (MF067820) | no images found on page |
| 1299545 | 2022 CATERPILLAR 330 - 07 (MF067810) | page carries no price |
| 1299545 | 2022 CATERPILLAR 330 - 07 (MF067810) | no images found on page |
| 2040885 | 2016 CATERPILLAR 249D (MC067730) | page carries no price |
| 2040885 | 2016 CATERPILLAR 249D (MC067730) | no images found on page |
| 1353001 | 2019 MCFA GP40N1 4V (LM016194) | page carries no price |
| 1353001 | 2019 MCFA GP40N1 4V (LM016194) | no images found on page |
| 2061277 | 2023 CATERPILLAR 239D3 (MT40614A) | page carries no price |
| 2061277 | 2023 CATERPILLAR 239D3 (MT40614A) | no images found on page |
| 2061100 | 2023 CATERPILLAR 239D3 (MT39978A) | price mismatch: export 58900 vs page 55600 |
| 2060845 | 2023 CATERPILLAR 239D3 (MT40473B) | price mismatch: export 58000 vs page 56900 |
| 2059665 | 2022 CATERPILLAR 299D3 (MT41624A) | price mismatch: export 86000 vs page 84400 |
| 2060013 | 2019 CATERPILLAR 299D2 (MT39942A) | price mismatch: export 53300 vs page 50000 |
| 2059541 | 2022 CATERPILLAR 299D3 (MT41620A) | price mismatch: export 66000 vs page 61700 |
| 2058745 | 2020 CATERPILLAR 259D3 (MT42723A) | page carries no price |
| 2058745 | 2020 CATERPILLAR 259D3 (MT42723A) | no images found on page |
| 2041751 | 2022 CATERPILLAR 308 (MT40560A) | page carries no price |
| 2041751 | 2022 CATERPILLAR 308 (MT40560A) | no images found on page |
| 2039080 | 2022 CATERPILLAR 306 - 07 (MT40776A) | page carries no price |
| 2039080 | 2022 CATERPILLAR 306 - 07 (MT40776A) | no images found on page |
| 792479 | 2020 JUNGHEINRICH EKS314A (LM017276) | no images found on page |
| 1913223 | 2019 JOHN DEERE 135G (MT41997A) | price mismatch: export 225600 vs page 221100 |
| 1343778 | 2017 JUNGHEINRICH ETR345 (LM015209) | no images found on page |
| 1329156 | 2018 MCFA GC55STRPRH (LM015490) | page carries no price |
| 1329156 | 2018 MCFA GC55STRPRH (LM015490) | no images found on page |
| 1992782 | 2023 CATERPILLAR 303 . 5 - 07 (MT40259A) | page carries no price |
| 1992782 | 2023 CATERPILLAR 303 . 5 - 07 (MT40259A) | no images found on page |
| 1190875 | 2021 CATERPILLAR 352 - 07 (MT41154A) | page carries no price |
| 1190875 | 2021 CATERPILLAR 352 - 07 (MT41154A) | no images found on page |
| 1688385 | 2021 CATERPILLAR 730 - 04 (M1065740) | page carries no price |
| 1688385 | 2021 CATERPILLAR 730 - 04 (M1065740) | no images found on page |
| 1663366 | 2024 JUNGHEINRICH ETV216A (LM800247) | no images found on page |
| 1663365 | 2024 JUNGHEINRICH ETV216A (LM800246) | no images found on page |
| 1663367 | 2024 JUNGHEINRICH ETV216A (LM800248) | no images found on page |
| 422121 | 2018 MCFA GC45 - STR (LQ201999) | no images found on page |
| 1663369 | 2024 JUNGHEINRICH ETV216A (LM800250) | no images found on page |
| 1663368 | 2024 JUNGHEINRICH ETV216A (LM800249) | no images found on page |
| 1317732 | 2018 MCFA 2ET3000 (LM801215) | no images found on page |
| 1916755 | 2013 KOMATSU WA250 (MT39601A) | page carries no price |
| 1916755 | 2013 KOMATSU WA250 (MT39601A) | no images found on page |
| 1188182 | 2021 CATERPILLAR 315 - 07 (MT42073A) | page carries no price |
| 1188182 | 2021 CATERPILLAR 315 - 07 (MT42073A) | no images found on page |
| 1915224 | 2010 CATERPILLAR 303 . 5 (MT39521A) | price mismatch: export 43900 vs page 41700 |
| 200505 | 2018-CATERPILLAR-MT40688A (MT40688A) | page carries no price |
| 200505 | 2018-CATERPILLAR-MT40688A (MT40688A) | no images found on page |
| 1550173 | 2024 CATERPILLAR D1 - 12 (MF066850) | page carries no price |
| 1550173 | 2024 CATERPILLAR D1 - 12 (MF066850) | no images found on page |
| 1296577 | 2017 MCFA DP70N1 (LM014616) | no images found on page |
| 772326 | 2019 JUNGHEINRICH ETR340A (L124900) | no images found on page |
| 320198 | 2019 MCFA GP25 (LQ210755) | no images found on page |
| 1916782 | 2021 KOMATSU PC360 - 11 (MT40679B) | page carries no price |
| 1916782 | 2021 KOMATSU PC360 - 11 (MT40679B) | no images found on page |
| 1914975 | 2017 KOMATSU PC240LC - 11 (M1066360) | page carries no price |
| 1914975 | 2017 KOMATSU PC240LC - 11 (M1066360) | no images found on page |
| 507047 | 2016 CATERPILLAR 314ELCR (M1066370) | page carries no price |
| 507047 | 2016 CATERPILLAR 314ELCR (M1066370) | no images found on page |
| 1914978 | 2021 KOMATSU PC360LC - 11 (M1066350) | page carries no price |
| 1914978 | 2021 KOMATSU PC360LC - 11 (M1066350) | no images found on page |
| 41075 | 1999 CATERPILLAR D7G (MT38719C) | page carries no price |
| 41075 | 1999 CATERPILLAR D7G (MT38719C) | no images found on page |
| 1718497 | 2025 CATERPILLAR 914 - 14 (MT396690) | price mismatch: export 264400 vs page 233300 |
| 1708684 | 2025 CATERPILLAR 914 - 14 (MT389180) | price mismatch: export 264400 vs page 233300 |
| 1718495 | 2025 CATERPILLAR 914 - 14 (MT396670) | price mismatch: export 264400 vs page 233300 |
| 1701020 | 2025 CATERPILLAR 914 - 14 (MT384140) | price mismatch: export 264400 vs page 233300 |
| 1464989 | 2023 CATERPILLAR MH3026 - 07 (MC066250) | page carries no price |
| 1718873 | 2025 CATERPILLAR 930 - 14 (MT396140) | price mismatch: export 377800 vs page 316700 |
| 1698180 | 2025 CATERPILLAR 920 - 14 (MT379160) | page carries no price |
| 1698180 | 2025 CATERPILLAR 920 - 14 (MT379160) | no images found on page |
| 1299777 | 2022 CATERPILLAR 420 - 07XE (MC066460) | page carries no price |
| 1299777 | 2022 CATERPILLAR 420 - 07XE (MC066460) | no images found on page |
| 1497312 | 2019 CATERPILLAR CB13 (M1062990) | page carries no price |
| 1497312 | 2019 CATERPILLAR CB13 (M1062990) | no images found on page |
| 102454 | 2006 CATERPILLAR PS300C (MT41303C) | page carries no price |
| 102454 | 2006 CATERPILLAR PS300C (MT41303C) | no images found on page |
| 1914995 | 2015 CASE TR270 (MT41335A) | page carries no price |
| 1914995 | 2015 CASE TR270 (MT41335A) | no images found on page |
| 92499 | 2016 CATERPILLAR 980M (MT40720A) | price mismatch: export 210000 vs page 198900 |
| 1913614 | 2015 JOHN DEERE 850 (MT37712A) | page carries no price |
| 1913614 | 2015 JOHN DEERE 850 (MT37712A) | no images found on page |
| 1724447 | 2026 CATERPILLAR 930 - 14 (M1066060) | page carries no price |
| 1724447 | 2026 CATERPILLAR 930 - 14 (M1066060) | no images found on page |
| 1688387 | 2021 CATERPILLAR 730 - 04 (M1065750) | page carries no price |
| 1688387 | 2021 CATERPILLAR 730 - 04 (M1065750) | no images found on page |
| 1913069 | 2024 J C B (J.C.BAMFORD) 409 (MT41907A) | price mismatch: export 123300 vs page 120000 |
| 225555 | 2010 CATERPILLAR 938H (MC066000) | page carries no price |
| 225555 | 2010 CATERPILLAR 938H (MC066000) | no images found on page |
| 1460145 | 2023 CATERPILLAR 323 - 07 (MT42011A) | price mismatch: export 261100 vs page 254400 |
| 109819 | 2007 CATERPILLAR D5GXL (M106324A) | price mismatch: export 81100 vs page 77800 |
| 1308995 | 2022 CATERPILLAR 320 - 07 (MC065420) | page carries no price |
| 1308995 | 2022 CATERPILLAR 320 - 07 (MC065420) | no images found on page |
| 1910132 | 9999 CEDARAPIDS MVP380 (M1065500) | page carries no price |
| 107525 | 2018 CATERPILLAR 315FLCR (MC068180) | page carries no price |
| 107525 | 2018 CATERPILLAR 315FLCR (MC068180) | no images found on page |
| 83461 | 2014 CATERPILLAR 336EL (MT39735A) | price mismatch: export 112200 vs page 110000 |
| 1907212 | 2023 JOHN DEERE 325G (MT41177A) | price mismatch: export 83300 vs page 77800 |
| 1905704 | 2024 CATERPILLAR 980 - 14 (M1065020) | page carries no price |
| 1905704 | 2024 CATERPILLAR 980 - 14 (M1065020) | no images found on page |
| 1906512 | 2022 CATERPILLAR CS56B (M1065200) | page carries no price |
| 1906512 | 2022 CATERPILLAR CS56B (M1065200) | no images found on page |
| 1903822 | 2023 KUBOTA KX080 - 4 (MT36909A) | price mismatch: export 177800 vs page 166700 |
| 175450 | 2017 CATERPILLAR D6NLGP (MT40061A) | page carries no price |
| 175450 | 2017 CATERPILLAR D6NLGP (MT40061A) | no images found on page |
| 1692643 | 2024 CATERPILLAR 326 - 07 (MT40981A) | page carries no price |
| 1692643 | 2024 CATERPILLAR 326 - 07 (MT40981A) | no images found on page |
| 1903117 | 2023 CATERPILLAR 242D3 (M1064730) | page carries no price |
| 1903117 | 2023 CATERPILLAR 242D3 (M1064730) | no images found on page |
| 1904239 | 2017 VOLVO A45G (M1162140) | page carries no price |
| 1904239 | 2017 VOLVO A45G (M1162140) | no images found on page |
| 1286297 | 2022 CATERPILLAR 926M (MT39572A) | page carries no price |
| 1286297 | 2022 CATERPILLAR 926M (MT39572A) | no images found on page |
| 1725958 | 2025 METSO MINERALS I1011 (ME405960) | page carries no price |
| 1725958 | 2025 METSO MINERALS I1011 (ME405960) | no images found on page |
| 103873 | 2006 CATERPILLAR D10T (MC063010) | page carries no price |
| 103873 | 2006 CATERPILLAR D10T (MC063010) | no images found on page |
| 1504421 | 2023 CATERPILLAR 323 - 07 (MT42601A) | price mismatch: export 285600 vs page 280000 |
| 82421 | 2015 CATERPILLAR 950M (MT35465A) | page carries no price |
| 82421 | 2015 CATERPILLAR 950M (MT35465A) | no images found on page |
| 491391 | 2007 CATERPILLAR 262B (MT37832B) | page carries no price |
| 491391 | 2007 CATERPILLAR 262B (MT37832B) | no images found on page |
| 1299805 | 2022 CATERPILLAR 440 - 07 (MT34609A) | page carries no price |
| 1299805 | 2022 CATERPILLAR 440 - 07 (MT34609A) | no images found on page |
| 1758730 | 2017 BOBCAT S770 (MT40630A) | price mismatch: export 46100 vs page 42800 |
| 1433818 | 2023 CATERPILLAR 320 - 07 (MT40577A) | page carries no price |
| 1433818 | 2023 CATERPILLAR 320 - 07 (MT40577A) | no images found on page |
| 200242 | 2017 CATERPILLAR 972M (MT37124A) | page carries no price |
| 200242 | 2017 CATERPILLAR 972M (MT37124A) | no images found on page |
| 1157580 | 2021 CATERPILLAR 315 - 07 (MT40179A) | price mismatch: export 233300 vs page 227800 |
| 109700 | 2008 CATERPILLAR D6TXLVP (M1062650) | price mismatch: export 161100 vs page 150000 |
| 76538 | 2017 CATERPILLAR 336EL (M1161720) | page carries no price |
| 76538 | 2017 CATERPILLAR 336EL (M1161720) | no images found on page |
| 1617738 | 2024 CATERPILLAR 308 - 07 (MF062660) | price mismatch: export 177800 vs page 172200 |
| 178862 | 2008 CATERPILLAR D6TXWVP (MC06078C) | price mismatch: export 60000 vs page 56700 |
| 1746624 | 2021-BOBCAT-M1061490 (M1061490) | page carries no price |
| 1746624 | 2021-BOBCAT-M1061490 (M1061490) | no images found on page |
| 199349 | 2018 CATERPILLAR 938K (MT42482A) | page carries no price |
| 199349 | 2018 CATERPILLAR 938K (MT42482A) | no images found on page |
| 1655293 | 2022 WEILER B457 (MT39433A) | page carries no price |
| 1655293 | 2022 WEILER B457 (MT39433A) | no images found on page |
| 1178068 | 2021 WEILER P65 (MT40379A) | price mismatch: export 114400 vs page 110000 |
| 1428347 | 2024 MASABA 3264 (ME309060) | page carries no price |
| 1435533 | 2022 CATERPILLAR 930M (MT39458A) | page carries no price |
| 1435533 | 2022 CATERPILLAR 930M (MT39458A) | no images found on page |
| 1330093 | 2015 CATERPILLAR LIFT GP30N5 (LM014062) | no images found on page |
| 1740042 | 2014 JOHN DEERE 544KX (MT38894A) | page carries no price |
| 1740042 | 2014 JOHN DEERE 544KX (MT38894A) | no images found on page |
| 1325858 | 2021 JUNGHEINRICH ETG318 (LM017436) | page carries no price |
| 1325858 | 2021 JUNGHEINRICH ETG318 (LM017436) | no images found on page |
| 110032 | 2006 CATERPILLAR D6RIII LGP (MT39074A) | page carries no price |
| 110032 | 2006 CATERPILLAR D6RIII LGP (MT39074A) | no images found on page |
| 1358118 | 2022 CATERPILLAR C32 MP3SG (N210004AL) | no images found on page |
| 535681 | 2013 CATERPILLAR 328DLCR (M1059740) | price mismatch: export 66700 vs page 55600 |
| 1733378 | 2018 MCFA 2C5000 3V (LM015982) | price mismatch: export 19499 vs page 17299 |
| 234070 | 1996 CATERPILLAR IT24F (MC060130) | page carries no price |
| 234070 | 1996 CATERPILLAR IT24F (MC060130) | no images found on page |
| 1727909 | 2008 CASE CX210B (MT37275A) | price mismatch: export 42200 vs page 27800 |
| 775402 | 2019 CATERPILLAR 440 - 07 (MT33198A) | price mismatch: export 66700 vs page 63300 |
| 1353043 | 2019 CATERPILLAR LIFT GC70K6 PRH (LM016157) | no images found on page |
| 790844 | 2019 MCFA 2C5000 (L124770) | price mismatch: export 26699 vs page 26199 |
| 509426 | 2018 MCFA 2C5000 (LQ202807) | price mismatch: export 19499 vs page 17299 |
| 1317387 | 2019 MCFA 2C6000 - INT (LM016137) | price mismatch: export 29999 vs page 26199 |
| 1672539 | 2024 CATERPILLAR 926 - 14 (MT362140) | page carries no price |
| 320407 | 2019 MCFA DP70 (LQ210785) | no images found on page |
| 443540 | 2016 MCFA 2C6000 (LQ192306) | price mismatch: export 24499 vs page 16199 |
| 1326477 | 2019 MITSUBISHI FB20PNT (LM801362) | no images found on page |
| 1322235 | 2017 MCFA DP45N1 4V (LM801185) | page carries no price |
| 1322235 | 2017 MCFA DP45N1 4V (LM801185) | no images found on page |
| 1317644 | 2020 MCFA 2EP5000 3V (LM017026) | price mismatch: export 39000 vs page 38999 |
| 1662600 | 2024 CATERPILLAR CP11 - 03 (MT352290) | page carries no price |
| 1662600 | 2024 CATERPILLAR CP11 - 03 (MT352290) | no images found on page |
| 561060 | 2018 MCFA GP30 (LQ207965) | page carries no price |
| 561060 | 2018 MCFA GP30 (LQ207965) | no images found on page |
| 444188 | 2016 CATERPILLAR LIFT GC60 (LQ198725) | price mismatch: export 110250 vs page 101850 |
| 22779 | 2018 CATERPILLAR 745 - 04 (MT42948A) | page carries no price |
| 22779 | 2018 CATERPILLAR 745 - 04 (MT42948A) | no images found on page |
| 320321 | 2018-CATERPILLAR LIFT-LQ202005 (LQ202005) | page carries no price |
| 320321 | 2018-CATERPILLAR LIFT-LQ202005 (LQ202005) | no images found on page |
| 1352131 | 2018 MCFA GP30N5 3V (LM015453) | price mismatch: export 38999 vs page 37299 |
| 321354 | 2017 CATERPILLAR AD60 (M1041530) | page fetch failed: HTTP 404 |
| 1343656 | 2019 MCFA 2C5000 - 245 (LM016129) | page carries no price |
| 1343656 | 2019 MCFA 2C5000 - 245 (LM016129) | no images found on page |
| 1455801 | 2021 CATERPILLAR M318 - 07 (M106305A) | price mismatch: export 310000 vs page 298900 |
| 1296992 | 2021 METSO MINERALS ST2 . 8 (ME296310) | page carries no price |
| 1296992 | 2021 METSO MINERALS ST2 . 8 (ME296310) | no images found on page |
| 1152405 | 2021 CATERPILLAR 930M (MT35996A) | page carries no price |
| 1152405 | 2021 CATERPILLAR 930M (MT35996A) | no images found on page |
| 22789 | 2018-CATERPILLAR-M1063170 (M1063170) | page carries no price |
| 22789 | 2018-CATERPILLAR-M1063170 (M1063170) | no images found on page |
