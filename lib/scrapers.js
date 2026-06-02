import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

async function fetchPage(url) {
  const resp = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.text();
}

function parsePrice(text) {
  if (!text) return null;
  const clean = text.replace(/[^\d,\.]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

function formatPrice(num, currency = '€') {
  if (!num) return null;
  return num.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

// ===== HORNBACH =====
async function scrapeHornbach(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  // Price in text like "459,00 €"
  let priceText = null;

  // Try structured data first
  const jsonLd = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean)
    .find(d => d['@type'] === 'Product' || d.offers);

  if (jsonLd?.offers?.price) {
    const num = parseFloat(jsonLd.offers.price);
    const currency = jsonLd.offers.priceCurrency || 'EUR';
    return { price_num: num, price: formatPrice(num, currency === 'EUR' ? '€' : currency), currency: currency === 'EUR' ? '€' : currency, available: jsonLd.offers.availability?.includes('InStock') ?? null };
  }

  // Fallback: find price in HTML
  const priceMatch = html.match(/Preis\s*[—–-]\s*([\d]+[,\.][\d]+)\s*€/);
  if (priceMatch) {
    const num = parsePrice(priceMatch[1]);
    return { price_num: num, price: formatPrice(num), currency: '€', available: true };
  }

  // Try meta og:price
  const metaPrice = $('meta[property="og:price:amount"]').attr('content') ||
                    $('meta[name="price"]').attr('content');
  if (metaPrice) {
    const num = parseFloat(metaPrice);
    return { price_num: num, price: formatPrice(num), currency: '€', available: true };
  }

  throw new Error('Cena ni najdena');
}

// ===== ZOOROYAL =====
async function scrapeZooroyal(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const jsonLd = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean)
    .find(d => d['@type'] === 'Product' || d.offers);

  if (jsonLd?.offers?.price) {
    const num = parseFloat(jsonLd.offers.price);
    const avail = jsonLd.offers.availability?.includes('InStock') ?? null;
    return { price_num: num, price: formatPrice(num), currency: '€', available: avail };
  }

  // Try price selectors
  const selectors = ['.price--default', '.product-detail-price', '[data-testid="price"]', '.price__regular', '.price'];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    const num = parsePrice(text);
    if (num && num > 0) return { price_num: num, price: formatPrice(num), currency: '€', available: true };
  }

  throw new Error('Cena ni najdena');
}

// ===== ZOOLOGO =====
async function scrapeZoologo(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const jsonLd = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean)
    .find(d => d['@type'] === 'Product' || d.offers);

  if (jsonLd?.offers?.price) {
    const num = parseFloat(jsonLd.offers.price);
    const avail = jsonLd.offers.availability?.includes('InStock') ?? null;
    return { price_num: num, price: formatPrice(num), currency: '€', available: avail };
  }

  const selectors = ['.price-box .price', '.product-info-price .price', '.price'];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    const num = parsePrice(text);
    if (num && num > 0) return { price_num: num, price: formatPrice(num), currency: '€', available: true };
  }

  throw new Error('Cena ni najdena');
}

// ===== DEHNER =====
async function scrapeDehner(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const jsonLd = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean)
    .find(d => d['@type'] === 'Product' || d.offers);

  if (jsonLd?.offers?.price) {
    const num = parseFloat(jsonLd.offers.price);
    return { price_num: num, price: formatPrice(num), currency: '€', available: jsonLd.offers.availability?.includes('InStock') ?? null };
  }

  const selectors = ['.price--current', '.product-detail__price', '.price'];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    const num = parsePrice(text);
    if (num && num > 0) return { price_num: num, price: formatPrice(num), currency: '€', available: true };
  }

  throw new Error('Cena ni najdena');
}

// ===== AQUASABI =====
async function scrapeAquasabi(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const jsonLd = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean)
    .find(d => d['@type'] === 'Product' || d.offers);

  if (jsonLd?.offers?.price) {
    const num = parseFloat(jsonLd.offers.price);
    return { price_num: num, price: formatPrice(num), currency: '€', available: jsonLd.offers.availability?.includes('InStock') ?? null };
  }

  const selectors = ['.product-price', '.price', '#product-price'];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    const num = parsePrice(text);
    if (num && num > 0) return { price_num: num, price: formatPrice(num), currency: '€', available: true };
  }

  throw new Error('Cena ni najdena');
}

// ===== KOELLE ZOO =====
async function scrapeKoelleZoo(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const jsonLd = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean)
    .find(d => d['@type'] === 'Product' || d.offers);

  if (jsonLd?.offers?.price) {
    const num = parseFloat(jsonLd.offers.price);
    return { price_num: num, price: formatPrice(num), currency: '€', available: jsonLd.offers.availability?.includes('InStock') ?? null };
  }

  const selectors = ['.price--current', '.price', '.product-price'];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    const num = parsePrice(text);
    if (num && num > 0) return { price_num: num, price: formatPrice(num), currency: '€', available: true };
  }

  throw new Error('Cena ni najdena');
}

// ===== OLIBETTA =====
async function scrapeOlibetta(url) {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const jsonLd = $('script[type="application/ld+json"]').toArray()
    .map(el => { try { return JSON.parse($(el).html()); } catch { return null; } })
    .filter(Boolean)
    .find(d => d['@type'] === 'Product' || d.offers);

  if (jsonLd?.offers?.price) {
    const num = parseFloat(jsonLd.offers.price);
    const avail = jsonLd.offers.availability?.includes('InStock') ?? null;
    return { price_num: num, price: formatPrice(num), currency: '€', available: avail };
  }

  const selectors = ['.price--current', '.product-price', '.price', '[class*="price"]'];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    const num = parsePrice(text);
    if (num && num > 0) return { price_num: num, price: formatPrice(num), currency: '€', available: true };
  }

  throw new Error('Cena ni najdena');
}

// ===== ROUTER =====
export async function scrapeUrl(url) {
  const domain = new URL(url).hostname.toLowerCase();

  try {
    if (domain.includes('hornbach')) return await scrapeHornbach(url);
    if (domain.includes('zooroyal')) return await scrapeZooroyal(url);
    if (domain.includes('zoologo')) return await scrapeZoologo(url);
    if (domain.includes('dehner')) return await scrapeDehner(url);
    if (domain.includes('aquasabi')) return await scrapeAquasabi(url);
    if (domain.includes('koelle') || domain.includes('kölle')) return await scrapeKoelleZoo(url);
    if (domain.includes('olibetta')) return await scrapeOlibetta(url);
    // Generic fallback
    return await scrapeHornbach(url);
  } catch (err) {
    return { price_num: null, price: null, currency: '€', available: null, error: err.message };
  }
}

export function getShopName(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const parts = domain.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '.' + parts[parts.length - 1];
  } catch {
    return url;
  }
}

export function isOlibetta(url) {
  return new URL(url).hostname.includes('olibetta');
}
