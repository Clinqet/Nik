// Pure transforms over the scraped dealer export. No network, no filesystem — so every rule here is
// unit-testable and the discrepancy report can be produced without touching the source site.

// Slug-form category/subcategory pairs the scraper derived from the URL instead of the page label.
// Every target below is the EXACT label form another record already uses, which is what proves the
// intent — except Power Systems, which has no labelled sibling anywhere in the export.
const PAIR_OVERRIDES = new Map([
  ['crushers>>material-handling-arm', ['Attachments and Accessories', 'Material Handling Arm']],
  ['power-systems>>engines-marine-propulsion-auxiliary', ['Power Systems', 'Engines - Marine Propulsion & Auxiliary']],
]);

const CATEGORY_SLUGS = new Map([
  ['construction', 'Construction and Mining'],
  ['material-handling', 'Material Handling'],
  ['power-systems', 'Power Systems'],
  ['crushers', 'Attachments and Accessories'],
]);

const SUBCATEGORY_SLUGS = new Map([
  ['dozers', 'Dozers'],
  ['excavators', 'Excavators'],
  ['motor-graders', 'Motor Graders'],
  ['underground-mining-equipment', 'Underground Mining Equipment'],
  ['wheel-loaders', 'Wheel Loaders'],
  ['forklifts', 'Forklifts'],
  ['material-handling-arm', 'Material Handling Arm'],
  ['engines-marine-propulsion-auxiliary', 'Engines - Marine Propulsion & Auxiliary'],
]);

// Branches whose "location" is not a place. The owner's instruction is that no service area is
// created for these; the machines still import and fall back to the business default area.
const NON_LOCATION_BRANCHES = new Set(['customer (lift)', 'fournisseur (lift)']);

const isSlug = (value) => typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);

export const PROVINCE_NAMES = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
};

export function normalizeTaxonomy(record, notes) {
  const rawCategory = (record.category ?? '').trim();
  const rawSubcategory = (record.subcategory ?? '').trim();

  const override = PAIR_OVERRIDES.get(`${rawCategory}>>${rawSubcategory}`);
  if (override) {
    notes.push({
      id: record.id, kind: 'taxonomy-pair-override',
      from: `${rawCategory} >> ${rawSubcategory}`, to: `${override[0]} >> ${override[1]}`,
    });
    return { category: override[0], subcategory: override[1] };
  }

  let category = rawCategory;
  let subcategory = rawSubcategory;

  if (isSlug(rawCategory) && CATEGORY_SLUGS.has(rawCategory)) {
    category = CATEGORY_SLUGS.get(rawCategory);
    notes.push({ id: record.id, kind: 'category-slug', from: rawCategory, to: category });
  }
  if (isSlug(rawSubcategory) && SUBCATEGORY_SLUGS.has(rawSubcategory)) {
    subcategory = SUBCATEGORY_SLUGS.get(rawSubcategory);
    notes.push({ id: record.id, kind: 'subcategory-slug', from: rawSubcategory, to: subcategory });
  }

  if (isSlug(category) || isSlug(subcategory)) {
    notes.push({
      id: record.id, kind: 'taxonomy-unmapped-slug',
      from: `${rawCategory} >> ${rawSubcategory}`, to: null,
    });
    return null;
  }

  return { category, subcategory };
}

export function normalizeYear(record, notes) {
  const year = record.year;
  if (year === null || year === undefined) return null;
  // 9999 is the source's "unknown" sentinel; anything outside a plausible build range is unusable.
  if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 2) {
    notes.push({ id: record.id, kind: 'year-implausible', from: String(year), to: null });
    return null;
  }
  return year;
}

export function resolveArea(record) {
  const raw = (record.location_raw ?? '').trim();
  if (!raw || NON_LOCATION_BRANCHES.has(raw.toLowerCase())) return null;

  const province = (record.province ?? '').trim().toUpperCase();
  // location_raw already reads "Branch, PROV"; drop the suffix to recover the branch on its own.
  const branch = province && raw.toUpperCase().endsWith(`, ${province}`)
    ? raw.slice(0, raw.length - province.length - 2).trim()
    : raw;

  return {
    name: raw,
    // Name keeps the dealer's own branch label so a provider recognises it; City is stripped down to
    // something geocodable, because that is what back-fills the area's coordinates at index time.
    city: toGeocodableCity(branch),
    state: province || null,
    country: province ? 'Canada' : null,
  };
}

// "Concord (Lift)" / "Guelph Rental" / "Sherbrooke CCE" are branch designations, not places.
const BRANCH_QUALIFIERS = /\s+(Rental|CCE|Lift|Manutention)$/i;

function toGeocodableCity(branch) {
  let city = branch.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  city = city.replace(BRANCH_QUALIFIERS, '').trim();
  return city || null;
}

// When the source lists the same machine several times, some rows carry a scraper-fallback title that
// just repeats the stock number ("2022-CATERPILLAR-MT39960A") instead of the model ("2022 CATERPILLAR
// 304"). Such a title is worth less than a real one, so score it explicitly rather than relying on a
// hours/price tiebreak to land on the good row by chance.
function hasModelBearingTitle(record) {
  const title = (record.title ?? '').trim();
  if (!title) return false;
  const stock = (record.stock_number ?? '').trim();
  if (stock && title.toUpperCase().includes(stock.toUpperCase())) return false;
  return true;
}

// Completeness score decides which of several rows describing the same physical machine survives.
function completeness(record) {
  const fields = ['price_cad', 'hours', 'year', 'serial', 'stock_number', 'branch', 'url'];
  let score = fields.reduce((n, f) => n + (record[f] === null || record[f] === undefined ? 0 : 1), 0);
  if (hasModelBearingTitle(record)) score += 2;
  score += Math.min(record.features?.length ?? 0, 40) / 100;
  return score;
}

