// node --test tools/lib/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize, normalizeTaxonomy, normalizeYear, resolveArea,
  dedupeBySerial, assignNames, buildSummary, buildAttributes,
} from './normalize.mjs';
import { parseListingPage, crossCheck } from './scrape.mjs';
import { validateManifest } from './validate.mjs';

const machine = (over = {}) => ({
  id: '1991424', title: '2019 CATERPILLAR 420F2IT', year: 2019,
  make: 'CATERPILLAR', model: '420F2IT', stock_number: 'MB067440', serial: 'HWD03872',
  hours: 4872, price_cad: 77800, currency: 'CAD', branch: 'Moncton', branch_division: null,
  province: 'NB', location_raw: 'Moncton, NB', category: 'Construction and Mining',
  subcategory: 'Backhoe Loaders', inventory_type: 'Used', seller: 'Toromont Cat',
  deposit_cad: 500, rebuild_type: null, features: ['Air Conditioner', 'Beacon'], feature_count: 2,
  url: 'https://www.toromontequip.com/en/products/construction/backhoe-loaders/eq-mdm-1991424.html',
  ...over,
});

test('taxonomy: label pairs pass through untouched', () => {
  const notes = [];
  assert.deepEqual(normalizeTaxonomy(machine(), notes),
    { category: 'Construction and Mining', subcategory: 'Backhoe Loaders' });
  assert.equal(notes.length, 0);
});

test('taxonomy: url-slug forms map to the label form another record already uses', () => {
  const notes = [];
  assert.deepEqual(
    normalizeTaxonomy(machine({ category: 'construction', subcategory: 'wheel-loaders' }), notes),
    { category: 'Construction and Mining', subcategory: 'Wheel Loaders' });
  assert.deepEqual(notes.map((n) => n.kind), ['category-slug', 'subcategory-slug']);
});

test('taxonomy: the mis-slugged crushers pair lands under its labelled sibling', () => {
  const notes = [];
  assert.deepEqual(
    normalizeTaxonomy(machine({ category: 'crushers', subcategory: 'material-handling-arm' }), notes),
    { category: 'Attachments and Accessories', subcategory: 'Material Handling Arm' });
  assert.equal(notes[0].kind, 'taxonomy-pair-override');
});

test('taxonomy: an unmapped slug is dropped rather than published as a slug', () => {
  const notes = [];
  assert.equal(normalizeTaxonomy(machine({ category: 'brand-new-thing', subcategory: 'who-knows' }), notes), null);
  assert.equal(notes.at(-1).kind, 'taxonomy-unmapped-slug');
});

test('year: the 9999 sentinel and out-of-range values become null', () => {
  const notes = [];
  assert.equal(normalizeYear(machine({ year: 9999 }), notes), null);
  assert.equal(normalizeYear(machine({ year: 1900 }), notes), null);
  assert.equal(normalizeYear(machine({ year: null }), notes), null);
  assert.equal(normalizeYear(machine({ year: 2019 }), notes), 2019);
});

test('area: name keeps the branch label, city is stripped to something geocodable', () => {
  assert.deepEqual(resolveArea(machine({ location_raw: 'Concord (Lift), ON', province: 'ON' })),
    { name: 'Concord (Lift), ON', city: 'Concord', state: 'ON', country: 'Canada' });
  assert.deepEqual(resolveArea(machine({ location_raw: 'Guelph Rental, ON', province: 'ON' })),
    { name: 'Guelph Rental, ON', city: 'Guelph', state: 'ON', country: 'Canada' });
  assert.deepEqual(resolveArea(machine({ location_raw: 'Sherbrooke CCE, QC', province: 'QC' })),
    { name: 'Sherbrooke CCE, QC', city: 'Sherbrooke', state: 'QC', country: 'Canada' });
});

test('area: the two non-location branches produce no area at all', () => {
  assert.equal(resolveArea(machine({ location_raw: 'customer (lift)', province: null })), null);
  assert.equal(resolveArea(machine({ location_raw: 'fournisseur (lift)', province: null })), null);
});

test('dedupe: the same serial keeps the row carrying a real model in its title', () => {
  const notes = [];
  const good = machine({ id: '1943356', title: '2022 CATERPILLAR 304', stock_number: 'MT39960A', serial: 'AN401205', hours: 1822 });
  // Scraper-fallback titles just repeat the stock number, and this one has MORE hours — the
  // completeness score must still prefer the informative title over the hours tiebreak.
  const fallback = machine({ id: '1781872', title: '2022-CATERPILLAR-MT39960A', stock_number: 'MT39960A', serial: 'AN401205', hours: 9999 });

  const kept = dedupeBySerial([fallback, good], notes);

  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, '1943356');
  assert.equal(notes.filter((n) => n.kind === 'duplicate-serial').length, 1);
});

