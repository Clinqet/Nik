// Pulls each machine's own gallery + microdata off its listing page.
//
// `<meta itemprop="image">` is the ONLY reliable anchor: it appears exclusively inside the product's
// media block, so it never picks up the ~120 related-machine thumbnails also present on the page.
// The same microdata block carries price/priceCurrency/brand/model, which gives a free cross-check
// against the export we were handed.

const META_IMAGE = /<meta\s+itemprop=["']image["']\s+content=["']([^"']+)["']\s*\/?>/gi;
const microdata = (prop) =>
  new RegExp(`itemprop=["']${prop}["']\\s+content=["']([^"']*)["']`, 'i');

const PRICE = microdata('price');
const CURRENCY = microdata('priceCurrency');

// brand/model are itemscope wrappers whose value sits in a nested name meta.
const BRAND_BLOCK = /itemprop=["']brand["'][^>]*>\s*<meta\s+itemprop=["']name["']\s+content=["']([^"']*)["']/i;
const MODEL_BLOCK = /itemprop=["']model["'][^>]*>\s*<meta\s+itemprop=["']name["']\s+content=["']([^"']*)["']/i;

export function parseListingPage(html) {
  const images = [];
  const seen = new Set();
  for (const match of html.matchAll(META_IMAGE)) {
    const url = decodeHtmlEntities(match[1].trim());
    if (url && !seen.has(url)) { seen.add(url); images.push(url); }
  }

  const price = PRICE.exec(html)?.[1]?.trim();
  const parsedPrice = price !== undefined && price !== '' ? Number(price) : null;

  return {
    images,
    price: Number.isFinite(parsedPrice) ? parsedPrice : null,
    currency: CURRENCY.exec(html)?.[1]?.trim() || null,
    brand: BRAND_BLOCK.exec(html)?.[1]?.trim() || null,
    model: MODEL_BLOCK.exec(html)?.[1]?.trim() || null,
  };
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&#39;', "'");
}

// Compares the export against what the page itself says. Anything reported here is reviewed by a
// human before an import runs — the export's price is what actually gets published.
export function crossCheck(record, page) {
  const issues = [];

  if (page.price === null) {
    issues.push('page carries no price');
  } else if (record.price === null || record.price === undefined) {
    issues.push(`export has no price, page says ${page.price}`);
  } else if (Math.abs(Number(record.price) - page.price) > 0.5) {
    issues.push(`price mismatch: export ${record.price} vs page ${page.price}`);
  }

  if (page.currency && record.currency && page.currency.toUpperCase() !== record.currency.toUpperCase()) {
    issues.push(`currency mismatch: export ${record.currency} vs page ${page.currency}`);
  }

  const make = record.attributes.find((a) => a.label === 'Make')?.value;
  if (page.brand && make && !equalsLoose(page.brand, make)) {
    issues.push(`make mismatch: export "${make}" vs page "${page.brand}"`);
  }

  const model = record.attributes.find((a) => a.label === 'Model')?.value;
  if (page.model && model && !equalsLoose(page.model, model)) {
    issues.push(`model mismatch: export "${model}" vs page "${page.model}"`);
  }

  if (page.images.length === 0) issues.push('no images found on page');

  return issues;
}

// The export writes "CATERPILLAR LIFT" where the page says "CATERPILLAR", and models differ by
// punctuation ("150 - 15AWD" vs "15015AWD"), so compare on alphanumerics with containment either way.
function equalsLoose(a, b) {
  const norm = (v) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return true;
  return x === y || x.includes(y) || y.includes(x);
}