// Serial number is the industry's unique machine identifier: same serial = same machine listed twice.
export function dedupeBySerial(records, notes) {
  const bySerial = new Map();
  const noSerial = [];

  for (const record of records) {
    const serial = (record.serial ?? '').trim();
    if (!serial) { noSerial.push(record); continue; }
    if (!bySerial.has(serial)) bySerial.set(serial, []);
    bySerial.get(serial).push(record);
  }

  const kept = [...noSerial];
  for (const [serial, group] of bySerial) {
    if (group.length === 1) { kept.push(group[0]); continue; }

    const ranked = [...group].sort((a, b) =>
      completeness(b) - completeness(a) ||
      (b.hours ?? 0) - (a.hours ?? 0) ||
      String(a.id).localeCompare(String(b.id)));

    kept.push(ranked[0]);
    for (const dropped of ranked.slice(1)) {
      notes.push({
        id: dropped.id, kind: 'duplicate-serial', from: serial,
        to: `kept ${ranked[0].id}`,
      });
    }
  }

  return kept;
}

// Title alone collides for 268 of 685 rows (worst case 14 identical). Stock number resolves all but
// one group; serial then id break the remainder. Service name is a natural key downstream, so a
// collision would silently drop machines rather than fail.
export function assignNames(records, notes) {
  const counts = new Map();
  const tally = (name) => counts.set(name, (counts.get(name) ?? 0) + 1);

  const base = records.map((record) => {
    const title = (record.title ?? '').trim().replace(/\s+/g, ' ');
    const stock = (record.stock_number ?? '').trim();
    const name = stock ? `${title} (${stock})` : title;
    tally(name.toLowerCase());
    return { record, title, name };
  });

  const used = new Set();
  return base.map(({ record, title, name }) => {
    let final = name;

    if (counts.get(name.toLowerCase()) > 1 || used.has(final.toLowerCase())) {
      const serial = (record.serial ?? '').trim();
      const candidate = serial ? `${name} S/N ${serial}` : name;
      final = used.has(candidate.toLowerCase()) ? `${name} #${record.id}` : candidate;
      notes.push({ id: record.id, kind: 'name-disambiguated', from: name, to: final });
    }

    if (used.has(final.toLowerCase())) {
      final = `${name} #${record.id}`;
      notes.push({ id: record.id, kind: 'name-disambiguated', from: name, to: final });
    }

    used.add(final.toLowerCase());
    return { record, title, name: final };
  });
}

// Subcategories are plural by nature ("Backhoe Loaders"); a summary describes one machine.
function singularize(subcategory) {
  const words = subcategory.trim().split(/\s+/);
  const last = words.at(-1);
  if (last && /s$/i.test(last) && !/(ss|us|is)$/i.test(last)) {
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(' ');
}

export function buildSummary({ title, year, make, model, hours, condition, subcategory }) {
  const parts = [];
  const headline = [year, make, model].filter(Boolean).join(' ') || title;
  parts.push(`${condition ? `${condition} ` : ''}${headline}`.trim());
  if (subcategory) parts.push(singularize(subcategory).toLowerCase());
  const lead = parts.join(' ');
  const hoursText = Number.isFinite(hours)
    ? ` with ${hours.toLocaleString('en-CA')} ${hours === 1 ? 'hour' : 'hours'}`
    : '';
  return `${lead.charAt(0).toUpperCase()}${lead.slice(1)}${hoursText}.`;
}

export function buildAttributes(record, normalizedYear, area) {
  const attributes = [];
  const push = (label, value) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (text) attributes.push({ label, value: text });
  };

  push('Make', record.make);
  push('Model', record.model);
  push('Year', normalizedYear);
  push('StockNumber', record.stock_number);
  push('SerialNumber', record.serial);
  push('UsageHours', Number.isFinite(record.hours) ? record.hours.toLocaleString('en-CA') : null);
  push('Condition', record.inventory_type);
  push('Branch', area ? area.name : null);
  push('Seller', record.seller);
  push('Rebuild', record.rebuild_type);

  return attributes;
}

export function normalize(raw) {
  const notes = [];
  const deduped = dedupeBySerial(raw.records ?? [], notes);
  const named = assignNames(deduped, notes);

  const areas = new Map();
  const records = [];

  for (const { record, name } of named) {
    const taxonomy = normalizeTaxonomy(record, notes);
    if (!taxonomy) continue;

    const year = normalizeYear(record, notes);
    const area = resolveArea(record);
    if (area && !areas.has(area.name)) areas.set(area.name, area);

    if (!area) {
      notes.push({
        id: record.id, kind: 'no-service-area',
        from: (record.location_raw ?? '(blank)').trim(), to: 'business default area',
      });
    }
    if (record.price_cad === null || record.price_cad === undefined) {
      notes.push({ id: record.id, kind: 'missing-price', from: null, to: 'imported without a price' });
    }

    records.push({
      externalId: String(record.id),
      name,
      categoryName: taxonomy.category,
      subcategoryName: taxonomy.subcategory,
      serviceAreaName: area ? area.name : null,
      summary: buildSummary({
        title: record.title, year, make: record.make, model: record.model,
        hours: record.hours, condition: record.inventory_type, subcategory: taxonomy.subcategory,
      }),
      price: record.price_cad ?? null,
      currency: record.currency ?? 'CAD',
      depositAmount: record.deposit_cad ?? null,
      attributes: buildAttributes(record, year, area),
      features: [...new Set((record.features ?? []).map((f) => String(f).trim()).filter(Boolean))],
      sourceUrl: record.url ?? null,
    });
  }

  return { records, areas: [...areas.values()], notes };
}
