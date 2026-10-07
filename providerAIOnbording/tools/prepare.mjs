// One-off preparation for a dealer catalog import.
//
//   node tools/prepare.mjs normalize      -- data fixes only, no network
//   node tools/prepare.mjs scrape         -- fetch listing pages (resumable, disk-cached)
//   node tools/prepare.mjs manifests      -- emit importable chunks + discrepancy report
//   node tools/prepare.mjs all
//
// Deliberately offline tooling: it hits a third-party site once per machine, which is data
// acquisition, not a platform capability.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from './lib/normalize.mjs';
import { parseListingPage, crossCheck } from './lib/scrape.mjs';
import { validateManifest } from './lib/validate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(root, 'toromont_machines.json');
const OUT = path.join(root, 'out');
const CACHE = path.join(OUT, 'pages');

const CONFIG = {
  source: 'toromontequip.com',
  manifestVersion: 1,
  maxRecordsPerChunk: 700,
  maxImagesPerRecord: 1,
  // The export was captured once; the listing page is live. Where the two disagree the page has
  // always been the LOWER of the two, so trusting the export would publish a price above the
  // dealer's own website. Flip to false to publish the export value verbatim instead.
  preferPagePrice: true,
  scrapeConcurrency: 4,
  scrapeDelayMs: 250,
  scrapeRetries: 2,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const writeJson = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
};