test('dedupe: rows without a serial are never merged', () => {
  const notes = [];
  const kept = dedupeBySerial([machine({ id: 'a', serial: '' }), machine({ id: 'b', serial: null })], notes);
  assert.equal(kept.length, 2);
});

test('names: identical titles are disambiguated by stock number', () => {
  const notes = [];
  const named = assignNames([
    machine({ id: '1', title: '2021 JUNGHEINRICH ETR345', stock_number: 'LM017719' }),
    machine({ id: '2', title: '2021 JUNGHEINRICH ETR345', stock_number: 'LM017717' }),
  ], notes);

  assert.deepEqual(named.map((n) => n.name), [
    '2021 JUNGHEINRICH ETR345 (LM017719)',
    '2021 JUNGHEINRICH ETR345 (LM017717)',
  ]);
  assert.equal(notes.length, 0);
});

test('names: a shared title AND stock number falls through to the serial', () => {
  const notes = [];
  const named = assignNames([
    machine({ id: '1', title: 'Same', stock_number: 'S1', serial: 'X1' }),
    machine({ id: '2', title: 'Same', stock_number: 'S1', serial: 'X2' }),
  ], notes);

  assert.deepEqual(named.map((n) => n.name), ['Same (S1) S/N X1', 'Same (S1) S/N X2']);
  assert.equal(notes.filter((n) => n.kind === 'name-disambiguated').length, 2);
});

// Backstop: with no serial to fall back on, the source id is the last resort.
test('names: identical rows with no serial fall through to the id', () => {
  const notes = [];
  const named = assignNames([
    machine({ id: '1', title: 'Same', stock_number: 'S1', serial: '' }),
    machine({ id: '2', title: 'Same', stock_number: 'S1', serial: '' }),
  ], notes);

  assert.deepEqual(named.map((n) => n.name), ['Same (S1)', 'Same (S1) #2']);
  assert.equal(new Set(named.map((n) => n.name.toLowerCase())).size, 2);
});

test('summary: the plural subcategory is singularised and hours agree in number', () => {
  assert.equal(
    buildSummary({ title: 't', year: 2019, make: 'CATERPILLAR', model: '420F2IT', hours: 4872, condition: 'Used', subcategory: 'Backhoe Loaders' }),
    'Used 2019 CATERPILLAR 420F2IT backhoe loader with 4,872 hours.');
  assert.equal(
    buildSummary({ title: 't', year: 2020, make: 'M', model: 'X', hours: 1, condition: 'Used', subcategory: 'Excavators' }),
    'Used 2020 M X excavator with 1 hour.');
  // "Underground Mining Equipment" must not lose a letter.
  assert.ok(buildSummary({ title: 't', year: 2017, make: 'M', model: 'X', hours: null, condition: 'Used', subcategory: 'Underground Mining Equipment' })
    .endsWith('underground mining equipment.'));
});

test('attributes: only present values are emitted, and every label is a known enum name', () => {
  const attributes = buildAttributes(machine({ rebuild_type: null }), 2019, { name: 'Moncton, NB' });
  const labels = attributes.map((a) => a.label);

  assert.deepEqual(labels, ['Make', 'Model', 'Year', 'StockNumber', 'SerialNumber', 'UsageHours', 'Condition', 'Branch', 'Seller']);
  assert.equal(attributes.find((a) => a.label === 'UsageHours').value, '4,872');
});

test('normalize: end-to-end over a small fixture', () => {
  const result = normalize({
    records: [
      machine(),
      machine({ id: '2', title: '2019 CATERPILLAR 420F2IT', stock_number: 'MB067441', serial: 'HWD03873' }),
      machine({ id: '3', location_raw: 'customer (lift)', province: null, serial: 'ZZ1', stock_number: 'S3', price_cad: null }),
    ],
  });

  assert.equal(result.records.length, 3);
  assert.equal(result.areas.length, 1);
  assert.equal(new Set(result.records.map((r) => r.name.toLowerCase())).size, 3);
  assert.equal(result.records[2].serviceAreaName, null);
  assert.ok(result.notes.some((n) => n.kind === 'no-service-area'));
  assert.ok(result.notes.some((n) => n.kind === 'missing-price'));
});

