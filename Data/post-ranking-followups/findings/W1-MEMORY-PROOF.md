# W1 — memory before/after, measured in the Flex instance shape (2 GB, 1 CPU, Linux)

Measured 2026-09-30. `docker run --memory=2g --memory-swap=2g --cpus=1 mcr.microsoft.com/dotnet/aspnet:10.0`, VmRSS
sampled every 10 ms (what the kernel's OOM killer counts). Each copy draws EVERY page at the 1024 reading box and page 1 at
the 2048 source-check box — the heaviest shape (nothing banked).

- **before** = `origin/master` of clinqetcore/shared/infrastructure (Docnet 2.6.0, every page drawn up front, flags 0, no gate)
- **after** = this branch (bblanchon PDFium 156 binding, `LIMITEDIMAGECACHE`, counted then drawn one page at a time, one
  process-wide `HeavyWorkGate` of 3)

| Document | copies | before peak | after peak | before time | after time |
|---|---|---|---|---|---|
| e-brochure-glanza (1 page, 15 × 166 in, 51 pictures) | 1 | 508 MB | **364 MB** | 4.9 s | 4.8 s |
| e-brochure-glanza | 8 | 1,676 MB | **521 MB** | 18.7 s | 13.9 s |
| Baleno (11 pages, 15 × 70 in) | 1 | 235 MB | 264 MB | 5.6 s | 5.4 s |
| Baleno | 8 | 626 MB | **418 MB** | 43.7 s | 33.8 s |
| MG Windsor (46 pages) | 1 | 258 MB | 260 MB | 6.8 s | 5.6 s |
| MG Windsor | 8 | 886 MB | **495 MB** | 40.5 s | 30.2 s |
| hilux (28 scanned spreads) | 8 | 286 / 293 / 281 MB | 379* / 265 / 228 MB | 16.6 / 21.5 / 15.5 s | 25.2* / 13.4 / 13.6 s |

\* the first hilux run was noise on a 1-CPU container; two repeats of each side are shown.

`MALLOC_ARENA_MAX=2` (re-measured, as the plan required before relying on it): hilux ×8 202 MB (vs 228–265), glanza ×8
**466 MB** (vs 521); before-code glanza ×8 1,296 MB. It lowers the peak a further 10–15% — kept.

The after build ran from its portable publish inside Linux, resolving `runtimes/linux-x64/native/libpdfium.so` — the native
library loads on the same OS family as Flex.

Not measured here and still owed: the whole worker (host + clients) — the 512 MB kill needs no concurrency, which is why
dev instances move to 2 GB (`deploy.ps1`); and the Glanza replay in the sandbox after W3 (must end Ready).
