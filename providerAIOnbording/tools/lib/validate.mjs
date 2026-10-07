// Mirrors the platform's CatalogManifest / CatalogManifestRecord / CatalogServiceAreaDto constraints
// so a chunk that the import would reject is caught here instead — at build time, not mid-run.
//
// Keep in step with clinqetshared/DTOs/AI/CatalogManifestDtos.cs.

const LIMITS = {
  manifestVersion: 1,
  source: 200,
  chunkLabel: 200,
  maxRecordsPerChunk: 700,
  externalId: 100,
  name: 150,
  categoryName: 150,
  subcategoryName: 150,
  serviceAreaName: 150,
  summary: 1000,
  attributeValue: 300,
  serviceAreaField: 100,
};

const ATTRIBUTE_LABELS = new Set([
  'Make', 'Model', 'Year', 'StockNumber', 'SerialNumber',
  'UsageHours', 'Condition', 'Branch', 'Seller', 'Rebuild',
]);

const CURRENCIES = new Set([
  'USD', 'CAD', 'INR', 'GBP', 'EUR', 'AUD', 'JPY', 'CNY', 'CHF', 'SEK',
  'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'RUB', 'BRL', 'ZAR',
]);

export function validateManifest(manifest, { maxAllowedPrice = 5_000_000 } = {}) {
  const errors = [];
  const fail = (message) => errors.push(message);

  const tooLong = (value, limit, what) => {
    if (typeof value === 'string' && value.length > limit) {
      fail(`${what} exceeds ${limit} chars (${value.length})`);
    }
  };

  if (manifest.manifestVersion !== LIMITS.manifestVersion) {
    fail(`manifestVersion must be ${LIMITS.manifestVersion}, got ${manifest.manifestVersion}`);
  }
  if (!manifest.source) fail('source is required');
  tooLong(manifest.source, LIMITS.source, 'source');
  tooLong(manifest.chunkLabel, LIMITS.chunkLabel, 'chunkLabel');

  if (!Array.isArray(manifest.records) || manifest.records.length === 0) fail('records is empty');
  if ((manifest.records?.length ?? 0) > LIMITS.maxRecordsPerChunk) {
    fail(`records ${manifest.records.length} exceeds the ${LIMITS.maxRecordsPerChunk} per-chunk cap`);
  }

  const declared = new Set();
  for (const area of manifest.serviceAreas ?? []) {
    if (!area.name) fail('a declared service area has no name');
    tooLong(area.name, LIMITS.serviceAreaName, 'serviceArea.name');
    for (const field of ['city', 'state', 'country']) {
      tooLong(area[field], LIMITS.serviceAreaField, `serviceArea.${field}`);
    }
    declared.add((area.name ?? '').toLowerCase());
  }

  const ids = new Set();
  const names = new Set();

  for (const record of manifest.records ?? []) {
    const where = `record ${record.externalId ?? '(no id)'}`;

    for (const [field, limit] of [
      ['externalId', LIMITS.externalId], ['name', LIMITS.name],
      ['categoryName', LIMITS.categoryName], ['subcategoryName', LIMITS.subcategoryName],
      ['summary', LIMITS.summary],
    ]) {
      if (limit && !record[field] && field !== 'summary') fail(`${where}: ${field} is required`);
      tooLong(record[field], limit, `${where}.${field}`);
    }

    // Set.add returns the Set, not a boolean — has/add, never `if (!set.add(x))`.
    if (ids.has(record.externalId)) fail(`${where}: duplicate externalId`);
    ids.add(record.externalId);

    const nameKey = (record.name ?? '').trim().toLowerCase();
    if (names.has(nameKey)) fail(`${where}: duplicate name "${record.name}"`);
    names.add(nameKey);

    if (record.serviceAreaName) {
      tooLong(record.serviceAreaName, LIMITS.serviceAreaName, `${where}.serviceAreaName`);
      if (!declared.has(record.serviceAreaName.toLowerCase())) {
        fail(`${where}: references undeclared service area "${record.serviceAreaName}"`);
      }
    }

    if (record.price !== null && record.price !== undefined) {
      if (!Number.isFinite(record.price) || record.price < 0) fail(`${where}: price is not a non-negative number`);
      if (record.price > maxAllowedPrice) fail(`${where}: price ${record.price} exceeds ${maxAllowedPrice}`);
    }
    if (record.depositAmount !== null && record.depositAmount !== undefined
        && (!Number.isFinite(record.depositAmount) || record.depositAmount < 0)) {
      fail(`${where}: depositAmount is not a non-negative number`);
    }
    if (record.currency && !CURRENCIES.has(record.currency)) {
      fail(`${where}: currency "${record.currency}" is not a CurrencyCode value`);
    }

    for (const attribute of record.attributes ?? []) {
      if (!ATTRIBUTE_LABELS.has(attribute.label)) {
        fail(`${where}: attribute label "${attribute.label}" is not a CatalogAttributeLabel value`);
      }
      if (!attribute.value) fail(`${where}: attribute "${attribute.label}" has no value`);
      tooLong(attribute.value, LIMITS.attributeValue, `${where}.attribute.${attribute.label}`);
    }

    for (const url of record.imageUrls ?? []) {
      if (!url.startsWith('https://')) fail(`${where}: image url is not https (${url})`);
    }
  }

  return errors;
}
