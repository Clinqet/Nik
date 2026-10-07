# W4 near-duplicate pictures — every pair checked on the real corpus (2026-09-30)

Owner ruling: check every pair the rule would merge on the real sandbox corpus; if even one is not truly the same picture, tighten until none are; give the full list.

## What was measured

42 sandbox files (Canada + India): each file's distinct pictures past the decorative floor, as the ingest extracts them. Every pair
whose shapes match within 1% was compared: **4,211 pairs**.

| Step | Pairs |
|---|---|
| Same shape (within 1%) | 4,211 |
| Pass the approved first check (32×32 colour, every channel's mean within 2%) | 123 |
| **Merged by the final rule** | **11** (6 pictures → 2) |

## Why the approved rule was tightened (twice)

1. **32×32 alone merges different products.** The equipment/catalogue look-alikes (AR-X1: two machines that differ only by the
   model number printed on them) pass it almost perfectly (0.0005). `kept-apart/sidebyside-005-*`.
2. **"Block by block at full size" still cannot tell a detailed photo at two sizes from a real look-alike.** Measured, confirmed by eye:
   - the same interior photo at two sizes differs by as much as a smartwatch showing another app screen (`kept-apart/*hycross*`);
   - the same dashboard in two trim colours, wood and red, passes the 2% first check (`kept-apart/sidebyside-091-*`);
   - a gradient that has an extra glow, and a white shape with a faint extra square, sit inside the range of true duplicates.
   Lining the pictures up first (sub-pixel registration + a light blur) narrowed the gap but never closed it: a smaller changed
   area (one number on a screen) would slip through.

**Final rule** (shipped): same shape within 1% → 32×32 first check (2%) → the larger drawn at the smaller's size (≤ 1,024 px) and
**every 4×4 block's average colour within 1% (≈ 2.5 of 255 levels) in every channel**. That leaves only differences no eye can see.
A detailed photo placed twice at two sizes therefore stays two pictures — exactly today's behaviour (no regression; the only cost
is one extra description, cents).

## The complete list of merges (all 11)

| File | Pictures | Worst block | What it is |
|---|---|---|---|
| MG Windsor EV brochure | 7b4b9e02421b 4529×1552, bfb9f716a4b7 4520×1549, 56a61e257917 4510×1546, cbaa61ff3e62 4506×1545, e16975999544 4308×1477 (10 pairs) | 0.0017–0.0020 | one dark gradient background placed five times at five sizes; the amplified difference is black (`merged/*MG*`) |
| LIC Jeevan Raksha brochure | 933942260526 478×210, 5768e3921c62 471×208 | 0.0044 | two near-black title pictures (the title's shape lives in the PDF's drawing, not in these pixels); what the product stores and shows for both is the same black rectangle (`merged/*LIC*`) |

Next pair not merged: the legender blurred background at 0.0235 — a true duplicate, left apart (safe side).

## Checked on the way — not a defect

Soft-masked PDF pictures (MG Windsor 47 of 82, innova-a4 41 of 47): the mask only feathers edges into the page; the colour data is the
full, correct photo (checked by eye), so no change was made.

Tool: `scratchpad/proof/neardup` (the product's own `KnowledgeImageSignature`); data: `all-same-shaped-pairs.tsv`.