test('scrape: meta itemprop=image yields only the product gallery', () => {
  const html = `
    <div class="product media">
      <meta itemprop="image" content="https://s7d2.scene7.com/a?x=1&amp;y=2" />
      <meta itemprop="image" content="https://s7d2.scene7.com/b" />
    </div>
    <div class="related"><img src="https://s7d2.scene7.com/UNRELATED" /></div>
    <span itemprop="price" content="77800" /><span itemprop="priceCurrency" content="CAD" />
    <div itemprop="brand" itemtype="https://schema.org/Brand" itemscope>
      <meta itemprop="name" content="CATERPILLAR" /></div>
    <div itemprop="model" itemtype="https://schema.org/Model" itemscope>
      <meta itemprop="name" content="420F2" /></div>`;

  const page = parseListingPage(html);

  assert.deepEqual(page.images, ['https://s7d2.scene7.com/a?x=1&y=2', 'https://s7d2.scene7.com/b']);
  assert.equal(page.price, 77800);
  assert.equal(page.currency, 'CAD');
  assert.equal(page.brand, 'CATERPILLAR');
  assert.equal(page.model, '420F2');
});

test('scrape: a page with no product media yields nothing rather than guessing', () => {
  const page = parseListingPage('<html><img src="https://s7d2.scene7.com/x" /></html>');
  assert.deepEqual(page.images, []);
  assert.equal(page.price, null);
});

test('crossCheck: reports a stale export price and stays quiet on cosmetic differences', () => {
  const record = {
    price: 38399, currency: 'CAD',
    attributes: [{ label: 'Make', value: 'CATERPILLAR LIFT' }, { label: 'Model', value: '150 - 15AWD' }],
  };

  const stale = crossCheck(record, { price: 36699, currency: 'CAD', brand: 'CATERPILLAR', model: '15015AWD', images: ['x'] });
  assert.deepEqual(stale, ['price mismatch: export 38399 vs page 36699']);

  const clean = crossCheck(record, { price: 38399, currency: 'CAD', brand: 'CATERPILLAR', model: '15015AWD', images: ['x'] });
  assert.deepEqual(clean, []);
});

test('crossCheck: a missing image is reported', () => {
  const issues = crossCheck(
    { price: 1, currency: 'CAD', attributes: [] },
    { price: 1, currency: 'CAD', brand: null, model: null, images: [] });
  assert.deepEqual(issues, ['no images found on page']);
});

const validManifest = () => ({
  manifestVersion: 1, source: 'toromontequip.com', chunkLabel: 'Moncton, NB',
  chunkIndex: 1, chunkCount: 1,
  serviceAreas: [{ name: 'Moncton, NB', city: 'Moncton', state: 'NB', country: 'Canada' }],
  records: [{
    externalId: '1991424', name: '2019 CAT 420F2IT (MB067440)',
    categoryName: 'Construction and Mining', subcategoryName: 'Backhoe Loaders',
    serviceAreaName: 'Moncton, NB', summary: 'ok', price: 77800, currency: 'CAD',
    depositAmount: 500, attributes: [{ label: 'Make', value: 'CATERPILLAR' }],
    features: [], imageUrls: ['https://s7d2.scene7.com/x'],
  }],
});

test('validate: a well-formed manifest reports nothing', () => {
  assert.deepEqual(validateManifest(validManifest()), []);
});

test('validate: catches every contract breach the platform would reject', () => {
  const over = validManifest();
  over.chunkLabel = 'x'.repeat(201);
  assert.ok(validateManifest(over).some((e) => e.includes('chunkLabel exceeds 200')));

  const dupName = validManifest();
  dupName.records.push({ ...dupName.records[0], externalId: '2' });
  assert.ok(validateManifest(dupName).some((e) => e.includes('duplicate name')));

  const dupId = validManifest();
  dupId.records.push({ ...dupId.records[0], name: 'Other' });
  assert.ok(validateManifest(dupId).some((e) => e.includes('duplicate externalId')));

  const undeclared = validManifest();
  undeclared.records[0].serviceAreaName = 'Nowhere, ZZ';
  assert.ok(validateManifest(undeclared).some((e) => e.includes('undeclared service area')));

  const badLabel = validManifest();
  badLabel.records[0].attributes = [{ label: 'Colour', value: 'red' }];
  assert.ok(validateManifest(badLabel).some((e) => e.includes('not a CatalogAttributeLabel')));

  const badCurrency = validManifest();
  badCurrency.records[0].currency = 'XYZ';
  assert.ok(validateManifest(badCurrency).some((e) => e.includes('not a CurrencyCode')));

  const insecure = validManifest();
  insecure.records[0].imageUrls = ['http://s7d2.scene7.com/x'];
  assert.ok(validateManifest(insecure).some((e) => e.includes('not https')));

  const tooMany = validManifest();
  tooMany.records = Array.from({ length: 701 }, (_, i) => ({ ...tooMany.records[0], externalId: `e${i}`, name: `n${i}` }));
  assert.ok(validateManifest(tooMany).some((e) => e.includes('per-chunk cap')));

  const pricey = validManifest();
  pricey.records[0].price = 9_000_000;
  assert.ok(validateManifest(pricey).some((e) => e.includes('exceeds 5000000')));
});