async function stageNormalize() {
  const raw = await readJson(SOURCE);
  const result = normalize(raw);

  await writeJson(path.join(OUT, 'normalized.json'), result);

  const byKind = result.notes.reduce((acc, n) => {
    acc[n.kind] = (acc[n.kind] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`normalize: ${raw.records.length} source rows -> ${result.records.length} records, ${result.areas.length} service areas`);
  for (const [kind, count] of Object.entries(byKind).sort()) console.log(`  ${kind}: ${count}`);

  const names = new Set(result.records.map((r) => r.name.toLowerCase()));
  if (names.size !== result.records.length) throw new Error(`name collision survived: ${result.records.length - names.size}`);
  const ids = new Set(result.records.map((r) => r.externalId));
  if (ids.size !== result.records.length) throw new Error('externalId collision survived');
  console.log(`  names unique: ${names.size}/${result.records.length}`);

  const taxonomy = new Set(result.records.map((r) => `${r.categoryName} >> ${r.subcategoryName}`));
  console.log(`  taxonomy pairs: ${taxonomy.size}`);
  return result;
}

async function fetchWithRetry(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': CONFIG.userAgent, Accept: 'text/html' },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt >= CONFIG.scrapeRetries) throw error;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

async function stageScrape() {
  const { records } = await readJson(path.join(OUT, 'normalized.json'));
  await fs.mkdir(CACHE, { recursive: true });

  const scraped = {};
  let done = 0;
  let fromCache = 0;
  let failed = 0;

  const queue = [...records];
  const worker = async () => {
    while (queue.length) {
      const record = queue.shift();
      if (!record) return;

      const cacheFile = path.join(CACHE, `${record.externalId}.json`);
      try {
        scraped[record.externalId] = await readJson(cacheFile);
        fromCache++;
      } catch {
        if (!record.sourceUrl) {
          scraped[record.externalId] = { images: [], price: null, currency: null, brand: null, model: null, error: 'no source url' };
        } else {
          try {
            const parsed = parseListingPage(await fetchWithRetry(record.sourceUrl));
            scraped[record.externalId] = parsed;
            await writeJson(cacheFile, parsed);
          } catch (error) {
            failed++;
            scraped[record.externalId] = { images: [], price: null, currency: null, brand: null, model: null, error: String(error.message ?? error) };
          }
        }
        await new Promise((r) => setTimeout(r, CONFIG.scrapeDelayMs));
      }

      if (++done % 25 === 0 || done === records.length) {
        console.log(`scrape: ${done}/${records.length} (cache ${fromCache}, failed ${failed})`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONFIG.scrapeConcurrency }, worker));
  await writeJson(path.join(OUT, 'scraped.json'), scraped);

  const withImages = Object.values(scraped).filter((s) => s.images.length > 0).length;
  console.log(`scrape: ${withImages}/${records.length} records have at least one image, ${failed} fetch failures`);
  return scraped;
}

async function stageManifests() {
  const { records, areas, notes } = await readJson(path.join(OUT, 'normalized.json'));
  let scraped = {};
  try {
    scraped = await readJson(path.join(OUT, 'scraped.json'));
  } catch {
    console.warn('manifests: no scraped.json — emitting manifests without images');
  }

  const discrepancies = [];
  const priceOverrides = [];
  const enriched = records.map((record) => {
    const page = scraped[record.externalId];
    const images = (page?.images ?? []).slice(0, CONFIG.maxImagesPerRecord);

    if (page && !page.error) {
      for (const issue of crossCheck(record, page)) {
        discrepancies.push({ id: record.externalId, name: record.name, issue });
      }
    } else if (page?.error) {
      discrepancies.push({ id: record.externalId, name: record.name, issue: `page fetch failed: ${page.error}` });
    }

    const { sourceUrl, ...rest } = record;

    // Only ever adopt a price the page actually states; a page with no price leaves the export alone.
    let price = rest.price;
    if (CONFIG.preferPagePrice && page && !page.error && page.price !== null
        && (price === null || price === undefined || Math.abs(Number(price) - page.price) > 0.5)) {
      priceOverrides.push({
        id: record.externalId, name: record.name,
        from: price ?? null, to: page.price,
      });
      price = page.price;
    }

    return { ...rest, price, imageUrls: images };
  });

  // Chunk on branch boundaries: a branch is one service area, so a chunk is self-contained and a
  // re-run of it is a clean no-op. Branches over the cap split; small ones pack together.
  const groups = new Map();
  for (const record of enriched) {
    const key = record.serviceAreaName ?? '(no branch)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  const chunks = [];
  let current = [];
  let currentLabels = [];
  // CatalogManifest.ChunkLabel is capped at 200 chars; packing 14 branches blows past that.
  const label = (labels) => {
    const joined = labels.join(' + ');
    return joined.length <= 180 ? joined : `${labels[0]} + ${labels.length - 1} more branches`;
  };

  const flush = () => {
    if (!current.length) return;
    chunks.push({ label: label(currentLabels), records: current });
    current = [];
    currentLabels = [];
  };

  for (const [label, group] of [...groups.entries()].sort((a, b) => a[1].length - b[1].length)) {
    if (group.length > CONFIG.maxRecordsPerChunk) {
      flush();
      for (let i = 0; i < group.length; i += CONFIG.maxRecordsPerChunk) {
        const slice = group.slice(i, i + CONFIG.maxRecordsPerChunk);
        chunks.push({ label: `${label} (${Math.floor(i / CONFIG.maxRecordsPerChunk) + 1})`, records: slice });
      }
      continue;
    }
    if (current.length + group.length > CONFIG.maxRecordsPerChunk) flush();
    current.push(...group);
    currentLabels.push(label);
  }
  flush();

  const chunkDir = path.join(OUT, 'chunks');
  await fs.rm(chunkDir, { recursive: true, force: true });

  const areasByName = new Map(areas.map((a) => [a.name, a]));
  const invalid = [];
  for (const [index, chunk] of chunks.entries()) {
    const used = [...new Set(chunk.records.map((r) => r.serviceAreaName).filter(Boolean))];
    const manifest = {
      manifestVersion: CONFIG.manifestVersion,
      source: CONFIG.source,
      generatedAt: new Date().toISOString(),
      chunkLabel: chunk.label,
      chunkIndex: index + 1,
      chunkCount: chunks.length,
      serviceAreas: used.map((name) => areasByName.get(name)).filter(Boolean),
      records: chunk.records,
    };

    const slug = String(index + 1).padStart(2, '0');

    // Fail here rather than let the operator discover a contract breach mid-import.
    const errors = validateManifest(manifest);
    if (errors.length) invalid.push({ chunk: `chunk-${slug}.json`, errors });

    await writeJson(path.join(chunkDir, `chunk-${slug}.json`), manifest);
  }

  if (invalid.length) {
    for (const { chunk, errors } of invalid) {
      console.error(`INVALID ${chunk}:`);
      for (const error of errors) console.error(`  - ${error}`);
    }
    throw new Error(`${invalid.length} chunk(s) violate the manifest contract`);
  }

  await writeReport({ records: enriched, areas, notes, discrepancies, chunks, priceOverrides });

  const withImages = enriched.filter((r) => r.imageUrls.length > 0).length;
  console.log(`manifests: ${chunks.length} chunks, ${enriched.length} records, ${withImages} with an image, ${discrepancies.length} discrepancies`);
  if (priceOverrides.length) {
    const delta = priceOverrides.reduce((n, o) => n + ((o.from ?? 0) - o.to), 0);
    console.log(`  price overrides taken from the live page: ${priceOverrides.length} (total ${delta >= 0 ? '-' : '+'}${Math.abs(delta).toLocaleString('en-CA')} CAD vs the export)`);
  }
  console.log(`  chunks -> ${chunkDir}`);
  console.log(`  report -> ${path.join(OUT, 'discrepancy-report.md')}`);
}

async function writeReport({ records, areas, notes, discrepancies, chunks, priceOverrides }) {
  const lines = [];
  const noteKinds = notes.reduce((acc, n) => { acc[n.kind] = (acc[n.kind] ?? 0) + 1; return acc; }, {});
  const withImages = records.filter((r) => r.imageUrls.length > 0).length;
  const withoutPrice = records.filter((r) => r.price === null || r.price === undefined).length;
  const taxonomy = [...new Set(records.map((r) => `${r.categoryName} >> ${r.subcategoryName}`))].sort();

  lines.push('# Toromont catalog import — pre-flight report', '');
  lines.push('Review this before running any import. Nothing here blocks the import; every item is a', 'judgement call for a human.', '');
  lines.push('## Totals', '');
  lines.push(`| Records ready | ${records.length} |`);
  lines.push('| --- | --- |');
  lines.push(`| Service areas | ${areas.length} |`);
  lines.push(`| Taxonomy pairs | ${taxonomy.length} |`);
  lines.push(`| Chunks | ${chunks.length} |`);
  lines.push(`| With an image | ${withImages} (${((withImages / records.length) * 100).toFixed(1)}%) |`);
  lines.push(`| Without a price | ${withoutPrice} |`);
  lines.push('');

  lines.push('## Normalization applied', '');
  if (Object.keys(noteKinds).length === 0) lines.push('_none_', '');
  else {
    lines.push('| Kind | Count |', '| --- | --- |');
    for (const [kind, count] of Object.entries(noteKinds).sort()) lines.push(`| ${kind} | ${count} |`);
    lines.push('');
    for (const kind of Object.keys(noteKinds).sort()) {
      lines.push(`### ${kind}`, '');
      for (const note of notes.filter((n) => n.kind === kind)) {
        lines.push(`- \`${note.id}\`: ${note.from ?? '(none)'} → ${note.to ?? '(dropped)'}`);
      }
      lines.push('');
    }
  }

  lines.push('## Taxonomy to be created', '');
  for (const pair of taxonomy) lines.push(`- ${pair}`);
  lines.push('');

  lines.push('## Service areas to be created', '');
  for (const area of [...areas].sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`- ${area.name} — city \`${area.city ?? ''}\`, state \`${area.state ?? ''}\`, country \`${area.country ?? ''}\``);
  }
  lines.push('');

  lines.push('## Chunk plan', '');
  lines.push('| # | Label | Records |', '| --- | --- | --- |');
  for (const [index, chunk] of chunks.entries()) {
    lines.push(`| ${index + 1} | ${chunk.label} | ${chunk.records.length} |`);
  }
  lines.push('');

  lines.push('## Prices taken from the live listing page', '');
  lines.push(`\`preferPagePrice\` is **${CONFIG.preferPagePrice}**. The export was captured once; the page is`,
    'live. Every override below is the page disagreeing with the export — review them, and set',
    '`preferPagePrice: false` in `tools/prepare.mjs` if the export should win instead.', '');
  if (!priceOverrides.length) lines.push('_none_', '');
  else {
    lines.push('| Id | Name | Export | Published (page) | Delta |', '| --- | --- | --- | --- | --- |');
    for (const o of priceOverrides) {
      const delta = o.from === null ? '—' : (o.to - o.from).toLocaleString('en-CA');
      lines.push(`| ${o.id} | ${o.name} | ${o.from ?? '(none)'} | ${o.to} | ${delta} |`);
    }
    lines.push('');
  }

  lines.push('## Page cross-check discrepancies', '');
  lines.push('Everything the page and the export disagreed on, including the overrides above.', '');
  if (discrepancies.length === 0) lines.push('_none_', '');
  else {
    lines.push('| Id | Name | Issue |', '| --- | --- | --- |');
    for (const d of discrepancies) lines.push(`| ${d.id} | ${d.name} | ${d.issue} |`);
    lines.push('');
  }

  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, 'discrepancy-report.md'), lines.join('\n'), 'utf8');
}

const stage = process.argv[2] ?? 'all';
const stages = { normalize: stageNormalize, scrape: stageScrape, manifests: stageManifests };

if (stage === 'all') {
  await stageNormalize();
  await stageScrape();
  await stageManifests();
} else if (stages[stage]) {
  await stages[stage]();
} else {
  console.error(`unknown stage "${stage}" — expected one of: normalize, scrape, manifests, all`);
  process.exit(1);
}
